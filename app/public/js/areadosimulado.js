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

// Filtro por disciplina (partials/filtroPadrao.ejs): so mexe nos cards da aba ativa
document.addEventListener('filtro:aplicar', (e) => {
    const selecionadas = e.detail.valores;
    const secaoAtivaId = document.querySelector('.aba-botao.aba-ativa').dataset.filtro;
    const secaoAtiva = document.getElementById(`secao-${secaoAtivaId}`);

    secaoAtiva.querySelectorAll('.card-simulado').forEach(card => {
        card.style.display = selecionadas.length === 0 || selecionadas.includes(card.dataset.disciplina)
            ? 'flex'
            : 'none';
    });
});
