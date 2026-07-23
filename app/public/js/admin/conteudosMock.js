// Dados mockados da pagina /admin/conteudos (sem banco/API por enquanto).
// MATERIAS_MOCK e CONTEUDOS_MOCK sao os arrays consumidos por conteudos.js.
// Quando a integracao real entrar, estes arrays deixam de ser gerados aqui e
// passam a vir de uma API (ex.: GET /api/admin/materias, GET /api/admin/conteudos)
// — busca, filtros, paginacao e renderizacao da tabela nao precisam mudar.

const MATERIAS_MOCK = [
    "Matematica", "Portugues", "Biologia", "Historia", "Filosofia", "Fisica",
    "Quimica", "Geografia", "Ingles", "Espanhol", "Literatura", "Sociologia",
    "Artes", "Educacao Fisica",
];

const AUTORES_CONTEUDO_MOCK = [
    "Equipe Primia", "Prof. Carlos Lima", "Prof. Ana Lima", "Prof. Marina Alves",
    "Prof. Bruno Cardoso", "Prof. Rafaela Nunes",
];

const VARIACOES_TITULO_CONTEUDO = [
    "Fundamentos", "Revisao geral", "Aprofundamento", "Modulo 1", "Modulo 2",
    "Pratica guiada", "Resumo essencial", "Avaliacao diagnostica",
];

const ROTULOS_TIPO_CONTEUDO = {
    livro: "Livro",
    videoaula: "Videoaula",
    simulado: "Simulado",
    cronograma: "Cronograma",
    "plano-de-estudo": "Plano de estudo",
};

const DISTRIBUICAO_TIPOS_CONTEUDO = [
    { tipo: "videoaula", quantidade: 28 },
    { tipo: "livro", quantidade: 20 },
    { tipo: "simulado", quantidade: 14 },
    { tipo: "cronograma", quantidade: 6 },
    { tipo: "plano-de-estudo", quantidade: 6 },
];

const DATA_REFERENCIA_CONTEUDO_MOCK = new Date("2026-07-22T00:00:00");

function gerarTituloConteudoMock(tipo, materia, indice) {
    const variacao = VARIACOES_TITULO_CONTEUDO[indice % VARIACOES_TITULO_CONTEUDO.length];
    return `${ROTULOS_TIPO_CONTEUDO[tipo]}: ${variacao} de ${materia}`;
}

function gerarDataConteudoMock(indice) {
    const diasAtras = (indice * 4) % 300;
    return new Date(DATA_REFERENCIA_CONTEUDO_MOCK.getTime() - diasAtras * 86400000).toISOString();
}

function gerarConteudoMock(indice, tipo) {
    const materia = MATERIAS_MOCK[indice % MATERIAS_MOCK.length];
    const cicloStatus = indice % 10;
    const status = cicloStatus === 0 ? "rascunho" : cicloStatus === 1 ? "agendado" : "publicado";
    const acesso = indice % 3 === 0 ? "premium" : "gratuito";

    return {
        id: indice + 1,
        titulo: gerarTituloConteudoMock(tipo, materia, indice),
        tipo,
        materia,
        status,
        acesso,
        autor: AUTORES_CONTEUDO_MOCK[indice % AUTORES_CONTEUDO_MOCK.length],
        data: gerarDataConteudoMock(indice),
        destaque: indice % 11 === 0,
        arquivado: false,
        statusAnterior: null,
    };
}

function gerarConteudosMock() {
    const conteudos = [];

    DISTRIBUICAO_TIPOS_CONTEUDO.forEach(({ tipo, quantidade }) => {
        for (let i = 0; i < quantidade; i += 1) {
            conteudos.push(gerarConteudoMock(conteudos.length, tipo));
        }
    });

    return conteudos;
}

const CONTEUDOS_MOCK = gerarConteudosMock();
