/* =========================================================
   NOXIFY — util.js
   Funções pequenas usadas por todos os outros arquivos.
========================================================= */

const $ = (id) => document.getElementById(id);

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])
  );

function absUrl(path){
  return new URL(path, location.href).href;
}

/* ícones SVG (definidos no <symbol> do index.html) */
function iconHtml(name, cls){
  return '<svg class="ic ' + (cls || "") + '"><use href="#i-' + name + '"/></svg>';
}

function setIcon(btn, name){
  const use = btn && btn.querySelector("use");
  if (use) use.setAttribute("href", "#i-" + name);
}

/* aviso rápido na parte de baixo */
let toastTimer;
function showToast(message){
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* confirmação dentro da própria página (funciona no site e no APK) */
function askConfirm(text, yesLabel){
  return new Promise((resolve) => {
    const modal = $("confirmModal");
    $("confirmText").textContent = text;
    $("confirmYes").textContent = yesLabel || "Confirmar";
    modal.hidden = false;

    const done = (value) => {
      modal.hidden = true;
      $("confirmYes").onclick = $("confirmNo").onclick = modal.onclick = null;
      resolve(value);
    };

    $("confirmYes").onclick = () => done(true);
    $("confirmNo").onclick  = () => done(false);
    modal.onclick = (e) => { if (e.target === modal) done(false); };
  });
}

function formatTime(sec){
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function formatMinutes(sec){
  if (sec < 60) return Math.round(sec) + " s";
  const m = Math.round(sec / 60);
  if (m < 120) return m + " min";
  const h = Math.floor(m / 60);
  return h + " h" + (m % 60 ? " " + (m % 60) + " min" : "");
}

const mainArtist = (song) => song.artist.split(",")[0].trim();

function hashStr(s){
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
