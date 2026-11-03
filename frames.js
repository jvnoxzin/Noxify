/* =========================================================
   NOXIFY — frames.js
   Molduras de perfil e efeitos de tela da Store, todos animados.

   MOLDURAS (NoxFrames): cada uma é uma arte em SVG animado que vira
   o ::after de qualquer avatar com a classe .fr-xxx (perfil, membros,
   grupos, mensagens). Funciona em todo lugar sem mexer no HTML.

   EFEITOS (NoxFx): cenas nos 4 cantos da tela, só com transformação e
   opacidade (leves), sem receber toque. Ficam paradas (bonitas) em
   aparelho fraco ou quando a pessoa pede menos movimento.
========================================================= */

/* ---------- utilidades ---------- */
const NoxArt = (() => {
  const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const f = (x, d) => (+x).toFixed(d === undefined ? 1 : d);
  const an = (attr, values, dur, o) => {
    o = o || {};
    return '<animate attributeName="' + attr + '" values="' + values + '" dur="' + dur + 's" begin="' + (o.begin || 0) + 's" repeatCount="indefinite"' +
      (o.kt ? ' keyTimes="' + o.kt + '"' : "") + (o.sp ? ' calcMode="spline" keyTimes="' + o.kt + '" keySplines="' + o.sp + '"' : "") + "/>";
  };
  const tr = (type, values, dur, o) => {
    o = o || {};
    return '<animateTransform attributeName="' + (o.attr || "transform") + '" type="' + type + '" values="' + values + '" dur="' + dur + 's" begin="' + (o.begin || 0) + 's" repeatCount="indefinite"' +
      (o.sum ? ' additive="sum"' : "") + (o.kt ? ' keyTimes="' + o.kt + '"' : "") + "/>";
  };
  /* estrela de 4 pontas centrada em (0,0) */
  const star4 = (s) => "M0 -" + s + "Q" + f(s * .12) + " -" + f(s * .12) + " " + s + " 0Q" + f(s * .12) + " " + f(s * .12) + " 0 " + s + "Q-" + f(s * .12) + " " + f(s * .12) + " -" + s + " 0Q-" + f(s * .12) + " -" + f(s * .12) + " 0 -" + s + "Z";
  const pol = (cx, cy, r, deg) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];
  /* arco (graus, 0 = direita, sentido horário) */
  const arc = (cx, cy, r, a0, a1) => {
    const p0 = pol(cx, cy, r, a0), p1 = pol(cx, cy, r, a1);
    return "M" + f(p0[0]) + " " + f(p0[1]) + "A" + r + " " + r + " 0 " + ((a1 - a0 + 360) % 360 > 180 ? 1 : 0) + " 1 " + f(p1[0]) + " " + f(p1[1]);
  };
  let uid = 0;
  const next = (p) => p + (++uid) + "_";
  return { rng, f, an, tr, star4, pol, arc, next };
})();

