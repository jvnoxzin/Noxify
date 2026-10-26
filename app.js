/* =========================================================
   NOXIFY — app.js
   1. Login e perfil     5. Player
   2. Navegação          6. Fila
   3. Início             7. Visual do player
   4. Buscar / Biblioteca 8. Offline

   Arquivos: util.js · playlist.js · settings.js · stats.js
             · lyrics.js · app.js
========================================================= */

const SONGS = Object.fromEntries(PLAYLIST.map((s) => [s.src, s]));

const coverStyle = (s) =>
  "background-image:url('" + esc(s.cover) + "'),linear-gradient(135deg,#3b1e5c,#1d1033)";


/* =========================
   1. LOGIN E PERFIL
========================= */
const AUTH_ERRORS = {
  "auth/invalid-credential":     "Email ou senha incorretos",
  "auth/invalid-email":          "Email inválido",
  "auth/email-already-in-use":   "Esse email já está em uso",
  "auth/weak-password":          "A senha precisa ter pelo menos 6 caracteres",
  "auth/network-request-failed": "Sem conexão com a internet"
};

const authMessage = (error) => AUTH_ERRORS[error.code] || error.message;

function firebaseReady(){
  if (window.firebaseFunctions && window.auth) return true;
  alert("Não consegui conectar ao servidor de login. Verifique sua internet.");
  return false;
}

function rememberUser(user, name){
  localStorage.setItem("noxLogin", "true");
  localStorage.setItem("loggedUser", name || user.displayName || user.email || "Usuário");
  localStorage.setItem("noxUid", user.uid || user.email || "guest");
  if (user.email) localStorage.setItem("noxEmail", user.email);
}

async function login(){

  if (!firebaseReady()) return;

  const email = $("user").value.trim();
  const pass  = $("pass").value;

  try{
    const { user } = await firebaseFunctions.signInWithEmailAndPassword(auth, email, pass);
    rememberUser(user);
    openApp();
  }catch(error){
    alert(authMessage(error));
  }
}

async function register(){

  if (!firebaseReady()) return;

  const name  = $("registerName").value.trim();
  const email = $("registerEmail").value.trim();
  const pass  = $("registerPass").value;
  const conf  = $("registerConfirm").value;

  if (pass !== conf){
    alert("As senhas não coincidem!");
    return;
  }

  if (!name){
    alert("Digite um nome de usuário.");
    return;
  }

  if (typeof Social !== "undefined" && (await Social.nameFree(name)) === false){
    alert("Esse nome de usuário já está em uso. Escolha outro.");
    return;
  }

  try{
    const { user } = await firebaseFunctions.createUserWithEmailAndPassword(auth, email, pass);
    await firebaseFunctions.updateProfile(user, { displayName: name });
    rememberUser(user, name);
    openApp();
  }catch(error){
    alert(authMessage(error));
  }
}

async function logout(){
  try{
    if (window.firebaseFunctions) await firebaseFunctions.signOut(auth);
  }catch(e){}
  Stats.flush();
  Social.stop();
  ["noxLogin", "loggedUser", "noxUid", "noxEmail"].forEach((k) => localStorage.removeItem(k));
  location.reload();
}

function openRegister(){
  $("loginScreen").style.display = "none";
  $("registerScreen").style.display = "flex";
}

function backToLogin(){
  $("registerScreen").style.display = "none";
  $("loginScreen").style.display = "flex";
}

function userName(){
  const user = window.auth ? window.auth.currentUser : null;
  return (user && user.displayName) || localStorage.getItem("loggedUser") || "Usuário";
}

function userEmail(){
  const user = window.auth ? window.auth.currentUser : null;
  return (user && user.email) || localStorage.getItem("noxEmail") || "";
}

const AVATAR_COLORS = [
  ["#c084fc", "#7c3aed"], ["#34d399", "#059669"], ["#60a5fa", "#2563eb"],
  ["#f472b6", "#db2777"], ["#fbbf24", "#d97706"], ["#f87171", "#dc2626"]
];

function avatarIndex(){
  const i = parseInt(localStorage.getItem("noxAvatar") || "0", 10);
  return AVATAR_COLORS[i] ? i : 0;
}

function applyProfile(){

  const name = userName();
  const [c1, c2] = AVATAR_COLORS[avatarIndex()];
  const photo = photoCss(Profile.get().photo);

  document.querySelectorAll(".avatar-btn, #profileAvatar").forEach((el) => {
    el.textContent = photo ? "" : name.charAt(0).toUpperCase();
    el.style.background = photo || "linear-gradient(135deg," + c1 + "," + c2 + ")";
  });
}

function greeting(){
  const h = new Date().getHours();
  const word = h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return word + ", " + userName().split(" ")[0];
}

