import { auth, db, signOut, onAuthStateChanged, collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, getDocs, limit, where } from './firebase.js';

const feedContainer = document.getElementById('feedContainer');
const storiesBar = document.getElementById('storiesBar');
const myStoryAvatar = document.getElementById('myStoryAvatar');

// Desktop Sidebar Elements
const desktopSidebar = document.getElementById('desktopSidebar');
const sidebarMyAvatar = document.getElementById('sidebarMyAvatar');
const sidebarMyName = document.getElementById('sidebarMyName');
const sidebarMyUsername = document.getElementById('sidebarMyUsername');
const suggestedUsers = document.getElementById('suggestedUsers');

const storyViewer = document.getElementById('storyViewer');
const storyProgressContainer = document.getElementById('storyProgressContainer');
const storyViewerAvatar = document.getElementById('storyViewerAvatar');
const storyViewerName = document.getElementById('storyViewerName');
const storyViewerTime = document.getElementById('storyViewerTime');
const storyImgView = document.getElementById('storyImgView');
const storyVidView = document.getElementById('storyVidView');
const closeStoryBtn = document.getElementById('closeStoryBtn');
const storyPrevBtn = document.getElementById('storyPrevBtn');
const storyNextBtn = document.getElementById('storyNextBtn');

let currentUser = null;
let currentUserData = null;
let visibleUids = []; 
let allUsersMap = {};

let groupedStories = [];
let activeGroupIndex = 0;
let activeStoryIndex = 0;
let storyTimer = null;
const STORY_DURATION = 5000;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const userRef = doc(db, "users", user.uid);
    onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        currentUserData = docSnap.data();
        if(myStoryAvatar) myStoryAvatar.src = currentUserData.photoURL;
        
        // Update Sidebar
        if(sidebarMyAvatar) sidebarMyAvatar.src = currentUserData.photoURL;
        if(sidebarMyName) sidebarMyName.innerText = currentUserData.name;
        if(sidebarMyUsername) sidebarMyUsername.innerText = currentUserData.username;
        
        visibleUids = currentUserData.following || [];
        visibleUids.push(currentUser.uid); 
        
        loadFeed();
        loadStories();
        loadSuggestedUsers();
      }
    });
    
    loadAllUsers();
  } else {
    window.location.href = "index.html";
  }
});

async function loadAllUsers() {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    allUsersMap = {};
    usersSnapshot.forEach((docSnap) => {
      allUsersMap[docSnap.id] = docSnap.data();
    });
    if (feedContainer && feedContainer.innerHTML !== '') loadFeed();
    if (storiesBar) loadStories();
  } catch (error) {
    console.error("Failed to load users:", error);
  }
}

