/* =========================================================
   NOXIFY — lyrics.js
   Botão "Letra" do player.

   As letras NÃO ficam dentro do app: elas são buscadas no
   serviço gratuito LRCLIB (lrclib.net) quando você pede, e
   depois ficam salvas no aparelho para abrir sem internet.
   Você também pode colar a letra de uma música manualmente.
========================================================= */

/* tira "(feat ...)" e " / outra parte" do título para achar melhor */
function cleanTrackName(name){
  return name.replace(/\(.*?\)/g, "").split("/")[0].trim();
}

async function fetchFromLrclib(song){

  const params = new URLSearchParams({
    track_name: cleanTrackName(song.name),
    artist_name: mainArtist(song)
  });

  const base = "https://lrclib.net/api/";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);

  const pick = (d) => ({
    synced: d.syncedLyrics || null,
    plain: d.plainLyrics || null,
    instrumental: !!d.instrumental
  });

  try{
    let r = await fetch(base + "get?" + params, { signal: ctl.signal });
    if (r.ok) return pick(await r.json());
    if (r.status !== 404) throw new Error("HTTP " + r.status);

    r = await fetch(base + "search?" + params, { signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);

    const list = await r.json();
    const hit = list.find((x) => x.syncedLyrics) || list.find((x) => x.plainLyrics);
    return hit ? pick(hit) : null;

  }finally{
    clearTimeout(timer);
  }
}

const Lyrics = {

  open: false,
  song: null,
  token: 0,
  lines: [],       // [{ t, text }] quando sincronizada
  els: [],
  active: -1,
  userScrollUntil: 0,
  data: null,

  keyCache(song){ return "noxLyrics:" + song.src; },
  keyUser(song){ return "noxLyricsUser:" + song.src; },

  /* "[01:23.45] texto" -> { t: 83.45, text } */
  parseLrc(text){
    const out = [];
    const re = /\[(\d+):(\d+(?:\.\d+)?)\]/g;

    for (const raw of text.split(/\r?\n/)){
      re.lastIndex = 0;
      const times = [];
      let m;
      while ((m = re.exec(raw))) times.push(parseInt(m[1], 10) * 60 + parseFloat(m[2]));
      const line = raw.replace(/\[[^\]]*\]/g, "").trim();
      times.forEach((t) => out.push({ t, text: line }));
    }
    return out.sort((a, b) => a.t - b.t);
  },

  stripLrc(text){
    return text.replace(/\[[^\]]*\]/g, "").split(/\r?\n/).map((l) => l.trim()).join("\n").trim();
  },

  /* 1) letra colada pelo usuário  2) já salva no aparelho  3) busca online */
  async load(song){

    try{
      const mine = localStorage.getItem(this.keyUser(song));
      if (mine) return this.fromText(mine, "user");

      const cached = localStorage.getItem(this.keyCache(song));
      if (cached) return Object.assign(JSON.parse(cached), { source: "cache" });
    }catch(e){}

    const fetcher = window.NOX_LYRICS_FETCHER || fetchFromLrclib;
    const found = await fetcher(song);          // pode lançar erro (sem internet)

    if (!found) return null;

    try{ localStorage.setItem(this.keyCache(song), JSON.stringify(found)); }catch(e){}
    return Object.assign({}, found, { source: "lrclib" });
  },

  fromText(text, source){
    const hasTimes = /\[\d+:\d+(?:\.\d+)?\]/.test(text);
    return {
      synced: hasTimes ? text : null,
      plain: hasTimes ? null : text,
      instrumental: false,
      source
    };
  },

  /* baixa em segundo plano quando a música é salva offline */
  async prefetch(song){
    try{ await this.load(song); }catch(e){}
  },

  async show(song){

    const box = $("lyricsScroll");

    if (!song){
      this.message("Toque em uma música para ver a letra.");
      return;
    }

    const token = ++this.token;
    this.song = song;
    this.lines = [];
    this.els = [];
    this.active = -1;
    this.message("Buscando letra…");

    try{
      const data = await this.load(song);
      if (token !== this.token) return;
      this.data = data;
      this.render(data);
    }catch(e){
      if (token !== this.token) return;
      this.data = null;
      this.message("Sem conexão para buscar a letra. Quando você ficar online, abra de novo.", true);
    }

    box.scrollTop = 0;
  },

  rerender(){
    if (this.open && this.data) this.render(this.data);
  },

  message(text, withEditor){
    $("lyricsScroll").innerHTML =
      '<div class="ly-msg">' + esc(text) + '</div>' +
      (withEditor && this.song
        ? '<div class="ly-foot"><button class="link-btn" onclick="editLyrics()">Colar letra manualmente</button></div>'
        : "");
  },

  render(data){

    const box = $("lyricsScroll");
    this.lines = [];
    this.els = [];

    if (!data){
      box.innerHTML =
        '<div class="ly-msg">Não encontrei a letra desta música.</div>' +
        '<div class="ly-foot"><button class="link-btn" onclick="editLyrics()">Colar letra manualmente</button></div>';
      return;
    }

    if (data.instrumental){
      box.innerHTML = '<div class="ly-msg">♪ Música instrumental</div>';
      return;
    }

    let html = "";

    if (data.synced && Settings.get("syncedLyrics")){
      this.lines = this.parseLrc(data.synced);
      html = this.lines.map((l, i) =>
        '<p class="ly-line" data-i="' + i + '">' + (l.text ? esc(l.text) : "♪") + '</p>'
      ).join("");

    }else{
      const text = data.plain || this.stripLrc(data.synced || "");
      html = '<div class="ly-plain">' +
        text.split(/\n{2,}/).map((block) =>
          '<p>' + esc(block).replace(/\n/g, "<br>") + '</p>'
        ).join("") + '</div>';
    }

    const source = { user: "Letra adicionada por você", cache: "Salva no aparelho", lrclib: "Letra via LRCLIB" }[data.source] || "";

    box.innerHTML = html +
      '<div class="ly-foot"><span>' + source + '</span>' +
      '<button class="link-btn" onclick="editLyrics()">Editar</button></div>';

    this.els = Array.from(box.querySelectorAll(".ly-line"));
    this.active = -1;
    this.tick(audio.currentTime);
  },

  /* chamado a cada atualização do tempo da música */
  tick(time){

    if (!this.open || !this.lines.length) return;

    let lo = 0, hi = this.lines.length - 1, idx = -1;
    while (lo <= hi){
      const mid = (lo + hi) >> 1;
      if (this.lines[mid].t <= time + 0.2){ idx = mid; lo = mid + 1; }
      else hi = mid - 1;
    }

    if (idx === this.active) return;

    if (this.els[this.active]) this.els[this.active].classList.remove("active");
    this.active = idx;

    const el = this.els[idx];
    if (!el) return;

    el.classList.add("active");

    if (Date.now() > this.userScrollUntil){
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  },

  onSongChange(song){
    if (this.open) this.show(song);
  }
};

