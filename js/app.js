import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
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
  uploadHomePhoto, uploadHomeMedia, uploadHomeMediaFiles, readPostMedia, uploadMomentPhoto, readMomentMedia, validateHomeFiles
} from "./media.js";

const app = document.getElementById("app");
const routes = [
  "home", "chat", "skills", "market", "profile", "search",
  "notifications", "settings", "skill-profile", "business",
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
  return `<p class="legal-copy">By creating an account, we agree to the
    <button class="inline-link" type="button" data-action="legal-terms">Terms</button>,
    <button class="inline-link" type="button" data-action="legal-privacy">Privacy Policy</button>, and
    <button class="inline-link" type="button" data-action="legal-community">Community Guidelines</button>.</p>`;
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
      <button class="menu-item" type="button" data-action="route-settings">${icon("settings")}Settings</button>
      <div class="menu-sep"></div>
      <button class="menu-item" type="button" data-action="legal-terms">${icon("file")}Terms</button>
      <button class="menu-item" type="button" data-action="legal-privacy">${icon("lock")}Privacy</button>
      <button class="menu-item" type="button" data-action="legal-community">${icon("shield")}Community Guidelines</button>
      <div class="menu-foot">Davonium Technologies · © 2026</div>
    </aside>
  </div>`;
}

function shell(content, noBottom = false) {
  return `<div class="app-shell">${topbar()}<main class="main-scroll">${content}</main>${noBottom ? "" : bottomBar()}</div>`;
}
function emptyState(title, text, action = "", label = "") {
  return `<div class="empty-state"><div class="empty-icon">${icon("spark",19)}</div><strong>${esc(title)}</strong><span>${esc(text)}</span>${action ? `<button class="btn btn-secondary" type="button" data-action="${esc(action)}">${esc(label)}</button>` : ""}</div>`;
}
function head(kicker, title, desc = "", action = "", label = "", back = "") {
  return `<header class="screen-head"><div class="screen-head-main">${back ? `<button class="page-back" type="button" data-action="route-${esc(back)}" aria-label="Back">${icon("back",18)}<span>Back</span></button>` : ""}<div><span class="eyebrow">${esc(kicker)}</span><h1>${esc(title)}</h1>${desc ? `<p>${esc(desc)}</p>` : ""}</div></div>${action ? `<button class="btn btn-primary" type="button" data-action="${esc(action)}">${icon("plus",17)}${esc(label)}</button>` : ""}</header>`;
}
function stamp(v) { return v?.toDate ? v.toDate().getTime() : new Date(v || 0).getTime(); }
function uidOf(x) { return x?.uid || x?.userId || x?.authorUid || x?.creatorUid || x?.ownerUid || ""; }
function participants(t) { return Array.isArray(t.participantIds) ? t.participantIds : (Array.isArray(t.participantUids) ? t.participantUids : []); }
function peer(t) {
  const pid = participants(t).find((x) => x !== state.user.uid) || "";
  return state.threadPeers?.[pid] || t.peerProfile || {uid: pid, displayName: "Conversation", username: ""};
}

async function hydrateThreadPeer(thread) {
  const pid = participants(thread).find((x) => String(x) !== String(state.user.uid)) || "";
  if (!pid || state.threadPeers?.[pid]?.displayName) return state.threadPeers?.[pid] || {uid: pid};
  try {
    const snap = await getDoc(doc(db, "users", pid));
    if (snap.exists()) {
      state.threadPeers[pid] = {uid: pid, ...snap.data()};
      saveThreadPeers();
    }
  } catch {}
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
    const snap = await getDoc(doc(db, "users", targetUid));
    if (snap.exists()) profile = {uid: targetUid, ...snap.data(), ...profile};
  } catch {}

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
  if (type === "skill_listing") {
    return `<article class="result compact-result"><div class="result-icon">${icon("skills",18)}</div><div class="grow"><strong>${esc(item?.title || p.title || "Skill listing")}</strong><small>${esc(item?.subtitle || item?.subTitle || p.description || "")}</small></div><button class="btn btn-secondary" type="button" data-action="skill-search-view" data-id="${esc(item.id || "")}">View</button></article>`;
  }
  return `<article class="result compact-result"><div class="result-icon">${icon(type.includes("product") ? "market" : "profile",18)}</div><div class="grow"><strong>${esc(item?.title || p.title || "Result")}</strong><small>${esc(item?.subtitle || item?.subTitle || p.description || p.bio || "")}</small></div><span class="muted">${type === "skill_profile" ? "Provider" : type === "skill_listing" ? "Service" : type.includes("product") ? "Product" : "Result"}</span></article>`;
}

function contextualSearch(formId, placeholder, scope, value = "") {
  return `<form id="${esc(formId)}" class="context-search"><div class="context-search-box">${icon("search",18)}<input name="query" value="${esc(value)}" maxlength="80" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" autocomplete="off"><button type="submit" aria-label="Search">${icon("arrow",18)}</button></div><input type="hidden" name="scope" value="${esc(scope)}"></form>`;
}

async function loadProfile() {
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
      followingCount: Number(stats?.followingCount || 0)
    };
  } catch {}
}

async function loadHome() {
  const [ps, ms] = await Promise.all([
    getDocs(query(collection(db,"posts"), where("visibility","==","public"), where("status","==","active"), orderBy("createdAt","desc"), limit(20))),
    getDocs(query(collection(db,"moments"), where("visibility","==","public"), where("status","==","active"), orderBy("createdAt","desc"), limit(40)))
  ]);
  state.posts = ps.docs.map((d) => ({id:d.id,...d.data()}));
  const now = Date.now();
  const active = ms.docs.map((d) => ({id:d.id,...d.data()})).filter((x) => !x.expiresAt || stamp(x.expiresAt) > now);
  const own = active.filter((x) => uidOf(x) === state.user.uid || x.uid === state.user.uid).slice(0,1);
  const latest = active.filter((x) => !own.some((o) => o.id === x.id)).slice(0,12);
  state.moments = [...own, ...latest];

  state.posts.filter((p) => Array.isArray(p.mediaIds) && p.mediaIds.length).slice(0,4).forEach((p) => {
    p.mediaUrls = null;
    void hydratePostMedia(p);
  });
}

async function hydratePostMedia(post) {
  if (!post?.id || !Array.isArray(post.mediaIds) || !post.mediaIds.length || Array.isArray(post.mediaUrls)) return;
  try { post.mediaUrls = await readPostMedia(post.id, post.mediaIds); } catch { post.mediaUrls = []; }
  paint();
}

