// JavaScript para controlar o menu hambúrguer
const hamburger = document.getElementById('hamburger');
const navMobile = document.getElementById('navMobile');
const overlay = document.getElementById('overlay');
const body = document.body;
const sinoBtn = document.getElementById('sino-btn');
const notifDropdown = document.getElementById('notif-dropdown');
const notifFechar = document.getElementById('notif-fechar');
const notifItens = document.querySelectorAll('.notif-item');
const marcarTodas = document.getElementById('notif-marcar-todas');
const mobileSinoBtn = document.getElementById('mobile-sino-btn');

// Função para abrir/fechar o menu
function toggleMenu() {
  hamburger.classList.toggle('active');
  navMobile.classList.toggle('active');
  overlay.classList.toggle('active');
  
  // Previne scroll do body quando menu está aberto
  if (navMobile.classList.contains('active')) {
    body.style.overflow = 'hidden';
  } else {
    body.style.overflow = '';
  }
}

// Event listeners
hamburger.addEventListener('click', toggleMenu);
overlay.addEventListener('click', toggleMenu);

// Fechar menu ao clicar em um link
const mobileLinks = navMobile.querySelectorAll('a');
mobileLinks.forEach(link => {
  link.addEventListener('click', () => {
    if (window.innerWidth < 1024) {
      toggleMenu();
    }
  });
});

// Fechar menu ao redimensionar para desktop
window.addEventListener('resize', () => {
  if (window.innerWidth >= 1024 && navMobile.classList.contains('active')) {
    toggleMenu();
  }
});

// abre e fecha ao clicar no sino
if (sinoBtn) {
    sinoBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation(); // adiciona essa linha
        notifDropdown.classList.toggle('aberto');
    });
}

// fecha ao clicar fora
document.addEventListener('click', function(e) {
    const container = document.querySelector('.sino-container');
    if (container && !container.contains(e.target)) {
        notifDropdown.classList.remove('aberto');
    }
});

// fecha ao clicar no X
if (notifFechar) {
    notifFechar.addEventListener('click', function() {
        notifDropdown.classList.remove('aberto');
    });
}

// marca como lida ao clicar na notificação

notifItens.forEach(item => {
    item.addEventListener('click', function() {
        this.classList.remove('nova');
        atualizarContador();
    });
});

if (marcarTodas) {
    marcarTodas.addEventListener('click', function() {
        document.querySelectorAll('.notif-item.nova').forEach(item => {
            item.classList.remove('nova');
        });
        atualizarContador();
    });
}

function atualizarContador() {
    const novas = document.querySelectorAll('.notif-item.nova').length;
    const contador = document.querySelector('.sino-contador');
    if (novas === 0) {
        contador.style.display = 'none';
    } else {
        contador.textContent = novas;
        contador.style.display = 'flex';
    }
}

// Para o sino no mobile
if (mobileSinoBtn) {
    mobileSinoBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        // reutiliza o mesmo dropdown
        notifDropdown.classList.toggle('aberto');
    });
}