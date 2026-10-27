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
  if (typeof Uploads !== "undefined") Uploads.renderMine(false);
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
    '<span class="fila-hint">+ Fila</span>' +
    '<div class="song-info"><div class="song-name">' + esc(song.name) + '</div>' +
    '<div class="song-artist">' + esc(song.artist) + '</div></div>' +
    '<button class="row-btn' + (off ? " done" : "") + '" data-act="dl" aria-label="Baixar para ouvir offline">' + downloadIcon(song) + '</button>' +
    '<button class="row-btn play" data-act="play" aria-label="Tocar">' + iconHtml("play") + '</button>' +
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
    if (tile.dataset.pl){ openPlaylist(tile.dataset.pl); return; }
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
  if (ctx === "playlist" && plCurrent) pushRecentKey("pl:" + plCurrent);
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

const recentItems = () => recent.map((k) => {
  if (String(k).startsWith("pl:")){
    const pl = Playlists.get(String(k).slice(3));
    return pl ? { pl } : null;
  }
  const song = SONGS[k];
  return song ? { song } : null;
}).filter(Boolean);

const recentSongs = () => recentItems().filter((x) => x.song).map((x) => x.song);

function pushRecentKey(key){
  recent = [key].concat(recent.filter((s) => s !== key)).slice(0, 12);
  try{ localStorage.setItem("noxRecent", JSON.stringify(recent)); }catch(e){}
}

function pushRecent(song){
  recent = [song.src].concat(recent.filter((s) => s !== song.src)).slice(0, 12);
  try{ localStorage.setItem("noxRecent", JSON.stringify(recent)); }catch(e){}
}

function homeSongs(){

  let list = PLAYLIST.slice();

  if (homeFilter === "offline") list = list.filter(isOffline).concat(Uploads.offlineSongs());

  if (homeFilter === "top"){
    return Stats.topSongs("total", 20).map((x) => SONGS[x.src]).filter(Boolean);
  }

  if (azOn) list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function renderRecent(){
  const items = recentItems();
  $("recentBox").hidden = items.length === 0;

  $("recentRow").innerHTML = items.map((it) => it.pl
    ? '<button class="recent-tile" data-pl="' + esc(it.pl.id) + '">' +
      '<div class="cover" style="background:' + Playlists.coverCss(it.pl).replace(/"/g, "&quot;") + '"></div>' +
      '<span>' + esc(it.pl.name) + '</span></button>'
    : '<button class="recent-tile" data-src="' + esc(it.song.src) + '">' +
      '<div class="cover" style="' + coverStyle(it.song) + '"></div>' +
      '<span>' + esc(it.song.name) + '</span></button>'
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
  Uploads.renderCommunity(false);
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

  Uploads.searchCommunity(q);

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
    const extra = Uploads.offlineSongs();
    const list = PLAYLIST.filter(isOffline).concat(extra);
    $("libCount").textContent = (list.length - extra.length) + " de " + PLAYLIST.length + " músicas baixadas" + (extra.length ? " + " + extra.length + " da comunidade" : "");
    renderList($("libList"), list);
    updateDlAll();
  }else{
    renderQueueViews();
  }
}


/* =========================
   5. PLAYER
========================= */
/* dois players: um toca e o outro faz a "cauda" da música anterior no crossfade */
const audioA = $("audio");
const audioB = new Audio();
audioB.preload = "none";
let audio = audioA;      // o que está tocando agora
let spare = audioB;      // o outro
const fullPlayer = $("fullPlayer");

/* escuta eventos só do player ativo (o outro está terminando e não deve mexer na tela) */
function onAudio(type, fn){
  [audioA, audioB].forEach((el) => el.addEventListener(type, (e) => { if (el === audio) fn(e); }));
}

let current = null;          // música tocando
let anchor = null;           // última música escolhida na lista (para o "próxima")
let contextList = PLAYLIST.slice();
let contextName = ctxNames.home;
let shuffleMode = "off";   // off | on | smart (inteligente)
let repeatMode = "off";      // off | all | one
let seeking = false;
let lastT = null;
let sessionSec = 0;
let counted = false;

/* áudio com equalizador: nasce no primeiro play (o navegador exige um toque) */
let audioCtx, analyser, freq, eqNodes = [], compressor, limiter, bus, graphTried = false;
const gains = new Map();   // player -> controle de volume dele (usado no crossfade)

const EQ_FREQS = [
  ["lowshelf", 80], ["peaking", 250, 1], ["peaking", 1000, 1], ["peaking", 4000, 1], ["highshelf", 12000]
];

function ensureAudioGraph(){

  if (graphTried) return;
  graphTried = true;

  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "playback" });

    eqNodes = EQ_FREQS.map(([type, hz, q]) => {
      const f = audioCtx.createBiquadFilter();
      f.type = type;
      f.frequency.value = hz;
      if (q) f.Q.value = q;
      return f;
    });

    compressor = audioCtx.createDynamicsCompressor();

    /* limitador: evita estourar (chiado/distorção) quando o equalizador aumenta o volume */
    limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = -1.5;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;

    bus = audioCtx.createGain();

    [audioA, audioB].forEach((el) => {
      const src = audioCtx.createMediaElementSource(el);
      const g = audioCtx.createGain();
      src.connect(g);
      g.connect(bus);
      gains.set(el, g);
    });

    let node = bus;
    eqNodes.concat([compressor, limiter, analyser]).forEach((n) => { node.connect(n); node = n; });
    node.connect(audioCtx.destination);

    freq = new Uint8Array(analyser.frequencyBinCount);
    applyAudioSettings();

  }catch(e){
    console.warn("Equalizador indisponível:", e);
    audioCtx = analyser = freq = compressor = limiter = bus = null;
    eqNodes = [];
    gains.clear();
  }
}

