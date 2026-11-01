/* =========================================================
   NOXIFY — api/_coins.js
   Regras das Nox Coins (NC). Roda SÓ no servidor.
   O navegador nunca manda "saldo": ele só pede ações
   (resgatar, comprar, equipar) e o servidor decide tudo
   dentro de transações do Firestore (atômicas).

   Dados (o navegador só LÊ os seus, veja firestore.rules):
     wallets/{uid}                 saldo, totais, sequência, itens, equipados
     wallets/{uid}/tx/{id}         histórico de transações
     wallets/{uid}/daily/{AAAA-MM-DD}  resgates diários
     wallets/{uid}/missions/{chave}    missões já resgatadas
     wallets/{uid}/ev/{chave}          atividade registrada (ouvir, playlist)
   Aparência pública (o que os outros veem): users/{uid}.cos
========================================================= */

const { TZ, DAILY, CATS, ITEMS, BY_ID, DEFAULT_OF, MISSIONS } = require("./_catalog");

const ID_RE = /^[a-z]{2}_[a-z0-9]{2,20}$/;
const CAT_LABEL = { frame: "moldura", effect: "efeito", banner: "banner", name: "estilo de nome", badge: "emblema", theme: "tema" };

class Fail extends Error {
  constructor(status, code, msg){ super(msg); this.status = status; this.code = code; }
}