function renderProfile(){

  applyProfile();

  const p = Profile.get();

  $("profileBanner").style.background = bannerCss(p.banner);
  $("profileName").textContent = userName();
  $("profileMail").textContent = userEmail() || "Conta Noxify";
  $("profileBio").textContent = p.bio;
  $("profileBio").hidden = !p.bio;

  const month = Stats.bucketFor("month");
  const total = Stats.bucketFor("total");

  $("statMonth").textContent = Math.round(month.sec / 60).toLocaleString("pt-BR");
  $("statSongs").textContent = Object.keys(total.songs).length;
  $("statOffline").textContent = PLAYLIST.filter(isOffline).length;

  if (typeof Social !== "undefined") Social.fillCounts();
}

function openApp(){

  $("loginScreen").style.display = "none";
  $("registerScreen").style.display = "none";
  $("app").style.display = "block";

  Stats.load();
  showView("home");
  Social.start();
}


/* =========================
   2. NAVEGAÇÃO
========================= */
const TAB_VIEWS = ["home", "search", "library", "capsule"];
let currentView = "home";
let lastTab = "home";

let backView = null;
const NAV_FOR = { playlist: "library", user: "social", chat: "social" };

function showView(name, back){
  Social.onLeave(currentView, name);
  backView = back || null;

  document.querySelectorAll(".view").forEach((v) => { v.hidden = v.id !== "view-" + name; });

  if (TAB_VIEWS.includes(name)) lastTab = name;
  currentView = name;
  document.body.dataset.view = name;

  document.querySelectorAll(".nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === (NAV_FOR[name] || name))
  );

  applyProfile();

  const render = {
    home: renderHome, search: renderSearch, library: renderLibrary,
    capsule: renderCapsule, profile: renderProfile, settings: renderSettings,
    playlist: renderPlaylistView, social: renderSocial, user: renderUserView, chat: renderChatView
  }[name];
  if (render) render();

  window.scrollTo(0, 0);
}

function goBack(){
  if (backView) showView(backView, backView === "user" ? "social" : null);
  else showView(currentView === "settings" ? "profile" : lastTab);
}


/* =========================
   LISTAS DE MÚSICAS (usadas em todas as telas)
========================= */
const ctxLists = {};
const ctxNames = {
  home: "Sua playlist", search: "Resultados da busca",
  library: "Baixadas", recent: "Tocadas recentemente"
};

function downloadIcon(song){
  return iconHtml(isOffline(song) ? "check" : "download");
}

function songRow(song, removable){
  const off = isOffline(song);
  return '<div class="song-row' + (song === current ? " playing" : "") + '" data-src="' + esc(song.src) + '">' +
    '<div class="cover" style="' + coverStyle(song) + '"></div>' +
    '<div class="song-info"><div class="song-name">' + esc(song.name) + '</div>' +
    '<div class="song-artist">' + esc(song.artist) + '</div></div>' +
    '<button class="row-btn' + (off ? " done" : "") + '" data-act="dl" aria-label="Baixar para ouvir offline">' + downloadIcon(song) + '</button>' +
    '<button class="row-btn" data-act="queue" aria-label="Adicionar à fila">' + iconHtml("plus") + '</button>' +
    (removable
      ? '<button class="row-btn" data-act="unpl" aria-label="Tirar da playlist">' + iconHtml("close") + '</button>'
      : "") +
    '</div>';
}

function queueRow(song, index){
  return '<div class="song-row" data-src="' + esc(song.src) + '" data-qi="' + index + '">' +
    '<div class="cover" style="' + coverStyle(song) + '"></div>' +
    '<div class="song-info"><div class="song-name">' + esc(song.name) + '</div>' +
    '<div class="song-artist">' + esc(song.artist) + '</div></div>' +
    '<button class="row-btn" data-act="unqueue" aria-label="Tirar da fila">' + iconHtml("close") + '</button>' +
    '</div>';
}

/* monta tudo de uma vez (muito mais rápido que innerHTML += em loop) */
function renderList(el, songs){
  ctxLists[el.dataset.ctx] = songs;
  el.innerHTML = songs.length
    ? songs.map((s) => songRow(s, !!el.dataset.remove)).join("")
    : '<div class="empty">' + (el.dataset.empty || "Nada por aqui ainda") + '</div>';
}

function markPlaying(){
  document.querySelectorAll(".song-row").forEach((row) =>
    row.classList.toggle("playing", !!current && row.dataset.src === current.src)
  );
}

