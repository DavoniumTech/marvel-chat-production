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
  threads: [],
  messages: [],
  skills: [],
  products: [],
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
  unsubscribers: [],
  sellerDraft: readDraft("marvel-seller-draft", {
    name: "",
    description: "",
    category: "",
    location: "",
    agreed: false,
  }),
  skillDraft: readDraft("marvel-skill-draft", {
    title: "",
    bio: "",
    category: "",
    strengths: "",
    service: "",
    agreed: false,
  }),
  sellerOnboardingStep: 0,
  skillOnboardingStep: 0,
  followingIds: [],
  marketCategory: "all",
  skillCategory: "all",
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
    localStorage.setItem(
        "marvel-seller-draft",
        JSON.stringify(state.sellerDraft || {}),
    );
  } catch {}
}

export function saveSkillDraft() {
  try {
    localStorage.setItem(
        "marvel-skill-draft",
        JSON.stringify(state.skillDraft || {}),
    );
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
