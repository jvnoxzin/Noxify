/* =========================================================
   NOXIFY — gdb.js
   Dados dos GRUPOS (Firestore). Só acesso a dados: nenhuma tela aqui.
   A segurança de verdade (quem pode ler/escrever o quê) está no
   firestore.rules; as telas (groups.js) só escondem o que não é permitido.

   Estrutura:
     groups/{gid}                       dados do grupo + cargos (roles)
     groups/{gid}/members/{uid}         membros (cargo, apelido, silenciado...)
     groups/{gid}/channels/{cid}        canais
     groups/{gid}/channels/{cid}/messages/{mid}     mensagens
     groups/{gid}/channels/{cid}/messages/{mid}/votes/{uid}   votos de enquete
     groups/{gid}/channels/{cid}/typing/{uid}       "digitando…"
     groups/{gid}/channels/{cid}/vp/{uid}           quem está na sala de voz
     groups/{gid}/channels/{cid}/vsig/{id}          sinais das salas de voz
     groups/{gid}/requests/{uid}        pedidos de entrada
     groups/{gid}/bans/{uid}            banidos
     groups/{gid}/reports/{id}          denúncias
     groups/{gid}/modlog/{id}           registro de ações
     groups/{gid}/events/{id}           eventos
     groups/{gid}/invites/{code}        convites (cópia para a lista do painel)
     invites/{code}                     convite (para entrar pelo código)
     users/{uid}/groups/{gid}           "meus grupos" (lista pessoal)
========================================================= */

import { getApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore, doc, collection, setDoc, getDoc, getDocs, deleteDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
  writeBatch, increment, arrayUnion, arrayRemove, deleteField
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const db = getFirestore(getApp());

const uid = () => (window.auth && window.auth.currentUser) ? window.auth.currentUser.uid : (localStorage.getItem("noxUid") || null);
const ms = (t) => (t && t.toMillis ? t.toMillis() : (typeof t === "number" ? t : Date.now()));

const gref = (gid) => doc(db, "groups", gid);
const mref = (gid, u) => doc(db, "groups", gid, "members", u);
const cref = (gid, cid) => doc(db, "groups", gid, "channels", cid);
const msgs = (gid, cid) => collection(db, "groups", gid, "channels", cid, "messages");
const newId = (...p) => doc(collection(db, ...p)).id;

/* código de convite: 8 letras/números, sem caracteres que se confundem */
function newCode(){
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(r, (x) => a[x % a.length]).join("");
}

const sortLimit = (q, n) => (n ? [q, limit(n)] : [q]);

/* converte um documento em objeto simples */
const plain = (d) => {
  const x = d.data({ serverTimestamps: "estimate" });
  return Object.assign({ id: d.id }, x);
};

const strip = (o) => {            // tira undefined (o Firestore não aceita)
  const out = {};
  for (const k in o) if (o[k] !== undefined) out[k] = o[k];
  return out;
};

window.NoxG = {

  uid, newId, newCode,

  /* ---------- meus grupos ---------- */
  subscribeMyGroups(cb, err){
    return onSnapshot(collection(db, "users", uid(), "groups"),
      (s) => cb(s.docs.map(plain)), err);
  },

  async myMembership(gid, u){
    const s = await getDoc(mref(gid, u || uid()));
    return s.exists() ? plain(s) : null;
  },

  async dropMyEntry(gid){ await deleteDoc(doc(db, "users", uid(), "groups", gid)); },

  async setMyEntry(gid, patch){
    await setDoc(doc(db, "users", uid(), "groups", gid), patch, { merge: true });
  },

  /* ---------- criar ---------- */
  async createGroup(g, roles, channels, myName){
    const me = uid();
    const gid = newId("groups");
    const code = newCode();
    const b = writeBatch(db);

    b.set(gref(gid), strip({
      name: g.name, nameLower: g.name.toLowerCase(), desc: g.desc || "", rules: g.rules || "",
      welcome: g.welcome || "", photo: g.photo || "", banner: g.banner || "",
      vis: g.vis === "private" ? "private" : "public", approval: !!g.approval,
      ownerId: me, memberCount: 1, maxMembers: Math.min(5000, Math.max(2, g.maxMembers || 500)),
      createdAt: serverTimestamp(), roles,
      filters: { words: [], links: "allow", flood: true }
    }));

    b.set(mref(gid, me), {
      role: "owner", nick: "", name: myName, joinedAt: serverTimestamp(), lastSeen: serverTimestamp(),
      st: "online", mutedUntil: 0, warns: 0, muted: false, mentionsOnly: false, fav: false, pinned: false
    });

    channels.forEach((c, i) => {
      b.set(cref(gid, newId("groups", gid, "channels")), strip({
        name: c.name, type: c.type, topic: c.topic || "", private: false, roles: [],
        order: i, createdBy: me, createdAt: serverTimestamp()
      }));
    });

    b.set(doc(db, "users", me, "groups", gid), { gid, name: g.name, photo: g.photo ? "1" : "", joinedAt: Date.now() });

    /* convite principal */
    b.set(doc(db, "invites", code), { gid, by: me, name: g.name, photo: g.photo || "", desc: (g.desc || "").slice(0, 120), exp: 0, max: 0, uses: 0, at: serverTimestamp() });
    b.set(doc(db, "groups", gid, "invites", code), { code, by: me, exp: 0, max: 0, at: serverTimestamp() });

    await b.commit();
    return gid;
  },

  /* ---------- ler grupo ---------- */
  async getGroup(gid){
    const s = await getDoc(gref(gid));
    return s.exists() ? plain(s) : null;
  },

  subscribeGroup(gid, cb, err){
    return onSnapshot(gref(gid), (s) => cb(s.exists() ? plain(s) : null), err);
  },

  async listPublic(max){
    const s = await getDocs(query(collection(db, "groups"), where("vis", "==", "public"), limit(max || 40)));
    return s.docs.map(plain);
  },

  async searchPublic(text, max){
    const t = String(text || "").toLowerCase().trim();
    if (!t) return this.listPublic(max);
    const s = await getDocs(query(collection(db, "groups"),
      where("vis", "==", "public"), where("nameLower", ">=", t), where("nameLower", "<=", t + ""), limit(max || 30)));
    return s.docs.map(plain);
  },

  async updateGroup(gid, patch){
    const p = Object.assign({}, patch);
    if (p.name) p.nameLower = p.name.toLowerCase();
    await setDoc(gref(gid), strip(p), { merge: true });
  },

  async saveRoles(gid, roles){
    /* "roles" substitui o mapa todo (cargos apagados somem) */
    const b = writeBatch(db);
    b.update(gref(gid), { roles });
    await b.commit();
  },

  async deleteGroup(gid){ await deleteDoc(gref(gid)); },

  /* ---------- entrar / sair ---------- */
  async joinPublic(g, myName){
    const me = uid();
    const b = writeBatch(db);
    b.set(mref(g.id, me), { role: "member", nick: "", name: myName, joinedAt: serverTimestamp(), lastSeen: serverTimestamp(), st: "online", mutedUntil: 0, warns: 0, muted: false, mentionsOnly: false, fav: false, pinned: false });
    b.update(gref(g.id), { memberCount: increment(1) });
    b.set(doc(db, "users", me, "groups", g.id), { gid: g.id, name: g.name, photo: g.photo ? "1" : "", joinedAt: Date.now() });
    await b.commit();
  },

  async previewInvite(code){
    const s = await getDoc(doc(db, "invites", String(code).toUpperCase()));
    return s.exists() ? plain(s) : null;
  },

  async joinByInvite(inv, myName){
    const me = uid();
    const b = writeBatch(db);
    b.set(mref(inv.gid, me), { role: "member", nick: "", name: myName, via: inv.id, joinedAt: serverTimestamp(), lastSeen: serverTimestamp(), st: "online", mutedUntil: 0, warns: 0, muted: false, mentionsOnly: false, fav: false, pinned: false });
    b.update(gref(inv.gid), { memberCount: increment(1) });
    b.update(doc(db, "invites", inv.id), { uses: increment(1) });
    b.set(doc(db, "users", me, "groups", inv.gid), { gid: inv.gid, name: inv.name || "Grupo", photo: inv.photo ? "1" : "", joinedAt: Date.now() });
    await b.commit();
  },

  async requestJoin(g, myName, note){
    const me = uid();
    const b = writeBatch(db);
    b.set(doc(db, "groups", g.id, "requests", me), { name: myName, note: (note || "").slice(0, 200), at: serverTimestamp() });
    b.set(doc(db, "users", me, "groups", g.id), { gid: g.id, name: g.name, photo: g.photo ? "1" : "", pending: true, joinedAt: Date.now() });
    await b.commit();
  },

  async cancelRequest(gid){
    const me = uid();
    const b = writeBatch(db);
    b.delete(doc(db, "groups", gid, "requests", me));
    b.delete(doc(db, "users", me, "groups", gid));
    await b.commit();
  },

  async leave(gid){
    const me = uid();
    const b = writeBatch(db);
    b.delete(mref(gid, me));
    b.update(gref(gid), { memberCount: increment(-1) });
    b.delete(doc(db, "users", me, "groups", gid));
    await b.commit();
  },

  subscribeRequests(gid, cb, err){
    return onSnapshot(collection(db, "groups", gid, "requests"), (s) => cb(s.docs.map(plain)), err);
  },

  async approve(gid, req, byName){
    const b = writeBatch(db);
    b.set(mref(gid, req.id), { role: "member", nick: "", name: req.name || "Usuário", joinedAt: serverTimestamp(), lastSeen: 0, st: "offline", mutedUntil: 0, warns: 0, muted: false, mentionsOnly: false, fav: false, pinned: false });
    b.update(gref(gid), { memberCount: increment(1) });
    b.delete(doc(db, "groups", gid, "requests", req.id));
    b.set(doc(db, "groups", gid, "modlog", newId("groups", gid, "modlog")), { by: uid(), byName, act: "approve", target: req.id, targetName: req.name || "", at: serverTimestamp() });
    await b.commit();
  },

  async declineRequest(gid, req, byName){
    const b = writeBatch(db);
    b.delete(doc(db, "groups", gid, "requests", req.id));
    b.set(doc(db, "groups", gid, "modlog", newId("groups", gid, "modlog")), { by: uid(), byName, act: "decline", target: req.id, targetName: req.name || "", at: serverTimestamp() });
    await b.commit();
  },

  async transferOwner(gid, to, byName, toName){
    const b = writeBatch(db);
    b.update(gref(gid), { ownerId: to });
    b.update(mref(gid, to), { role: "owner" });
    b.update(mref(gid, uid()), { role: "admin" });
    b.set(doc(db, "groups", gid, "modlog", newId("groups", gid, "modlog")), { by: uid(), byName, act: "transfer", target: to, targetName: toName, at: serverTimestamp() });
    await b.commit();
  },

  /* ---------- convites ---------- */
  async createInvite(g, o){
    const code = newCode();
    const b = writeBatch(db);
    const exp = o && o.hours ? Date.now() + o.hours * 3600000 : 0;
    const max = (o && o.max) || 0;
    b.set(doc(db, "invites", code), { gid: g.id, by: uid(), name: g.name, photo: g.photo || "", desc: (g.desc || "").slice(0, 120), exp, max, uses: 0, at: serverTimestamp() });
    b.set(doc(db, "groups", g.id, "invites", code), { code, by: uid(), exp, max, at: serverTimestamp() });
    await b.commit();
    return code;
  },

  async listInvites(gid){
    const s = await getDocs(collection(db, "groups", gid, "invites"));
    const list = s.docs.map(plain);
    for (const i of list){
      try{ const t = await getDoc(doc(db, "invites", i.code)); i.uses = t.exists() ? (t.data().uses || 0) : 0; }catch(e){ i.uses = 0; }
    }
    return list.sort((a, b) => ms(b.at) - ms(a.at));
  },

  async deleteInvite(gid, code){
    const b = writeBatch(db);
    b.delete(doc(db, "invites", code));
    b.delete(doc(db, "groups", gid, "invites", code));
    await b.commit();
  },

  /* ---------- membros ---------- */
  subscribeMembers(gid, cb, err){
    return onSnapshot(query(collection(db, "groups", gid, "members"), limit(600)), (s) => cb(s.docs.map(plain)), err);
  },

  async patchMember(gid, u, patch){
    await setDoc(mref(gid, u), strip(patch), { merge: true });
  },

  async kick(gid, u, byName, targetName){
    const b = writeBatch(db);
    b.delete(mref(gid, u));
    b.update(gref(gid), { memberCount: increment(-1) });
    b.set(doc(db, "groups", gid, "modlog", newId("groups", gid, "modlog")), { by: uid(), byName, act: "kick", target: u, targetName, at: serverTimestamp() });
    await b.commit();
  },

  async ban(gid, u, reason, byName, targetName){
    const b = writeBatch(db);
    b.delete(mref(gid, u));
    b.update(gref(gid), { memberCount: increment(-1) });
    b.set(doc(db, "groups", gid, "bans", u), { by: uid(), byName, name: targetName, reason: (reason || "").slice(0, 200), at: serverTimestamp() });
    b.set(doc(db, "groups", gid, "modlog", newId("groups", gid, "modlog")), { by: uid(), byName, act: "ban", target: u, targetName, note: (reason || "").slice(0, 200), at: serverTimestamp() });
    await b.commit();
  },

  async unban(gid, u, byName, targetName){
    const b = writeBatch(db);
    b.delete(doc(db, "groups", gid, "bans", u));
    b.set(doc(db, "groups", gid, "modlog", newId("groups", gid, "modlog")), { by: uid(), byName, act: "unban", target: u, targetName, at: serverTimestamp() });
    await b.commit();
  },

  async listBans(gid){
    const s = await getDocs(collection(db, "groups", gid, "bans"));
    return s.docs.map(plain).sort((a, b) => ms(b.at) - ms(a.at));
  },

  async logAction(gid, entry){
    await setDoc(doc(db, "groups", gid, "modlog", newId("groups", gid, "modlog")), Object.assign({ by: uid(), at: serverTimestamp() }, strip(entry)));
  },

  async listLog(gid, n){
    const s = await getDocs(query(collection(db, "groups", gid, "modlog"), orderBy("at", "desc"), limit(n || 80)));
    return s.docs.map(plain);
  },

  async report(gid, r){
    await setDoc(doc(db, "groups", gid, "reports", newId("groups", gid, "reports")),
      Object.assign({ by: uid(), status: "open", at: serverTimestamp() }, strip(r)));
  },

  async listReports(gid){
    const s = await getDocs(query(collection(db, "groups", gid, "reports"), orderBy("at", "desc"), limit(80)));
    return s.docs.map(plain);
  },

  async closeReport(gid, id){
    await setDoc(doc(db, "groups", gid, "reports", id), { status: "closed", closedBy: uid() }, { merge: true });
  },

  /* ---------- canais ---------- */
  subscribeChannels(gid, cb, err){
    return onSnapshot(collection(db, "groups", gid, "channels"), (s) => cb(s.docs.map(plain)), err);
  },

  async createChannel(gid, c){
    const id = newId("groups", gid, "channels");
    await setDoc(cref(gid, id), strip({
      name: c.name, type: c.type, topic: c.topic || "", private: !!c.private, roles: c.roles || [],
      order: c.order || 99, temp: !!c.temp, expiresAt: c.expiresAt || 0, slow: c.slow || 0,
      createdBy: uid(), createdAt: serverTimestamp()
    }));
    return id;
  },

  async updateChannel(gid, cid, patch){ await setDoc(cref(gid, cid), strip(patch), { merge: true }); },

  async deleteChannel(gid, cid){ await deleteDoc(cref(gid, cid)); },

  /* ---------- mensagens ---------- */
  subscribeMessages(gid, cid, n, cb, err){
    const q = query(msgs(gid, cid), orderBy("at", "desc"), limit(n));
    return onSnapshot(q, { includeMetadataChanges: true }, (s) => {
      cb(s.docs.map((d) => Object.assign(plain(d), { pending: !!(d.metadata && d.metadata.hasPendingWrites) })).reverse());
    }, err);
  },

  /* a última mensagem do canal (para "não lidas") */
  subscribeLast(gid, cid, cb){
    return onSnapshot(query(msgs(gid, cid), orderBy("at", "desc"), limit(1)), (s) => {
      const d = s.docs[0];
      cb(d ? { id: d.id, at: ms(d.data({ serverTimestamps: "estimate" }).at), from: d.data().from, mentions: d.data().mentions || [] } : null);
    }, () => cb(null));
  },

  async sendMessage(gid, cid, m){
    const ref = doc(msgs(gid, cid));
    await setDoc(ref, strip(Object.assign({ from: uid(), at: serverTimestamp() }, m)));
    return ref.id;
  },

  async editMessage(gid, cid, mid, text){
    await setDoc(doc(msgs(gid, cid), mid), { text: text.slice(0, 2000), editedAt: Date.now() }, { merge: true });
  },

  async deleteMessage(gid, cid, mid){
    await setDoc(doc(msgs(gid, cid), mid), { del: true, text: "", image: "", audio: "", file: null }, { merge: true });
  },

  async react(gid, cid, mid, emoji, on){
    /* reactions: { uid: [emojis] } — assim as regras conferem que cada um só mexe na própria */
    await setDoc(doc(msgs(gid, cid), mid), { reactions: { [uid()]: on ? arrayUnion(emoji) : arrayRemove(emoji) } }, { merge: true });
  },

  async pin(gid, cid, mid, on){
    await setDoc(doc(msgs(gid, cid), mid), { pin: !!on, pinnedAt: on ? Date.now() : 0 }, { merge: true });
  },

  /* votos */
  async vote(gid, cid, mid, choices){
    await setDoc(doc(msgs(gid, cid), mid, "votes", uid()), { c: choices, at: Date.now() });
  },

  subscribeVotes(gid, cid, mid, cb){
    return onSnapshot(collection(msgs(gid, cid), mid, "votes"), (s) => cb(s.docs.map(plain)), () => cb([]));
  },

  /* digitando */
  async setTyping(gid, cid){
    await setDoc(doc(db, "groups", gid, "channels", cid, "typing", uid()), { at: Date.now() });
  },

  subscribeTyping(gid, cid, cb){
    return onSnapshot(collection(db, "groups", gid, "channels", cid, "typing"), (s) => cb(s.docs.map(plain)), () => cb([]));
  },

  /* ---------- eventos ---------- */
  subscribeEvents(gid, cb, err){
    return onSnapshot(collection(db, "groups", gid, "events"), (s) => cb(s.docs.map(plain)), err);
  },

  async createEvent(gid, e){
    const id = newId("groups", gid, "events");
    await setDoc(doc(db, "groups", gid, "events", id), strip({ title: e.title, desc: e.desc || "", at: e.at, by: uid(), going: {}, created: serverTimestamp() }));
    return id;
  },

  async rsvp(gid, id, on){
    await setDoc(doc(db, "groups", gid, "events", id), { going: { [uid()]: on ? true : deleteField() } }, { merge: true });
  },

  async deleteEvent(gid, id){ await deleteDoc(doc(db, "groups", gid, "events", id)); },

  /* ---------- salas de voz ---------- */
  subscribeVoice(gid, cid, cb){
    return onSnapshot(collection(db, "groups", gid, "channels", cid, "vp"), (s) => cb(s.docs.map(plain)), () => cb([]));
  },

  async voiceJoin(gid, cid, name){
    const t = Date.now();
    await setDoc(doc(db, "groups", gid, "channels", cid, "vp", uid()), { name, at: t, j: t, m: true });
  },

  async voiceBeat(gid, cid, extra){
    await setDoc(doc(db, "groups", gid, "channels", cid, "vp", uid()), Object.assign({ at: Date.now() }, extra || {}), { merge: true });
  },

  async voiceLeave(gid, cid){
    await deleteDoc(doc(db, "groups", gid, "channels", cid, "vp", uid()));
  },

  async voiceSignal(gid, cid, to, k, d){
    const id = newId("groups", gid, "channels", cid, "vsig");
    await setDoc(doc(db, "groups", gid, "channels", cid, "vsig", id), { from: uid(), to, k, d: JSON.stringify(d), at: Date.now() });
  },

  subscribeSignals(gid, cid, cb){
    return onSnapshot(query(collection(db, "groups", gid, "channels", cid, "vsig"), where("to", "==", uid())),
      (s) => cb(s.docs.map(plain)), () => {});
  },

  async deleteSignal(gid, cid, id){
    await deleteDoc(doc(db, "groups", gid, "channels", cid, "vsig", id));
  },

  /* ---------- arquivos grandes (vídeo, documentos) no Supabase ---------- */
  async uploadMedia(gid, file, onProgress){
    const SB_URL = "https://fjzodnouorrdlavnnvnv.supabase.co";
    const SB_KEY = "sb_publishable_sdUjknXEYe56HZtVaAmxcA_A2xyJnP9";
    if (!window.__sbMedia){
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      window.__sbMedia = createClient(SB_URL, SB_KEY);
    }
    const ext = (String(file.name).split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
    const path = gid + "/" + crypto.randomUUID() + "." + ext;
    if (onProgress) onProgress(0.05);
    const { error } = await window.__sbMedia.storage.from("chatmedia").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error){
      const e = new Error(error.message || "Falha no envio");
      e.code = /not found|bucket/i.test(error.message || "") ? "media/no-bucket" : "media/upload";
      throw e;
    }
    if (onProgress) onProgress(1);
    return window.__sbMedia.storage.from("chatmedia").getPublicUrl(path).data.publicUrl;
  }
};

window.dispatchEvent(new Event("nox-g-ready"));
