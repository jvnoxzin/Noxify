/* =========================================================
   NOXIFY — db.js (Migrado para Supabase)
   Ligação com o Supabase (perfis públicos, seguidores, chat
   e armazenamento de músicas no Supabase Storage).
========================================================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configurações do seu projeto Supabase (URL e Anon Key Pública)
const SUPABASE_URL = "https://fjzodnouorrdlavnnvnv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sdUjknXEYe56HZtVaAmxcA_A2xyJnP9"; // Usando a chave pública segura

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const currentUid = () => (window.auth && window.auth.currentUser) ? window.auth.currentUser.uid : null;

// Função utilitária para converter os dados do Supabase para o formato do player Noxify
const songFrom = (x) => ({
  id: x.id,
  ownerUid: x.owner_uid,
  ownerName: x.owner_name || "",
  title: x.title,
  artist: x.artist,
  visibility: x.visibility,
  audioPath: x.audio_path,
  coverPath: x.cover_path || "",
  size: x.size || 0,
  createdAt: x.created_at ? new Date(x.created_at).getTime() : Date.now()
});

window.NoxDB = {

  chatId(a, b){ return [a, b].sort().join("_"); },

  /* ---------- perfis ---------- */
  async upsertUser(uid, data){
    const { error } = await supabase
      .from("users")
      .upsert({ uid, ...data, updated_at: new Date().toISOString() });
    if (error) throw error;
  },

  async getUser(uid){
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("uid", uid)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  },

  async searchUsers(prefix, max){
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .gte("name_lower", prefix)
      .lte("name_lower", prefix + "\uf8ff") // Busca prefixo
      .limit(max || 20);
    if (error) return [];
    return data;
  },

  /* ---------- nomes únicos ---------- */
  async isNameFree(lower, uid){
    const { data } = await supabase
      .from("usernames")
      .select("uid")
      .eq("name", lower)
      .maybeSingle();
    return !data || (!!uid && data.uid === uid);
  },

  async claimName(uid, lower){
    // Tenta reservar o nome
    const { error } = await supabase.from("usernames").upsert({ name: lower, uid });
    if (error) {
      if (error.code === '23505') { // Código de violação de unicidade no Postgres
         const e = new Error("name-taken"); e.code = "name-taken"; throw e;
      }
      throw error;
    }
  },

  /* ---------- músicas enviadas (Supabase Storage + Tabela user_songs) ---------- */

  async uploadSong(opts, onProgress, ctl){
    const uid = currentUid();
    if (!uid){ const e = new Error("Sem login"); e.code = "unauthenticated"; throw e; }

    const id = crypto.randomUUID(); // Gera um ID único para a música
    const audioPath = `${uid}/${id}.mp3`;
    const coverPath = opts.cover ? `${uid}/${id}.jpg` : "";
    ctl = ctl || {};

    try {
      // 1. Envia o áudio para o Bucket 'songs'
      if (ctl.cancelled) throw new Error("Cancelado");
      const { error: audioErr } = await supabase.storage
        .from("songs")
        .upload(audioPath, opts.file, { contentType: "audio/mpeg", upsert: false });
      
      if (audioErr) throw audioErr;
      if (onProgress) onProgress(0.9); // Progresso simulado

      // 2. Envia a capa se houver
      if (opts.cover) {
        if (ctl.cancelled) throw new Error("Cancelado");
        const { error: coverErr } = await supabase.storage
          .from("songs")
          .upload(coverPath, opts.cover, { contentType: "image/jpeg", upsert: false });
        if (coverErr) throw coverErr;
      }
      if (onProgress) onProgress(1); // Progresso simulado

      // 3. Salva os metadados na tabela 'user_songs'
      const { error: dbErr } = await supabase.from("user_songs").insert({
        id,
        owner_uid: uid,
        owner_name: opts.ownerName,
        title: opts.title,
        artist: opts.artist,
        visibility: opts.visibility,
        audio_path: audioPath,
        cover_path: coverPath,
        size: opts.file.size
      });

      if (dbErr) throw dbErr;
      return id;

    } catch (err) {
      // Limpeza caso dê erro no meio do processo
      await supabase.storage.from("songs").remove([audioPath, coverPath].filter(Boolean));
      throw err;
    }
  },

  async listMySongs(uid){
    const { data, error } = await supabase
      .from("user_songs")
      .select("*")
      .eq("owner_uid", uid)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []).map(songFrom);
  },

  async listPublicSongs(uid){
    const { data, error } = await supabase
      .from("user_songs")
      .select("*")
      .eq("owner_uid", uid)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []).map(songFrom);
  },

  async updateSong(id, patch){
    const dbPatch = {};
    if (patch.title) dbPatch.title = patch.title;
    if (patch.artist) dbPatch.artist = patch.artist;
    if (patch.ownerName) dbPatch.owner_name = patch.ownerName;
    if (patch.visibility) dbPatch.visibility = patch.visibility;

    const { error } = await supabase.from("user_songs").update(dbPatch).eq("id", id);
    if (error) throw error;
  },

  async deleteSong(song){
    // Remove os arquivos físicos
    for (const path of [song.audioPath, song.coverPath].filter(Boolean)){
      await supabase.storage.from("songs").remove([path]);
    }
    // Remove o registro do banco
    const { error } = await supabase.from("user_songs").delete().eq("id", song.id);
    if (error) throw error;
  },

  async getFileBlob(path){
    // Baixa o arquivo do storage (respeitando RLS) e retorna como Blob
    const { data, error } = await supabase.storage.from("songs").download(path);
    if (error) throw error;
    return data;
  },

  /* ---------- seguidores ---------- */
  async follow(me, other){
    await supabase.from("followers").upsert([
      { follower_id: me, following_id: other }
    ]);
  },

  async unfollow(me, other){
    await supabase.from("followers").delete().match({ follower_id: me, following_id: other });
  },

  async isFollowing(me, other){
    const { data } = await supabase
      .from("followers")
      .select("*")
      .eq("follower_id", me)
      .eq("following_id", other)
      .maybeSingle();
    return !!data;
  },

  async listFollow(uid, kind){
    if (kind === "followers") {
      const { data } = await supabase.from("followers").select("follower_id").eq("following_id", uid);
      return (data || []).map(x => x.follower_id);
    } else {
      const { data } = await supabase.from("followers").select("following_id").eq("follower_id", uid);
      return (data || []).map(x => x.following_id);
    }
  },

  async countFollow(uid, kind){
    const list = await this.listFollow(uid, kind);
    return list.length;
  },

  /* ---------- chat ---------- */
  subscribeChats(uid, onData, onError){
    // Assina mudanças na tabela de chats para atualizar em tempo real
    const channel = supabase.channel('changes_noxify_chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
        this._fetchChats(uid).then(onData).catch(onError);
      })
      .subscribe();

    this._fetchChats(uid).then(onData).catch(onError);
    return () => { supabase.removeChannel(channel); };
  },

  async _fetchChats(uid){
    const { data } = await supabase
      .from("chats")
      .select("*")
      .contains("members", [uid]);
    return (data || []).map(d => ({
      id: d.id,
      members: d.members || [],
      lastText: d.last_text || "",
      lastFrom: d.last_from || "",
      lastAt: d.last_at ? new Date(d.last_at).getTime() : Date.now()
    }));
  },

  subscribeMessages(chatId, onData, onError){
    // Assina novas mensagens inseridas neste chat específico
    const channel = supabase.channel(`messages:${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, () => {
        this._fetchMessages(chatId).then(onData).catch(onError);
      })
      .subscribe();

    this._fetchMessages(chatId).then(onData).catch(onError);
    return () => { supabase.removeChannel(channel); };
  },

  async _fetchMessages(chatId){
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("at", { ascending: true })
      .limit(150);
    return (data || []).map(m => ({
      id: m.id,
      from: m.sender_id,
      text: m.text,
      at: m.at ? new Date(m.at).getTime() : Date.now()
    }));
  },

  async sendMessage(chatId, members, from, text){
    const now = new Date().toISOString();
    // Insere a mensagem
    await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: from,
      text,
      at: now
    });

    // Atualiza o último texto da conversa (upsert para criar o chat se não existir)
    await supabase.from("chats").upsert({
      id: chatId,
      members,
      last_text: text.slice(0, 80),
      last_from: from,
      last_at: now
    });
  }
};

window.dispatchEvent(new Event("nox-db-ready"));
