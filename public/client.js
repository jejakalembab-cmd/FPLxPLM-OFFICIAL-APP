// client.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { getDatabase, ref, push, query, orderByKey, limitToLast, onChildAdded, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDMeG8LGrHaB_Ywj10Tgroj-XcZjlDiog8",
  authDomain: "fplxplm-official-app.firebaseapp.com",
  databaseURL: "https://fplxplm-official-app-default-rtdb.firebaseio.com",
  projectId: "fplxplm-official-app",
  storageBucket: "fplxplm-official-app.appspot.com",
  messagingSenderId: "1054494209967",
  appId: "1:1054494209967:web:e447f6fe62b2a2712de15a"
};

const TENOR_KEY = "LIVDSRZULELA"; // untuk GIF search demo
const DEFAULT_LEAGUE = "meny2m";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// UI elements
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const userPic = document.getElementById('userPic');
const userNameEl = document.getElementById('userName');

const leagueIdInput = document.getElementById('leagueId');
const loadLeagueBtn = document.getElementById('loadLeague');
const standingsList = document.getElementById('standingsList');

const chatWindow = document.getElementById('chatWindow');
const nameInput = document.getElementById('nameInput');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const emojiBtn = document.getElementById('emojiBtn');
const gifBtn = document.getElementById('gifBtn');
const gifModal = document.getElementById('gifModal');
const gifResults = document.getElementById('gifResults');
const gifSearch = document.getElementById('gifQuery');
const gifSearchBtn = document.getElementById('gifSearch');
const gifClose = document.getElementById('gifClose');
const imgBtn = document.getElementById('imgBtn');
const imageUpload = document.getElementById('imageUpload');
const goChat = document.getElementById('goChat');

// Emoji picker from external script (pastikan ada load di index.html)
const picker = new EmojiButton({ position: 'top-end' });
emojiBtn.addEventListener('click', () => picker.togglePicker(emojiBtn));
picker.on('emoji', selection => {
  msgInput.value += selection.emoji;
  msgInput.focus();
});

// Google login
loginBtn.addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert('Login error: ' + (err.message || err));
  }
});

// Logout
logoutBtn?.addEventListener('click', async () => {
  await signOut(auth);
});

// Track auth state change
onAuthStateChanged(auth, user => {
  if (user) {
    loginBtn.classList.add('hidden');
    userInfo.classList.remove('hidden');
    userPic.src = user.photoURL || 'logo.png';
    userNameEl.textContent = user.displayName || user.email;
    nameInput.value = user.displayName || user.email.split('@')[0];
  } else {
    loginBtn.classList.remove('hidden');
    userInfo.classList.add('hidden');
    userPic.src = '';
    userNameEl.textContent = '';
    nameInput.value = '';
  }
});

// Load standings data from your API endpoint
async function loadStandings(league) {
  standingsList.textContent = "Loading...";
  try {
    const res = await fetch(`/api/league-standings?league_id=${encodeURIComponent(league)}`);
    const json = await res.json();
    let results = json.standings?.results || json.results || [];
    if (results.length === 0 && json.standings?.entries) results = json.standings.entries;
    standingsList.innerHTML = results.map(r =>
      `<div class="stand-row">
        <div><span class="name">#${r.rank} ${escapeHtml(r.entry_name)}</span><div class="meta">${escapeHtml(r.player_name)}</div></div>
        <div class="meta">${r.total ?? r.points ?? 0} pts</div>
      </div>`
    ).join('');
  } catch (e) {
    standingsList.textContent = "Gagal load standings";
  }
}

loadLeagueBtn.addEventListener('click', () => loadStandings(leagueIdInput.value.trim() || DEFAULT_LEAGUE));
leagueIdInput.value = DEFAULT_LEAGUE;
loadStandings(DEFAULT_LEAGUE);

// Chatroom logic
const leagueName = document.querySelector('.app-sub')?.innerText || DEFAULT_LEAGUE;
const chatPath = `chats/${leagueName.replace(/\W/g, '_')}`;

let oldestKey = null;