async function loadThreads() {
  const s = await getDocs(query(collection(db,"chatThreads"), where("participantIds","array-contains",state.user.uid), limit(50)));
  state.threads = s.docs.map((d) => ({id:d.id,...d.data()})).sort((a,b) => stamp(b.updatedAt || b.lastMessageAt) - stamp(a.updatedAt || a.lastMessageAt));
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

async function loadSkills() {
  const [listingSnap, categorySnap] = await Promise.all([
    getDocs(query(collection(db,"skillListings"), where("status","==","active"), limit(40))),
    getDocs(query(collection(db,"skillCategories"), where("status","==","active"), limit(50))).catch(() => ({docs:[]}))
  ]);
  state.skills = listingSnap.docs.map((d) => ({id:d.id,...d.data()}));
  state.skillCategories = categorySnap.docs.map((d) => ({id:d.id,...d.data()}));
}

async function loadSkillWorkspace() {
  const profileSnap = await getDoc(doc(db,"skillProfiles",state.user.uid));
  state.skillProfile = profileSnap.exists() ? {uid:state.user.uid,...profileSnap.data()} : null;
  const listingSnap = await getDocs(query(collection(db,"skillListings"), where("providerUid","==",state.user.uid), limit(50)));
  state.skillListingsMine = listingSnap.docs.map((d) => ({id:d.id,...d.data()}));
  const [reqA, reqB] = await Promise.all([
    getDocs(query(collection(db,"skillRequests"), where("requesterUid","==",state.user.uid), limit(40))).catch(() => ({docs:[]})),
    getDocs(query(collection(db,"skillRequests"), where("providerUid","==",state.user.uid), limit(40))).catch(() => ({docs:[]}))
  ]);
  const map = new Map();
  [...reqA.docs,...reqB.docs].forEach((d) => map.set(d.id,{id:d.id,...d.data()}));
  state.skillRequests = [...map.values()].sort((a,b) => stamp(b.updatedAt || b.createdAt) - stamp(a.updatedAt || a.createdAt));
}

async function loadMarket() {
  const [r, categorySnap, storeSnap] = await Promise.all([
    api.discoverMarketProducts({query: state.searchQuery || "", scope:"all"}),
    getDocs(query(collection(db,"productCategories"), where("status","==","active"), limit(50))).catch(() => ({docs:[]})),
    getDocs(query(collection(db,"stores"), where("ownerUid","==",state.user.uid), limit(1))).catch(() => ({docs:[]}))
  ]);
  state.products = Array.isArray(r?.results) ? r.results : [];
  state.marketCategories = categorySnap.docs.map((d) => ({id:d.id,...d.data()}));
  state.myStore = storeSnap.docs.length ? {id:storeSnap.docs[0].id,...storeSnap.docs[0].data()} : state.myStore;
}

async function loadBusinessWorkspace() {
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
  if (state.myStore) {
    const reqSnap = await getDocs(query(collection(db,"commerceRequests"), where("sellerUid","==",state.user.uid), limit(50))).catch(() => ({docs:[]}));
    state.commerceRequests = reqSnap.docs.map((d) => ({id:d.id,...d.data()})).sort((a,b) => stamp(b.updatedAt || b.createdAt) - stamp(a.updatedAt || a.createdAt));
  } else {
    state.commerceRequests = [];
  }
}

async function loadNotifications() {
  try {
    const s = await getDocs(query(collection(db,"notifications"), where("recipientUid","==",state.user.uid), limit(40)));
    state.notifications = s.docs.map((d) => ({id:d.id,...d.data()})).sort((a,b) => stamp(b.createdAt) - stamp(a.createdAt));
    state.unreadNotifications = state.notifications.filter((n) => !n.read && !n.isRead && !n.readAt).length;
  } catch {
    try { const r = await api.getMyNotificationSummary(); state.unreadNotifications = Number(r?.unreadCount || 0); } catch { state.unreadNotifications = 0; }
    state.notifications = [];
  }
}

function categoryChips(kind, selected) {
  const fallback = kind === "market" ? MARKET_CATEGORIES : SKILL_CATEGORIES;
  const dynamic = kind === "market" ? state.marketCategories : state.skillCategories;
  const categories = dynamic.length ? [["all","All"],...dynamic.map((c) => [c.id,c.name || c.slug || c.id])] : fallback;
  return `<div class="category-row">${categories.map(([id,label]) => `<button class="category-chip ${selected === id ? "active" : ""}" type="button" data-action="${kind}-category" data-category="${esc(id)}">${esc(label)}</button>`).join("")}</div>`;
}

function momentCard(m, own = false) {
  const label = own ? "Your Moment" : (m.authorSnapshot?.displayName || m.author?.displayName || m.displayName || m.username || "Following");
  return `<button class="moment-card ${own ? "own" : ""}" type="button" data-action="view-moment" data-id="${esc(m.id)}"><div class="moment-ring"><div class="moment-avatar">${avatar(m.authorSnapshot || m.author || m,"md",true)}</div>${own ? `<span class="moment-plus">${icon("plus",12)}</span>` : ""}</div><span class="moment-label">${esc(label)}</span></button>`;
}

function renderHome() {
  const own = state.moments.find((m) => uidOf(m) === state.user.uid || m.uid === state.user.uid);
  const following = state.moments.filter((m) => m.id !== own?.id);
  const post = (p) => {
    const author = p.authorSnapshot || p.author || p;
    const urls = Array.isArray(p.mediaUrls) ? p.mediaUrls : [];
    const mediaHtml = urls.length ? `<div class="post-media-grid ${urls.length > 1 ? "multi" : ""}">${urls.map((m) => {
      if (String(m.contentType || "").startsWith("video/")) {
        return `<figure><video src="${esc(m.url)}" controls playsinline preload="metadata"></video></figure>`;
      }
      return `<figure><img src="${esc(m.url)}" alt="Photo shared by ${esc(author.displayName || "a community member")}" loading="lazy" decoding="async"></figure>`;
    }).join("")}</div>` : (Array.isArray(p.mediaIds) && p.mediaIds.length ? `<button class="media-placeholder" type="button" data-action="load-post-media" data-id="${esc(p.id)}">${icon("camera",17)}<span>Load ${p.mediaIds.length > 1 ? `${p.mediaIds.length} media items` : "media"}</span></button>` : "");
    return `<article class="post-card modern-post" data-post-id="${esc(p.id)}">
      <header class="post-head">${avatar(author,"md",true)}<div class="grow"><strong>${esc(author.displayName || "Community member")}</strong><span>${esc(author.username ? `@${author.username}` : "Community")} · ${when(p.createdAt)}</span></div>${uidOf(p) === state.user.uid ? `<button class="icon-btn" type="button" data-action="post-menu" data-id="${esc(p.id)}" aria-label="Post options">${icon("menuDots",19)}</button>` : `<button class="post-follow" type="button" data-action="${state.followingIds.includes(String(uidOf(p))) ? "unfollow-user" : "follow-user"}" data-id="${esc(uidOf(p))}" aria-label="${followLabel(uidOf(p))}">${followLabel(uidOf(p))}</button>`}</header>
      <div class="post-body">${p.text ? `<p>${esc(p.text)}</p>` : ""}${mediaHtml}</div>
      <footer class="post-actions"><button type="button" data-action="like-post" data-id="${esc(p.id)}">${icon("heart",18)}Like <span>${Number(p.reactionCount || 0) || ""}</span></button><button type="button" data-action="comment-post" data-id="${esc(p.id)}">${icon("comment",18)}Comment <span>${Number(p.commentCount || 0) || ""}</span></button><button type="button" data-action="save-post" data-id="${esc(p.id)}">${icon("bookmark",18)}Save</button><button type="button" data-action="share-post" data-id="${esc(p.id)}">${icon("arrow",18)}Share</button></footer>
    </article>`;
  };
  return `<section class="screen home-screen">
    <section class="home-moments"><div class="section-head compact"><div><span class="eyebrow">MOMENTS</span><h2>Stories & updates</h2></div><button class="text-button" type="button" data-action="create-moment">Create</button></div><div class="moments-row">${own ? momentCard(own,true) : `<button class="moment-card own" type="button" data-action="create-moment"><div class="moment-ring add-ring">${avatar(state.profile || state.user,"md",true)}<span class="add-badge">${icon("plus",13)}</span></div><span class="moment-label">Add a Moment</span></button>`}${following.map((m) => momentCard(m)).join("")}</div></section>
    ${contextualSearch("home-search-form","Search people, skills, products, or shops…","all",state.searchQuery)}
    ${state.homeSearchResults.length ? `<section class="inline-results"><div class="section-head compact"><div><span class="eyebrow">SEARCH</span><h2>Matches</h2></div><button class="text-button" type="button" data-action="clear-home-search">Clear</button></div><div class="results">${state.homeSearchResults.slice(0,8).map(searchResultCard).join("")}</div></section>` : ""}
    <section class="section feed-section"><div class="section-head compact"><div><span class="eyebrow">COMMUNITY FEED</span><h2>Latest updates</h2></div></div>${state.posts.length ? state.posts.map(post).join("") : emptyState("Your feed is quiet","Community updates will appear here.","create-post","Create a post")}</section>
    <button class="fab" type="button" data-action="create-menu" aria-label="Create"><span>${icon("plus",23)}</span></button>
  </section>`;
}

function renderChat() {
  if (state.activeThreadId) {
    const t = state.threads.find((x) => x.id === state.activeThreadId) || {};
    const p = peer(t);
    return `<section class="screen conversation"><header class="conversation-head"><button class="icon-btn" type="button" data-action="close-thread" aria-label="Back">${icon("back")}</button>${avatar(p,"sm",true)}<div class="grow"><strong>${esc(p.displayName || p.username || "Conversation")}</strong><span>${esc(p.username ? `@${p.username}` : "Private conversation")}</span></div></header><div class="messages">${state.messages.length ? state.messages.map((m) => `<div class="message-row ${m.senderUid === state.user.uid ? "own" : ""}"><div class="bubble"><div>${esc(m.status === "deleted_for_everyone" ? "Message deleted" : (m.text || ""))}</div><small>${when(m.createdAt)}</small>${m.senderUid === state.user.uid && m.status !== "deleted_for_everyone" ? `<button class="message-more" type="button" data-action="delete-message" data-id="${esc(m.id)}">Delete</button>` : ""}</div></div>`).join("") : emptyState("Start the conversation","Send a message to begin.")}</div><form id="message-form" class="composer"><textarea name="text" rows="1" maxlength="4000" placeholder="Write a message…" required></textarea><button type="submit" aria-label="Send">${icon("send",20)}</button></form></section>`;
  }
  const thread = (t) => { const p = peer(t); return `<button class="thread" type="button" data-action="open-thread" data-id="${esc(t.id)}">${avatar(p,"md",true)}<span class="thread-copy"><strong>${esc(p.displayName || p.username || "Conversation")}</strong><small>${esc(typeof t.lastMessage === "string" ? t.lastMessage : (t.lastMessage?.text || t.lastMessageText || "No messages yet"))}</small></span><span class="thread-meta">${when(t.lastMessageAt || t.updatedAt)}</span></button>`; };
  return `<section class="screen chat-screen">${head("CONVERSATIONS","Chat","Private conversations with people you choose.","focus-chat-search","New chat")}${contextualSearch("chat-person-search-form","Search exact username…","users",state.chatSearchQuery)}${state.chatSearchResults.length ? `<section class="inline-results"><div class="section-head compact"><div><span class="eyebrow">PEOPLE</span><h2>Search results</h2></div><button class="text-button" type="button" data-action="clear-chat-search">Clear</button></div><div class="results">${state.chatSearchResults.slice(0,8).map(searchResultCard).join("")}</div></section>` : ""}<div class="threads">${state.threads.length ? state.threads.map(thread).join("") : emptyState("No conversations yet","Search an exact username above to start a conversation.")}</div></section>`;
}

function renderSkills() {
  const q = state.skillsSearchQuery.trim().toLowerCase();
  const filtered = state.skills.filter((item) => {
    if (!categoryMatches(item, state.skillCategory || "all")) return false;
    if (!q) return true;
    return [item.title, item.description, item.categoryId, ...(item.tags || [])].join(" ").toLowerCase().includes(q);
  });
  const card = (item) => `<article class="listing-card"><div class="listing-icon">${icon("skills",20)}</div><div class="grow"><span class="eyebrow">SERVICE</span><h3>${esc(item.title || "Skill listing")}</h3><p>${esc(item.description || "")}</p><div class="tags">${(item.tags || []).slice(0,4).map((tag) => `<span>${esc(tag)}</span>`).join("")}</div><small class="muted">${money(item.priceFromMinor,item.currency || "NGN")}</small></div><button class="btn btn-secondary" type="button" data-action="skill-view" data-id="${esc(item.id)}">View</button></article>`;
  return `<section class="screen skills-screen">${head("DISCOVERY","Marvel Skills","Discover services and providers.")}${contextualSearch("skills-search-form","Search services or providers…","skills",state.skillsSearchQuery)}<section class="section"><div class="section-head compact"><div><span class="eyebrow">CATEGORIES</span><h2>Explore skills</h2></div>${state.skillProfile ? `<button class="text-button" type="button" data-action="route-skill-profile">My Skills</button>` : ""}</div>${categoryChips("skills",state.skillCategory || "all")}</section><section class="section"><div class="listing-grid">${filtered.length ? filtered.map(card).join("") : emptyState("No services here yet","Try another category or search phrase when new listings are available.")}</div></section></section>`;
}

function renderSkillProfile() {
  const p = state.skillProfile;
  const mine = state.skillListingsMine;
  const requests = state.skillRequests.slice(0,12);
  return `<section class="screen">${head("PROVIDER ACCOUNT","My Skills",p ? "Manage your provider profile and services." : "Create your provider account from Profile.",p ? "create-skill-listing" : "route-skill-onboarding",p ? "Add service" : "Create account", "profile")}<div class="workspace-card featured"><div class="workspace-icon">${icon("skills",22)}</div><div class="grow"><span class="eyebrow">PROVIDER PROFILE</span><h2>${esc(p?.headline || "Provider account")}</h2><p>${esc(p?.bio || "Your provider profile will appear here after setup.")}</p>${p ? `<div class="tags">${(p.categories || []).slice(0,6).map((c) => `<span>${esc(c)}</span>`).join("")}<span>${p.remote ? "Remote" : "On location"}</span></div>` : ""}</div></div>${p ? `<section class="section"><div class="section-head compact"><div><span class="eyebrow">MY SERVICES</span><h2>${mine.length} service${mine.length === 1 ? "" : "s"}</h2></div></div><div class="listing-grid">${mine.length ? mine.map((item) => `<article class="listing-card"><div class="listing-icon">${icon("skills",20)}</div><div class="grow"><h3>${esc(item.title || "Service")}</h3><p>${esc(item.description || "")}</p><small class="muted">${esc(item.status || "active")} · ${money(item.priceFromMinor,item.currency || "NGN")}</small></div><div class="stack-buttons"><button class="btn btn-secondary" type="button" data-action="edit-skill-listing" data-id="${esc(item.id)}">Edit</button>${item.status === "active" ? `<button class="btn btn-secondary" type="button" data-action="pause-skill-listing" data-id="${esc(item.id)}">Pause</button>` : item.status === "paused" ? `<button class="btn btn-secondary" type="button" data-action="activate-skill-listing" data-id="${esc(item.id)}">Offer</button>` : ""}<button class="btn btn-secondary" type="button" data-action="delete-skill-listing" data-id="${esc(item.id)}">Delete</button></div></article>`).join("") : emptyState("No services yet","Add your first service to appear in Marvel Skills.","create-skill-listing","Add service")}</div></section><section class="section"><div class="section-head compact"><div><span class="eyebrow">REQUESTS</span><h2>Skill activity</h2></div></div>${requests.length ? requests.map((r) => `<article class="notification"><div class="notification-icon">${icon("skills",18)}</div><div class="grow"><strong>${esc(r.title || "Skill request")}</strong><p>${esc(r.status || "open")}</p><small>${formatDate(r.updatedAt || r.createdAt)}</small></div></article>`).join("") : emptyState("No skill requests","Requests will appear here when members contact your services.")}</section>` : ""}</section>`;
}

function renderMarket() {
  const filtered = state.products.filter((item) => categoryMatches(item.result || item, state.marketCategory || "all"));
  const card = (item) => { const p = item.result || item; return `<article class="product-card" data-action="market-view" data-id="${esc(item.id || p.id || "")}" tabindex="0"><div class="product-cover"><div class="product-cover-icon">${icon("market",24)}</div></div><div class="product-info"><span class="eyebrow">PRODUCT</span><h3>${esc(p.title || item.title || "Product")}</h3><p>${esc(p.description || p.subTitle || "")}</p><strong>${money(p.priceMinor,p.currency || "NGN")}</strong></div></article>`; };
  return `<section class="screen market-screen">${head("DISCOVERY","Marvel Market","Discover products from real storefronts.",state.myStore ? "route-business" : "",state.myStore ? "My Shop" : "")}${contextualSearch("market-form","Search products and shops…","market",state.searchQuery)}<div class="market-powered">Powered by Davonium Technologies</div><section class="section"><div class="section-head compact"><div><span class="eyebrow">CATEGORIES</span><h2>Browse categories</h2></div></div>${categoryChips("market",state.marketCategory || "all")}</section><section class="section"><div class="product-grid">${filtered.length ? filtered.map(card).join("") : emptyState("Nothing to show yet","Try another category or search phrase.")}</div></section></section>`;
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
  const posts = p.postsCount ?? p.postCount ?? 0;
  const followers = state.followStats.followersCount || p.followersCount || 0;
  const following = state.followStats.followingCount || state.followingIds.length || p.followingCount || 0;
  return `<section class="screen">${head("YOUR SPACE","Profile","Your identity, provider account, seller account, and settings.","edit-profile","Edit profile")}<div class="profile-hero">${avatar(p,"xl",true)}<div class="profile-main"><h1>${esc(p.displayName || state.user?.displayName || "Your profile")}</h1><p class="handle">${esc(p.username ? `@${p.username}` : p.email || state.user?.email || "")}</p><p class="bio">${esc(p.bio || "")}</p></div></div><div class="profile-stats"><div><strong>${esc(posts)}</strong><span>Posts</span></div><div><strong>${esc(followers)}</strong><span>Followers</span></div><div><strong>${esc(following)}</strong><span>Following</span></div></div><div class="profile-grid"><button class="profile-tile" type="button" data-action="route-skill-profile"><span class="tile-icon">${icon("skills",20)}</span><strong>${state.skillProfile ? "My Skills" : "Create skill account"}</strong><small>${state.skillProfile ? "Manage your provider profile and services." : "Become a provider from your Profile."}</small>${icon("arrow",17)}</button><button class="profile-tile" type="button" data-action="route-business"><span class="tile-icon">${icon("shop",20)}</span><strong>${state.myStore ? "My Shop" : "Create seller account"}</strong><small>${state.myStore ? "Manage your storefront, products, stock, and orders." : "Create a seller account before opening your shop."}</small>${icon("arrow",17)}</button><button class="profile-tile" type="button" data-action="route-settings"><span class="tile-icon">${icon("settings",20)}</span><strong>Settings</strong><small>Appearance and notification preferences.</small>${icon("arrow",17)}</button></div><div class="profile-footer-actions"><button class="btn btn-secondary" type="button" data-action="sign-out">${icon("logout",17)}Sign out</button></div></section>`;
}

function renderSearch() {
  const results = state.searchResults.slice(0,24);
  return `<section class="screen">${head("DISCOVERY","Search","Find people, skills, products, and shops.", "", "", "home")}<form id="search-form" class="search-form"><label class="search-box">${icon("search",18)}<input name="query" value="${esc(state.searchQuery)}" maxlength="80" placeholder="Search everything…" autocomplete="off"></label><select name="scope"><option value="all" ${state.searchScope === "all" ? "selected" : ""}>Everything</option><option value="users" ${state.searchScope === "users" ? "selected" : ""}>People</option><option value="skills" ${state.searchScope === "skills" ? "selected" : ""}>Skills</option><option value="market" ${state.searchScope === "market" ? "selected" : ""}>Market</option></select><button class="btn btn-primary" type="submit">Search</button></form><div class="results">${results.length ? results.map(searchResultCard).join("") : emptyState("Start searching","Search by name, username, skill, product, or shop.")}</div></section>`;
}
function renderNotifications() { return `<section class="screen">${head("UPDATES","Notifications",state.unreadNotifications ? `${state.unreadNotifications} unread` : "You are all caught up.", "", "", "home")}<div>${state.notifications.length ? state.notifications.map((n) => `<article class="notification ${n.read || n.isRead || n.readAt ? "" : "unread"}"><div class="notification-icon">${icon("bell",18)}</div><div class="grow"><strong>${esc(n.title || "Marvel Chat")}</strong><p>${esc(n.body || "")}</p><small>${when(n.createdAt)}</small></div>${!(n.read || n.isRead || n.readAt) ? `<button class="text-button" type="button" data-action="read-notification" data-id="${esc(n.id)}">Mark read</button>` : ""}</article>`).join("") : emptyState("No new notifications","Activity updates will appear here.")}</div></section>`; }
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
    state.pushEnabled = false;
    if (foregroundMessageUnsubscribe) { foregroundMessageUnsubscribe(); foregroundMessageUnsubscribe = null; }
    toast("Notifications disabled for this browser.","success");
    paint();
  } catch (error) {
    toast(friendlyError(error),"error");
  }
}

