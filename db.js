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
  writeBatch, getCountFromServer, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const db = initializeFirestore(getApp(), { experimentalAutoDetectLongPolling: true });

/* id do documento de um nome (sem "/" e sem "." sozinho) */
const nameDoc = (lower) => doc(db, "usernames", encodeURIComponent(lower).replace(/\./g, "%2E"));

/* ---------- Supabase (só os arquivos de música; perfis, seguidores e chat ficam no Firestore) ---------- */
const SUPABASE_URL = "https://fjzodnouorrdlavnnvnv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sdUjknXEYe56HZtVaAmxcA_A2xyJnP9";   // chave pública (anon)

let sbClient = null;

/* carrega só quando alguém envia ou toca uma música enviada: se o Supabase falhar, o resto do app continua */
async function useSupabase(){
  if (!sbClient){
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return sbClient;
}

const currentUid = () => (window.auth && window.auth.currentUser) ? window.auth.currentUser.uid : null;

/* erros do Supabase -> os mesmos códigos que o uploads.js já sabe explicar em português */
function sbFail(err){
  const e = new Error((err && err.message) || "Erro no armazenamento");
  const st = Number(err && (err.statusCode || err.status));
  const msg = String((err && err.message) || "");
  if (st === 401 || st === 403 || /row-level security|not authorized|permission/i.test(msg)) e.code = "storage/unauthorized";
  else if (st === 404 || /not found|Object not found/i.test(msg)) e.code = "storage/object-not-found";
  else if (st === 413 || /exceeded the maximum|too large/i.test(msg)) e.code = "storage/quota-exceeded";
  else if (/Failed to fetch|NetworkError|network/i.test(msg)) e.code = "storage/retry-limit-exceeded";
  else e.code = (err && err.code) || "storage/unknown";
  return e;
}

const songFrom = (x) => ({
  id: x.id, ownerUid: x.owner_uid, ownerName: x.owner_name || "", title: x.title, artist: x.artist,
  visibility: x.visibility, audioPath: x.audio_path, coverPath: x.cover_path || "",
  size: x.size || 0, createdAt: x.created_at ? new Date(x.created_at).getTime() : Date.now()
});

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

  /* ---------- músicas enviadas (Supabase Storage bucket "songs" + tabela user_songs) ---------- */

  /* envia o MP3 (e a capa), depois grava os dados. Se algo falhar, apaga o que já subiu.
     O Supabase não informa progresso de envio, então a barra anda por etapas. */
  async uploadSong(opts, onProgress, ctl){

    const uid = currentUid();
    if (!uid){ const e = new Error("Sem login"); e.code = "unauthenticated"; throw e; }

    const sb = await useSupabase();
    const id = crypto.randomUUID();
    const audioPath = uid + "/" + id + ".mp3";
    const coverPath = opts.cover ? uid + "/" + id + ".jpg" : "";
    const sent = [];
    ctl = ctl || {};
    ctl.cancel = () => { ctl.cancelled = true; };

    const stop = () => {
      if (ctl.cancelled){ const e = new Error("Cancelado"); e.code = "storage/canceled"; throw e; }
    };

    try{
      stop();
      if (onProgress) onProgress(0.05);
      const a = await sb.storage.from("songs").upload(audioPath, opts.file, { contentType: "audio/mpeg", upsert: false });
      if (a.error) throw sbFail(a.error);
      sent.push(audioPath);
      if (onProgress) onProgress(0.85);
      stop();

      if (opts.cover){
        const c = await sb.storage.from("songs").upload(coverPath, opts.cover, { contentType: "image/jpeg", upsert: false });
        if (c.error) throw sbFail(c.error);
        sent.push(coverPath);
      }
      if (onProgress) onProgress(0.95);
      stop();

      const r = await sb.from("user_songs").insert({
        id, owner_uid: uid, owner_name: opts.ownerName, title: opts.title, artist: opts.artist,
        visibility: opts.visibility, audio_path: audioPath, cover_path: coverPath, size: opts.file.size
      });
      if (r.error) throw sbFail(r.error);
      if (onProgress) onProgress(1);
    }catch(err){
      /* não deixa arquivo órfão para trás */
      if (sent.length){ try{ await sb.storage.from("songs").remove(sent); }catch(e){} }
      throw err;
    }
    return id;
  },

  async listMySongs(uid){
    const sb = await useSupabase();
    const { data, error } = await sb.from("user_songs").select("*").eq("owner_uid", uid)
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw sbFail(error);
    return (data || []).map(songFrom);
  },

  async listPublicSongs(uid){
    const sb = await useSupabase();
    const { data, error } = await sb.from("user_songs").select("*").eq("owner_uid", uid).eq("visibility", "public")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw sbFail(error);
    return (data || []).map(songFrom);
  },

  /* músicas públicas de todo mundo (mais novas primeiro) */
  async listCommunitySongs(max){
    const sb = await useSupabase();
    const { data, error } = await sb.from("user_songs").select("*").eq("visibility", "public")
      .order("created_at", { ascending: false }).limit(max || 40);
    if (error) throw sbFail(error);
    return (data || []).map(songFrom);
  },

  async searchCommunitySongs(text, max){
    const sb = await useSupabase();
    const t = String(text).replace(/[%_,()\\*]/g, " ").trim().slice(0, 40);
    if (!t) return [];
    const { data, error } = await sb.from("user_songs").select("*").eq("visibility", "public")
      .or("title.ilike.%" + t + "%,artist.ilike.%" + t + "%")
      .order("created_at", { ascending: false }).limit(max || 20);
    if (error) throw sbFail(error);
    return (data || []).map(songFrom);
  },

  async updateSong(id, patch){
    const sb = await useSupabase();
    const p = {};
    if (patch.title) p.title = patch.title;
    if (patch.artist) p.artist = patch.artist;
    if (patch.ownerName) p.owner_name = patch.ownerName;
    if (patch.visibility) p.visibility = patch.visibility;
    const { error } = await sb.from("user_songs").update(p).eq("id", id);
    if (error) throw sbFail(error);
  },

  /* apaga primeiro os arquivos e só depois o registro: se algo falhar no meio, dá para tentar de novo */
  async deleteSong(song){
    const sb = await useSupabase();
    const paths = [song.audioPath, song.coverPath].filter(Boolean);
    const rm = await sb.storage.from("songs").remove(paths);
    if (rm.error) throw sbFail(rm.error);
    const { error } = await sb.from("user_songs").delete().eq("id", song.id);
    if (error) throw sbFail(error);
  },

  async getFileBlob(path){
    const sb = await useSupabase();
    const { data, error } = await sb.storage.from("songs").download(path);
    if (error) throw sbFail(error);
    return data;
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
        return {
          id: d.id,
          from: x.from,
          text: x.text || "",
          type: x.type || "text",
          image: x.image || "",
          audio: x.audio || "",
          dur: x.dur || 0,
          alt: x.alt || "",
          at: ms(x.at)
        };
      }));
    }, onError);
  },

  subscribeCallSession(chatId, onData, onError){
    return onSnapshot(doc(db, "callSessions", chatId), (snap) => {
      onData(snap.exists() ? snap.data() : null);
    }, onError);
  },

  /* replace=true começa uma chamada nova do zero (apaga sinais e resposta da chamada anterior) */
  async upsertCallSession(chatId, patch, replace){
    const ref = doc(db, "callSessions", chatId);
    const data = Object.assign({ members: chatId.split("_"), updatedAt: Date.now() }, patch);
    if (replace) data.events = [];
    await setDoc(ref, data, replace ? undefined : { merge: true });
  },

  /* arrayUnion: dois lados mandando candidatos ao mesmo tempo não se sobrescrevem */
  async pushCallEvent(chatId, event){
    const ref = doc(db, "callSessions", chatId);
    const ev = Object.assign({ id: crypto.randomUUID(), at: Date.now() }, event);
    await setDoc(ref, { members: chatId.split("_"), events: arrayUnion(ev), updatedAt: Date.now() }, { merge: true });
  },

  async clearCallSession(chatId){
    await deleteDoc(doc(db, "callSessions", chatId));
  },

  async sendMessage(chatId, members, from, text, meta = {}){
    const payload = {
      from,
      type: meta.type || "text",
      at: serverTimestamp()
    };

    if (meta.type === "sticker"){
      payload.image = meta.image || "";
      payload.alt = meta.alt || "figurinha";
      payload.text = "";
    } else if (meta.type === "audio") {
      payload.audio = meta.audio || "";
      payload.dur = Number(meta.dur) || 0;
      payload.alt = meta.alt || "audio";
      payload.text = "";
    } else {
      payload.text = (text || "").slice(0, 500);
    }

    const b = writeBatch(db);
    b.set(doc(db, "chats", chatId), {
      members,
      lastText: payload.type === "sticker" ? "Figurinha" : payload.type === "audio" ? "Áudio" : (payload.text || "").slice(0, 80),
      lastFrom: from,
      lastAt: serverTimestamp()
    }, { merge: true });
    b.set(doc(collection(db, "chats", chatId, "messages")), payload);
    await b.commit();
  }
};

window.dispatchEvent(new Event("nox-db-ready"));
