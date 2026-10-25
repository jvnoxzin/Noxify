/* =========================================================
   NOXIFY — settings.js
   Preferências do usuário + tela de Configurações.
========================================================= */

/* ganhos em dB para: graves, médios, agudos */
const EQ_PRESETS = {
  normal:     { label: "Normal",     gains: [0, 0, 0] },
  graves:     { label: "Graves",     gains: [7, 0, -1] },
  vocal:      { label: "Vocal",      gains: [-2, 4, 2] },
  agudos:     { label: "Agudos",     gains: [-2, 0, 6] },
  eletronica: { label: "Eletrônica", gains: [5, -1, 4] }
};

const SETTINGS_DEFAULTS = {
  eq: "normal",
  normalize: false,
  autoplay: true,
  syncedLyrics: true,
  visuals: "high",
  wifiOnly: false
};

const Settings = {
  data: Object.assign({}, SETTINGS_DEFAULTS),

  load(){
    try{
      Object.assign(this.data, JSON.parse(localStorage.getItem("noxSettings") || "{}"));
    }catch(e){}
  },

  get(key){ return this.data[key]; },

  set(key, value){
    this.data[key] = value;
    try{ localStorage.setItem("noxSettings", JSON.stringify(this.data)); }catch(e){}
  }
};

Settings.load();


/* ---------- tela de configurações ---------- */
function renderSettings(){

  const s = Settings.data;

  const seg = (key, options) =>
    '<div class="seg" data-setting="' + key + '">' +
    options.map(([value, label]) =>
      '<button class="seg-btn' + (s[key] === value ? " active" : "") +
      '" data-value="' + value + '">' + label + '</button>'
    ).join("") + '</div>';

  const toggle = (key, title, desc) =>
    '<label class="set-row"><span class="set-text"><b>' + title + '</b><small>' + desc +
    '</small></span><input class="switch" type="checkbox" data-setting="' + key + '"' +
    (s[key] ? " checked" : "") + '></label>';

  const presets = Object.entries(EQ_PRESETS).map(([k, p]) => [k, p.label]);

  $("settingsBody").innerHTML =

    '<h2 class="set-title">Qualidade de som</h2>' +
    '<div class="set-block"><div class="set-label">Equalizador</div>' + seg("eq", presets) + '</div>' +
    toggle("normalize", "Normalizar volume", "Deixa as músicas num volume mais parecido") +

    '<h2 class="set-title">Reprodução</h2>' +
    toggle("autoplay", "Tocar a próxima automaticamente", "Quando uma música termina, a seguinte começa") +
    toggle("syncedLyrics", "Letra sincronizada", "A letra acompanha a música e rola sozinha") +

    '<h2 class="set-title">Desempenho</h2>' +
    '<div class="set-block"><div class="set-label">Efeitos visuais do player</div>' +
    seg("visuals", [["high", "Alto"], ["low", "Econômico"], ["off", "Desligado"]]) + '</div>' +

    '<h2 class="set-title">Downloads</h2>' +
    toggle("wifiOnly", "Baixar só no Wi-Fi", "Evita gastar seus dados móveis (depende do aparelho)") +
    '<button class="set-action" data-action="clear-downloads">Remover todos os downloads</button>' +

    '<h2 class="set-title">Conta e diagnóstico</h2>' +
    '<button class="set-action neutral" data-action="check-account">Testar conexão com a conta</button>' +
    '<div class="diag" id="accountResult" hidden></div>' +
    '<button class="set-action neutral" data-action="check-songs">Verificar arquivos de música</button>' +
    '<div class="diag" id="songsResult" hidden></div>' +

    '<h2 class="set-title">Dados</h2>' +
    '<button class="set-action" data-action="reset-stats">Apagar histórico da Cápsula sonora</button>' +

    '<p class="set-about">Noxify 2.0 · Letras fornecidas pelo LRCLIB</p>';
}

function onSettingChanged(key){
  applyAudioSettings();
  syncVisuals();
  if (key === "syncedLyrics") Lyrics.rerender();
}

