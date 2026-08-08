var express = require("express");
var router = express.Router();
const { body, validationResult } = require("express-validator");
const pool = require("../../db");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const Models = require("../models");
const AdminDashboardMock = require("../mocks/adminDashboardMock");
const IaService = require("../services/iaService");
const UploadService = require("../services/uploadService");
const MailService = require("../services/mailService");
const CronogramaService = require("../services/cronogramaService");

const uploadConteudo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const TIPOS_USUARIO = Object.freeze({
  aluno: "aluno",
  professor: "professor",
  admin: "admin", 
});

const STATUS_CONTA = Object.freeze({
  ativo: "ativo",
  bloqueado: "bloqueado",
  inativo: "inativo",
});

const ROTAS_POR_TIPO_USUARIO = Object.freeze({
  [TIPOS_USUARIO.aluno]: "/entrada",
  [TIPOS_USUARIO.professor]: "/entradaprofessor",
  [TIPOS_USUARIO.admin]: "/admin",
});

const VIEWS = Object.freeze({
  login: "pages/login",
  cadastro: "pages/cadastro",
  cadastroProfessor: "pages/cadastroprofessor",
  editarPerfil: "pages/editarperfil",
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

function extrairIdYoutube(url) {
  const match = String(url || "").match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function urlEmbedYoutube(url) {
  const id = extrairIdYoutube(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

// mysql2 devolve colunas DATE como Date em horario local da meia-noite.
// Usar toISOString() converte pra UTC e pode "voltar" um dia dependendo
// do fuso do servidor - por isso lemos ano/mes/dia locais na mao aqui,
// em vez de deixar o toISOString() reinterpretar o fuso.
function formatarDataLocal(data) {
  const dataObj = data instanceof Date ? data : new Date(data);
  const ano = dataObj.getFullYear();
  const mes = String(dataObj.getMonth() + 1).padStart(2, "0");
  const dia = String(dataObj.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// A descricao guarda "Titulo - Detalhe" nos cronogramas gerados; na
// celula da grade so cabe o titulo.
function tituloDaDescricao(descricao) {
  return String(descricao || "").split(" - ")[0];
}

function planoAulaParaGrade(planoAula) {
  return {
    data: formatarDataLocal(planoAula.data_atual),
    horaInicio: planoAula.hora_inicio,
    horaFim: planoAula.hora_fim,
    materia: planoAula.materia,
    atividade: planoAula.objetivos,
    tipoAtividade: "aula",
  };
}

const CORES_PRIORIDADE = Object.freeze({
  baixa: "#10B981",
  media: "#F59E0B",
  alta: "#EF4444",
});

// Sem sessao/flash no projeto, o retorno das acoes de cronograma vem por
// query string. Antes toda falha era so console.error + redirect, e o
// aluno nao tinha como saber se o cronograma foi gerado ou nao.
const AVISOS_PLANO_ESTUDO = Object.freeze({
  erro: {
    premium: "Gerar e regerar cronograma é exclusivo para assinantes premium.",
    ia: "Não deu pra gerar o cronograma com a IA agora. Tente de novo em alguns instantes.",
    manual: "Não foi possível salvar o cronograma. Confira se todos os eventos têm título, data e horários.",
    regerar: "Não foi possível regerar a rotina da semana. Tente de novo.",
  },
  ok: {
    regerar: "Rotina da semana regerada.",
  },
});

function avisoDaQuery(query) {
  if (query.erro && AVISOS_PLANO_ESTUDO.erro[query.erro]) {
    return { tipo: "erro", texto: AVISOS_PLANO_ESTUDO.erro[query.erro] };
  }
  if (query.ok && AVISOS_PLANO_ESTUDO.ok[query.ok]) {
    return { tipo: "ok", texto: AVISOS_PLANO_ESTUDO.ok[query.ok] };
  }
  return null;
}

// Mesmo problema que o /planoestudo tinha: as rotas do professor so
// faziam console.error + redirect quando a geracao falhava (cota da IA
// estourada, professor sem materia, etc), entao a tela ficava igual
// tivesse dado certo ou nao - o professor nao tinha como saber.
const AVISOS_CRONOGRAMA_PROFESSOR = Object.freeze({
  erro: {
    ia: "Não deu pra gerar o cronograma com a IA agora (a cota diária pode ter estourado). Tente de novo em alguns instantes, ou monte na mão.",
    manual: "Não foi possível salvar o cronograma. Confira se todos os eventos têm título, data e horários.",
    materia: "Você precisa ter uma matéria cadastrada no seu perfil para gerar um cronograma.",
  },
});

function avisoCronogramaProfessorDaQuery(query) {
  if (query.erro && AVISOS_CRONOGRAMA_PROFESSOR.erro[query.erro]) {
    return { tipo: "erro", texto: AVISOS_CRONOGRAMA_PROFESSOR.erro[query.erro] };
  }
  return null;
}

// As acoes de prioridade/concluido sao usadas tanto na lista generica
// (/planoestudo) quanto dentro de um cronograma gerado especifico
// (/planoestudo/:codigoLote) - o formulario manda de volta pra onde
// veio via campo oculto. So aceita caminho comecando com /planoestudo
// (prefixo fixo, nao vem de fora) pra nunca virar open redirect.
function voltarSeguro(valor) {
  return typeof valor === "string" && valor.startsWith("/planoestudo") ? valor : "/planoestudo";
}

// Detecta rotina generica desatualizada em relacao ao status premium
// atual do aluno: itens de quem ja foi premium um dia (ou de antes da
// restricao existir) podem ter ficado com exercicios/simulado mesmo
// sendo gratuito agora; e o inverso, premium com uma rotina antiga de
// quando ainda era gratuito nunca ganha exercicios/simulado sozinho. O
// simulado e sempre gerado 1x (ultimo bloco de sexta) quando premium,
// entao a presenca/ausencia dele e um jeito confiavel de notar isso sem
// precisar guardar "versao da rotina" em coluna nenhuma.
function rotinaDesatualizada(itens, ehPremium) {
  if (itens.length === 0) return false;
  const temSimulado = itens.some((item) => item.tipo_atividade === "simulado");
  return ehPremium ? !temSimulado : temSimulado;
}

// Rotina padrao do aluno: 6 blocos por dia util (manha 08-11 e tarde
// 14-17), com as materias rodiziando. Aluno premium tem o tipo de
// atividade variando entre estudo, exercicios, revisao e um simulado no
// fim da sexta; exercicios/simulado sao premium, entao o gratuito recebe
// so estudo/revisao.
async function semearCronogramaGenerico(idAluno, ehPremium) {
  const materias = await Models.materias.listarAtivas();
  const diasUteis = CronogramaService.proximosDiasUteis(5);
  const rotina = CronogramaService.gerarRotinaGenerica(materias, diasUteis, ehPremium);

  for (const item of rotina) {
    await Models.planoEstudo.criarItem({
      idAluno,
      idMateria: item.idMateria,
      horaAula: item.horaInicio,
      horaFim: item.horaFim,
      dataInicio: item.data,
      dataFim: item.data,
      descricao: item.descricao,
      tipoAtividade: item.tipoAtividade,
    });
  }

  return rotina.length;
}

function planoEstudoParaGrade(item) {
  const ehGerado = !!item.codigo_lote;

  return {
    data: formatarDataLocal(item.data_inicio),
    horaInicio: item.hora_aula,
    horaFim: item.hora_fim,
    materia: item.materia,
    // Item generico mostra so o tipo ("Exercícios"); item gerado por
    // IA/mao mostra o titulo que veio junto.
    atividade: ehGerado ? tituloDaDescricao(item.descricao) : null,
    tipoAtividade: item.tipo_atividade || "estudo",
    corPrioridade: item.corPrioridade,
    concluido: !!item.concluido,
    idCronograma: item.id_cronograma,
  };
}

async function determinarOrigemContato(email) {
  const usuario = await Models.usuarios.buscarPorEmail(email);

  if (!usuario) return "Futuro parceiro";
  if (usuario.tipo_usuario === TIPOS_USUARIO.aluno) return "aluno";
  if (usuario.tipo_usuario === TIPOS_USUARIO.professor) return "professor";
  return usuario.tipo_usuario;
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
  // senha salva criptografada no banco com Hash
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

// ── COOKIE ASSINADO ─────────────────────────────────────────
const crypto = require("crypto");

if (!process.env.COOKIE_SECRET) {
  throw new Error("COOKIE_SECRET não está definido no .env");
}

function criarCookieUsuario(res, usuario) {
  const json = JSON.stringify({ id: usuario.id, tipo_usuario: usuario.tipo_usuario });
  const dados = Buffer.from(json).toString("base64url");
  const assinatura = crypto
    .createHmac("sha256", process.env.COOKIE_SECRET)
    .update(dados)
    .digest("base64url");

  res.setHeader(
    "Set-Cookie",
    `primia_usuario=${dados}.${assinatura}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
  );
}

function limparCookieUsuario(res) {
  res.setHeader(
    "Set-Cookie",
    "primia_usuario=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
  );
}

function lerCookieUsuario(req) {
  const raw = req.headers.cookie || "";
  const cookie = raw.split(";").map((c) => c.trim()).find((c) => c.startsWith("primia_usuario="));
  if (!cookie) return null;

  const valor = cookie.slice("primia_usuario=".length);
  const ponto = valor.lastIndexOf(".");
  if (ponto === -1) return null;

  const dados = valor.slice(0, ponto);
  const assinaturaRecebida = valor.slice(ponto + 1);

  const assinaturaEsperada = crypto
    .createHmac("sha256", process.env.COOKIE_SECRET)
    .update(dados)
    .digest("base64url");

  // timingSafeEqual evita timing attacks — os buffers precisam ter o mesmo tamanho
  let valido = false;
  try {
    valido = crypto.timingSafeEqual(
      Buffer.from(assinaturaRecebida),
      Buffer.from(assinaturaEsperada)
    );
  } catch {
    return null; // tamanhos diferentes = assinatura inválida
  }

  if (!valido) return null;

  try {
    return JSON.parse(Buffer.from(dados, "base64url").toString("utf8"));
  } catch {
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

function mapearPermissoesDuvida(duvida, contexto = {}) {
  const { tipoUsuario = null, idUsuario = null, idMateriaProfessor = null } = contexto;

  return {
    ...duvida,
    podeExcluirComoAluno:
      tipoUsuario === TIPOS_USUARIO.aluno && Number(duvida.id_aluno) === Number(idUsuario),
    podeExcluirComoProfessor: tipoUsuario === TIPOS_USUARIO.professor,
    podeResponderComoProfessor:
      tipoUsuario === TIPOS_USUARIO.professor &&
      Number(idMateriaProfessor) === Number(duvida.id_materia),
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
    return null;
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
    return null;
  }
}

function somenteAdmin(req, res, next) {
  const usuario = lerCookieUsuario(req);

  if (!usuario) {
    return res.redirect("/login");
  }

  if (usuario.tipo_usuario !== TIPOS_USUARIO.admin) {
    return res.status(403).redirect("/login");
  }

  return next();
}

async function carregarNotificacoes(req, res, next) {
  const usuario = lerCookieUsuario(req);
  const paginasSemprePublicas = new Set([
    "/",
    "/telainicial",
    "/login",
    "/loginprofessor",
    "/cadastro",
    "/cadastroprofessor",
    "/logincadastro",
    "/naotemumaconta",
  ]);
  const paginasMistas = new Set([
    "/sobre",
    "/contato",
    "/termopriva",
    "/termouso",
  ]);

  res.locals.emPaginaPublica =
    paginasSemprePublicas.has(req.path) || (!usuario && paginasMistas.has(req.path));
  res.locals.usuarioHeader = usuario;
  res.locals.rotaInicioHeader = res.locals.emPaginaPublica
    ? "/telainicial"
    : rotaInicialPorTipoUsuario(usuario?.tipo_usuario);

  res.locals.notificacoes = [];
  res.locals.totalNotificacoesNaoLidas = 0;

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

router.get("/areapremium", function (req, res) {
  res.render("pages/areapremium");
});

router.get("/admin", somenteAdmin, async function (req, res) {
  // Futuramente trocar AdminDashboardMock por Models.admin (adminModel.js),
  // que ja expoe buscarMetricasDashboard com os mesmos nomes de campo.
  const [metricas, grafico, pendencias] = await Promise.all([
    AdminDashboardMock.buscarMetricas(),
    AdminDashboardMock.buscarGraficoCrescimento(),
    AdminDashboardMock.buscarPendencias(),
  ]);

  res.render("pages/admin/dashboard", {
    activeAdminPage: "dashboard",
    metricas,
    grafico,
    pendencias,
  });
});

router.get("/admin/dashboard", somenteAdmin, function (req, res) {
  res.redirect("/admin");
});

router.get("/admin/usuarios", somenteAdmin, function (req, res) {
  res.render("pages/admin/usuarios", { activeAdminPage: "usuarios" });
});

router.get("/admin/conteudos", somenteAdmin, function (req, res) {
  res.render("pages/admin/conteudos", { activeAdminPage: "conteudos" });
});

router.get("/admin/suporte", somenteAdmin, function (req, res) {
  res.render("pages/admin/suporte", { activeAdminPage: "suporte" });
});

router.get("/admin/relatorios", somenteAdmin, function (req, res) {
  res.render("pages/admin/relatorios", { activeAdminPage: "relatorios" });
});

router.get("/admin/configuracoes", somenteAdmin, function (req, res) {
  res.render("pages/admin/configuracoes", { activeAdminPage: "configuracoes" });
});


router.get("/telainicial", function (req, res) {
  res.render("pages/telainicial");
});

router.get("/logout", function (req, res) {
  usuarioLogadoSimulado = null;
  limparCookieUsuario(res);
  res.redirect("/telainicial");
});

router.get("/contato", function (req, res) {
  res.render("pages/contato", { msgSucesso: null, msgErro: {}, valores: {} });
});

router.post(
  "/contato",
  body("nome").trim().notEmpty().withMessage("O nome e obrigatorio."),
  body("email").trim().notEmpty().withMessage("O e-mail e obrigatorio.").isEmail().withMessage("Digite um e-mail valido."),
  body("mensagem").trim().notEmpty().withMessage("Escreva uma mensagem antes de enviar."),
  async function (req, res) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const { msgErro } = montarErrosValidacao(errors);
      return res.render("pages/contato", { msgSucesso: null, msgErro, valores: req.body });
    }

    const { nome, email, assunto, mensagem } = req.body;
    const usuarioCookie = lerCookieUsuario(req);
    const origem = await determinarOrigemContato(email);

    try {
      await Models.contato.criar({
        usuarioId: usuarioCookie?.id || null,
        nome,
        email,
        assunto,
        mensagem,
        origem,
      });
    } catch (erro) {
      console.error("Erro ao salvar mensagem de contato:", erro);
      return res.render("pages/contato", {
        msgSucesso: null,
        msgErro: { geral: "Nao foi possivel enviar sua mensagem agora. Tente novamente." },
        valores: req.body,
      });
    }

    try {
      await MailService.enviarNotificacaoContato({ nome, email, assunto, mensagem, origem });
    } catch (erro) {
      console.error("Mensagem de contato salva, mas o e-mail de notificacao falhou:", erro);
    }

    return res.render("pages/contato", {
      msgSucesso: "Mensagem enviada com sucesso! Em breve entraremos em contato.",
      msgErro: {},
      valores: {},
    });
  }
);

router.get("/contatoprofessor", function (req, res) {
  res.render("pages/contatoprofessor", { msgSucesso: null, msgErro: {}, valores: {} });
});

router.post(
  "/contatoprofessor",
  body("nome").trim().notEmpty().withMessage("O nome e obrigatorio."),
  body("email").trim().notEmpty().withMessage("O e-mail e obrigatorio.").isEmail().withMessage("Digite um e-mail valido."),
  body("mensagem").trim().notEmpty().withMessage("Escreva uma mensagem antes de enviar."),
  async function (req, res) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const { msgErro } = montarErrosValidacao(errors);
      return res.render("pages/contatoprofessor", { msgSucesso: null, msgErro, valores: req.body });
    }

    const { nome, email, assunto, mensagem } = req.body;
    const usuarioCookie = lerCookieUsuario(req);
    const origem = await determinarOrigemContato(email);

    try {
      await Models.contato.criar({
        usuarioId: usuarioCookie?.id || null,
        nome,
        email,
        assunto,
        mensagem,
        origem,
      });
    } catch (erro) {
      console.error("Erro ao salvar mensagem de contato (professor):", erro);
      return res.render("pages/contatoprofessor", {
        msgSucesso: null,
        msgErro: { geral: "Nao foi possivel enviar sua mensagem agora. Tente novamente." },
        valores: req.body,
      });
    }

    try {
      await MailService.enviarNotificacaoContato({ nome, email, assunto, mensagem, origem });
    } catch (erro) {
      console.error("Mensagem de contato salva, mas o e-mail de notificacao falhou:", erro);
    }

    return res.render("pages/contatoprofessor", {
      msgSucesso: "Mensagem enviada com sucesso! Em breve entraremos em contato.",
      msgErro: {},
      valores: {},
    });
  }
);



router.get("/video", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const usuario = await buscarPerfilLogado(req, TIPOS_USUARIO.aluno);

  if (!usuario) {
    return res.redirect("/login");
  }

  const [materias, videosBase] = await Promise.all([
    Models.materias.listarAtivas(),
    Models.conteudos.listarPublicadosPorTipo("video"),
  ]);

  res.render("pages/video", {
    usuario,
    materias: materias.map((materia) => ({
      ...materia,
      slug: slugMateria(materia.nome),
    })),
    videos: videosBase.map((video) => ({
      ...video,
      materiaSlug: slugMateria(video.materia),
    })),
  });
});

router.get("/videoaula/:id", async function (req, res) {
  const aluno = usuarioAutenticado(req, TIPOS_USUARIO.aluno);
  const professor = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!aluno && !professor) {
    return res.redirect("/login");
  }

  const tipoUsuario = aluno
    ? TIPOS_USUARIO.aluno
    : TIPOS_USUARIO.professor;

  const usuario = await buscarPerfilLogado(req, tipoUsuario);

  if (!usuario) {
    return res.redirect("/login");
  }

  const video = await Models.conteudos.buscarPorId(req.params.id);

  if (!video || video.tipo !== "video") {
    return res.redirect("/video");
  }

  res.render("pages/videoaula", {
    video,
    usuario,
    urlEmbed: urlEmbedYoutube(video.arquivo_url),
  });
});

router.get("/cronograma", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const cronogramas = await Models.planoAula.listarCronogramasPublicados();

  res.render("pages/cronograma", { cronogramas });
});

router.get("/cronograma/:codigoLote", async function (req, res) {
  const usuarioAluno = usuarioAutenticado(req, TIPOS_USUARIO.aluno);
  const usuarioProfessor = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioAluno && !usuarioProfessor) {
    return res.redirect("/login");
  }

  const eventos = await Models.planoAula.listarEventosPorLote(req.params.codigoLote);

  if (eventos.length === 0) {
    return res.redirect(usuarioProfessor ? "/cronogramaprofessor" : "/cronograma");
  }

  res.render("pages/cronogramaDetalhe", {
    titulo: eventos[0].titulo_cronograma,
    materia: eventos[0].materia,
    professor: eventos[0].professor,
    grade: CronogramaService.montarGrade(eventos.map(planoAulaParaGrade)),
    rotaVolta: usuarioProfessor ? "/cronogramaprofessor" : "/cronograma",
    ehProfessor: !!usuarioProfessor,
    ehProprio: false,
  });
});



async function anexarStatusResposta(formularios, idAluno) {
  const resultado = [];

  for (const formulario of formularios) {
    const respostas = await Models.formularios.listarRespostas(formulario.id_formulario, idAluno);
    resultado.push({ ...formulario, respondido: respostas.length > 0 });
  }

  return resultado;
}

router.get("/areadosimulado", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const [materias, meusFormulariosBase, publicadosBase] = await Promise.all([
    Models.materias.listarAtivas(),
    Models.formularios.listarPorAluno(usuarioBase.id),
    Models.formularios.listarPublicadosPremium(),
  ]);

  const meusFormularios = (await anexarStatusResposta(meusFormulariosBase, usuarioBase.id)).map(
    (formulario) => ({ ...formulario, origem: "Gerado por voce" })
  );
  const publicados = (await anexarStatusResposta(publicadosBase, usuarioBase.id)).map(
    (formulario) => ({ ...formulario, origem: `Professor ${formulario.professor || ""}`.trim() })
  );

  const todos = [...meusFormularios, ...publicados];

  res.render("pages/areadosimulado", {
    materias,
    emAndamento: todos.filter((formulario) => !formulario.respondido),
    finalizados: todos.filter((formulario) => formulario.respondido),
    msgErro: null,
  });
});

router.post(
  "/areadosimulado/gerar",
  body("tema").trim().notEmpty().withMessage("Descreva o tema do simulado."),
  async function (req, res) {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const { tema, materia_id, quantidade, dificuldade } = req.body;

    try {
      const materia = materia_id ? await Models.materias.buscarPorId(materia_id) : null;

      const formularioGerado = await IaService.gerarSimulado({
        tema,
        materia: materia?.nome,
        quantidade,
        dificuldade,
      });

      const idFormulario = await Models.formularios.criar({
        idAluno: usuarioBase.id,
        idMateria: materia_id || null,
        titulo: tema,
        schemaJson: formularioGerado,
        geradoPorIa: true,
      });

      return res.redirect(`/simulado/${idFormulario}`);
    } catch (erro) {
      console.error("Erro ao gerar simulado:", erro);
      return res.redirect("/areadosimulado");
    }
  }
);

router.get("/simulado/:id", async function (req, res) {
  const usuarioAluno = usuarioAutenticado(req, TIPOS_USUARIO.aluno);
  const usuarioProfessor = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioAluno && !usuarioProfessor) {
    return res.redirect("/login");
  }

  const formulario = await Models.formularios.buscarPorId(req.params.id);

  if (!formulario) {
    return res.redirect(usuarioProfessor ? "/simuladoprofessor" : "/areadosimulado");
  }

  if (usuarioProfessor) {
    return res.render("pages/simulado", {
      formulario,
      modoPreview: true,
      respostas: null,
    });
  }

  const respostas = await Models.formularios.listarRespostas(formulario.id_formulario, usuarioAluno.id);
  const respostasPorPergunta = Object.fromEntries(respostas.map((r) => [r.pergunta_ref, r]));

  res.render("pages/simulado", {
    formulario,
    modoPreview: false,
    respostas: respostas.length > 0 ? respostasPorPergunta : null,
  });
});

router.post("/simulado/:id/responder", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const formulario = await Models.formularios.buscarPorId(req.params.id);

  if (!formulario) {
    return res.redirect("/areadosimulado");
  }

  const jaRespondeu = await Models.formularios.listarRespostas(formulario.id_formulario, usuarioBase.id);
  if (jaRespondeu.length > 0) {
    return res.redirect(`/simulado/${formulario.id_formulario}`);
  }

  const perguntas = formulario.schema_json?.perguntas || [];
  let acertos = 0;

  for (const pergunta of perguntas) {
    const indiceEscolhido = Number(req.body[`resposta_${pergunta.id}`]);
    const respostaTexto = pergunta.alternativas[indiceEscolhido] ?? null;
    const correta = indiceEscolhido === pergunta.correta;
    if (correta) acertos += 1;

    await Models.formularios.salvarResposta({
      idFormulario: formulario.id_formulario,
      idAluno: usuarioBase.id,
      perguntaRef: pergunta.id,
      respostaAluno: respostaTexto,
      correta,
    });
  }

  if (formulario.id_professor) {
    try {
      const aluno = await Models.alunos.buscarPerfilCompleto(usuarioBase.id);
      await Models.notificacoes.criar({
        idUsuario: formulario.id_professor,
        tipo: "sistema",
        titulo: "Aluno respondeu seu simulado",
        mensagem: `${aluno?.nome || "Um aluno"} respondeu ao simulado "${formulario.titulo}" (${acertos}/${perguntas.length} corretas).`,
        link: `/simulado/${formulario.id_formulario}`,
      });
    } catch (erro) {
      console.error("Erro ao notificar professor sobre resposta de simulado:", erro);
    }
  }

  return res.redirect(`/simulado/${formulario.id_formulario}`);
});


router.get("/cadastroprofessor", function (req, res) {
  renderizarCadastroProfessor(res);
});

router.get("/partepremium", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const usuario = await buscarPerfilLogado(req, TIPOS_USUARIO.aluno);

  if (!usuario) {
    return res.redirect("/login");
  }

  res.render("pages/partepremium", { usuario });
});


router.get("/biblioteca", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const [materias, livrosBase] = await Promise.all([
    Models.materias.listarAtivas(),
    Models.conteudos.listarPublicadosPorTipo("livro"),
  ]);

  res.render("pages/biblioteca", {
    materias: materias.map((materia) => ({ ...materia, slug: slugMateria(materia.nome) })),
    livros: livrosBase.map((livro) => ({ ...livro, materiaSlug: slugMateria(livro.materia) })),
  });
});


router.get("/simuladoprofessor", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const meusFormularios = await Models.formularios.listarPorProfessor(usuarioBase.id);

  res.render("pages/simuladoprofessor", { meusFormularios });
});

router.post(
  "/simuladoprofessor/gerar",
  body("tema").trim().notEmpty().withMessage("Descreva o tema do simulado."),
  async function (req, res) {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const { tema, quantidade, dificuldade } = req.body;

    try {
      const professor = await Models.professores.buscarPerfilCompleto(usuarioBase.id);
      if (!professor?.id_materia) {
        throw new Error("Professor sem materia cadastrada.");
      }

      const formularioGerado = await IaService.gerarSimulado({
        tema,
        materia: professor.materia,
        quantidade,
        dificuldade,
      });

      const idFormulario = await Models.formularios.criar({
        idProfessor: usuarioBase.id,
        idMateria: professor.id_materia,
        titulo: tema,
        schemaJson: formularioGerado,
        geradoPorIa: true,
      });

      return res.redirect(`/simulado/${idFormulario}`);
    } catch (erro) {
      console.error("Erro ao gerar simulado (professor):", erro);
      return res.redirect("/simuladoprofessor");
    }
  }
);

router.post(
  "/simuladoprofessor/manual",
  body("titulo").trim().notEmpty().withMessage("Informe um titulo para o simulado."),
  async function (req, res) {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const { titulo } = req.body;
    const perguntasBrutas = Array.isArray(req.body.perguntas) ? req.body.perguntas : [];

    try {
      const professor = await Models.professores.buscarPerfilCompleto(usuarioBase.id);
      if (!professor?.id_materia) {
        throw new Error("Professor sem materia cadastrada.");
      }

      const perguntasNormalizadas = perguntasBrutas.map((pergunta) => ({
        enunciado: pergunta?.enunciado,
        alternativas: Array.isArray(pergunta?.alternativas)
          ? pergunta.alternativas.filter((alternativa) => String(alternativa || "").trim())
          : [],
        correta: Number(pergunta?.correta),
        explicacao: pergunta?.explicacao,
      }));

      const formularioValidado = IaService.validarFormulario(
        { perguntas: perguntasNormalizadas },
        perguntasNormalizadas.length
      );

      const idFormulario = await Models.formularios.criar({
        idProfessor: usuarioBase.id,
        idMateria: professor.id_materia,
        titulo,
        schemaJson: formularioValidado,
        geradoPorIa: false,
      });

      return res.redirect(`/simulado/${idFormulario}`);
    } catch (erro) {
      console.error("Erro ao salvar simulado montado manualmente:", erro);
      return res.redirect("/simuladoprofessor");
    }
  }
);

router.get("/videoaulaprofessor", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const [professor, materiasBase, videosBase] = await Promise.all([
    Models.professores.buscarPerfilCompleto(usuarioBase.id),
    Models.materias.listarAtivas(),
    Models.conteudos.listarPublicadosPorTipo("video"),
  ]);

  const materiaParaAdicionar = professor?.id_materia
    ? [{ id_materia: professor.id_materia, nome: professor.materia }]
    : [];

  res.render("pages/videoaulaprofessor", {
    materias: materiasBase.map((materia) => ({ ...materia, slug: slugMateria(materia.nome) })),
    materiaParaAdicionar,
    videos: videosBase.map((video) => ({ ...video, materiaSlug: slugMateria(video.materia) })),
  });
});

router.get("/cronogramaprofessor", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const meusCronogramas = await Models.planoAula.listarCronogramasPorProfessor(usuarioBase.id);

  res.render("pages/cronogramaprofessor", {
    meusCronogramas,
    aviso: avisoCronogramaProfessorDaQuery(req.query),
  });
});

router.post(
  "/cronogramaprofessor/gerar",
  body("tema").trim().notEmpty().withMessage("Descreva o tema do cronograma."),
  async function (req, res) {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const { tema, tipo, data_inicio, quantidade } = req.body;

    try {
      const professor = await Models.professores.buscarPerfilCompleto(usuarioBase.id);
      if (!professor?.id_materia) {
        return res.redirect("/cronogramaprofessor?erro=materia");
      }

      const cronogramaGerado = await IaService.gerarCronograma({
        materia: professor.materia,
        tema,
        tipo,
        dataInicio: data_inicio,
        quantidade,
      });

      const { codigoLote } = await Models.planoAula.criarEventos(cronogramaGerado.eventos, {
        idProfessor: usuarioBase.id,
        idMateria: professor.id_materia,
        tituloCronograma: tema,
      });

      return res.redirect(`/cronograma/${codigoLote}`);
    } catch (erro) {
      console.error("Erro ao gerar cronograma com IA (professor):", erro);
      return res.redirect("/cronogramaprofessor?erro=ia");
    }
  }
);

router.post(
  "/cronogramaprofessor/gerar-manual",
  body("titulo").trim().notEmpty().withMessage("De um titulo para o cronograma."),
  async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const { titulo } = req.body;
  const eventosBrutos = Array.isArray(req.body.eventos) ? req.body.eventos : [];

  try {
    const professor = await Models.professores.buscarPerfilCompleto(usuarioBase.id);
    if (!professor?.id_materia) {
      return res.redirect("/cronogramaprofessor?erro=materia");
    }

    const eventosNormalizados = eventosBrutos.map((evento) => ({
      titulo: evento?.titulo,
      descricao: evento?.descricao,
      data: evento?.data,
      hora_inicio: evento?.hora_inicio,
      hora_fim: evento?.hora_fim,
    }));

    const cronogramaValidado = IaService.validarCronograma({ eventos: eventosNormalizados });

    const { codigoLote } = await Models.planoAula.criarEventos(cronogramaValidado.eventos, {
      idProfessor: usuarioBase.id,
      idMateria: professor.id_materia,
      tituloCronograma: titulo,
    });

    return res.redirect(`/cronograma/${codigoLote}`);
  } catch (erro) {
    console.error("Erro ao salvar cronograma manual (professor):", erro);
    return res.redirect("/cronogramaprofessor?erro=manual");
  }
  }
);



router.get("/bibliotecaprofessor", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const [professor, materiasBase, livrosBase] = await Promise.all([
    Models.professores.buscarPerfilCompleto(usuarioBase.id),
    Models.materias.listarAtivas(),
    Models.conteudos.listarPublicadosPorTipo("livro"),
  ]);

  const materiaParaAdicionar = professor?.id_materia
    ? [{ id_materia: professor.id_materia, nome: professor.materia }]
    : [];

  res.render("pages/bibliotecaprofessor", {
    materias: materiasBase.map((materia) => ({ ...materia, slug: slugMateria(materia.nome) })),
    materiaParaAdicionar,
    livros: livrosBase.map((livro) => ({ ...livro, materiaSlug: slugMateria(livro.materia) })),
  });
});

router.post(
  "/professor/conteudos/gerar-sinopse",
  uploadConteudo.fields([{ name: "arquivo", maxCount: 1 }]),
  async function (req, res) {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

    if (!usuarioBase) {
      return res.status(401).json({ erro: "Nao autenticado." });
    }

    const { tipo, titulo, autor, materia_id, url_video } = req.body;

    try {
      const professor = await Models.professores.buscarPerfilCompleto(usuarioBase.id);
      if (!professor?.id_materia) {
        return res.status(400).json({ erro: "Voce nao tem uma materia cadastrada." });
      }
      const materiaId = professor.id_materia;

      const materia = materiaId ? await Models.materias.buscarPorId(materiaId) : null;

      let sinopse;

      if (tipo === "video") {
        if (!url_video) {
          return res.status(400).json({ erro: "Informe o link do video antes de gerar a sinopse." });
        }
        sinopse = await IaService.gerarSinopseVideo({
          titulo,
          materia: materia?.nome,
          urlYoutube: url_video,
        });
      } else {
        const arquivoFile = req.files?.arquivo?.[0];
        const textoConteudo = arquivoFile
          ? await IaService.extrairTextoPdf(arquivoFile.buffer)
          : undefined;

        sinopse = await IaService.gerarSinopse({
          titulo,
          autor,
          materia: materia?.nome,
          textoConteudo,
        });
      }

      return res.json({ sinopse });
    } catch (erro) {
      console.error("Erro ao gerar sinopse com IA:", erro);
      return res.status(500).json({ erro: "Nao foi possivel gerar a sinopse agora." });
    }
  }
);

router.post(
  "/professor/conteudos",
  uploadConteudo.fields([
    { name: "arquivo", maxCount: 1 },
    { name: "capa", maxCount: 1 },
  ]),
  async function (req, res) {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const { tipo, titulo, autor, materia_id, descricao, url_video, is_premium, destaque } = req.body;
    const rotaVolta = tipo === "video" ? "/videoaulaprofessor" : "/bibliotecaprofessor";

    try {
      const professor = await Models.professores.buscarPerfilCompleto(usuarioBase.id);
      if (!professor?.id_materia) {
        throw new Error("Professor sem materia cadastrada.");
      }
      const materiaId = professor.id_materia;

      let arquivoUrl = null;

      if (tipo === "video") {
        arquivoUrl = url_video;
      } else {
        const arquivoFile = req.files?.arquivo?.[0];
        if (!arquivoFile) {
          throw new Error("Arquivo do livro (PDF) e obrigatorio.");
        }
        arquivoUrl = await UploadService.enviarArquivo(arquivoFile.buffer, "primia/conteudos");
      }

      const capaFile = req.files?.capa?.[0];
      const imagemUrl = capaFile
        ? await UploadService.enviarImagem(capaFile.buffer, "primia/capas")
        : null;

      await Models.conteudos.criar({
        titulo,
        autor,
        descricao,
        tipo,
        materiaId,
        professorId: usuarioBase.id,
        arquivoUrl,
        imagemUrl,
        isPremium: !!is_premium,
        destaque: !!destaque,
        status: "publicado",
      });

      return res.redirect(rotaVolta);
    } catch (erro) {
      console.error("Erro ao cadastrar conteudo:", erro);
      return res.redirect(rotaVolta);
    }
  }
);


router.get("/livro/:id", async function (req, res) {
  const aluno = usuarioAutenticado(req, TIPOS_USUARIO.aluno);
  const professor = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!aluno && !professor) {
    return res.redirect("/login");
  }

  const tipoUsuario = aluno
    ? TIPOS_USUARIO.aluno
    : TIPOS_USUARIO.professor;

  const usuario = await buscarPerfilLogado(req, tipoUsuario);

  if (!usuario) {
    return res.redirect("/login");
  }

  const livro = await Models.conteudos.buscarPorId(req.params.id);

  if (!livro || livro.tipo !== "livro") {
    return res.redirect("/biblioteca");
  }

  res.render("pages/livro", {
    livro,
    usuario,
  });
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
      duvidas: duvidas
        .map(formatarDuvida)
        .map((duvida) =>
          mapearPermissoesDuvida(duvida, {
            tipoUsuario: TIPOS_USUARIO.aluno,
            idUsuario: usuarioBase.id,
          })
        ),
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
    const duvidasBase = await Models.duvidas.listar();
    const duvidas = await anexarRespostasNasDuvidas(duvidasBase);

    return res.render("pages/forumprofessor", {
      professor,
      materias,
      duvidas: duvidas
        .map(formatarDuvida)
        .map((duvida) =>
          mapearPermissoesDuvida(duvida, {
            tipoUsuario: TIPOS_USUARIO.professor,
            idUsuario: usuarioBase.id,
            idMateriaProfessor: professor?.id_materia,
          })
        ),
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

router.post("/forumprofessor/duvidas/:id/excluir", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    await Models.respostas.excluirPorDuvida(req.params.id, conexao);
    await Models.duvidas.excluirPorId(req.params.id, conexao);

    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    console.error("Erro ao excluir duvida pelo professor:", erro);
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
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const usuario = await buscarPerfilLogado(req, TIPOS_USUARIO.professor);

  if (!usuario) {
    return res.redirect("/login");
  }

  res.render("pages/entradaprofessor", { usuario });
});

router.get("/planoestudo", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const ehPremium = await Models.assinaturas.estaAtiva(usuarioBase.id);
  let itens = await Models.planoEstudo.listarPorAluno(usuarioBase.id);

  if (itens.length === 0 || rotinaDesatualizada(itens, ehPremium)) {
    // So apaga se ja existiam itens (senao apagarGenericosDoAluno seria
    // uma query a toa) - e nunca mexe nos cronogramas com codigo_lote,
    // aqueles sao gerados a parte e intocados por essa limpeza.
    if (itens.length > 0) {
      await Models.planoEstudo.apagarGenericosDoAluno(usuarioBase.id);
    }
    await semearCronogramaGenerico(usuarioBase.id, ehPremium);
    itens = await Models.planoEstudo.listarPorAluno(usuarioBase.id);
  }

  const itensComEvento = itens.map((item) => ({
    ...item,
    corPrioridade: CORES_PRIORIDADE[item.prioridade] || CORES_PRIORIDADE.media,
  }));

  const meusCronogramasGerados = ehPremium
    ? await Models.planoEstudo.listarCronogramasGerados(usuarioBase.id)
    : [];

  res.render("pages/planoestudo", {
    itens: itensComEvento,
    grade: CronogramaService.montarGrade(itensComEvento.map(planoEstudoParaGrade)),
    materias: await Models.materias.listarAtivas(),
    ehPremium,
    meusCronogramasGerados,
    aviso: avisoDaQuery(req.query),
  });
});

// Regera a rotina padrao. Apaga so os itens genericos do proprio aluno
// (os cronogramas gerados por IA/mao tem codigo_lote e nao sao tocados).
router.post("/planoestudo/regerar", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  if (!(await Models.assinaturas.estaAtiva(usuarioBase.id))) {
    return res.redirect("/planoestudo?erro=premium");
  }

  try {
    await Models.planoEstudo.apagarGenericosDoAluno(usuarioBase.id);
    await semearCronogramaGenerico(usuarioBase.id, true);
  } catch (erro) {
    console.error("Erro ao regerar cronograma generico:", erro);
    return res.redirect("/planoestudo?erro=regerar");
  }

  return res.redirect("/planoestudo?ok=regerar");
});

router.get("/planoestudo/:codigoLote", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const eventos = await Models.planoEstudo.listarEventosPorLote(
    req.params.codigoLote,
    usuarioBase.id
  );

  if (eventos.length === 0) {
    return res.redirect("/planoestudo");
  }

  const itensComEvento = eventos.map((item) => ({
    ...item,
    corPrioridade: CORES_PRIORIDADE[item.prioridade] || CORES_PRIORIDADE.media,
  }));

  res.render("pages/cronogramaDetalhe", {
    titulo: eventos[0].titulo_cronograma,
    materia: eventos[0].materia,
    professor: null,
    grade: CronogramaService.montarGrade(itensComEvento.map(planoEstudoParaGrade)),
    rotaVolta: "/planoestudo",
    ehProfessor: false,
    ehProprio: true,
    itens: itensComEvento,
    voltarPara: `/planoestudo/${req.params.codigoLote}`,
  });
});

router.post("/planoestudo/:id/prioridade", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  await Models.planoEstudo.atualizarPrioridade({
    idCronograma: req.params.id,
    idAluno: usuarioBase.id,
    prioridade: req.body.prioridade,
  });

  return res.redirect(voltarSeguro(req.body.voltar));
});

router.post("/planoestudo/:id/concluido", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  await Models.planoEstudo.atualizarConcluido({
    idCronograma: req.params.id,
    idAluno: usuarioBase.id,
    concluido: req.body.concluido === "1",
  });

  return res.redirect(voltarSeguro(req.body.voltar));
});

router.post(
  "/planoestudo/criar",
  body("materia_id").notEmpty().withMessage("Escolha uma materia."),
  body("descricao").trim().notEmpty().withMessage("Descreva o item."),
  async function (req, res) {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const { materia_id, descricao, data_inicio, data_fim } = req.body;

    try {
      await Models.planoEstudo.criarItem({
        idAluno: usuarioBase.id,
        idMateria: materia_id,
        horaAula: "08:00:00",
        dataInicio: data_inicio || new Date(),
        dataFim: data_fim || new Date(),
        descricao,
      });
    } catch (erro) {
      console.error("Erro ao criar item de plano de estudo:", erro);
    }

    return res.redirect("/planoestudo");
  }
);

router.post(
  "/planoestudo/gerar",
  body("tema").trim().notEmpty().withMessage("Descreva o tema do cronograma."),
  body("materia_id").notEmpty().withMessage("Escolha uma materia."),
  async function (req, res) {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const ehPremium = await Models.assinaturas.estaAtiva(usuarioBase.id);
    if (!ehPremium) {
      return res.redirect("/planoestudo?erro=premium");
    }

    const { tema, materia_id, tipo, data_inicio, quantidade } = req.body;

    try {
      const materia = await Models.materias.buscarPorId(materia_id);

      const cronogramaGerado = await IaService.gerarCronograma({
        materia: materia?.nome,
        tema,
        tipo,
        dataInicio: data_inicio,
        quantidade,
      });

      const { codigoLote } = await Models.planoEstudo.criarEventos(cronogramaGerado.eventos, {
        idAluno: usuarioBase.id,
        idMateria: materia_id,
        tituloCronograma: tema,
      });

      // Abre direto o cronograma recem-criado, em vez de voltar pra
      // lista e deixar o aluno procurando se deu certo ou nao.
      return res.redirect(`/planoestudo/${codigoLote}`);
    } catch (erro) {
      console.error("Erro ao gerar cronograma com IA (aluno):", erro);
      return res.redirect("/planoestudo?erro=ia");
    }
  }
);

router.post(
  "/planoestudo/gerar-manual",
  body("materia_id").notEmpty().withMessage("Escolha uma materia."),
  body("titulo").trim().notEmpty().withMessage("De um titulo para o cronograma."),
  async function (req, res) {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const ehPremium = await Models.assinaturas.estaAtiva(usuarioBase.id);
    if (!ehPremium) {
      return res.redirect("/planoestudo?erro=premium");
    }

    const { materia_id, titulo } = req.body;
    const eventosBrutos = Array.isArray(req.body.eventos) ? req.body.eventos : [];

    try {
      const eventosNormalizados = eventosBrutos.map((evento) => ({
        titulo: evento?.titulo,
        descricao: evento?.descricao,
        data: evento?.data,
        hora_inicio: evento?.hora_inicio,
        hora_fim: evento?.hora_fim,
      }));

      const cronogramaValidado = IaService.validarCronograma({ eventos: eventosNormalizados });

      const { codigoLote } = await Models.planoEstudo.criarEventos(cronogramaValidado.eventos, {
        idAluno: usuarioBase.id,
        idMateria: materia_id,
        tituloCronograma: titulo,
      });

      return res.redirect(`/planoestudo/${codigoLote}`);
    } catch (erro) {
      console.error("Erro ao salvar cronograma manual (aluno):", erro);
      return res.redirect("/planoestudo?erro=manual");
    }
  }
);

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
      foto_url: usuario.foto_url || "",
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
      foto_url: usuario.foto_url || "",
    },
    erroValidacao: {},
    msgErro: {},
  });
});

router.get("/termopriva", function (req, res) {
  res.render("pages/termopriva");
});

router.get("/entrada", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const usuario = await buscarPerfilLogado(req, TIPOS_USUARIO.aluno);

  if (!usuario) {
    return res.redirect("/login");
  }

  res.render("pages/entrada", { usuario });
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

router.get("/faq", function (req, res) {
  res.render("pages/faq");
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

  uploadConteudo.single("avatar"),

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

      if (req.file) {
        const fotoUrl = await UploadService.enviarImagem(req.file.buffer, "primia/avatares");
        await Models.usuarios.atualizarFoto(
          {
            fotoUrl,
            idUsuario: usuarioBase.id,
          },
          conexao
        );
      }

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

  uploadConteudo.single("avatar"),

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

      if (req.file) {
        const fotoUrl = await UploadService.enviarImagem(req.file.buffer, "primia/avatares");
        await Models.usuarios.atualizarFoto(
          {
            fotoUrl,
            idUsuario: usuarioBase.id,
          },
          conexao
        );
      }

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




module.exports = router;







