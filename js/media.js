import {api} from "./api.js";

export const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
export const DAILY_MEDIA_BYTES = 2 * 1024 * 1024;
export const MAX_HOME_MEDIA_ITEMS = 10;
const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_SOURCE_VIDEO_BYTES = 60 * 1024 * 1024;
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_TARGET_BYTES = Math.floor(MAX_MEDIA_BYTES * 0.92);
const VIDEO_TARGET_BYTES = Math.floor(MAX_MEDIA_BYTES * 0.90);

export const ALLOWED_HOME_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime"
]);

export const ALLOWED_MOMENT_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function ensureFile(file, allowedTypes, label) {
  if (!(file instanceof File)) throw new Error(`Choose a ${label} file.`);
  if (!allowedTypes.has(file.type)) {
    throw new Error(label === "media"
      ? "Use JPG, PNG, WebP, GIF, MP4, WebM, or MOV files."
      : "Use JPG, PNG, WebP, or GIF images.");
  }

  const maxSource = file.type.startsWith("video/") ?
    MAX_SOURCE_VIDEO_BYTES : MAX_SOURCE_IMAGE_BYTES;

  if (file.size < 1 || file.size > maxSource) {
    throw new Error(
        `${label === "media" ? "Media" : "Image"} is too large to optimize in this browser. ` +
        `Choose a smaller file.`
    );
  }
}

function fileNameWithExtension(name, extension) {
  const clean = String(name || "media").replace(/[^a-zA-Z0-9._-]/g, "_");
  return clean.replace(/\.[^.]+$/, "") + extension;
}

async function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image compression failed.")), type, quality);
  });
}

async function loadImageBitmap(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) return file;

  const source = await loadImageBitmap(file);
  try {
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
    let width = Math.max(1, Math.round(sourceWidth * scale));
    let height = Math.max(1, Math.round(sourceHeight * scale));

    for (let pass = 0; pass < 5; pass += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", {alpha: true});
      if (!ctx) throw new Error("Image compression is not supported in this browser.");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, width, height);

      for (const quality of [0.84, 0.76, 0.68, 0.60, 0.52, 0.46]) {
        const blob = await canvasToBlob(canvas, "image/webp", quality);
        if (blob.size <= IMAGE_TARGET_BYTES) {
          return new File([blob], fileNameWithExtension(file.name, ".webp"), {
            type: "image/webp",
            lastModified: Date.now()
          });
        }
      }

      width = Math.max(480, Math.round(width * 0.82));
      height = Math.max(480, Math.round(height * 0.82));
    }
  } finally {
    source.close?.();
  }

  throw new Error("This image could not be compressed below the 2 MiB daily upload allowance.");
}

function supportedVideoMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function compressVideoAtBitrate(file, videoBitsPerSecond) {
  const mimeType = supportedVideoMime();
  if (!mimeType) return null;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Video could not be read."));
    });

    const stream = video.captureStream?.() || video.mozCaptureStream?.();
    if (!stream) return null;

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond,
      audioBitsPerSecond: 32000
    });

    const chunks = [];
    const result = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error("Video compression failed."));
      recorder.onstop = () => resolve(new Blob(chunks, {type: mimeType}));
    });

    const stop = () => {
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
    };

    video.onended = stop;
    recorder.start(250);

    try {
      await video.play();
    } catch {
      video.muted = true;
      await video.play();
    }

    const blob = await result;
    return blob;
  } finally {
    URL.revokeObjectURL(url);
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
}

async function compressVideo(file) {
  if (!file.type.startsWith("video/")) return file;
  if (file.size <= VIDEO_TARGET_BYTES) return file;

  const probeUrl = URL.createObjectURL(file);
  const probe = document.createElement("video");
  probe.preload = "metadata";
  probe.src = probeUrl;

  let duration = 0;
  try {
    await new Promise((resolve, reject) => {
      probe.onloadedmetadata = () => resolve();
      probe.onerror = () => reject(new Error("Video could not be read."));
    });
    duration = Number.isFinite(probe.duration) ? Math.max(1, probe.duration) : 1;
  } finally {
    URL.revokeObjectURL(probeUrl);
    probe.removeAttribute("src");
    probe.load();
  }

  const totalTargetBits = VIDEO_TARGET_BYTES * 8;
  const audioBitsPerSecond = 32000;
  const firstBitrate = Math.max(
      90000,
      Math.min(650000, Math.floor(totalTargetBits / duration - audioBitsPerSecond)),
  );

  for (const bitrate of [
    firstBitrate,
    Math.max(70000, Math.floor(firstBitrate * 0.72)),
    Math.max(55000, Math.floor(firstBitrate * 0.52))
  ]) {
    const blob = await compressVideoAtBitrate(file, bitrate);
    if (!blob) break;
    if (blob.size <= VIDEO_TARGET_BYTES) {
      return new File([blob], fileNameWithExtension(file.name, ".webm"), {
        type: "video/webm",
        lastModified: Date.now()
      });
    }
  }

  if (file.size <= MAX_MEDIA_BYTES) return file;
  throw new Error(
      "This video could not be compressed below the 2 MiB daily allowance. Choose a shorter video."
  );
}

