
const VERSAO_CACHE = "primia-v1";

const PRECACHE = [
  "/offline.html",
  "/icons/icon-192.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSAO_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes
          .filter((nome) => nome.startsWith("primia-") && nome !== VERSAO_CACHE)
          .map((nome) => caches.delete(nome))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;

  if (requisicao.method !== "GET") return;

  const url = new URL(requisicao.url);

  if (url.origin !== self.location.origin) return;

  if (requisicao.mode === "navigate") {
    evento.respondWith(
      fetch(requisicao).catch(() => caches.match("/offline.html"))
    );
    return;
  }


  if (url.pathname.startsWith("/css/") || url.pathname.startsWith("/js/")) {
    evento.respondWith(redePrimeiro(requisicao));
    return;
  }

 
  if (
    url.pathname.startsWith("/image/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/favicon")
  ) {
    evento.respondWith(cachePrimeiro(requisicao, evento));
  }

});

function guardarNoCache(requisicao, resposta) {
  if (!resposta || resposta.status !== 200 || resposta.type !== "basic") return;
  const copia = resposta.clone();
  caches.open(VERSAO_CACHE).then((cache) => cache.put(requisicao, copia));
}

async function redePrimeiro(requisicao) {
  try {
    const resposta = await fetch(requisicao);
    guardarNoCache(requisicao, resposta);
    return resposta;
  } catch (erro) {
    const doCache = await caches.match(requisicao);
    if (doCache) return doCache;
    throw erro;
  }
}

async function cachePrimeiro(requisicao, evento) {
  const doCache = await caches.match(requisicao);
  const daRede = fetch(requisicao).then((resposta) => {
    guardarNoCache(requisicao, resposta);
    return resposta;
  });

  if (doCache) {
    evento.waitUntil(daRede.catch(() => {}));
    return doCache;
  }
  return daRede;
}
