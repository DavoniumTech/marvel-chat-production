import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, sendPasswordResetEmail, persistenceReady,
  GoogleAuthProvider, signInWithPopup, updateAuthProfile, initAppCheck,
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, onSnapshot, getBrowserFcmToken, onForegroundMessage
} from "./firebase.js";
import {api} from "./api.js";
import {
  state, setTheme, clearSubscriptions, addSubscription,
  saveSellerDraft, saveSkillDraft, saveThreadPeers
} from "./state.js";
import {
  esc, avatar, when, formatDate, toast, modal, closeModal, friendlyError
} from "./ui.js";
import {icon} from "./icons.js";
import {
  uploadHomePhoto, uploadHomeMedia, uploadHomeMediaFiles, readPostMedia, uploadMomentMedia, readMomentMedia,
  uploadProfilePhoto, readProfilePhoto, uploadMarketProductPhoto, readMarketProductMedia,
  uploadSkillListingPhoto, readSkillListingMedia, validateHomeFiles,
  prepareMediaFile, MAX_MEDIA_BYTES, DAILY_MEDIA_BYTES
} from "./media.js";

const app = document.getElementById("app");
const routes = [
  "home", "chat", "skills", "market", "profile", "search", "saved-posts",
  "notifications", "settings", "skill-profile", "business", "help",
  "seller-onboarding", "skill-onboarding"
];
const MARKET_CATEGORIES = [
  ["all", "All"], ["electronics", "Electronics"], ["phones", "Phones & Tablets"],
  ["computers", "Computers"], ["fashion", "Fashion"], ["beauty", "Beauty & Personal Care"],
  ["home", "Home & Living"], ["furniture", "Furniture"], ["food", "Food & Drinks"],
  ["health", "Health"], ["automotive", "Automotive"], ["agriculture", "Agriculture"],
  ["sports", "Sports & Fitness"], ["baby", "Baby & Kids"], ["books", "Books & Education"],
  ["services", "Services"], ["property", "Property"], ["arts", "Arts & Collectibles"],
  ["events", "Events"], ["other", "Other"]
];
const SKILL_CATEGORIES = [
  ["all", "All"], ["design", "Design"], ["programming", "Programming"], ["writing", "Writing"],
  ["marketing", "Marketing"], ["education", "Education"], ["business", "Business"], ["translation", "Translation"],
  ["photography", "Photography"], ["video", "Video"], ["music", "Music"], ["beauty", "Beauty"],
  ["fashion", "Fashion"], ["consulting", "Consulting"], ["repair", "Repairs"], ["personal", "Personal services"],
  ["fitness", "Fitness"], ["tutoring", "Tutoring"], ["engineering", "Engineering"], ["other", "Other"]
];
let authMode = "welcome";
let googleSignInPending = false;
let deferredInstallPrompt = null;
let offlineToastActive = false;
let homePaginationObserver = null;
let catalogueMediaObserver = null;
const carouselHydrationTimers = new Map();
let momentAutoCloseTimer = null;
window.addEventListener("beforeinstallprompt", (event) => {
  // Defer the browser prompt: users choose Install from the menu when ready.
  event.preventDefault();
  deferredInstallPrompt = event;
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  toast("Marvel Chat was installed successfully.", "success");
});
window.addEventListener("offline", () => {
  if (offlineToastActive) return;
  offlineToastActive = true;
  toast("You’re offline. Your current screen stays open; live actions will resume when you reconnect.", "info");
});
window.addEventListener("online", () => { offlineToastActive = false; });

const DISCOVERY_BANNER_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DISCOVERY_BANNER_AUTO_DISMISS_MS = 30 * 1000;
let discoveryBannerVisibleForUser = null;
let discoveryBannerTimer = null;
let discoveryBannerCloseTimer = null;
let discoveryBannerTimerUid = "";

function stopDiscoveryBannerTimer() {
  if (discoveryBannerTimer) clearTimeout(discoveryBannerTimer);
  if (discoveryBannerCloseTimer) clearTimeout(discoveryBannerCloseTimer);
  discoveryBannerTimer = null;
  discoveryBannerCloseTimer = null;
  discoveryBannerTimerUid = "";
}

function syncDiscoveryBannerTimer() {
  const overlay = app.querySelector("[data-discovery-overlay]");
  const uid = String(state.user?.uid || "");
  if (!overlay || !uid || discoveryBannerVisibleForUser !== true) {
    if (!overlay || !uid || discoveryBannerVisibleForUser !== true) stopDiscoveryBannerTimer();
    return;
  }
  if (discoveryBannerTimer && discoveryBannerTimerUid === uid) return;
  stopDiscoveryBannerTimer();
  discoveryBannerTimerUid = uid;
  discoveryBannerTimer = setTimeout(() => {
    discoveryBannerTimer = null;
    discoveryBannerTimerUid = "";
    if (String(state.user?.uid || "") !== uid) return;
    app.querySelector("[data-discovery-overlay]")?.classList.add("is-closing");
    discoveryBannerCloseTimer = setTimeout(() => {
      discoveryBannerCloseTimer = null;
      if (String(state.user?.uid || "") !== uid) return;
      discoveryBannerVisibleForUser = false;
      paint();
    }, 420);
  }, DISCOVERY_BANNER_AUTO_DISMISS_MS);
}

function shouldShowDiscoveryBanner() {
  if (discoveryBannerVisibleForUser !== null) return discoveryBannerVisibleForUser;
  const uid = String(state.user?.uid || "").trim();
  if (!uid) {
    discoveryBannerVisibleForUser = false;
    return false;
  }
  const key = `marvelchat.discovery-banner.last-shown.v1.${uid}`;
  try {
    const lastShown = Number(window.localStorage.getItem(key) || 0);
    if (Number.isFinite(lastShown) && lastShown > 0 &&
        Date.now() - lastShown < DISCOVERY_BANNER_INTERVAL_MS) {
      discoveryBannerVisibleForUser = false;
      return false;
    }
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // Local-storage restrictions must not prevent the app from rendering.
  }
  discoveryBannerVisibleForUser = true;
  return true;
}
let activeCommentPostId = null;
let activeCommentCursor = null;
let activeCommentLoading = false;
try { initAppCheck(); } catch {}

function googleButton() {
  return `<button class="btn btn-google btn-block" type="button" data-action="google-signin">
    ${icon("google", 20)}<span>Continue with Google</span>
  </button>`;
}

function authField(type, label, name, opts = {}) {
  const id = opts.id || `auth-${name}`;
  return `<label class="floating-field">
    <input id="${id}" name="${name}" type="${type}" autocomplete="${opts.autocomplete || "off"}" placeholder=" "
      ${opts.maxlength ? `maxlength="${opts.maxlength}"` : ""}
      ${opts.minlength ? `minlength="${opts.minlength}"` : ""} required>
    <span>${esc(label)}</span>
    ${opts.password ? `<button class="field-toggle" type="button" data-action="toggle-password" data-target="${id}">Show</button>` : ""}
  </label>`;
}

function legalLinks() {
  return `<p class="legal-copy">Please review our
    <button class="inline-link" type="button" data-action="legal-terms">Terms</button>,
    <button class="inline-link" type="button" data-action="legal-privacy">Privacy Policy</button>, and
    <button class="inline-link" type="button" data-action="legal-community">Community Guidelines</button> before joining.</p>`;
}

function authScreen() {
  const wrap = (body, klass = "") => `<main class="auth-page">
    <div class="auth-glow glow-one"></div><div class="auth-glow glow-two"></div>
    <section class="auth-wrap"><section class="auth-card ${klass}">
      <header class="auth-brand inside-card">
        <div class="brand-mark brand-mark-xl"><img src="./assets/brand/icon-192.png" alt="Marvel Chat"></div>
        <h1>Marvel Chat</h1><p>by Davonium Technologies</p>
      </header>
      ${body}
      <footer class="auth-foot">© 2026 Davonium Technologies. All rights reserved.</footer>
    </section></section>
  </main>`;

  if (authMode === "signup") {
    return wrap(`<div class="auth-heading"><span class="eyebrow">CREATE ACCOUNT</span><h2>Welcome to Marvel Chat</h2><p>Build your identity and join the community.</p></div>
      <form id="signup-form" class="form-stack auth-form">
        ${authField("text", "Full name", "displayName", {autocomplete: "name", maxlength: 80})}
        ${authField("text", "Username", "username", {autocomplete: "username", maxlength: 30})}
        ${authField("email", "Email", "email", {autocomplete: "email", maxlength: 254})}
        ${authField("password", "Password", "password", {autocomplete: "new-password", minlength: 6, maxlength: 128, password: true})}
        <label class="agree-row"><input type="checkbox" name="agreement" required><span>I agree to the Terms, Privacy Policy, and Community Guidelines.</span></label>
        ${legalLinks()}
        <button class="btn btn-primary btn-block btn-lg" type="submit">Create account</button>
      </form>
      <div class="auth-switch">Already have an account? <button type="button" data-action="auth-signin">Sign in</button></div>
      <button class="text-button auth-back" type="button" data-action="auth-welcome">Back</button>`, "auth-card-tall");
  }

  if (authMode === "signin") {
    return wrap(`<div class="auth-heading"><span class="eyebrow">WELCOME BACK</span><h2>Sign in</h2><p>Continue where you left off.</p></div>
      <form id="signin-form" class="form-stack auth-form">
        ${authField("email", "Email", "email", {autocomplete: "email", maxlength: 254})}
        ${authField("password", "Password", "password", {autocomplete: "current-password", maxlength: 128, password: true})}
        <div class="auth-row"><span></span><button class="inline-link" type="button" data-action="forgot-password">Forgot password?</button></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Sign in</button>
      </form>
      <div class="auth-divider"><span>or</span></div>${googleButton()}
      <div class="auth-switch">New to Marvel Chat? <button type="button" data-action="auth-signup">Create account</button></div>
      <button class="text-button auth-back" type="button" data-action="auth-welcome">Back</button>`);
  }

  if (authMode === "forgot") {
    return wrap(`<div class="auth-heading"><span class="eyebrow">ACCOUNT RECOVERY</span><h2>Reset your password</h2><p>Enter your email and we will send a secure reset link.</p></div>
      <form id="forgot-form" class="form-stack auth-form">
        ${authField("email", "Email", "email", {autocomplete: "email", maxlength: 254})}
        <button class="btn btn-primary btn-block btn-lg" type="submit">Send reset link</button>
      </form><button class="text-button auth-back" type="button" data-action="auth-signin">Back to sign in</button>`);
  }

  return wrap(`<div class="auth-heading auth-heading-welcome"><span class="eyebrow">WELCOME</span><h2>More than a chat.</h2><p>Connect with people, discover skills, explore opportunities, and build your world.</p></div>
    <div class="auth-actions">${googleButton()}<button class="btn btn-primary btn-block btn-lg" type="button" data-action="auth-signup">Create account</button><button class="btn btn-secondary btn-block" type="button" data-action="auth-signin">Sign in</button></div>
    <div class="auth-points"><span>${icon("shield", 16)}Secure identity</span><span>${icon("grid", 16)}One community</span><span>${icon("spark", 16)}Built to grow</span></div>`);
}

function topbar() {
  return `<header class="topbar"><div class="topbar-inner">
    <button class="desktop-brand" type="button" data-action="route-home">
      <span class="brand-mark brand-mark-sm"><img src="./assets/brand/icon-192.png" alt="Marvel Chat"></span>
      <span><strong>Marvel Chat</strong><small>Davonium Technologies</small></span>
    </button>
    <div class="top-actions">
      <button class="icon-btn" type="button" data-action="route-search" aria-label="Search">${icon("search",20)}</button>
      <button class="icon-btn notif-btn" type="button" data-action="route-notifications" aria-label="Notifications">${icon("bell",20)}${state.unreadNotifications ? `<b>${state.unreadNotifications > 9 ? "9+" : state.unreadNotifications}</b>` : ""}</button>
      <button class="icon-btn" type="button" data-action="open-menu" aria-label="Menu">${icon("menu",20)}</button>
    </div>
  </div></header>`;
}

function bottomBar() {
  const items = [["home","Home","home"],["chat","Chat","chat"],["skills","Skills","skills"],["market","Market","market"],["profile","Profile","profile"]];
  return `<nav class="bottom-bar" aria-label="Primary navigation">${items.map(([r,l,i]) => `<button class="nav-item ${state.route === r ? "active" : ""}" type="button" data-action="route-${r}">${icon(i,20)}<span>${l}</span></button>`).join("")}</nav>`;
}

function sideMenu() {
  return `<div id="menu-overlay" class="menu-layer" data-action="close-menu" aria-hidden="false">
    <aside class="side-menu" role="dialog" aria-modal="true" aria-label="More">
      <div class="menu-head"><div><span class="eyebrow">MARVEL CHAT</span><h2>More</h2></div>
        <button class="icon-btn" type="button" data-action="close-menu" aria-label="Close menu">${icon("close",20)}</button>
      </div>
      <button class="menu-item" type="button" data-action="route-search">${icon("search")}Search</button>
      <button class="menu-item" type="button" data-action="route-notifications">${icon("bell")}Notifications</button>
      <button class="menu-item" type="button" data-action="route-saved-posts">${icon("bookmark")}Saved posts</button>
      <button class="menu-item" type="button" data-action="install-app">${icon("download")}Install Marvel Chat</button>
      <button class="menu-item" type="button" data-action="route-help">${icon("help")}How to use Marvel Chat</button>
      <button class="menu-item" type="button" data-action="route-settings">${icon("settings")}Settings</button>
      <button class="menu-item" type="button" data-action="feedback">${icon("message")}Feedback</button>
      <div class="menu-sep"></div>
      <button class="menu-item" type="button" data-action="legal-terms">${icon("file")}Terms</button>
      <button class="menu-item" type="button" data-action="legal-privacy">${icon("lock")}Privacy</button>
      <button class="menu-item" type="button" data-action="legal-community">${icon("shield")}Community Guidelines</button>
      <div class="menu-foot">Davonium Technologies · © 2026</div>
      <button class="menu-item menu-sign-out" type="button" data-action="sign-out">${icon("logout")}Sign out</button>
    </aside>
  </div>`;
}

function shell(content, noBottom = false) {
  return `<div class="app-shell${noBottom ? " chat-open-shell" : ""}">${topbar()}<main class="main-scroll">${content}</main>${noBottom ? "" : bottomBar()}</div>`;
}
function emptyState(title, text, action = "", label = "") {
  return `<div class="empty-state"><div class="empty-icon">${icon("spark",19)}</div><strong>${esc(title)}</strong><span>${esc(text)}</span>${action ? `<button class="btn btn-secondary" type="button" data-action="${esc(action)}">${esc(label)}</button>` : ""}</div>`;
}
function head(kicker, title, desc = "", action = "", label = "", back = "") {
  return `<header class="screen-head"><div class="screen-head-main">${back ? `<button class="page-back" type="button" data-action="route-${esc(back)}" aria-label="Back">${icon("back",18)}<span>Back</span></button>` : ""}<div><span class="eyebrow">${esc(kicker)}</span><h1>${esc(title)}</h1>${desc ? `<p>${esc(desc)}</p>` : ""}</div></div>${action ? `<button class="btn btn-primary" type="button" data-action="${esc(action)}">${icon("plus",17)}${esc(label)}</button>` : ""}</header>`;
}
function stamp(v) { return v?.toDate ? v.toDate().getTime() : new Date(v || 0).getTime(); }
function uidOf(x) { return x?.uid || x?.userId || x?.authorUid || x?.creatorUid || x?.ownerUid || ""; }
function formatKB(bytes) { return `${(Math.max(0, Number(bytes) || 0) / 1024).toFixed(1)} KB`; }
function formatMiB(bytes) { return `${(Math.max(0, Number(bytes) || 0) / (1024 * 1024)).toFixed(2)} MiB`; }
function quotaRetryCopy(retryAt) {
  const retry = retryAt ? new Date(retryAt) : null;
  if (!retry || !Number.isFinite(retry.getTime())) return "Try again when recent media reaches its 24-hour expiry.";
  const minutesTotal = Math.ceil(Math.max(0, retry.getTime() - Date.now()) / 60000);
  const hours = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal % 60;
  return `Try again in about ${hours ? `${hours} h ` : ""}${minutes} min (around ${retry.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}).`;
}
function postTextHtml(value) {
  // Escaping happens before limited **bold** markup is introduced, so user HTML
  // cannot become executable markup. Newlines remain visible via pre-wrap CSS.
  return esc(value).replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
}
function postFormatToolbar(targetId) {
  return `<div class="post-format-toolbar" role="group" aria-label="Text formatting"><button class="format-button format-bold" type="button" data-action="format-post-bold" data-target="${esc(targetId)}" aria-label="Make selected text bold"><strong>B</strong></button><button class="format-button" type="button" data-action="format-post-normal" data-target="${esc(targetId)}">Normal</button><small>Select text, then choose Bold or Normal. Formatting is not shown as markup.</small></div>`;
}
function markdownToRichEditor(value) {
  return esc(String(value || "")).replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>").replace(/\r?\n/g, "<br>");
}
function richEditorNodeToText(node) {
  if (!node) return "";
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName;
  if (tag === "BR") return "\n";
  const inner = [...node.childNodes].map(richEditorNodeToText).join("");
  if (tag === "STRONG" || tag === "B") return inner ? `**${inner}**` : "";
  if (["DIV", "P"].includes(tag)) return inner + "\n";
  // Unknown pasted markup is flattened to text; formatting is restricted to bold.
  return inner;
}
function richEditorMarkdown(targetId) {
  const editor = document.getElementById(targetId);
  if (!editor) return "";
  return [...editor.childNodes].map(richEditorNodeToText).join("").replace(/\n+$/g, "").replace(/\u00a0/g, " ");
}
function applyPostTextFormatting(targetId, mode) {
  const field = document.getElementById(targetId);
  if (!field || !field.isContentEditable) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed ||
      !field.contains(selection.anchorNode) || !field.contains(selection.focusNode)) {
    toast("Select the text you want to format first.", "info");
    return;
  }
  // Preserve the user's selection and manipulate only the selected fragment.
  // This avoids editor engines inserting literal Markdown markers into the UI.
  const range = selection.getRangeAt(0).cloneRange();
  const selectedText = range.toString();
  if (!selectedText) {
    toast("Select the text you want to format first.", "info");
    return;
  }
  const fragment = range.extractContents();
  if (mode === "normal") {
    fragment.querySelectorAll?.("strong, b").forEach((node) => {
      node.replaceWith(...node.childNodes);
    });
    const parent = range.startContainer?.parentElement;
    if (parent && field.contains(parent) && parent.matches("strong, b") && parent.childNodes.length === 1) {
      parent.replaceWith(...parent.childNodes);
    }
    range.insertNode(fragment);
  } else {
    const wrapper = document.createElement("strong");
    wrapper.append(fragment);
    range.insertNode(wrapper);
  }
  selection.removeAllRanges();
  const caret = document.createRange();
  caret.selectNodeContents(field);
  caret.collapse(false);
  selection.addRange(caret);
  const hiddenId = targetId === "post-text-editor" ? "post-text" : "edit-post-text";
  const hidden = document.getElementById(hiddenId);
  if (hidden) hidden.value = richEditorMarkdown(targetId);
}

function participants(t) { return Array.isArray(t.participantIds) ? t.participantIds : (Array.isArray(t.participantUids) ? t.participantUids : []); }
function peer(t) {
  const pid = participants(t).find((x) => x !== state.user.uid) || "";
  return state.threadPeers?.[pid] || t.peerProfile || {uid: pid, displayName: "Conversation", username: ""};
}

