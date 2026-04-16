import { auth, db, storage, onAuthStateChanged, collection, query, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, orderBy, serverTimestamp, limit, ref, uploadBytesResumable, getDownloadURL } from './firebase.js';
import { postNotificationToUser } from './notifications.js';

const urlParams = new URLSearchParams(window.location.search);
const otherUid = urlParams.get('uid');

const chatName = document.getElementById('chatName');
const chatStatus = document.getElementById('chatStatus');
const chatAvatar = document.getElementById('chatAvatar');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const typingIndicator = document.getElementById('typingIndicator');
const gifBtn = document.getElementById('gifBtn');
const gifModal = document.getElementById('gifModal');
const gifSearch = document.getElementById('gifSearch');
const gifResults = document.getElementById('gifResults');
const GIPHY_API_KEY = "dc6zaTOxFJmzC"; // Public beta key

const voiceCallBtn = document.getElementById('voiceCallBtn');
const videoCallBtn = document.getElementById('videoCallBtn');
const snapMode = document.getElementById('snapMode');
const snapViewer = document.getElementById('snapViewer');
const snapTimer = document.getElementById('snapTimer');
const snapImgView = document.getElementById('snapImgView');
const snapVidView = document.getElementById('snapVidView');

let currentUser = null;
let currentUserName = null;
let chatId = null;
let typingTimeout = null;
let typingActive = false;
let lastTypingUpdate = 0;
const TYPING_UPDATE_THROTTLE = 1200;
let isSendingMessage = false;
let replyingTo = null;

window.viewSnap = (docId, fileUrl, fileType) => {
  snapViewer.style.display = 'flex';
  if (fileType && fileType.startsWith('video/')) {
    snapImgView.style.display = 'none';
    snapVidView.style.display = 'block';
    snapVidView.src = fileUrl;
    snapVidView.play();
  } else {
    snapVidView.style.display = 'none';
    snapImgView.style.display = 'block';
    snapImgView.src = fileUrl;
  }
  
  let timeLeft = 10;
  snapTimer.innerText = timeLeft + 's';
  const timer = setInterval(async () => {
    timeLeft--;
    snapTimer.innerText = timeLeft + 's';
    if (timeLeft <= 0) {
      clearInterval(timer);
      snapViewer.style.display = 'none';
      snapImgView.src = '';
      snapVidView.src = '';
      try { await deleteDoc(doc(db, "chats", chatId, "messages", docId)); } catch (e) {}
    }
  }, 1000);
};

if (!otherUid) { window.location.href = "home.html"; }

