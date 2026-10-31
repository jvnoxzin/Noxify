/* =========================================================
   NOXIFY — gvoice.js
   Salas de voz dos grupos (WebRTC em malha: cada pessoa se liga
   direto às outras; funciona bem até ~6 pessoas por sala).
   - entrar/sair, microfone, volume de cada pessoa, quem está falando
   - compartilhar tela (onde o navegador permite)
   - salas privadas/temporárias: controladas pelo canal (gadmin.js)
   Sinalização pelo Firestore (groups/{g}/channels/{c}/vp e vsig).
   Em redes difíceis (4G/corporativas) precisa de servidor TURN:
   use a lista TURN_SERVERS do calls.js (vale para as duas coisas).
========================================================= */

const GXVoice = (() => {

  const STALE = 40000;                 // sem "batida" há 40 s = saiu
  const V = { cur: null, watchers: {}, counts: {}, room: null };

  const S = () => GX.S, G = () => GX.G(), q = (s, r) => GX.q(s, r), qa = (s, r) => GX.qa(s, r);
  const toast = (t) => GX.toast(t);
  const fresh = (l) => l.filter((p) => Date.now() - (p.at || 0) < STALE);

  function ice(){
    const l = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
    try{ if (typeof TURN_SERVERS !== "undefined" && Array.isArray(TURN_SERVERS)) l.push(...TURN_SERVERS); }catch(e){}
    return l;
  }

  /* ---------- contagem nos canais de voz (lista lateral) ---------- */
  function watch(chans){
    const ids = chans.map((c) => c.id).slice(0, 10);
    Object.keys(V.watchers).forEach((id) => { if (!ids.includes(id)){ V.watchers[id](); delete V.watchers[id]; delete V.counts[id]; } });
    ids.forEach((cid) => {
      if (V.watchers[cid]) return;
      V.watchers[cid] = G().subscribeVoice(S().gid, cid, (l) => {
        V.counts[cid] = fresh(l).length;
        if (window.GX && S().gid) GX.paintSide();
      });
    });
  }
  function unwatch(){ if (V.unsubRoom){ V.unsubRoom(); V.unsubRoom = null; } Object.values(V.watchers).forEach((u) => { try{ u(); }catch(e){} }); V.watchers = {}; V.counts = {}; }
  const countHtml = (cid) => V.counts[cid] ? '<span class="g-ch-vc">🎙️ ' + V.counts[cid] + "</span>" : "";
  const active = () => !!V.cur;

  /* ---------- tela da sala ---------- */
  function open(ch){
    const main = $("gMain");
    V.room = ch.id;
    main.innerHTML =
      '<header class="g-head"><button class="g-ico back" data-gx="back-side" aria-label="Voltar aos canais">' + iconHtml("left") + "</button>" +
      '<div class="g-head-t"><b>' + (ch.private ? "🔒" : "🎙️") + " " + esc(ch.name) + (ch.temp ? " ⏳" : "") + "</b><small>" + esc(ch.topic || "Sala de voz") + "</small></div>" +
      '<button class="g-ico only-m" data-gx="members-open" aria-label="Membros">' + iconHtml("people") + "</button>" +
      '<button class="g-ico" data-v="chmenu" aria-label="Sala">' + iconHtml("more") + "</button></header>" +
      '<div class="g-voice" id="gVoiceBox"></div>';
    main.onclick = (e) => {
      const t = e.target.closest("[data-v]"); if (!t) return;
      const a = t.dataset.v;
      if (a === "join") join(ch);
      else if (a === "leave") leave();
      else if (a === "mic") toggleMic();
      else if (a === "screen") toggleScreen();
      else if (a === "chmenu") GXAdmin.channelMenu(ch);
    };
    if (V.unsubRoom) V.unsubRoom();
    V.unsubRoom = G().subscribeVoice(S().gid, ch.id, (l) => { V.list = fresh(l); V.listFor = ch.id; paint(ch); });
    paint(ch);
  }

  function paint(ch){
    const box = $("gVoiceBox");
    if (!box || V.room !== ch.id) return;
    const here = V.cur && V.cur.cid === ch.id;
    const list = (V.listFor === ch.id ? V.list : []) || [];
    const block = !GX.can("sendMsg") ? "Você não tem permissão para falar aqui." : (GX.isMuted(S().mem) ? "Você está silenciado." : "");

    box.innerHTML =
      '<div class="g-vgrid">' + (list.length ? list.map((p) => tile(p)).join("") : '<p class="g-muted">Ninguém na sala. Seja o primeiro! 🎙️</p>') + "</div>" +
      '<div class="g-vctl">' +
      (here
        ? '<button class="g-vb' + (V.cur.muted ? " off" : "") + '" data-v="mic">' + (V.cur.muted ? "🔇<small>Mudo</small>" : "🎙️<small>Microfone</small>") + "</button>" +
          (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia ? '<button class="g-vb' + (V.cur.screen ? " on" : "") + '" data-v="screen">🖥️<small>' + (V.cur.screen ? "Parar tela" : "Tela") + "</small></button>" : "") +
          '<button class="g-vb end" data-v="leave">🚪<small>Sair</small></button>'
        : (V.cur ? '<p class="g-muted">Você está em outra sala (' + esc(V.cur.name) + ").</p>" : "") +
          '<button class="g-btn primary" data-v="join"' + (block ? " disabled" : "") + ">Entrar na sala</button>" + (block ? '<p class="g-muted">' + esc(block) + "</p>" : "")) +
      "</div>" + (here ? '<div class="g-vol"><span>🔊 Volume geral</span><input type="range" min="0" max="100" value="' + Math.round(V.cur.master * 100) + '" id="gVolAll"></div>' : "") +
      '<p class="g-muted g-vnote">Salas de voz funcionam bem até ~6 pessoas. Em algumas redes (4G, escola, trabalho) a conexão pode falhar sem servidor TURN.</p>';

    const all = $("gVolAll");
    if (all) all.oninput = () => { V.cur.master = all.value / 100; applyVolumes(); };
    qa("[data-vol]", box).forEach((r) => (r.oninput = () => { const pc = V.cur && V.cur.peers[r.dataset.vol]; if (pc){ pc.vol = r.value / 100; applyVolumes(); } }));
    attachVideos();
    GX.loadPhotos(list.map((p) => p.id));
  }

  function tile(p){
    const mine = p.id === S().uid, here = V.cur;
    const peer = here && here.peers[p.id];
    const nm = GX.dispName(p.id) || p.name;
    return '<div class="g-vt' + (p.m === false || (mine && here && here.muted) ? " muted" : "") + '" data-vt="' + esc(p.id) + '"><div class="g-vt-av">' + GX.avatar(p.id, nm, 64) + "</div>" +
      '<div class="g-vt-v" data-vv="' + esc(p.id) + '"></div>' +
      "<b>" + esc(nm) + (mine ? " (você)" : "") + (p.m === false || (mine && here && here.muted) ? " 🔇" : "") + "</b>" +
      (!mine && here ? '<input type="range" class="g-vt-r" min="0" max="100" value="' + Math.round(((peer && peer.vol) == null ? 1 : peer.vol) * 100) + '" data-vol="' + esc(p.id) + '" title="Volume de ' + esc(nm) + '">' : "") + "</div>";
  }

  /* ---------- entrar / sair ---------- */
  async function join(ch){
    if (V.cur){ toast("Saia da outra sala primeiro."); return; }
    if (typeof NoxCalls !== "undefined" && NoxCalls.isBusy()){ toast("Você está em uma chamada."); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ toast("Este navegador não permite usar o microfone."); return; }
    let stream;
    try{ stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch(e){ toast(e && e.name === "NotFoundError" ? "Não encontrei um microfone." : "Permita o microfone para entrar."); return; }

    const R = { gid: S().gid, cid: ch.id, name: ch.name, stream, peers: {}, muted: false, screen: null, master: 1, joinedAt: Date.now(), seen: new Set(), actx: null, speak: {} };
    V.cur = R;
    try{
      await G().voiceJoin(R.gid, R.cid, GX.dispName(S().uid));
    }catch(e){ stream.getTracks().forEach((t) => t.stop()); V.cur = null; toast(GX.errText(e)); return; }

    R.unsubSig = G().subscribeSignals(R.gid, R.cid, onSignals);
    R.unsubPart = G().subscribeVoice(R.gid, R.cid, (l) => onParticipants(fresh(l)));
    R.hb = setInterval(() => { G().voiceBeat(R.gid, R.cid).catch(() => {}); }, 15000);
    try{ R.actx = new (window.AudioContext || window.webkitAudioContext)(); if (R.actx.state === "suspended") R.actx.resume(); watchSpeaking(S().uid, stream); }catch(e){}
    R.tick = setInterval(speakTick, 160);
    pill();
    paint(ch);
    toast("Você entrou na sala 🎙️");
  }

  function leave(silent){
    const R = V.cur; if (!R) return;
    V.cur = null;
    clearInterval(R.hb); clearInterval(R.tick);
    [R.unsubSig, R.unsubPart].forEach((u) => { try{ u && u(); }catch(e){} });
    Object.keys(R.peers).forEach((u) => closePeer(R, u));
    R.stream.getTracks().forEach((t) => t.stop());
    if (R.screen) R.screen.getTracks().forEach((t) => t.stop());
    try{ R.actx && R.actx.close(); }catch(e){}
    G().voiceLeave(R.gid, R.cid).catch(() => {});
    const p = $("gVoicePill"); if (p) p.remove();
    if (!silent){ const ch = S().chans.find((c) => c.id === V.room); if (ch) paint(ch); toast("Você saiu da sala."); }
  }

  /* aviso fixo enquanto está numa sala (mesmo em outro canal) */
  function pill(){
    let p = $("gVoicePill");
    if (!p){ p = document.createElement("div"); p.id = "gVoicePill"; p.className = "g-vpill"; $("gApp").appendChild(p); }
    p.innerHTML = '<span>🎙️ ' + esc(V.cur.name) + '</span><button data-vp="go">Abrir</button><button data-vp="mic">' + (V.cur.muted ? "🔇" : "🎙️") + '</button><button data-vp="x" class="end">Sair</button>';
    p.onclick = (e) => {
      const b = e.target.closest("[data-vp]"); if (!b) return;
      if (b.dataset.vp === "x") leave();
      else if (b.dataset.vp === "mic") toggleMic();
      else GX.selectChannel(V.cur.cid);
    };
  }

  function toggleMic(){
    const R = V.cur; if (!R) return;
    R.muted = !R.muted;
    R.stream.getAudioTracks().forEach((t) => (t.enabled = !R.muted));
    G().voiceBeat(R.gid, R.cid, { m: !R.muted }).catch(() => {});
    pill();
    const ch = S().chans.find((c) => c.id === V.room); if (ch) paint(ch);
  }

  /* ---------- conexões ---------- */
  function onParticipants(list){
    const R = V.cur; if (!R) return;
    const mine = list.find((p) => p.id === S().uid);
    const myJ = (mine && mine.j) || R.joinedAt;
    const ids = list.map((p) => p.id);
    list.forEach((p) => {
      if (p.id === S().uid || R.peers[p.id]) return;
      if ((p.j || 0) < myJ) makePeer(R, p.id);          // quem chega depois liga para quem já estava
    });
    Object.keys(R.peers).forEach((u) => { if (!ids.includes(u)) closePeer(R, u); });
  }

  function makePeer(R, uid){
    if (R.peers[uid]) return R.peers[uid];
    const pc = new RTCPeerConnection({ iceServers: ice() });
    const P = { pc, polite: S().uid < uid, making: false, ignore: false, queue: [], vol: 1, audio: null, video: null, senders: {} };
    R.peers[uid] = P;

    R.stream.getTracks().forEach((t) => { P.senders[t.id] = pc.addTrack(t, R.stream); });
    if (R.screen) R.screen.getTracks().forEach((t) => { P.senders[t.id] = pc.addTrack(t, R.screen); });

    pc.onicecandidate = (e) => { if (e.candidate) G().voiceSignal(R.gid, R.cid, uid, "ice", e.candidate.toJSON()).catch(() => {}); };
    pc.onnegotiationneeded = async () => {
      try{
        P.making = true;
        await pc.setLocalDescription();
        await G().voiceSignal(R.gid, R.cid, uid, "desc", { type: pc.localDescription.type, sdp: pc.localDescription.sdp });
      }catch(e){ console.warn("voz: oferta", e); }
      finally{ P.making = false; }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      if (e.track.kind === "audio"){
        if (!P.audio){ P.audio = new Audio(); P.audio.autoplay = true; P.audio.playsInline = true; }
        P.audio.srcObject = stream; P.audio.volume = P.vol * R.master;
        P.audio.play().catch(() => {});
        watchSpeaking(uid, stream);
      }else{
        P.video = stream;
        e.track.onended = e.track.onmute = () => { P.video = null; attachVideos(); };
        e.track.onunmute = () => { P.video = stream; attachVideos(); };
        attachVideos();
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed"){ try{ pc.restartIce(); }catch(e){} }
    };
    return P;
  }

  function closePeer(R, uid){
    const P = R.peers[uid]; if (!P) return;
    delete R.peers[uid];
    try{ P.pc.close(); }catch(e){}
    if (P.audio){ P.audio.srcObject = null; }
    delete R.speak[uid];
    attachVideos();
  }

  async function onSignals(list){
    const R = V.cur; if (!R) return;
    list.sort((a, b) => (a.at || 0) - (b.at || 0));
    for (const s of list){
      if (R.seen.has(s.id)) continue;
      R.seen.add(s.id);
      G().deleteSignal(R.gid, R.cid, s.id).catch(() => {});
      if (Date.now() - (s.at || 0) > 60000) continue;
      let d; try{ d = JSON.parse(s.d); }catch(e){ continue; }
      const P = R.peers[s.from] || makePeer(R, s.from);
      try{
        if (s.k === "desc"){
          const pc = P.pc;
          const collision = d.type === "offer" && (P.making || pc.signalingState !== "stable");
          P.ignore = !P.polite && collision;
          if (P.ignore) continue;
          await pc.setRemoteDescription(d);
          while (P.queue.length){ try{ await pc.addIceCandidate(P.queue.shift()); }catch(e){} }
          if (d.type === "offer"){
            await pc.setLocalDescription();
            await G().voiceSignal(R.gid, R.cid, s.from, "desc", { type: pc.localDescription.type, sdp: pc.localDescription.sdp });
          }
        }else if (s.k === "ice"){
          if (P.pc.remoteDescription) { try{ await P.pc.addIceCandidate(d); }catch(e){ if (!P.ignore) console.warn("voz: ice", e); } }
          else P.queue.push(d);
        }
      }catch(e){ console.warn("voz: sinal", e); }
    }
  }

  function applyVolumes(){
    const R = V.cur; if (!R) return;
    Object.values(R.peers).forEach((P) => { if (P.audio) P.audio.volume = Math.max(0, Math.min(1, P.vol * R.master)); });
  }

  /* ---------- quem está falando ---------- */
  function watchSpeaking(uid, stream){
    const R = V.cur; if (!R || !R.actx || !stream.getAudioTracks().length) return;
    try{
      const src = R.actx.createMediaStreamSource(stream);
      const an = R.actx.createAnalyser(); an.fftSize = 512;
      src.connect(an);
      R.speak[uid] = { an, buf: new Uint8Array(an.fftSize) };
    }catch(e){}
  }

  function speakTick(){
    const R = V.cur; if (!R) return;
    Object.keys(R.speak).forEach((u) => {
      const s = R.speak[u];
      s.an.getByteTimeDomainData(s.buf);
      let sum = 0; for (let i = 0; i < s.buf.length; i++){ const v = (s.buf[i] - 128) / 128; sum += v * v; }
      const on = Math.sqrt(sum / s.buf.length) > 0.04 && !(u === S().uid && R.muted);
      const el = q('[data-vt="' + CSS.escape(u) + '"]');
      if (el) el.classList.toggle("speaking", on);
    });
  }

  /* ---------- compartilhar tela ---------- */
  async function toggleScreen(){
    const R = V.cur; if (!R) return;
    if (R.screen){ stopScreen(); return; }
    let scr;
    try{ scr = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); }
    catch(e){ if (e && e.name !== "NotAllowedError") toast("Não foi possível compartilhar a tela neste aparelho."); return; }
    R.screen = scr;
    const tr = scr.getVideoTracks()[0];
    tr.onended = () => { if (V.cur && V.cur.screen === scr) stopScreen(); };
    Object.values(R.peers).forEach((P) => { P.senders[tr.id] = P.pc.addTrack(tr, scr); });
    const ch = S().chans.find((c) => c.id === V.room); if (ch) paint(ch);
  }

  function stopScreen(){
    const R = V.cur; if (!R || !R.screen) return;
    const scr = R.screen; R.screen = null;
    scr.getTracks().forEach((t) => {
      Object.values(R.peers).forEach((P) => { const s = P.senders[t.id]; if (s){ try{ P.pc.removeTrack(s); }catch(e){} delete P.senders[t.id]; } });
      t.stop();
    });
    const ch = S().chans.find((c) => c.id === V.room); if (ch) paint(ch);
  }

  /* mostra o vídeo (tela de quem compartilha) dentro do quadro da pessoa */
  function attachVideos(){
    const R = V.cur;
    qa("[data-vv]").forEach((box) => {
      const u = box.dataset.vv;
      const stream = u === S().uid ? (R && R.screen) : (R && R.peers[u] && R.peers[u].video);
      const has = !!(stream && stream.getVideoTracks().length);
      let v = box.firstElementChild;
      if (!has){ box.innerHTML = ""; box.parentElement.classList.remove("sharing"); return; }
      if (!v){ v = document.createElement("video"); v.autoplay = true; v.muted = true; v.playsInline = true; box.appendChild(v); }
      if (v.srcObject !== stream) v.srcObject = stream;
      box.parentElement.classList.add("sharing");
    });
  }

  return { open, leave, active, watch, unwatch, countHtml };
})();

window.GXVoice = GXVoice;
