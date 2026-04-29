var express = require("express");
var router = express.Router();
const { body, validationResult } = require("express-validator");
const pool = require("../../db");
const bcrypt = require("bcrypt");
const Models = require("../models");

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

function textoTempoRelativo(data) {
  if (!data) return "agora";

  const dataEvento = new Date(data);
  const diferencaMs = Date.now() - dataEvento.getTime();
  const segundos = Math.max(0, Math.floor(diferencaMs / 1000));
  const minutos = Math.floor(segundos / 60);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (segundos < 60) return "agora";
  if (minutos < 60) return `há ${minutos} minuto${minutos === 1 ? "" : "s"}`;
  if (horas < 24) return `há ${horas} hora${horas === 1 ? "" : "s"}`;
  return `há ${dias} dia${dias === 1 ? "" : "s"}`;
}

function textoTempoRelativoSeguro(data, segundosBanco = null) {
  let segundos = Number(segundosBanco);

  if (!Number.isFinite(segundos)) {
    if (!data) return "agora";

    const dataEvento = new Date(data);
    if (Number.isNaN(dataEvento.getTime())) return "agora";

    segundos = Math.floor((Date.now() - dataEvento.getTime()) / 1000);
  }

  segundos = Math.max(0, segundos);

  const minutos = Math.floor(segundos / 60);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (segundos < 60) return "agora pouco";
  if (minutos < 60) return `ha ${minutos} minuto${minutos === 1 ? "" : "s"}`;
  if (horas < 24) return `ha ${horas} hora${horas === 1 ? "" : "s"}`;
  return `ha ${dias} dia${dias === 1 ? "" : "s"}`;
}

function slugMateria(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
  return Models.usuarios.emailJaCadastrado(email, conexao);
}

async function cadastrarUsuarioBase(conexao, { nome, email, senha, tipoUsuario }) {
  const senhaCriptografada = await bcrypt.hash(senha, 10);
  return Models.usuarios.criar(
    {
      nome,
      senhaCriptografada,
      email,
      tipoUsuario,
      status: STATUS_CONTA.ativo,
    },
    conexao
  );
}

async function buscarOuCriarMateria(conexao, nomeMateria) {
  return Models.materias.buscarOuCriar(nomeMateria, conexao);
}