/* um único listener para todos os cliques nas listas */
document.addEventListener("click", (e) => {

  const tile = e.target.closest(".recent-tile");
  if (tile){
    playSong(SONGS[tile.dataset.src], recentSongs(), ctxNames.recent);
    return;
  }

  const row = e.target.closest(".song-row");
  if (!row) return;

  const song = SONGS[row.dataset.src];
  if (!song) return;

  const btn = e.target.closest("[data-act]");
  const act = btn && btn.dataset.act;

  if (act === "queue")   { addToQueue(song); return; }
  if (act === "pl")      { openPlaylistPicker(song); return; }
  if (act === "unpl")    { removeFromPlaylist(song.src); return; }
  if (act === "dl")      { downloadSong(song); return; }
  if (act === "unqueue") { removeFromQueue(+row.dataset.qi); return; }

  if (row.dataset.qi !== undefined){          // tocar item da fila
    const [picked] = queue.splice(+row.dataset.qi, 1);
    renderQueueViews();
    startSong(picked, true);
    return;
  }

  const host = row.closest("[data-ctx]");
  const ctx = host && host.dataset.ctx;
  playSong(song, ctxLists[ctx], ctxNames[ctx]);
});

/* chips (filtros) e abas */
document.addEventListener("click", (e) => {

  const nav = e.target.closest(".nav-btn");
  if (nav){ showView(nav.dataset.view); return; }

  const chip = e.target.closest(".chip");
  if (!chip) return;

  if (chip.dataset.filter){ homeFilter = chip.dataset.filter; renderHome(); }
  else if (chip.id === "azChip"){ azOn = !azOn; renderHome(); }
  else if (chip.dataset.lib){ libTab = chip.dataset.lib; renderLibrary(); }
  else if (chip.dataset.cap){ capScope = chip.dataset.cap; renderCapsule(); }
});


/* =========================
   3. INÍCIO
========================= */
let homeFilter = "all";
let azOn = false;
let recent = [];

try{ recent = JSON.parse(localStorage.getItem("noxRecent") || "[]"); }catch(e){}

const recentSongs = () => recent.map((src) => SONGS[src]).filter(Boolean);

function pushRecent(song){
  recent = [song.src].concat(recent.filter((s) => s !== song.src)).slice(0, 12);
  try{ localStorage.setItem("noxRecent", JSON.stringify(recent)); }catch(e){}
}

function homeSongs(){

  let list = PLAYLIST.slice();

  if (homeFilter === "offline") list = list.filter(isOffline);

  if (homeFilter === "top"){
    return Stats.topSongs("total", 20).map((x) => SONGS[x.src]).filter(Boolean);
  }

  if (azOn) list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function renderRecent(){
  const songs = recentSongs();
  $("recentBox").hidden = songs.length === 0;

  $("recentRow").innerHTML = songs.map((s) =>
    '<button class="recent-tile" data-src="' + esc(s.src) + '">' +
    '<div class="cover" style="' + coverStyle(s) + '"></div>' +
    '<span>' + esc(s.name) + '</span></button>'
  ).join("");
}

function renderHome(){

  $("greeting").textContent = greeting();

  document.querySelectorAll("#homeChips [data-filter]").forEach((c) =>
    c.classList.toggle("active", c.dataset.filter === homeFilter)
  );
  $("azChip").classList.toggle("active", azOn);

  renderRecent();

  $("homeTitle").textContent = { all: "Sua playlist", offline: "Baixadas", top: "Mais tocadas" }[homeFilter];
  $("homeList").dataset.empty =
    homeFilter === "offline" ? "Você ainda não baixou nenhuma música."
    : homeFilter === "top"   ? "Ouça algumas músicas e as mais tocadas aparecem aqui."
    : "Nenhuma música";

  renderList($("homeList"), homeSongs());
  updateDlAll();
}


/* =========================
   4. BUSCAR / BIBLIOTECA
========================= */
let searchTimer;

function searchMusic(){
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderSearch, 150);
}

function buildArtistGrid(){

  const grid = $("artistGrid");
  if (grid.childElementCount) return;

  const seen = new Map();
  PLAYLIST.forEach((s) => {
    mainArtistsOf(s).forEach((name) => { if (!seen.has(name)) seen.set(name, s); });
  });

  grid.innerHTML = Array.from(seen, ([name, song]) =>
    '<button class="artist-tile" data-artist="' + esc(name) + '" style="--h:' + (hashStr(name) % 360) + '">' +
    '<span>' + esc(name) + '</span>' +
    '<i class="tile-art" style="' + coverStyle(song) + '"></i></button>'
  ).join("");
}

const mainArtistsOf = (song) => song.artist.split(",").map((a) => a.trim()).filter(Boolean);

$("artistGrid").addEventListener("click", (e) => {
  const tile = e.target.closest(".artist-tile");
  if (!tile) return;
  $("searchInput").value = tile.dataset.artist;
  renderSearch();
});

