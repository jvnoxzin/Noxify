/* =========================================================
   NOXIFY — bg.js
   Fundo com partículas roxas flutuando (como no começo).
   Respeita Configurações > Efeitos visuais (Alto / Econômico / Desligado).
========================================================= */

const Particles = (() => {

  const canvas = document.getElementById("particles");
  const ctx = canvas.getContext("2d");

  let dots = [];
  let raf = 0;
  let last = 0;
  let w = 0, h = 0;

  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function build(count){
    dots = [];
    for (let i = 0; i < count; i++){
      dots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.8,
        dx: (Math.random() - 0.5) * 0.5,
        dy: (Math.random() - 0.5) * 0.5
      });
    }
  }

  function draw(ts){

    raf = requestAnimationFrame(draw);

    const mode = Settings.get("visuals");
    if (mode === "low" && ts - last < 33) return;     // ~30 quadros por segundo
    last = ts;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(168,85,247,0.8)";

    for (const p of dots){
      p.x += p.dx;
      p.y += p.dy;

      if (p.x < 0 || p.x > w) p.dx *= -1;
      if (p.y < 0 || p.y > h) p.dy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function stop(){
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function start(){
    if (raf) return;
    raf = requestAnimationFrame(draw);
  }

  /* chamado no início e quando a configuração muda */
  function sync(){

    const mode = Settings.get("visuals");
    const want = mode === "high" ? 80 : mode === "low" ? 35 : 0;

    if (!want || document.hidden){
      stop();
      ctx.clearRect(0, 0, w, h);
      return;
    }

    if (dots.length !== want) build(want);
    start();
  }

  window.addEventListener("resize", () => { resize(); sync(); });
  document.addEventListener("visibilitychange", sync);

  resize();
  sync();

  return { sync };
})();
