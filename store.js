/* =========================================================
   NOXIFY — store.js
   Nox Coins (NC), Noxify Store, Inventário, Carteira, missões
   e a aparência (molduras, nomes, emblemas, banners, efeitos, temas).

   Regra de ouro: este arquivo NUNCA decide saldo nem compra.
   Ele só pede ao servidor (api/coins.js) e mostra a resposta.
   O saldo vem do Firebase, guardado pelo servidor.
========================================================= */

/* ---------- aparência dos itens (o PREÇO e a posse ficam no servidor) ---------- */
const COS_BANNERS = {
  bn_neon:     "radial-gradient(circle at 18% 30%,#e879f9,transparent 50%),radial-gradient(circle at 82% 70%,#7c3aed,transparent 55%),linear-gradient(135deg,#1a0633,#0b0614)",
  bn_aurora:   "linear-gradient(115deg,#064e3b,#10b981 25%,#22d3ee 50%,#8b5cf6 75%,#ec4899)",
  bn_cosmic:   "radial-gradient(circle at 12% 25%,#fff 0 1px,transparent 2px),radial-gradient(circle at 60% 20%,#fff 0 1px,transparent 2px),radial-gradient(circle at 80% 70%,#fff 0 1.5px,transparent 2.5px),radial-gradient(circle at 35% 75%,#fff 0 1px,transparent 2px),radial-gradient(circle at 70% 40%,rgba(236,72,153,.55),transparent 45%),linear-gradient(160deg,#020617,#312e81 55%,#581c87)",
  bn_futur:    "repeating-linear-gradient(0deg,rgba(34,211,238,.28) 0 1px,transparent 1px 20px),repeating-linear-gradient(90deg,rgba(34,211,238,.28) 0 1px,transparent 1px 20px),linear-gradient(135deg,#031525,#0b1b3a 60%,#1e1b4b)",
  bn_abstract: "radial-gradient(circle at 20% 80%,#f472b6 0 18%,transparent 19%),radial-gradient(circle at 78% 25%,#38bdf8 0 22%,transparent 23%),radial-gradient(circle at 55% 65%,#a78bfa 0 14%,transparent 15%),linear-gradient(135deg,#1e1b4b,#4c1d95)",
  bn_special:  "linear-gradient(120deg,#2e1065,#6d28d9 30%,#fbbf24 52%,#6d28d9 74%,#2e1065)"
};

const COS_THEMES = {
  th_midnight: { "--bg": "#070b14", "--surface": "#0f1626", "--surface2": "#18223a", "--accent": "#38bdf8", "--accent2": "#7dd3fc", "--accent-deep": "#0369a1", sw: ["#070b14", "#38bdf8", "#18223a"] },
  th_rose:     { "--bg": "#12060d", "--surface": "#1f0f19", "--surface2": "#2e1624", "--accent": "#f472b6", "--accent2": "#f9a8d4", "--accent-deep": "#be185d", sw: ["#12060d", "#f472b6", "#2e1624"] },
  th_matrix:   { "--bg": "#050d07", "--surface": "#0c1a10", "--surface2": "#14281a", "--accent": "#22c55e", "--accent2": "#86efac", "--accent-deep": "#15803d", sw: ["#050d07", "#22c55e", "#14281a"] },
  th_gold:     { "--bg": "#0e0b05", "--surface": "#1a150a", "--surface2": "#292010", "--accent": "#eab308", "--accent2": "#fde047", "--accent-deep": "#a16207", sw: ["#0e0b05", "#eab308", "#292010"] }
};
const THEME_DEFAULT = { "--bg": "#0d0a12", "--surface": "#181321", "--surface2": "#231c30", "--accent": "#a855f7", "--accent2": "#c084fc", "--accent-deep": "#6d28d9" };

/* Emblema do dono: coroa com 3 joias sobre um medalhão roxo com o N, e duas asas de penas douradas.
   É montado por código (cada pena é calculada) e cada desenho usa ids próprios nos degradês. */