function renderSearch(){

  buildArtistGrid();

  const q = $("searchInput").value.trim().toLowerCase();
  $("artistBox").hidden = !!q;
  $("searchList").hidden = !q;

  if (!q) return;

  const results = PLAYLIST.filter((s) =>
    s.name.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
  );

  $("searchList").dataset.empty = "Nada encontrado para “" + esc($("searchInput").value.trim()) + "”.";
  renderList($("searchList"), results);
}

let libTab = "playlists";

function renderLibrary(){

  document.querySelectorAll("[data-lib]").forEach((c) =>
    c.classList.toggle("active", c.dataset.lib === libTab)
  );

  $("libPlaylistsBox").hidden = libTab !== "playlists";
  $("libOfflineBox").hidden = libTab !== "offline";
  $("libQueueBox").hidden = libTab !== "queue";

  if (libTab === "playlists"){
    renderPlaylistGrid();
  }else if (libTab === "offline"){
    const list = PLAYLIST.filter(isOffline);
    $("libCount").textContent = list.length + " de " + PLAYLIST.length + " músicas baixadas";
    renderList($("libList"), list);
    updateDlAll();
  }else{
    renderQueueViews();
  }
}


/* =========================
   5. PLAYER
========================= */
const audio = $("audio");
const fullPlayer = $("fullPlayer");

let current = null;          // música tocando
let anchor = null;           // última música escolhida na lista (para o "próxima")
let contextList = PLAYLIST.slice();
let contextName = ctxNames.home;
let shuffleMode = false;
let repeatMode = "off";      // off | all | one
let seeking = false;
let lastT = null;
let sessionSec = 0;
let counted = false;

/* áudio com equalizador: nasce no primeiro play (o navegador exige um toque) */
let audioCtx, analyser, freq, eqNodes = [], compressor, graphTried = false;

function ensureAudioGraph(){

  if (graphTried) return;
  graphTried = true;

  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const filter = (type, hz, q) => {
      const f = audioCtx.createBiquadFilter();
      f.type = type;
      f.frequency.value = hz;
      if (q) f.Q.value = q;
      return f;
    };

    eqNodes = [filter("lowshelf", 120), filter("peaking", 1500, 1), filter("highshelf", 5000)];
    compressor = audioCtx.createDynamicsCompressor();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;

    let node = audioCtx.createMediaElementSource(audio);
    eqNodes.concat([compressor, analyser]).forEach((n) => { node.connect(n); node = n; });
    node.connect(audioCtx.destination);

    freq = new Uint8Array(analyser.frequencyBinCount);
    applyAudioSettings();

  }catch(e){
    console.warn("Equalizador indisponível:", e);
    audioCtx = analyser = freq = compressor = null;
    eqNodes = [];
  }
}

function applyAudioSettings(){

  if (!audioCtx) return;

  const preset = EQ_PRESETS[Settings.get("eq")] || EQ_PRESETS.normal;
  eqNodes.forEach((n, i) => { n.gain.value = preset.gains[i]; });

  if (Settings.get("normalize")){
    compressor.threshold.value = -28;
    compressor.knee.value = 24;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.25;
  }else{
    compressor.threshold.value = 0;
    compressor.ratio.value = 1;
  }
}

function playSong(song, list, name){
  if (!song) return;
  if (list && list.length){
    contextList = list;
    contextName = name || contextName;
  }
  startSong(song, false);
}

function startSong(song, fromQueue){

  current = song;
  if (!fromQueue) anchor = song;

  sessionSec = 0;
  counted = false;
  lastT = null;

  ensureAudioGraph();
  if (audioCtx) audioCtx.resume();

  audio.src = song.src;
  audio.play().catch((err) => console.warn("Não foi possível tocar:", err));

  updatePlayerUI();
  markPlaying();
  pushRecent(song);
  updateMediaSession(song);
  Lyrics.onSongChange(song);
}

function togglePlay(){
  if (!current){
    startSong(PLAYLIST[0]);
    return;
  }
  if (audio.paused) audio.play();
  else audio.pause();
}

function nextMusic(auto){

  if (queue.length > 0){
    startSong(queue.shift(), true);
    renderQueueViews();
    return;
  }

  const list = contextList.length ? contextList : PLAYLIST;
  let i = list.indexOf(anchor);

  if (shuffleMode && list.length > 1){
    let random;
    do { random = Math.floor(Math.random() * list.length); } while (random === i);
    i = random;
  }else{
    i++;
    if (i >= list.length){
      if (auto === true && repeatMode === "off"){
        audio.pause();
        return;
      }
      i = 0;
    }
  }

  startSong(list[i], false);
}

function prevMusic(){

  if (audio.currentTime > 3){
    audio.currentTime = 0;
    return;
  }

  const list = contextList.length ? contextList : PLAYLIST;
  const i = list.indexOf(anchor);
  startSong(list[i <= 0 ? list.length - 1 : i - 1], false);
}

