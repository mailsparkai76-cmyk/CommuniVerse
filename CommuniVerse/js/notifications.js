import { auth, db, app, getMessaging, getToken, onMessage, doc, setDoc, updateDoc, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit } from './firebase.js';

const VAPID_KEY = "joUge_t0zWlFR2wXBOmsOTdnlih_Cp9jFlHG0zuhd4c";
let messagingImportPromise = null;

function normalizeVapidKey(key) {
  let normalized = key.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4 !== 0) {
    normalized += '=';
  }
  return normalized;
}

async function ensureServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.');
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  if (registrations.length > 0) {
    return registrations[0];
  }

  return await navigator.serviceWorker.register('firebase-messaging-sw.js');
}

async function loadFirebaseMessaging() {
  if (!messagingImportPromise) {
    messagingImportPromise = import('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js');
  }
  return messagingImportPromise;
}

export async function registerPushNotifications() {
  if (!auth.currentUser) throw new Error("User must be signed in to enable notifications.");

  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Notification permission was denied.");
    }
  }

  const registration = await ensureServiceWorkerRegistration();
  const normalizedKey = normalizeVapidKey(VAPID_KEY);
  const messagingModule = await loadFirebaseMessaging();
  const messaging = messagingModule.getMessaging(app);
  const currentToken = await messagingModule.getToken(messaging, { vapidKey: normalizedKey, serviceWorkerRegistration: registration });
  if (!currentToken) {
    throw new Error("Could not obtain FCM token. Make sure your Firebase Web Push key is set.");
  }

  await setDoc(doc(db, "users", auth.currentUser.uid), { fcmToken: currentToken }, { merge: true });
  return currentToken;
}

export async function postNotificationToUser(targetUid, title, body) {
  if (!auth.currentUser) throw new Error("You must be signed in to post notifications.");
  if (!targetUid || !title || !body) throw new Error("Target user, title, and body are required.");

  return await addDoc(collection(db, "notifications", targetUid, "messages"), {
    senderId: auth.currentUser.uid,
    title,
    body,
    timestamp: serverTimestamp()
  });
}

export function listenForNotifications() {
  auth.onAuthStateChanged((user) => {
    if (!user) return;

    const notificationsQuery = query(
      collection(db, "notifications", user.uid, "messages"),
      orderBy("timestamp", "desc"),
      limit(20)
    );

    let initialSnapshot = true;
    onSnapshot(notificationsQuery, (snapshot) => {
      if (initialSnapshot) {
        initialSnapshot = false;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          if (Notification.permission === "granted") {
            new Notification(data.title, { body: data.body });
          }
        }
      });
    });
  });
}

export async function setupForegroundMessaging() {
  const messagingModule = await loadFirebaseMessaging();
  const messaging = messagingModule.getMessaging(app);

  messagingModule.onMessage(messaging, (payload) => {
    const title = payload.notification?.title || "CommuniVerse";
    const options = {
      body: payload.notification?.body || "",
      icon: payload.notification?.icon
    };

    if (Notification.permission === "granted") {
      new Notification(title, options);
    }
  });
}
