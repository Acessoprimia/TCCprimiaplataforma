// Monta a grade semanal (dias nas colunas, horarios nas linhas) e gera a
// rotina generica do aluno gratuito.
//
// Regra importante da grade: as LINHAS de horario sao derivadas dos
// horarios que realmente existem nos dados. Antes a tela usava uma faixa
// fixa de 07:00 as 19:00 e qualquer evento fora disso simplesmente
// sumia da tela (era o motivo dos cronogramas de IA aparecerem vazios,
// porque a IA colocava tudo as 19:00). Derivando as linhas do proprio
// dado, nenhum evento pode ficar invisivel.

const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
const DIAS_SEMANA_ABREV = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

const CORES_ATIVIDADE = Object.freeze({
  estudo: "#A398D1",
  exercicios: "#FF9466",
  revisao: "#63C7B2",
  simulado: "#EF4444",
  aula: "#A398D1",
});

const ROTULOS_ATIVIDADE = Object.freeze({
  estudo: "Estudo",
  exercicios: "Exercícios",
  revisao: "Revisão",
  simulado: "Simulado",
  aula: "Aula",
});

// Rotina base do cronograma generico: manha e tarde, com o intervalo de
// almoco (12h-14h) ficando naturalmente vazio na grade.
const BLOCOS_ROTINA_GENERICA = Object.freeze([
  { inicio: "08:00", fim: "09:00" },
  { inicio: "09:00", fim: "10:00" },
  { inicio: "10:00", fim: "11:00" },
  { inicio: "14:00", fim: "15:00" },
  { inicio: "15:00", fim: "16:00" },
  { inicio: "16:00", fim: "17:00" },
]);

// Cada materia percorre esse ciclo na ordem em que aparece na semana.
// Amarrar o tipo a OCORRENCIA DA MATERIA (e nao ao indice do bloco) e o
// que garante variedade - com tipo derivado de indice por aritmetica
// modular, materia em quantidade multipla do ciclo cai sempre no mesmo
// tipo.
//
// Exercicios e simulado sao premium (mesmo pacote que ja gate exercicios/
// simulados/videoaulas no restante da plataforma); aluno gratuito so
// tem estudo e revisao no cronograma generico.
const CICLO_ATIVIDADE_PREMIUM = Object.freeze(["estudo", "exercicios", "revisao"]);
const CICLO_ATIVIDADE_GRATIS = Object.freeze(["estudo", "revisao"]);

// Janela de horarios possiveis pra um cronograma gerado por IA: 4 blocos
// de manha (08h-12h) + 4 de tarde (14h-18h), sempre pulando o almoco. E
// o teto de quantos eventos cabem num unico dia sem virar rotina irreal
// - usado tanto pro "diario" (tudo num dia so) quanto pra distribuir
// quantos blocos por dia o "semanal" recebe.
const JANELA_HORARIOS_IA = Object.freeze([
  { hora_inicio: "08:00", hora_fim: "09:00" },
  { hora_inicio: "09:00", hora_fim: "10:00" },
  { hora_inicio: "10:00", hora_fim: "11:00" },
  { hora_inicio: "11:00", hora_fim: "12:00" },
  { hora_inicio: "14:00", hora_fim: "15:00" },
  { hora_inicio: "15:00", hora_fim: "16:00" },
  { hora_inicio: "16:00", hora_fim: "17:00" },
  { hora_inicio: "17:00", hora_fim: "18:00" },
]);

