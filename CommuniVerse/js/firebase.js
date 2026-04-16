// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut, 
  sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  arrayUnion, 
  arrayRemove, 
  limit, 
  increment 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  uploadBytes, 
  getDownloadURL, 
  uploadString 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

import { 
  getMessaging, 
  getToken, 
  onMessage 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-ZtbM5x37DbwBsC6-rmtKZjl1C8zuWwg",
  authDomain: "ommuniverse-04192010.firebaseapp.com",
  databaseURL: "https://ommuniverse-04192010-default-rtdb.firebaseio.com",
  projectId: "ommuniverse-04192010",
  storageBucket: "ommuniverse-04192010.firebasestorage.app",
  messagingSenderId: "568909441248",
  appId: "1:568909441248:web:8ad7f827872ad543b8c885",
  measurementId: "G-SYBWYTQVN2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { 
  app, auth, db, storage,
  // Auth
  GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail,
  // Firestore
  collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, arrayRemove, limit, increment,
  // Storage
  ref, uploadBytesResumable, uploadBytes, getDownloadURL, uploadString,
  // Messaging
  getMessaging, getToken, onMessage
};
