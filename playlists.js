/* =========================================================
   NOXIFY — playlists.js
   Playlists personalizadas: nome, foto e músicas.
   Ficam guardadas neste aparelho, separadas por conta.
========================================================= */

const Playlists = {

  key(){ return "noxPlaylists:" + (localStorage.getItem("noxUid") || "guest"); },

  all(){
    try{
      const list = JSON.parse(localStorage.getItem(this.key()) || "[]");
      return Array.isArray(list) ? list : [];
    }catch(e){ return []; }
  },

  write(list){
    try{
      localStorage.setItem(this.key(), JSON.stringify(list));
      return true;
    }catch(e){
      showToast("Sem espaço para guardar. Tente uma foto menor.");
      return false;
    }
  },

  get(id){ return this.all().find((p) => p.id === id) || null; },

  create(data){
    const list = this.all();
    const pl = {
      id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: data.name, cover: data.cover || "", songs: data.songs || []
    };
    list.unshift(pl);
    return this.write(list) ? pl : null;
  },

  update(id, patch){
    const list = this.all();
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) return false;
    list[i] = Object.assign(list[i], patch);
    return this.write(list);
  },

  remove(id){
    return this.write(this.all().filter((p) => p.id !== id));
  },

  addSong(id, src){
    const pl = this.get(id);
    if (!pl) return false;
    if (pl.songs.includes(src)) return "dup";
    return this.update(id, { songs: pl.songs.concat(src) });
  },

  removeSong(id, src){
    const pl = this.get(id);
    return pl ? this.update(id, { songs: pl.songs.filter((s) => s !== src) }) : false;
  },

  songs(pl){ return pl.songs.map((s) => SONGS[s]).filter(Boolean); },

  /* capa: foto escolhida > capa da primeira música > roxo padrão */
  coverCss(pl){
    if (pl.cover) return photoCss(pl.cover);
    const first = this.songs(pl)[0];
    return first
      ? "url('" + first.cover + "') center/cover no-repeat, linear-gradient(135deg,#3b1e5c,#1d1033)"
      : "linear-gradient(135deg,#7c3aed,#312e81)";
  }
};