function toggleShuffle(){
  shuffleMode = !shuffleMode;
  $("fpShuffle").classList.toggle("on", shuffleMode);
  showToast(shuffleMode ? "Aleatório ligado" : "Aleatório desligado");
}

function toggleRepeat(){
  repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";

  const btn = $("fpRepeat");
  btn.classList.toggle("on", repeatMode !== "off");
  setIcon(btn, repeatMode === "one" ? "repeat-one" : "repeat");

  showToast({ off: "Repetir desligado", all: "Repetir a playlist", one: "Repetir esta música" }[repeatMode]);
}

audio.addEventListener("ended", () => {

  if (repeatMode === "one"){
    audio.currentTime = 0;
    audio.play();
    return;
  }

  if (!Settings.get("autoplay")){
    audio.pause();
    return;
  }

  nextMusic(true);
});

function setPlayIcons(){
  const icon = audio.paused ? "play" : "pause";
  setIcon($("fpPlay"), icon);
  setIcon($("miniPlay"), icon);

  if ("mediaSession" in navigator){
    navigator.mediaSession.playbackState = audio.paused ? "paused" : "playing";
  }
}

audio.addEventListener("play", () => {
  setPlayIcons();
  if (audioCtx) audioCtx.resume();
  syncVisuals();
});

audio.addEventListener("pause", () => {
  setPlayIcons();
  Stats.flush();
  syncVisuals();
});

/* progresso + contagem do tempo ouvido (Cápsula) */
audio.addEventListener("loadedmetadata", () => {
  $("fpDur").textContent = formatTime(audio.duration);
});

audio.addEventListener("timeupdate", () => {

  const t = audio.currentTime;

  if (lastT !== null && current){
    const d = t - lastT;
    if (d > 0 && d < 1.5){
      sessionSec += d;
      let play = false;
      if (!counted && sessionSec >= 30){ counted = true; play = true; }
      Stats.add(current, d, play);
    }
  }
  lastT = t;

  if (isNaN(audio.duration)) return;

  const pct = t / audio.duration;
  $("miniBar").style.width = (pct * 100) + "%";
  $("fpCur").textContent = formatTime(t);

  if (!seeking){
    $("fpProgress").value = pct * 1000;
    setFill(pct * 100);
  }

  updatePositionState(t);
  Lyrics.tick(t);
});

const progress = $("fpProgress");

/* rastro roxo da barra: vai até onde a música está */
function setFill(percent){
  $("fpProgress").style.setProperty("--p", Math.min(100, Math.max(0, percent)) + "%");
}

progress.addEventListener("input", () => {
  seeking = true;
  setFill(progress.value / 10);
  if (!isNaN(audio.duration)) $("fpCur").textContent = formatTime(progress.value / 1000 * audio.duration);
});

progress.addEventListener("change", () => {
  if (!isNaN(audio.duration)) audio.currentTime = progress.value / 1000 * audio.duration;
  lastT = null;
  seeking = false;
});

function updatePlayerUI(){

  if (!current) return;

  $("mini").hidden = false;
  document.body.classList.add("has-mini");

  $("miniCover").style.cssText = coverStyle(current);
  $("miniTitle").textContent = current.name;
  $("miniArtist").textContent = current.artist;

  $("fpCover").src = current.cover;
  $("fpTitle").textContent = current.name;
  $("fpArtist").textContent = current.artist;
  $("fpCtx").textContent = contextName;
  $("fpDur").textContent = "0:00";
  $("fpCur").textContent = "0:00";
  progress.value = 0;
  setFill(0);
  $("miniBar").style.width = "0%";

  updateFpDownload();
  setPlayIcons();
}

function updateFpDownload(){
  if (!current) return;
  const done = isOffline(current);
  setIcon($("fpDlBtn"), done ? "check" : "download");
  $("fpDlBtn").classList.toggle("on", done);
}

function downloadCurrent(){
  if (current) downloadSong(current);
}

function openPlayer(){
  if (!current) return;
  fullPlayer.classList.add("open");
  document.body.classList.add("no-scroll");
  resizeEq();
  syncVisuals();
}

function closePlayer(){
  fullPlayer.classList.remove("open");
  document.body.classList.remove("no-scroll");
  syncVisuals();
}

$("miniMain").addEventListener("click", openPlayer);

/* controles na tela de bloqueio / notificação do celular */
function updateMediaSession(song){
  if (!("mediaSession" in navigator)) return;

  const src = absUrl(song.cover);
  const ext = (src.split("?")[0].split(".").pop() || "").toLowerCase();
  const type = { png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", webp:"image/webp", svg:"image/svg+xml" }[ext];

  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.name,
    artist: song.artist,
    album: "Noxify",
    artwork: [96, 192, 256, 384, 512].map((s) => {
      const art = { src, sizes: s + "x" + s };
      if (type) art.type = type;
      return art;
    })
  });
}

