// Interacoes da pagina /admin/suporte (denuncias do forum + mensagens de contato).
// Depende das funcoes compartilhadas definidas em common.js.

function tratarAcaoAdmin(botao) {
    const acao = botao.dataset.adminAction;
    const item = itemPai(botao);

    switch (acao) {
        case "visualizar-denuncia":
            abrirModalVisualizacao("Detalhes da denuncia", textoDenuncia(item), item);
            break;
        case "analisar-denuncia":
            setStatus(item.querySelector(".status"), "Em analise", "ativo");
            // Futuramente PUT /api/admin/denuncias/:id/status com status = "em_analise".
            mostrarAvisoAdmin("Denuncia marcada como em analise.");
            break;
        case "ignorar-denuncia":
            setStatus(item.querySelector(".status"), "Ignorada", "ativo");
            // Futuramente salvar decisao do admin e manter conteudo publicado.
            mostrarAvisoAdmin("Denuncia ignorada visualmente.");
            break;
        case "resolver-denuncia":
            setStatus(item.querySelector(".status"), "Resolvida", "ativo");
            // Futuramente finalizar denuncia com decisao administrativa.
            mostrarAvisoAdmin("Denuncia resolvida visualmente.");
            break;
        case "remover-conteudo-denunciado":
            abrirConfirmacao("Remover conteudo denunciado", "Tem certeza que deseja remover o conteudo denunciado?", () => {
                setStatus(item.querySelector(".status"), "Conteudo removido", "pendente");
                item.classList.add("linha-destacada");
                // Futuramente remover/inativar conteudo denunciado no banco sem responder a duvida.
                mostrarAvisoAdmin("Conteudo denunciado removido visualmente.");
            });
            break;
        case "visualizar-contato":
            abrirModalVisualizacao("Mensagem de contato", textoContato(item), item);
            break;
        case "responder-contato":
            abrirModalResposta("Responder contato", "resposta-contato", textoContato(item), item);
            break;
        case "resolver-contato":
            setStatus(item.querySelector(".status"), "Resolvido", "ativo");
            // Futuramente PUT /api/admin/contatos/:id/status com status = "resolvido".
            mostrarAvisoAdmin("Contato marcado como resolvido.");
            break;
        case "excluir-contato":
            confirmarRemocao(botao, "Excluir mensagem", "Tem certeza que deseja excluir esta mensagem de contato?", "Mensagem removida visualmente.");
            break;
        default:
            mostrarAvisoAdmin("Acao administrativa preparada.");
    }
}

function textoDenuncia(item) {
    const codigo = item.children[0]?.textContent.trim() || "DEN-000";
    const materia = item.children[1]?.textContent.trim() || "Materia";
    const conteudo = item.children[2]?.textContent.trim() || "Conteudo denunciado";
    const motivo = item.children[3]?.textContent.trim() || "Motivo nao informado";
    const status = item.children[4]?.textContent.trim() || "Aberta";
    const data = item.children[5]?.textContent.trim() || "";

    return `Denuncia: ${codigo}\nMateria: ${materia}\nStatus: ${status}\nData: ${data}\n\nConteudo denunciado: ${conteudo}\n\nMotivo da denuncia: ${motivo}`;
}

function textoContato(item) {
    const nome = item.children[0]?.textContent.trim() || "Usuario";
    const email = item.children[1]?.textContent.trim() || "";
    const assunto = item.children[2]?.textContent.trim() || "Contato";

    if (assunto.includes("cadastro")) {
        return `Nome: ${nome}\nEmail: ${email}\nAssunto: ${assunto}\n\nMensagem: Tentei criar minha conta na Primia, mas nao consegui finalizar o cadastro. Podem verificar?`;
    }

    return `Nome: ${nome}\nEmail: ${email}\nAssunto: ${assunto}\n\nMensagem: Gostariamos de entender como a escola pode usar a Primia com alunos e professores.`;
}

function abrirModalResposta(titulo, modo, pergunta, origem = null) {
    abrirModal(
        titulo,
        modo,
        campoLeitura("Mensagem recebida", pergunta) +
        campoTextarea("resposta", "Resposta do administrador"),
        origem
    );
}

adminModalHandlers["resposta-contato"] = function registrarRespostaContato() {
    const item = modalOrigem;
    const status = item.querySelector(".status");

    if (status) {
        setStatus(status, "Respondido", "ativo");
    }

    item.classList.add("linha-destacada");
    // Futuramente salvar resposta em respostas_contato e atualizar status para "respondido" no banco.
    mostrarAvisoAdmin("Contato respondido visualmente.");
};