// Load last 20 messages once
async function loadLatestMessages() {
  const msgsQuery = query(ref(db, chatPath), orderByKey(), limitToLast(20));
  const snapshot = await get(msgsQuery);
  const data = snapshot.val() || {};
  chatWindow.innerHTML = '';
  const entries = Object.entries(data);
  entries.forEach(([key, msg]) => {
    addMessageRow(msg, key);
    oldestKey = oldestKey || key;
  });

  // Listen to new messages realtime
  const newMsgQuery = query(ref(db, chatPath), orderByKey(), limitToLast(1));
  onChildAdded(newMsgQuery, snapshot => {
    const key = snapshot.key;
    const msg = snapshot.val();
    if (document.getElementById(`msg-${key}`)) return;
    addMessageRow(msg, key);
  });
}

// Load older messages when scroll to top
async function loadOlder() {
  if (!oldestKey) return;
  const olderQuery = query(ref(db, chatPath), orderByKey(), limitToLast(21), /* endAt */);
  // Firebase modular SDK doesn't support endAt with limitToLast directly, workaround needed or skip paging for now.
  // For simplicity, skipping loadOlder paging.
}

chatWindow.addEventListener('scroll', () => {
  if (chatWindow.scrollTop < 40) {
    loadOlder();
  }
});

loadLatestMessages();

function formatMessageText(text) {
  let t = escapeHtml(text);
  t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  t = t.replace(/_(.+?)_/g, '<i>$1</i>');
  t = t.replace(/==(.+?)==/g, '<span class="highlight">$1</span>');
  t = t.replace(/(https?:\/\/\S+\.(?:png|jpe?g|gif))(?![^<]*>)/gi, '<img src="$1" class="chat-img">');
  return t;
}

function addMessageRow(m, key) {
  const div = document.createElement('div');
  div.id = `msg-${key}`;
  const isMe = auth.currentUser && (m.senderUid === auth.currentUser.uid);
  div.className = 'msg-row ' + (isMe ? 'msg-right' : 'msg-left');
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.innerText = (m.name || 'U').charAt(0).toUpperCase();
  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + (isMe ? 'bubble-right' : 'bubble-left');
  bubble.innerHTML = `<div><strong>${escapeHtml(m.name || 'Anon')}</strong></div>
                      <div class="msg-body">${formatMessageText(m.text || '')}</div>
                      <div class="meta">${new Date(m.ts || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>`;
  if (isMe) {
    div.appendChild(bubble);
    div.appendChild(avatar);
  } else {
    div.appendChild(avatar);
    div.appendChild(bubble);
  }
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

sendBtn.addEventListener('click', async () => {
  if (!auth.currentUser) {
    alert('Sila login dengan Google dahulu');
    return;
  }
  const text = msgInput.value.trim();
  if (!text) return;
  const name = nameInput.value.trim() || auth.currentUser.displayName || 'Anon';
  const msg = { name, text, ts: Date.now(), senderUid: auth.currentUser.uid };
  await push(ref(db, chatPath), msg);
  msgInput.value = '';
});

msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendBtn.click();
});

// GIF modal handlers
gifBtn.addEventListener('click', () => gifModal.classList.remove('hidden'));
gifClose.addEventListener('click', () => gifModal.classList.add('hidden'));

gifSearchBtn.addEventListener('click', async () => {
  const q = gifSearch.value.trim();
  if (!q) return;
  gifResults.textContent = 'Mencari...';
  try {
    const res = await fetch(`https://g.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=24`);
    const j = await res.json();
    gifResults.innerHTML = '';
    (j.results || []).forEach(item => {
      const url = item.media[0].gif.url;
      const img = document.createElement('img');
      img.src = url;
      img.className = 'chat-gif';
      img.style.cursor = 'pointer';
      img.onclick = async () => {
        if (!auth.currentUser) {
          alert('Login needed');
          return;
        }
        const name = nameInput.value.trim() || auth.currentUser.displayName || 'Anon';
        const m = { name, text: url, ts: Date.now(), senderUid: auth.currentUser.uid };
        await push(ref(db, chatPath), m);
        gifModal.classList.add('hidden');
      };
      gifResults.appendChild(img);
    });
  } catch (e) {
    gifResults.textContent = 'Gagal cari GIF';
  }
});

// Note: Storage image upload with modular SDK is possible but requires extra code,
// if nak saya buatkan storage image upload modular version, saya boleh tambah.

function escapeHtml(s) {
  return (s + '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}