/* barra de progresso e botões de pular 10 s na notificação */
function updatePositionState(t){

  if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
  if (!isFinite(audio.duration) || audio.duration <= 0) return;

  const sec = Math.floor(t);
  if (sec === updatePositionState.last) return;
  updatePositionState.last = sec;

  try{
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate || 1,
      position: Math.min(t, audio.duration)
    });
  }catch(e){}
}

if ("mediaSession" in navigator){

  const handlers = {
    play:          () => audio.play(),
    pause:         () => audio.pause(),
    previoustrack: () => prevMusic(),
    nexttrack:     () => nextMusic(),
    seekbackward:  (d) => { audio.currentTime = Math.max(0, audio.currentTime - ((d && d.seekOffset) || 10)); },
    seekforward:   (d) => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + ((d && d.seekOffset) || 10)); },
    seekto:        (d) => { if (d && typeof d.seekTime === "number") audio.currentTime = d.seekTime; },
    stop:          () => { audio.pause(); audio.currentTime = 0; }
  };

  for (const [action, fn] of Object.entries(handlers)){
    try{ navigator.mediaSession.setActionHandler(action, fn); }catch(e){}   // alguns aparelhos não têm todas as ações
  }
}

window.addEventListener("pagehide", () => Stats.flush());
document.addEventListener("visibilitychange", () => { if (document.hidden) Stats.flush(); });


/* =========================
   6. FILA
========================= */
let queue = [];   // guarda as músicas (não o índice), então não quebra ao reordenar

function addToQueue(song){
  queue.push(song);
  showToast("Adicionada à fila");
  renderQueueViews();
}

function removeFromQueue(index){
  queue.splice(index, 1);
  renderQueueViews();
}

function clearQueue(){
  queue = [];
  renderQueueViews();
}

function upcomingFromContext(n){
  const i = contextList.indexOf(anchor);
  return contextList.slice(i + 1, i + 1 + n);
}

function renderQueueViews(){

  const rows = queue.map(queueRow).join("");
  const empty = '<div class="empty">Sua fila está vazia. Toque em + em uma música.</div>';

  if (!$("view-library").hidden && libTab === "queue"){
    $("libQueueList").innerHTML = rows || empty;
  }

  if (!$("queueSheet").hidden) renderQueueSheet();
}

function renderQueueSheet(){

  const next = upcomingFromContext(6);

  $("sheetBody").innerHTML =
    '<div class="sheet-sec">Tocando agora</div>' +
    (current ? songRow(current) : '<div class="empty">Nada tocando</div>') +
    '<div class="sheet-sec">Na fila (' + queue.length + ')</div>' +
    (queue.length ? queue.map(queueRow).join("") : '<div class="empty">Sua fila está vazia</div>') +
    '<div class="sheet-sec">A seguir · ' + esc(contextName) + '</div>' +
    (next.length ? next.map(songRow).join("") : '<div class="empty">Fim da lista</div>');
}

function openQueue(){
  $("queueSheet").hidden = false;
  renderQueueSheet();
}

function closeQueue(){
  $("queueSheet").hidden = true;
}

$("queueSheet").addEventListener("click", (e) => {
  if (e.target === $("queueSheet")) closeQueue();
});


/* =========================
   7. VISUAL DO PLAYER
========================= */
const eqCanvas = $("equalizer");
const eqCtx = eqCanvas.getContext("2d");
const EQ_H = 56, EQ_BAR_W = 5, EQ_GAP = 3;

let eqGradient, eqBars = 40, rafId = 0, lastFrame = 0;

function resizeEq(){

  const w = eqCanvas.clientWidth;
  if (!w) return;

  eqCanvas.width = w;
  eqCanvas.height = EQ_H;
  eqBars = Math.min(64, Math.floor(w / (EQ_BAR_W + EQ_GAP)));

  eqGradient = eqCtx.createLinearGradient(0, EQ_H, 0, 0);
  eqGradient.addColorStop(0, "#7c3aed");
  eqGradient.addColorStop(1, "#d8b4fe");
}

function visualsActive(){
  return fullPlayer.classList.contains("open") && !audio.paused &&
         !!analyser && Settings.get("visuals") !== "off";
}

/* o loop só roda com o player aberto e tocando */
function syncVisuals(){
  if (visualsActive()){
    if (!rafId) rafId = requestAnimationFrame(frame);
  }else{
    cancelAnimationFrame(rafId);
    rafId = 0;
    clearVisuals();
  }
}

function frame(ts){

  rafId = 0;
  if (!visualsActive()) return;

  if (Settings.get("visuals") === "low" && ts - lastFrame < 66){
    rafId = requestAnimationFrame(frame);
    return;
  }

  lastFrame = ts;
  drawEqualizer();
  rafId = requestAnimationFrame(frame);
}

