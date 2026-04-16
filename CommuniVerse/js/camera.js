import { auth, db, onAuthStateChanged, getStorage, ref, uploadString, getDownloadURL } from './firebase.js';

const videoElement = document.getElementById('videoElement');
const photoPreview = document.getElementById('photoPreview');
const captureBtn = document.getElementById('captureBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const filtersList = document.getElementById('filtersList');
const cameraControls = document.getElementById('cameraControls');
const previewActions = document.getElementById('previewActions');
const addToStoryBtn = document.getElementById('addToStoryBtn');
const downloadBtn = document.getElementById('downloadBtn');

let currentStream = null;
let useFrontCamera = true;
let capturedDataUrl = null;

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "index.html";
});

async function initCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  const constraints = {
    video: {
      facingMode: useFrontCamera ? "user" : "environment",
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    },
    audio: false
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = currentStream;
  } catch (err) {
    console.error("Camera access denied or unavailable", err);
    alert("Camera access denied or unavailable. Please check permissions.");
  }
}

switchCameraBtn.addEventListener('click', () => {
  useFrontCamera = !useFrontCamera;
  initCamera();
});

captureBtn.addEventListener('click', () => {
  if (!currentStream) return;
  
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  
  // Apply current CSS filter to canvas context before drawing
  ctx.filter = getComputedStyle(videoElement).filter;
  if(useFrontCamera) {
     // Flip horizontally for front camera to act like a mirror
     ctx.translate(canvas.width, 0);
     ctx.scale(-1, 1);
  }
  
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  capturedDataUrl = canvas.toDataURL('image/png');
  
  photoPreview.src = capturedDataUrl;
  photoPreview.classList.remove('hidden');
  videoElement.classList.add('hidden');
  
  cameraControls.classList.add('hidden');
  previewActions.style.display = 'flex';
  filtersList.classList.add('hidden');
});

filtersList.addEventListener('click', (e) => {
  if (e.target.classList.contains('filter-btn')) {
     const filterVal = e.target.getAttribute('data-filter');
     videoElement.style.filter = filterVal;
     
     document.querySelectorAll('.filter-btn').forEach(el=>el.classList.remove('active'));
     e.target.classList.add('active');
  }
});

downloadBtn.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = capturedDataUrl;
  a.download = `CommuniVerse_Snap_${Date.now()}.png`;
  a.click();
  alert("Saved to device");
});

addToStoryBtn.addEventListener('click', () => {
  sessionStorage.setItem('cameraCapture', capturedDataUrl);
  // We can pass the filter too if we want
  window.location.href = `create-post.html?fromCamera=true&target=story`;
});

initCamera();
