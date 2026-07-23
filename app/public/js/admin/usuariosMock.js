// Dados mockados da pagina /admin/usuarios (sem banco/API por enquanto).
// USUARIOS_MOCK e o "array de objetos" consumido por usuarios.js. Quando a
// integracao real entrar, este array deixa de ser gerado aqui e passa a vir
// de uma API (ex.: GET /api/admin/usuarios) — o restante do codigo (busca,
// filtros, paginacao, renderizacao da tabela) nao precisa mudar.

const PRIMEIROS_NOMES = [
    "Maria", "Pedro", "Carlos", "Ana", "Julia", "Lucas", "Beatriz", "Rafael",
    "Camila", "Bruno", "Fernanda", "Diego", "Larissa", "Thiago", "Patricia",
    "Eduardo", "Gabriela", "Marcelo", "Vanessa", "Rodrigo", "Isabela", "Felipe",
    "Aline", "Gustavo",
];

const SOBRENOMES = [
    "Souza", "Martins", "Lima", "Oliveira", "Costa", "Almeida", "Pereira",
    "Rocha", "Carvalho", "Ribeiro", "Barbosa", "Cardoso", "Teixeira",
    "Nascimento", "Araujo", "Mendes", "Freitas", "Correia",
];

const MATERIAS_PROFESSOR = [
    "Matematica", "Biologia", "Historia", "Quimica", "Fisica", "Portugues", "Geografia", "Ingles",
];

const DATA_REFERENCIA_MOCK = new Date("2026-07-22T09:00:00");

function gerarEmailMock(nome, sobrenome, tipoUsuario) {
    const usuario = `${nome}.${sobrenome}`.toLowerCase();
    const sufixo = tipoUsuario === "professor" ? "prof" : tipoUsuario === "admin" ? "admin" : "aluno";
    return `${usuario}.${sufixo}@primia.com`;
}

function gerarUltimoAcessoMock(indice) {
    const diasAtras = indice % 33;
    const horasAtras = (indice * 7) % 24;
    const minutosAtras = (indice * 13) % 60;
    const dataAcesso = new Date(DATA_REFERENCIA_MOCK.getTime()
        - diasAtras * 86400000
        - horasAtras * 3600000
        - minutosAtras * 60000);
    return dataAcesso.toISOString();
}

function gerarUsuarioMock(indice, tipoUsuario) {
    const nome = PRIMEIROS_NOMES[indice % PRIMEIROS_NOMES.length];
    const sobrenome = SOBRENOMES[(indice * 3) % SOBRENOMES.length];
    const cicloStatus = indice % 20;
    const status = cicloStatus === 0 ? "bloqueado" : cicloStatus === 1 ? "inativo" : "ativo";
    const premiumAtivo = tipoUsuario === "aluno" && indice % 7 === 0;

    return {
        id: indice + 1,
        idAcesso: "",
        nome: `${nome} ${sobrenome}`,
        email: gerarEmailMock(nome, sobrenome, tipoUsuario),
        tipoUsuario,
        status,
        materia: tipoUsuario === "professor" ? MATERIAS_PROFESSOR[indice % MATERIAS_PROFESSOR.length] : null,
        premium: {
            ativo: premiumAtivo,
            ate: premiumAtivo ? "2026-12-31" : null,
        },
        ultimoAcesso: gerarUltimoAcessoMock(indice),
    };
}

function gerarUsuariosMock() {
    const usuarios = [];
    const distribuicao = [
        { tipoUsuario: "aluno", quantidade: 245, prefixo: "ALU" },
        { tipoUsuario: "professor", quantidade: 18, prefixo: "PROF" },
        { tipoUsuario: "admin", quantidade: 5, prefixo: "ADM" },
    ];

    distribuicao.forEach(({ tipoUsuario, quantidade, prefixo }) => {
        for (let contador = 1; contador <= quantidade; contador += 1) {
            const usuario = gerarUsuarioMock(usuarios.length, tipoUsuario);

            if (tipoUsuario === "admin") {
                usuario.status = "ativo";
                usuario.premium = { ativo: false, ate: null };
            }

            usuario.idAcesso = `${prefixo}-${String(contador).padStart(4, "0")}`;
            usuarios.push(usuario);
        }
    });

    return usuarios;
}

const USUARIOS_MOCK = gerarUsuariosMock();