function drawEqualizer(){

  analyser.getByteFrequencyData(freq);

  /* pulso da capa com o grave */
  let bass = 0;
  for (let i = 0; i < 12; i++) bass += freq[i];
  $("fpCover").style.transform = "scale(" + (1 + bass / 12 / 1800) + ")";

  eqCtx.clearRect(0, 0, eqCanvas.width, EQ_H);
  eqCtx.fillStyle = eqGradient;

  const usable = 100;
  const total = eqBars * (EQ_BAR_W + EQ_GAP) - EQ_GAP;
  let x = (eqCanvas.width - total) / 2;

  for (let i = 0; i < eqBars; i++){
    const h = Math.max(2, (freq[Math.floor(i * usable / eqBars)] / 255) * (EQ_H - 4));
    eqCtx.fillRect(x, EQ_H - h, EQ_BAR_W, h);
    x += EQ_BAR_W + EQ_GAP;
  }
}

function clearVisuals(){
  eqCtx.clearRect(0, 0, eqCanvas.width, EQ_H);
  $("fpCover").style.transform = "";
}

window.addEventListener("resize", () => {
  if (fullPlayer.classList.contains("open")) resizeEq();
});


/* =========================
   8. OFFLINE (Service Worker + Cache)
========================= */
const MUSIC_CACHE = "noxify-music-v1";
const offlineSet = new Set();   // URLs já baixadas
const downloadFailures = {};    // src -> motivo da última falha

/* baixa o arquivo inteiro; tenta de novo uma vez se a rede falhar */
async function fetchSong(url){

  for (let attempt = 0; ; attempt++){
    try{
      const res = await fetch(url);

      if (res.status !== 200) throw new Error("HTTP " + res.status);

      /* alguns hospedeiros devolvem uma página HTML "200" quando o arquivo não existe */
      if (/text\/html/i.test(res.headers.get("content-type") || "")) throw new Error("HTTP 404");

      return res;

    }catch(e){
      if (attempt >= 1 || /^HTTP/.test(e.message)) throw e;
      await new Promise((r) => setTimeout(r, 700));
    }
  }
}

function downloadReason(err){
  const m = String((err && err.message) || err);

  if (/HTTP 404/.test(m)) return "arquivo não encontrado no site";
  if (/HTTP (\d+)/.test(m)) return "erro " + m.match(/HTTP (\d+)/)[1] + " do servidor";
  if (err && (err.name === "QuotaExceededError" || /quota/i.test(m))) return "sem espaço no aparelho";
  if (/failed to fetch|networkerror|load failed/i.test(m)) return "sem conexão";
  return m;
}

/* confere se cada .mp3 da playlist realmente existe no site */
async function checkSongFiles(onProgress){

  const bad = [];
  const queue = PLAYLIST.slice();
  let done = 0;

  async function worker(){
    while (queue.length){
      const song = queue.shift();
      const url = absUrl(song.src);

      try{
        let r = await fetch(url, { method: "HEAD", cache: "no-store" });

        if (r.status === 405 || r.status === 501){
          r = await fetch(url, { headers: { Range: "bytes=0-0" }, cache: "no-store" });
        }

        const html = /text\/html/i.test(r.headers.get("content-type") || "");

        if (!r.ok) bad.push({ song, reason: r.status === 404 ? "arquivo não encontrado" : "erro " + r.status });
        else if (html) bad.push({ song, reason: "arquivo não encontrado" });

      }catch(e){
        bad.push({ song, reason: "sem conexão" });
      }

      if (onProgress) onProgress(++done, PLAYLIST.length);
    }
  }

  await Promise.all([worker(), worker(), worker(), worker()]);
  return bad;
}

if ("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").catch((e) => {
    console.warn("Service worker não registrou (precisa de https ou localhost):", e);
  });
}

function isOffline(song){
  return offlineSet.has(absUrl(song.src));
}

async function loadOfflineSet(){
  if (!("caches" in window)) return;
  try{
    const cache = await caches.open(MUSIC_CACHE);
    (await cache.keys()).forEach((r) => offlineSet.add(r.url));
  }catch(e){}
  refreshOfflineUI();
}

function updateDlAll(){
  const n = PLAYLIST.filter(isOffline).length;
  document.querySelectorAll(".dl-all").forEach((b) => {
    b.textContent = n === PLAYLIST.length ? "Tudo baixado ✓" : "Baixar tudo (" + n + "/" + PLAYLIST.length + ")";
  });
}

function refreshOfflineUI(){

  document.querySelectorAll('.song-row [data-act="dl"]').forEach((btn) => {
    if (btn.dataset.busy === "1") return;
    const song = SONGS[btn.closest(".song-row").dataset.src];
    btn.innerHTML = downloadIcon(song);
    btn.classList.toggle("done", isOffline(song));
  });

  updateDlAll();
  updateFpDownload();

  if (!$("view-library").hidden && libTab === "offline") renderLibrary();
  if (!$("view-profile").hidden) renderProfile();
}