function openLegal(type) {
  const title = {terms:"Terms",privacy:"Privacy Policy",community:"Community Guidelines"}[type];
  modal(title, legalBody(type), `<button class="btn btn-primary" type="button" data-action="close-modal">Done</button>`, {wide:true});
}

const viewMap = {
  home: renderHome, chat: renderChat, skills: renderSkills, market: renderMarket,
  profile: renderProfile, search: renderSearch, notifications: renderNotifications,
  settings: renderSettings, "skill-profile": renderSkillProfile,
  business: renderBusiness, "seller-onboarding": renderSellerOnboarding,
  "skill-onboarding": renderSkillOnboarding
};

function paint() {
  if (!state.user) { app.innerHTML = authScreen(); return; }
  app.innerHTML = shell((viewMap[state.route] || renderHome)(), state.route === "chat" && Boolean(state.activeThreadId));
}

async function refreshRouteData(route) {
  state.loadingRoute = true;
  try {
    if (route === "home") await loadHome();
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
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateAuthProfile(credential.user, {displayName});
  await api.updateProfile({displayName, username, bio: "", location: ""});
}

function openCreatePost() {
  state.pendingMediaFile = null;
  state.pendingMediaFiles = [];
  modal("Create post",`<form id="post-form" class="form-stack compact-form"><label class="floating-field"><textarea name="text" maxlength="5000" placeholder=" "></textarea><span>What would you like to share?</span></label><label class="select-field"><span>Visibility</span><select name="visibility"><option value="public">Public</option><option value="followers">Followers</option><option value="private">Private</option></select></label><label class="photo-pick">${icon("camera",20)}<span><strong>Add photos or a video</strong><small>Up to 10 media items · photos/videos are optimized automatically · 2 MiB total daily allowance</small></span><input id="post-media" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple></label><div id="post-media-preview" class="post-media-picker"></div></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-post">Publish</button>`,{wide:true});
}

function openCreateMoment() {
  state.pendingMomentFile = null;
  modal("Create Moment",`<form id="moment-form" class="form-stack compact-form"><label class="select-field"><span>Moment type</span><select id="moment-content-type" name="contentType"><option value="text">Text</option><option value="photo">Photo</option><option value="photo_text">Photo + text</option></select></label><label class="floating-field"><textarea name="text" maxlength="1500" placeholder=" "></textarea><span>Moment text</span></label><label class="photo-pick">${icon("camera",20)}<span><strong>Add a photo</strong><small>Required for photo/photo + text Moments · photo optimized automatically · 2 MiB daily allowance</small></span><input id="moment-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><div id="moment-photo-preview" class="post-photo-preview"></div></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-moment">Publish</button>`);
}

function openComment(postId) {
  modal("Add a comment",`<form id="comment-form" class="form-stack compact-form"><input type="hidden" name="postId" value="${esc(postId)}"><label class="floating-field"><textarea name="text" maxlength="1000" required placeholder=" "></textarea><span>Your comment</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-comment">Comment</button>`);
}

function openSkillListing(listing) {
  const price = listing.priceFromMinor == null ? "Price on request" : money(listing.priceFromMinor,listing.currency || "NGN");
  modal(listing.title || "Service",`<div class="detail"><p>${esc(listing.description || "")}</p><div class="tags">${(listing.tags || []).map((t) => `<span>${esc(t)}</span>`).join("")}</div><strong>${price}</strong></div>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button><button class="btn btn-primary" type="button" data-action="request-skill" data-id="${esc(listing.id)}">Request service</button>`,{wide:true});
}

function openMarketProduct(item) {
  const p = item.result || item;
  modal(p.title || "Product",`<div class="detail"><div class="product-detail-icon">${icon("market",30)}</div><p>${esc(p.description || p.subTitle || "")}</p><strong>${money(p.priceMinor,p.currency || "NGN")}</strong><small class="muted">${esc(p.status || "available")}</small></div><form id="purchase-form" class="form-stack compact-form"><input type="hidden" name="productId" value="${esc(p.id || item.id || "")}"><input type="hidden" name="storeId" value="${esc(p.storeId || "")}"><label class="floating-field"><input name="quantity" type="number" min="1" max="1000" value="1" required><span>Quantity</span></label><label class="floating-field"><textarea name="customerNote" maxlength="1000" placeholder=" "></textarea><span>Note to seller (optional)</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button><button class="btn btn-primary" type="button" data-action="submit-purchase">Send request</button>`,{wide:true});
}

function openProfileEdit() {
  const p = state.profile || {};
  modal("Edit profile",`<form id="profile-form" class="form-stack compact-form"><label class="floating-field"><input name="displayName" maxlength="80" value="${esc(p.displayName || state.user?.displayName || "")}" required placeholder=" "><span>Full name</span></label><label class="floating-field"><input name="username" maxlength="30" value="${esc(p.username || "")}" required placeholder=" "><span>Username</span></label><label class="floating-field"><textarea name="bio" maxlength="500" placeholder=" ">${esc(p.bio || "")}</textarea><span>Bio</span></label><label class="floating-field"><input name="location" maxlength="200" value="${esc(p.location || "")}" placeholder=" "><span>Location</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-profile">Save changes</button>`);
}

function openSkillListingEditor(listing = null) {
  const s = listing || {};
  const categoryOptions = state.skillCategories.length ? state.skillCategories.map((c) => [c.id,c.name || c.id]) : SKILL_CATEGORIES.filter((x) => x[0] !== "all");
  modal(listing ? "Edit service" : "Create service",`<form id="skill-listing-form" class="form-stack compact-form"><label class="floating-field"><input name="title" maxlength="160" value="${esc(s.title || "")}" required placeholder=" "><span>Service title</span></label><label class="floating-field"><textarea name="description" maxlength="3000" required placeholder=" ">${esc(s.description || "")}</textarea><span>Description</span></label><label class="select-field"><span>Category</span><select name="categoryId" required>${categoryOptions.map(([id,label]) => `<option value="${esc(id)}" ${s.categoryId === id ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label><label class="floating-field"><input name="priceFromMinor" type="number" min="0" value="${esc(s.priceFromMinor ?? "")}" placeholder=" "><span>Starting price (minor units)</span></label><label class="floating-field"><input name="deliveryTimeDays" type="number" min="1" max="365" value="${esc(s.deliveryTimeDays ?? "")}" placeholder=" "><span>Delivery time (days)</span></label><label class="floating-field"><input name="tags" maxlength="500" value="${esc((s.tags || []).join(", "))}" placeholder=" "><span>Tags, comma separated</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-skill-listing" data-id="${esc(s.id || "")}">${listing ? "Save changes" : "Publish listing"}</button>`,{wide:true});
}

function openProductEditor(product = null) {
  const p = product || {};
  const categoryOptions = state.marketCategories.length ? state.marketCategories.map((c) => [c.id,c.name || c.id]) : [];
  modal(product ? "Edit product" : "Create product",`<form id="product-form" class="form-stack compact-form"><label class="floating-field"><input name="title" maxlength="200" value="${esc(p.title || "")}" required placeholder=" "><span>Product name</span></label><label class="floating-field"><textarea name="description" maxlength="3000" placeholder=" ">${esc(p.description || "")}</textarea><span>Description</span></label><label class="select-field"><span>Category</span><select name="categoryId"><option value="">No category</option>${categoryOptions.map(([id,label]) => `<option value="${esc(id)}" ${p.categoryId === id ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label><label class="floating-field"><input name="priceMinor" type="number" min="0" value="${esc(p.priceMinor ?? "0")}" required placeholder=" "><span>Price in minor units</span></label><label class="floating-field"><input name="currency" maxlength="3" value="${esc(p.currency || "NGN")}" required placeholder=" "><span>Currency</span></label><label class="floating-field"><input name="tags" maxlength="500" value="${esc((p.tags || []).join(", "))}" placeholder=" "><span>Tags, comma separated</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-product" data-id="${esc(p.id || "")}">${product ? "Save changes" : "Create product"}</button>`,{wide:true});
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

document.addEventListener("click", async (e) => {
  if (e.target?.classList?.contains("modal-backdrop")) {
    closeModal();
    return;
  }

  const actionEl = e.target.closest?.("[data-action]");
  if (!actionEl) return;
  const a = actionEl.dataset.action;
  try {
    if (a === "close-modal") { closeModal(); return; }
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
        await signInWithPopup(auth, new GoogleAuthProvider());
      } finally {
        googleSignInPending = false;
        document.querySelectorAll('[data-action="google-signin"]').forEach((button) => {
          button.disabled = false;
        });
      }
      return;
    }
    if (a.startsWith("route-")) { go(a.slice(6)); return; }
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
    if (a.startsWith("legal-")) { openLegal(a.slice(6)); return; }
    if (a === "sign-out") { await signOut(auth); return; }
    if (a === "create-menu") { openCreateMenu(); return; }
    if (a === "create-post") { closeModal(); openCreatePost(); return; }
    if (a === "create-moment") { closeModal(); openCreateMoment(); return; }
    if (a === "submit-post") { const f=document.getElementById("post-form"); const d=Object.fromEntries(new FormData(f)); const text=String(d.text || "").trim(); const files=Array.isArray(state.pendingMediaFiles) ? state.pendingMediaFiles : []; if(!text && files.length===0){toast("Add text or media before publishing.","error");return;} const mediaIds=files.length ? await uploadHomeMediaFiles(files) : []; await api.createPost({text,mediaIds,visibility:String(d.visibility || "public")}); state.pendingMediaFile=null; state.pendingMediaFiles=[]; closeModal(); toast("Post published.","success"); await loadHome(); paint(); return; }
    if (a === "submit-moment") { const f=document.getElementById("moment-form"); const d=Object.fromEntries(new FormData(f)); const contentType=String(d.contentType || "text"); const needsPhoto=contentType === "photo" || contentType === "photo_text"; if(needsPhoto && !state.pendingMomentFile){toast("Choose a photo for this Moment.","error");return;} let mediaId=null; if(state.pendingMomentFile) mediaId=await uploadMomentPhoto(state.pendingMomentFile); await api.createMoment({contentType,text:String(d.text || "").trim(),mediaId}); state.pendingMomentFile=null; closeModal(); toast("Moment published.","success"); await loadHome(); paint(); return; }
    if (a === "post-menu") { const p=state.posts.find((x)=>x.id===actionEl.dataset.id); if(!p)return; modal("Post options",`<div class="form-stack"><button class="btn btn-secondary btn-block" type="button" data-action="edit-post" data-id="${esc(p.id)}">Edit post</button><button class="btn btn-secondary btn-block" type="button" data-action="delete-post" data-id="${esc(p.id)}">Delete post</button></div>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button>`); return; }
    if (a === "edit-post") { const p=state.posts.find((x)=>x.id===actionEl.dataset.id); if(!p)return; modal("Edit post",`<form id="edit-post-form" class="form-stack"><input type="hidden" name="postId" value="${esc(p.id)}"><label class="floating-field"><textarea name="text" maxlength="4000" required placeholder=" ">${esc(p.text || "")}</textarea><span>Post text</span></label><label class="select-field"><span>Visibility</span><select name="visibility"><option value="public" ${p.visibility === "public" ? "selected" : ""}>Public</option><option value="followers" ${p.visibility === "followers" ? "selected" : ""}>Followers</option><option value="private" ${p.visibility === "private" ? "selected" : ""}>Private</option></select></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-edit-post">Save</button>`); return; }
    if (a === "submit-edit-post") { const d=Object.fromEntries(new FormData(document.getElementById("edit-post-form"))); await api.updatePost({postId:d.postId,text:String(d.text || "").trim(),visibility:d.visibility}); closeModal(); toast("Post updated.","success"); await loadHome(); paint(); return; }
    if (a === "delete-post") { await api.deletePost({postId:actionEl.dataset.id}); closeModal(); toast("Post deleted.","success"); await loadHome(); paint(); return; }
    if (a === "like-post") { const r=await api.reactToPost({postId:actionEl.dataset.id,type:"like"}); toast(r?.reacted === false ? "Like removed." : "Post liked.","success"); return; }
    if (a === "save-post") { const r=await api.savePost({postId:actionEl.dataset.id}); toast(r?.saved === false ? "Post unsaved." : "Post saved.","success"); return; }
    if (a === "comment-post") { openComment(actionEl.dataset.id); return; }
    if (a === "submit-comment") { const d=Object.fromEntries(new FormData(document.getElementById("comment-form"))); await api.commentOnPost({postId:d.postId,text:String(d.text || "").trim()}); closeModal(); toast("Comment added.","success"); return; }
    if (a === "share-post") { const url=location.href; try { if(navigator.share) await navigator.share({title:"Marvel Chat",text:"Check this post on Marvel Chat",url}); else {await navigator.clipboard.writeText(url);toast("Link copied.","success");} } catch {} return; }
    if (a === "load-post-media") { const p=state.posts.find((x)=>x.id===actionEl.dataset.id); if(p) await hydratePostMedia(p); return; }
    if (a === "view-moment") { const m=state.moments.find((x)=>x.id===actionEl.dataset.id); if(!m)return; let urls=[]; if(m.mediaId) { try { urls=await readMomentMedia(m.id,[m.mediaId]); } catch {} } modal(m.uid === state.user.uid ? "Your Moment" : "Moment",`<div class="moment-view"><div class="moment-large-avatar">${avatar(m.author || m,"xl",true)}</div><span class="eyebrow">${esc(m.contentType || "text")}</span><h3>${esc(m.authorSnapshot?.displayName || m.author?.displayName || m.displayName || m.username || "")}</h3>${urls[0]?.url ? `<img class="moment-view-image" src="${esc(urls[0].url)}" alt="Moment photo" loading="lazy">` : ""}<p>${esc(m.text || "")}</p><small>${formatDate(m.createdAt)}</small></div>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Done</button>${m.uid === state.user.uid || m.authorUid === state.user.uid ? `<button class="btn btn-primary" type="button" data-action="delete-moment" data-id="${esc(m.id)}">Delete</button>` : ""}`); return; }
    if (a === "delete-moment") { await api.deleteMoment({momentId:actionEl.dataset.id}); closeModal(); toast("Moment deleted.","success"); await loadHome(); paint(); return; }
    if (a === "clear-home-search") { state.searchQuery="";state.homeSearchResults=[];paint();return; }
    if (a === "clear-chat-search") { state.chatSearchQuery="";state.chatSearchResults=[];paint();return; }
    if (a === "focus-chat-search") { state.route="chat"; paint(); setTimeout(()=>document.querySelector('#chat-person-search-form input[name="query"]')?.focus(),0); return; }
    if (a === "open-thread") { state.activeThreadId=actionEl.dataset.id;state.messages=[];const thread=state.threads.find((x)=>x.id===state.activeThreadId);if(thread) await hydrateThreadPeer(thread);paint();await loadMessages(state.activeThreadId);return; }
    if (a === "close-thread") { clearSubscriptions();state.activeThreadId=null;state.messages=[];go("chat");return; }
    if (a === "delete-message") { await api.deleteMessage({threadId:state.activeThreadId,messageId:actionEl.dataset.id,mode:"for_everyone"});toast("Message deleted.","success");return; }
    if (a === "message-user") { const target=actionEl.dataset.id; if(!target || target===state.user.uid)return; const item=[...state.chatSearchResults,...state.homeSearchResults,...state.searchResults].find((x)=>String(x.id)===String(target)); const profile=item?.result || item || {}; const derivedUsername = profile.username || String(item?.subtitle || "").replace(/^@/, ""); state.threadPeers[target]={uid:target,displayName:item?.title || profile.displayName || derivedUsername || "Conversation",username:derivedUsername,photoURL:profile.photoURL || null};saveThreadPeers(); const id=await findOrCreateDirectThread(target,state.threadPeers[target]); state.route="chat";state.activeThreadId=id;await loadThreads();paint();await loadMessages(id);return; }
    if (a === "view-user") { const target=actionEl.dataset.id; if(!target || target===state.user.uid)return; const item=[...state.chatSearchResults,...state.homeSearchResults,...state.searchResults].find((x)=>String(x.id)===String(target)); await openPublicUserProfile(target,item || {}); return; }
    if (a === "follow-user" || a === "unfollow-user") { const target=actionEl.dataset.id; if(!target || target===state.user.uid)return; const current=await api.getFollowState({targetUid:target}); if(current?.following){await api.unfollowUser({targetUid:target});state.followingIds=state.followingIds.filter((id)=>String(id)!==String(target));toast("No longer following.","success");}else{await api.followUser({targetUid:target});state.followingIds=[...new Set([...state.followingIds,String(target)])];toast("Following.","success");} paint(); return; }
    if (a === "skill-view" || a === "skill-search-view") { const s=state.skills.find((x)=>x.id===actionEl.dataset.id) || [...state.searchResults,...state.homeSearchResults].find((x)=>x.id===actionEl.dataset.id); if(s)openSkillListing(s.result || s);return; }
    if (a === "request-skill") { const listing=state.skills.find((x)=>x.id===actionEl.dataset.id) || [...state.searchResults,...state.homeSearchResults].map((x)=>x.result || x).find((x)=>x.id===actionEl.dataset.id); if(!listing)return; modal("Request this service",`<form id="skill-request-form" class="form-stack"><input type="hidden" name="listingId" value="${esc(listing.id)}"><label class="floating-field"><input name="title" value="Request: ${esc(listing.title || "service")}" maxlength="160" required placeholder=" "><span>Request title</span></label><label class="floating-field"><textarea name="description" maxlength="3000" required placeholder=" "></textarea><span>What do you need?</span></label><label class="floating-field"><input name="budgetMinMinor" type="number" min="0" placeholder=" "><span>Minimum budget (minor units)</span></label><label class="floating-field"><input name="budgetMaxMinor" type="number" min="0" placeholder=" "><span>Maximum budget (minor units)</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-skill-request">Send request</button>`,{wide:true});return; }
    if (a === "submit-skill-request") { const d=Object.fromEntries(new FormData(document.getElementById("skill-request-form"))); await api.createSkillRequest({title:String(d.title || "").trim(),description:String(d.description || "").trim(),listingId:d.listingId,currency:"NGN",budgetMinMinor:d.budgetMinMinor ? safeMinor(d.budgetMinMinor) : null,budgetMaxMinor:d.budgetMaxMinor ? safeMinor(d.budgetMaxMinor) : null}); closeModal();toast("Skill request sent.","success");return; }
    if (a === "create-skill-listing") { if(!state.skillProfile){go("skill-onboarding");return;} openSkillListingEditor();return; }
    if (a === "edit-skill-listing") { const s=state.skillListingsMine.find((x)=>x.id===actionEl.dataset.id); if(s)openSkillListingEditor(s);return; }
    if (a === "pause-skill-listing" || a === "activate-skill-listing") { await api.updateSkillListing({listingId:actionEl.dataset.id,status:a === "activate-skill-listing" ? "active" : "paused"});toast(a === "activate-skill-listing" ? "Service offered again." : "Service paused.","success");await loadSkillWorkspace();paint();return; }
    if (a === "delete-skill-listing") { await api.deleteSkillListing({listingId:actionEl.dataset.id});toast("Service archived.","success");await loadSkillWorkspace();paint();return; }
    if (a === "market-view") { const m=state.products.find((x)=>(x.id || x.result?.id)===actionEl.dataset.id); if(m)openMarketProduct(m);return; }
    if (a === "submit-purchase") { const d=Object.fromEntries(new FormData(document.getElementById("purchase-form"))); const quantity=Math.max(1,Math.min(1000,Number(d.quantity||1))); await api.createMarketCommerceRequest({items:[{productId:d.productId,quantity}],customerNote:String(d.customerNote || "").trim()});closeModal();toast("Commerce request sent.","success");return; }
    if (a === "route-seller-onboarding") { state.sellerOnboardingStep=0;go("seller-onboarding");return; }
    if (a === "submit-store") { const d=Object.fromEntries(new FormData(document.getElementById("seller-details-form"))); if(state.myStore){await api.updateStoreProfile({storeId:state.myStore.id,name:String(d.name).trim(),description:String(d.description || "").trim(),locationText:String(d.location || "").trim()});toast("Store updated.","success");}else{const r=await api.createStore({name:String(d.name).trim(),description:String(d.description || "").trim(),category:String(d.category || "").trim(),location:String(d.location || "").trim()});state.sellerDraft={...state.sellerDraft,...d,storeId:r?.storeId || "",agreed:true};saveSellerDraft();toast("Store created.","success");}closeModal();await loadBusinessWorkspace();go("business");return; }
    if (a === "store-status-toggle") { await api.setStoreStatus({storeId:state.myStore.id,status:actionEl.dataset.status});toast(actionEl.dataset.status === "active" ? "Store is open." : "Store is paused.","success");await loadBusinessWorkspace();paint();return; }
    if (a === "create-product") { if(!state.myStore){go("seller-onboarding");return;}openProductEditor();return; }
    if (a === "edit-product") { const p=state.myProducts.find((x)=>x.id===actionEl.dataset.id);if(p)openProductEditor(p);return; }
    if (a === "submit-product") { const f=document.getElementById("product-form");const d=Object.fromEntries(new FormData(f));const id=actionEl.dataset.id;const payload={title:String(d.title || "").trim(),description:String(d.description || "").trim(),categoryId:String(d.categoryId || "") || null,priceMinor:safeMinor(d.priceMinor),currency:String(d.currency || "NGN").trim().toUpperCase(),tags:String(d.tags || "").split(",").map((x)=>x.trim()).filter(Boolean)};if(id)await api.updateProduct({productId:id,...payload});else await api.createProduct({storeId:state.myStore.id,...payload,mediaIds:[]});closeModal();toast(id ? "Product updated." : "Product created.","success");await loadBusinessWorkspace();paint();return; }
    if (a === "inventory-product") { const p=state.myProducts.find((x)=>x.id===actionEl.dataset.id);if(!p)return;modal("Update inventory",`<form id="inventory-form" class="form-stack"><input type="hidden" name="productId" value="${esc(p.id)}"><label class="floating-field"><input name="inventoryQuantity" type="number" min="1" max="1000000" value="${Number(p.inventoryQuantity || 0)}" required placeholder=" "><span>Inventory quantity</span></label></form>`,`<button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="button" data-action="submit-inventory">Save stock</button>`);return; }
    if (a === "submit-inventory") { const d=Object.fromEntries(new FormData(document.getElementById("inventory-form"))); await api.setProductInventory({productId:d.productId,inventoryQuantity:Math.max(1,Math.floor(Number(d.inventoryQuantity||1)))});closeModal();toast("Inventory updated.","success");await loadBusinessWorkspace();paint();return; }
    if (a === "activate-product" || a === "pause-product") { await api.setProductAvailability({productId:actionEl.dataset.id,status:a === "activate-product" ? "active" : "paused"});toast(a === "activate-product" ? "Product activated." : "Product paused.","success");await loadBusinessWorkspace();paint();return; }
    if (a === "archive-product") { await api.archiveProduct({productId:actionEl.dataset.id});toast("Product archived.","success");await loadBusinessWorkspace();paint();return; }
    if (a === "commerce-status") { await api.updateMarketCommerceRequestStatus({requestId:actionEl.dataset.id,status:actionEl.dataset.status});toast("Commerce request updated.","success");await loadBusinessWorkspace();paint();return; }
    if (a === "edit-profile") { openProfileEdit();return; }
    if (a === "submit-profile") { const d=Object.fromEntries(new FormData(document.getElementById("profile-form"))); await api.updateProfile({displayName:String(d.displayName).trim(),username:String(d.username).trim().replace(/^@/,"").toLowerCase(),bio:String(d.bio || "").trim(),location:String(d.location || "").trim()}); await updateAuthProfile(state.user,{displayName:String(d.displayName).trim()}); state.profile={...state.profile,...d,displayName:String(d.displayName).trim()};closeModal();toast("Profile updated.","success");paint();return; }
    if (a === "read-notification") { await api.markNotificationRead({notificationId:actionEl.dataset.id});await loadNotifications();paint();return; }
    if (a === "enable-notifications") { await enableBrowserNotifications(); return; }
    if (a === "disable-notifications") { await disableBrowserNotifications(); return; }
    if (a.startsWith("theme-")) { const t=a.slice(6);setTheme(t);paint();try{await api.updateUserSettings({themeId:t});}catch{}return; }
    if (a === "market-category") { state.marketCategory=actionEl.dataset.category || "all";paint();return; }
    if (a === "skills-category") { state.skillCategory=actionEl.dataset.category || "all";paint();return; }
    if (a === "onboarding-next") { const step=state.sellerOnboardingStep; if(step===2 && !document.getElementById("seller-agreement")?.checked){toast("Please accept the seller standards.","error");return;} if(step===3){const f=document.getElementById("seller-details-form");const d=f ? Object.fromEntries(new FormData(f)) : {};state.sellerDraft={...state.sellerDraft,...d,agreed:true};saveSellerDraft(); if(state.myStore) await api.updateStoreProfile({storeId:state.myStore.id,name:String(d.name).trim(),description:String(d.description || "").trim(),locationText:String(d.location || "").trim()}); else {const r=await api.createStore({name:String(d.name).trim(),description:String(d.description || "").trim(),category:String(d.category || "").trim(),location:String(d.location || "").trim()});state.sellerDraft.storeId=r?.storeId || "";} await loadBusinessWorkspace();go("business");return;} state.sellerOnboardingStep++;paint();return; }
    if (a === "onboarding-back") { if(state.sellerOnboardingStep>0){state.sellerOnboardingStep--;paint();}return; }
    if (a === "skill-onboarding-next") { const step=state.skillOnboardingStep;const f=document.getElementById("skill-details-form");if(f){const d=Object.fromEntries(new FormData(f));state.skillDraft={...state.skillDraft,...d};saveSkillDraft();} if(step===3){const d=state.skillDraft;const categories=String(d.category || "").trim();await api.upsertSkillProfile({headline:String(d.headline || "").trim(),bio:String(d.bio || "").trim(),locationText:String(d.locationText || "").trim(),remote:String(d.remote) !== "false",yearsExperience:Math.max(0,Math.min(80,Math.floor(Number(d.yearsExperience || 0)))),categories:categories ? [categories] : []}); if(d.listingTitle && d.listingDescription && d.category){await api.createSkillListing({title:String(d.listingTitle).trim(),description:String(d.listingDescription).trim(),categoryId:String(d.category),currency:String(d.currency || "NGN"),priceFromMinor:d.priceFromMinor === "" ? null : safeMinor(d.priceFromMinor),deliveryTimeDays:d.deliveryTimeDays === "" ? null : Math.max(1,Math.min(365,Math.floor(Number(d.deliveryTimeDays)))),tags:String(d.tags || "").split(",").map((x)=>x.trim()).filter(Boolean)});} state.skillDraft={...state.skillDraft,skillProfileUid:state.user.uid};saveSkillDraft();toast("Provider profile saved.","success");await loadSkillWorkspace();go("skill-profile");return;} state.skillOnboardingStep++;paint();return; }
    if (a === "skill-onboarding-back") { if(state.skillOnboardingStep>0){state.skillOnboardingStep--;paint();}return; }
    if (a === "submit-skill-listing") { const d=Object.fromEntries(new FormData(document.getElementById("skill-listing-form")));const id=actionEl.dataset.id;const payload={title:String(d.title || "").trim(),description:String(d.description || "").trim(),categoryId:String(d.categoryId || ""),currency:"NGN",priceFromMinor:d.priceFromMinor === "" ? null : safeMinor(d.priceFromMinor),deliveryTimeDays:d.deliveryTimeDays === "" ? null : Math.max(1,Math.min(365,Math.floor(Number(d.deliveryTimeDays)))),tags:String(d.tags || "").split(",").map((x)=>x.trim()).filter(Boolean)};if(id)await api.updateSkillListing({listingId:id,...payload});else await api.createSkillListing(payload);closeModal();toast(id ? "Listing updated." : "Listing published.","success");await loadSkillWorkspace();paint();return; }
  } catch (err) { console.error("[Marvel Chat] action failed", a, err?.code, err?.message, err); toast(friendlyError(err),"error"); }
});

document.addEventListener("change", (e) => {
  const input = e.target;
  if (input?.id === "post-media" && input.files) {
    try {
      const files = validateHomeFiles(input.files);
      state.pendingMediaFiles = files;
      const box = document.getElementById("post-media-preview");
      if (box) {
        box.innerHTML = files.map((file) => `<div class="selected-media"><span>${file.type.startsWith("video/") ? icon("video",17) : icon("camera",17)}</span><div><strong>${esc(file.name)}</strong><small>${(file.size / 1024 / 1024).toFixed(2)} MiB</small></div></div>`).join("");
      }
    } catch (error) {
      state.pendingMediaFiles = [];
      input.value = "";
      toast(error.message,"error");
    }
  }
  if(input?.id === "moment-photo" && input.files?.[0]) { state.pendingMomentFile=input.files[0]; const box=document.getElementById("moment-photo-preview"); if(box){box.innerHTML=`<img src="${URL.createObjectURL(input.files[0])}" alt="Selected Moment preview">`; } }
});

document.addEventListener("submit", async (e) => {
  const f=e.target;if(!f)return;
  try {
    if(f.id === "signup-form"){e.preventDefault();await signup(f);toast("Your account is ready.","success");return;}
    if(f.id === "signin-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));try{await signInWithEmailAndPassword(auth,String(d.email).trim(),String(d.password));}catch(err){console.error("[Marvel Chat] email sign-in",err?.code,err?.message);throw err;}return;}
    if(f.id === "forgot-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));await sendPasswordResetEmail(auth,String(d.email).trim());toast("If an account matches that email, a reset link is on its way.","success");return;}
    if(f.id === "message-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));const text=String(d.text || "").trim();if(!text)return;await api.sendMessage({threadId:state.activeThreadId,text});f.reset();return;}
    if(f.id === "home-search-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));state.searchQuery=String(d.query || "").trim();if(state.searchQuery.length<2){state.homeSearchResults=[];paint();return;}const r=await api.search({query:state.searchQuery,scope:"all"});state.homeSearchResults=Array.isArray(r?.results)?r.results:[];paint();return;}
    if(f.id === "chat-person-search-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));state.chatSearchQuery=String(d.query || "").trim();if(state.chatSearchQuery.length<2){state.chatSearchResults=[];paint();return;}const r=await api.search({query:state.chatSearchQuery,scope:"users"});state.chatSearchResults=Array.isArray(r?.results)?r.results:[];paint();return;}
    if(f.id === "skills-search-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));state.skillsSearchQuery=String(d.query || "").trim();paint();return;}
    if(f.id === "search-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));state.searchQuery=String(d.query || "").trim();state.searchScope=String(d.scope || "all");if(state.searchQuery.length<2){state.searchResults=[];paint();return;}const r=await api.search({query:state.searchQuery,scope:state.searchScope});state.searchResults=Array.isArray(r?.results)?r.results:[];paint();return;}
    if(f.id === "market-form"){e.preventDefault();const d=Object.fromEntries(new FormData(f));state.searchQuery=String(d.query || "").trim();await loadMarket();paint();return;}
  } catch(err) { e.preventDefault(); console.error(err?.code,err?.message); toast(friendlyError(err),"error"); }
});

document.addEventListener("keydown", (e) => {
  if(e.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)){e.preventDefault();go("search");setTimeout(()=>document.querySelector('#search-form input[name="query"]')?.focus(),0);}
  if(e.target.matches(".composer textarea") && e.key === "Enter" && !e.shiftKey){e.preventDefault();e.target.form?.requestSubmit();}
});

if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
app.innerHTML=`<main class="splash"><section class="splash-card"><div class="brand-mark brand-mark-xl"><img src="./assets/brand/icon-512.png" alt="Marvel Chat"></div><h1>Marvel Chat</h1><p>by Davonium Technologies</p><div class="loader"><span></span></div></section></main>`;

onAuthStateChanged(auth, async (user) => {
  clearSubscriptions();
  state.user=user;
  state.activeThreadId=null;
  state.messages=[];
  if(!user){state.profile=null;state.skillProfile=null;state.myStore=null;state.route="home";authMode="welcome";paint();return;}
  try{await loadProfile();}catch(e){toast(friendlyError(e),"error");}
  try{ state.pushEnabled = typeof Notification !== "undefined" && Notification.permission === "granted"; }catch{}
  paint();
  void refreshRouteData(state.route);
});
