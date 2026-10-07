import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  GoogleAuthProvider, signInWithPopup, updateAuthProfile, initAppCheck,
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, onSnapshot,
  getBrowserFcmIdentity, onForegroundMessage
} from "./firebase.js";
import {api} from "./api.js";
import {
  state, setTheme, clearSubscriptions, addSubscription,
  saveSellerDraft, saveSkillDraft
} from "./state.js";
import {
  esc, avatar, when, formatDate, toast, modal, closeModal, friendlyError
} from "./ui.js";
import {icon} from "./icons.js";
import {uploadHomeMediaFiles, uploadMomentMedia, readPostMedia, readMomentMedia, MAX_POST_MEDIA} from "./media.js";

const app = document.getElementById("app");
const routes = [
  "home", "chat", "skills", "market", "profile", "search",
  "notifications", "settings", "skill-profile", "business",
  "seller-onboarding", "skill-onboarding"
];
const MARKET_CATEGORIES = [
  ["all", "All"], ["electronics", "Electronics"], ["fashion", "Fashion"],
  ["home", "Home"], ["beauty", "Beauty"], ["food", "Food"],
  ["services", "Services"], ["other", "Other"]
];
const SKILL_CATEGORIES = [
  ["all", "All"], ["design", "Design"], ["writing", "Writing"],
  ["programming", "Programming"], ["marketing", "Marketing"],
  ["education", "Education"], ["business", "Business"],
  ["translation", "Translation"], ["other", "Other"]
];
let authMode = "welcome";
let foregroundNotificationUnsub = null;
try { initAppCheck(); } catch {}

async function enableBrowserNotifications() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Browser notifications are not supported on this device.");
  }
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Browser notification permission was not granted.");
  }
  const fcm = await getBrowserFcmIdentity();
  if (!fcm?.token || !fcm?.installationId) throw new Error("Browser push is not available yet.");
  const token = fcm.token;
  const storageKey = `marvel-device-${state.user.uid}`;
  let device = {};
  try { device = JSON.parse(localStorage.getItem(storageKey) || "{}") || {}; } catch {}
  if (!device.deviceId) {
    device.deviceId = (crypto.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 120);
  }
  if (!device.installationId) {
    device.installationId = fcm.installationId.slice(0, 200);
  }
  device.token = token;
  localStorage.setItem(storageKey, JSON.stringify(device));
  device.installationId = fcm.installationId.slice(0, 200);
  await api.registerDevice({deviceId: device.deviceId, installationId: device.installationId, token, platform: "web", browser: navigator.userAgent.slice(0, 120)});
  if (!foregroundNotificationUnsub) {
    foregroundNotificationUnsub = onForegroundMessage((payload) => {
      const title = payload?.notification?.title || payload?.data?.title || "Marvel Chat";
      const body = payload?.notification?.body || payload?.data?.body || "You have a new notification.";
      toast(`${title}: ${body}`, "info");
    });
  }
}

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
  return `<p class="legal-copy">By creating an account, we agree to the
    <button class="inline-link" type="button" data-action="legal-terms">Terms</button>,
    <button class="inline-link" type="button" data-action="legal-privacy">Privacy Policy</button>, and
    <button class="inline-link" type="button" data-action="legal-community">Community Guidelines</button>.</p>`;
}

function authScreen() {
  const wrap = (body, klass = "") => `<main class="auth-page">
    <div class="auth-glow glow-one"></div><div class="auth-glow glow-two"></div>
    <section class="auth-wrap">
      <section class="auth-card ${klass}">
        <header class="auth-brand inside-card">
          <div class="brand-mark brand-mark-xl"><img src="./assets/brand/icon-192.png" alt="Marvel Chat"></div>
          <h1>Marvel Chat</h1><p>by Davonium Technologies</p>
        </header>
        ${body}
        <footer class="auth-foot">© 2026 Davonium Technologies. All rights reserved.</footer>
      </section>
    </section>
  </main>`;

  if (authMode === "signup") {
    return wrap(`<div class="auth-heading"><span class="eyebrow">CREATE ACCOUNT</span><h2>Welcome to Marvel Chat</h2><p>Build your identity and join the community.</p></div>
      <form id="signup-form" class="form-stack auth-form">
        ${authField("text", "Full name", "displayName", {autocomplete: "name", maxlength: 80})}
        ${authField("text", "Username", "username", {autocomplete: "username", maxlength: 30})}
        ${authField("email", "Email", "email", {autocomplete: "email", maxlength: 254})}
        ${authField("password", "Password", "password", {autocomplete: "new-password", minlength: 6, maxlength: 128, password: true})}
        <label class="agree-row"><input type="checkbox" name="agreement" required><span>I agree to the Marvel Chat terms and community standards.</span></label>
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
    <button class="desktop-brand" type="button" data-action="route-home" aria-label="Marvel Chat home"><span class="brand-mark brand-mark-sm"><img src="./assets/brand/icon-192.png" alt="Marvel Chat"></span><span><strong>Marvel Chat</strong><small>Connect · Chat · Share · Discover</small></span></button>
    <div class="top-actions"><button class="icon-btn" type="button" data-action="route-search" aria-label="Search">${icon("search", 20)}</button><button class="icon-btn notif-btn" type="button" data-action="route-notifications" aria-label="Notifications">${icon("bell", 20)}${state.unreadNotifications ? `<b>${state.unreadNotifications > 9 ? "9+" : state.unreadNotifications}</b>` : ""}</button><button class="icon-btn" type="button" data-action="theme-toggle" aria-label="Toggle theme">${icon(state.resolvedTheme === "dark" ? "sun" : "moon", 19)}</button><button class="icon-btn" type="button" data-action="open-menu" aria-label="Menu">${icon("menu", 20)}</button></div>
  </div></header>`;
}

function bottomBar() {
  const items = [["home", "Home", "home"], ["chat", "Chat", "chat"], ["skills", "Skills", "skills"], ["market", "Market", "market"], ["profile", "Profile", "profile"]];
  return `<nav class="bottom-bar" aria-label="Primary navigation">${items.map(([r, l, i]) => `<button class="nav-item ${state.route === r ? "active" : ""}" type="button" data-action="route-${r}">${icon(i, 20)}<span>${l}</span></button>`).join("")}</nav>`;
}

function sideMenu() {
  return `<div class="menu-layer" data-action="close-menu"><aside class="side-menu">
    <div class="menu-head"><div><span class="eyebrow">MARVEL CHAT</span><h2>More</h2></div><button class="icon-btn" type="button" data-action="close-menu" aria-label="Close">${icon("close", 20)}</button></div>
    <button class="menu-item" type="button" data-action="route-search">${icon("search")}Search</button>
    <button class="menu-item" type="button" data-action="route-notifications">${icon("bell")}Notifications</button>
    <button class="menu-item" type="button" data-action="route-settings">${icon("settings")}Settings</button>
    <div class="menu-sep"></div>
    <button class="menu-item" type="button" data-action="legal-terms">${icon("file")}Terms</button>
    <button class="menu-item" type="button" data-action="legal-privacy">${icon("lock")}Privacy</button>
    <button class="menu-item" type="button" data-action="legal-community">${icon("shield")}Community Guidelines</button>
    <div class="menu-foot">Davonium Technologies · © 2026</div>
  </aside></div>`;
}

function shell(content) {
  return `<div class="app-shell">${topbar()}<main class="main-scroll">${content}</main>${bottomBar()}</div>`;
}
function emptyState(title, text, action = "", label = "") {
  return `<div class="empty-state"><div class="empty-icon">${icon("spark", 19)}</div><strong>${esc(title)}</strong><span>${esc(text)}</span>${action ? `<button class="btn btn-secondary" type="button" data-action="${action}">${esc(label)}</button>` : ""}</div>`;
}
function head(kicker, title, desc = "", action = "", label = "") {
  return `<header class="screen-head"><div><span class="eyebrow">${esc(kicker)}</span><h1>${esc(title)}</h1>${desc ? `<p>${esc(desc)}</p>` : ""}</div>${action ? `<button class="btn btn-primary" type="button" data-action="${action}">${icon("plus", 17)}${esc(label)}</button>` : ""}</header>`;
}
function stamp(v) {
  return v?.toDate ? v.toDate().getTime() : new Date(v || 0).getTime();
}
function uidOf(x) {
  return x?.uid || x?.userId || x?.authorUid || x?.creatorUid || x?.ownerUid || "";
}
function participants(t) {
  return Array.isArray(t.participantUids) ? t.participantUids : (Array.isArray(t.participantIds) ? t.participantIds : []);
}
function peer(t) {
  const ids = participants(t);
  const pid = ids.find((x) => x !== state.user.uid) || "";
  return (t.participantProfiles || {})[pid] || t.peerProfile || {displayName: t.title || "Conversation", uid: pid};
}
function normalizedCategory(item) {
  const value = item?.categoryId || item?.category || item?.categoryName || "";
  return String(value).trim().toLowerCase();
}
function categoryMatches(item, category) {
  if (!category || category === "all") return true;
  return normalizedCategory(item) === category || normalizedCategory(item).includes(category);
}
function globalSearchBar(placeholder = "Search people, skills, products…") {
  return `<button class="global-search" type="button" data-action="route-search"><span>${icon("search", 18)}</span><span class="search-placeholder">${esc(placeholder)}</span><kbd>/</kbd></button>`;
}

function searchResultCard(item) {
  const p = item?.result || item || {};
  const type = String(item?.type || "result").toLowerCase();
  if (type === "user" || type === "person") {
    const id = item?.id || p.uid || p.id || "";
    return `<article class="result compact-result">${avatar(p, "sm", false)}<div class="grow"><strong>${esc(item?.title || p.displayName || p.username || "Member")}</strong><small>${esc(item?.subTitle || (p.username ? `@${p.username}` : p.bio || "Community member"))}</small></div>${id && id !== state.user.uid ? `<button class="btn btn-secondary" type="button" data-action="message-user" data-id="${esc(id)}">Message</button>` : ""}</article>`;
  }
  return `<article class="result compact-result"><div class="result-icon">${icon(type.includes("product") ? "market" : type.includes("skill") ? "skills" : "profile", 18)}</div><div class="grow"><strong>${esc(item?.title || p.title || "Result")}</strong><small>${esc(item?.subTitle || p.description || p.bio || "")}</small></div><span class="muted">${esc(type)}</span></article>`;
}

function contextualSearch(formId, placeholder, scope, value = "") {
  return `<form id="${esc(formId)}" class="context-search"><div class="context-search-box">${icon("search", 18)}<input name="query" value="${esc(value)}" maxlength="80" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" autocomplete="off"><button type="submit" aria-label="Search">${icon("arrow", 18)}</button></div><input type="hidden" name="scope" value="${esc(scope)}"></form>`;
}

async function loadProfile() {
  await api.ensureUserProfile();
  const s = await getDoc(doc(db, "users", state.user.uid));
  state.profile = s.exists() ? {uid: state.user.uid, ...s.data()} : {uid: state.user.uid, email: state.user.email || ""};
  const f = state.profile.followingUids || state.profile.followingIds || state.profile.following || [];
  state.followingIds = Array.isArray(f) ? f.map(String) : [];
}

async function loadHome() {
  const [ps, ms] = await Promise.all([
    getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20))),
    getDocs(query(collection(db, "moments"), orderBy("createdAt", "desc"), limit(40)))
  ]);
  state.posts = ps.docs.map((d) => ({id: d.id, ...d.data()}));
  const now = Date.now();
  const active = ms.docs.map((d) => ({id: d.id, ...d.data()})).filter((x) => !x.expiresAt || stamp(x.expiresAt) > now);
  const own = active.filter((x) => uidOf(x) === state.user.uid || x.uid === state.user.uid)
      .sort((a, b) => stamp(b.createdAt) - stamp(a.createdAt)).slice(0, 1);
  const followed = state.followingIds.length ? active.filter((x) => state.followingIds.includes(String(uidOf(x))) || state.followingIds.includes(String(x.uid)))
      .sort((a, b) => stamp(b.createdAt) - stamp(a.createdAt)).slice(0, 12) : [];
  state.moments = [...own, ...followed.filter((x) => !own.some((o) => o.id === x.id))];

  const mediaJobs = state.posts
      .filter((post) => Array.isArray(post.mediaIds) && post.mediaIds.length)
      .slice(0, 20)
      .map(async (post) => {
        try {
          post.mediaUrls = await readPostMedia(post.id, post.mediaIds);
        } catch {
          post.mediaUrls = [];
        }
      });
  await Promise.all(mediaJobs);
}