/* "Baixar só no Wi-Fi": só consegue checar em aparelhos que informam o tipo de rede */
function blockedByWifiRule(){
  if (!Settings.get("wifiOnly")) return false;
  const c = navigator.connection;
  if (!c) return false;
  if (c.saveData) return true;
  return !!c.type && c.type !== "wifi" && c.type !== "ethernet";
}

async function downloadSong(song, silent){

  const url = absUrl(song.src);

  if (!("caches" in window)){
    showToast("Seu navegador não suporta offline");
    return false;
  }

  /* já baixada: toque remove */
  if (offlineSet.has(url)){
    if (silent) return true;
    if (await askConfirm('Remover "' + song.name + '" do offline?', "Remover")){
      const cache = await caches.open(MUSIC_CACHE);
      await cache.delete(url);
      offlineSet.delete(url);
      refreshOfflineUI();
      showToast("Removida do offline");
    }
    return true;
  }

  if (blockedByWifiRule()){
    if (!silent) showToast("Conecte ao Wi-Fi para baixar");
    return false;
  }

  const btns = Array.from(document.querySelectorAll('.song-row[data-src="' + CSS.escape(song.src) + '"] [data-act="dl"]'));
  btns.forEach((b) => { b.dataset.busy = "1"; b.textContent = "…"; });

  try{
    const cache = await caches.open(MUSIC_CACHE);

    const res = await fetchSong(url);
    await cache.put(url, res);

    /* capa (se falhar, não atrapalha a música) */
    try{
      const coverUrl = absUrl(song.cover);
      const sameOrigin = new URL(coverUrl).origin === location.origin;
      const req = new Request(coverUrl, { mode: sameOrigin ? "same-origin" : "no-cors" });
      await cache.put(req, await fetch(req));
    }catch(e){}

    offlineSet.add(url);

    if (navigator.storage && navigator.storage.persist){
      navigator.storage.persist().catch(() => {});
    }

    Lyrics.prefetch(song);   // guarda a letra também, sem esperar

    if (!silent) showToast(song.name + " salva offline");
    return true;

  }catch(err){
    const reason = downloadReason(err);
    downloadFailures[song.src] = reason;
    console.error("Falha ao baixar", song.name, song.src, err);
    if (!silent) showToast("Não consegui baixar: " + reason);
    return false;

  }finally{
    btns.forEach((b) => { b.dataset.busy = "0"; });
    refreshOfflineUI();
  }
}

let downloadingAll = false;

async function downloadAll(){

  if (downloadingAll) return;

  const todo = PLAYLIST.filter((s) => !isOffline(s));

  if (todo.length === 0){
    showToast("Tudo já está offline");
    return;
  }

  if (blockedByWifiRule()){
    showToast("Conecte ao Wi-Fi para baixar");
    return;
  }

  if (!await askConfirm("Baixar " + todo.length + " músicas para ouvir offline? Isso usa dados e espaço no aparelho.", "Baixar")) return;

  downloadingAll = true;
  let ok = 0;
  const failed = [];

  for (const song of todo){
    showToast("Baixando " + (ok + failed.length + 1) + "/" + todo.length);
    if (await downloadSong(song, true)) ok++;
    else failed.push(song);
  }

  downloadingAll = false;

  if (!failed.length){
    showToast(ok + " músicas offline");
    return;
  }

  showToast("Baixadas: " + ok + " · Falharam: " + failed.length);

  const lines = failed.slice(0, 6)
    .map((s) => "• " + s.name + " (" + (downloadFailures[s.src] || "erro") + ")")
    .join("\n");

  await askConfirm(
    "Não consegui baixar " + failed.length + (failed.length === 1 ? " música" : " músicas") + ":\n" +
    lines + (failed.length > 6 ? "\n…" : "") +
    "\n\nEm Configurações > Verificar arquivos de música você vê o nome exato de cada arquivo.",
    "OK", true
  );
}

async function removeAllDownloads(){
  try{
    if ("caches" in window) await caches.delete(MUSIC_CACHE);
  }catch(e){}
  offlineSet.clear();
  refreshOfflineUI();
  showToast("Downloads removidos");
}

window.addEventListener("offline", () => showToast("Sem internet · tocando do offline"));
window.addEventListener("online",  () => showToast("De volta online"));


/* =========================
   INÍCIO
========================= */
renderQueueViews();
loadOfflineSet();

setTimeout(() => {
  $("splash").style.display = "none";

  if (localStorage.getItem("noxLogin")) openApp();
  else $("loginScreen").style.display = "flex";
}, 2500);
