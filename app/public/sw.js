// Service worker do PWA. Precisa morar na raiz (/sw.js) pra ter escopo
// sobre o site inteiro.
//
// Regra principal: HTML NUNCA e cacheado. As paginas sao renderizadas no
// servidor com dados da sessao (notificacoes, premium, admin...), entao
// servir uma copia antiga poderia mostrar dado velho ou de outra conta.
// Sem rede, a navegacao cai na /offline.html.
//
// Ao mudar a lista de PRECACHE ou a estrategia, suba a versao: o activate
// apaga os caches antigos e todo mundo recebe a versao nova.
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

  // POST/PUT/DELETE (login, formularios, APIs) passam direto pro servidor.
  if (requisicao.method !== "GET") return;

  const url = new URL(requisicao.url);

  // Cloudinary, Mercado Pago, fontes externas... nao sao nossos pra cachear.
  if (url.origin !== self.location.origin) return;

  if (requisicao.mode === "navigate") {
    evento.respondWith(
      fetch(requisicao).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // CSS/JS: rede primeiro, pra alteracao no codigo aparecer no proximo F5
  // (com cache primeiro o navegador mostraria o arquivo velho uma vez).
  if (url.pathname.startsWith("/css/") || url.pathname.startsWith("/js/")) {
    evento.respondWith(redePrimeiro(requisicao));
    return;
  }

  // Imagens e icones quase nunca mudam: responde do cache na hora e
  // atualiza em segundo plano.
  if (
    url.pathname.startsWith("/image/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/favicon")
  ) {
    evento.respondWith(cachePrimeiro(requisicao, evento));
  }

  // Todo o resto (rotas JSON, /health...) segue direto pra rede.
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
    // Mantem o SW vivo ate a atualizacao em segundo plano terminar.
    evento.waitUntil(daRede.catch(() => {}));
    return doCache;
  }
  return daRede;
}