async function atualizarSenhaUsuario(conexao, { senha, idUsuario }) {
  const senhaCriptografada = await bcrypt.hash(senha, 10);
  return Models.usuarios.atualizarSenha(
    {
      senhaCriptografada,
      idUsuario,
    },
    conexao
  );
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
  return Models.usuarios.emailPertenceAOutroUsuario(email, idUsuario);
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

function formatarNotificacao(notificacao) {
  return {
    ...notificacao,
    tempo: textoTempoRelativoSeguro(notificacao.data_criacao, notificacao.segundos_desde_criacao),
    link: notificacao.link || "/sobre",
  };
}

function formatarDuvida(duvida) {
  return {
    ...duvida,
    materia_slug: slugMateria(duvida.materia),
    tempo: textoTempoRelativoSeguro(duvida.data_envio, duvida.segundos_desde_envio),
    serie_formatada: duvida.serie
      ? String(duvida.serie).replace("ano", "º ano Ensino Médio")
      : "Ensino Médio",
    respostas: (duvida.respostas || []).map((resposta) => ({
      ...resposta,
      tempo: textoTempoRelativoSeguro(resposta.data_resposta, resposta.segundos_desde_resposta),
    })),
  };
}

async function anexarRespostasNasDuvidas(duvidas, conexao) {
  const duvidasComRespostas = [];

  for (const duvida of duvidas) {
    const respostas = await Models.respostas.listarPorDuvida(duvida.id_duvida, conexao);
    duvidasComRespostas.push({ ...duvida, respostas });
  }

  return duvidasComRespostas;
}

async function buscarUltimoPerfil(tipoUsuario) {
  try {
    const perfil =
      tipoUsuario === TIPOS_USUARIO.professor
        ? await Models.professores.buscarUltimoPerfil()
        : await Models.alunos.buscarUltimoPerfil();

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
    const perfil =
      tipoUsuario === TIPOS_USUARIO.professor
        ? await Models.professores.buscarPerfilCompleto(usuarioBase.id)
        : await Models.alunos.buscarPerfilCompleto(usuarioBase.id);

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

async function carregarNotificacoes(req, res, next) {
  res.locals.notificacoes = [];
  res.locals.totalNotificacoesNaoLidas = 0;

  const usuario = lerCookieUsuario(req);
  if (!usuario) return next();

  try {
    const notificacoes = await Models.notificacoes.listarPorUsuario(usuario.id, 5);
    const total = await Models.notificacoes.contarNaoLidas(usuario.id);

    res.locals.notificacoes = notificacoes.map(formatarNotificacao);
    res.locals.totalNotificacoesNaoLidas = total;
  } catch (erro) {
    console.error("Erro ao carregar notificacoes:", erro);
  }

  return next();
}

router.use(carregarNotificacoes);

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

router.get("/forumdeduvidas", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  try {
    const materias = await Models.materias.listarAtivas();
    const duvidasBase = await Models.duvidas.listar();
    const duvidas = await anexarRespostasNasDuvidas(duvidasBase);

    return res.render("pages/forumdeduvidas", {
      materias,
      duvidas: duvidas.map(formatarDuvida),
      msgErro: {},
      msgSucesso: null,
    });
  } catch (erro) {
    console.error("Erro ao carregar forum do aluno:", erro);
    return res.render("pages/forumdeduvidas", {
      materias: [],
      duvidas: [],
      msgErro: { geral: "Nao foi possivel carregar o forum agora." },
      msgSucesso: null,
    });
  }
});

router.post(
  "/forumdeduvidas",
  body("duvida").trim().notEmpty().withMessage("Digite sua duvida antes de enviar."),
  body("id_materia").notEmpty().withMessage("Escolha uma materia."),
  async function (req, res) {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.redirect("/forumdeduvidas");
    }

    const { duvida, id_materia } = req.body;
    const conexao = await pool.getConnection();

    try {
      await conexao.beginTransaction();

      const materia = await Models.materias.buscarPorId(id_materia, conexao);

      if (!materia) {
        await conexao.rollback();
        return res.redirect("/forumdeduvidas");
      }

      const idForum = await Models.forum.buscarOuCriarForumPorMateria(
        {
          idMateria: materia.id_materia,
          nomeMateria: materia.nome,
        },
        conexao
      );

      const idDuvida = await Models.duvidas.criar(
        {
          idAluno: usuarioBase.id,
          idForum,
          duvida,
        },
        conexao
      );

      const professores = await Models.forum.listarProfessoresPorForum(idForum, conexao);

      for (const professor of professores) {
        await Models.notificacoes.criar(
          {
            idUsuario: professor.id_professor,
            tipo: "nova_duvida",
            titulo: "Nova dúvida na sua matéria",
            mensagem: `Um aluno enviou uma dúvida de ${professor.materia}.`,
            link: `/forumprofessor?duvida=${idDuvida}#duvida-${idDuvida}`,
          },
          conexao
        );
      }

      await conexao.commit();
      return res.redirect(`/forumdeduvidas?duvida=${idDuvida}`);
    } catch (erro) {
      await conexao.rollback();
      console.error("Erro ao criar duvida:", erro);
      return res.redirect("/forumdeduvidas");
    } finally {
      conexao.release();
    }
  }
);

router.post("/forumdeduvidas/:id/excluir", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    await Models.respostas.excluirDaDuvidaDoAluno(
      {
        idDuvida: req.params.id,
        idAluno: usuarioBase.id,
      },
      conexao
    );

    const resultado = await Models.duvidas.excluirDoAluno(
      {
        idDuvida: req.params.id,
        idAluno: usuarioBase.id,
      },
      conexao
    );

    await conexao.commit();

    if (!resultado.affectedRows) {
      console.warn("Nenhuma duvida foi excluida. Verifique se a duvida pertence ao aluno logado.");
    }
  } catch (erro) {
    await conexao.rollback();
    console.error("Erro ao excluir duvida:", erro);
  } finally {
    conexao.release();
  }

  return res.redirect("/forumdeduvidas");
});

router.get("/forumprofessor", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  try {
    const professor = await Models.professores.buscarPerfilCompleto(usuarioBase.id);
    const materias = professor?.materia
      ? [{ id_materia: professor.id_materia, nome: professor.materia }]
      : [];
    const duvidasBase = await Models.duvidas.listarPorProfessor(usuarioBase.id);
    const duvidas = await anexarRespostasNasDuvidas(duvidasBase);

    return res.render("pages/forumprofessor", {
      professor,
      materias,
      duvidas: duvidas.map(formatarDuvida),
      msgErro: {},
      msgSucesso: null,
    });
  } catch (erro) {
    console.error("Erro ao carregar forum do professor:", erro);
    return res.render("pages/forumprofessor", {
      professor: null,
      materias: [],
      duvidas: [],
      msgErro: { geral: "Nao foi possivel carregar as duvidas agora." },
      msgSucesso: null,
    });
  }
});