/* "AAAA-MM-DD" no fuso do app */
function dayKey(ms){
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}
function prevDay(key){
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

function createCoins({ db, FieldValue, now }){

  const clock = now || (() => Date.now());
  const walletRef = (uid) => db.doc("wallets/" + uid);
  const newWallet = () => ({ balance: 0, earned: 0, spent: 0, streak: 0, lastClaim: "", owned: {}, equip: {}, createdAt: clock() });

  const owns = (w, id) => !!(BY_ID[id] && (BY_ID[id].free || (w.owned || {})[id]));

  /* cria a carteira (saldo 0) se ainda não existe */
  async function ensure(uid){
    const ref = walletRef(uid);
    await db.runTransaction(async (t) => {
      const s = await t.get(ref);
      if (!s.exists) t.set(ref, newWallet());
    });
  }

  /* grava uma transação no histórico (dentro de uma transação do Firestore) */
  function logTx(t, uid, amt, desc, kind, bal){
    t.set(db.collection("wallets/" + uid + "/tx").doc(), { amt, desc, kind, bal, at: clock() });
  }

  function publicCos(equip){
    const keep = (id, def) => (id && id !== def ? id : "");
    return {
      f: keep(equip.frame, "fr_default"),
      b: equip.banner || "",
      n: keep(equip.name, "nm_default"),
      d: keep(equip.badge, "bd_none")
    };
  }
  async function mirrorCos(uid, equip){
    await db.doc("users/" + uid).set({ cos: publicCos(equip) }, { merge: true });
  }

  /* ---------- recompensa diária ---------- */
  async function daily(uid){
    const ref = walletRef(uid);
    const today = dayKey(clock());
    let out;
    await db.runTransaction(async (t) => {
      const s = await t.get(ref);
      const w = s.exists ? s.data() : newWallet();
      if (w.lastClaim === today) throw new Fail(409, "already", "Você já resgatou hoje. Volte amanhã!");

      const streak = w.lastClaim === prevDay(today) ? (w.streak || 0) + 1 : 1;
      const reward = DAILY[(streak - 1) % DAILY.length];
      const bal = (w.balance || 0) + reward;

      const patch = { balance: bal, earned: (w.earned || 0) + reward, streak, lastClaim: today };
      if (!owns(w, "bd_rookie")) patch.owned = { bd_rookie: true };
      if (s.exists) t.set(ref, patch, { merge: true }); else t.set(ref, Object.assign(newWallet(), patch, { owned: patch.owned || {} }));

      t.set(db.doc("wallets/" + uid + "/daily/" + today), { streak, reward, at: clock() });
      logTx(t, uid, reward, "Recompensa diária (dia " + (((streak - 1) % DAILY.length) + 1) + ")", "daily", bal);
      out = { reward, streak };
    });
    return out;
  }

  /* ---------- compra ---------- */
  async function buy(uid, id){
    const item = ID_RE.test(String(id)) && BY_ID[id];
    if (!item) throw new Fail(404, "no-item", "Item não encontrado.");
    if (item.free || item.src) throw new Fail(400, "not-for-sale", "Este item não está à venda.");

    const ref = walletRef(uid);
    let out;
    await db.runTransaction(async (t) => {
      const s = await t.get(ref);
      const w = s.exists ? s.data() : newWallet();
      if (owns(w, id)) throw new Fail(409, "owned", "Você já tem este item.");
      if ((w.balance || 0) < item.price) throw new Fail(402, "funds", "Saldo insuficiente.");

      const bal = w.balance - item.price;
      const patch = { balance: bal, spent: (w.spent || 0) + item.price, owned: { [id]: true } };
      if (s.exists) t.set(ref, patch, { merge: true }); else t.set(ref, Object.assign(newWallet(), patch));
      logTx(t, uid, -item.price, "Compra de " + CAT_LABEL[item.cat] + " " + item.name, "buy", bal);
      out = { id, balance: bal };
    });
    return out;
  }

  /* ---------- equipar / desequipar ---------- */
  async function equip(uid, id, cat){
    let item = null;
    if (id){
      item = ID_RE.test(String(id)) && BY_ID[id];
      if (!item) throw new Fail(404, "no-item", "Item não encontrado.");
      cat = item.cat;
    }
    if (!CATS.includes(cat)) throw new Fail(400, "bad-cat", "Categoria inválida.");

    const ref = walletRef(uid);
    let eq;
    await db.runTransaction(async (t) => {
      const s = await t.get(ref);
      const w = s.exists ? s.data() : newWallet();
      if (item && !owns(w, item.id)) throw new Fail(403, "not-owned", "Você ainda não tem este item.");
      const val = item ? item.id : (DEFAULT_OF[cat] || "");
      eq = Object.assign({}, w.equip || {}, { [cat]: val });
      if (s.exists) t.set(ref, { equip: { [cat]: val } }, { merge: true }); else t.set(ref, Object.assign(newWallet(), { equip: eq }));
    });
    await mirrorCos(uid, eq);
    return { equip: eq };
  }

  /* ---------- atividade (ouvir / playlist) ---------- */
  async function event(uid, body){
    const type = body.type;
    const today = dayKey(clock());
    if (type === "listen"){
      const key = String(body.key || "").slice(0, 120);
      if (!key) throw new Fail(400, "bad-event", "Evento inválido.");
      const ref = db.doc("wallets/" + uid + "/ev/listen_" + today);
      await db.runTransaction(async (t) => {
        const s = await t.get(ref);
        const keys = s.exists ? Object.keys(s.data().keys || {}) : [];
        const hk = hash(key);
        if (keys.length >= 20 || keys.includes(hk)) return;       // limite por dia; a mesma música não conta duas vezes
        t.set(ref, { keys: { [hk]: true }, at: clock() }, { merge: true });
      });
      return { ok: true };
    }
    if (type === "playlist"){
      await db.doc("wallets/" + uid + "/ev/playlist").set({ done: true, at: clock() }, { merge: true });
      return { ok: true };
    }
    throw new Fail(400, "bad-event", "Evento inválido.");
  }
  function hash(s){ let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return "k" + (h >>> 0).toString(36); }

  /* ---------- missões ---------- */
  const claimKey = (m, today) => (m.period === "day" ? m.id + "_" + today : m.id);

  async function progressOf(uid, m, w, today){
    if (m.id === "m_login") return 1;                             // abrir o app já autentica esta chamada
    if (m.id === "m_streak7") return Math.min(w.streak || 0, 7);
    if (m.id === "m_listen"){
      const s = await db.doc("wallets/" + uid + "/ev/listen_" + today).get();
      return Math.min(s.exists ? Object.keys(s.data().keys || {}).length : 0, m.target);
    }
    if (m.id === "m_playlist"){
      const s = await db.doc("wallets/" + uid + "/ev/playlist").get();
      return s.exists && s.data().done ? 1 : 0;
    }
    if (m.id === "m_group"){
      const s = await db.collection("users/" + uid + "/groups").limit(1).get();
      return s.empty ? 0 : 1;                                     // conferido nos grupos reais da conta
    }
    return 0;
  }

  async function claimMission(uid, id){
    const m = MISSIONS.find((x) => x.id === id);
    if (!m) throw new Fail(404, "no-mission", "Missão não encontrada.");
    const today = dayKey(clock());
    const ref = walletRef(uid);
    const first = await ref.get();
    const w0 = first.exists ? first.data() : newWallet();
    if ((await progressOf(uid, m, w0, today)) < m.target) throw new Fail(400, "incomplete", "A missão ainda não foi concluída.");

    const mref = db.doc("wallets/" + uid + "/missions/" + claimKey(m, today));
    let out;
    await db.runTransaction(async (t) => {
      const [s, ms] = await Promise.all([t.get(ref), t.get(mref)]);
      if (ms.exists) throw new Fail(409, "claimed", "Você já resgatou esta missão.");
      const w = s.exists ? s.data() : newWallet();
      const bal = (w.balance || 0) + m.reward;
      const patch = { balance: bal, earned: (w.earned || 0) + m.reward };
      if (m.item && !owns(w, m.item)) patch.owned = { [m.item]: true };
      if (s.exists) t.set(ref, patch, { merge: true }); else t.set(ref, Object.assign(newWallet(), patch, { owned: patch.owned || {} }));
      t.set(mref, { at: clock(), reward: m.reward });
      logTx(t, uid, m.reward, "Missão: " + m.name, "mission", bal);
      out = { reward: m.reward, balance: bal, item: m.item || null };
    });
    return out;
  }

  /* ---------- estado completo para a tela ---------- */
  async function state(uid){
    await ensure(uid);
    const today = dayKey(clock());
    const ref = walletRef(uid);
    const [ws, txs, dls, mss] = await Promise.all([
      ref.get(),
      db.collection("wallets/" + uid + "/tx").orderBy("at", "desc").limit(40).get(),
      db.collection("wallets/" + uid + "/daily").orderBy("at", "desc").limit(14).get(),
      db.collection("wallets/" + uid + "/missions").get()
    ]);
    const w = ws.data();
    const claimed = new Set(); mss.forEach((d) => claimed.add(d.id));

    const missions = [];
    for (const m of MISSIONS){
      const progress = await progressOf(uid, m, w, today);
      missions.push({ id: m.id, name: m.name, desc: m.desc, period: m.period, target: m.target, reward: m.reward, item: m.item || null,
        progress, claimed: claimed.has(claimKey(m, today)) });
    }

    const claimedToday = w.lastClaim === today;
    const alive = claimedToday || w.lastClaim === prevDay(today);        // a sequência continua?
    const streak = alive ? (w.streak || 0) : 0;
    const nextIdx = claimedToday ? streak % DAILY.length : (alive ? streak : 0) % DAILY.length;

    return {
      today,
      wallet: { balance: w.balance || 0, earned: w.earned || 0, spent: w.spent || 0 },
      daily: { streak, claimedToday, next: DAILY[nextIdx], nextDay: nextIdx + 1, table: DAILY,
        history: dls.docs.map((d) => Object.assign({ date: d.id }, d.data())) },
      owned: Object.keys(w.owned || {}),
      equip: w.equip || {},
      items: ITEMS,
      missions,
      tx: txs.docs.map((d) => Object.assign({ id: d.id }, d.data()))
    };
  }

  /* ---------- entrada ---------- */
  const lastCall = new Map();
  async function handle(uid, body){
    const action = body && body.action;
    try{
      if (action !== "state"){
        const t0 = clock();
        if (t0 - (lastCall.get(uid) || 0) < 250) throw new Fail(429, "slow", "Devagar um pouco.");
        lastCall.set(uid, t0);
        if (lastCall.size > 3000) lastCall.clear();
      }
      let result;
      switch (action){
        case "state":   return { status: 200, json: await state(uid) };
        case "daily":   result = await daily(uid); break;
        case "buy":     result = await buy(uid, body.id); break;
        case "equip":   result = await equip(uid, body.id, null); break;
        case "unequip": result = await equip(uid, null, body.cat); break;
        case "event":   result = await event(uid, body); break;
        case "mission": result = await claimMission(uid, body.id); break;
        default: throw new Fail(400, "bad-action", "Ação inválida.");
      }
      return { status: 200, json: Object.assign({ ok: true }, result) };
    }catch(e){
      if (e instanceof Fail) return { status: e.status, json: { error: e.message, code: e.code } };
      console.error("coins:", action, e && e.message);
      return { status: 500, json: { error: "Erro no servidor. Tente de novo.", code: "server" } };
    }
  }

  return { handle, dayKey, state };
}

module.exports = { createCoins, dayKey, prevDay };
