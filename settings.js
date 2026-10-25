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

    '<h2 class="set-title">Dados</h2>' +
    '<button class="set-action" data-action="reset-stats">Apagar histórico da Cápsula sonora</button>' +

    '<p class="set-about">Noxify 2.0 · Letras fornecidas pelo LRCLIB</p>';
}

function onSettingChanged(key){
  applyAudioSettings();
  syncVisuals();
  if (key === "syncedLyrics") Lyrics.rerender();
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
