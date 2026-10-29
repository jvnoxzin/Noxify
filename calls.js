/* =========================================================
   NOXIFY — calls.js
   Chamadas de voz e vídeo (WebRTC), no estilo do WhatsApp:
   tela cheia, toque de chamada, atender/recusar, cronômetro,
   mudo, câmera. A sinalização passa pelo Firestore, no
   documento callSessions/{uidA_uidB} (veja firestore.rules).

   Quem recebe a chamada é avisado em QUALQUER tela do app
   (o app só precisa estar aberto).

   PARA FUNCIONAR EM DADOS MÓVEIS / REDES RESTRITAS é preciso um
   servidor TURN. Coloque o seu em TURN_SERVERS aqui embaixo, por
   exemplo: { urls: "turn:SEU-SERVIDOR:3478", username: "...", credential: "..." }
========================================================= */

const TURN_SERVERS = [];

const NoxCalls = (() => {

  const ICE = {
    iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }].concat(TURN_SERVERS)
  };

  const RING_TIMEOUT = 45000;      // ninguém atendeu
  const STALE = 60000;             // sinal de chamada mais velho que isso é ignorado

  const db = () => window.NoxDB;
  const me = () => (window.auth && window.auth.currentUser) ? window.auth.currentUser.uid : (localStorage.getItem("noxUid") || null);
  const sidOf = (other) => [me(), other].sort().join("_");
  const toast = (t) => { if (typeof showToast === "function") showToast(t); };

  const C = {
    st: "idle",            // idle | calling | ringing | connecting | active
    role: null, type: "audio", peer: null, sid: null, info: null,
    pc: null, local: null, offer: null,
    pend: [], seen: new Set(), outbox: [], sigReady: false,
    seenDoc: false, answered: false, chain: Promise.resolve(),
    t0: 0, tick: 0, ringT: 0, failT: 0,
    watchers: new Map(), chatsUnsub: null, uid: null,
    mutedMic: false, camOff: false
  };

  /* ---------- aparência (CSS entra por aqui para não mexer no style.css) ---------- */
  const css = document.createElement("style");
  css.textContent = `
  .nc{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;color:#fff;
      background:radial-gradient(120% 80% at 50% 0%,#3b1e5c 0%,#150d24 55%,#0b0614 100%);
      padding:calc(env(safe-area-inset-top,0px) + 56px) 24px calc(env(safe-area-inset-bottom,0px) + 36px);}
  .nc[hidden]{display:none}
  .nc-remote{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;z-index:0}
  .nc-remote.audio-only{width:2px;height:2px;opacity:0;pointer-events:none}
  .nc-shade{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(#0009,#0000 30%,#0000 60%,#000a)}
  .nc.voice .nc-shade{display:none}
  .nc-top,.nc-mid,.nc-bottom,.nc-local{position:relative;z-index:2}
  .nc-top{text-align:center}
  .nc-name{font-size:26px;font-weight:700;letter-spacing:.2px}
  .nc-status{margin-top:6px;font-size:15px;opacity:.8;min-height:20px;font-variant-numeric:tabular-nums}
  .nc-mid{flex:1;display:flex;align-items:center;justify-content:center}
  .nc.video.live .nc-mid{visibility:hidden}
  .nc-av{width:168px;height:168px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      font-size:72px;font-weight:700;background-size:cover;background-position:center;box-shadow:0 0 0 0 #a855f755}
  .nc.ringing .nc-av,.nc.calling .nc-av{animation:ncPulse 1.8s ease-out infinite}
  @keyframes ncPulse{0%{box-shadow:0 0 0 0 #a855f799}100%{box-shadow:0 0 0 46px #a855f700}}
  .nc-local{position:absolute;top:calc(env(safe-area-inset-top,0px) + 16px);right:16px;width:96px;height:136px;
      object-fit:cover;border-radius:14px;background:#000;border:2px solid #fff3;transform:scaleX(-1);z-index:3}
  .nc-local[hidden]{display:none}
  .nc-bottom{display:flex;gap:26px;align-items:flex-end;justify-content:center}
  .nc-btn{display:flex;flex-direction:column;align-items:center;gap:8px;background:none;border:0;color:#fff;font-size:12px;cursor:pointer}
  .nc-btn i{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#ffffff26;backdrop-filter:blur(6px)}
  .nc-btn.on i{background:#fff;color:#150d24}
  .nc-btn.red i{background:#e53935}
  .nc-btn.green i{background:#22c55e}
  .nc-btn svg{width:28px;height:28px;fill:currentColor}
  .nc-btn.hang svg{transform:rotate(135deg)}
  `;
  document.head.appendChild(css);

  const ICONS = {
    phone: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.9V21h2v-3.1A7 7 0 0019 11h-2z"/></svg>',
    micOff: '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.9V21h2v-3.1A7 7 0 0019 11h-2z"/><path d="M3.5 4.9L4.9 3.5l15.6 15.6-1.4 1.4z"/></svg>',
    video: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>',
    videoOff: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/><path d="M3.5 4.9L4.9 3.5l15.6 15.6-1.4 1.4z"/></svg>'
  };

  const root = document.createElement("div");
  root.className = "nc";
  root.id = "nc";
  root.hidden = true;
  root.innerHTML =
    '<video class="nc-remote audio-only" id="ncRemote" autoplay playsinline></video>' +
    '<div class="nc-shade"></div>' +
    '<video class="nc-local" id="ncLocal" autoplay playsinline muted hidden></video>' +
    '<div class="nc-top"><div class="nc-name" id="ncName"></div><div class="nc-status" id="ncStatus"></div></div>' +
    '<div class="nc-mid"><div class="nc-av" id="ncAv"></div></div>' +
    '<div class="nc-bottom" id="ncBottom"></div>';
  document.body.appendChild(root);

  const el = (id) => document.getElementById(id);

  function setStatus(t){ el("ncStatus").textContent = t; }

  function btn(cls, icon, label, act){
    return '<button type="button" class="nc-btn ' + cls + '" data-nc="' + act + '"><i>' + icon + '</i>' + label + '</button>';
  }

  function setBottom(mode){
    let h = "";
    if (mode === "incoming"){
      h = btn("red hang", ICONS.phone, "Recusar", "decline") + btn("green", C.type === "video" ? ICONS.video : ICONS.phone, "Atender", "accept");
    }else{
      h = btn(C.mutedMic ? "on" : "", C.mutedMic ? ICONS.micOff : ICONS.mic, C.mutedMic ? "Mic desligado" : "Mudo", "mic");
      if (C.type === "video") h += btn(C.camOff ? "on" : "", C.camOff ? ICONS.videoOff : ICONS.video, C.camOff ? "Câmera desligada" : "Câmera", "cam");
      h += btn("red hang", ICONS.phone, "Encerrar", "end");
    }
    el("ncBottom").innerHTML = h;
  }

  function paintAv(info, uid){
    const av = el("ncAv");
    const photo = (typeof photoCss === "function" && info && info.photo) ? photoCss(info.photo) : "";
    if (photo){
      av.style.background = photo;
      av.textContent = "";
    }else{
      const c = (typeof colorsFor === "function") ? colorsFor(uid) : ["#7c3aed", "#312e81"];
      av.style.background = "linear-gradient(135deg," + c[0] + "," + c[1] + ")";
      av.textContent = ((info && info.name) || "N").charAt(0).toUpperCase();
    }
  }

  function showUI(mode){
    root.className = "nc " + (C.type === "video" ? "video" : "voice") + " " + mode;
    el("ncName").textContent = (C.info && C.info.name) || "Usuário";
    paintAv(C.info, C.peer);
    el("ncRemote").classList.toggle("audio-only", C.type !== "video");
    el("ncLocal").hidden = C.type !== "video";
    root.hidden = false;
    document.body.classList.add("no-scroll");
  }

  function hideUI(){
    root.hidden = true;
    document.body.classList.remove("no-scroll");
    el("ncRemote").srcObject = null;
    el("ncLocal").srcObject = null;
  }

  async function userInfo(uid){
    try{ const u = await db().getUser(uid); if (u) return u; }catch(e){}
    return { uid, name: "Usuário" };
  }

  /* ---------- toques (sem arquivos de áudio: gerados na hora) ---------- */
  let actx = null, toneT = 0;
  function stopTone(){
    clearInterval(toneT); toneT = 0;
    try{ if (navigator.vibrate) navigator.vibrate(0); }catch(e){}
  }
  function beep(freq, at, len, vol){
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.03);
    g.gain.setValueAtTime(vol, at + len - 0.05);
    g.gain.linearRampToValueAtTime(0, at + len);
    o.connect(g); g.connect(actx.destination);
    o.start(at); o.stop(at + len + 0.02);
  }
  function startTone(kind){
    stopTone();
    try{
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
    }catch(e){ return; }
    const play = () => {
      try{
        const t = actx.currentTime + 0.05;
        if (kind === "in"){ beep(880, t, 0.35, 0.18); beep(660, t + 0.5, 0.35, 0.18); if (navigator.vibrate) navigator.vibrate([350, 150, 350]); }
        else beep(425, t, 1.0, 0.08);
      }catch(e){}
    };
    play();
    toneT = setInterval(play, kind === "in" ? 2400 : 3500);
  }

  /* ---------- mídia e conexão ---------- */
  async function getMedia(type){
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      throw new Error("Este navegador não suporta chamadas.");
    try{
      C.local = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === "video" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false
      });
    }catch(e){
      const n = e && e.name;
      if (n === "NotAllowedError" || n === "SecurityError") throw new Error(type === "video" ? "Permita o microfone e a câmera para ligar." : "Permita o microfone para ligar.");
      if (n === "NotFoundError" || n === "OverconstrainedError") throw new Error(type === "video" ? "Não encontrei microfone ou câmera." : "Não encontrei um microfone.");
      throw new Error("Não consegui acessar o microfone.");
    }
    if (type === "video"){ el("ncLocal").srcObject = C.local; }
  }

  function makePc(){
    closePc();
    const pc = new RTCPeerConnection(ICE);
    C.pc = pc;

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      const c = ev.candidate.toJSON ? ev.candidate.toJSON() : { candidate: ev.candidate.candidate, sdpMid: ev.candidate.sdpMid, sdpMLineIndex: ev.candidate.sdpMLineIndex };
      if (!C.sigReady){ C.outbox.push(c); return; }
      db().pushCallEvent(C.sid, { type: "candidate", from: me(), data: c }).catch((e) => console.warn("ICE não enviado:", e));
    };

    pc.ontrack = (ev) => {
      const v = el("ncRemote");
      if (ev.streams && ev.streams[0]){
        v.srcObject = ev.streams[0];
        const p = v.play(); if (p && p.catch) p.catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (C.pc !== pc) return;
      const s = pc.connectionState;
      if (s === "connected"){
        clearTimeout(C.failT);
        if (C.st !== "active") goActive();
        else setStatus(fmtDur());
      }else if (s === "disconnected"){
        setStatus("Reconectando…");
        clearTimeout(C.failT);
        C.failT = setTimeout(() => { if (C.pc === pc && pc.connectionState !== "connected") end("Conexão perdida", { local: true }); }, 12000);
      }else if (s === "failed"){
        end("Não consegui conectar. A rede pode precisar de um servidor TURN.", { local: true });
      }
    };

    if (C.local) C.local.getTracks().forEach((t) => pc.addTrack(t, C.local));
  }

  function closePc(){
    if (C.pc){
      const pc = C.pc;
      C.pc = null;
      pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = null;
      try{ pc.close(); }catch(e){}
    }
  }

  async function flushIce(){
    const pc = C.pc;
    if (!pc || !pc.remoteDescription) return;
    const list = C.pend.splice(0);
    for (const c of list){
      try{ await pc.addIceCandidate(c); }catch(e){ console.warn("ICE rejeitado:", e); }
    }
  }

  async function flushOutbox(){
    C.sigReady = true;
    const list = C.outbox.splice(0);
    for (const c of list){
      try{ await db().pushCallEvent(C.sid, { type: "candidate", from: me(), data: c }); }catch(e){ console.warn("ICE não enviado:", e); }
    }
  }

  /* ---------- cronômetro ---------- */
  const fmtDur = () => {
    const s = Math.max(0, Math.floor((Date.now() - C.t0) / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };

  function goActive(){
    C.st = "active";
    C.t0 = Date.now();
    clearTimeout(C.ringT);
    stopTone();
    root.classList.remove("ringing", "calling");
    root.classList.add("live");
    setBottom("active");
    setStatus(fmtDur());
    clearInterval(C.tick);
    C.tick = setInterval(() => { if (C.st === "active") setStatus(fmtDur()); }, 1000);
  }

  /* ---------- sinais vindos do outro lado ---------- */
  async function applySignals(p){
    if (!C.pc) return;

    if (Array.isArray(p.events)){
      for (const ev of p.events){
        if (!ev || ev.from === me() || ev.type !== "candidate" || !ev.data) continue;
        if (ev.id && C.seen.has(ev.id)) continue;
        if (ev.id) C.seen.add(ev.id);
        C.pend.push(ev.data);
      }
      await flushIce();
    }

    if (C.role === "caller" && p.answer && !C.answered && !C.pc.remoteDescription){
      C.answered = true;
      try{
        await C.pc.setRemoteDescription({ type: p.answer.type, sdp: p.answer.sdp });
        await flushIce();
        clearTimeout(C.ringT);
        stopTone();
        if (C.st === "calling"){ C.st = "connecting"; setStatus("Conectando…"); }
      }catch(e){
        console.warn("Resposta da chamada:", e);
        end("Erro ao conectar a chamada", { local: true });
      }
    }
  }

  function onSession(id, p){
    const other = id.split("_").find((x) => x !== C.uid);
    if (!other) return;

    if (!p){
      if (C.sid === id && C.st !== "idle" && (C.seenDoc || C.st === "ringing")){
        if (C.st === "ringing") end("Chamada cancelada", { remote: true });
        else if (C.st === "calling") end("Chamada recusada", { remote: true, declined: true });
        else end("Chamada encerrada", { remote: true });
      }
      return;
    }

    if (C.sid === id){
      C.seenDoc = true;
      C.chain = C.chain.then(() => applySignals(p)).catch(() => {});
    }

    const fresh = Date.now() - (p.lastSignal || p.updatedAt || 0) < STALE;
    if (p.status === "dialing" && p.caller && p.caller !== C.uid && C.st === "idle" && fresh) incoming(id, other, p);
  }

  /* ---------- receber ---------- */
  async function incoming(id, other, p){
    C.st = "ringing";
    C.role = "callee"; C.peer = other; C.sid = id; C.type = p.type === "video" ? "video" : "audio";
    C.offer = p.offer || null; C.seenDoc = true; C.answered = false;
    C.seen = new Set(); C.pend = []; C.outbox = []; C.sigReady = true;
    C.mutedMic = C.camOff = false;
    C.info = { uid: other, name: "Chamada" };
    showUI("ringing");
    setStatus(C.type === "video" ? "Chamada de vídeo do Noxify" : "Chamada de voz do Noxify");
    setBottom("incoming");
    startTone("in");
    clearTimeout(C.ringT);
    C.ringT = setTimeout(() => { if (C.st === "ringing") end("Chamada perdida", { remote: true }); }, RING_TIMEOUT);

    const info = await userInfo(other);
    if (C.sid === id && C.st === "ringing"){
      C.info = info;
      el("ncName").textContent = info.name || "Usuário";
      paintAv(info, other);
    }
  }

  async function accept(){
    if (C.st !== "ringing") return;
    clearTimeout(C.ringT);
    stopTone();
    C.st = "connecting";
    setStatus("Conectando…");
    setBottom("active");
    try{
      if (!C.offer) throw new Error("A chamada não está mais disponível.");
      await getMedia(C.type);
      makePc();
      await C.pc.setRemoteDescription({ type: C.offer.type, sdp: C.offer.sdp });
      await flushIce();
      const answer = await C.pc.createAnswer();
      await C.pc.setLocalDescription(answer);
      const la = C.pc.localDescription || answer;
      await db().upsertCallSession(C.sid, {
        status: "connected", callee: me(), answer: { type: la.type, sdp: la.sdp }, lastSignal: Date.now()
      });
      C.sigReady = true;
    }catch(e){
      toast(e && e.message ? e.message : "Não foi possível atender");
      end("", { local: true });
    }
  }

  /* ---------- ligar ---------- */
  async function startCall(type, peer){
    if (C.st !== "idle"){ toast("Você já está em uma chamada."); return; }
    if (!db() || !me()){ toast("Entre na sua conta, com internet, para ligar."); return; }
    if (!peer || peer === me()) return;
    if (!window.RTCPeerConnection){ toast("Este navegador não suporta chamadas."); return; }
    if (!navigator.onLine){ toast("Sem internet."); return; }

    C.uid = me();
    C.st = "calling"; C.role = "caller"; C.type = type === "video" ? "video" : "audio";
    C.peer = peer; C.sid = sidOf(peer);
    C.seen = new Set(); C.pend = []; C.outbox = []; C.sigReady = false;
    C.seenDoc = false; C.answered = false; C.offer = null;
    C.mutedMic = C.camOff = false;
    C.info = { uid: peer, name: "…" };
    showUI("calling");
    setStatus("Iniciando…");
    setBottom("active");

    try{
      C.info = await userInfo(peer);
      if (C.st !== "calling") return;
      el("ncName").textContent = C.info.name || "Usuário";
      paintAv(C.info, peer);

      await getMedia(C.type);
      makePc();
      const offer = await C.pc.createOffer();
      await C.pc.setLocalDescription(offer);
      const ld = C.pc.localDescription || offer;

      /* a entrada no chat cria a conversa; é por ela que o outro lado fica sabendo da chamada */
      await db().sendMessage(db().chatId(me(), peer), [me(), peer].sort(), me(),
        C.type === "video" ? "📹 Chamada de vídeo" : "📞 Chamada de voz");

      await db().upsertCallSession(C.sid, {
        type: C.type, status: "dialing", caller: me(), callee: null,
        members: [me(), peer].sort(), offer: { type: ld.type, sdp: ld.sdp },
        answer: null, lastSignal: Date.now()
      }, true);

      await flushOutbox();
      if (C.st !== "calling") return;

      setStatus("Chamando…");
      startTone("out");
      clearTimeout(C.ringT);
      C.ringT = setTimeout(() => { if (C.st === "calling") end("Sem resposta", { local: true, missed: true }); }, RING_TIMEOUT);
    }catch(e){
      console.warn("Falha ao ligar:", e);
      toast(e && e.message ? e.message : "Não foi possível iniciar a chamada");
      end("", { local: true, silent: true });
    }
  }

  /* ---------- encerrar ---------- */
  function end(reason, o){
    o = o || {};
    if (C.st === "idle") return;

    const wasActive = C.st === "active";
    const dur = wasActive ? Math.floor((Date.now() - C.t0) / 1000) : 0;
    const role = C.role, peer = C.peer, sid = C.sid, type = C.type;

    clearTimeout(C.ringT); clearTimeout(C.failT); clearInterval(C.tick);
    stopTone();
    closePc();
    if (C.local){ C.local.getTracks().forEach((t) => t.stop()); C.local = null; }
    C.st = "idle"; C.role = null; C.sid = null; C.peer = null; C.offer = null;
    C.pend = []; C.outbox = []; C.sigReady = false; C.seenDoc = false;
    hideUI();

    if (o.local && sid && db()) db().clearCallSession(sid).catch(() => {});

    if (reason && !o.silent) toast(reason);

    /* quem ligou deixa o registro no chat (como o WhatsApp) */
    if (role === "caller" && peer && db() && !o.silent){
      const icon = type === "video" ? "📹" : "📞";
      const text = wasActive
        ? icon + " Chamada encerrada · " + Math.floor(dur / 60) + ":" + String(dur % 60).padStart(2, "0")
        : o.declined ? icon + " Chamada recusada" : icon + " Chamada perdida";
      db().sendMessage(db().chatId(me(), peer), [me(), peer].sort(), me(), text).catch(() => {});
    }
  }

  /* ---------- botões da tela de chamada ---------- */
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-nc]");
    if (!b) return;
    const act = b.dataset.nc;

    if (act === "accept") accept();
    else if (act === "decline") end("", { local: true, silent: true });
    else if (act === "end") end("Chamada encerrada", { local: true });
    else if (act === "mic"){
      const t = C.local && C.local.getAudioTracks()[0];
      if (t){ t.enabled = !t.enabled; C.mutedMic = !t.enabled; setBottom(C.st === "ringing" ? "incoming" : "active"); }
    }else if (act === "cam"){
      const t = C.local && C.local.getVideoTracks()[0];
      if (t){ t.enabled = !t.enabled; C.camOff = !t.enabled; setBottom("active"); }
    }
  });

  /* ---------- ligar o aviso de chamadas ---------- */
  function onChats(list){
    list = (list || []).slice(0, 40);
    const want = new Set(list.map((c) => c.id));

    for (const [id, un] of C.watchers){
      if (!want.has(id)){ try{ un(); }catch(e){} C.watchers.delete(id); }
    }
    for (const c of list){
      if (C.watchers.has(c.id)) continue;
      C.watchers.set(c.id, db().subscribeCallSession(c.id, (p) => onSession(c.id, p), (err) => console.warn("Chamadas:", err)));
    }
  }

  function start(){
    const uid = me();
    if (!uid || !db()) return;
    if (C.uid === uid && C.chatsUnsub) return;
    stop();
    C.uid = uid;
    C.chatsUnsub = db().subscribeChats(uid, onChats, (e) => console.warn("Chamadas (chats):", e));
  }

  function stop(){
    if (C.chatsUnsub){ try{ C.chatsUnsub(); }catch(e){} C.chatsUnsub = null; }
    C.watchers.forEach((un) => { try{ un(); }catch(e){} });
    C.watchers.clear();
    if (C.st !== "idle") end("", { local: true, silent: true });
    C.uid = null;
  }

  window.addEventListener("nox-db-ready", () => setTimeout(start, 0));
  window.addEventListener("beforeunload", () => { if (C.st !== "idle" && C.sid && db()) db().clearCallSession(C.sid).catch(() => {}); });

  return { start, stop, startCall, isBusy: () => C.st !== "idle" };
})();
