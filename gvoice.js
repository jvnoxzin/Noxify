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
  const V = { cur: null, watchers: {}, counts: {}, parts: {}, room: null, volOpen: null, sig: "" };

  const S = () => GX.S, G = () => GX.G(), q = (s, r) => GX.q(s, r), qa = (s, r) => GX.qa(s, r);
  const toast = (t) => GX.toast(t);
  const IC = {
    mic: '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>',
    micOff: '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/><path d="M3.5 3.5l17 17" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>',
    screen: '<svg viewBox="0 0 24 24"><path d="M20 3H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6v2H8v2h8v-2h-2v-2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 13H4V5h16v11z"/></svg>',
    end: '<svg viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>',
    cam: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>',
    camOff: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/><path d="M3.5 3.5l17 17" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>',
    spk: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>',
    wave: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>'
  };
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
        V.parts[cid] = fresh(l);
        V.counts[cid] = V.parts[cid].length;
        if (window.GX && S().gid) GX.paintSide();
      });
    });
  }
  function unwatch(){ if (V.unsubRoom){ V.unsubRoom(); V.unsubRoom = null; } Object.values(V.watchers).forEach((u) => { try{ u(); }catch(e){} }); V.watchers = {}; V.counts = {}; V.parts = {}; }
  const countHtml = (cid) => V.counts[cid] ? '<span class="g-ch-vc">' + IC.spk + " " + V.counts[cid] + "</span>" : "";

  /* quem está na sala aparece embaixo do canal, como no Discord */
  const listHtml = (cid) => {
    const l = V.parts[cid] || [];
    if (!l.length) return "";
    return '<div class="g-vcl">' + l.map((p) => {
      const nm = GX.dispName(p.id) || p.name;
      return '<div class="g-vcm" data-vs="' + esc(p.id) + '">' + GX.avatar(p.id, nm, 22) + '<em class="g-nm">' + esc(nm) + "</em>" + (p.m === false ? '<i class="g-vcm-i">' + IC.micOff + "</i>" : "") + "</div>";
    }).join("") + "</div>";
  };
  const active = () => !!V.cur;

  /* ---------- tela da sala ---------- */
  function open(ch){
    const main = $("gMain");
    V.room = ch.id;
    V.sig = "";                      // tela nova: sem isso a sala voltava vazia ao reabrir
    main.innerHTML =
      '<header class="g-head"><button class="g-ico back" data-gx="back-side" aria-label="Voltar aos canais">' + iconHtml("left") + "</button>" +
      '<div class="g-head-t"><b>' + (ch.private ? "🔒" : "🎙️") + " " + esc(ch.name) + (ch.temp ? " ⏳" : "") + "</b><small>" + esc(ch.topic || "Sala de voz") + "</small></div>" +
      '<button class="g-ico only-m" data-gx="members-open" aria-label="Membros">' + iconHtml("people") + "</button>" +
      '<button class="g-ico" data-v="chmenu" aria-label="Sala">' + iconHtml("more") + "</button></header>" +
      '<div class="g-voice" id="gVoiceBox"></div>';
    main.onclick = (e) => {
      if (e.target.closest(".g-vt-vol")) return;
      const t = e.target.closest("[data-v]"); if (!t) return;
      const a = t.dataset.v;
      if (a === "tile"){ if (V.cur && t.dataset.uid !== S().uid){ V.volOpen = V.volOpen === t.dataset.uid ? null : t.dataset.uid; qa(".g-vt").forEach((x) => x.classList.toggle("vol", x.dataset.uid === V.volOpen)); V.sig = ""; } return; }
      if (a === "join") join(ch);
      else if (a === "leave") leave();
      else if (a === "mic") toggleMic();
      else if (a === "screen") toggleScreen();
      else if (a === "cam") toggleCam();
      else if (a === "chmenu") GXAdmin.channelMenu(ch);
    };
    if (V.unsubRoom) V.unsubRoom();
    V.unsubRoom = G().subscribeVoice(S().gid, ch.id, (l) => { V.list = fresh(l); V.listFor = ch.id; paint(ch); });
    paint(ch);
  }

  function paint(ch, force){
    const box = $("gVoiceBox");
    if (!box || V.room !== ch.id) return;
    const here = !!(V.cur && V.cur.cid === ch.id);
    const list = (V.listFor === ch.id ? V.list : []) || [];
    const block = !GX.can("sendMsg") ? "Você não tem permissão para falar aqui." : (GX.isMuted(S().mem) ? "Você está silenciado." : "");

    /* só redesenha se algo visível mudou (evita piscar e atrapalhar o controle de volume) */
    const sig = [ch.id, here, V.cur && V.cur.muted, V.cur && !!V.cur.screen, V.cur && !!V.cur.cam, V.volOpen, block, V.cur && V.cur.cid,
      list.map((p) => p.id + (p.m === false ? "0" : "1") + (p.v || "") + GX.dispName(p.id)).join(",")].join("|");
    if (!force && sig === V.sig) return;
    V.sig = sig;

    const n = list.length;
    box.innerHTML =
      '<div class="g-vstage n' + Math.min(n, 6) + '">' + (n ? list.map((p) => tile(p, here)).join("") :
        '<div class="g-vempty"><div class="g-vempty-i">' + IC.mic + "</div><b>Ninguém na sala</b><span>Entre para começar a conversar</span></div>") + "</div>" +
      '<div class="g-vbar">' + (here
        ? '<button class="g-vc' + (V.cur.muted ? " off" : "") + '" data-v="mic" title="' + (V.cur.muted ? "Ativar microfone" : "Silenciar microfone") + '">' + (V.cur.muted ? IC.micOff : IC.mic) + "</button>" +
          '<button class="g-vc' + (V.cur.cam ? " on" : "") + '" data-v="cam" title="' + (V.cur.cam ? "Desligar câmera" : "Ligar câmera") + '">' + (V.cur.cam ? IC.cam : IC.camOff) + "</button>" +
          (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia ? '<button class="g-vc' + (V.cur.screen ? " on" : "") + '" data-v="screen" title="' + (V.cur.screen ? "Parar de compartilhar" : "Compartilhar tela") + '">' + IC.screen + "</button>" : "") +
          '<span class="g-vmaster" title="Volume geral">' + IC.wave + '<input type="range" min="0" max="100" value="' + Math.round(V.cur.master * 100) + '" id="gVolAll"></span>' +
          '<button class="g-vc end" data-v="leave" title="Sair da sala">' + IC.end + "</button>"
        : (V.cur ? '<span class="g-vnote">Você está em outra sala (' + esc(V.cur.name) + ")</span>" : "") +
          '<button class="g-vjoin" data-v="join"' + (block ? " disabled" : "") + ">" + IC.mic + " Entrar na sala</button>" + (block ? '<span class="g-vnote">' + esc(block) + "</span>" : "")) +
      "</div>" +
      '<p class="g-vfoot">Salas de voz funcionam bem até ~6 pessoas. Em algumas redes (4G, escola, trabalho) pode falhar sem servidor TURN.</p>';

    const all = $("gVolAll");
    if (all) all.oninput = () => { V.cur.master = all.value / 100; applyVolumes(); };
    qa("[data-vol]", box).forEach((r) => (r.oninput = () => { const pc = V.cur && V.cur.peers[r.dataset.vol]; if (pc){ pc.vol = r.value / 100; applyVolumes(); } }));
    attachVideos();
    GX.loadPhotos(list.map((p) => p.id));
  }

  function tile(p, here){
    const mine = p.id === S().uid;
    const peer = here && V.cur && V.cur.peers[p.id];
    const nm = GX.dispName(p.id) || p.name;
    const muted = p.m === false || (mine && V.cur && V.cur.muted);
    const ri = S().members[p.id] ? GX.roleInfo(S().members[p.id]) : null;
    return '<div class="g-vt' + (muted ? " muted" : "") + (V.volOpen === p.id ? " vol" : "") + (mine ? " me" : "") + (p.v ? " " + esc(p.v) : "") + '" data-vt="' + esc(p.id) + '" data-v="tile" data-uid="' + esc(p.id) + '">' +
      '<div class="g-vt-v" data-vv="' + esc(p.id) + '"></div>' +
      '<div class="g-vt-av">' + GX.avatar(p.id, nm, 76) + "</div>" +
      '<div class="g-vt-n">' + (muted ? '<i class="g-vt-mic">' + IC.micOff + "</i>" : "") + "<b" + (ri ? ' style="color:' + esc(ri.color) + '"' : "") + ">" + esc(nm) + (mine ? " (você)" : "") + "</b></div>" +
      (!mine && here ? '<div class="g-vt-vol">' + IC.spk + '<input type="range" min="0" max="100" value="' + Math.round(((peer && peer.vol) == null ? 1 : peer.vol) * 100) + '" data-vol="' + esc(p.id) + '" title="Volume de ' + esc(nm) + '"></div>' : "") + "</div>";
  }

  /* ---------- entrar / sair ---------- */
  async function join(ch){
    if (V.cur){ toast("Saia da outra sala primeiro."); return; }
    if (typeof NoxCalls !== "undefined" && NoxCalls.isBusy()){ toast("Você está em uma chamada."); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ toast("Este navegador não permite usar o microfone."); return; }
    let stream;
    try{ stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch(e){ toast(e && e.name === "NotFoundError" ? "Não encontrei um microfone." : "Permita o microfone para entrar."); return; }

    const R = { gid: S().gid, cid: ch.id, name: ch.name, stream, peers: {}, muted: false, screen: null, cam: null, master: 1, joinedAt: Date.now(), seen: new Set(), actx: null, speak: {} };
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
    paint(ch, true);
    toast("Você entrou na sala");
  }

  function leave(silent){
    const R = V.cur; if (!R) return;
    V.cur = null;
    clearInterval(R.hb); clearInterval(R.tick);
    [R.unsubSig, R.unsubPart].forEach((u) => { try{ u && u(); }catch(e){} });
    Object.keys(R.peers).forEach((u) => closePeer(R, u));
    R.stream.getTracks().forEach((t) => t.stop());
    if (R.screen) R.screen.getTracks().forEach((t) => t.stop());
    if (R.cam) R.cam.getTracks().forEach((t) => t.stop());
    try{ R.actx && R.actx.close(); }catch(e){}
    G().voiceLeave(R.gid, R.cid).catch(() => {});
    const p = $("gVoicePill"); if (p) p.remove();
    if (!silent){ const ch = S().chans.find((c) => c.id === V.room); if (ch) paint(ch, true); toast("Você saiu da sala."); }
  }

  /* aviso fixo enquanto está numa sala (mesmo em outro canal) */
  function pill(){
    let p = $("gVoicePill");
    if (!p){ p = document.createElement("div"); p.id = "gVoicePill"; p.className = "g-vpill"; $("gApp").appendChild(p); }
    p.innerHTML = '<i class="g-vp-dot"></i><button class="g-vp-n" data-vp="go"><b>Voz conectada</b><small>' + esc(V.cur.name) + "</small></button>" +
      '<button class="g-vp-b' + (V.cur.muted ? " off" : "") + '" data-vp="mic" title="Microfone">' + (V.cur.muted ? IC.micOff : IC.mic) + "</button>" +
      '<button class="g-vp-b end" data-vp="x" title="Sair">' + IC.end + "</button>";
    syncPill();
    p.onclick = (e) => {
      const b = e.target.closest("[data-vp]"); if (!b) return;
      if (b.dataset.vp === "x") leave();
      else if (b.dataset.vp === "mic") toggleMic();
      else GX.selectChannel(V.cur.cid);
    };
  }

  /* a barra só aparece quando você está numa sala e olhando outro canal */
  function syncPill(){
    const p = $("gVoicePill"); if (!p) return;
    p.hidden = !V.cur || S().cid === V.cur.cid;
  }

  function toggleMic(){
    const R = V.cur; if (!R) return;
    R.muted = !R.muted;
    R.stream.getAudioTracks().forEach((t) => (t.enabled = !R.muted));
    G().voiceBeat(R.gid, R.cid, { m: !R.muted }).catch(() => {});
    pill();
    const ch = S().chans.find((c) => c.id === V.room); if (ch) paint(ch, true);
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
    if (R.cam) R.cam.getTracks().forEach((t) => { P.senders[t.id] = pc.addTrack(t, R.cam); });

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
      qa('[data-vs="' + CSS.escape(u) + '"]').forEach((x) => x.classList.toggle("speaking", on));
    });
  }

  /* ---------- compartilhar tela ---------- */
  async function toggleScreen(){
    const R = V.cur; if (!R) return;
    if (R.screen){ stopScreen(); return; }
    let scr;
    try{ scr = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); }
    catch(e){ if (e && e.name !== "NotAllowedError") toast("Não foi possível compartilhar a tela neste aparelho."); return; }
    if (R.cam) stopCam();
    R.screen = scr;
    G().voiceBeat(R.gid, R.cid, { v: "screen" }).catch(() => {});
    const tr = scr.getVideoTracks()[0];
    tr.onended = () => { if (V.cur && V.cur.screen === scr) stopScreen(); };
    Object.values(R.peers).forEach((P) => { P.senders[tr.id] = P.pc.addTrack(tr, scr); });
    const ch = S().chans.find((c) => c.id === V.room); if (ch) paint(ch, true);
  }

  function stopScreen(){
    const R = V.cur; if (!R || !R.screen) return;
    const scr = R.screen; R.screen = null;
    G().voiceBeat(R.gid, R.cid, { v: R.cam ? "cam" : "" }).catch(() => {});
    scr.getTracks().forEach((t) => {
      Object.values(R.peers).forEach((P) => { const s = P.senders[t.id]; if (s){ try{ P.pc.removeTrack(s); }catch(e){} delete P.senders[t.id]; } });
      t.stop();
    });
    const ch = S().chans.find((c) => c.id === V.room); if (ch) paint(ch, true);
  }

  /* ---------- câmera ---------- */
  async function toggleCam(){
    const R = V.cur; if (!R) return;
    if (R.cam){ stopCam(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ toast("Este navegador não permite usar a câmera."); return; }
    let cam;
    try{ cam = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false }); }
    catch(e){ toast(e && e.name === "NotFoundError" ? "Não encontrei uma câmera." : "Permita a câmera para ligar."); return; }
    if (!V.cur){ cam.getTracks().forEach((t) => t.stop()); return; }
    if (R.screen) stopScreen();
    R.cam = cam;
    const tr = cam.getVideoTracks()[0];
    tr.onended = () => { if (V.cur && V.cur.cam === cam) stopCam(); };
    Object.values(R.peers).forEach((P) => { P.senders[tr.id] = P.pc.addTrack(tr, cam); });
    G().voiceBeat(R.gid, R.cid, { v: "cam" }).catch(() => {});
    const ch = S().chans.find((c) => c.id === V.room); if (ch) paint(ch, true);
  }

  function stopCam(){
    const R = V.cur; if (!R || !R.cam) return;
    const cam = R.cam; R.cam = null;
    cam.getTracks().forEach((t) => {
      Object.values(R.peers).forEach((P) => { const s = P.senders[t.id]; if (s){ try{ P.pc.removeTrack(s); }catch(e){} delete P.senders[t.id]; } });
      t.stop();
    });
    G().voiceBeat(R.gid, R.cid, { v: R.screen ? "screen" : "" }).catch(() => {});
    const ch = S().chans.find((c) => c.id === V.room); if (ch) paint(ch, true);
  }

  /* mostra o vídeo (tela de quem compartilha) dentro do quadro da pessoa */
  function attachVideos(){
    const R = V.cur;
    qa("[data-vv]").forEach((box) => {
      const u = box.dataset.vv;
      const stream = u === S().uid ? (R && (R.cam || R.screen)) : (R && R.peers[u] && R.peers[u].video);
      const has = !!(stream && stream.getVideoTracks().length);
      let v = box.firstElementChild;
      if (!has){ box.innerHTML = ""; box.parentElement.classList.remove("sharing"); return; }
      if (!v){ v = document.createElement("video"); v.autoplay = true; v.muted = true; v.playsInline = true; box.appendChild(v); }
      if (v.srcObject !== stream) v.srcObject = stream;
      box.parentElement.classList.add("sharing");
    });
  }

  return { open, leave, active, watch, unwatch, countHtml, listHtml, syncPill };
})();

window.GXVoice = GXVoice;