function applyAudioSettings(){

  if (!audioCtx) return;

  const preset = EQ_PRESETS[Settings.get("eq")] || EQ_PRESETS.normal;
  eqNodes.forEach((n, i) => { n.gain.value = preset.gains[i] || 0; });

  /* abaixa um pouco o volume geral quando o equalizador aumenta algum grave/agudo */
  const boost = Math.max(0, ...preset.gains);
  bus.gain.value = Math.pow(10, -(boost * 0.5) / 20);

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

let playHistory = [];       // músicas já tocadas (para o botão "anterior" no aleatório)
let skipHistory = false;
let crossfading = false;
let tailTimer = 0;

const CURVE_IN = new Float32Array(64);
const CURVE_OUT = new Float32Array(64);
for (let i = 0; i < 64; i++){            // curva de potência igual: o volume total não afunda no meio
  const p = i / 63;
  CURVE_IN[i] = Math.sin(p * Math.PI / 2);
  CURVE_OUT[i] = Math.cos(p * Math.PI / 2);
}

function crossfadeSeconds(){
  const n = parseInt(Settings.get("fade"), 10);
  return n > 0 ? n : 0;
}

function resetGains(){
  gains.forEach((g) => { g.gain.cancelScheduledValues(0); g.gain.value = 1; });
}

function stopSpare(){
  clearTimeout(tailTimer);
  spare.pause();
  spare.removeAttribute("src");
  spare.load();
  crossfading = false;
}

/* o volume é programado dentro do áudio do navegador, então continua certo com a tela apagada */
function runCrossfade(outEl, inEl, secs){
  const gOut = gains.get(outEl), gIn = gains.get(inEl);
  const start = audioCtx.currentTime + 0.02;

  [gOut, gIn].forEach((g) => g.gain.cancelScheduledValues(0));
  gIn.gain.value = 0;
  gOut.gain.value = 1;
  gIn.gain.setValueCurveAtTime(CURVE_IN, start, secs);
  gOut.gain.setValueCurveAtTime(CURVE_OUT, start, secs);
}

function startSong(song, fromQueue, xfade){

  cloudTok++;

  if (current && current !== song && !skipHistory){
    playHistory.push(current);
    if (playHistory.length > 60) playHistory.shift();
  }
  skipHistory = false;

  current = song;
  if (!fromQueue) anchor = song;
  if (shuffleMode === "smart") smartMark(song);

  sessionSec = 0;
  counted = false;
  lastT = null;

  ensureAudioGraph();
  if (audioCtx) audioCtx.resume();

  /* música enviada por usuário: precisa baixar com o login antes de tocar (veja uploads.js) */
  const needCloud = !!song.cloud && !Uploads.cachedUrl(song);
  if (song.cloud) Uploads.ensureCover(song);

  const canMix = !needCloud && xfade && audioCtx && gains.size === 2 && !audio.paused && isFinite(audio.duration);

  if (canMix){

    const out = audio;
    const secs = Math.max(1, Math.min(crossfadeSeconds(), audio.duration - audio.currentTime));

    audio = spare;
    spare = out;

    audio.src = songSrc(song);
    runCrossfade(out, audio, secs);
    crossfading = true;

    clearTimeout(tailTimer);
    tailTimer = setTimeout(stopSpare, secs * 1000 + 400);

  }else{
    stopSpare();
    if (audioCtx) resetGains();
    if (needCloud){
      audio.pause();
      audio.removeAttribute("src");
      loadCloudSong(song);
    }else{
      audio.src = songSrc(song);
    }
  }

  if (!needCloud) audio.play().catch((err) => console.warn("Não foi possível tocar:", err));

  updatePlayerUI();
  markPlaying();
  pushRecent(song);
  updateMediaSession(song);
  Lyrics.onSongChange(song);
}

/* endereço do áudio: arquivo do app, ou o arquivo baixado de uma música enviada */
function songSrc(song){
  return song.cloud ? Uploads.cachedUrl(song) : song.src;
}

let cloudFails = 0;
let cloudTok = 0;      // muda a cada música iniciada: respostas atrasadas de outra escolha são ignoradas

async function loadCloudSong(song){

  const tok = cloudTok;
  showToast("Carregando “" + song.name + "”…");

  try{
    await Uploads.resolveUrl(song);
  }catch(e){
    if (tok !== cloudTok) return;
    showToast(Uploads.errText(e));
    /* some o botão de pausa travado e pula, mas para depois de 3 seguidas */
    setPlayIcons();
    if (++cloudFails <= 3 && Settings.get("autoplay") && (queue.length || contextList.length > 1)) setTimeout(() => { if (tok === cloudTok) nextMusic(true); }, 1200);
    return;
  }

  if (tok !== cloudTok) return;   // a pessoa já escolheu outra
  cloudFails = 0;
  audio.src = Uploads.cachedUrl(song);
  audio.play().catch((err) => console.warn("Não foi possível tocar:", err));
}

function togglePlay(){
  if (!current){
    startSong(PLAYLIST[0]);
    return;
  }
  if (current.cloud && !audio.getAttribute("src")){ startSong(current, true); return; }
  if (audio.paused) audio.play();
  else audio.pause();
}

/* decide qual é a próxima música (sem tocar). Devolve null se a lista acabou. */
function pickNext(auto){

  if (queue.length > 0){
    return { song: queue.shift(), fromQueue: true };
  }

  const list = contextList.length ? contextList : PLAYLIST;
  let i = list.indexOf(anchor);

  if (shuffleMode === "smart" && list.length > 1){
    return { song: smartPick(list), fromQueue: false };
  }

  if (shuffleMode === "on" && list.length > 1){
    let random;
    do { random = Math.floor(Math.random() * list.length); } while (random === i);
    return { song: list[random], fromQueue: false };
  }

  i++;
  if (i >= list.length){
    if (auto === true && repeatMode === "off") return null;
    i = 0;
  }
  return { song: list[i], fromQueue: false };
}

function nextMusic(auto){

  const next = pickNext(auto);

  if (!next){
    audio.pause();
    return;
  }

  if (next.fromQueue) renderQueueViews();
  startSong(next.song, next.fromQueue, false);
}

function prevMusic(){

  if (audio.currentTime > 3){
    audio.currentTime = 0;
    return;
  }

  /* no aleatório, "anterior" volta para a música que realmente tocou antes */
  if (shuffleMode !== "off" && playHistory.length){
    skipHistory = true;
    startSong(playHistory.pop(), false, false);
    return;
  }

  const list = contextList.length ? contextList : PLAYLIST;
  const i = list.indexOf(anchor);
  startSong(list[i <= 0 ? list.length - 1 : i - 1], false, false);
}


/* ---------- aleatório inteligente ----------
   • não repete nenhuma música até todas da lista terem tocado
   • evita o mesmo artista duas vezes seguidas
   • músicas que você mais ouve têm um pouco mais de chance de vir primeiro */
let smart = { list: null, played: new Set() };

function smartMark(song){
  if (smart.list !== contextList){
    smart = { list: contextList, played: new Set() };
  }
  smart.played.add(song.src);
}

function smartPick(list){

  if (smart.list !== list) smart = { list, played: new Set() };

  const me = current ? mainArtist(current) : "";
  let pool = list.filter((s) => !smart.played.has(s.src) && s !== current);

  if (!pool.length){               // todas tocaram: começa uma rodada nova
    smart.played = new Set(current ? [current.src] : []);
    pool = list.filter((s) => s !== current);
  }

  const other = pool.filter((s) => mainArtist(s) !== me);
  if (other.length) pool = other;

  const plays = Stats.bucketFor("total").songs;
  const weights = pool.map((s) => 1 + Math.log2(1 + ((plays[s.src] && plays[s.src].plays) || 0)));
  let r = Math.random() * weights.reduce((x, y) => x + y, 0);

  for (let k = 0; k < pool.length; k++){
    r -= weights[k];
    if (r <= 0) return pool[k];
  }
  return pool[pool.length - 1];
}

function setShuffle(mode){
  shuffleMode = mode;
  smart = { list: null, played: new Set() };
  if (mode === "smart" && current) smartMark(current);

  const btn = $("fpShuffle");
  btn.classList.toggle("on", mode !== "off");
  btn.classList.toggle("smart", mode === "smart");
  btn.setAttribute("aria-label", { off: "Aleatório", on: "Aleatório ligado", smart: "Aleatório inteligente" }[mode]);
}

/* 1 toque = aleatório · 2 toques = inteligente · 3 toques = desligado */
function toggleShuffle(){
  setShuffle(shuffleMode === "off" ? "on" : shuffleMode === "on" ? "smart" : "off");
  showToast({
    off: "Aleatório desligado",
    on: "Aleatório ligado",
    smart: "Aleatório inteligente: não repete até tocar todas"
  }[shuffleMode]);
}

function toggleRepeat(){
  repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";

  const btn = $("fpRepeat");
  btn.classList.toggle("on", repeatMode !== "off");
  setIcon(btn, repeatMode === "one" ? "repeat-one" : "repeat");

  showToast({ off: "Repetir desligado", all: "Repetir a playlist", one: "Repetir esta música" }[repeatMode]);
}

onAudio("ended", () => {

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

onAudio("play", () => {
  setPlayIcons();
  if (audioCtx) audioCtx.resume();
  syncVisuals();
});

onAudio("pause", () => {
  if (crossfading) stopSpare();      // pausou no meio do crossfade: a outra música para junto
  setPlayIcons();
  Stats.flush();
  syncVisuals();
});

/* progresso + contagem do tempo ouvido (Cápsula) */
/* arquivo que não abre (nome errado, sem internet): avisa e pula, mas para depois de 3 seguidas */
let errorStreak = 0;

onAudio("playing", () => { errorStreak = 0; });

onAudio("error", () => {
  if (!current || !audio.getAttribute("src")) return;
  showToast("Não consegui tocar “" + current.name + "”");
  if (++errorStreak <= 3 && Settings.get("autoplay")) setTimeout(() => nextMusic(true), 900);
});

onAudio("loadedmetadata", () => {
  $("fpDur").textContent = formatTime(audio.duration);
});

onAudio("timeupdate", () => {

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

  /* chegou perto do fim: começa a próxima por cima (crossfade) */
  const X = crossfadeSeconds();
  if (X && !crossfading && !seeking && !audio.paused && audioCtx &&
      audio.duration > X * 2.5 && audio.duration - t <= X &&
      repeatMode !== "one" && Settings.get("autoplay")){
    const next = pickNext(true);
    if (next){
      if (next.fromQueue) renderQueueViews();
      startSong(next.song, next.fromQueue, true);
      return;
    }
  }

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
  if (song.cloud) return Uploads.isOffline(song);
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

  /* música enviada por usuário: guarda no cache próprio (uploads.js) */
  if (song.cloud) return Uploads.toggleOffline(song, silent);

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
  await Uploads.clearOffline();
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


/* =========================
   10. ARRASTAR PARA A FILA
========================= */
/* arrastar uma música para o lado (esquerda ou direita) coloca na fila */
(function(){

  const LIMIT = 70;
  let drag = null;
  let justSwiped = false;

  const hintOf = (row) => row.querySelector(".fila-hint");

  function move(row, dx){
    row.style.transition = "none";
    row.style.transform = "translateX(" + dx + "px)";
    const hint = hintOf(row);
    if (hint){
      hint.style.opacity = Math.min(1, Math.abs(dx) / LIMIT);
      hint.style.left = dx > 0 ? "14px" : "auto";
      hint.style.right = dx > 0 ? "auto" : "14px";
    }
  }

  function reset(row){
    row.style.transition = "transform .2s ease";
    row.style.transform = "";
    row.classList.remove("swiping");
    const hint = hintOf(row);
    if (hint) hint.style.opacity = 0;
  }

  document.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    const row = e.target.closest(".song-row");
    if (!row || row.dataset.qi !== undefined || row.classList.contains("pick-row")) return;
    if (e.target.closest("button, input, label")) return;
    drag = { row, x: e.clientX, y: e.clientY, active: false, dx: 0 };
  });

  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;

    if (!drag.active){
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)){ drag = null; return; }   // é rolagem
      if (Math.abs(dx) < 10) return;
      drag.active = true;
      drag.row.classList.add("swiping");
    }

    drag.dx = dx;
    move(drag.row, dx * 0.9);
  });

  function finish(){
    if (!drag) return;
    const d = drag;
    drag = null;

    if (!d.active) return;

    justSwiped = true;
    setTimeout(() => { justSwiped = false; }, 350);

    const song = SONGS[d.row.dataset.src];
    if (Math.abs(d.dx) >= LIMIT && song){
      addToQueue(song);
    }
    reset(d.row);
  }

  document.addEventListener("pointerup", finish);
  document.addEventListener("pointercancel", finish);

  /* depois de arrastar, o toque final não deve tocar a música */
  document.addEventListener("click", (e) => {
    if (!justSwiped) return;
    justSwiped = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);
})();