let __bdN = 0;
function ownerBadge(){
  const u = "ob" + (++__bdN);
  const feather = (a, L, W, fill) =>
    '<path transform="translate(23 22) rotate(' + a + ')" fill="' + fill + '" stroke="#7c4a0b" stroke-width=".45" stroke-linejoin="round" ' +
    'd="M0 0C' + (L * .25) + ' ' + (-W) + ' ' + (L * .75) + ' ' + (-W * .9) + ' ' + L + ' 0C' + (L * .78) + ' ' + (W * .75) + ' ' + (L * .3) + ' ' + (W * .8) + ' 0 0z"/>';
  const vein = (a, L) => '<path transform="translate(23 22) rotate(' + a + ')" d="M2 0H' + (L * .85) + '" stroke="#fff6c8" stroke-opacity=".55" stroke-width=".35" stroke-linecap="round"/>';
  const long  = [[236, 21, 4.6], [219, 23, 4.6], [203, 22.5, 4.4], [188, 20, 4.2], [173, 16.5, 3.8], [160, 12, 3.2]];
  const short = [[228, 12, 3.4], [208, 13, 3.4], [190, 11.5, 3.2], [172, 9, 2.8]];
  const wing =
    long.map((f) => feather(f[0], f[1], f[2], "url(#" + u + "g)")).join("") +
    short.map((f) => feather(f[0], f[1], f[2], "url(#" + u + "l)")).join("") +
    long.slice(0, 4).map((f) => vein(f[0], f[1])).join("");
  return '<defs>' +
    '<linearGradient id="' + u + 'g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8791a"/><stop offset=".55" stop-color="#f5b82e"/><stop offset="1" stop-color="#fff3b0"/></linearGradient>' +
    '<linearGradient id="' + u + 'l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9962b"/><stop offset="1" stop-color="#fff9d6"/></linearGradient>' +
    '<linearGradient id="' + u + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#fbbf24"/><stop offset="1" stop-color="#b8791a"/></linearGradient>' +
    '<radialGradient id="' + u + 'm" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="#c084fc"/><stop offset=".6" stop-color="#6d28d9"/><stop offset="1" stop-color="#2e1065"/></radialGradient>' +
    '</defs>' +
    '<g>' + wing + '</g>' +
    '<g transform="matrix(-1 0 0 1 64 0)">' + wing + '</g>' +
    /* medalhão */
    '<circle cx="32" cy="24" r="10.6" fill="url(#' + u + 'm)" stroke="url(#' + u + 'c)" stroke-width="1.7"/>' +
    '<circle cx="32" cy="24" r="8.6" fill="none" stroke="#fff3b0" stroke-opacity=".35" stroke-width=".4"/>' +
    '<path d="M27.4 29.4V18.8h2.3l5.1 6.9v-6.9h2.4v10.6h-2.3l-5.1-6.9v6.9z" fill="#fff" stroke="#2e1065" stroke-width=".35" stroke-linejoin="round"/>' +
    /* coroa */
    '<path d="M24.4 14.6L25.6 7.4 29 11.3 32 4.8 35 11.3 38.4 7.4 39.6 14.6z" fill="url(#' + u + 'c)" stroke="#7c4a0b" stroke-width=".5" stroke-linejoin="round"/>' +
    '<rect x="24.2" y="13.9" width="15.6" height="2.4" rx="1.1" fill="url(#' + u + 'c)" stroke="#7c4a0b" stroke-width=".5"/>' +
    '<circle cx="25.6" cy="6.6" r="1.15" fill="#67e8f9" stroke="#0e7490" stroke-width=".3"/>' +
    '<circle cx="32" cy="4" r="1.4" fill="#f0abfc" stroke="#a21caf" stroke-width=".3"/>' +
    '<circle cx="38.4" cy="6.6" r="1.15" fill="#67e8f9" stroke="#0e7490" stroke-width=".3"/>' +
    '<circle cx="32" cy="15.1" r=".7" fill="#fff"/>';
}

