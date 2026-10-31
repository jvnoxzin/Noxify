/* =========================================================
   NOXIFY — api/push.js  (função da Vercel)
   Envia notificações push (Web Push / VAPID) para o aparelho
   de outra pessoa quando você liga ou manda mensagem.

   Variáveis de ambiente (Vercel > Settings > Environment Variables):
     FIREBASE_SERVICE_ACCOUNT  o JSON da conta de serviço do Firebase
     VAPID_PUBLIC_KEY          a mesma chave pública do push.js
     VAPID_PRIVATE_KEY         a chave privada (SECRETA)
     VAPID_SUBJECT             mailto:seu-email@exemplo.com
========================================================= */

const admin = require("firebase-admin");
const webpush = require("web-push");

let ready = false;
function init(){
  if (ready) return;
  if (!admin.apps.length){
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  ready = true;
}

/* limite simples por instância: evita spam de notificações */
const last = new Map();
function tooFast(key, ms){
  const now = Date.now();
  if (now - (last.get(key) || 0) < ms) return true;
  last.set(key, now);
  if (last.size > 2000) last.clear();
  return false;
}

const UID_RE = /^[A-Za-z0-9_-]{6,128}$/;
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);


/* ---------- push de grupo ---------- */
async function groupPush(from, body, res){
  const db = admin.firestore();
  const gid = body.gid, cid = body.cid;

  const [gSnap, mSnap, cSnap] = await Promise.all([
    db.doc("groups/" + gid).get(), db.doc("groups/" + gid + "/members/" + from).get(), db.doc("groups/" + gid + "/channels/" + cid).get()
  ]);
  if (!gSnap.exists || !mSnap.exists || !cSnap.exists) return res.status(403).json({ error: "Sem acesso" });
  const g = gSnap.data(), me = mSnap.data(), ch = cSnap.data();
  if ((me.mutedUntil || 0) > Date.now()) return res.status(403).json({ error: "Silenciado" });

  const roles = g.roles || {};
  const roleOf = (m, id) => (id === g.ownerId ? "owner" : (roles[m.role] ? m.role : "member"));
  const hasPerm = (m, id, p) => id === g.ownerId || m.role === "owner" || !!((roles[roleOf(m, id)] || {}).perms || {})[p];
  const canRead = (m, id) => !ch.private || hasPerm(m, id, "manageChannels") || (ch.roles || []).includes(roleOf(m, id)) || (ch.users || []).includes(id);
  if (ch.type === "voice" || !canRead(me, from)) return res.status(403).json({ error: "Sem acesso" });

  const wantsAll = Array.isArray(body.mentions) && body.mentions.includes("all") && hasPerm(me, from, "mentionAll");
  const mentioned = new Set((Array.isArray(body.mentions) ? body.mentions : []).filter((x) => typeof x === "string" && x !== "all").slice(0, 30));

  const all = await db.collection("groups/" + gid + "/members").select("role", "muted", "mentionsOnly", "chMute").limit(1000).get();
  const targets = [];
  all.forEach((d) => {
    const id = d.id, m = d.data();
    if (id === from || m.muted) return;
    if (m.chMute && m.chMute[cid]) return;
    if (!canRead(m, id)) return;
    if (m.mentionsOnly && !(wantsAll || mentioned.has(id))) return;
    targets.push(id);
  });
  if (!targets.length) return res.status(200).json({ sent: 0, note: "Ninguém para avisar" });
  const list = targets.slice(0, 300);

  const sender = await db.doc("users/" + from).get();
  const who = clean(me.nick, 30) || clean(sender.exists ? sender.data().name : "", 30) || "Alguém";
  const t = body.type;
  const text = t === "audio" ? "🎙️ Mensagem de voz" : t === "image" ? "📷 Foto" : t === "video" ? "🎬 Vídeo" : t === "file" ? "📄 Arquivo" : t === "poll" ? "📊 " + (clean(body.text, 80) || "Enquete") : (clean(body.text, 100) || "Nova mensagem");
  const payload = JSON.stringify({
    title: clean(g.name, 40) + " · #" + clean(ch.name, 30), body: who + ": " + text,
    kind: "gmsg", tag: "g-" + cid, from, url: "./?g=" + gid + "&c=" + cid, at: Date.now()
  });

  const snaps = await db.getAll(...list.map((u) => db.doc("pushSubs/" + u)));
  let sent = 0;
  await Promise.all(snaps.map(async (snap) => {
    if (!snap.exists) return;
    const subs = snap.data().subs || {};
    const dead = {};
    await Promise.all(Object.keys(subs).map(async (sid) => {
      const s = subs[sid];
      if (!s || !s.endpoint || !s.keys) return;
      try{ await webpush.sendNotification(s, payload, { TTL: 60 * 60 * 24, urgency: "normal" }); sent++; }
      catch(e){ if (e && (e.statusCode === 404 || e.statusCode === 410)) dead["subs." + sid] = admin.firestore.FieldValue.delete(); }
    }));
    if (Object.keys(dead).length) await snap.ref.update(dead).catch(() => {});
  }));
  return res.status(200).json({ sent, members: list.length });
}