export async function prepareMediaFile(file, allowedTypes = ALLOWED_HOME_MEDIA_TYPES, label = "media") {
  ensureFile(file, allowedTypes, label);
  if (file.type.startsWith("image/")) return compressImage(file);
  if (file.type.startsWith("video/")) return compressVideo(file);
  return file;
}

async function upload(file, feature, allowedTypes) {
  const optimized = await prepareMediaFile(
      file,
      allowedTypes,
      feature === "home_post" ? "media" : "image",
  );

  if (optimized.size > MAX_MEDIA_BYTES) {
    throw new Error("The optimized media is still above the 2 MiB per-item limit. Choose a smaller file.");
  }

  const ticket = await api.createMediaUpload({
    feature,
    mimeType: optimized.type,
    sizeBytes: optimized.size,
    originalName: optimized.name
  });

  const put = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: ticket.requiredHeaders || {"Content-Type": optimized.type},
    body: optimized
  });

  if (!put.ok) throw new Error("The media upload could not be completed.");
  await api.finalizeMediaUpload({mediaId: ticket.mediaId});
  return ticket.mediaId;
}

export function validateHomeFiles(files) {
  const list = Array.from(files || []);
  if (!list.length) return [];
  if (list.length > MAX_HOME_MEDIA_ITEMS) {
    throw new Error(`A post can contain up to ${MAX_HOME_MEDIA_ITEMS} media items.`);
  }
  list.forEach((file) => ensureFile(file, ALLOWED_HOME_MEDIA_TYPES, "media"));
  return list;
}

export async function uploadHomeMedia(file) {
  return upload(file, "home_post", ALLOWED_HOME_MEDIA_TYPES);
}

export async function uploadHomePhoto(file) {
  return uploadHomeMedia(file);
}

export async function uploadHomeMediaFiles(files) {
  const list = validateHomeFiles(files);
  const prepared = [];
  let totalBytes = 0;

  for (const file of list) {
    const optimized = await prepareMediaFile(file, ALLOWED_HOME_MEDIA_TYPES, "media");
    if (optimized.size > MAX_MEDIA_BYTES) {
      throw new Error("An optimized media item is still above the 2 MiB per-item limit.");
    }
    prepared.push(optimized);
    totalBytes += optimized.size;
  }

  if (totalBytes > DAILY_MEDIA_BYTES) {
    throw new Error("The optimized selection exceeds your 2 MiB daily media allowance.");
  }

  const ids = [];
  for (const optimized of prepared) {
    const ticket = await api.createMediaUpload({
      feature: "home_post",
      mimeType: optimized.type,
      sizeBytes: optimized.size,
      originalName: optimized.name
    });
    const put = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: ticket.requiredHeaders || {"Content-Type": optimized.type},
      body: optimized
    });
    if (!put.ok) throw new Error("The media upload could not be completed.");
    await api.finalizeMediaUpload({mediaId: ticket.mediaId});
    ids.push(ticket.mediaId);
  }
  return ids;
}

export async function readPostMedia(postId, mediaIds) {
  if (!postId || !Array.isArray(mediaIds) || mediaIds.length === 0) return [];
  const result = await api.createMediaReadUrls({
    mediaIds,
    feature: "home_post",
    parentId: postId,
    parentCollection: "posts"
  });
  return Array.isArray(result?.urls) ? result.urls : [];
}

export async function uploadMomentPhoto(file) {
  return upload(file, "moment", ALLOWED_MOMENT_MEDIA_TYPES);
}

export async function readMomentMedia(momentId, mediaIds) {
  if (!momentId || !Array.isArray(mediaIds) || mediaIds.length === 0) return [];
  const result = await api.createMediaReadUrls({
    mediaIds,
    feature: "moment",
    parentId: momentId,
    parentCollection: "moments"
  });
  return Array.isArray(result?.urls) ? result.urls : [];
}
