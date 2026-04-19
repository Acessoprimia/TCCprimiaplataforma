const hamburger = document.getElementById("hamburger");
const navMobile = document.getElementById("navMobile");
const overlay = document.getElementById("overlay");
const body = document.body;
const sinoBtn = document.getElementById("sino-btn");
const notifDropdown = document.getElementById("notif-dropdown");
const marcarTodas = document.getElementById("notif-marcar-todas");
const mobileSinoBtn = document.getElementById("mobile-sino-btn");

function toggleMenu() {
  if (!hamburger || !navMobile || !overlay) return;

  hamburger.classList.toggle("active");
  navMobile.classList.toggle("active");
  overlay.classList.toggle("active");
  body.style.overflow = navMobile.classList.contains("active") ? "hidden" : "";
}

if (hamburger) hamburger.addEventListener("click", toggleMenu);
if (overlay) overlay.addEventListener("click", toggleMenu);

if (navMobile) {
  const mobileLinks = navMobile.querySelectorAll("a");
  mobileLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth < 1024) {
        toggleMenu();
      }
    });
  });
}

window.addEventListener("resize", () => {
  if (navMobile && window.innerWidth >= 1024 && navMobile.classList.contains("active")) {
    toggleMenu();
  }
});

function atualizarContador(total) {
  const contador = document.querySelector(".sino-contador");
  if (!contador) return;

  if (!total) {
    contador.style.display = "none";
    contador.textContent = "0";
  } else {
    contador.textContent = total;
    contador.style.display = "flex";
  }
}

function montarItemNotificacao(notificacao) {
  const li = document.createElement("li");
  li.className = `notif-item ${notificacao.lida ? "" : "nova"}`;
  li.dataset.id = notificacao.id_notificacao;

  const link = document.createElement("a");
  link.className = "notif-link";
  link.href = notificacao.link || "/sobre";

  const texto = document.createElement("p");
  texto.className = "notif-texto";
  texto.textContent = `${notificacao.titulo} - ${notificacao.mensagem}`;

  const tempo = document.createElement("time");
  tempo.className = "notif-tempo";
  tempo.textContent = notificacao.tempo || "agora";

  link.appendChild(texto);
  link.appendChild(tempo);
  li.appendChild(link);

  li.addEventListener("click", async (event) => {
    event.preventDefault();
    li.classList.remove("nova");
    if (notificacao.id_notificacao) {
      await fetch(`/api/notificacoes/${notificacao.id_notificacao}/lida`, {
        method: "POST",
      });
      carregarNotificacoes();
    }
    window.location.href = link.href || "/sobre";
  });

  return li;
}

function renderizarNotificacoes(notificacoes) {
  const lista = document.getElementById("notif-lista");
  if (!lista) return;

  lista.innerHTML = "";

  if (!notificacoes.length) {
    const li = document.createElement("li");
    li.className = "notif-item";
    li.innerHTML = '<p class="notif-texto">Você ainda não tem notificações.</p><time class="notif-tempo">agora</time>';
    lista.appendChild(li);
    return;
  }

  notificacoes.forEach((notificacao) => {
    lista.appendChild(montarItemNotificacao(notificacao));
  });
}

async function carregarNotificacoes() {
  try {
    const resposta = await fetch("/api/notificacoes");
    if (!resposta.ok) return;

    const dados = await resposta.json();
    renderizarNotificacoes(dados.notificacoes || []);
    atualizarContador(dados.totalNaoLidas || 0);
  } catch (erro) {
    console.error("Erro ao atualizar notificações:", erro);
  }
}

if (sinoBtn && notifDropdown) {
  sinoBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    notifDropdown.classList.toggle("aberto");
    carregarNotificacoes();
  });
}

document.addEventListener("click", function (e) {
  const container = document.querySelector(".sino-container");
  if (container && notifDropdown && !container.contains(e.target)) {
    notifDropdown.classList.remove("aberto");
  }
});

if (marcarTodas) {
  marcarTodas.addEventListener("click", async function () {
    await fetch("/api/notificacoes/marcar-todas", { method: "POST" });
    document.querySelectorAll(".notif-item.nova").forEach((item) => {
      item.classList.remove("nova");
    });
    atualizarContador(0);
    carregarNotificacoes();
  });
}

if (mobileSinoBtn && notifDropdown) {
  mobileSinoBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    notifDropdown.classList.toggle("aberto");
    carregarNotificacoes();
  });
}

carregarNotificacoes();
setInterval(carregarNotificacoes, 30000);