router.post(
  "/forumprofessor/responder",
  body("id_duvida").notEmpty().withMessage("Duvida invalida."),
  body("resposta").trim().notEmpty().withMessage("Digite uma resposta antes de enviar."),
  async function (req, res) {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.redirect("/forumprofessor");
    }

    const { id_duvida, resposta } = req.body;
    const conexao = await pool.getConnection();

    try {
      await conexao.beginTransaction();

      const duvida = await Models.duvidas.buscarParaResposta(
        {
          idDuvida: id_duvida,
          idProfessor: usuarioBase.id,
        },
        conexao
      );

      if (!duvida) {
        await conexao.rollback();
        return res.redirect("/forumprofessor");
      }

      await Models.respostas.criar(
        {
          idProfessor: usuarioBase.id,
          idDuvida: id_duvida,
          resposta,
        },
        conexao
      );
      await Models.duvidas.marcarRespondida(id_duvida, conexao);

      await Models.notificacoes.criar(
        {
          idUsuario: duvida.id_aluno,
          tipo: "resposta_duvida",
          titulo: "Sua dúvida foi respondida",
          mensagem: `Um professor respondeu sua dúvida de ${duvida.materia}.`,
          link: `/forumdeduvidas?duvida=${id_duvida}#duvida-${id_duvida}`,
        },
        conexao
      );

      await conexao.commit();
      return res.redirect("/forumprofessor");
    } catch (erro) {
      await conexao.rollback();
      console.error("Erro ao responder duvida:", erro);
      return res.redirect("/forumprofessor");
    } finally {
      conexao.release();
    }
  }
);

router.post("/forumprofessor/respostas/:id/excluir", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const idDuvida = req.body.id_duvida;
  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    await Models.respostas.excluirDoProfessor(
      {
        idResposta: req.params.id,
        idProfessor: usuarioBase.id,
      },
      conexao
    );

    if (idDuvida) {
      await Models.duvidas.atualizarStatusPorRespostas(idDuvida, conexao);
    }

    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    console.error("Erro ao excluir resposta:", erro);
  } finally {
    conexao.release();
  }

  return res.redirect("/forumprofessor");
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

router.get("/api/notificacoes", async function (req, res) {
  const usuario = lerCookieUsuario(req);

  if (!usuario) {
    return res.json({ notificacoes: [], totalNaoLidas: 0 });
  }

  try {
    const notificacoes = await Models.notificacoes.listarPorUsuario(usuario.id, 10);
    const totalNaoLidas = await Models.notificacoes.contarNaoLidas(usuario.id);

    return res.json({
      notificacoes: notificacoes.map(formatarNotificacao),
      totalNaoLidas,
    });
  } catch (erro) {
    console.error("Erro na API de notificacoes:", erro);
    return res.status(500).json({ notificacoes: [], totalNaoLidas: 0 });
  }
});

router.post("/api/notificacoes/:id/lida", async function (req, res) {
  const usuario = lerCookieUsuario(req);

  if (!usuario) {
    return res.status(401).json({ ok: false });
  }

  try {
    await Models.notificacoes.marcarComoLida({
      idNotificacao: req.params.id,
      idUsuario: usuario.id,
    });
    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao marcar notificacao como lida:", erro);
    return res.status(500).json({ ok: false });
  }
});

router.post("/api/notificacoes/marcar-todas", async function (req, res) {
  const usuario = lerCookieUsuario(req);

  if (!usuario) {
    return res.status(401).json({ ok: false });
  }

  try {
    await Models.notificacoes.marcarTodasComoLidas(usuario.id);
    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao marcar todas notificacoes:", erro);
    return res.status(500).json({ ok: false });
  }
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

      await Models.alunos.criar(
        {
          idAluno: idUsuario,
          ra,
          serie,
          dataNascimento: data_nascimento,
        },
        conexao
      );
      await Models.notificacoes.criar(
        {
          idUsuario: idUsuario,
          tipo: "sistema",
          titulo: "Bem-vindo à Primia",
          mensagem: "Seu cadastro foi criado com sucesso. Conheça a plataforma.",
          link: "/sobre",
        },
        conexao
      );
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
      const usuario = await Models.usuarios.buscarPorEmail(email);

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

      await Models.professores.criar(
        {
          idProfessor: idUsuario,
          idMateria,
          diploma,
          dataNascimento,
        },
        conexao
      );
      await Models.notificacoes.criar(
        {
          idUsuario: idUsuario,
          tipo: "sistema",
          titulo: "Bem-vindo à Primia",
          mensagem: "Seu cadastro de professor foi criado com sucesso.",
          link: "/sobre",
        },
        conexao
      );
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
      const usuario = await Models.usuarios.buscarPorEmail(email);

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
      const usuario = await Models.usuarios.buscarPorEmail(email);

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

      await Models.usuarios.atualizarPerfilBasico(
        {
          nome,
          email,
          idUsuario: usuarioBase.id,
        },
        conexao
      );
      await Models.alunos.atualizar(
        {
          serie,
          idAluno: usuarioBase.id,
        },
        conexao
      );

      if (senha) {
        await atualizarSenhaUsuario(conexao, {
          senha,
          idUsuario: usuarioBase.id,
        });
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

      await Models.usuarios.atualizarPerfilBasico(
        {
          nome,
          email,
          idUsuario: usuarioBase.id,
        },
        conexao
      );

      if (senha) {
        await atualizarSenhaUsuario(conexao, {
          senha,
          idUsuario: usuarioBase.id,
        });
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