/* ---------- lista na Biblioteca ---------- */
function renderPlaylistGrid(){

  const list = Playlists.all();

  $("plGrid").innerHTML = list.length
    ? list.map((pl) =>
        '<button class="pl-card" data-pl="' + esc(pl.id) + '">' +
        '<div class="pl-card-cover" style="background:' + Playlists.coverCss(pl).replace(/"/g, "&quot;") + '"></div>' +
        '<div class="pl-card-name">' + esc(pl.name) + '</div>' +
        '<div class="pl-card-meta">' + Playlists.songs(pl).length + ' músicas</div></button>'
      ).join("")
    : '<div class="empty" style="grid-column:1/-1">Você ainda não criou nenhuma playlist.<br>Toque em “Nova playlist”.</div>';
}

$("plGrid").addEventListener("click", (e) => {
  const card = e.target.closest("[data-pl]");
  if (card) openPlaylist(card.dataset.pl);
});


/* ---------- tela da playlist ---------- */
let plCurrent = null;

function openPlaylist(id){
  plCurrent = id;
  showView("playlist", "library");
}

function renderPlaylistView(){

  const pl = Playlists.get(plCurrent);
  if (!pl){ libTab = "playlists"; showView("library"); return; }

  const songs = Playlists.songs(pl);

  $("plCover").style.background = Playlists.coverCss(pl);
  $("plName").textContent = pl.name;
  $("plMeta").textContent = songs.length + (songs.length === 1 ? " música" : " músicas");

  ctxNames.playlist = pl.name;
  renderList($("plList"), songs);
}

function playPlaylist(shuffle){

  const pl = Playlists.get(plCurrent);
  const songs = pl ? Playlists.songs(pl) : [];
  if (!songs.length){ showToast("A playlist está vazia"); return; }

  setShuffle(shuffle ? "smart" : "off");

  pushRecentKey("pl:" + pl.id);
  const first = shuffle ? songs[Math.floor(Math.random() * songs.length)] : songs[0];
  playSong(first, songs, pl.name);
}

/* baixa todas as músicas da playlist para ouvir offline */
async function downloadPlaylist(){

  const pl = Playlists.get(plCurrent);
  if (!pl) return;

  const todo = Playlists.songs(pl).filter((s) => !isOffline(s));
  if (!todo.length){ showToast("Todas já estão offline"); return; }

  if (blockedByWifiRule()){ showToast("Conecte ao Wi-Fi para baixar"); return; }
  if (downloadingAll) return;

  if (!await askConfirm("Baixar " + todo.length + (todo.length === 1 ? " música" : " músicas") + " da playlist “" + pl.name + "”?", "Baixar")) return;

  downloadingAll = true;
  let ok = 0;
  try{
    for (let i = 0; i < todo.length; i++){
      showToast("Baixando " + (i + 1) + "/" + todo.length);
      if (await downloadSong(todo[i], true)) ok++;
    }
  }finally{
    downloadingAll = false;
  }

  refreshOfflineUI();
  renderPlaylistView();
  showToast(ok + " de " + todo.length + " baixadas");
}

function removeFromPlaylist(src){
  Playlists.removeSong(plCurrent, src);
  renderPlaylistView();
  showToast("Tirada da playlist");
}


/* ---------- criar / editar ---------- */
let plDraft = null;   // { id|null, name, cover, songs:Set }

function newPlaylist(preselect){
  plDraft = { id: null, name: "", cover: "", songs: new Set(preselect ? [preselect] : []) };
  openPlaylistEditor();
}

function editCurrentPlaylist(){
  const pl = Playlists.get(plCurrent);
  if (!pl) return;
  plDraft = { id: pl.id, name: pl.name, cover: pl.cover, songs: new Set(pl.songs) };
  openPlaylistEditor();
}

function openPlaylistEditor(){
  $("plEditTitle").textContent = plDraft.id ? "Editar playlist" : "Nova playlist";
  $("plNameInput").value = plDraft.name;
  $("plSongSearch").value = "";
  $("plDelete").hidden = !plDraft.id;
  renderPlaylistPicker();
  refreshPlaylistEditor();
  $("plEditor").hidden = false;
}

function closePlaylistEditor(){
  $("plEditor").hidden = true;
  plDraft = null;
}

function refreshPlaylistEditor(){
  if (!plDraft) return;

  const first = SONGS[Array.from(plDraft.songs)[0]];
  $("plEditCover").style.background = plDraft.cover
    ? photoCss(plDraft.cover)
    : first
      ? "url('" + first.cover + "') center/cover no-repeat, linear-gradient(135deg,#3b1e5c,#1d1033)"
      : "linear-gradient(135deg,#7c3aed,#312e81)";

  $("plRemoveCover").hidden = !plDraft.cover;
  $("plPickCount").textContent = plDraft.songs.size + (plDraft.songs.size === 1 ? " música escolhida" : " músicas escolhidas");
}

function renderPlaylistPicker(){

  const q = $("plSongSearch").value.trim().toLowerCase();
  const songs = PLAYLIST.filter((s) =>
    !q || s.name.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
  );

  $("plPickList").innerHTML = songs.length
    ? songs.map((s) =>
        '<label class="song-row pick-row" data-src="' + esc(s.src) + '">' +
        '<div class="cover" style="' + coverStyle(s) + '"></div>' +
        '<div class="song-info"><div class="song-name">' + esc(s.name) + '</div>' +
        '<div class="song-artist">' + esc(s.artist) + '</div></div>' +
        '<input class="switch pick-box" type="checkbox"' + (plDraft && plDraft.songs.has(s.src) ? " checked" : "") + '></label>'
      ).join("")
    : '<div class="empty">Nenhuma música encontrada</div>';
}

$("plSongSearch").addEventListener("input", renderPlaylistPicker);

$("plPickList").addEventListener("change", (e) => {
  const row = e.target.closest(".pick-row");
  if (!row || !plDraft) return;
  if (e.target.checked) plDraft.songs.add(row.dataset.src);
  else plDraft.songs.delete(row.dataset.src);
  refreshPlaylistEditor();
});

/* o clique nas linhas do seletor não pode tocar a música */
$("plPickList").addEventListener("click", (e) => e.stopPropagation());

$("plCoverFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file || !plDraft) return;
  try{
    plDraft.cover = await imageToDataUrl(file, 400, 400, 0.8);
    refreshPlaylistEditor();
  }catch(err){ showToast(err.message); }
});