async function loadThreads() {
  let s;
  try {
    s = await getDocs(query(collection(db, "chatThreads"), where("participantIds", "array-contains", state.user.uid), limit(50)));
  } catch {
    s = await getDocs(query(collection(db, "chatThreads"), where("participantUids", "array-contains", state.user.uid), limit(50)));
  }
  state.threads = s.docs.map((d) => ({id: d.id, ...d.data()}))
      .sort((a, b) => stamp(b.updatedAt || b.lastMessageAt || b.lastMessageAt) - stamp(a.updatedAt || a.lastMessageAt || a.updatedAt));
}

async function loadMessages(id) {
  clearSubscriptions();
  const u = onSnapshot(query(collection(db, "chatThreads", id, "messages"), orderBy("createdAt", "asc"), limit(100)), (s) => {
    state.messages = s.docs.map((d) => ({id: d.id, ...d.data()}));
    paint();
  });
  addSubscription(u);
  try { await api.markThreadRead({threadId: id}); } catch {}
}
async function loadSkills() {
  const s = await getDocs(query(collection(db, "skillListings"), where("status", "==", "active"), limit(40)));
  state.skills = s.docs.map((d) => ({id: d.id, ...d.data()}));
}
async function loadMarket() {
  const r = await api.discoverMarketProducts({query: state.searchQuery || "", scope: "all"});
  state.products = Array.isArray(r?.results) ? r.results : [];
}
async function loadNotifications() {
  try {
    const s = await getDocs(query(collection(db, "notifications"), where("recipientUid", "==", state.user.uid), limit(40)));
    state.notifications = s.docs.map((d) => ({id: d.id, ...d.data()})).sort((a, b) => stamp(b.createdAt) - stamp(a.createdAt));
    state.unreadNotifications = state.notifications.filter((n) => !n.read && !n.isRead && !n.readAt).length;
  } catch {
    state.notifications = [];
    try { const r = await api.getMyNotificationSummary(); state.unreadNotifications = Number(r?.unreadCount || 0); } catch { state.unreadNotifications = 0; }
  }
}

function momentCard(m, own = false) {
  const label = own ? "Your Moment" : (m.author?.displayName || m.displayName || m.username || "Following");
  return `<button class="moment-card ${own ? "own" : ""}" type="button" data-action="view-moment" data-id="${esc(m.id)}">
    <div class="moment-ring"><div class="moment-avatar">${avatar(m.author || m, "md", false)}</div>${own ? `<span class="moment-plus">${icon("plus", 12)}</span>` : ""}</div>
    <span class="moment-label">${esc(label)}</span></button>`;
}

