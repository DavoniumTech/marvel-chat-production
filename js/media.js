import { api } from "./api.js";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function ensureImage(file) {
  if (!(file instanceof File)) {
    throw new Error("Choose an image file.");
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Use JPG, PNG, WebP, or GIF images.");
  }
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Images must be 2 MB or smaller.");
  }
}

export async function uploadHomePhoto(file) {
  ensureImage(file);

  const ticket = await api.createMediaUpload({
    feature: "home_post",
    mimeType: file.type,
    sizeBytes: file.size,
    originalName: file.name
  });

  const put = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: ticket.requiredHeaders || { "Content-Type": file.type },
    body: file
  });

  if (!put.ok) {
    throw new Error("The image could not be uploaded.");
  }

  await api.finalizeMediaUpload({ mediaId: ticket.mediaId });
  return ticket.mediaId;
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
  ensureImage(file);

  const ticket = await api.createMediaUpload({
    feature: "moment",
    mimeType: file.type,
    sizeBytes: file.size,
    originalName: file.name
  });

  const put = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: ticket.requiredHeaders || {"Content-Type": file.type},
    body: file
  });

  if (!put.ok) {
    throw new Error("The Moment image could not be uploaded.");
  }

  await api.finalizeMediaUpload({mediaId: ticket.mediaId});
  return ticket.mediaId;
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