function paraDataLocal(texto) {
  const [ano, mes, dia] = String(texto).split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function formatarISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarCurta(data) {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}`;
}

// Corta "08:00:00" (TIME do MySQL) pra "08:00", que e o formato usado
// como chave de linha da grade.
function normalizarHora(hora) {
  if (!hora) return null;
  const partes = String(hora).split(":");
  if (partes.length < 2) return null;
  return `${partes[0].padStart(2, "0")}:${partes[1]}`;
}

function somarUmaHora(hora) {
  const [h, m] = hora.split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Segunda-feira da semana da data informada (usada pra agrupar
// cronogramas que passam de uma semana em varias grades).
function segundaDaSemana(data) {
  const copia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const diaSemana = copia.getDay();
  const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana;
  copia.setDate(copia.getDate() + deslocamento);
  return copia;
}

function proximosDiasUteis(quantidade, dataBase) {
  const dias = [];
  const cursor = dataBase ? new Date(dataBase) : new Date();

  while (dias.length < quantidade) {
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      dias.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dias;
}

// eventos: [{ data:'YYYY-MM-DD', horaInicio, horaFim, materia, atividade,
//             tipoAtividade, corPrioridade }]
function montarGrade(eventos) {
  const normalizados = [];

  for (const evento of eventos) {
    const horaInicio = normalizarHora(evento.horaInicio);
    if (!evento.data || !horaInicio) continue;

    normalizados.push({
      ...evento,
      horaInicio,
      horaFim: normalizarHora(evento.horaFim) || somarUmaHora(horaInicio),
      cor: CORES_ATIVIDADE[evento.tipoAtividade] || CORES_ATIVIDADE.estudo,
      rotuloAtividade:
        evento.atividade || ROTULOS_ATIVIDADE[evento.tipoAtividade] || ROTULOS_ATIVIDADE.estudo,
    });
  }

  if (normalizados.length === 0) {
    return { horarios: [], semanas: [], vazia: true };
  }

  // LINHAS: todos os horarios de inicio que existem de verdade nos dados.
  const horariosMap = new Map();
  for (const evento of normalizados) {
    const atual = horariosMap.get(evento.horaInicio);
    if (!atual || evento.horaFim > atual) {
      horariosMap.set(evento.horaInicio, evento.horaFim);
    }
  }

  const horarios = [...horariosMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([inicio, fim]) => ({ inicio, fim, rotulo: `${inicio} – ${fim}` }));

  // COLUNAS: agrupadas por semana, pra cronograma que passa de 5 dias
  // nao esconder nada.
  const semanasMap = new Map();

  for (const evento of normalizados) {
    const data = paraDataLocal(evento.data);
    const chaveSemana = formatarISO(segundaDaSemana(data));

    if (!semanasMap.has(chaveSemana)) {
      semanasMap.set(chaveSemana, { diasComEvento: new Set(), celulas: new Map() });
    }

    const semana = semanasMap.get(chaveSemana);
    semana.diasComEvento.add(evento.data);

    const chaveCelula = `${evento.data}|${evento.horaInicio}`;
    if (!semana.celulas.has(chaveCelula)) {
      semana.celulas.set(chaveCelula, []);
    }
    semana.celulas.get(chaveCelula).push(evento);
  }

  const semanas = [...semanasMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chaveSemana, dados]) => {
      const segunda = paraDataLocal(chaveSemana);

      // Segunda a sexta sempre aparecem (visual de grade escolar); fim de
      // semana so entra na grade se tiver evento de verdade nele.
      const dias = [];
      for (let i = 0; i < 7; i++) {
        const dia = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + i);
        const iso = formatarISO(dia);
        const ehFimDeSemana = dia.getDay() === 0 || dia.getDay() === 6;

        if (ehFimDeSemana && !dados.diasComEvento.has(iso)) continue;

        dias.push({
          iso,
          nome: DIAS_SEMANA[dia.getDay()],
          abrev: DIAS_SEMANA_ABREV[dia.getDay()],
          dataCurta: formatarCurta(dia),
        });
      }

      const celulas = {};
      for (const [chave, lista] of dados.celulas.entries()) {
        celulas[chave] = lista;
      }

      return {
        rotulo: `Semana de ${formatarCurta(segunda)}`,
        dias,
        celulas,
      };
    });

  return { horarios, semanas, vazia: false, mostrarRotuloSemana: semanas.length > 1 };
}

// Distribui as materias por dia util E por bloco de horario, variando o
// tipo de atividade. O stride (blocos+1) evita que uma materia caia
// sempre no mesmo bloco/tipo quando a quantidade de materias e multipla
// da quantidade de blocos.
//
// ehPremium controla QUAIS tipos de atividade podem aparecer: exercicios
// e simulado sao premium, entao o aluno gratuito so recebe estudo/revisao.
function gerarRotinaGenerica(materias, diasUteis, ehPremium) {
  if (materias.length === 0) return [];

  const itens = [];
  const ocorrenciasPorMateria = new Map();
  const ciclo = ehPremium ? CICLO_ATIVIDADE_PREMIUM : CICLO_ATIVIDADE_GRATIS;

  diasUteis.forEach((dia, indiceDia) => {
    const ehSexta = dia.getDay() === 5;

    BLOCOS_ROTINA_GENERICA.forEach((bloco, indiceBloco) => {
      const posicao = indiceDia * BLOCOS_ROTINA_GENERICA.length + indiceBloco;
      const materia = materias[posicao % materias.length];

      const ocorrencia = ocorrenciasPorMateria.get(materia.id_materia) || 0;
      ocorrenciasPorMateria.set(materia.id_materia, ocorrencia + 1);

      // Fecha a semana com um simulado no ultimo bloco da sexta (so pra
      // quem tem simulado no plano).
      const ehUltimoBloco = indiceBloco === BLOCOS_ROTINA_GENERICA.length - 1;
      const tipo =
        ehPremium && ehSexta && ehUltimoBloco
          ? "simulado"
          : ciclo[ocorrencia % ciclo.length];

      itens.push({
        idMateria: materia.id_materia,
        materia: materia.nome,
        data: dia,
        horaInicio: `${bloco.inicio}:00`,
        horaFim: `${bloco.fim}:00`,
        tipoAtividade: tipo,
        descricao: `${ROTULOS_ATIVIDADE[tipo]} de ${materia.nome}`,
      });
    });
  });

  return itens;
}

// Gera N blocos de horario sequenciais e sem sobreposicao (limitados
// pela janela do dia), com o tipo de atividade variando em ciclo. Usado
// pra distribuir a quantidade de eventos que o professor/aluno escolheu
// na geracao por IA, sem deixar o horario "bugado" (sobreposto ou fora
// de uma janela realista).
function gerarBlocosDia(quantidade) {
  const n = Math.max(1, Math.min(quantidade, JANELA_HORARIOS_IA.length));

  return Array.from({ length: n }, (_, indice) => ({
    ...JANELA_HORARIOS_IA[indice],
    tipo_atividade: CICLO_ATIVIDADE_PREMIUM[indice % CICLO_ATIVIDADE_PREMIUM.length],
  }));
}

module.exports = Object.freeze({
  montarGrade,
  gerarRotinaGenerica,
  gerarBlocosDia,
  proximosDiasUteis,
  normalizarHora,
  CORES_ATIVIDADE,
  ROTULOS_ATIVIDADE,
  MAX_BLOCOS_POR_DIA: JANELA_HORARIOS_IA.length,
});
