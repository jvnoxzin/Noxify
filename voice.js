/* =========================================================
   NOXIFY — voice.js
   Mensagens de voz no chat, estilo WhatsApp:
   toque no microfone para gravar, lixeira cancela, seta envia.
   As mensagens aparecem com play, onda e duração.
   O áudio vai dentro da mensagem (limite do Firestore ~1 MB),
   por isso a gravação é comprimida e dura no máximo 2 minutos.
========================================================= */

const NoxVoice = (() => {

  const MAX_SEC = 120;
  const MAX_CHARS = 880000;          // tem que ser menor que o limite do firestore.rules (900000)

  const db = () => window.NoxDB;
  const me = () => (window.auth && window.auth.currentUser) ? window.auth.currentUser.uid : (localStorage.getItem("noxUid") || null);
  const toast = (t) => { if (typeof showToast === "function") showToast(t); };

  const R = { rec: null, stream: null, chunks: [], t0: 0, tick: 0, peer: null, mime: "", send: false, busy: false };

  const css = document.createElement("style");
  css.textContent = `
  .rec-bar{display:none;flex:1;align-items:center;gap:12px;min-height:44px}
  .chat-form.recording > :not(.rec-bar){display:none !important}
  .chat-form.recording .rec-bar{display:flex}
  .rec-dot{width:12px;height:12px;border-radius:50%;background:#ef4444;animation:recBlink 1s infinite}
  @keyframes recBlink{50%{opacity:.25}}
  .rec-time{font-variant-numeric:tabular-nums;font-size:16px}
  .rec-hint{flex:1;opacity:.6;font-size:13px}
  .rec-btn{width:44px;height:44px;border-radius:50%;border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;background:#ffffff1f}
  .rec-btn.go{background:var(--accent,#7c3aed)}
  .rec-btn svg{width:22px;height:22px;fill:currentColor}
  .bubble.voice{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:230px}
  .vm-play{width:38px;height:38px;border-radius:50%;border:0;background:#ffffff2b;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
  .vm-play svg{width:18px;height:18px;fill:currentColor}
  .vm-wave{position:relative;flex:1;height:30px;display:flex;align-items:center;gap:2px;cursor:pointer;min-width:90px}
  .vm-wave i{flex:1;background:#ffffff55;border-radius:2px;min-height:4px}
  .vm-wave i.on{background:#fff}
  .vm-dur{font-size:11px;opacity:.75;font-variant-numeric:tabular-nums;flex:none}
  .bubble.voice time{flex-basis:100%;margin:-2px 0 0}
  `;
  document.head.appendChild(css);

  const form = () => document.getElementById("chatForm");

  function ensureBar(){
    const f = form();
    if (!f || f.querySelector(".rec-bar")) return;
    const bar = document.createElement("div");
    bar.className = "rec-bar";
    bar.innerHTML =
      '<button type="button" class="rec-btn" data-rec="cancel" aria-label="Cancelar gravação"><svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>' +
      '<span class="rec-dot"></span><span class="rec-time" id="recTime">0:00</span>' +
      '<span class="rec-hint">Gravando…</span>' +
      '<button type="button" class="rec-btn go" data-rec="send" aria-label="Enviar áudio"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>';
    f.appendChild(bar);
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("[data-rec]");
      if (!b) return;
      finish(b.dataset.rec === "send");
    });
  }

  const pickMime = () => {
    if (!window.MediaRecorder) return null;
    for (const m of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"]){
      try{ if (MediaRecorder.isTypeSupported(m)) return m; }catch(e){}
    }
    return "";
  };

  const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

  async function start(peer){
    if (R.rec || R.busy) return;
    if (!db() || !me()){ toast("Entre na sua conta, com internet, para enviar áudio."); return; }
    if (!peer) return;
    if (typeof NoxCalls !== "undefined" && NoxCalls.isBusy()){ toast("Você está em uma chamada."); return; }

    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      toast("Este navegador não consegue gravar áudio.");
      return;
    }

    try{
      R.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    }catch(e){
      toast(e && e.name === "NotFoundError" ? "Não encontrei um microfone." : "Permita o microfone para gravar.");
      return;
    }

    ensureBar();
    R.peer = peer; R.chunks = []; R.mime = mime; R.send = false;

    try{
      R.rec = new MediaRecorder(R.stream, Object.assign({ audioBitsPerSecond: 32000 }, mime ? { mimeType: mime } : {}));
    }catch(e){
      R.stream.getTracks().forEach((t) => t.stop());
      R.stream = null;
      toast("Não consegui iniciar a gravação.");
      return;
    }

    R.rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) R.chunks.push(ev.data); };
    R.rec.onstop = onStopped;
    R.rec.start(500);
    R.t0 = Date.now();
    document.getElementById("recTime").textContent = "0:00";
    form().classList.add("recording");
    R.tick = setInterval(() => {
      const s = (Date.now() - R.t0) / 1000;
      document.getElementById("recTime").textContent = fmt(s);
      if (s >= MAX_SEC) finish(true);
    }, 250);
  }

  function finish(send){
    if (!R.rec) return;
    R.send = !!send;
    clearInterval(R.tick);
    form().classList.remove("recording");
    try{ if (R.rec.state !== "inactive") R.rec.stop(); else onStopped(); }catch(e){ onStopped(); }
  }

  async function onStopped(){
    const rec = R.rec; if (!rec) return;
    R.rec = null;
    if (R.stream){ R.stream.getTracks().forEach((t) => t.stop()); R.stream = null; }

    const dur = Math.max(1, Math.round((Date.now() - R.t0) / 1000));
    const send = R.send, peer = R.peer, type = (rec.mimeType || R.mime || "audio/webm");
    const blob = new Blob(R.chunks, { type });
    R.chunks = [];

    if (!send) return;
    if (dur < 1 || blob.size < 500){ toast("Gravação muito curta."); return; }

    R.busy = true;
    try{
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result || ""));
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(blob);
      });
      if (dataUrl.length > MAX_CHARS){ toast("Áudio grande demais. Grave um mais curto."); return; }

      await db().sendMessage(db().chatId(me(), peer), [me(), peer].sort(), me(), "", {
        type: "audio", audio: dataUrl, alt: "voz", dur
      });
    }catch(e){
      toast("Não consegui enviar o áudio" + (e && e.code ? " (" + e.code + ")" : "."));
    }finally{
      R.busy = false;
    }
  }

  function cancelIfAny(){ if (R.rec) finish(false); }

  /* ---------- tocar as mensagens de voz ---------- */
  const player = new Audio();
  player.preload = "metadata";
  const srcs = new Map();      // id da mensagem -> áudio
  const durs = new Map();      // id -> segundos
  let curId = null;

  const BARS = 30;
  function wave(id){
    let h = 7;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    let out = "";
    for (let i = 0; i < BARS; i++){
      h = (h * 1103515245 + 12345) >>> 0;
      out += '<i style="height:' + (22 + (h >>> 8) % 70) + '%"></i>';
    }
    return out;
  }

  const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';

  function bubbleHtml(m, mine, timeStr){
    const id = String(m.id || "");
    srcs.set(id, m.audio);
    if (m.dur) durs.set(id, m.dur);
    const d = durs.get(id) || 0;
    return '<div class="bubble voice ' + (mine ? "mine" : "theirs") + '" data-vm="' + esc(id) + '">' +
      '<button type="button" class="vm-play" aria-label="Tocar áudio">' + ICON_PLAY + '</button>' +
      '<div class="vm-wave">' + wave(id) + '</div>' +
      '<span class="vm-dur">' + (d ? fmt(d) : "") + '</span>' +
      '<time>' + (timeStr || "") + '</time></div>';
  }

  const node = (id) => Array.from(document.querySelectorAll("[data-vm]")).find((n) => n.dataset.vm === id) || null;

  function paint(){
    document.querySelectorAll("[data-vm]").forEach((n) => {
      const on = n.dataset.vm === curId;
      const total = durs.get(n.dataset.vm) || (on && isFinite(player.duration) ? player.duration : 0);
      const frac = on && total ? Math.min(1, player.currentTime / total) : 0;
      n.querySelector(".vm-play").innerHTML = on && !player.paused ? ICON_PAUSE : ICON_PLAY;
      n.querySelectorAll(".vm-wave i").forEach((b, i) => b.classList.toggle("on", on && i < Math.round(frac * BARS)));
      const dur = n.querySelector(".vm-dur");
      if (on && !player.paused) dur.textContent = fmt(player.currentTime);
      else dur.textContent = total ? fmt(total) : "";
    });
  }

  function afterRender(){ paint(); }

  document.addEventListener("click", (e) => {
    const n = e.target.closest("[data-vm]");
    if (!n) return;
    const id = n.dataset.vm;
    const onWave = e.target.closest(".vm-wave");
    const onPlay = e.target.closest(".vm-play");
    if (!onWave && !onPlay) return;

    if (curId !== id){
      player.pause();
      curId = id;
      player.src = srcs.get(id) || "";
      player.play().catch(() => toast("Não consegui tocar esse áudio."));
      paint();
      return;
    }
    if (onWave && !onPlay){
      const r = onWave.getBoundingClientRect();
      const total = durs.get(id) || player.duration;
      if (total && isFinite(total)) player.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * total;
      if (player.paused) player.play().catch(() => {});
    }else{
      if (player.paused) player.play().catch(() => {}); else player.pause();
    }
    paint();
  });

  player.addEventListener("timeupdate", paint);
  player.addEventListener("play", paint);
  player.addEventListener("pause", paint);
  player.addEventListener("ended", () => { player.currentTime = 0; paint(); });
  player.addEventListener("loadedmetadata", () => {
    if (curId && isFinite(player.duration) && !durs.get(curId)) durs.set(curId, player.duration);
    paint();
  });

  return { start, finish, cancelIfAny, bubbleHtml, afterRender };
})();
