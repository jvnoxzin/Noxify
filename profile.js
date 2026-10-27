/* =========================================================
   NOXIFY — profile.js
   Foto de perfil, banner e "sobre mim".
   Fotos são reduzidas no próprio aparelho (ficam pequenas)
   e guardadas junto da conta; o banner pode ser um do app
   ou uma foto importada.
========================================================= */

/* ---------- imagem -> texto (data URL), cortada no centro ---------- */
function imageToDataUrl(file, w, h, quality){
  return new Promise((resolve, reject) => {

    if (!file || !/^image\//.test(file.type)){
      reject(new Error("Escolha um arquivo de imagem."));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const c = canvas.getContext("2d");

      const scale = Math.max(w / img.width, h / img.height);
      const sw = w / scale, sh = h / scale;
      c.fillStyle = "#000";
      c.fillRect(0, 0, w, h);
      c.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);

      resolve(canvas.toDataURL("image/jpeg", quality || 0.82));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não consegui abrir essa imagem."));
    };

    img.src = url;
  });
}

/* só aceitamos imagens em base64 simples (dados de outras contas passam por aqui) */
const SAFE_IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/;

/* ---------- banners que já vêm no app ---------- */
const BANNERS = [
  { id: "aurora",  name: "Aurora",   css: "linear-gradient(120deg,#4c1d95,#7c3aed 45%,#22d3ee)" },
  { id: "neon",    name: "Neon",     css: "radial-gradient(circle at 20% 30%,#c026d3,transparent 55%),radial-gradient(circle at 80% 70%,#6d28d9,transparent 55%),#0b0614" },
  { id: "sunset",  name: "Pôr do sol", css: "linear-gradient(135deg,#7c3aed,#db2777 55%,#f59e0b)" },
  { id: "ocean",   name: "Oceano",   css: "linear-gradient(135deg,#0f172a,#1d4ed8 60%,#38bdf8)" },
  { id: "forest",  name: "Floresta", css: "linear-gradient(135deg,#052e16,#15803d 60%,#a3e635)" },
  { id: "flame",   name: "Chama",    css: "linear-gradient(135deg,#450a0a,#dc2626 55%,#fbbf24)" },
  { id: "galaxy",  name: "Galáxia",  css: "radial-gradient(circle at 15% 20%,rgba(255,255,255,.9) 0 1px,transparent 2px),radial-gradient(circle at 70% 35%,rgba(255,255,255,.8) 0 1px,transparent 2px),radial-gradient(circle at 45% 75%,rgba(255,255,255,.7) 0 1px,transparent 2px),radial-gradient(circle at 85% 80%,rgba(255,255,255,.9) 0 1px,transparent 2px),linear-gradient(160deg,#020617,#312e81 60%,#6d28d9)" },
  { id: "grid",    name: "Grade",    css: "repeating-linear-gradient(0deg,rgba(168,85,247,.25) 0 1px,transparent 1px 22px),repeating-linear-gradient(90deg,rgba(168,85,247,.25) 0 1px,transparent 1px 22px),linear-gradient(135deg,#1e0b3a,#0b0614)" },
  { id: "mono",    name: "Grafite",  css: "linear-gradient(135deg,#111827,#374151)" }
];

const DEFAULT_BANNER = { t: "preset", id: "aurora" };

/* css de fundo para um banner ({t:"preset",id} ou {t:"img",data}) */
function bannerCss(b){
  if (b && b.t === "img" && SAFE_IMG.test(b.data || "")){
    return "url('" + b.data + "') center/cover no-repeat, #1d1033";
  }
  const preset = BANNERS.find((x) => x.id === (b && b.id)) || BANNERS[0];
  return preset.css;
}

const photoCss = (photo) =>
  SAFE_IMG.test(photo || "") ? "url('" + photo + "') center/cover no-repeat" : "";

/* cor de avatar estável para quem não tem foto (usado nas contas dos outros) */
function colorsFor(seed){
  return AVATAR_COLORS[hashStr(String(seed)) % AVATAR_COLORS.length];
}

/* ---------- dados do perfil (neste aparelho) ---------- */
const Profile = {

  key(){ return "noxProfile:" + (localStorage.getItem("noxUid") || "guest"); },

  get(){
    try{
      const d = JSON.parse(localStorage.getItem(this.key()) || "{}");
      return { photo: d.photo || "", banner: d.banner || DEFAULT_BANNER, bio: d.bio || "" };
    }catch(e){
      return { photo: "", banner: DEFAULT_BANNER, bio: "" };
    }
  },

  save(patch){
    const next = Object.assign(this.get(), patch);
    try{
      localStorage.setItem(this.key(), JSON.stringify(next));
    }catch(e){
      showToast("Sem espaço para guardar a imagem. Tente uma menor.");
      return false;
    }
    if (typeof Social !== "undefined") Social.sync();
    return true;
  }
};


