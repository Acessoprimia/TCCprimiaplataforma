// Filtro de matérias
const filtro = document.getElementById('materia-filtro');
const cards = document.querySelectorAll('.card-duvida');

filtro.addEventListener('change', (e) => {
    const selectedMateria = e.target.value;

    cards.forEach(card => {
        if (selectedMateria === '' || card.dataset.materia === selectedMateria) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
});

// Ver resposta
const botoesVerResposta = document.querySelectorAll('.btn-ver-resposta');

botoesVerResposta.forEach(botao => {
    botao.addEventListener('click', () => {
        const respostaContainer = botao.nextElementSibling;
        
        if (respostaContainer.style.display === 'none') {
            respostaContainer.style.display = 'block';
            botao.textContent = 'Ocultar resposta';
        } else {
            respostaContainer.style.display = 'none';
            botao.textContent = 'Ver resposta';
        }
    });
});

// Modal de pergunta
const modal = document.getElementById('modal-pergunta');
const btnAbrirModal = document.getElementById('btn-abrir-modal');
const btnAddFixo = document.getElementById('btn-add-fixo');
const btnFecharModal = document.getElementById('btn-fechar-modal');

function abrirModal() {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function fecharModal() {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

btnAbrirModal.addEventListener('click', abrirModal);
btnAddFixo.addEventListener('click', abrirModal);
btnFecharModal.addEventListener('click', fecharModal);

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        fecharModal();
    }
});