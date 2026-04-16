import { auth, db, onAuthStateChanged, doc, onSnapshot, setDoc, deleteDoc, updateDoc, getDoc, serverTimestamp } from './firebase.js';

const remoteVideos = document.getElementById('remoteVideos');
const localVideo = document.getElementById('localVideo');
const callStatus = document.getElementById('callStatus');
const micBtn = document.getElementById('micBtn');
const camBtn = document.getElementById('camBtn');
const blurBtn = document.getElementById('blurBtn');
const endBtn = document.getElementById('endBtn');

const urlParams = new URLSearchParams(window.location.search);
const otherUid = urlParams.get('uid');
const type = urlParams.get('type') || 'video';
const isInitiator = urlParams.get('init') === 'true';

let localStream = null;
let pc = null;
let currentUser = null;

const servers = {
  iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }],
  iceCandidatePoolSize: 10,
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    if (!otherUid) { window.location.href = "home.html"; return; }
    await startCall();
  } else { window.location.href = "index.html"; }
});

async function startCall() {
  callStatus.innerText = isInitiator ? "Calling..." : "Connecting...";
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: type === 'video',
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    localVideo.srcObject = localStream;
  } catch (err) {
    callStatus.innerText = "Access Denied";
    return;
  }

  pc = new RTCPeerConnection(servers);
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = (event) => {
    const remoteVideo = document.createElement('video');
    remoteVideo.autoplay = true;
    remoteVideo.playsinline = true;
    remoteVideo.srcObject = event.streams[0];
    remoteVideos.innerHTML = '';
    remoteVideos.appendChild(remoteVideo);
    callStatus.innerText = "On Call";
  };

  const callId = isInitiator ? otherUid : currentUser.uid;
  const callRef = doc(db, "calls", callId);

  if (isInitiator) {
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    await setDoc(callRef, { type, callerId: currentUser.uid, offer: { type: offerDescription.type, sdp: offerDescription.sdp }, createdAt: serverTimestamp() });
    onSnapshot(callRef, (snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });
  } else {
    const callSnap = await getDoc(callRef);
    if (callSnap.exists()) {
      await pc.setRemoteDescription(new RTCSessionDescription(callSnap.data().offer));
      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);
      await updateDoc(callRef, { answer: { type: answerDescription.type, sdp: answerDescription.sdp } });
    }
  }

  onSnapshot(callRef, (snapshot) => { if (!snapshot.exists()) endCall(false); });
}

function endCall(notifyOther = true) {
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  if (pc) pc.close();
  if (notifyOther && currentUser) {
    const callId = isInitiator ? otherUid : currentUser.uid;
    deleteDoc(doc(db, "calls", callId)).catch(e => console.error(e));
  }
  window.location.href = "home.html";
}

micBtn.onclick = () => {
  const t = localStream.getAudioTracks()[0];
  t.enabled = !t.enabled;
  micBtn.querySelector('i').className = t.enabled ? 'fa-solid fa-microphone' : 'fa-solid fa-microphone-slash';
  micBtn.classList.toggle('danger', !t.enabled);
};

camBtn.onclick = () => {
  if (type === 'voice') return;
  const t = localStream.getVideoTracks()[0];
  t.enabled = !t.enabled;
  camBtn.querySelector('i').className = t.enabled ? 'fa-solid fa-video' : 'fa-solid fa-video-slash';
  camBtn.classList.toggle('danger', !t.enabled);
};

blurBtn.onclick = () => {
  localVideo.style.filter = localVideo.style.filter === 'blur(10px)' ? 'none' : 'blur(10px)';
  blurBtn.classList.toggle('active');
};

endBtn.onclick = () => endCall();