async function loadSuggestedUsers() {
    if(!suggestedUsers) return;
    try {
        const q = query(collection(db, "users"), limit(5));
        const snap = await getDocs(q);
        suggestedUsers.innerHTML = '';
        snap.forEach(docSnap => {
            const data = docSnap.data();
            if(data.uid === currentUser.uid) return;
            
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'space-between';
            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; cursor: pointer;" onclick="window.location.href='profile.html?uid=${data.uid}'">
                    <img src="${data.photoURL}" class="avatar avatar-sm">
                    <div>
                        <div style="font-weight: 600; font-size: 13px;">${data.username}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">Suggested for you</div>
                    </div>
                </div>
                <span style="font-size: 12px; font-weight: 600; color: var(--primary-color); cursor: pointer;">Follow</span>
            `;
            suggestedUsers.appendChild(div);
        });
    } catch(e) { console.error(e); }
}

function timeSince(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m";
  return Math.floor(seconds) + "s";
}

function loadFeed() {
  if(!feedContainer) return;
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
  
  let isInitialLoad = true;
  onSnapshot(q, (snapshot) => {
    if (isInitialLoad) {
      feedContainer.innerHTML = '';
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (visibleUids.includes(data.authorId)) {
          feedContainer.appendChild(renderPostElement(data, docSnap.id));
        }
      });
      isInitialLoad = false;
    } else {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const postId = change.doc.id;
        
        if (!visibleUids.includes(data.authorId)) {
          const existing = document.getElementById(`post_${postId}`);
          if (existing) existing.remove();
          return;
        }

        if (change.type === "added") {
          const div = renderPostElement(data, postId);
          feedContainer.prepend(div);
        } else if (change.type === "modified") {
          const div = document.getElementById(`post_${postId}`);
          if (div) {
            const isLiked = data.likes && data.likes.includes(currentUser.uid);
            const likeBtn = div.querySelector('.fa-heart');
            const likesCount = div.querySelector('.likes-count');
            if (likeBtn) {
              likeBtn.className = `${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart`;
              likeBtn.style.color = isLiked ? 'var(--secondary-color)' : 'inherit';
            }
            if (likesCount) likesCount.innerText = `${data.likes ? data.likes.length : 0} likes`;
          }
        } else if (change.type === "removed") {
          const div = document.getElementById(`post_${postId}`);
          if (div) div.remove();
        }
      });
    }
  }, (error) => {
    console.error("Firestore Feed Error:", error);
    if(feedContainer) {
      feedContainer.innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger-color);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:40px;margin-bottom:15px;"></i><br>
        <strong>Firestore Error:</strong> ${error.message}<br>
        <span style="font-size:12px;opacity:0.8;">Hint: Ensure "communi-verse.edgeone.app" is whitelisted in your Firebase Console -> Authentication -> Settings -> Authorized Domains.</span>
      </div>`;
    }
  });
}

function renderPostElement(data, postId) {
  const author = allUsersMap[data.authorId] || { name: 'User', photoURL: 'images/icon.png', username: '@user' };
  const timeStr = data.createdAt ? timeSince(data.createdAt.toDate()) : 'Now';
  const isLiked = data.likes && data.likes.includes(currentUser.uid);
  const likeColor = isLiked ? 'var(--secondary-color)' : 'inherit';
  const heartIcon = isLiked ? 'fa-solid' : 'fa-regular';
  
  let mediaHtml = '';
  if (data.mediaType && data.mediaType.startsWith('video/')) {
    mediaHtml = `<video src="${data.mediaUrl}" controls playsinline></video>`;
  } else {
    mediaHtml = `<img src="${data.mediaUrl}" loading="lazy">`;
  }
  
  const div = document.createElement('div');
  div.className = 'feed-post animate-slide-up';
  div.id = `post_${postId}`;
  div.innerHTML = `
    <div class="post-header">
      <div class="post-user" onclick="window.location.href='profile.html?uid=${data.authorId}'">
        <img src="${author.photoURL}" class="avatar avatar-sm">
        <div class="post-username">${author.name} <span style="font-weight: 400; font-size: 13px; color: var(--text-secondary); opacity: 0.7; margin-left: 4px;">• ${timeStr}</span></div>
      </div>
      <i class="fa-solid fa-ellipsis" style="cursor: pointer; opacity: 0.6;"></i>
    </div>
    <div class="post-media" ondblclick="document.getElementById('likeToggle_${postId}').click()">
      ${mediaHtml}
    </div>
    <div class="post-actions">
      <i class="${heartIcon} fa-heart action-btn" id="likeToggle_${postId}" style="color: ${likeColor}"></i>
      <i class="fa-regular fa-comment action-btn" onclick="openComments('${postId}')"></i>
      <i class="fa-regular fa-paper-plane action-btn" onclick="window.location.href='chat.html?uid=${data.authorId}'"></i>
      <div style="flex: 1;"></div>
      <i class="fa-regular fa-bookmark action-btn"></i>
    </div>
    <div class="post-info">
      <span class="likes-count">${data.likes ? data.likes.length : 0} likes</span>
      <div class="post-caption"><span style="font-weight:700;">${author.name}</span> ${data.caption || ''}</div>
      <div class="post-comments-link" onclick="openComments('${postId}')">View all comments</div>
    </div>
  `;
  
  const likeBtn = div.querySelector(`#likeToggle_${postId}`);
  likeBtn.addEventListener('click', async () => {
     const postRef = doc(db, "posts", postId);
     const currentIsLiked = likeBtn.classList.contains('fa-solid');
     if (currentIsLiked) {
       await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
     } else {
       await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
     }
  });

  return div;
}

globalThis.openComments = (id) => alert("Comments coming soon in next update!");

function loadStories() {
  if(!storiesBar) return;
  const q = query(collection(db, "stories"), orderBy("createdAt", "asc"));
  
  onSnapshot(q, (snapshot) => {
    storiesBar.innerHTML = `
      <div class="story-bubble" onclick="window.location.href='create-post.html'">
          <div style="position: relative;">
            <img src="${currentUserData ? currentUserData.photoURL : 'images/icon.png'}" class="avatar avatar-md" style="padding: 2px;">
            <div class="add-story-icon"><i class="fa-solid fa-plus"></i></div>
          </div>
          <span class="story-author">Your Story</span>
      </div>
    `;
    
    let tempGroupMap = {};
    const now = Date.now();
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.createdAt) return;
      const ageMs = now - data.createdAt.toMillis();
      if (ageMs > 24 * 60 * 60 * 1000) {
        deleteDoc(doc(db, "stories", docSnap.id)).catch(e=>console.error(e));
        return;
      }
      if (!visibleUids.includes(data.authorId)) return;
      if (!tempGroupMap[data.authorId]) tempGroupMap[data.authorId] = [];
      tempGroupMap[data.authorId].push(data);
    });
    
    groupedStories = [];
    for (const uid in tempGroupMap) {
      const user = allUsersMap[uid] || { name: 'User', photoURL: 'images/icon.png' };
      groupedStories.push({ uid, user, stories: tempGroupMap[uid] });
      
      const div = document.createElement('div');
      div.className = 'story-bubble';
      div.innerHTML = `
        <div class="story-avatar" style="border: 2px solid var(--secondary-color); padding: 2px; border-radius: 50%;">
          <img src="${user.photoURL}" class="avatar avatar-md">
        </div>
        <div class="story-author">${uid === currentUser.uid ? 'Your Story' : user.name}</div>
      `;
      storiesBar.appendChild(div);
      
      const idx = groupedStories.length - 1;
      div.addEventListener('click', () => openStoryGroup(idx));
    }
  });
}

