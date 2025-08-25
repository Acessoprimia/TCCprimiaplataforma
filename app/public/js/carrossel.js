const slidesOriginais = Array.from(lista.children);
const totalSlides = slidesOriginais.length;


for (let i = totalSlides - 1; i > 0; i--) {
  const clone = slidesOriginais[i].cloneNode(true);
  lista.insertBefore(clone, lista.firstChild);
}


for (let i = 1; i < totalSlides; i++) {
  const clone = slidesOriginais[i].cloneNode(true);
  lista.appendChild(clone);
}

const primeiroSlide = lista.querySelector(".slide");
const larguraSlide = primeiroSlide.offsetWidth + 60;

let indice = totalSlides; 
carrossel.scrollLeft = larguraSlide * indice;

next.addEventListener("click", () => {
  indice++;
  carrossel.scrollTo({
    left: indice * larguraSlide,
    behavior: "smooth",
  });
});

prev.addEventListener("click", () => {
  indice--;
  carrossel.scrollTo({
    left: indice * larguraSlide,
    behavior: "smooth",
  });
});

carrossel.addEventListener("scroll", () => {
  const posicaoScroll = carrossel.scrollLeft;

  if (posicaoScroll <= larguraSlide * 0.5) {
    indice = totalSlides;
    carrossel.scrollLeft = indice * larguraSlide;
  }

  if (posicaoScroll >= larguraSlide * (totalSlides * 2 - 2)) {
    indice = totalSlides;
    carrossel.scrollLeft = indice * larguraSlide;
  }
});