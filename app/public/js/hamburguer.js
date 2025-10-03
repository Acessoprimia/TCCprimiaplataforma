// JavaScript para controlar o menu hambúrguer
const hamburger = document.getElementById('hamburger');
const navMobile = document.getElementById('navMobile');
const overlay = document.getElementById('overlay');
const body = document.body;

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