function openStoryGroup(gIndex) {
  if (gIndex >= groupedStories.length) {
    closeStoryViewer();
    return;
  }
  activeGroupIndex = gIndex;
  activeStoryIndex = 0;
  storyViewer.style.display = 'flex';
  renderCurrentStory();
}

function closeStoryViewer() {
  storyViewer.style.display = 'none';
  clearTimeout(storyTimer);
  storyVidView.pause();
  storyVidView.src = '';
  storyImgView.src = '';
}

function nextStory() {
  clearTimeout(storyTimer);
  const group = groupedStories[activeGroupIndex];
  if (activeStoryIndex < group.stories.length - 1) {
    activeStoryIndex++;
    renderCurrentStory();
  } else {
    openStoryGroup(activeGroupIndex + 1);
  }
}

function prevStory() {
  clearTimeout(storyTimer);
  if (activeStoryIndex > 0) {
    activeStoryIndex--;
    renderCurrentStory();
  } else {
    if (activeGroupIndex > 0) {
      openStoryGroup(activeGroupIndex - 1);
    } else {
      activeStoryIndex = 0;
      renderCurrentStory();
    }
  }
}

if(storyNextBtn) storyNextBtn.addEventListener('click', nextStory);
if(storyPrevBtn) storyPrevBtn.addEventListener('click', prevStory);
if(closeStoryBtn) closeStoryBtn.addEventListener('click', closeStoryViewer);

function renderCurrentStory() {
  const group = groupedStories[activeGroupIndex];
  const story = group.stories[activeStoryIndex];
  
  storyViewerName.innerText = group.user.name;
  storyViewerAvatar.src = group.user.photoURL;
  storyViewerTime.innerText = timeSince(story.createdAt.toDate());
  
  storyProgressContainer.innerHTML = '';
  for (let i = 0; i < group.stories.length; i++) {
    const bar = document.createElement('div');
    bar.className = 'story-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'story-progress-fill';
    
    if (i < activeStoryIndex) fill.style.width = '100%';
    else if (i === activeStoryIndex) {
      fill.style.width = '0%';
      setTimeout(() => fill.style.transition = `width ${STORY_DURATION}ms linear`, 10);
      setTimeout(() => fill.style.width = '100%', 20);
    } else fill.style.width = '0%';
    
    bar.appendChild(fill);
    storyProgressContainer.appendChild(bar);
  }
  
  if (story.mediaType && story.mediaType.startsWith('video/')) {
    storyImgView.classList.add('hidden');
    storyVidView.classList.remove('hidden');
    storyVidView.src = story.mediaUrl;
    storyVidView.play();
    storyVidView.onended = nextStory;
    clearTimeout(storyTimer);
  } else {
    storyVidView.classList.add('hidden');
    storyImgView.classList.remove('hidden');
    storyImgView.src = story.mediaUrl;
    storyTimer = setTimeout(nextStory, STORY_DURATION);
  }
}
