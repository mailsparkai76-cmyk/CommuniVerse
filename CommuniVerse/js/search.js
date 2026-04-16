import { auth, db, onAuthStateChanged, collection, query, onSnapshot, doc, getDoc, updateDoc, arrayUnion, arrayRemove, getDocs } from './firebase.js';

const usersContainer = document.getElementById('usersContainer');
const searchInput = document.getElementById('searchInput');

let currentUser = null;
let currentUserData = null;
let allUsers = [];

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    
    const userRef = doc(db, "users", user.uid);
    onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        currentUserData = docSnap.data();
        if (!currentUserData.following) currentUserData.following = [];
        renderUsers();
      }
    });

    loadAllUsers();
  } else {
    window.location.href = "index.html";
  }
});

async function loadAllUsers() {
  try {
    const snapshot = await getDocs(collection(db, "users"));
    allUsers = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.uid !== currentUser.uid) {
        allUsers.push(data);
      }
    });
    renderUsers();
  } catch (error) {
    console.error("Failed to load users:", error);
    if(usersContainer) usersContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger-color);">Unable to load users.</div>';
  }
}

function renderUsers() {
  if (!currentUserData || !usersContainer) return;
  const searchTerm = searchInput.value.toLowerCase().trim();
  
  usersContainer.innerHTML = '';
  
  const filteredUsers = allUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm) || 
    u.username.toLowerCase().includes(searchTerm)
  );

  if (filteredUsers.length === 0) {
    usersContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary);"><i class="fa-solid fa-ghost" style="font-size: 48px; opacity: 0.3; margin-bottom: 20px;"></i><br>No explorers found in this sector.</div>';
    return;
  }

  filteredUsers.forEach(user => {
    const isFollowing = currentUserData.following.includes(user.uid);
    const btnClass = isFollowing ? 'secondary' : 'primary';
    const btnText = isFollowing ? 'Following' : 'Follow';
    
    const div = document.createElement('div');
    div.className = 'user-card animate-slide-up';
    div.innerHTML = `
      <img src="${user.photoURL}" class="avatar avatar-md" onclick="window.location.href='profile.html?uid=${user.uid}'">
      <div class="user-card-info" onclick="window.location.href='profile.html?uid=${user.uid}'">
        <div class="user-card-name">${user.name}</div>
        <div class="user-card-username">${user.username}</div>
      </div>
      <button class="follow-btn ${btnClass}" id="followBtn_${user.uid}">${btnText}</button>
    `;
    usersContainer.appendChild(div);
    
    const btn = document.getElementById(`followBtn_${user.uid}`);
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      btn.innerHTML = '<span class="loader" style="width:14px; height:14px; border-width:2px;"></span>';
      await toggleFollow(user.uid, isFollowing);
    });
  });
}

if(searchInput) searchInput.addEventListener('input', renderUsers);

async function toggleFollow(targetUid, isCurrentlyFollowing) {
  if (!currentUser) return;
  
  const myRef = doc(db, "users", currentUser.uid);
  const targetRef = doc(db, "users", targetUid);
  
  try {
    if (isCurrentlyFollowing) {
      await updateDoc(myRef, { following: arrayRemove(targetUid) });
      await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
    } else {
      await updateDoc(myRef, { following: arrayUnion(targetUid) });
      await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
    }
  } catch (err) {
    console.error("Error toggling follow:", err);
    alert("Error updating follow status. " + err.message);
  }
}
