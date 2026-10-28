/* =========================================================
   NOXIFY — social.js
   Perfis públicos, seguir pessoas e conversar.
   Usa window.NoxDB (db.js, Firestore). Tudo aqui é protegido
   pelas regras do arquivo firestore.rules.
========================================================= */

const Social = (() => {

  const S = {
    chats: [],            // conversas do usuário
    users: {},            // cache de perfis { uid: { at, data } }
    following: null,      // Set com quem eu sigo
    tab: "chats",
    userId: null,         // perfil aberto
    peer: null,           // conversa aberta
    unsubChats: null,
    unsubMsgs: null,
    startedFor: null,
    firstSnap: true,
    searchSeq: 0,
    quickPanelOpen: false,
    emojiIndex: 0,
    callState: null,
    callType: "audio",
    callPeer: null,
    callSessionUnsub: null,
    localStream: null,
    peerConnection: null,
    callCandidates: []
  };

  const CHAT_QUICK_TEXT = [
    "Oi 👋",
    "Tudo bem?",
    "Vamos ouvir uma música?",
    "Legal! 🎵",
    "Me manda sua playlist",
    "Tô nessa! 🔥",
    "Vou ouvir depois 🎧",
    "Que vibe! 😍"
  ];

  const CHAT_EMOJIS = ["😊", "😂", "🔥", "🎵", "💜", "😎", "❤️", "✨", "😍", "🥰", "😆", "🤩", "👍", "🎉", "🥳", "✨"];

  const CHAT_BG_PRESETS = {
    default: "linear-gradient(180deg, rgba(18, 12, 24, 0.8), rgba(11, 10, 17, 0.9))",
    night: "radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 40%), linear-gradient(180deg, rgba(15,22,42,0.85), rgba(10,10,18,0.92))",
    sunset: "radial-gradient(circle at top, rgba(251,146,60,0.22), transparent 32%), linear-gradient(135deg, rgba(127,29,29,0.62), rgba(76,29,149,0.56), rgba(15,23,42,0.86))",
    ocean: "radial-gradient(circle at top, rgba(45,212,191,0.2), transparent 35%), linear-gradient(180deg, rgba(2,6,23,0.86), rgba(12,74,110,0.7))",
    violet: "radial-gradient(circle at center, rgba(168,85,247,0.24), transparent 36%), linear-gradient(135deg, rgba(88,28,135,0.7), rgba(17,24,39,0.8))",
    stars: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1.8px) 0 0/18px 18px, linear-gradient(180deg, rgba(10,14,28,0.8), rgba(26,26,46,0.9))"
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildEmojiPicker);
  } else {
    buildEmojiPicker();
  }

  const db  = () => window.NoxDB;
  const me  = () => (window.auth && window.auth.currentUser) ? window.auth.currentUser.uid : null;
  const chatIdWith = (other) => db().chatId(me(), other);

  /* ---------- mensagens de erro amigáveis ---------- */
  function errText(e){
    const code = (e && e.code) || "";
    if (code.includes("name-taken")) return "Esse nome já está em uso por outra pessoa.";
    if (code.includes("permission-denied"))
      return "O Firebase recusou o acesso. Falta publicar as regras do chat (arquivo firestore.rules).";
    if (code.includes("not-found") || code.includes("failed-precondition"))
      return "O banco Firestore ainda não foi criado no Firebase (Build > Firestore Database > Criar banco).";
    if (code.includes("unavailable") || code.includes("network"))
      return "Sem conexão com o servidor. Tente de novo com internet.";
    return "Erro: " + (code || (e && e.message) || "desconhecido");
  }

  function unavailable(){
    if (!db()) return "O chat não carregou. Isso acontece sem internet ou se o Firebase estiver bloqueado.";
    if (!me()) return "Entre na sua conta, com internet, para usar o Social.";
    return null;
  }

  /* ---------- perfil público (meu) ---------- */
  let syncTimer = 0;

  function sync(){
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      if (unavailable()) return;
      const p = Profile.get();
      const name = userName().slice(0, 30);
      try{
        await db().claimName(me(), name.trim().toLowerCase());
      }catch(e){
        if (e && e.code === "name-taken"){
          S.nameTaken = name;
          showToast("O nome “" + name + "” já está em uso. Escolha outro em Editar perfil.");
        }
        return;
      }
      S.nameTaken = null;
      try{
        await db().upsertUser(me(), {
          name, nameLower: name.toLowerCase(),
          bio: p.bio || "",
          photo: SAFE_IMG.test(p.photo) ? p.photo : "",
          bannerId: p.banner.t === "preset" ? p.banner.id : "",
          bannerImg: p.banner.t === "img" && SAFE_IMG.test(p.banner.data) ? p.banner.data : ""
        });
      }catch(e){
        console.warn("Não consegui salvar o perfil público:", e);
      }
    }, 800);
  }

  /* true = livre, false = em uso, null = não deu para conferir */
  async function nameFree(name){
    if (!db()) return null;
    try{ return await db().isNameFree(name.trim().toLowerCase(), me()); }
    catch(e){ return null; }
  }

  /* ---------- ler perfis dos outros ---------- */
  async function userInfo(id){

    const hit = S.users[id];
    if (hit && Date.now() - hit.at < 60000) return hit.data;

    let data = null;
    try{ data = await db().getUser(id); }catch(e){}

    data = data || { uid: id, name: "Usuário" };
    S.users[id] = { at: Date.now(), data };
    return data;
  }

  const bannerOf = (u) => bannerCss(u.bannerImg ? { t: "img", data: u.bannerImg } : { t: "preset", id: u.bannerId });

  function avatarStyle(u){
    const photo = photoCss(u.photo);
    const [c1, c2] = colorsFor(u.uid || u.name);
    return photo || "linear-gradient(135deg," + c1 + "," + c2 + ")";
  }

  const initialOf = (u) => u.photo && photoCss(u.photo) ? "" : (u.name || "?").charAt(0).toUpperCase();

  function paintAvatar(el, u){
    el.style.background = avatarStyle(u);
    el.textContent = initialOf(u);
  }

  function fmtTime(ms){
    if (!ms) return "";
    const d = new Date(ms), now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  /* ---------- quem eu sigo ---------- */
  async function loadFollowing(){
    if (unavailable()) return;
    try{
      S.following = new Set(await db().listFollow(me(), "following"));
    }catch(e){ S.following = S.following || new Set(); }
  }

  const isFollowing = (id) => !!(S.following && S.following.has(id));

  async function toggleFollow(id){

    const bad = unavailable();
    if (bad){ showToast(bad); return; }
    if (id === me()) return;
    if (!S.following) await loadFollowing();

    try{
      if (isFollowing(id)){
        await db().unfollow(me(), id);
        S.following.delete(id);
        showToast("Você deixou de seguir");
      }else{
        await db().follow(me(), id);
        S.following.add(id);
        showToast("Seguindo");
      }
    }catch(e){
      showToast(errText(e));
      return;
    }

    document.querySelectorAll('[data-follow="' + id + '"]').forEach((b) => {
      b.textContent = isFollowing(id) ? "Seguindo" : "Seguir";
      b.classList.toggle("ghost", isFollowing(id));
    });
    if (currentView === "user") renderUserView();
    if (currentView === "social") render();
    if (currentView === "profile") fillCounts();
  }

  /* ---------- conversas (ao vivo) ---------- */
  const seenKey = () => "noxChatSeen:" + (me() || "");

  function seenMap(){
    try{ return JSON.parse(localStorage.getItem(seenKey()) || "{}"); }catch(e){ return {}; }
  }

  function markSeen(chatId, at){
    const m = seenMap();
    m[chatId] = Math.max(m[chatId] || 0, at || Date.now());
    try{ localStorage.setItem(seenKey(), JSON.stringify(m)); }catch(e){}
    updateBadge();
  }

  const peerOf = (chat) => chat.members.find((x) => x !== me());

  function isUnread(chat){
    return chat.lastFrom && chat.lastFrom !== me() && chat.lastAt > (seenMap()[chat.id] || 0);
  }

  function updateBadge(){
    const dot = document.querySelector('.nav-btn[data-view="social"] .nav-dot');
    if (dot) dot.hidden = !S.chats.some(isUnread);
  }

  function onChats(list){

    const before = Object.fromEntries(S.chats.map((c) => [c.id, c.lastAt]));
    S.chats = list.slice().sort((a, b) => b.lastAt - a.lastAt);

    /* aviso de mensagem nova (só depois da primeira carga) */
    if (!S.firstSnap){
      S.chats.forEach(async (c) => {
        if (c.lastFrom && c.lastFrom !== me() && c.lastAt > (before[c.id] || 0) && !(currentView === "chat" && S.peer === peerOf(c))){
          const u = await userInfo(peerOf(c));
          showToast(u.name + ": " + c.lastText);
        }
      });
    }
    S.firstSnap = false;

    if (currentView === "chat" && S.peer){
      const c = S.chats.find((x) => x.id === chatIdWith(S.peer));
      if (c) markSeen(c.id, c.lastAt);
    }

    updateBadge();
    if (currentView === "social" && S.tab === "chats") render();
  }

  async function start(){

    if (!db() || !window.auth) return;

    try{ if (window.auth.authStateReady) await window.auth.authStateReady(); }catch(e){}

    const id = me();
    if (!id || S.startedFor === id) return;
    S.startedFor = id;
    S.firstSnap = true;

    sync();
    loadFollowing();

    if (S.unsubChats) S.unsubChats();
    S.unsubChats = db().subscribeChats(id, onChats, (e) => {
      console.warn("Chats:", e);
      S.chatError = errText(e);
      if (currentView === "social") render();
    });
  }

  window.addEventListener("nox-db-ready", start);

  function stop(){
    if (S.unsubChats) S.unsubChats();
    if (S.unsubMsgs) S.unsubMsgs();
    S.unsubChats = S.unsubMsgs = null;
    S.startedFor = null;
    S.chats = [];
  }

  /* ---------- tela Social ---------- */
  function personRow(u, opts){
    opts = opts || {};
    return '<div class="person" data-uid="' + esc(u.uid) + '">' +
      '<div class="p-av"></div>' +
      '<div class="p-info"><div class="p-name">' + esc(u.name || "…") + '</div>' +
      '<div class="p-sub">' + (opts.sub || "") + '</div></div>' +
      (opts.right || "") + '</div>';
  }

  function hydrate(box){
    box.querySelectorAll(".person").forEach(async (row) => {
      const u = await userInfo(row.dataset.uid);
      row.querySelector(".p-name").textContent = u.name;
      paintAvatar(row.querySelector(".p-av"), u);
      const bio = row.querySelector("[data-bio]");
      if (bio) bio.textContent = u.bio || "";
    });
  }

  const followBtn = (id) =>
    '<button class="pill-btn small' + (isFollowing(id) ? " ghost" : "") + '" data-follow="' + esc(id) + '">' +
    (isFollowing(id) ? "Seguindo" : "Seguir") + '</button>';

  function render(){

    document.querySelectorAll("#socTabs [data-soc]").forEach((c) =>
      c.classList.toggle("active", c.dataset.soc === S.tab)
    );
    $("socFind").hidden = S.tab !== "find";

    const msg = $("socMsg");
    const list = $("socList");
    const bad = unavailable();

    if (S.nameTaken){
      msg.hidden = false;
      msg.className = "diag warn";
      msg.innerHTML = "<b>Seu nome está em uso</b><span>Outra pessoa já usa “" + esc(S.nameTaken) +
        "”. Troque em Perfil > Editar perfil para aparecer na busca e receber mensagens.</span>";
      list.innerHTML = "";
      return;
    }

    if (bad || (S.chatError && S.tab === "chats")){
      msg.hidden = false;
      msg.className = "diag warn";
      msg.innerHTML = "<b>Social indisponível</b><span>" + esc(bad || S.chatError) + "</span>";
      list.innerHTML = "";
      return;
    }
    msg.hidden = true;

    if (S.tab === "chats"){
      list.innerHTML = S.chats.length
        ? S.chats.map((c) => {
            const id = peerOf(c);
            const unread = isUnread(c);
            return personRow({ uid: id, name: "…" }, {
              sub: esc((c.lastFrom === me() ? "Você: " : "") + c.lastText),
              right: '<div class="p-meta' + (unread ? " unread" : "") + '">' + fmtTime(c.lastAt) + (unread ? '<i></i>' : "") + '</div>'
            }).replace('class="person"', 'class="person' + (unread ? " unread" : "") + '" data-chat="1"');
          }).join("")
        : '<div class="empty">Nenhuma conversa ainda.<br>Use “Buscar pessoas” para achar alguém e mandar um oi.</div>';
      hydrate(list);
      return;
    }

    if (S.tab === "following"){
      list.innerHTML = '<div class="empty">Carregando…</div>';
      const seq = ++S.searchSeq;
      db().listFollow(me(), "following").then((ids) => {
        if (seq !== S.searchSeq || S.tab !== "following") return;
        S.following = new Set(ids);
        list.innerHTML = ids.length
          ? ids.map((id) => personRow({ uid: id, name: "…" }, { sub: '<span data-bio></span>', right: followBtn(id) })).join("")
          : '<div class="empty">Você ainda não segue ninguém.</div>';
        hydrate(list);
      }).catch((e) => { list.innerHTML = '<div class="empty">' + esc(errText(e)) + '</div>'; });
      return;
    }

    /* buscar */
    if (!$("socSearch").value.trim()){
      list.innerHTML = '<div class="empty">Digite o nome de quem você quer encontrar.</div>';
    }
  }

  let searchTimer = 0;

  function runSearch(){

    const q = $("socSearch").value.trim().toLowerCase();
    const list = $("socList");

    if (!q){ render(); return; }
    if (unavailable()) return;

    const seq = ++S.searchSeq;

    db().searchUsers(q, 20).then((rows) => {
      if (seq !== S.searchSeq || S.tab !== "find") return;
      rows = rows.filter((u) => u.uid !== me());
      list.innerHTML = rows.length
        ? rows.map((u) => {
            S.users[u.uid] = { at: Date.now(), data: u };
            return personRow(u, { sub: esc(u.bio || ""), right: followBtn(u.uid) });
          }).join("")
        : '<div class="empty">Ninguém encontrado com esse nome.<br>A busca começa pelo início do nome.</div>';
      hydrate(list);
    }).catch((e) => {
      $("socMsg").hidden = false;
      $("socMsg").className = "diag bad";
      $("socMsg").innerHTML = "<b>Não consegui buscar</b><span>" + esc(errText(e)) + "</span>";
    });
  }

  $("socSearch").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 300);
  });

  $("socTabs").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-soc]");
    if (!chip) return;
    S.tab = chip.dataset.soc;
    S.searchSeq++;
    render();
    if (S.tab === "find") $("socSearch").focus();
  });

  /* cliques em qualquer lista de pessoas */
  function onPeopleClick(e){

    const fb = e.target.closest("[data-follow]");
    if (fb){ e.stopPropagation(); toggleFollow(fb.dataset.follow); return; }

    const row = e.target.closest(".person");
    if (!row) return;

    closeFollowSheet();

    if (row.dataset.chat) openChat(row.dataset.uid);
    else openUser(row.dataset.uid);
  }

  $("socList").addEventListener("click", onPeopleClick);
  $("followBody").addEventListener("click", onPeopleClick);


  /* ---------- perfil de outra pessoa ---------- */
  function openUser(id){
    if (id === me()){ showView("profile", currentView); return; }
    S.userId = id;
    showView("user", currentView === "chat" ? "social" : currentView);
  }

  async function renderUserView(){

    const id = S.userId;
    if (!id) return;

    if (!S.following) await loadFollowing();

    const u = await userInfo(id);
    if (S.userId !== id) return;

    $("userBanner").style.background = bannerOf(u);
    paintAvatar($("userAvatar"), u);
    $("userName").textContent = u.name;
    $("userBio").textContent = u.bio || "";
    $("userBio").hidden = !u.bio;

    const btn = $("userFollow");
    btn.textContent = isFollowing(id) ? "Seguindo" : "Seguir";
    btn.classList.toggle("ghost", isFollowing(id));

    $("userFollowers").textContent = "–";
    $("userFollowing").textContent = "–";
    db().countFollow(id, "followers").then((n) => { if (S.userId === id) $("userFollowers").textContent = n; }).catch(() => {});
    db().countFollow(id, "following").then((n) => { if (S.userId === id) $("userFollowing").textContent = n; }).catch(() => {});

    if (typeof Uploads !== "undefined") Uploads.renderUser(id, false);
  }

  $("userFollow").addEventListener("click", () => toggleFollow(S.userId));
  $("userMessage").addEventListener("click", () => openChat(S.userId));

  /* ---------- contagens do meu perfil ---------- */
  function fillCounts(){
    $("cntFollowers").textContent = "–";
    $("cntFollowing").textContent = "–";
    if (unavailable()) return;
    db().countFollow(me(), "followers").then((n) => { $("cntFollowers").textContent = n; }).catch(() => {});
    db().countFollow(me(), "following").then((n) => { $("cntFollowing").textContent = n; }).catch(() => {});
  }

  /* ---------- listas de seguidores ---------- */
  function closeFollowSheet(){ $("followSheet").hidden = true; }

  async function openFollowList(id, kind){

    const bad = unavailable();
    if (bad){ showToast(bad); return; }

    $("followTitle").textContent = kind === "followers" ? "Seguidores" : "Seguindo";
    $("followBody").innerHTML = '<div class="empty">Carregando…</div>';
    $("followSheet").hidden = false;

    try{
      const ids = await db().listFollow(id, kind);
      $("followBody").innerHTML = ids.length
        ? ids.map((x) => personRow({ uid: x, name: "…" }, { sub: '<span data-bio></span>' })).join("")
        : '<div class="empty">Ninguém por aqui ainda.</div>';
      hydrate($("followBody"));
    }catch(e){
      $("followBody").innerHTML = '<div class="empty">' + esc(errText(e)) + '</div>';
    }
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-follow-list]");
    if (!b) return;
    const inUser = currentView === "user";
    openFollowList(inUser ? S.userId : me(), b.dataset.followList);
  });

  $("followClose").addEventListener("click", closeFollowSheet);


  /* ---------- conversa ---------- */
  function openChat(id){
    const bad = unavailable();
    if (bad){ showToast(bad); return; }
    if (id === me()) return;
    S.peer = id;
    showView("chat", currentView === "user" ? "user" : "social");
    loadChatBackground();
    watchCallSessionForActiveChat();
  }

  function setChatInputValue(value){
    const input = document.getElementById("chatInput");
    if (!input) return;
    input.value = value;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function toggleChatToolbar(forceOpen){
    const toolbar = document.getElementById("chatToolbar");
    if (!toolbar) return;
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !S.quickPanelOpen;
    S.quickPanelOpen = shouldOpen;
    toolbar.hidden = !shouldOpen;
  }

  function buildEmojiPicker(){
    const grid = document.getElementById("emojiGrid");
    if (!grid) return;
    grid.innerHTML = CHAT_EMOJIS.map((emoji) =>
      '<button type="button" data-emoji="' + esc(emoji) + '" aria-label="Selecionar emoji ' + esc(emoji) + '">' + emoji + '</button>'
    ).join("");
  }

  function chatBgKey(){
    return "noxChatBg:" + (S.peer || "default");
  }

  function applyChatBackground(bg){
    const msgs = document.getElementById("chatMsgs");
    if (!msgs) return;

    if (!bg){
      msgs.style.background = CHAT_BG_PRESETS.default;
      msgs.style.backgroundSize = "cover";
      msgs.style.backgroundPosition = "center";
      msgs.style.backgroundRepeat = "no-repeat";
      return;
    }

    msgs.style.background = bg;
    msgs.style.backgroundSize = "cover";
    msgs.style.backgroundPosition = "center";
    msgs.style.backgroundRepeat = "no-repeat";
  }

  function setChatBackgroundPreset(name){
    const preset = CHAT_BG_PRESETS[name] || CHAT_BG_PRESETS.default;
    applyChatBackground(preset);
    document.querySelectorAll(".bg-option").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.bgPreset === name);
    });
    try{
      localStorage.setItem(chatBgKey(), JSON.stringify({ type: "preset", name }));
    }catch(e){}
  }

  function setChatBackgroundCustom(dataUrl){
    const safeUrl = String(dataUrl || "").replace(/"/g, "%22");
    const bg = 'linear-gradient(180deg, rgba(10,10,18,0.18), rgba(10,10,18,0.38)), url("' + safeUrl + '") center/cover no-repeat';
    applyChatBackground(bg);
    try{
      localStorage.setItem(chatBgKey(), JSON.stringify({ type: "custom", value: dataUrl }));
    }catch(e){}
  }

  function loadChatBackground(){
    if (!S.peer) return;
    try{
      const raw = localStorage.getItem(chatBgKey());
      if (!raw) {
        setChatBackgroundPreset("default");
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && parsed.type === "custom" && parsed.value) {
        setChatBackgroundCustom(parsed.value);
        return;
      }
      if (parsed && parsed.type === "preset") {
        setChatBackgroundPreset(parsed.name || "default");
        return;
      }
    }catch(e){}
    setChatBackgroundPreset("default");
  }

  function toggleEmojiPicker(forceOpen){
    const picker = document.getElementById("emojiPicker");
    if (!picker) return;
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : picker.hidden;
    picker.hidden = !shouldOpen;
    if (shouldOpen) toggleChatToolbar(false);
  }

  function insertEmoji(emojiText){
    const input = document.getElementById("chatInput");
    if (!input) return;
    const selected = emojiText || CHAT_EMOJIS[S.emojiIndex % CHAT_EMOJIS.length];
    S.emojiIndex += 1;
    const prefix = input.value.trim() ? input.value + " " : "";
    input.value = prefix + selected;
    input.focus();
    toggleEmojiPicker(false);
  }

  function addQuickMessage(text){
    const input = document.getElementById("chatInput");
    if (!input) return;
    if (!input.value.trim()){ input.value = text; }
    else { input.value = input.value.trim() + " " + text; }
    input.focus();
    toggleChatToolbar(false);
  }

  async function renderChatView(){

    const peer = S.peer;
    if (!peer) return;

    $("chatTitle").textContent = "…";
    $("chatMeta").textContent = "Disponível";
    $("chatMsgs").innerHTML = "";

    const u = await userInfo(peer);
    if (S.peer !== peer) return;
    $("chatTitle").textContent = u.name;
    $("chatMeta").textContent = "Online agora";
    paintAvatar($("chatAvatar"), u);
    loadChatBackground();

    const cid = chatIdWith(peer);
    if (S.unsubMsgs) S.unsubMsgs();

    S.unsubMsgs = db().subscribeMessages(cid, (msgs) => {

      const box = $("chatMsgs");
      const stick = box.scrollHeight - box.scrollTop - box.clientHeight < 80;

      box.innerHTML = msgs.length
        ? msgs.map((m) => {
            if (m.type === "sticker" && m.image) {
              return '<div class="bubble ' + (m.from === me() ? "mine" : "theirs") + '">' +
                '<img class="inline-sticker" src="' + esc(m.image) + '" alt="' + esc(m.alt || "figurinha") + '">' +
                '<time>' + fmtTime(m.at) + '</time></div>';
            }
            if (m.type === "audio" && m.audio) {
              return '<div class="bubble ' + (m.from === me() ? "mine" : "theirs") + '">' +
                '<audio controls src="' + esc(m.audio) + '"></audio>' +
                '<time>' + fmtTime(m.at) + '</time></div>';
            }
            return '<div class="bubble ' + (m.from === me() ? "mine" : "theirs") + '">' +
              '<span>' + esc(m.text || "") + '</span><time>' + fmtTime(m.at) + '</time></div>';
          }).join("")
        : '<div class="empty">Diga oi para ' + esc(u.name) + ' 👋</div>';

      if (stick || box.dataset.first !== cid){ box.scrollTop = box.scrollHeight; box.dataset.first = cid; }

      if (msgs.length) markSeen(cid, msgs[msgs.length - 1].at);
    }, (e) => {
      $("chatMsgs").innerHTML = '<div class="empty">' + esc(errText(e)) + '</div>';
    });
  }

  function getCallSessionId(otherUid){
    return [me(), otherUid].sort().join("_");
  }

  function updateCallStatus(text){
    const el = document.getElementById("callStatus");
    if (el) el.textContent = text;
  }

  function setCallOverlay(show){
    const overlay = document.getElementById("callOverlay");
    if (!overlay) return;
    overlay.hidden = !show;
    document.body.classList.toggle("no-scroll", show);
  }

  async function ensureCallMedia(type){
    const constraints = {
      audio: true,
      video: type === "video"
    };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Este navegador não suporta chamadas de voz/vídeo.");
    }

    if (S.localStream) {
      S.localStream.getTracks().forEach((track) => track.stop());
    }

    S.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    const localVideo = document.getElementById("localVideo");
    if (localVideo) {
      localVideo.srcObject = S.localStream;
      localVideo.muted = true;
    }
    return S.localStream;
  }

  function stopLocalCallTracks(){
    if (S.localStream) {
      S.localStream.getTracks().forEach((track) => track.stop());
      S.localStream = null;
    }
    const localVideo = document.getElementById("localVideo");
    if (localVideo) localVideo.srcObject = null;
    const remoteVideo = document.getElementById("remoteVideo");
    if (remoteVideo) remoteVideo.srcObject = null;
  }

  function cleanupPeerConnection(){
    if (S.peerConnection) {
      S.peerConnection.onicecandidate = null;
      S.peerConnection.ontrack = null;
      S.peerConnection.onconnectionstatechange = null;
      S.peerConnection.close();
      S.peerConnection = null;
    }
    S.callCandidates = [];
  }

  async function setupPeerConnection(type){
    if (!window.RTCPeerConnection) {
      throw new Error("WebRTC não está disponível neste navegador.");
    }

    cleanupPeerConnection();
    S.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }]
    });

    S.peerConnection.onicecandidate = async (event) => {
      if (!event.candidate) return;
      const cand = event.candidate.toJSON();
      S.callCandidates.push(cand);
      const sessionId = getCallSessionId(S.callPeer || S.peer);
      if (!sessionId) return;
      try {
        await db().pushCallEvent(sessionId, { type: "candidate", from: me(), data: cand });
      } catch (err) {
        console.warn("Erro ao enviar candidate da chamada:", err);
      }
    };

    S.peerConnection.ontrack = (event) => {
      const remoteVideo = document.getElementById("remoteVideo");
      if (remoteVideo && event.streams && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
      }
    };

    S.peerConnection.onconnectionstatechange = () => {
      const state = S.peerConnection?.connectionState || "new";
      if (state === "connected") updateCallStatus("Conectado");
      else if (state === "connecting") updateCallStatus("Conectando...");
      else if (state === "failed") updateCallStatus("Conexão falhou");
    };

    if (S.localStream) {
      S.localStream.getTracks().forEach((track) => {
        S.peerConnection.addTrack(track, S.localStream);
      });
    }

    const remoteVideo = document.getElementById("remoteVideo");
    if (remoteVideo && type === "video") {
      remoteVideo.style.display = "block";
    }
  }

  async function startCall(type){
    const bad = unavailable();
    if (bad){ showToast(bad); return; }
    if (!S.peer){ showToast("Abra uma conversa antes de iniciar a chamada."); return; }

    S.callType = type || "audio";
    S.callPeer = S.peer;
    S.callState = "dialing";

    try{
      await ensureCallMedia(S.callType);
      await setupPeerConnection(S.callType);

      document.getElementById("callTitle").textContent = "Chamada com " + (await userInfo(S.peer)).name;
      updateCallStatus("Solicitando conexão...");
      setCallOverlay(true);

      const sessionId = getCallSessionId(S.peer);
      const offer = await S.peerConnection.createOffer();
      await S.peerConnection.setLocalDescription(offer);
      await db().upsertCallSession(sessionId, {
        type: S.callType,
        status: "dialing",
        caller: me(),
        members: [me(), S.peer].sort(),
        offer: offer.toJSON(),
        answer: null,
        lastSignal: Date.now()
      });

      if (S.callType === "video") {
        const remoteVideo = document.getElementById("remoteVideo");
        if (remoteVideo) remoteVideo.style.display = "block";
      }

      showToast(S.callType === "video" ? "Chamada de vídeo iniciada" : "Chamada de voz iniciada");
    }catch(err){
      cleanupPeerConnection();
      stopLocalCallTracks();
      setCallOverlay(false);
      showToast(err && err.message ? err.message : "Não foi possível iniciar a chamada");
    }
  }

  async function acceptCall(payload){
    if (!payload || !payload.caller || payload.caller === me()) return;
    S.callType = payload.type || "audio";
    S.callPeer = payload.caller;
    S.callState = "connecting";

    try{
      await ensureCallMedia(S.callType);
      await setupPeerConnection(S.callType);
      setCallOverlay(true);
      document.getElementById("callTitle").textContent = "Chamada com " + (await userInfo(payload.caller)).name;
      updateCallStatus("Aceitando chamada...");

      const sessionId = getCallSessionId(payload.caller);
      await db().upsertCallSession(sessionId, {
        type: S.callType,
        status: "ringing",
        callee: me(),
        members: [me(), payload.caller].sort(),
        lastSignal: Date.now()
      });

      const offer = payload.offer;
      if (offer) {
        await S.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await S.peerConnection.createAnswer();
        await S.peerConnection.setLocalDescription(answer);
        await db().upsertCallSession(sessionId, {
          status: "connected",
          answer: answer.toJSON(),
          lastSignal: Date.now()
        });
        updateCallStatus("Chamada conectada");
      }
    }catch(err){
      console.warn("acceptCall error", err);
      updateCallStatus("Não foi possível aceitar a chamada");
    }
  }

  function closeCallUI(){
    cleanupPeerConnection();
    stopLocalCallTracks();
    S.callState = null;
    S.callPeer = null;
    setCallOverlay(false);
    if (S.callSessionUnsub) { S.callSessionUnsub(); S.callSessionUnsub = null; }
  }

  async function endCall(){
    if (!S.callPeer) return;
    const sessionId = getCallSessionId(S.callPeer);
    try{ await db().clearCallSession(sessionId); }catch(e){}
    closeCallUI();
    showToast("Chamada encerrada");
  }

  async function handleCallSession(payload){
    if (!payload || !payload.members) return;
    const meUid = me();
    const other = payload.members.find((x) => x !== meUid);
    if (!other) return;

    if (Array.isArray(payload.events)) {
      for (const event of payload.events) {
        if (!event || event.from === meUid || event.type !== "candidate" || !event.data || !S.peerConnection) continue;
        try {
          await S.peerConnection.addIceCandidate(new RTCIceCandidate(event.data));
        } catch (err) {
          console.warn("ICE candidate rejeitado:", err);
        }
      }
    }

    if (payload.answer && payload.caller === meUid && S.peerConnection && !S.peerConnection.remoteDescription) {
      try {
        await S.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
        updateCallStatus("Conectado");
      } catch (err) {
        console.warn("Erro ao aplicar resposta da chamada:", err);
      }
    }

    if (payload.status === "dialing" && payload.caller && payload.caller !== meUid) {
      const accept = await askConfirm("Receber chamada de " + (await userInfo(payload.caller)).name + "?", "Atender");
      if (accept) {
        await acceptCall(payload);
      }
    }

    if (payload.status === "connected" && payload.caller && payload.caller !== meUid) {
      updateCallStatus("Conectado");
    }
  }

  async function watchCallSessionForActiveChat(){
    if (!S.peer) return;
    const sessionId = getCallSessionId(S.peer);
    if (S.callSessionUnsub) S.callSessionUnsub();
    S.callSessionUnsub = db().subscribeCallSession(sessionId, async (payload) => {
      if (!payload) return;
      await handleCallSession(payload);
    }, (err) => console.warn("call session error", err));
  }

  function openStickerPicker(){
    const input = document.getElementById("chatStickerInput");
    if (!input) return;
    input.click();
  }

  function openAudioPicker(){
    const input = document.getElementById("chatAudioInput");
    if (!input) return;
    input.click();
  }

  async function sendSticker(file){
    if (!file || !S.peer || unavailable()) return;
    if (!file.type.startsWith("image/")) {
      showToast("Selecione uma imagem válida para a figurinha.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try{
        await db().sendMessage(chatIdWith(S.peer), [me(), S.peer].sort(), me(), "", {
          type: "sticker",
          image: String(reader.result || ""),
          alt: file.name || "figurinha"
        });
      }catch(err){
        showToast(errText(err));
      }
    };
    reader.readAsDataURL(file);
  }

  async function sendAudio(file){
    if (!file || !S.peer || unavailable()) return;
    if (!file.type.startsWith("audio/")) {
      showToast("Selecione um arquivo de áudio válido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try{
        await db().sendMessage(chatIdWith(S.peer), [me(), S.peer].sort(), me(), "", {
          type: "audio",
          audio: String(reader.result || ""),
          alt: file.name || "áudio"
        });
      }catch(err){
        showToast(errText(err));
      }
    };
    reader.readAsDataURL(file);
  }

  document.addEventListener("click", (e) => {
    const quick = e.target.closest("[data-chat-quick]");
    if (quick){
      addQuickMessage(quick.dataset.chatQuick);
      return;
    }

    const optionBtn = e.target.closest("#chatOptionsBtn");
    if (optionBtn){
      toggleChatToolbar();
      return;
    }

    const emojiBtn = e.target.closest("#chatEmojiBtn");
    if (emojiBtn){
      toggleEmojiPicker();
      return;
    }

    const emojiPick = e.target.closest("[data-emoji]");
    if (emojiPick){
      insertEmoji(emojiPick.dataset.emoji);
      return;
    }

    const bgPreset = e.target.closest("[data-bg-preset]");
    if (bgPreset){
      setChatBackgroundPreset(bgPreset.dataset.bgPreset);
      toggleChatToolbar(false);
      return;
    }

    const bgUpload = e.target.closest("#chatBgUploadBtn");
    if (bgUpload){
      const input = document.getElementById("chatBgInput");
      if (input) input.click();
      return;
    }

    const stickerBtn = e.target.closest("#chatStickerBtn");
    if (stickerBtn){
      openStickerPicker();
      return;
    }

    const audioBtn = e.target.closest("#chatAudioBtn");
    if (audioBtn){
      openAudioPicker();
      return;
    }

    const voiceCall = e.target.closest("#chatVoiceCallBtn");
    if (voiceCall){
      startCall("audio");
      return;
    }

    const videoCall = e.target.closest("#chatVideoCallBtn");
    if (videoCall){
      startCall("video");
      return;
    }

    const endCallBtn = e.target.closest("#callEndBtn");
    if (endCallBtn){
      endCall();
      return;
    }

    const micBtn = e.target.closest("#callMicBtn");
    if (micBtn){
      const audioTrack = S.localStream && S.localStream.getAudioTracks()[0];
      if (audioTrack){
        audioTrack.enabled = !audioTrack.enabled;
        micBtn.dataset.state = audioTrack.enabled ? "on" : "off";
        micBtn.textContent = audioTrack.enabled ? "Mic" : "Mic desligado";
      }
      return;
    }

    const camBtn = e.target.closest("#callCamBtn");
    if (camBtn){
      const videoTrack = S.localStream && S.localStream.getVideoTracks()[0];
      if (videoTrack){
        videoTrack.enabled = !videoTrack.enabled;
        camBtn.dataset.state = videoTrack.enabled ? "on" : "off";
        camBtn.textContent = videoTrack.enabled ? "Câmera" : "Câmera desligada";
      }
      return;
    }

    const closeCallBtn = e.target.closest("#callCloseBtn");
    if (closeCallBtn){
      endCall();
      return;
    }

    if (!e.target.closest("#chatToolbar") && !e.target.closest("#chatOptionsBtn")){
      toggleChatToolbar(false);
    }
  });

  $("chatForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    const input = $("chatInput");
    const text = input.value.trim().slice(0, 500);
    if (!text || !S.peer || unavailable()) return;

    input.value = "";
    toggleChatToolbar(false);
    toggleEmojiPicker(false);
    try{
      await db().sendMessage(chatIdWith(S.peer), [me(), S.peer].sort(), me(), text);
    }catch(err){
      input.value = text;
      showToast(errText(err));
    }
  });

  $("chatStickerInput").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      await sendSticker(file);
      e.target.value = "";
    }
  });

  $("chatAudioInput").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      await sendAudio(file);
      e.target.value = "";
    }
  });

  $("chatBgInput").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Selecione uma imagem válida para o fundo do chat.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setChatBackgroundCustom(String(reader.result || ""));
      toggleChatToolbar(false);
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  });

  function onLeave(from, to){
    if (from === "chat" && to !== "chat"){
      if (S.unsubMsgs){
        S.unsubMsgs();
        S.unsubMsgs = null;
      }
      if (S.callSessionUnsub){
        S.callSessionUnsub();
        S.callSessionUnsub = null;
      }
      if (to !== "chat" && S.callState){
        endCall();
      }
    }
  }

  /* ---------- teste para as Configurações ---------- */
  async function check(box){

    const bad = unavailable();
    if (bad){ diag(box, "bad", "Social indisponível", esc(bad)); return; }

    diag(box, "", "Testando…");

    try{
      await db().upsertUser(me(), {
        name: userName().slice(0, 30), nameLower: userName().slice(0, 30).toLowerCase()
      });
      const back = await db().getUser(me());
      if (!back) throw new Error("O perfil não voltou do servidor");
      await db().countFollow(me(), "followers");
      diag(box, "ok", "Chat e seguidores funcionando", "Seu perfil público está salvo no Firestore.");
    }catch(e){
      diag(box, "bad", "Não funcionou", esc(errText(e)));
    }
  }

  return { start, stop, sync, nameFree, render, renderUserView, renderChatView, fillCounts, onLeave, check, updateBadge };
})();

const renderSocial   = () => Social.render();
const renderUserView = () => Social.renderUserView();
const renderChatView = () => Social.renderChatView();
