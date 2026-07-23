document.addEventListener('DOMContentLoaded', () => {
  const carrossel = document.getElementById('carrossel');
  const lista = document.getElementById('lista');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const pontosContainer = document.getElementById('materias-dots');

  if (!carrossel || !lista || !prevBtn || !nextBtn) return;

  const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const slidesOriginais = Array.from(lista.children);
  const totalSlides = slidesOriginais.length;

  if (totalSlides === 0) return;

  // Clona todos os slides antes e depois para o loop infinito
  const prefixo = document.createDocumentFragment();
  const sufixo = document.createDocumentFragment();
  slidesOriginais.forEach((slide) => {
    prefixo.appendChild(slide.cloneNode(true));
    sufixo.appendChild(slide.cloneNode(true));
  });
  lista.insertBefore(prefixo, lista.firstChild);
  lista.appendChild(sufixo);

  // indice = posicao do slide "atual" dentro de lista.children (0-based).
  // Os slides tem larguras diferentes (o texto varia), entao a posicao de
  // rolagem e sempre calculada a partir da posicao real do elemento
  // (offsetLeft), nunca de "indice * largura fixa".
  let indice = totalSlides; // primeiro slide original
  let autoplayId = null;
  let retomarAutoplayId = null;

  function centralizar(elemento, comAnimacao) {
    const centroAlvo = elemento.offsetLeft + elemento.offsetWidth / 2;
    const destino = centroAlvo - carrossel.clientWidth / 2;

    // Pulo instantaneo (fim do loop infinito): atribuir scrollLeft direto
    // evita qualquer disputa com o scroll-snap nativo que "scrollTo(auto)"
    // pode sofrer quando chamado de dentro do proprio handler de scroll.
    if (reduzMovimento || !comAnimacao) {
      carrossel.scrollLeft = destino;
      return;
    }

    carrossel.scrollTo({ left: destino, behavior: 'smooth' });
  }

  function irPara(novoIndice, comAnimacao = true) {
    const alvo = lista.children[novoIndice];
    if (!alvo) return;
    indice = novoIndice;
    centralizar(alvo, comAnimacao);
  }

  function slideMaisProximoDoCentro() {
    const centro = carrossel.scrollLeft + carrossel.clientWidth / 2;
    let melhorIndice = indice;
    let menorDistancia = Infinity;

    Array.from(lista.children).forEach((slide, i) => {
      const meio = slide.offsetLeft + slide.offsetWidth / 2;
      const distancia = Math.abs(meio - centro);
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        melhorIndice = i;
      }
    });

    return melhorIndice;
  }

  function iniciarAutoplay() {
    if (reduzMovimento) return;
    clearInterval(autoplayId);
    autoplayId = setInterval(() => irPara(indice + 1), 4000);
  }

  function pausarERetomar(atraso = 5000) {
    clearInterval(autoplayId);
    clearTimeout(retomarAutoplayId);
    retomarAutoplayId = setTimeout(iniciarAutoplay, atraso);
  }

  function indiceReal() {
    return ((indice - totalSlides) % totalSlides + totalSlides) % totalSlides;
  }

  function atualizarDestaque() {
    lista.querySelectorAll('.slide').forEach((slide, i) => {
      slide.classList.toggle('slide-ativo', i === indice);
    });
  }

  function atualizarPontos() {
    if (!pontosContainer) return;
    const atual = indiceReal();
    Array.from(pontosContainer.children).forEach((ponto, i) => {
      ponto.classList.toggle('active', i === atual);
    });
  }

  function criarPontos() {
    if (!pontosContainer) return;
    pontosContainer.innerHTML = '';
    slidesOriginais.forEach((slide, i) => {
      const nomeMateria = slide.dataset.materia || slide.textContent.trim();
      const ponto = document.createElement('button');
      ponto.type = 'button';
      ponto.className = 'materia-dot';
      ponto.setAttribute('aria-label', `Ir para ${nomeMateria}`);
      ponto.addEventListener('click', () => {
        irPara(totalSlides + i);
        pausarERetomar();
      });
      pontosContainer.appendChild(ponto);
    });
  }

  criarPontos();
  irPara(indice, false);
  atualizarDestaque();
  atualizarPontos();

  nextBtn.addEventListener('click', () => {
    irPara(indice + 1);
    pausarERetomar();
  });

  prevBtn.addEventListener('click', () => {
    irPara(indice - 1);
    pausarERetomar();
  });

  let scrollTimeout;
  carrossel.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      indice = slideMaisProximoDoCentro();

      // Chegou numa copia clonada da ponta: pula sem animar para o
      // equivalente no bloco original, mantendo a ilusao de loop infinito.
      if (indice < totalSlides) {
        indice += totalSlides;
        centralizar(lista.children[indice], false);
      } else if (indice >= totalSlides * 2) {
        indice -= totalSlides;
        centralizar(lista.children[indice], false);
      }

      atualizarDestaque();
      atualizarPontos();
    }, 80);
  });

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => irPara(indice, false), 150);
  });

  carrossel.addEventListener('mouseenter', () => clearInterval(autoplayId));
  carrossel.addEventListener('mouseleave', iniciarAutoplay);
  carrossel.addEventListener('touchstart', () => clearInterval(autoplayId), { passive: true });
  carrossel.addEventListener('touchend', () => pausarERetomar(3000), { passive: true });

  iniciarAutoplay();
});
