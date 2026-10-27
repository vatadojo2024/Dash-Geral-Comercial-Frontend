import type { AnaliseDetalhe, AnaliseItemLista, ResultadoAnalise, StatusAnalise } from "../contrato";
import type { AnaliseBanco, Banco } from "./tipos";

// ---------------------------------------------------------------------------
// Análise de aula no modo demonstração (spec Fase 3, seção 5.4; backend 5.3).
//   - Status pelo tempo desde o envio (ou reprocessamento): menos de 3 s na
//     fila, menos de 8 s processando, depois pronta (ou erro, se o texto tem
//     `#erro`). Assim a fila anda mesmo depois de recarregar a página.
//   - Resultado de exemplo determinístico a partir do texto: resumo com as 3
//     primeiras frases, notas fixas 70/55/40/20, highlights com as 5 frases mais
//     longas e evidências tiradas do próprio texto.
//   - Legendas (.vtt/.srt) limpas como no backend: sem números nem marcações de
//     tempo, falas juntadas.
// ---------------------------------------------------------------------------

export const NA_FILA_MS = 3000;
export const PROCESSANDO_MS = 8000;
export const MARCA_DE_ERRO = "#erro";
export const ERRO_SIMULADO = "A IA não conseguiu analisar esta transcrição (erro simulado no modo demonstração).";

export const TEXTO_DOCX_EXEMPLO =
  "Abrimos a aula revisando a tarefa da semana. O aluno mostrou a planilha de custos preenchida. " +
  "Ele entendeu a diferença entre margem e markup e explicou com as próprias palavras. " +
  "Na prática, aplicou o novo preço em dois clientes e trouxe o resultado da primeira semana. " +
  "Ainda falta validar com uma venda fechada no preço novo. Combinamos de revisar a oferta na próxima aula.";

export function statusDe(an: AnaliseBanco, agora: string): StatusAnalise {
  if (an.estado === "confirmada" || an.estado === "descartada") return an.estado;
  const passou = Date.parse(agora) - Date.parse(an.inicio);
  if (passou < NA_FILA_MS) return "na_fila";
  if (passou < PROCESSANDO_MS) return "processando";
  return an.falhar ? "erro" : "pronta";
}

const RE_TEMPO = /^\d{1,2}:\d{2}(:\d{2})?[.,]\d{3}\s*-->\s*\d{1,2}:\d{2}(:\d{2})?[.,]\d{3}/;

// .vtt e .srt: tira o cabeçalho, os números das falas e as marcações de tempo.
export function limparTranscricao(texto: string, arquivo: string | null): string {
  const legenda = /\.(vtt|srt)$/i.test(arquivo ?? "");
  if (!legenda) return texto.trim();
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && l !== "WEBVTT" && !/^\d+$/.test(l) && !RE_TEMPO.test(l) && !/^NOTE\b/.test(l))
    .map((l) => l.replace(/<[^>]+>/g, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function frases(texto: string): string[] {
  return texto
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0 && f !== MARCA_DE_ERRO);
}

const NOTAS = { consumiu: 70, entendeu: 55, aplicou: 40, validou: 20 } as const;
const JUSTIFICATIVA = {
  consumiu: "Acompanhou o conteúdo da aula (nota de exemplo do modo demonstração).",
  entendeu: "Explicou parte do conceito com as próprias palavras (nota de exemplo).",
  aplicou: "Começou a aplicar, ainda sem constância (nota de exemplo).",
  validou: "Ainda sem resultado validado (nota de exemplo).",
} as const;

export function resultadoDeExemplo(texto: string): ResultadoAnalise {
  const fs = frases(texto);
  const evid = (i: number) => (fs.length ? [fs[i % fs.length]] : []);
  const longas = [...fs].sort((a, b) => b.length - a.length || fs.indexOf(a) - fs.indexOf(b)).slice(0, 5);
  return {
    resumo: fs.slice(0, 3).join(" ") || "Transcrição sem frases para resumir.",
    progresso: {
      consumiu: { nota: NOTAS.consumiu, justificativa: JUSTIFICATIVA.consumiu, evidencias: evid(0) },
      entendeu: { nota: NOTAS.entendeu, justificativa: JUSTIFICATIVA.entendeu, evidencias: evid(1) },
      aplicou: { nota: NOTAS.aplicou, justificativa: JUSTIFICATIVA.aplicou, evidencias: evid(2) },
      validou: { nota: NOTAS.validou, justificativa: JUSTIFICATIVA.validou, evidencias: evid(3) },
    },
    highlights: longas,
  };
}

export function itemDaLista(banco: Banco, an: AnaliseBanco, agora: string): AnaliseItemLista {
  const aluno = banco.alunos.find((a) => a.id === an.aluno_id);
  const etapa = banco.config.etapas.find((e) => e.id === an.etapa_id);
  return {
    id: an.id,
    aluno: { id: an.aluno_id, nome: aluno?.nome ?? "Aluno removido" },
    data_aula: an.data_aula,
    etapa: { id: an.etapa_id, nome: etapa?.nome ?? "Etapa removida" },
    status: statusDe(an, agora),
    criada_por: an.criada_por,
    criada_em: an.criada_em,
  };
}

export function detalheDaAnalise(banco: Banco, an: AnaliseBanco, agora: string): AnaliseDetalhe {
  const item = itemDaLista(banco, an, agora);
  const processou = item.status !== "na_fila" && item.status !== "processando" && item.status !== "erro";
  return {
    ...item,
    arquivo_nome: an.arquivo_nome,
    transcricao: an.transcricao,
    resultado_ia: processou ? an.resultado_ia : null,
    resultado_confirmado: an.resultado_confirmado,
    erro: item.status === "erro" ? ERRO_SIMULADO : null,
    confirmada_por: an.confirmada_por,
    confirmada_em: an.confirmada_em,
  };
}

// Confirmadas do aluno, mais recente primeiro (data da aula, depois confirmação).
export function confirmadasDoAluno(banco: Banco, alunoId: string): AnaliseBanco[] {
  return (banco.analises ?? [])
    .filter((x) => x.aluno_id === alunoId && x.estado === "confirmada" && x.resultado_confirmado)
    .sort((a, b) => b.data_aula.localeCompare(a.data_aula) || (b.confirmada_em ?? "").localeCompare(a.confirmada_em ?? ""));
}
