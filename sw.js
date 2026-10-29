/* Noxify - Service Worker
   - SHELL: arquivos do app (HTML/CSS/JS/Firebase), atualizados em segundo plano
   - MUSIC: músicas e capas que o usuário baixou (servidas sempre do cache) */

const SHELL = "noxify-shell-v15";
const MUSIC = "noxify-music-v1";
const SHELL_FILES = ["./", "index.html", "style.css", "util.js", "playlist.js", "settings.js", "stats.js", "lyrics.js", "bg.js", "profile.js", "playlists.js", "calls.js", "voice.js", "social.js", "uploads.js", "db.js", "app.js", "manifest.json", "icon-192.png", "icon-512.png", "LogoPlayer.jpg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) =>
      Promise.allSettled(SHELL_FILES.map((f) => c.add(f)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("noxify-shell-") && k !== SHELL)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* O <audio> pede trechos (Range); o cache guarda o arquivo inteiro,
   então precisamos fatiar a resposta para o player poder buscar/pular. */
async function rangeResponse(req, res) {
  const header = req.headers.get("range");
  if (!header) return res;

  const buf = await res.arrayBuffer();
  const total = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(header);
  if (!m) return res;

  let start, end;
  if (m[1] === "" && m[2] !== "") {
    start = Math.max(0, total - parseInt(m[2], 10));
    end = total - 1;
  } else {
    start = m[1] ? parseInt(m[1], 10) : 0;
    end = m[2] ? parseInt(m[2], 10) : total - 1;
  }
  end = Math.min(end, total - 1);

  if (start >= total) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${total}` },
    });
  }

  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  e.respondWith(
    (async () => {
      /* 1) música/capa baixada? serve do cache */
      const music = await caches.open(MUSIC);
      const hit = await music.match(req.url);
      if (hit) return rangeResponse(req, hit);

      /* 2) só trata o próprio site e os módulos do Firebase (gstatic) */
      const allowed =
        url.origin === self.location.origin || url.hostname === "www.gstatic.com";
      if (!allowed) return fetch(req);

      /* mp3 não baixado: direto da rede */
      if (/\.mp3$/i.test(url.pathname)) return fetch(req);

      /* 3) app: cache primeiro, atualiza em segundo plano */
      const shell = await caches.open(SHELL);
      const cached = await shell.match(req, { ignoreSearch: true });

      const network = fetch(req)
        .then((r) => {
          if (r && r.ok && r.status === 200) {
            shell.put(req, r.clone()).catch(() => {});
          }
          return r;
        })
        .catch(() => null);

      if (cached) return cached;

      const r = await network;
      if (r) return r;

      if (req.mode === "navigate") {
        return (
          (await shell.match("index.html")) ||
          (await shell.match("./")) ||
          Response.error()
        );
      }
      return Response.error();
    })()
  );
});
