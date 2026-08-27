// Cookie Consent Banner Logic
(function () {
  "use strict";

  var COOKIE_NAME = "primia_cookie_consent";
  var COOKIE_EXPIRY_DAYS = 365;
  var BANNER_CLASS = "visible";
  var banner = document.getElementById("cookieBanner");
  var acceptBtn = document.getElementById("cookieAcceptBtn");

  // Verifica se o usuário já escolheu (aceitou ou rejeitou)
  function hasChoice() {
    var cookie = document.cookie.split(";").map(function (c) {
      return c.trim();
    }).find(function (c) {
      return c.startsWith(COOKIE_NAME + "=");
    });

    return !!cookie;
  }

  // Define cookie com escolha (dura 1 ano)
  function setChoiceCookie(choice) {
    var expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + COOKIE_EXPIRY_DAYS);
    document.cookie = COOKIE_NAME + "=" + choice + "; Path=/; SameSite=Strict; Max-Age=" + (COOKIE_EXPIRY_DAYS * 24 * 60 * 60);
  }

  // Mostra o banner
  function showBanner() {
    if (banner) {
      banner.classList.add(BANNER_CLASS);
    }
  }

  // Esconde o banner
  function hideBanner() {
    if (banner) {
      banner.classList.remove(BANNER_CLASS);
    }
  }

  // Inicialização
  function init() {
    if (!banner) return;

    if (hasChoice()) {
      hideBanner();
    } else {
      showBanner();
    }

    // O site so usa cookies estritamente necessarios (sessao autenticada
    // + a propria preferencia deste aviso), que sao dispensados de
    // consentimento pela LGPD. Por isso o aviso e informativo e tem um
    // unico botao: nao havia nada opcional pra "rejeitar", e um botao de
    // recusa que nao bloqueia nada seria enganoso. Se um dia entrar
    // algum cookie nao-essencial (analytics, rastreamento), ai sim
    // volta o par aceitar/rejeitar - e o servidor precisa checar
    // primia_cookie_consent antes de gravar esse cookie novo.
    if (acceptBtn) {
      acceptBtn.addEventListener("click", function () {
        setChoiceCookie("acknowledged");
        hideBanner();
      });
    }
  }

  // Inicia quando o DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
