import { auth, db, signOut, onAuthStateChanged, collection, query, where, onSnapshot, doc, getDoc, orderBy, deleteDoc, setDoc, updateDoc, increment, serverTimestamp } from './firebase.js';

const chatsContainer = document.getElementById('chatsContainer');

const openMenuBtn = document.getElementById('openMenuBtn');
const menuAvatar = document.getElementById('menuAvatar');
const menuName = document.getElementById('menuName');
const menuUsername = document.getElementById('menuUsername');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const sideMenu = document.getElementById('sideMenu');
const menuOverlay = document.getElementById('menuOverlay');
const logoutBtn = document.getElementById('logoutBtn');

let currentUser = null;
const userCache = new Map();

function toggleMenu() {
  sideMenu.classList.toggle('open');
  menuOverlay.classList.toggle('open');
}
if(openMenuBtn) openMenuBtn.addEventListener('click', toggleMenu);
if(closeMenuBtn) closeMenuBtn.addEventListener('click', toggleMenu);
if(menuOverlay) menuOverlay.addEventListener('click', toggleMenu);

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}

function listenForIncomingCalls(uid) {
  const callRef = doc(db, "calls", uid);
  onSnapshot(callRef, async (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (!data.answer) {
         const callerSnap = await getDoc(doc(db, "users", data.callerId));
         const callerName = callerSnap.exists() ? callerSnap.data().name : "Someone";
         
         const accept = confirm(`Incoming ${data.type} call from ${callerName}! Answer?`);
         if (accept) {
           window.location.href = `call.html?uid=${uid}&init=false`;
         } else {
           await deleteDoc(callRef); 
         }
      }
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user && window.location.pathname.endsWith('home.html')) {
    currentUser = user;
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (menuName) menuName.innerText = data.name;
        if (menuUsername) menuUsername.innerText = data.username;
        
        if (menuAvatar) {
          menuAvatar.src = data.photoURL;
          menuAvatar.classList.remove('hidden');
        }
        
        loadChats();
        listenForIncomingCalls(user.uid);
        updateUserStreak(userRef, data);
      } else {
        const baseName = user.displayName || (user.email ? user.email.split('@')[0] : "User");
        const safeName = baseName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        
        await setDoc(userRef, {
          uid: user.uid,
          name: baseName,
          email: user.email || "",
          phone: user.phoneNumber || "",
          photoURL: user.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(baseName) + "&background=8b5cf6&color=fff",
          username: `@${safeName}${randomNum}`,
          isOnline: true,
          lastSeen: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
      chatsContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--danger-color);"><b>Firebase Error:</b><br/>${error.message}<br/><br/><i>Have you updated your Firestore Security Rules? Copy them from firebase-rules.txt to your Firebase Console!</i></div>`;
    }
  } else if (!user) {
    if (window.location.pathname.endsWith('home.html')) {
        window.location.href = "index.html";
    }
  }
});

function loadChats() {
  const q = query(collection(db, "chats"), where("participants", "array-contains", currentUser.uid));
  onSnapshot(q, async (snapshot) => {
    chatsContainer.innerHTML = '';
    if (snapshot.empty) {
      chatsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No chats yet. Switch to All Users to start!</div>';
      return;
    }
    
    const docs = snapshot.docs.slice();
    docs.sort((a, b) => {
      const timeA = a.data().lastMessageTime ? a.data().lastMessageTime.toMillis() : 0;
      const timeB = b.data().lastMessageTime ? b.data().lastMessageTime.toMillis() : 0;
      return timeB - timeA;
    });

    let items = [];
    try {
      items = await Promise.all(docs.map(async (docSnap) => {
        const data = docSnap.data();
        const otherUid = data.participants.find(uid => uid !== currentUser.uid);
        if (!otherUid) return null;

        let otherUser = userCache.get(otherUid);
        if (!otherUser) {
          const otherUserSnap = await getDoc(doc(db, "users", otherUid));
          if (!otherUserSnap.exists()) return null;
          otherUser = otherUserSnap.data();
          userCache.set(otherUid, otherUser);
        }

        let lastMsg = data.lastMessage || "Started a chat";
        let displayTime = "";
        if (data.lastMessageTime) {
          const t = data.lastMessageTime.toDate();
          displayTime = t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0');
        }

        const item = document.createElement('div');
        item.className = 'chat-item';
        item.onclick = () => window.location.href = `chat.html?uid=${otherUid}`;
        item.innerHTML = `
          <img src="${otherUser.photoURL}" class="avatar avatar-md">
          <div class="chat-item-info">
            <div class="chat-name">
              ${otherUser.name}
              <span class="chat-time">${displayTime}</span>
            </div>
            <div class="chat-last-msg">${lastMsg}</div>
          </div>
        `;
        return item;
      }));
    } catch (err) {
      console.error("Error processing chats:", err);
      chatsContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--danger-color);">Error processing chats.</div>`;
      return;
    }

    items.filter(Boolean).forEach(item => chatsContainer.appendChild(item));
  }, (error) => {
    console.error("Error loading chats:", error);
    chatsContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--danger-color);">${error.message}</div>`;
  });
}

async function updateUserStreak(userRef, data) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const lastActive = data.lastActiveDate ? data.lastActiveDate.toDate() : null;
  const lastActiveTime = lastActive ? new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate()).getTime() : 0;

  if (lastActiveTime === today) return;

  let newStreak = data.streak || 0;
  if (today - lastActiveTime === 86400000) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }

  try {
    await updateDoc(userRef, {
      streak: newStreak,
      lastActiveDate: serverTimestamp(),
      totalActiveDays: increment(1)
    });
  } catch(e) { console.error("Streak update failed", e); }
}
