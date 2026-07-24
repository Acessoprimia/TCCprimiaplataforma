// Dados mockados da pagina /admin/suporte (denuncias do forum + mensagens de contato).
// DENUNCIAS_MOCK e CONTATOS_MOCK sao os "arrays de objetos" consumidos por suporte.js.
// Quando a integracao real entrar, estes arrays deixam de ser gerados aqui e passam a vir
// de uma API (ex.: GET /api/admin/denuncias e GET /api/admin/contatos) — o restante do
// codigo (busca, filtros, paginacao, menu de acoes, renderizacao das tabelas) nao precisa mudar.

const PRIMEIROS_NOMES_SUPORTE = [
    "Camila", "Joao", "Mariana", "Rafael", "Larissa", "Bruno", "Fernanda", "Diego",
    "Patricia", "Eduardo", "Gabriela", "Marcelo", "Vanessa", "Rodrigo", "Isabela",
    "Felipe", "Aline", "Gustavo", "Renata", "Leonardo",
];

const SOBRENOMES_SUPORTE = [
    "Nunes", "Barros", "Lima", "Oliveira", "Costa", "Almeida", "Pereira", "Rocha",
    "Carvalho", "Ribeiro", "Barbosa", "Cardoso", "Teixeira", "Nascimento", "Araujo",
];

const MATERIAS_SUPORTE = [
    "Matematica", "Biologia", "Historia", "Quimica", "Fisica", "Portugues", "Geografia", "Filosofia",
];

const TIPOS_DENUNCIA_MOCK = ["forum", "videoaula", "livro", "simulado", "outros"];

const PRIORIDADES_DENUNCIA_MOCK = ["alta", "media", "baixa"];

const MOTIVOS_POR_TIPO_DENUNCIA = {
    forum: ["Conteudo incorreto", "Linguagem inadequada", "Spam", "Discurso de odio"],
    videoaula: ["Conteudo incorreto", "Problema no audio ou video", "Direitos autorais"],
    livro: ["Conteudo incorreto", "Direitos autorais", "Material desatualizado"],
    simulado: ["Gabarito incorreto", "Questao mal formulada", "Conteudo desatualizado"],
    outros: ["Comportamento suspeito", "Spam", "Outro motivo"],
};

const ASSUNTOS_CONTATO_MOCK = [
    "Problema no cadastro", "Duvida sobre planos", "Parceria escolar", "Problema no pagamento",
    "Sugestao de melhoria", "Duvida sobre conteudo", "Problema de acesso", "Elogio",
];

// Ancora de tempo usada para gerar datas relativas deterministicas (mesma
// abordagem de usuariosMock.js e conteudosMock.js).
const DATA_REFERENCIA_SUPORTE = new Date("2026-07-23T09:00:00");

function gerarDataRelativaSuporte(diasAtras, horasAtras = 0, minutosAtras = 0) {
    return new Date(DATA_REFERENCIA_SUPORTE.getTime()
        - diasAtras * 86400000
        - horasAtras * 3600000
        - minutosAtras * 60000).toISOString();
}

function gerarDenunciaMock(indice) {
    const nome = PRIMEIROS_NOMES_SUPORTE[indice % PRIMEIROS_NOMES_SUPORTE.length];
    const sobrenome = SOBRENOMES_SUPORTE[(indice * 3) % SOBRENOMES_SUPORTE.length];
    const tipo = TIPOS_DENUNCIA_MOCK[indice % TIPOS_DENUNCIA_MOCK.length];
    const motivosDoTipo = MOTIVOS_POR_TIPO_DENUNCIA[tipo];
    const motivo = motivosDoTipo[indice % motivosDoTipo.length];
    const prioridade = PRIORIDADES_DENUNCIA_MOCK[indice % PRIORIDADES_DENUNCIA_MOCK.length];
    const materia = MATERIAS_SUPORTE[indice % MATERIAS_SUPORTE.length];

    const cicloStatus = indice % 10;
    const status = cicloStatus < 4 ? "aberto" : cicloStatus < 7 ? "em_analise" : "resolvido";
    const resolvidoHoje = status === "resolvido" && indice % 6 === 0;
    const diasAtrasCriacao = indice % 20;
    const ciclosResolucao = ["resolvido", "ignorado", "conteudo_removido"];

    return {
        id: indice + 1,
        codigo: `DEN-${String(indice + 1).padStart(4, "0")}`,
        usuario: {
            nome: `${nome} ${sobrenome}`,
            idAcesso: `ALU-${String((indice % 245) + 1).padStart(4, "0")}`,
        },
        tipo,
        materia,
        conteudoDenunciado: `Conteudo de ${materia.toLowerCase()} sinalizado por: ${motivo.toLowerCase()}.`,
        motivo,
        prioridade,
        status,
        resolucao: status === "resolvido" ? ciclosResolucao[indice % ciclosResolucao.length] : null,
        criadoEm: gerarDataRelativaSuporte(diasAtrasCriacao, (indice * 5) % 24, (indice * 11) % 60),
        resolvidoEm: status === "resolvido"
            ? gerarDataRelativaSuporte(resolvidoHoje ? 0 : Math.max(diasAtrasCriacao - 2, 0))
            : null,
    };
}

function gerarDenunciasMock(quantidade) {
    const denuncias = [];

    for (let indice = 0; indice < quantidade; indice += 1) {
        denuncias.push(gerarDenunciaMock(indice));
    }

    return denuncias;
}

function gerarContatoMock(indice) {
    const nome = PRIMEIROS_NOMES_SUPORTE[(indice * 2) % PRIMEIROS_NOMES_SUPORTE.length];
    const sobrenome = SOBRENOMES_SUPORTE[(indice * 5) % SOBRENOMES_SUPORTE.length];
    const assunto = ASSUNTOS_CONTATO_MOCK[indice % ASSUNTOS_CONTATO_MOCK.length];

    const cicloStatus = indice % 6;
    const status = cicloStatus < 2 ? "aberto" : cicloStatus < 4 ? "respondido" : "resolvido";
    const resolvidoHoje = status === "resolvido" && indice % 5 === 0;
    const diasAtrasCriacao = indice % 15;

    return {
        id: indice + 1,
        codigo: `CT-${String(indice + 1).padStart(4, "0")}`,
        nome: `${nome} ${sobrenome}`,
        email: `${nome}.${sobrenome}`.toLowerCase() + "@email.com",
        assunto,
        mensagem: `Mensagem enviada pela pagina de contato sobre: ${assunto.toLowerCase()}.`,
        status,
        criadoEm: gerarDataRelativaSuporte(diasAtrasCriacao, (indice * 3) % 24, (indice * 17) % 60),
        resolvidoEm: status === "resolvido"
            ? gerarDataRelativaSuporte(resolvidoHoje ? 0 : diasAtrasCriacao)
            : null,
    };
}

function gerarContatosMock(quantidade) {
    const contatos = [];

    for (let indice = 0; indice < quantidade; indice += 1) {
        contatos.push(gerarContatoMock(indice));
    }

    return contatos;
}

const DENUNCIAS_MOCK = gerarDenunciasMock(46);
const CONTATOS_MOCK = gerarContatosMock(34);