function getChatId(uid1, uid2) { return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`; }

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const currentUserSnap = await getDoc(doc(db, "users", user.uid));
    currentUserName = currentUserSnap.exists() ? currentUserSnap.data().name : (user.displayName || "Someone");
    chatId = getChatId(user.uid, otherUid);
    
    // Create chat metadata if not exists
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) {
      await setDoc(chatRef, { participants: [user.uid, otherUid], lastMessage: "", lastMessageTime: serverTimestamp() });
    }
    
    loadOtherUser();
    loadMessages();
    listenToTyping();
  } else {
    window.location.href = "index.html";
  }
});

async function loadOtherUser() {
  const otherUserRef = doc(db, "users", otherUid);
  onSnapshot(otherUserRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      chatName.innerText = data.name;
      chatStatus.innerText = data.isOnline ? "Online" : "Last seen " + formatLastSeen(data.lastSeen);
      chatAvatar.src = data.photoURL;
      chatName.onclick = () => window.location.href = `profile.html?uid=${otherUid}`;
      chatAvatar.onclick = () => window.location.href = `profile.html?uid=${otherUid}`;
    }
  });
}

function formatLastSeen(timestamp) {
  if (!timestamp) return "Recently";
  const date = timestamp.toDate();
  const now = new Date();
  if (now - date < 60000) return "Just now";
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function loadMessages() {
  const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"), limit(200));
  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      const messageId = change.doc.id;
      const isMe = data.senderId === currentUser.uid;
      if (change.type === "added") {
        const div = document.createElement('div');
        div.className = `message ${isMe ? 'msg-sent' : 'msg-received'} animate-slide-up`;
        div.id = `msg_${messageId}`;
        div.innerHTML = renderMessageContent(data, isMe, messageId);
        setupMessageInteractions(div, data, messageId, isMe);
        if (!isMe && !data.seen && !data.isEphemeral) markMessageAsSeen(messageId);
        messagesContainer.appendChild(div);
      } else if (change.type === "modified") {
        const div = document.getElementById(`msg_${messageId}`);
        if (div) {
          div.innerHTML = renderMessageContent(data, isMe, messageId);
          setupMessageInteractions(div, data, messageId, isMe);
        }
      } else if (change.type === "removed") {
        const div = document.getElementById(`msg_${messageId}`);
        if (div) div.remove();
      }
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

function renderMessageContent(data, isMe, docId) {
  let replyHtml = '';
  if (data.replyTo) {
    replyHtml = `<div class="msg-reply-node" style="background: rgba(0,0,0,0.05); padding: 5px 8px; border-left: 2px solid var(--primary-color); border-radius: 4px; margin-bottom: 5px; font-size: 11px; opacity: 0.8;">
      <div style="font-weight:bold; color:var(--primary-color);">${data.replyTo.senderName}</div>
      <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${data.replyTo.text}</div>
    </div>`;
  }
  let content = replyHtml;
  if (data.isEphemeral) {
    content += isMe ? `<div style="color:var(--secondary-color); font-weight:bold;"><i class="fa-solid fa-paper-plane"></i> Delivered Snap</div>` : `<button class="btn-primary" style="padding: 6px 12px; border-radius: 12px; font-size: 12px;" onclick="window.viewSnap('${docId}', '${data.fileUrl}', '${data.fileType}')">View Snap</button>`;
  } else if (data.fileUrl) {
    if (data.fileType?.startsWith('image/')) content += `<img src="${data.fileUrl}" class="msg-img">`;
    else if (data.fileType?.startsWith('audio/')) content += `<audio controls src="${data.fileUrl}" style="width:100%"></audio>`;
    else content += `<a href="${data.fileUrl}" target="_blank">Attachment</a>`;
  }
  if (data.text) content += `<div>${data.text}</div>`;
  if (data.isEdited) content += `<span style="font-size:9px; opacity:0.5;"> (edited)</span>`;
  
  let reactionsHtml = '<div class="reactions-list">';
  if (data.reactions) {
    const counts = {};
    Object.values(data.reactions).forEach(e => counts[e] = (counts[e]||0)+1);
    for (const [emoji, count] of Object.entries(counts)) reactionsHtml += `<span class="reaction-item">${emoji}${count>1?count:''}</span>`;
  }
  reactionsHtml += '</div>';

  const t = data.timestamp?.toDate() || new Date();
  const timeStr = t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0');
  const status = isMe ? `<span class="msg-status">${data.seen ? '✔✔' : '✔'}</span>` : '';
  return `${content}${reactionsHtml}<span class="msg-time">${timeStr}</span>${status}`;
}

function setupMessageInteractions(div, data, messageId, isMe) {
  div.oncontextmenu = (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, data, messageId, isMe);
  };
}

function showContextMenu(x, y, data, messageId, isMe) {
  const existing = document.getElementById('ctxMenu');
  if (existing) existing.remove();
  const menu = document.createElement('div');
  menu.id = 'ctxMenu';
  menu.className = 'glass-panel';
  menu.style.cssText = `position:fixed; top:${y}px; left:${x}px; z-index:1000; padding:8px; display:flex; flex-direction:column; gap:5px; min-width:120px;`;
  
  const emojis = ['👍','❤️','🔥','😂','😊','🎉','😎','🤦‍♂️','🫀','✨','✌️','🤞','🤔','🥲','😒'];
  const emojiRow = document.createElement('div');
  emojiRow.style.cssText = 'display:flex; gap:5px; padding-bottom:5px; border-bottom:1px solid var(--glass-border); margin-bottom:5px;';
  emojis.forEach(e => {
    const s = document.createElement('span'); s.innerText = e; s.style.cursor='pointer';
    s.onclick = () => { updateDoc(doc(db,"chats",chatId,"messages",messageId), {[`reactions.${currentUser.uid}`]: e}); menu.remove(); };
    emojiRow.appendChild(s);
  });
  menu.appendChild(emojiRow);

  const items = [
    { text: 'Reply', icon: 'fa-reply', click: () => { setReply(data, messageId); menu.remove(); } },
    { text: 'Copy', icon: 'fa-copy', click: () => { navigator.clipboard.writeText(data.text); menu.remove(); } }
  ];
  if (isMe && (new Date() - data.timestamp?.toDate()) < 300000) {
    items.push({ text: 'Edit', icon: 'fa-pen', click: () => { const t = prompt("Edit:", data.text); if(t) updateDoc(doc(db,"chats",chatId,"messages",messageId),{text:t,isEdited:true}); menu.remove(); } });
  }
  items.push({ text: 'Delete', icon: 'fa-trash', click: () => { if(confirm("Delete for all?")) deleteDoc(doc(db,"chats",chatId,"messages",messageId)); menu.remove(); } });

  items.forEach(i => {
    const d = document.createElement('div'); d.style.cssText = 'cursor:pointer; padding:5px; display:flex; align-items:center; gap:8px; font-size:13px;';
    d.innerHTML = `<i class="fa-solid ${i.icon}"></i> ${i.text}`;
    d.onclick = i.click;
    menu.appendChild(d);
  });
  document.body.appendChild(menu);
  document.onclick = (e) => { if(!menu.contains(e.target)) menu.remove(); };
}

function setReply(data, messageId) {
  replyingTo = { id: messageId, text: data.text || 'Media', senderName: data.senderId === currentUser.uid ? 'You' : chatName.innerText };
  let bar = document.getElementById('replyBar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'replyBar';
    bar.style.cssText = 'background:rgba(0,0,0,0.05); padding:8px; border-top:1px solid var(--glass-border); display:flex; align-items:center; gap:10px; font-size:12px;';
    document.querySelector('.chat-input-container').prepend(bar);
  }
  bar.innerHTML = `<div style="flex:1; border-left:2px solid var(--primary-color); padding-left:8px;">
    <b>Replying to ${replyingTo.senderName}</b><div>${replyingTo.text}</div>
  </div><i class="fa-solid fa-xmark" onclick="this.parentElement.remove(); replyingTo=null;"></i>`;
}

async function markMessageAsSeen(id) {
  await updateDoc(doc(db, "chats", chatId, "messages", id), { seen: true });
}

async function sendMessage(text) {
  if (isSendingMessage) return;
  const msgText = text.trim();
  if (!msgText) return;
  
  isSendingMessage = true;
  messageInput.value = '';
  const currentReply = replyingTo;
  if (document.getElementById('replyBar')) document.getElementById('replyBar').remove();
  replyingTo = null;

  try {
    const payload = { senderId: currentUser.uid, text: msgText, timestamp: serverTimestamp(), seen: false, replyTo: currentReply };
    await Promise.all([
      addDoc(collection(db, "chats", chatId, "messages"), payload),
      updateDoc(doc(db, "chats", chatId), { lastMessage: msgText, lastMessageTime: serverTimestamp() }),
      updateDoc(doc(db, "users", currentUser.uid), { messagesSent: increment(1) })
    ]);
    postNotificationToUser(otherUid, currentUserName + " sent a message", msgText).catch(console.error);
  } finally { isSendingMessage = false; }
}

gifBtn.onclick = () => {
    gifModal.style.display = 'flex';
    fetchGiphy('trending');
};

gifSearch.oninput = () => {
    const term = gifSearch.value.trim();
    if(term.length > 2) fetchGiphy(term);
};

async function fetchGiphy(term) {
    const url = term === 'trending' 
        ? `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20`
        : `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${term}&limit=20`;
    
    const resp = await fetch(url);
    const data = await resp.json();
    gifResults.innerHTML = '';
    data.data.forEach(gif => {
        const img = document.createElement('img');
        img.src = gif.images.fixed_height_small.url;
        img.style.cursor = 'pointer';
        img.style.width = '100%';
        img.onclick = () => {
           sendGif(gif.images.fixed_height.url);
           gifModal.style.display = 'none';
        };
        gifResults.appendChild(img);
    });
}

async function sendGif(url) {
    const payload = { senderId: currentUser.uid, fileUrl: url, fileType: 'image/gif', timestamp: serverTimestamp(), seen: false };
    await addDoc(collection(db, "chats", chatId, "messages"), payload);
    updateDoc(doc(db, "users", currentUser.uid), { messagesSent: increment(1) });
}

sendBtn.onclick = () => sendMessage(messageInput.value);
messageInput.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(messageInput.value); }};

fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const refPath = ref(storage, `chat_files/${chatId}/${Date.now()}_${file.name}`);
  const uploadTask = uploadBytesResumable(refPath, file);
  uploadTask.on('state_changed', null, null, async () => {
    const url = await getDownloadURL(uploadTask.snapshot.ref);
    addDoc(collection(db, "chats", chatId, "messages"), { senderId: currentUser.uid, fileUrl: url, fileType: file.type, timestamp: serverTimestamp(), seen: false });
  });
};

messageInput.addEventListener('input', () => {
  if (Date.now() - lastTypingUpdate < 1500) return;
  lastTypingUpdate = Date.now();
  updateDoc(doc(db, "chats", chatId), { [`typing_${currentUser.uid}`]: true });
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => updateDoc(doc(db, "chats", chatId), { [`typing_${currentUser.uid}`]: false }), 3000);
});

function listenToTyping() {
  onSnapshot(doc(db, "chats", chatId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      typingIndicator.style.display = data[`typing_${otherUid}`] ? 'block' : 'none';
      if (data[`typing_${otherUid}`]) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });
}

voiceCallBtn.onclick = () => window.location.href = `call.html?uid=${otherUid}&type=voice&init=true`;
videoCallBtn.onclick = () => window.location.href = `call.html?uid=${otherUid}&type=video&init=true`;