/* se o usuário rolar a letra com o dedo, pausa a rolagem automática por uns segundos */
["touchstart", "wheel"].forEach((evt) =>
  $("lyricsScroll").addEventListener(evt, () => { Lyrics.userScrollUntil = Date.now() + 4000; }, { passive: true })
);

/* tocar numa linha pula a música para aquele ponto */
$("lyricsScroll").addEventListener("click", (e) => {
  const line = e.target.closest(".ly-line");
  if (!line) return;
  const l = Lyrics.lines[+line.dataset.i];
  if (l){
    audio.currentTime = l.t;
    Lyrics.userScrollUntil = 0;
  }
});

function openLyrics(){
  Lyrics.open = true;
  $("fpCoverWrap").hidden = true;
  $("lyricsBox").hidden = false;
  $("fpLyricsBtn").classList.add("active");
  Lyrics.show(current);
}

function closeLyrics(){
  Lyrics.open = false;
  $("fpCoverWrap").hidden = false;
  $("lyricsBox").hidden = true;
  $("fpLyricsBtn").classList.remove("active");
}

function toggleLyrics(){
  if (Lyrics.open) closeLyrics();
  else openLyrics();
}

/* editor para colar a letra */
function editLyrics(){

  const song = Lyrics.song;
  if (!song) return;

  let existing = "";
  try{ existing = localStorage.getItem(Lyrics.keyUser(song)) || ""; }catch(e){}

  $("lyricsScroll").innerHTML =
    '<div class="ly-editor">' +
    '<p>Cole a letra de <b>' + esc(song.name) + '</b>. Se tiver tempos como [01:23.45], ela rola sincronizada.</p>' +
    '<textarea id="lyricsText" rows="10" placeholder="Cole a letra aqui">' + esc(existing) + '</textarea>' +
    '<div class="ly-editor-actions">' +
      '<button class="pill-btn" onclick="saveUserLyrics()">Salvar</button>' +
      '<button class="pill-btn ghost" onclick="Lyrics.show(Lyrics.song)">Cancelar</button>' +
      (existing ? '<button class="pill-btn ghost" onclick="removeUserLyrics()">Remover minha letra</button>' : "") +
    '</div></div>';
}

function saveUserLyrics(){
  const text = $("lyricsText").value.trim();
  try{
    if (text) localStorage.setItem(Lyrics.keyUser(Lyrics.song), text);
    else localStorage.removeItem(Lyrics.keyUser(Lyrics.song));
  }catch(e){}
  Lyrics.show(Lyrics.song);
}

function removeUserLyrics(){
  try{ localStorage.removeItem(Lyrics.keyUser(Lyrics.song)); }catch(e){}
  Lyrics.show(Lyrics.song);
}