/* ---------- editor de perfil ---------- */
let draft = null;

function openProfileEditor(){

  draft = Object.assign({}, Profile.get());
  draft.name = userName();
  draft.color = avatarIndex();

  $("peName").value = draft.name;
  $("peBio").value = draft.bio;
  buildBannerGrid();
  refreshEditor();
  $("profileEditor").hidden = false;
}

function closeProfileEditor(){
  $("profileEditor").hidden = true;
  draft = null;
}

function buildBannerGrid(){
  $("bannerGrid").innerHTML =
    BANNERS.map((b) =>
      '<button class="banner-opt" data-banner="' + b.id + '" style="background:' + b.css + '" aria-label="' + esc(b.name) + '"><span>' + esc(b.name) + '</span></button>'
    ).join("") +
    '<button class="banner-opt banner-add" data-banner="__import">' + iconHtml("plus") + '<span>Importar foto</span></button>';
}

function refreshEditor(){

  if (!draft) return;

  $("peBanner").style.background = bannerCss(draft.banner);

  const av = $("peAvatar");
  const [c1, c2] = AVATAR_COLORS[draft.color] || AVATAR_COLORS[0];
  const photo = photoCss(draft.photo);
  av.style.background = photo || "linear-gradient(135deg," + c1 + "," + c2 + ")";
  av.textContent = photo ? "" : (draft.name || "N").charAt(0).toUpperCase();

  document.querySelectorAll("#bannerGrid [data-banner]").forEach((b) =>
    b.classList.toggle("active", draft.banner.t === "preset" && b.dataset.banner === draft.banner.id)
  );
  $("bannerGrid").querySelector(".banner-add").classList.toggle("active", draft.banner.t === "img");

  document.querySelectorAll("#peSwatches .swatch").forEach((s, i) =>
    s.classList.toggle("active", i === draft.color)
  );

  $("peRemovePhoto").hidden = !draft.photo;
}

$("bannerGrid").addEventListener("click", (e) => {
  const opt = e.target.closest("[data-banner]");
  if (!opt || !draft) return;

  if (opt.dataset.banner === "__import"){
    $("bannerFile").click();
    return;
  }
  draft.banner = { t: "preset", id: opt.dataset.banner };
  refreshEditor();
});

$("peSwatches").addEventListener("click", (e) => {
  const sw = e.target.closest(".swatch");
  if (!sw || !draft) return;
  draft.color = Array.from(sw.parentElement.children).indexOf(sw);
  refreshEditor();
});

$("peName").addEventListener("input", () => {
  if (draft){ draft.name = $("peName").value.trim(); refreshEditor(); }
});

$("photoFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file || !draft) return;
  try{
    draft.photo = await imageToDataUrl(file, 256, 256, 0.82);
    refreshEditor();
  }catch(err){ showToast(err.message); }
});

$("bannerFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file || !draft) return;
  try{
    draft.banner = { t: "img", data: await imageToDataUrl(file, 900, 300, 0.78) };
    refreshEditor();
  }catch(err){ showToast(err.message); }
});

function removeProfilePhoto(){
  if (!draft) return;
  draft.photo = "";
  refreshEditor();
}

async function saveProfileEditor(){

  if (!draft) return;

  const name = $("peName").value.trim();
  if (!name){ showToast("Digite um nome"); return; }

  const bio = $("peBio").value.trim().slice(0, 120);

  if (name.toLowerCase() !== userName().trim().toLowerCase() && typeof Social !== "undefined"){
    if ((await Social.nameFree(name)) === false){
      showToast("Esse nome já está em uso. Escolha outro.");
      return;
    }
  }

  localStorage.setItem("noxAvatar", String(draft.color));
  localStorage.setItem("loggedUser", name);

  try{
    if (window.firebaseFunctions && window.auth && window.auth.currentUser){
      await firebaseFunctions.updateProfile(window.auth.currentUser, { displayName: name });
    }
  }catch(err){
    console.warn("Não foi possível atualizar o nome online:", err);
  }

  if (!Profile.save({ photo: draft.photo, banner: draft.banner, bio })) return;

  closeProfileEditor();
  applyProfile();
  renderProfile();
  showToast("Perfil atualizado");
}
