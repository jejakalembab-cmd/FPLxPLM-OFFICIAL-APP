// client.js
// ---------- CONFIG: Ganti nilai-nilai ini sebelum guna ----------
const FIREBASE_CONFIG = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE.firebaseapp.com",
  databaseURL: "https://PASTE.firebaseio.com",
  projectId: "PASTE",
  storageBucket: "PASTE.appspot.com",
  messagingSenderId: "PASTE",
  appId: "PASTE"
};
const TENOR_KEY = "LIVDSRZULELA"; // demo key - boleh ganti
const DEFAULT_LEAGUE = "meny2m";
// ----------------------------------------------------------------

(async function init(){
  // load firebase scripts (compat for simple usage)
  await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
  await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js");
  await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js");
  await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js");

  // initialize
  firebase.initializeApp(FIREBASE_CONFIG);
  const auth = firebase.auth();
  const db = firebase.database();
  const storage = firebase.storage();

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

  // Emoji picker
  const picker = new EmojiButton({ position: 'top-end' });
  emojiBtn.addEventListener('click', () => picker.togglePicker(emojiBtn));
  picker.on('emoji', selection => { msgInput.value = msgInput.value + selection.emoji; msgInput.focus(); });

  // Auth: Google login
  loginBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
      // onAuthStateChanged will handle UI
    } catch (err) {
      alert('Login error: ' + (err.message || err));
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    await auth.signOut();
  });

  auth.onAuthStateChanged(user => {
    if (user) {
      // show profile
      loginBtn.classList.add('hidden');
      userInfo.classList.remove('hidden');
      userPic.src = user.photoURL || 'logo.png';
      userNameEl.innerText = user.displayName || user.email;
      // set name input default
      nameInput.value = user.displayName || user.email.split('@')[0];
    } else {
      loginBtn.classList.remove('hidden');
      userInfo.classList.add('hidden');
      userPic.src = '';
      userNameEl.innerText = '';
      nameInput.value = '';
    }
  });

  // Standings loader
  async function loadStandings(league) {
    standingsList.innerHTML = "Loading...";
    try {
      const res = await fetch(`/api/league-standings?league_id=${encodeURIComponent(league)}`);
      const j = await res.json();
      let results = j.standings?.results || j.results || [];
      if (results.length === 0 && j.standings?.entries) results = j.standings.entries;
      standingsList.innerHTML = results.map(r => `<div class="stand-row"><div><span class="name">#${r.rank} ${escapeHtml(r.entry_name)}</span><div class="meta">${escapeHtml(r.player_name)}</div></div><div class="meta">${r.total ?? r.points ?? 0} pts</div></div>`).join('');
    } catch (e) {
      standingsList.innerText = "Gagal load standings";
    }
  }

  loadLeagueBtn.addEventListener('click', () => loadStandings(leagueIdInput.value.trim() || DEFAULT_LEAGUE));
  leagueIdInput.value = DEFAULT_LEAGUE;
  loadStandings(DEFAULT_LEAGUE);

  // Chat path per-league
  const leagueName = document.querySelector('.app-sub')?.innerText || DEFAULT_LEAGUE;
  const chatPath = `chats/${leagueName.replace(/\W/g,'_')}`;

  // Pagination: load last 20 messages
  let oldestKey = null;
  async function loadLatestMessages() {
    const ref = db.ref(chatPath).orderByKey().limitToLast(20);
    const snap = await ref.once('value');
    const data = snap.val() || {};
    chatWindow.innerHTML = '';
    const entries = Object.entries(data);
    entries.forEach(([key, msg]) => {
      addMessageRow(msg, key);
      oldestKey = oldestKey || key;
    });
    // listen for new messages (push)
    db.ref(chatPath).limitToLast(1).on('child_added', (s) => {
      const k = s.key; const m = s.val();
      if (document.getElementById(`msg-${k}`)) return;
      addMessageRow(m, k);
    });
  }

  async function loadOlder() {
    if (!oldestKey) return;
    const ref = db.ref(chatPath).orderByKey().endAt(oldestKey).limitToLast(21);
    const snap = await ref.once('value');
    const data = snap.val() || {};
    const entries = Object.entries(data);
    if (entries.length <= 1) return;
    entries.pop(); // remove duplicate = oldestKey
    entries.reverse().forEach(([k,m]) => { prependMessageRow(m, k); oldestKey = k; });
  }

  chatWindow.addEventListener('scroll', () => { if (chatWindow.scrollTop < 40) loadOlder(); });

  loadLatestMessages();

  // Helpers for formatting + rendering
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
    bubble.innerHTML = `<div><strong>${escapeHtml(m.name || 'Anon')}</strong></div><div class="msg-body">${formatMessageText(m.text || '')}</div><div class="meta">${new Date(m.ts || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>`;
    if (isMe) { div.appendChild(bubble); div.appendChild(avatar); } else { div.appendChild(avatar); div.appendChild(bubble); }
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function prependMessageRow(m, key) {
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
    chatWindow.insertBefore(div, chatWindow.firstChild);
  }

  // Send message (requires login)
  sendBtn.addEventListener('click', async () => {
    if (!auth.currentUser) { alert('Sila login dengan Google dahulu'); return; }
    const text = msgInput.value.trim();
    if (!text) return;
    const name = nameInput.value.trim() || auth.currentUser.displayName || 'Anon';
    const m = { name, text, ts: Date.now(), senderUid: auth.currentUser.uid };
    await db.ref(chatPath).push().set(m);
    msgInput.value = '';
  });

  // Send on Enter
  msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendBtn.click(); });

  // GIF modal
  document.getElementById('gifBtn').addEventListener('click', ()=> gifModal.classList.remove('hidden'));
  gifClose.addEventListener('click', ()=> gifModal.classList.add('hidden'));
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
          if (!auth.currentUser) { alert('Login needed'); return; }
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

  // Image upload -> Firebase Storage
  imgBtn.addEventListener('click', () => imageUpload.click());
  imageUpload.addEventListener('change', async () => {
    if (!auth.currentUser) { alert('Login needed'); return; }
    const file = imageUpload.files[0]; if (!file) return;
    const name = nameInput.value.trim() || auth.currentUser.displayName || 'Anon';
    const key = `${Date.now()}_${file.name.replace(/\\s/g,'_')}`;
    const ref = storage.ref().child(`chat_images/${key}`);
    const task = ref.put(file);
    await task;
    const url = await ref.getDownloadURL();
    await db.ref(chatPath).push().set({ name, text: url, ts: Date.now(), senderUid: auth.currentUser.uid });
    imageUpload.value = '';
  });

  // helper
  function escapeHtml(s){ return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function loadScript(src){ return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
})();