const BADGE_SVG = {
  bd_rookie:   ["#4ade80", "M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"],
  bd_listener: ["#38bdf8", "M12 3a9 9 0 0 0-9 9v6a3 3 0 0 0 3 3h1v-8H5v-1a7 7 0 0 1 14 0v1h-2v8h1a3 3 0 0 0 3-3v-6a9 9 0 0 0-9-9z"],
  bd_group:    ["#f472b6", "M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.6 0-1 .1 1.2.8 2 2 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z"],
  bd_fire7:    ["#fb923c", "M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4 0-7 1-10z"],
  bd_star:     ["#c084fc", "M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z"],
  bd_crown:    ["#fbbf24", "M3 18h18v2H3zM3 7l5 4 4-6 4 6 5-4-2 9H5z"],
  bd_diamond:  ["#22d3ee", "M12 22L2 9l4-6h12l4 6z"],
  bd_owner:    { w: 64, h: 38, scale: 1.35, draw: ownerBadge }
};

const COS_KNOWN = /^(fr|fx|bn|nm|bd|th)_[a-z0-9]{2,20}$/;

/* ---------- aparência pública de qualquer pessoa (usada em social.js e groups.js) ---------- */
const Cos = {
  cache: {},
  ok: (id) => typeof id === "string" && COS_KNOWN.test(id),

  frameCls(cos){ return cos && cos.f && this.ok(cos.f) ? "fr fr-" + cos.f.slice(3) : ""; },
  nameCls(cos){ return cos && cos.n && this.ok(cos.n) ? "nmx nm-" + cos.n.slice(3) : ""; },
  bannerCss(cos){ return cos && cos.b && COS_BANNERS[cos.b] ? COS_BANNERS[cos.b] : ""; },

  badgeSvg(id, size){
    const b = BADGE_SVG[id]; if (!b) return "";
    const s = size || 16;
    if (!Array.isArray(b)){                     // emblema desenhado por código (ex.: dono)
      const h = Math.round(s * (b.scale || 1)), w = Math.round(h * b.w / b.h);
      return '<svg class="bdg-svg bdg-wide" width="' + w + '" height="' + h + '" viewBox="0 0 ' + b.w + " " + b.h + '" aria-hidden="true">' + b.draw() + "</svg>";
    }
    return '<svg class="bdg-svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="' + b[0] + '" aria-hidden="true"><path d="' + b[1] + '"/></svg>';
  },
  badgeHtml(cos){
    if (!cos || !cos.d || !BADGE_SVG[cos.d]) return "";
    return '<i class="bdg" title="Emblema">' + this.badgeSvg(cos.d, 15) + "</i>";
  },

  /* põe/tira a moldura de um elemento de avatar */
  frame(el, cos){
    if (!el) return;
    Array.from(el.classList).forEach((c) => { if (c === "fr" || c.startsWith("fr-")) el.classList.remove(c); });
    const c = this.frameCls(cos);
    if (c) c.split(" ").forEach((x) => el.classList.add(x));
  },
  /* estilo + emblema no nome (só aparência: o texto continua o mesmo) */
  name(el, cos){
    if (!el) return;
    Array.from(el.classList).forEach((c) => { if (c === "nmx" || c.startsWith("nm-")) el.classList.remove(c); });
    const c = this.nameCls(cos);
    if (c) c.split(" ").forEach((x) => el.classList.add(x));
    const old = el.querySelector(":scope > .bdg"); if (old) old.remove();
    const b = this.badgeHtml(cos);
    if (b) el.insertAdjacentHTML("beforeend", b);
  }
};


