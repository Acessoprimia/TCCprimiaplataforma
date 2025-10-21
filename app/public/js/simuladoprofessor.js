// Lógica para as abas 'Em andamento' e 'Finalizados'
const abaBotoes = document.querySelectorAll('.aba-botao');
const secoesSimulados = document.querySelectorAll('.secao-simulados');

abaBotoes.forEach(botao => {
    botao.addEventListener('click', () => {
        // Remove a classe 'aba-ativa' de todos os botões
        abaBotoes.forEach(btn => btn.classList.remove('aba-ativa'));
        // Adiciona a classe 'aba-ativa' ao botão clicado
        botao.classList.add('aba-ativa');

        const filtro = botao.dataset.filtro;

        // Oculta todas as seções de simulados
        secoesSimulados.forEach(secao => secao.classList.add('oculta'));

        // Mostra a seção correspondente ao filtro
        document.getElementById(`secao-${filtro}`).classList.remove('oculta');
    });
});

// Lógica para o Modal de Filtro
const secaoFiltro = document.querySelector('.secao-filtro');
const modalFiltro = document.getElementById('modalFiltro');
const fecharModal = document.querySelector('.fechar-modal');
const formFiltro = document.getElementById('formFiltro');

secaoFiltro.addEventListener('click', () => {
    modalFiltro.showModal(); // Mostra o modal
});

fecharModal.addEventListener('click', () => {
    modalFiltro.close(); // Fecha o modal
});

// O elemento <dialog> já lida com o clique fora para fechar, mas podemos adicionar um listener para o evento 'close' se necessário.
modalFiltro.addEventListener('close', () => {
    // Ações a serem tomadas quando o modal é fechado (por exemplo, resetar o formulário)
    console.log('Modal de filtro fechado');
});

formFiltro.addEventListener('submit', (event) => {
    event.preventDefault();
    const checkboxes = formFiltro.querySelectorAll('input[name="disciplina"]:checked');
    const disciplinasSelecionadas = Array.from(checkboxes).map(cb => cb.value);

    // Pega a seção ativa (andamento ou finalizados)
    const secaoAtivaId = document.querySelector('.aba-botao.aba-ativa').dataset.filtro;
    const secaoAtiva = document.getElementById(`secao-${secaoAtivaId}`);
    const cardsSimulado = secaoAtiva.querySelectorAll('.card-simulado');

    cardsSimulado.forEach(card => {
        const disciplinaCard = card.dataset.disciplina;
        if (disciplinasSelecionadas.length === 0 || disciplinasSelecionadas.includes(disciplinaCard)) {
            card.style.display = 'flex'; // Mostra o card
        } else {
            card.style.display = 'none'; // Oculta o card
        }
    });

    modalFiltro.close(); // Fecha o modal após aplicar o filtro
});


document.addEventListener("DOMContentLoaded", () => {
    const modalFiltro = document.getElementById("modalFiltro");
    const abreModalFiltro = document.getElementById("abreModalFiltro");
    const fecharModal = modalFiltro.querySelector(".fechar-modal");
    const formFiltro = document.getElementById("formFiltro");
    const secaoVideoaulas = document.getElementById("secao-videoaulas");
    const cardsVideo = secaoVideoaulas.querySelectorAll(".card-video-link");

    // Abrir modal
    abreModalFiltro.addEventListener("click", () => {
        modalFiltro.showModal();
    });

    // Fechar modal
    fecharModal.addEventListener("click", () => {
        modalFiltro.close();
    });

    // Fechar modal ao clicar fora dele
    modalFiltro.addEventListener("click", (event) => {
        if (event.target === modalFiltro) {
            modalFiltro.close();
        }
    });

    // Lógica de filtro
    formFiltro.addEventListener("submit", (event) => {
        event.preventDefault();
        const checkboxes = formFiltro.querySelectorAll("input[name=\"disciplina\"]:checked");
        const disciplinasSelecionadas = Array.from(checkboxes).map(cb => cb.value);

        cardsVideo.forEach(card => {
            const disciplinaCard = card.dataset.disciplina;
            if (disciplinasSelecionadas.length === 0 || disciplinasSelecionadas.includes(disciplinaCard)) {
                card.style.display = "block";
            } else {
                card.style.display = "none";
            }
        });

        modalFiltro.close();
    });
});

// Modal
const modal = document.getElementById('modal');
const btnAbrir = document.getElementById('btn-abrir');
const btnFechar = document.getElementById('btn-fechar');

function abrirModal() {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function fecharModal() {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

btnAbrir.addEventListener('click', abrirModal);
btnFechar.addEventListener('click', fecharModal);

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        fecharModal();
    }
});

// Tabs
const tabs = document.querySelectorAll('.tab');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    });
});

