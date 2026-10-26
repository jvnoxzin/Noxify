/* =========================================================
   NOXIFY — stats.js
   Registra o que você ouve e monta a Cápsula sonora
   (do mês e total). Tudo fica salvo só neste aparelho.
========================================================= */

const Stats = {

  data: null,
  _timer: null,

  bucket(){ return { sec: 0, plays: 0, songs: {}, artists: {} }; },

  empty(){ return { v: 1, total: this.bucket(), months: {} }; },

  key(){ return "noxStats:" + (localStorage.getItem("noxUid") || "guest"); },

  monthKey(d){
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  },

  load(){
    try{
      this.data = JSON.parse(localStorage.getItem(this.key()));
    }catch(e){ this.data = null; }
    if (!this.data || !this.data.total) this.data = this.empty();
  },

  save(){
    try{ localStorage.setItem(this.key(), JSON.stringify(this.data)); }catch(e){}
  },

  /* grava no máximo a cada 5 s (e ao pausar/sair) para não pesar */
  scheduleSave(){
    if (this._timer) return;
    this._timer = setTimeout(() => { this._timer = null; this.save(); }, 5000);
  },

  flush(){
    clearTimeout(this._timer);
    this._timer = null;
    if (this.data) this.save();
  },

  reset(){
    this.data = this.empty();
    this.save();
    if (typeof renderCapsule === "function") renderCapsule();
  },

  artistsOf(song){
    return song.artist.split(",").map((a) => a.trim()).filter(Boolean);
  },

  /* soma segundos ouvidos; play = true quando passou de 30 s (conta 1 reprodução) */
  add(song, sec, play){

    if (!this.data) this.load();

    const mk = this.monthKey();
    const month = this.data.months[mk] || (this.data.months[mk] = this.bucket());

    for (const b of [this.data.total, month]){
      b.sec += sec;
      if (play) b.plays++;

      const s = b.songs[song.src] || (b.songs[song.src] = { sec: 0, plays: 0 });
      s.sec += sec;
      if (play) s.plays++;

      for (const name of this.artistsOf(song)){
        const a = b.artists[name] || (b.artists[name] = { sec: 0, plays: 0 });
        a.sec += sec;
        if (play) a.plays++;
      }
    }

    this.scheduleSave();
  },

  bucketFor(scope){
    if (!this.data) this.load();
    return scope === "month"
      ? (this.data.months[this.monthKey()] || this.bucket())
      : this.data.total;
  },

  topSongs(scope, n){
    const b = this.bucketFor(scope);
    return Object.entries(b.songs)
      .map(([src, v]) => ({ src, sec: v.sec, plays: v.plays }))
      .sort((x, y) => y.plays - x.plays || y.sec - x.sec)
      .slice(0, n);
  },

  topArtists(scope, n){
    const b = this.bucketFor(scope);
    return Object.entries(b.artists)
      .map(([name, v]) => ({ name, sec: v.sec, plays: v.plays }))
      .sort((x, y) => y.sec - x.sec)
      .slice(0, n);
  }
};


/* =========================
   TELA DA CÁPSULA SONORA
========================= */
let capScope = "month";

