/* =========================================================
   NOXIFY — push.js
   Notificações push (chamada e mensagem) com o app fechado.

   Como funciona:
   1) O aparelho cria uma "assinatura de push" (precisa da chave
      pública VAPID abaixo) e o app a salva no Firestore (pushSubs/{uid}).
   2) Quando você liga ou manda mensagem, o app pede à função
      /api/push (na Vercel) para avisar a outra pessoa.
   3) O sw.js recebe o aviso e mostra a notificação.

   A chave PRIVADA nunca fica aqui: ela vai só nas variáveis de
   ambiente da Vercel (veja LEIA-ME-PUSH.txt).
========================================================= */

const VAPID_PUBLIC_KEY = "BBE681hJsuDG1h5nHdzaKeQ4wo03kZLsQQbGnnB8BKx4DwUKP3stqKQFS313uS-dZUYQksiGUHv6A9x21cCPTDg";

const NoxPush = (() => {

  const db = () => window.NoxDB;
  const uid = () => (window.auth && window.auth.currentUser) ? window.auth.currentUser.uid : (localStorage.getItem("noxUid") || null);
  const flagKey = () => "noxPush:" + (uid() || "");

  const supported = () =>
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installed = () =>
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  /* estado para a tela de Configurações */
  function state(){
    if (!supported()){
      if (isIos() && !installed()) return "ios-install";
      return "unsupported";
    }
    if (Notification.permission === "denied") return "denied";
    let on = false;
    try{ on = localStorage.getItem(flagKey()) === "1"; }catch(e){}
    return (on && Notification.permission === "granted") ? "on" : "off";
  }

  const b64ToBytes = (b64) => {
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  };

  /* id curto e estável da assinatura (o endpoint é longo demais para virar nome de campo) */
  function subId(endpoint){
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < endpoint.length; i++){
      const c = endpoint.charCodeAt(i);
      h1 = ((h1 * 33) ^ c) >>> 0;
      h2 = ((h2 * 33) ^ c) >>> 0;
    }
    return "s" + h1.toString(36) + h2.toString(36);
  }

  async function registration(){
    return navigator.serviceWorker.ready;
  }

  async function save(sub){
    const j = sub.toJSON();
    await db().savePushSub(uid(), subId(j.endpoint), {
      endpoint: j.endpoint,
      keys: { p256dh: j.keys.p256dh, auth: j.keys.auth },
      ua: navigator.userAgent.slice(0, 120),
      at: Date.now()
    });
  }

  async function enable(){
    if (!supported()) throw new Error("Este navegador não suporta notificações.");
    if (!db() || !uid()) throw new Error("Entre na sua conta, com internet, para ativar.");

    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Permissão negada. Libere as notificações nas configurações do navegador.");

    const reg = await registration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY)
      });
    }
    await save(sub);
    try{ localStorage.setItem(flagKey(), "1"); }catch(e){}
    return true;
  }

  async function disable(){
    try{
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub){
        const id = subId(sub.endpoint);
        await sub.unsubscribe();
        if (db() && uid()) await db().removePushSub(uid(), id);
      }
    }catch(e){ console.warn("Push:", e); }
    try{ localStorage.removeItem(flagKey()); }catch(e){}
  }

  /* ao abrir o app já com permissão: garante que o servidor tem a assinatura atual */
  async function refresh(){
    try{
      if (state() !== "on" || !db() || !uid()) return;
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) await save(sub);
      else localStorage.removeItem(flagKey());
    }catch(e){ console.warn("Push:", e); }
  }

  /* pede ao servidor para avisar outra pessoa (não bloqueia nada se falhar) */
  async function notify(to, kind, extra){
    try{
      if (!to || !window.auth || !window.auth.currentUser) return false;
      const token = await window.auth.currentUser.getIdToken();
      const r = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(Object.assign({ to, kind }, extra || {})),
        keepalive: true
      });
      return r.ok;
    }catch(e){
      return false;
    }
  }

  /* notificação de teste para si mesmo (Configurações) */
  async function test(){
    const token = await window.auth.currentUser.getIdToken();
    const r = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ to: uid(), kind: "test" })
    });
    let data = {};
    try{ data = await r.json(); }catch(e){}
    if (!r.ok) throw new Error(data.error || ("Servidor respondeu " + r.status));
    return data;
  }

  window.addEventListener("nox-db-ready", () => setTimeout(refresh, 1500));

  return { supported, state, enable, disable, refresh, notify, test };
})();

window.NoxPush = NoxPush;   /* o db.js e o calls.js procuram por window.NoxPush */
