import {api} from "./api.js";

export const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
export const DAILY_MEDIA_BYTES = 2 * 1024 * 1024;
export const MAX_HOME_MEDIA_ITEMS = 10;
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
  if (file.size < 1 || file.size > MAX_MEDIA_BYTES) {
    throw new Error("Each media item must be 2 MiB or smaller, with a 2 MiB daily allowance per user.");
  }
}

async function upload(file, feature, allowedTypes) {
  ensureFile(file, allowedTypes, feature === "home_post" ? "media" : "image");
  const ticket = await api.createMediaUpload({
    feature,
    mimeType: file.type,
    sizeBytes: file.size,
    originalName: file.name
  });
  const put = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: ticket.requiredHeaders || {"Content-Type": file.type},
    body: file
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
  const totalBytes = list.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > DAILY_MEDIA_BYTES) {
    throw new Error("The selected media exceeds your 2 MiB daily allowance.");
  }
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
  const ids = [];
  for (const file of list) ids.push(await uploadHomeMedia(file));
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
