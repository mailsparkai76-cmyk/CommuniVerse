// js/auth.js
import { auth, db, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, doc, setDoc, getDoc, serverTimestamp } from './firebase.js';

const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authBtn = document.getElementById('authBtn');
const authTitle = document.getElementById('authTitle');
const toggleAuthText = document.getElementById('toggleAuthText');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const authError = document.getElementById('authError');
const forgotPassword = document.getElementById('forgotPassword');

let isLoginMode = true;

if (toggleAuthText) {
  toggleAuthText.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
      authTitle.innerHTML = 'Hello there,<br>Welcome Back';
      authBtn.innerText = "Login";
      toggleAuthText.innerText = "Don't have an account? Sign up";
      if(forgotPassword) forgotPassword.classList.remove('hidden');
    } else {
      authTitle.innerHTML = 'Create Your<br>Account';
      authBtn.innerText = "Sign Up";
      toggleAuthText.innerText = "Already have an account? Log in";
      if(forgotPassword) forgotPassword.classList.add('hidden');
    }
    showError('');
  });
}

function showError(msg) {
  if (!authError) return;
  if (msg) {
    authError.innerText = msg;
    authError.classList.remove('hidden');
  } else {
    authError.classList.add('hidden');
  }
}

function generateUsername(name) {
  const baseName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || "user";
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `@${baseName}${randomNum}`;
}

async function saveUserProfile(user, additionalData = {}) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    const name = additionalData.name || user.displayName || "CommuniVerse User";
    const username = generateUsername(name);
    
    await setDoc(userRef, {
      uid: user.uid,
      name: name,
      email: user.email || "",
      phone: additionalData.phone || user.phoneNumber || "",
      photoURL: user.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(name) + "&background=8b5cf6&color=fff",
      username: username,
      isOnline: true,
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
      streak: 0,
      totalActiveDays: 1,
      messagesSent: 0
    });
  } else {
    await setDoc(userRef, {
      isOnline: true,
      lastSeen: serverTimestamp()
    }, { merge: true });
  }
}

if (authBtn) {
  authBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!email || !password) {
      showError("Please fill in all fields.");
      return;
    }

    try {
      authBtn.innerHTML = '<span class="loader"></span>';
      showError('');
      
      if (isLoginMode) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await saveUserProfile(userCredential.user);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await saveUserProfile(userCredential.user);
      }
      
      window.location.href = "feed.html";
    } catch (error) {
      showError(error.message);
      authBtn.innerText = isLoginMode ? "Login" : "Sign Up";
    }
  });
}

if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
      showError('');
      const result = await signInWithPopup(auth, provider);
      await saveUserProfile(result.user);
      window.location.href = "feed.html";
    } catch (error) {
      showError(error.message);
    }
  });
}

if (forgotPassword) {
    forgotPassword.addEventListener('click', () => {
        const email = emailInput.value.trim();
        if(!email) {
            showError("Enter your email to reset password.");
            return;
        }
        // Firebase password reset logic could go here
        alert("Password reset link sent to " + email);
    });
}

onAuthStateChanged(auth, async (user) => {
  const path = window.location.pathname;
  const fileName = path.substring(path.lastIndexOf('/') + 1).toLowerCase();
  const isLoginPage = fileName === 'index.html' || fileName === '';

  if (user) {
    if (isLoginPage) {
      window.location.replace("feed.html");
    }
  } else {
    // If you want to force redirect to login from protected pages:
    /*
    if (!isLoginPage && !path.includes('privacy.html') && !path.includes('terms.html')) {
       window.location.replace("index.html");
    }
    */
  }
});
