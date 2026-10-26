/* =========================================================
   NOXIFY — db.js
   Ligação com o Firestore (perfis públicos, seguidores e chat).
   Carrega separado do login: se falhar, o resto do app continua.
   Regras de segurança: firestore.rules
========================================================= */

import { getApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  initializeFirestore, doc, collection, setDoc, getDoc, getDocs, deleteDoc,
  query, where, orderBy, limit, limitToLast, onSnapshot, serverTimestamp,
  writeBatch, getCountFromServer
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const db = initializeFirestore(getApp(), { experimentalAutoDetectLongPolling: true });

/* id do documento de um nome (sem "/" e sem "." sozinho) */
const nameDoc = (lower) => doc(db, "usernames", encodeURIComponent(lower).replace(/\./g, "%2E"));

const ms = (t) => (t && t.toMillis ? t.toMillis() : Date.now());

window.NoxDB = {

  chatId(a, b){ return [a, b].sort().join("_"); },

  /* ---------- perfis ---------- */
  upsertUser(uid, data){
    return setDoc(doc(db, "users", uid), Object.assign({}, data, { updatedAt: serverTimestamp() }), { merge: true });
  },

  async getUser(uid){
    const s = await getDoc(doc(db, "users", uid));
    return s.exists() ? Object.assign({ uid }, s.data()) : null;
  },

  async searchUsers(prefix, max){
    const q = query(
      collection(db, "users"),
      where("nameLower", ">=", prefix),
      where("nameLower", "<=", prefix + ""),
      limit(max || 20)
    );
    const s = await getDocs(q);
    return s.docs.map((d) => Object.assign({ uid: d.id }, d.data()));
  },

  /* ---------- nomes únicos ---------- */
  async isNameFree(lower, uid){
    const s = await getDoc(nameDoc(lower));
    return !s.exists() || (!!uid && s.data().uid === uid);
  },

  /* reserva o nome para a conta e libera o antigo (tudo ou nada) */
  async claimName(uid, lower){

    const mine = await getDoc(nameDoc(lower));
    if (mine.exists() && mine.data().uid !== uid){
      const e = new Error("name-taken"); e.code = "name-taken"; throw e;
    }

    const prev = await getDoc(doc(db, "users", uid));
    const oldLower = prev.exists() ? prev.data().nameLower : "";

    const b = writeBatch(db);
    if (!mine.exists()) b.set(nameDoc(lower), { uid });
    if (oldLower && oldLower !== lower){
      const old = await getDoc(nameDoc(oldLower));
      if (old.exists() && old.data().uid === uid) b.delete(nameDoc(oldLower));
    }

    try{ await b.commit(); }
    catch(err){
      if (err && err.code === "permission-denied"){
        const e = new Error("name-taken"); e.code = "name-taken"; throw e;
      }
      throw err;
    }
  },

  /* ---------- seguidores ---------- */
  async follow(me, other){
    const b = writeBatch(db);
    b.set(doc(db, "users", me, "following", other), { at: serverTimestamp() });
    b.set(doc(db, "users", other, "followers", me), { at: serverTimestamp() });
    await b.commit();
  },

  async unfollow(me, other){
    const b = writeBatch(db);
    b.delete(doc(db, "users", me, "following", other));
    b.delete(doc(db, "users", other, "followers", me));
    await b.commit();
  },

  async isFollowing(me, other){
    const s = await getDoc(doc(db, "users", me, "following", other));
    return s.exists();
  },

  async listFollow(uid, kind){
    const s = await getDocs(query(collection(db, "users", uid, kind), limit(100)));
    return s.docs.map((d) => d.id);
  },

  async countFollow(uid, kind){
    try{
      const s = await getCountFromServer(collection(db, "users", uid, kind));
      return s.data().count;
    }catch(e){
      return (await this.listFollow(uid, kind)).length;
    }
  },

  /* ---------- chat ---------- */
  subscribeChats(uid, onData, onError){
    const q = query(collection(db, "chats"), where("members", "array-contains", uid));
    return onSnapshot(q, (snap) => {
      onData(snap.docs.map((d) => {
        const x = d.data({ serverTimestamps: "estimate" });
        return { id: d.id, members: x.members || [], lastText: x.lastText || "", lastFrom: x.lastFrom || "", lastAt: ms(x.lastAt) };
      }));
    }, onError);
  },

  subscribeMessages(chatId, onData, onError){
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("at"), limitToLast(150));
    return onSnapshot(q, (snap) => {
      onData(snap.docs.map((d) => {
        const x = d.data({ serverTimestamps: "estimate" });
        return { id: d.id, from: x.from, text: x.text, at: ms(x.at) };
      }));
    }, onError);
  },

  async sendMessage(chatId, members, from, text){
    const b = writeBatch(db);
    b.set(doc(db, "chats", chatId), {
      members, lastText: text.slice(0, 80), lastFrom: from, lastAt: serverTimestamp()
    }, { merge: true });
    b.set(doc(collection(db, "chats", chatId, "messages")), {
      from, text, at: serverTimestamp()
    });
    await b.commit();
  }
};

window.dispatchEvent(new Event("nox-db-ready"));