/* ---------- diagnóstico ---------- */
function diag(box, kind, title, detail){
  box.hidden = false;
  box.className = "diag " + kind;
  box.innerHTML = "<b>" + esc(title) + "</b>" + (detail ? "<span>" + detail + "</span>" : "");
}

async function runAccountCheck(){

  const box = $("accountResult");
  diag(box, "", "Verificando…");

  if (!window.auth || !window.firebaseFunctions){
    diag(box, "bad", "O Firebase não carregou",
      "O login online não está disponível agora. Isso acontece sem internet ou quando o endereço do Firebase está bloqueado.");
    return;
  }

  try{
    if (auth.authStateReady) await auth.authStateReady();

    const user = auth.currentUser;

    if (!user){
      diag(box, "warn", "Sem login ativo no servidor",
        "O app está aberto com o login salvo neste aparelho. Toque em Sair e entre de novo, com internet, para reconectar.");
      return;
    }

    await user.reload();   // pergunta ao servidor do Firebase se a conta existe

    diag(box, "ok", "Firebase conectado",
      esc(user.email || "") + "<br>ID da conta: " + esc(String(user.uid).slice(0, 8)) + "…");

  }catch(e){

    const msg = {
      "auth/network-request-failed": "Sem conexão com o servidor. Tente de novo com internet.",
      "auth/user-token-expired":     "Sua sessão expirou. Toque em Sair e entre de novo.",
      "auth/user-not-found":         "Essa conta não existe mais no Firebase.",
      "auth/user-disabled":          "Essa conta foi desativada.",
      "auth/invalid-api-key":        "A chave do Firebase no index.html está inválida."
    }[e.code] || ("Erro: " + (e.code || e.message));

    diag(box, "bad", "Não consegui falar com o Firebase", esc(msg));
  }
}

async function runSongCheck(btn){

  const box = $("songsResult");

  if (!navigator.onLine){
    diag(box, "warn", "Sem internet", "Conecte-se para conferir os arquivos que estão no site.");
    return;
  }

  const label = btn.textContent;
  btn.disabled = true;
  diag(box, "", "Verificando " + PLAYLIST.length + " arquivos…");

  const bad = await checkSongFiles((done, total) => {
    btn.textContent = "Verificando " + done + "/" + total + "…";
  });

  btn.textContent = label;
  btn.disabled = false;

  if (!bad.length){
    diag(box, "ok", "Todos os " + PLAYLIST.length + " arquivos foram encontrados");
    return;
  }

  diag(box, "bad",
    bad.length + (bad.length === 1 ? " arquivo com problema" : " arquivos com problema"),
    bad.map((b) => "• " + esc(b.song.name) + "<br><code>" + esc(b.song.src) + "</code> · " + esc(b.reason)).join("<br>") +
    "<br><br>Compare com o nome do arquivo no seu repositório: maiúsculas, espaços e acentos precisam ser idênticos. " +
    "Pelo site do GitHub, cada arquivo pode ter no máximo 25 MB.");
}

const settingsBody = $("settingsBody");

settingsBody.addEventListener("click", async (e) => {

  const btn = e.target.closest(".seg-btn");
  if (btn){
    const key = btn.parentElement.dataset.setting;
    Settings.set(key, btn.dataset.value);
    onSettingChanged(key);
    renderSettings();
    return;
  }

  const action = e.target.closest("[data-action]");
  if (!action) return;

  if (action.dataset.action === "check-account") { runAccountCheck(); return; }
  if (action.dataset.action === "check-songs")   { runSongCheck(action); return; }

  if (action.dataset.action === "clear-downloads"){
    if (await askConfirm("Remover todas as músicas baixadas deste aparelho?", "Remover")){
      await removeAllDownloads();
    }
  }

  if (action.dataset.action === "reset-stats"){
    if (await askConfirm("Apagar todo o histórico da sua Cápsula sonora? Isso não pode ser desfeito.", "Apagar")){
      Stats.reset();
      showToast("Histórico apagado");
    }
  }
});

settingsBody.addEventListener("change", (e) => {
  const input = e.target;
  if (!input.classList.contains("switch")) return;
  Settings.set(input.dataset.setting, input.checked);
  onSettingChanged(input.dataset.setting);
});