function renderHome() {
  const displayName = state.profile?.displayName || state.user?.displayName || "there";
  const own = state.moments.find((m) => uidOf(m) === state.user.uid || m.uid === state.user.uid);
  const following = state.moments.filter((m) => m.id !== own?.id);
  const mediaMarkup = (p) => {
    const urls = Array.isArray(p.mediaUrls) ? p.mediaUrls : [];
    if (!urls.length) {
      return Array.isArray(p.mediaIds) && p.mediaIds.length
        ? `<div class="media-placeholder">${icon("camera", 17)}<span>Loading secure media…</span></div>`
        : "";
    }
    return `<div class="post-media-grid count-${Math.min(urls.length, 10)}">${urls.map((m, index) => {
      const isVideo = m.mediaType === "video" || String(m.contentType || "").startsWith("video/");
      return `<figure class="post-media-item ${isVideo ? "is-video" : ""}">${isVideo ? `<video src="${esc(m.url)}" controls preload="metadata" playsinline></video>` : `<img src="${esc(m.url)}" alt="Media shared by ${esc(p.author?.displayName || p.displayName || "a community member")}" loading="lazy" decoding="async">`}${index === 3 && urls.length > 4 ? `<span class="media-more">+${urls.length - 4}</span>` : ""}</figure>`;
    }).join("")}</div>`;
  };
  const post = (p) => `<article class="post-card modern-post" id="post-${esc(p.id)}">
    <header class="post-head">${avatar(p.author || p, "md", false)}<div class="grow"><strong>${esc(p.author?.displayName || p.displayName || "Community member")}</strong><span>${esc(p.author?.username ? `@${p.author.username}` : "Community")} · ${when(p.createdAt)}</span></div>${uidOf(p) === state.user.uid ? `<button class="icon-btn" type="button" data-action="post-menu" data-id="${esc(p.id)}" aria-label="Post options">${icon("menuDots", 19)}</button>` : ""}</header>
    <div class="post-body">${p.text ? `<p>${esc(p.text)}</p>` : ""}${mediaMarkup(p)}</div>
    <footer class="post-actions"><button type="button" data-action="like-post" data-id="${esc(p.id)}">${icon("heart", 18)}<span>${Number(p.reactionCount || 0) || "Like"}</span></button><button type="button" data-action="comment-post" data-id="${esc(p.id)}">${icon("comment", 18)}<span>${Number(p.commentCount || 0) || "Comment"}</span></button><button type="button" data-action="save-post" data-id="${esc(p.id)}">${icon("bookmark", 18)}<span>${Number(p.saveCount || 0) || "Save"}</span></button><button type="button" data-action="share-post" data-id="${esc(p.id)}">${icon("arrow", 18)}<span>Share</span></button></footer>
  </article>`;
  return `<section class="screen home-screen">
    <section class="home-header-row"><div><span class="eyebrow">HOME</span><h1>Community</h1><p>Moments, conversations and posts from your world.</p></div><button class="btn btn-primary home-header-create" type="button" data-action="create-menu">${icon("plus", 17)}Create</button></section>
    ${contextualSearch("home-search-form", "Search people, posts, skills, or shops…", "all", state.searchQuery)}
    ${state.homeSearchResults.length ? `<section class="inline-results"><div class="section-head compact"><div><span class="eyebrow">SEARCH</span><h2>Matches</h2></div><button class="text-button" type="button" data-action="clear-home-search">Clear</button></div><div class="results">${state.homeSearchResults.slice(0, 8).map(searchResultCard).join("")}</div></section>` : ""}
    <section class="surface-card moments-panel instagram-moments"><div class="section-head compact"><div><span class="eyebrow">MOMENTS</span><h2>Stories</h2></div><button class="text-button" type="button" data-action="create-moment">Add</button></div>
      <div class="moments-row">${own ? `<button class="moment-card own" type="button" data-action="create-moment"><div class="moment-ring add-ring">${avatar(state.profile || state.user, "md", false)}<span class="add-badge">${icon("plus", 13)}</span></div><span class="moment-label">Add story</span></button>` : `<button class="moment-card own" type="button" data-action="create-moment"><div class="moment-ring add-ring">${avatar(state.profile || state.user, "md", false)}<span class="add-badge">${icon("plus", 13)}</span></div><span class="moment-label">Add story</span></button>`}${following.map((m) => momentCard(m)).join("")}</div>
    </section>
    <section class="surface-card compose-card compact-compose social-compose"><div>${avatar(state.profile || state.user, "sm", false)}</div><button class="compose-trigger" type="button" data-action="create-post">What are you thinking, ${esc(displayName.split(" ")[0] || "friend")}?</button><button class="compose-camera" type="button" data-action="create-post" aria-label="Create photo or video post">${icon("camera", 18)}</button></section>
    <section class="section feed-section"><div class="section-head compact"><div><span class="eyebrow">COMMUNITY FEED</span><h2>Latest posts</h2></div></div>${state.posts.length ? state.posts.map(post).join("") : emptyState("Your feed is quiet", "Your community updates will appear here.", "create-post", "Create a post")}</section>
    <button class="home-create-fab" type="button" data-action="create-menu" aria-label="Create post or Moment">${icon("plus", 22)}</button>
  </section>`;
}

function renderChat() {
  if (state.activeThreadId) {
    const t = state.threads.find((x) => x.id === state.activeThreadId) || {};
    const p = peer(t);
    return `<section class="screen conversation"><header class="conversation-head"><button class="icon-btn" type="button" data-action="close-thread" aria-label="Back">${icon("back")}</button>${avatar(p, "sm", false)}<div class="grow"><strong>${esc(p.displayName || p.username || t.title || "Conversation")}</strong><span>${esc(p.username ? `@${p.username}` : "Private conversation")}</span></div></header>
      <div class="messages">${state.messages.length ? state.messages.map((m) => `<div class="message-row ${m.senderUid === state.user.uid ? "own" : ""}"><div class="bubble"><div>${esc(m.text || "")}</div><small>${when(m.createdAt)}</small></div></div>`).join("") : emptyState("Start the conversation", "Send a message to begin.")}</div>
      <form id="message-form" class="composer"><textarea name="text" rows="1" maxlength="5000" placeholder="Write a message…" required></textarea><button type="submit" aria-label="Send">${icon("send", 20)}</button></form></section>`;
  }
  const thread = (t) => { const p = peer(t); return `<button class="thread" type="button" data-action="open-thread" data-id="${esc(t.id)}">${avatar(p, "md", false)}<span class="thread-copy"><strong>${esc(p.displayName || p.username || t.title || "Conversation")}</strong><small>${esc(t.lastMessage || t.lastMessageText || "No messages yet")}</small></span><span class="thread-meta">${when(t.updatedAt || t.lastMessageAt)}</span></button>`; };
  return `<section class="screen">${head("CONVERSATIONS", "Chat", "Private conversations with people you choose.")}
    ${contextualSearch("chat-person-search-form", "Find a person by name or username…", "users", state.chatSearchQuery)}
    ${state.chatSearchResults.length ? `<section class="inline-results"><div class="section-head compact"><div><span class="eyebrow">PEOPLE</span><h2>Search results</h2></div><button class="text-button" type="button" data-action="clear-chat-search">Clear</button></div><div class="results">${state.chatSearchResults.slice(0, 8).map(searchResultCard).join("")}</div></section>` : ""}
    <div class="threads">${state.threads.length ? state.threads.map(thread).join("") : emptyState("No conversations yet", "Search for a person above to start a conversation.")}</div>
  </section>`;
}

function categoryChips(kind, selected) {
  const list = kind === "market" ? MARKET_CATEGORIES : SKILL_CATEGORIES;
  return `<div class="category-row" role="list">${list.map(([id, label]) => `<button class="category-chip ${selected === id ? "active" : ""}" type="button" data-action="${kind}-category" data-category="${id}">${icon(kind === "market" ? "market" : "skills", 15)}${esc(label)}</button>`).join("")}</div>`;
}

function renderSkills() {
  const q = state.skillsSearchQuery.trim().toLowerCase();
  const filtered = state.skills.filter((s) => {
    if (!categoryMatches(s, state.skillCategory || "all")) return false;
    if (!q) return true;
    const hay = [s.title, s.description, s.category, ...(Array.isArray(s.tags) ? s.tags : [])].join(" ").toLowerCase();
    return hay.includes(q);
  });
  const card = (s) => `<article class="listing-card"><div class="listing-icon">${icon("skills", 20)}</div><div class="grow"><span class="eyebrow">SERVICE</span><h3>${esc(s.title || "Skill listing")}</h3><p>${esc(s.description || "")}</p><div class="tags">${(s.tags || []).slice(0, 4).map((t) => `<span>${esc(t)}</span>`).join("")}</div></div><button class="btn btn-secondary" type="button" data-action="skill-view" data-id="${esc(s.id)}">View</button></article>`;
  return `<section class="screen">${head("OPPORTUNITY", "Marvel Skills", "Discover people who can help, teach, design, build, write, and more.")}${contextualSearch("skills-search-form", "Search services and providers…", "skills", state.skillsSearchQuery)}
    <section class="path-grid"><button class="path-card" type="button" data-action="route-skill-onboarding"><span class="path-icon">${icon("spark", 20)}</span><strong>Offer your skills</strong><span>Create a professional service identity.</span>${icon("arrow", 18)}</button><button class="path-card" type="button" data-action="route-skill-profile"><span class="path-icon">${icon("profile", 20)}</span><strong>My Skills</strong><span>Manage your professional profile and listings.</span>${icon("arrow", 18)}</button></section>
    <section class="section"><div class="section-head compact"><div><span class="eyebrow">CATEGORIES</span><h2>Explore skills</h2></div></div>${categoryChips("skills", state.skillCategory || "all")}</section>
    <section class="section"><div class="listing-grid">${filtered.length ? filtered.map(card).join("") : emptyState("No services here yet", "Try another category or search when new listings are available.")}</div></section>
  </section>`;
}

function renderSkillProfile() {
  const d = state.skillDraft;
  const count = state.skills.filter((s) => uidOf(s) === state.user.uid).length;
  return `<section class="screen">${head("MY SKILLS", "My Skills", "Your professional identity and service presence.", "route-skill-onboarding", d.title ? "Edit profile" : "Get started")}
    <div class="workspace-card featured"><div class="workspace-icon">${icon("skills", 22)}</div><div class="grow"><span class="eyebrow">PROFESSIONAL PROFILE</span><h2>${esc(d.title || "Build your professional identity")}</h2><p>${esc(d.bio || "Tell people what you do, what you are good at, and how you can help.")}</p></div></div>
    <div class="workspace-grid"><article><span class="eyebrow">ACTIVE LISTINGS</span><h3>${count}</h3><p>Published services connected to this profile.</p></article><article><span class="eyebrow">CATEGORY</span><h3>${esc(d.category || "—")}</h3><p>Primary service category.</p></article></div>
  </section>`;
}

