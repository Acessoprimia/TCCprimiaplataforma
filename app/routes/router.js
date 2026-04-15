var express = require("express");
var router = express.Router();
const { body, validationResult } = require("express-validator");
const pool = require("../../db");
const bcrypt = require("bcrypt");

// Constantes centrais para a futura integracao com o banco de dados.
// A ideia e evitar nomes de tabelas, status e rotas espalhados pelo arquivo.
const TABELAS = Object.freeze({
  usuarios: "Usuario",
  alunos: "Aluno",
  professores: "Professor",
  materias: "Materia",
  planosEstudo: "Plano_de_Estudo",
  cronogramas: "Cronograma",
  planosAula: "Plano_de_Aula",
  forum: "Forum",
  duvidas: "Duvidas",
  respostas: "Respostas",
});

const TIPOS_USUARIO = Object.freeze({
  aluno: "aluno",
  professor: "professor",
});

const STATUS_CONTA = Object.freeze({
  ativo: "ativo",
  bloqueado: "bloqueado",
  inativo: "inativo",
});

const ROTAS_POR_TIPO_USUARIO = Object.freeze({
  [TIPOS_USUARIO.aluno]: "/entrada",
  [TIPOS_USUARIO.professor]: "/entradaprofessor",
});

const VIEWS = Object.freeze({
  login: "pages/login",
  cadastro: "pages/cadastro",
  cadastroProfessor: "pages/cadastroprofessor",
  editarPerfil: "pages/editarperfil",
  admin: "pages/admin",
});

const VALORES_INICIAIS_CADASTRO_ALUNO = Object.freeze({
  nome: "",
  email: "",
  senha: "",
  confirmar_senha: "",
  data_nascimento: "",
  ra: "",
  serie: "",
});

const VALORES_INICIAIS_LOGIN = Object.freeze({
  email: "",
  senha: "",
});

const VALORES_INICIAIS_CADASTRO_PROFESSOR = Object.freeze({
  nomeCompleto: "",
  email: "",
  senha: "",
  confirmarSenha: "",
  dataNascimento: "",
  diploma: "",
  materia: "",
});

const VALORES_INICIAIS_EDITAR_PERFIL = Object.freeze({
  nome: "",
  email: "",
  serie: "",
});

