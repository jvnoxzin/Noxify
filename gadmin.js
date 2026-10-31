/* =========================================================
   NOXIFY — gadmin.js
   Administração dos grupos: perfil/moderação de membros, cargos,
   canais, convites, pedidos de entrada, banidos, registro, denúncias,
   filtros, eventos e configurações pessoais.
   Todas as ações são conferidas de novo pelo firestore.rules.
========================================================= */

const GXAdmin = (() => {

  const S = () => GX.S, G = () => GX.G(), q = (s, r) => GX.q(s, r), qa = (s, r) => GX.qa(s, r);
  const toast = (t) => GX.toast(t);
  const guard = GX.guard;
  const me = () => GX.dispName(S().uid);
  const ms = (t) => GX.ms(t);
  const fmtDate = (t) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  /* ---------- perfil de um membro ---------- */
  const profile = guard(async (uid) => {
    const m = S().members[uid];
    if (!m){ toast("Esse membro não está mais no grupo."); return; }
    const ri = GX.roleInfo(m), st = GX.statusOf(m);
    let u = null; try{ u = await window.NoxDB.getUser(uid); }catch(e){}
    const mine = uid === S().uid;
    const target = m;
    const above = GX.outranks(S().mem, target) && uid !== S().g.ownerId;

    const mod = GX.modal(GX.dispName(uid),
      '<div class="g-prof"><div class="g-prof-av">' + GX.avatar(uid, GX.dispName(uid), 84, u && u.photo) + '<i class="g-st big ' + st + '"></i></div>' +
      "<h3>" + esc(GX.dispName(uid)) + "</h3>" +
      (m.nick && u && u.name ? '<p class="g-muted">' + esc(u.name) + "</p>" : "") +
      '<span class="g-role" style="background:' + esc(ri.color) + '22;color:' + esc(ri.color) + '">' + esc((ri.icon || "") + " " + ri.name) + "</span>" +
      '<p class="g-muted">' + (st === "on" ? "🟢 Online" : st === "away" ? "🟡 Ausente" : "⚫ Offline") + " · entrou em " + (m.joinedAt ? new Date(ms(m.joinedAt)).toLocaleDateString("pt-BR") : "—") + "</p>" +
      (u && u.bio ? "<p>" + esc(u.bio) + "</p>" : "") +
      (GX.isMuted(m) ? '<p class="g-warn">🔇 Silenciado até ' + fmtDate(m.mutedUntil) + "</p>" : "") +
      ((m.warns || 0) ? '<p class="g-warn">⚠️ ' + m.warns + " advertência" + (m.warns > 1 ? "s" : "") + "</p>" : "") +
      '<div class="gs-list" id="gpActs"></div></div>');

    const acts = [];
    if (mine || (GX.can("manageMembers") && above)) acts.push({ icon: "✏️", label: "Alterar apelido no grupo", run: () => nickModal(uid) });
    if (!mine && GX.can("manageMembers") && above) acts.push({ icon: "🎖️", label: "Alterar cargo", run: () => roleModal(uid) });
    if (!mine && GX.can("ban") && above){
      acts.push({ icon: "🔇", label: GX.isMuted(m) ? "Tirar silêncio" : "Silenciar…", run: () => muteModal(uid) });
      acts.push({ icon: "⚠️", label: "Dar advertência", run: () => warn(uid) });
      if ((m.warns || 0)) acts.push({ icon: "🧹", label: "Zerar advertências", run: guard(() => G().patchMember(S().gid, uid, { warns: 0 })) });
      acts.push({ icon: "👢", label: "Expulsar do grupo", danger: true, run: () => kick(uid) });
      acts.push({ icon: "⛔", label: "Banir do grupo", danger: true, run: () => ban(uid) });
    }
    if (!mine && S().uid === S().g.ownerId) acts.push({ icon: "👑", label: "Transferir a posse do grupo", danger: true, run: () => transfer(uid) });
    if (!mine) acts.push({ icon: "🚩", label: "Denunciar usuário", run: () => reportUser(uid) });
    const box = q("#gpActs", mod);
    box.innerHTML = acts.map((a, i) => '<button class="gs-item' + (a.danger ? " danger" : "") + '" data-i="' + i + '"><span>' + a.icon + "</span>" + esc(a.label) + "</button>").join("");
    qa(".gs-item", box).forEach((b) => (b.onclick = () => { mod.close(); acts[+b.dataset.i].run(); }));
  });

  function nickModal(uid){
    GX.formModal("Apelido no grupo", [{ k: "n", l: "Apelido (vazio = nome normal)", max: 30, v: (S().members[uid] || {}).nick || "" }], "Salvar", async (v) => {
      await G().patchMember(S().gid, uid, { nick: v.n.trim().slice(0, 30) });
      if (uid !== S().uid) G().logAction(S().gid, { byName: me(), act: "nick", target: uid, targetName: GX.dispName(uid), note: v.n.slice(0, 30) }).catch(() => {});
    });
  }

  function roleModal(uid){
    const roles = S().g.roles, mineRank = GX.rank(S().mem), isOwner = S().uid === S().g.ownerId;
    const ids = Object.keys(roles).filter((r) => r !== "owner" && (isOwner || roles[r].order > mineRank)).sort((a, b) => roles[a].order - roles[b].order);
    GX.sheet("Cargo de " + GX.dispName(uid), ids.map((r) => ({ icon: roles[r].icon || "🎖️", label: roles[r].name + (S().members[uid].role === r ? "  ✓" : ""), run: guard(async () => {
      await G().patchMember(S().gid, uid, { role: r });
      G().logAction(S().gid, { byName: me(), act: "role", target: uid, targetName: GX.dispName(uid), note: roles[r].name }).catch(() => {});
      toast("Cargo alterado.");
    }) })));
  }

  function muteModal(uid){
    const set = guard(async (mins) => {
      const until = mins ? Date.now() + mins * 60000 : 0;
      await G().patchMember(S().gid, uid, { mutedUntil: until });
      G().logAction(S().gid, { byName: me(), act: mins ? "mute" : "unmute", target: uid, targetName: GX.dispName(uid), note: mins ? mins + " min" : "" }).catch(() => {});
      toast(mins ? "Silenciado." : "Silêncio removido.");
    });
    GX.sheet("Silenciar " + GX.dispName(uid), [
      { icon: "⏱️", label: "10 minutos", run: () => set(10) }, { icon: "⏱️", label: "1 hora", run: () => set(60) },
      { icon: "⏱️", label: "1 dia", run: () => set(1440) }, { icon: "⏱️", label: "7 dias", run: () => set(10080) },
      { icon: "🔊", label: "Tirar silêncio", run: () => set(0) }
    ]);
  }

  const warn = guard(async (uid) => {
    const n = ((S().members[uid] || {}).warns || 0) + 1;
    await G().patchMember(S().gid, uid, { warns: n });
    await G().logAction(S().gid, { byName: me(), act: "warn", target: uid, targetName: GX.dispName(uid), note: n + "ª advertência" });
    toast("Advertência registrada (" + n + ").");
    if (n >= 3 && (await askConfirm(GX.dispName(uid) + " já tem " + n + " advertências. Silenciar por 1 dia?", "Silenciar"))) await G().patchMember(S().gid, uid, { mutedUntil: Date.now() + 86400000 });
  });

  const kick = guard(async (uid) => {
    if (!(await askConfirm("Expulsar " + GX.dispName(uid) + " do grupo?", "Expulsar"))) return;
    await G().kick(S().gid, uid, me(), GX.dispName(uid)); toast("Membro expulso.");
  });

  function ban(uid){
    GX.formModal("Banir " + GX.dispName(uid), [{ k: "r", l: "Motivo (opcional)", max: 200 }], "Banir", async (v) => {
      await G().ban(S().gid, uid, v.r.trim(), me(), GX.dispName(uid)); toast("Membro banido.");
    });
  }

  const transfer = guard(async (uid) => {
    if (!(await askConfirm("Transferir a posse do grupo para " + GX.dispName(uid) + "? Você vira administrador.", "Transferir"))) return;
    await G().transferOwner(S().gid, uid, me(), GX.dispName(uid)); toast("Posse transferida.");
  });

  function reportUser(uid){
    GX.formModal("Denunciar " + GX.dispName(uid), [
      { k: "why", l: "Motivo", t: "select", v: "abuse", o: [["spam", "Spam"], ["abuse", "Ofensa / assédio"], ["nsfw", "Conteúdo impróprio"], ["other", "Outro"]] },
      { k: "note", l: "Detalhes (opcional)", t: "textarea", max: 300 }
    ], "Enviar denúncia", async (v) => {
      await G().report(S().gid, { kind: "user", target: uid, targetName: GX.dispName(uid), why: v.why, note: v.note.slice(0, 300), byName: me() });
      toast("Denúncia enviada para a moderação.");
    });
  }

  /* ---------- menu do grupo ---------- */
  function groupMenu(){
    const g = S().g; if (!g) return;
    const owner = S().uid === g.ownerId;
    GX.sheet(g.name, [
      { icon: "ℹ️", label: "Informações do grupo", run: info },
      GX.can("createInvite") && { icon: "🔗", label: "Convites", run: invite },
      GX.can("approveJoin") && { icon: "🙋", label: "Pedidos de entrada", run: requests },
      GX.can("manageGroup") && { icon: "⚙️", label: "Editar grupo", run: editGroup },
      GX.can("manageGroup") && { icon: "🛡️", label: "Filtros e proteção", run: filters },
      GX.can("manageRoles") && { icon: "🎖️", label: "Cargos e permissões", run: rolesList },
      GX.can("ban") && { icon: "⛔", label: "Banidos", run: bans },
      GX.can("viewLog") && { icon: "📜", label: "Registro de ações", run: log },
      GX.can("viewLog") && { icon: "🚩", label: "Denúncias", run: reports },
      { icon: "🔔", label: "Minhas configurações", run: mySettings },
      !owner && { icon: "🚪", label: "Sair do grupo", danger: true, run: () => GX.leaveGroup(g.id) },
      owner && { icon: "🗑️", label: "Apagar grupo", danger: true, run: delGroup }
    ]);
  }

  const delGroup = guard(async () => {
    const g = S().g;
    if (!(await askConfirm("Apagar o grupo \"" + g.name + "\" para todos? Isso não pode ser desfeito.", "Apagar"))) return;
    await G().deleteGroup(g.id);
    toast("Grupo apagado.");
  });

  function info(){
    const g = S().g; if (!g) return;
    const ok = typeof SAFE_IMG !== "undefined" && SAFE_IMG.test(g.banner || "");
    GX.modal(g.name, '<div class="g-ginfo">' + (ok ? '<div class="g-banner" style="background-image:url(\'' + g.banner + '\')"></div>' : "") +
      '<div class="g-ginfo-h">' + GX.groupAvatar(g, 64) + "<div><h3>" + esc(g.name) + "</h3><small>" + (g.vis === "private" ? "🔒 Privado" : "🌐 Público") + " · " + (g.memberCount || 0) + " / " + g.maxMembers + " membros · " + GX.onlineCount() + " online</small></div></div>" +
      (g.desc ? "<p>" + esc(g.desc) + "</p>" : "") + (g.rules ? "<h4>📜 Regras</h4><p>" + esc(g.rules).replace(/\n/g, "<br>") + "</p>" : "") +
      "<p class='g-muted'>Dono: " + esc(GX.dispName(g.ownerId)) + " · criado em " + (g.createdAt ? new Date(ms(g.createdAt)).toLocaleDateString("pt-BR") : "—") + "</p></div>");
  }

  /* ---------- editar grupo ---------- */
  function editGroup(){
    const g = S().g, d = { photo: g.photo || "", banner: g.banner || "" };
    const m = GX.modal("Editar grupo",
      '<div class="g-create-pics"><button class="g-pic" id="egPhoto">📷<small>Foto</small></button><button class="g-pic wide" id="egBanner">🖼️<small>Banner</small></button></div>' +
      '<label class="gf"><span>Nome</span><input id="egName" maxlength="40" value="' + esc(g.name) + '"></label>' +
      '<label class="gf"><span>Descrição</span><textarea id="egDesc" rows="2" maxlength="300">' + esc(g.desc || "") + "</textarea></label>" +
      '<label class="gf"><span>Regras</span><textarea id="egRules" rows="4" maxlength="1500">' + esc(g.rules || "") + "</textarea></label>" +
      '<label class="gf"><span>Mensagem de boas-vindas (use {nome})</span><textarea id="egWel" rows="2" maxlength="300">' + esc(g.welcome || "") + "</textarea></label>" +
      '<label class="gf"><span>Tipo</span><select id="egVis"><option value="public"' + (g.vis === "public" ? " selected" : "") + '>Público</option><option value="private"' + (g.vis === "private" ? " selected" : "") + ">Privado</option></select></label>" +
      '<label class="gf chk"><input type="checkbox" id="egAppr"' + (g.approval ? " checked" : "") + "><span>Aprovar quem pedir para entrar</span></label>" +
      '<label class="gf"><span>Limite de participantes</span><input id="egMax" type="number" min="2" max="5000" value="' + g.maxMembers + '"></label>' +
      '<button class="g-btn primary full" id="egOk">Salvar</button>');
    const paint = () => {
      q("#egPhoto", m).style.background = d.photo ? photoCss(d.photo) : ""; q("#egPhoto", m).firstChild.textContent = d.photo ? "" : "📷";
      q("#egBanner", m).style.background = d.banner ? photoCss(d.banner) : ""; q("#egBanner", m).firstChild.textContent = d.banner ? "" : "🖼️";
    };
    paint();
    q("#egPhoto", m).onclick = async () => { const x = await GX.pickImage(256, 256, 0.82); if (x){ d.photo = x; paint(); } };
    q("#egBanner", m).onclick = async () => { const x = await GX.pickImage(900, 300, 0.78); if (x){ d.banner = x; paint(); } };
    q("#egOk", m).onclick = async () => {
      const name = q("#egName", m).value.trim();
      if (name.length < 2){ toast("Nome muito curto."); return; }
      const max = Math.min(5000, Math.max(2, parseInt(q("#egMax", m).value, 10) || 500));
      if (max < (g.memberCount || 0)){ toast("O limite não pode ser menor que o número de membros (" + g.memberCount + ")."); return; }
      try{
        await G().updateGroup(g.id, { name, desc: q("#egDesc", m).value.trim(), rules: q("#egRules", m).value.trim(), welcome: q("#egWel", m).value.trim(), vis: q("#egVis", m).value, approval: q("#egAppr", m).checked, maxMembers: max, photo: d.photo, banner: d.banner });
        G().logAction(g.id, { byName: me(), act: "editgroup" }).catch(() => {});
        m.close(); toast("Grupo atualizado.");
      }catch(e){ toast(GX.errText(e)); }
    };
  }

  /* ---------- filtros ---------- */
  function filters(){
    const f = S().g.filters || {};
    GX.formModal("Filtros e proteção", [
      { k: "words", l: "Palavras bloqueadas (separe por vírgula)", t: "textarea", rows: 3, max: 600, v: (f.words || []).join(", ") },
      { k: "links", l: "Links nas mensagens", t: "select", v: f.links || "allow", o: [["allow", "Permitidos"], ["mods", "Só a equipe pode enviar"], ["block", "Bloqueados para todos (exceto equipe)"]] },
      { k: "flood", l: "Proteção contra spam (limite de 5 mensagens a cada 8 s)", t: "check", v: f.flood !== false }
    ], "Salvar", async (v) => {
      const words = v.words.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 60);
      await G().updateGroup(S().gid, { filters: { words, links: v.links, flood: !!v.flood } });
      toast("Filtros salvos. (Valem para quem usa o app atualizado.)");
    });
  }

  /* ---------- cargos ---------- */
  function rolesList(){
    const roles = S().g.roles;
    const ids = Object.keys(roles).sort((a, b) => roles[a].order - roles[b].order);
    const m = GX.modal("Cargos", '<p class="g-muted">Quanto menor a posição, mais alto o cargo. Cargos mais altos podem moderar os mais baixos.</p><div class="gs-list">' + ids.map((r) =>
      '<button class="gs-item" data-r="' + esc(r) + '"><span>' + esc(roles[r].icon || "🎖️") + '</span><b style="color:' + esc(roles[r].color) + '">' + esc(roles[r].name) + "</b>&nbsp;<small>#" + roles[r].order + "</small></button>").join("") +
      '</div><button class="g-btn primary full" id="rlNew">' + iconHtml("plus") + " Novo cargo</button>");
    qa("[data-r]", m).forEach((b) => (b.onclick = () => { m.close(); roleEdit(b.dataset.r); }));
    q("#rlNew", m).onclick = () => { m.close(); roleEdit(null); };
  }

  function roleEdit(id){
    const roles = JSON.parse(JSON.stringify(S().g.roles));
    const isNew = !id;
    const r = isNew ? { name: "Novo cargo", color: "#38bdf8", icon: "🎖️", order: 4, perms: { sendMsg: true, sendMedia: true } } : roles[id];
    const locked = id === "owner";
    const m = GX.modal(isNew ? "Novo cargo" : r.name,
      '<label class="gf"><span>Nome</span><input id="reN" maxlength="24" value="' + esc(r.name) + '"' + (locked ? " disabled" : "") + "></label>" +
      '<div class="g-two"><label class="gf"><span>Cor</span><input id="reC" type="color" value="' + esc(r.color) + '"></label>' +
      '<label class="gf"><span>Ícone (emoji)</span><input id="reI" maxlength="4" value="' + esc(r.icon || "") + '"></label></div>' +
      '<label class="gf"><span>Posição na hierarquia (1 = mais alto)</span><input id="reO" type="number" min="1" max="50" value="' + r.order + '"' + (locked ? " disabled" : "") + "></label>" +
      '<div class="g-ch-title">Permissões</div>' +
      GX.ALL.map((p) => '<label class="gf chk"><input type="checkbox" data-p="' + p + '"' + (r.perms && r.perms[p] ? " checked" : "") + (locked ? " disabled" : "") + "><span>" + esc(GX.PERMS[p]) + "</span></label>").join("") +
      (locked ? '<p class="g-muted">O dono sempre tem todas as permissões.</p>' : '<button class="g-btn primary full" id="reOk">Salvar</button>') +
      (!isNew && !["owner", "member"].includes(id) ? '<button class="g-btn danger full" id="reDel">Apagar cargo</button>' : ""));
    const ok = q("#reOk", m);
    if (ok) ok.onclick = async () => {
      const name = q("#reN", m).value.trim();
      if (!name){ toast("Dê um nome ao cargo."); return; }
      const perms = {}; qa("[data-p]", m).forEach((c) => { if (c.checked) perms[c.dataset.p] = true; });
      const nr = { name: name.slice(0, 24), color: q("#reC", m).value, icon: q("#reI", m).value.trim().slice(0, 4), order: Math.max(1, Math.min(50, parseInt(q("#reO", m).value, 10) || 4)), perms };
      const key = isNew ? "r" + Date.now().toString(36) : id;
      if (!isNew && S().uid !== S().g.ownerId && id !== "member" && nr.order <= GX.rank(S().mem)){ toast("Você não pode colocar um cargo acima ou igual ao seu."); return; }
      roles[key] = nr;
      try{ await G().saveRoles(S().gid, roles); G().logAction(S().gid, { byName: me(), act: "roles", note: nr.name }).catch(() => {}); m.close(); toast("Cargo salvo."); }
      catch(e){ toast(GX.errText(e)); }
    };
    const del = q("#reDel", m);
    if (del) del.onclick = async () => {
      if (!(await askConfirm("Apagar o cargo " + r.name + "? Quem tem esse cargo vira Membro.", "Apagar"))) return;
      try{
        const holders = Object.values(S().members).filter((x) => x.role === id);
        for (const h of holders) await G().patchMember(S().gid, h.id, { role: "member" });
        delete roles[id];
        await G().saveRoles(S().gid, roles); m.close(); toast("Cargo apagado.");
      }catch(e){ toast(GX.errText(e)); }
    };
  }

  /* ---------- pedidos de entrada ---------- */
  function requests(){
    const m = GX.modal("Pedidos de entrada", '<div id="rqBody"><p class="g-muted">Carregando…</p></div>');
    const un = G().subscribeRequests(S().gid, (list) => {
      const b = q("#rqBody", m); if (!b) return;
      b.innerHTML = list.length ? list.map((r) => '<div class="g-req"><div>' + GX.avatar(r.id, r.name, 36) + "<b>" + esc(r.name || "Usuário") + "</b></div>" +
        '<div><button class="g-btn primary sm" data-ok="' + esc(r.id) + '">Aprovar</button><button class="g-btn sm" data-no="' + esc(r.id) + '">Recusar</button></div></div>').join("") : '<p class="g-muted">Nenhum pedido pendente.</p>';
      qa("[data-ok]", b).forEach((x) => (x.onclick = guard(async () => { x.disabled = true; await G().approve(S().gid, list.find((r) => r.id === x.dataset.ok), me()); toast("Aprovado."); })));
      qa("[data-no]", b).forEach((x) => (x.onclick = guard(async () => { x.disabled = true; await G().declineRequest(S().gid, list.find((r) => r.id === x.dataset.no), me()); })));
    }, (e) => { const b = q("#rqBody", m); if (b) b.innerHTML = '<p class="g-muted">' + esc(GX.errText(e)) + "</p>"; });
    const obs = new MutationObserver(() => { if (!document.body.contains(m)){ un(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
  }

  /* ---------- banidos / registro / denúncias ---------- */
  const bans = guard(async () => {
    const list = await G().listBans(S().gid);
    const m = GX.modal("Banidos", list.length ? list.map((b) => '<div class="g-req"><div><b>' + esc(b.name || b.id) + "</b><small>" + esc(b.reason || "sem motivo") + '</small></div><button class="g-btn sm" data-un="' + esc(b.id) + '">Desbanir</button></div>').join("") : '<p class="g-muted">Ninguém banido.</p>');
    qa("[data-un]", m).forEach((x) => (x.onclick = guard(async () => { const b = list.find((y) => y.id === x.dataset.un); await G().unban(S().gid, b.id, me(), b.name || ""); x.closest(".g-req").remove(); toast("Desbanido."); })));
  });

  const ACT = { kick: "expulsou", ban: "baniu", unban: "desbaniu", mute: "silenciou", unmute: "tirou o silêncio de", warn: "advertiu", role: "mudou o cargo de", nick: "mudou o apelido de", approve: "aprovou a entrada de", decline: "recusou a entrada de", delmsg: "apagou mensagem de", editgroup: "editou o grupo", roles: "editou o cargo", transfer: "passou a posse para", chan: "mexeu no canal" };
  const log = guard(async () => {
    const list = await G().listLog(S().gid, 80);
    GX.modal("Registro de ações", list.length ? '<div class="g-log">' + list.map((l) => "<div><small>" + fmtDate(ms(l.at) || Date.now()) + "</small> <b>" + esc(l.byName || "?") + "</b> " + esc(ACT[l.act] || l.act) + (l.targetName ? " <b>" + esc(l.targetName) + "</b>" : "") + (l.note ? " — " + esc(l.note) : "") + "</div>").join("") + "</div>" : '<p class="g-muted">Nada registrado ainda.</p>', { wide: true });
  });

  const reports = guard(async () => {
    const list = await G().listReports(S().gid);
    const m = GX.modal("Denúncias", list.length ? list.map((r) => '<div class="g-rep' + (r.status === "closed" ? " closed" : "") + '"><b>' + (r.kind === "msg" ? "Mensagem de " : "Usuário ") + esc(r.targetName || "") + "</b><small>por " + esc(r.byName || "?") + " · " + esc(r.why || "") + " · " + fmtDate(ms(r.at) || Date.now()) + "</small>" +
      (r.preview ? "<p>“" + esc(r.preview) + "”</p>" : "") + (r.note ? "<p>" + esc(r.note) + "</p>" : "") +
      (r.status === "closed" ? "<small>✔ resolvida</small>" : '<button class="g-btn sm" data-cl="' + esc(r.id) + '">Marcar como resolvida</button>') + "</div>").join("") : '<p class="g-muted">Nenhuma denúncia.</p>', { wide: true });
    qa("[data-cl]", m).forEach((x) => (x.onclick = guard(async () => { await G().closeReport(S().gid, x.dataset.cl); x.closest(".g-rep").classList.add("closed"); x.remove(); })));
  });

  /* ---------- convites ---------- */
  function linkFor(code){ return location.origin + location.pathname.replace(/[^/]*$/, "") + "?join=" + code; }

  const invite = guard(async () => {
    const g = S().g;
    const paint = async (m) => {
      const list = await G().listInvites(g.id);
      const b = q("#ivBody", m);
      b.innerHTML = list.map((i) => '<div class="g-inv"><div><b>' + esc(i.code) + "</b><small>" + (i.uses || 0) + (i.max ? "/" + i.max : "") + " usos · " + (i.exp ? "expira " + fmtDate(i.exp) : "sem validade") + '</small></div>' +
        '<div><button class="g-btn sm" data-cp="' + esc(i.code) + '">Copiar link</button><button class="g-btn sm" data-cc="' + esc(i.code) + '">Código</button>' +
        '<button class="g-btn sm" data-ct="' + esc(i.code) + '">Enviar</button>' +
        (GX.can("manageGroup") || i.by === S().uid ? '<button class="g-btn sm danger" data-rm="' + esc(i.code) + '">✕</button>' : "") + "</div></div>").join("") || '<p class="g-muted">Nenhum convite.</p>';
      qa("[data-cp]", b).forEach((x) => (x.onclick = () => share(linkFor(x.dataset.cp), g.name)));
      qa("[data-ct]", b).forEach((x) => (x.onclick = () => sendToContact(x.dataset.ct)));
      qa("[data-cc]", b).forEach((x) => (x.onclick = () => copy(x.dataset.cc, "Código copiado!")));
      qa("[data-rm]", b).forEach((x) => (x.onclick = guard(async () => { await G().deleteInvite(g.id, x.dataset.rm); paint(m); })));
    };
    const m = GX.modal("Convidar para " + g.name,
      '<div id="ivBody"><p class="g-muted">Carregando…</p></div><div class="g-ch-title">Novo convite</div>' +
      '<div class="g-two"><label class="gf"><span>Validade</span><select id="ivH"><option value="0">Sem validade</option><option value="1">1 hora</option><option value="24">1 dia</option><option value="168">7 dias</option></select></label>' +
      '<label class="gf"><span>Máx. de usos</span><input id="ivM" type="number" min="0" max="1000" value="0"></label></div>' +
      '<button class="g-btn primary full" id="ivNew">Criar convite</button>');
    q("#ivNew", m).onclick = guard(async () => {
      const code = await G().createInvite(g, { hours: +q("#ivH", m).value, max: Math.max(0, parseInt(q("#ivM", m).value, 10) || 0) });
      toast("Convite criado: " + code); paint(m);
    });
    paint(m);
  });

  /* manda o convite numa conversa direta (quem recebe ganha a notificação normal de mensagem) */
  async function sendToContact(code){
    const g = S().g, dm = [];
    try{
      await new Promise((res) => {
        const u = window.NoxDB.subscribeChats(S().uid, (l) => { u(); dm.push(...l.filter((c) => c.members.length === 2).slice(0, 20)); res(); }, () => res());
      });
    }catch(e){}
    if (!dm.length){ toast("Você ainda não tem conversas. Use 'Copiar link'."); return; }
    const m = GX.modal("Enviar convite para…", '<div class="gs-list">' + dm.map((c) => '<button class="gs-item" data-dm="' + esc(c.id) + '" data-o="' + esc(c.members.find((x) => x !== S().uid)) + '">…</button>').join("") + "</div>");
    qa("[data-dm]", m).forEach(async (b) => { try{ const u = await window.NoxDB.getUser(b.dataset.o); b.textContent = "👤 " + ((u && u.name) || "Usuário"); }catch(e){ b.textContent = "👤 Usuário"; } });
    qa("[data-dm]", m).forEach((b) => (b.onclick = guard(async () => {
      m.close();
      await window.NoxDB.sendMessage(b.dataset.dm, [S().uid, b.dataset.o].sort(), S().uid, ("🎉 Convite para o grupo " + g.name + ": " + linkFor(code)).slice(0, 500));
      toast("Convite enviado!");
    })));
  }

  function copy(t, msg){ try{ navigator.clipboard.writeText(t); toast(msg || "Copiado!"); }catch(e){ prompt("Copie:", t); } }
  function share(url, name){
    if (navigator.share){ navigator.share({ title: "Grupo " + name + " no Noxify", text: "Entre no meu grupo no Noxify!", url }).catch(() => {}); }
    else copy(url, "Link copiado!");
  }

  /* ---------- canais ---------- */
  function newChannel(){
    GX.formModal("Novo canal", [
      { k: "n", l: "Nome", max: 30, ph: "ex.: memes" },
      { k: "t", l: "Tipo", t: "select", v: "text", o: Object.keys(GX.CH_TYPES).map((k) => [k, GX.CH_TYPES[k].icon + " " + GX.CH_TYPES[k].label]) },
      { k: "d", l: "Descrição", max: 100 },
      { k: "p", l: "Canal privado (só cargos/pessoas escolhidos)", t: "check" },
      { k: "tmp", l: "Duração", t: "select", v: "0", o: [["0", "Permanente"], ["1", "Temporário: 1 hora"], ["6", "Temporário: 6 horas"], ["24", "Temporário: 24 horas"]] }
    ], "Criar canal", async (v) => {
      const name = v.n.trim().toLowerCase().replace(/\s+/g, v.t === "voice" ? " " : "-");
      if (!name){ toast("Dê um nome ao canal."); return false; }
      if (S().chans.length >= 40){ toast("Limite de 40 canais."); return false; }
      const hrs = +v.tmp;
      const id = await G().createChannel(S().gid, { name, type: v.t, topic: v.d.trim(), private: v.p, roles: v.p ? ["admin", "mod"] : [], order: S().chans.length, temp: hrs > 0, expiresAt: hrs ? Date.now() + hrs * 3600000 : 0 });
      G().logAction(S().gid, { byName: me(), act: "chan", note: "criou #" + name }).catch(() => {});
      toast("Canal criado.");
      if (v.p) setTimeout(() => channelSettings(S().chans.find((c) => c.id === id) || { id, name, roles: ["admin", "mod"], private: true, type: v.t }), 600);
    });
  }

  function channelMenu(ch){
    if (!ch) return;
    const mem = S().mem, muted = mem.chMute && mem.chMute[ch.id];
    GX.sheet("#" + ch.name, [
      { icon: muted ? "🔔" : "🔕", label: muted ? "Reativar notificações do canal" : "Silenciar canal", run: guard(() => G().patchMember(S().gid, S().uid, { chMute: { [ch.id]: !muted } })) },
      { icon: "✅", label: "Marcar como lido", run: guard(async () => { const last = S().lastBy[ch.id] || Date.now(); await G().patchMember(S().gid, S().uid, { reads: { [ch.id]: last } }); }) },
      GX.can("manageChannels") && { icon: "⚙️", label: "Configurações do canal", run: () => channelSettings(ch) }
    ]);
  }

  function channelSettings(ch){
    const roles = S().g.roles, rids = Object.keys(roles).filter((r) => r !== "owner").sort((a, b) => roles[a].order - roles[b].order);
    const mems = Object.values(S().members).filter((m) => m.id !== S().g.ownerId).slice(0, 80);
    const m = GX.modal("Canal #" + ch.name,
      '<label class="gf"><span>Nome</span><input id="chN" maxlength="30" value="' + esc(ch.name) + '"></label>' +
      '<label class="gf"><span>Descrição</span><input id="chD" maxlength="100" value="' + esc(ch.topic || "") + '"></label>' +
      '<label class="gf"><span>Modo lento (segundos entre mensagens, 0 = desligado)</span><input id="chS" type="number" min="0" max="3600" value="' + (ch.slow || 0) + '"></label>' +
      '<label class="gf chk"><input type="checkbox" id="chP"' + (ch.private ? " checked" : "") + "><span>🔒 Canal privado</span></label>" +
      '<div id="chAcc"' + (ch.private ? "" : " hidden") + '><div class="g-ch-title">Cargos com acesso</div>' +
      rids.map((r) => '<label class="gf chk"><input type="checkbox" data-r="' + esc(r) + '"' + ((ch.roles || []).includes(r) ? " checked" : "") + "><span>" + esc((roles[r].icon || "") + " " + roles[r].name) + "</span></label>").join("") +
      '<div class="g-ch-title">Pessoas com acesso</div>' +
      mems.map((u) => '<label class="gf chk"><input type="checkbox" data-u="' + esc(u.id) + '"' + ((ch.users || []).includes(u.id) ? " checked" : "") + "><span>" + esc(GX.dispName(u.id)) + "</span></label>").join("") + "</div>" +
      '<button class="g-btn primary full" id="chOk">Salvar</button><button class="g-btn danger full" id="chDel">Apagar canal</button>');
    q("#chP", m).onchange = (e) => (q("#chAcc", m).hidden = !e.target.checked);
    q("#chOk", m).onclick = guard(async () => {
      const name = q("#chN", m).value.trim().toLowerCase().replace(/\s+/g, ch.type === "voice" ? " " : "-");
      if (!name){ toast("Nome inválido."); return; }
      await G().updateChannel(S().gid, ch.id, {
        name, topic: q("#chD", m).value.trim(), slow: Math.max(0, Math.min(3600, parseInt(q("#chS", m).value, 10) || 0)),
        private: q("#chP", m).checked, roles: qa("[data-r]:checked", m).map((x) => x.dataset.r), users: qa("[data-u]:checked", m).map((x) => x.dataset.u)
      });
      m.close(); toast("Canal salvo.");
    });
    q("#chDel", m).onclick = guard(async () => {
      if (!(await askConfirm("Apagar o canal #" + ch.name + "? As mensagens deixam de aparecer.", "Apagar"))) return;
      await G().deleteChannel(S().gid, ch.id); G().logAction(S().gid, { byName: me(), act: "chan", note: "apagou #" + ch.name }).catch(() => {});
      m.close(); toast("Canal apagado.");
    });
  }

  /* ---------- eventos ---------- */
  function events(){
    const g = S().g;
    const m = GX.modal("📅 Eventos do grupo", '<div id="evBody"><p class="g-muted">Carregando…</p></div>' + (GX.can("manageEvents") ? '<button class="g-btn primary full" id="evNew">' + iconHtml("plus") + " Novo evento</button>" : ""));
    const un = G().subscribeEvents(g.id, (list) => {
      const b = q("#evBody", m); if (!b) return;
      list.sort((a, c) => a.at - c.at);
      const up = list.filter((e) => e.at > Date.now() - 3600000), past = list.filter((e) => e.at <= Date.now() - 3600000);
      const card = (e) => '<div class="g-ev"><div class="g-ev-d"><b>' + new Date(e.at).getDate() + "</b><small>" + new Date(e.at).toLocaleDateString("pt-BR", { month: "short" }) + '</small></div><div class="g-ev-t"><b>' + esc(e.title) + "</b><small>" + fmtDate(e.at) + " · " + Object.keys(e.going || {}).length + " vão</small>" + (e.desc ? "<p>" + esc(e.desc) + "</p>" : "") + "</div>" +
        '<div class="g-ev-a"><button class="g-btn sm' + (!!(e.going || {})[S().uid] ? " primary" : "") + '" data-go="' + esc(e.id) + '">' + (!!(e.going || {})[S().uid] ? "✓ Vou" : "Vou") + "</button>" +
        (GX.can("manageEvents") ? '<button class="g-btn sm danger" data-ed="' + esc(e.id) + '">✕</button>' : "") + "</div></div>";
      b.innerHTML = (up.length ? up.map(card).join("") : '<p class="g-muted">Nenhum evento marcado.</p>') + (past.length ? '<div class="g-ch-title">Anteriores</div>' + past.slice(-5).map(card).join("") : "");
      qa("[data-go]", b).forEach((x) => (x.onclick = guard(async () => { const e = list.find((y) => y.id === x.dataset.go); await G().rsvp(g.id, e.id, !!!(e.going || {})[S().uid]); })));
      qa("[data-ed]", b).forEach((x) => (x.onclick = guard(async () => { if (await askConfirm("Apagar este evento?", "Apagar")) await G().deleteEvent(g.id, x.dataset.ed); })));
    }, (e) => { const b = q("#evBody", m); if (b) b.innerHTML = '<p class="g-muted">' + esc(GX.errText(e)) + "</p>"; });
    const obs = new MutationObserver(() => { if (!document.body.contains(m)){ un(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
    const nb = q("#evNew", m);
    if (nb) nb.onclick = () => GX.formModal("Novo evento", [
      { k: "t", l: "Título", max: 60 }, { k: "w", l: "Data e hora", t: "datetime-local" }, { k: "d", l: "Descrição", t: "textarea", max: 300 }
    ], "Criar evento", async (v) => {
      const at = new Date(v.w).getTime();
      if (!v.t.trim() || !at){ toast("Preencha título e data."); return false; }
      await G().createEvent(g.id, { title: v.t.trim(), desc: v.d.trim(), at });
      toast("Evento criado.");
    });
  }

  /* ---------- minhas configurações no grupo ---------- */
  function mySettings(){
    const mem = S().mem, p = GX.prefs(), g = S().g;
    const entry = S().my.find((e) => e.gid === g.id) || {};
    const m = GX.modal("Minhas configurações",
      '<label class="gf"><span>Meu apelido neste grupo</span><input id="msN" maxlength="30" value="' + esc(mem.nick || "") + '" placeholder="' + esc(mem.name || "") + '"></label>' +
      '<div class="g-ch-title">Notificações deste grupo</div>' +
      '<label class="gf chk"><input type="checkbox" id="msMute"' + (mem.muted ? " checked" : "") + "><span>🔕 Silenciar o grupo todo</span></label>" +
      '<label class="gf chk"><input type="checkbox" id="msMen"' + (mem.mentionsOnly ? " checked" : "") + "><span>@ Avisar só quando me mencionarem</span></label>" +
      '<label class="gf chk"><input type="checkbox" id="msFav"' + (entry.fav ? " checked" : "") + "><span>⭐ Favoritar grupo</span></label>" +
      '<label class="gf chk"><input type="checkbox" id="msPin"' + (entry.pinned ? " checked" : "") + "><span>📌 Fixar no topo da lista</span></label>" +
      '<div class="g-ch-title">Neste aparelho</div>' +
      '<label class="gf chk"><input type="checkbox" id="msSnd"' + (p.sound ? " checked" : "") + "><span>🔊 Som de nova mensagem</span></label>" +
      '<label class="gf chk"><input type="checkbox" id="msVis"' + (p.visual ? " checked" : "") + "><span>💬 Aviso visual de nova mensagem</span></label>" +
      '<label class="gf"><span>Tema dos grupos</span><select id="msTheme"><option value="auto">Automático</option><option value="dark">Escuro</option><option value="light">Claro</option></select></label>' +
      '<p class="g-muted">As notificações com o app fechado (push) usam as opções de silenciar acima e precisam estar ativadas em Configurações.</p>' +
      '<button class="g-btn primary full" id="msOk">Salvar</button>');
    q("#msTheme", m).value = p.theme;
    q("#msOk", m).onclick = guard(async () => {
      await G().patchMember(S().gid, S().uid, { nick: q("#msN", m).value.trim().slice(0, 30), muted: q("#msMute", m).checked, mentionsOnly: q("#msMen", m).checked });
      await G().setMyEntry(S().gid, { fav: q("#msFav", m).checked, pinned: q("#msPin", m).checked });
      GX.setPref("sound", q("#msSnd", m).checked); GX.setPref("visual", q("#msVis", m).checked); GX.setPref("theme", q("#msTheme", m).value);
      m.close(); toast("Salvo.");
    });
  }

  return { profile, groupMenu, info, newChannel, events, invite, mySettings, channelMenu, channelSettings, requests, rolesList };
})();

window.GXAdmin = GXAdmin;