function renderMarket() {
  const filtered = state.products.filter((x) => categoryMatches(x.result || x, state.marketCategory || "all"));
  const card = (i) => { const p = i.result || i; const price = Number.isInteger(p.priceMinor) ? `${esc(p.currency || "NGN")} ${(p.priceMinor / 100).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : "Price set by seller"; return `<article class="product-card" data-action="market-view" data-id="${esc(i.id || p.id || "")}" tabindex="0"><div class="product-cover"><div class="product-cover-icon">${icon("market", 24)}</div></div><div class="product-info"><span class="eyebrow">PRODUCT</span><h3>${esc(p.title || i.title || "Product")}</h3><p>${esc(p.subTitle || p.description || "")}</p><strong>${price}</strong></div></article>`; };
  return `<section class="screen">${head("COMMERCE", "Marvel Market", "Discover products and local businesses.")}
    <section class="section"><div class="section-head compact"><div><span class="eyebrow">CATEGORIES</span><h2>Browse categories</h2></div></div>${categoryChips("market", state.marketCategory || "all")}</section>
    <form id="market-form" class="context-search"><div class="context-search-box">${icon("search", 18)}<input name="query" value="${esc(state.searchQuery)}" placeholder="Search products and shops…" aria-label="Search products and shops" autocomplete="off"><button type="submit" aria-label="Search">${icon("arrow", 18)}</button></div></form>
    <section class="section"><div class="section-head compact"><div><span class="eyebrow">DISCOVERY</span><h2>Featured products</h2></div></div><div class="product-grid">${filtered.length ? filtered.map(card).join("") : emptyState("Nothing to show yet", "Try another category or search phrase.")}</div></section>
  </section>`;
}

function renderBusiness() {
  const d = state.sellerDraft;
  return `<section class="screen">${head("MY BUSINESS", "My Business", "Your private workspace for building and managing a shop.", "route-seller-onboarding", d.name ? "Edit shop setup" : "Start a shop")}
    <div class="business-hero"><div class="business-symbol">${icon("shop", 25)}</div><div><span class="eyebrow">YOUR STOREFRONT</span><h2>${esc(d.name || "Your storefront")}</h2><p>${esc(d.description || "Create your shop profile, then add products and manage your marketplace activity.")}</p></div></div>
    <div class="business-grid"><article class="workspace-card"><div class="workspace-icon">${icon("shop", 20)}</div><h3>Store profile</h3><p>Business identity, description, category, and location.</p><button class="btn btn-secondary" type="button" data-action="route-seller-onboarding">Open setup</button></article>
    <article class="workspace-card"><div class="workspace-icon">${icon("grid", 20)}</div><h3>Products</h3><p>Your catalogue workspace will use the live seller tools.</p></article>
    <article class="workspace-card"><div class="workspace-icon">${icon("settings", 20)}</div><h3>Inventory</h3><p>Keep stock and availability accurate across your catalogue.</p></article>
    <article class="workspace-card"><div class="workspace-icon">${icon("bell", 20)}</div><h3>Commerce requests</h3><p>Review customer requests and supported commerce states.</p></article></div>
  </section>`;
}

function renderSellerOnboarding() {
  const step = state.sellerOnboardingStep, d = state.sellerDraft;
  const steps = ["Welcome", "How it works", "Seller standards", "Agreement", "Business setup"];
  const pages = [
    ["Build your storefront", "Create a clear business presence for customers who discover your products.", "shop"],
    ["How selling works", "Create your shop, publish products, keep inventory accurate, receive customer requests, and complete supported order workflows.", "grid"],
    ["Seller standards", "Accurate product information, clear pricing, honest availability, and responsible customer service help create a trusted marketplace.", "shield"],
    ["Our agreement", "Before a shop is created, sellers accept the marketplace responsibilities and community standards that apply to their activity.", "file"],
    ["Business details", "Add the basic information that forms your public shop identity.", "edit"]
  ];
  const p = pages[step];
  return `<section class="screen onboarding-screen"><div class="onboarding-shell"><div class="stepper">${steps.map((x, i) => `<span class="step-dot ${i <= step ? "active" : ""}">${i < step ? icon("check", 13) : i + 1}</span>${i < steps.length - 1 ? `<i class="step-line ${i < step ? "active" : ""}"></i>` : ""}`).join("")}</div>
    <div class="onboarding-card"><div class="onboarding-icon">${icon(p[2], 26)}</div><span class="eyebrow">${esc(steps[step])}</span><h1>${esc(p[0])}</h1><p class="onboarding-copy">${esc(p[1])}</p>
    ${step === 3 ? `<label class="agree-row large"><input type="checkbox" id="seller-agreement" ${d.agreed ? "checked" : ""}><span>I have read and agree to the seller standards and marketplace responsibilities.</span></label>` : ""}
    ${step === 4 ? `<form id="seller-details-form" class="form-stack compact-form"><label class="floating-field"><input name="name" value="${esc(d.name || "")}" maxlength="120" required><span>Business name</span></label><label class="floating-field"><textarea name="description" maxlength="500" required>${esc(d.description || "")}</textarea><span>Short description</span></label><label class="floating-field"><input name="categoryId" value="${esc(d.categoryId || "")}" maxlength="120"><span>Business category</span></label><label class="floating-field"><input name="location" value="${esc(d.location || "")}" maxlength="120"><span>Business location</span></label></form>` : ""}
    <div class="onboarding-actions"><button class="btn btn-secondary" type="button" data-action="onboarding-back" ${step === 0 ? "disabled" : ""}>Back</button><button class="btn btn-primary" type="button" data-action="onboarding-next">${step === 4 ? "Save setup" : "Continue"}</button></div></div><button class="text-button" type="button" data-action="route-business">Exit setup</button></div></section>`;
}

function renderSkillOnboarding() {
  const step = state.skillOnboardingStep, d = state.skillDraft, steps = ["Profile", "Strengths", "Service", "Review"];
  const page = [["Build your skill profile", "Create a professional identity that tells people what you do.", "profile"], ["Show your strengths", "Describe the experience and strengths that help the right people choose you.", "spark"], ["Define your service", "Choose a category and write a concise service description.", "skills"], ["Review before publishing", "Review your details before connecting the profile to the provider workflow.", "check"]][step];
  const form = step === 3 ? `<div class="review-card"><strong>${esc(d.title || "Your professional profile")}</strong><p>${esc(d.bio || "No strengths description yet.")}</p><span>${esc(d.category || "No category selected")}</span></div>` : `<form id="skill-details-form" class="form-stack compact-form">${step === 0 ? `<label class="floating-field"><input name="title" value="${esc(d.title || "")}" maxlength="120" required><span>Professional title</span></label>` : ""}${step === 1 ? `<label class="floating-field"><textarea name="bio" maxlength="500" required>${esc(d.bio || "")}</textarea><span>About your strengths</span></label>` : ""}${step === 2 ? `<label class="floating-field"><input name="category" value="${esc(d.category || "")}" maxlength="120" required><span>Primary service category</span></label><label class="floating-field"><textarea name="listingDescription" maxlength="500" required>${esc(d.listingDescription || "")}</textarea><span>Service description</span></label>` : ""}</form>`;
  return `<section class="screen onboarding-screen"><div class="onboarding-shell"><div class="stepper">${steps.map((x, i) => `<span class="step-dot ${i <= step ? "active" : ""}">${i < step ? icon("check", 13) : i + 1}</span>${i < steps.length - 1 ? `<i class="step-line ${i < step ? "active" : ""}"></i>` : ""}`).join("")}</div><div class="onboarding-card"><div class="onboarding-icon">${icon(page[2], 26)}</div><span class="eyebrow">${esc(steps[step])}</span><h1>${esc(page[0])}</h1><p class="onboarding-copy">${esc(page[1])}</p>${form}<div class="onboarding-actions"><button class="btn btn-secondary" type="button" data-action="skill-onboarding-back" ${step === 0 ? "disabled" : ""}>Back</button><button class="btn btn-primary" type="button" data-action="skill-onboarding-next">${step === 3 ? "Save profile" : "Continue"}</button></div></div><button class="text-button" type="button" data-action="route-skill-profile">Exit setup</button></div></section>`;
}

function renderProfile() {
  const p = state.profile || {};
  const posts = p.postsCount ?? p.postCount ?? 0;
  const followers = p.followersCount ?? (Array.isArray(p.followerUids) ? p.followerUids.length : 0);
  const following = p.followingCount ?? (Array.isArray(state.followingIds) ? state.followingIds.length : 0);
  return `<section class="screen">${head("YOUR SPACE", "Profile", "Your identity, skills, business, and account controls.", "edit-profile", "Edit profile")}
    <div class="profile-hero">${avatar(p, "xl", false)}<div class="profile-main"><h1>${esc(p.displayName || "Your profile")}</h1><p class="handle">${esc(p.username ? `@${p.username}` : p.email || "")}</p><p class="bio">${esc(p.bio || "")}</p></div></div>
    <div class="profile-stats"><div><strong>${esc(posts)}</strong><span>Posts</span></div><div><strong>${esc(followers)}</strong><span>Followers</span></div><div><strong>${esc(following)}</strong><span>Following</span></div></div>
    <div class="profile-grid"><button class="profile-tile" type="button" data-action="route-skill-profile"><span class="tile-icon">${icon("skills", 20)}</span><strong>My Skills</strong><small>Build and manage your professional identity.</small>${icon("arrow", 17)}</button><button class="profile-tile" type="button" data-action="route-business"><span class="tile-icon">${icon("shop", 20)}</span><strong>My Business</strong><small>Create or manage your marketplace presence.</small>${icon("arrow", 17)}</button><button class="profile-tile" type="button" data-action="route-settings"><span class="tile-icon">${icon("settings", 20)}</span><strong>Settings</strong><small>Appearance, privacy, and preferences.</small>${icon("arrow", 17)}</button></div>
    <div class="profile-footer-actions"><button class="btn btn-secondary" type="button" data-action="sign-out">${icon("logout", 17)}Sign out</button></div>
  </section>`;
}

function renderSearch() {
  const r = (i) => { const p = i.result || i; if (i.type === "user") return `<article class="result">${avatar(p, "md", false)}<div class="grow"><strong>${esc(p.title || p.displayName || "Member")}</strong><small>${esc(p.subTitle || (p.username ? `@${p.username}` : p.bio || "Community member"))}</small></div><button class="btn btn-secondary" type="button" data-action="message-user" data-id="${esc(i.id || p.uid || p.id)}">Message</button></article>`; return `<article class="result"><div class="result-icon">${icon(i.type === "product" ? "market" : i.type?.includes("skill") ? "skills" : "profile", 19)}</div><div class="grow"><strong>${esc(p.title || i.type || "Result")}</strong><small>${esc(p.subTitle || p.description || "")}</small></div><span class="muted">${esc(i.type || "result")}</span></article>`; };
  return `<section class="screen">${head("DISCOVERY", "Search", "Find people, services, products, and more.")}<form id="search-form" class="search-form discovery-search"><div class="search-box">${icon("search", 18)}<input name="query" minlength="2" maxlength="80" value="${esc(state.searchQuery)}" placeholder="Search people, skills, shops, or products" required autofocus></div><select name="scope"><option value="all" ${state.searchScope === "all" ? "selected" : ""}>Everything</option><option value="users" ${state.searchScope === "users" ? "selected" : ""}>People</option><option value="skills" ${state.searchScope === "skills" ? "selected" : ""}>Skills</option><option value="market" ${state.searchScope === "market" ? "selected" : ""}>Market</option></select><button class="btn btn-primary" type="submit">Search</button></form><div class="results">${state.searchResults.length ? state.searchResults.map(r).join("") : emptyState("Search when you are ready", "Results appear here as you search the live discovery service.")}</div></section>`;
}
function renderNotifications() { return `<section class="screen">${head("UPDATES", "Notifications", state.unreadNotifications ? `${state.unreadNotifications} unread` : "You are all caught up.")}<div>${state.notifications.length ? state.notifications.map((n) => `<article class="notification ${n.read || n.isRead || n.readAt ? "" : "unread"}"><div class="notification-icon">${icon("bell", 18)}</div><div class="grow"><strong>${esc(n.title || "Marvel Chat")}</strong><p>${esc(n.body || "")}</p><small>${when(n.createdAt)}</small></div>${!(n.read || n.isRead || n.readAt) ? `<button class="text-button" type="button" data-action="read-notification" data-id="${esc(n.id)}">Mark read</button>` : ""}</article>`).join("") : emptyState("No new notifications", "Activity updates will appear here.")}</div></section>`; }
function renderSettings() {
  const pushSupported = "Notification" in window && "serviceWorker" in navigator;
  const pushState = !pushSupported ? "Not supported" : Notification.permission === "granted" ? "Enabled" : Notification.permission === "denied" ? "Blocked in browser" : "Not enabled";
  return `<section class="screen">${head("PREFERENCES", "Settings", "Choose how Marvel Chat looks and behaves on this device.")}<div class="settings-list">
    <article class="setting-card"><div class="setting-copy"><strong>Appearance</strong><small>Choose the theme used across the application.</small></div><div class="theme-pills">${["light", "dark", "system"].map((x) => `<button class="${state.theme === x ? "active" : ""}" type="button" data-action="theme-${x}">${icon(x === "light" ? "sun" : x === "dark" ? "moon" : "system", 16)}${x[0].toUpperCase() + x.slice(1)}</button>`).join("")}</div></article>
    <article class="setting-card"><div class="setting-copy"><strong>Browser notifications</strong><small>Receive supported alerts from Marvel Chat on this device. Status: ${esc(pushState)}</small></div><button class="btn btn-secondary" type="button" data-action="enable-browser-notifications" ${!pushSupported || pushState === "Blocked in browser" ? "disabled" : ""}>${pushState === "Enabled" ? "Refresh" : "Enable"}</button></article>
    <button class="setting-card setting-link" type="button" data-action="legal-terms"><div class="setting-copy"><strong>Terms</strong><small>Review our service terms.</small></div>${icon("arrow", 18)}</button>
    <button class="setting-card setting-link" type="button" data-action="legal-privacy"><div class="setting-copy"><strong>Privacy</strong><small>Learn how account and activity data are handled.</small></div>${icon("arrow", 18)}</button>
    <button class="setting-card setting-link" type="button" data-action="legal-community"><div class="setting-copy"><strong>Community Guidelines</strong><small>Our standards for a useful and trustworthy community.</small></div>${icon("arrow", 18)}</button>
  </div></section>`;
}

function legalBody(type) {
  const data = {
    terms: [
      ["Purpose and acceptance", "These Terms explain the conditions that apply when using Marvel Chat and its communication, community, skills, and marketplace features. By creating or using an account, members agree to follow these terms and the linked community standards."],
      ["Eligibility", "Members are responsible for ensuring that they are legally able to use the service in their location. Where a feature has additional eligibility requirements, those requirements may apply before that feature can be used."],
      ["Account information", "Account details should be accurate and kept current. Members are responsible for maintaining control of their sign-in credentials and for promptly addressing suspicious access."],
      ["Identity and usernames", "A username or display name must not be used to impersonate another person, mislead other members, or deliberately create confusion about ownership or affiliation."],
      ["Community participation", "Marvel Chat is designed for constructive communication. Members should communicate respectfully, avoid harassment, and use features for their intended purposes."],
      ["Content responsibility", "Members remain responsible for content they publish or send. Content should respect applicable law, the rights of others, and the platform's Community Guidelines."],
      ["Private communication", "Chat is designed for private conversations between members selected by the participants. Members should use reasonable care when sharing sensitive information with other people."],
      ["Messaging boundaries", "Members should not use automated or deceptive methods to send unwanted messages, abuse communication features, or deliberately overwhelm another member's experience."],
      ["Marvel Skills", "Skills listings describe services offered by independent providers. Providers are responsible for the accuracy of their profiles, qualifications, descriptions, availability, and service commitments."],
      ["Marvel Market", "Marketplace listings describe products and shops offered by sellers. Sellers are responsible for accurate product information, availability, lawful activity, and fulfillment of accepted commerce requests."],
      ["Pricing and commerce", "Where marketplace transactions are supported, authoritative product and request values are determined by platform and seller records rather than by untrusted browser input."],
      ["Third-party interactions", "Members may interact with independent sellers, providers, and other community members. Marvel Chat provides the platform experience but does not turn every member into an employee, agent, or representative of Davonium Technologies."],
      ["Prohibited misuse", "Members may not attempt to bypass access controls, interfere with platform operations, reverse engineer protected systems, harvest private information, or abuse vulnerabilities."],
      ["Security controls", "Technical safeguards may include authentication, access controls, application integrity checks, rate limits, server-side validation, and other measures intended to protect the service."],
      ["Service availability", "Features may change, become temporarily unavailable, or be limited as systems are maintained, improved, protected, or repaired. The platform does not promise that every feature will always be available."],
      ["Intellectual property", "Marvel Chat and its branding, interface, software, and original service materials are owned by or licensed to Davonium Technologies or their respective rights holders. Members retain rights in content they lawfully own."],
      ["Feedback", "Suggestions and product feedback may be used to improve the service. Feedback should not include confidential information that a member does not want to share."],
      ["Enforcement", "Where activity violates these Terms, Community Guidelines, or applicable law, appropriate actions may include content restrictions, feature limitations, suspension, account closure, or referral to relevant authorities where required."],
      ["Changes to these Terms", "We may update these Terms as the product, legal requirements, or operating practices change. Material updates should be communicated through appropriate product or website notices."],
      ["Contact and governing information", "Questions about these Terms or the service can be directed through the official contact channels published by Davonium Technologies. Any governing-law provisions should be read together with applicable local law."],
      ["Effective date", "These Terms are presented for Marvel Chat and may be updated before public launch or as the service evolves. The latest published version should be treated as the current version."],
    ],
    privacy: [
      ["Overview", "This Privacy Policy explains the categories of information Marvel Chat may process to provide accounts, communication, community, skills, marketplace, notification, and security features."],
      ["Account information", "Account creation and sign-in may involve an email address, authentication provider information, and account identifiers needed to maintain a member account."],
      ["Profile information", "Members may provide display names, usernames, biographies, profile images, locations, skills, and other information chosen for their profile or business presence."],
      ["Content and interactions", "We may process posts, comments, reactions, saves, Moments, messages, service listings, product listings, commerce requests, reviews, and related activity needed to operate the corresponding features."],
      ["Messages", "Private messages are processed so that authorized participants can send, receive, and retrieve their conversations. Access controls are used to limit private conversation data to appropriate participants."],
      ["Moments and community content", "Moments and posts are processed according to their visibility and platform rules. Temporary Moment content may be subject to expiration and lifecycle handling."],
      ["Skills information", "Provider information may include professional descriptions, categories, listings, requests, offers, completion information, and reviews associated with Skills workflows."],
      ["Marketplace information", "Seller and marketplace information may include store details, product descriptions, inventory and availability states, commerce requests, and product reviews."],
      ["Device and notification information", "When notification features are enabled, device and browser information and notification tokens may be processed so that supported notifications can be delivered and managed."],
      ["Technical information", "The service may process technical information such as timestamps, authentication status, request context, browser details, and security signals required to operate and protect the service."],
      ["How information is used", "We use information to provide requested features, maintain accounts, support communication, personalize product experiences, operate marketplace and Skills workflows, deliver notifications, and protect the service."],
      ["Security and fraud prevention", "Information may be processed to identify abusive activity, protect accounts, enforce platform rules, investigate security incidents, and reduce misuse."],
      ["Service providers", "We may use trusted infrastructure and service providers to host, secure, deliver, or support the service. Access is limited to what is reasonably necessary for the applicable purpose."],
      ["Firebase services", "Authentication, Firestore, Cloud Functions, and related Firebase infrastructure may process information as part of providing Marvel Chat. Their processing is also subject to their own terms and privacy documentation."],
      ["Media infrastructure", "Where supported, media files may be transferred through the platform's secured media workflow and storage infrastructure. The browser should not receive server credentials or private storage secrets."],
      ["Data retention", "We retain information for as long as reasonably needed for the purpose for which it was collected, to operate features, meet legitimate business needs, resolve disputes, protect the service, or comply with applicable obligations."],
      ["Account deletion", "Where account deletion is available, members may request deletion through the supported account process. Certain records may need to be retained for security, legal, fraud-prevention, dispute, or transaction purposes."],
      ["Public information", "Information intentionally published in public areas may be visible to other members or visitors, depending on the feature and its visibility settings. Members should avoid publishing information they want kept private."],
      ["Children and age-sensitive use", "Marvel Chat is not intended to encourage unlawful or unsafe use by people who are not eligible under applicable rules. Additional age controls may apply as the service evolves."],
      ["International access", "Marvel Chat may be accessed from different countries. Information may therefore be processed in locations used by our infrastructure and service providers, subject to applicable requirements."],
      ["Policy changes", "We may update this Privacy Policy when the service, infrastructure, or legal requirements change. The latest published version should be reviewed periodically."],
      ["Contact", "Privacy questions and requests can be sent through the official support or contact channels published by Davonium Technologies."],
      ["Effective date", "This policy is the current product-facing privacy explanation for Marvel Chat and may be revised before or during public operation as the service matures."],
    ],
    community: [
      ["Our purpose", "Marvel Chat is built to help people communicate, discover useful skills, participate in community, and explore commerce. Community standards help keep those experiences useful and safe."],
      ["Be respectful", "Treat other members with dignity. Disagreement is allowed; targeted harassment, intimidation, humiliation, or persistent abuse is not."],
      ["Do not impersonate", "Do not pretend to be another person, business, organization, or public representative in a way that misleads others."],
      ["Respect privacy", "Do not publish or distribute another person's private information without appropriate permission or lawful basis."],
      ["Use messages responsibly", "Do not send spam, repeated unwanted messages, scams, malicious links, or deceptive requests through Chat."],
      ["Protect accounts", "Do not request passwords, authentication codes, recovery links, or other private access information from other members."],
      ["Be accurate", "Do not deliberately publish false information about products, services, identities, transactions, or professional qualifications in order to mislead people."],
      ["Marketplace trust", "Sellers should provide clear product descriptions, truthful availability, accurate prices where applicable, and responsible communication with customers."],
      ["Skills trust", "Providers should accurately describe their skills, experience, services, availability, and expectations. Do not fabricate credentials or results."],
      ["No exploitation", "Do not use Marvel Chat to facilitate coercion, abuse, trafficking, exploitation, or other harmful activity."],
      ["No malicious activity", "Do not use the service to distribute malware, interfere with systems, exploit vulnerabilities, or deliberately disrupt platform operations."],
      ["No evasion", "Do not create or use accounts, automation, or deceptive methods for the purpose of evading restrictions or enforcement."],
      ["Content quality", "Use appropriate language and context for the audience and feature. Content that materially harms community participation may be restricted."],
      ["Intellectual property", "Do not knowingly upload or distribute content that infringes another person's rights or that you do not have permission to use."],
      ["Safety concerns", "Content or behavior that creates credible safety risks may receive urgent attention and may be restricted where appropriate."],
      ["Reports", "Members should use the platform's available reporting or support channels to flag harmful content, suspected abuse, or serious violations."],
      ["Moderation", "We may review reports and platform signals to determine whether content or behavior appears to violate these standards. Actions may depend on context and severity."],
      ["Possible actions", "Violations may result in content removal, feature limits, account restrictions, suspension, or other appropriate action. Severe matters may be escalated where required."],
      ["Appeals and review", "Where an appeal or review process is provided, members may use the available support pathway to request reconsideration of eligible enforcement decisions."],
      ["Updates", "These guidelines may evolve as the community, safety landscape, and product features change. The current published version applies to use of the service."],
      ["Good-faith participation", "Members are encouraged to use the platform in good faith, cooperate with reasonable safety measures, and help maintain a useful environment for others."],
      ["Effective date", "These Community Guidelines form part of the Marvel Chat experience and may be updated as the service evolves."],
    ]
  };
  const sections = data[type] || [];
  return `<div class="legal-content long-legal">${sections.map(([h,p], i) => `<section><div class="legal-number">${String(i + 1).padStart(2, "0")}</div><div><h3>${esc(h)}</h3><p>${esc(p)}</p></div></section>`).join("")}</div>`;
}
function openLegal(type) {
  const title = {terms: "Terms", privacy: "Privacy Policy", community: "Community Guidelines"}[type];
  modal(title, legalBody(type), `<button class="btn btn-primary" type="button" data-action="close-modal">Done</button>`, {wide: true});
}

const viewMap = {home: renderHome, chat: renderChat, skills: renderSkills, market: renderMarket, profile: renderProfile, search: renderSearch, notifications: renderNotifications, settings: renderSettings, "skill-profile": renderSkillProfile, business: renderBusiness, "seller-onboarding": renderSellerOnboarding, "skill-onboarding": renderSkillOnboarding};
function paint() {
  if (!state.user) { app.innerHTML = authScreen(); return; }
  app.innerHTML = shell((viewMap[state.route] || renderHome)());
}
async function refreshRouteData(route) {
  try {
    if (route === "home") await loadHome();
    if (route === "chat" && !state.activeThreadId) await loadThreads();
    if (route === "skills") await loadSkills();
    if (route === "market") await loadMarket();
    if (route === "notifications") await loadNotifications();
    paint();
  } catch (e) {
    toast(friendlyError(e), "error");
    paint();
  }
}
function go(route) {
  if (!routes.includes(route)) route = "home";
  clearSubscriptions();
  state.route = route;
  state.activeThreadId = null;
  state.messages = [];
  paint();
  void refreshRouteData(route);
}
async function signup(form) {
  const d = Object.fromEntries(new FormData(form));
  const cred = await createUserWithEmailAndPassword(auth, String(d.email).trim(), String(d.password));
  await updateAuthProfile(cred.user, {displayName: String(d.displayName || "").trim()});
  await api.ensureUserProfile();
  await api.updateProfile({displayName: String(d.displayName || "").trim(), username: String(d.username || "").trim().toLowerCase(), bio: ""});
}

document.addEventListener("click", async (e) => {
  const el = e.target.closest?.("[data-action]"); if (!el) return;
  const a = el.dataset.action;
  try {
    if (a === "close-modal") { closeModal(); return; }
    if (a === "open-menu") { document.querySelector(".menu-layer")?.remove(); app.insertAdjacentHTML("beforeend", sideMenu()); return; }
    if (a === "close-menu") { if (el.classList.contains("menu-layer") && e.target.closest(".side-menu")) return; document.querySelector(".menu-layer")?.remove(); return; }
    if (a.startsWith("route-")) { go(a.slice(6)); return; }
    if (a === "sign-out") { clearSubscriptions(); foregroundNotificationUnsub?.(); foregroundNotificationUnsub = null; await signOut(auth); return; }
    if (a === "create-menu") {
      modal("Create on Marvel Chat", `<div class="create-choice-grid"><button class="create-choice" type="button" data-action="create-post">${icon("camera", 22)}<strong>Post</strong><span>Share text, photos or video with the community.</span></button><button class="create-choice" type="button" data-action="create-moment">${icon("spark", 22)}<strong>Moment</strong><span>Share a quick story that lasts for 24 hours.</span></button></div>`, `<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button>`); return; }
    if (a === "auth-signup") { authMode = "signup"; paint(); return; }
    if (a === "auth-signin") { authMode = "signin"; paint(); return; }
    if (a === "auth-welcome") { authMode = "welcome"; paint(); return; }
    if (a === "forgot-password") { authMode = "forgot"; paint(); return; }
    if (a === "toggle-password") { const t = document.getElementById(el.dataset.target); if (t) t.type = t.type === "password" ? "text" : "password"; return; }
    if (a === "google-signin") { await signInWithPopup(auth, new GoogleAuthProvider()); return; }
    if (a === "legal-terms") { openLegal("terms"); return; }
    if (a === "legal-privacy") { openLegal("privacy"); return; }
    if (a === "legal-community") { openLegal("community"); return; }
    if (a === "create-post") { modal("Create a post", `<form id="post-form" class="form-stack compact-form"><label class="floating-field"><textarea name="text" maxlength="5000" placeholder=" "></textarea><span>What would you like to share?</span></label><div class="post-media-picker"><label class="photo-pick"><input id="post-media-input" name="media" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple><span>${icon("camera", 18)}<strong>Add photos or video</strong><small>Up to ${MAX_POST_MEDIA} items · each is compressed before secure upload · max 2 MiB each</small></span></label><div id="post-photo-preview" class="post-photo-preview" aria-live="polite"></div><div id="upload-status" class="upload-status" aria-live="polite"></div></div><label class="select-field"><span>Visibility</span><select name="visibility"><option value="public">Public</option><option value="followers">Followers</option><option value="private">Private</option></select></label></form>`, `<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-post">Publish</button>`); setTimeout(() => { const input = document.getElementById("post-media-input"); input?.addEventListener("change", () => { const preview = document.getElementById("post-photo-preview"); if (!preview) return; const files = Array.from(input.files || []).slice(0, MAX_POST_MEDIA); if (input.files?.length > MAX_POST_MEDIA) { toast(`Only ${MAX_POST_MEDIA} media items can be attached to one post.`, "error"); } preview.innerHTML = files.map((file) => { const url = URL.createObjectURL(file); const video = file.type.startsWith("video/"); return `<figure>${video ? `<video src="${url}" muted playsinline preload="metadata"></video>` : `<img src="${url}" alt="Selected media preview">`}<figcaption>${esc(file.name)}</figcaption></figure>`; }).join(""); }); }, 0); return; }
    if (a === "submit-post") { const form = document.getElementById("post-form"); const d = Object.fromEntries(new FormData(form)); const text = String(d.text || "").trim(); const input = document.getElementById("post-media-input"); const files = Array.from(input?.files || []).slice(0, MAX_POST_MEDIA); if (!text && !files.length) { toast("Add text, photos or a video before publishing.", "error"); return; } const status = document.getElementById("upload-status"); const publish = form?.closest?.(".modal")?.querySelector?.('[data-action="submit-post"]'); publish?.setAttribute("disabled", "true"); let mediaIds = []; try { if (files.length) { mediaIds = await uploadHomeMediaFiles(files, (message) => { if (status) status.textContent = message; }); } await api.createPost({text, mediaIds, visibility: d.visibility}); closeModal(); await refreshRouteData("home"); toast("Your post is live.", "success"); } finally { publish?.removeAttribute("disabled"); } return; }
    if (a === "create-moment") { modal("Add a Moment", `<div class="moment-choice"><button class="moment-type active" type="button" data-action="moment-type-text">${icon("file", 18)}<strong>Text</strong><span>Share a quick update.</span></button><button class="moment-type" type="button" data-action="moment-type-photo">${icon("camera", 18)}<strong>Photo</strong><span>Add one photo.</span></button><button class="moment-type" type="button" data-action="moment-type-photo-text">${icon("spark", 18)}<strong>Photo + text</strong><span>Add a visual story with a caption.</span></button></div><form id="moment-form" class="form-stack compact-form"><input type="hidden" name="contentType" value="text"><label class="floating-field"><textarea name="text" maxlength="2000" placeholder=" "></textarea><span>Add a caption or message</span></label><div id="moment-media-field"></div><div id="moment-status" class="upload-status" aria-live="polite"></div></form>`, `<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-moment">Publish</button>`); return; }
    if (a === "moment-type-text") { const f = document.getElementById("moment-form"); f.elements.contentType.value = "text"; document.querySelectorAll(".moment-type").forEach((x) => x.classList.remove("active")); el.classList.add("active"); document.getElementById("moment-media-field").innerHTML = ""; return; }
    if (a === "moment-type-photo" || a === "moment-type-photo-text") { const f = document.getElementById("moment-form"); f.elements.contentType.value = a === "moment-type-photo" ? "photo" : "photo_text"; document.querySelectorAll(".moment-type").forEach((x) => x.classList.remove("active")); el.classList.add("active"); document.getElementById("moment-media-field").innerHTML = `<div class="post-media-picker"><label class="photo-pick"><input id="moment-media-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><span>${icon("camera", 18)}<strong>Add a photo</strong><small>The photo is compressed before secure upload.</small></span></label><div id="moment-preview" class="post-photo-preview"></div></div>`; const input = document.getElementById("moment-media-input"); input?.addEventListener("change", () => { const file = input.files?.[0]; const preview = document.getElementById("moment-preview"); if (!preview || !file) return; const url = URL.createObjectURL(file); preview.innerHTML = `<figure><img src="${url}" alt="Selected Moment photo"></figure>`; }); return; }
    if (a === "submit-moment") { const form = document.getElementById("moment-form"); const d = Object.fromEntries(new FormData(form)); const text = String(d.text || "").trim(); const input = document.getElementById("moment-media-input"); const file = input?.files?.[0] || null; const status = document.getElementById("moment-status"); const publish = form?.closest?.(".modal")?.querySelector?.('[data-action="submit-moment"]'); publish?.setAttribute("disabled", "true"); try { let mediaId = null; if (d.contentType !== "text" && !file) { toast("Choose a photo for this Moment.", "error"); return; } if (d.contentType === "text" && !text) { toast("Write something for your Moment.", "error"); return; } if (file) { mediaId = await uploadMomentMedia(file, (message) => { if (status) status.textContent = message; }); } await api.createMoment({contentType: d.contentType || "text", text, mediaId}); closeModal(); await refreshRouteData("home"); toast("Your Moment is live.", "success"); } finally { publish?.removeAttribute("disabled"); } return; }
    if (a === "like-post") { await api.reactToPost({postId: el.dataset.id, type: "like"}); await refreshRouteData("home"); return; }
    if (a === "save-post") { await api.savePost({postId: el.dataset.id}); toast("Saved to your account.", "success"); return; }
    if (a === "share-post") { const url = `${location.origin}${location.pathname}#post-${encodeURIComponent(el.dataset.id)}`; try { await navigator.clipboard.writeText(url); toast("Post link copied.", "success"); } catch { toast("Post link ready to share.", "info"); } return; }
    if (a === "delete-post") { await api.deletePost({postId: el.dataset.id}); await refreshRouteData("home"); toast("Post removed.", "success"); return; }
    if (a === "post-menu") { modal("Post options", `<button class="quick-action" type="button" data-action="delete-post" data-id="${esc(el.dataset.id)}">${icon("trash", 18)}Delete post</button>`, `<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button>`, {narrow: true}); return; }
    if (a === "comment-post") { modal("Add a comment", `<form id="comment-form" class="form-stack compact-form"><input type="hidden" name="postId" value="${esc(el.dataset.id)}"><label class="floating-field"><textarea name="text" maxlength="1000" required></textarea><span>Your comment</span></label></form>`, `<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-comment">Comment</button>`); return; }
    if (a === "submit-comment") { const d = Object.fromEntries(new FormData(document.getElementById("comment-form"))); await api.commentOnPost({postId: d.postId, text: String(d.text || "").trim()}); closeModal(); toast("Comment added.", "success"); return; }
    if (a === "view-moment") { const m = state.moments.find((x) => x.id === el.dataset.id); if (!m) return; let mediaHtml = ""; if (m.mediaId) { try { const urls = await readMomentMedia(m.id, m.mediaId); const media = urls[0]; if (media) { mediaHtml = media.mediaType === "video" ? `<video class="moment-media-view" src="${esc(media.url)}" controls playsinline></video>` : `<img class="moment-media-view" src="${esc(media.url)}" alt="Moment shared by ${esc(m.author?.displayName || m.displayName || "community member")}">`; } } catch { mediaHtml = `<div class="media-placeholder">${icon("camera", 17)}<span>Moment media is temporarily unavailable.</span></div>`; } } modal(m.uid === state.user.uid ? "Your Moment" : "Moment", `<div class="moment-view"><div class="moment-large-avatar">${avatar(m.author || m, "xl", false)}</div><span class="eyebrow">${esc(m.contentType || "text")}</span><h3>${esc(m.author?.displayName || m.displayName || "")}</h3>${mediaHtml}${m.text ? `<p>${esc(m.text)}</p>` : ""}<small>${formatDate(m.createdAt)}</small></div>`, `<button class="btn btn-primary" type="button" data-action="close-modal">Done</button>`); return; }
    if (a === "clear-home-search") { state.searchQuery = ""; state.homeSearchResults = []; paint(); return; }
    if (a === "clear-chat-search") { state.chatSearchQuery = ""; state.chatSearchResults = []; paint(); return; }
    if (a === "new-chat") { go("chat"); setTimeout(() => document.querySelector('#chat-person-search-form input[name="query"]')?.focus(), 0); return; }
    if (a === "open-thread") { state.route = "chat"; state.activeThreadId = el.dataset.id; state.messages = []; paint(); await loadMessages(el.dataset.id); return; }
    if (a === "close-thread") { clearSubscriptions(); state.activeThreadId = null; state.messages = []; go("chat"); return; }
    if (a === "skill-view") { const s = state.skills.find((x) => x.id === el.dataset.id); if (s) modal(s.title || "Service", `<div class="detail"><p>${esc(s.description || "")}</p><div class="tags">${(s.tags || []).map((t) => `<span>${esc(t)}</span>`).join("")}</div></div>`, `<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button>`); return; }
    if (a === "market-view") { const m = state.products.find((x) => (x.id || x.result?.id) === el.dataset.id); if (m) { const p = m.result || m; modal(p.title || "Product", `<div class="detail"><div class="product-detail-icon">${icon("market", 30)}</div><p>${esc(p.description || p.subTitle || "")}</p><strong>${Number.isInteger(p.priceMinor) ? `${esc(p.currency || "NGN")} ${(p.priceMinor / 100).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : "Price set by seller"}</strong></div>`, `<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button>`); } return; }
    if (a === "edit-profile") { const p = state.profile || {}; modal("Edit profile", `<form id="profile-form" class="form-stack compact-form"><label class="floating-field"><input name="displayName" maxlength="80" value="${esc(p.displayName || "")}" required><span>Display name</span></label><label class="floating-field"><input name="username" maxlength="30" value="${esc(p.username || "")}" required><span>Username</span></label><label class="floating-field"><textarea name="bio" maxlength="500">${esc(p.bio || "")}</textarea><span>Bio</span></label></form>`, `<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-profile">Save changes</button>`); return; }
    if (a === "submit-profile") { const d = Object.fromEntries(new FormData(document.getElementById("profile-form"))); await api.updateProfile(d); state.profile = {...state.profile, ...d}; closeModal(); paint(); toast("Profile updated.", "success"); return; }
    if (a === "message-user") { const target = el.dataset.id; if (!target || target === state.user.uid) return; const r = await api.createChatThread({type: "direct", participantIds: [state.user.uid, target]}); state.route = "chat"; state.activeThreadId = r?.threadId || r?.id || null; paint(); await loadThreads(); if (state.activeThreadId) await loadMessages(state.activeThreadId); paint(); return; }
    if (a === "read-notification") { await api.markNotificationRead({notificationId: el.dataset.id}); await loadNotifications(); paint(); return; }
    if (a === "enable-browser-notifications") { await enableBrowserNotifications(); paint(); toast("Browser notifications are enabled on this device.", "success"); return; }
    if (a === "theme-toggle") { const next = state.resolvedTheme === "dark" ? "light" : "dark"; setTheme(next); paint(); try { await api.updateUserSettings({themeId: next}); } catch {} return; }
    if (a.startsWith("theme-")) { const t = a.slice(6); setTheme(t); paint(); try { await api.updateUserSettings({themeId: t}); } catch {} return; }
    if (a === "market-category") { state.marketCategory = el.dataset.category || "all"; paint(); return; }
    if (a === "skills-category") { state.skillCategory = el.dataset.category || "all"; paint(); return; }
    if (a === "onboarding-next") { if (state.sellerOnboardingStep === 3 && !document.getElementById("seller-agreement")?.checked) { toast("Please accept the seller standards to continue.", "error"); return; } if (state.sellerOnboardingStep === 4) { const f = document.getElementById("seller-details-form"); if (f) state.sellerDraft = {...state.sellerDraft, ...Object.fromEntries(new FormData(f)), agreed: true}; saveSellerDraft(); toast("Shop setup saved.", "success"); go("business"); return; } state.sellerOnboardingStep++; paint(); return; }
    if (a === "onboarding-back") { if (state.sellerOnboardingStep > 0) state.sellerOnboardingStep--; paint(); return; }
    if (a === "skill-onboarding-next") { const f = document.getElementById("skill-details-form"); if (f) state.skillDraft = {...state.skillDraft, ...Object.fromEntries(new FormData(f))}; saveSkillDraft(); if (state.skillOnboardingStep === 3) { toast("Professional setup saved.", "success"); go("skill-profile"); return; } state.skillOnboardingStep++; paint(); return; }
    if (a === "skill-onboarding-back") { if (state.skillOnboardingStep > 0) state.skillOnboardingStep--; paint(); return; }
  } catch (err) { toast(friendlyError(err), "error"); }
});

document.addEventListener("submit", async (e) => {
  const f = e.target; if (!f) return;
  try {
    if (f.id === "signup-form") { e.preventDefault(); await signup(f); toast("Your account is ready.", "success"); return; }
    if (f.id === "signin-form") { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); await signInWithEmailAndPassword(auth, String(d.email).trim(), String(d.password)); return; }
    if (f.id === "forgot-form") { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); await sendPasswordResetEmail(auth, String(d.email).trim()); toast("If an account matches that email, a reset link is on its way.", "success"); return; }
    if (f.id === "message-form") { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); const text = String(d.text || "").trim(); if (!text) return; await api.sendMessage({threadId: state.activeThreadId, text}); f.reset(); return; }
    if (f.id === "home-search-form") { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); state.searchQuery = String(d.query || "").trim(); state.searchScope = "all"; if (state.searchQuery.length < 2) { state.homeSearchResults = []; paint(); return; } const r = await api.search({query: state.searchQuery, scope: "all"}); state.homeSearchResults = Array.isArray(r?.results) ? r.results : []; paint(); return; }
    if (f.id === "chat-person-search-form") { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); state.chatSearchQuery = String(d.query || "").trim(); if (state.chatSearchQuery.length < 2) { state.chatSearchResults = []; paint(); return; } const r = await api.search({query: state.chatSearchQuery, scope: "users"}); state.chatSearchResults = Array.isArray(r?.results) ? r.results : []; paint(); return; }
    if (f.id === "skills-search-form") { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); state.skillsSearchQuery = String(d.query || "").trim(); paint(); return; }
    if (f.id === "search-form") { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); state.searchQuery = String(d.query || "").trim(); state.searchScope = String(d.scope || "all"); const r = await api.search({query: state.searchQuery, scope: state.searchScope}); state.searchResults = Array.isArray(r?.results) ? r.results : []; paint(); return; }
    if (f.id === "market-form") { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); state.searchQuery = String(d.query || "").trim(); await loadMarket(); paint(); return; }
    if (f.id === "profile-form" || f.id === "post-form" || f.id === "comment-form" || f.id === "moment-form") return;
  } catch (err) { e.preventDefault(); toast(friendlyError(err), "error"); }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) { e.preventDefault(); go("search"); setTimeout(() => document.querySelector('#search-form input[name="query"]')?.focus(), 0); }
  if (e.target.matches(".composer textarea") && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.target.form?.requestSubmit(); }
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
app.innerHTML = `<main class="splash"><section class="splash-card"><div class="brand-mark brand-mark-xl"><img src="./assets/brand/icon-512.png" alt="Marvel Chat"></div><h1>Marvel Chat</h1><p>by Davonium Technologies</p><div class="loader"><span></span></div></section></main>`;
onAuthStateChanged(auth, async (user) => {
  clearSubscriptions(); state.user = user; state.activeThreadId = null; state.messages = [];
  if (!user) { foregroundNotificationUnsub?.(); foregroundNotificationUnsub = null; state.profile = null; state.route = "home"; authMode = "welcome"; paint(); return; }
  try { await loadProfile(); } catch (e) { toast(friendlyError(e), "error"); }
  if ("Notification" in window && Notification.permission === "granted") {
    try { await enableBrowserNotifications(); } catch {}
  }
  paint(); void refreshRouteData(state.route);
});
