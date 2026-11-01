/* =========================================================
   NOXIFY — api/coins.js  (função da Vercel)
   Carteira de Nox Coins, recompensas, missões e Store.
   Usa as MESMAS variáveis do push.js:
     FIREBASE_SERVICE_ACCOUNT  o JSON da conta de serviço do Firebase
   Não precisa de nenhuma variável nova.
========================================================= */

const admin = require("firebase-admin");
const { createCoins } = require("./_coins");

let core = null;
function init(){
  if (core) return core;
  if (!admin.apps.length){
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  core = createCoins({ db: admin.firestore(), FieldValue: admin.firestore.FieldValue });
  return core;
}

module.exports = async (req, res) => {

  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  let body = req.body;
  if (typeof body === "string"){ try{ body = JSON.parse(body); }catch(e){ body = null; } }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Pedido inválido" });

  let c;
  try{ c = init(); }
  catch(e){
    console.error("coins: configuração ausente ou inválida");
    return res.status(500).json({ error: "O servidor das moedas ainda não foi configurado.", code: "config" });
  }

  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) return res.status(401).json({ error: "Sem login" });

  let uid;
  try{ uid = (await admin.auth().verifyIdToken(m[1])).uid; }
  catch(e){ return res.status(401).json({ error: "Login inválido" }); }

  const r = await c.handle(uid, body);
  return res.status(r.status).json(r.json);
};