async function hydrateThreadPeer(thread) {
  const pid = participants(thread).find((x) => String(x) !== String(state.user.uid)) || "";
  if (!pid || state.threadPeers?.[pid]?.displayName) return state.threadPeers?.[pid] || {uid: pid};
  try {
    const response = await api.getPublicProfiles({userIds: [pid]});
    const profile = Array.isArray(response?.profiles)
      ? response.profiles.find((item) => item.uid === pid)
      : null;
    if (profile) {
      const peerProfile = {uid: pid, ...profile};
      if (peerProfile.photoMediaId) {
        const signedPhoto = await readProfilePhoto(pid, peerProfile.photoMediaId);
        if (signedPhoto) peerProfile.photoURL = signedPhoto;
      }
      state.threadPeers[pid] = peerProfile;
      saveThreadPeers();
    }
  } catch (error) {
    console.debug("[Marvel Chat] conversation profile lookup unavailable", error?.code);
  }
  return state.threadPeers?.[pid] || {uid: pid};
}
function normalizedCategory(item) { return String(item?.categoryId || item?.category || item?.categoryName || "").trim().toLowerCase(); }
function categoryMatches(item, category) { if (!category || category === "all") return true; return normalizedCategory(item) === category || normalizedCategory(item).includes(category); }
function safeMinor(value) { const n = Number(value); return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
function money(minor, currency = "NGN") { return `${esc(currency)} ${(Math.max(0, Number(minor) || 0) / 100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
function firstName() { return String(state.profile?.displayName || state.user?.displayName || "friend").trim().split(/\s+/)[0] || "friend"; }

function followLabel(targetUid) {
  return state.followingIds.includes(String(targetUid)) ? "Following" : "Follow";
}

async function getPublicUserPosts(targetUid) {
  try {
    const snap = await getDocs(query(
        collection(db, "posts"),
        where("authorUid", "==", targetUid),
        where("visibility", "==", "public"),
        where("status", "==", "active"),
        limit(10),
    ));
    return snap.docs
        .map((d) => ({id: d.id, ...d.data()}))
        .sort((a, b) => stamp(b.createdAt) - stamp(a.createdAt));
  } catch (error) {
    console.debug("[Marvel Chat] public profile posts unavailable", error?.code, error?.message);
    return [];
  }
}

async function openPublicUserProfile(targetUid, supplied = {}) {
  if (!targetUid || targetUid === state.user.uid) return;
  let profile = {uid: targetUid, ...(supplied?.result || supplied || {})};
  try {
    const response = await api.getPublicProfiles({userIds: [targetUid]});
    const publicProfile = Array.isArray(response?.profiles)
      ? response.profiles.find((item) => item.uid === targetUid)
      : null;
    if (publicProfile) profile = {...publicProfile, ...profile, uid: targetUid};
    if (profile.photoMediaId) {
      const signedPhoto = await readProfilePhoto(targetUid, profile.photoMediaId);
      if (signedPhoto) profile.photoURL = signedPhoto;
    }
  } catch (error) {
    console.debug("[Marvel Chat] public profile lookup unavailable", error?.code);
  }

  let following = state.followingIds.includes(String(targetUid));
  let followersCount = 0;
  try {
    const stateResult = await api.getFollowState({targetUid});
    following = Boolean(stateResult?.following);
    followersCount = Number(stateResult?.followersCount || 0);
  } catch {}

  if (following) {
    state.followingIds = [...new Set([...state.followingIds, String(targetUid)])];
  }

  const posts = await getPublicUserPosts(targetUid);
  const recentPosts = posts.length ? posts.slice(0, 6).map((post) =>
      `<article class="mini-post"><strong>${esc(post.text || "Shared a media post")}</strong><small>${when(post.createdAt)}</small></article>`
  ).join("") : `<div class="muted">No public posts available yet.</div>`;

  modal(
      profile.displayName || profile.username || "Member",
      `<div class="public-profile"><div class="public-profile-top">${avatar(profile, "xl", false)}<div><h3>${esc(profile.displayName || profile.username || "Member")}</h3><p>${esc(profile.username ? `@${profile.username}` : "Community member")}</p>${profile.bio ? `<p>${esc(profile.bio)}</p>` : ""}</div></div><div class="profile-stat-line"><span><strong>${followersCount}</strong> followers</span></div><section class="section mini-posts"><div class="section-head compact"><div><span class="eyebrow">COMMUNITY</span><h3>Recent posts</h3></div></div>${recentPosts}</section></div>`,
      `<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button><button class="btn btn-secondary" type="button" data-action="message-user" data-id="${esc(targetUid)}">Message</button><button class="btn btn-primary" type="button" data-action="${following ? "unfollow-user" : "follow-user"}" data-id="${esc(targetUid)}">${following ? "Following" : "Follow"}</button>`,
      {wide: true},
  );
}

function searchResultCard(item) {
  const p = item?.result || item || {};
  const type = String(item?.type || "result").toLowerCase();
  if (type === "user" || type === "person") {
    const id = item?.id || p.uid || p.id || "";
    const following = state.followingIds.includes(String(id));
    return `<article class="result compact-result">${avatar(p,"sm",true)}<div class="grow"><strong>${esc(item?.title || p.displayName || p.username || "Member")}</strong><small>${esc(item?.subtitle || item?.subTitle || (p.username ? `@${p.username}` : p.bio || "Community member"))}</small></div>${id && id !== state.user.uid ? `<div class="result-actions"><button class="btn btn-secondary" type="button" data-action="view-user" data-id="${esc(id)}">View</button><button class="btn btn-secondary" type="button" data-action="message-user" data-id="${esc(id)}">Message</button><button class="btn btn-secondary" type="button" data-action="${following ? "unfollow-user" : "follow-user"}" data-id="${esc(id)}">${following ? "Following" : "Follow"}</button></div>` : ""}</article>`;
  }
  if (type === "post") {
    return `<article class="result compact-result"><div class="result-icon">${icon("grid",18)}</div><div class="grow"><strong>${esc(item?.title || "Community post")}</strong><small>${esc(item?.subtitle || "Public community update")}</small><small class="muted">Post · ${esc(when(item?.createdAt || item?.updatedAt))}</small></div><span class="muted">Post</span></article>`;
  }
  if (type === "skill_listing") {
    return `<article class="result compact-result"><div class="result-icon">${icon("skills",18)}</div><div class="grow"><strong>${esc(item?.title || p.title || "Skill listing")}</strong><small>${esc(item?.subtitle || item?.subTitle || p.description || "")}</small></div><button class="btn btn-secondary" type="button" data-action="skill-search-view" data-id="${esc(item.id || "")}">View</button></article>`;
  }
  return `<article class="result compact-result"><div class="result-icon">${icon(type.includes("product") ? "market" : "profile",18)}</div><div class="grow"><strong>${esc(item?.title || p.title || "Result")}</strong><small>${esc(item?.subtitle || item?.subTitle || p.description || p.bio || "")}</small></div><span class="muted">${type === "skill_profile" ? "Provider" : type === "skill_listing" ? "Service" : type.includes("product") ? "Product" : "Result"}</span></article>`;
}

function contextualSearch(formId, placeholder, scope, value = "") {
  return `<form id="${esc(formId)}" class="context-search"><div class="context-search-box">${icon("search",18)}<input name="query" value="${esc(value)}" maxlength="80" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" autocomplete="off"><button type="submit" aria-label="Search">${icon("arrow",18)}</button></div><input type="hidden" name="scope" value="${esc(scope)}"></form>`;
}

async function loadProfile(force = false) {
  if (!force && state.profileLoadedAt && Date.now() - state.profileLoadedAt < 60_000 && state.profile?.uid === state.user?.uid) return;
  let snap = await getDoc(doc(db, "users", state.user.uid));
  if (!snap.exists()) {
    await api.ensureUserProfile();
    snap = await getDoc(doc(db, "users", state.user.uid));
  }
  state.profile = snap.exists()
    ? {uid: state.user.uid, ...snap.data()}
    : {uid: state.user.uid, email: state.user.email || ""};
  state.profile.displayName = state.profile.displayName || state.user.displayName || "";
  state.profile.email = state.profile.email || state.user.email || "";
  state.profile.photoURL = state.profile.photoURL || state.user.photoURL || "";
  if (state.profile.photoMediaId) {
    try {
      const signedPhoto = await readProfilePhoto(state.user.uid, state.profile.photoMediaId);
      if (signedPhoto) state.profile.photoURL = signedPhoto;
    } catch (error) {
      console.debug("[Marvel Chat] profile photo URL unavailable", error?.code);
    }
  }
  try {
    const f = await api.getFollowList({targetUid: state.user.uid, direction: "following", limit: 50});
    state.followingIds = Array.isArray(f?.users) ? f.users.map((u) => String(u.uid)) : [];
  } catch {
    state.followingIds = [];
  }
  try {
    const stats = await api.getFollowState({targetUid: state.user.uid});
    state.followStats = {
      followersCount: Number(stats?.followersCount || 0),
      followingCount: Number(stats?.followingCount || 0),
      postCount: Number(stats?.postCount ?? state.profile.postCount ?? state.profile.postsCount ?? 0)
    };
  } catch {}
  state.profileLoadedAt = Date.now();
}

async function loadHome({reset = !state.homeLoaded} = {}) {
  if (state.homeLoading) return;
  if (!reset && !state.homeHasMore) return;
  state.homeLoading = true;
  state.homeError = "";
  if (reset) {
    state.homeCursor = null;
    state.homeHasMore = false;
    state.homeViewerFollowsAny = null;
    state.posts = [];
    state.moments = [];
    state.homeLoaded = false;
  }
  paint();
  try {
    const cursor = reset ? null : state.homeCursor;
    const priorCount = reset ? 0 : state.posts.length;
    const feedPromise = api.getHomeFeed({limit: 3, ...(cursor ? {cursor} : {})});
    const momentsPromise = reset ? api.getHomeMoments({limit: 12}) : Promise.resolve(null);
    const [feedResult, momentsResult] = await Promise.allSettled([feedPromise, momentsPromise]);
    if (feedResult.status !== "fulfilled") throw feedResult.reason;
    const feed = feedResult.value;
    const momentResult = momentsResult.status === "fulfilled" ? momentsResult.value : null;
    if (momentsResult.status === "rejected") {
      console.debug("[Marvel Chat] Moments temporarily unavailable", momentsResult.reason?.code);
    }
    const incoming = Array.isArray(feed?.posts) ? feed.posts : [];
    if (reset) state.posts = incoming;
    else {
      const seen = new Set(state.posts.map((post) => post.id));
      state.posts = [...state.posts, ...incoming.filter((post) => !seen.has(post.id))];
    }
    state.homeCursor = feed?.nextCursor || null;
    state.homeHasMore = Boolean(feed?.hasMore && state.homeCursor);
    state.homeViewerFollowsAny = typeof feed?.viewerFollowsAny === "boolean" ? feed.viewerFollowsAny : state.followingIds.length > 0;
    if (momentResult) {
      state.moments = Array.isArray(momentResult?.moments) ? momentResult.moments : [];
    }
    state.homeLoaded = true;
    // The first three posts are the current page. Resolve signed R2 URLs only
    // for those items, rather than hydrating dozens of posts on every visit.
    incoming.forEach((post, index) => {
      post.feedIndex = priorCount + index;
      post.mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : null;
    });
    void Promise.all(incoming.filter((post) => Array.isArray(post.mediaIds) && post.mediaIds.length)
      .map((post) => hydratePostMedia(post)));
  } catch (error) {
    state.homeError = friendlyError(error);
    if (reset) state.homeLoaded = false;
    throw error;
  } finally {
    state.homeLoading = false;
    paint();
  }
}

function updateRenderedPostMedia(post, indices) {
  const tracks = [...app.querySelectorAll("[data-post-carousel-track]")]
      .filter((track) => String(track.dataset.id) === String(post.id));
  if (!tracks.length) return;
  const count = Math.max(0, Array.isArray(post.mediaIds) ? post.mediaIds.length : 0);
  for (const track of tracks) {
    for (const index of indices) {
      const slide = [...track.querySelectorAll(".post-carousel-slide")]
          .find((node) => Number(node.dataset.slideIndex) === Number(index));
      if (!slide) continue;
      const item = post.mediaUrls?.[index];
      if (item?.url) {
        const mediaType = String(item.contentType || "");
        const label = `Media ${index + 1} of ${count} shared by ${post.authorSnapshot?.displayName || "a community member"}`;
        let media;
        if (mediaType.startsWith("video/")) {
          media = document.createElement("video");
          media.controls = true;
          media.playsInline = true;
          media.preload = "none";
          media.setAttribute("aria-label", label);
        } else {
          media = document.createElement("img");
          media.alt = label;
          media.loading = Number(track.dataset.currentIndex || track.dataset.startIndex || 0) === index ? "eager" : "lazy";
          media.decoding = "async";
          media.dataset.postMedia = "true";
          media.dataset.postId = String(post.id);
          media.dataset.mediaIndex = String(index);
          media.fetchPriority = index === 0 ? "high" : "auto";
        }
        media.src = item.url;
        slide.replaceChildren(media);
      } else if ((post.mediaLoadErrorIndices || []).includes(index)) {
        slide.innerHTML = `<button class="carousel-lazy-placeholder is-error" type="button" data-action="load-post-media" data-id="${esc(post.id)}" data-index="${index}">Tap to retry media ${index + 1}</button>`;
      } else if (post.mediaLoadingIndices?.includes(index)) {
        slide.innerHTML = `<div class="carousel-lazy-placeholder" role="status">${icon("spinner",20)}<span>Loading media…</span></div>`;
      }
    }
  }
}

async function hydratePostMedia(post, requestedIndices = [0]) {
  if (!post?.id || !Array.isArray(post.mediaIds) || post.mediaIds.length === 0) return;
  const count = post.mediaIds.length;
  if (!Array.isArray(post.mediaUrls) || post.mediaUrls.length !== count) {
    post.mediaUrls = Array(count).fill(null);
  }
  const validIndices = [...new Set((Array.isArray(requestedIndices) ? requestedIndices : [requestedIndices])
    .map((index) => Number(index))
    .filter((index) => Number.isInteger(index) && index >= 0 && index < count))];
  const busy = new Set(Array.isArray(post.mediaLoadingIndices) ? post.mediaLoadingIndices : []);
  const missing = validIndices.filter((index) => !post.mediaUrls[index] && !busy.has(index));
  if (!missing.length) return;
  post.mediaLoadingIndices = [...busy, ...missing];
  post.mediaLoading = true;
  post.mediaLoadErrorIndices = Array.isArray(post.mediaLoadErrorIndices) ? post.mediaLoadErrorIndices : [];
  updateRenderedPostMedia(post, missing);
  try {
    // Only resolve signed URLs for visible/nearby slides. Updating the existing
    // figure nodes prevents async URL completion from replacing the track and
    // snapping a user's current slide back to index zero.
    const result = await readPostMedia(post.id, missing.map((index) => post.mediaIds[index]));
    const loaded = Array.isArray(result) ? result : [];
    for (const item of loaded) {
      const index = post.mediaIds.indexOf(item.mediaId);
      if (index >= 0) {
        post.mediaUrls[index] = item;
        post.mediaLoadErrorIndices = post.mediaLoadErrorIndices.filter((value) => value !== index);
      }
    }
    for (const index of missing) {
      if (!post.mediaUrls[index] && !post.mediaLoadErrorIndices.includes(index)) post.mediaLoadErrorIndices.push(index);
    }
  } catch (error) {
    for (const index of missing) if (!post.mediaLoadErrorIndices.includes(index)) post.mediaLoadErrorIndices.push(index);
    console.debug("[Marvel Chat] post media read failed", error?.code || error?.message);
  } finally {
    post.mediaLoadingIndices = (post.mediaLoadingIndices || []).filter((index) => !missing.includes(index));
    post.mediaLoading = post.mediaLoadingIndices.length > 0;
    updateRenderedPostMedia(post, missing);
  }
}

async function loadSavedPosts({reset = !state.savedPostsLoaded} = {}) {
  if (state.savedPostsLoading) return;
  if (!reset && !state.savedPostsHasMore) return;
  state.savedPostsLoading = true;
  paint();
  try {
    const cursor = reset ? null : state.savedPostsCursor;
    const result = await api.getMySavedPosts({limit: 5, ...(cursor ? {cursor} : {})});
    const incoming = Array.isArray(result?.posts) ? result.posts : [];
    if (reset) state.savedPosts = incoming;
    else {
      const seen = new Set(state.savedPosts.map((post) => post.id));
      state.savedPosts = [...state.savedPosts, ...incoming.filter((post) => !seen.has(post.id))];
    }
    state.savedPostsCursor = result?.nextCursor || null;
    state.savedPostsHasMore = Boolean(state.savedPostsCursor);
    state.savedPostsLoaded = true;
    for (const post of incoming) post.mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : null;
    void Promise.all(incoming.filter((post) => Array.isArray(post.mediaIds) && post.mediaIds.length)
      .map((post) => hydratePostMedia(post)));
  } finally {
    state.savedPostsLoading = false;
    paint();
  }
}

async function refreshNotificationSummary() {
  const result = await api.getMyNotificationSummary();
  state.unreadNotifications = Number(result?.unreadCount || 0);
  return result;
}

async function loadThreads(force = false) {
  if (!force && state.threadsLoadedAt && Date.now() - state.threadsLoadedAt < 30_000) return;
  const s = await getDocs(query(collection(db,"chatThreads"), where("participantIds","array-contains",state.user.uid), limit(50)));
  state.threads = s.docs.map((d) => ({id:d.id,...d.data()})).sort((a,b) => stamp(b.updatedAt || b.lastMessageAt) - stamp(a.updatedAt || a.lastMessageAt));
  state.threadsLoadedAt = Date.now();
}

async function findOrCreateDirectThread(targetUid, profile) {
  const existing = state.threads.find((t) => {
    const ids = participants(t).map(String);
    return t.type === "direct" && ids.length === 2 && ids.includes(String(targetUid)) && ids.includes(String(state.user.uid));
  });
  if (existing) return existing.id;
  state.threadPeers[targetUid] = profile || {uid: targetUid};
  saveThreadPeers();
  const r = await api.createChatThread({type:"direct", participantIds:[state.user.uid,targetUid]});
  return r?.threadId || r?.id || null;
}

async function loadMessages(id) {
  clearSubscriptions();
  const u = onSnapshot(query(collection(db,"chatThreads",id,"messages"), orderBy("createdAt","asc"), limit(100)), (s) => {
    state.messages = s.docs.map((d) => ({id:d.id,...d.data()}));
    paint();
    requestAnimationFrame(() => { const box = document.querySelector(".messages"); if (box) box.scrollTop = box.scrollHeight; });
  }, (error) => toast(friendlyError(error),"error"));
  addSubscription(u);
  try { await api.markThreadRead({threadId:id}); } catch {}
}

async function loadSkills(force = false) {
  if (!force && state.skillsLoadedAt && Date.now() - state.skillsLoadedAt < 60_000) return Promise.resolve();
  const [listingSnap, categorySnap] = await Promise.all([
    getDocs(query(collection(db,"skillListings"), where("status","==","active"), limit(40))),
    getDocs(query(collection(db,"skillCategories"), where("status","==","active"), limit(50))).catch(() => ({docs:[]}))
  ]);
  state.skills = listingSnap.docs.map((d) => ({id:d.id,...d.data()}));
  state.skillsLoadedAt = Date.now();
  state.skillCategories = categorySnap.docs.map((d) => ({id:d.id,...d.data()}));
  void Promise.all(state.skills.slice(0, 8).map((item) => hydrateSkillListingMedia(item))).then(() => { if (state.route === "skills") paint(); });
}

async function loadSkillWorkspace(force = false) {
  if (!force && state.skillWorkspaceLoadedAt && Date.now() - state.skillWorkspaceLoadedAt < 45_000) return;
  const profileSnap = await getDoc(doc(db,"skillProfiles",state.user.uid));
  state.skillProfile = profileSnap.exists() ? {uid:state.user.uid,...profileSnap.data()} : null;
  const listingSnap = await getDocs(query(collection(db,"skillListings"), where("providerUid","==",state.user.uid), limit(50)));
  state.skillListingsMine = listingSnap.docs.map((d) => ({id:d.id,...d.data()}));
  void Promise.all(state.skillListingsMine.slice(0, 8).map((item) => hydrateSkillListingMedia(item))).then(() => { if (state.route === "skill-profile") paint(); });
  const [reqA, reqB] = await Promise.all([
    getDocs(query(collection(db,"skillRequests"), where("requesterUid","==",state.user.uid), limit(40))).catch(() => ({docs:[]})),
    getDocs(query(collection(db,"skillRequests"), where("providerUid","==",state.user.uid), limit(40))).catch(() => ({docs:[]}))
  ]);
  const map = new Map();
  [...reqA.docs,...reqB.docs].forEach((d) => map.set(d.id,{id:d.id,...d.data()}));
  state.skillRequests = [...map.values()].sort((a,b) => stamp(b.updatedAt || b.createdAt) - stamp(a.updatedAt || a.createdAt));
  state.skillWorkspaceLoadedAt = Date.now();
}

async function loadMarket(force = false) {
  const queryText = String(state.searchQuery || "").trim();
  // Keep catalogue data in memory for 60 seconds to avoid repeated reads when
  // switching between tabs, opening details, and returning to Market.
  if (!force && state.marketLoaded && state.marketCacheQuery === queryText &&
      Date.now() - Number(state.marketCacheAt || 0) < 60_000) return;

  const [productsResult, categoryResult, ownStoreResult, shopsResult, savedResult] = await Promise.allSettled([
    api.discoverMarketProducts({query: queryText, limit: 30}),
    getDocs(query(collection(db,"productCategories"), where("status","==","active"), limit(50))),
    getDocs(query(collection(db,"stores"), where("ownerUid","==",state.user.uid), limit(1))),
    getDocs(query(collection(db,"stores"), where("status","==","active"), limit(12))),
    api.getMySavedMarketProducts({limit: 40})
  ]);
  if (productsResult.status !== "fulfilled") throw productsResult.reason;
  const response = productsResult.value;
  state.products = (Array.isArray(response?.results) ? response.results : []).map((item) => ({
    ...item,
    id: item.id || item.productId || "",
    storeName: item.storeName || item.storeSnapshot?.name || "Marvel Market shop"
  })).filter((item) => item.id);
  state.marketCategories = categoryResult.status === "fulfilled"
    ? categoryResult.value.docs.map((d) => ({id:d.id,...d.data()})) : state.marketCategories;
  if (ownStoreResult.status === "fulfilled") {
    state.myStore = ownStoreResult.value.docs.length
      ? {id:ownStoreResult.value.docs[0].id,...ownStoreResult.value.docs[0].data()}
      : state.myStore;
  }
  state.marketStores = shopsResult.status === "fulfilled"
    ? shopsResult.value.docs.map((d) => ({id:d.id,...d.data()})).sort((a,b) => stamp(b.createdAt || b.updatedAt) - stamp(a.createdAt || a.updatedAt))
    : state.marketStores;
  if (savedResult.status === "fulfilled") {
    state.marketSavedProductIds = Array.isArray(savedResult.value?.productIds)
      ? savedResult.value.productIds.map(String) : [];
    state.savedMarketProducts = Array.isArray(savedResult.value?.products)
      ? savedResult.value.products.map((item) => ({...item, id:item.id || item.productId || ""})) : [];
  } else {
    console.debug("[Marvel Chat] saved Market items unavailable", savedResult.reason?.code);
  }
  state.marketCacheQuery = queryText;
  state.marketCacheAt = Date.now();
  state.marketLoaded = true;
  void Promise.all(state.products.slice(0, 8).map((item) => hydrateMarketProductMedia(item)))
    .then(() => { if (state.route === "market") paint(); });
}

async function loadBusinessWorkspace(force = false) {
  if (!force && state.businessLoadedAt && Date.now() - state.businessLoadedAt < 45_000) return;
  const [storeSnap, categorySnap] = await Promise.all([
    getDocs(query(collection(db,"stores"), where("ownerUid","==",state.user.uid), limit(10))),
    getDocs(query(collection(db,"productCategories"), where("status","==","active"), limit(50))).catch(() => ({docs:[]}))
  ]);
  state.marketCategories = categorySnap.docs.map((d) => ({id:d.id,...d.data()}));
  const stores = storeSnap.docs.map((d) => ({id:d.id,...d.data()})).sort((a,b) => stamp(b.updatedAt || b.createdAt) - stamp(a.updatedAt || a.createdAt));
  state.myStore = stores[0] || null;
  if (state.myStore) {
    state.sellerDraft = {...state.sellerDraft, storeId:state.myStore.id, name:state.myStore.name || "", description:state.myStore.description || "", category:state.myStore.category || "", location:state.myStore.location || state.myStore.locationText || ""};
    saveSellerDraft();
  }
  const productSnap = await getDocs(query(collection(db,"products"), where("ownerUid","==",state.user.uid), limit(50)));
  state.myProducts = productSnap.docs.map((d) => ({id:d.id,...d.data()})).sort((a,b) => stamp(b.updatedAt || b.createdAt) - stamp(a.updatedAt || a.createdAt));
  void Promise.all(state.myProducts.slice(0, 8).map((item) => hydrateMarketProductMedia(item))).then(() => { if (state.route === "business") paint(); });
  if (state.myStore) {
    const reqSnap = await getDocs(query(collection(db,"commerceRequests"), where("sellerUid","==",state.user.uid), limit(50))).catch(() => ({docs:[]}));
    state.commerceRequests = reqSnap.docs.map((d) => ({id:d.id,...d.data()})).sort((a,b) => stamp(b.updatedAt || b.createdAt) - stamp(a.updatedAt || a.createdAt));
  } else {
    state.commerceRequests = [];
  }
  state.businessLoadedAt = Date.now();
}

async function hydrateMarketProductMedia(item, force = false) {
  const product = item?.result || item;
  if (!product?.id || !Array.isArray(product.mediaIds) || !product.mediaIds.length) return;
  const freshForMs = 5 * 60 * 1000;
  if (force) { product.mediaUrls = null; product.mediaLoadPromise = null; product.mediaUrlFetchedAt = 0; }
  if (Array.isArray(product.mediaUrls) && product.mediaUrls.length && product.mediaUrlFetchedAt && Date.now() - product.mediaUrlFetchedAt < freshForMs) return product.mediaUrls;
  if (product.mediaLoadPromise) return product.mediaLoadPromise;
  product.mediaLoading = true;
  product.mediaLoadPromise = (async () => {
    try {
      product.mediaUrls = await readMarketProductMedia(product.id, product.mediaIds);
      product.mediaUrlFetchedAt = Date.now();
    } catch (error) {
      product.mediaUrls = [];
      product.mediaUrlFetchedAt = 0;
      console.debug("[Marvel Chat] product media unavailable", error?.code || error?.message);
    } finally {
      product.mediaLoading = false;
      product.mediaLoadPromise = null;
    }
    return product.mediaUrls;
  })();
  return product.mediaLoadPromise;
}

async function hydrateSkillListingMedia(item, force = false) {
  const listing = item?.result || item;
  if (!listing?.id || !Array.isArray(listing.mediaIds) || !listing.mediaIds.length) return;
  const freshForMs = 5 * 60 * 1000;
  if (force) { listing.mediaUrls = null; listing.mediaLoadPromise = null; listing.mediaUrlFetchedAt = 0; }
  if (Array.isArray(listing.mediaUrls) && listing.mediaUrls.length && listing.mediaUrlFetchedAt && Date.now() - listing.mediaUrlFetchedAt < freshForMs) return listing.mediaUrls;
  if (listing.mediaLoadPromise) return listing.mediaLoadPromise;
  listing.mediaLoading = true;
  listing.mediaLoadPromise = (async () => {
    try {
      listing.mediaUrls = await readSkillListingMedia(listing.id, listing.mediaIds);
      listing.mediaUrlFetchedAt = Date.now();
    } catch (error) {
      listing.mediaUrls = [];
      listing.mediaUrlFetchedAt = 0;
      console.debug("[Marvel Chat] skill media unavailable", error?.code || error?.message);
    } finally {
      listing.mediaLoading = false;
      listing.mediaLoadPromise = null;
    }
    return listing.mediaUrls;
  })();
  return listing.mediaLoadPromise;
}

function resetPendingPhoto(kind) {
  if (kind === "product" && Array.isArray(state.pendingProductPhotoPreviews)) { state.pendingProductPhotoPreviews.forEach((url) => { if (url) URL.revokeObjectURL(url); }); state.pendingProductPhotoPreviews = []; state.pendingProductPhotoFiles = []; }
  const fileKey = kind === "product" ? "pendingProductPhotoFile" : "pendingSkillPhotoFile";
  const previewKey = kind === "product" ? "pendingProductPhotoPreview" : "pendingSkillPhotoPreview";
  if (state[previewKey]) URL.revokeObjectURL(state[previewKey]);
  state[fileKey] = null;
  state[previewKey] = "";
}

async function loadNotifications(force = false) {
  if (!force && state.notificationsLoadedAt && Date.now() - state.notificationsLoadedAt < 30_000) return;
  const result = await api.getMyNotificationSummary();
  state.notifications = Array.isArray(result?.notifications) ? result.notifications : [];
  state.unreadNotifications = Number(result?.unreadCount || 0);
  state.notificationsLoadedAt = Date.now();
}

function categoryChips(kind, selected) {
  const fallback = kind === "market" ? MARKET_CATEGORIES : SKILL_CATEGORIES;
  const dynamic = kind === "market" ? state.marketCategories : state.skillCategories;
  const categories = dynamic.length ? [["all","All"],...dynamic.map((c) => [c.id,c.name || c.slug || c.id])] : fallback;
  return `<div class="category-row">${categories.map(([id,label]) => `<button class="category-chip ${selected === id ? "active" : ""}" type="button" data-action="${kind}-category" data-category="${esc(id)}">${esc(label)}</button>`).join("")}</div>`;
}

function momentCard(m, own = false) {
  const label = own ? "Your Moment" : (m.authorSnapshot?.displayName || m.author?.displayName || m.displayName || m.username || "Following");
  const person = own ? (state.profile || state.user || m) : (m.authorSnapshot || m.author || m);
  return `<button class="moment-card ${own ? "own has-moment" : "has-moment"}" type="button" data-action="view-moment" data-id="${esc(m.id)}"><div class="moment-ring"><div class="moment-avatar">${avatar(person,"md",true)}</div>${own ? `<span class="moment-plus">${icon("plus",12)}</span>` : ""}</div><span class="moment-label">${esc(label)}</span></button>`;
}

function renderPostCard(p) {
  const author = p.authorSnapshot || p.author || p;
  const urls = Array.isArray(p.mediaUrls) ? p.mediaUrls : [];
  const mediaCount = Array.isArray(p.mediaIds) ? p.mediaIds.length : urls.length;
  const mediaIndex = Math.max(0, Math.min(Number(p.mediaIndex || 0), Math.max(0, mediaCount - 1)));
  const mediaHtml = mediaCount ? `<div class="post-carousel" data-post-carousel data-id="${esc(p.id)}" data-count="${mediaCount}">
    <div class="post-carousel-viewport" role="region" aria-label="Post media. Swipe horizontally to browse ${mediaCount} items">
      <div class="post-carousel-track" data-post-carousel-track data-id="${esc(p.id)}" data-start-index="${mediaIndex}" tabindex="0">
        ${Array.from({length: mediaCount}, (_, index) => {
          const m = urls[index] || null;
          const loadFailed = Array.isArray(p.mediaLoadErrorIndices) && p.mediaLoadErrorIndices.includes(index);
          if (!m || !m.url) {
            return `<figure class="post-carousel-slide" data-slide-index="${index}" data-media-id="${esc(p.mediaIds?.[index] || "")}" role="group" aria-label="${index + 1} of ${mediaCount}">${loadFailed
              ? `<button class="carousel-lazy-placeholder is-error" type="button" data-action="load-post-media" data-id="${esc(p.id)}" data-index="${index}">Tap to retry media ${index + 1}</button>`
              : `<div class="carousel-lazy-placeholder" role="status">${icon(p.mediaLoading ? "spinner" : "image",20)}<span>${index === mediaIndex ? "Loading media…" : "Swipe to view this item"}</span></div>`}</figure>`;
          }
          const mediaType = String(m.contentType || "");
          const label = `Media ${index + 1} of ${mediaCount} shared by ${author.displayName || "a community member"}`;
          if (mediaType.startsWith("video/")) {
            return `<figure class="post-carousel-slide" data-slide-index="${index}" data-media-id="${esc(p.mediaIds?.[index] || "")}" role="group" aria-label="${index + 1} of ${mediaCount}"><video src="${esc(m.url)}" controls playsinline preload="none" aria-label="${esc(label)}"></video></figure>`;
          }
          return `<figure class="post-carousel-slide" data-slide-index="${index}" data-media-id="${esc(p.mediaIds?.[index] || "")}" role="group" aria-label="${index + 1} of ${mediaCount}"><img src="${esc(m.url)}" alt="${esc(label)}" data-post-media="true" data-post-id="${esc(p.id)}" data-media-index="${index}" loading="${index === mediaIndex ? "eager" : "lazy"}" fetchpriority="${Number(p.feedIndex) === 0 && index === 0 ? "high" : "auto"}" decoding="async"></figure>`;
        }).join("")}
      </div>
    </div>
    ${mediaCount > 1 ? `<div class="post-carousel-footer"><div class="post-carousel-controls"><button type="button" data-action="post-media-prev" data-id="${esc(p.id)}" aria-label="Previous photo or video" ${mediaIndex <= 0 ? "disabled" : ""}>‹</button><span data-carousel-count aria-live="polite">${mediaIndex + 1} / ${mediaCount}</span><button type="button" data-action="post-media-next" data-id="${esc(p.id)}" aria-label="Next photo or video" ${mediaIndex >= mediaCount - 1 ? "disabled" : ""}>›</button></div><div class="post-carousel-dots" aria-label="Media position">${Array.from({length:mediaCount},(_,index)=>`<button type="button" data-action="post-media-go" data-id="${esc(p.id)}" data-index="${index}" aria-label="Show media ${index+1}" aria-current="${index===mediaIndex ? "true" : "false"}"></button>`).join("")}</div></div>` : ""}
  </div>` : (Array.isArray(p.mediaIds) && p.mediaIds.length
    ? `<button class="media-placeholder" type="button" data-action="load-post-media" data-id="${esc(p.id)}">${icon("camera",17)}<span>${p.mediaLoading ? "Loading media…" : p.mediaLoadError ? "Retry loading media" : `Load ${p.mediaIds.length > 1 ? `${p.mediaIds.length} media items` : "media"}`}</span></button>` : "");
  const expanded = Boolean(p.textExpanded);
  const captionText = String(p.text || "").trim();
  const showToggle = captionText.length > 45 || captionText.includes("\n");
  return `<article class="post-card modern-post" data-post-id="${esc(p.id)}">
    <header class="post-head">${avatar(author,"md",true)}<div class="grow"><strong>${esc(author.displayName || "Community member")}</strong><span>${esc(author.username ? `@${author.username}` : "Community")} · ${when(p.createdAt)}</span></div>${uidOf(p) === state.user.uid ? `<button class="icon-btn" type="button" data-action="post-menu" data-id="${esc(p.id)}" aria-label="Post options">${icon("menuDots",19)}</button>` : `<button class="post-follow" type="button" data-action="${state.followingIds.includes(String(uidOf(p))) ? "unfollow-user" : "follow-user"}" data-id="${esc(uidOf(p))}" aria-label="${followLabel(uidOf(p))}">${followLabel(uidOf(p))}</button>`}</header>
    <div class="post-body">${mediaHtml}${p.text ? `<p id="post-caption-${esc(p.id)}" class="post-caption ${expanded ? "expanded" : "collapsed"}">${postTextHtml(p.text)}</p>${showToggle ? `<button class="post-text-toggle" type="button" data-action="toggle-post-text" data-id="${esc(p.id)}" aria-expanded="${expanded}" aria-controls="post-caption-${esc(p.id)}">${expanded ? "Show less" : "Show more"}</button>` : ""}` : ""}</div>
    <footer class="post-actions"><button class="${p.likedByViewer ? "is-active" : ""}" type="button" data-action="like-post" data-id="${esc(p.id)}" aria-pressed="${Boolean(p.likedByViewer)}">${icon("heart",18)}${p.likedByViewer ? "Liked" : "Like"} <span>${Number(p.reactionCount || 0) || ""}</span></button><button type="button" data-action="comment-post" data-id="${esc(p.id)}">${icon("comment",18)}Comment <span>${Number(p.commentCount || 0) || ""}</span></button><button class="${p.savedByViewer ? "is-active" : ""}" type="button" data-action="save-post" data-id="${esc(p.id)}" aria-pressed="${Boolean(p.savedByViewer)}">${icon("bookmark",18)}${p.savedByViewer ? "Saved" : "Save"}</button><button type="button" data-action="share-post" data-id="${esc(p.id)}">${icon("arrow",18)}Share</button></footer>
  </article>`;
}

function renderDiscoveryBanner() {
  if (!shouldShowDiscoveryBanner()) return "";
  return `<div class="discovery-overlay" data-discovery-overlay role="dialog" aria-modal="true" aria-labelledby="discovery-title">
    <section class="discovery-banner" aria-label="Discover more on Marvel Chat">
      <div class="discovery-banner-glimmer discovery-glimmer-one" aria-hidden="true"></div>
      <div class="discovery-banner-glimmer discovery-glimmer-two" aria-hidden="true"></div>
      <button class="discovery-banner-dismiss" type="button" data-action="dismiss-discovery-banner" aria-label="Dismiss discovery banner">${icon("close",18)}</button>
      <div class="discovery-banner-brand"><img src="./assets/brand/icon-192.png" width="48" height="48" alt="Marvel Chat"><span>MARVEL CHAT DISCOVERY</span></div>
      <div class="discovery-banner-intro">
        <span class="discovery-banner-kicker">A LITTLE MORE TO EXPLORE</span>
        <h2 id="discovery-title">Find your next favourite thing.</h2>
        <p>Discover useful products, independent shops and people with skills worth knowing.</p>
      </div>
      <div class="discovery-banner-options">
        <button class="discovery-option discovery-option-market" type="button" data-action="route-market">
          <span class="discovery-option-art discovery-market-art" aria-hidden="true"><span class="discovery-art-orbit"></span><span class="discovery-art-icon">${icon("market",25)}</span><span class="discovery-art-spark">✦</span></span>
          <span class="discovery-option-copy"><strong>Explore Marvel Market</strong><small>Discover products and shops</small></span>
          <span class="discovery-option-arrow">${icon("arrow",16)}</span>
        </button>
        <button class="discovery-option discovery-option-skills" type="button" data-action="route-skills">
          <span class="discovery-option-art discovery-skills-art" aria-hidden="true"><span class="discovery-art-orbit"></span><span class="discovery-art-icon">${icon("skills",25)}</span><span class="discovery-art-spark">✦</span></span>
          <span class="discovery-option-copy"><strong>Explore Marvel Skills</strong><small>Meet talented providers</small></span>
          <span class="discovery-option-arrow">${icon("arrow",16)}</span>
        </button>
      </div>
      <p class="discovery-banner-footnote">This invitation closes automatically in 30 seconds.</p>
    </section>
  </div>`;
}

function renderHome() {
  const own = state.moments.find((m) => uidOf(m) === state.user.uid || m.uid === state.user.uid);
  const following = state.moments.filter((m) => m.id !== own?.id);
  const feedBody = state.posts.length ? state.posts.map(renderPostCard).join("") :
    (state.homeLoading ? `<div class="feed-loader" role="status">${icon("spinner",18)} Loading community updates…</div>` :
      state.homeError ? emptyState("Your feed could not load", state.homeError, "retry-home", "Try again") :
      state.homeViewerFollowsAny === false
        ? emptyState("Start with people and posts", "Search for people to follow. Their posts and Moments will appear here.", "route-search", "Find people and posts")
        : emptyState("Your feed is quiet", "Public community posts and updates from people you follow will appear here.", "create-post", "Create a post"));
  const paging = state.homeLoading && state.posts.length
    ? `<div class="feed-loader" role="status">${icon("spinner",18)} Loading more posts…</div>`
    : state.homeHasMore ? `<div id="home-page-sentinel" class="pagination-sentinel"><button class="btn btn-secondary" type="button" data-action="load-more-home">Load more posts</button></div>`
    : state.homeLoaded && state.homeViewerFollowsAny === false
      ? `<div class="feed-follow-prompt"><strong>${state.posts.length >= 6 ? "You’ve seen the current public preview." : "You’ve reached the end of the available public posts."}</strong><p>Follow people to see their new posts and Moments. Search for a person or post to find someone to follow.</p><button class="btn btn-primary" type="button" data-action="route-search">Search people and posts</button></div>`
      : state.homeLoaded && state.posts.length ? `<p class="end-of-feed">You’re all caught up.</p>` : "";
  return `<section class="screen home-screen">
    ${renderDiscoveryBanner()}
    <section class="home-moments"><div class="section-head compact"><div><span class="eyebrow">MOMENTS</span><h2>Stories & updates</h2></div><button class="text-button" type="button" data-action="create-moment">Create</button></div><div class="moments-row">${own ? momentCard(own,true) : `<button class="moment-card own no-moment" type="button" data-action="create-moment"><div class="moment-ring add-ring"><div class="moment-avatar">${avatar(state.profile || state.user,"md",true)}</div><span class="add-badge">${icon("plus",13)}</span></div><span class="moment-label">Add a Moment</span></button>`}${following.map((m) => momentCard(m)).join("")}</div></section>
    ${contextualSearch("home-search-form","Search people and posts…","people_posts",state.searchQuery)}
    ${state.homeSearchResults.length ? `<section class="inline-results"><div class="section-head compact"><div><span class="eyebrow">SEARCH</span><h2>Matches</h2></div><button class="text-button" type="button" data-action="clear-home-search">Clear</button></div><div class="results">${state.homeSearchResults.slice(0,8).map(searchResultCard).join("")}</div></section>` : ""}
    <section class="section feed-section"><div class="section-head compact"><div><span class="eyebrow">COMMUNITY FEED</span><h2>Latest updates</h2></div></div>${feedBody}${paging}</section>
    <button class="fab" type="button" data-action="create-menu" aria-label="Create"><span>${icon("plus",23)}</span></button>
  </section>`;
}

function renderSavedPosts() {
  const content = state.savedPosts.length ? state.savedPosts.map(renderPostCard).join("") :
    (state.savedPostsLoading ? `<div class="feed-loader" role="status">${icon("spinner",18)} Loading saved posts…</div>` :
      emptyState("No saved posts yet", "Save a post from Home and it will be kept here."));
  const paging = state.savedPostsLoading && state.savedPosts.length
    ? `<div class="feed-loader" role="status">${icon("spinner",18)} Loading more saved posts…</div>`
    : state.savedPostsHasMore ? `<div class="pagination-sentinel"><button class="btn btn-secondary" type="button" data-action="load-more-saved">Load more</button></div>` : "";
  return `<section class="screen">${head("YOUR COLLECTION","Saved posts","Posts you chose to keep for later.","route-home","Back to Home")}<section class="section feed-section">${content}${paging}</section></section>`;
}

function renderChat() {
  if (state.activeThreadId) {
    const t = state.threads.find((x) => x.id === state.activeThreadId) || {};
    const p = peer(t);
    const visibleMessages = state.messages.filter((m) =>
      !(Array.isArray(m.deletedForUids) && m.deletedForUids.includes(state.user.uid)) &&
      !(m.senderUid === state.user.uid && m.senderDeletedForMe === true));
    return `<section class="screen conversation"><header class="conversation-head"><button class="icon-btn" type="button" data-action="close-thread" aria-label="Back">${icon("back")}</button>${avatar(p,"sm",true)}<div class="grow"><strong>${esc(p.displayName || p.username || "Conversation")}</strong><span>${esc(p.username ? `@${p.username}` : "Private conversation")}</span></div><button class="icon-btn" type="button" data-action="thread-options" data-id="${esc(t.id || state.activeThreadId)}" aria-label="Conversation options">${icon("menuDots",18)}</button></header><div class="messages">${visibleMessages.length ? visibleMessages.map((m) => `<div class="message-row ${m.senderUid === state.user.uid ? "own" : ""}"><div class="bubble"><div>${esc(m.status === "deleted_for_everyone" ? "Message deleted" : (m.text || ""))}</div><small>${when(m.createdAt)}${m.editedAt ? " · edited" : ""}</small>${m.senderUid === state.user.uid && m.status !== "deleted_for_everyone" ? `<div class="message-actions"><button class="message-more" type="button" data-action="edit-message" data-id="${esc(m.id)}">Edit</button><button class="message-more" type="button" data-action="delete-message" data-mode="for_everyone" data-id="${esc(m.id)}">Delete for everyone</button><button class="message-more" type="button" data-action="delete-message" data-mode="for_me" data-id="${esc(m.id)}">Delete for me</button></div>` : m.status !== "deleted_for_everyone" ? `<button class="message-more" type="button" data-action="delete-message" data-mode="for_me" data-id="${esc(m.id)}">Delete for me</button>` : ""}</div></div>`).join("") : emptyState("Start the conversation","Send a message to begin.")}</div><form id="message-form" class="composer"><textarea name="text" rows="1" maxlength="4000" placeholder="Write a message…" required></textarea><button type="submit" aria-label="Send">${icon("send",20)}</button></form></section>`;
  }
  const uid = String(state.user?.uid || "");
  const visibleThreads = state.threads.filter((t) =>
    !(Array.isArray(t.hiddenForUids) && t.hiddenForUids.includes(uid)) &&
    !(Array.isArray(t.archivedUids) && t.archivedUids.includes(uid)));
  visibleThreads.sort((a,b) => {
    const aPinned = Array.isArray(a.pinnedUids) && a.pinnedUids.includes(uid) ? 1 : 0;
    const bPinned = Array.isArray(b.pinnedUids) && b.pinnedUids.includes(uid) ? 1 : 0;
    return bPinned - aPinned || stamp(b.updatedAt || b.lastMessageAt) - stamp(a.updatedAt || a.lastMessageAt);
  });
  const thread = (t) => { const p = peer(t); const pinned = Array.isArray(t.pinnedUids) && t.pinnedUids.includes(uid); return `<article class="thread-row"><button class="thread" type="button" data-action="open-thread" data-id="${esc(t.id)}">${avatar(p,"md",true)}<span class="thread-copy"><strong>${pinned ? `${icon("star",13)} ` : ""}${esc(p.displayName || p.username || "Conversation")}</strong><small>${esc(typeof t.lastMessage === "string" ? t.lastMessage : (t.lastMessage?.text || t.lastMessageText || "No messages yet"))}</small></span><span class="thread-meta">${when(t.lastMessageAt || t.updatedAt)}</span></button><button class="thread-options-button" type="button" data-action="thread-options" data-id="${esc(t.id)}" aria-label="Conversation options">${icon("menuDots",17)}</button></article>`; };
  return `<section class="screen chat-screen">${head("CONVERSATIONS","Chat","Private conversations with people you choose.","focus-chat-search","New chat")}${contextualSearch("chat-person-search-form","Search exact username…","users",state.chatSearchQuery)}${state.chatSearchResults.length ? `<section class="inline-results"><div class="section-head compact"><div><span class="eyebrow">PEOPLE</span><h2>Search results</h2></div><button class="text-button" type="button" data-action="clear-chat-search">Clear</button></div><div class="results">${state.chatSearchResults.slice(0,8).map(searchResultCard).join("")}</div></section>` : ""}<div class="threads">${visibleThreads.length ? visibleThreads.map(thread).join("") : emptyState("No conversations yet","Search an exact username above to start a conversation.")}</div></section>`;
}

function renderSkills() {
  const q = state.skillsSearchQuery.trim().toLowerCase();
  const filtered = state.skills.filter((item) => {
    if (!categoryMatches(item, state.skillCategory || "all")) return false;
    if (!q) return true;
    return [item.title, item.description, item.categoryId, ...(item.tags || [])].join(" ").toLowerCase().includes(q);
  });
  const card = (item) => { const mediaPending = Array.isArray(item.mediaIds) && item.mediaIds.length && !Array.isArray(item.mediaUrls); return `<article class="listing-card" ${mediaPending ? `data-media-kind="skill" data-media-id="${esc(item.id)}"` : ""}>${item.mediaUrls?.[0]?.url ? `<img class="catalogue-thumb" src="${esc(item.mediaUrls[0].url)}" alt="${esc(item.title || "Service photo")}" data-media-kind="skill" data-media-id="${esc(item.id)}" loading="lazy" decoding="async">` : `<div class="listing-icon">${icon("skills",20)}</div>`}<div class="grow"><span class="eyebrow">SERVICE</span><h3>${esc(item.title || "Skill listing")}</h3><p>${esc(item.description || "")}</p><div class="tags">${(item.tags || []).slice(0,4).map((tag) => `<span>${esc(tag)}</span>`).join("")}</div><small class="muted">${money(item.priceFromMinor,item.currency || "NGN")}</small></div><button class="btn btn-secondary" type="button" data-action="skill-view" data-id="${esc(item.id)}">View</button></article>`; };
  return `<section class="screen skills-screen">${head("DISCOVERY","Marvel Skills","Discover services and providers.")}${contextualSearch("skills-search-form","Search services or providers…","skills",state.skillsSearchQuery)}<section class="section"><div class="section-head compact"><div><span class="eyebrow">CATEGORIES</span><h2>Explore skills</h2></div>${state.skillProfile ? `<button class="text-button" type="button" data-action="route-skill-profile">My Skills</button>` : ""}</div>${categoryChips("skills",state.skillCategory || "all")}</section><section class="section"><div class="listing-grid">${filtered.length ? filtered.map(card).join("") : emptyState("No services here yet","Try another category or search phrase when new listings are available.")}</div></section></section>`;
}

function renderSkillProfile() {
  const p = state.skillProfile;
  const mine = state.skillListingsMine;
  const requests = state.skillRequests.slice(0,12);
  return `<section class="screen">${head("PROVIDER ACCOUNT","My Skills",p ? "Manage your provider profile and services." : "Create your provider account from Profile.",p ? "create-skill-listing" : "route-skill-onboarding",p ? "Add service" : "Create account", "profile")}<div class="workspace-card featured"><div class="workspace-icon">${icon("skills",22)}</div><div class="grow"><span class="eyebrow">PROVIDER PROFILE</span><h2>${esc(p?.headline || "Provider account")}</h2><p>${esc(p?.bio || "Your provider profile will appear here after setup.")}</p>${p ? `<div class="tags">${(p.categories || []).slice(0,6).map((c) => `<span>${esc(c)}</span>`).join("")}<span>${p.remote ? "Remote" : "On location"}</span></div>` : ""}</div></div>${p ? `<section class="section"><div class="section-head compact"><div><span class="eyebrow">MY SERVICES</span><h2>${mine.length} service${mine.length === 1 ? "" : "s"}</h2></div></div><div class="listing-grid">${mine.length ? mine.map((item) => `<article class="listing-card">${item.mediaUrls?.[0]?.url ? `<img class="catalogue-thumb" src="${esc(item.mediaUrls[0].url)}" alt="${esc(item.title || "Service photo")}" data-media-kind="skill" data-media-id="${esc(item.id)}" loading="lazy" decoding="async">` : `<div class="listing-icon">${icon("skills",20)}</div>`}<div class="grow"><h3>${esc(item.title || "Service")}</h3><p>${esc(item.description || "")}</p><small class="muted">${esc(item.status || "active")} · ${money(item.priceFromMinor,item.currency || "NGN")}</small></div><div class="stack-buttons"><button class="btn btn-secondary" type="button" data-action="edit-skill-listing" data-id="${esc(item.id)}">Edit</button>${item.status === "active" ? `<button class="btn btn-secondary" type="button" data-action="pause-skill-listing" data-id="${esc(item.id)}">Pause</button>` : item.status === "paused" ? `<button class="btn btn-secondary" type="button" data-action="activate-skill-listing" data-id="${esc(item.id)}">Offer</button>` : ""}<button class="btn btn-secondary" type="button" data-action="delete-skill-listing" data-id="${esc(item.id)}">Delete</button></div></article>`).join("") : emptyState("No services yet","Add your first service to appear in Marvel Skills.","create-skill-listing","Add service")}</div></section><section class="section"><div class="section-head compact"><div><span class="eyebrow">REQUESTS</span><h2>Skill activity</h2></div></div>${requests.length ? requests.map((r) => `<article class="notification"><div class="notification-icon">${icon("skills",18)}</div><div class="grow"><strong>${esc(r.title || "Skill request")}</strong><p>${esc(r.status || "open")}</p><small>${formatDate(r.updatedAt || r.createdAt)}</small></div></article>`).join("") : emptyState("No skill requests","Requests will appear here when members contact your services.")}</section>` : ""}</section>`;
}

function renderMarket() {
  let filtered = state.products.filter((item) => categoryMatches(item, state.marketCategory || "all"));
  const query = String(state.searchQuery || "").trim().toLowerCase();
  if (query) filtered = filtered.filter((p) => [p.title,p.description,p.storeName,p.categoryId,...(p.tags || [])].join(" ").toLowerCase().includes(query));
  const score = (item) => Number(item.marketScore ?? item.score ?? 0);
  if (state.marketSort === "price_low") filtered.sort((a,b) => Number(a.priceMinor || 0) - Number(b.priceMinor || 0));
  else if (state.marketSort === "price_high") filtered.sort((a,b) => Number(b.priceMinor || 0) - Number(a.priceMinor || 0));
  else if (state.marketSort === "newest") filtered.sort((a,b) => stamp(b.createdAt) - stamp(a.createdAt));
  else filtered.sort((a,b) => score(b) - score(a));
  const shopCard = (shop) => `<button type="button" class="market-shop-card" data-action="market-view-shop" data-id="${esc(shop.id)}"><span class="market-shop-avatar">${icon("shop",20)}</span><span class="market-shop-copy"><strong>${esc(shop.name || "Shop")}</strong><small>${esc(shop.category || "Independent shop")}${shop.locationText || shop.location ? ` · ${esc(shop.locationText || shop.location)}` : ""}</small></span><span class="market-shop-arrow">${icon("arrow",16)}</span></button>`;
  const card = (p) => { const image = p.mediaUrls?.[0]?.url; const productId = p.id || p.productId || ""; const mediaPending = Array.isArray(p.mediaIds) && p.mediaIds.length && !Array.isArray(p.mediaUrls); const saved = state.marketSavedProductIds.includes(String(productId)); return `<article class="product-card" ${mediaPending ? `data-media-kind="market" data-media-id="${esc(productId)}"` : ""}><button class="product-card-main" type="button" data-action="market-view" data-id="${esc(productId)}"><div class="product-cover">${image ? `<img src="${esc(image)}" alt="${esc(p.title || "Product photo")}" data-media-kind="market" data-media-id="${esc(productId)}" loading="lazy" decoding="async">` : `<div class="product-cover-icon">${icon("market",24)}</div>`}</div><div class="product-info"><span class="eyebrow">PRODUCT</span><h3>${esc(p.title || "Product")}</h3><p>${esc(p.description || "")}</p><strong>${money(p.priceMinor,p.currency || "NGN")}</strong></div></button><div class="product-card-foot"><button type="button" class="product-shop-link" data-action="market-view-shop" data-id="${esc(p.storeId || "")}">${icon("shop",14)} ${esc(p.storeName || "View shop")}</button><button type="button" class="product-save-button ${saved ? "is-saved" : ""}" data-action="save-market-product" data-id="${esc(productId)}" data-saved="${saved}" aria-pressed="${saved}">${icon("bookmark",15)}</button></div></article>`; };
  const shops = state.marketStores.slice(0, 12);
  return `<section class="screen market-screen">${head("DISCOVERY","Marvel Market","Explore independent shops and the products they offer.",state.myStore ? "route-business" : "route-seller-onboarding",state.myStore ? "My Shop" : "Open a shop")}${contextualSearch("market-form","Search products and shops…","market",state.searchQuery)}<section class="section"><div class="section-head compact"><div><span class="eyebrow">CATEGORIES</span><h2>Browse categories</h2></div></div>${categoryChips("market",state.marketCategory || "all")}</section><section class="section"><div class="section-head compact"><div><span class="eyebrow">STOREFRONTS</span><h2>Explore shops</h2></div></div><div class="market-shop-grid">${shops.length ? shops.map(shopCard).join("") : `<p class="muted">New shops will appear here as sellers open their storefronts.</p>`}</div></section><section class="section"><div class="section-head compact"><div><span class="eyebrow">PRODUCTS</span><h2>${query ? "Search results" : "Discover products"}</h2></div><label class="market-sort"><span>Sort</span><select data-action="market-sort" aria-label="Sort products"><option value="recommended" ${state.marketSort === "recommended" ? "selected" : ""}>Recommended</option><option value="newest" ${state.marketSort === "newest" ? "selected" : ""}>Newest</option><option value="price_low" ${state.marketSort === "price_low" ? "selected" : ""}>Price: low to high</option><option value="price_high" ${state.marketSort === "price_high" ? "selected" : ""}>Price: high to low</option></select></label><button type="button" class="btn btn-secondary" data-action="show-saved-market">${icon("bookmark",15)} Saved</button></div><div class="product-grid">${filtered.length ? filtered.map(card).join("") : emptyState("Nothing to show yet","Try another category or search phrase.")}</div></section></section>`;
}

function renderBusiness() {
  const s = state.myStore;
  const products = state.myProducts;
  return `<section class="screen">${head("MY SHOP","My Shop",s ? "Manage your storefront, products, stock, and customer requests." : "Create your seller account from Profile.","route-seller-onboarding",s ? "Edit shop" : "Create shop", "profile")}
    <div class="business-hero"><div class="business-symbol">${icon("shop",25)}</div><div class="grow"><span class="eyebrow">MY SHOP</span><h2>${esc(s?.name || "Your shop")}</h2><p>${esc(s?.description || "Create your store, then add products and manage inventory and availability.")}</p>${s ? `<div class="tags"><span>${esc(s.status || "paused")}</span><span>${esc(s.category || "Uncategorized")}</span><span>${esc(s.location || s.locationText || "Location not set")}</span></div>` : ""}</div></div>
    ${!s ? emptyState("No shop yet","Create your seller account from Profile.","route-seller-onboarding","Create shop") : `<section class="section"><div class="section-head compact"><div><span class="eyebrow">CATALOGUE</span><h2>${products.length} product${products.length === 1 ? "" : "s"}</h2></div><div class="stack-buttons"><button class="btn btn-secondary" type="button" data-action="store-status-toggle" data-status="${esc(s.status === "active" ? "paused" : "active")}">${s.status === "active" ? "Pause store" : "Open store"}</button><button class="btn btn-primary" type="button" data-action="create-product">${icon("plus",17)}New product</button></div></div><div class="listing-grid">${products.length ? products.map((p) => `<article class="listing-card"><div class="listing-icon">${icon("market",20)}</div><div class="grow"><h3>${esc(p.title || "Product")}</h3><p>${esc(p.description || "")}</p><small class="muted">${esc(p.status || "draft")} · ${money(p.priceMinor,p.currency || "NGN")} · Stock ${Number(p.inventoryQuantity || 0)}</small></div><div class="stack-buttons"><button class="btn btn-secondary" type="button" data-action="edit-product" data-id="${esc(p.id)}">Edit</button><button class="btn btn-secondary" type="button" data-action="inventory-product" data-id="${esc(p.id)}">Stock</button>${p.status === "archived" ? "" : p.status === "active" ? `<button class="btn btn-secondary" type="button" data-action="pause-product" data-id="${esc(p.id)}">Pause</button>` : `<button class="btn btn-secondary" type="button" data-action="activate-product" data-id="${esc(p.id)}">Activate</button>`}<button class="btn btn-secondary" type="button" data-action="archive-product" data-id="${esc(p.id)}">Archive</button></div></article>`).join("") : emptyState("No products yet","Create your first real product listing.","create-product","Create product")}</div></section>
    <section class="section"><div class="section-head compact"><div><span class="eyebrow">COMMERCE REQUESTS</span><h2>Customer activity</h2></div></div><div>${state.commerceRequests.length ? state.commerceRequests.map((r) => `<article class="notification"><div class="notification-icon">${icon("market",18)}</div><div class="grow"><strong>${esc(r.requestId || r.id || "Commerce request")}</strong><p>${esc(r.status || "submitted")} · ${money(r.totalMinor,r.currency || "NGN")}</p><small>${formatDate(r.updatedAt || r.createdAt)}</small></div><div class="stack-buttons">${r.status === "submitted" ? `<button class="btn btn-secondary" type="button" data-action="commerce-status" data-id="${esc(r.id)}" data-status="accepted">Accept</button><button class="btn btn-secondary" type="button" data-action="commerce-status" data-id="${esc(r.id)}" data-status="cancelled">Cancel</button>` : r.status === "accepted" ? `<button class="btn btn-secondary" type="button" data-action="commerce-status" data-id="${esc(r.id)}" data-status="processing">Processing</button>` : r.status === "processing" ? `<button class="btn btn-secondary" type="button" data-action="commerce-status" data-id="${esc(r.id)}" data-status="ready">Ready</button>` : r.status === "ready" ? `<button class="btn btn-secondary" type="button" data-action="commerce-status" data-id="${esc(r.id)}" data-status="completed">Complete</button>` : ""}</div></article>`).join("") : emptyState("No commerce requests","Customer requests will appear here.")}</div></section>`}`;
}

function renderSellerOnboarding() {
  const step = state.sellerOnboardingStep;
  const d = state.sellerDraft;
  const steps = ["Welcome","Standards","Agreement","Details"];
  const pages = [
    ["Build your storefront","Create the business identity customers will see.","shop"],
    ["Seller standards","Use accurate descriptions, truthful availability, and responsible customer communication.","shield"],
    ["Marketplace agreement","Accept the marketplace responsibilities before creating the real store.","file"],
    ["Business details","Add the name, description, category, and location customers will see.","edit"]
  ];
  const p = pages[step];
  return `<section class="screen onboarding-screen"><div class="onboarding-shell"><div class="page-back-wrap"><button class="page-back" type="button" data-action="route-profile" aria-label="Back to Profile">${icon("back",18)}<span>Back to Profile</span></button></div><div class="stepper">${steps.map((x,i) => `<span class="step-dot ${i <= step ? "active" : ""}">${i < step ? icon("check",13) : i+1}</span>${i < steps.length-1 ? `<i class="step-line ${i < step ? "active" : ""}"></i>` : ""}`).join("")}</div><div class="onboarding-card"><div class="onboarding-icon">${icon(p[2],26)}</div><span class="eyebrow">${esc(steps[step])}</span><h1>${esc(p[0])}</h1><p class="onboarding-copy">${esc(p[1])}</p>${step === 2 ? `<label class="agree-row large"><input type="checkbox" id="seller-agreement" ${d.agreed ? "checked" : ""}><span>I accept the seller standards and marketplace responsibilities.</span></label>` : ""}${step === 3 ? `<form id="seller-details-form" class="form-stack compact-form"><label class="floating-field"><input name="name" value="${esc(d.name || "")}" maxlength="120" required><span>Business name</span></label><label class="floating-field"><textarea name="description" maxlength="1000">${esc(d.description || "")}</textarea><span>Business description</span></label><label class="floating-field"><input name="category" value="${esc(d.category || "")}" maxlength="100" placeholder=" "><span>Business category</span></label><label class="floating-field"><input name="location" value="${esc(d.location || "")}" maxlength="200" placeholder=" "><span>Business location</span></label></form>` : ""}<div class="onboarding-actions"><button class="btn btn-secondary" type="button" data-action="onboarding-back" ${step===0 ? "disabled" : ""}>Back</button><button class="btn btn-primary" type="button" data-action="onboarding-next">${step===3 ? (d.storeId ? "Update store" : "Create store") : "Continue"}</button></div></div><button class="text-button" type="button" data-action="route-business">Exit setup</button></div></section>`;
}

function renderSkillOnboarding() {
  const step = state.skillOnboardingStep;
  const d = state.skillDraft;
  const steps = ["Profile","Experience","Service","Review"];
  const page = [["Provider account","Create the professional identity behind your Skills services.","profile"],["Your experience","Describe your strengths, location, remote availability, and experience.","spark"],["Your first service","Create the first service that will appear in Marvel Skills.","skills"],["Review","Check your provider profile and service before publishing.","check"]][step];
  const categoryOptions = (state.skillCategories.length ? state.skillCategories.map((c) => [c.id,c.name || c.id]) : SKILL_CATEGORIES.filter((x) => x[0] !== "all"));
  let form = "";
  if (step === 0) form = `<form id="skill-details-form" class="form-stack compact-form"><label class="floating-field"><input name="headline" maxlength="180" value="${esc(d.headline || "")}" required><span>Professional headline</span></label><label class="floating-field"><textarea name="bio" maxlength="2000" required>${esc(d.bio || "")}</textarea><span>Professional bio</span></label></form>`;
  if (step === 1) form = `<form id="skill-details-form" class="form-stack compact-form"><label class="floating-field"><input name="locationText" maxlength="160" value="${esc(d.locationText || "")}" placeholder=" "><span>Location</span></label><label class="select-field"><span>Remote availability</span><select name="remote"><option value="true" ${d.remote !== false ? "selected" : ""}>Remote available</option><option value="false" ${d.remote === false ? "selected" : ""}>On location</option></select></label><label class="floating-field"><input name="yearsExperience" type="number" min="0" max="80" value="${Number(d.yearsExperience || 0)}" required><span>Years of experience</span></label></form>`;
  if (step === 2) form = `<form id="skill-details-form" class="form-stack compact-form"><label class="select-field"><span>Primary category</span><select name="category" required>${categoryOptions.map(([id,label]) => `<option value="${esc(id)}" ${d.category === id ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label><label class="floating-field"><input name="listingTitle" maxlength="160" value="${esc(d.listingTitle || "")}" required><span>Service title</span></label><label class="floating-field"><textarea name="listingDescription" maxlength="3000" required>${esc(d.listingDescription || "")}</textarea><span>Service description</span></label><label class="floating-field"><input name="priceFromMinor" type="number" min="0" value="${esc(d.priceFromMinor || "")}" placeholder=" "><span>Starting price (minor units)</span></label><label class="floating-field"><input name="deliveryTimeDays" type="number" min="1" max="365" value="${esc(d.deliveryTimeDays || "")}" placeholder=" "><span>Delivery time in days</span></label><label class="floating-field"><input name="tags" maxlength="500" value="${esc(d.tags || "")}" placeholder=" "><span>Tags, comma separated</span></label></form>`;
  if (step === 3) form = `<div class="review-card"><strong>${esc(d.headline || "Provider")}</strong><p>${esc(d.bio || "")}</p><span>${esc(d.category || "No category")}</span><p>${esc(d.listingTitle || "No listing title")}</p><small>${esc(d.listingDescription || "")}</small></div>`;
  return `<section class="screen onboarding-screen"><div class="onboarding-shell"><div class="page-back-wrap"><button class="page-back" type="button" data-action="route-profile" aria-label="Back to Profile">${icon("back",18)}<span>Back to Profile</span></button></div><div class="stepper">${steps.map((x,i) => `<span class="step-dot ${i <= step ? "active" : ""}">${i < step ? icon("check",13) : i+1}</span>${i < steps.length-1 ? `<i class="step-line ${i < step ? "active" : ""}"></i>` : ""}`).join("")}</div><div class="onboarding-card"><div class="onboarding-icon">${icon(page[2],26)}</div><span class="eyebrow">${esc(steps[step])}</span><h1>${esc(page[0])}</h1><p class="onboarding-copy">${esc(page[1])}</p>${form}<div class="onboarding-actions"><button class="btn btn-secondary" type="button" data-action="skill-onboarding-back" ${step===0 ? "disabled" : ""}>Back</button><button class="btn btn-primary" type="button" data-action="skill-onboarding-next">${step===3 ? "Publish profile + listing" : "Continue"}</button></div></div><button class="text-button" type="button" data-action="route-skill-profile">Exit setup</button></div></section>`;
}

function renderProfile() {
  const p = state.profile || {};
  const posts = state.followStats.postCount ?? p.postsCount ?? p.postCount ?? 0;
  const followers = state.followStats.followersCount ?? p.followersCount ?? 0;
  const following = state.followStats.followingCount ?? p.followingCount ?? state.followingIds.length ?? 0;
  return `<section class="screen">${head("YOUR SPACE","Profile","Your identity, provider account, seller account, and settings.","edit-profile","Edit profile")}<div class="profile-hero">${avatar(p,"xl",true)}<div class="profile-main"><h1>${esc(p.displayName || state.user?.displayName || "Your profile")}</h1><p class="handle">${esc(p.username ? `@${p.username}` : p.email || state.user?.email || "")}</p><p class="bio">${esc(p.bio || "")}</p></div></div><div class="profile-stats"><button type="button" data-action="profile-posts"><strong>${esc(posts)}</strong><span>Posts</span></button><button type="button" data-action="profile-followers"><strong>${esc(followers)}</strong><span>Followers</span></button><button type="button" data-action="profile-following"><strong>${esc(following)}</strong><span>Following</span></button></div><div class="profile-grid"><button class="profile-tile" type="button" data-action="route-skill-profile"><span class="tile-icon">${icon("skills",20)}</span><strong>${state.skillProfile ? "My Skills" : "Create skill account"}</strong><small>${state.skillProfile ? "Manage your provider profile and services." : "Become a provider from your Profile."}</small>${icon("arrow",17)}</button><button class="profile-tile" type="button" data-action="route-business"><span class="tile-icon">${icon("shop",20)}</span><strong>${state.myStore ? "My Shop" : "Create seller account"}</strong><small>${state.myStore ? "Manage your storefront, products, stock, and orders." : "Create a seller account before opening your shop."}</small>${icon("arrow",17)}</button><button class="profile-tile" type="button" data-action="route-settings"><span class="tile-icon">${icon("settings",20)}</span><strong>Settings</strong><small>Appearance and notification preferences.</small>${icon("arrow",17)}</button></div><div class="profile-footer-actions"><button class="btn btn-secondary" type="button" data-action="sign-out">${icon("logout",17)}Sign out</button></div></section>`;
}

function renderSearch() {
  const results = state.searchResults.slice(0,24);
  return `<section class="screen">${head("DISCOVERY","Search","Find people, skills, products, and shops.", "", "", "home")}<form id="search-form" class="search-form"><label class="search-box">${icon("search",18)}<input name="query" value="${esc(state.searchQuery)}" maxlength="80" placeholder="Search everything…" autocomplete="off"></label><select name="scope"><option value="all" ${state.searchScope === "all" ? "selected" : ""}>Everything</option><option value="users" ${state.searchScope === "users" ? "selected" : ""}>People</option><option value="skills" ${state.searchScope === "skills" ? "selected" : ""}>Skills</option><option value="market" ${state.searchScope === "market" ? "selected" : ""}>Market</option></select><button class="btn btn-primary" type="submit">Search</button></form><div class="results">${results.length ? results.map(searchResultCard).join("") : emptyState("Start searching","Search by name, username, skill, product, or shop.")}</div></section>`;
}
function renderNotifications() { return `<section class="screen">${head("UPDATES","Notifications",state.unreadNotifications ? `${state.unreadNotifications} unread` : "You are all caught up.", "", "", "home")}<div>${state.notifications.length ? state.notifications.map((n) => `<article class="notification ${n.read || n.isRead || n.readAt ? "" : "unread"}"><div class="notification-icon">${icon("bell",18)}</div><div class="grow"><strong>${esc(n.title || "Marvel Chat")}</strong><p>${esc(n.body || "")}</p><small>${when(n.createdAt)}</small></div>${!(n.read || n.isRead || n.readAt) ? `<button class="text-button" type="button" data-action="read-notification" data-id="${esc(n.id)}">Mark read</button>` : ""}</article>`).join("") : emptyState("No new notifications","Activity updates will appear here.")}</div></section>`; }
function renderHelp() {
  return `<section class="screen help-screen">${head("HELP CENTRE","How to use Marvel Chat","A quick guide to getting value from each section.","route-home","Back to Home")}<div class="help-guide-grid"><article class="help-guide-card"><span class="help-guide-icon">${icon("home",22)}</span><h2>Home and Moments</h2><p>Browse community posts, swipe through post photos and videos, expand captions, like, comment, save, and follow people. Select Create to publish a post or a temporary Moment.</p></article><article class="help-guide-card"><span class="help-guide-icon">${icon("chat",22)}</span><h2>Chat</h2><p>Search for a person by username, open a conversation, and send a message. Use conversation options to keep important chats organized. Enable browser notifications in Settings if you want alerts outside the app.</p></article><article class="help-guide-card"><span class="help-guide-icon">${icon("skills",22)}</span><h2>Marvel Skills</h2><p>Create a provider profile to publish services. Add a clear service photo, accurate description, category and price. Manage a service from My Skills; deletion removes it from public discovery, while request history may be retained when needed.</p></article><article class="help-guide-card"><span class="help-guide-icon">${icon("market",22)}</span><h2>Marvel Market</h2><p>Browse categories, open a shop to view its available products, and save items for later. Sellers can create a shop from Profile, then add product details, price, stock and product photos.</p></article><article class="help-guide-card"><span class="help-guide-icon">${icon("profile",22)}</span><h2>Profile and Settings</h2><p>Keep your name, username, profile photo and bio up to date. Your posts, follower list and following list are available from Profile. Settings controls appearance and notification permission.</p></article><article class="help-guide-card"><span class="help-guide-icon">${icon("shield",22)}</span><h2>Privacy and media</h2><p>Choose post visibility carefully and share only content you have permission to upload. Image compression shows the resulting file size. The shared media allowance is 2 MiB over a rolling 24-hour period.</p></article></div><div class="help-support-card"><div><strong>Need help?</strong><p>Contact Davonium Technologies for support and product feedback.</p></div><a class="btn btn-primary" href="https://www.davoniumtech.com/contact" target="_blank" rel="noopener noreferrer">Contact support</a></div></section>`;
}

function renderSettings() {
  return `<section class="screen">${head("PREFERENCES","Settings","Choose how Marvel Chat looks and behaves.", "", "", "profile")}<div class="settings-list"><article class="setting-card"><div class="setting-copy"><strong>Appearance</strong><small>Choose the theme used across the application.</small></div><div class="theme-pills">${["light","dark","system"].map((x) => `<button class="${state.theme === x ? "active" : ""}" type="button" data-action="theme-${x}">${icon(x === "light" ? "sun" : x === "dark" ? "moon" : "system",16)}${x[0].toUpperCase()+x.slice(1)}</button>`).join("")}</div></article><article class="setting-card"><div class="setting-copy"><strong>Notifications</strong><small>Receive Marvel Chat updates on this browser when permission is enabled.</small></div>${state.pushEnabled ? `<button class="btn btn-secondary" type="button" data-action="disable-notifications">Disable</button>` : `<button class="btn btn-primary" type="button" data-action="enable-notifications">Enable</button>`}</article><button class="setting-card setting-link" type="button" data-action="legal-terms"><div class="setting-copy"><strong>Terms</strong><small>Review our service terms.</small></div>${icon("arrow",18)}</button><button class="setting-card setting-link" type="button" data-action="legal-privacy"><div class="setting-copy"><strong>Privacy</strong><small>Learn how account and activity data are handled.</small></div>${icon("arrow",18)}</button><button class="setting-card setting-link" type="button" data-action="legal-community"><div class="setting-copy"><strong>Community Guidelines</strong><small>Our standards for a useful and trustworthy community.</small></div>${icon("arrow",18)}</button></div></section>`;
}

function getBrowserDeviceIds() {
  const make = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  let deviceId = localStorage.getItem("marvel-device-id");
  let installationId = localStorage.getItem("marvel-installation-id");
  if (!deviceId) { deviceId = make(); localStorage.setItem("marvel-device-id", deviceId); }
  if (!installationId) { installationId = make(); localStorage.setItem("marvel-installation-id", installationId); }
  return {deviceId, installationId};
}

let foregroundMessageUnsubscribe = null;

async function enableBrowserNotifications() {
  if (!("Notification" in window)) { toast("Notifications are not supported in this browser.","error"); return; }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") { toast("Notification permission was not granted.","error"); return; }
  try {
    const token = await getBrowserFcmToken();
    if (!token) throw new Error("Browser push is unavailable on this device.");
    const {deviceId, installationId} = getBrowserDeviceIds();
    await api.registerDevice({deviceId, installationId, token, platform:"web", browser:navigator.userAgent.slice(0,120)});
    await api.updateUserSettings({notificationPreferences:{pushEnabled:true}});
    state.pushEnabled = true;
    if (foregroundMessageUnsubscribe) foregroundMessageUnsubscribe();
    foregroundMessageUnsubscribe = onForegroundMessage((payload) => {
      const title = payload?.notification?.title || "Marvel Chat";
      const body = payload?.notification?.body || "You have a new update.";
      toast(`${title}: ${body}`,"info");
      void loadNotifications();
    });
    toast("Notifications enabled.","success");
    paint();
  } catch (error) {
    console.error("FCM registration failed", error?.code, error?.message);
    toast(friendlyError(error),"error");
  }
}

async function disableBrowserNotifications() {
  try {
    const {deviceId} = getBrowserDeviceIds();
    await api.unregisterDevice({deviceId});
    await api.updateUserSettings({notificationPreferences:{pushEnabled:false}});
    state.pushEnabled = false;
    if (foregroundMessageUnsubscribe) { foregroundMessageUnsubscribe(); foregroundMessageUnsubscribe = null; }
    toast("Notifications disabled for this browser.","success");
    paint();
  } catch (error) {
    toast(friendlyError(error),"error");
  }
}

async function legalBody(type) {
  const pages = {
    terms: "terms.html",
    privacy: "privacy.html",
    community: "community-guidelines.html"
  };
  const page = pages[type];
  if (!page) throw new Error("The requested legal page is unavailable.");

  const response = await fetch(new URL(page, document.baseURI), {
    method: "GET",
    credentials: "same-origin",
    cache: "no-cache",
    headers: {"Accept": "text/html"}
  });
  if (!response.ok) throw new Error(`Could not load the legal page (${response.status}).`);

  const parsed = new DOMParser().parseFromString(await response.text(), "text/html");
  const main = parsed.querySelector("main") || parsed.body;
  if (!main) throw new Error("The legal page content is unavailable.");

  // The files are first-party static policy documents. Strip executable or
  // embedding elements before rendering their text inside the modal.
  main.querySelectorAll("script,style,iframe,object,embed,form,base,meta,link").forEach((node) => node.remove());
  main.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      if (/^on/i.test(attribute.name) || attribute.name.toLowerCase() === "srcdoc") {
        node.removeAttribute(attribute.name);
      }
    });
  });
  main.querySelector("header")?.remove();
  main.querySelector(".legal-page-hero")?.remove();
  main.querySelector(".legal-policy-nav")?.remove();
  main.querySelectorAll('a[data-return-marvel], a[href="./"], a[href="/"]').forEach((link) => {
    const button = parsed.createElement("button");
    button.type = "button";
    button.className = link.className || "legal-return-button";
    button.dataset.action = "close-modal";
    button.textContent = link.textContent || "Return to Marvel Chat";
    link.replaceWith(button);
  });
  main.querySelector("h1")?.remove();
  main.querySelector(".meta")?.remove();
  main.querySelector(":scope > p")?.remove();

  const summary = {
    terms: "The conditions governing your use of Marvel Chat.",
    privacy: "How Davonium Technologies handles information used to operate Marvel Chat.",
    community: "The standards that help keep Marvel Chat useful, respectful and trustworthy."
  }[type];
  const legalLinks = [["terms","Terms of Use"],["privacy","Privacy Policy"],["community","Community Guidelines"]];
  const switcher = `<nav class="legal-modal-switcher" aria-label="Switch legal page">${legalLinks.map(([key,label]) => `<button type="button" class="${key === type ? "active" : ""}" data-action="legal-${key}" ${key === type ? 'aria-current="page"' : ""}>${label}</button>`).join("")}</nav>`;
  const hero = `<section class="legal-modal-hero"><div class="legal-modal-mark"><img src="./assets/brand/icon-192.png" width="56" height="56" alt="Marvel Chat"></div><div class="legal-modal-hero-copy"><span class="eyebrow">OFFICIAL POLICY · DAVONIUM TECHNOLOGIES</span><h3>${esc({terms:"Terms of Use",privacy:"Privacy Policy",community:"Community Guidelines"}[type])}</h3><p>${esc(summary)}</p></div>${switcher}</section>`;
  return `${hero}<div class="legal-modal-document">${main.innerHTML}</div>`;
}

function openLegal(type) {
  const title = {terms:"Terms",privacy:"Privacy Policy",community:"Community Guidelines"}[type];
  if (!title) return;
  modal(title, `<div class="legal-loading" role="status"><span class="legal-loading-dot"></span>Loading the official ${esc(title)}…</div>`,
    `<button class="btn btn-primary" type="button" data-action="close-modal">Done</button>`, {wide:true});

  void legalBody(type).then((body) => {
    const dialog = document.querySelector("#modal-root .modal");
    if (!dialog || dialog.getAttribute("aria-label") !== title) return;
    const content = dialog.querySelector(".modal-body");
    if (!content) return;
    content.innerHTML = body;
    content.querySelectorAll('.legal-modal-document a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetId = link.getAttribute("href").slice(1);
        const target = [...content.querySelectorAll("[id]")].find((element) => element.id === targetId);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
      });
    });
  }).catch((error) => {
    const dialog = document.querySelector("#modal-root .modal");
    if (!dialog || dialog.getAttribute("aria-label") !== title) return;
    const content = dialog.querySelector(".modal-body");
    if (content) {
      const fallback = {terms:"terms.html",privacy:"privacy.html",community:"community-guidelines.html"}[type];
      content.innerHTML = `<div class="legal-load-error"><p>${esc(friendlyError(error))}</p><a class="btn btn-secondary" href="./${fallback}">Open full page</a></div>`;
    }
  });
}

const viewMap = {
  home: renderHome, chat: renderChat, skills: renderSkills, market: renderMarket,
  profile: renderProfile, search: renderSearch, "saved-posts": renderSavedPosts, notifications: renderNotifications,
  settings: renderSettings,
  help: renderHelp, "skill-profile": renderSkillProfile,
  business: renderBusiness, "seller-onboarding": renderSellerOnboarding,
  "skill-onboarding": renderSkillOnboarding
};

function bindHomePagination() {
  // Home pagination is deliberately user-triggered: only three posts are loaded
  // at a time, and a real cursor request runs only when Load more is tapped.
  homePaginationObserver?.disconnect();
  homePaginationObserver = null;
}

function bindCatalogueMedia() {
  catalogueMediaObserver?.disconnect();
  catalogueMediaObserver = null;
  if (!("IntersectionObserver" in window)) return;
  const pending = app.querySelectorAll('[data-media-kind][data-media-id]');
  if (!pending.length) return;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const kind = entry.target.dataset.mediaKind;
      const id = entry.target.dataset.mediaId;
      let item = null;
      if (kind === "market") item = state.products.find((candidate) => candidate.id === id || candidate.result?.id === id);
      if (kind === "skill") item = state.skills.find((candidate) => candidate.id === id);
      if (!item) continue;
      const routeAtStart = state.route;
      const hydrate = kind === "market" ? hydrateMarketProductMedia(item) : hydrateSkillListingMedia(item);
      void hydrate.then(() => { if (state.route === routeAtStart) paint(); });
    }
  }, {root:null, rootMargin:"240px 0px", threshold:0});
  catalogueMediaObserver = observer;
  pending.forEach((element) => observer.observe(element));
}

function paint() {
  if (!state.user) {
    stopDiscoveryBannerTimer();
    homePaginationObserver?.disconnect();
    homePaginationObserver = null;
    app.innerHTML = authScreen();
    return;
  }
  // Capture the actual scroll offset before replacing the feed DOM. Keeping a
  // pixel ratio (not merely the rounded slide number) avoids snapping a user's
  // finger back to slide one when a signed URL finishes loading mid-swipe.
  const carouselOffsets = new Map();
  app.querySelectorAll("[data-post-carousel-track]").forEach((track) => {
    if (!track.dataset.id || !track.clientWidth) return;
    const ratio = track.scrollLeft / track.clientWidth;
    carouselOffsets.set(String(track.dataset.id), ratio);
    const post = [...state.posts, ...state.savedPosts].find((item) => String(item.id) === String(track.dataset.id));
    if (post) post.mediaIndex = Math.max(0, Math.min((post.mediaIds || []).length - 1, Math.round(ratio)));
  });
  app.innerHTML = shell((viewMap[state.route] || renderHome)(), state.route === "chat" && Boolean(state.activeThreadId));
  bindHomePagination();
  bindCatalogueMedia();
  app.querySelectorAll("[data-post-carousel-track]").forEach((track) => {
    const savedRatio = carouselOffsets.get(String(track.dataset.id));
    const fallbackIndex = Math.max(0, Number(track.dataset.startIndex || 0));
    const ratio = Number.isFinite(savedRatio) ? savedRatio : fallbackIndex;
    requestAnimationFrame(() => {
      if (!track.isConnected || !track.clientWidth) return;
      track.scrollLeft = Math.max(0, ratio * track.clientWidth);
    });
  });
  syncDiscoveryBannerTimer();
}

async function refreshRouteData(route) {
  state.loadingRoute = true;
  try {
    if (route === "home" && !state.homeLoaded) await loadHome({reset: true});
    if (route === "saved-posts" && !state.savedPostsLoaded) await loadSavedPosts({reset: true});
    if (route === "chat" && !state.activeThreadId) await loadThreads();
    if (route === "skills") await loadSkills();
    if (route === "skill-profile") await loadSkillWorkspace();
    if (route === "market") await loadMarket();
    if (route === "business") await loadBusinessWorkspace();
    if (route === "notifications") await loadNotifications();
  } catch (e) {
    toast(friendlyError(e),"error");
  } finally {
    state.loadingRoute = false;
    paint();
  }
}

function go(route) {
  const target = routes.includes(route) ? route : "home";
  if (state.route === "chat" && target !== "chat") clearSubscriptions();
  state.route = target;
  if (target !== "chat") state.activeThreadId = null;
  paint();
  void refreshRouteData(target);
}

async function signup(form) {
  const d = Object.fromEntries(new FormData(form));
  const displayName = String(d.displayName || "").trim();
  const username = String(d.username || "").trim().replace(/^@/, "").toLowerCase();
  const email = String(d.email || "").trim().toLowerCase();
  const password = String(d.password || "");
  await persistenceReady;
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateAuthProfile(credential.user, {displayName});
  await api.updateProfile({displayName, username, bio: "", location: ""});
}

function openCreatePost() {
  state.pendingMediaFile = null;
  state.pendingMediaFiles = [];
  modal("Create post",`<form id="post-form" class="form-stack compact-form"><label class="floating-field rich-text-field"><div id="post-text-editor" class="rich-text-editor" data-post-editor contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="What would you like to share?"></div><textarea id="post-text" name="text" maxlength="5000" hidden></textarea><span>What would you like to share?</span></label>${postFormatToolbar("post-text-editor")}<label class="select-field"><span>Visibility</span><select name="visibility"><option value="public">Public</option><option value="followers">Followers</option><option value="private">Private</option></select></label><div class="upload-action-row post-upload-row"><button class="btn btn-secondary" type="button" data-action="pick-post-media">${icon("camera",18)}Choose photos or videos from gallery</button><input id="post-media" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple hidden><small>Up to 10 items. Each item must be 2 MiB or smaller after compression; shared daily limit is 2 MiB. Compression results show the exact KB saved.</small></div><div id="post-media-preview" class="post-media-picker" aria-live="polite"></div></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-post">Publish</button>`,{wide:true});
}

async function openPostEditor(post) {
  state.pendingEditMediaFiles = [];
  state.pendingEditMediaProcessing = false;
  const mediaIds = Array.isArray(post.mediaIds) ? post.mediaIds.slice(0, 10) : [];
  if (mediaIds.length) {
    try { await hydratePostMedia(post, mediaIds.map((_, index) => index)); }
    catch (error) { console.debug("[Marvel Chat] edit media preview unavailable", error?.code || error?.message); }
  }
  const keepMediaMarkup = mediaIds.length ? mediaIds.map((mediaId, index) => {
    const media = post.mediaUrls?.[index];
    const isVideo = String(media?.contentType || "").startsWith("video/");
    const preview = media?.url
      ? (isVideo ? `<video src="${esc(media.url)}" muted playsinline preload="metadata"></video>` : `<img src="${esc(media.url)}" alt="Existing post media ${index + 1}" loading="lazy">`)
      : `<span>Media ${index + 1}</span>`;
    return `<label class="edit-media-item"><input type="checkbox" name="keepMediaIds" value="${esc(mediaId)}" checked><span class="edit-media-thumb">${preview}</span><span>Keep media ${index + 1}</span></label>`;
  }).join("") : `<p class="muted">This post has no existing media.</p>`;
  modal("Edit post",`<form id="edit-post-form" class="form-stack compact-form"><input type="hidden" name="postId" value="${esc(post.id)}"><label class="floating-field rich-text-field"><div id="edit-post-text-editor" class="rich-text-editor" data-post-editor contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Post text">${markdownToRichEditor(post.text || "")}</div><textarea id="edit-post-text" name="text" maxlength="5000" hidden></textarea><span>Post text</span></label>${postFormatToolbar("edit-post-text-editor")}<label class="select-field"><span>Visibility</span><select name="visibility"><option value="public" ${post.visibility === "public" ? "selected" : ""}>Public</option><option value="followers" ${post.visibility === "followers" ? "selected" : ""}>Followers</option><option value="private" ${post.visibility === "private" ? "selected" : ""}>Private</option></select></label><section class="edit-existing-media"><strong>Existing photos and videos</strong><small>Untick an item to remove it from this post.</small><div class="edit-existing-media-grid">${keepMediaMarkup}</div></section><div class="upload-action-row"><button class="btn btn-secondary" type="button" data-action="pick-edit-post-media">${icon("camera",18)}Add photos or videos</button><input id="edit-post-media" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple hidden><small>Add up to 10 media items total. Images are compressed before upload.</small></div><div id="edit-post-media-preview" class="post-media-picker" aria-live="polite"></div></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-edit-post" data-id="${esc(post.id)}">Save changes</button>`,{wide:true});
}

function openCreateMoment() {
  state.pendingMomentFile = null;
  modal("Create Moment",`<form id="moment-form" class="form-stack compact-form"><label class="select-field"><span>Moment type</span><select id="moment-content-type" name="contentType"><option value="text">Text</option><option value="photo">Photo</option><option value="photo_text">Photo + text</option><option value="video">Video</option><option value="video_text">Video + text</option></select></label><label class="floating-field"><textarea name="text" maxlength="1500" placeholder=" "></textarea><span>Moment text</span></label><div class="upload-action-row"><button class="btn btn-secondary" type="button" data-action="pick-moment-media">${icon("camera",18)}Choose photo or video from gallery</button><input id="moment-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" hidden><small>Choose one photo or video. Images are compressed before upload; each item is limited to 2 MiB and the shared daily limit is 2 MiB.</small></div><div id="moment-photo-preview" class="post-photo-preview"></div></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-moment">Publish</button>`);
}

async function openComment(postId) {
  activeCommentPostId = postId;
  activeCommentCursor = null;
  activeCommentLoading = false;
  modal("Comments", `<div id="comment-list" class="comment-list" aria-live="polite"><div class="feed-loader">Loading comments…</div></div><form id="comment-form" class="form-stack compact-form"><input type="hidden" name="postId" value="${esc(postId)}"><label class="floating-field"><textarea name="text" maxlength="1000" required placeholder=" "></textarea><span>Write a comment</span></label></form>`, `<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button><button class="btn btn-primary" type="button" data-action="submit-comment">Comment</button>`, {wide: true});
  await loadCommentsPage(postId, {reset: true});
}

async function loadCommentsPage(postId, {reset = false} = {}) {
  const container = document.getElementById("comment-list");
  if (!postId || !container || activeCommentLoading) return;
  if (reset) activeCommentCursor = null;
  activeCommentLoading = true;
  container.querySelector(".comment-load-more")?.remove();
  const loading = document.createElement("div");
  loading.className = "feed-loader comment-loading";
  loading.textContent = reset ? "Loading comments…" : "Loading more comments…";
  container.appendChild(loading);
  try {
    const result = await api.getPostComments({postId, limit: 3, ...(activeCommentCursor ? {cursor: activeCommentCursor} : {})});
    loading.remove();
    if (reset) container.innerHTML = "";
    const comments = Array.isArray(result?.comments) ? result.comments : [];
    if (reset && comments.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted comment-empty";
      empty.textContent = "No comments yet. Start the conversation.";
      container.appendChild(empty);
    }
    for (const comment of comments) {
      const author = comment.authorSnapshot || {};
      const item = document.createElement("article");
      item.className = "comment-item";
      item.innerHTML = `<div class="comment-avatar">${avatar(author, "sm", true)}</div><div class="comment-copy"><strong>${esc(author.displayName || author.username || "Community member")}</strong><small>${esc(author.username ? `@${author.username}` : "Member")} · ${when(comment.createdAt)}</small><p>${esc(comment.text || "")}</p></div>`;
      container.appendChild(item);
    }
    activeCommentCursor = result?.nextCursor || null;
    if (activeCommentCursor) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "btn btn-secondary comment-load-more";
      more.dataset.action = "load-more-comments";
      more.textContent = "Load more comments";
      container.appendChild(more);
    }
  } catch (error) {
    loading.remove();
    if (reset) container.innerHTML = `<p class="muted">Comments could not be loaded. Please try again.</p>`;
    else toast(friendlyError(error), "error");
  } finally {
    activeCommentLoading = false;
  }
}


function openFeedback() {
  modal("Send feedback", `<form id="feedback-form" class="form-stack compact-form"><label class="select-field"><span>Feedback type</span><select name="category"><option value="suggestion">Suggestion</option><option value="bug">Report a problem</option><option value="accessibility">Accessibility</option><option value="feedback">Other</option></select></label><label class="floating-field"><textarea name="message" maxlength="3000" required placeholder=" "></textarea><span>Tell us what happened or what could be better</span></label></form>`, `<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-feedback">Send feedback</button>`, {wide: true});
}

function openSkillListing(listing) {
  const price = listing.priceFromMinor == null ? "Price on request" : money(listing.priceFromMinor,listing.currency || "NGN");
  const serviceImage = listing.mediaUrls?.[0]?.url ? `<img class="product-detail-photo" src="${esc(listing.mediaUrls[0].url)}" alt="${esc(listing.title || "Service photo")}" data-media-kind="skill" data-media-id="${esc(listing.id)}" data-media-index="0" decoding="async">` : "";
  modal(listing.title || "Service",`<div class="detail">${serviceImage}<p>${esc(listing.description || "")}</p><div class="tags">${(listing.tags || []).map((t) => `<span>${esc(t)}</span>`).join("")}</div><strong>${price}</strong></div>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button><button class="btn btn-primary" type="button" data-action="request-skill" data-id="${esc(listing.id)}">Request service</button>`,{wide:true});
}

async function openMarketShop(storeId) {
  if (!storeId) { toast("This shop is unavailable.", "error"); return; }
  let store = state.marketStores.find((item) => String(item.id) === String(storeId));
  if (!store) {
    try {
      const snap = await getDoc(doc(db, "stores", storeId));
      if (snap.exists()) store = {id:snap.id, ...snap.data()};
    } catch (error) {
      console.debug("[Marvel Chat] shop details unavailable", error?.code);
    }
  }
  if (!store || store.status !== "active") {
    toast("This shop is not currently available.", "error");
    return;
  }
  const response = await api.discoverMarketProducts({query:"", storeId, limit:24});
  const products = (Array.isArray(response?.results) ? response.results : [])
    .map((item) => ({...item, id:item.id || item.productId || "", storeName:store.name || "Shop"}))
    .filter((item) => item.id);
  await Promise.all(products.slice(0, 6).map((item) => hydrateMarketProductMedia(item)));
  const cards = products.length ? products.map((p) => `<button type="button" class="shop-product-card" data-action="market-view" data-id="${esc(p.id)}"><span class="shop-product-photo">${p.mediaUrls?.[0]?.url ? `<img src="${esc(p.mediaUrls[0].url)}" alt="${esc(p.title || "Product photo")}" loading="lazy" decoding="async">` : icon("market",20)}</span><span class="shop-product-copy"><strong>${esc(p.title || "Product")}</strong><small>${money(p.priceMinor,p.currency || "NGN")}</small></span></button>`).join("") : `<div class="empty-state"><strong>No available products yet</strong><span>This shop has not published an available product.</span></div>`;
  modal(store.name || "Shop", `<div class="shop-detail-head"><span class="shop-detail-mark">${icon("shop",22)}</span><div><h3>${esc(store.name || "Shop")}</h3><p>${esc(store.description || "Explore available items from this shop.")}</p><small>${esc(store.locationText || store.location || "")}</small></div></div><div class="shop-products-grid">${cards}</div>`, `<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button>`, {wide:true});
}

function openMarketProduct(item) {
  const p = item.result || item;
  if (!p.id && p.productId) p.id = p.productId;
  const media = Array.isArray(p.mediaUrls) ? p.mediaUrls.filter((m) => m?.url).slice(0, 8) : [];
  const photos = media.length ? `<div class="market-detail-carousel" aria-label="Product photos and videos"><div class="market-detail-track" tabindex="0" data-market-detail-track>${media.map((m, index) => `<figure class="market-detail-slide" aria-label="${index + 1} of ${media.length}">${String(m.contentType || "").startsWith("video/") ? `<video src="${esc(m.url)}" controls playsinline preload="metadata" aria-label="${esc(p.title || "Product")} video ${index + 1}"></video>` : `<img src="${esc(m.url)}" alt="${esc(p.title || "Product photo")} ${index + 1}" data-media-kind="market" data-media-id="${esc(p.id)}" data-media-index="${index}" loading="${index ? "lazy" : "eager"}" decoding="async">`}</figure>`).join("")}</div>${media.length > 1 ? `<div class="market-detail-carousel-controls"><button type="button" data-action="market-media-prev" aria-label="Previous product photo">‹</button><span data-market-detail-count>1 / ${media.length}</span><button type="button" data-action="market-media-next" aria-label="Next product photo">›</button></div>` : ""}</div>` : `<div class="product-detail-icon">${icon("market",30)}</div>`;
  const store = state.marketStores.find((s) => String(s.id) === String(p.storeId)) || {id:p.storeId, name:p.storeName || "Shop"};
  const saved = state.marketSavedProductIds.includes(String(p.id || item.id || ""));
  modal(p.title || "Product",`<div class="detail">${photos}<button type="button" class="market-store-link" data-action="market-view-shop" data-id="${esc(store.id || "")}">${icon("shop",16)} From ${esc(store.name || "Shop")} · View shop</button><p>${esc(p.description || p.subTitle || "")}</p><strong>${money(p.priceMinor,p.currency || "NGN")}</strong><small class="muted">${esc(p.status || "available")}</small></div><form id="purchase-form" class="form-stack compact-form"><input type="hidden" name="productId" value="${esc(p.id || item.id || "")}"><input type="hidden" name="storeId" value="${esc(p.storeId || "")}"><label class="floating-field"><input name="quantity" type="number" min="1" max="1000" value="1" required><span>Quantity</span></label><label class="floating-field"><textarea name="customerNote" maxlength="1000" placeholder=" "></textarea><span>Note to seller (optional)</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button><button class="btn btn-secondary" type="button" data-action="save-market-product" data-id="${esc(p.id || item.id || "")}" data-saved="${saved}">${saved ? "Remove saved" : "Save product"}</button><button class="btn btn-primary" type="button" data-action="submit-purchase">Request product</button>`,{wide:true});
}

function openProfileEdit() {
  const p = state.profile || {};
  state.pendingProfilePhotoFile = null;
  if (state.pendingProfilePhotoPreview) URL.revokeObjectURL(state.pendingProfilePhotoPreview);
  state.pendingProfilePhotoPreview = "";
  modal("Edit profile",`<form id="profile-form" class="form-stack compact-form"><section class="profile-photo-editor"><div id="profile-photo-preview">${avatar(p,"lg",true)}</div><button class="btn btn-secondary" type="button" data-action="pick-profile-photo">${icon("camera",17)}Choose profile photo</button><input id="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden><small>JPG, PNG, WebP or GIF. The image is optimized before secure upload.</small></section><label class="floating-field"><input name="displayName" maxlength="80" value="${esc(p.displayName || state.user?.displayName || "")}" required placeholder=" "><span>Full name</span></label><label class="floating-field"><input name="username" maxlength="30" value="${esc(p.username || "")}" required placeholder=" "><span>Username</span></label><label class="floating-field"><textarea name="bio" maxlength="500" placeholder=" ">${esc(p.bio || "")}</textarea><span>Bio</span></label><label class="floating-field"><input name="location" maxlength="200" value="${esc(p.location || "")}" placeholder=" "><span>Location</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-profile">Save changes</button>`);
}

function openSkillListingEditor(listing = null) {
  const s = listing || {};
  resetPendingPhoto("skill");
  const categoryOptions = state.skillCategories.length ? state.skillCategories.map((c) => [c.id,c.name || c.id]) : SKILL_CATEGORIES.filter((x) => x[0] !== "all");
  const existingPhoto = s.mediaUrls?.[0]?.url ? `<img src="${esc(s.mediaUrls[0].url)}" alt="Current service photo" loading="lazy">` : `<span class="muted">No service photo selected</span>`;
  modal(listing ? "Edit service" : "Create service",`<form id="skill-listing-form" class="form-stack compact-form"><section class="catalogue-photo-editor"><div id="skill-photo-preview">${existingPhoto}</div><button class="btn btn-secondary" type="button" data-action="pick-skill-photo">${icon("camera",17)}Choose service photo</button><input id="skill-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden><small>A clear service photo helps customers understand your offer. Maximum optimized size: 2 MiB.</small></section><label class="floating-field"><input name="title" maxlength="160" value="${esc(s.title || "")}" required placeholder=" "><span>Service title</span></label><label class="floating-field"><textarea name="description" maxlength="3000" required placeholder=" ">${esc(s.description || "")}</textarea><span>Description</span></label><label class="select-field"><span>Category</span><select name="categoryId" required>${categoryOptions.map(([id,label]) => `<option value="${esc(id)}" ${s.categoryId === id ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label><label class="floating-field"><input name="priceFromMinor" type="number" min="0" value="${esc(s.priceFromMinor ?? "")}" placeholder=" "><span>Starting price (minor units)</span></label><label class="floating-field"><input name="deliveryTimeDays" type="number" min="1" max="365" value="${esc(s.deliveryTimeDays ?? "")}" placeholder=" "><span>Delivery time (days)</span></label><label class="floating-field"><input name="tags" maxlength="500" value="${esc((s.tags || []).join(", "))}" placeholder=" "><span>Tags, comma separated</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-skill-listing" data-id="${esc(s.id || "")}">${listing ? "Save changes" : "Publish listing"}</button>`,{wide:true});
}

function openProductEditor(product = null) {
  const p = product || {};
  resetPendingPhoto("product");
  const categoryOptions = state.marketCategories.length ? state.marketCategories.map((c) => [c.id,c.name || c.id]) : [];
  const existingPhoto = Array.isArray(p.mediaIds) && p.mediaIds.length ? `<div class="market-photo-preview-grid">${p.mediaIds.slice(0,8).map((mediaId,index) => { const media=p.mediaUrls?.[index]; return `<label class="market-existing-photo">${media?.url ? `<img src="${esc(media.url)}" alt="Current product photo ${index+1}" loading="lazy" decoding="async">` : `<span class="product-cover-icon">${icon("image",18)}</span>`}<span><input type="checkbox" name="keepProductMedia" value="${esc(mediaId)}" checked> Keep photo ${index+1}</span></label>`; }).join("")}</div>` : `<span class="muted">No product photos selected</span>`;
  state.pendingProductPhotoFiles = [];
  modal(product ? "Edit product" : "Create product",`<form id="product-form" class="form-stack compact-form"><section class="catalogue-photo-editor"><div id="product-photo-preview">${existingPhoto}</div><button class="btn btn-secondary" type="button" data-action="pick-product-photo">${icon("camera",17)}Choose photos (up to 8)</button><input id="product-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden><small>Choose up to 8 clear photos. Each is optimized before publishing; maximum 2 MiB per item and 2 MiB shared media allowance over the rolling past 24 hours.</small><div id="product-photo-results" class="media-compression-results" aria-live="polite"></div></section><label class="floating-field"><input name="title" maxlength="200" value="${esc(p.title || "")}" required placeholder=" "><span>Product name</span></label><label class="floating-field"><textarea name="description" maxlength="3000" placeholder=" ">${esc(p.description || "")}</textarea><span>Description</span></label><label class="select-field"><span>Category</span><select name="categoryId"><option value="">No category</option>${categoryOptions.map(([id,label]) => `<option value="${esc(id)}" ${p.categoryId === id ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label><label class="floating-field"><input name="priceMinor" type="number" min="0" value="${esc(p.priceMinor ?? "0")}" required placeholder=" "><span>Price in minor units</span></label><label class="floating-field"><input name="currency" maxlength="3" value="${esc(p.currency || "NGN")}" required placeholder=" "><span>Currency</span></label><label class="floating-field"><input name="tags" maxlength="500" value="${esc((p.tags || []).join(", "))}" placeholder=" "><span>Tags, comma separated</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-product" data-id="${esc(p.id || "")}">${product ? "Save changes" : "Create product"}</button>`,{wide:true});
}

function openStoreEditor() {
  const s = state.myStore || state.sellerDraft || {};
  const categoryField = s.id
    ? `<div class="read-only-field"><span class="eyebrow">BUSINESS CATEGORY</span><strong>${esc(s.category || "Not set")}</strong><small>Category is established when the storefront is created.</small></div>`
    : `<label class="floating-field"><input name="category" maxlength="100" value="${esc(s.category || "")}" placeholder=" "><span>Business category</span></label>`;
  modal(s.id ? "Edit store" : "Create store",`<form id="seller-details-form" class="form-stack compact-form"><label class="floating-field"><input name="name" maxlength="120" value="${esc(s.name || "")}" required placeholder=" "><span>Business name</span></label><label class="floating-field"><textarea name="description" maxlength="1000" placeholder=" ">${esc(s.description || "")}</textarea><span>Business description</span></label>${categoryField}<label class="floating-field"><input name="location" maxlength="200" value="${esc(s.location || s.locationText || "")}" placeholder=" "><span>Business location</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-store">${s.id ? "Save changes" : "Create store"}</button>`);
}

function openCreateMenu() {
  modal("Create",`<div class="create-choice-grid"><button class="path-card" type="button" data-action="create-post"><span class="path-icon">${icon("edit",20)}</span><strong>Create Post</strong><span>Share a community update.</span></button><button class="path-card" type="button" data-action="create-moment"><span class="path-icon">${icon("spark",20)}</span><strong>Create Moment</strong><span>Share a quick temporary update.</span></button></div>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button>`);
}

document.addEventListener("pointerdown", (event) => {
  if (event.target?.closest?.(".post-format-toolbar button")) event.preventDefault();
});
document.addEventListener("input", (event) => {
  const editor = event.target;
  if (!editor?.matches?.('[contenteditable="true"][data-post-editor]')) return;
  const plain = editor.textContent || "";
  if (!/\*\*[^*\n]{1,400}\*\*/.test(plain)) return;
  // Keep typed Markdown shorthand legible while composing. The renderer still
  // performs HTML escaping before turning the limited bold syntax into <strong>.
  const selection = window.getSelection();
  const caretAtEnd = selection?.rangeCount && selection.isCollapsed && selection.focusNode && editor.contains(selection.focusNode)
    ? (() => { const range = selection.getRangeAt(0).cloneRange(); range.selectNodeContents(editor); range.setEnd(selection.focusNode, selection.focusOffset); return range.toString().length >= plain.length; })()
    : false;
  if (!caretAtEnd) return;
  editor.innerHTML = markdownToRichEditor(plain);
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const nextSelection = window.getSelection();
  nextSelection?.removeAllRanges();
  nextSelection?.addRange(range);
});

app.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  if (image.dataset.postMedia === "true") {
    const postId = image.dataset.postId;
    const index = Number(image.dataset.mediaIndex);
    const post = [...state.posts, ...state.savedPosts].find((entry) => String(entry.id) === String(postId));
    if (!post || !Number.isInteger(index) || !Array.isArray(post.mediaIds) || !post.mediaIds[index]) return;
    if (post.mediaRetryAt && Date.now() - post.mediaRetryAt < 60_000) return;
    post.mediaRetryAt = Date.now();
    post.mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : Array(post.mediaIds.length).fill(null);
    post.mediaUrls[index] = null;
    post.mediaLoadErrorIndices = (post.mediaLoadErrorIndices || []).filter((value) => value !== index);
    post.mediaLoadingIndices = (post.mediaLoadingIndices || []).filter((value) => value !== index);
    void hydratePostMedia(post, [index]).then(() => { if (state.route === "home" || state.route === "saved-posts") paint(); });
    return;
  }
  const kind = image.dataset.mediaKind;
  const id = image.dataset.mediaId;
  if (!kind || !id) return;
  const list = kind === "market" ? [...state.products, ...state.savedMarketProducts, ...state.myProducts] : [...state.skills, ...state.skillListingsMine];
  const item = list.find((entry) => String(entry.id || entry.productId) === String(id));
  if (!item || item.mediaRetryAt && Date.now() - item.mediaRetryAt < 60_000) return;
  item.mediaRetryAt = Date.now();
  const index = Math.max(0, Number(image.dataset.mediaIndex || 0));
  const retry = kind === "market" ? hydrateMarketProductMedia(item, true) : hydrateSkillListingMedia(item, true);
  void Promise.resolve(retry).then(() => {
    const refreshed = item.mediaUrls?.[index]?.url;
    if (refreshed) image.src = refreshed;
    if (state.route === "market" || state.route === "skills" || state.route === "skill-profile") paint();
  });
}, true);

app.addEventListener("scroll", (event) => {
  const marketTrack = event.target;
  if (marketTrack?.matches?.("[data-market-detail-track]")) {
    const count = marketTrack.querySelectorAll(".market-detail-slide").length;
    const index = marketTrack.clientWidth ? Math.max(0, Math.min(count - 1, Math.round(marketTrack.scrollLeft / marketTrack.clientWidth))) : 0;
    const root = marketTrack.closest(".market-detail-carousel");
    const counter = root?.querySelector("[data-market-detail-count]");
    if (counter) counter.textContent = `${index + 1} / ${Math.max(1,count)}`;
    const prev = root?.querySelector('[data-action="market-media-prev"]');
    const next = root?.querySelector('[data-action="market-media-next"]');
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index >= count - 1;
    return;
  }
  const track = event.target;
  if (!track?.matches?.("[data-post-carousel-track]")) return;
  const carousel = track.closest("[data-post-carousel]");
  if (!carousel || !track.clientWidth) return;
  const count = Math.max(1, Number(carousel.dataset.count || 1));
  const index = Math.max(0, Math.min(count - 1, Math.round(track.scrollLeft / track.clientWidth)));
  track.dataset.currentIndex = String(index);
  carousel.dataset.index = String(index);
  const counter = carousel.querySelector("[data-carousel-count]");
  if (counter) counter.textContent = `${index + 1} / ${count}`;
  carousel.querySelectorAll("[data-action=post-media-go]").forEach((dot) => {
    dot.setAttribute("aria-current", Number(dot.dataset.index) === index ? "true" : "false");
  });
  const previous = carousel.querySelector("[data-action=post-media-prev]");
  const next = carousel.querySelector("[data-action=post-media-next]");
  if (previous) previous.disabled = index <= 0;
  if (next) next.disabled = index >= count - 1;
  const post = [...state.posts, ...state.savedPosts].find((item) => item.id === track.dataset.id);
  if (post) {
    post.mediaIndex = index;
    const timerKey = String(post.id);
    const previousTimer = carouselHydrationTimers.get(timerKey);
    if (previousTimer) clearTimeout(previousTimer);
    carouselHydrationTimers.set(timerKey, setTimeout(() => {
      carouselHydrationTimers.delete(timerKey);
      const latest = [...state.posts, ...state.savedPosts].find((item) => item.id === track.dataset.id);
      const chosen = Number(track.dataset.currentIndex || 0);
      if (latest && state.route === "home" || (latest && state.route === "saved-posts")) {
        void hydratePostMedia(latest, [chosen - 1, chosen, chosen + 1]);
      }
    }, 220));
  }
}, true);

document.addEventListener("click", async (e) => {
  if (e.target?.classList?.contains("modal-backdrop")) {
    closeModal();
    return;
  }

  const actionEl = e.target.closest?.("[data-action]");
  if (!actionEl) return;
  const a = actionEl.dataset.action;
  try {
    if (a === "close-modal") { clearTimeout(momentAutoCloseTimer); closeModal(); return; }
    if (a === "dismiss-discovery-banner") { stopDiscoveryBannerTimer(); discoveryBannerVisibleForUser = false; paint(); return; }
    if (a === "auth-welcome") { authMode="welcome"; paint(); return; }
    if (a === "auth-signin") { authMode="signin"; paint(); return; }
    if (a === "auth-signup") { authMode="signup"; paint(); return; }
    if (a === "forgot-password") { authMode="forgot"; paint(); return; }
    if (a === "toggle-password") { const t=document.getElementById(actionEl.dataset.target); if(t){t.type=t.type === "password" ? "text" : "password"; actionEl.textContent=t.type === "password" ? "Show" : "Hide";} return; }
    if (a === "google-signin") {
      if (googleSignInPending) return;
      googleSignInPending = true;
      document.querySelectorAll('[data-action="google-signin"]').forEach((button) => {
        button.disabled = true;
      });
      try {
        await persistenceReady;
        await signInWithPopup(auth, new GoogleAuthProvider());
      } finally {
        googleSignInPending = false;
        document.querySelectorAll('[data-action="google-signin"]').forEach((button) => {
          button.disabled = false;
        });
      }
      return;
    }
    if (a.startsWith("route-")) { if (app.querySelector("[data-discovery-overlay]")) { stopDiscoveryBannerTimer(); discoveryBannerVisibleForUser = false; } document.getElementById("menu-root")?.remove(); go(a.slice(6)); return; }
    if (a === "open-menu") {
      if (document.getElementById("menu-root")) return;
      const root = document.createElement("div");
      root.id = "menu-root";
      root.innerHTML = sideMenu();
      document.body.appendChild(root);
      document.querySelector('#menu-overlay .side-menu button[data-action="close-menu"]')?.focus();
      return;
    }
    if (a === "close-menu") {
      if (e.target.closest(".side-menu") && !e.target.closest('button[data-action="close-menu"]')) return;
      document.getElementById("menu-root")?.remove();
      return;
    }
    if (a.startsWith("legal-")) { document.getElementById("menu-root")?.remove(); openLegal(a.slice(6)); return; }
    if (a === "install-app") {
      document.getElementById("menu-root")?.remove();
      if (deferredInstallPrompt) {
        const promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice.catch(() => null);
        toast(choice?.outcome === "accepted" ? "Install started." : "You can install Marvel Chat later from the browser menu.", "info");
      } else {
        toast("To install Marvel Chat, open your browser menu and choose Install app or Add to Home Screen when available.", "info");
      }
      return;
    }
    if (a === "feedback") { document.getElementById("menu-root")?.remove(); openFeedback(); return; }
    if (a === "sign-out") { document.getElementById("menu-root")?.remove(); await signOut(auth); return; }
    if (a === "create-menu") { openCreateMenu(); return; }
    if (a === "pick-post-media") { document.getElementById("post-media")?.click(); return; }
    if (a === "pick-moment-media") { document.getElementById("moment-photo")?.click(); return; }
    if (a === "retry-home") { await loadHome({reset: true}); return; }
    if (a === "pick-product-photo") { document.getElementById("product-photo-input")?.click(); return; }
    if (a === "pick-skill-photo") { document.getElementById("skill-photo-input")?.click(); return; }
    if (a === "pick-profile-photo") { document.getElementById("profile-photo-input")?.click(); return; }
    if (["post-media-prev", "post-media-next", "post-media-go"].includes(a)) {
      const carousel = actionEl.closest("[data-post-carousel]");
      const track = carousel?.querySelector("[data-post-carousel-track]");
      if (!track || !track.clientWidth) return;
      const total = Math.max(1, Number(carousel.dataset.count || 1));
      const current = Math.max(0, Math.min(total - 1, Math.round(track.scrollLeft / track.clientWidth)));
      const requested = a === "post-media-prev" ? current - 1 : a === "post-media-next" ? current + 1 : Number(actionEl.dataset.index || 0);
      const nextIndex = Math.max(0, Math.min(total - 1, requested));
      track.scrollTo({left: nextIndex * track.clientWidth, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
      return;
    }
    if (a === "load-more-home") { await loadHome({reset: false}); return; }
    if (a === "load-more-saved") { await loadSavedPosts({reset: false}); return; }
    if (a === "load-more-comments") { await loadCommentsPage(activeCommentPostId, {reset: false}); return; }
    if (a === "toggle-post-text") {
      const targetId = actionEl.dataset.id;
      for (const post of [...state.posts, ...state.savedPosts, ...state.homeSearchResults, ...state.searchResults]) { const candidate=post.result || post; if (String(candidate.id||candidate.postId) === String(targetId)) candidate.textExpanded = !candidate.textExpanded; }
      paint(); return;
    }
    if (a === "create-post") { closeModal(); openCreatePost(); return; }
    if (a === "create-moment") { closeModal(); openCreateMoment(); return; }
    if (a === "submit-post") { if (state.pendingMediaProcessing) { toast("Please wait until media compression finishes.", "error"); return; } const f=document.getElementById("post-form"); const d=Object.fromEntries(new FormData(f)); const text=String(richEditorMarkdown("post-text-editor") || "").trim(); document.getElementById("post-text").value=text; const files=Array.isArray(state.pendingMediaFiles) ? state.pendingMediaFiles : []; if(!text && files.length===0){toast("Add text or media before publishing.","error");return;} const mediaIds=files.length ? await uploadHomeMediaFiles(files) : []; await api.createPost({text,mediaIds,visibility:String(d.visibility || "public")}); state.pendingMediaFile=null; state.pendingMediaFiles=[]; state.pendingMediaProcessing=false; closeModal(); toast("Post published.","success"); await loadHome({reset: true}); paint(); return; }
    if (a === "submit-moment") { const f=document.getElementById("moment-form"); const d=Object.fromEntries(new FormData(f)); let contentType=String(d.contentType || "text"); const text=String(d.text || "").trim(); const needsMedia=["photo","photo_text","video","video_text"].includes(contentType); if(needsMedia && !state.pendingMomentFile){toast("Choose a photo or video for this Moment.","error");return;} if(state.pendingMomentFile){const selectedVideo=state.pendingMomentFile.type.startsWith("video/"); if(selectedVideo && !contentType.startsWith("video")) contentType=text ? "video_text" : "video"; if(!selectedVideo && !contentType.startsWith("photo")) contentType=text ? "photo_text" : "photo";} let mediaId=null; if(state.pendingMomentFile) mediaId=await uploadMomentMedia(state.pendingMomentFile); await api.createMoment({contentType,text,mediaId}); state.pendingMomentFile=null; closeModal(); toast("Moment published.","success"); await loadHome({reset: true}); paint(); return; }
    if (a === "post-menu") { const p=[...state.posts,...state.savedPosts].find((x)=>x.id===actionEl.dataset.id); if(!p)return; modal("Post options",`<div class="form-stack"><button class="btn btn-secondary btn-block" type="button" data-action="edit-post" data-id="${esc(p.id)}">Edit post</button><button class="btn btn-secondary btn-block" type="button" data-action="delete-post" data-id="${esc(p.id)}">Delete post</button></div>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button>`); return; }
    if (a === "edit-post") { const p=[...state.posts,...state.savedPosts].find((x)=>x.id===actionEl.dataset.id); if(!p)return; await openPostEditor(p); return; }
    if (a === "format-post-bold" || a === "format-post-normal") { applyPostTextFormatting(actionEl.dataset.target, a === "format-post-bold" ? "bold" : "normal"); return; }
    if (a === "pick-edit-post-media") { document.getElementById("edit-post-media")?.click(); return; }
    if (a === "submit-edit-post") {
      if (state.pendingEditMediaProcessing) { toast("Please wait until media compression finishes.", "error"); return; }
      const form = document.getElementById("edit-post-form");
      const data = new FormData(form);
      const postId = String(data.get("postId") || actionEl.dataset.id || "");
      const text = String(richEditorMarkdown("edit-post-text-editor") || "").trim();
      document.getElementById("edit-post-text").value = text;
      const keptMediaIds = data.getAll("keepMediaIds").map(String);
      const addedFiles = Array.isArray(state.pendingEditMediaFiles) ? state.pendingEditMediaFiles : [];
      if (keptMediaIds.length + addedFiles.length > 10) { toast("A post can contain at most 10 photos or videos.", "error"); return; }
      if (!text && keptMediaIds.length + addedFiles.length === 0) { toast("A post must contain text or media.", "error"); return; }
      const originalPost = [...state.posts, ...state.savedPosts].find((item) => item.id === postId);
      const oldIds = Array.isArray(originalPost?.mediaIds) ? originalPost.mediaIds : [];
      const uploadedIds = addedFiles.length ? await uploadHomeMediaFiles(addedFiles) : [];
      const nextIds = [...keptMediaIds, ...uploadedIds];
      await api.updatePost({postId, text, mediaIds:nextIds, visibility:String(data.get("visibility") || "public")});
      const removedIds = oldIds.filter((id) => !nextIds.includes(id));
      if (removedIds.length) {
        try { await api.cleanupDeletedMedia({feature:"home_post", parentId:postId, parentCollection:"posts", mediaIds:removedIds}); }
        catch (error) { console.debug("[Marvel Chat] removed post media cleanup pending", error?.code || error?.message); }
      }
      state.pendingEditMediaFiles = []; state.pendingEditMediaProcessing = false;
      state.savedPostsLoaded = false;
      closeModal(); toast("Post updated.","success"); await loadHome({reset:true}); paint(); return;
    }
    if (a === "delete-post") { const deletedId=actionEl.dataset.id; const oldPost=state.posts.find((post)=>post.id===deletedId) || state.savedPosts.find((post)=>post.id===deletedId); await api.deletePost({postId:deletedId}); state.savedPosts=state.savedPosts.filter((post)=>post.id!==deletedId); state.posts=state.posts.filter((post)=>post.id!==deletedId); state.savedPostsLoaded=false; if(Array.isArray(oldPost?.mediaIds) && oldPost.mediaIds.length){try{await api.cleanupDeletedMedia({feature:"home_post",parentId:deletedId,parentCollection:"posts"});}catch(cleanupError){console.error("[Marvel Chat] deleted post media cleanup pending",cleanupError?.code);}} closeModal(); toast("Post deleted.","success"); await loadHome({reset: true}); paint(); return; }
    if (a === "like-post") {
      const postId = actionEl.dataset.id;
      const copies = [...new Set([...state.posts, ...state.savedPosts].filter((post) => post.id === postId))];
      if (!copies.length) return;
      const before = copies.map((post) => ({post, liked: Boolean(post.likedByViewer), count: Number(post.reactionCount || 0)}));
      const desired = !Boolean(copies[0].likedByViewer);
      for (const item of before) { item.post.likedByViewer = desired; item.post.reactionCount = Math.max(0, item.count + (desired ? 1 : -1)); }
      paint();
      try {
        const result = await api.reactToPost({postId, type: "like"});
        const actual = Boolean(result?.reacted);
        if (actual !== desired) for (const item of before) { item.post.reactionCount = Math.max(0, item.post.reactionCount + (actual ? 1 : -1)); item.post.likedByViewer = actual; }
        toast(actual ? "Post liked." : "Like removed.", "success");
      } catch (error) {
        for (const item of before) { item.post.likedByViewer = item.liked; item.post.reactionCount = item.count; }
        throw error;
      } finally { paint(); }
      return;
    }
    if (a === "save-post") {
      const postId = actionEl.dataset.id;
      const copies = [...new Set([...state.posts, ...state.savedPosts].filter((post) => post.id === postId))];
      if (!copies.length) return;
      const previous = Boolean(copies[0].savedByViewer);
      const beforeCounts = copies.map((post) => ({post, saved: Boolean(post.savedByViewer), count: Number(post.saveCount || 0)}));
      const desired = !previous;
      for (const item of beforeCounts) { item.post.savedByViewer = desired; item.post.saveCount = Math.max(0, item.count + (desired ? 1 : -1)); }
      if (!desired) state.savedPosts = state.savedPosts.filter((post) => post.id !== postId);
      paint();
      try {
        const result = await api.savePost({postId});
        const actual = Boolean(result?.saved);
        if (actual !== desired) {
          for (const item of beforeCounts) { item.post.savedByViewer = actual; item.post.saveCount = Math.max(0, item.post.saveCount + (actual ? 1 : -1)); }
        }
        if (actual && state.savedPostsLoaded && !state.savedPosts.some((post) => post.id === postId)) state.savedPosts.unshift({...copies[0], savedByViewer: true});
        if (!actual) state.savedPosts = state.savedPosts.filter((post) => post.id !== postId);
        toast(actual ? "Post saved." : "Post removed from Saved posts.", "success");
      } catch (error) {
        for (const item of beforeCounts) { item.post.savedByViewer = item.saved; item.post.saveCount = item.count; }
        if (previous && !state.savedPosts.some((post) => post.id === postId)) state.savedPosts.unshift({...copies[0], savedByViewer: true});
        throw error;
      } finally { paint(); }
      return;
    }
    if (a === "comment-post") { await openComment(actionEl.dataset.id); return; }
    if (a === "submit-comment") {
      const form = document.getElementById("comment-form");
      const d = Object.fromEntries(new FormData(form));
      const text = String(d.text || "").trim();
      if (!text) { toast("Write a comment first.", "error"); return; }
      await api.commentOnPost({postId: d.postId, text});
      for (const post of [...state.posts, ...state.savedPosts]) if (post.id === d.postId) post.commentCount = Number(post.commentCount || 0) + 1;
      form.reset();
      toast("Comment added.", "success");
      await loadCommentsPage(d.postId, {reset: true});
      paint();
      return;
    }
    if (a === "submit-feedback") {
      const d = Object.fromEntries(new FormData(document.getElementById("feedback-form")));
      await api.submitFeedback({category: String(d.category || "suggestion"), message: String(d.message || "").trim(), route: state.route});
      closeModal(); toast("Thank you. Your feedback was sent.", "success"); return;
    }
    if (a === "share-post") { const url=location.href; try { if(navigator.share) await navigator.share({title:"Marvel Chat",text:"Check this post on Marvel Chat",url}); else {await navigator.clipboard.writeText(url);toast("Link copied.","success");} } catch {} return; }
    if (a === "load-post-media") { const p=[...state.posts,...state.savedPosts].find((x)=>x.id===actionEl.dataset.id); if(p) await hydratePostMedia(p, actionEl.dataset.index === undefined ? [0] : [Number(actionEl.dataset.index)]); return; }
    if (a === "view-moment") {
      const m = state.moments.find((item) => item.id === actionEl.dataset.id);
      if (!m) return;
      let urls = [];
      if (m.mediaId) { try { urls = await readMomentMedia(m.id, [m.mediaId]); } catch (error) { console.debug("[Marvel Chat] Moment media read failed", error?.code); } }
      const mediaUrl = urls[0]?.url || "";
      const mediaHtml = mediaUrl && String(urls[0]?.contentType || "").startsWith("video/")
        ? `<video class="moment-view-image" src="${esc(mediaUrl)}" controls autoplay playsinline preload="metadata"></video>`
        : mediaUrl ? `<img class="moment-view-image" src="${esc(mediaUrl)}" alt="Moment photo" loading="lazy">` : "";
      modal(m.uid === state.user.uid ? "Your Moment" : "Moment", `<div class="moment-view"><div class="moment-large-avatar">${avatar(m.author || m.authorSnapshot || m,"xl",true)}</div><span class="eyebrow">${esc(m.contentType || "text")}</span><h3>${esc(m.authorSnapshot?.displayName || m.author?.displayName || m.displayName || m.username || "")}</h3>${mediaHtml}<p>${esc(m.text || "")}</p><small>${formatDate(m.createdAt)}</small></div>`, `<button class="btn btn-secondary" type="button" data-action="close-modal">Done</button>${m.uid === state.user.uid || m.authorUid === state.user.uid ? `<button class="btn btn-primary" type="button" data-action="delete-moment" data-id="${esc(m.id)}">Delete</button>` : ""}`);
      clearTimeout(momentAutoCloseTimer);
      const openedModal = document.querySelector("#modal-root .modal");
      const duration = String(m.contentType || "").includes("video") ? 10000 : 30000;
      momentAutoCloseTimer = setTimeout(() => {
        if (openedModal?.isConnected) closeModal();
      }, duration);
      return;
    }
    if (a === "delete-moment") { const momentId=actionEl.dataset.id; const oldMoment=state.moments.find((item)=>item.id===momentId); await api.deleteMoment({momentId}); if(oldMoment?.mediaId){try{await api.cleanupDeletedMedia({feature:"moment",parentId:momentId,parentCollection:"moments"});}catch(cleanupError){console.error("[Marvel Chat] deleted Moment media cleanup pending",cleanupError?.code);}} closeModal(); toast("Moment deleted.","success"); await loadHome({reset: true}); paint(); return; }
    if (a === "clear-home-search") { state.searchQuery="";state.homeSearchResults=[];paint();return; }
    if (a === "clear-chat-search") { state.chatSearchQuery="";state.chatSearchResults=[];paint();return; }
    if (a === "focus-chat-search") { state.route="chat"; paint(); setTimeout(()=>document.querySelector('#chat-person-search-form input[name="query"]')?.focus(),0); return; }
    if (a === "open-thread") { state.activeThreadId=actionEl.dataset.id;state.messages=[];const thread=state.threads.find((x)=>x.id===state.activeThreadId);if(thread) await hydrateThreadPeer(thread);paint();await loadMessages(state.activeThreadId);return; }
    if (a === "close-thread") { clearSubscriptions();state.activeThreadId=null;state.messages=[];go("chat");return; }
    if (a === "thread-options") { const thread=state.threads.find((x)=>String(x.id)===String(actionEl.dataset.id)); if(!thread)return; const uid=String(state.user.uid); const pinned=Array.isArray(thread.pinnedUids)&&thread.pinnedUids.includes(uid); const archived=Array.isArray(thread.archivedUids)&&thread.archivedUids.includes(uid); modal("Conversation options",`<div class="form-stack"><button class="btn btn-secondary btn-block" type="button" data-action="set-thread-preference" data-id="${esc(thread.id)}" data-pref="pin" data-enabled="${!pinned}">${pinned?"Unpin conversation":"Pin conversation"}</button><button class="btn btn-secondary btn-block" type="button" data-action="set-thread-preference" data-id="${esc(thread.id)}" data-pref="archive" data-enabled="${!archived}">${archived?"Unarchive conversation":"Archive conversation"}</button><button class="btn btn-secondary btn-block" type="button" data-action="set-thread-preference" data-id="${esc(thread.id)}" data-pref="delete_for_me" data-enabled="true">Delete conversation for me</button></div>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button>`); return; }
    if (a === "set-thread-preference") { const threadId=String(actionEl.dataset.id||""); const preference=String(actionEl.dataset.pref||""); const enabled=actionEl.dataset.enabled==="true"; await api.updateChatThreadPreference({threadId,preference,enabled}); const thread=state.threads.find((x)=>String(x.id)===threadId); const field={pin:"pinnedUids",archive:"archivedUids",delete_for_me:"hiddenForUids"}[preference]; if(thread&&field){const prior=Array.isArray(thread[field])?thread[field]:[];thread[field]=enabled?[...new Set([...prior,String(state.user.uid)])]:prior.filter((id)=>String(id)!==String(state.user.uid));} if(preference==="delete_for_me"&&enabled){state.threads=state.threads.filter((x)=>String(x.id)!==threadId);if(state.activeThreadId===threadId){clearSubscriptions();state.activeThreadId=null;state.messages=[];}} closeModal();state.threadsLoadedAt=Date.now();toast(preference==="pin"?(enabled?"Conversation pinned.":"Conversation unpinned."):preference==="archive"?(enabled?"Conversation archived.":"Conversation restored."):"Conversation removed from your chat list.","success");paint();return; }
    if (a === "edit-message") { const msg=state.messages.find((x)=>String(x.id)===String(actionEl.dataset.id)); if(!msg||msg.senderUid!==state.user.uid||msg.status==="deleted_for_everyone")return; modal("Edit message",`<form id="edit-message-form" class="form-stack"><input type="hidden" name="messageId" value="${esc(msg.id)}"><label class="floating-field"><textarea name="text" maxlength="4000" required placeholder=" ">${esc(msg.text||"")}</textarea><span>Message</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="save-message-edit">Save</button>`); return; }
    if (a === "save-message-edit") { const form=document.getElementById("edit-message-form"); if(!form)return; const d=Object.fromEntries(new FormData(form)); const text=String(d.text||"").trim(); if(!text){toast("Message cannot be empty.","error");return;} await api.editMessage({threadId:state.activeThreadId,messageId:String(d.messageId),text}); const msg=state.messages.find((x)=>String(x.id)===String(d.messageId)); if(msg){msg.text=text;msg.editedAt=new Date();} closeModal();toast("Message updated.","success");paint();return; }
    if (a === "delete-message") { const mode=actionEl.dataset.mode||"for_everyone"; if(mode==="for_everyone"&& !window.confirm("Delete this message for everyone?"))return; await api.deleteMessage({threadId:state.activeThreadId,messageId:actionEl.dataset.id,mode}); if(mode==="for_me"){const msg=state.messages.find((x)=>String(x.id)===String(actionEl.dataset.id));if(msg){msg.deletedForUids=[...new Set([...(msg.deletedForUids||[]),String(state.user.uid)])];}}else{const msg=state.messages.find((x)=>String(x.id)===String(actionEl.dataset.id));if(msg){msg.text="";msg.status="deleted_for_everyone";}}toast(mode==="for_me"?"Message removed from your view.":"Message deleted for everyone.","success");paint();return; }
    if (a === "message-user") { const target=actionEl.dataset.id; if(!target || target===state.user.uid)return; const item=[...state.chatSearchResults,...state.homeSearchResults,...state.searchResults].find((x)=>String(x.id)===String(target)); const profile=item?.result || item || {}; const derivedUsername = profile.username || String(item?.subtitle || "").replace(/^@/, ""); state.threadPeers[target]={uid:target,displayName:item?.title || profile.displayName || derivedUsername || "Conversation",username:derivedUsername,photoURL:profile.photoURL || null};saveThreadPeers(); const id=await findOrCreateDirectThread(target,state.threadPeers[target]); state.route="chat";state.activeThreadId=id;await loadThreads();paint();await loadMessages(id);return; }
    if (a === "view-user") { const target=actionEl.dataset.id; if(!target || target===state.user.uid)return; const item=[...state.chatSearchResults,...state.homeSearchResults,...state.searchResults].find((x)=>String(x.id)===String(target)); await openPublicUserProfile(target,item || {}); return; }
    if (a === "follow-user" || a === "unfollow-user") { const target=actionEl.dataset.id; if(!target || target===state.user.uid)return; const current=await api.getFollowState({targetUid:target}); if(current?.following){await api.unfollowUser({targetUid:target});state.followingIds=state.followingIds.filter((id)=>String(id)!==String(target));toast("No longer following.","success");}else{await api.followUser({targetUid:target});state.followingIds=[...new Set([...state.followingIds,String(target)])];toast("Following.","success");} if(state.route === "home"){await loadHome({reset:true});} paint(); return; }
    if (a === "skill-view" || a === "skill-search-view") { const s=state.skills.find((x)=>x.id===actionEl.dataset.id) || [...state.searchResults,...state.homeSearchResults].find((x)=>x.id===actionEl.dataset.id); if(s){const listing=s.result || s;await hydrateSkillListingMedia(listing);openSkillListing(listing);}return; }
    if (a === "request-skill") { const listing=state.skills.find((x)=>x.id===actionEl.dataset.id) || [...state.searchResults,...state.homeSearchResults].map((x)=>x.result || x).find((x)=>x.id===actionEl.dataset.id); if(!listing)return; modal("Request this service",`<form id="skill-request-form" class="form-stack"><input type="hidden" name="listingId" value="${esc(listing.id)}"><label class="floating-field"><input name="title" value="Request: ${esc(listing.title || "service")}" maxlength="160" required placeholder=" "><span>Request title</span></label><label class="floating-field"><textarea name="description" maxlength="3000" required placeholder=" "></textarea><span>What do you need?</span></label><label class="floating-field"><input name="budgetMinMinor" type="number" min="0" placeholder=" "><span>Minimum budget (minor units)</span></label><label class="floating-field"><input name="budgetMaxMinor" type="number" min="0" placeholder=" "><span>Maximum budget (minor units)</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-skill-request">Send request</button>`,{wide:true});return; }
    if (a === "submit-skill-request") { const d=Object.fromEntries(new FormData(document.getElementById("skill-request-form"))); await api.createSkillRequest({title:String(d.title || "").trim(),description:String(d.description || "").trim(),listingId:d.listingId,currency:"NGN",budgetMinMinor:d.budgetMinMinor ? safeMinor(d.budgetMinMinor) : null,budgetMaxMinor:d.budgetMaxMinor ? safeMinor(d.budgetMaxMinor) : null}); closeModal();toast("Skill request sent.","success");return; }
    if (a === "create-skill-listing") { if(!state.skillProfile){go("skill-onboarding");return;} openSkillListingEditor();return; }
    if (a === "edit-skill-listing") { const s=state.skillListingsMine.find((x)=>x.id===actionEl.dataset.id); if(s)openSkillListingEditor(s);return; }
    if (a === "pause-skill-listing" || a === "activate-skill-listing") { await api.updateSkillListing({listingId:actionEl.dataset.id,status:a === "activate-skill-listing" ? "active" : "paused"});toast(a === "activate-skill-listing" ? "Service offered again." : "Service paused.","success");await loadSkillWorkspace(true);paint();return; }
    if (a === "delete-skill-listing") { const listingId=actionEl.dataset.id; if(!window.confirm("Delete this service from Marvel Skills? It will no longer appear in public listings.")) return; const deleted=await api.deleteSkillListing({listingId}); const mediaIds=Array.isArray(deleted?.mediaIds)?deleted.mediaIds:[]; if(mediaIds.length){try{await api.cleanupDeletedMedia({feature:"skill_listing",parentId:listingId,parentCollection:"skillListings",mediaIds});}catch(error){console.debug("[Marvel Chat] service media cleanup pending",error?.code);}} const purged=await api.purgeDeletedSkillListing({listingId}); state.skillListingsMine=state.skillListingsMine.filter((item)=>String(item.id)!==String(listingId)); state.skills=state.skills.filter((item)=>String(item.id)!==String(listingId)); state.skillsLoadedAt=0; await loadSkillWorkspace(true); await loadSkills(true); toast(purged?.retainedForHistory?"Service removed from discovery; request history was retained.":"Service deleted.","success");paint();return; }
    if (a === "market-view") { const id=actionEl.dataset.id; const m=[...state.products,...state.savedMarketProducts].find((x)=>String(x.id || x.productId)===String(id) || String(x.result?.id || x.result?.productId)===String(id)); if(m){await hydrateMarketProductMedia(m);openMarketProduct(m);}else{toast("This product is not available in the current results. Refresh Market and try again.","info");}return; }
    if (a === "market-view-shop") { await openMarketShop(actionEl.dataset.id); return; }
    if (a === "market-media-prev" || a === "market-media-next") {
      const track = document.querySelector("#modal-root [data-market-detail-track]");
      if (!track) return;
      const delta = a === "market-media-prev" ? -1 : 1;
      track.scrollBy({left: delta * track.clientWidth, behavior: "smooth"});
      return;
    }
    if (a === "save-market-product") { const productId=actionEl.dataset.id; const wasSaved=state.marketSavedProductIds.includes(String(productId)); await api.saveMarketProduct({productId,saved:!wasSaved}); state.marketSavedProductIds=wasSaved?state.marketSavedProductIds.filter((id)=>String(id)!==String(productId)):[...new Set([...state.marketSavedProductIds,String(productId)])]; if(wasSaved)state.savedMarketProducts=state.savedMarketProducts.filter((p)=>String(p.id)!==String(productId)); else {const item=state.products.find((p)=>String(p.id)===String(productId));if(item)state.savedMarketProducts=[item,...state.savedMarketProducts.filter((p)=>String(p.id)!==String(productId))];} toast(wasSaved?"Removed from saved products.":"Product saved for later.","success"); if(document.getElementById("modal-root")?.textContent?.includes("Product")) closeModal(); paint(); return; }
    if (a === "show-saved-market") {
      if(!state.savedMarketProducts.length){
        const saved=await api.getMySavedMarketProducts({limit:40});
        state.savedMarketProducts=Array.isArray(saved?.products)?saved.products.map((item)=>({...item,id:item.id||item.productId||""})):[];
        state.marketSavedProductIds=Array.isArray(saved?.productIds)?saved.productIds.map(String):state.marketSavedProductIds;
      }
      // Fetch media URLs only for the first visible saved products; opening one
      // product refreshes its URLs on demand. This avoids a burst of signed-URL calls.
      await Promise.all(state.savedMarketProducts.slice(0,6).map((p)=>hydrateMarketProductMedia(p)));
      const body=state.savedMarketProducts.length?`<div class="product-grid">${state.savedMarketProducts.map((p)=>`<button type="button" class="shop-product-card" data-action="market-view" data-id="${esc(p.id)}"><span class="shop-product-photo">${p.mediaUrls?.[0]?.url?`<img src="${esc(p.mediaUrls[0].url)}" alt="${esc(p.title||"Product photo")}" loading="lazy" decoding="async">`:icon("market",20)}</span><span class="shop-product-copy"><strong>${esc(p.title||"Product")}</strong><small>${money(p.priceMinor,p.currency||"NGN")}</small></span></button>`).join("")}</div>`:`<div class="empty-state"><strong>No saved products yet</strong><span>Save products from the Market to find them here.</span></div>`;
      modal("Saved products",body,`<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button>`,{wide:true}); return;
    }
    if (a === "profile-posts") { go("home"); return; }
    if (a === "profile-followers" || a === "profile-following") { const kind=a==="profile-followers"?"followers":"following"; const res=await api.getFollowList({direction:kind,targetUid:state.user.uid,limit:40}); const list=Array.isArray(res?.users)?res.users:Array.isArray(res?.items)?res.items:[]; modal(kind==="followers"?"Followers":"Following",list.length?`<div class="follow-list">${list.map((p)=>`<button class="follow-list-item" type="button" data-action="view-user" data-id="${esc(p.uid||p.id||"")}">${avatar(p,"sm",true)}<span><strong>${esc(p.displayName||p.username||"Member")}</strong><small>${p.username?`@${esc(p.username)}`:"Marvel Chat member"}</small></span></button>`).join("")}</div>`:`<div class="empty-state"><strong>No ${kind} to show</strong><span>As your community grows, the list will appear here.</span></div>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button>`,{wide:true}); return; }
    if (a === "submit-purchase") { const d=Object.fromEntries(new FormData(document.getElementById("purchase-form"))); const quantity=Math.max(1,Math.min(1000,Number(d.quantity||1))); await api.createMarketCommerceRequest({items:[{productId:d.productId,quantity}],customerNote:String(d.customerNote || "").trim()});closeModal();toast("Commerce request sent.","success");return; }
    if (a === "route-seller-onboarding") { state.sellerOnboardingStep=0;go("seller-onboarding");return; }
    if (a === "submit-store") { const d=Object.fromEntries(new FormData(document.getElementById("seller-details-form"))); if(state.myStore){await api.updateStoreProfile({storeId:state.myStore.id,name:String(d.name).trim(),description:String(d.description || "").trim(),locationText:String(d.location || "").trim()});toast("Store updated.","success");}else{const r=await api.createStore({name:String(d.name).trim(),description:String(d.description || "").trim(),category:String(d.category || "").trim(),location:String(d.location || "").trim()});state.sellerDraft={...state.sellerDraft,...d,storeId:r?.storeId || "",agreed:true};saveSellerDraft();toast("Store created.","success");}closeModal();await loadBusinessWorkspace(true);state.marketLoaded=false;await loadMarket(true);go("business");return; }
    if (a === "store-status-toggle") { await api.setStoreStatus({storeId:state.myStore.id,status:actionEl.dataset.status});toast(actionEl.dataset.status === "active" ? "Store is open." : "Store is paused.","success");await loadBusinessWorkspace(true);paint();return; }
    if (a === "create-product") { if(!state.myStore){go("seller-onboarding");return;}openProductEditor();return; }
    if (a === "edit-product") { const p=state.myProducts.find((x)=>x.id===actionEl.dataset.id);if(p)openProductEditor(p);return; }
    if (a === "submit-product") {
      const f = document.getElementById("product-form");
      const d = Object.fromEntries(new FormData(f));
      const id = actionEl.dataset.id;
      const existing = id ? state.myProducts.find((item) => item.id === id) : null;
      const payload = {
        title: String(d.title || "").trim(),
        description: String(d.description || "").trim(),
        categoryId: String(d.categoryId || "") || null,
        priceMinor: safeMinor(d.priceMinor),
        currency: String(d.currency || "NGN").trim().toUpperCase(),
        tags: String(d.tags || "").split(",").map((x) => x.trim()).filter(Boolean)
      };
      const keepIds = id ? [...f.querySelectorAll('input[name="keepProductMedia"]:checked')].map((input) => input.value) : [];
      const oldMediaIds = Array.isArray(existing?.mediaIds) ? [...existing.mediaIds] : [];
      const newFiles = Array.isArray(state.pendingProductPhotoFiles) ? state.pendingProductPhotoFiles : [];
      if (newFiles.length > 8 || keepIds.length + newFiles.length > 8) {
        toast("A product can have up to eight photos. Remove a photo or choose fewer new ones.", "error");
        return;
      }
      let mediaIds = [...keepIds];
      for (const file of newFiles) {
        mediaIds.push(await uploadMarketProductPhoto(file));
      }
      if (!id && mediaIds.length === 0) {
        toast("Choose at least one product photo before creating the listing.", "error");
        return;
      }
      if (id) {
        const update = {...payload, mediaIds};
        await api.updateProduct({productId:id,...update});
        const removedIds = oldMediaIds.filter((mediaId) => !mediaIds.includes(mediaId));
        if (removedIds.length) {
          try { await api.cleanupDeletedMedia({feature:"market_product",parentId:id,parentCollection:"products",mediaIds:removedIds}); }
          catch (error) { console.debug("[Marvel Chat] removed product photo cleanup pending", error?.code || error?.message); }
        }
      } else {
        await api.createProduct({storeId:state.myStore.id,...payload,mediaIds});
      }
      resetPendingPhoto("product");
      closeModal();
      toast(id ? "Product updated." : "Product created.","success");
      await loadBusinessWorkspace(true);
      state.marketLoaded = false;
      await loadMarket(true);
      paint();
      return;
    }
    if (a === "inventory-product") { const p=state.myProducts.find((x)=>x.id===actionEl.dataset.id);if(!p)return;modal("Update inventory",`<form id="inventory-form" class="form-stack"><input type="hidden" name="productId" value="${esc(p.id)}"><label class="floating-field"><input name="inventoryQuantity" type="number" min="1" max="1000000" value="${Number(p.inventoryQuantity || 0)}" required placeholder=" "><span>Inventory quantity</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-inventory">Save stock</button>`);return; }
    if (a === "submit-inventory") { const d=Object.fromEntries(new FormData(document.getElementById("inventory-form"))); await api.setProductInventory({productId:d.productId,inventoryQuantity:Math.max(1,Math.floor(Number(d.inventoryQuantity||1)))});closeModal();toast("Inventory updated.","success");await loadBusinessWorkspace(true);paint();return; }
    if (a === "activate-product" || a === "pause-product") { await api.setProductAvailability({productId:actionEl.dataset.id,status:a === "activate-product" ? "active" : "paused"});toast(a === "activate-product" ? "Product activated." : "Product paused.","success");await loadBusinessWorkspace(true);paint();return; }
    if (a === "archive-product") { await api.archiveProduct({productId:actionEl.dataset.id});toast("Product archived.","success");await loadBusinessWorkspace(true);paint();return; }
    if (a === "commerce-status") { await api.updateMarketCommerceRequestStatus({requestId:actionEl.dataset.id,status:actionEl.dataset.status});toast("Commerce request updated.","success");await loadBusinessWorkspace(true);paint();return; }
    if (a === "edit-profile") { openProfileEdit();return; }
    if (a === "submit-profile") {
      const d = Object.fromEntries(new FormData(document.getElementById("profile-form")));
      const payload = {displayName: String(d.displayName).trim(), username: String(d.username).trim().replace(/^@/, "").toLowerCase(), bio: String(d.bio || "").trim(), location: String(d.location || "").trim()};
      const oldProfilePhotoMediaId = state.profile?.photoMediaId || "";
      if (state.pendingProfilePhotoFile) {
        const photoMediaId = await uploadProfilePhoto(state.pendingProfilePhotoFile);
        payload.photoMediaId = photoMediaId;
      }
      await api.updateProfile(payload);
      if (payload.photoMediaId && oldProfilePhotoMediaId && payload.photoMediaId !== oldProfilePhotoMediaId) {
        try { await api.cleanupDeletedMedia({feature:"profile_photo",parentId:state.user.uid,parentCollection:"users",mediaIds:[oldProfilePhotoMediaId]}); }
        catch (error) { console.debug("[Marvel Chat] old profile photo cleanup pending", error?.code || error?.message); }
      }
      await updateAuthProfile(state.user, {displayName: payload.displayName});
      if (state.pendingProfilePhotoPreview) URL.revokeObjectURL(state.pendingProfilePhotoPreview);
      state.pendingProfilePhotoPreview = "";
      state.pendingProfilePhotoInfo = "";
      state.pendingProfilePhotoFile = null;
      closeModal();
      state.profileLoadedAt = 0;
      await loadProfile(true);
      toast("Profile updated.", "success");
      paint();
      return;
    }
    if (a === "read-notification") { await api.markNotificationRead({notificationId:actionEl.dataset.id});await loadNotifications(true);paint();return; }
    if (a === "enable-notifications") { await enableBrowserNotifications(); return; }
    if (a === "disable-notifications") { await disableBrowserNotifications(); return; }
    if (a.startsWith("theme-")) { const t=a.slice(6);setTheme(t);paint();try{await api.updateUserSettings({themeId:t});}catch{}return; }
    if (a === "market-category") { state.marketCategory=actionEl.dataset.category || "all";paint();return; }
    if (a === "skills-category") { state.skillCategory=actionEl.dataset.category || "all";paint();return; }
    if (a === "onboarding-next") { const step=state.sellerOnboardingStep; if(step===2 && !document.getElementById("seller-agreement")?.checked){toast("Please accept the seller standards.","error");return;} if(step===3){const f=document.getElementById("seller-details-form");const d=f ? Object.fromEntries(new FormData(f)) : {};state.sellerDraft={...state.sellerDraft,...d,agreed:true};saveSellerDraft(); if(state.myStore) await api.updateStoreProfile({storeId:state.myStore.id,name:String(d.name).trim(),description:String(d.description || "").trim(),locationText:String(d.location || "").trim()}); else {const r=await api.createStore({name:String(d.name).trim(),description:String(d.description || "").trim(),category:String(d.category || "").trim(),location:String(d.location || "").trim()});state.sellerDraft.storeId=r?.storeId || "";} await loadBusinessWorkspace(true);go("business");return;} state.sellerOnboardingStep++;paint();return; }
    if (a === "onboarding-back") { if(state.sellerOnboardingStep>0){state.sellerOnboardingStep--;paint();}return; }
    if (a === "skill-onboarding-next") { const step=state.skillOnboardingStep;const f=document.getElementById("skill-details-form");if(f){const d=Object.fromEntries(new FormData(f));state.skillDraft={...state.skillDraft,...d};saveSkillDraft();} if(step===3){const d=state.skillDraft;const categories=String(d.category || "").trim();await api.upsertSkillProfile({headline:String(d.headline || "").trim(),bio:String(d.bio || "").trim(),locationText:String(d.locationText || "").trim(),remote:String(d.remote) !== "false",yearsExperience:Math.max(0,Math.min(80,Math.floor(Number(d.yearsExperience || 0)))),categories:categories ? [categories] : []}); if(d.listingTitle && d.listingDescription && d.category){await api.createSkillListing({title:String(d.listingTitle).trim(),description:String(d.listingDescription).trim(),categoryId:String(d.category),currency:String(d.currency || "NGN"),priceFromMinor:d.priceFromMinor === "" ? null : safeMinor(d.priceFromMinor),deliveryTimeDays:d.deliveryTimeDays === "" ? null : Math.max(1,Math.min(365,Math.floor(Number(d.deliveryTimeDays)))),tags:String(d.tags || "").split(",").map((x)=>x.trim()).filter(Boolean)});} state.skillDraft={...state.skillDraft,skillProfileUid:state.user.uid};saveSkillDraft();toast("Provider profile saved.","success");await loadSkillWorkspace(true);go("skill-profile");return;} state.skillOnboardingStep++;paint();return; }
    if (a === "skill-onboarding-back") { if(state.skillOnboardingStep>0){state.skillOnboardingStep--;paint();}return; }
    if (a === "submit-skill-listing") {
      const d = Object.fromEntries(new FormData(document.getElementById("skill-listing-form")));
      const id = actionEl.dataset.id;
      const existing = id ? state.skillListingsMine.find((item) => item.id === id) : null;
      const payload = {
        title:String(d.title || "").trim(),
        description:String(d.description || "").trim(),
        categoryId:String(d.categoryId || ""),
        currency:"NGN",
        priceFromMinor:d.priceFromMinor === "" ? null : safeMinor(d.priceFromMinor),
        deliveryTimeDays:d.deliveryTimeDays === "" ? null : Math.max(1,Math.min(365,Math.floor(Number(d.deliveryTimeDays)))),
        tags:String(d.tags || "").split(",").map((x)=>x.trim()).filter(Boolean)
      };
      let mediaIds = Array.isArray(existing?.mediaIds) ? [...existing.mediaIds] : [];
      const oldMediaIds = [...mediaIds];
      if (state.pendingSkillPhotoFile) {
        const newMediaId = await uploadSkillListingPhoto(state.pendingSkillPhotoFile);
        mediaIds = [newMediaId, ...mediaIds.filter((mediaId) => mediaId !== newMediaId)].slice(0, 5);
      }
      if (state.pendingSkillPhotoFile || !id) payload.mediaIds = mediaIds;
      if (id) {
        await api.updateSkillListing({listingId:id,...payload});
        if (state.pendingSkillPhotoFile && oldMediaIds.length) {
          try { await api.cleanupDeletedMedia({feature:"skill_listing",parentId:id,parentCollection:"skillListings",mediaIds:oldMediaIds}); }
          catch (error) { console.debug("[Marvel Chat] old service photo cleanup pending", error?.code || error?.message); }
        }
      } else {
        await api.createSkillListing(payload);
      }
      resetPendingPhoto("skill");
      closeModal();
      toast(id ? "Listing updated." : "Listing published.","success");
      await loadSkillWorkspace(true);
      await loadSkills(true);
      paint();
      return;
    }
  } catch (err) { console.error("[Marvel Chat] action failed", a, err?.code, err?.message, err); toast(friendlyError(err),"error"); }
});

document.addEventListener("change", async (e) => {
  const input = e.target;
  if (input?.matches?.('[data-action="market-sort"]')) {
    state.marketSort = ["recommended","newest","price_low","price_high"].includes(input.value) ? input.value : "recommended";
    paint();
    return;
  }
  if (input?.id === "profile-photo-input" && input.files?.[0]) {
    const original = input.files[0];
    const box = document.getElementById("profile-photo-preview");
    try {
      if (!original.type.startsWith("image/")) throw new Error("Choose an image for your profile photo.");
      const optimized = await prepareMediaFile(original, undefined, "image");
      if (optimized.size > MAX_MEDIA_BYTES) throw new Error("The profile image is still larger than 2 MiB after optimization.");
      const usage = await api.getMyMediaDailyUsage({requestedBytes: optimized.size});
      const remaining = Math.max(0, Number(usage?.remainingBytes ?? DAILY_MEDIA_BYTES));
      if (optimized.size > remaining) throw new Error(`The shared 2 MiB rolling 24-hour allowance has ${formatMiB(remaining)} remaining. ${quotaRetryCopy(usage?.retryAt)} You can still update text fields.`);
      state.pendingProfilePhotoFile = optimized;
      if (state.pendingProfilePhotoPreview) URL.revokeObjectURL(state.pendingProfilePhotoPreview);
      state.pendingProfilePhotoPreview = URL.createObjectURL(optimized);
      const saved = Math.max(0, original.size - optimized.size);
      const pct = original.size ? (saved / original.size * 100) : 0;
      state.pendingProfilePhotoInfo = `${formatKB(original.size)} → ${formatKB(optimized.size)}${saved ? ` · saved ${pct.toFixed(1)}%` : " · already optimized"}`;
      if (box) box.innerHTML = `<img src="${state.pendingProfilePhotoPreview}" alt="Optimized profile photo preview"><small class="media-compression-result">${esc(state.pendingProfilePhotoInfo)}</small>`;
    } catch (error) {
      state.pendingProfilePhotoFile = null;
      input.value = "";
      toast(error.message || "Profile photo could not be optimized.", "error");
    }
  }
  if ((input?.id === "post-media" || input?.id === "edit-post-media") && input.files) {
    const isEditing = input.id === "edit-post-media";
    const box = document.getElementById(isEditing ? "edit-post-media-preview" : "post-media-preview");
    const filesStateKey = isEditing ? "pendingEditMediaFiles" : "pendingMediaFiles";
    const processingKey = isEditing ? "pendingEditMediaProcessing" : "pendingMediaProcessing";
    try {
      const files = validateHomeFiles(input.files);
      if (files.length > 10) throw new Error("Choose up to 10 media items at a time.");
      state[processingKey] = true;
      state[filesStateKey] = [];
      if (box) {
        box.querySelectorAll("img,video").forEach((media) => {
          const url = media.getAttribute("src") || "";
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        });
        box.innerHTML = `<div class="media-processing" role="status">${icon("spinner",18)} Optimizing ${files.length} media item${files.length === 1 ? "" : "s"} for upload…</div>`;
      }
      const preparedItems = [];
      for (const original of files) {
        const optimized = await prepareMediaFile(original);
        if (optimized.size > MAX_MEDIA_BYTES) {
          throw new Error(`${original.name}: this media is still over 2 MiB after compression. Please choose a smaller file.`);
        }
        preparedItems.push({original, optimized});
        if (box) box.innerHTML = `<div class="media-processing" role="status">${icon("spinner",18)} Compressed ${preparedItems.length} of ${files.length} media items…</div>`;
      }
      const totalBytes = preparedItems.reduce((sum, item) => sum + item.optimized.size, 0);
      if (totalBytes > DAILY_MEDIA_BYTES) throw new Error(`The selected files total ${formatMiB(totalBytes)} after compression. The daily upload limit is 2.00 MiB.`);
      const usage = await api.getMyMediaDailyUsage({requestedBytes: totalBytes});
      const remainingBytes = Math.max(0, Number(usage?.remainingBytes ?? DAILY_MEDIA_BYTES));
      if (totalBytes > remainingBytes) throw new Error(`The shared rolling 24-hour media limit is 2.00 MiB. ${formatMiB(remainingBytes)} remains and this selection needs ${formatMiB(totalBytes)}. ${quotaRetryCopy(usage?.retryAt)} Text-only posts are still available.`);
      state[filesStateKey] = preparedItems.map((item) => item.optimized);
      if (box) {
        box.innerHTML = preparedItems.map(({original, optimized}) => {
          const url = URL.createObjectURL(optimized);
          const visual = optimized.type.startsWith("video/")
            ? `<video src="${esc(url)}" muted playsinline preload="metadata" aria-label="Optimized video preview"></video>`
            : `<img src="${esc(url)}" alt="Optimized preview of ${esc(original.name)}" decoding="async">`;
          const savedBytes = Math.max(0, original.size - optimized.size);
          const percent = original.size ? (savedBytes / original.size) * 100 : 0;
          const summary = optimized.size < original.size
            ? `${formatKB(original.size)} → ${formatKB(optimized.size)} · saved ${percent.toFixed(1)}%`
            : `${formatKB(original.size)} · no further compression needed`;
          return `<article class="selected-media"><div class="selected-media-preview">${visual}</div><div class="selected-media-copy"><strong>${esc(original.name)}</strong><small>${summary}</small><small>${optimized.type.startsWith("video/") ? "Video" : "Image"} · max 2 MiB per item</small></div></article>`;
        }).join("") + `<p class="media-quota-note">Added selection: ${formatMiB(totalBytes)} · daily limit: 2.00 MiB · remaining before upload: ${formatMiB(remainingBytes - totalBytes)}</p>`;
      }
    } catch (error) {
      state[filesStateKey] = [];
      input.value = "";
      if (box) {
        box.querySelectorAll("img,video").forEach((media) => {
          const url = media.getAttribute("src") || "";
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        });
        box.innerHTML = "";
      }
      toast(error.message || "Media optimization failed.", "error");
    } finally {
      state[processingKey] = false;
    }
  }

  if (input?.id === "product-photo-input" && input.files) {
    const box = document.getElementById("product-photo-preview");
    const results = document.getElementById("product-photo-results");
    try {
      const originals = Array.from(input.files || []);
      if (!originals.length) return;
      if (originals.length > 8) throw new Error("Choose up to eight product photos at a time.");
      if (originals.some((file) => !file.type.startsWith("image/"))) throw new Error("Choose image files only for a product gallery.");
      if (Array.isArray(state.pendingProductPhotoPreviews)) state.pendingProductPhotoPreviews.forEach((url)=>{if(url)URL.revokeObjectURL(url);});
      state.pendingProductPhotoPreviews=[];
      state.pendingProductPhotoFiles=[];
      if (results) results.innerHTML = `<div class="media-processing" role="status">${icon("spinner",18)} Optimizing product photos…</div>`;
      const prepared=[];
      for (const original of originals) {
        const optimized=await prepareMediaFile(original, undefined, "image");
        if(optimized.size>MAX_MEDIA_BYTES) throw new Error(`${original.name} remains larger than 2 MiB after compression.`);
        prepared.push({original,optimized});
      }
      const total=prepared.reduce((sum,item)=>sum+item.optimized.size,0);
      if(total>DAILY_MEDIA_BYTES) throw new Error(`These photos total ${formatMiB(total)}. The shared rolling 24-hour allowance is 2 MiB; choose fewer or smaller photos.`);
      const usage=await api.getMyMediaDailyUsage({requestedBytes:total});
      const remaining=Math.max(0,Number(usage?.remainingBytes??DAILY_MEDIA_BYTES));
      if(total>remaining) throw new Error(`Only ${formatMiB(remaining)} remains in the shared 2 MiB rolling 24-hour media allowance. ${quotaRetryCopy(usage?.retryAt)}`);
      state.pendingProductPhotoFiles=prepared.map((item)=>item.optimized);
      state.pendingProductPhotoFile=state.pendingProductPhotoFiles[0]||null;
      const imageCards=prepared.map(({original,optimized})=>{
        const url=URL.createObjectURL(optimized);state.pendingProductPhotoPreviews.push(url);
        const saved=Math.max(0,original.size-optimized.size);const pct=original.size?(saved/original.size*100):0;
        return `<figure class="selected-media"><img src="${esc(url)}" alt="Optimized preview of ${esc(original.name)}" decoding="async"><figcaption><strong>${esc(original.name)}</strong><small>${formatKB(original.size)} → ${formatKB(optimized.size)}${saved?` · saved ${pct.toFixed(1)}%`:" · already optimized"}</small></figcaption></figure>`;
      }).join("");
      if(box) box.innerHTML=imageCards;
      if(results) results.innerHTML=`<p class="media-quota-note">Selected ${prepared.length} photo(s) · ${formatMiB(total)} optimized · ${formatMiB(remaining-total)} remaining before upload. The server checks the allowance again during each upload.</p>`;
    } catch (error) {
      state.pendingProductPhotoFiles=[];state.pendingProductPhotoFile=null;
      if(Array.isArray(state.pendingProductPhotoPreviews))state.pendingProductPhotoPreviews.forEach((url)=>URL.revokeObjectURL(url));state.pendingProductPhotoPreviews=[];
      if(box)box.innerHTML="";if(results)results.textContent="";input.value="";
      toast(error.message||"Product photos could not be optimized.","error");
    }
  }
  if (input?.id === "skill-photo-input" && input.files?.[0]) {
    const original = input.files[0];
    try {
      if (!original.type.startsWith("image/")) throw new Error("Choose an image file for the service.");
      const optimized = await prepareMediaFile(original, undefined, "image");
      if (optimized.size > MAX_MEDIA_BYTES) throw new Error("The service photo is still larger than 2 MiB after compression.");
      const usage = await api.getMyMediaDailyUsage({requestedBytes: optimized.size});
      const remaining = Math.max(0, Number(usage?.remainingBytes ?? DAILY_MEDIA_BYTES));
      if (optimized.size > remaining) throw new Error(`The shared 2 MiB rolling 24-hour allowance has ${formatMiB(remaining)} remaining. ${quotaRetryCopy(usage?.retryAt)}`);
      if (state.pendingSkillPhotoPreview) URL.revokeObjectURL(state.pendingSkillPhotoPreview);
      state.pendingSkillPhotoFile = optimized;
      state.pendingSkillPhotoPreview = URL.createObjectURL(optimized);
      const saved = Math.max(0, original.size - optimized.size);
      const pct = original.size ? (saved / original.size * 100) : 0;
      state.pendingSkillPhotoInfo = `${formatKB(original.size)} → ${formatKB(optimized.size)}${saved ? ` · saved ${pct.toFixed(1)}%` : " · already optimized"}`;
      const box = document.getElementById("skill-photo-preview");
      if (box) box.innerHTML = `<img src="${esc(state.pendingSkillPhotoPreview)}" alt="Optimized service photo"><small class="media-compression-result">${esc(state.pendingSkillPhotoInfo)}</small>`;
    } catch (error) {
      state.pendingSkillPhotoFile = null;
      input.value = "";
      toast(error.message || "Service photo could not be optimized.", "error");
    }
  }
  if(input?.id === "moment-photo" && input.files?.[0]) {
    const original = input.files[0];
    try {
      validateHomeFiles([original]);
      const optimized = await prepareMediaFile(original);
      if (optimized.size > MAX_MEDIA_BYTES) {
        throw new Error("This media is still larger than 2 MiB after compression. Choose a smaller photo or video.");
      }
      const usage = await api.getMyMediaDailyUsage({requestedBytes: optimized.size});
      const remaining = Math.max(0, Number(usage?.remainingBytes ?? DAILY_MEDIA_BYTES));
      if (optimized.size > remaining) {
        throw new Error(`The shared rolling 24-hour media limit is 2.00 MiB. ${formatMiB(remaining)} remains and this item needs ${formatMiB(optimized.size)}. ${quotaRetryCopy(usage?.retryAt)} Text-only Moments are still available.`);
      }
      state.pendingMomentFile = optimized;
      const contentSelect=document.getElementById("moment-content-type");
      const textValue=String(document.querySelector('#moment-form textarea[name="text"]')?.value || "").trim();
      if (contentSelect) contentSelect.value = optimized.type.startsWith("video/") ? (textValue ? "video_text" : "video") : (textValue ? "photo_text" : "photo");
      const box=document.getElementById("moment-photo-preview");
      if(box){
        box.querySelectorAll("img,video").forEach((media) => { const url=media.getAttribute("src") || ""; if(url.startsWith("blob:")) URL.revokeObjectURL(url); });
        const previewUrl=URL.createObjectURL(optimized);
        const visual=optimized.type.startsWith("video/") ? `<video src="${esc(previewUrl)}" controls playsinline preload="metadata" aria-label="Optimized Moment video preview"></video>` : `<img src="${esc(previewUrl)}" alt="Optimized Moment photo preview" decoding="async">`;
        const saving=Math.max(0, original.size-optimized.size);
        const pct=original.size ? Math.max(0,(saving/original.size)*100) : 0;
        box.innerHTML=`${visual}<small class="media-compression-result">${formatKB(original.size)} → ${formatKB(optimized.size)}${saving ? ` · saved ${pct.toFixed(1)}%` : " · no further compression needed"}. Per item: 2 MiB max; daily total: 2 MiB.</small>`;
      }
    } catch (error) {
      input.value = "";
      state.pendingMomentFile = null;
      const box=document.getElementById("moment-photo-preview");
      if (box) box.innerHTML = "";
      toast(error.message || "Moment media could not be optimized.","error");
    }
  }
});

document.addEventListener("submit", async (e) => {
  const f=e.target;if(!f)return;
  try {
    if(f.id === "signup-form"){e.preventDefault();await signup(f);toast("Your account is ready.","success");return;}
    if(f.id === "signin-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));await persistenceReady;try{await signInWithEmailAndPassword(auth,String(d.email).trim(),String(d.password));}catch(err){console.error("[Marvel Chat] email sign-in",err?.code,err?.message);throw err;}return;}
    if(f.id === "forgot-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));await sendPasswordResetEmail(auth,String(d.email).trim());toast("If an account matches that email, a reset link is on its way.","success");return;}
    if(f.id === "message-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));const text=String(d.text || "").trim();if(!text)return;await api.sendMessage({threadId:state.activeThreadId,text});f.reset();return;}
    if(f.id === "home-search-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));state.searchQuery=String(d.query || "").trim();if(state.searchQuery.length<2){state.homeSearchResults=[];paint();return;}const r=await api.search({query:state.searchQuery,scope:"people_posts"});state.homeSearchResults=Array.isArray(r?.results)?r.results.filter((item)=>["user","person","post"].includes(String(item?.type||"").toLowerCase())):[];paint();return;}
    if(f.id === "chat-person-search-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));state.chatSearchQuery=String(d.query || "").trim();if(state.chatSearchQuery.length<2){state.chatSearchResults=[];paint();return;}const r=await api.search({query:state.chatSearchQuery,scope:"users"});state.chatSearchResults=Array.isArray(r?.results)?r.results:[];paint();return;}
    if(f.id === "skills-search-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));state.skillsSearchQuery=String(d.query || "").trim();paint();return;}
    if(f.id === "search-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));state.searchQuery=String(d.query || "").trim();state.searchScope=String(d.scope || "all");if(state.searchQuery.length<2){state.searchResults=[];paint();return;}const r=await api.search({query:state.searchQuery,scope:state.searchScope});state.searchResults=Array.isArray(r?.results)?r.results:[];paint();return;}
    if(f.id === "market-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));state.searchQuery=String(d.query || "").trim();await loadMarket();paint();return;}
  } catch(err) { e.preventDefault(); console.error(err?.code,err?.message); toast(friendlyError(err),"error"); }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && app.querySelector("[data-discovery-overlay]")) { stopDiscoveryBannerTimer(); discoveryBannerVisibleForUser = false; paint(); return; }
  if (e.key === "Escape") { document.getElementById("menu-root")?.remove(); closeModal(); }
  if(e.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)){e.preventDefault();go("search");setTimeout(()=>document.querySelector('#search-form input[name="query"]')?.focus(),0);}
  if(e.target.matches(".composer textarea") && e.key === "Enter" && !e.shiftKey){e.preventDefault();e.target.form?.requestSubmit();}
});

if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
app.innerHTML=`<main class="splash"><section class="splash-card"><div class="brand-mark brand-mark-xl"><img src="./assets/brand/icon-512.png" alt="Marvel Chat"></div><h1>Marvel Chat</h1><p>by Davonium Technologies</p><div class="loader"><span></span></div></section></main>`;

onAuthStateChanged(auth, async (user) => {
  clearSubscriptions();
  const previousUid = state.user?.uid || "";
  state.user = user;
  if (previousUid !== (user?.uid || "")) { stopDiscoveryBannerTimer(); discoveryBannerVisibleForUser = null; }
  state.activeThreadId = null;
  state.messages = [];
  if (!user) {
    state.profile = null; state.skillProfile = null; state.myStore = null;
    state.posts = []; state.moments = []; state.homeCursor = null; state.homeHasMore = false; state.homeViewerFollowsAny = null; state.homeLoaded = false;
    state.savedPosts = []; state.savedPostsCursor = null; state.savedPostsHasMore = false; state.savedPostsLoaded = false;
    state.notifications = []; state.unreadNotifications = 0; state.followingIds = [];
    state.route = "home"; authMode = "welcome"; paint(); return;
  }
  if (previousUid !== user.uid) {
    state.profileLoadedAt = 0; state.threadsLoadedAt = 0; state.notificationsLoadedAt = 0;
    state.marketLoaded = false; state.marketCacheAt = 0; state.skillsLoadedAt = 0; state.businessLoadedAt = 0;
    state.posts = []; state.moments = []; state.homeCursor = null; state.homeHasMore = false; state.homeViewerFollowsAny = null; state.homeLoaded = false; state.homeError = "";
    state.savedPosts = []; state.savedPostsCursor = null; state.savedPostsHasMore = false; state.savedPostsLoaded = false;
    state.notifications = []; state.unreadNotifications = 0; state.followingIds = []; state.followStats = {followersCount: 0, followingCount: 0, postCount: 0};
  }
  try { state.pushEnabled = typeof Notification !== "undefined" && Notification.permission === "granted"; } catch {}
  // Render immediately after authentication. Profile and notification requests
  // must not hold the first Home feed paint hostage.
  paint();
  void loadProfile().catch((error) => console.debug("[Marvel Chat] profile load deferred", error?.code || error?.message)).finally(() => paint());
  void refreshNotificationSummary().catch((error) => { state.unreadNotifications = 0; console.debug("[Marvel Chat] notification badge unavailable", error?.code || error?.message); }).finally(() => paint());
  void refreshRouteData(state.route);
});
