const mq = window.matchMedia?.("(prefers-color-scheme: dark)");

function readDraft(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

export const state = {
  user: null,
  profile: null,
  route: "home",
  activeThreadId: null,
  posts: [],
  moments: [],
  homeCursor: null,
  homeHasMore: false,
  homeLoading: false,
  homeLoaded: false,
  homeError: "",
  homeViewerFollowsAny: null,
  savedPosts: [],
  savedPostsCursor: null,
  savedPostsHasMore: false,
  savedPostsLoading: false,
  savedPostsLoaded: false,
  threads: [],
  threadsLoadedAt: 0,
  messages: [],
  skills: [],
  skillProfile: null,
  skillListingsMine: [],
  skillRequests: [],
  products: [],
  marketStores: [],
  marketSavedProductIds: [],
  savedMarketProducts: [],
  marketSort: "recommended",
  marketLoaded: false,
  marketCacheAt: 0,
  marketCacheQuery: "",
  skillsLoadedAt: 0,
  businessLoadedAt: 0,
  profileLoadedAt: 0,
  notificationsLoadedAt: 0,
  activeMarketStoreId: "",
  searchResults: [],
  homeSearchResults: [],
  chatSearchResults: [],
  skillsSearchQuery: "",
  chatSearchQuery: "",
  notifications: [],
  unreadNotifications: 0,
  searchQuery: "",
  searchScope: "all",
  theme: localStorage.getItem("marvel-theme") || "system",
  resolvedTheme: "light",
  loadingRoute: false,
  busyAction: "",
  unsubscribers: [],
  threadPeers: readDraft("marvel-thread-peers", {}),
  sellerDraft: readDraft("marvel-seller-draft", {
    storeId: "",
    name: "",
    description: "",
    category: "",
    location: "",
    agreed: false
  }),
  skillDraft: readDraft("marvel-skill-draft", {
    skillProfileUid: "",
    headline: "",
    bio: "",
    locationText: "",
    remote: true,
    yearsExperience: 0,
    category: "",
    listingTitle: "",
    listingDescription: "",
    currency: "NGN",
    priceFromMinor: "",
    deliveryTimeDays: "",
    tags: "",
    agreed: false
  }),
  sellerOnboardingStep: 0,
  skillOnboardingStep: 0,
  followingIds: [],
  followStats: {followersCount: 0, followingCount: 0},
  marketCategory: "all",
  skillCategory: "all",
  marketCategories: [],
  skillCategories: [],
  myStore: null,
  myProducts: [],
  commerceRequests: [],
  pendingMediaFile: null,
  pendingMediaFiles: [],
  pendingMediaProcessing: false,
  pendingEditMediaFiles: [],
  pendingEditMediaProcessing: false,
  pendingMomentFile: null,
  pendingProfilePhotoFile: null,
  pendingProfilePhotoPreview: "",
  pendingProfilePhotoInfo: "",
  pendingProductPhotoFile: null,
  pendingProductPhotoFiles: [],
  pendingProductPhotoPreview: "",
  pendingProductPhotoPreviews: [],
  pendingSkillPhotoFile: null,
  pendingSkillPhotoPreview: "",
  pendingSkillPhotoInfo: "",
  pushEnabled: false
};

export function resolveTheme() {
  state.resolvedTheme = state.theme === "system"
    ? (mq?.matches ? "dark" : "light")
    : state.theme;
  document.documentElement.dataset.theme = state.resolvedTheme;
}

export function setTheme(value) {
  state.theme = ["light", "dark", "system"].includes(value) ? value : "system";
  localStorage.setItem("marvel-theme", state.theme);
  resolveTheme();
}

export function saveSellerDraft() {
  try {
    localStorage.setItem("marvel-seller-draft", JSON.stringify(state.sellerDraft || {}));
  } catch {}
}

export function saveSkillDraft() {
  try {
    localStorage.setItem("marvel-skill-draft", JSON.stringify(state.skillDraft || {}));
  } catch {}
}

export function saveThreadPeers() {
  try {
    localStorage.setItem("marvel-thread-peers", JSON.stringify(state.threadPeers || {}));
  } catch {}
}

mq?.addEventListener?.("change", resolveTheme);
resolveTheme();

export function clearSubscriptions() {
  state.unsubscribers.splice(0).forEach((fn) => {
    try { fn(); } catch {}
  });
}

export function addSubscription(fn) {
  if (typeof fn === "function") state.unsubscribers.push(fn);
}
