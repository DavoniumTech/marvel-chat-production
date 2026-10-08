import {initializeApp} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile as updateAuthProfile,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {getFunctions, httpsCallable} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken as getAppCheckToken
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";
import {
  getMessaging,
  isSupported as messagingSupported,
  getToken as getMessagingToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js";
import {firebaseConfig, appCheckSiteKey, vapidKey} from "./config.js";

export const firebaseApp = initializeApp(firebaseConfig);

let appCheck = null;
let messaging = null;

export function initAppCheck() {
  if (!appCheckSiteKey) return false;
  if (appCheck) return true;
  appCheck = initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
  return true;
}

// Initialize production App Check before constructing the Firebase services
// that will be used by the application.
initAppCheck();

export const auth = getAuth(firebaseApp);
void setPersistence(auth, browserLocalPersistence).catch(() => {});
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp, "europe-west1");

export async function appCheckReady() {
  if (!initAppCheck()) return false;
  try {
    await getAppCheckToken(appCheck, false);
    return true;
  } catch {
    return false;
  }
}

export async function getBrowserMessaging() {
  if (!vapidKey || !(await messagingSupported())) return null;
  if (!messaging) messaging = getMessaging(firebaseApp);
  return messaging;
}

export async function getBrowserFcmToken() {
  const msg = await getBrowserMessaging();
  if (!msg) return null;
  return getMessagingToken(msg, {vapidKey, serviceWorkerRegistration: await navigator.serviceWorker.ready});
}

export function onForegroundMessage(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}

export {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateAuthProfile,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  httpsCallable,
};