function removePlaylistCover(){
  if (!plDraft) return;
  plDraft.cover = "";
  refreshPlaylistEditor();
}

function savePlaylistEditor(){

  if (!plDraft) return;

  const name = $("plNameInput").value.trim();
  if (!name){ showToast("Dê um nome para a playlist"); return; }

  /* mantém a ordem da playlist e põe as novas no fim */
  const old = plDraft.id ? (Playlists.get(plDraft.id) || { songs: [] }).songs : [];
  const songs = old.filter((s) => plDraft.songs.has(s))
    .concat(Array.from(plDraft.songs).filter((s) => !old.includes(s)));

  let id = plDraft.id;

  if (id){
    if (!Playlists.update(id, { name, cover: plDraft.cover, songs })) return;
  }else{
    const pl = Playlists.create({ name, cover: plDraft.cover, songs });
    if (!pl) return;
    id = pl.id;
  }

  closePlaylistEditor();
  showToast("Playlist salva");

  if (currentView === "playlist" && id === plCurrent) renderPlaylistView();
  else openPlaylist(id);
}

async function deleteCurrentPlaylist(){
  if (!plDraft || !plDraft.id) return;
  if (!(await askConfirm("Apagar esta playlist? As músicas continuam no app.", "Apagar"))) return;
  Playlists.remove(plDraft.id);
  closePlaylistEditor();
  libTab = "playlists";
  showView("library");
  showToast("Playlist apagada");
}


/* ---------- "adicionar à playlist" (a partir de uma música) ---------- */
let pickerSong = null;

function openPlaylistPicker(song){
  pickerSong = song;
  $("plChooseSong").textContent = song.name;

  const list = Playlists.all();
  $("plChooseList").innerHTML =
    '<button class="menu-item" data-choose="__new">' + iconHtml("plus") + 'Nova playlist</button>' +
    list.map((pl) =>
      '<button class="menu-item" data-choose="' + esc(pl.id) + '">' +
      '<span class="pl-mini" style="background:' + Playlists.coverCss(pl).replace(/"/g, "&quot;") + '"></span>' +
      esc(pl.name) + (pl.songs.includes(song.src) ? ' <small class="muted">· já tem</small>' : "") + '</button>'
    ).join("");

  $("plChoose").hidden = false;
}

function closePlaylistPicker(){ $("plChoose").hidden = true; }

$("plChooseList").addEventListener("click", (e) => {

  const btn = e.target.closest("[data-choose]");
  if (!btn || !pickerSong) return;

  const song = pickerSong;
  closePlaylistPicker();

  if (btn.dataset.choose === "__new"){ newPlaylist(song.src); return; }

  const r = Playlists.addSong(btn.dataset.choose, song.src);
  const pl = Playlists.get(btn.dataset.choose);
  showToast(r === "dup" ? "Essa música já está na playlist" : r ? "Adicionada a " + (pl ? pl.name : "playlist") : "Não consegui adicionar");
});

function addCurrentToPlaylist(){
  if (!current){ showToast("Toque uma música primeiro"); return; }
  openPlaylistPicker(current);
}