function monthLabel(){
  const s = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function listenerType(minutes, scope){
  const k = scope === "month" ? 1 : 3;
  if (minutes < 20 * k)  return "Começando a esquentar";
  if (minutes < 90 * k)  return "Ouvinte frequente";
  if (minutes < 300 * k) return "Trilha sonora ambulante";
  return "Maratonista musical";
}

function renderCapsule(){

  document.querySelectorAll("[data-cap]").forEach((c) =>
    c.classList.toggle("active", c.dataset.cap === capScope)
  );

  const body = $("capsuleBody");
  const b = Stats.bucketFor(capScope);

  if (b.sec < 5 && !b.plays){
    body.innerHTML =
      '<div class="cap-empty">' +
      '<div class="cap-empty-ic">' + iconHtml("sparkle") + '</div>' +
      '<h3>Sua cápsula ainda está vazia</h3>' +
      '<p>Ouça músicas por pelo menos 30 segundos e seus números aparecem aqui.</p>' +
      '</div>';
    return;
  }

  const minutes = Math.round(b.sec / 60);
  const underMinute = b.sec < 60;
  const bigNumber = underMinute ? Math.round(b.sec) : minutes;

  const topSongs = Stats.topSongs(capScope, 5)
    .map((x) => Object.assign({ song: SONGS[x.src] }, x))
    .filter((x) => x.song);

  const topArtists = Stats.topArtists(capScope, 5);

  const nSongs = Object.keys(b.songs).length;
  const nArtists = Object.keys(b.artists).length;

  const hero =
    '<div class="cap-hero">' +
      '<div class="cap-kicker">' + (capScope === "month" ? monthLabel() : "Desde o começo") + '</div>' +
      '<div class="cap-big">' + bigNumber.toLocaleString("pt-BR") + '</div>' +
      '<div class="cap-unit">' + (underMinute ? "segundos de música" : "minutos de música") + '</div>' +
      '<div class="cap-type">' + listenerType(minutes, capScope) + '</div>' +
      '<div class="cap-mini">' +
        '<div><b>' + b.plays.toLocaleString("pt-BR") + '</b><span>reproduções</span></div>' +
        '<div><b>' + nSongs + '</b><span>músicas</span></div>' +
        '<div><b>' + nArtists + '</b><span>artistas</span></div>' +
      '</div>' +
    '</div>';

  let favSong = "";
  if (topSongs.length){
    const t = topSongs[0];
    favSong =
      '<div class="cap-card">' +
        '<div class="cap-card-label">Música mais tocada</div>' +
        '<div class="cap-fav">' +
          '<div class="cover cap-cover" style="' + coverStyle(t.song) + '"></div>' +
          '<div class="cap-fav-text">' +
            '<div class="cap-fav-name">' + esc(t.song.name) + '</div>' +
            '<div class="cap-fav-sub">' + esc(t.song.artist) + '</div>' +
            '<div class="cap-fav-sub">' + (t.plays
              ? t.plays + (t.plays === 1 ? " reprodução" : " reproduções")
              : formatMinutes(t.sec) + " ouvidos") + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  let favArtist = "";
  if (topArtists.length){
    const a = topArtists[0];
    favArtist =
      '<div class="cap-card">' +
        '<div class="cap-card-label">Artista mais ouvido</div>' +
        '<div class="cap-fav">' +
          '<div class="cap-artist-ic" style="--h:' + (hashStr(a.name) % 360) + '">' +
            esc(a.name.charAt(0).toUpperCase()) + '</div>' +
          '<div class="cap-fav-text">' +
            '<div class="cap-fav-name">' + esc(a.name) + '</div>' +
            '<div class="cap-fav-sub">' + formatMinutes(a.sec) + ' ouvidos</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  const songRank = topSongs.map((x, i) =>
    '<li><span class="rank">' + (i + 1) + '</span>' +
    '<div class="cover rank-cover" style="' + coverStyle(x.song) + '"></div>' +
    '<div class="rank-text"><b>' + esc(x.song.name) + '</b><small>' + esc(x.song.artist) + '</small></div>' +
    '<span class="rank-val">' + (x.plays ? x.plays + 'x' : formatMinutes(x.sec)) + '</span></li>'
  ).join("");

  const artistRank = topArtists.map((x, i) =>
    '<li><span class="rank">' + (i + 1) + '</span>' +
    '<div class="rank-ic" style="--h:' + (hashStr(x.name) % 360) + '">' + esc(x.name.charAt(0).toUpperCase()) + '</div>' +
    '<div class="rank-text"><b>' + esc(x.name) + '</b></div>' +
    '<span class="rank-val">' + formatMinutes(x.sec) + '</span></li>'
  ).join("");

  body.innerHTML =
    hero + favSong + favArtist +
    '<h2 class="section-title">Top músicas</h2><ol class="rank-list">' + songRank + '</ol>' +
    '<h2 class="section-title">Top artistas</h2><ol class="rank-list">' + artistRank + '</ol>';
}
