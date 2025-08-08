// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getDatabase, ref, push, onChildAdded } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

// ===== Firebase Config (dari projek awak) =====
const firebaseConfig = {
  apiKey: "AIzaSyDMeG8LGrHaB_Ywj10Tgroj-XcZjlDiog8",
  authDomain: "fplxplm-official-app.firebaseapp.com",
  databaseURL: "https://fplxplm-official-app-default-rtdb.firebaseio.com",
  projectId: "fplxplm-official-app",
  storageBucket: "fplxplm-official-app.firebasestorage.app",
  messagingSenderId: "1054494209967",
  appId: "1:1054494209967:web:e447f6fe62b2a2712de15a",
  measurementId: "G-660W7FMJCF"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getDatabase(app);

// ===== UI Elements =====
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userDisplay = document.getElementById("user");
const sendBtn = document.getElementById("sendBtn");
const messageInput = document.getElementById("message");
const chatBox = document.getElementById("chatBox");

// ===== Login with Google =====
loginBtn.addEventListener("click", () => {
  signInWithPopup(auth, provider)
    .catch(error => console.error(error));
});

// ===== Logout =====
logoutBtn.addEventListener("click", () => {
  signOut(auth);
});

// ===== Auth State Listener =====
onAuthStateChanged(auth, (user) => {
  if (user) {
    userDisplay.innerText = `Hi, ${user.displayName}`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    sendBtn.disabled = false;
  } else {
    userDisplay.innerText = "";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    sendBtn.disabled = true;
  }
});

// ===== Send Message =====
sendBtn.addEventListener("click", () => {
  if (!messageInput.value.trim()) return;
  push(ref(db, "messages"), {
    user: auth.currentUser.displayName,
    text: messageInput.value,
    time: new Date().toLocaleTimeString()
  });
  messageInput.value = "";
});

// ===== Load Messages Live =====
onChildAdded(ref(db, "messages"), (snapshot) => {
  const msg = snapshot.val();
  chatBox.innerHTML += `<p><strong>${msg.user}</strong>: ${msg.text} <small>${msg.time}</small></p>`;
  chatBox.scrollTop = chatBox.scrollHeight;
});
