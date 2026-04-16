import { auth, db, storage, onAuthStateChanged, collection, addDoc, serverTimestamp, doc, setDoc, ref, uploadBytesResumable, getDownloadURL } from './firebase.js';

const uploadArea = document.getElementById('uploadArea');
const mediaInput = document.getElementById('mediaInput');
const previewContainer = document.getElementById('previewContainer');
const imgPreview = document.getElementById('imgPreview');
const vidPreview = document.getElementById('vidPreview');
const removeMediaBtn = document.getElementById('removeMediaBtn');

const captionInput = document.getElementById('captionInput');
const publishBtn = document.getElementById('publishBtn');
const typeFeed = document.getElementById('typeFeed');
const typeStory = document.getElementById('typeStory');
const filtersGroup = document.getElementById('filtersGroup');

let currentUser = null;
let currentFile = null;
let targetFeed = true;
let targetStory = false;
let activeFilter = 'none';

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    checkForCameraCapture();
  } else {
    window.location.href = "index.html";
  }
});

function checkForCameraCapture() {
    const urlParams = new URLSearchParams(window.location.search);
    const fromCamera = urlParams.get('fromCamera');
    const cameraUrl = fromCamera ? sessionStorage.getItem('cameraCapture') : urlParams.get('cameraUrl');
    const cameraFilter = sessionStorage.getItem('cameraFilter') || 'none';
    
    if (cameraUrl) {
      if (cameraUrl.startsWith('data:image')) {
        currentFile = dataURLtoFile(cameraUrl, 'camera_capture.png');
        showPreview(cameraUrl, 'image/png');
      } else {
         fetch(cameraUrl).then(res => res.blob()).then(blob => {
             currentFile = new File([blob], 'camera_capture.webm', {type: 'video/webm'});
             showPreview(cameraUrl, 'video/webm');
         });
      }
      
      activeFilter = cameraFilter;
      applyFilterToPreview(activeFilter);
      
      if (urlParams.get('target') === 'story') {
        setTarget('story');
      }
    }
}

function dataURLtoFile(dataurl, filename) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

function setTarget(type) {
  if (type === 'feed') {
    targetFeed = true; targetStory = false;
    typeFeed.classList.add('active');
    typeStory.classList.remove('active');
  } else {
    targetFeed = false; targetStory = true;
    typeStory.classList.add('active');
    typeFeed.classList.remove('active');
  }
}

if(typeFeed) typeFeed.addEventListener('click', () => setTarget('feed'));
if(typeStory) typeStory.addEventListener('click', () => setTarget('story'));

if(uploadArea) uploadArea.addEventListener('click', () => mediaInput.click());

if(mediaInput) mediaInput.addEventListener('change', (e) => {
  currentFile = e.target.files[0];
  if (!currentFile) return;
  const objectUrl = URL.createObjectURL(currentFile);
  showPreview(objectUrl, currentFile.type);
});

if(removeMediaBtn) removeMediaBtn.addEventListener('click', () => {
  currentFile = null;
  previewContainer.style.display = 'none';
  uploadArea.style.display = 'block';
  filtersGroup.style.display = 'none';
});

function showPreview(url, type) {
  uploadArea.style.display = 'none';
  previewContainer.style.display = 'block';
  filtersGroup.style.display = 'block';
  
  if (type.startsWith('image/')) {
    vidPreview.classList.add('hidden');
    imgPreview.classList.remove('hidden');
    imgPreview.src = url;
  } else {
    imgPreview.classList.add('hidden');
    vidPreview.classList.remove('hidden');
    vidPreview.src = url;
  }
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    applyFilterToPreview(activeFilter);
  });
});

function applyFilterToPreview(filter) {
    imgPreview.style.filter = filter;
    vidPreview.style.filter = filter;
}

async function handlePublish() {
  if (!currentFile) {
    alert("Please select media first!");
    return;
  }
  
  publishBtn.disabled = true;
  publishBtn.innerHTML = '<span class="loader"></span> Publishing...';
  
  const storageRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}_${currentFile.name}`);
  const uploadTask = uploadBytesResumable(storageRef, currentFile);
  
  uploadTask.on('state_changed', 
    null,
    (error) => {
      console.error(error);
      alert("Upload failed: " + error.message);
      publishBtn.disabled = false;
      publishBtn.innerHTML = 'Publish';
    }, 
    async () => {
      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
      
      const payload = {
        authorId: currentUser.uid,
        mediaUrl: downloadURL,
        mediaType: currentFile.type,
        caption: captionInput.value.trim(),
        filter: activeFilter,
        createdAt: serverTimestamp(),
      };
      
      try {
        const promises = [];
        if (targetFeed) {
          promises.push(addDoc(collection(db, "posts"), { ...payload, likes: [], comments: [] }));
        }
        if (targetStory) {
          promises.push(addDoc(collection(db, "stories"), payload));
        }
        
        await Promise.all(promises);
        
        sessionStorage.removeItem('cameraCapture');
        sessionStorage.removeItem('cameraFilter');
        window.location.href = 'feed.html';
      } catch (err) {
        console.error(err);
        alert("Error creating post: " + err.message);
        publishBtn.disabled = false;
        publishBtn.innerHTML = 'Publish';
      }
    }
  );
}

if(publishBtn) publishBtn.addEventListener('click', handlePublish);
