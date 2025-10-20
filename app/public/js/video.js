const filter = document.getElementById('materia-filter');
const cards = document.querySelectorAll('article');

filter.addEventListener('change', (e) => {
    const selectedMateria = e.target.value;

    cards.forEach(card => {
        if (selectedMateria === '' || card.dataset.materia === selectedMateria) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
});