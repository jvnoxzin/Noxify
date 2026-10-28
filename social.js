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
    callCandidates: [],
    callPending: [],
    callSeen: false,
    callRinging: false
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

  const CHAT_EMOJIS = ["😊", "😂", "🔥", "🎵", "🗿", "😎", "❤️", "🐒", "😍", "🥰", "🖕🏻", "🫦", "👍", "💩", "🙄", "✨"];

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
    const safeUrl = String(dataUrl || "
