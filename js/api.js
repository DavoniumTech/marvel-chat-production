import {httpsCallable} from "./firebase.js";

const names = [
"getPlatformStatus","ensureUserProfile","updateProfile","updateUserSettings",
  "registerDevice","unregisterDevice","markNotificationRead","getMyNotificationSummary",
  "dispatchNotificationPush","createPost","updatePost","deletePost","createMoment","deleteMoment",
  "reactToPost","commentOnPost","savePost","createChatThread","sendMessage","markThreadRead",
  "deleteMessage","upsertSkillProfile","createSkillListing","updateSkillListing","deleteSkillListing",
  "createSkillRequest","createSkillOffer","acceptSkillOffer","declineSkillOffer","completeSkillRequest",
  "cancelSkillRequest","createSkillReview","updateStoreProfile","setStoreStatus","createProductCategory",
  "updateProduct","setProductInventory","setProductAvailability","archiveProduct",
  "createMarketCommerceRequest","updateMarketCommerceRequestStatus","createMarketProductReview",
  "createStore","createProduct","discoverMarketProducts","search","createMediaUpload",
  "finalizeMediaUpload","createMediaReadUrls"
];

const fns = Object.fromEntries(names.map((name) => [name, httpsCallable(name)]));

export async function call(name, data = {}) {
  if (!fns[name]) throw new Error(`Unknown backend function: ${name}`);
  const response = await fns[name](data);
  return response.data;
}

export const api = new Proxy({}, {
  get: (_, prop) => fns[prop] ? (data = {}) => call(prop, data) : undefined
});

export async function healthCheck() {
  const projectEndpoint = "https://healthcheck-5owqjyl5qq-ew.a.run.app";
  const response = await fetch(projectEndpoint, {method: "GET", cache: "no-store"});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Health check failed (${response.status}).`);
  return data;
}

export {names as backendFunctionNames};