/* =========================================================
   MOLDURAS  (viewBox 0 0 100 100; a foto ocupa o círculo r = 33 no centro)
========================================================= */
const NoxFrames = (() => {
  const { rng, f, an, tr, star4, pol, arc } = NoxArt;

  const FR = {

    /* ---------- NEON ROXA: tubo de neon com falhas, faíscas e ponto orbitando ---------- */
    neon(u) {
      let sp = "";
      [45, 135, 225, 315].forEach((a, i) => {
        const p = pol(50, 50, 43.5, a);
        sp += '<g transform="translate(' + f(p[0]) + " " + f(p[1]) + ')"><path d="' + star4(4.6) + '" fill="#fff"><animateTransform attributeName="transform" type="scale" values=".3;1.1;.3" dur="2.4s" begin="-' + f(i * .6) + 's" repeatCount="indefinite"/>' +
          an("opacity", ".2;1;.2", 2.4, { begin: "-" + f(i * .6) }) + "</path></g>";
      });
      return '<defs><linearGradient id="' + u + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0abfc"/><stop offset=".5" stop-color="#a855f7"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs>' +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="#a855f7" stroke-width="9" opacity=".16">' + an("opacity", ".1;.3;.1", 2.6) + "</circle>" +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="#d946ef" stroke-width="5.5" opacity=".28">' + an("opacity", ".2;.42;.2", 2.6) + "</circle>" +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="url(#' + u + 'g)" stroke-width="3.2" stroke-dasharray="212 14" stroke-linecap="round">' + tr("rotate", "0 50 50;360 50 50", 22) + an("opacity", ".85;1;.7;1;.9", 3.1) + "</circle>" +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="#fff" stroke-width=".9" stroke-opacity=".9" stroke-dasharray="212 14" stroke-linecap="round">' + tr("rotate", "0 50 50;360 50 50", 22) + "</circle>" +
        '<circle cx="50" cy="50" r="41.5" fill="none" stroke="#e879f9" stroke-width="1" stroke-dasharray="1 3.2" stroke-linecap="round" opacity=".75">' + tr("rotate", "360 50 50;0 50 50", 30) + "</circle>" +
        '<circle cx="50" cy="50" r="47" fill="none" stroke="#a855f7" stroke-width=".6" stroke-opacity=".45"/>' +
        sp +
        '<g>' + tr("rotate", "0 50 50;360 50 50", 4.2) + '<circle cx="50" cy="14" r="4" fill="#e879f9" opacity=".35"/><circle cx="50" cy="14" r="2.1" fill="#fff"/></g>';
    },

    /* ---------- CÓSMICA: anel de galáxia, poeira de estrelas e planeta orbitando ---------- */
    cosmic(u) {
      const r = rng(5);
      let st = "";
      for (let i = 0; i < 8; i++) {
        const p = pol(50, 50, 40 + r() * 8, r() * 360);
        st += '<g transform="translate(' + f(p[0]) + " " + f(p[1]) + ')"><path d="' + star4(f(1.6 + r() * 2.2)) + '" fill="' + (i % 3 ? "#fff" : "#a5f3fc") + '">' + an("opacity", ".1;1;.1", f(1.6 + r() * 2.4), { begin: "-" + f(r() * 3) }) + "</path></g>";
      }
      return '<defs><linearGradient id="' + u + 'g" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">' + tr("rotate", "0 .5 .5;360 .5 .5", 9, { attr: "gradientTransform" }) +
        '<stop offset="0" stop-color="#22d3ee"/><stop offset=".35" stop-color="#7c3aed"/><stop offset=".7" stop-color="#d946ef"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>' +
        '<radialGradient id="' + u + 'p" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ffe3b3"/><stop offset=".5" stop-color="#e2893a"/><stop offset="1" stop-color="#4a1d0b"/></radialGradient></defs>' +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="#6366f1" stroke-width="8" opacity=".2"/>' +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="url(#' + u + 'g)" stroke-width="3.4"/>' +
        '<circle cx="50" cy="50" r="39.6" fill="none" stroke="#fff" stroke-width="1.3" stroke-dasharray=".1 3" stroke-linecap="round" opacity=".8">' + tr("rotate", "360 50 50;0 50 50", 40) + "</circle>" +
        '<circle cx="50" cy="50" r="32.4" fill="none" stroke="#c7d2fe" stroke-width=".6" stroke-opacity=".5"/>' +
        '<g transform="rotate(-24 50 50)"><ellipse cx="50" cy="50" rx="47" ry="17" fill="none" stroke="#a5b4fc" stroke-width=".6" stroke-opacity=".4" stroke-dasharray="2 2.5"/>' +
        '<g><circle r="4" fill="url(#' + u + 'p)"/><ellipse rx="7.2" ry="1.7" fill="none" stroke="#fde7c2" stroke-width=".8" stroke-opacity=".85" transform="rotate(-20)"/><animateMotion dur="11s" repeatCount="indefinite" path="M97 50A47 17 0 1 1 3 50A47 17 0 1 1 97 50Z"/></g></g>' +
        st;
    },

    /* ---------- FOGO: anel de chamas vivas com brasas subindo ---------- */
    fire(u) {
      const r = rng(9);
      const flame = (a, h, i) => {
        const p = pol(50, 50, 34.2, a - 90);
        const w = h / 13;
        return '<g transform="translate(' + f(p[0]) + " " + f(p[1]) + ") rotate(" + a + ')"><g>' +
          tr("scale", w + " " + f(w * .8) + ";" + f(w * .82) + " " + f(w * 1.28) + ";" + w + " " + f(w * .8), f(.7 + r() * .7), { begin: "-" + f(r() * 2) }) +
          '<path d="M0 1C-5.2 -1.5 -6 -7.5 -1.6 -12.4C-1 -8.6 .6 -8.4 1.6 -10.2C4.6 -6.4 5.4 -2 0 1Z" fill="url(#' + u + 'o)"/>' +
          '<path d="M0 .5C-2.8 -1 -3.2 -4.2 -.8 -7C-.4 -5 .4 -4.8 1 -5.8C2.6 -3.6 2.8 -1.4 0 .5Z" fill="url(#' + u + 'i)"/></g></g>';
      };
      let fl = "";
      for (let i = 0; i < 20; i++) fl += flame(i * 18 + r() * 5, 11 + r() * 9 + (i % 2 ? 0 : 3), i);
      let em = "";
      for (let i = 0; i < 9; i++) {
        const p = pol(50, 50, 38 + r() * 6, r() * 360);
        em += '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + f(.7 + r() * .9) + '" fill="#fde047"><animate attributeName="cy" values="' + f(p[1]) + ";" + f(p[1] - 14 - r() * 10) + '" dur="' + f(1.6 + r() * 1.8) + 's" begin="-' + f(r() * 3) + 's" repeatCount="indefinite"/>' +
          an("opacity", "0;1;0", f(1.6 + r() * 1.8), { begin: "-" + f(r() * 3) }) + "</circle>";
      }
      return '<defs><linearGradient id="' + u + 'o" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fbbf24"/><stop offset=".45" stop-color="#f97316"/><stop offset="1" stop-color="#dc2626"/></linearGradient>' +
        '<linearGradient id="' + u + 'i" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fffbe0"/><stop offset="1" stop-color="#fde047"/></linearGradient>' +
        '<linearGradient id="' + u + 'r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset=".5" stop-color="#f97316"/><stop offset="1" stop-color="#b91c1c"/></linearGradient></defs>' +
        '<circle cx="50" cy="50" r="38" fill="none" stroke="#f97316" stroke-width="10" opacity=".16">' + an("opacity", ".1;.28;.1", 1.3) + "</circle>" +
        fl +
        '<circle cx="50" cy="50" r="34" fill="none" stroke="url(#' + u + 'r)" stroke-width="2.6"/>' +
        '<circle cx="50" cy="50" r="32.6" fill="none" stroke="#fff7c2" stroke-width=".5" stroke-opacity=".6"/>' + em;
    },

    /* ---------- FUTURISTA: HUD com segmentos giratórios, escaneamento e colchetes ---------- */
    futur(u) {
      let ticks = "";
      for (let i = 0; i < 4; i++) {
        const a = 45 + i * 90, p = pol(50, 50, 46, a);
        ticks += '<g transform="translate(' + f(p[0]) + " " + f(p[1]) + ") rotate(" + (a + 90) + ')"><path d="M-5 2.4V-2.4H5V2.4" fill="none" stroke="#67e8f9" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' + an("opacity", "1;.35;1", 2, { begin: "-" + f(i * .5) }) + "</path></g>";
      }
      return '<defs><linearGradient id="' + u + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0fbff"/><stop offset=".5" stop-color="#22d3ee"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs>' +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="#22d3ee" stroke-width="7" opacity=".1"/>' +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="url(#' + u + 'g)" stroke-width="2.6" stroke-dasharray="30 5 12 5 6 5" stroke-linecap="butt">' + tr("rotate", "0 50 50;360 50 50", 16) + "</circle>" +
        '<circle cx="50" cy="50" r="40.4" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-dasharray="1.4 2.1" opacity=".8">' + tr("rotate", "360 50 50;0 50 50", 26) + "</circle>" +
        '<circle cx="50" cy="50" r="33.4" fill="none" stroke="#a5f3fc" stroke-width=".7" stroke-opacity=".7"/>' +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="#fff" stroke-width="3.2" stroke-dasharray="14 212" stroke-linecap="round" opacity=".95">' + tr("rotate", "0 50 50;360 50 50", 3.4) + "</circle>" +
        '<path d="' + arc(50, 50, 44.4, 200, 250) + '" fill="none" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round" opacity=".8">' + an("opacity", ".3;1;.3", 2.2) + "</path>" +
        '<path d="' + arc(50, 50, 44.4, 20, 70) + '" fill="none" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round" opacity=".8">' + an("opacity", "1;.3;1", 2.2) + "</path>" +
        ticks +
        '<g fill="#67e8f9"><circle cx="50" cy="2.6" r="1.4">' + an("opacity", ".2;1;.2", 1.4) + '</circle><circle cx="50" cy="97.4" r="1.4">' + an("opacity", "1;.2;1", 1.4) + "</circle></g>";
    },

    /* ---------- AURORA: fitas de luz que mudam de cor girando ---------- */
    aurora(u) {
      let wv = "";
      for (let a = 0; a <= 360; a += 6) {
        const p = pol(50, 50, 44 + Math.sin(a * Math.PI / 180 * 6) * 2.4, a);
        wv += (a ? "L" : "M") + f(p[0]) + " " + f(p[1]);
      }
      const grad = (id, dur, rev) => '<linearGradient id="' + u + id + '" x1="0" y1="0" x2="1" y2="1">' + tr("rotate", rev ? "360 .5 .5;0 .5 .5" : "0 .5 .5;360 .5 .5", dur, { attr: "gradientTransform" }) +
        '<stop offset="0" stop-color="#34d399"/><stop offset=".3" stop-color="#22d3ee"/><stop offset=".6" stop-color="#a78bfa"/><stop offset=".85" stop-color="#f472b6"/><stop offset="1" stop-color="#34d399"/></linearGradient>';
      const tw = [[16, 20, 3.6], [86, 28, 3], [90, 78, 3.8], [22, 88, 3], [52, 4, 3.2]].map((s, i) =>
        '<g transform="translate(' + s[0] + " " + s[1] + ')"><path d="' + star4(s[2]) + '" fill="#e8fff6">' + an("opacity", ".1;1;.1", f(2 + i * .5), { begin: "-" + f(i * .7) }) + "</path></g>").join("");
      return "<defs>" + grad("a", 7) + grad("b", 11, true) + grad("c", 9) + "</defs>" +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="url(#' + u + 'a)" stroke-width="10" opacity=".18"/>' +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="url(#' + u + 'a)" stroke-width="4.2">' + an("stroke-width", "3.4;5;3.4", 3.5) + "</circle>" +
        '<circle cx="50" cy="50" r="40.2" fill="none" stroke="url(#' + u + 'b)" stroke-width="1.8" opacity=".85"/>' +
        '<path d="' + wv + 'Z" fill="none" stroke="url(#' + u + 'c)" stroke-width="1.6" stroke-linejoin="round" opacity=".8">' + tr("rotate", "0 50 50;360 50 50", 40) + "</path>" +
        '<circle cx="50" cy="50" r="33.2" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".6"/>' + tw;
    },

    /* ---------- PARTÍCULAS: nuvens de luz em órbitas diferentes ---------- */
    particles(u) {
      const r = rng(31);
      const orbit = (n, rad, dur, rev, hue) => {
        let g = "";
        for (let i = 0; i < n; i++) {
          const p = pol(50, 50, rad + (r() - .5) * 5, i * 360 / n + r() * 30), s = .9 + r() * 1.7;
          g += '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + f(s * 2.6) + '" fill="' + hue + '" opacity=".28"/><circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + f(s) + '" fill="#fff">' + an("opacity", ".35;1;.35", f(1.4 + r() * 1.6), { begin: "-" + f(r() * 2) }) + "</circle>";
        }
        return "<g>" + tr("rotate", (rev ? "360 50 50;0 50 50" : "0 50 50;360 50 50"), dur) + g + "</g>";
      };
      return '<circle cx="50" cy="50" r="35.5" fill="none" stroke="#c084fc" stroke-width="1.4" stroke-opacity=".38"/>' +
        '<circle cx="50" cy="50" r="35.5" fill="none" stroke="#e9d5ff" stroke-width=".5" stroke-opacity=".75" stroke-dasharray="1 5">' + tr("rotate", "0 50 50;360 50 50", 30) + "</circle>" +
        orbit(7, 38, 9, false, "#c084fc") + orbit(6, 43, 14, true, "#e879f9") + orbit(5, 47, 20, false, "#a78bfa") +
        '<circle cx="50" cy="12" r="3.2" fill="#f0abfc" opacity=".6">' + an("opacity", ".25;.8;.25", 2.2) + "</circle>";
    },

    /* ---------- IMPERIAL: ouro e carmesim, louros, coroa e joias ---------- */
    special(u) {
      let leaves = "";
      for (let i = 0; i < 8; i++) {
        const th = (12 + i * 17) * Math.PI / 180;
        [-1, 1].forEach((sd) => {
          [[43.4, 1], [39.8, -1]].forEach((rg) => {
            const R = rg[0], px = 50 + sd * R * Math.sin(th), py = 50 + R * Math.cos(th);
            const phi = Math.atan2(sd * Math.cos(th), Math.sin(th)) * 180 / Math.PI + sd * rg[1] * 30;
            leaves += '<ellipse rx="2.3" ry="6" fill="url(#' + u + 'g)" stroke="#5c3a00" stroke-width=".3" transform="translate(' + f(px) + " " + f(py) + ") rotate(" + f(phi, 0) + ')">' + an("opacity", ".78;1;.78", 3.2, { begin: "-" + f(i * .4) }) + "</ellipse>";
          });
        });
      }
      return '<defs><linearGradient id="' + u + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".45" stop-color="#f2bf3e"/><stop offset=".75" stop-color="#b9791a"/><stop offset="1" stop-color="#ffe289"/></linearGradient>' +
        '<radialGradient id="' + u + 'r" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ff8a99"/><stop offset=".5" stop-color="#d4122b"/><stop offset="1" stop-color="#6b0714"/></radialGradient></defs>' +
        '<circle cx="50" cy="50" r="37" fill="none" stroke="#ffcf5a" stroke-width="8" opacity=".14">' + an("opacity", ".1;.24;.1", 3.5) + "</circle>" +
        leaves +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="url(#' + u + 'g)" stroke-width="4.4"/>' +
        '<circle cx="50" cy="50" r="33.2" fill="none" stroke="#8a0c1c" stroke-width="1.7"/>' +
        '<circle cx="50" cy="50" r="38.6" fill="none" stroke="#ffe08a" stroke-width=".7" stroke-opacity=".9"/>' +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="#fffbe0" stroke-width="2" stroke-dasharray="9 217" stroke-linecap="round" opacity=".95">' + tr("rotate", "0 50 50;360 50 50", 5) + "</circle>" +
        /* joias laterais */
        '<g><path d="M14 50l4.2-5.2 4.2 5.2-4.2 5.2Z" fill="url(#' + u + 'r)" stroke="url(#' + u + 'g)" stroke-width="1.1"/><path d="M86 50l-4.2-5.2-4.2 5.2 4.2 5.2Z" fill="url(#' + u + 'r)" stroke="url(#' + u + 'g)" stroke-width="1.1"/></g>' +
        /* laço embaixo */
        '<g transform="translate(50 89)"><path d="M0 0L-9 6.6-6 -.6ZM0 0L9 6.6 6 -.6Z" fill="url(#' + u + 'g)" stroke="#5c3a00" stroke-width=".4"/><path d="M-3 1L-8.6 10.2-5.4 8.6ZM3 1L8.6 10.2 5.4 8.6Z" fill="#b01227" stroke="#5c3a00" stroke-width=".4"/><circle r="3.1" fill="url(#' + u + 'r)" stroke="url(#' + u + 'g)" stroke-width="1"/></g>' +
        /* coroa */
        '<g transform="translate(50 12.5)"><path d="M-12.6 6.8L-14.6 -7 -7.2 -1 0 -11.4 7.2 -1 14.6 -7 12.6 6.8Z" fill="url(#' + u + 'g)" stroke="#5c3a00" stroke-width=".7" stroke-linejoin="round"/>' +
        '<rect x="-13.6" y="5.6" width="27.2" height="4.6" rx="1.5" fill="url(#' + u + 'g)" stroke="#5c3a00" stroke-width=".7"/>' +
        '<circle cx="-14.6" cy="-8" r="2.1" fill="#fff0b3" stroke="#8a5a0b" stroke-width=".4"/><circle cx="14.6" cy="-8" r="2.1" fill="#fff0b3" stroke="#8a5a0b" stroke-width=".4"/><circle cy="-12.4" r="2.5" fill="url(#' + u + 'r)" stroke="#8a5a0b" stroke-width=".5"/>' +
        '<circle cx="-6" cy="7.9" r="1.1" fill="#7fe4ff"/><circle cx="0" cy="7.9" r="1.3" fill="#ff4d6a"/><circle cx="6" cy="7.9" r="1.1" fill="#7fe4ff"/>' +
        '<g transform="translate(0 -12.4)"><path d="' + star4(6) + '" fill="#fff" opacity="0">' + an("opacity", "0;1;0", 3.4) + tr("scale", ".2;1.1;.2", 3.4) + "</path></g></g>" +
        '<g transform="translate(86 24)"><path d="' + star4(4) + '" fill="#fff" opacity="0">' + an("opacity", "0;1;0", 4, { begin: -1 }) + tr("scale", ".2;1;.2", 4, { begin: -1 }) + "</path></g>" +
        '<g transform="translate(15 76)"><path d="' + star4(3.6) + '" fill="#fff" opacity="0">' + an("opacity", "0;1;0", 4.4, { begin: -2.4 }) + tr("scale", ".2;1;.2", 4.4, { begin: -2.4 }) + "</path></g>";
    }
  };

  const strip = (s) => s.replace(/<animate(?:Transform|Motion)?\b[^>]*\/>/g, "");
  const svg = (id, animated) => {
    const u = "nf" + id + "_";
    let s = FR[id](u);
    if (!animated) s = strip(s);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + s + "</svg>";
  };
  const uri = (s) => 'url("data:image/svg+xml,' + encodeURIComponent(s) + '")';

  /* gera e injeta o CSS (uma vez) */
  function inject() {
    if (document.getElementById("frStyles")) return;
    let css = ".fr{position:relative}.fr::before{content:none}" +
      ".fr::after{content:'';position:absolute;inset:-26%;border-radius:0;padding:0;pointer-events:none;background:center/100% 100% no-repeat;-webkit-mask:none;mask:none;animation:none;z-index:1}";
    Object.keys(FR).forEach((id) => {
      css += ".fr-" + id + "::after{background-image:" + uri(svg(id, true)) + "}";
      css += "html.lite .fr-" + id + "::after{background-image:" + uri(svg(id, false)) + "}";
    });
    const el = document.createElement("style");
    el.id = "frStyles"; el.textContent = css;
    document.head.appendChild(el);
  }
  const ids = () => Object.keys(FR);
  return { inject, ids, svg };
})();