module.exports = async (req, res) => {

  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  let body = req.body;
  if (typeof body === "string"){ try{ body = JSON.parse(body); }catch(e){ body = null; } }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Pedido inválido" });

  try{ init(); }
  catch(e){
    console.error("push: configuração ausente ou inválida");
    return res.status(500).json({ error: "O servidor de push ainda não foi configurado." });
  }

  /* 1) quem está pedindo? (confere o login do Firebase) */
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) return res.status(401).json({ error: "Sem login" });

  let from;
  try{ from = (await admin.auth().verifyIdToken(m[1])).uid; }
  catch(e){ return res.status(401).json({ error: "Login inválido" }); }

  /* ---- grupos: avisa os membros de um canal ---- */
  if (body.kind === "gmsg"){
    const ID_RE = /^[A-Za-z0-9]{8,40}$/;
    if (typeof body.gid !== "string" || typeof body.cid !== "string" || !ID_RE.test(body.gid) || !ID_RE.test(body.cid)) return res.status(400).json({ error: "Grupo inválido" });
    if (tooFast(from + ">g" + body.cid, 1500)) return res.status(429).json({ error: "Devagar" });
    return groupPush(from, body, res);
  }

  /* 2) pedido válido? */
  const to = body.to, kind = body.kind;
  if (typeof to !== "string" || !UID_RE.test(to)) return res.status(400).json({ error: "Destino inválido" });
  if (!["call", "msg", "test"].includes(kind)) return res.status(400).json({ error: "Tipo inválido" });
  if (kind === "test" ? to !== from : to === from) return res.status(400).json({ error: "Destino inválido" });

  if (tooFast(from + ">" + to + ":" + kind, kind === "call" ? 4000 : 1500)) return res.status(429).json({ error: "Devagar" });

  const db = admin.firestore();

  /* 3) as duas pessoas têm uma conversa juntas? (impede mandar push para qualquer um) */
  if (kind !== "test"){
    const chat = await db.doc("chats/" + [from, to].sort().join("_")).get();
    const members = chat.exists ? (chat.data().members || []) : [];
    if (!members.includes(from) || !members.includes(to)) return res.status(403).json({ error: "Sem conversa entre vocês" });
  }

  /* 4) texto da notificação (o nome vem do servidor, não do pedido) */
  const sender = await db.doc("users/" + from).get();
  const name = clean(sender.exists ? sender.data().name : "", 30) || "Noxify";

  let title = name, text = "", tag = "msg-" + from;
  if (kind === "call"){
    text = body.type === "video" ? "📹 Chamada de vídeo" : "📞 Chamada de voz";
    tag = "call-" + from;
  }else if (kind === "test"){
    title = "Noxify"; text = "Notificações funcionando 🎉"; tag = "test";
  }else if (body.type === "audio"){ text = "🎙️ Mensagem de voz"; }
  else if (body.type === "sticker"){ text = "🖼️ Figurinha"; }
  else { text = clean(body.text, 100) || "Nova mensagem"; }

  const payload = JSON.stringify({ title, body: text, kind, tag, from, url: "./", at: Date.now() });

  /* 5) envia para todos os aparelhos do destinatário */
  const ref = db.doc("pushSubs/" + to);
  const snap = await ref.get();
  const subs = snap.exists ? (snap.data().subs || {}) : {};
  const ids = Object.keys(subs);
  if (!ids.length) return res.status(200).json({ sent: 0, removed: 0, note: "Sem aparelhos com notificação ativa" });

  let sent = 0;
  const dead = {};

  await Promise.all(ids.map(async (id) => {
    const s = subs[id];
    if (!s || !s.endpoint || !s.keys) return;
    try{
      await webpush.sendNotification(s, payload, {
        TTL: kind === "call" ? 45 : 60 * 60 * 24,
        urgency: kind === "call" ? "high" : "normal"
      });
      sent++;
    }catch(e){
      if (e && (e.statusCode === 404 || e.statusCode === 410)) dead["subs." + id] = admin.firestore.FieldValue.delete();
      else console.warn("push: falha ao enviar", e && e.statusCode);
    }
  }));

  const removed = Object.keys(dead).length;
  if (removed) await ref.update(dead).catch(() => {});

  return res.status(200).json({ sent, removed });
};