const Store = (() => {

  const CAT_NAMES = { frame: "Molduras", effect: "Efeitos", banner: "Banners", name: "Estilos de nome", badge: "Emblemas", theme: "Temas" };
  const CAT_ONE = { frame: "Moldura", effect: "Efeito", banner: "Banner", name: "Estilo de nome", badge: "Emblema", theme: "Tema" };
  const CATS = Object.keys(CAT_NAMES);
  const DEFAULT_OF = { frame: "fr_default", effect: "fx_none", banner: "", name: "nm_default", badge: "bd_none", theme: "th_default" };

  const S = { data: null, at: 0, tab: "shop", cat: "frame", icat: "", busy: false, err: "", loading: false, focus: "" };

  const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR");
  const coin = (px) => '<svg class="nc-ic" width="' + (px || 16) + '" height="' + (px || 16) + '" aria-hidden="true"><use href="#i-nc"/></svg>';
  const itemOf = (id) => ((S.data && S.data.items) || []).find((i) => i.id === id);
  const owns = (it) => !!it && (it.free || (S.data && S.data.owned.includes(it.id)));
  const equipped = (it) => {
    const eq = (S.data && S.data.equip) || {};
    const cur = eq[it.cat];
    return cur ? cur === it.id : it.id === DEFAULT_OF[it.cat];
  };

  /* ---------- servidor ---------- */
  async function api(action, extra){
    const u = window.auth && window.auth.currentUser;
    if (!u) throw Object.assign(new Error("Entre na sua conta, com internet, para usar a Store."), { code: "auth" });
    let r;
    try{
      const token = await u.getIdToken();
      r = await fetch("/api/coins", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(Object.assign({ action }, extra || {}))
      });
    }catch(e){ throw Object.assign(new Error("Sem conexão com o servidor. Tente de novo com internet."), { code: "net" }); }
    let j = {}; try{ j = await r.json(); }catch(e){}
    if (!r.ok){
      const msg = j.code === "config" ? "A Store ainda não foi configurada no servidor (falta a chave do Firebase na Vercel)."
        : r.status === 404 ? "A Store não está publicada ainda (falta o arquivo api/coins.js no GitHub)."
        : (j.error || "Não foi possível falar com o servidor.");
      throw Object.assign(new Error(msg), { code: j.code || "http" });
    }
    return j;
  }

  async function load(force){
    if (!force && S.data && Date.now() - S.at < 20000) return S.data;
    S.loading = true;
    try{
      S.data = await api("state");
      S.at = Date.now(); S.err = "";
      Cos.cache[uidNow()] = ownCos();
    }catch(e){ S.err = e.message; }
    S.loading = false;
    paintBalance();
    applyAll();
    /* se a pessoa abriu a Store enquanto isso carregava, desenha agora (senão ficava em "Carregando…") */
    const v = document.getElementById("view-store");
    if (v && !v.hidden) render();
    return S.data;
  }

  const uidNow = () => (window.auth && window.auth.currentUser && window.auth.currentUser.uid) || "";

  function ownCos(){
    const eq = (S.data && S.data.equip) || {};
    const k = (id, d) => (id && id !== d ? id : "");
    return { f: k(eq.frame, "fr_default"), b: eq.banner || "", n: k(eq.name, "nm_default"), d: k(eq.badge, "bd_none") };
  }

  /* ---------- saldo (perfil e Store) ---------- */
  function paintBalance(){
    const has = !!S.data;
    const t = has ? fmt(S.data.wallet.balance) : "–";
    document.querySelectorAll("[data-nc-bal]").forEach((el) => { el.textContent = t; });
  }

  /* ---------- aplica a aparência equipada no app ---------- */
  function applyAll(){
    if (!S.data) return;
    const eq = S.data.equip || {};
    applyTheme(eq.theme);
    applyEffect(eq.effect);
    decorateProfile();
  }

  function applyTheme(id){
    const root = document.documentElement;
    const th = COS_THEMES[id];
    const vars = th || THEME_DEFAULT;
    Object.keys(THEME_DEFAULT).forEach((k) => root.style.setProperty(k, vars[k]));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", vars["--bg"]);
  }

  /* camada global de efeitos: não recebe toque, fica atrás dos botões e é leve */
  function fxMarkup(id){
    const n = id === "fx_particles" ? 5 : id === "fx_lightning" ? 3 : 4;
    return ["tl", "tr", "bl", "br"].map((c) => '<div class="fxc ' + c + '">' + "<i></i>".repeat(n) + "</div>").join("");
  }
  function applyEffect(id){
    const layer = $("fxLayer"); if (!layer) return;
    const off = !id || id === "fx_none" || !COS_KNOWN.test(id);
    layer.dataset.fx = off ? "" : id.slice(3);
    layer.innerHTML = off ? "" : fxMarkup(id);
    layer.hidden = off;
  }

  /* leve em aparelho fraco / "reduzir animações" */
  (function perf(){
    const weak = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 2);
    const calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (weak || calm) document.documentElement.classList.add("lite");
    document.addEventListener("visibilitychange", () => document.documentElement.classList.toggle("fx-pause", document.hidden));
  })();

  /* perfil: moldura, estilo do nome, emblema, banner e saldo */
  function decorateProfile(){
    const cos = S.data ? ownCos() : null;
    const av = $("profileAvatar"), nm = $("profileName");
    if (av) Cos.frame(av, cos);
    if (nm){ nm.textContent = (typeof userName === "function" ? userName() : nm.textContent); Cos.name(nm, cos); }
    const bn = $("profileBanner");
    const css = cos && Cos.bannerCss(cos);
    if (bn && css) bn.style.background = css;
  }

  /* ---------- atividade que rende missões ---------- */
  let listenTimer = 0;
  function trackListen(key){
    clearTimeout(listenTimer);
    if (!key || !uidNow()) return;
    listenTimer = setTimeout(() => {
      /* só conta se a música continuou tocando por 20 s */
      if (typeof current !== "undefined" && current && current.src === key && typeof audio !== "undefined" && !audio.paused){
        api("event", { type: "listen", key: String(key) }).then(() => { if (S.data) S.at = 0; }).catch(() => {});
      }
    }, 20000);
  }
  function trackPlaylist(){
    if (!uidNow()) return;
    api("event", { type: "playlist" }).then(() => { if (S.data) S.at = 0; }).catch(() => {});
  }

  /* ---------- previews ---------- */
  function meAvatarStyle(){
    const p = typeof Profile !== "undefined" ? Profile.get() : {};
    const ph = p.photo && typeof photoCss === "function" ? photoCss(p.photo) : "";
    if (ph) return { bg: ph, ch: "" };
    const [c1, c2] = (typeof AVATAR_COLORS !== "undefined" && typeof avatarIndex === "function") ? AVATAR_COLORS[avatarIndex()] : ["#c084fc", "#7c3aed"];
    return { bg: "linear-gradient(135deg," + c1 + "," + c2 + ")", ch: (typeof userName === "function" ? userName() : "N").charAt(0).toUpperCase() };
  }

  function preview(it){
    switch (it.cat){
      case "frame": {
        const a = meAvatarStyle();
        return '<span class="st-av ' + (it.id === "fr_default" ? "" : "fr fr-" + it.id.slice(3)) + '" style="background:' + a.bg + '">' + esc(a.ch) + "</span>";
      }
      case "banner":
        return '<div class="st-bn" style="background:' + (COS_BANNERS[it.id] || "") + '"></div>';
      case "name":
        return '<span class="st-nm ' + (it.id === "nm_default" ? "" : "nmx nm-" + it.id.slice(3)) + '">' + esc(typeof userName === "function" ? userName() : "Seu nome") + "</span>";
      case "badge":
        return it.id === "bd_none" ? '<span class="st-none">—</span>' : '<span class="st-bd">' + Cos.badgeSvg(it.id, 38) + "</span>";
      case "effect":
        return it.id === "fx_none" ? '<span class="st-none">—</span>' : '<div class="st-fx fxbox" data-fx="' + it.id.slice(3) + '">' + fxMarkup(it.id) + "</div>";
      case "theme": {
        const sw = (COS_THEMES[it.id] || { sw: ["#0d0a12", "#a855f7", "#231c30"] }).sw;
        return '<div class="st-th">' + sw.map((c) => '<i style="background:' + c + '"></i>').join("") + "</div>";
      }
    }
    return "";
  }

  /* ---------- telas ---------- */
  function render(){
    const box = $("storeBody"); if (!box) return;
    document.querySelectorAll("[data-st-tab]").forEach((b) => b.classList.toggle("active", b.dataset.stTab === S.tab));
    paintBalance();

    if (!S.data){
      box.innerHTML = '<div class="empty">' + (S.err ? esc(S.err) + '<br><br><button class="pill-btn small" data-st="retry">Tentar de novo</button>' : "Carregando…") + "</div>";
      if (!S.err && !S.loading) load(true).then(render);
      return;
    }
    if (S.tab === "shop") box.innerHTML = shopHtml();
    else if (S.tab === "inv") box.innerHTML = invHtml();
    else box.innerHTML = walletHtml();

    if (S.focus){
      const el = box.querySelector('[data-id="' + S.focus + '"]');
      if (el){ el.scrollIntoView({ block: "center" }); el.classList.add("flash"); }
      S.focus = "";
    }
  }

  const catTabs = (cur, attr) => '<div class="st-cats">' + CATS.map((c) =>
    '<button class="st-cat' + (c === cur ? " active" : "") + '" ' + attr + '="' + c + '">' + CAT_NAMES[c] + "</button>").join("") + "</div>";

  function shopHtml(){
    const items = S.data.items.filter((i) => i.cat === S.cat && !i.free);
    return catTabs(S.cat, "data-st-cat") +
      '<div class="st-grid">' + items.map((it) => {
        const own = owns(it), eq = own && equipped(it);
        let act;
        if (eq) act = '<span class="st-tag eq">Equipado</span><button class="st-btn ghost" data-st="inv" data-id="' + it.id + '">Inventário</button>';
        else if (own) act = '<span class="st-tag own">Adquirido</span><button class="st-btn" data-st="equip" data-id="' + it.id + '">Equipar</button>';
        else if (it.src === "owner") act = '<span class="st-tag lock">Exclusivo do dono</span>';
        else if (it.src) act = '<span class="st-tag lock">Só em missões</span>';
        else act = '<span class="st-price">' + coin(15) + fmt(it.price) + '</span><button class="st-btn" data-st="buy" data-id="' + it.id + '">Comprar</button>';
        return '<div class="st-card' + (eq ? " is-eq" : "") + '" data-id="' + it.id + '">' +
          '<div class="st-prev ' + it.cat + '">' + preview(it) + "</div>" +
          '<div class="st-name">' + esc(it.name) + '</div><div class="st-desc">' + esc(it.desc) + "</div>" +
          '<div class="st-foot">' + act + "</div></div>";
      }).join("") + "</div>";
  }

  function invHtml(){
    const cats = S.icat ? [S.icat] : CATS;
    const sections = cats.map((c) => {
      const items = S.data.items.filter((i) => i.cat === c && owns(i));
      const real = items.filter((i) => !i.free);
      if (!items.length) return "";
      return '<div class="st-isec"><h3>' + CAT_NAMES[c] + ' <small>' + real.length + "</small></h3><div class=\"st-grid\">" + items.map((it) => {
        const eq = equipped(it);
        const canRemove = eq && it.id !== DEFAULT_OF[it.cat];
        return '<div class="st-card' + (eq ? " is-eq" : "") + '" data-id="' + it.id + '">' +
          '<div class="st-prev ' + it.cat + '">' + preview(it) + "</div>" +
          '<div class="st-name">' + esc(it.name) + '</div><div class="st-desc">' + CAT_ONE[it.cat] + "</div>" +
          '<div class="st-foot">' + (eq ? '<span class="st-tag eq">Equipado</span>' : "") +
          (canRemove ? '<button class="st-btn ghost" data-st="unequip" data-cat="' + it.cat + '">Remover</button>'
            : eq ? "" : '<button class="st-btn" data-st="equip" data-id="' + it.id + '">Equipar</button>') + "</div></div>";
      }).join("") + "</div></div>";
    }).join("");
    const bannerNote = '<p class="st-note">Banners: se nenhum estiver equipado, vale a sua capa do perfil (foto ou a que você já escolheu).</p>';
    const any = S.data.owned.length;
    return '<div class="st-cats"><button class="st-cat' + (!S.icat ? " active" : "") + '" data-st-icat="">Tudo</button>' + CATS.map((c) =>
      '<button class="st-cat' + (c === S.icat ? " active" : "") + '" data-st-icat="' + c + '">' + CAT_NAMES[c] + "</button>").join("") + "</div>" +
      (any ? "" : '<div class="empty">Você ainda não comprou nada. Veja a aba <b>Loja</b>.</div>') + sections + bannerNote;
  }

  function dayLabel(ms){
    const d = new Date(ms);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function walletHtml(){
    const d = S.data, w = d.wallet, dl = d.daily;
    const done = dl.claimedToday ? ((dl.streak - 1) % 7) + 1 : (dl.streak % 7);
    const strip = dl.table.map((v, i) => {
      const st = i < done ? "done" : (i === done && !dl.claimedToday ? "today" : "");
      return '<div class="dy ' + st + '"><small>Dia ' + (i + 1) + "</small>" + coin(14) + "<b>" + v + "</b></div>";
    }).join("");

    const missions = d.missions.map((m) => {
      const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
      const ready = m.progress >= m.target && !m.claimed;
      return '<div class="ms' + (m.claimed ? " is-done" : "") + '"><div class="ms-top"><div><b>' + esc(m.name) + "</b><small>" + esc(m.desc) + (m.period === "day" ? " · diária" : "") + "</small></div>" +
        '<span class="ms-rw">' + coin(14) + "+" + m.reward + "</span></div>" +
        '<div class="ms-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="ms-bot"><small>' + Math.min(m.progress, m.target) + " / " + m.target + "</small>" +
        (m.claimed ? '<span class="st-tag eq">Resgatada</span>' : '<button class="st-btn" data-st="mission" data-id="' + m.id + '"' + (ready ? "" : " disabled") + ">Resgatar</button>") + "</div></div>";
    }).join("");

    const tx = d.tx.length ? d.tx.map((t) =>
      '<div class="tx"><div><b class="' + (t.amt >= 0 ? "pos" : "neg") + '">' + (t.amt >= 0 ? "+" : "−") + fmt(Math.abs(t.amt)) + " NC</b><span> — " + esc(t.desc) + "</span></div><small>" + dayLabel(t.at) + "</small></div>"
    ).join("") : '<div class="empty">Nenhuma transação ainda. Resgate sua primeira recompensa!</div>';

    const hist = dl.history.length ? dl.history.map((h) =>
      '<div class="tx"><div><b class="pos">+' + h.reward + " NC</b><span> — Dia " + (((h.streak - 1) % 7) + 1) + " da sequência</span></div><small>" + h.date.split("-").reverse().join("/") + "</small></div>").join("")
      : '<div class="empty">Nenhum resgate ainda.</div>';

    return '<div class="wl-hero"><span class="wl-coin">' + coin(54) + '</span><div><small>Saldo atual</small><b>' + fmt(w.balance) + ' <em>NC</em></b></div></div>' +
      '<div class="wl-two"><div><small>Recebidas</small><b class="pos">+' + fmt(w.earned) + '</b></div><div><small>Gastas</small><b class="neg">−' + fmt(w.spent) + "</b></div></div>" +

      '<h3 class="st-h">Recompensa diária</h3><div class="dl-box"><div class="dl-strip">' + strip + "</div>" +
      '<div class="dl-info"><span>Sequência: <b>' + dl.streak + (dl.streak === 1 ? " dia" : " dias") + "</b></span><span>" +
      (dl.claimedToday ? "Amanhã: <b>+" + dl.next + " NC</b>" : "Hoje: <b>+" + dl.next + " NC</b>") + "</span></div>" +
      '<button class="st-btn big" data-st="daily"' + (dl.claimedToday ? " disabled" : "") + ">" + (dl.claimedToday ? "Já resgatado hoje ✓" : "Resgatar +" + dl.next + " NC") + "</button>" +
      '<p class="st-note">O dia vira à meia-noite, no horário de Brasília. Se você pular um dia, a sequência volta ao dia 1.</p></div>' +

      '<h3 class="st-h">Missões</h3><div class="ms-list">' + missions + "</div>" +
      '<h3 class="st-h">Histórico de transações</h3><div class="tx-list">' + tx + "</div>" +
      '<h3 class="st-h">Histórico de resgates diários</h3><div class="tx-list">' + hist + "</div>";
  }

  /* ---------- ações ---------- */
  async function run(fn){
    if (S.busy) return;
    S.busy = true;
    try{ await fn(); }
    catch(e){ showToast(e.message || "Algo deu errado."); }
    S.busy = false;
  }

  async function doBuy(id){
    const it = itemOf(id); if (!it) return;
    if (S.data.wallet.balance < it.price){ showToast("Saldo insuficiente: faltam " + fmt(it.price - S.data.wallet.balance) + " NC."); return; }
    if (!(await askConfirm("Comprar “" + it.name + "” por " + fmt(it.price) + " NC?", "Comprar"))) return;
    await api("buy", { id });
    await load(true);
    showToast("Comprado: " + it.name + " ✓");
    render();
  }

  async function doEquip(id){
    const r = await api("equip", { id });
    S.data.equip = r.equip; S.at = Date.now();
    Cos.cache[uidNow()] = ownCos();
    applyAll(); refreshOthers(); render();
    showToast("Equipado ✓");
  }
  async function doUnequip(cat){
    const r = await api("unequip", { cat });
    S.data.equip = r.equip; S.at = Date.now();
    Cos.cache[uidNow()] = ownCos();
    applyAll(); refreshOthers(); render();
    showToast("Removido");
  }
  async function doDaily(){
    const r = await api("daily");
    await load(true);
    showToast("+" + r.reward + " NC! Sequência: " + r.streak + (r.streak === 1 ? " dia" : " dias"));
    render();
  }
  async function doMission(id){
    const r = await api("mission", { id });
    await load(true);
    showToast("Missão concluída: +" + r.reward + " NC" + (r.item ? " e um emblema novo!" : ""));
    render();
  }

  /* depois de equipar, atualiza o que já está desenhado em outras telas */
  function refreshOthers(){
    if (typeof renderProfile === "function" && typeof currentView !== "undefined" && currentView === "profile") renderProfile();
  }

  function onClick(e){
    const t = e.target.closest("[data-st],[data-st-tab],[data-st-cat],[data-st-icat],.st-card");
    if (!t) return;
    if (t.dataset.stTab){ S.tab = t.dataset.stTab; render(); window.scrollTo(0, 0); return; }
    if (t.dataset.stCat){ S.cat = t.dataset.stCat; render(); return; }
    if (t.dataset.stIcat !== undefined && t.hasAttribute("data-st-icat")){ S.icat = t.dataset.stIcat; render(); return; }
    const a = t.dataset.st;
    if (a === "retry"){ S.err = ""; load(true).then(render); render(); return; }
    if (a === "buy") return run(() => doBuy(t.dataset.id));
    if (a === "equip") return run(() => doEquip(t.dataset.id));
    if (a === "unequip") return run(() => doUnequip(t.dataset.cat));
    if (a === "daily") return run(doDaily);
    if (a === "mission") return run(() => doMission(t.dataset.id));
    if (a === "inv"){ const it = itemOf(t.dataset.id); S.tab = "inv"; S.icat = it ? it.cat : ""; S.focus = t.dataset.id; render(); return; }
    /* tocar num item que já é seu abre o inventário nele */
    if (t.classList.contains("st-card") && S.tab === "shop"){
      const it = itemOf(t.dataset.id);
      if (it && owns(it)){ S.tab = "inv"; S.icat = it.cat; S.focus = it.id; render(); }
    }
  }

  /* ---------- abrir a Store ---------- */
  function open(tab){
    S.tab = tab === "wallet" ? "wallet" : tab === "inv" ? "inv" : "shop";
    S.at = 0;
    showView("store");
  }

  function boot(){
    S.data = null; S.err = "";
    load(true);
  }
  function reset(){ S.data = null; S.at = 0; applyTheme(""); applyEffect(""); paintBalance(); }

  document.addEventListener("click", (e) => { if (e.target.closest("#view-store")) onClick(e); });

  return { open, render, boot, reset, load, trackListen, trackPlaylist, decorateProfile, ownCos, get data(){ return S.data; } };
})();
