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
  writeBatch, getCountFromServer, updateDoc
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const db = initializeFirestore(getApp(), { experimentalAutoDetectLongPolling: true });

/* id do documento de um nome (sem "/" e sem "." sozinho) */
const nameDoc = (lower) => doc(db, "usernames", encodeURIComponent(lower).replace(/\./g, "%2E"));

/* Storage carrega só quando alguém envia ou toca uma música enviada (não pesa no resto do app) */
let storageMod = null;
let storageRef = null;

async function useStorage(){
  if (!storageMod){
    storageMod = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js");
    storageRef = storageMod.getStorage(getApp());
  }
  return storageMod;
}

const currentUid = () => (window.auth && window.auth.currentUser) ? window.auth.currentUser.uid : null;

const songFrom = (d) => {
  const x = d.data({ serverTimestamps: "estimate" });
  return {
    id: d.id, ownerUid: x.ownerUid, ownerName: x.ownerName || "", title: x.title, artist: x.artist,
    visibility: x.visibility, audioPath: x.audioPath, coverPath: x.coverPath || "",
    size: x.size || 0, createdAt: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : Date.now()
  };
};

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

  /* ---------- músicas enviadas (Storage + Firestore) ---------- */

  /* envia o MP3 (e a capa), depois grava os dados. Se algo falhar, apaga o que já subiu.
     ctl.cancel() cancela o envio em andamento. */
  async uploadSong(opts, onProgress, ctl){

    const uid = currentUid();
    if (!uid){ const e = new Error("Sem login"); e.code = "unauthenticated"; throw e; }

    const m = await useStorage();
    const id = doc(collection(db, "userSongs")).id;
    const audioPath = "songs/" + uid + "/" + id;
    const coverPath = opts.cover ? "covers/" + uid + "/" + id : "";
    const done = [];
    ctl = ctl || {};

    const send = (path, blob, type, base, weight) => new Promise((resolve, reject) => {
      if (ctl.cancelled){ const e = new Error("Cancelado"); e.code = "storage/canceled"; reject(e); return; }
      const task = m.uploadBytesResumable(m.ref(storageRef, path), blob, { contentType: type });
      ctl.cancel = () => { ctl.cancelled = true; task.cancel(); };
      task.on("state_changed",
        (s) => { if (onProgress) onProgress(base + weight * (s.totalBytes ? s.bytesTransferred / s.totalBytes : 0)); },
        reject,
        () => { done.push(path); resolve(); });
    });

    try{
      const w = opts.cover ? 0.93 : 1;
      await send(audioPath, opts.file, "audio/mpeg", 0, w);
      if (opts.cover) await send(coverPath, opts.cover, "image/jpeg", w, 1 - w);
      if (ctl.cancelled){ const e = new Error("Cancelado"); e.code = "storage/canceled"; throw e; }

      await setDoc(doc(db, "userSongs", id), {
        ownerUid: uid, ownerName: opts.ownerName, title: opts.title, artist: opts.artist,
        visibility: opts.visibility, audioPath, coverPath, size: opts.file.size,
        createdAt: serverTimestamp()
      });
    }catch(err){
      /* não deixa arquivo órfão para trás */
      await Promise.allSettled(done.map((p) => m.deleteObject(m.ref(storageRef, p))));
      throw err;
    }
    return id;
  },

  async listMySongs(uid){
    const q = query(collection(db, "userSongs"), where("ownerUid", "==", uid), limit(100));
    const s = await getDocs(q);
    return s.docs.map(songFrom).sort((a, b) => b.createdAt - a.createdAt);
  },

  async listPublicSongs(uid){
    const q = query(collection(db, "userSongs"), where("ownerUid", "==", uid), where("visibility", "==", "public"), limit(100));
    const s = await getDocs(q);
    return s.docs.map(songFrom).sort((a, b) => b.createdAt - a.createdAt);
  },

  updateSong(id, patch){
    return updateDoc(doc(db, "userSongs", id), patch);
  },

  /* apaga primeiro os arquivos e só depois o registro: se algo falhar no meio, dá para tentar de novo
     (arquivo que já não existe é ignorado) e nunca fica um registro "bom" apontando para nada. */
  async deleteSong(song){
    const m = await useStorage();
    for (const path of [song.audioPath, song.coverPath].filter(Boolean)){
      try{
        await m.deleteObject(m.ref(storageRef, path));
      }catch(e){
        if (!e || e.code !== "storage/object-not-found") throw e;
      }
    }
    await deleteDoc(doc(db, "userSongs", song.id));
  },

  /* baixa o arquivo com o login do usuário (as regras do Storage valem; não existe link público) */
  async getFileBlob(path){
    const m = await useStorage();
    return m.getBlob(m.ref(storageRef, path), 30 * 1024 * 1024);
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
