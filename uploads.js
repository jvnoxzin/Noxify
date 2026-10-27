/* =========================================================
   NOXIFY — uploads.js
   Músicas enviadas pelos usuários (MP3 no Firebase Storage,
   dados no Firestore: coleção userSongs).

   • Privada: só o dono ouve/baixa. Pública: qualquer usuário logado.
   • O app NUNCA usa link público de download: o arquivo é buscado
     com o login do usuário (getBlob), então as regras do Storage
     valem em todo acesso. Veja storage.rules e firestore.rules.
========================================================= */

/* limites (mantenha iguais aos de storage.rules e firestore.rules) */
const UPLOAD_MAX_MB = 25;
const UPLOAD_MAX_SONGS = 100;      // limite por usuário (só no app; veja LEIA-ME-UPLOAD.txt)
const UPLOAD_MIN_KB = 20;

const Uploads = (() => {

  const S = {
    mine: null,              // minhas músicas (dados do Firestore)
    mineAt: 0,
    users: {},               // uid -> { at, list }
    shown: { mine: 30, user: 30 },
    urls: new Map(),         // id -> blob: URL do áudio já baixado
    pending: new Map(),      // id -> Promise (download em andamento)
    covers: new Map(),       // caminho da capa -> blob: URL
    editing: null,
    ctl: null,
    file: null,
    cover: null,
    sending: false
  };

  const db = () => window.NoxDB;
  const me = () => (window.auth && window.auth.currentUser) ? window.auth.currentUser.uid : null;

  /* ---------- mensagens de erro em português ---------- */
  function errText(e){
    const code = (e && e.code) || "";
    if (code === "storage/canceled") return "Envio cancelado.";
    if (code === "unauthenticated") return "Entre na sua conta (com internet) para enviar músicas.";
    if (code.includes("storage/unauthorized") || code.includes("permission-denied") || code === "storage/unauthenticated")
      return "Sem permissão. As regras do Firebase (Storage e Firestore) ainda não foram publicadas, ou você precisa entrar de novo.";
    if (code === "storage/object-not-found") return "Esse arquivo não existe mais.";
    if (code === "storage/bucket-not-found" || code === "storage/project-not-found")
      return "O Firebase Storage ainda não foi ativado neste projeto (veja o LEIA-ME-UPLOAD.txt).";
    if (code === "storage/quota-exceeded") return "O limite gratuito do Firebase Storage acabou.";
    if (code === "storage/retry-limit-exceeded" || code === "storage/network-request-failed" || code.includes("unavailable") || code.includes("network"))
      return "Falha de conexão. Verifique a internet e tente de novo.";
    if (code === "storage/invalid-argument") return "Arquivo recusado pelo servidor.";
    if (e && /CORS|cors|NetworkError|Failed to fetch|XMLHttpRequest/i.test(String(e.message || e)))
      return "O navegador bloqueou o download (CORS). Faça a configuração do passo CORS do LEIA-ME-UPLOAD.txt.";
    return "Erro: " + (code || (e && e.message) || "desconhecido");
  }

  function unavailable(){
    if (!db()) return "O envio de músicas não carregou (sem internet ou Firebase bloqueado).";
    if (!me()) return "Entre na sua conta, com internet, para usar músicas enviadas.";
    return null;
  }

  /* ---------- música do Firestore -> música do player ---------- */
  function toPlayer(doc){
    const key = "cloud:" + doc.id;
    let song = SONGS[key];
    if (!song){
      song = { name: doc.title, artist: doc.artist, src: key, cover: "icon-192.png", cloud: true, doc };
      SONGS[key] = song;
    }
    song.name = doc.title;
    song.artist = doc.artist;
    song.doc = doc;
    return song;
  }

  const safeFile = (s) => String(s).replace(/[\\/:*?"<>|#%\u0000-\u001f]/g, "").trim().slice(0, 80) || "musica";

  /* ---------- áudio: baixa com o login e vira um endereço local ---------- */
  const cachedUrl = (song) => (song.doc && S.urls.get(song.doc.id)) || null;

  function trimUrls(keepId){
    while (S.urls.size > 4){
      const oldest = Array.from(S.urls.keys()).find((k) => k !== keepId);
      if (!oldest) break;
      URL.revokeObjectURL(S.urls.get(oldest));
      S.urls.delete(oldest);
    }
  }

  function resolveUrl(song){

    const id = song.doc.id;
    if (S.urls.has(id)) return Promise.resolve(S.urls.get(id));
    if (S.pending.has(id)) return S.pending.get(id);

    const bad = unavailable();
    if (bad) return Promise.reject(Object.assign(new Error(bad), { code: "unauthenticated" }));

    const p = db().getFileBlob(song.doc.audioPath).then((blob) => {
      const url = URL.createObjectURL(blob);
      S.urls.set(id, url);
      trimUrls(id);
      return url;
    }).finally(() => S.pending.delete(id));

    S.pending.set(id, p);
    return p;
  }

  async function saveFile(song){

    try{
      showToast("Preparando o download…");
      const url = await resolveUrl(song);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFile(song.artist + " - " + song.name) + ".mp3";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    }catch(e){
      showToast(errText(e));
      return false;
    }
  }

  /* ---------- capas (carrega só as da tela) ---------- */
  async function coverUrl(doc){
    if (!doc.coverPath) return null;
    if (S.covers.has(doc.coverPath)) return S.covers.get(doc.coverPath);
    try{
      const url = URL.createObjectURL(await db().getFileBlob(doc.coverPath));
      S.covers.set(doc.coverPath, url);
      return url;
    }catch(e){ return null; }
  }

  async function ensureCover(song){

    const url = await coverUrl(song.doc);
    if (!url) return;

    song.cover = url;

    document.querySelectorAll('.cover[data-cover="' + song.doc.id + '"]').forEach((el) => {
      el.style.backgroundImage = "url('" + url + "')";
    });

    if (typeof current !== "undefined" && current === song){
      $("fpCover").src = url;
      $("miniCover").style.cssText = coverStyle(song);
      updateMediaSession(song);
    }
  }

  /* ---------- listas ---------- */
  function rowHtml(song, mine){

    const d = song.doc;
    const badge = '<span class="vis-badge ' + d.visibility + '">' + (d.visibility === "public" ? "Pública" : "Privada") + '</span>';

    return '<div class="song-row cloud-row' + (song === current ? " playing" : "") + '" data-src="' + esc(song.src) + '" data-id="' + esc(d.id) + '">' +
      '<span class="fila-hint">+ Fila</span>' +
      '<div class="cover" data-cover="' + esc(d.id) + '" style="' + coverStyle(song) + '"></div>' +
      '<div class="song-info"><div class="song-name">' + esc(song.name) + '</div>' +
      '<div class="song-artist">' + (mine ? badge + " " : "") + esc(song.artist) +
      (mine ? "" : " · por " + esc(d.ownerName || "alguém")) + '</div></div>' +
      '<button class="row-btn" data-up="dl" aria-label="Baixar o MP3">' + iconHtml("download") + '</button>' +
      (mine ? '<button class="row-btn" data-up="edit" aria-label="Editar">' + iconHtml("edit") + '</button>' : "") +
      '<button class="row-btn play" data-act="play" aria-label="Tocar">' + iconHtml("play") + '</button>' +
      '</div>';
  }

  function paint(el, docs, mine, ctx, name, shownKey, emptyText){

    const songs = docs.map(toPlayer);
    ctxLists[ctx] = songs;
    ctxNames[ctx] = name;

    const part = songs.slice(0, S.shown[shownKey]);

    el.innerHTML = songs.length
      ? part.map((s) => rowHtml(s, mine)).join("") +
        (songs.length > part.length ? '<button class="link-btn more-btn" data-up="more" data-key="' + shownKey + '">Mostrar mais (' + (songs.length - part.length) + ')</button>' : "")
      : '<div class="empty">' + emptyText + '</div>';

    part.forEach((s) => ensureCover(s));
    markPlaying();
  }

  async function renderMine(force){

    const box = $("mySongs");
    const bad = unavailable();

    if (bad){
      box.innerHTML = '<div class="empty">' + esc(bad) + '</div>';
      return;
    }

    if (force || !S.mine || Date.now() - S.mineAt > 30000){
      box.innerHTML = '<div class="empty">Carregando…</div>';
      try{
        S.mine = await db().listMySongs(me());
        S.mineAt = Date.now();
      }catch(e){
        box.innerHTML = '<div class="empty">' + esc(errText(e)) + '</div>';
        return;
      }
    }

    paint(box, S.mine, true, "mysongs", "Minhas músicas", "mine",
      "Você ainda não enviou nenhuma música.<br>Toque em “+ Enviar música”.");
  }

  async function renderUser(uid, force){

    const box = $("userSongs");
    if (S.userUid !== uid){ S.userUid = uid; S.shown.user = 30; }
    const bad = unavailable();

    if (bad){
      box.innerHTML = '<div class="empty">' + esc(bad) + '</div>';
      return;
    }

    const hit = S.users[uid];

    if (force || !hit || Date.now() - hit.at > 30000){
      box.innerHTML = '<div class="empty">Carregando…</div>';
      try{
        S.users[uid] = { at: Date.now(), list: await db().listPublicSongs(uid) };
      }catch(e){
        box.innerHTML = '<div class="empty">' + esc(errText(e)) + '</div>';
        return;
      }
    }

    paint(box, S.users[uid].list, false, "usersongs", "Músicas publicadas", "user",
      "Nenhuma música publicada por esta pessoa.");
  }

  function onListClick(e){

    const btn = e.target.closest("[data-up]");
    if (!btn) return;

    e.stopPropagation();   // não toca a música

    if (btn.dataset.up === "more"){
      S.shown[btn.dataset.key] += 30;
      if (btn.dataset.key === "mine") renderMine(false);
      else renderUser(S.userUid, false);
      return;
    }

    const row = btn.closest(".song-row");
    const song = row && SONGS[row.dataset.src];
    if (!song) return;

    if (btn.dataset.up === "dl") saveFile(song);
    if (btn.dataset.up === "edit") openEdit(song);
  }

  $("mySongs").addEventListener("click", onListClick);
  $("userSongs").addEventListener("click", onListClick);


  /* ---------- enviar ---------- */
  const mb = (n) => (n / 1048576).toFixed(n >= 10485760 ? 0 : 1).replace(".", ",") + " MB";

  /* confere o começo do arquivo: precisa ser MP3 de verdade (etiqueta ID3 ou quadro de áudio) */
  async function looksLikeMp3(file){

    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    let start = 0;

    if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33){
      start = 10 + (((head[6] & 127) << 21) | ((head[7] & 127) << 14) | ((head[8] & 127) << 7) | (head[9] & 127));
    }

    const buf = new Uint8Array(await file.slice(start, start + 16384).arrayBuffer());

    for (let i = 0; i < buf.length - 3; i++){
      if (buf[i] !== 0xFF || (buf[i + 1] & 0xE0) !== 0xE0) continue;
      const ver = (buf[i + 1] >> 3) & 3, layer = (buf[i + 1] >> 1) & 3;
      const bi = (buf[i + 2] >> 4) & 15, si = (buf[i + 2] >> 2) & 3;
      if (ver !== 1 && layer === 1 && bi !== 0 && bi !== 15 && si !== 3) return true;
    }
    return false;
  }

  /* o navegador consegue abrir esse áudio? (pega arquivo corrompido ou "falso" .mp3) */
  function decodes(file){
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const a = new Audio();
      let done = false;
      const end = (ok) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(ok); };
      a.preload = "metadata";
      a.onloadedmetadata = () => end(isFinite(a.duration) && a.duration > 1);
      a.onerror = () => end(false);
      setTimeout(() => end(false), 10000);
      a.src = url;
    });
  }

  function upStatus(text, kind){
    const el = $("upStatus");
    el.hidden = !text;
    el.className = "diag" + (kind ? " " + kind : "");
    el.innerHTML = text ? "<span>" + text + "</span>" : "";
  }

  function upSetBusy(busy){
    S.sending = busy;
    ["upPick", "upTitle", "upArtist", "upCoverPick", "upRights"].forEach((id) => { $(id).disabled = busy; });
    document.querySelectorAll("#upVis button").forEach((b) => { b.disabled = busy; });
    $("upSend").hidden = busy;
    $("upCancel").hidden = !busy;
    $("upClose").disabled = busy;
    $("upProgressBox").hidden = !busy;
  }

  function upVisibility(){
    const on = document.querySelector("#upVis .seg-btn.active");
    return on ? on.dataset.value : "private";
  }

  function openUpload(){

    const bad = unavailable();
    if (bad){ showToast(bad); return; }

    if (S.mine && S.mine.length >= UPLOAD_MAX_SONGS){
      showToast("Limite de " + UPLOAD_MAX_SONGS + " músicas enviadas. Exclua alguma para enviar outra.");
      return;
    }

    S.file = null;
    S.cover = null;
    $("upFileName").textContent = "Nenhum arquivo escolhido";
    $("upTitle").value = "";
    $("upArtist").value = "";
    $("upRights").checked = false;
    $("upCoverThumb").style.backgroundImage = "";
    $("upCoverThumb").classList.remove("has");
    $("upCoverRemove").hidden = true;
    document.querySelectorAll("#upVis .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.value === "private"));
    $("upLimit").textContent = "MP3 de até " + UPLOAD_MAX_MB + " MB.";
    upStatus("");
    upSetBusy(false);
    $("upSheet").hidden = false;
  }

  function closeUpload(){
    if (S.sending) return;
    $("upSheet").hidden = true;
  }

  $("upVis").addEventListener("click", (e) => {
    const b = e.target.closest(".seg-btn");
    if (!b || S.sending) return;
    document.querySelectorAll("#upVis .seg-btn").forEach((x) => x.classList.toggle("active", x === b));
    $("upVisHint").textContent = b.dataset.value === "public"
      ? "Qualquer usuário do Noxify poderá ouvir e baixar esta música."
      : "Só você poderá ouvir e baixar.";
  });

  $("upFile").addEventListener("change", async (e) => {

    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    S.file = null;
    $("upFileName").textContent = "Verificando…";
    upStatus("");

    const fail = (msg) => { $("upFileName").textContent = "Nenhum arquivo escolhido"; upStatus(msg, "bad"); };

    if (!/\.mp3$/i.test(file.name)) return fail("Escolha um arquivo com a extensão .mp3.");
    if (file.size === 0) return fail("Esse arquivo está vazio.");
    if (file.size < UPLOAD_MIN_KB * 1024) return fail("Esse arquivo é pequeno demais para ser uma música.");
    if (file.size > UPLOAD_MAX_MB * 1048576) return fail("Esse arquivo tem " + mb(file.size) + ". O limite é " + UPLOAD_MAX_MB + " MB.");

    let ok = false;
    try{ ok = await looksLikeMp3(file) && await decodes(file); }catch(err){ ok = false; }
    if (!ok) return fail("Não consegui ler esse arquivo como MP3. Ele pode estar corrompido ou não ser um MP3 de verdade.");

    S.file = file;
    $("upFileName").textContent = file.name + " · " + mb(file.size);

    if (!$("upTitle").value.trim()){
      $("upTitle").value = file.name.replace(/\.mp3$/i, "").replace(/[_]+/g, " ").trim().slice(0, 80);
    }
  });

  $("upCoverFile").addEventListener("change", async (e) => {

    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    try{
      const dataUrl = await imageToDataUrl(file, 600, 600, 0.82);
      S.cover = await (await fetch(dataUrl)).blob();
      $("upCoverThumb").style.backgroundImage = "url('" + dataUrl + "')";
      $("upCoverThumb").classList.add("has");
      $("upCoverRemove").hidden = false;
    }catch(err){
      upStatus(esc(err.message), "bad");
    }
  });

  $("upCoverRemove").addEventListener("click", () => {
    S.cover = null;
    $("upCoverThumb").style.backgroundImage = "";
    $("upCoverThumb").classList.remove("has");
    $("upCoverRemove").hidden = true;
  });

  async function send(){

    if (S.sending) return;

    const bad = unavailable();
    if (bad){ upStatus(esc(bad), "bad"); return; }
    if (!navigator.onLine){ upStatus("Sem internet. Conecte-se e tente de novo.", "bad"); return; }

    const title = $("upTitle").value.trim();
    const artist = $("upArtist").value.trim();

    if (!S.file) return upStatus("Escolha o arquivo MP3.", "bad");
    if (!title || title.length > 80) return upStatus("Digite o título (até 80 letras).", "bad");
    if (!artist || artist.length > 60) return upStatus("Digite o nome do artista (até 60 letras).", "bad");
    if (!$("upRights").checked) return upStatus("Confirme que você tem os direitos desta música.", "bad");

    S.ctl = {};
    upStatus("");
    upSetBusy(true);
    $("upBar").style.width = "0%";
    $("upPercent").textContent = "0%";

    try{
      await db().uploadSong({
        file: S.file, cover: S.cover, title, artist,
        visibility: upVisibility(), ownerName: userName().slice(0, 30)
      }, (p) => {
        const pct = Math.round(p * 100);
        $("upBar").style.width = pct + "%";
        $("upPercent").textContent = pct + "%";
      }, S.ctl);

      upSetBusy(false);
      $("upSheet").hidden = true;
      showToast("Música enviada");
      S.mine = null;
      if (currentView === "profile") renderMine(true);

    }catch(err){
      upSetBusy(false);
      upStatus(esc(errText(err)) + (err && err.code === "storage/canceled" ? "" : " Toque em Enviar para tentar de novo."), err && err.code === "storage/canceled" ? "warn" : "bad");
    }
  }

  $("upSend").addEventListener("click", send);
  $("upCancel").addEventListener("click", () => { if (S.ctl && S.ctl.cancel) S.ctl.cancel(); });


  /* ---------- editar / visibilidade / excluir ---------- */
  function editVisibility(){
    const on = document.querySelector("#edVis .seg-btn.active");
    return on ? on.dataset.value : "private";
  }

  function openEdit(song){
    S.editing = song;
    $("edTitle").value = song.doc.title;
    $("edArtist").value = song.doc.artist;
    document.querySelectorAll("#edVis .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.value === song.doc.visibility));
    $("edStatus").hidden = true;
    $("edSheet").hidden = false;
  }

  function closeEdit(){
    $("edSheet").hidden = true;
    S.editing = null;
  }

  $("edVis").addEventListener("click", (e) => {
    const b = e.target.closest(".seg-btn");
    if (!b) return;
    document.querySelectorAll("#edVis .seg-btn").forEach((x) => x.classList.toggle("active", x === b));
  });

  function edStatus(text, kind){
    const el = $("edStatus");
    el.hidden = !text;
    el.className = "diag" + (kind ? " " + kind : "");
    el.innerHTML = text ? "<span>" + text + "</span>" : "";
  }

  async function saveEdit(){

    const song = S.editing;
    if (!song) return;

    const title = $("edTitle").value.trim();
    const artist = $("edArtist").value.trim();
    const visibility = editVisibility();

    if (!title || title.length > 80) return edStatus("Digite o título (até 80 letras).", "bad");
    if (!artist || artist.length > 60) return edStatus("Digite o nome do artista (até 60 letras).", "bad");

    const patch = {};
    if (title !== song.doc.title) patch.title = title;
    if (artist !== song.doc.artist) patch.artist = artist;
    if (visibility !== song.doc.visibility) patch.visibility = visibility;

    if (!Object.keys(patch).length){ closeEdit(); return; }

    if (patch.visibility === "public" &&
        !(await askConfirm("Tornar esta música pública? Qualquer usuário do Noxify poderá ouvir e baixar.", "Tornar pública"))) return;

    try{
      await db().updateSong(song.doc.id, patch);
      Object.assign(song.doc, patch);
      toPlayer(song.doc);
      showToast(patch.visibility === "private" ? "Agora é privada" : "Música atualizada");
      closeEdit();
      renderMine(false);
    }catch(e){
      edStatus(esc(errText(e)), "bad");
    }
  }

  async function removeSong(){

    const song = S.editing;
    if (!song) return;

    if (!(await askConfirm("Excluir “" + song.name + "” para sempre? O arquivo e os dados serão apagados.", "Excluir"))) return;

    try{
      await db().deleteSong(song.doc);
    }catch(e){
      edStatus(esc(errText(e)) + " Toque em Excluir para tentar de novo.", "bad");
      return;
    }

    /* tira do player, da fila e das listas */
    if (current === song){ audio.pause(); current = null; $("mini").hidden = true; document.body.classList.remove("has-mini"); }
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i] === song) queue.splice(i, 1);
    if (S.urls.has(song.doc.id)){ URL.revokeObjectURL(S.urls.get(song.doc.id)); S.urls.delete(song.doc.id); }
    delete SONGS[song.src];
    renderQueueViews();

    S.mine = (S.mine || []).filter((d) => d.id !== song.doc.id);
    closeEdit();
    showToast("Música excluída");
    renderMine(false);
  }

  $("edSave").addEventListener("click", saveEdit);
  $("edDelete").addEventListener("click", removeSong);

  return {
    renderMine, renderUser, resolveUrl, cachedUrl, saveFile, ensureCover, errText,
    openUpload, closeUpload, closeEdit
  };
})();

const openUpload = () => Uploads.openUpload();
const closeUpload = () => Uploads.closeUpload();
const closeEdit = () => Uploads.closeEdit();
