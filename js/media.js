import { api } from "./api.js";

const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
const TARGET_MEDIA_BYTES = Math.floor(MAX_MEDIA_BYTES * 0.90);
const MAX_POST_MEDIA = 10;
const MAX_IMAGE_DIMENSION = 2048;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const SUPPORTED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function assertSupported(file) {
  if (!(file instanceof File)) throw new Error("Please choose a valid media file.");
  const type = String(file.type || "").toLowerCase();
  if (!SUPPORTED_IMAGE_TYPES.has(type) && !SUPPORTED_VIDEO_TYPES.has(type)) {
    throw new Error("Supported media: JPG, PNG, WebP, GIF, MP4, WebM or MOV.");
  }
}

function makeFile(blob, name, type) {
  return new File([blob], name, {type, lastModified: Date.now()});
}

async function imageSource(file) {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // The Image object may still need the URL only while decoding.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function encodeImage(canvas, type, quality) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  return blob;
}

export async function compressImage(file) {
  assertSupported(file);
  const type = String(file.type || "").toLowerCase();
  if (type === "image/gif") {
    if (file.size <= TARGET_MEDIA_BYTES) return file;
    throw new Error("This GIF is larger than 2 MB. Please choose a smaller GIF.");
  }

  const source = await imageSource(file);
  const sourceWidth = source.width || source.naturalWidth || 0;
  const sourceHeight = source.height || source.naturalHeight || 0;
  if (!sourceWidth || !sourceHeight) throw new Error("The selected image could not be read.");

  let scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight));
  let quality = 0.84;
  let outputType = "image/webp";
  let blob = null;

  try {
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", {alpha: true});
      if (!ctx) throw new Error("Image compression is unavailable in this browser.");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, width, height);

      blob = await encodeImage(canvas, outputType, quality);
      if (blob && blob.size <= TARGET_MEDIA_BYTES) {
        const ext = outputType === "image/webp" ? "webp" : "jpg";
        return makeFile(blob, file.name.replace(/\.[^.]+$/, "") + `.${ext}`, outputType);
      }

      if (attempt >= 3) scale *= 0.82;
      else quality -= 0.09;
      quality = Math.max(0.34, quality);
    }
  } finally {
    if (typeof source.close === "function") source.close();
  }

  throw new Error("The image is still larger than 2 MB after compression. Please choose a smaller image.");
}

function recorderMimeType() {
  const choices = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return choices.find((value) => window.MediaRecorder?.isTypeSupported?.(value));
}

async function loadVideo(file) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.playsInline = true;
  video.muted = false;
  video.src = url;
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new Error("The selected video could not be read."));
  });
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    URL.revokeObjectURL(url);
    throw new Error("The selected video has no readable duration.");
  }
  return {video, url};
}

async function transcodeVideo(file, maxDimension, videoBitsPerSecond) {
  if (!window.MediaRecorder || !HTMLVideoElement.prototype.captureStream || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("This browser cannot compress video locally. Please use a modern Chrome, Edge, Firefox or Safari browser.");
  }

  const mimeType = recorderMimeType();
  if (!mimeType) throw new Error("This browser does not support WebM video encoding.");

  const {video, url} = await loadVideo(file);
  const duration = video.duration;
  const sourceStream = video.captureStream();
  const sourceAudioTracks = sourceStream.getAudioTracks();

  let width = video.videoWidth || 1280;
  let height = video.videoHeight || 720;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  width = Math.max(2, Math.round((width * scale) / 2) * 2);
  height = Math.max(2, Math.round((height * scale) / 2) * 2);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", {alpha: false});
  if (!ctx) {
    URL.revokeObjectURL(url);
    throw new Error("Video compression is unavailable in this browser.");
  }

  const outputStream = canvas.captureStream(20);
  for (const track of sourceAudioTracks) outputStream.addTrack(track);

  const recorder = new MediaRecorder(outputStream, {
    mimeType,
    videoBitsPerSecond,
    audioBitsPerSecond: sourceAudioTracks.length ? 48000 : 0,
  });

  const chunks = [];
  let drawTimer = 0;
  const draw = () => {
    if (video.ended || video.paused) return;
    ctx.drawImage(video, 0, 0, width, height);
    drawTimer = requestAnimationFrame(draw);
  };

  const blobPromise = new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error("Video compression failed in this browser."));
    recorder.onstop = () => resolve(new Blob(chunks, {type: mimeType.split(";")[0]}));
  });

  try {
    video.currentTime = 0;
    await video.play();
    recorder.start(1000);
    draw();
    await new Promise((resolve) => {
      video.onended = resolve;
      const guard = window.setInterval(() => {
        if (video.ended || video.currentTime >= duration - 0.05) {
          window.clearInterval(guard);
          try { recorder.stop(); } catch {}
          resolve();
        }
      }, 120);
    });
    if (drawTimer) cancelAnimationFrame(drawTimer);
    const blob = await blobPromise;
    return makeFile(blob, file.name.replace(/\.[^.]+$/, ".webm"), "video/webm");
  } finally {
    if (drawTimer) cancelAnimationFrame(drawTimer);
    sourceStream.getTracks().forEach((track) => track.stop());
    outputStream.getTracks().forEach((track) => track.stop());
    video.pause();
    video.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}

