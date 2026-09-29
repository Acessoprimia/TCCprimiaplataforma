// Cookie Consent Banner Logic
(function () {
  "use strict";

  var COOKIE_NAME = "primia_cookie_consent";
  var COOKIE_EXPIRY_DAYS = 365;
  var BANNER_CLASS = "visible";
  var banner = document.getElementById("cookieBanner");
  var acceptBtn = document.getElementById("cookieAcceptBtn");

  function hasChoice() {
    var cookie = document.cookie.split(";").map(function (c) {
      return c.trim();
    }).find(function (c) {
      return c.startsWith(COOKIE_NAME + "=");
    });

    return !!cookie;
  }

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

  function apagarEscolha() {
    document.cookie = COOKIE_NAME + "=; Path=/; SameSite=Strict; Max-Age=0";
  }

  window.primiaReabrirAvisoCookies = function () {
    apagarEscolha();
    showBanner();
  };

  // Inicialização
  function init() {
    if (!banner) return;

    if (hasChoice()) {
      hideBanner();
    } else {
      showBanner();
    }


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
