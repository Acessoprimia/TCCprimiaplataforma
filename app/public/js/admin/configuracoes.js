// Interacoes da pagina /admin/configuracoes.
// Depende das funcoes compartilhadas definidas em common.js.

function tratarAcaoAdmin(botao) {
    const acao = botao.dataset.adminAction;

    switch (acao) {
        case "salvar-configuracoes":
            // Futuramente salvar configuracoes no banco com PUT /api/admin/configuracoes,
            // guardando chave, valor, data_alteracao e id do admin responsavel pela mudanca.
            mostrarAvisoAdmin("Configuracoes salvas visualmente. A persistencia entrara com o banco.");
            break;
        default:
            mostrarAvisoAdmin("Acao administrativa preparada.");
    }
}