export async function compressVideo(file) {
  assertSupported(file);
  if (file.size <= TARGET_MEDIA_BYTES) {
    // Preserve already-small media to avoid avoidable generation loss.
    return file;
  }

  let last = null;
  const profiles = [
    {dimension: 720, bitrate: 360000},
    {dimension: 540, bitrate: 240000},
    {dimension: 360, bitrate: 150000},
  ];

  for (const profile of profiles) {
    try {
      const compressed = await transcodeVideo(file, profile.dimension, profile.bitrate);
      last = compressed;
      if (compressed.size <= TARGET_MEDIA_BYTES) return compressed;
    } catch (error) {
      last = error;
      break;
    }
  }

  if (last instanceof File && last.size > MAX_MEDIA_BYTES) {
    throw new Error("This video is still larger than 2 MB after compression. Please choose a shorter or smaller clip.");
  }
  if (last instanceof Error) throw last;
  throw new Error("This video is still larger than 2 MB after compression. Please choose a shorter or smaller clip.");
}

export async function prepareMedia(file) {
  assertSupported(file);
  const type = String(file.type || "").toLowerCase();
  const prepared = type.startsWith("image/") ? await compressImage(file) : await compressVideo(file);
  if (!prepared || prepared.size < 1 || prepared.size > MAX_MEDIA_BYTES) {
    throw new Error("Media must be 2 MB or smaller after compression.");
  }
  return prepared;
}

async function uploadPreparedMedia(file, feature) {
  const ticket = await api.createMediaUpload({
    feature,
    mimeType: file.type,
    sizeBytes: file.size,
    originalName: file.name,
  });
  const response = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: ticket.requiredHeaders || {"Content-Type": file.type},
    body: file,
  });
  if (!response.ok) throw new Error("The media could not be uploaded.");
  await api.finalizeMediaUpload({mediaId: ticket.mediaId});
  return ticket.mediaId;
}

export async function uploadHomeMedia(file, onStatus = () => {}) {
  const prepared = await prepareMedia(file);
  onStatus(`Uploading ${prepared.name}…`);
  return uploadPreparedMedia(prepared, "home_post");
}

export async function uploadMomentMedia(file, onStatus = () => {}) {
  const prepared = await prepareMedia(file);
  onStatus(`Uploading ${prepared.name}…`);
  return uploadPreparedMedia(prepared, "moment");
}

export async function uploadHomeMediaFiles(files, onStatus = () => {}) {
  const selected = Array.from(files || []);
  if (!selected.length) return [];
  if (selected.length > MAX_POST_MEDIA) {
    throw new Error(`You can attach up to ${MAX_POST_MEDIA} media items to one post.`);
  }

  const ids = [];
  for (let index = 0; index < selected.length; index += 1) {
    onStatus(`Preparing media ${index + 1} of ${selected.length}…`);
    ids.push(await uploadHomeMedia(selected[index], onStatus));
  }
  return ids;
}

export async function readPostMedia(postId, mediaIds) {
  if (!postId || !Array.isArray(mediaIds) || !mediaIds.length) return [];
  const result = await api.createMediaReadUrls({
    mediaIds,
    feature: "home_post",
    parentId: postId,
    parentCollection: "posts",
  });
  return Array.isArray(result?.urls) ? result.urls : [];
}

export async function readMomentMedia(momentId, mediaId) {
  if (!momentId || !mediaId) return [];
  const result = await api.createMediaReadUrls({
    mediaIds: [mediaId],
    feature: "moment",
    parentId: momentId,
    parentCollection: "moments",
  });
  return Array.isArray(result?.urls) ? result.urls : [];
}

export {MAX_MEDIA_BYTES, MAX_POST_MEDIA};
