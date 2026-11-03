/* =========================================================
   NOXIFY — banners.js
   Banners animados da Store (cenas em SVG, como um GIF vivo).

   - Cada banner é uma cena desenhada por código (sem imagens pesadas).
   - Só usam animação de transformação/opacidade (leve para Android).
   - Pausam quando saem da tela, com a aba escondida, ou quando o
     aparelho pede menos movimento / é fraco (aí ficam parados, bonitos).
   API:  NoxBanners.has(id)   NoxBanners.html(id)
         NoxBanners.mount(el, id)   NoxBanners.unmount(el)
========================================================= */

const NoxBanners = (() => {

  let uid = 0;
  const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const f = (x, d) => (+x).toFixed(d === undefined ? 1 : d);
  const pick = (r, a) => a[Math.floor(r() * a.length)];

  /* pequenos atalhos de animação SMIL */
  const an = (attr, values, dur, o) => {
    o = o || {};
    return '<animate attributeName="' + attr + '" values="' + values + '" dur="' + dur + 's" begin="' + (o.begin || 0) + 's" repeatCount="indefinite"' +
      (o.spline ? ' calcMode="spline" keyTimes="' + o.keyTimes + '" keySplines="' + o.spline + '"' : "") + "/>";
  };
  const tr = (type, values, dur, o) => {
    o = o || {};
    return '<animateTransform attributeName="transform" type="' + type + '" values="' + values + '" dur="' + dur + 's" begin="' + (o.begin || 0) + 's" repeatCount="indefinite"' +
      (o.sum ? ' additive="sum"' : "") + (o.spline ? ' calcMode="spline" keyTimes="' + o.keyTimes + '" keySplines="' + o.spline + '"' : "") + "/>";
  };

  /* campo de estrelas que piscam */
  function stars(r, n, yMax, tint) {
    let s = "";
    for (let i = 0; i < n; i++) {
      const x = r() * 400, y = r() * yMax, big = r() > .88;
      s += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(big ? .9 + r() * .6 : .3 + r() * .55) + '" fill="' + (tint && r() > .6 ? tint : "#fff") + '" opacity=".55">' +
        an("opacity", ".15;1;.15", f(1.8 + r() * 3.2), { begin: "-" + f(r() * 5) }) + "</circle>";
    }
    return s;
  }

  /* estrela cadente: uma risca que cruza o quadro de tempos em tempos */
  function shooting(u, x0, y0, dx, dy, dur, begin, col) {
    return '<g opacity="0"><line x1="0" y1="0" x2="-26" y2="-11" stroke="url(#' + u + 'sh)" stroke-width="1.6" stroke-linecap="round"/>' +
      '<circle r="1.6" fill="#fff"/>' +
      '<animateTransform attributeName="transform" type="translate" values="' + x0 + " " + y0 + ";" + (x0 + dx) + " " + (y0 + dy) + '" keyTimes="0;1" dur="' + dur + 's" begin="' + begin + 's" repeatCount="indefinite"/>' +
      '<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.04;.12;.2;1" dur="' + dur + 's" begin="' + begin + 's" repeatCount="indefinite"/></g>';
  }

  /* ======================================================
     CENAS (viewBox 0 0 400 150)
  ====================================================== */
  const SCENES = {

    /* ---------- NEON: pôr do sol synthwave com grade em movimento ---------- */
    bn_neon(u) {
      const r = rng(11);
      let vert = "";
      for (let k = -16; k <= 16; k++) vert += '<line x1="' + f(200 + k * 11) + '" y1="88" x2="' + f(200 + k * 62) + '" y2="150"/>';
      let horiz = "";
      for (let i = 0; i < 7; i++) {
        const d = 3.2, b = "-" + f(i * d / 7);
        const sp = { spline: ".55 0 .9 .5", keyTimes: "0;1" };
        horiz += '<line x1="0" x2="400" y1="88" y2="88" stroke="#ff5ee0" stroke-width="1">' +
          an("y1", "88;151", d, Object.assign({ begin: b }, sp)) + an("y2", "88;151", d, Object.assign({ begin: b }, sp)) +
          an("stroke-opacity", ".1;.95", d, Object.assign({ begin: b }, sp)) + an("stroke-width", ".4;2.2", d, Object.assign({ begin: b }, sp)) + "</line>";
      }
      let bars = "";
      [[63, 1.6], [69, 2.4], [75, 3.2], [81, 4.2]].forEach((b) => (bars += '<rect x="140" y="' + b[0] + '" width="120" height="' + b[1] + '" fill="#000"/>'));
      return '<defs>' +
        '<linearGradient id="' + u + 'sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07011a"/><stop offset=".45" stop-color="#2a0a52"/><stop offset=".78" stop-color="#9b1d8f"/><stop offset="1" stop-color="#ff5a9d"/></linearGradient>' +
        '<linearGradient id="' + u + 'sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff35c"/><stop offset=".55" stop-color="#ff9a3c"/><stop offset="1" stop-color="#ff2e93"/></linearGradient>' +
        '<linearGradient id="' + u + 'fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a0f6e"/><stop offset="1" stop-color="#0d0220"/></linearGradient>' +
        '<radialGradient id="' + u + 'gl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff4fd8" stop-opacity=".75"/><stop offset="1" stop-color="#ff4fd8" stop-opacity="0"/></radialGradient>' +
        '<mask id="' + u + 'mk"><rect width="400" height="150" fill="#fff"/>' + bars + "</mask></defs>" +
        '<rect width="400" height="150" fill="url(#' + u + 'sky)"/>' + stars(r, 36, 62) +
        '<circle cx="200" cy="80" r="82" fill="url(#' + u + 'gl)">' + an("opacity", ".55;1;.55", 4) + an("r", "78;88;78", 4) + "</circle>" +
        '<g mask="url(#' + u + 'mk)"><circle cx="200" cy="80" r="44" fill="url(#' + u + 'sun)"/></g>' +
        /* montanhas com contorno neon */
        '<path d="M0 90V68L26 52 46 70 74 56 112 90Z" fill="#14042e" stroke="#63e8ff" stroke-width=".9" stroke-linejoin="round" opacity=".95"/>' +
        '<path d="M400 90V64L372 50 350 68 322 54 286 90Z" fill="#14042e" stroke="#63e8ff" stroke-width=".9" stroke-linejoin="round" opacity=".95"/>' +
        '<rect y="88" width="400" height="62" fill="url(#' + u + 'fl)"/>' +
        '<g stroke="#ff5ee0" stroke-width=".8" stroke-opacity=".6">' + vert + "</g>" +
        horiz +
        '<rect y="86.4" width="400" height="3" fill="#ff7be9">' + an("opacity", ".55;1;.55", 2.6) + "</rect>" +
        '<rect y="88" width="400" height="14" fill="url(#' + u + 'sky)" opacity=".0"/>';
    },

    /* ---------- AURORA: cortinas de luz sobre montanhas ---------- */
    bn_aurora(u) {
      const r = rng(23);
      const curtain = (cid, base, amp, hgt, freq, ph, dur, sway, op) => {
        let top = "", bot = "";
        for (let x = -30; x <= 430; x += 10) {
          const y = base + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.3 + ph * 1.7) * amp * .35;
          top += f(x) + " " + f(y) + " ";
          bot = f(x) + " " + f(y + hgt + Math.sin(x * .05 + ph) * 8) + " " + bot;
        }
        let rays = "";
        for (let x = -20; x < 420; x += 7 + Math.floor(r() * 9)) {
          const y = base + Math.sin(x * freq + ph) * amp;
          rays += '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(1.2 + r() * 2.4) + '" height="' + f(hgt * (.55 + r() * .6)) + '" opacity="' + f(.12 + r() * .25, 2) + '"/>';
        }
        return '<g opacity="' + op + '">' +
          '<polygon points="' + top + bot + '" fill="url(#' + u + cid + ')"/>' +
          '<g fill="url(#' + u + cid + 'r)">' + rays + "</g>" +
          tr("translate", "-16 0;16 0;-16 0", sway) + tr("skewX", "-5;5;-5", sway * 1.3, { sum: true }) +
          an("opacity", (op * .55) + ";" + op + ";" + (op * .55), sway * .8) + "</g>";
      };
      const grad = (id, c1, c2, c3) => '<linearGradient id="' + u + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c1 + '" stop-opacity="0"/><stop offset=".35" stop-color="' + c2 + '" stop-opacity=".85"/><stop offset=".75" stop-color="' + c3 + '" stop-opacity=".4"/><stop offset="1" stop-color="' + c3 + '" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="' + u + id + 'r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".4" stop-color="#eafff6" stop-opacity=".9"/><stop offset="1" stop-color="' + c2 + '" stop-opacity="0"/></linearGradient>';
      return '<defs>' +
        '<linearGradient id="' + u + 'sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#010617"/><stop offset=".6" stop-color="#06263a"/><stop offset="1" stop-color="#0b4a52"/></linearGradient>' +
        grad("g1", "#2dffa0", "#2dffa0", "#22d3ee") + grad("g2", "#22d3ee", "#34e1ff", "#7c6cff") + grad("g3", "#c084fc", "#d27bff", "#ff6ec7") +
        '<linearGradient id="' + u + 'lk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee" stop-opacity=".35"/><stop offset=".5" stop-color="#2dffa0" stop-opacity=".5"/><stop offset="1" stop-color="#c084fc" stop-opacity=".35"/></linearGradient>' +
        '<linearGradient id="' + u + 'sh" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
        '<rect width="400" height="150" fill="url(#' + u + 'sky)"/>' + stars(r, 70, 90, "#bff") +
        curtain("g3", 22, 12, 62, .018, 2.1, 9, 9, .85) +
        curtain("g2", 30, 14, 66, .021, 0.6, 7.5, 7, .9) +
        curtain("g1", 38, 12, 70, .016, 4.0, 11, 11, 1) +
        shooting(u, 70, 12, 120, 52, 8, 2) +
        /* lago com reflexo */
        '<rect y="124" width="400" height="26" fill="url(#' + u + 'lk)">' + an("opacity", ".55;1;.55", 5) + "</rect>" +
        '<path d="M0 126L34 100 52 112 86 84 118 114 150 98 190 126 232 104 270 88 308 112 340 96 372 114 400 100V126Z" fill="#04121c"/>' +
        '<path d="M86 84L94 94 86 92 80 96ZM270 88L278 98 270 96 262 100ZM34 100L41 108 34 106 28 110Z" fill="#cfeaff" opacity=".8"/>' +
        '<rect y="126" width="400" height="24" fill="#03101a" opacity=".78"/>' +
        '<g stroke="#9ff" stroke-opacity=".28" stroke-width=".7"><line x1="60" y1="132" x2="130" y2="132">' + an("x1", "60;80;60", 4) + '</line><line x1="220" y1="138" x2="320" y2="138">' + an("x2", "320;290;320", 5) + "</line></g>";
    },

    /* ---------- CÓSMICO: nebulosa, planeta com anel e estrelas cadentes ---------- */
    bn_cosmic(u) {
      const r = rng(37);
      const neb = (cx, cy, rx, ry, c, op, dx, dy, dur) =>
        '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + c + '" opacity="' + op + '">' +
        tr("translate", "0 0;" + dx + " " + dy + ";0 0", dur) + "</ellipse>";
      return '<defs>' +
        '<radialGradient id="' + u + 'n1"><stop offset="0" stop-color="#d946ef" stop-opacity=".9"/><stop offset="1" stop-color="#d946ef" stop-opacity="0"/></radialGradient>' +
        '<radialGradient id="' + u + 'n2"><stop offset="0" stop-color="#3b82f6" stop-opacity=".85"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></radialGradient>' +
        '<radialGradient id="' + u + 'n3"><stop offset="0" stop-color="#fb7185" stop-opacity=".7"/><stop offset="1" stop-color="#fb7185" stop-opacity="0"/></radialGradient>' +
        '<radialGradient id="' + u + 'pl" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#ffe3b3"/><stop offset=".45" stop-color="#e2893a"/><stop offset="1" stop-color="#3b1308"/></radialGradient>' +
        '<linearGradient id="' + u + 'rg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a5b4fc" stop-opacity=".1"/><stop offset=".5" stop-color="#fde7c2" stop-opacity=".95"/><stop offset="1" stop-color="#a5b4fc" stop-opacity=".15"/></linearGradient>' +
        '<linearGradient id="' + u + 'sh" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
        '<clipPath id="' + u + 'fc"><rect x="240" y="82" width="160" height="30"/></clipPath></defs>' +
        '<rect width="400" height="150" fill="#04010d"/>' +
        '<g>' + neb(90, 50, 150, 70, "url(#" + u + "n1)", .55, 26, 8, 22) + neb(270, 110, 170, 70, "url(#" + u + "n2)", .55, -30, -10, 26) + neb(200, 30, 120, 50, "url(#" + u + "n3)", .4, 20, 12, 30) + "</g>" +
        stars(r, 90, 150, "#ffd6f5") +
        /* planeta */
        '<g>' + tr("translate", "0 0;0 -3;0 0", 7) +
        '<ellipse cx="320" cy="82" rx="64" ry="14" fill="none" stroke="url(#' + u + 'rg)" stroke-width="4" transform="rotate(-18 320 82)" opacity=".8"/>' +
        '<circle cx="320" cy="82" r="31" fill="url(#' + u + 'pl)"/>' +
        '<path d="M292 76q28 8 56 -4M290 88q30 10 60 -2" stroke="#7a3410" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<circle cx="320" cy="82" r="31" fill="none" stroke="#ffd9a3" stroke-opacity=".35" stroke-width=".8"/>' +
        '<g transform="rotate(-18 320 82)"><g clip-path="url(#' + u + 'fc)"><ellipse cx="320" cy="82" rx="64" ry="14" fill="none" stroke="url(#' + u + 'rg)" stroke-width="4"/></g></g>' +
        "</g>" +
        /* lua orbitando */
        '<circle r="5.2" fill="#cbd5e1"><animateMotion dur="14s" repeatCount="indefinite" path="M255 60 C300 20 380 30 392 74 C380 118 290 128 255 60Z"/></circle>' +
        /* galáxia espiral pequena */
        '<g opacity=".8" transform="translate(70 100)"><g><ellipse rx="28" ry="8" fill="#a78bfa" opacity=".4"/><ellipse rx="15" ry="4" fill="#fff" opacity=".6"/><ellipse rx="5" ry="2" fill="#fff"/>' + tr("rotate", "-20;340", 90) + "</g></g>" +
        shooting(u, 40, 14, 200, 84, 7, 1) + shooting(u, 190, 6, 170, 72, 9, 4.5);
    },

    /* ---------- FUTURISTA: painel de controle com anéis e circuitos ---------- */
    bn_futur(u) {
      const r = rng(53);
      const trace = (d, col, dur, begin) =>
        '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-opacity=".22" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="14 400" filter="none">' +
        an("stroke-dashoffset", "0;-420", dur, { begin: begin }) + "</path>";
      let ticks = "";
      let eq = "";
      for (let i = 0; i < 14; i++) {
        const h0 = 6 + r() * 20, h1 = 4 + r() * 24, dur = f(.9 + r() * 1.3), bg = "-" + f(r() * 2);
        eq += '<rect x="' + (20 + i * 6) + '" y="' + f(140 - h0) + '" width="3.4" height="' + f(h0) + '" rx="1" fill="' + (i % 4 === 0 ? "#f0abfc" : "#22d3ee") + '" opacity=".85">' +
          an("height", f(h0) + ";" + f(h1) + ";" + f(h0), dur, { begin: bg }) + an("y", f(140 - h0) + ";" + f(140 - h1) + ";" + f(140 - h0), dur, { begin: bg }) + "</rect>";
      }
      return '<defs>' +
        '<linearGradient id="' + u + 'bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#020912"/><stop offset=".6" stop-color="#06183a"/><stop offset="1" stop-color="#0b1f4d"/></linearGradient>' +
        '<pattern id="' + u + 'hx" width="28" height="48.5" patternUnits="userSpaceOnUse" patternTransform="scale(.8)"><path d="M14 0L28 8.08V24.25L14 32.33 0 24.25V8.08Z M14 32.33V48.5M0 24.25L-0 40.4M28 24.25V40.4" fill="none" stroke="#22d3ee" stroke-opacity=".13" stroke-width=".8"/></pattern>' +
        '<linearGradient id="' + u + 'sc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee" stop-opacity="0"/><stop offset=".85" stop-color="#22d3ee" stop-opacity=".28"/><stop offset="1" stop-color="#a5f3fc" stop-opacity=".7"/></linearGradient>' +
        '<radialGradient id="' + u + 'co"><stop offset="0" stop-color="#e0fbff"/><stop offset=".35" stop-color="#22d3ee"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient></defs>' +
        '<rect width="400" height="150" fill="url(#' + u + 'bg)"/><rect width="400" height="150" fill="url(#' + u + 'hx)"/>' +
        /* anéis giratórios */
        '<g transform="translate(300 75)">' +
        '<circle r="58" fill="none" stroke="#22d3ee" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="2 5"><animateTransform attributeName="transform" type="rotate" values="0;360" dur="40s" repeatCount="indefinite"/></circle>' +
        '<circle r="48" fill="none" stroke="#38bdf8" stroke-width="3" stroke-dasharray="60 24 14 24" stroke-linecap="round" opacity=".85"><animateTransform attributeName="transform" type="rotate" values="360;0" dur="14s" repeatCount="indefinite"/></circle>' +
        '<circle r="38" fill="none" stroke="#22d3ee" stroke-width="1.4" stroke-dasharray="3 3.1" opacity=".7"><animateTransform attributeName="transform" type="rotate" values="0;360" dur="22s" repeatCount="indefinite"/></circle>' +
        '<circle r="28" fill="none" stroke="#a5f3fc" stroke-width="4" stroke-dasharray="26 30" stroke-linecap="round" opacity=".9"><animateTransform attributeName="transform" type="rotate" values="0;360" dur="6s" repeatCount="indefinite"/></circle>' +
        '<circle r="16" fill="url(#' + u + 'co)">' + an("r", "13;19;13", 2.4) + "</circle>" +
        '<path d="M-6 4V-6L6 4V-6" fill="none" stroke="#04202e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>' +
        /* circuitos com pulsos de luz */
        trace("M0 40H40L52 52H120L132 40H214", "#22d3ee", 3.2, -0.2) +
        trace("M0 84H64L76 96H150L162 108H230", "#38bdf8", 4.1, -1.4) +
        trace("M10 128H92L104 116H190", "#f0abfc", 3.6, -2.2) +
        trace("M214 40H236L246 28H262", "#22d3ee", 2.2, -0.9) +
        '<g fill="#22d3ee"><circle cx="214" cy="40" r="2.4">' + an("opacity", ".3;1;.3", 1.6) + '</circle><circle cx="230" cy="108" r="2.4">' + an("opacity", ".3;1;.3", 2.1, { begin: -.5 }) + '</circle><circle cx="190" cy="116" r="2.4" fill="#f0abfc">' + an("opacity", ".3;1;.3", 1.9, { begin: -1 }) + "</circle></g>" +
        eq +
        /* varredura */
        '<rect y="0" width="60" height="150" fill="url(#' + u + 'sc)">' + an("x", "-60;400", 4.8) + "</rect>" +
        /* moldura HUD */
        '<g fill="none" stroke="#22d3ee" stroke-width="1.6" stroke-linecap="round" opacity=".85"><path d="M6 20V6H20M380 6H394V20M394 130V144H380M20 144H6V130"/></g>' +
        '<g fill="#22d3ee" opacity=".55"><rect x="30" y="12" width="46" height="2.4" rx="1"/><rect x="80" y="12" width="14" height="2.4" rx="1"/><rect x="326" y="136" width="40" height="2.4" rx="1"/></g>';
    },

    /* ---------- ABSTRATO: luz líquida em movimento ---------- */
    bn_abstract(u) {
      const blob = (cid, cx, cy, rx, ry, vals, dur, begin, rot) =>
        '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="url(#' + u + cid + ')" opacity=".78" style="mix-blend-mode:screen">' +
        tr("translate", vals, dur, { begin: begin }) + (rot ? tr("rotate", "0;" + rot, dur * 1.7, { sum: true, begin: begin }) : "") + "</ellipse>";
      const rg = (id, c) => '<radialGradient id="' + u + id + '"><stop offset="0" stop-color="' + c + '"/><stop offset=".55" stop-color="' + c + '" stop-opacity=".45"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient>';
      const ring = (cx, cy, rr, dur, dy, begin) =>
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1">' + tr("translate", "0 0;0 " + dy + ";0 0", dur, { begin: begin }) + an("stroke-opacity", ".12;.45;.12", dur, { begin: begin }) + "</circle>";
      return '<defs>' + rg("a", "#ff3d8b") + rg("b", "#ffb347") + rg("c", "#38c9ff") + rg("d", "#8f5bff") + rg("e", "#34ffb0") + rg("f", "#ff6a3d") +
        '<linearGradient id="' + u + 'bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16062f"/><stop offset="1" stop-color="#0a0320"/></linearGradient></defs>' +
        '<rect width="400" height="150" fill="url(#' + u + 'bg)"/>' +
        blob("a", 90, 60, 110, 80, "0 0;70 30;20 -20;0 0", 13, 0, 25) +
        blob("c", 310, 90, 120, 78, "0 0;-80 -26;-30 30;0 0", 15, -3) +
        blob("d", 200, 30, 100, 62, "0 0;-60 40;50 20;0 0", 17, -6, 40) +
        blob("b", 150, 124, 96, 60, "0 0;90 -30;30 -10;0 0", 12, -2) +
        blob("e", 350, 20, 80, 56, "0 0;-110 40;-40 10;0 0", 16, -8, 30) +
        blob("f", 40, 130, 84, 54, "0 0;60 -40;110 -10;0 0", 14, -5) +
        /* fios de luz fluindo */
        '<g fill="none" stroke="#fff" stroke-linecap="round" opacity=".5">' +
        '<path d="M-20 90C60 40 120 130 200 80S340 40 420 90" stroke-width="1.1" stroke-opacity=".35">' + tr("translate", "0 0;-40 6;0 0", 9) + "</path>" +
        '<path d="M-20 110C70 70 140 150 220 100S350 70 420 112" stroke-width=".8" stroke-opacity=".28">' + tr("translate", "-30 0;20 -5;-30 0", 11) + "</path>" +
        '<path d="M-20 60C70 20 150 100 230 54S350 20 420 58" stroke-width=".8" stroke-opacity=".22">' + tr("translate", "20 0;-30 5;20 0", 13) + "</path></g>" +
        ring(60, 40, 16, 6, -8, -1) + ring(150, 110, 24, 8, -12, -3) + ring(250, 36, 11, 5, 8, -2) + ring(340, 100, 19, 7, -10, -4) + ring(372, 38, 8, 6, 6, -1) +
        '<circle cx="200" cy="75" r="150" fill="none"/>';
    },

    /* ---------- IMPERIAL: veludo carmesim, ouro, coroa e louros ---------- */
    bn_special(u) {
      const r = rng(71);
      /* raios do sol imperial */
      let rays = "";
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2, a2 = a + Math.PI / 48 * (i % 2 ? .55 : 1);
        rays += '<polygon points="0,0 ' + f(Math.cos(a - .045) * 260) + "," + f(Math.sin(a - .045) * 260) + " " + f(Math.cos(a2 + .02) * 260) + "," + f(Math.sin(a2 + .02) * 260) + '" opacity="' + (i % 2 ? ".5" : "1") + '"/>';
      }
      /* coroa de louros: folhas ao longo de dois arcos (esquerda e direita), de baixo até quase o topo */
      let leaves = "";
      for (let i = 0; i < 8; i++) {
        const th = (14 + i * 17) * Math.PI / 180;
        [-1, 1].forEach((sd) => {
          [[27.6, 0], [23.4, 1]].forEach((ring) => {                  // folha de fora e de dentro
            const R = ring[0], px = sd * R * Math.sin(th), py = R * Math.cos(th);
            const phi = Math.atan2(sd * Math.cos(th), Math.sin(th)) * 180 / Math.PI + (ring[1] ? -sd * 28 : sd * 28) * -1;
            leaves += '<ellipse rx="2" ry="5.2" fill="url(#' + u + 'gd)" stroke="#6a4300" stroke-width=".3" transform="translate(' + f(px) + " " + f(py) + ") rotate(" + f(phi, 0) + ')">' +
              an("opacity", ".7;1;.7", 3, { begin: "-" + f(i * .37) }) + "</ellipse>";
          });
        });
      }
      /* pó de ouro subindo */
      let dust = "";
      for (let i = 0; i < 26; i++) {
        const x = f(r() * 400), d = f(4 + r() * 5), b = "-" + f(r() * 8);
        dust += '<circle cx="' + x + '" cy="152" r="' + f(.5 + r() * 1.1) + '" fill="' + pick(r, ["#ffe9a3", "#ffd25a", "#fff6d6"]) + '" opacity="0">' +
          an("cy", "152;-4", d, { begin: b }) + an("opacity", "0;.95;.8;0", d, { begin: b }) + an("cx", x + ";" + f(+x + (r() - .5) * 18) + ";" + x, d, { begin: b }) + "</circle>";
      }
      /* dobras do veludo */
      let folds = "";
      for (let i = 0; i < 12; i++) {
        folds += '<rect x="' + f(i * 36 - 14) + '" y="0" width="' + f(20 + r() * 20) + '" height="150" fill="url(#' + u + (i % 2 ? "fa" : "fb") + ')"/>';
      }
      const star4 = (cx, cy, s, dur, b) => '<g transform="translate(' + cx + " " + cy + ')"><path d="M0 -' + s + 'Q.5 -.5 ' + s + ' 0Q.5 .5 0 ' + s + 'Q-.5 .5 -' + s + ' 0Q-.5 -.5 0 -' + s + 'Z" fill="#fff" opacity="0">' +
        an("opacity", "0;1;0", dur, { begin: b }) + tr("scale", ".2;1.1;.2", dur, { begin: b }) + tr("rotate", "0;90", dur, { begin: b, sum: true }) + "</path></g>";
      return '<defs>' +
        '<radialGradient id="' + u + 'bg" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#c41a30"/><stop offset=".55" stop-color="#7a0b18"/><stop offset="1" stop-color="#250308"/></radialGradient>' +
        '<linearGradient id="' + u + 'gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".45" stop-color="#f2bf3e"/><stop offset=".75" stop-color="#b9791a"/><stop offset="1" stop-color="#ffe289"/></linearGradient>' +
        '<linearGradient id="' + u + 'fa" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="' + u + 'fb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7a8a" stop-opacity="0"/><stop offset=".5" stop-color="#ff7a8a" stop-opacity=".16"/><stop offset="1" stop-color="#ff7a8a" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="' + u + 'sw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff2b8" stop-opacity="0"/><stop offset=".5" stop-color="#fff2b8" stop-opacity=".5"/><stop offset="1" stop-color="#fff2b8" stop-opacity="0"/></linearGradient>' +
        '<radialGradient id="' + u + 'md" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="#e0243d"/><stop offset=".7" stop-color="#7a0b18"/><stop offset="1" stop-color="#3a050c"/></radialGradient>' +
        '<radialGradient id="' + u + 'hl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd36b" stop-opacity=".6"/><stop offset="1" stop-color="#ffd36b" stop-opacity="0"/></radialGradient>' +
        '<clipPath id="' + u + 'cp"><rect width="400" height="150"/></clipPath></defs>' +
        '<g clip-path="url(#' + u + 'cp)">' +
        '<rect width="400" height="150" fill="url(#' + u + 'bg)"/>' +
        '<g>' + folds + tr("translate", "0 0;6 0;0 0", 9) + "</g>" +
        '<g transform="translate(200 75)"><g fill="#ffcf5a" opacity=".13">' + rays + tr("rotate", "0;360", 120) + "</g></g>" +
        '<circle cx="200" cy="75" r="62" fill="url(#' + u + 'hl)">' + an("opacity", ".6;1;.6", 4.5) + "</circle>" +
        /* faixas laterais (estandartes) */
        '<g>' +
        '<path d="M70 0H104V108L87 96 70 108Z" fill="#5a0912"/><path d="M70 0H104V108L87 96 70 108Z" fill="none" stroke="url(#' + u + 'gd)" stroke-width="1.4"/><path d="M76 10H98V96L87 88 76 96Z" fill="none" stroke="#f2bf3e" stroke-opacity=".7" stroke-width=".7"/><path d="M87 26l5 8-5 8-5-8Z M87 52l4 6-4 6-4-6Z" fill="url(#' + u + 'gd)"/>' +
        '<path d="M296 0H330V108L313 96 296 108Z" fill="#5a0912"/><path d="M296 0H330V108L313 96 296 108Z" fill="none" stroke="url(#' + u + 'gd)" stroke-width="1.4"/><path d="M302 10H324V96L313 88 302 96Z" fill="none" stroke="#f2bf3e" stroke-opacity=".7" stroke-width=".7"/><path d="M313 26l5 8-5 8-5-8Z M313 52l4 6-4 6-4-6Z" fill="url(#' + u + 'gd)"/>' +
        tr("rotate", "-1.2 87 0;1.2 87 0;-1.2 87 0", 6) + "</g>" +
        /* medalhão central */
        '<g transform="translate(200 78)">' +
        '<circle r="34" fill="#2a0409" opacity=".55"/>' +
        '<circle r="31" fill="url(#' + u + 'md)" stroke="url(#' + u + 'gd)" stroke-width="2.6"/>' +
        '<circle r="26.5" fill="none" stroke="#ffe08a" stroke-width=".7" stroke-dasharray="1.2 2.6" stroke-linecap="round"/>' +
        leaves +
        /* coroa */
        '<g transform="translate(0 -3)"><path d="M-15 8L-17 -8 -8 -1 0 -13 8 -1 17 -8 15 8Z" fill="url(#' + u + 'gd)" stroke="#6a4300" stroke-width=".7" stroke-linejoin="round"/>' +
        '<rect x="-16" y="7" width="32" height="5" rx="1.6" fill="url(#' + u + 'gd)" stroke="#6a4300" stroke-width=".7"/>' +
        '<circle cx="-17" cy="-9" r="2.3" fill="#fff0b3" stroke="#8a5a0b" stroke-width=".5"/><circle cx="0" cy="-14.5" r="2.7" fill="#ff4d6a" stroke="#8a5a0b" stroke-width=".5"/><circle cx="17" cy="-9" r="2.3" fill="#fff0b3" stroke="#8a5a0b" stroke-width=".5"/>' +
        '<circle cx="-8" cy="9.5" r="1.3" fill="#7fe4ff"/><circle cx="0" cy="9.5" r="1.5" fill="#ff4d6a"/><circle cx="8" cy="9.5" r="1.3" fill="#7fe4ff"/></g>' +
        star4(0, -15, 6, 3.4, -.4) + "</g>" +
        /* bordas ornamentadas em ouro */
        '<rect x="5" y="5" width="390" height="140" rx="3" fill="none" stroke="url(#' + u + 'gd)" stroke-width="1.8"/>' +
        '<rect x="10" y="10" width="380" height="130" rx="2" fill="none" stroke="#f2bf3e" stroke-opacity=".6" stroke-width=".6"/>' +
        '<g fill="none" stroke="url(#' + u + 'gd)" stroke-width="1.8" stroke-linecap="round"><path d="M5 26V5H26M374 5H395V26M395 124V145H374M26 145H5V124"/></g>' +
        '<g fill="url(#' + u + 'gd)"><path d="M5 5l6 3-3 3-3-6zM395 5l-6 3 3 3 3-6zM5 145l6-3-3-3-3 6zM395 145l-6-3 3-3 3 6z"/>' +
        '<path d="M200 5l5 5-5 5-5-5z M200 135l5 5-5 5-5-5z"/></g>' +
        '<g stroke="#ffe08a" stroke-width="1.6" stroke-linecap="round" stroke-dasharray=".1 5.2" opacity=".85"><line x1="40" y1="13" x2="150" y2="13"/><line x1="250" y1="13" x2="360" y2="13"/><line x1="40" y1="137" x2="150" y2="137"/><line x1="250" y1="137" x2="360" y2="137"/></g>' +
        dust +
        /* brilho dourado cruzando o banner */
        '<g opacity=".9"><rect x="-90" y="-20" width="70" height="200" fill="url(#' + u + 'sw)" transform="skewX(-18)">' + an("x", "-90;470", 5.5, { begin: 0 }) + "</rect></g>" +
        star4(120, 38, 5, 4.2, -1) + star4(285, 108, 4.5, 3.6, -2.3) + star4(354, 44, 4, 5, -.2) +
        "</g>";
    }
  };

  /* ======================================================
     monta, pausa e solta
  ====================================================== */
  const LOW = (() => {
    try {
      if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
      if (navigator.deviceMemory && navigator.deviceMemory <= 1) return true;      // só aparelhos bem fracos (1 GB ou menos)
    } catch (e) { /* sem info: deixa animar */ }
    return false;
  })();
  const FORCE = () => { try { return localStorage.getItem("noxBannerMotion"); } catch (e) { return null; } };   // "on" liga em aparelho fraco, "off" desliga

  const motionOn = () => { const v = FORCE(); return v === "on" ? true : v === "off" ? false : !LOW; };

  let io = null;
  const watch = (svg) => {
    if (!motionOn()) { try { svg.pauseAnimations(); } catch (e) { } return; }
    if (!("IntersectionObserver" in window)) return;
    if (!io) io = new IntersectionObserver((es) => es.forEach((e) => {
      try { e.isIntersecting && !document.hidden && motionOn() ? e.target.unpauseAnimations() : e.target.pauseAnimations(); } catch (x) { }
    }), { threshold: 0.01 });
    io.observe(svg);
  };
  document.addEventListener("visibilitychange", () => {
    document.querySelectorAll("svg.bnx").forEach((s) => { try { document.hidden || !motionOn() ? s.pauseAnimations() : s.unpauseAnimations(); } catch (e) { } });
  });

  const has = (id) => typeof id === "string" && Object.prototype.hasOwnProperty.call(SCENES, id);

  /* devolve o <svg> pronto (texto) */
  function html(id) {
    if (!has(id)) return "";
    const u = "nb" + (++uid) + "_";
    return '<svg class="bnx" data-bn="' + id + '" viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' + SCENES[id](u) + "</svg>";
  }

  /* coloca o banner dentro de um elemento (o elemento precisa ser position:relative) */
  function mount(el, id) {
    if (!el || !has(id)) return false;
    const cur = el.querySelector(":scope > svg.bnx");
    if (cur && cur.dataset.bn === id) return true;
    if (cur) cur.remove();
    el.insertAdjacentHTML("afterbegin", html(id));
    watch(el.firstElementChild);
    return true;
  }
  function unmount(el) {
    if (!el) return;
    const cur = el.querySelector(":scope > svg.bnx");
    if (cur) { try { io && io.unobserve(cur); } catch (e) { } cur.remove(); }
  }
  /* para previews montados por texto (Store e Inventário): liga a pausa nos novos */
  function scan(root) {
    (root || document).querySelectorAll("svg.bnx:not([data-w])").forEach((s) => { s.dataset.w = "1"; watch(s); });
  }

  return { has, html, mount, unmount, scan, ids: () => Object.keys(SCENES), get motion() { return motionOn(); } };
})();
