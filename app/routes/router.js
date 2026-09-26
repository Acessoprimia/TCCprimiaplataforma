var express = require("express");
var router = express.Router();
const { body, validationResult } = require("express-validator");
const pool = require("../../db");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const Models = require("../models");
const IaService = require("../services/iaService");
const UploadService = require("../services/uploadService");
const MailService = require("../services/mailService");
const CronogramaService = require("../services/cronogramaService");
const PagamentoService = require("../services/pagamentoService");

const uploadDiploma = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    cb(null, ["application/pdf", "image/jpeg", "image/png"].includes(file.mimetype)),
});

const uploadConteudo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const TIPOS_USUARIO = Object.freeze({
  aluno: "aluno",
  professor: "professor",
  admin: "admin",
});

const ROTULOS_STATUS_PAGAMENTO = Object.freeze({
  pendente: { texto: "Pendente", classe: "pendente" },
  aprovado: { texto: "Aprovado", classe: "sucesso" },
  recusado: { texto: "Recusado", classe: "erro" },
  cancelado: { texto: "Cancelado", classe: "erro" },
  estornado: { texto: "Estornado", classe: "erro" },
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
  configuracoes: "pages/configuracoes",
  confirmarEmail: "pages/confirmarEmail",
  recuperarSenha: "pages/recuperarSenha",
  redefinirSenha: "pages/redefinirSenha",
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

// Data + hora em formato BR (dd/mm/aaaa hh:mm) para exibicao. Le os campos
// locais na mao pelo mesmo motivo de formatarDataLocal acima.
function formatarDataHoraLocal(data) {
  const dataObj = data instanceof Date ? data : new Date(data);
  const [ano, mes, dia] = formatarDataLocal(dataObj).split("-");
  const hora = String(dataObj.getHours()).padStart(2, "0");
  const minuto = String(dataObj.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
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
  const diasUteis = CronogramaService.proximosDiasUteis(5, CronogramaService.proximaSegunda());
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

async function renderizarCadastroProfessor(res, valores = VALORES_INICIAIS_CADASTRO_PROFESSOR, msgErro = {}) {
  const materias = await Models.materias.listarAtivas();

  return res.render(VIEWS.cadastroProfessor, {
    erros: null,
    valores,
    retorno: null,
    erroValidacao: {},
    msgErro,
    materias,
  });
}

function renderizarLogin(res, valores = VALORES_INICIAIS_LOGIN, msgErro = {}, aviso = null) {
  return res.render(VIEWS.login, {
    erros: null,
    valores,
    erroValidacao: {},
    msgErro,
    aviso,
  });
}

async function emailJaCadastrado(conexao, email) {
  return Models.usuarios.emailJaCadastrado(email, conexao);
}

function gerarTokenVerificacaoEmail() {
  const token = crypto.randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { token, expiraEm };
}

// Validade curta de proposito: redefinir senha e mais sensivel que confirmar
// e-mail, entao o link vive 1 hora em vez das 24h da confirmacao.
function gerarTokenRedefinicaoSenha() {
  const token = crypto.randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + 60 * 60 * 1000);
  return { token, expiraEm };
}

async function cadastrarUsuarioBase(conexao, { nome, email, senha, tipoUsuario }) {
  const senhaCriptografada = await bcrypt.hash(senha, 10);
  const { token, expiraEm } = gerarTokenVerificacaoEmail();

  // senha salva criptografada no banco com Hash
  const idUsuario = await Models.usuarios.criar(
    {
      nome,
      senhaCriptografada,
      email,
      tipoUsuario,
      status: STATUS_CONTA.ativo,
      tokenVerificacao: token,
      tokenVerificacaoExpira: expiraEm,
    },
    conexao
  );

  return { idUsuario, tokenVerificacaoEmail: token };
}

async function enviarEmailConfirmacaoSeguro({ nome, email, token }) {
  try {
    await MailService.enviarEmailConfirmacao({ nome, email, token });
  } catch (erro) {
    console.error("Erro ao enviar e-mail de confirmacao:", erro);
  }
}

async function enviarEmailRedefinicaoSenhaSeguro({ nome, email, token }) {
  try {
    await MailService.enviarEmailRedefinicaoSenha({ nome, email, token });
  } catch (erro) {
    console.error("Erro ao enviar e-mail de redefinicao de senha:", erro);
  }
}

// Grava no Log_Auditoria o que aluno/professor fez, pro admin consultar em
// /admin/auditoria. Best-effort igual as notificacoes: erro aqui e logado e
// engolido, nunca derruba a acao real do usuario. Recebe a descricao ja
// montada (e nao so o id) porque a linha original costuma estar sendo
// apagada - depois do DELETE nao da mais pra descobrir o que era.
async function registrarAuditoria({
  usuarioBase,
  acao,
  entidade,
  idEntidade = null,
  descricao,
  nomeUsuario = null,
}) {
  try {
    const nome = nomeUsuario || (await Models.usuarios.buscarNomePorId(usuarioBase.id));

    await Models.auditoria.criar({
      idUsuario: usuarioBase.id,
      nomeUsuario: nome || "Conta removida",
      tipoUsuario: usuarioBase.tipo_usuario,
      acao,
      entidade,
      idEntidade,
      descricao,
    });
  } catch (erro) {
    console.error("Erro ao registrar auditoria:", erro);
  }
}

// Atalho pras rotas /admin/...: quem age e o admin logado (somenteAdmin ja
// garantiu que existe cookie valido), nao o usuario que sofreu a acao.
function auditarAdmin(req, dados) {
  return registrarAuditoria({ usuarioBase: lerCookieUsuario(req), ...dados });
}

// Corta textos longos (duvida/resposta) pra caber no VARCHAR(255) da
// descricao sem estourar a coluna.
function resumirTexto(texto, limite = 80) {
  const limpo = String(texto || "").trim().replace(/\s+/g, " ");
  if (!limpo) return "(sem texto)";
  return limpo.length > limite ? `${limpo.slice(0, limite)}...` : limpo;
}

// Exclui a conta e, NA MESMA transacao, troca o nome nas linhas do log de
// auditoria por "Conta removida" - o FK ja zera o id_usuario (ON DELETE SET
// NULL), mas o nome ficaria guardado sem isso. O numero antigo da conta
// fica no texto ("Conta removida (#12)") pra ainda dar pra ligar as linhas
// da mesma pessoa sem mostrar quem ela e. Se qualquer passo falhar,
// nada e apagado e o erro sobe pra rota mostrar a mensagem de sempre.
async function excluirContaAnonimizandoAuditoria(idUsuario) {
  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();
    await Models.auditoria.anonimizarUsuario(idUsuario, conexao);
    await Models.usuarios.excluirConta(idUsuario, conexao);
    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
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


// Quem ja teve premium alguma vez (comprou e expirou, ou teve concedido
// e revogado) vai direto pro checkout de renovacao; quem nunca assinou
// ve a pagina geral de planos primeiro.
async function redirecionarFaltaPremium(idUsuario, res) {
  const jaTevePremium = await Models.assinaturas.jaTevePremium(idUsuario);
  return res.redirect(jaTevePremium ? "/premium/assinar?motivo=expirado" : "/areapremium");
}

function usuarioAutenticado(req, tipoUsuario) {
  const usuarioBase = lerCookieUsuario(req);

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

  if (tipoUsuario === TIPOS_USUARIO.admin) {
    return {
      nome: "Administrador",
      email: "admin@primia.com",
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

// Quem desligou "perfil publico" em Configuracoes > Privacidade aparece
// anonimo pros outros no forum. O id continua vindo do banco, entao as
// permissoes (excluir a propria duvida, etc.) seguem funcionando - so o
// nome exibido muda. O painel admin usa outras queries e continua vendo
// o nome real pra moderacao.
function nomeExibidoNoForum(nome, perfilPublico, rotulo) {
  const escondido = perfilPublico === 0 || perfilPublico === false;
  return escondido ? rotulo : nome;
}

// Mesma regra do nome: quem desligou perfil publico tambem nao mostra a
// propria foto no forum (senao daria pra identificar o "anonimo" so pela
// imagem). null faz a view cair no silhueta padrao (image/usuario.webp).
// Quem desligou "mostrar minha foto" (foto_publica) tambem fica com a
// silhueta, independente do nome.
function fotoExibidaNoForum(fotoUrl, perfilPublico, fotoPublica) {
  const escondido =
    perfilPublico === 0 || perfilPublico === false || fotoPublica === 0 || fotoPublica === false;
  return escondido ? null : fotoUrl || null;
}

function formatarDuvida(duvida) {
  return {
    ...duvida,
    aluno_nome: nomeExibidoNoForum(
      duvida.aluno_nome,
      duvida.aluno_perfil_publico,
      "Aluno anônimo"
    ),
    aluno_foto_url: fotoExibidaNoForum(
      duvida.aluno_foto_url,
      duvida.aluno_perfil_publico,
      duvida.aluno_foto_publica
    ),
    materia_slug: slugMateria(duvida.materia),
    tempo: textoTempoRelativoSeguro(duvida.data_envio, duvida.segundos_desde_envio),
    serie_formatada: duvida.serie
      ? String(duvida.serie).replace("ano", "º ano Ensino Médio")
      : "Ensino Médio",
    respostas: (duvida.respostas || []).map((resposta) => ({
      ...resposta,
      professor_nome: nomeExibidoNoForum(
        resposta.professor_nome,
        resposta.professor_perfil_publico,
        "Professor(a) anônimo(a)"
      ),
      professor_foto_url: fotoExibidaNoForum(
        resposta.professor_foto_url,
        resposta.professor_perfil_publico,
        resposta.professor_foto_publica
      ),
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
  const usuarioBase = lerCookieUsuario(req);

  if (!usuarioBase || usuarioBase.tipo_usuario !== tipoUsuario) {
    return null;
  }

  try {
    let perfil;
    if (tipoUsuario === TIPOS_USUARIO.professor) {
      perfil = await Models.professores.buscarPerfilCompleto(usuarioBase.id);
    } else if (tipoUsuario === TIPOS_USUARIO.admin) {
      // Admin nao tem tabela de subtipo (Aluno/Professor) - o perfil e so
      // a linha da propria Usuario.
      perfil = await Models.usuarios.buscarPerfilCompleto(usuarioBase.id);
    } else {
      perfil = await Models.alunos.buscarPerfilCompleto(usuarioBase.id);
    }

    if (!perfil) {
      return { ...perfilFallback(tipoUsuario), ...usuarioBase };
    }

    return formatarPerfil(tipoUsuario, perfil, usuarioBase);
  } catch (erro) {
    console.error("Erro ao buscar perfil:", erro);
    return null;
  }
}

const ABAS_CONFIGURACOES = Object.freeze([
  "perfil",
  "seguranca",
  "assinatura",
  "notificacoes",
  "privacidade",
  "aparencia",
]);

const MENSAGENS_SUCESSO_CONFIGURACOES = Object.freeze({
  perfil: "Perfil atualizado com sucesso!",
  senha: "Senha alterada com sucesso!",
  diploma: "Diploma enviado com sucesso!",
  diploma_analise: "Novo diploma enviado! Ele ficará em análise até a aprovação da equipe.",
  notificacoes: "Preferências de notificação salvas!",
  privacidade: "Preferências de privacidade salvas!",
});

// Tipos de notificacao que o sistema realmente dispara hoje, separados
// por quem recebe cada um. O ENUM do banco tem mais valores (reservados
// pra usos futuros), mas so faz sentido mostrar toggle do que existe.
const TIPOS_NOTIFICACAO_POR_PERFIL = Object.freeze({
  [TIPOS_USUARIO.aluno]: [
    {
      tipo: "resposta_duvida",
      titulo: "Respostas às suas dúvidas",
      descricao: "Quando um professor responde uma dúvida que você enviou no fórum.",
    },
    {
      tipo: "sistema",
      titulo: "Avisos da plataforma",
      descricao: "Pagamento aprovado, boas-vindas e outros avisos gerais da conta.",
    },
  ],
  [TIPOS_USUARIO.professor]: [
    {
      tipo: "nova_duvida",
      titulo: "Novas dúvidas na sua matéria",
      descricao: "Quando um aluno envia uma dúvida da matéria que você leciona.",
    },
    {
      tipo: "sistema",
      titulo: "Avisos da plataforma",
      descricao: "Aluno respondeu um simulado seu, boas-vindas e outros avisos gerais.",
    },
  ],
});

// Contexto completo da pagina /configuracoes - usado tanto no GET quanto
// nos POST das abas (perfil/senha), ja que qualquer erro de validacao
// precisa re-renderizar a pagina inteira (todas as abas), nao so o form
// que falhou.
async function montarContextoConfiguracoes(req, tipoUsuario, overrides = {}) {
  const usuario = await buscarPerfilLogado(req, tipoUsuario);
  let assinatura = null;

  if (tipoUsuario === TIPOS_USUARIO.aluno && usuario) {
    const detalhe = await Models.assinaturas.buscarAtivaDetalhe(usuario.id).catch((erro) => {
      console.error("Erro ao buscar assinatura para configuracoes:", erro);
      return null;
    });

    assinatura = {
      ativa: Boolean(detalhe),
      dataFim: detalhe && detalhe.data_fim ? formatarDataLocal(detalhe.data_fim) : null,
    };
  }

  // Preferencias de notificacao: so vem linha do que a pessoa desligou,
  // entao o padrao de qualquer tipo sem linha e ligado.
  const preferenciasNotificacao = usuario
    ? await Models.preferenciasNotificacao.buscarMapaPorUsuario(usuario.id).catch((erro) => {
        console.error("Erro ao buscar preferencias de notificacao:", erro);
        return {};
      })
    : {};

  const tiposNotificacao = TIPOS_NOTIFICACAO_POR_PERFIL[tipoUsuario] || [];
  const perfilPublico = usuario ? usuario.perfil_publico !== 0 : true;
  const fotoPublica = usuario ? usuario.foto_publica !== 0 : true;

  return {
    tipoUsuario,
    abaInicial: "perfil",
    valoresPerfil: {
      nome: usuario?.nome || "",
      email: usuario?.email || "",
      serie: usuario?.serie || "",
      ra: usuario?.ra || "0000",
      materia: usuario?.materia || "",
      data_nascimento: usuario?.data_nascimento || "",
      foto_url: usuario?.foto_url || "",
      tem_diploma: String(usuario?.diploma || "").includes("|"),
      diploma_pendente: !!usuario?.diploma_pendente,
    },
    erroValidacaoPerfil: {},
    msgErroPerfil: {},
    erroValidacaoSenha: {},
    msgErroSenha: {},
    msgErroConta: null,
    msgSucesso: null,
    assinatura,
    tiposNotificacao,
    preferenciasNotificacao,
    perfilPublico,
    fotoPublica,
    ...overrides,
  };
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
  res.locals.notificacoesAdmin = [];
  res.locals.totalNotificacoesAdmin = 0;

  // Precisa rodar pra QUALQUER visitante (logado ou nao) - o aviso do
  // site e o texto institucional aparecem em paginas publicas tambem,
  // entao fica antes do "if (!usuario)" abaixo. O .catch garante que
  // uma falha de banco aqui nunca derruba a pagina inteira.
  res.locals.configuracoesSite = await Models.configuracoes.buscarMapa().catch((erro) => {
    console.error("Erro ao carregar configuracoes da plataforma:", erro);
    return {
      aviso_site: "",
      texto_institucional: "",
      banner_principal_url: "",
      recurso_premium_destaque: "",
      periodo_teste_premium: "",
      email_contato_destino: "",
    };
  });

  if (!usuario) return next();

  try {
    if (usuario.tipo_usuario === TIPOS_USUARIO.admin) {
      const { itens, total } = await Models.admin.buscarNotificacoes();
      res.locals.notificacoesAdmin = itens.map((item) => ({
        ...item,
        tempo: textoTempoRelativo(item.data),
      }));
      res.locals.totalNotificacoesAdmin = total;
    } else {
      const notificacoes = await Models.notificacoes.listarPorUsuario(usuario.id, 5);
      const total = await Models.notificacoes.contarNaoLidas(usuario.id);

      res.locals.notificacoes = notificacoes.map(formatarNotificacao);
      res.locals.totalNotificacoesNaoLidas = total;
    }
  } catch (erro) {
    console.error("Erro ao carregar notificacoes:", erro);
  }

  return next();
}

// As duas rotas abaixo ficam ANTES do carregarNotificacoes de proposito:
// nenhuma precisa do banco, entao respondem na hora.

// Pingada pelo monitor de uptime (UptimeRobot) a cada poucos minutos pra
// o Render free nao colocar o servico pra dormir.
router.get("/health", function (req, res) {
  res.set("Cache-Control", "no-store");
  res.status(200).send("ok");
});

// start_url do manifest.json: o app instalado abre aqui. Quem ja esta
// logado vai direto pra sua area em vez de cair na tela inicial publica.
router.get("/app", function (req, res) {
  const usuario = lerCookieUsuario(req);
  res.redirect(usuario ? rotaInicialPorTipoUsuario(usuario.tipo_usuario) : "/telainicial");
});

// Trava contra envio duplicado: se o mesmo usuario manda o mesmo POST (mesma rota,
// mesmo conteudo) de novo em poucos segundos - clique repetido com servidor
// lento, F5 depois de enviar - o segundo e descartado em vez de criar outro
// registro. O botao desativado no navegador (js/envioUnico.js) evita o caso
// comum; isto cobre quem burla o botao e as requisicoes que chegam juntas.
const JANELA_ENVIO_DUPLICADO_MS = 8000;
const ENVIOS_RECENTES = new Map();
// Rotas em que repetir o mesmo POST e legitimo (alternar estado, tentar login de novo).
const ROTAS_SEM_TRAVA_DUPLICADO = /^\/(login$|planoestudo\/[^/]+\/(concluido|prioridade)$|admin\/.*\/(status|destaque|premium|arquivar)$)/;

function limparEnviosRecentes(agora) {
  for (const [chave, instante] of ENVIOS_RECENTES) {
    if (agora - instante > JANELA_ENVIO_DUPLICADO_MS) ENVIOS_RECENTES.delete(chave);
  }
}

function bloquearEnvioDuplicado(req, res, next) {
  if (req.method !== "POST") return next();
  if (req.path.startsWith("/api/") || req.path.startsWith("/webhooks/")) return next();
  if (ROTAS_SEM_TRAVA_DUPLICADO.test(req.path)) return next();

  const usuario = lerCookieUsuario(req);
  const quem = usuario ? `${usuario.tipo_usuario}:${usuario.id}` : `ip:${req.ip}`;
  const multipart = String(req.headers["content-type"] || "").startsWith("multipart/");
  // multipart ainda nao foi lido aqui (multer roda por rota); o tamanho serve de digital.
  const conteudo = multipart
    ? `multipart:${req.headers["content-length"] || ""}`
    : JSON.stringify(req.body || {});
  const chave = crypto
    .createHash("sha256")
    .update(`${quem}|${req.path}|${conteudo}`)
    .digest("hex");

  const agora = Date.now();
  if (ENVIOS_RECENTES.size > 500) limparEnviosRecentes(agora);

  const anterior = ENVIOS_RECENTES.get(chave);
  if (anterior && agora - anterior < JANELA_ENVIO_DUPLICADO_MS) {
    console.warn(`Envio duplicado descartado: ${req.path} (${quem})`);
    if (req.accepts(["html", "json"]) === "json") {
      return res.status(429).json({ erro: "Envio repetido. Aguarde um instante." });
    }
    return res.redirect(303, req.get("referer") || "/");
  }

  ENVIOS_RECENTES.set(chave, agora);
  return next();
}

router.use(bloquearEnvioDuplicado);

router.use(carregarNotificacoes);

async function renderizarTelaInicial(res) {
  const materias = await Models.materias.listarAtivas();
  res.render("pages/telainicial", { materias });
}

router.get("/", async function (req, res) {
  await renderizarTelaInicial(res);
});

router.get("/areapremium", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (usuarioBase && (await Models.assinaturas.estaAtiva(usuarioBase.id))) {
    return res.redirect("/partepremium");
  }

  res.render("pages/areapremium");
});

router.get("/admin", somenteAdmin, async function (req, res) {
  const [metricas, grafico, pendencias] = await Promise.all([
    Models.admin.buscarMetricasDashboard(),
    Models.admin.buscarGraficoCrescimento(),
    Models.admin.buscarPendencias(),
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

const PREFIXO_TIPO_USUARIO = Object.freeze({ aluno: "ALU", professor: "PROF", admin: "ADM" });

// Traduz a linha que vem do banco (adminModel.listarUsuarios) pro
// mesmo formato de objeto que app/public/js/admin/usuarios.js ja sabe
// filtrar/paginar/renderizar (era o formato de USUARIOS_MOCK).
function usuarioParaAdminJson(usuario) {
  return {
    id: usuario.id_usuario,
    idAcesso: `${PREFIXO_TIPO_USUARIO[usuario.tipo_usuario]}-${String(usuario.id_usuario).padStart(4, "0")}`,
    nome: usuario.nome,
    email: usuario.email,
    tipoUsuario: usuario.tipo_usuario,
    status: usuario.status,
    materia: usuario.materia || null,
    temDiploma: !!usuario.tem_diploma,
    diplomaPendente: !!usuario.diploma_pendente,
    premium: {
      ativo: !!usuario.premium_ativo,
      ate: usuario.premium_ate ? formatarDataLocal(usuario.premium_ate) : null,
    },
    // Fica null pra quem nunca logou depois que essa coluna passou a
    // existir - o front trata null mostrando "-" em vez de quebrar.
    ultimoAcesso: usuario.ultimo_login ? new Date(usuario.ultimo_login).toISOString() : null,
  };
}

router.get("/admin/usuarios", somenteAdmin, async function (req, res) {
  const usuarios = await Models.admin.listarUsuarios();

  res.render("pages/admin/usuarios", {
    activeAdminPage: "usuarios",
    usuarios: usuarios.map(usuarioParaAdminJson),
  });
});

router.get("/admin/usuarios/:id/diploma", somenteAdmin, async function (req, res) {
  try {
    const perfil = await Models.professores.buscarPerfilCompleto(Number(req.params.id));
    const url = UploadService.urlDiploma(perfil?.diploma);
    if (!url) return res.status(404).send("Diploma nao disponivel para este professor.");
    return res.redirect(url);
  } catch (erro) {
    console.error("Erro ao abrir diploma (admin):", erro);
    return res.status(500).send("Nao foi possivel abrir o diploma.");
  }
});

router.get("/admin/usuarios/:id/diploma-pendente", somenteAdmin, async function (req, res) {
  try {
    const perfil = await Models.professores.buscarPerfilCompleto(Number(req.params.id));
    const url = UploadService.urlDiploma(perfil?.diploma_pendente);
    if (!url) return res.status(404).send("Nao ha diploma pendente para este professor.");
    return res.redirect(url);
  } catch (erro) {
    console.error("Erro ao abrir diploma pendente (admin):", erro);
    return res.status(500).send("Nao foi possivel abrir o diploma.");
  }
});

async function decidirDiplomaPendente(req, res, aprovar) {
  const idProfessor = Number(req.params.id);

  try {
    const perfil = await Models.professores.buscarPerfilCompleto(idProfessor);

    if (!perfil?.diploma_pendente) {
      return res.status(400).json({ erro: "Este professor nao tem diploma pendente." });
    }

    const antigo = perfil.diploma;
    const pendente = perfil.diploma_pendente;

    if (aprovar) {
      await Models.professores.aprovarDiplomaPendente(idProfessor);
      UploadService.apagarDiploma(antigo);
    } else {
      await Models.professores.limparDiplomaPendente(idProfessor);
      UploadService.apagarDiploma(pendente);
    }

    await auditarAdmin(req, {
      acao: "editou",
      entidade: "conta",
      idEntidade: idProfessor,
      descricao: `${aprovar ? "Aprovou" : "Recusou"} a troca de diploma do professor #${idProfessor}`,
    });

    await Models.notificacoes
      .criar({
        idUsuario: idProfessor,
        tipo: "sistema",
        titulo: aprovar ? "Novo diploma aprovado" : "Novo diploma recusado",
        mensagem: aprovar
          ? "O diploma que você enviou foi aprovado e agora é o diploma da sua conta."
          : "O novo diploma que você enviou foi recusado. Seu diploma anterior continua válido; você pode enviar outro arquivo.",
        link: "/configuracoes",
      })
      .catch((erro) => console.error("Erro ao notificar decisao de diploma:", erro));

    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao decidir diploma pendente (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel concluir a acao." });
  }
}

router.post("/admin/usuarios/:id/diploma/aprovar", somenteAdmin, (req, res) =>
  decidirDiplomaPendente(req, res, true)
);

router.post("/admin/usuarios/:id/diploma/recusar", somenteAdmin, (req, res) =>
  decidirDiplomaPendente(req, res, false)
);

router.post("/admin/usuarios/:id/editar", somenteAdmin, async function (req, res) {
  const idUsuario = Number(req.params.id);
  const nome = String(req.body.nome || "").trim();
  const email = String(req.body.email || "").trim();

  if (!nome || !email) {
    return res.status(400).json({ erro: "Nome e email sao obrigatorios." });
  }

  try {
    const emailEmUso = await Models.usuarios.emailPertenceAOutroUsuario(email, idUsuario);
    if (emailEmUso) {
      return res.status(400).json({ erro: "Esse email ja esta em uso por outra conta." });
    }

    await Models.usuarios.atualizarPerfilBasico({ nome, email, idUsuario });

    await auditarAdmin(req, {
      acao: "editou",
      entidade: "conta",
      idEntidade: idUsuario,
      descricao: `Editou o nome/e-mail da conta #${idUsuario}`,
    });

    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao editar usuario (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel salvar as alteracoes." });
  }
});

router.post("/admin/usuarios/:id/status", somenteAdmin, async function (req, res) {
  const idUsuario = Number(req.params.id);
  const { status } = req.body;

  if (!Object.values(STATUS_CONTA).includes(status)) {
    return res.status(400).json({ erro: "Status invalido." });
  }

  try {
    await Models.usuarios.alterarStatusConta({ status, idUsuario });

    await auditarAdmin(req, {
      acao: "editou",
      entidade: "conta",
      idEntidade: idUsuario,
      descricao: `Alterou o status da conta #${idUsuario} para ${status}`,
    });

    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao alterar status de usuario (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel alterar o status." });
  }
});

router.post("/admin/usuarios/:id/premium/conceder", somenteAdmin, async function (req, res) {
  const idUsuario = Number(req.params.id);

  try {
    await Models.assinaturas.conceder(idUsuario);

    await auditarAdmin(req, {
      acao: "editou",
      entidade: "conta",
      idEntidade: idUsuario,
      descricao: `Concedeu acesso Premium a conta #${idUsuario}`,
    });

    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao conceder premium (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel conceder premium." });
  }
});

router.post("/admin/usuarios/:id/premium/remover", somenteAdmin, async function (req, res) {
  const idUsuario = Number(req.params.id);

  try {
    await Models.assinaturas.revogar(idUsuario);

    await auditarAdmin(req, {
      acao: "editou",
      entidade: "conta",
      idEntidade: idUsuario,
      descricao: `Removeu o acesso Premium da conta #${idUsuario}`,
    });

    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao remover premium (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel remover o premium." });
  }
});

router.post("/admin/usuarios/:id/excluir", somenteAdmin, async function (req, res) {
  const idUsuario = Number(req.params.id);
  const usuarioLogado = lerCookieUsuario(req);

  if (usuarioLogado && Number(usuarioLogado.id) === idUsuario) {
    return res.status(400).json({ erro: "Voce nao pode excluir a propria conta." });
  }

  try {
    const alvo = await Models.usuarios.buscarPerfilCompleto(idUsuario);
    await excluirContaAnonimizandoAuditoria(idUsuario);

    await auditarAdmin(req, {
      acao: "excluiu",
      entidade: "conta",
      descricao: `Excluiu a conta de ${alvo?.tipo_usuario || "usuario"} #${idUsuario}`,
    });

    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao excluir usuario (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel excluir a conta." });
  }
});

// Traduz uma linha de Conteudo (adminModel/conteudoModel) pro formato
// que conteudos.js ja sabe filtrar/paginar/renderizar (era o formato de
// CONTEUDOS_MOCK). "arquivado" vira um status sintetico "arquivado" no
// campo status (escondendo o rascunho/publicado real em statusAnterior)
// porque e assim que a tabela/acoes do front ja esperam receber.
function conteudoParaAdminJson(conteudo) {
  const arquivado = !!conteudo.arquivado;

  return {
    id: conteudo.id,
    titulo: conteudo.titulo,
    tipo: conteudo.tipo === "video" ? "videoaula" : conteudo.tipo,
    materia: conteudo.materia || "Sem matéria",
    status: arquivado ? "arquivado" : conteudo.status,
    statusAnterior: arquivado ? conteudo.status : null,
    acesso: conteudo.is_premium ? "premium" : "gratuito",
    autor: conteudo.autor || "",
    data: new Date(conteudo.criado_em).toISOString(),
    destaque: !!conteudo.destaque,
    arquivado,
  };
}

router.get("/admin/conteudos", somenteAdmin, async function (req, res) {
  const [conteudos, materias] = await Promise.all([
    Models.conteudos.listarTodosAdmin(),
    Models.materias.listarAtivas(),
  ]);

  res.render("pages/admin/conteudos", {
    activeAdminPage: "conteudos",
    conteudos: conteudos.map(conteudoParaAdminJson),
    materias: materias.map((m) => m.nome),
  });
});

router.post("/admin/conteudos/:id/editar", somenteAdmin, async function (req, res) {
  const id = Number(req.params.id);
  const titulo = String(req.body.titulo || "").trim();
  const autor = String(req.body.autor || "").trim();
  const nomeMateria = String(req.body.materia || "").trim();
  const { status, premium } = req.body;

  if (!titulo || !["rascunho", "publicado"].includes(status)) {
    return res.status(400).json({ erro: "Titulo e status sao obrigatorios." });
  }

  try {
    const materia = await Models.materias.buscarPorNome(nomeMateria);
    await Models.conteudos.atualizarMetadados({
      id,
      titulo,
      autor,
      materiaId: materia?.id_materia || null,
      status,
    });
    await Models.conteudos.atualizarPremium({ id, isPremium: !!premium });

    await auditarAdmin(req, {
      acao: "editou",
      entidade: "conteudo",
      idEntidade: id,
      descricao: `Editou o conteudo #${id}: "${resumirTexto(titulo)}" (status ${status}${premium ? ", premium" : ""})`,
    });

    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao editar conteudo (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel salvar as alteracoes." });
  }
});

router.post("/admin/conteudos/:id/destaque", somenteAdmin, async function (req, res) {
  try {
    await Models.conteudos.atualizarDestaque({ id: Number(req.params.id), destaque: !!req.body.destaque });

    await auditarAdmin(req, {
      acao: "editou",
      entidade: "conteudo",
      idEntidade: Number(req.params.id),
      descricao: `${req.body.destaque ? "Destacou o" : "Removeu o destaque do"} conteudo #${req.params.id}`,
    });

    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao alternar destaque (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel atualizar o destaque." });
  }
});

router.post("/admin/conteudos/:id/premium", somenteAdmin, async function (req, res) {
  try {
    await Models.conteudos.atualizarPremium({ id: Number(req.params.id), isPremium: !!req.body.premium });

    await auditarAdmin(req, {
      acao: "editou",
      entidade: "conteudo",
      idEntidade: Number(req.params.id),
      descricao: `Marcou o conteudo #${req.params.id} como ${req.body.premium ? "premium" : "gratuito"}`,
    });

    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao alternar premium do conteudo (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel atualizar o acesso." });
  }
});

router.post("/admin/conteudos/:id/arquivar", somenteAdmin, async function (req, res) {
  try {
    await Models.conteudos.atualizarArquivado({ id: Number(req.params.id), arquivado: !!req.body.arquivado });

    await auditarAdmin(req, {
      acao: "editou",
      entidade: "conteudo",
      idEntidade: Number(req.params.id),
      descricao: `${req.body.arquivado ? "Arquivou" : "Restaurou"} o conteudo #${req.params.id}`,
    });

    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao arquivar conteudo (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel atualizar o arquivamento." });
  }
});

router.post("/admin/conteudos/:id/duplicar", somenteAdmin, async function (req, res) {
  try {
    const novoId = await Models.conteudos.duplicar(Number(req.params.id));
    if (!novoId) {
      return res.status(404).json({ erro: "Conteudo original nao encontrado." });
    }

    await auditarAdmin(req, {
      acao: "criou",
      entidade: "conteudo",
      idEntidade: novoId,
      descricao: `Duplicou o conteudo #${req.params.id} (copia #${novoId})`,
    });

    return res.json({ ok: true, id: novoId });
  } catch (erro) {
    console.error("Erro ao duplicar conteudo (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel duplicar o conteudo." });
  }
});

router.post("/admin/conteudos/:id/excluir", somenteAdmin, async function (req, res) {
  try {
    const conteudo = await Models.conteudos.buscarPorId(Number(req.params.id));
    await Models.conteudos.remover(Number(req.params.id));

    await auditarAdmin(req, {
      acao: "excluiu",
      entidade: "conteudo",
      idEntidade: Number(req.params.id),
      descricao: `Excluiu ${conteudo?.tipo === "video" ? "a video-aula" : "o livro"} "${resumirTexto(conteudo?.titulo)}" pelo painel admin`,
    });

    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao excluir conteudo (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel excluir o conteudo." });
  }
});

// Se o arquivo enviado for SVG, processa e recoloriza pra embutir
// inline (herda a cor do site de verdade); senao sobe pro Cloudinary
// como antes e recebe so a aproximacao via filtro CSS. Lanca erro com
// mensagem amigavel se o SVG estiver mal formado.
async function processarArquivoDeIcone(file) {
  if (!file) {
    return { iconeUrl: null, iconeSvg: null };
  }

  if (UploadService.ehSvg(file.mimetype, file.buffer)) {
    const iconeSvg = UploadService.processarIconeSvg(file.buffer);
    if (!iconeSvg) {
      const erro = new Error("O arquivo SVG parece invalido.");
      erro.ehErroDeValidacao = true;
      throw erro;
    }
    return { iconeUrl: null, iconeSvg };
  }

  const iconeUrl = await UploadService.enviarImagem(file.buffer, "primia/materias");
  return { iconeUrl, iconeSvg: null };
}

router.post(
  "/admin/materias",
  somenteAdmin,
  uploadConteudo.single("icone"),
  async function (req, res) {
    const nome = String(req.body.nome || "").trim();

    if (!nome) {
      return res.status(400).json({ erro: "Informe o nome da materia." });
    }

    try {
      const existente = await Models.materias.buscarPorNome(nome);
      if (existente) {
        return res.status(400).json({ erro: "Ja existe uma materia com esse nome." });
      }

      const { iconeUrl, iconeSvg } = await processarArquivoDeIcone(req.file);
      const id = await Models.materias.criar({ nome, descricao: null, iconeUrl, iconeSvg });
      return res.json({ ok: true, id, iconeUrl });
    } catch (erro) {
      if (erro.ehErroDeValidacao) {
        return res.status(400).json({ erro: erro.message });
      }
      console.error("Erro ao criar materia (admin):", erro);
      return res.status(500).json({ erro: "Nao foi possivel criar a materia." });
    }
  }
);

router.post("/admin/materias/excluir", somenteAdmin, async function (req, res) {
  const nome = String(req.body.nome || "").trim();

  try {
    const materia = await Models.materias.buscarPorNome(nome);
    if (!materia) {
      return res.status(404).json({ erro: "Materia nao encontrada." });
    }

    const professoresVinculados = await Models.materias.contarProfessoresVinculados(materia.id_materia);
    if (professoresVinculados > 0) {
      return res.status(400).json({
        erro: `Essa materia esta vinculada a ${professoresVinculados} professor${professoresVinculados > 1 ? "es" : ""} e nao pode ser removida.`,
      });
    }

    await Models.materias.remover(materia.id_materia);
    return res.json({ ok: true });
  } catch (erro) {
    // Ainda pode cair aqui por causa de Plano_de_Estudo/Plano_de_Aula/Forum
    // (ON DELETE RESTRICT) mesmo sem professor vinculado.
    if (erro?.code === "ER_ROW_IS_REFERENCED_2" || erro?.code === "ER_ROW_IS_REFERENCED") {
      return res.status(400).json({ erro: "Essa materia esta em uso e nao pode ser removida." });
    }
    console.error("Erro ao remover materia (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel remover a materia." });
  }
});

router.post(
  "/admin/materias/icone",
  somenteAdmin,
  uploadConteudo.single("icone"),
  async function (req, res) {
    const nome = String(req.body.nome || "").trim();

    if (!req.file) {
      return res.status(400).json({ erro: "Selecione uma imagem." });
    }

    try {
      const materia = await Models.materias.buscarPorNome(nome);
      if (!materia) {
        return res.status(404).json({ erro: "Materia nao encontrada." });
      }

      const { iconeUrl, iconeSvg } = await processarArquivoDeIcone(req.file);
      await Models.materias.atualizarIcone({ idMateria: materia.id_materia, iconeUrl, iconeSvg });
      return res.json({ ok: true, iconeUrl });
    } catch (erro) {
      if (erro.ehErroDeValidacao) {
        return res.status(400).json({ erro: erro.message });
      }
      console.error("Erro ao atualizar icone da materia (admin):", erro);
      return res.status(500).json({ erro: "Nao foi possivel atualizar o icone." });
    }
  }
);

// Traduz uma linha de Denuncia (denunciaModel.listarTodas) pro mesmo
// formato que suporte.js ja sabe filtrar/paginar/renderizar (era o
// formato de DENUNCIAS_MOCK). "conteudo" vira "livro"/"videoaula"
// dependendo de Conteudo.tipo; "formulario" vira "simulado"; "duvida"
// vira "forum".
function denunciaParaAdminJson(denuncia) {
  const tipo =
    denuncia.tipo_conteudo === "duvida"
      ? "forum"
      : denuncia.tipo_conteudo === "conteudo"
      ? denuncia.conteudo_tipo === "video"
        ? "videoaula"
        : "livro"
      : denuncia.tipo_conteudo === "formulario"
      ? "simulado"
      : "outros";

  return {
    id: denuncia.id_denuncia,
    codigo: `DEN-${String(denuncia.id_denuncia).padStart(4, "0")}`,
    usuario: {
      nome: denuncia.usuario_nome,
      idAcesso: `${PREFIXO_TIPO_USUARIO[denuncia.usuario_tipo] || "USR"}-${String(denuncia.id_usuario).padStart(4, "0")}`,
    },
    tipo,
    materia: denuncia.materia || "-",
    conteudoDenunciado: denuncia.resumo_conteudo || "Conteudo nao encontrado (pode ter sido removido).",
    motivo: denuncia.motivo,
    descricao: denuncia.descricao,
    prioridade: denuncia.prioridade,
    status: denuncia.status,
    resolucao: denuncia.resolucao,
    resposta: denuncia.resposta_admin,
    criadoEm: new Date(denuncia.data_denuncia).toISOString(),
    resolvidoEm: denuncia.data_resolucao ? new Date(denuncia.data_resolucao).toISOString() : null,
  };
}

// Mesma ideia pra Mensagem_Contato: "pendente" vira "aberto" pra bater
// com o vocabulario que a tela ja usa (CONTATOS_MOCK).
function contatoParaAdminJson(contato) {
  return {
    id: contato.id,
    codigo: `CT-${String(contato.id).padStart(4, "0")}`,
    nome: contato.nome,
    email: contato.email,
    assunto: contato.assunto,
    mensagem: contato.mensagem,
    status: contato.status === "pendente" ? "aberto" : contato.status,
    resposta: contato.resposta_admin,
    criadoEm: new Date(contato.criado_em).toISOString(),
    resolvidoEm: contato.resolvido_em ? new Date(contato.resolvido_em).toISOString() : null,
  };
}

router.get("/admin/suporte", somenteAdmin, async function (req, res) {
  const [denuncias, contatos] = await Promise.all([
    Models.denuncias.listarTodas(),
    Models.contato.listar(),
  ]);

  res.render("pages/admin/suporte", {
    activeAdminPage: "suporte",
    denuncias: denuncias.map(denunciaParaAdminJson),
    contatos: contatos.map(contatoParaAdminJson),
  });
});

router.post("/admin/denuncias/:id/responder", somenteAdmin, async function (req, res) {
  const id = Number(req.params.id);
  const resposta = String(req.body.resposta || "").trim();

  if (!resposta) {
    return res.status(400).json({ erro: "Escreva uma resposta antes de salvar." });
  }

  try {
    await Models.denuncias.responder({ id, resposta });
    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao responder denuncia (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel salvar a resposta." });
  }
});

router.post("/admin/denuncias/:id/resolver", somenteAdmin, async function (req, res) {
  const id = Number(req.params.id);
  const { resolucao } = req.body;

  // "conteudo_removido" fica de fora de proposito - so a rota
  // /remover-conteudo pode chegar nesse desfecho, porque ela de fato
  // apaga o conteudo junto. Deixar entrar por aqui deixaria a denuncia
  // dizendo "conteudo removido" com o conteudo ainda no ar.
  if (!["resolvido", "ignorado"].includes(resolucao)) {
    return res.status(400).json({ erro: "Desfecho invalido." });
  }

  try {
    await Models.denuncias.resolver({ id, resolucao });
    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao resolver denuncia (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel atualizar a denuncia." });
  }
});

// Diferente do /resolver acima: essa rota de fato apaga o conteudo
// denunciado (Conteudo/Formulario/Duvida, dependendo do tipo) antes de
// marcar a denuncia como resolvida com resolucao='conteudo_removido'.
// Tudo numa transacao so - se o delete falhar, a denuncia nao fica
// marcada como removida sem o conteudo ter sido removido de verdade.
router.post("/admin/denuncias/:id/remover-conteudo", somenteAdmin, async function (req, res) {
  const id = Number(req.params.id);
  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    const denuncia = await Models.denuncias.buscarPorId(id, conexao);

    if (!denuncia) {
      await conexao.rollback();
      return res.status(404).json({ erro: "Denuncia nao encontrada." });
    }

    if (denuncia.tipo_conteudo === "conteudo" && denuncia.id_conteudo_alvo) {
      await Models.conteudos.remover(denuncia.id_conteudo_alvo, conexao);
    } else if (denuncia.tipo_conteudo === "formulario" && denuncia.id_conteudo_alvo) {
      await Models.formularios.excluir(denuncia.id_conteudo_alvo, conexao);
    } else if (denuncia.tipo_conteudo === "duvida" && denuncia.id_duvida) {
      await Models.duvidas.excluirPorId(denuncia.id_duvida, conexao);
    }

    await Models.denuncias.resolver({ id, resolucao: "conteudo_removido" }, conexao);

    await conexao.commit();

    const entidadeRemovida = ["conteudo", "formulario", "duvida"].includes(denuncia.tipo_conteudo)
      ? denuncia.tipo_conteudo
      : null;

    if (entidadeRemovida) {
      await auditarAdmin(req, {
        acao: "excluiu",
        entidade: entidadeRemovida,
        idEntidade: denuncia.id_conteudo_alvo || denuncia.id_duvida || null,
        descricao: `Removeu um(a) ${entidadeRemovida} por causa da denuncia #${id}`,
      });
    }

    return res.json({ ok: true });
  } catch (erro) {
    await conexao.rollback();
    console.error("Erro ao remover conteudo denunciado (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel remover o conteudo." });
  } finally {
    conexao.release();
  }
});

router.post("/admin/contatos/:id/responder", somenteAdmin, async function (req, res) {
  const id = Number(req.params.id);
  const resposta = String(req.body.resposta || "").trim();

  if (!resposta) {
    return res.status(400).json({ erro: "Escreva uma resposta antes de salvar." });
  }

  const enviarEmail = req.body.enviarEmail === true || req.body.enviarEmail === "on";

  try {
    await Models.contato.responder({ id, resposta });

    if (!enviarEmail) {
      return res.json({ ok: true, emailEnviado: false });
    }

    // A resposta ja esta salva; se o e-mail falhar o admin e avisado, mas
    // nada se perde.
    try {
      const contato = await Models.contato.buscarPorId(id);
      await MailService.enviarRespostaContato({
        nome: contato.nome,
        email: contato.email,
        assunto: contato.assunto,
        mensagem: contato.mensagem,
        resposta,
        replyTo: res.locals.configuracoesSite?.email_contato_destino || undefined,
      });
      return res.json({ ok: true, emailEnviado: true });
    } catch (erroEmail) {
      console.error("Erro ao enviar resposta de contato por e-mail:", erroEmail);
      return res.json({ ok: true, emailEnviado: false, avisoEmail: "Resposta salva, mas o e-mail não pôde ser enviado." });
    }
  } catch (erro) {
    console.error("Erro ao responder contato (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel salvar a resposta." });
  }
});

router.post("/admin/contatos/:id/resolver", somenteAdmin, async function (req, res) {
  const id = Number(req.params.id);

  try {
    await Models.contato.resolver(id);
    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao resolver contato (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel marcar a mensagem como resolvida." });
  }
});

router.post("/admin/contatos/:id/excluir", somenteAdmin, async function (req, res) {
  const id = Number(req.params.id);

  try {
    await Models.contato.remover(id);
    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao excluir contato (admin):", erro);
    return res.status(500).json({ erro: "Nao foi possivel excluir a mensagem." });
  }
});

router.get("/admin/relatorios", somenteAdmin, async function (req, res) {
  const { registros, materias } = await Models.admin.buscarRelatorioDiario();

  res.render("pages/admin/relatorios", {
    activeAdminPage: "relatorios",
    registrosDiarios: registros,
    materias,
  });
});

// Busca, filtros e paginacao sao client-side (auditoria.js), igual a
// /admin/usuarios. O limite so evita mandar o log inteiro quando ele crescer:
// registros alem dos mais recentes nao aparecem na busca.
const LIMITE_LOGS_AUDITORIA = 2000;

router.get("/admin/auditoria", somenteAdmin, async function (req, res) {
  const logs = await Models.auditoria.listar({ limite: LIMITE_LOGS_AUDITORIA });

  res.render("pages/admin/auditoria", {
    activeAdminPage: "auditoria",
    logs: logs.map((log) => ({
      id: log.id_log,
      nome: log.nome_usuario,
      email: log.email_usuario,
      tipoUsuario: log.tipo_usuario,
      acao: log.acao,
      entidade: log.entidade,
      idEntidade: log.id_entidade,
      descricao: log.descricao,
      quando: formatarDataHoraLocal(log.criado_em),
    })),
  });
});

router.get("/admin/configuracoes", somenteAdmin, async function (req, res) {
  const config = await Models.configuracoes.buscarMapa();
  res.render("pages/admin/configuracoes", { activeAdminPage: "configuracoes", config });
});

router.post(
  "/admin/configuracoes",
  somenteAdmin,
  body("email_contato_destino")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("E-mail de contato invalido."),
  async function (req, res) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ erro: errors.array()[0].msg });
    }

    const usuarioLogado = lerCookieUsuario(req);
    const campos = [
      "aviso_site",
      "texto_institucional",
      "recurso_premium_destaque",
      "periodo_teste_premium",
      "email_contato_destino",
    ];

    try {
      for (const chave of campos) {
        await Models.configuracoes.salvar({
          chave,
          valor: String(req.body[chave] || "").trim(),
          idAdmin: usuarioLogado.id,
        });
      }
      return res.json({ ok: true });
    } catch (erro) {
      console.error("Erro ao salvar configuracoes (admin):", erro);
      return res.status(500).json({ erro: "Nao foi possivel salvar as configuracoes." });
    }
  }
);

router.post(
  "/admin/configuracoes/banner",
  somenteAdmin,
  uploadConteudo.single("banner"),
  async function (req, res) {
    if (!req.file) {
      return res.status(400).json({ erro: "Selecione uma imagem." });
    }

    try {
      const bannerUrl = await UploadService.enviarImagem(req.file.buffer, "primia/configuracoes");
      const usuarioLogado = lerCookieUsuario(req);
      await Models.configuracoes.salvar({
        chave: "banner_principal_url",
        valor: bannerUrl,
        idAdmin: usuarioLogado.id,
      });
      return res.json({ ok: true, bannerUrl });
    } catch (erro) {
      console.error("Erro ao atualizar banner principal (admin):", erro);
      return res.status(500).json({ erro: "Nao foi possivel atualizar o banner." });
    }
  }
);


router.get("/telainicial", async function (req, res) {
  await renderizarTelaInicial(res);
});

router.get("/logout", function (req, res) {
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
      await MailService.enviarNotificacaoContato({
        nome, email, assunto, mensagem, origem,
        destinatario: res.locals.configuracoesSite?.email_contato_destino,
      });
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
      await MailService.enviarNotificacaoContato({
        nome, email, assunto, mensagem, origem,
        destinatario: res.locals.configuracoesSite?.email_contato_destino,
      });
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

  if (aluno && video.is_premium && !(await Models.assinaturas.estaAtiva(aluno.id))) {
    return redirecionarFaltaPremium(aluno.id, res);
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

  const ehPremium = await Models.assinaturas.estaAtiva(usuarioBase.id);

  const [materias, meusFormulariosBase, publicadosBase] = await Promise.all([
    Models.materias.listarAtivas(),
    Models.formularios.listarPorAluno(usuarioBase.id),
    Models.formularios.listarPublicadosPorProfessor(),
  ]);

  // podeExcluir so nos gerados pelo proprio aluno - os publicados por
  // professor aparecem na lista dele, mas nao sao dele pra apagar.
  const meusFormularios = (await anexarStatusResposta(meusFormulariosBase, usuarioBase.id)).map(
    (formulario) => ({ ...formulario, origem: "Gerado por voce", podeExcluir: true })
  );
  // Formularios publicados por professor sao sempre premium (mesmo sem
  // coluna is_premium - ver nota em formularioModel.js) - nao mostra pra
  // aluno gratuito, senao ele veria e conseguiria abrir um conteudo que
  // deveria ser exclusivo.
  const publicados = ehPremium
    ? (await anexarStatusResposta(publicadosBase, usuarioBase.id)).map(
        (formulario) => ({ ...formulario, origem: `Professor ${formulario.professor || ""}`.trim() })
      )
    : [];

  const todos = [...meusFormularios, ...publicados];

  res.render("pages/areadosimulado", {
    materias,
    emAndamento: todos.filter((formulario) => !formulario.respondido),
    finalizados: todos.filter((formulario) => formulario.respondido),
    ehPremium,
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

    if (!(await Models.assinaturas.estaAtiva(usuarioBase.id))) {
      return redirecionarFaltaPremium(usuarioBase.id, res);
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

      await registrarAuditoria({
        usuarioBase,
        acao: "criou",
        entidade: "formulario",
        idEntidade: idFormulario,
        descricao: `Gerou um simulado com IA: "${resumirTexto(tema)}"${materia ? ` (${materia.nome})` : ""}`,
      });

      return res.redirect(`/simulado/${idFormulario}`);
    } catch (erro) {
      console.error("Erro ao gerar simulado:", erro);
      return res.redirect("/areadosimulado");
    }
  }
);

// So apaga simulado que o proprio aluno gerou (id_aluno no WHERE do model):
// os publicados por professor aparecem pra ele, mas nao sao dele pra excluir.
router.post("/areadosimulado/:id/excluir", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  try {
    const formulario = await Models.formularios.buscarPorId(req.params.id);

    const resultado = await Models.formularios.excluirDoAluno({
      id: req.params.id,
      idAluno: usuarioBase.id,
    });

    if (resultado.affectedRows) {
      await registrarAuditoria({
        usuarioBase,
        acao: "excluiu",
        entidade: "formulario",
        idEntidade: Number(req.params.id),
        descricao: `Excluiu o proprio simulado "${resumirTexto(formulario?.titulo)}"${formulario?.materia ? ` de ${formulario.materia}` : ""}`,
      });
    }
  } catch (erro) {
    console.error("Erro ao excluir simulado do aluno:", erro);
  }

  return res.redirect("/areadosimulado");
});

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

  if (formulario.id_professor && !(await Models.assinaturas.estaAtiva(usuarioAluno.id))) {
    return redirecionarFaltaPremium(usuarioAluno.id, res);
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

  if (formulario.id_professor && !(await Models.assinaturas.estaAtiva(usuarioBase.id))) {
    return redirecionarFaltaPremium(usuarioBase.id, res);
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

router.get("/redacao", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  if (!(await Models.assinaturas.estaAtiva(usuarioBase.id))) {
    return redirecionarFaltaPremium(usuarioBase.id, res);
  }

  const historico = await Models.redacoes.listarPorAluno(usuarioBase.id);
  res.render("pages/redacao", {
    historico, msgErro: null, valores: {},
    perfis: IaService.listarPerfisRedacao(),
  });
});

router.post(
  "/redacao",
  body("tema").trim().notEmpty().withMessage("Descreva o tema da redacao."),
  body("texto").trim().notEmpty().withMessage("Escreva sua redacao antes de enviar."),
  async function (req, res) {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    if (!(await Models.assinaturas.estaAtiva(usuarioBase.id))) {
      return redirecionarFaltaPremium(usuarioBase.id, res);
    }

    const errors = validationResult(req);
    const { tema, texto } = req.body;
    const perfis = IaService.listarPerfisRedacao();

    if (!errors.isEmpty()) {
      const { msgErro } = montarErrosValidacao(errors);
      const historico = await Models.redacoes.listarPorAluno(usuarioBase.id);
      return res.render("pages/redacao", { historico, msgErro, valores: req.body, perfis });
    }

    // Resolvido UMA vez e reaproveitado tanto pra corrigir quanto pra
    // salvar - senao, se o aluno mandar um tipo_redacao invalido, a
    // correcao cairia no fallback ENEM mas o banco ficaria com o valor
    // invalido gravado (redacao dizendo "genero X" mas corrigida como ENEM).
    const tipoRedacao = IaService.resolverTipoRedacao(req.body.tipo_redacao);

    try {
      const correcao = await IaService.corrigirRedacao({ tema, texto, tipoRedacao });
      const idRedacao = await Models.redacoes.criar({
        idAluno: usuarioBase.id,
        tema,
        texto,
        tipoRedacao,
        correcao,
      });

      await registrarAuditoria({
        usuarioBase,
        acao: "criou",
        entidade: "redacao",
        idEntidade: idRedacao,
        descricao: `Enviou uma redacao para correcao. Tema: "${resumirTexto(tema)}"`,
      });

      return res.redirect(`/redacao/${idRedacao}`);
    } catch (erro) {
      console.error("Erro ao corrigir redacao:", erro);
      const historico = await Models.redacoes.listarPorAluno(usuarioBase.id);
      return res.render("pages/redacao", {
        historico,
        msgErro: { geral: erro.message || "Nao foi possivel corrigir sua redacao agora. Tente novamente." },
        valores: req.body,
        perfis,
      });
    }
  }
);

router.get("/redacao/:id", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const redacao = await Models.redacoes.buscarPorId(req.params.id);

  if (!redacao || redacao.id_aluno !== usuarioBase.id) {
    return res.redirect("/redacao");
  }

  res.render("pages/redacaovisualizacao", {
    redacao,
    perfil: IaService.buscarPerfilRedacao(redacao.tipo_redacao),
  });
});

router.post("/redacao/:id/excluir", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  try {
    const redacao = await Models.redacoes.buscarPorId(req.params.id);

    const resultado = await Models.redacoes.excluirDoAluno({
      id: req.params.id,
      idAluno: usuarioBase.id,
    });

    if (resultado.affectedRows) {
      await registrarAuditoria({
        usuarioBase,
        acao: "excluiu",
        entidade: "redacao",
        idEntidade: Number(req.params.id),
        descricao: `Excluiu a propria redacao "${resumirTexto(redacao?.tema)}" (nota ${redacao?.nota_total ?? "?"})`,
      });
    }
  } catch (erro) {
    console.error("Erro ao excluir redacao do aluno:", erro);
  }

  return res.redirect("/redacao");
});

// buscarResumoAgregado devolve porGenero so com o slug (tipo_redacao) -
// a tela precisa do rotulo pra mostrar qual estilo cada linha e (ex:
// "📖 Narrativa"), entao resolve aqui em vez de fazer o model depender
// do catalogo de generos do iaService.js.
async function buscarNumerosResultados(idAluno) {
  const numeros = await Models.resultados.buscarResumoAgregado(idAluno);
  return {
    ...numeros,
    porGenero: numeros.porGenero.map((g) => ({
      ...g,
      rotulo: IaService.buscarPerfilRedacao(g.tipoRedacao).rotulo,
    })),
  };
}

// Re-checa, so na leitura, se os conteudos recomendados no snapshot
// salvo ainda estao publicados/nao-arquivados - evita link morto sem
// precisar rechamar a IA se um admin arquivar algo depois da analise
// ter sido gerada.
async function carregarAnaliseComLinksValidos(idAluno) {
  const analise = await Models.resultados.buscarAnalise(idAluno);
  if (!analise) return null;

  const todosIds = analise.recomendacoes.flatMap((grupo) => grupo.conteudos.map((c) => c.id));
  const idsValidos = new Set(await Models.conteudos.filtrarAindaPublicados(todosIds));

  analise.recomendacoes = analise.recomendacoes
    .map((grupo) => ({ ...grupo, conteudos: grupo.conteudos.filter((c) => idsValidos.has(c.id)) }))
    .filter((grupo) => grupo.conteudos.length > 0);

  return analise;
}

router.get("/resultados", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  if (!(await Models.assinaturas.estaAtiva(usuarioBase.id))) {
    return redirecionarFaltaPremium(usuarioBase.id, res);
  }

  const numeros = await buscarNumerosResultados(usuarioBase.id);
  const analise = await carregarAnaliseComLinksValidos(usuarioBase.id);

  res.render("pages/resultados", { numeros, analise, msgErro: null });
});

router.post("/resultados/analisar", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  if (!(await Models.assinaturas.estaAtiva(usuarioBase.id))) {
    return redirecionarFaltaPremium(usuarioBase.id, res);
  }

  const numeros = await buscarNumerosResultados(usuarioBase.id);

  // Nao gasta cota da IA sem dado real pra analisar - mesma cautela de
  // TAMANHO_MINIMO_REDACAO em iaService.js.
  if (numeros.totalPerguntasRespondidas === 0 && numeros.totalRedacoes === 0) {
    const analise = await carregarAnaliseComLinksValidos(usuarioBase.id);
    return res.render("pages/resultados", {
      numeros,
      analise,
      msgErro: { geral: "Responda um simulado ou envie uma redação antes de gerar sua análise." },
    });
  }

  try {
    const materiasDisponiveis = await Models.materias.listarAtivas();
    const resultado = await IaService.analisarDesempenho({ resumo: numeros, materiasDisponiveis });

    const recomendacoes = [];
    for (const materia of resultado.materiasFracas) {
      const conteudos = await Models.conteudos.listarRecomendadosPorMateria(materia.id_materia, 3);
      if (conteudos.length) {
        recomendacoes.push({ materia: materia.nome, conteudos });
      }
    }

    await Models.resultados.salvarAnalise({
      idAluno: usuarioBase.id,
      diagnostico: resultado.diagnostico,
      pontosFortes: resultado.pontosFortes,
      recomendacaoGeral: resultado.recomendacaoGeral,
      materiasFracas: resultado.materiasFracas.map((m) => m.nome),
      recomendacoes,
    });

    return res.redirect("/resultados");
  } catch (erro) {
    // Nunca perde o estado da tela: numeros continuam reais/atualizados,
    // e a analise ANTIGA (se existir) continua visivel - so aparece um
    // aviso de que a atualizacao falhou.
    console.error("Erro ao gerar analise de desempenho:", erro);
    const analise = await carregarAnaliseComLinksValidos(usuarioBase.id);
    return res.render("pages/resultados", {
      numeros,
      analise,
      msgErro: { geral: erro.message || "Nao foi possivel gerar sua analise agora. Tente novamente." },
    });
  }
});

router.get("/premium/assinar", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const msgAviso = req.query.motivo === "expirado"
    ? "Seu premium expirou. Renove para continuar aproveitando os recursos premium."
    : null;

  res.render("pages/premiumAssinar", { planos: PagamentoService.listarPlanos(), msgErro: null, msgAviso });
});

router.post("/premium/checkout", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  try {
    const urlBase = `${req.protocol}://${req.get("host")}`;
    const { urlCheckout } = await PagamentoService.criarCheckout({
      idUsuario: usuarioBase.id,
      planoSlug: req.body.plano,
      urlBase,
    });
    return res.redirect(urlCheckout);
  } catch (erro) {
    console.error("Erro ao criar checkout Mercado Pago:", erro);
    return res.render("pages/premiumAssinar", {
      planos: PagamentoService.listarPlanos(),
      msgErro: { geral: "Nao foi possivel iniciar o pagamento agora. Tente novamente." },
      msgAviso: null,
    });
  }
});

// So mostra uma mensagem - NUNCA concede premium aqui. E so o navegador
// voltando do Mercado Pago, sem garantia nenhuma de pagamento aprovado
// de verdade (aba pode ser fechada, redirect pode ser manipulado). Quem
// concede premium de verdade e o webhook abaixo.
// Nao exige login de proposito. O aluno chega aqui vindo do dominio do
// Mercado Pago, e o cookie de sessao usa SameSite=Strict - ou seja, o
// navegador NAO o envia em navegacao vinda de outro site. Exigir
// autenticacao aqui jogaria pro /login justamente quem acabou de pagar.
// Nao ha risco: a pagina so mostra uma mensagem a partir da query,
// nao expoe dado nenhum do aluno e nao concede premium (quem concede e
// o webhook).
router.get("/premium/retorno", async function (req, res) {
  res.render("pages/premiumRetorno", { status: req.query.status || "pending" });
});

router.get("/premium/historico", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  const pagamentos = await Models.pagamentos.listarPorAluno(usuarioBase.id);
  const historico = pagamentos.map((pagamento) => ({
    ...pagamento,
    dataFormatada: formatarDataLocal(pagamento.criado_em),
    valorFormatado: (pagamento.valor_centavos / 100).toFixed(2).replace(".", ","),
    podeCancelar: pagamento.status === "pendente",
    status: ROTULOS_STATUS_PAGAMENTO[pagamento.status] || { texto: pagamento.status, classe: "pendente" },
  }));

  res.render("pages/premiumHistorico", { historico });
});

router.post("/premium/historico/:id/cancelar", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  await Models.pagamentos.cancelarPendente({
    idPagamento: Number(req.params.id),
    idUsuario: usuarioBase.id,
  });

  return res.redirect("/premium/historico");
});

// Rota publica de proposito (quem chama e o servidor do Mercado Pago,
// nao um navegador de aluno com cookie de sessao) - a seguranca vem da
// validacao de assinatura, nao de autenticacao de sessao.
router.post("/webhooks/mercadopago", async function (req, res) {
  try {
    const assinaturaValida = PagamentoService.validarAssinaturaWebhook({
      xSignature: req.headers["x-signature"],
      xRequestId: req.headers["x-request-id"],
      dataId: req.query["data.id"],
    });

    if (!assinaturaValida) {
      console.error("Webhook Mercado Pago com assinatura invalida ou ausente.");
      return res.status(401).end();
    }

    if (req.body.type !== "payment") {
      return res.status(200).end();
    }

    const { referenciaExterna, status, idTransacaoGateway } =
      await PagamentoService.confirmarPagamento(req.body.data.id);
    const pagamento = await Models.pagamentos.buscarPorReferenciaExterna(referenciaExterna);

    if (!pagamento) {
      console.error("Webhook Mercado Pago: referencia externa desconhecida:", referenciaExterna);
      return res.status(200).end();
    }

    // Idempotencia: o Mercado Pago pode reenviar a mesma notificacao -
    // so concede premium na PRIMEIRA vez que o status vira aprovado.
    if (status === "approved" && pagamento.status !== "aprovado") {
      const conexao = await pool.getConnection();
      try {
        await conexao.beginTransaction();
        await Models.pagamentos.atualizarStatus(
          { referenciaExterna, status: "aprovado", idTransacaoGateway },
          conexao
        );
        await Models.assinaturas.concederPorPeriodo(pagamento.id_usuario, pagamento.dias_premium, conexao);
        await conexao.commit();
      } catch (erroTransacao) {
        await conexao.rollback();
        throw erroTransacao;
      } finally {
        conexao.release();
      }

      // Fora da transacao de proposito: o premium ja foi concedido e
      // confirmado nesse ponto, entao uma falha aqui (ex: enum de tipo
      // desatualizado) nao pode derrubar o pagamento nem disparar um
      // reenvio do webhook pelo Mercado Pago.
      try {
        await Models.notificacoes.criar({
          idUsuario: pagamento.id_usuario,
          tipo: "sistema",
          titulo: "Pagamento aprovado",
          mensagem: `Seu pagamento foi aprovado! Você ganhou ${pagamento.dias_premium} dias de acesso premium.`,
          link: "/premium/historico",
        });
      } catch (erroNotificacao) {
        console.error("Erro ao criar notificacao de pagamento aprovado:", erroNotificacao);
      }
    } else if (status !== "approved" && pagamento.status === "pendente") {
      const mapa = { rejected: "recusado", cancelled: "cancelado", refunded: "estornado" };
      await Models.pagamentos.atualizarStatus({
        referenciaExterna,
        status: mapa[status] || "pendente",
        idTransacaoGateway,
      });
    }

    return res.status(200).end();
  } catch (erro) {
    console.error("Erro ao processar webhook Mercado Pago:", erro);
    return res.status(500).end(); // Mercado Pago tenta de novo depois
  }
});


router.get("/cadastroprofessor", async function (req, res) {
  return renderizarCadastroProfessor(res);
});

router.get("/partepremium", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  if (!(await Models.assinaturas.estaAtiva(usuarioBase.id))) {
    return res.redirect("/premium/assinar");
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

      await registrarAuditoria({
        usuarioBase,
        acao: "criou",
        entidade: "formulario",
        idEntidade: idFormulario,
        descricao: `Gerou um simulado com IA: "${resumirTexto(tema)}" (${professor.materia})`,
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

      await registrarAuditoria({
        usuarioBase,
        acao: "criou",
        entidade: "formulario",
        idEntidade: idFormulario,
        descricao: `Criou um simulado manualmente: "${resumirTexto(titulo)}" (${professor.materia})`,
      });

      return res.redirect(`/simulado/${idFormulario}`);
    } catch (erro) {
      console.error("Erro ao salvar simulado montado manualmente:", erro);
      return res.redirect("/simuladoprofessor");
    }
  }
);

router.post("/simuladoprofessor/:id/excluir", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  try {
    const formulario = await Models.formularios.buscarPorId(req.params.id);

    const resultado = await Models.formularios.excluirDoProfessor({
      id: req.params.id,
      idProfessor: usuarioBase.id,
    });

    if (resultado.affectedRows) {
      await registrarAuditoria({
        usuarioBase,
        acao: "excluiu",
        entidade: "formulario",
        idEntidade: Number(req.params.id),
        descricao: `Excluiu o simulado "${resumirTexto(formulario?.titulo)}" de ${formulario?.materia || "materia removida"}`,
      });
    }
  } catch (erro) {
    console.error("Erro ao excluir simulado do professor:", erro);
  }

  return res.redirect("/simuladoprofessor");
});

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
    videos: videosBase.map((video) => ({
      ...video,
      materiaSlug: slugMateria(video.materia),
      podeExcluir: video.professor_id === usuarioBase.id,
    })),
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

      await registrarAuditoria({
        usuarioBase,
        acao: "criou",
        entidade: "cronograma",
        descricao: `Gerou um cronograma com IA: "${resumirTexto(tema)}" (${professor.materia})`,
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

    await registrarAuditoria({
      usuarioBase,
      acao: "criou",
      entidade: "cronograma",
      descricao: `Criou um cronograma manualmente: "${resumirTexto(titulo)}" (${professor.materia})`,
    });

    return res.redirect(`/cronograma/${codigoLote}`);
  } catch (erro) {
    console.error("Erro ao salvar cronograma manual (professor):", erro);
    return res.redirect("/cronogramaprofessor?erro=manual");
  }
  }
);

// Cronograma publicado = um lote de linhas de Plano_de_Aula (uma por
// evento), por isso a chave aqui e o codigo_lote e nao um id.
router.post("/cronogramaprofessor/:codigoLote/excluir", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  try {
    const lote = await Models.planoAula.buscarLoteDoProfessor({
      codigoLote: req.params.codigoLote,
      idProfessor: usuarioBase.id,
    });

    const resultado = await Models.planoAula.excluirLoteDoProfessor({
      codigoLote: req.params.codigoLote,
      idProfessor: usuarioBase.id,
    });

    if (resultado.affectedRows) {
      await registrarAuditoria({
        usuarioBase,
        acao: "excluiu",
        entidade: "cronograma",
        descricao: `Excluiu o cronograma "${resumirTexto(lote?.titulo_cronograma)}" de ${lote?.materia || "materia removida"} (${resultado.affectedRows} evento${resultado.affectedRows > 1 ? "s" : ""})`,
      });
    }
  } catch (erro) {
    console.error("Erro ao excluir cronograma do professor:", erro);
  }

  return res.redirect("/cronogramaprofessor");
});



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
    // A lista mostra o catalogo inteiro (de todos os professores), mas so
    // da pra excluir o que o professor logado publicou.
    livros: livrosBase.map((livro) => ({
      ...livro,
      materiaSlug: slugMateria(livro.materia),
      podeExcluir: livro.professor_id === usuarioBase.id,
    })),
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

      const idConteudo = await Models.conteudos.criar({
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

      await registrarAuditoria({
        usuarioBase,
        acao: "criou",
        entidade: "conteudo",
        idEntidade: idConteudo || null,
        descricao: `Publicou ${tipo === "video" ? "a video-aula" : "o livro"} "${resumirTexto(titulo)}" de ${professor.materia}`,
      });

      return res.redirect(rotaVolta);
    } catch (erro) {
      console.error("Erro ao cadastrar conteudo:", erro);
      return res.redirect(rotaVolta);
    }
  }
);

// Serve pros dois tipos de Conteudo (livro e video) - a rota de volta muda
// conforme o tipo do que foi apagado.
router.post("/professor/conteudos/:id/excluir", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  let rotaVolta = "/bibliotecaprofessor";

  try {
    const conteudo = await Models.conteudos.buscarPorId(req.params.id);

    if (conteudo?.tipo === "video") {
      rotaVolta = "/videoaulaprofessor";
    }

    const resultado = await Models.conteudos.removerDoProfessor({
      id: req.params.id,
      idProfessor: usuarioBase.id,
    });

    if (resultado.affectedRows) {
      await registrarAuditoria({
        usuarioBase,
        acao: "excluiu",
        entidade: "conteudo",
        idEntidade: Number(req.params.id),
        descricao: `Excluiu ${conteudo?.tipo === "video" ? "a video-aula" : "o livro"} "${resumirTexto(conteudo?.titulo)}" de ${conteudo?.materia || "materia removida"}`,
      });
    }
  } catch (erro) {
    console.error("Erro ao excluir conteudo do professor:", erro);
  }

  return res.redirect(rotaVolta);
});


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

  if (aluno && livro.is_premium && !(await Models.assinaturas.estaAtiva(aluno.id))) {
    return redirecionarFaltaPremium(aluno.id, res);
  }

  res.render("pages/livro", {
    livro,
    usuario,
  });
});

router.post("/livro/:id/denunciar", async function (req, res) {
  const usuarioCookie = lerCookieUsuario(req);

  if (!usuarioCookie) {
    return res.status(401).json({ erro: "Faca login para denunciar um conteudo." });
  }

  const motivo = String(req.body.motivo || "").trim();
  const descricao = String(req.body.descricao || "").trim();

  if (!motivo) {
    return res.status(400).json({ erro: "Selecione um motivo para a denuncia." });
  }

  const livro = await Models.conteudos.buscarPorId(req.params.id);

  if (!livro || livro.tipo !== "livro") {
    return res.status(404).json({ erro: "Livro nao encontrado." });
  }

  try {
    await Models.denuncias.criar({
      idUsuario: usuarioCookie.id,
      tipoConteudo: "conteudo",
      idConteudoAlvo: livro.id,
      motivo,
      descricao,
    });
    return res.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao registrar denuncia de livro:", erro);
    return res.status(500).json({ erro: "Nao foi possivel enviar a denuncia agora." });
  }
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

      await registrarAuditoria({
        usuarioBase,
        acao: "criou",
        entidade: "duvida",
        idEntidade: idDuvida,
        descricao: `Criou uma duvida em ${materia.nome}: "${resumirTexto(duvida)}"`,
      });

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

    // Lido ANTES do DELETE: depois de apagada nao da mais pra saber o texto.
    const duvida = await Models.duvidas.buscarPorId(req.params.id, conexao);

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
    } else {
      await registrarAuditoria({
        usuarioBase,
        acao: "excluiu",
        entidade: "duvida",
        idEntidade: Number(req.params.id),
        descricao: `Excluiu a propria duvida em ${duvida?.materia || "materia removida"}: "${resumirTexto(duvida?.duvida)}"`,
      });
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

      const idResposta = await Models.respostas.criar(
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

      await registrarAuditoria({
        usuarioBase,
        acao: "criou",
        entidade: "resposta",
        idEntidade: idResposta,
        descricao: `Respondeu uma duvida de ${duvida.materia}: "${resumirTexto(resposta)}"`,
      });

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

    const resposta = await Models.respostas.buscarPorId(req.params.id, conexao);

    const resultado = await Models.respostas.excluirDoProfessor(
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

    if (resultado.affectedRows) {
      await registrarAuditoria({
        usuarioBase,
        acao: "excluiu",
        entidade: "resposta",
        idEntidade: Number(req.params.id),
        descricao: `Excluiu a propria resposta para a duvida "${resumirTexto(resposta?.duvida_texto)}"`,
      });
    }
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

    const duvida = await Models.duvidas.buscarPorId(req.params.id, conexao);

    await Models.respostas.excluirPorDuvida(req.params.id, conexao);
    const resultado = await Models.duvidas.excluirPorId(req.params.id, conexao);

    await conexao.commit();

    if (resultado.affectedRows) {
      await registrarAuditoria({
        usuarioBase,
        acao: "excluiu",
        entidade: "duvida",
        idEntidade: Number(req.params.id),
        descricao: `Removeu (moderacao) a duvida de um aluno em ${duvida?.materia || "materia removida"}: "${resumirTexto(duvida?.duvida)}"`,
      });
    }
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

  await registrarAuditoria({
    usuarioBase,
    acao: "editou",
    entidade: "cronograma",
    descricao: "Regerou a propria rotina de estudos (substituiu a rotina padrao anterior)",
  });

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

      await registrarAuditoria({
        usuarioBase,
        acao: "criou",
        entidade: "cronograma",
        descricao: `Adicionou um item ao proprio plano de estudo: "${resumirTexto(descricao)}"`,
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

      await registrarAuditoria({
        usuarioBase,
        acao: "criou",
        entidade: "cronograma",
        descricao: `Gerou um cronograma com IA: "${resumirTexto(tema)}"${materia ? ` (${materia.nome})` : ""}`,
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

      await registrarAuditoria({
        usuarioBase,
        acao: "criou",
        entidade: "cronograma",
        descricao: `Criou um cronograma manualmente: "${resumirTexto(titulo)}"`,
      });

      return res.redirect(`/planoestudo/${codigoLote}`);
    } catch (erro) {
      console.error("Erro ao salvar cronograma manual (aluno):", erro);
      return res.redirect("/planoestudo?erro=manual");
    }
  }
);

// Mesma logica do cronograma do professor: apaga o lote inteiro, nao um
// evento so. Aqui o delete cai no Plano_de_Estudo e o Cronograma vai junto
// por CASCADE (ver nota no model).
router.post("/planoestudo/:codigoLote/excluir", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  try {
    const lote = await Models.planoEstudo.buscarLoteDoAluno({
      codigoLote: req.params.codigoLote,
      idAluno: usuarioBase.id,
    });

    const resultado = await Models.planoEstudo.excluirLoteDoAluno({
      codigoLote: req.params.codigoLote,
      idAluno: usuarioBase.id,
    });

    if (resultado.affectedRows) {
      await registrarAuditoria({
        usuarioBase,
        acao: "excluiu",
        entidade: "cronograma",
        descricao: `Excluiu o proprio cronograma "${resumirTexto(lote?.titulo_cronograma)}" de ${lote?.materia || "materia removida"} (${resultado.affectedRows} evento${resultado.affectedRows > 1 ? "s" : ""})`,
      });
    }
  } catch (erro) {
    console.error("Erro ao excluir cronograma do aluno:", erro);
  }

  return res.redirect("/planoestudo");
});

router.get("/termouso", function (req, res) {
  res.render("pages/termouso");
});

// /editarperfil e /editarprofessor viraram abas dentro de /configuracoes -
// os links antigos (favoritos, e-mails ja enviados) continuam funcionando.
router.get("/editarperfil", function (req, res) {
  res.redirect("/configuracoes");
});

router.get("/editarprofessor", function (req, res) {
  res.redirect("/configuracoes");
});

router.get("/configuracoes", async function (req, res) {
  const usuarioCookie = lerCookieUsuario(req);
  const tipoUsuario = usuarioCookie?.tipo_usuario;

  if (
    !usuarioCookie ||
    (tipoUsuario !== TIPOS_USUARIO.aluno && tipoUsuario !== TIPOS_USUARIO.professor && tipoUsuario !== TIPOS_USUARIO.admin)
  ) {
    return res.redirect("/login");
  }

  const abaInicial = ABAS_CONFIGURACOES.includes(req.query.aba) ? req.query.aba : "perfil";

  const contexto = await montarContextoConfiguracoes(req, tipoUsuario, {
    abaInicial,
    msgSucesso: MENSAGENS_SUCESSO_CONFIGURACOES[req.query.salvo] || null,
  });

  res.render(VIEWS.configuracoes, contexto);
});

// Sem diploma valido (contas antigas com o placeholder
// "diploma_pendente_upload"): o envio vale na hora. Com diploma valido: o
// arquivo novo vai pra coluna diploma_pendente e so substitui o atual quando
// o admin aprovar. Em nenhum caso o professor remove o diploma.
router.post("/configuracoes/diploma", function (req, res, next) {
  if (!usuarioAutenticado(req, TIPOS_USUARIO.professor)) {
    return res.redirect("/login");
  }

  uploadDiploma.single("diploma")(req, res, async function (erroUpload) {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

    const voltarComErro = async (msgErroDiploma) =>
      res.status(400).render(
        VIEWS.configuracoes,
        await montarContextoConfiguracoes(req, TIPOS_USUARIO.professor, { msgErroDiploma })
      );

    try {
      const perfil = await Models.professores.buscarPerfilCompleto(usuarioBase.id);

      if (erroUpload) {
        return voltarComErro(
          erroUpload.code === "LIMIT_FILE_SIZE"
            ? "O diploma deve ter no maximo 5 MB."
            : "Nao foi possivel enviar o diploma."
        );
      }

      if (!req.file) {
        return voltarComErro("Envie o diploma em PDF, JPG ou PNG (ate 5 MB).");
      }

      const diploma = await UploadService.enviarDiploma(req.file.buffer);
      const jaTemDiploma = String(perfil?.diploma || "").includes("|");

      if (!jaTemDiploma) {
        await Models.professores.atualizarDiploma({ diploma, idProfessor: usuarioBase.id });
        return res.redirect("/configuracoes?aba=perfil&salvo=diploma");
      }

      await Models.professores.definirDiplomaPendente({ diplomaPendente: diploma, idProfessor: usuarioBase.id });
      // Reenvio antes da decisao: o pendente anterior nao vale mais.
      if (perfil.diploma_pendente) {
        UploadService.apagarDiploma(perfil.diploma_pendente);
      }

      await registrarAuditoria({
        usuarioBase,
        acao: "editou",
        entidade: "conta",
        idEntidade: usuarioBase.id,
        descricao: "Enviou um novo diploma para aprovacao",
      });

      return res.redirect("/configuracoes?aba=perfil&salvo=diploma_analise");
    } catch (erro) {
      console.error("Erro ao enviar diploma (professor):", erro);
      return voltarComErro("Nao foi possivel enviar o diploma. Tente novamente.");
    }
  });
});
router.get("/configuracoes/diploma", async function (req, res) {
  const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

  if (!usuarioBase) {
    return res.redirect("/login");
  }

  try {
    const perfil = await Models.professores.buscarPerfilCompleto(usuarioBase.id);
    const url = UploadService.urlDiploma(perfil?.diploma);
    if (!url) return res.status(404).send("Nenhum diploma enviado para esta conta.");
    return res.redirect(url);
  } catch (erro) {
    console.error("Erro ao abrir diploma (professor):", erro);
    return res.status(500).send("Nao foi possivel abrir o diploma.");
  }
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

router.get("/api/admin/notificacoes", somenteAdmin, async function (req, res) {
  try {
    const { itens, total } = await Models.admin.buscarNotificacoes();

    return res.json({
      itens: itens.map((item) => ({ ...item, tempo: textoTempoRelativo(item.data) })),
      total,
    });
  } catch (erro) {
    console.error("Erro na API de notificacoes admin:", erro);
    return res.status(500).json({ itens: [], total: 0 });
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


// ========== ROTA CONFIRMACAO DE E-MAIL ==========
router.get("/confirmar-email", async (req, res) => {
  const token = String(req.query.token || "");

  if (!token) {
    const status = req.query.status === "cadastrado" ? "cadastrado" : "erro";
    return res.render(VIEWS.confirmarEmail, { status });
  }

  try {
    const confirmado = await Models.usuarios.confirmarEmailPorToken(token);
    return res.render(VIEWS.confirmarEmail, { status: confirmado ? "sucesso" : "erro" });
  } catch (erro) {
    console.error("Erro ao confirmar e-mail:", erro);
    return res.render(VIEWS.confirmarEmail, { status: "erro" });
  }
});

router.post(
  "/confirmar-email/reenviar",
  body("email").notEmpty().isEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render(VIEWS.confirmarEmail, { status: "erro" });
    }

    const { email } = req.body;

    try {
      const usuario = await Models.usuarios.buscarPorEmail(email);

      if (usuario && !usuario.email_verificado) {
        const { token, expiraEm } = gerarTokenVerificacaoEmail();
        await Models.usuarios.salvarTokenVerificacaoEmail({
          idUsuario: usuario.id_usuario,
          token,
          expiraEm,
        });
        await enviarEmailConfirmacaoSeguro({ nome: usuario.nome, email, token });
      }

      // Sempre mostra a mesma mensagem, exista ou nao a conta, para nao vazar quais e-mails estao cadastrados.
      return res.render(VIEWS.confirmarEmail, { status: "reenviado" });
    } catch (erro) {
      console.error("Erro ao reenviar confirmacao de e-mail:", erro);
      return res.render(VIEWS.confirmarEmail, { status: "erro" });
    }
  }
);

// ========== ROTAS "ESQUECI MINHA SENHA" ==========
router.get("/recuperar-senha", (req, res) => {
  res.render(VIEWS.recuperarSenha, { status: null, msgErro: null, valores: { email: "" } });
});

router.post(
  "/recuperar-senha",
  body("email")
    .trim()
    .notEmpty().withMessage("Informe seu e-mail.")
    .isEmail().withMessage("Informe um e-mail valido."),
  async (req, res) => {
    const errors = validationResult(req);
    const email = String(req.body.email || "").trim();

    if (!errors.isEmpty()) {
      const { msgErro } = montarErrosValidacao(errors);
      return res.render(VIEWS.recuperarSenha, { status: null, msgErro, valores: { email } });
    }

    try {
      const usuario = await Models.usuarios.buscarPorEmail(email);

      if (usuario) {
        const { token, expiraEm } = gerarTokenRedefinicaoSenha();
        await Models.usuarios.salvarTokenRedefinicaoSenha({
          idUsuario: usuario.id_usuario,
          token,
          expiraEm,
        });
        await enviarEmailRedefinicaoSenhaSeguro({ nome: usuario.nome, email, token });
      }

      // Mesma resposta exista ou nao a conta, senao a tela vira um detector de
      // quais e-mails estao cadastrados (mesma decisao ja tomada no reenvio de
      // confirmacao de e-mail).
      return res.render(VIEWS.recuperarSenha, {
        status: "enviado",
        msgErro: null,
        valores: { email: "" },
      });
    } catch (erro) {
      console.error("Erro ao iniciar redefinicao de senha:", erro);
      return res.render(VIEWS.recuperarSenha, {
        status: null,
        msgErro: { geral: "Nao foi possivel enviar o link agora. Tente novamente." },
        valores: { email },
      });
    }
  }
);

router.get("/redefinir-senha", async (req, res) => {
  const token = String(req.query.token || "");

  if (!token) {
    return res.render(VIEWS.redefinirSenha, { tokenValido: false, token: "", msgErro: null });
  }

  try {
    const tokenValido = await Models.usuarios.tokenRedefinicaoSenhaValido(token);
    return res.render(VIEWS.redefinirSenha, { tokenValido, token, msgErro: null });
  } catch (erro) {
    console.error("Erro ao validar token de redefinicao:", erro);
    return res.render(VIEWS.redefinirSenha, { tokenValido: false, token: "", msgErro: null });
  }
});

router.post(
  "/redefinir-senha",

  body("senha")
    .notEmpty().withMessage("A senha e obrigatoria.")
    .isLength({ min: 8, max: 15 }).withMessage("A senha deve ter entre 8 e 15 caracteres!"),
  body("confirmar-senha").custom((value, { req }) => {
    if (value !== req.body.senha) {
      throw new Error("As senhas nao conferem!");
    }
    return true;
  }),

  async (req, res) => {
    const token = String(req.body.token || "");
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const { msgErro } = montarErrosValidacao(errors);
      return res.render(VIEWS.redefinirSenha, { tokenValido: true, token, msgErro });
    }

    try {
      const senhaCriptografada = await bcrypt.hash(req.body.senha, 10);
      const redefinida = await Models.usuarios.redefinirSenhaPorToken({
        token,
        senhaCriptografada,
      });

      if (!redefinida) {
        return res.render(VIEWS.redefinirSenha, { tokenValido: false, token: "", msgErro: null });
      }

      return res.redirect("/login?senha=redefinida");
    } catch (erro) {
      console.error("Erro ao redefinir senha:", erro);
      return res.render(VIEWS.redefinirSenha, {
        tokenValido: true,
        token,
        msgErro: { geral: "Nao foi possivel redefinir a senha. Tente novamente." },
      });
    }
  }
);

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

      const { idUsuario, tokenVerificacaoEmail } = await cadastrarUsuarioBase(conexao, {
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
          mensagem:
            "Seu cadastro foi criado com sucesso. Conheça a plataforma. Enviamos um e-mail de confirmação - se não encontrar na caixa de entrada, confira o spam.",
          link: "/sobre",
        },
        conexao
      );
      await conexao.commit();

      await registrarAuditoria({
        usuarioBase: { id: idUsuario, tipo_usuario: TIPOS_USUARIO.aluno },
        acao: "criou",
        entidade: "conta",
        idEntidade: idUsuario,
        descricao: "Criou a propria conta de aluno",
      });

      enviarEmailConfirmacaoSeguro({ nome, email, token: tokenVerificacaoEmail });

      return res.redirect("/confirmar-email?status=cadastrado");
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

  function (req, res, next) {
    uploadDiploma.single("diploma")(req, res, function (erro) {
      if (!erro) return next();
      const msg =
        erro.code === "LIMIT_FILE_SIZE"
          ? "O diploma deve ter no maximo 5 MB."
          : "Nao foi possivel enviar o diploma.";
      return renderizarCadastroProfessor(res, req.body, { diploma: msg });
    });
  },

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
    if (!req.file) {
      return renderizarCadastroProfessor(res, req.body, {
        diploma: "Envie o diploma em PDF, JPG ou PNG (ate 5 MB).",
      });
    }

    let diploma;
    try {
      diploma = await UploadService.enviarDiploma(req.file.buffer);
    } catch (erro) {
      console.error("Erro ao enviar diploma:", erro);
      return renderizarCadastroProfessor(res, req.body, {
        diploma: "Nao foi possivel enviar o diploma. Tente novamente.",
      });
    }

    const conexao = await pool.getConnection();

    try {
      await conexao.beginTransaction();

      if (await emailJaCadastrado(conexao, email)) {
        await conexao.rollback();
        return renderizarCadastroProfessor(res, req.body, {
          email: "Este e-mail ja esta cadastrado.",
        });
      }

      const { idUsuario, tokenVerificacaoEmail } = await cadastrarUsuarioBase(conexao, {
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
          mensagem:
            "Seu cadastro de professor foi criado com sucesso. Enviamos um e-mail de confirmação - se não encontrar na caixa de entrada, confira o spam.",
          link: "/sobre",
        },
        conexao
      );
      await conexao.commit();

      await registrarAuditoria({
        usuarioBase: { id: idUsuario, tipo_usuario: TIPOS_USUARIO.professor },
        acao: "criou",
        entidade: "conta",
        idEntidade: idUsuario,
        descricao: "Criou a propria conta de professor",
      });

      enviarEmailConfirmacaoSeguro({ nome: nomeCompleto, email, token: tokenVerificacaoEmail });

      return res.redirect("/confirmar-email?status=cadastrado");
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
  const aviso =
    req.query.senha === "redefinida"
      ? "Senha redefinida com sucesso! Entre com a nova senha."
      : null;

  renderizarLogin(res, VALORES_INICIAIS_LOGIN, {}, aviso);
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

      if (!usuario.email_verificado) {
        return renderizarLogin(res, req.body, {
          geral:
            'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada (ou spam), ou <a href="/confirmar-email">solicite um novo link de confirmação</a>.',
        });
      }

      criarCookieUsuario(res, {
        id: usuario.id_usuario,
        nome: usuario.nome,
        email: usuario.email,
        tipo_usuario: usuario.tipo_usuario,
      });

      Models.usuarios.atualizarUltimoLogin(usuario.id_usuario).catch((erro) => {
        console.error("Erro ao atualizar ultimo_login:", erro);
      });

      return res.redirect(rotaInicialPorTipoUsuario(usuario.tipo_usuario));
    } catch (erro) {
      console.error("Erro ao fazer login:", erro);

      return renderizarLogin(res, req.body, {
        geral: "Nao foi possivel fazer login agora. Tente novamente.",
      });
    }
  }
);


// ========== ROTAS POST DA PAGINA DE CONFIGURACOES (integradas ao banco) ==========
// Aba "Perfil" (aluno). A senha saiu daqui - agora e a aba "Seguranca" (POST /configuracoes/senha).
router.post(
  "/editarperfil",

  uploadConteudo.single("avatar"),

  body("nome").trim().notEmpty().withMessage("O nome e obrigatorio!"),
  body("email").trim().notEmpty().withMessage("O e-mail e obrigatorio!").isEmail().withMessage("Digite um e-mail valido!"),
  body("serie").notEmpty().withMessage("A serie escolar e obrigatoria!"),

  async (req, res) => {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.aluno);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const { erroValidacao, msgErro } = montarErrosValidacao(errors);

      const contexto = await montarContextoConfiguracoes(req, TIPOS_USUARIO.aluno, {
        abaInicial: "perfil",
        valoresPerfil: { ...req.body },
        erroValidacaoPerfil: erroValidacao,
        msgErroPerfil: msgErro,
      });

      return res.render(VIEWS.configuracoes, contexto);
    }

    const { nome, email, serie } = req.body;
    const conexao = await pool.getConnection();

    try {
      await conexao.beginTransaction();

      if (await emailPertenceAOutroUsuario(email, usuarioBase.id)) {
        await conexao.rollback();

        const contexto = await montarContextoConfiguracoes(req, TIPOS_USUARIO.aluno, {
          abaInicial: "perfil",
          valoresPerfil: { ...req.body },
          erroValidacaoPerfil: { email: "erro" },
          msgErroPerfil: { email: "Este e-mail ja esta cadastrado em outra conta." },
        });

        return res.render(VIEWS.configuracoes, contexto);
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

      await conexao.commit();

      criarCookieUsuario(res, {
        ...usuarioBase,
        nome,
        email,
        tipo_usuario: TIPOS_USUARIO.aluno,
      });

      await registrarAuditoria({
        usuarioBase,
        acao: "editou",
        entidade: "conta",
        idEntidade: usuarioBase.id,
        descricao: `Editou o proprio perfil de aluno${req.file ? " (incluindo a foto)" : ""}`,
      });

      return res.redirect("/configuracoes?salvo=perfil");
    } catch (erro) {
      await conexao.rollback();
      console.error("Erro ao editar perfil do aluno:", erro);

      const contexto = await montarContextoConfiguracoes(req, TIPOS_USUARIO.aluno, {
        abaInicial: "perfil",
        valoresPerfil: { ...req.body },
        msgErroPerfil: { geral: "Nao foi possivel salvar as alteracoes. Tente novamente." },
      });

      return res.render(VIEWS.configuracoes, contexto);
    } finally {
      conexao.release();
    }
  }
);

// Aba "Perfil" (professor).
router.post(
  "/editarprofessor",

  uploadConteudo.single("avatar"),

  body("nome").trim().notEmpty().withMessage("O nome e obrigatorio!"),
  body("email").trim().notEmpty().withMessage("O e-mail e obrigatorio!").isEmail().withMessage("Digite um e-mail valido!"),

  async (req, res) => {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.professor);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const { erroValidacao, msgErro } = montarErrosValidacao(errors);

      const contexto = await montarContextoConfiguracoes(req, TIPOS_USUARIO.professor, {
        abaInicial: "perfil",
        valoresPerfil: { ...req.body },
        erroValidacaoPerfil: erroValidacao,
        msgErroPerfil: msgErro,
      });

      return res.render(VIEWS.configuracoes, contexto);
    }

    const { nome, email } = req.body;
    const conexao = await pool.getConnection();

    try {
      await conexao.beginTransaction();

      if (await emailPertenceAOutroUsuario(email, usuarioBase.id)) {
        await conexao.rollback();

        const contexto = await montarContextoConfiguracoes(req, TIPOS_USUARIO.professor, {
          abaInicial: "perfil",
          valoresPerfil: { ...req.body },
          erroValidacaoPerfil: { email: "erro" },
          msgErroPerfil: { email: "Este e-mail ja esta cadastrado em outra conta." },
        });

        return res.render(VIEWS.configuracoes, contexto);
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

      await conexao.commit();

      criarCookieUsuario(res, {
        ...usuarioBase,
        nome,
        email,
        tipo_usuario: TIPOS_USUARIO.professor,
      });

      await registrarAuditoria({
        usuarioBase,
        acao: "editou",
        entidade: "conta",
        idEntidade: usuarioBase.id,
        descricao: `Editou o proprio perfil de professor${req.file ? " (incluindo a foto)" : ""}`,
      });

      return res.redirect("/configuracoes?salvo=perfil");
    } catch (erro) {
      await conexao.rollback();
      console.error("Erro ao editar perfil do professor:", erro);

      const contexto = await montarContextoConfiguracoes(req, TIPOS_USUARIO.professor, {
        abaInicial: "perfil",
        valoresPerfil: { ...req.body },
        msgErroPerfil: { geral: "Nao foi possivel salvar as alteracoes. Tente novamente." },
      });

      return res.render(VIEWS.configuracoes, contexto);
    } finally {
      conexao.release();
    }
  }
);

// Aba "Perfil" (admin). Sem tabela de subtipo (Aluno/Professor) - so nome,
// email e foto direto na Usuario, igual ao professor menos a materia.
router.post(
  "/editaradmin",

  uploadConteudo.single("avatar"),

  body("nome").trim().notEmpty().withMessage("O nome e obrigatorio!"),
  body("email").trim().notEmpty().withMessage("O e-mail e obrigatorio!").isEmail().withMessage("Digite um e-mail valido!"),

  async (req, res) => {
    const usuarioBase = usuarioAutenticado(req, TIPOS_USUARIO.admin);

    if (!usuarioBase) {
      return res.redirect("/login");
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const { erroValidacao, msgErro } = montarErrosValidacao(errors);

      const contexto = await montarContextoConfiguracoes(req, TIPOS_USUARIO.admin, {
        abaInicial: "perfil",
        valoresPerfil: { ...req.body },
        erroValidacaoPerfil: erroValidacao,
        msgErroPerfil: msgErro,
      });

      return res.render(VIEWS.configuracoes, contexto);
    }

    const { nome, email } = req.body;
    const conexao = await pool.getConnection();

    try {
      await conexao.beginTransaction();

      if (await emailPertenceAOutroUsuario(email, usuarioBase.id)) {
        await conexao.rollback();

        const contexto = await montarContextoConfiguracoes(req, TIPOS_USUARIO.admin, {
          abaInicial: "perfil",
          valoresPerfil: { ...req.body },
          erroValidacaoPerfil: { email: "erro" },
          msgErroPerfil: { email: "Este e-mail ja esta cadastrado em outra conta." },
        });

        return res.render(VIEWS.configuracoes, contexto);
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

      await conexao.commit();

      criarCookieUsuario(res, {
        ...usuarioBase,
        nome,
        email,
        tipo_usuario: TIPOS_USUARIO.admin,
      });

      await registrarAuditoria({
        usuarioBase,
        acao: "editou",
        entidade: "conta",
        idEntidade: usuarioBase.id,
        descricao: `Editou o proprio perfil de admin${req.file ? " (incluindo a foto)" : ""}`,
      });

      return res.redirect("/configuracoes?salvo=perfil");
    } catch (erro) {
      await conexao.rollback();
      console.error("Erro ao editar perfil do admin:", erro);

      const contexto = await montarContextoConfiguracoes(req, TIPOS_USUARIO.admin, {
        abaInicial: "perfil",
        valoresPerfil: { ...req.body },
        msgErroPerfil: { geral: "Nao foi possivel salvar as alteracoes. Tente novamente." },
      });

      return res.render(VIEWS.configuracoes, contexto);
    } finally {
      conexao.release();
    }
  }
);

// Aba "Seguranca" - troca de senha (funciona pra aluno e professor).
router.post(
  "/configuracoes/senha",

  body("senha")
    .notEmpty().withMessage("A senha e obrigatoria.")
    .isLength({ min: 8, max: 15 }).withMessage("A senha deve ter entre 8 e 15 caracteres!"),
  body("confirmar-senha").custom((value, { req }) => {
    if (value !== req.body.senha) {
      throw new Error("As senhas nao conferem!");
    }
    return true;
  }),

  async (req, res) => {
    const usuarioCookie = lerCookieUsuario(req);
    const tipoUsuario = usuarioCookie?.tipo_usuario;

    if (
      !usuarioCookie ||
      (tipoUsuario !== TIPOS_USUARIO.aluno && tipoUsuario !== TIPOS_USUARIO.professor && tipoUsuario !== TIPOS_USUARIO.admin)
    ) {
      return res.redirect("/login");
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const { erroValidacao, msgErro } = montarErrosValidacao(errors);

      const contexto = await montarContextoConfiguracoes(req, tipoUsuario, {
        abaInicial: "seguranca",
        erroValidacaoSenha: erroValidacao,
        msgErroSenha: msgErro,
      });

      return res.render(VIEWS.configuracoes, contexto);
    }

    try {
      await atualizarSenhaUsuario(null, {
        senha: req.body.senha,
        idUsuario: usuarioCookie.id,
      });

      await registrarAuditoria({
        usuarioBase: usuarioCookie,
        acao: "editou",
        entidade: "conta",
        idEntidade: usuarioCookie.id,
        descricao: "Alterou a propria senha",
      });

      return res.redirect("/configuracoes?aba=seguranca&salvo=senha");
    } catch (erro) {
      console.error("Erro ao alterar senha:", erro);

      const contexto = await montarContextoConfiguracoes(req, tipoUsuario, {
        abaInicial: "seguranca",
        msgErroSenha: { geral: "Nao foi possivel alterar a senha. Tente novamente." },
      });

      return res.render(VIEWS.configuracoes, contexto);
    }
  }
);

// Aba "Seguranca" - desativar a propria conta (login fica bloqueado ate reativacao manual).
router.post("/configuracoes/desativar", async function (req, res) {
  const usuarioCookie = lerCookieUsuario(req);
  const tipoUsuario = usuarioCookie?.tipo_usuario;

  if (
    !usuarioCookie ||
    (tipoUsuario !== TIPOS_USUARIO.aluno && tipoUsuario !== TIPOS_USUARIO.professor)
  ) {
    return res.redirect("/login");
  }

  try {
    await Models.usuarios.alterarStatusConta({
      status: STATUS_CONTA.inativo,
      idUsuario: usuarioCookie.id,
    });

    await registrarAuditoria({
      usuarioBase: usuarioCookie,
      acao: "editou",
      entidade: "conta",
      idEntidade: usuarioCookie.id,
      descricao: "Desativou a propria conta",
    });

    limparCookieUsuario(res);
    return res.redirect("/login");
  } catch (erro) {
    console.error("Erro ao desativar conta:", erro);

    const contexto = await montarContextoConfiguracoes(req, tipoUsuario, {
      abaInicial: "seguranca",
      msgErroConta: "Nao foi possivel desativar a conta. Tente novamente.",
    });

    return res.render(VIEWS.configuracoes, contexto);
  }
});

// Aba "Seguranca" - exclusao definitiva da propria conta.
router.post("/configuracoes/excluir", async function (req, res) {
  const usuarioCookie = lerCookieUsuario(req);
  const tipoUsuario = usuarioCookie?.tipo_usuario;

  if (
    !usuarioCookie ||
    (tipoUsuario !== TIPOS_USUARIO.aluno && tipoUsuario !== TIPOS_USUARIO.professor)
  ) {
    return res.redirect("/login");
  }

  try {
    await excluirContaAnonimizandoAuditoria(usuarioCookie.id);

    // Depois da exclusao a conta nao existe mais (FK do log), entao o
    // evento entra sem vinculo e ja com o nome anonimizado, no mesmo
    // formato das linhas antigas dessa pessoa ("Conta removida (#id)").
    await registrarAuditoria({
      usuarioBase: { id: null, tipo_usuario: tipoUsuario },
      nomeUsuario: `Conta removida (#${usuarioCookie.id})`,
      acao: "excluiu",
      entidade: "conta",
      descricao: `Excluiu a propria conta de ${tipoUsuario}`,
    });

    limparCookieUsuario(res);
    return res.redirect("/login");
  } catch (erro) {
    console.error("Erro ao excluir a propria conta:", erro);

    const contexto = await montarContextoConfiguracoes(req, tipoUsuario, {
      abaInicial: "seguranca",
      msgErroConta: "Nao foi possivel excluir a conta. Tente novamente.",
    });

    return res.render(VIEWS.configuracoes, contexto);
  }
});

// Aba "Notificacoes" - liga/desliga cada tipo de aviso. Como o padrao e
// ligado, so grava linha pro que veio desmarcado no formulario.
router.post("/configuracoes/notificacoes", async function (req, res) {
  const usuarioCookie = lerCookieUsuario(req);
  const tipoUsuario = usuarioCookie?.tipo_usuario;

  if (
    !usuarioCookie ||
    (tipoUsuario !== TIPOS_USUARIO.aluno && tipoUsuario !== TIPOS_USUARIO.professor)
  ) {
    return res.redirect("/login");
  }

  const tiposPermitidos = TIPOS_NOTIFICACAO_POR_PERFIL[tipoUsuario] || [];

  try {
    for (const { tipo } of tiposPermitidos) {
      // checkbox desmarcado nao vem no body - ausencia significa desligado
      const ativo = Boolean(req.body[`notificacao_${tipo}`]);

      await Models.preferenciasNotificacao.definir({
        idUsuario: usuarioCookie.id,
        tipo,
        ativo,
      });
    }

    return res.redirect("/configuracoes?aba=notificacoes&salvo=notificacoes");
  } catch (erro) {
    console.error("Erro ao salvar preferencias de notificacao:", erro);

    const contexto = await montarContextoConfiguracoes(req, tipoUsuario, {
      abaInicial: "notificacoes",
      msgErroConta: "Não foi possível salvar suas preferências agora. Tente novamente.",
    });

    return res.render(VIEWS.configuracoes, contexto);
  }
});

// Aba "Privacidade" - visibilidade do nome no forum.
router.post("/configuracoes/privacidade", async function (req, res) {
  const usuarioCookie = lerCookieUsuario(req);
  const tipoUsuario = usuarioCookie?.tipo_usuario;

  if (
    !usuarioCookie ||
    (tipoUsuario !== TIPOS_USUARIO.aluno && tipoUsuario !== TIPOS_USUARIO.professor)
  ) {
    return res.redirect("/login");
  }

  try {
    await Models.usuarios.atualizarPerfilPublico({
      perfilPublico: Boolean(req.body.perfil_publico),
      idUsuario: usuarioCookie.id,
    });
    await Models.usuarios.atualizarFotoPublica({
      fotoPublica: Boolean(req.body.foto_publica),
      idUsuario: usuarioCookie.id,
    });

    return res.redirect("/configuracoes?aba=privacidade&salvo=privacidade");
  } catch (erro) {
    console.error("Erro ao salvar preferencias de privacidade:", erro);

    const contexto = await montarContextoConfiguracoes(req, tipoUsuario, {
      abaInicial: "privacidade",
      msgErroConta: "Não foi possível salvar suas preferências agora. Tente novamente.",
    });

    return res.render(VIEWS.configuracoes, contexto);
  }
});

// Aba "Privacidade" - exportacao dos proprios dados (LGPD). So le o que
// ja existe nas tabelas atuais, sem precisar de coluna/tabela nova.
router.get("/configuracoes/exportar-dados", async function (req, res) {
  const usuarioCookie = lerCookieUsuario(req);
  const tipoUsuario = usuarioCookie?.tipo_usuario;

  if (
    !usuarioCookie ||
    (tipoUsuario !== TIPOS_USUARIO.aluno && tipoUsuario !== TIPOS_USUARIO.professor && tipoUsuario !== TIPOS_USUARIO.admin)
  ) {
    return res.redirect("/login");
  }

  const idUsuario = usuarioCookie.id;

  try {
    const dados = {
      gerado_em: new Date().toISOString(),
      tipo_conta: tipoUsuario,
    };

    if (tipoUsuario === TIPOS_USUARIO.aluno) {
      const [
        conta,
        duvidasEnviadas,
        redacoesResumo,
        planoEstudoAvulso,
        cronogramasGerados,
        pagamentos,
        assinaturaAtiva,
        jaTevePremium,
        notificacoes,
        analiseDesempenho,
      ] = await Promise.all([
        Models.alunos.buscarPerfilCompleto(idUsuario),
        Models.duvidas.listarPorAluno(idUsuario),
        Models.redacoes.listarPorAluno(idUsuario),
        Models.planoEstudo.listarPorAluno(idUsuario),
        Models.planoEstudo.listarCronogramasGerados(idUsuario),
        Models.pagamentos.listarPorAluno(idUsuario),
        Models.assinaturas.buscarAtivaDetalhe(idUsuario),
        Models.assinaturas.jaTevePremium(idUsuario),
        Models.notificacoes.listarPorUsuario(idUsuario, 5000),
        Models.resultados.buscarAnalise(idUsuario),
      ]);

      // redacoes.listarPorAluno so traz um resumo (sem o texto/correcao
      // completos) - busca cada uma inteira, ja que sao poucas por aluno.
      const redacoesCompletas = await Promise.all(
        redacoesResumo.map((r) => Models.redacoes.buscarPorId(r.id_redacao))
      );

      dados.conta = conta;
      dados.duvidas_enviadas = duvidasEnviadas;
      dados.redacoes = redacoesCompletas.filter(Boolean);
      dados.plano_de_estudo_itens_avulsos = planoEstudoAvulso;
      dados.cronogramas_gerados_por_ia = cronogramasGerados;
      dados.pagamentos = pagamentos;
      dados.assinatura_premium = {
        ativa_no_momento: Boolean(assinaturaAtiva),
        detalhe: assinaturaAtiva,
        ja_teve_premium_algum_dia: jaTevePremium,
      };
      dados.notificacoes = notificacoes;
      dados.analise_de_desempenho = analiseDesempenho;
    } else if (tipoUsuario === TIPOS_USUARIO.admin) {
      // Admin nao produz conteudo proprio nem tem subtipo - a exportacao
      // e so a linha da conta mesmo.
      dados.conta = await Models.usuarios.buscarPerfilCompleto(idUsuario);
    } else {
      const [conta, duvidasDaMateria, respostasDadas, planosDeAula, notificacoes] =
        await Promise.all([
          Models.professores.buscarPerfilCompleto(idUsuario),
          Models.duvidas.listarPorProfessor(idUsuario),
          Models.respostas.listarPorProfessor(idUsuario),
          Models.planoAula.listarCronogramasPorProfessor(idUsuario),
          Models.notificacoes.listarPorUsuario(idUsuario, 5000),
        ]);

      dados.conta = conta;
      dados.duvidas_da_sua_materia = duvidasDaMateria;
      dados.respostas_que_voce_deu = respostasDadas;
      dados.planos_de_aula_publicados = planosDeAula;
      dados.notificacoes = notificacoes;
    }

    const nomeArquivo = `meus-dados-primia-${idUsuario}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
    return res.send(JSON.stringify(dados, null, 2));
  } catch (erro) {
    console.error("Erro ao exportar dados do usuario:", erro);

    const contexto = await montarContextoConfiguracoes(req, tipoUsuario, {
      abaInicial: "privacidade",
      msgErroConta: "Nao foi possivel gerar sua exportacao de dados agora. Tente novamente.",
    });

    return res.render(VIEWS.configuracoes, contexto);
  }
});

module.exports = router;