// Consultas SQL que serao usadas quando as rotas deixarem de ser simuladas.
// Futuramente cada bloco pode ir para uma camada de model/repository.
const SQL = Object.freeze({
  usuarios: {
    buscarPorEmail: `
      SELECT id_usuario, nome, email, senha, tipo_usuario, status
      FROM ${TABELAS.usuarios}
      WHERE email = ?
      LIMIT 1
    `,
    buscarEmailDeOutroUsuario: `
      SELECT id_usuario
      FROM ${TABELAS.usuarios}
      WHERE email = ? AND id_usuario <> ?
      LIMIT 1
    `,
    criarUsuario: `
      INSERT INTO ${TABELAS.usuarios}
        (nome, senha, email, tipo_usuario, status)
      VALUES (?, ?, ?, ?, ?)
    `,
    atualizarPerfilBasico: `
      UPDATE ${TABELAS.usuarios}
      SET nome = ?, email = ?
      WHERE id_usuario = ?
    `,
    atualizarSenha: `
      UPDATE ${TABELAS.usuarios}
      SET senha = ?
      WHERE id_usuario = ?
    `,
    alterarTipoConta: `
      UPDATE ${TABELAS.usuarios}
      SET tipo_usuario = ?
      WHERE id_usuario = ?
    `,
    alterarStatusConta: `
      UPDATE ${TABELAS.usuarios}
      SET status = ?
      WHERE id_usuario = ?
    `,
    excluirConta: `
      DELETE FROM ${TABELAS.usuarios}
      WHERE id_usuario = ?
    `,
  },
  alunos: {
    criarAluno: `
      INSERT INTO ${TABELAS.alunos}
        (id_aluno, RA, serie, data_nascimento)
      VALUES (?, ?, ?, ?)
    `,
    buscarPerfilCompleto: `
      SELECT u.id_usuario, u.nome, u.email, u.tipo_usuario, u.status, a.RA, a.serie, a.data_nascimento
      FROM ${TABELAS.usuarios} u
      LEFT JOIN ${TABELAS.alunos} a ON a.id_aluno = u.id_usuario
      WHERE u.id_usuario = ?
    `,
    buscarUltimoPerfil: `
      SELECT u.id_usuario, u.nome, u.email, u.tipo_usuario, u.status, a.RA, a.serie, a.data_nascimento
      FROM ${TABELAS.usuarios} u
      INNER JOIN ${TABELAS.alunos} a ON a.id_aluno = u.id_usuario
      WHERE u.tipo_usuario = 'aluno'
      ORDER BY u.id_usuario DESC
      LIMIT 1
    `,
    atualizarAluno: `
      UPDATE ${TABELAS.alunos}
      SET serie = ?
      WHERE id_aluno = ?
    `,
  },
  professores: {
    criarProfessor: `
      INSERT INTO ${TABELAS.professores}
        (id_professor, id_materia, diploma, data_nascimento)
      VALUES (?, ?, ?, ?)
    `,
    listarProfessores: `
      SELECT p.id_professor, u.nome, u.email, u.tipo_usuario, u.status, p.diploma
      FROM ${TABELAS.professores} p
      INNER JOIN ${TABELAS.usuarios} u ON u.id_usuario = p.id_professor
      ORDER BY u.nome
    `,
    buscarPerfilCompleto: `
      SELECT u.id_usuario, u.nome, u.email, u.tipo_usuario, u.status, p.diploma, p.data_nascimento, m.nome AS materia
      FROM ${TABELAS.usuarios} u
      LEFT JOIN ${TABELAS.professores} p ON p.id_professor = u.id_usuario
      LEFT JOIN ${TABELAS.materias} m ON m.id_materia = p.id_materia
      WHERE u.id_usuario = ?
    `,
    buscarUltimoPerfil: `
      SELECT u.id_usuario, u.nome, u.email, u.tipo_usuario, u.status, p.diploma, p.data_nascimento, m.nome AS materia
      FROM ${TABELAS.usuarios} u
      INNER JOIN ${TABELAS.professores} p ON p.id_professor = u.id_usuario
      LEFT JOIN ${TABELAS.materias} m ON m.id_materia = p.id_materia
      WHERE u.tipo_usuario = 'professor'
      ORDER BY u.id_usuario DESC
      LIMIT 1
    `,
  },
  materias: {
    listarAtivas: `
      SELECT id_materia, nome, descricao
      FROM ${TABELAS.materias}
      ORDER BY nome
    `,
    buscarPorNome: `
      SELECT id_materia, nome
      FROM ${TABELAS.materias}
      WHERE nome = ?
      LIMIT 1
    `,
    criarMateria: `
      INSERT INTO ${TABELAS.materias}
        (nome, descricao)
      VALUES (?, ?)
    `,
    removerMateria: `
      DELETE FROM ${TABELAS.materias}
      WHERE id_materia = ?
    `,
  },
  conteudos: {
    listarPublicados: `
      SELECT c.id, c.titulo, c.descricao, c.tipo, c.is_premium, c.destaque, m.nome AS materia
      FROM ${TABELAS.conteudos} c
      LEFT JOIN ${TABELAS.materias} m ON m.id = c.materia_id
      WHERE c.status = 'publicado'
      ORDER BY c.criado_em DESC
    `,
    criarConteudo: `
      INSERT INTO ${TABELAS.conteudos}
        (titulo, descricao, tipo, materia_id, professor_id, arquivo_url, imagem_url, is_premium, destaque, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  },
  forum: {
    listarDuvidas: `
      SELECT d.id, d.titulo, d.pergunta, d.status, d.criado_em, u.nome AS autor, m.nome AS materia
      FROM ${TABELAS.duvidas} d
      INNER JOIN ${TABELAS.alunos} a ON a.id = d.aluno_id
      INNER JOIN ${TABELAS.usuarios} u ON u.id = a.usuario_id
      LEFT JOIN ${TABELAS.materias} m ON m.id = d.materia_id
      ORDER BY d.criado_em DESC
    `,
    listarDenuncias: `
      SELECT df.id, df.motivo, df.descricao, df.status, df.criado_em, d.titulo AS duvida_titulo, u.nome AS denunciante
      FROM ${TABELAS.denunciasForum} df
      LEFT JOIN ${TABELAS.duvidas} d ON d.id = df.duvida_id
      INNER JOIN ${TABELAS.usuarios} u ON u.id = df.denunciante_id
      ORDER BY df.criado_em DESC
    `,
    atualizarStatusDenuncia: `
      UPDATE ${TABELAS.denunciasForum}
      SET status = ?, resolvido_em = NOW()
      WHERE id = ?
    `,
  },
  contato: {
    criarMensagem: `
      INSERT INTO ${TABELAS.mensagensContato}
        (usuario_id, nome, email, assunto, mensagem, origem, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pendente')
    `,
    listarMensagens: `
      SELECT id, nome, email, assunto, mensagem, origem, status, criado_em
      FROM ${TABELAS.mensagensContato}
      ORDER BY criado_em DESC
    `,
    marcarRespondido: `
      UPDATE ${TABELAS.mensagensContato}
      SET status = 'respondido'
      WHERE id = ?
    `,
  },
  admin: {
    metricasDashboard: {
      totalAlunos: `SELECT COUNT(*) AS total FROM ${TABELAS.usuarios} WHERE tipo_usuario = 'aluno'`,
      totalProfessores: `SELECT COUNT(*) AS total FROM ${TABELAS.usuarios} WHERE tipo_usuario = 'professor'`,
      duvidasPendentes: `SELECT COUNT(*) AS total FROM ${TABELAS.duvidas} WHERE status = 'pendente'`,
      conteudosCadastrados: `SELECT COUNT(*) AS total FROM ${TABELAS.conteudos}`,
      usuariosPremium: `SELECT COUNT(*) AS total FROM ${TABELAS.assinaturasPremium} WHERE status = 'ativa'`,
      mensagensContato: `SELECT COUNT(*) AS total FROM ${TABELAS.mensagensContato} WHERE status = 'pendente'`,
    },
  },
});

// Variaveis de apoio para integrar banco, sessoes e seguranca depois.
// Hoje ainda podem ficar sem uso em algumas rotas porque parte do sistema continua estatica.
var usuarioLogadoSimulado = null;
var dadosDashboardAdmin = {};
var materiasDisponiveis = [];
var conteudosDisponiveis = [];
var notificacoesDoUsuario = [];

function criarEstadoFormulario(valores = {}) {
  return {
    erros: null,
    valores,
    retorno: null,
    erroValidacao: {},
    msgErro: {},
  };
}

function montarErrosValidacao(errors) {
  const erroValidacao = {};
  const msgErro = {};

  errors.array().forEach((erro) => {
    erroValidacao[erro.path] = "erro";
    msgErro[erro.path] = erro.msg;
  });

  return { erroValidacao, msgErro };
}

function rotaInicialPorTipoUsuario(tipoUsuario) {
  return ROTAS_POR_TIPO_USUARIO[tipoUsuario] || ROTAS_POR_TIPO_USUARIO[TIPOS_USUARIO.aluno];
}

function normalizarRA(ra) {
  return String(ra || "").trim().toUpperCase().replace(/\s+/g, "");
}

function validarFormatoRA(ra) {
  const formatoComSeparadores = /^[0-9]{6,15}-[0-9A-Z]{1,2}\/[A-Z]{2}$/;
  const formatoSemSeparadores = /^[0-9]{7,17}[A-Z]{2}$/;

  return formatoComSeparadores.test(ra) || formatoSemSeparadores.test(ra);
}

function formatarDataInput(data) {
  if (!data) return "";

  if (data instanceof Date) {
    return data.toISOString().slice(0, 10);
  }

  return String(data).slice(0, 10);
}

function renderizarCadastroAluno(res, valores = VALORES_INICIAIS_CADASTRO_ALUNO, msgErro = {}) {
  return res.render(VIEWS.cadastro, {
    erros: null,
    valores,
    retorno: null,
    erroValidacao: {},
    msgErro,
  });
}

function renderizarCadastroProfessor(res, valores = VALORES_INICIAIS_CADASTRO_PROFESSOR, msgErro = {}) {
  return res.render(VIEWS.cadastroProfessor, {
    erros: null,
    valores,
    retorno: null,
    erroValidacao: {},
    msgErro,
  });
}

function renderizarLogin(res, valores = VALORES_INICIAIS_LOGIN, msgErro = {}) {
  return res.render(VIEWS.login, {
    erros: null,
    valores,
    erroValidacao: {},
    msgErro,
  });
}

async function emailJaCadastrado(conexao, email) {
  const [usuarios] = await conexao.query(SQL.usuarios.buscarPorEmail, [email]);
  return usuarios.length > 0;
}

async function cadastrarUsuarioBase(conexao, { nome, email, senha, tipoUsuario }) {
  const senhaCriptografada = await bcrypt.hash(senha, 10);
  const [resultado] = await conexao.query(SQL.usuarios.criarUsuario, [
    nome,
    senhaCriptografada,
    email,
    tipoUsuario,
    STATUS_CONTA.ativo,
  ]);

  return resultado.insertId;
}

async function buscarOuCriarMateria(conexao, nomeMateria) {
  const [materias] = await conexao.query(SQL.materias.buscarPorNome, [nomeMateria]);

  if (materias.length > 0) {
    return materias[0].id_materia;
  }

  const [resultado] = await conexao.query(SQL.materias.criarMateria, [
    nomeMateria,
    `Conteudos de ${nomeMateria}`,
  ]);

  return resultado.insertId;
}

function criarCookieUsuario(res, usuario) {
  // Temporario: guardar apenas id e tipo para carregar o perfil apos redirect.
  // Futuramente substituir por express-session ou JWT assinado e com expiracao segura.
  const payload = Buffer.from(
    JSON.stringify({
      id: usuario.id,
      tipo_usuario: usuario.tipo_usuario,
    })
  ).toString("base64url");

  res.setHeader("Set-Cookie", `primia_usuario=${payload}; Path=/; HttpOnly; SameSite=Lax`);
}

function lerCookieUsuario(req) {
  const cookies = (req.headers.cookie || "").split(";").map((cookie) => cookie.trim());
  const cookieUsuario = cookies.find((cookie) => cookie.startsWith("primia_usuario="));

  if (!cookieUsuario) return null;

  try {
    const valor = cookieUsuario.split("=")[1];
    return JSON.parse(Buffer.from(valor, "base64url").toString("utf8"));
  } catch (erro) {
    return null;
  }
}

function usuarioAutenticado(req, tipoUsuario) {
  const usuarioCookie = lerCookieUsuario(req);
  const usuarioBase = usuarioCookie || usuarioLogadoSimulado;

  if (!usuarioBase || usuarioBase.tipo_usuario !== tipoUsuario) {
    return null;
  }

  return usuarioBase;
}

async function emailPertenceAOutroUsuario(email, idUsuario) {
  const [usuarios] = await pool.query(SQL.usuarios.buscarEmailDeOutroUsuario, [email, idUsuario]);
  return usuarios.length > 0;
}

function perfilFallback(tipoUsuario) {
  if (tipoUsuario === TIPOS_USUARIO.professor) {
    return {
      nome: "Usuario do Professor",
      email: "usuarioprofessor@gmail.com",
      materia: "Materia: Exemplo",
    };
  }

  return {
    nome: "Usuario do Aluno",
    email: "usuarioaluno@gmail.com",
    ra: "0000",
    serie: "",
  };
}

function formatarPerfil(tipoUsuario, perfil, usuarioBase = {}) {
  return {
    ...perfilFallback(tipoUsuario),
    ...usuarioBase,
    ...perfil,
    id: perfil.id_usuario || usuarioBase.id,
    ra: perfil.RA || usuarioBase.ra,
    data_nascimento: formatarDataInput(perfil.data_nascimento || usuarioBase.data_nascimento),
    materia: perfil.materia ? `Materia: ${perfil.materia}` : usuarioBase.materia,
  };
}

async function buscarUltimoPerfil(tipoUsuario) {
  try {
    const consulta =
      tipoUsuario === TIPOS_USUARIO.professor
        ? SQL.professores.buscarUltimoPerfil
        : SQL.alunos.buscarUltimoPerfil;

    const [linhas] = await pool.query(consulta);
    const perfil = linhas[0];

    if (!perfil) {
      return perfilFallback(tipoUsuario);
    }

    return formatarPerfil(tipoUsuario, perfil);
  } catch (erro) {
    console.error("Erro ao buscar ultimo perfil:", erro);
    return perfilFallback(tipoUsuario);
  }
}

async function buscarPerfilLogado(req, tipoUsuario) {
  const usuarioCookie = lerCookieUsuario(req);
  const usuarioBase = usuarioCookie || usuarioLogadoSimulado;

  if (!usuarioBase || usuarioBase.tipo_usuario !== tipoUsuario) {
    return buscarUltimoPerfil(tipoUsuario);
  }

  try {
    const consulta =
      tipoUsuario === TIPOS_USUARIO.professor
        ? SQL.professores.buscarPerfilCompleto
        : SQL.alunos.buscarPerfilCompleto;

    const [linhas] = await pool.query(consulta, [usuarioBase.id]);
    const perfil = linhas[0];

    if (!perfil) {
      return { ...perfilFallback(tipoUsuario), ...usuarioBase };
    }

    return formatarPerfil(tipoUsuario, perfil, usuarioBase);
  } catch (erro) {
    console.error("Erro ao buscar perfil:", erro);
    return { ...perfilFallback(tipoUsuario), ...usuarioBase };
  }
}

function somenteAdminSimulado(req, res, next) {
  // Futuramente bloquear acesso se nao houver sessao valida:
  // if (!req.session || !req.session.usuario) return res.redirect("/login");
  // Futuramente confirmar se o cargo do usuario logado e admin:
  // if (req.session.usuario.tipo_usuario !== "admin") return res.status(403).render("pages/acesso-negado");
  // Futuramente validar permissoes especificas para acoes sensiveis:
  // const podeGerenciarUsuarios = req.session.usuario.permissoes.includes("gerenciar_usuarios");
  // if (!podeGerenciarUsuarios) return res.status(403).send("Acesso negado");
  next();
}

router.get("/", function (req, res) {
  res.render("pages/telainicial");
});

router.get("/materia1", function (req, res) {
  res.render("pages/materia1");
});

router.get("/paginaMaterias", function (req, res) {
  res.render("pages/paginaMaterias");
});


router.get("/login", function (req, res) {
  renderizarLogin(res);
});

router.get("/areapremium", function (req, res) {
  res.render("pages/areapremium");
});

router.get("/admin", somenteAdminSimulado, function (req, res) {
  // Futuramente buscar metricas reais no banco de dados antes de renderizar:
  // const metricas = await AdminModel.buscarMetricasDashboard();
  // const usuarios = await UsuarioModel.listarUsuariosRecentes();
  // res.render("pages/admin", { metricas, usuarios });
  res.render(VIEWS.admin);
});

router.get("/admin/dashboard", somenteAdminSimulado, function (req, res) {
  // Futuramente manter esta rota como alias ou separar dashboard de outras telas admin.
  res.redirect("/admin");
});


router.get("/telainicial", function (req, res) {
  res.render("pages/telainicial");
});

router.get("/contato", function (req, res) {
  res.render("pages/contato");
});

router.get("/contatoprofessor", function (req, res) {
  res.render("pages/contatoprofessor");
});



router.get("/video", function (req, res) {
  res.render("pages/video");
});

router.get("/videoaula", function (req, res) {
  res.render("pages/videoaula");
});

router.get("/cronograma", function (req, res) {
  res.render("pages/cronograma");
});



router.get("/areadosimulado", function (req, res) {
  res.render("pages/areadosimulado");
});


router.get("/cadastroprofessor", function (req, res) {
  renderizarCadastroProfessor(res);
});

router.get("/partepremium", function (req, res) {
  res.render("pages/partepremium");
});


router.get("/partepremiumprofessor", function (req, res) {
  res.render("pages/partepremiumprofessor");
});



router.get("/biblioteca", function (req, res) {
  res.render("pages/biblioteca");
});


router.get("/areapremiumprofessor", function (req, res) {
  res.render("pages/areapremiumprofessor");
});


router.get("/simuladoprofessor", function (req, res) {
  res.render("pages/simuladoprofessor");
});

router.get("/videoaulaprofessor", function (req, res) {
  res.render("pages/videoaulaprofessor");
});

router.get("/cronogramaprofessor", function (req, res) {
  res.render("pages/cronogramaprofessor");
});



router.get("/bibliotecaprofessor", function (req, res) {
  res.render("pages/bibliotecaprofessor");
});


router.get("/livro", function (req, res) {
  res.render("pages/livro");
});

router.get("/forumdeduvidas", function (req, res) {
  res.render("pages/forumdeduvidas");
});

router.get("/forumprofessor", function (req, res) {
  res.render("pages/forumprofessor");
});

router.get("/planoestudoprofessor", function (req, res) {
  res.render("pages/planoestudoprofessor");
});


router.get("/logincadastro", function (req, res) {
  res.render("pages/logincadastro");
});

router.get("/naotemumaconta", function (req, res) {
  res.redirect("/login");
});


router.get("/entradaprofessor", async function (req, res) {
  const usuario = await buscarPerfilLogado(req, TIPOS_USUARIO.professor);
  res.render("pages/entradaprofessor", { usuario });
});

router.get("/planoestudo", function (req, res) {
  res.render("pages/planoestudo");
});

router.get("/termouso", function (req, res) {
  res.render("pages/termouso");
});

router.get("/editarperfil", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const usuario = await buscarPerfilLogado(req, TIPOS_USUARIO.aluno);

  res.render(VIEWS.editarPerfil, {
    erros: null,
    valores: {
      nome: usuario.nome,
      email: usuario.email,
      serie: usuario.serie || "",
      ra: usuario.ra || "0000",
      data_nascimento: usuario.data_nascimento || "",
    },
    erroValidacao: {},
    msgErro: {},
  });
});

router.get("/editarprofessor", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const usuario = await buscarPerfilLogado(req, TIPOS_USUARIO.professor);

  res.render("pages/editarprofessor", {
    erros: null,
    valores: {
      nome: usuario.nome,
      email: usuario.email,
      materia: usuario.materia || "Materia: Exemplo",
      data_nascimento: usuario.data_nascimento || "",
    },
    erroValidacao: {},
    msgErro: {},
  });
});

router.get("/termopriva", function (req, res) {
  res.render("pages/termopriva");
});

router.get("/entrada", async function (req, res) {
  const usuario = await buscarPerfilLogado(req, TIPOS_USUARIO.aluno);
  res.render("pages/entrada", { usuario });
});

router.get("/duvida", function (req, res) {
  res.render("pages/duvida");
});

router.get("/chat", function (req, res) {
  res.render("pages/chat");
});

router.get("/sobreprofessor", function (req, res) {
  res.render("pages/sobreprofessor");
});


router.get("/sobre", function (req, res) {
  res.render("pages/sobre");
});


// ========== ROTA GET CADASTRO ==========
router.get("/cadastro", (req, res) => {
  renderizarCadastroAluno(res);
});

// ========== ROTA POST CADASTRO ==========
router.post(
  "/cadastro",

  // Validação dos campos
  body("nome")
    .trim()
    .notEmpty()
    .withMessage("O nome de usuário é obrigatório!")
    .isLength({ min: 3 })
    .withMessage("O nome deve ter pelo menos 3 caracteres!"),

  body("email")
    .notEmpty()
    .withMessage("O e-mail é obrigatório!")
    .isEmail()
    .withMessage("Digite um e-mail válido!"),

  body("senha")
    .notEmpty()
    .withMessage("A senha é obrigatória!")
    .isLength({ min: 6 })
    .withMessage("A senha deve ter pelo menos 6 caracteres!"),

  body("confirmar_senha")
    .notEmpty()
    .withMessage("A confirmação de senha é obrigatória!")
    .custom((value, { req }) => {
      if (value !== req.body.senha) {
        throw new Error("As senhas não conferem!");
      }
      return true;
    }),

  body("data_nascimento")
    .notEmpty()
    .withMessage("A data de nascimento é obrigatória!"),

  body("ra")
    .customSanitizer(normalizarRA)
    .notEmpty()
    .withMessage("O RA é obrigatório!")
    .isLength({ min: 9, max: 30 })
    .withMessage("O RA deve ter entre 9 e 30 caracteres.")
    .custom((value) => {
      if (!validarFormatoRA(value)) {
        throw new Error("Digite o RA no formato 000123456789-0/SP ou 0001234567890SP.");
      }
      return true;
    }),

  body("serie")
    .notEmpty()
    .withMessage("A série escolar é obrigatória!"),

  // Função principal
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Cria objetos para marcar os campos com erro
      const { erroValidacao, msgErro } = montarErrosValidacao(errors);

      // Recarrega a página de cadastro com as mensagens de erro
      return res.render(VIEWS.cadastro, {
        erros: errors,
        valores: req.body,
        retorno: null,
        erroValidacao,
        msgErro,
      });
    }

    const { nome, email, senha, data_nascimento, ra, serie } = req.body;
    const conexao = await pool.getConnection();

    try {
      await conexao.beginTransaction();

      if (await emailJaCadastrado(conexao, email)) {
        await conexao.rollback();
        return renderizarCadastroAluno(res, req.body, {
          email: "Este e-mail ja esta cadastrado.",
        });
      }

      const idUsuario = await cadastrarUsuarioBase(conexao, {
        nome,
        email,
        senha,
        tipoUsuario: TIPOS_USUARIO.aluno,
      });

      await conexao.query(SQL.alunos.criarAluno, [idUsuario, ra, serie, data_nascimento]);
      await conexao.commit();

      usuarioLogadoSimulado = {
        id: idUsuario,
        nome,
        email,
        tipo_usuario: TIPOS_USUARIO.aluno,
        ra,
        serie,
        data_nascimento,
      };
      criarCookieUsuario(res, usuarioLogadoSimulado);

      return res.redirect(rotaInicialPorTipoUsuario(TIPOS_USUARIO.aluno));
    } catch (erro) {
      await conexao.rollback();
      console.error("Erro ao cadastrar aluno:", erro);

      return renderizarCadastroAluno(res, req.body, {
        geral: "Nao foi possivel concluir o cadastro. Tente novamente.",
      });
    } finally {
      conexao.release();
    }
  }
);

router.post("/entrada", async function(req, res) {
  const { email } = req.body;

  if (email) {
    try {
      const [usuarios] = await pool.query(SQL.usuarios.buscarPorEmail, [email]);
      const usuario = usuarios[0];

      if (usuario) {
        criarCookieUsuario(res, {
          id: usuario.id_usuario,
          tipo_usuario: usuario.tipo_usuario,
        });
      }
    } catch (erro) {
      console.error("Erro ao preparar perfil do aluno:", erro);
    }
  }

  res.redirect("/entrada");
});



router.get("/cadastroprofessor", (req, res) => {
  renderizarCadastroProfessor(res);
});

// ========== ROTA POST CADASTRO PROFESSOR ==========
router.post(
  "/cadastroprofessor",

  body("nomeCompleto")
    .trim()
    .notEmpty()
    .withMessage("O nome completo e obrigatorio.")
    .isLength({ min: 3 })
    .withMessage("O nome deve ter pelo menos 3 caracteres."),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("O e-mail e obrigatorio.")
    .isEmail()
    .withMessage("Digite um e-mail valido."),

  body("senha")
    .notEmpty()
    .withMessage("A senha e obrigatoria.")
    .isLength({ min: 6 })
    .withMessage("A senha deve ter pelo menos 6 caracteres."),

  body("confirmarSenha")
    .notEmpty()
    .withMessage("A confirmacao de senha e obrigatoria.")
    .custom((value, { req }) => {
      if (value !== req.body.senha) {
        throw new Error("As senhas nao conferem.");
      }
      return true;
    }),

  body("dataNascimento")
    .notEmpty()
    .withMessage("A data de nascimento e obrigatoria."),

  body("materia")
    .notEmpty()
    .withMessage("A materia e obrigatoria."),

  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const { msgErro } = montarErrosValidacao(errors);
      return renderizarCadastroProfessor(res, req.body, msgErro);
    }

    const { nomeCompleto, email, senha, materia, dataNascimento } = req.body;
    const diploma = req.body.diploma || "diploma_pendente_upload";
    const conexao = await pool.getConnection();

    try {
      await conexao.beginTransaction();

      if (await emailJaCadastrado(conexao, email)) {
        await conexao.rollback();
        return renderizarCadastroProfessor(res, req.body, {
          email: "Este e-mail ja esta cadastrado.",
        });
      }

      const idUsuario = await cadastrarUsuarioBase(conexao, {
        nome: nomeCompleto,
        email,
        senha,
        tipoUsuario: TIPOS_USUARIO.professor,
      });

      const idMateria = await buscarOuCriarMateria(conexao, materia);

      await conexao.query(SQL.professores.criarProfessor, [idUsuario, idMateria, diploma, dataNascimento]);
      await conexao.commit();

      usuarioLogadoSimulado = {
        id: idUsuario,
        nome: nomeCompleto,
        email,
        tipo_usuario: TIPOS_USUARIO.professor,
        materia: materia ? `Materia: ${materia}` : "Materia: Exemplo",
        data_nascimento: dataNascimento,
      };
      criarCookieUsuario(res, usuarioLogadoSimulado);

      return res.redirect(rotaInicialPorTipoUsuario(TIPOS_USUARIO.professor));
    } catch (erro) {
      await conexao.rollback();
      console.error("Erro ao cadastrar professor:", erro);

      return renderizarCadastroProfessor(res, req.body, {
        geral: "Nao foi possivel concluir o cadastro. Tente novamente.",
      });
    } finally {
      conexao.release();
    }
  }
);

router.post("/entradaprofessor", async (req, res) => {
  const { email } = req.body;

  if (email) {
    try {
      const [usuarios] = await pool.query(SQL.usuarios.buscarPorEmail, [email]);
      const usuario = usuarios[0];

      if (usuario) {
        criarCookieUsuario(res, {
          id: usuario.id_usuario,
          tipo_usuario: usuario.tipo_usuario,
        });
      }
    } catch (erro) {
      console.error("Erro ao preparar perfil do professor:", erro);
    }
  }

  res.redirect("/entradaprofessor");
});

// ========== ROTA GET LOGIN ==========
router.get("/login", (req, res) => {
  renderizarLogin(res);
});

router.get("/loginprofessor", (req, res) => {
  res.redirect("/login");
});

// ========== ROTA POST LOGIN ==========
router.post(
  "/login",
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("O e-mail é obrigatório!")
      .isEmail()
      .withMessage("Digite um e-mail válido!"),
    body("senha")
      .notEmpty()
      .withMessage("A senha é obrigatória!")
      .isLength({ min: 6 })
      .withMessage("A senha deve ter pelo menos 6 caracteres!"),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    // Se houver erros, volta pro login com mensagens
    if (!errors.isEmpty()) {
      const { erroValidacao, msgErro } = montarErrosValidacao(errors);

      return res.render(VIEWS.login, {
        erros: errors,
        valores: req.body,
        erroValidacao,
        msgErro,
      });
    }

    // Caso não haja erros
    const { email, senha } = req.body;

    try {
      const [usuarios] = await pool.query(SQL.usuarios.buscarPorEmail, [email]);
      const usuario = usuarios[0];

      if (!usuario) {
        return renderizarLogin(res, req.body, {
          geral: "E-mail ou senha incorretos.",
        });
      }

      if (usuario.status !== STATUS_CONTA.ativo) {
        return renderizarLogin(res, req.body, {
          geral: "Esta conta nao esta ativa. Procure o suporte.",
        });
      }

      const senhaValida = await bcrypt.compare(senha, usuario.senha);

      if (!senhaValida) {
        return renderizarLogin(res, req.body, {
          geral: "E-mail ou senha incorretos.",
        });
      }

      // Futuramente trocar esta variavel temporaria por uma sessao real:
      // req.session.usuario = {
      //   id: usuario.id_usuario,
      //   nome: usuario.nome,
      //   email: usuario.email,
      //   tipo_usuario: usuario.tipo_usuario,
      // };
      usuarioLogadoSimulado = {
        id: usuario.id_usuario,
        nome: usuario.nome,
        email: usuario.email,
        tipo_usuario: usuario.tipo_usuario,
      };
      criarCookieUsuario(res, usuarioLogadoSimulado);

      return res.redirect(rotaInicialPorTipoUsuario(usuario.tipo_usuario));
    } catch (erro) {
      console.error("Erro ao fazer login:", erro);

      return renderizarLogin(res, req.body, {
        geral: "Nao foi possivel fazer login agora. Tente novamente.",
      });
    }
  }
);


// ========== ROTAS POST EDITAR PERFIL INTEGRADAS AO BANCO ==========
router.post(
  "/editarperfil",

  body("nome").trim().notEmpty().withMessage("O nome e obrigatorio!"),
  body("email").trim().notEmpty().withMessage("O e-mail e obrigatorio!").isEmail().withMessage("Digite um e-mail valido!"),
  body("serie").notEmpty().withMessage("A serie escolar e obrigatoria!"),
  body("senha").optional({ checkFalsy: true }).isLength({ min: 8, max: 15 }).withMessage("A senha deve ter entre 8 e 15 caracteres!"),
  body("confirmar-senha").optional({ checkFalsy: true }).custom((value, { req }) => {
    if (req.body.senha && value !== req.body.senha) {
      throw new Error("As senhas nao conferem!");
    }
    return true;
  }),

  async (req, res) => {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const { erroValidacao, msgErro } = montarErrosValidacao(errors);

      return res.render(VIEWS.editarPerfil, {
        erros: errors,
        valores: req.body,
        erroValidacao,
        msgErro,
      });
    }

    const { nome, email, serie, senha } = req.body;
    const conexao = await pool.getConnection();

    try {
      await conexao.beginTransaction();

      if (await emailPertenceAOutroUsuario(email, usuarioBase.id)) {
        await conexao.rollback();

        return res.render(VIEWS.editarPerfil, {
          erros: null,
          valores: req.body,
          erroValidacao: { email: "erro" },
          msgErro: { email: "Este e-mail ja esta cadastrado em outra conta." },
        });
      }

      await conexao.query(SQL.usuarios.atualizarPerfilBasico, [nome, email, usuarioBase.id]);
      await conexao.query(SQL.alunos.atualizarAluno, [serie, usuarioBase.id]);

      if (senha) {
        const senhaCriptografada = await bcrypt.hash(senha, 10);
        await conexao.query(SQL.usuarios.atualizarSenha, [senhaCriptografada, usuarioBase.id]);
      }

      await conexao.commit();

      usuarioLogadoSimulado = {
        ...usuarioBase,
        nome,
        email,
        tipo_usuario: TIPOS_USUARIO.aluno,
      };
      criarCookieUsuario(res, usuarioLogadoSimulado);

      return res.redirect("/entrada");
    } catch (erro) {
      await conexao.rollback();
      console.error("Erro ao editar perfil do aluno:", erro);

      return res.render(VIEWS.editarPerfil, {
        erros: null,
        valores: req.body,
        erroValidacao: {},
        msgErro: { geral: "Nao foi possivel salvar as alteracoes. Tente novamente." },
      });
    } finally {
      conexao.release();
    }
  }
);

router.post(
  "/editarprofessor",

  body("nome").trim().notEmpty().withMessage("O nome e obrigatorio!"),
  body("email").trim().notEmpty().withMessage("O e-mail e obrigatorio!").isEmail().withMessage("Digite um e-mail valido!"),
  body("senha").optional({ checkFalsy: true }).isLength({ min: 8, max: 15 }).withMessage("A senha deve ter entre 8 e 15 caracteres!"),
  body("confirmar-senha").optional({ checkFalsy: true }).custom((value, { req }) => {
    if (req.body.senha && value !== req.body.senha) {
      throw new Error("As senhas nao conferem!");
    }
    return true;
  }),

  async (req, res) => {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const { erroValidacao, msgErro } = montarErrosValidacao(errors);

      return res.render("pages/editarprofessor", {
        erros: errors,
        valores: req.body,
        erroValidacao,
        msgErro,
      });
    }

    const { nome, email, senha } = req.body;
    const conexao = await pool.getConnection();

    try {
      await conexao.beginTransaction();

      if (await emailPertenceAOutroUsuario(email, usuarioBase.id)) {
        await conexao.rollback();

        return res.render("pages/editarprofessor", {
          erros: null,
          valores: req.body,
          erroValidacao: { email: "erro" },
          msgErro: { email: "Este e-mail ja esta cadastrado em outra conta." },
        });
      }

      await conexao.query(SQL.usuarios.atualizarPerfilBasico, [nome, email, usuarioBase.id]);

      if (senha) {
        const senhaCriptografada = await bcrypt.hash(senha, 10);
        await conexao.query(SQL.usuarios.atualizarSenha, [senhaCriptografada, usuarioBase.id]);
      }

      await conexao.commit();

      usuarioLogadoSimulado = {
        ...usuarioBase,
        nome,
        email,
        tipo_usuario: TIPOS_USUARIO.professor,
      };
      criarCookieUsuario(res, usuarioLogadoSimulado);

      return res.redirect("/entradaprofessor");
    } catch (erro) {
      await conexao.rollback();
      console.error("Erro ao editar perfil do professor:", erro);

      return res.render("pages/editarprofessor", {
        erros: null,
        valores: req.body,
        erroValidacao: {},
        msgErro: { geral: "Nao foi possivel salvar as alteracoes. Tente novamente." },
      });
    } finally {
      conexao.release();
    }
  }
);

// ========== ROTA POST EDITAR PERFIL ANTIGA ==========
router.post(
  "/editarperfil",

  body("nome")
    .trim()
    .notEmpty()
    .withMessage("O nome é obrigatório!")
    .matches(/^[A-Za-zÀ-ú]+(\s[A-Za-zÀ-ú]+)+$/)
    .withMessage("Digite seu nome completo (pelo menos duas palavras)"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("O e-mail é obrigatório!")
    .isEmail()
    .withMessage("Digite um e-mail válido!"),

  body("serie")
    .notEmpty()
    .withMessage("A série escolar é obrigatória!"),

  // Senha é opcional — só valida se o usuário preencheu
  body("senha")
    .optional({ checkFalsy: true })
    .isLength({ min: 8, max: 15 })
    .withMessage("A senha deve ter entre 8 e 15 caracteres!")
    .matches(/[A-Z]/)
    .withMessage("A senha deve ter pelo menos uma letra maiúscula!")
    .matches(/[a-z]/)
    .withMessage("A senha deve ter pelo menos uma letra minúscula!")
    .matches(/[0-9]/)
    .withMessage("A senha deve ter pelo menos um número!")
    .matches(/[@!#$%&]/)
    .withMessage("A senha deve ter pelo menos um caractere especial (@!#$%&)!"),

  body("confirmar-senha")
    .optional({ checkFalsy: true })
    .custom((value, { req }) => {
      if (req.body.senha && value !== req.body.senha) {
        throw new Error("As senhas não conferem!");
      }
      return true;
    }),

  async (req, res) => {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const { erroValidacao, msgErro } = montarErrosValidacao(errors);

      return res.render(VIEWS.editarPerfil, {
        erros: errors,
        valores: req.body,
        erroValidacao,
        msgErro,
      });
    }

    // Tudo certo — redireciona para a entrada do aluno
    res.redirect("/entrada");
  }
);



module.exports = router;







