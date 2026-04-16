importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC-ZtbM5x37DbwBsC6-rmtKZjl1C8zuWwg",
  authDomain: "ommuniverse-04192010.firebaseapp.com",
  projectId: "ommuniverse-04192010",
  storageBucket: "ommuniverse-04192010.firebasestorage.app",
  messagingSenderId: "568909441248",
  appId: "1:568909441248:web:8ad7f827872ad543b8c885",
  measurementId: "G-SYBWYTQVN2"
});

const messaging = firebase.messaging();

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'CommuniVerse';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message.',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
