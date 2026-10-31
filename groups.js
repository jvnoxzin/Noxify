/* =========================================================
   NOXIFY — groups.js
   Núcleo dos GRUPOS: aba "Grupos", criar, descobrir, entrar com
   código/convite, cargos e permissões, tela do grupo (canais + membros).
   Depende de: gdb.js (window.NoxG). O chat fica em gchat.js,
   a administração em gadmin.js e as salas de voz em gvoice.js.
========================================================= */

const GX = (() => {

  /* ---------- permissões e cargos ---------- */
  const PERMS = {
    sendMsg:        "Enviar mensagens",
    sendMedia:      "Enviar fotos, vídeos, áudios e arquivos",
    mentionAll:     "Mencionar todos (@todos)",
    createInvite:   "Criar convites",
    manageChannels: "Criar e gerenciar canais",
    manageMembers:  "Gerenciar membros (apelidos e cargos)",
    ban:            "Expulsar, banir e silenciar",
    approveJoin:    "Aprovar pedidos de entrada",
    deleteMsg:      "Apagar mensagens de outros",
    pinMsg:         "Fixar mensagens",
    manageGroup:    "Editar o grupo",
    manageEvents:   "Criar eventos",
    viewLog:        "Ver registro e denúncias",
    manageRoles:    "Gerenciar cargos",
    announce:       "Postar em canais de anúncios"
  };

  const P = (...k) => { const o = {}; k.forEach((x) => (o[x] = true)); return o; };
  const ALL = Object.keys(PERMS);

  function defaultRoles(){
    return {
      owner:  { name: "Dono",          color: "#f5c542", icon: "👑", order: 0, perms: P(...ALL) },
      admin:  { name: "Administrador", color: "#ef4444", icon: "🛡️", order: 1, perms: P(...ALL.filter((x) => x !== "manageRoles")) },
      mod:    { name: "Moderador",     color: "#3b82f6", icon: "🔨", order: 2, perms: P("sendMsg", "sendMedia", "mentionAll", "createInvite", "ban", "approveJoin", "deleteMsg", "pinMsg", "viewLog", "manageEvents", "announce") },
      vip:    { name: "Membro VIP",    color: "#a855f7", icon: "⭐", order: 3, perms: P("sendMsg", "sendMedia", "createInvite") },
      member: { name: "Membro",        color: "#9ca3af", icon: "👤", order: 4, perms: P("sendMsg", "sendMedia") },
      bot:    { name: "Bot",           color: "#10b981", icon: "🤖", order: 5, perms: P("sendMsg", "sendMedia") }
    };
  }

  const CH_TYPES = {
    text:     { icon: "💬", label: "Chat geral" },
    announce: { icon: "📢", label: "Anúncios" },
    games:    { icon: "🎮", label: "Jogos" },
    music:    { icon: "🎵", label: "Música" },
    memes:    { icon: "😂", label: "Memes" },
    media:    { icon: "📸", label: "Fotos e vídeos" },
    voice:    { icon: "🎙️", label: "Sala de voz" },
    info:     { icon: "📝", label: "Informações e regras" }
  };

  /* ---------- estado ---------- */
  const S = {
    started: false, uid: null, name: "",
    my: [], gcache: {}, tab: "mine", unsubMy: null,
    gid: null, g: null, mem: null, members: {}, chans: [], cid: null,
    unsubs: [], lastBy: {}, unread: {}, unsubLast: {},
    photos: {}, panel: false, prefs: null, hb: 0
  };

  const G = () => window.NoxG;
  const now = () => Date.now();
  const ms = (t) => (t && t.toMillis ? t.toMillis() : (typeof t === "number" ? t : 0));
  const q = (s, r) => (r || document).querySelector(s);
  const qa = (s, r) => Array.from((r || document).querySelectorAll(s));
  const toast = (t) => { if (typeof showToast === "function") showToast(t); };

  function errText(e){
    const c = (e && e.code) || "";
    if (/permission-denied/.test(c)) return "Sem permissão para isso (as regras do Firebase recusaram). Veja o LEIA-ME-GRUPOS.txt.";
    if (/unavailable|network/.test(c)) return "Sem conexão. Tente de novo.";
    if (/not-found/.test(c)) return "Não encontrado.";
    return (e && e.message) || "Algo deu errado.";
  }
  const guard = (fn) => async (...a) => { try{ return await fn(...a); }catch(e){ console.warn(e); toast(errText(e)); } };

  /* preferências neste aparelho (tema, sons, avisos visuais) */
  function prefs(){
    if (S.prefs) return S.prefs;
    try{ S.prefs = Object.assign({ theme: "dark", sound: true, visual: true }, JSON.parse(localStorage.getItem("noxG:prefs") || "{}")); }
    catch(e){ S.prefs = { theme: "dark", sound: true, visual: true }; }
    return S.prefs;
  }
  function setPref(k, v){
    prefs()[k] = v;
    try{ localStorage.setItem("noxG:prefs", JSON.stringify(S.prefs)); }catch(e){}
    applyTheme();
  }
  function applyTheme(){
    const el = $("gApp");
    if (!el) return;
    const t = prefs().theme;
    const light = t === "light" || (t === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
    el.dataset.theme = light ? "light" : "dark";
  }

  /* ---------- permissões (lado do cliente; o servidor confere de novo) ---------- */
  const roleOf = (m) => {
    if (!m || !S.g) return null;
    const r = S.g.roles || {};
    return r[m.role] ? m.role : "member";
  };
  const rank = (m) => {
    if (m && S.g && m.id === S.g.ownerId) return -1;
    const id = roleOf(m);
    const r = id && S.g.roles[id];
    return r && typeof r.order === "number" ? r.order : 99;
  };
  const can = (perm, m) => {
    m = m || S.mem;
    if (!m || !S.g) return false;
    if (m.id === S.g.ownerId || m.role === "owner") return true;
    const r = S.g.roles && S.g.roles[roleOf(m)];
    return !!(r && r.perms && r.perms[perm]);
  };
  const outranks = (a, b) => rank(a) < rank(b);
  const isMuted = (m) => (m && (m.mutedUntil || 0) > now());
  const roleInfo = (m) => (S.g && S.g.roles && S.g.roles[roleOf(m)]) || { name: "Membro", color: "#9ca3af", icon: "👤" };

  function canSee(ch, m){
    m = m || S.mem;
    if (!ch.private) return true;
    if (can("manageChannels", m)) return true;
    return (ch.roles || []).includes(roleOf(m)) || (ch.users || []).includes(m.id);
  }

  /* ---------- nomes e fotos ---------- */
  const dispName = (uid) => {
    const m = S.members[uid];
    return (m && (m.nick || m.name)) || "Usuário";
  };

  function avatar(uid, name, size, photo){
    const c = colorsFor(uid || name || "x");
    const url = photo || S.photos[uid] || "";
    const bg = (typeof photoCss === "function" && url) ? photoCss(url) : "";
    return '<span class="g-av" data-uid="' + esc(uid || "") + '" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * .42) + 'px;background:' +
      (bg || "linear-gradient(135deg," + c[0] + "," + c[1] + ")") + '">' + (bg ? "" : esc(String(name || "?").charAt(0).toUpperCase())) + "</span>";
  }

  const photoReq = {};
  async function loadPhotos(uids){
    const todo = uids.filter((u) => u && !(u in S.photos) && !photoReq[u]).slice(0, 40);
    if (!todo.length) return;
    await Promise.all(todo.map(async (u) => {
      photoReq[u] = 1;
      try{ const d = await window.NoxDB.getUser(u); S.photos[u] = (d && d.photo) || ""; }catch(e){ S.photos[u] = ""; }
    }));
    qa('.g-av[data-uid]').forEach((el) => {
      const u = el.dataset.uid, p = S.photos[u];
      if (p && typeof photoCss === "function" && photoCss(p)){ el.style.background = photoCss(p); el.textContent = ""; }
    });
  }

  function groupAvatar(g, size){
    const c = colorsFor(g.id || g.name);
    const bg = (typeof photoCss === "function" && g.photo) ? photoCss(g.photo) : "";
    return '<span class="g-av g-sq" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * .4) + 'px;background:' +
      (bg || "linear-gradient(135deg," + c[0] + "," + c[1] + ")") + '">' + (bg ? "" : esc(String(g.name || "?").charAt(0).toUpperCase())) + "</span>";
  }

  /* ---------- janela (modal) simples ---------- */
  function modal(title, html, opt){
    opt = opt || {};
    const m = document.createElement("div");
    m.className = "gm";
    m.innerHTML = '<div class="gm-box' + (opt.wide ? " wide" : "") + '" role="dialog" aria-modal="true"><div class="gm-head"><b>' + esc(title) +
      '</b><button class="gm-x" aria-label="Fechar">' + iconHtml("close") + '</button></div><div class="gm-body">' + html + "</div></div>";
    const th = $("gApp") ? $("gApp").dataset.theme : "dark";
    m.dataset.theme = th || "dark";
    document.body.appendChild(m);
    const close = () => { m.remove(); if (opt.onClose) opt.onClose(); };
    m.addEventListener("mousedown", (e) => { if (e.target === m) close(); });
    q(".gm-x", m).onclick = close;
    m.close = close;
    requestAnimationFrame(() => m.classList.add("in"));
    return m;
  }

  /* menu de ações (lista de botões) */
  function sheet(title, items){
    const html = items.filter(Boolean).map((it, i) =>
      '<button class="gs-item' + (it.danger ? " danger" : "") + '" data-i="' + i + '">' + (it.icon ? '<span>' + it.icon + "</span>" : "") + esc(it.label) + "</button>").join("");
    const list = items.filter(Boolean);
    const m = modal(title, '<div class="gs-list">' + html + "</div>");
    qa(".gs-item", m).forEach((b) => (b.onclick = () => { m.close(); list[+b.dataset.i].run(); }));
    return m;
  }

  /* formulário genérico: campos -> valores */
  function formModal(title, fields, okLabel, onOk){
    const html = fields.map((f) => {
      const id = "gf_" + f.k;
      if (f.t === "textarea") return '<label class="gf"><span>' + esc(f.l) + '</span><textarea id="' + id + '" rows="' + (f.rows || 3) + '" maxlength="' + (f.max || 500) + '" placeholder="' + esc(f.ph || "") + '">' + esc(f.v || "") + "</textarea></label>";
      if (f.t === "select") return '<label class="gf"><span>' + esc(f.l) + '</span><select id="' + id + '">' + f.o.map((o) => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(f.v) ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select></label>";
      if (f.t === "check") return '<label class="gf chk"><input type="checkbox" id="' + id + '"' + (f.v ? " checked" : "") + "><span>" + esc(f.l) + "</span></label>";
      return '<label class="gf"><span>' + esc(f.l) + '</span><input id="' + id + '" type="' + (f.t || "text") + '" maxlength="' + (f.max || 80) + '" placeholder="' + esc(f.ph || "") + '" value="' + esc(f.v == null ? "" : f.v) + '"></label>';
    }).join("");
    const m = modal(title, html + '<button class="g-btn primary full" id="gfOk">' + esc(okLabel || "Salvar") + "</button>");
    q("#gfOk", m).onclick = async () => {
      const v = {};
      fields.forEach((f) => { const el = q("#gf_" + f.k, m); v[f.k] = f.t === "check" ? el.checked : el.value; });
      const b = q("#gfOk", m); b.disabled = true;
      try{ const r = await onOk(v, m); if (r !== false) m.close(); }
      catch(e){ console.warn(e); toast(errText(e)); }
      b.disabled = false;
    };
    return m;
  }

  /* ---------- imagem -> texto (cortada no centro) ---------- */
  const pickImage = (w, h, qual) => new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = async () => {
      if (!inp.files[0]) return resolve("");
      try{ resolve(await imageToDataUrl(inp.files[0], w, h, qual)); }catch(e){ toast(e.message); resolve(""); }
    };
    inp.click();
  });

  /* =========================================================
     COMEÇAR / PARAR
  ========================================================= */
  function me(){ return (window.auth && window.auth.currentUser) ? window.auth.currentUser.uid : (localStorage.getItem("noxUid") || null); }

  function ready(){ return !!(window.NoxG && window.NoxDB && me()); }

  function start(){
    if (!ready()) return false;
    const id = me();
    if (S.started && S.uid === id) return true;
    stop();
    S.started = true; S.uid = id; S.name = userName();
    S.unsubMy = G().subscribeMyGroups((list) => {
      S.my = list;
      reconcilePending(list);
      if (currentView === "groups") renderList();
    }, (e) => { console.warn(e); renderList(errText(e)); });
    return true;
  }

  /* pedido aprovado: o atalho "meus grupos" ainda diz "aguardando" -> corrige sozinho */
  const checking = {};
  function reconcilePending(list){
    list.filter((e) => e.pending && !checking[e.gid]).forEach(async (e) => {
      checking[e.gid] = 1;
      try{
        const m = await G().myMembership(e.gid);
        if (m) await G().setMyEntry(e.gid, { pending: false });
      }catch(err){}
      setTimeout(() => { delete checking[e.gid]; }, 20000);
    });
  }

  function stop(){
    if (S.unsubMy) S.unsubMy();
    closeGroup(true);
    Object.assign(S, { started: false, uid: null, my: [], gcache: {}, unsubMy: null });
  }

  /* =========================================================
     ABA "GRUPOS"
  ========================================================= */
  function viewHtml(){
    return '<h1 class="page-title">Grupos</h1>' +
      '<div class="chips" id="gTabs"><button class="chip active" data-gtab="mine">Meus grupos</button><button class="chip" data-gtab="find">Descobrir</button><button class="chip" data-gtab="code">Entrar com código</button></div>' +
      '<div id="gBody"></div>';
  }

  function render(){
    const v = $("view-groups");
    if (!v) return;
    if (!v.dataset.built){ v.innerHTML = viewHtml(); v.dataset.built = "1"; }
    if (!start()){
      $("gBody").innerHTML = '<p class="g-empty">Entre na sua conta para usar os grupos.</p>';
      return;
    }
    qa("#gTabs .chip").forEach((c) => c.classList.toggle("active", c.dataset.gtab === S.tab));
    if (S.tab === "mine") renderList();
    else if (S.tab === "find") renderFind();
    else renderCode();
  }

  async function renderList(err){
    const body = $("gBody");
    if (!body || S.tab !== "mine") return;
    if (err){ body.innerHTML = '<p class="g-empty">' + esc(err) + "</p>"; return; }

    const list = S.my.slice().sort((a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || String(a.name).localeCompare(String(b.name)));

    let html = '<button class="g-btn primary full" data-gact="create">' + iconHtml("plus") + " Criar grupo</button>";
    if (!list.length){
      html += '<p class="g-empty">Você ainda não está em nenhum grupo.<br>Crie o seu, procure em <b>Descobrir</b> ou entre com um código de convite.</p>';
    }else{
      html += '<div class="g-list">' + list.map((e) => {
        const g = (S.gcache[e.gid] && S.gcache[e.gid].g) || { id: e.gid, name: e.name };
        return '<div class="g-row" data-open="' + esc(e.gid) + '">' + groupAvatar(g, 48) +
          '<div class="g-row-t"><b>' + (e.pinned ? "📌 " : "") + (e.fav ? "⭐ " : "") + esc(g.name || e.name) + "</b>" +
          "<small>" + (e.pending ? "Aguardando aprovação…" : (g.memberCount != null ? g.memberCount + " membro" + (g.memberCount === 1 ? "" : "s") + (g.vis === "private" ? " · privado" : " · público") : "…")) + "</small></div>" +
          '<button class="g-ico" data-gmenu="' + esc(e.gid) + '" aria-label="Opções">' + iconHtml("more") + "</button></div>";
      }).join("") + "</div>";
    }
    body.innerHTML = html;

    /* completa fotos e contagens em segundo plano */
    list.forEach(async (e) => {
      const c = S.gcache[e.gid];
      if (c && now() - c.t < 60000) return;
      try{
        const g = await G().getGroup(e.gid);
        S.gcache[e.gid] = { t: now(), g: g || { id: e.gid, name: e.name } };
        if (S.tab === "mine" && currentView === "groups") paintRows();
      }catch(_){}
    });
  }

  function paintRows(){
    qa("#gBody .g-row").forEach((r) => {
      const c = S.gcache[r.dataset.open];
      if (!c || !c.g) return;
      const e = S.my.find((x) => x.gid === r.dataset.open) || {};
      r.firstElementChild.outerHTML = groupAvatar(c.g, 48);
      const sm = q("small", r);
      if (sm && !e.pending) sm.textContent = (c.g.memberCount || 0) + " membro" + (c.g.memberCount === 1 ? "" : "s") + (c.g.vis === "private" ? " · privado" : " · público");
    });
  }

  /* ---------- descobrir ---------- */
  function renderFind(){
    const body = $("gBody");
    body.innerHTML = '<div class="g-search"><input id="gSearch" placeholder="Buscar grupos públicos…" maxlength="40"></div><div id="gFound" class="g-list"></div>';
    const run = async () => {
      const box = $("gFound");
      box.innerHTML = '<p class="g-empty">Buscando…</p>';
      try{
        const list = await G().searchPublic($("gSearch").value, 30);
        box.innerHTML = list.length ? list.map((g) =>
          '<div class="g-row" data-peek="' + esc(g.id) + '">' + groupAvatar(g, 48) + '<div class="g-row-t"><b>' + esc(g.name) + "</b><small>" + (g.memberCount || 0) + " membros" + (g.desc ? " · " + esc(g.desc.slice(0, 60)) : "") + "</small></div></div>").join("")
          : '<p class="g-empty">Nenhum grupo público encontrado.</p>';
        list.forEach((g) => (S.gcache[g.id] = { t: now(), g }));
      }catch(e){ box.innerHTML = '<p class="g-empty">' + esc(errText(e)) + "</p>"; }
    };
    let tm; $("gSearch").oninput = () => { clearTimeout(tm); tm = setTimeout(run, 350); };
    run();
  }

  function renderCode(){
    $("gBody").innerHTML = '<div class="g-card"><b>Tem um convite?</b><p class="g-muted">Cole o código (8 letras) ou o link que recebeu.</p>' +
      '<input id="gCode" placeholder="Ex.: K7QM2XPA" maxlength="120"><button class="g-btn primary full" id="gCodeGo">Entrar</button></div>';
    $("gCodeGo").onclick = () => joinByCode($("gCode").value);
  }

  function parseCode(v){
    v = String(v || "").trim();
    const m = /[?&]join=([A-Za-z0-9]+)/.exec(v);
    return (m ? m[1] : v).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  const joinByCode = guard(async (raw) => {
    const code = parseCode(raw);
    if (code.length < 6){ toast("Código inválido."); return; }
    const inv = await G().previewInvite(code);
    if (!inv){ toast("Convite não encontrado ou apagado."); return; }
    if (inv.exp && inv.exp < now()){ toast("Esse convite expirou."); return; }
    if (inv.max && (inv.uses || 0) >= inv.max){ toast("Esse convite já foi usado o máximo de vezes."); return; }
    if (S.my.some((e) => e.gid === inv.gid && !e.pending)){ toast("Você já está nesse grupo."); openGroup(inv.gid); return; }
    const m = modal("Convite para grupo", '<div class="g-invite">' + groupAvatar({ id: inv.gid, name: inv.name, photo: inv.photo }, 72) + "<h3>" + esc(inv.name) + "</h3><p class='g-muted'>" + esc(inv.desc || "") + '</p><button class="g-btn primary full" id="gInvGo">Entrar no grupo</button></div>');
    q("#gInvGo", m).onclick = async () => {
      q("#gInvGo", m).disabled = true;
      try{
        await G().joinByInvite(inv, S.name);
        afterJoin(inv.gid, inv.name);
        m.close(); toast("Você entrou em " + inv.name + "!");
        openGroup(inv.gid);
      }catch(e){
        console.warn(e);
        const c = (e && e.code) || "";
        toast(/permission/.test(c) ? "Não foi possível entrar (grupo cheio, convite inválido ou você foi banido)." : errText(e));
        q("#gInvGo", m).disabled = false;
      }
    };
  });

  /* mensagem de "entrou" no primeiro canal de texto (melhor esforço) */
  async function afterJoin(gid, name){
    try{
      const chans = await new Promise((res) => { const u = G().subscribeChannels(gid, (l) => { u(); res(l); }, () => res([])); });
      const first = chans.filter((c) => !c.private && c.type !== "voice" && c.type !== "info").sort((a, b) => (a.order || 0) - (b.order || 0))[0];
      if (first) await G().sendMessage(gid, first.id, { type: "system", sys: "join", text: "" });
    }catch(e){ console.warn("entrada:", e); }
  }

  /* ---------- pré-visualizar grupo público ---------- */
  const peek = guard(async (gid) => {
    let g = S.gcache[gid] && S.gcache[gid].g;
    if (!g || !g.roles) g = await G().getGroup(gid);
    if (!g){ toast("Grupo não encontrado."); return; }
    S.gcache[gid] = { t: now(), g };
    const mine = S.my.find((e) => e.gid === gid);
    if (mine && !mine.pending){ openGroup(gid); return; }
    const full = g.memberCount >= g.maxMembers;
    const m = modal(g.name, '<div class="g-invite">' + groupAvatar(g, 72) + "<h3>" + esc(g.name) + "</h3><p class='g-muted'>" + (g.memberCount || 0) + " / " + g.maxMembers + " membros</p><p>" + esc(g.desc || "") + "</p>" +
      (g.rules ? '<details class="g-rules"><summary>Regras</summary><p>' + esc(g.rules).replace(/\n/g, "<br>") + "</p></details>" : "") +
      (mine && mine.pending ? '<button class="g-btn full" id="gPkCancel">Cancelar pedido</button>'
        : full ? '<p class="g-muted">Grupo cheio.</p>'
        : '<button class="g-btn primary full" id="gPkGo">' + (g.approval ? "Pedir para entrar" : "Entrar") + "</button>") + "</div>");
    const go = q("#gPkGo", m);
    if (go) go.onclick = async () => {
      go.disabled = true;
      try{
        if (g.approval){ await G().requestJoin(g, S.name, ""); toast("Pedido enviado. Aguarde a aprovação."); m.close(); }
        else{ await G().joinPublic(g, S.name); afterJoin(g.id, g.name); m.close(); openGroup(g.id); }
      }catch(e){ console.warn(e); toast(/permission/.test((e && e.code) || "") ? "Não foi possível entrar (grupo cheio ou você foi banido)." : errText(e)); go.disabled = false; }
    };
    const cn = q("#gPkCancel", m);
    if (cn) cn.onclick = guard(async () => { await G().cancelRequest(gid); m.close(); toast("Pedido cancelado."); });
  });

  /* ---------- criar grupo ---------- */
  function createGroup(){
    const draft = { photo: "", banner: "" };
    const m = modal("Criar grupo",
      '<div class="g-create-pics"><button class="g-pic" id="gcPhoto">📷<small>Foto</small></button><button class="g-pic wide" id="gcBanner">🖼️<small>Banner</small></button></div>' +
      '<label class="gf"><span>Nome do grupo</span><input id="gcName" maxlength="40" placeholder="Ex.: Fãs de Rock"></label>' +
      '<label class="gf"><span>Descrição</span><textarea id="gcDesc" rows="2" maxlength="300" placeholder="Sobre o que é o grupo?"></textarea></label>' +
      '<label class="gf"><span>Regras do grupo</span><textarea id="gcRules" rows="3" maxlength="1500" placeholder="1. Respeito sempre…"></textarea></label>' +
      '<label class="gf"><span>Tipo</span><select id="gcVis"><option value="public">Público — aparece na busca</option><option value="private">Privado — só entra com convite</option></select></label>' +
      '<label class="gf chk"><input type="checkbox" id="gcAppr"><span>Aprovar manualmente quem pedir para entrar</span></label>' +
      '<label class="gf"><span>Limite de participantes (2 a 5000)</span><input id="gcMax" type="number" min="2" max="5000" value="500"></label>' +
      '<button class="g-btn primary full" id="gcGo">Criar grupo</button>');
    const paint = () => {
      const p = q("#gcPhoto", m), b = q("#gcBanner", m);
      p.style.background = draft.photo ? photoCss(draft.photo) : ""; p.firstChild.textContent = draft.photo ? "" : "📷";
      b.style.background = draft.banner ? photoCss(draft.banner) : ""; b.firstChild.textContent = draft.banner ? "" : "🖼️";
    };
    q("#gcPhoto", m).onclick = async () => { const d = await pickImage(256, 256, 0.82); if (d){ draft.photo = d; paint(); } };
    q("#gcBanner", m).onclick = async () => { const d = await pickImage(900, 300, 0.78); if (d){ draft.banner = d; paint(); } };
    q("#gcGo", m).onclick = async () => {
      const name = q("#gcName", m).value.trim();
      if (name.length < 2){ toast("Dê um nome ao grupo (mínimo 2 letras)."); return; }
      const b = q("#gcGo", m); b.disabled = true;
      try{
        const gid = await G().createGroup({
          name, desc: q("#gcDesc", m).value.trim(), rules: q("#gcRules", m).value.trim(),
          vis: q("#gcVis", m).value, approval: q("#gcAppr", m).checked,
          maxMembers: parseInt(q("#gcMax", m).value, 10) || 500, photo: draft.photo, banner: draft.banner,
          welcome: "Bem-vindo(a), {nome}! 🎉 Leia as regras e se apresente."
        }, defaultRoles(), [
          { name: "geral", type: "text", topic: "Conversa livre" },
          { name: "anúncios", type: "announce", topic: "Avisos da administração" },
          { name: "regras", type: "info", topic: "Regras e informações" },
          { name: "Sala de voz", type: "voice", topic: "" }
        ], S.name);
        m.close(); toast("Grupo criado! 🎉");
        openGroup(gid);
      }catch(e){ console.warn(e); toast(errText(e)); b.disabled = false; }
    };
  }

  /* =========================================================
     TELA DO GRUPO  (#gApp)
  ========================================================= */
  function shell(){
    let el = $("gApp");
    if (el) return el;
    el = document.createElement("div");
    el.id = "gApp"; el.className = "g-app"; el.hidden = true;
    el.innerHTML =
      '<aside class="g-rail" id="gRail"></aside>' +
      '<section class="g-side" id="gSide"></section>' +
      '<section class="g-main" id="gMain"></section>' +
      '<aside class="g-members" id="gMembers"></aside>';
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      const t = e.target.closest("[data-gx]");
      if (t) act(t.dataset.gx, t.dataset, e);
    });
    applyTheme();
    return el;
  }

  const openGroup = guard(async (gid, cid) => {
    if (!start()) return;
    if (S.gid && S.gid !== gid) closeGroup(true);
    const mem = await G().myMembership(gid);
    if (!mem){
      const pend = S.my.find((e) => e.gid === gid && e.pending);
      if (pend){ toast("Seu pedido ainda está aguardando aprovação."); return; }
      toast("Você não é membro deste grupo."); G().dropMyEntry(gid).catch(() => {});
      return;
    }
    const el = shell();
    el.hidden = false; document.body.classList.add("g-open");
    applyTheme();
    S.gid = gid; S.mem = mem; S.members = {}; S.chans = []; S.cid = null; S.lastBy = {}; S.unread = {};
    $("gMain").innerHTML = '<div class="g-loading">Carregando…</div>';
    el.classList.remove("pane-chat", "show-members");
    paintRail();

    S.unsubs.push(G().subscribeGroup(gid, (g) => {
      if (!g){
        toast("Este grupo foi apagado.");
        G().dropMyEntry(gid).catch(() => {});
        closeGroup(); return;
      }
      const first = !S.g;
      S.g = g; S.gcache[gid] = { t: now(), g };
      if (!first) { paintSide(); paintHead(); }
      else paintSide();
    }, (e) => {
      console.warn(e);
      if (/permission-denied/.test((e && e.code) || "")){ G().dropMyEntry(gid).catch(() => {}); toast("Este grupo não existe mais ou você perdeu o acesso."); }
      else toast(errText(e));
      closeGroup();
    }));

    S.unsubs.push(G().subscribeMembers(gid, (list) => {
      S.members = {};
      list.forEach((m) => (S.members[m.id] = m));
      if (!S.members[S.uid]){            // fui removido
        if (S.mem){ S.mem = null; toast("Você não faz mais parte deste grupo."); G().dropMyEntry(gid).catch(() => {}); closeGroup(); }
        return;
      }
      S.mem = S.members[S.uid];
      if (!S.reqWatch && can("approveJoin") && S.g && S.g.vis === "public" && S.g.approval){
        S.reqWatch = G().subscribeRequests(gid, (l) => {
          if (l.length > (S.reqCount || 0)) toast("🙋 " + l.length + " pedido(s) de entrada aguardando (menu do grupo)");
          S.reqCount = l.length;
        }, () => {});
        S.unsubs.push(() => { if (S.reqWatch){ S.reqWatch(); S.reqWatch = null; S.reqCount = 0; } });
      }
      paintMembers(); paintSide();
      if (window.GXChat) GXChat.membersChanged();
      loadPhotos(Object.keys(S.members).slice(0, 40));
    }, (e) => console.warn(e)));

    S.unsubs.push(G().subscribeChannels(gid, (list) => {
      S.chans = list.sort((a, b) => (a.order || 0) - (b.order || 0));
      watchUnread();
      if (window.GXVoice) GXVoice.watch(S.chans.filter((c) => c.type === "voice" && canSee(c)));
      /* esconde/apaga salas temporárias vencidas */
      S.chans.forEach((c) => { if (c.temp && c.expiresAt && c.expiresAt < now() && S.mem && can("manageChannels")) G().deleteChannel(gid, c.id).catch(() => {}); });
      paintSide();
      if (!S.cid){
        const pick = (cid && S.chans.find((c) => c.id === cid)) || S.chans.find((c) => c.type === "text" && canSee(c)) || S.chans.find((c) => c.type !== "voice" && canSee(c));
        if (pick) selectChannel(pick.id, !cid);
      }else if (!S.chans.find((c) => c.id === S.cid)){ S.cid = null; $("gMain").innerHTML = '<div class="g-loading">Canal removido. Escolha outro.</div>'; $("gApp").classList.remove("pane-chat"); }
    }, (e) => console.warn(e)));

    beat(true);
    clearInterval(S.hb); S.hb = setInterval(() => beat(false), 45000);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", goOffline);
    history.pushState({ g: 1 }, "");
    window.addEventListener("popstate", onPop);
  });

  function onPop(){
    const el = $("gApp");
    if (!el || el.hidden) return;
    if (el.classList.contains("show-members")){ el.classList.remove("show-members"); history.pushState({ g: 1 }, ""); return; }
    if (el.classList.contains("pane-chat") && window.innerWidth < 900){ el.classList.remove("pane-chat"); history.pushState({ g: 1 }, ""); return; }
    closeGroup();
  }

  /* presença: online / ausente / offline */
  function beat(first){
    if (!S.gid || !S.mem) return;
    const st = document.hidden ? "away" : "online";
    G().patchMember(S.gid, S.uid, { lastSeen: Date.now(), st }).catch(() => {});
  }
  function onVis(){ beat(); }
  function goOffline(){ if (S.gid && S.mem) G().patchMember(S.gid, S.uid, { st: "offline", lastSeen: Date.now() }).catch(() => {}); }

  const statusOf = (m) => {
    if (!m || !m.st || m.st === "offline") return "off";
    const age = now() - (ms(m.lastSeen) || 0);
    if (age > 150000) return "off";
    return m.st === "away" ? "away" : "on";
  };

  function closeGroup(silent){
    S.unsubs.forEach((u) => { try{ u(); }catch(e){} }); S.unsubs = [];
    Object.values(S.unsubLast).forEach((u) => { try{ u(); }catch(e){} }); S.unsubLast = {};
    clearInterval(S.hb);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("pagehide", goOffline);
    window.removeEventListener("popstate", onPop);
    if (window.GXChat) GXChat.close();
    if (window.GXVoice){ GXVoice.leave(true); GXVoice.unwatch(); }
    if (S.gid && S.mem) goOffline();
    S.gid = null; S.g = null; S.mem = null; S.cid = null; S.members = {}; S.chans = [];
    const el = $("gApp");
    if (el && !el.hidden){ el.hidden = true; }
    document.body.classList.remove("g-open");
    if (!silent && currentView === "groups") render();
  }

  /* ---------- lateral: trilho de grupos (computador) ---------- */
  function paintRail(){
    const r = $("gRail");
    if (!r) return;
    const list = S.my.filter((e) => !e.pending).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(a.name).localeCompare(String(b.name)));
    r.innerHTML = '<button class="g-rail-i home" data-gx="exit" title="Voltar ao Noxify">' + iconHtml("home") + "</button><i class='g-sep'></i>" +
      list.map((e) => {
        const g = (S.gcache[e.gid] && S.gcache[e.gid].g) || { id: e.gid, name: e.name };
        return '<button class="g-rail-i' + (e.gid === S.gid ? " on" : "") + '" data-gx="switch" data-gid="' + esc(e.gid) + '" title="' + esc(e.name) + '">' + groupAvatar(g, 44) + "</button>";
      }).join("") + '<button class="g-rail-i add" data-gx="newgroup" title="Criar ou entrar">' + iconHtml("plus") + "</button>";
  }

  /* ---------- lateral: canais ---------- */
  function paintSide(){
    const side = $("gSide");
    if (!side || !S.g) return;
    paintRail();
    const g = S.g, canCh = can("manageChannels");
    const chans = S.chans.filter((c) => canSee(c) && !(c.temp && c.expiresAt && c.expiresAt < now()));
    const grp = (title, list) => list.length ? '<div class="g-ch-title">' + title + "</div>" + list.map((c) => chanRow(c)).join("") : "";

    side.innerHTML =
      '<header class="g-side-h" data-gx="ginfo" style="' + (g.banner ? "background-image:linear-gradient(transparent,rgba(0,0,0,.65)),url('" + (SAFE_IMG.test(g.banner) ? g.banner : "") + "')" : "") + '">' +
        '<button class="g-ico back" data-gx="exit" aria-label="Voltar">' + iconHtml("left") + "</button>" +
        '<div class="g-side-t"><b>' + esc(g.name) + "</b><small></small></div>" +
        '<button class="g-ico" data-gx="gmenu" aria-label="Menu do grupo">' + iconHtml("more") + "</button></header>" +
      '<div class="g-side-body">' +
        grp("Texto", chans.filter((c) => c.type !== "voice")) +
        grp("Voz", chans.filter((c) => c.type === "voice")) +
        (canCh ? '<button class="g-add-ch" data-gx="newch">' + iconHtml("plus") + " Criar canal</button>" : "") +
        '<div class="g-ch-title">Comunidade</div>' +
        '<button class="g-ch" data-gx="events"><span class="g-ch-i">📅</span><span class="g-ch-n">Eventos</span></button>' +
        '<button class="g-ch" data-gx="members-open"><span class="g-ch-i">👥</span><span class="g-ch-n">Membros</span></button>' +
        '<button class="g-ch" data-gx="invite"><span class="g-ch-i">🔗</span><span class="g-ch-n">Convidar</span></button>' +
        '<button class="g-ch" data-gx="mysettings"><span class="g-ch-i">⚙️</span><span class="g-ch-n">Minhas configurações</span></button>' +
      "</div>";
    side.querySelector(".g-side-t small").textContent = (g.memberCount || 0) + (g.memberCount === 1 ? " membro · " : " membros · ") + onlineCount() + " online";
  }

  function chanRow(c){
    const t = CH_TYPES[c.type] || CH_TYPES.text;
    const un = S.unread[c.id];
    const muted = S.mem && S.mem.chMute && S.mem.chMute[c.id];
    return '<button class="g-ch' + (c.id === S.cid ? " on" : "") + (un && !muted ? " unread" : "") + '" data-gx="chan" data-cid="' + esc(c.id) + '">' +
      '<span class="g-ch-i">' + (c.private ? "🔒" : t.icon) + '</span><span class="g-ch-n">' + esc(c.name) + (c.temp ? " ⏳" : "") + "</span>" +
      (muted ? '<span class="g-ch-m">🔕</span>' : (un ? '<i class="g-dot"></i>' : "")) +
      (c.type === "voice" && window.GXVoice ? GXVoice.countHtml(c.id) : "") + "</button>";
  }

  const onlineCount = () => Object.values(S.members).filter((m) => statusOf(m) === "on").length;

  /* não lidos: observa a última mensagem de cada canal visível */
  function watchUnread(){
    const ids = S.chans.filter((c) => c.type !== "voice" && canSee(c)).map((c) => c.id).slice(0, 25);
    Object.keys(S.unsubLast).forEach((id) => { if (!ids.includes(id)){ S.unsubLast[id](); delete S.unsubLast[id]; } });
    ids.forEach((cid) => {
      if (S.unsubLast[cid]) return;
      let first = true;
      S.unsubLast[cid] = G().subscribeLast(S.gid, cid, (m) => {
        if (!m) return;
        const prev = S.lastBy[cid];
        S.lastBy[cid] = m.at;
        const readAt = (S.mem && S.mem.reads && S.mem.reads[cid]) || 0;
        const mine = m.from === S.uid;
        if (cid === S.cid || mine){ S.unread[cid] = false; }
        else if (m.at > readAt){
          S.unread[cid] = true;
          if (!first && (!prev || m.at > prev)) notifyIn(cid, m);
        }
        first = false;
        paintSideLight();
      });
    });
  }

  function paintSideLight(){
    qa("#gSide .g-ch[data-cid]").forEach((b) => {
      const un = S.unread[b.dataset.cid] && !(S.mem && S.mem.chMute && S.mem.chMute[b.dataset.cid]);
      b.classList.toggle("unread", !!un);
      let d = q(".g-dot", b);
      if (un && !d){ d = document.createElement("i"); d.className = "g-dot"; b.appendChild(d); }
      if (!un && d) d.remove();
    });
  }

  /* aviso dentro do app (som + faixa) respeitando silenciar e menções */
  function notifyIn(cid, m){
    if (!S.mem || S.mem.muted) return;
    const ch = S.chans.find((c) => c.id === cid);
    if (!ch || (S.mem.chMute && S.mem.chMute[cid])) return;
    if (S.mem.mentionsOnly && !(window.GXChat && GXChat.mentionsMe(m))) return;
    if (prefs().sound) beep();
    if (prefs().visual) toast("# " + ch.name + " — nova mensagem");
  }

  let actx;
  function beep(){
    try{
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.06;
      o.connect(g); g.connect(actx.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.25); o.stop(actx.currentTime + 0.26);
    }catch(e){}
  }

  /* ---------- painel de membros ---------- */
  function paintMembers(){
    const box = $("gMembers");
    if (!box || !S.g) return;
    const all = Object.values(S.members);
    const groups = {};
    all.forEach((m) => {
      const st = statusOf(m);
      const key = st === "off" ? "__off" : roleOf(m);
      (groups[key] = groups[key] || []).push(m);
    });
    const roles = S.g.roles || {};
    const order = Object.keys(roles).sort((a, b) => (roles[a].order || 0) - (roles[b].order || 0));
    const sec = (title, list) => list && list.length ? '<div class="g-ch-title">' + esc(title) + " — " + list.length + "</div>" +
      list.sort((a, b) => dispName(a.id).localeCompare(dispName(b.id))).map(memberRow).join("") : "";
    box.innerHTML = '<header class="g-mem-h"><b>Membros</b><button class="g-ico" data-gx="members-close" aria-label="Fechar">' + iconHtml("close") + "</button></header>" +
      '<div class="g-mem-search"><input id="gMemQ" placeholder="Buscar membro…"></div><div class="g-mem-body" id="gMemBody">' +
      order.map((r) => sec((roles[r].icon || "") + " " + roles[r].name, groups[r])).join("") + sec("Offline", groups.__off) + "</div>";
    const inp = $("gMemQ");
    inp.oninput = () => {
      const t = inp.value.toLowerCase();
      qa("#gMemBody .g-mem").forEach((r) => (r.hidden = !!t && !r.dataset.n.includes(t)));
    };
    paintSideLight();
    const sm = q("#gSide .g-side-t small");
    if (sm) sm.textContent = (S.g.memberCount || 0) + " membros · " + onlineCount() + " online";
  }

  function memberRow(m){
    const ri = roleInfo(m), st = statusOf(m);
    return '<button class="g-mem" data-gx="profile" data-uid="' + esc(m.id) + '" data-n="' + esc(dispName(m.id).toLowerCase()) + '">' +
      '<span class="g-avw">' + avatar(m.id, dispName(m.id), 36) + '<i class="g-st ' + st + '"></i></span>' +
      '<span class="g-mem-t"><b style="color:' + esc(ri.color) + '">' + esc(dispName(m.id)) + (m.id === S.uid ? " (você)" : "") + "</b><small>" + esc((ri.icon || "") + " " + ri.name) + (isMuted(m) ? " · 🔇" : "") + "</small></span></button>";
  }

  /* ---------- seleção de canal ---------- */
  function selectChannel(cid, quiet){
    const ch = S.chans.find((c) => c.id === cid);
    if (!ch) return;
    S.cid = cid; S.unread[cid] = false;
    paintSideLight();
    qa("#gSide .g-ch[data-cid]").forEach((b) => b.classList.toggle("on", b.dataset.cid === cid));
    const el = $("gApp");
    if (!quiet) el.classList.add("pane-chat");
    if (ch.type === "voice"){
      if (window.GXVoice) GXVoice.open(ch);
    }else if (window.GXChat) GXChat.open(ch);
  }

  function paintHead(){ if (window.GXChat) GXChat.refreshHead(); }

  /* ---------- ações dos botões (data-gx) ---------- */
  function act(a, d, e){
    switch (a){
      case "exit": closeGroup(); if (history.state && history.state.g) history.back(); break;
      case "switch": if (d.gid !== S.gid) openGroup(d.gid); break;
      case "newgroup":
        sheet("Grupos", [
          { icon: "➕", label: "Criar grupo", run: createGroup },
          { icon: "🔎", label: "Descobrir grupos", run: () => { closeGroup(); S.tab = "find"; showView("groups"); } },
          { icon: "🔑", label: "Entrar com código", run: () => { closeGroup(); S.tab = "code"; showView("groups"); } }
        ]); break;
      case "chan": selectChannel(d.cid); break;
      case "members-open": $("gApp").classList.add("show-members"); history.pushState({ g: 1 }, ""); break;
      case "members-close": $("gApp").classList.remove("show-members"); break;
      case "back-side": $("gApp").classList.remove("pane-chat"); break;
      case "profile": if (window.GXAdmin) GXAdmin.profile(d.uid); break;
      case "gmenu": e.stopPropagation(); if (window.GXAdmin) GXAdmin.groupMenu(); break;
      case "ginfo": if (!e.target.closest("button") && window.GXAdmin) GXAdmin.info(); break;
      case "newch": if (window.GXAdmin) GXAdmin.newChannel(); break;
      case "events": if (window.GXAdmin) GXAdmin.events(); break;
      case "invite": if (window.GXAdmin) GXAdmin.invite(); break;
      case "mysettings": if (window.GXAdmin) GXAdmin.mySettings(); break;
    }
  }

  /* menu "..." de cada grupo na lista */
  function rowMenu(gid){
    const e = S.my.find((x) => x.gid === gid) || {};
    sheet((S.gcache[gid] && S.gcache[gid].g && S.gcache[gid].g.name) || e.name || "Grupo", [
      !e.pending && { icon: "📌", label: e.pinned ? "Desafixar do topo" : "Fixar no topo", run: guard(() => G().setMyEntry(gid, { pinned: !e.pinned })) },
      !e.pending && { icon: "⭐", label: e.fav ? "Tirar dos favoritos" : "Favoritar", run: guard(() => G().setMyEntry(gid, { fav: !e.fav })) },
      e.pending && { icon: "✖️", label: "Cancelar pedido", run: guard(() => G().cancelRequest(gid)) },
      !e.pending && { icon: "🚪", label: "Sair do grupo", danger: true, run: () => leaveGroup(gid) }
    ]);
  }

  const leaveGroup = guard(async (gid) => {
    const g = (S.gcache[gid] && S.gcache[gid].g) || await G().getGroup(gid);
    if (g && g.ownerId === S.uid){
      toast("Você é o dono. Passe o grupo para outra pessoa (Configurações > Membros) ou apague o grupo.");
      return;
    }
    if (!(await askConfirm("Sair do grupo " + ((g && g.name) || "") + "?", "Sair"))) return;
    try{ if (g){ const chans = await new Promise((res) => { const u = G().subscribeChannels(gid, (l) => { u(); res(l); }, () => res([])); });
      const first = chans.filter((c) => !c.private && c.type !== "voice" && c.type !== "info")[0];
      if (first) await G().sendMessage(gid, first.id, { type: "system", sys: "leave", text: "" }); } }catch(e){}
    await G().leave(gid);
    if (S.gid === gid) closeGroup();
    toast("Você saiu do grupo.");
  });

  /* cliques na aba */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("#gTabs .chip");
    if (t){ S.tab = t.dataset.gtab; render(); return; }
    const a = e.target.closest("[data-gact]");
    if (a && a.dataset.gact === "create"){ createGroup(); return; }
    const mn = e.target.closest("[data-gmenu]");
    if (mn){ e.stopPropagation(); rowMenu(mn.dataset.gmenu); return; }
    const op = e.target.closest("#gBody [data-open]");
    if (op){ openGroup(op.dataset.open); return; }
    const pk = e.target.closest("#gBody [data-peek]");
    if (pk){ peek(pk.dataset.peek); }
  });

  /* link de convite: https://seu-site/?join=CODIGO */
  /* abrir um grupo/canal (vindo de uma notificação push) */
  function openFromUrl(u){
    const m = /[?&]g=([A-Za-z0-9]+)/.exec(u || "");
    if (!m) return false;
    const c = /[?&]c=([A-Za-z0-9]+)/.exec(u);
    const tryIt = () => {
      if (ready()){ start(); showView("groups"); openGroup(m[1], c ? c[1] : undefined); }
      else setTimeout(tryIt, 1000);
    };
    tryIt();
    return true;
  }
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data && e.data.type === "open-url") openFromUrl(e.data.url);
  });

  function checkDeepLink(){
    if (/[?&]g=/.test(location.search)){ const u = location.search; history.replaceState(null, "", location.pathname); setTimeout(() => openFromUrl(u), 1500); return; }
    const m = /[?&]join=([A-Za-z0-9]+)/.exec(location.search);
    if (!m) return;
    const code = m[1];
    history.replaceState(null, "", location.pathname);
    const tryIt = () => {
      if (ready()){ showView("groups"); joinByCode(code); }
      else setTimeout(tryIt, 1200);
    };
    setTimeout(tryIt, 1500);
  }

  /* ---------- integração com o app (sem mexer no app.js) ---------- */
  function hook(){
    if (typeof showView !== "function" || hook.done) return;
    hook.done = true;
    const orig = showView;
    window.showView = showView = function (name, back){
      const r = orig.apply(this, arguments);
      if (name === "groups") render();
      return r;
    };
    window.addEventListener("nox-db-ready", () => setTimeout(() => { if (ready()) start(); }, 800));
    window.addEventListener("nox-g-ready", () => setTimeout(() => { if (ready()) start(); }, 800));
    setTimeout(() => { if (ready()) start(); }, 2500);
    checkDeepLink();
  }

  return { S, PERMS, ALL, CH_TYPES, defaultRoles, G, can, rank, outranks, isMuted, roleOf, roleInfo, canSee, statusOf, dispName,
    avatar, groupAvatar, loadPhotos, modal, sheet, formModal, pickImage, toast, errText, guard, prefs, setPref, applyTheme,
    openGroup, closeGroup, selectChannel, start, stop, render, hook, now, ms, q, qa, onlineCount, paintMembers, paintSide, beep, afterJoin, joinByCode, leaveGroup };
})();

window.GX = GX;
GX.hook();
