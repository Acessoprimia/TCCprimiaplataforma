// Interacoes da pagina /admin/conteudos (materias, livros, videoaulas, simulados, cronogramas e planos).
// Depende das funcoes compartilhadas definidas em common.js.

function tratarAcaoAdmin(botao) {
    const acao = botao.dataset.adminAction;
    const item = itemPai(botao);

    switch (acao) {
        case "adicionar-conteudo":
            abrirModalConteudo("Adicionar conteudo", "conteudo");
            break;
        case "editar-conteudo":
            abrirModalConteudo("Editar conteudo", "conteudo", item);
            break;
        case "destacar-conteudo":
            item.classList.toggle("destacado");
            // Futuramente PUT /api/admin/conteudos/:id/destaque.
            mostrarAvisoAdmin(item.classList.contains("destacado") ? "Conteudo destacado." : "Destaque removido.");
            break;
        case "premium-conteudo": {
            const texto = item.querySelector("p");
            const premium = texto.textContent.toLowerCase().includes("premium");
            texto.textContent = texto.textContent.replace(premium ? "premium" : "gratuito", premium ? "gratuito" : "premium");
            botao.textContent = premium ? "Marcar premium" : "Editar premium";
            // Futuramente atualizar campo is_premium no banco.
            mostrarAvisoAdmin("Regra premium alterada visualmente.");
            break;
        }
        case "excluir-conteudo":
            confirmarRemocao(botao, "Excluir conteudo", "Tem certeza que deseja excluir este conteudo?", "Conteudo removido visualmente.");
            break;
        case "adicionar-materia":
            abrirModal("Adicionar materia", "materia", campoTexto("nome", "Nome da materia"));
            break;
        case "remover-materia":
            confirmarRemocao(botao, "Remover materia", "Tem certeza que deseja remover esta materia? Futuramente o banco deve bloquear se houver conteudos vinculados.", "Materia removida visualmente.");
            break;
        default:
            mostrarAvisoAdmin("Acao administrativa preparada.");
    }
}

function listarMaterias() {
    const materias = Array.from(document.querySelectorAll("#materiasLista .materia-chip span"))
        .map((item) => item.textContent.trim());

    return materias.length ? materias : ["Matematica", "Portugues", "Biologia"];
}

function abrirModalConteudo(titulo, modo, origem = null) {
    const textoConteudo = origem?.querySelector("p")?.textContent || "";
    const materiaAtual = textoConteudo.match(/Materia:\s*([^|]+)/)?.[1]?.trim() || "Geral";
    const categoriaAtual = origem?.querySelector("span")?.textContent || "Livro";

    abrirModal(
        titulo,
        modo,
        campoSelect("categoria", "Categoria", ["Livro", "Videoaula", "Simulado", "Cronograma", "Plano de estudo"], categoriaAtual) +
        campoSelect("materia", "Materia", ["Geral", ...listarMaterias()], materiaAtual) +
        campoTexto("titulo", "Titulo", origem?.querySelector("h3")?.textContent || "") +
        campoSelect("status", "Status", ["Publicado", "Rascunho", "Agendado"], "Publicado") +
        campoSelect("acesso", "Acesso", ["Gratuito", "Premium"], origem?.textContent.includes("premium") ? "Premium" : "Gratuito"),
        origem
    );
}

adminModalHandlers.conteudo = function salvarConteudo(dados) {
    const lista = document.getElementById("conteudosLista");
    const categoriaSlug = dados.categoria.toLowerCase().replace(/\s+/g, "-");

    // Futuramente salvar conteudo no banco com POST /api/admin/conteudos.
    // Arquivos como livros e videoaulas devem ir para storage, gravando no banco apenas metadados e URL.
    const html = `
        <article class="content-admin-card" data-categoria="${categoriaSlug}">
            <span>${dados.categoria}</span>
            <h3>${dados.titulo}</h3>
            <p>Materia: ${dados.materia} | Status: ${dados.status.toLowerCase()} | Acesso: ${dados.acesso.toLowerCase()}</p>
            <nav>
                <button data-admin-action="editar-conteudo">Editar</button>
                <button data-admin-action="destacar-conteudo">Destacar</button>
                <button data-admin-action="premium-conteudo">${dados.acesso === "Premium" ? "Editar premium" : "Marcar premium"}</button>
                <button class="danger" data-admin-action="excluir-conteudo">Excluir</button>
            </nav>
        </article>
    `;

    if (modalOrigem) {
        modalOrigem.outerHTML = html;
        mostrarAvisoAdmin("Conteudo atualizado visualmente.");
        return;
    }

    lista.insertAdjacentHTML("afterbegin", html);
    mostrarAvisoAdmin("Conteudo adicionado temporariamente.");
};

adminModalHandlers.materia = function salvarMateria(dados) {
    const lista = document.getElementById("materiasLista");

    // Futuramente salvar materia com POST /api/admin/materias.
    lista.insertAdjacentHTML("beforeend", `
        <article class="materia-chip">
            <span>${dados.nome}</span>
            <button type="button" data-admin-action="remover-materia">Remover</button>
        </article>
    `);
    mostrarAvisoAdmin("Materia adicionada temporariamente.");
};

function aplicarFiltroConteudos(filtro) {
    document.querySelectorAll("#conteudosLista .content-admin-card").forEach((card) => {
        const mostrar = filtro === "todos" || card.dataset.categoria === filtro;
        card.classList.toggle("oculto", !mostrar);
    });
}

document.querySelectorAll("[data-filtro-conteudos]").forEach((botao) => {
    botao.addEventListener("click", () => {
        document.querySelectorAll("[data-filtro-conteudos]").forEach((outro) => outro.classList.remove("ativo"));
        botao.classList.add("ativo");
        aplicarFiltroConteudos(botao.dataset.filtroConteudos);
    });
});