/* =========================================================
   EFEITOS DE TELA (cantos). Cada cena tem viewBox 0 0 120 120,
   com a origem no canto da tela; os outros cantos são espelhados.
========================================================= */
const NoxFx = (() => {
  const { rng, f, an, tr, star4, pol } = NoxArt;

  const glow = (u, col, op, r) => '<radialGradient id="' + u + "gl" + col.slice(1) + '" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 0) scale(' + r + ')"><stop offset="0" stop-color="' + col + '" stop-opacity="' + op + '"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></radialGradient>';

  const FX = {

    /* ---------- PARTÍCULAS ROXAS: luzes que sobem com brilho, balançando ---------- */
    particles(u) {
      const r = rng(5);
      let p = "";
      for (let i = 0; i < 18; i++) {
        const x = 5 + r() * 105, y0 = 112 - r() * 26, dy = 44 + r() * 70, d = 4.6 + r() * 4.4, s = .9 + r() * 2.1;
        const col = ["#c084fc", "#e879f9", "#a78bfa", "#f0abfc"][i % 4], b = "-" + f(r() * 9);
        p += '<g transform="translate(' + f(x) + " " + f(y0) + ')"><g>' +
          '<animateTransform attributeName="transform" type="translate" values="0 0;' + f((r() - .5) * 18) + " " + f(-dy) + '" dur="' + f(d) + 's" begin="' + b + 's" repeatCount="indefinite"/>' +
          '<animateTransform attributeName="transform" type="translate" values="0 0;6 0;0 0;-6 0;0 0" dur="' + f(2.6 + r() * 2) + 's" begin="' + b + 's" repeatCount="indefinite" additive="sum"/>' +
          '<circle r="' + f(s * 3) + '" fill="' + col + '" opacity=".28"/><circle r="' + f(s) + '" fill="#fff"/>' +
          an("opacity", "0;1;.9;0", d, { begin: b, kt: "0;.15;.7;1" }) + "</g></g>";
      }
      return "<defs>" + glow(u, "#a855f7", .55, 80) + "</defs>" +
        '<circle r="80" fill="url(#' + u + 'gla855f7)">' + an("opacity", ".55;1;.55", 5) + "</circle>" +
        p;
    },

    /* ---------- RAIOS NEON: relâmpagos de verdade com clarão ---------- */
    lightning(u) {
      const r = rng(17);
      const bolt = (x0, len, begin, dur) => {
        let x = x0, y = 0, d = "M" + x + " 0";
        const n = 7;
        for (let i = 1; i <= n; i++) { y = len * i / n; x += (r() - .5) * 17; d += "L" + f(x) + " " + f(y); }
        const bx = x0 + (r() - .5) * 8, by = len * .45;
        const br = "M" + f(bx) + " " + f(by) + "L" + f(bx + 12 + r() * 8) + " " + f(by + 16) + "L" + f(bx + 9) + " " + f(by + 30);
        const flick = an("opacity", "0;0;1;.2;.95;.15;.7;0;0", dur, { begin: begin, kt: "0;.78;.8;.82;.84;.87;.9;.95;1" });
        return "<g opacity=\"0\">" + flick +
          '<path d="' + d + br + '" fill="none" stroke="#c084fc" stroke-width="6" stroke-linejoin="round" opacity=".32"/>' +
          '<path d="' + d + br + '" fill="none" stroke="#e879f9" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>' +
          '<path d="' + d + '" fill="none" stroke="#fff" stroke-width=".9" stroke-linejoin="round" stroke-linecap="round"/>' +
          '<circle cx="' + f(x) + '" cy="' + f(len) + '" r="5" fill="#f0abfc" opacity=".5"/></g>' +
          '<circle r="70" fill="url(#' + u + 'gle879f9)" opacity="0">' + an("opacity", "0;0;.9;.15;.7;0;0", dur, { begin: begin, kt: "0;.78;.8;.84;.88;.93;1" }) + "</circle>";
      };
      return "<defs>" + glow(u, "#e879f9", .5, 70) + "</defs>" +
        '<circle r="70" fill="url(#' + u + 'gle879f9)" opacity=".25">' + an("opacity", ".12;.32;.12", 4) + "</circle>" +
        bolt(22, 70, -1.2, 6.2) + bolt(58, 84, -3.6, 7.4) + bolt(92, 62, -5.4, 5.6);
    },

    /* ---------- ESTRELAS: cintilações em cruz e uma estrela cadente ---------- */
    stars(u) {
      const r = rng(23);
      let s = "";
      const spec = [[14, 16, 8], [48, 12, 5], [84, 20, 6.5], [30, 46, 9], [68, 52, 5], [104, 44, 4.2], [12, 82, 5.5], [50, 86, 4], [92, 90, 4.6], [76, 100, 3.4]];
      spec.forEach((p, i) => {
        const col = i % 4 === 0 ? "#fde68a" : i % 3 === 0 ? "#f5d0fe" : "#fff";
        s += '<g transform="translate(' + p[0] + " " + p[1] + ')"><g><animateTransform attributeName="transform" type="scale" values=".35;1;.35" dur="' + f(2.4 + r() * 2) + 's" begin="-' + f(r() * 4) + 's" repeatCount="indefinite"/>' +
          '<circle r="' + f(p[2] * .9) + '" fill="' + col + '" opacity=".13"/><path d="' + star4(p[2]) + '" fill="' + col + '"/>' +
          '<path d="' + star4(p[2] * .55) + '" fill="#fff" transform="rotate(45)"/>' +
          an("opacity", ".25;1;.25", f(2.4 + r() * 2), { begin: "-" + f(r() * 4) }) + "</g></g>";
      });
      for (let i = 0; i < 16; i++) s += '<circle cx="' + f(r() * 118) + '" cy="' + f(r() * 118) + '" r="' + f(.4 + r() * .7) + '" fill="#fff" opacity=".5">' + an("opacity", ".1;.9;.1", f(1.6 + r() * 2.4), { begin: "-" + f(r() * 3) }) + "</circle>";
      return "<defs>" + glow(u, "#c4b5fd", .35, 70) + '<linearGradient id="' + u + 'sh" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
        '<circle r="70" fill="url(#' + u + 'glc4b5fd)"/>' + s +
        '<g opacity="0"><line x1="0" y1="0" x2="-22" y2="-9" stroke="url(#' + u + 'sh)" stroke-width="1.5" stroke-linecap="round"/><circle r="1.5" fill="#fff"/>' +
        '<animateTransform attributeName="transform" type="translate" values="10 8;112 50" dur="8s" repeatCount="indefinite"/>' + an("opacity", "0;1;1;0;0", 8, { kt: "0;.05;.14;.22;1" }) + "</g>";
    },

    /* ---------- ONDAS FUTURISTAS: pulsos de radar saindo do canto ---------- */
    waves(u) {
      let arcs = "", pulses = "";
      [30, 50, 70, 90, 110].forEach((rad, i) => {
        arcs += '<circle r="' + rad + '" fill="none" stroke="url(#' + u + 'g)" stroke-width="' + (i % 2 ? .6 : 1) + '" stroke-opacity="' + (.55 - i * .06) + '"' + (i % 2 ? ' stroke-dasharray="2 3"' : "") + "/>";
      });
      for (let i = 0; i < 4; i++) {
        pulses += '<circle r="6" fill="none" stroke="' + (i % 2 ? "#a78bfa" : "#22d3ee") + '" stroke-width="2" opacity="0">' +
          an("r", "6;116", 5.2, { begin: "-" + f(i * 1.3) }) + an("opacity", ".9;.55;0", 5.2, { begin: "-" + f(i * 1.3) }) + an("stroke-width", "2.6;.5", 5.2, { begin: "-" + f(i * 1.3) }) + "</circle>";
      }
      return '<defs><linearGradient id="' + u + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>' + glow(u, "#22d3ee", .3, 60) + "</defs>" +
        '<circle r="60" fill="url(#' + u + 'gl22d3ee)">' + an("opacity", ".6;1;.6", 3.6) + "</circle>" + arcs + pulses +
        '<circle r="58" fill="none" stroke="#67e8f9" stroke-width="1.6" stroke-dasharray="9 7 2 7" opacity=".8">' + tr("rotate", "0;360", 34) + "</circle>" +
        '<circle r="80" fill="none" stroke="#a78bfa" stroke-width="1.2" stroke-dasharray="1.2 4" opacity=".75">' + tr("rotate", "360;0", 48) + "</circle>" +
        '<circle r="2.2" fill="#fff"><animateMotion dur="6s" repeatCount="indefinite" path="M70 0A70 70 0 0 1 0 70"/></circle>' +
        '<circle r="2.2" fill="#fff"><animateMotion dur="9s" repeatCount="indefinite" begin="-3s" path="M0 90A90 90 0 0 0 90 0"/></circle>';
    },

    /* ---------- FUMAÇA: névoa em camadas subindo e se enrolando ---------- */
    smoke(u) {
      const r = rng(41);
      const blob = (px, py, rx, ry, col, dx, dy, d, b) =>
        '<g transform="translate(' + px + " " + py + ')"><g>' +
        '<animateTransform attributeName="transform" type="translate" values="0 0;' + dx + " " + dy + ';0 0" dur="' + d + 's" begin="' + b + 's" repeatCount="indefinite"/>' +
        '<animateTransform attributeName="transform" type="scale" values=".85;1.3;.85" dur="' + (d * .8) + 's" begin="' + b + 's" repeatCount="indefinite" additive="sum"/>' +
        '<ellipse rx="' + rx + '" ry="' + ry + '" fill="url(#' + u + col + ')"/>' + an("opacity", ".35;.9;.35", d * .9, { begin: b }) + "</g></g>";
      const rg = (id, c) => '<radialGradient id="' + u + id + '"><stop offset="0" stop-color="' + c + '" stop-opacity=".55"/><stop offset=".6" stop-color="' + c + '" stop-opacity=".2"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient>';
      const wisp = (d, dur, b) => '<path d="' + d + '" fill="none" stroke="#ddd6fe" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="26 120" opacity=".22">' + an("stroke-dashoffset", "146;0", dur, { begin: b }) + "</path>";
      return "<defs>" + rg("a", "#a855f7") + rg("b", "#d946ef") + rg("c", "#6366f1") + "</defs>" +
        blob(26, 26, 46, 30, "a", 22, 14, 11, -1) + blob(70, 12, 40, 24, "b", 16, 22, 13, -4) + blob(8, 76, 36, 32, "c", 26, -10, 12, -7) +
        blob(58, 64, 34, 22, "a", 18, 8, 10, -3) + blob(100, 36, 28, 36, "c", -10, 20, 15, -6) + blob(36, 104, 30, 20, "b", 22, -6, 9, -2) +
        wisp("M6 92C30 80 20 56 46 48S70 30 84 4", 7, -1) + wisp("M-4 60C22 52 18 34 40 26S62 8 70 -4", 9, -4) + wisp("M30 112C50 98 44 80 66 74S100 58 118 40", 8, -2);
    },

    /* ---------- CÓSMICO: nebulosa, planeta com anel e cometa ---------- */
    cosmic(u) {
      const r = rng(67);
      const neb = (cx, cy, rx, ry, id, dx, dy, d) => '<g transform="translate(' + cx + " " + cy + ')"><ellipse rx="' + rx + '" ry="' + ry + '" fill="url(#' + u + id + ')"><animateTransform attributeName="transform" type="translate" values="0 0;' + dx + " " + dy + ';0 0" dur="' + d + 's" repeatCount="indefinite"/>' + an("opacity", ".6;1;.6", d * .7) + "</ellipse></g>";
      const rg = (id, c, o) => '<radialGradient id="' + u + id + '"><stop offset="0" stop-color="' + c + '" stop-opacity="' + o + '"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient>';
      let st = "";
      for (let i = 0; i < 20; i++) st += '<circle cx="' + f(r() * 118) + '" cy="' + f(r() * 118) + '" r="' + f(.4 + r() * .9) + '" fill="' + (i % 4 ? "#fff" : "#a5f3fc") + '" opacity=".5">' + an("opacity", ".1;1;.1", f(1.5 + r() * 2.8), { begin: "-" + f(r() * 4) }) + "</circle>";
      return "<defs>" + rg("a", "#d946ef", .75) + rg("b", "#3b82f6", .7) + rg("c", "#22d3ee", .5) +
        '<radialGradient id="' + u + 'p" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ffe3b3"/><stop offset=".5" stop-color="#e2893a"/><stop offset="1" stop-color="#4a1d0b"/></radialGradient>' +
        '<linearGradient id="' + u + 'sh" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
        neb(14, 18, 66, 46, "a", 14, 8, 12) + neb(70, 54, 52, 40, "b", -12, 10, 15) + neb(24, 78, 40, 34, "c", 10, -8, 13) + st +
        /* planeta pequeno com anel */
        '<g transform="translate(78 78)"><g>' + an("opacity", "1;1", 1) + '<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="6s" repeatCount="indefinite"/>' +
        '<ellipse rx="13" ry="3.2" fill="none" stroke="#c7d2fe" stroke-width="1.4" stroke-opacity=".6" transform="rotate(-20)"/><circle r="6.4" fill="url(#' + u + 'p)"/>' +
        '<path d="M-5 -1.6q5 2 10 -.6" fill="none" stroke="#7a3410" stroke-opacity=".4" stroke-width="1"/>' +
        '<g clip-path="inset(0 0 50% 0)"></g><ellipse rx="13" ry="3.2" fill="none" stroke="#e0e7ff" stroke-width="1.4" stroke-opacity=".9" stroke-dasharray="20 40" transform="rotate(-20)"/></g></g>' +
        /* cometa */
        '<g opacity="0"><line x1="0" y1="0" x2="-30" y2="-13" stroke="url(#' + u + 'sh)" stroke-width="1.8" stroke-linecap="round"/><circle r="1.9" fill="#fff"/>' +
        '<animateTransform attributeName="transform" type="translate" values="6 4;118 54" dur="9s" begin="-2s" repeatCount="indefinite"/>' + an("opacity", "0;1;1;0;0", 9, { begin: -2, kt: "0;.04;.13;.2;1" }) + "</g>";
    },

    /* ---------- BRILHO: aura com raios de luz e cintilações ---------- */
    glow(u) {
      const r = rng(83);
      let rays = "";
      for (let i = 0; i < 9; i++) {
        const a = 6 + i * 10, p0 = pol(0, 0, 130, a - 2.2), p1 = pol(0, 0, 130, a + 2.2);
        rays += '<polygon points="0,0 ' + f(p0[0]) + "," + f(p0[1]) + " " + f(p1[0]) + "," + f(p1[1]) + '" opacity="' + f(.35 + (i % 3) * .2, 2) + '"/>';
      }
      let sp = "";
      [[30, 24, 7], [64, 44, 5], [18, 66, 5.5], [88, 20, 4.5], [50, 80, 4], [100, 62, 3.6]].forEach((p, i) => {
        sp += '<g transform="translate(' + p[0] + " " + p[1] + ')"><g><animateTransform attributeName="transform" type="scale" values="0;1.15;0" dur="3.6s" begin="-' + f(i * .6) + 's" repeatCount="indefinite"/><animateTransform attributeName="transform" type="rotate" values="0;90" dur="3.6s" begin="-' + f(i * .6) + 's" repeatCount="indefinite" additive="sum"/>' +
          '<path d="' + star4(p[2]) + '" fill="#fff"/><circle r="' + f(p[2] * .7) + '" fill="#f0abfc" opacity=".25"/></g></g>';
      });
      for (let i = 0; i < 12; i++) sp += '<circle cx="' + f(r() * 116) + '" cy="' + f(r() * 116) + '" r="' + f(.5 + r() * .8) + '" fill="#fff" opacity=".5">' + an("opacity", ".1;.95;.1", f(1.6 + r() * 2), { begin: "-" + f(r() * 3) }) + "</circle>";
      return "<defs>" + glow(u, "#c084fc", .75, 84) + glow(u, "#fff7ed", .5, 36) + '<linearGradient id="' + u + 'ray" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#f0abfc" stop-opacity="0"/></linearGradient></defs>' +
        '<circle r="84" fill="url(#' + u + 'glc084fc)">' + an("opacity", ".65;1;.65", 4.4) + "</circle>" +
        '<g fill="url(#' + u + 'ray)">' + tr("rotate", "-7;7;-7", 12) + rays + "</g>" +
        '<circle r="36" fill="url(#' + u + 'glfff7ed)">' + an("opacity", ".5;1;.5", 3.2) + "</circle>" + sp;
    }
  };

  const has = (id) => typeof id === "string" && id.startsWith("fx_") && Object.prototype.hasOwnProperty.call(FX, id.slice(3));
  let uid = 0;
  const cornerSvg = (key) => '<svg class="fxs" viewBox="0 0 120 120" width="100%" height="100%" preserveAspectRatio="xMinYMin meet" aria-hidden="true" focusable="false">' + FX[key]("nx" + (++uid) + "_") + "</svg>";

  /* HTML dos 4 cantos para um efeito */
  function markup(id) {
    if (!has(id)) return "";
    const key = id.slice(3);
    return ["tl", "tr", "bl", "br"].map((c) => '<div class="fxc ' + c + '">' + cornerSvg(key) + "</div>").join("");
  }

  const motionOn = () => (typeof NoxBanners !== "undefined" ? NoxBanners.motion : true);
  function scan(root) {
    (root || document).querySelectorAll("svg.fxs").forEach((s) => {
      try { motionOn() && !document.hidden ? s.unpauseAnimations() : s.pauseAnimations(); } catch (e) { }
    });
  }
  document.addEventListener("visibilitychange", () => scan(document));
  return { has, markup, scan, ids: () => Object.keys(FX) };
})();

try { NoxFrames.inject(); } catch (e) { console.warn("molduras:", e); }
