// client.js (compat version) — paste replace file sedia ada

// --- MASUKKAN FIREBASE CONFIG AWAK DI SINI ---
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDMeG8LGrHaB_Ywj10Tgroj-XcZjlDiog8",
  authDomain: "fplxplm-official-app.firebaseapp.com",
  databaseURL: "https://fplxplm-official-app-default-rtdb.firebaseio.com",
  projectId: "fplxplm-official-app",
  storageBucket: "fplxplm-official-app.firebasestorage.app",
  messagingSenderId: "1054494209967",
  appId: "1:1054494209967:web:e447f6fe62b2a2712de15a",
  measurementId: "G-660W7FMJCF"
};
// -----------------------------------------------

const TENOR_KEY = "LIVDSRZULELA";
const DEFAULT_LEAGUE = "meny2m";

// init firebase (compat)
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.database();

// UI elements (must match index.html)
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

// emoji picker
const picker = new EmojiButton({ position: 'top-end' });
emojiBtn.addEventListener('click', () => picker.togglePicker(emojiBtn));
picker.on('emoji', sel => { msgInput.value += sel.emoji; msgInput.focus(); });

// LOGIN: try popup, if fails (mobile), fallback to redirect
loginBtn.addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (err) {
    console.log('signin popup failed, fallback to redirect', err.code, err.message);
    // mobile browsers often block popup — use redirect
    try { auth.signInWithRedirect(provider); } catch (e) { alert('Login failed: ' + e.message); }
  }
});

// LOGOUT
logoutBtn?.addEventListener('click', async () => {
  await auth.signOut();
});

// Enable send button only when logged in
auth.onAuthStateChanged(user => {
  if (user) {
    loginBtn.style.display = 'none';
    userInfo.style.display = 'flex';
    userPic.src = user.photoURL || 'logo.png';
    userNameEl.innerText = user.displayName || user.email;
    nameInput.value = user.displayName || user.email.split('@')[0];
    sendBtn.disabled = false;
    loadStandings(leagueIdInput.value || DEFAULT_LEAGUE);
    startChatListener();
  } else {
    loginBtn.style.display = 'inline-block';
    userInfo.style.display = 'none';
    userPic.src = '';
    userNameEl.innerText = '';
    nameInput.value = '';
    sendBtn.disabled = true;
    chatWindow.innerHTML = '';
  }
});

// load standings (uses your server API at /api/league-standings)
async function loadStandings(league) {
  standingsList.innerHTML = "Loading...";
  try {
    const res = await fetch(`/api/league-standings?league_id=${encodeURIComponent(league)}`);
    const j = await res.json();
    let results = j.standings?.results || j.results || [];
    if (results.length === 0 && j.standings?.entries) results = j.standings.entries;
    standingsList.innerHTML = results.map(r => `<div class="stand-row"><div><span class="name">#${r.rank} ${escapeHtml(r.entry_name)}</span><div class="meta">${escapeHtml(r.player_name)}</div></div><div class="meta">${r.total ?? r.points ?? 0} pts</div></div>`).join('');
  } catch(e) {
    standingsList.innerText = "Gagal load standings";
  }
}
loadLeagueBtn.addEventListener('click', () => loadStandings(leagueIdInput.value.trim() || DEFAULT_LEAGUE));
leagueIdInput.value = DEFAULT_LEAGUE;

// CHAT DB PATH
const leagueName = document.querySelector('.app-sub')?.innerText || DEFAULT_LEAGUE;
const chatPath = `chats/${leagueName.replace(/\W/g,'_')}`;

// Listen & render chat
let started = false;
function startChatListener() {
  if (started) return;
  started = true;
  const ref = db.ref(chatPath).limitToLast(50);
  ref.off(); // remove old listeners
  ref.on('child_added', snap => {
    const m = snap.val();
    addMessageRow(m, snap.key);
  });
}

// Render message
function addMessageRow(m, key) {
  if (!m) return;
  if (document.getElementById(`msg-${key}`)) return;
  const div = document.createElement('div');
  div.id = `msg-${key}`;
  const isMe = auth.currentUser && (m.senderUid === auth.currentUser.uid);
  div.className = 'msg-row ' + (isMe ? 'msg-right' : 'msg-left');
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.innerText = (m.name || 'U').charAt(0).toUpperCase();
  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + (isMe ? 'bubble-right' : 'bubble-left');
  bubble.innerHTML = `<div><strong>${escapeHtml(m.name || 'Anon')}</strong></div><div class="msg-body">${formatMessageText(m.text || '')}</div><div class="meta">${new Date(m.ts || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>`;
  if (isMe) { div.appendChild(bubble); div.appendChild(avatar); } else { div.appendChild(avatar); div.appendChild(bubble); }
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Format + highlight
function formatMessageText(text) {
  let t = escapeHtml(text || '');
  t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  t = t.replace(/_(.+?)_/g, '<i>$1</i>');
  t = t.replace(/==(.+?)==/g, '<span class="highlight">$1</span>');
  t = t.replace(/(https?:\/\/\S+\.(?:png|jpe?g|gif))(?![^<]*>)/gi, '<img src="$1" class="chat-img">');
  return t;
}

// SEND message
sendBtn.addEventListener('click', async () => {
  if (!auth.currentUser) { alert('Sila login dahulu'); return; }
  const text = msgInput.value.trim();
  if (!text) return;
  const name = nameInput.value.trim() || auth.currentUser.displayName || 'Anon';
  const m = { name, text, ts: Date.now(), senderUid: auth.currentUser.uid };
  try {
    await db.ref(chatPath).push().set(m);
    msgInput.value = '';
  } catch (err) {
    alert('Gagal hantar: ' + err.message);
  }
});
msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendBtn.click(); });

// GIF modal
gifBtn.addEventListener('click', () => gifModal.classList.remove('hidden'));
gifClose.addEventListener('click', () => gifModal.classList.add('hidden'));
gifSearchBtn.addEventListener('click', async () => {
  const q = gifSearch.value.trim(); if (!q) return;
  gifResults.innerHTML = 'Mencari...';
  try {
    const res = await fetch(`https://g.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=24`);
    const j = await res.json();
    gifResults.innerHTML = '';
    (j.results || []).forEach(item => {
      const url = item.media[0].gif.url;
      const img = document.createElement('img');
      img.src = url; img.className = 'chat-gif'; img.style.cursor = 'pointer';
      img.onclick = async () => {
        if (!auth.currentUser) { alert('Sila login dahulu'); return; }
        const name = nameInput.value.trim() || auth.currentUser.displayName || 'Anon';
        const m = { name, text: url, ts: Date.now(), senderUid: auth.currentUser.uid };
        await db.ref(chatPath).push().set(m);
        gifModal.classList.add('hidden');
      };
      gifResults.appendChild(img);
    });
  } catch (e) {
    gifResults.innerText = 'Gagal cari GIF';
  }
});

// Paste image URL button behaviour
imgBtn.addEventListener('click', async () => {
  if (!auth.currentUser) { alert('Sila login dahulu'); return; }
  const url = prompt('Paste image/GIF URL di sini (contoh: https://i.imgur.com/abc.jpg)');
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) { alert('Sila paste URL yang sah'); return; }
  const name = nameInput.value.trim() || auth.currentUser.displayName || 'Anon';
  await db.ref(chatPath).push().set({ name, text: url, ts: Date.now(), senderUid: auth.currentUser.uid });
});

// helpers
function escapeHtml(s){ return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
