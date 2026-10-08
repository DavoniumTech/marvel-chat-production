import {functions, httpsCallableFromURL, appCheckReady} from "./firebase.js";
import {appMeta} from "./config.js";

const names = [
  "getPlatformStatus", "ensureUserProfile", "updateProfile", "updateUserSettings",
  "registerDevice", "unregisterDevice", "markNotificationRead", "getMyNotificationSummary",
  "createPost", "updatePost", "deletePost", "createMoment", "deleteMoment",
  "reactToPost", "commentOnPost", "savePost",
  "createChatThread", "sendMessage", "markThreadRead", "deleteMessage",
  "upsertSkillProfile", "createSkillListing", "updateSkillListing", "deleteSkillListing",
  "createSkillRequest", "createSkillOffer", "acceptSkillOffer", "declineSkillOffer",
  "completeSkillRequest", "cancelSkillRequest", "createSkillReview",
  "createStore", "updateStoreProfile", "setStoreStatus", "createProduct", "updateProduct",
  "setProductInventory", "setProductAvailability", "archiveProduct", "createProductCategory",
  "createMarketCommerceRequest", "updateMarketCommerceRequestStatus", "createMarketProductReview",
  "discoverMarketProducts", "search",
  "createMediaUpload", "finalizeMediaUpload", "createMediaReadUrls",
  "followUser", "unfollowUser", "getFollowState", "getFollowList"
];

function callableUrl(name) {
  return `https://${appMeta.region}-${appMeta.projectId}.cloudfunctions.net/${name}`;
}

const fns = Object.fromEntries(
    names.map((name) => [
      name,
      httpsCallableFromURL(
          functions,
          callableUrl(name),
          {timeout: 70000},
      ),
    ]),
);

export async function call(name, data = {}) {
  if (!fns[name]) throw new Error(`Unknown operation: ${name}`);

  {
    const ok = await appCheckReady();
    if (!ok) {
      const err = new Error("App Check is not ready.");
      err.code = "app-check/unavailable";
      throw err;
    }
  }

  try {
    const response = await fns[name](data);
    return response.data;
  } catch (error) {
    if (typeof console !== "undefined" && console.debug) {
      console.debug(`[Marvel Chat] ${name} failed`, error?.code, error?.message);
    }
    throw error;
  }
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
