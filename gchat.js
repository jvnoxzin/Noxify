/* =========================================================
   NOXIFY — gchat.js
   O chat dos canais (estilo WhatsApp): texto, imagem, vídeo, áudio,
   documentos, respostas, encaminhar, reações, editar/apagar, fixar,
   menções, "digitando", visto, busca, enquetes e tópicos.
========================================================= */

const GXChat = (() => {

  const C = {
    ch: null, msgs: [], n: 60, unsub: null, unsubT: null, typing: [], votes: {}, unsubV: {},
    reply: null, search: "", lastTyping: 0, sent: [], lastRead: 0, rec: null, thread: null, atBottom: true, loadingMore: false
  };

  const $g = () => GX, S = () => GX.S, G = () => GX.G(), q = (s, r) => GX.q(s, r), qa = (s, r) => GX.qa(s, r);
  const toast = (t) => GX.toast(t);
  const ms = (t) => GX.ms(t);
  const EMOJI = ["😀", "😂", "🥹", "😍", "😎", "🤔", "😢", "😡", "👍", "👎", "🙏", "👏", "🔥", "✨", "🎉", "❤️", "💔", "🎵", "🎮", "😴", "🤝", "💯", "👀", "🗿"];
  const QUICK = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  const SAFE_DATA = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/;
  const HTTPS = /^https:\/\/[^\s"'<>]+$/;
  const okImg = (u) => typeof u === "string" && (SAFE_DATA.test(u) || HTTPS.test(u));
  const okUrl = (u) => typeof u === "string" && HTTPS.test(u);

  const timeStr = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const dayStr = (t) => {
    const d = new Date(t), n = new Date();
    const same = (a, b) => a.toDateString() === b.toDateString();
    if (same(d, n)) return "Hoje";
    const y = new Date(n); y.setDate(n.getDate() - 1);
    if (same(d, y)) return "Ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: d.getFullYear() === n.getFullYear() ? undefined : "numeric" });
  };
  const sizeStr = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";

  /* texto -> html: links, @menções, quebras de linha */
  function fmtText(text, m){
    let h = esc(text || "");
    h = h.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)"'])/g, (u) => '<a href="' + u.replace(/&amp;/g, "&").replace(/"/g, "") + '" target="_blank" rel="noopener noreferrer">' + u + "</a>");
    const ids = (m && m.mentions) || [];
    if (ids.includes("all")) h = h.replace(/@todos\b/gi, '<span class="g-men all">@todos</span>');
    ids.filter((i) => i !== "all").forEach((u) => {
      const n = esc(GX.dispName(u));
      h = h.split("@" + n).join('<span class="g-men" data-gx="profile" data-uid="' + esc(u) + '">@' + n + "</span>");
    });
    if (C.search){
      const re = new RegExp("(" + C.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![^<]*>)", "gi");
      h = h.replace(re, "<mark>$1</mark>");
    }
    return h.replace(/\n/g, "<br>");
  }

  const mentionsMe = (m) => !!m && ((m.mentions || []).includes(S().uid) || (m.mentions || []).includes("all"));

  /* ---------- permissões de envio ---------- */
  function postBlock(ch){
    const g = S().g, m = S().mem;
    if (!g || !m) return "Carregando…";
    if (GX.isMuted(m)) return "🔇 Você está silenciado até " + new Date(m.mutedUntil).toLocaleString("pt-BR") + ".";
    if (!GX.can("sendMsg")) return "Você não tem permissão para enviar mensagens.";
    if (ch.type === "announce" && !GX.can("announce")) return "📢 Só quem tem permissão pode postar nos anúncios.";
    if (ch.type === "info" && !GX.can("manageChannels")) return "📝 Este canal é só leitura.";
    return "";
  }

  /* ---------- abrir / fechar ---------- */
  function open(ch){
    close();
    C.ch = ch; C.msgs = []; C.n = 60; C.reply = null; C.search = ""; C.typing = []; C.votes = {}; C.atBottom = true; C.thread = null;
    const main = $("gMain");
    main.innerHTML =
      '<header class="g-head" id="gHead"></header>' +
      '<div class="g-pinbar" id="gPinBar" hidden></div>' +
      '<div class="g-searchbar" id="gSearchBar" hidden><input id="gSearchIn" placeholder="Buscar nesta conversa…"><button class="g-ico" data-c="search-x">' + iconHtml("close") + "</button></div>" +
      '<div class="g-msgs" id="gMsgs"><div class="g-loading">Carregando mensagens…</div></div>' +
      '<div class="g-typing" id="gTyping"></div>' +
      '<div id="gComposer" class="g-composer"></div>';
    refreshHead(); paintComposer();

    C.unsub = G().subscribeMessages(S().gid, ch.id, C.n, onMsgs, (e) => {
      console.warn(e);
      const el = $("gMsgs");
      if (el) el.innerHTML = '<div class="g-loading">' + esc(GX.errText(e)) + "</div>";
    });
    C.unsubT = G().subscribeTyping(S().gid, ch.id, (l) => { C.typing = l; paintTyping(); });
    main.onclick = onClick;
    const sc = $("gMsgs");
    sc.onscroll = () => { C.atBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80; };
    $("gSearchIn").oninput = (e) => { C.search = e.target.value.trim(); render(true); };
  }

  function close(){
    if (C.unsub){ C.unsub(); C.unsub = null; }
    if (C.unsubT){ C.unsubT(); C.unsubT = null; }
    Object.values(C.unsubV).forEach((u) => { try{ u(); }catch(e){} }); C.unsubV = {};
    cancelRec();
    C.ch = null; C.msgs = []; C.thread = null;
  }

  function membersChanged(){
    if (!C.ch) return;
    refreshHead(); paintComposer(); render(true);
  }

  function refreshHead(){
    const h = $("gHead");
    if (!h || !C.ch) return;
    const ch = (S().chans.find((c) => c.id === C.ch.id)) || C.ch;
    C.ch = ch;
    const t = GX.CH_TYPES[ch.type] || GX.CH_TYPES.text;
    h.innerHTML = '<button class="g-ico back" data-gx="back-side" aria-label="Voltar aos canais">' + iconHtml("left") + "</button>" +
      '<div class="g-head-t"><b>' + (ch.private ? "🔒" : t.icon) + " " + esc(ch.name) + "</b><small>" + esc(ch.topic || t.label) + "</small></div>" +
      '<button class="g-ico" data-c="search" aria-label="Buscar">' + iconHtml("search") + "</button>" +
      '<button class="g-ico" data-c="pins" aria-label="Fixadas">📌</button>' +
      '<button class="g-ico only-m" data-gx="members-open" aria-label="Membros">' + iconHtml("people") + "</button>" +
      '<button class="g-ico" data-c="chmenu" aria-label="Canal">' + iconHtml("more") + "</button>";
  }

  /* ---------- mensagens ---------- */
  function onMsgs(list){
    C.msgs = list;
    list.filter((m) => m.type === "poll" && !m.del).slice(-8).forEach((m) => {
      if (C.unsubV[m.id]) return;
      C.unsubV[m.id] = G().subscribeVotes(S().gid, C.ch.id, m.id, (v) => { C.votes[m.id] = v; render(true); });
    });
    render();
    markRead();
  }

  function markRead(){
    if (!C.ch || document.hidden) return;
    const last = C.msgs.length ? ms(C.msgs[C.msgs.length - 1].at) : 0;
    if (!last || last <= C.lastRead && C.lastReadCh === C.ch.id) return;
    const cur = (S().mem && S().mem.reads && S().mem.reads[C.ch.id]) || 0;
    C.lastRead = last; C.lastReadCh = C.ch.id;
    if (last > cur) G().patchMember(S().gid, S().uid, { reads: { [C.ch.id]: last } }).catch(() => {});
    S().unread[C.ch.id] = false;
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) markRead(); });

  const othersSeen = (m) => {
    const at = ms(m.at);
    return Object.values(S().members).filter((x) => x.id !== S().uid && x.reads && (x.reads[C.ch.id] || 0) >= at);
  };

  function render(keep){
    const box = $("gMsgs");
    if (!box || !C.ch) return;
    const prevH = box.scrollHeight, prevT = box.scrollTop;
    const wasBottom = C.atBottom;

    let list = C.msgs.filter((m) => !m.tid);
    if (C.search) list = list.filter((m) => !m.del && ((m.text || "").toLowerCase().includes(C.search.toLowerCase()) || (m.file && (m.file.name || "").toLowerCase().includes(C.search.toLowerCase())) || (m.poll && m.poll.q.toLowerCase().includes(C.search.toLowerCase()))));

    const threads = {};
    C.msgs.forEach((m) => { if (m.tid && !m.del) threads[m.tid] = (threads[m.tid] || 0) + 1; });

    let html = "";
    if (C.msgs.length >= C.n && !C.search) html += '<button class="g-more" data-c="more">Carregar mensagens anteriores</button>';
    if (C.search) html += '<div class="g-hint">Busca nas mensagens carregadas' + (C.msgs.length >= C.n ? ' — <a data-c="more">carregar mais</a>' : "") + "</div>";

    if (C.ch.type === "info" && S().g){
      html += '<div class="g-infocard"><h3>' + esc(S().g.name) + "</h3>" + (S().g.desc ? "<p>" + esc(S().g.desc) + "</p>" : "") +
        (S().g.rules ? "<h4>📜 Regras</h4><p>" + esc(S().g.rules).replace(/\n/g, "<br>") + "</p>" : "<p class='g-muted'>Nenhuma regra escrita ainda.</p>") + "</div>";
    }
    if (C.ch.type === "text" && S().g && S().g.welcome && !C.search && C.msgs.length < C.n){
      html += '<div class="g-welcome">👋 ' + esc(S().g.welcome.replace(/\{nome\}/gi, GX.dispName(S().uid))) + "</div>";
    }

    let lastDay = "", prev = null;
    list.forEach((m) => {
      const t = ms(m.at) || Date.now();
      const d = dayStr(t);
      if (d !== lastDay){ html += '<div class="g-day"><span>' + esc(d) + "</span></div>"; lastDay = d; prev = null; }
      if (m.type === "system"){
        const who = esc(GX.dispName(m.from));
        html += '<div class="g-sys">' + (m.sys === "join" ? "👋 " + who + " entrou no grupo" : "🚪 " + who + " saiu do grupo") + "</div>";
        prev = null; return;
      }
      html += msgHtml(m, prev, t, threads[m.id] || 0);
      prev = m;
    });
    if (!list.length && !C.search && C.ch.type !== "info") html += '<div class="g-hint">Nenhuma mensagem ainda. Comece a conversa! 👋</div>';
    box.innerHTML = html;

    if (wasBottom && !keep || (wasBottom && keep)) box.scrollTop = box.scrollHeight;
    else if (C.loadingMore){ box.scrollTop = prevT + (box.scrollHeight - prevH); C.loadingMore = false; }
    else box.scrollTop = prevT;

    GX.loadPhotos(Array.from(new Set(list.map((m) => m.from))));
    if (typeof NoxVoice !== "undefined") NoxVoice.afterRender();
    paintPinBar();
    if (C.thread) paintThread();
  }

  /* reactions guardadas como { uid: [emojis] } -> { emoji: [uids] } */
  function rxByEmoji(m){
    const out = {};
    Object.keys(m.reactions || {}).forEach((u) => { (m.reactions[u] || []).forEach((e) => { (out[e] = out[e] || []).push(u); }); });
    return out;
  }

  function msgHtml(m, prev, t, nThread){
    const mine = m.from === S().uid;
    const cluster = prev && prev.from === m.from && !prev.del && (t - ms(prev.at)) < 300000 && !m.reply;
    const mem = S().members[m.from];
    const ri = mem ? GX.roleInfo(mem) : { color: "#9ca3af", icon: "", name: "" };
    const name = GX.dispName(m.from);

    if (m.del){
      return '<div class="g-m ' + (mine ? "mine" : "theirs") + '"><div class="g-bub del">🚫 Mensagem apagada</div></div>';
    }

    let body = "";
    if (m.fwd) body += '<div class="g-fwd">↪ Encaminhada' + (m.fwd.name ? " de " + esc(m.fwd.name) : "") + "</div>";
    if (m.reply){
      body += '<div class="g-quote" data-c="goto" data-id="' + esc(m.reply.id) + '"><b>' + esc(m.reply.name || "") + "</b><span>" + esc((m.reply.text || "").slice(0, 90)) + "</span></div>";
    }

    if (m.type === "image" && okImg(m.image)){
      body += '<img class="g-img" data-c="img" src="' + esc(m.image) + '" alt="imagem" loading="lazy">' + (m.text ? '<div class="g-txt">' + fmtText(m.text, m) + "</div>" : "");
    }else if (m.type === "video" && m.file && okUrl(m.file.url)){
      body += '<video class="g-vid" controls preload="metadata" playsinline src="' + esc(m.file.url) + '"></video>' + (m.text ? '<div class="g-txt">' + fmtText(m.text, m) + "</div>" : "");
    }else if (m.type === "file" && m.file && okUrl(m.file.url)){
      body += '<a class="g-file" href="' + esc(m.file.url) + '" target="_blank" rel="noopener noreferrer" download><span>📄</span><div><b>' + esc(m.file.name || "arquivo") + "</b><small>" + esc(sizeStr(m.file.size || 0)) + "</small></div></a>" + (m.text ? '<div class="g-txt">' + fmtText(m.text, m) + "</div>" : "");
    }else if (m.type === "audio" && m.audio){
      /* o player de voz do Noxify cuida do resto */
      body += '<div class="g-voicewrap" data-vwrap="' + esc(m.id) + '"></div>';
    }else if (m.type === "poll" && m.poll){
      body += pollHtml(m);
    }else{
      body += '<div class="g-txt">' + fmtText(m.text, m) + "</div>";
    }

    const rx = rxByEmoji(m);
    const rxHtml = Object.keys(rx).map((e) =>
      '<button class="g-rx' + (rx[e].includes(S().uid) ? " mine" : "") + '" data-c="react" data-id="' + esc(m.id) + '" data-e="' + esc(e) + '">' + esc(e) + " " + rx[e].length + "</button>").join("");

    let ticks = "";
    if (mine){
      if (m.pending) ticks = '<span class="g-tick">🕓</span>';
      else { const seen = othersSeen(m).length; ticks = '<button class="g-tick' + (seen ? " seen" : "") + '" data-c="seen" data-id="' + esc(m.id) + '" aria-label="Visto por">' + (seen ? "✓✓" : "✓") + "</button>"; }
    }

    const mention = mentionsMe(m) && !mine;
    const voiceNote = m.type === "audio" ? "" : "";
    return '<div class="g-m ' + (mine ? "mine" : "theirs") + (cluster ? " cl" : "") + (mention ? " men" : "") + (m.pin ? " pinned" : "") + '" data-id="' + esc(m.id) + '">' +
      (!mine ? '<div class="g-m-av">' + (cluster ? "" : '<button data-gx="profile" data-uid="' + esc(m.from) + '">' + GX.avatar(m.from, name, 32) + "</button>") + "</div>" : "") +
      '<div class="g-bub">' +
        (!mine && !cluster ? '<div class="g-m-h"><b style="color:' + esc(ri.color) + '">' + esc(name) + '</b><i title="' + esc(ri.name) + '">' + esc(ri.icon || "") + "</i></div>" : "") +
        body + voiceNote +
        (rxHtml ? '<div class="g-rxs">' + rxHtml + "</div>" : "") +
        (nThread ? '<button class="g-thr" data-c="thread" data-id="' + esc(m.id) + '">💬 ' + nThread + " resposta" + (nThread > 1 ? "s" : "") + "</button>" : "") +
        '<div class="g-m-f">' + (m.pin ? "📌 " : "") + (m.editedAt ? "editada · " : "") + timeStr(t) + " " + ticks + "</div>" +
        '<button class="g-mact" data-c="menu" data-id="' + esc(m.id) + '" aria-label="Opções da mensagem">▾</button>' +
      "</div></div>";
  }

  /* o player de áudio precisa do HTML dele; troca os espaços reservados */
  const _render = render;
  render = function (keep){
    _render(keep);
    qa(".g-voicewrap").forEach((w) => {
      const m = C.msgs.find((x) => x.id === w.dataset.vwrap);
      if (!m || typeof NoxVoice === "undefined") return;
      const mine = m.from === S().uid;
      w.innerHTML = NoxVoice.bubbleHtml({ id: "g" + m.id, audio: m.audio, dur: m.dur }, mine, "");
    });
    if (typeof NoxVoice !== "undefined") NoxVoice.afterRender();
  };

  /* ---------- enquetes ---------- */
  function pollHtml(m){
    const p = m.poll, votes = C.votes[m.id] || [];
    const counts = p.opts.map(() => 0);
    let mine = [];
    votes.forEach((v) => { (v.c || []).forEach((i) => { if (counts[i] != null) counts[i]++; }); if (v.id === S().uid) mine = v.c || []; });
    const total = votes.length;
    return '<div class="g-poll"><b>📊 ' + esc(p.q) + "</b><small>" + (p.multi ? "Várias respostas" : "Uma resposta") + "</small>" +
      p.opts.map((o, i) => {
        const pct = total ? Math.round(counts[i] * 100 / Math.max(1, total)) : 0;
        return '<button class="g-opt' + (mine.includes(i) ? " on" : "") + '" data-c="vote" data-id="' + esc(m.id) + '" data-i="' + i + '"><i style="width:' + pct + '%"></i><span>' + esc(o) + "</span><em>" + counts[i] + "</em></button>";
      }).join("") + "<small>" + total + " voto" + (total === 1 ? "" : "s") + "</small></div>";
  }

  const vote = GX.guard(async (id, i) => {
    const m = C.msgs.find((x) => x.id === id);
    if (!m || !m.poll) return;
    const cur = ((C.votes[id] || []).find((v) => v.id === S().uid) || {}).c || [];
    let next;
    if (m.poll.multi) next = cur.includes(i) ? cur.filter((x) => x !== i) : cur.concat(i);
    else next = cur.includes(i) ? [] : [i];
    await G().vote(S().gid, C.ch.id, id, next);
  });

  /* ---------- barra de fixadas ---------- */
  const pins = () => C.msgs.filter((m) => m.pin && !m.del).sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));
  function paintPinBar(){
    const bar = $("gPinBar");
    if (!bar) return;
    const p = pins();
    bar.hidden = !p.length;
    if (p.length) bar.innerHTML = '<span>📌</span><div data-c="goto" data-id="' + esc(p[0].id) + '"><b>Mensagem fixada' + (p.length > 1 ? " (" + p.length + ")" : "") + "</b><small>" + esc((p[0].text || (p[0].type === "image" ? "Imagem" : p[0].type === "poll" ? "Enquete" : "Mensagem")).slice(0, 80)) + "</small></div>";
  }

  /* ---------- digitando ---------- */
  function paintTyping(){
    const t = $("gTyping");
    if (!t) return;
    const names = C.typing.filter((x) => x.id !== S().uid && Date.now() - (x.at || 0) < 4500).map((x) => GX.dispName(x.id));
    t.textContent = !names.length ? "" : names.length === 1 ? names[0] + " está digitando…" : names.length === 2 ? names.join(" e ") + " estão digitando…" : "Várias pessoas estão digitando…";
  }
  setInterval(paintTyping, 2000);

  /* ---------- compositor ---------- */
  function paintComposer(){
    const box = $("gComposer");
    if (!box || !C.ch) return;
    const block = postBlock(C.ch);
    if (block){ box.innerHTML = '<div class="g-locked">' + esc(block) + "</div>"; return; }
    if (box.querySelector("#gInput")) return;            // já pintado: não perde o que foi digitado
    box.innerHTML =
      '<div class="g-replybar" id="gReplyBar" hidden></div>' +
      '<div class="g-mentions" id="gMen" hidden></div>' +
      '<div class="g-emojis" id="gEmo" hidden>' + EMOJI.map((e) => '<button type="button" data-c="emo" data-e="' + e + '">' + e + "</button>").join("") + "</div>" +
      '<div class="g-form" id="gForm">' +
        '<button type="button" class="g-ico" data-c="attach" aria-label="Anexar">' + iconHtml("plus") + "</button>" +
        '<textarea id="gInput" rows="1" maxlength="2000" placeholder="Mensagem em #' + esc(C.ch.name) + '"></textarea>' +
        '<button type="button" class="g-ico" data-c="emoji" aria-label="Emojis">😊</button>' +
        '<button type="button" class="g-send" id="gSend" data-c="send" aria-label="Enviar">' + iconHtml("send") + "</button>" +
        '<button type="button" class="g-send mic" id="gMic" data-c="mic" aria-label="Gravar áudio">🎙️</button>' +
      "</div>" +
      '<div class="g-rec" id="gRec" hidden><i class="rec-dot"></i><span id="gRecT">0:00</span><span class="g-grow"></span><button type="button" class="g-ico" data-c="rec-x" aria-label="Cancelar">🗑️</button><button type="button" class="g-send" data-c="rec-ok" aria-label="Enviar áudio">' + iconHtml("send") + "</button></div>";
    const inp = $("gInput");
    const sync = () => {
      inp.style.height = "auto"; inp.style.height = Math.min(120, inp.scrollHeight) + "px";
      const has = inp.value.trim().length > 0;
      $("gSend").style.display = has ? "" : "none"; $("gMic").style.display = has ? "none" : "";
    };
    inp.oninput = () => { sync(); onTyping(); mentionSuggest(); };
    inp.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth >= 900){ e.preventDefault(); send(); } };
    sync();
  }

  function onTyping(){
    const t = Date.now();
    if (t - C.lastTyping < 2500) return;
    C.lastTyping = t;
    G().setTyping(S().gid, C.ch.id).catch(() => {});
  }

  /* @menções */
  function mentionSuggest(){
    const inp = $("gInput"), box = $("gMen");
    if (!inp || !box) return;
    const before = inp.value.slice(0, inp.selectionStart);
    const m = /(?:^|\s)@([^\s@]{0,20})$/.exec(before);
    if (!m){ box.hidden = true; return; }
    const t = m[1].toLowerCase();
    let opts = Object.values(S().members).filter((x) => x.id !== S().uid && GX.dispName(x.id).toLowerCase().startsWith(t)).slice(0, 6).map((x) => ({ id: x.id, n: GX.dispName(x.id) }));
    if (GX.can("mentionAll") && "todos".startsWith(t)) opts.unshift({ id: "all", n: "todos" });
    if (!opts.length){ box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = opts.map((o) => '<button type="button" data-c="men" data-n="' + esc(o.n) + '">@' + esc(o.n) + "</button>").join("");
  }

  function insertMention(n){
    const inp = $("gInput");
    const pos = inp.selectionStart, before = inp.value.slice(0, pos), after = inp.value.slice(pos);
    const nb = before.replace(/@([^\s@]{0,20})$/, "@" + n + " ");
    inp.value = nb + after; inp.focus(); inp.selectionStart = inp.selectionEnd = nb.length;
    $("gMen").hidden = true; inp.dispatchEvent(new Event("input"));
  }

  function parseMentions(text){
    const ids = [];
    Object.values(S().members).forEach((m) => { if (m.id !== S().uid && text.includes("@" + GX.dispName(m.id))) ids.push(m.id); });
    if (/@todos\b/i.test(text) && GX.can("mentionAll")) ids.push("all");
    return ids.slice(0, 30);
  }

  /* ---------- filtros e proteção contra spam (cliente; regras do servidor protegem o resto) ---------- */
  function checkOutgoing(text, isMedia){
    const g = S().g, m = S().mem, ch = C.ch;
    const err = postBlock(ch);
    if (err) return err;
    if (isMedia && !GX.can("sendMedia")) return "Você não pode enviar mídia neste grupo.";
    const staff = GX.can("ban") || GX.can("deleteMsg");
    const now = Date.now();
    if (!staff && ch.slow){
      const lastMine = [...C.msgs].reverse().find((x) => x.from === S().uid);
      const wait = ch.slow * 1000 - (now - (lastMine ? ms(lastMine.at) : 0));
      if (wait > 0) return "Modo lento: espere " + Math.ceil(wait / 1000) + " s.";
    }
    C.sent = C.sent.filter((t) => now - t < 8000);
    if (!staff && g.filters && g.filters.flood !== false && C.sent.length >= 5) return "Calma! Você está enviando mensagens rápido demais.";
    if (!staff && text){
      const f = g.filters || {};
      const low = text.toLowerCase();
      const bad = (f.words || []).find((w) => w && low.includes(w.toLowerCase()));
      if (bad) return "Sua mensagem tem uma palavra bloqueada neste grupo.";
      if (/(https?:\/\/|www\.)/i.test(text) && f.links === "block") return "Links não são permitidos neste grupo.";
      if (/(https?:\/\/|www\.)/i.test(text) && f.links === "mods") return "Só a equipe pode enviar links neste grupo.";
    }
    return "";
  }

  const afterSend = (extra) => {
    C.sent.push(Date.now());
    if (window.NoxPush && NoxPush.notifyGroup) NoxPush.notifyGroup(S().gid, C.ch.id, extra || {});
  };

  const send = GX.guard(async () => {
    const inp = $("gInput");
    if (!inp) return;
    const text = inp.value.trim();
    if (!text) return;
    const err = checkOutgoing(text, false);
    if (err){ toast(err); return; }
    const m = { type: "text", text: text.slice(0, 2000) };
    const men = parseMentions(text); if (men.length) m.mentions = men;
    if (C.reply) m.reply = { id: C.reply.id, name: C.reply.name, text: C.reply.text };
    inp.value = ""; inp.dispatchEvent(new Event("input"));
    const rep = C.reply; setReply(null);
    try{
      await G().sendMessage(S().gid, C.ch.id, m);
      afterSend({ type: "text", text: text.slice(0, 100), mentions: men });
    }catch(e){ inp.value = text; inp.dispatchEvent(new Event("input")); C.reply = rep; throw e; }
    C.atBottom = true;
  });

  function setReply(r){
    C.reply = r;
    const b = $("gReplyBar");
    if (!b) return;
    b.hidden = !r;
    if (r) b.innerHTML = '<div><b>Respondendo a ' + esc(r.name) + "</b><small>" + esc((r.text || "").slice(0, 80)) + '</small></div><button class="g-ico" data-c="reply-x">' + iconHtml("close") + "</button>";
    if (r && $("gInput")) $("gInput").focus();
  }

  /* ---------- mídia ---------- */
  function shrink(file, max){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        let out = c.toDataURL("image/webp", 0.8);
        if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/jpeg", 0.8);
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não consegui abrir essa imagem.")); };
      img.src = url;
    });
  }

  function pickFile(accept){
    return new Promise((res) => {
      const i = document.createElement("input"); i.type = "file"; i.accept = accept || "";
      i.onchange = () => res(i.files[0] || null); i.click();
    });
  }

  const sendImage = GX.guard(async (file) => {
    if (!file) return;
    const err = checkOutgoing("", true); if (err){ toast(err); return; }
    toast("Enviando imagem…");
    let image = await shrink(file, 900);
    if (image.length > 700000) image = await shrink(file, 600);
    if (image.length > 850000){ toast("Imagem grande demais."); return; }
    const m = { type: "image", image, text: "" };
    if (C.reply) m.reply = { id: C.reply.id, name: C.reply.name, text: C.reply.text };
    await G().sendMessage(S().gid, C.ch.id, m); setReply(null);
    afterSend({ type: "image" });
  });

  const sendBig = GX.guard(async (file, kind) => {
    if (!file) return;
    const err = checkOutgoing("", true); if (err){ toast(err); return; }
    const max = kind === "video" ? 25 : 15;
    if (file.size > max * 1048576){ toast("Arquivo grande demais (máx. " + max + " MB)."); return; }
    toast("Enviando " + (kind === "video" ? "vídeo" : "arquivo") + "…");
    let url;
    try{ url = await G().uploadMedia(S().gid, file); }
    catch(e){
      if (e.code === "media/no-bucket") toast("Falta criar o bucket 'chatmedia' no Supabase (veja o LEIA-ME-GRUPOS.txt).");
      else toast("Falha no envio: " + (e.message || e));
      return;
    }
    const m = { type: kind, file: { url, name: String(file.name || "arquivo").slice(0, 80), size: file.size, mime: file.type || "" }, text: "" };
    if (C.reply) m.reply = { id: C.reply.id, name: C.reply.name, text: C.reply.text };
    await G().sendMessage(S().gid, C.ch.id, m); setReply(null);
    afterSend({ type: kind });
  });

  /* ---------- gravação de áudio ---------- */
  const mimeOk = () => { const l = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]; return l.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || ""; };

  async function startRec(){
    if (C.rec) return;
    const err = checkOutgoing("", true); if (err){ toast(err); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder){ toast("Este navegador não grava áudio."); return; }
    if (window.GXVoice && GXVoice.active()){ toast("Saia da sala de voz para gravar."); return; }
    let stream;
    try{ stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch(e){ toast("Permita o microfone para gravar."); return; }
    const mime = mimeOk();
    let rec;
    try{ rec = new MediaRecorder(stream, Object.assign({ audioBitsPerSecond: 32000 }, mime ? { mimeType: mime } : {})); }
    catch(e){ stream.getTracks().forEach((t) => t.stop()); toast("Não consegui gravar."); return; }
    const R = { rec, stream, chunks: [], t0: Date.now(), send: false, tick: 0 };
    C.rec = R;
    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) R.chunks.push(ev.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      C.rec = null;
      if (!R.send) return;
      const dur = Math.max(1, Math.round((Date.now() - R.t0) / 1000));
      const blob = new Blob(R.chunks, { type: rec.mimeType || mime || "audio/webm" });
      const data = await new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(blob); });
      if (data.length > 880000){ toast("Áudio muito longo."); return; }
      try{
        await G().sendMessage(S().gid, C.ch.id, { type: "audio", audio: data, dur, text: "" });
        afterSend({ type: "audio" });
      }catch(e){ toast(GX.errText(e)); }
    };
    rec.start(500);
    $("gForm").hidden = true; $("gRec").hidden = false;
    R.tick = setInterval(() => {
      const s = (Date.now() - R.t0) / 1000;
      $("gRecT").textContent = Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
      if (s >= 120) finishRec(true);
    }, 250);
  }

  function finishRec(send){
    const R = C.rec; if (!R) return;
    clearInterval(R.tick); R.send = !!send;
    if ($("gForm")){ $("gForm").hidden = false; $("gRec").hidden = true; }
    try{ if (R.rec.state !== "inactive") R.rec.stop(); }catch(e){}
  }
  function cancelRec(){ if (C.rec) finishRec(false); }

  /* ---------- enquete ---------- */
  function newPoll(){
    GX.formModal("Nova enquete", [
      { k: "q", l: "Pergunta", max: 120, ph: "Qual música ouvimos hoje?" },
      { k: "o", l: "Opções (uma por linha, 2 a 8)", t: "textarea", rows: 5, max: 400, ph: "Opção 1\nOpção 2" },
      { k: "multi", l: "Permitir várias respostas", t: "check" }
    ], "Publicar", async (v) => {
      const opts = v.o.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 8);
      if (!v.q.trim() || opts.length < 2){ toast("Escreva a pergunta e pelo menos 2 opções."); return false; }
      const err = checkOutgoing(v.q, false); if (err){ toast(err); return false; }
      await G().sendMessage(S().gid, C.ch.id, { type: "poll", text: v.q.trim(), poll: { q: v.q.trim().slice(0, 120), opts: opts.map((o) => o.slice(0, 60)), multi: !!v.multi } });
      afterSend({ type: "poll", text: v.q.trim().slice(0, 100) });
    });
  }

  /* ---------- menu da mensagem ---------- */
  const find = (id) => C.msgs.find((m) => m.id === id);

  function msgMenu(id){
    const m = find(id); if (!m) return;
    const mine = m.from === S().uid;
    const author = S().members[m.from];
    const canDel = mine || (GX.can("deleteMsg") && (!author || GX.outranks(S().mem, author)) && m.from !== S().g.ownerId);
    const isText = m.type === "text" && !m.del;
    const blocked = postBlock(C.ch);
    const items = [];
    if (!m.del){
      items.push({ icon: "↩️", label: "Responder", run: () => { if (blocked) return toast(blocked); setReply({ id: m.id, name: GX.dispName(m.from), text: m.text || (m.type === "image" ? "📷 Imagem" : m.type === "audio" ? "🎙️ Áudio" : m.type === "poll" ? "📊 Enquete" : m.file ? "📄 " + (m.file.name || "") : "") }); } });
      items.push({ icon: "💬", label: "Responder em tópico", run: () => openThread(m.id) });
      items.push({ icon: "😊", label: "Reagir…", run: () => reactPicker(m.id) });
      if (m.text) items.push({ icon: "📋", label: "Copiar texto", run: () => { try{ navigator.clipboard.writeText(m.text); toast("Copiado!"); }catch(e){ toast("Não consegui copiar."); } } });
      items.push({ icon: "↪️", label: "Encaminhar", run: () => forward(m) });
      if (GX.can("pinMsg")) items.push({ icon: "📌", label: m.pin ? "Desafixar" : "Fixar", run: GX.guard(() => G().pin(S().gid, C.ch.id, m.id, !m.pin)) });
      if (mine && isText) items.push({ icon: "✏️", label: "Editar", run: () => editMsg(m) });
      if (!mine) items.push({ icon: "🚩", label: "Denunciar mensagem", run: () => reportMsg(m) });
      if (!mine) items.push({ icon: "👤", label: "Ver perfil", run: () => GXAdmin.profile(m.from) });
    }
    if (canDel) items.push({ icon: "🗑️", label: "Apagar", danger: true, run: GX.guard(async () => {
      if (!(await askConfirm("Apagar esta mensagem?", "Apagar"))) return;
      await G().deleteMessage(S().gid, C.ch.id, m.id);
      if (!mine) G().logAction(S().gid, { byName: GX.dispName(S().uid), act: "delmsg", target: m.from, targetName: GX.dispName(m.from), note: (m.text || m.type).slice(0, 80) }).catch(() => {});
    }) });
    GX.sheet("Mensagem", items);
  }

  function reactPicker(id){
    const m = GX.modal("Reagir", '<div class="g-emojis open">' + QUICK.concat(EMOJI).filter((e, i, a) => a.indexOf(e) === i).map((e) => '<button type="button" data-e="' + e + '">' + e + "</button>").join("") + "</div>");
    GX.qa("button", m).forEach((b) => (b.onclick = () => { m.close(); toggleReact(id, b.dataset.e); }));
  }

  const toggleReact = GX.guard(async (id, e) => {
    const m = find(id); if (!m || m.del) return;
    const has = ((m.reactions || {})[S().uid] || []).includes(e);
    await G().react(S().gid, C.ch.id, id, e, !has);
  });

  function editMsg(m){
    GX.formModal("Editar mensagem", [{ k: "t", l: "Texto", t: "textarea", rows: 4, max: 2000, v: m.text }], "Salvar", async (v) => {
      const t = v.t.trim(); if (!t){ toast("A mensagem não pode ficar vazia."); return false; }
      const err = checkOutgoing(t, false); if (err){ toast(err); return false; }
      await G().editMessage(S().gid, C.ch.id, m.id, t);
    });
  }

  function reportMsg(m){
    GX.formModal("Denunciar mensagem", [
      { k: "why", l: "Motivo", t: "select", v: "spam", o: [["spam", "Spam"], ["abuse", "Ofensa / assédio"], ["nsfw", "Conteúdo impróprio"], ["other", "Outro"]] },
      { k: "note", l: "Detalhes (opcional)", t: "textarea", max: 300 }
    ], "Enviar denúncia", async (v) => {
      await G().report(S().gid, { kind: "msg", cid: C.ch.id, mid: m.id, target: m.from, targetName: GX.dispName(m.from), why: v.why, note: v.note.slice(0, 300), preview: (m.text || m.type).slice(0, 120), byName: GX.dispName(S().uid) });
      toast("Denúncia enviada para a moderação.");
    });
  }

  async function seenBy(id){
    const m = find(id); if (!m) return;
    const list = othersSeen(m);
    GX.modal("Visto por", list.length ? list.map((x) => '<div class="g-mem plain">' + GX.avatar(x.id, GX.dispName(x.id), 32) + "<b>" + esc(GX.dispName(x.id)) + "</b></div>").join("") : '<p class="g-muted">Ninguém viu ainda. (✓ = enviada, ✓✓ = vista)</p>');
  }

  /* ---------- encaminhar ---------- */
  async function forward(m){
    const chs = S().chans.filter((c) => c.type !== "voice" && GX.canSee(c));
    const dm = [];
    try{
      await new Promise((res) => {
        const u = window.NoxDB.subscribeChats(S().uid, (l) => { u(); dm.push(...l.filter((c) => c.members.length === 2).slice(0, 15)); res(); }, () => res());
      });
    }catch(e){}
    const html = '<div class="g-fw-t">Neste grupo</div>' + chs.map((c) => '<button class="gs-item" data-ch="' + esc(c.id) + '">' + esc((GX.CH_TYPES[c.type] || {}).icon || "#") + " " + esc(c.name) + "</button>").join("") +
      (dm.length ? '<div class="g-fw-t">Conversas</div><div id="gFwDm">' + dm.map((c) => { const o = c.members.find((x) => x !== S().uid); return '<button class="gs-item" data-dm="' + esc(c.id) + '" data-o="' + esc(o) + '">…</button>'; }).join("") + "</div>" : "");
    const mod = GX.modal("Encaminhar para…", '<div class="gs-list">' + html + "</div>");
    qa("[data-dm]", mod).forEach(async (b) => { try{ const u = await window.NoxDB.getUser(b.dataset.o); b.textContent = "👤 " + ((u && u.name) || "Usuário"); }catch(e){ b.textContent = "👤 Usuário"; } });
    const fwdName = GX.dispName(m.from);
    qa("[data-ch]", mod).forEach((b) => (b.onclick = GX.guard(async () => {
      const target = S().chans.find((c) => c.id === b.dataset.ch);
      const err = postBlock(target); if (err){ toast(err); return; }
      mod.close();
      const out = { type: m.type === "poll" ? "text" : m.type, text: m.type === "poll" ? "📊 " + m.poll.q : (m.text || ""), fwd: { name: fwdName } };
      if (m.image) out.image = m.image; if (m.audio){ out.audio = m.audio; out.dur = m.dur || 0; } if (m.file) out.file = m.file;
      await G().sendMessage(S().gid, target.id, out); toast("Encaminhada para #" + target.name);
    })));
    qa("[data-dm]", mod).forEach((b) => (b.onclick = GX.guard(async () => {
      mod.close();
      const id = b.dataset.dm, other = b.dataset.o;
      if (m.type === "image" && m.image) await window.NoxDB.sendMessage(id, [S().uid, other].sort(), S().uid, "", { type: "sticker", image: m.image, alt: "imagem" });
      else if (m.text) await window.NoxDB.sendMessage(id, [S().uid, other].sort(), S().uid, ("↪ " + m.text).slice(0, 500));
      else { toast("Esse tipo de mensagem só pode ser encaminhado para canais."); return; }
      toast("Encaminhada!");
    })));
  }

  /* ---------- tópicos (discussões dentro de uma mensagem) ---------- */
  function openThread(id){
    C.thread = id;
    let mod = $("gThread");
    if (!mod){
      mod = GX.modal("Tópico", '<div id="gThBody"></div><div class="g-form" id="gThForm"><textarea id="gThIn" rows="1" maxlength="1000" placeholder="Responder no tópico…"></textarea><button class="g-send" id="gThSend">' + iconHtml("send") + "</button></div>", { wide: true, onClose: () => { C.thread = null; } });
      mod.id = "gThread";
      q("#gThSend", mod).onclick = GX.guard(async () => {
        const inp = q("#gThIn", mod), t = inp.value.trim();
        if (!t) return;
        const err = checkOutgoing(t, false); if (err){ toast(err); return; }
        inp.value = "";
        await G().sendMessage(S().gid, C.ch.id, { type: "text", text: t, tid: C.thread });
        afterSend({ type: "text", text: t.slice(0, 100) });
      });
    }
    paintThread();
  }

  function paintThread(){
    const body = $("gThBody");
    if (!body) return;
    const p = find(C.thread);
    if (!p){ body.innerHTML = '<p class="g-muted">Mensagem não carregada.</p>'; return; }
    const reps = C.msgs.filter((m) => m.tid === C.thread && !m.del);
    body.innerHTML = '<div class="g-th-p"><b>' + esc(GX.dispName(p.from)) + "</b><div>" + (p.del ? "🚫 apagada" : fmtText(p.text || (p.type === "image" ? "📷 Imagem" : "…"), p)) + "</div></div>" +
      reps.map((m) => '<div class="g-th-r">' + GX.avatar(m.from, GX.dispName(m.from), 26) + "<div><b>" + esc(GX.dispName(m.from)) + " <small>" + timeStr(ms(m.at) || Date.now()) + "</small></b><div>" + fmtText(m.text, m) + "</div></div></div>").join("") + (reps.length ? "" : '<p class="g-muted">Sem respostas ainda.</p>');
    body.scrollTop = body.scrollHeight;
  }

  /* ---------- cliques ---------- */
  function onClick(e){
    const t = e.target.closest("[data-c]");
    if (!t) return;
    const c = t.dataset.c, id = t.dataset.id;
    switch (c){
      case "menu": msgMenu(id); break;
      case "react": toggleReact(id, t.dataset.e); break;
      case "vote": vote(id, +t.dataset.i); break;
      case "thread": openThread(id); break;
      case "seen": seenBy(id); break;
      case "img": viewImage(t.src); break;
      case "goto": {
        const el = q('.g-m[data-id="' + CSS.escape(id) + '"]');
        if (el){ el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1500); }
        else toast("Mensagem antiga: carregue as anteriores.");
        break;
      }
      case "more": C.n += 60; C.loadingMore = true; if (C.unsub) C.unsub(); C.unsub = G().subscribeMessages(S().gid, C.ch.id, C.n, onMsgs, () => {}); break;
      case "send": send(); break;
      case "mic": startRec(); break;
      case "rec-x": finishRec(false); break;
      case "rec-ok": finishRec(true); break;
      case "reply-x": setReply(null); break;
      case "emoji": $("gEmo").hidden = !$("gEmo").hidden; break;
      case "emo": { const i = $("gInput"); i.value += t.dataset.e; i.dispatchEvent(new Event("input")); i.focus(); break; }
      case "men": insertMention(t.dataset.n); break;
      case "search": { const b = $("gSearchBar"); b.hidden = !b.hidden; if (!b.hidden) $("gSearchIn").focus(); else { C.search = ""; render(true); } break; }
      case "search-x": $("gSearchBar").hidden = true; $("gSearchIn").value = ""; C.search = ""; render(true); break;
      case "pins": pinList(); break;
      case "chmenu": window.GXAdmin && GXAdmin.channelMenu(C.ch); break;
      case "attach": attachMenu(); break;
    }
  }

  function attachMenu(){
    GX.sheet("Enviar", [
      { icon: "🖼️", label: "Foto", run: async () => sendImage(await pickFile("image/*")) },
      { icon: "🎬", label: "Vídeo", run: async () => sendBig(await pickFile("video/*"), "video") },
      { icon: "📄", label: "Documento", run: async () => sendBig(await pickFile(".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv,.mp3"), "file") },
      { icon: "📊", label: "Enquete", run: newPoll }
    ]);
  }

  function pinList(){
    const p = pins();
    const m = GX.modal("Mensagens fixadas", p.length ? p.map((x) => '<button class="gs-item" data-id="' + esc(x.id) + '"><b>' + esc(GX.dispName(x.from)) + "</b>&nbsp;" + esc((x.text || x.type).slice(0, 70)) + "</button>").join("") : '<p class="g-muted">Nada fixado neste canal.</p>');
    qa("[data-id]", m).forEach((b) => (b.onclick = () => { m.close(); const el = q('.g-m[data-id="' + CSS.escape(b.dataset.id) + '"]'); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }));
  }

  function viewImage(src){
    const m = GX.modal("Imagem", '<img class="g-bigimg" src="' + esc(src) + '" alt="imagem">', { wide: true });
  }

  /* colar imagem no campo de texto */
  document.addEventListener("paste", (e) => {
    if (!C.ch || !$("gInput") || document.activeElement !== $("gInput")) return;
    const f = Array.from((e.clipboardData && e.clipboardData.files) || []).find((x) => x.type.startsWith("image/"));
    if (f){ e.preventDefault(); sendImage(f); }
  });

  return { open, close, refreshHead, membersChanged, mentionsMe, render: () => render(true) };
})();

window.GXChat = GXChat;
