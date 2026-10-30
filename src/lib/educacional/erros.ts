// ---------------------------------------------------------------------------
// Mensagens de erro do módulo Educacional em português, com o campo e o que
// fazer. A API devolve 400 `{ error: "validacao", campo, mensagem }`; parte das
// mensagens vem crua da validação do backend, em inglês ("Invalid input:
// expected string, received undefined"). Tudo passa por aqui antes da tela.
// Só apresentação: nenhuma regra de negócio.
// ---------------------------------------------------------------------------

type Genero = "m" | "f" | "mp" | "fp";
type Rotulo = { nome: string; g: Genero };

const m = (nome: string): Rotulo => ({ nome, g: "m" });
const f = (nome: string): Rotulo => ({ nome, g: "f" });

// Campos da API → rótulo da tela (o mesmo dos formulários).
const ROTULOS: Record<string, Rotulo> = {
  nome: m("Nome"),
  programa: m("Programa"),
  programa_id: m("Programa"),
  mentoria: f("Mentoria"),
  data_entrada: f("Data de entrada"),
  data_termino: f("Data de término"),
  data_inicio: f("Data de início"),
  data_inicio_programa: m("Início do programa"),
  objetivo: m("Objetivo"),
  nivel_inicial: m("Nível inicial"),
  status_aluno: m("Status do aluno"),
  etapa: f("Etapa"),
  etapa_id: f("Etapa"),
  responsavel: m("Responsável"),
  responsavel_id: m("Responsável"),
  proxima_acao: f("Próxima ação"),
  proxima_acao_prazo: m("Prazo da próxima ação"),
  diagnostico: m("Diagnóstico"),
  motivo_risco: m("Motivo do risco"),
  autorizacao_prova_social: f("Autorização de prova social"),
  observacoes: { nome: "Observações", g: "fp" },
  observacao: f("Observação"),
  data_prevista: f("Data prevista"),
  data_realizada: f("Data realizada"),
  status: m("Status"),
  big_win: m("Big Win"),
  tipo_id: m("Tipo de intervenção"),
  tipo: m("Tipo"),
  descricao: f("Descrição"),
  prazo: m("Prazo"),
  motivo: m("Motivo"),
  valor: m("Valor"),
  aluno: m("Aluno"),
  aluno_id: m("Aluno"),
  duracao_meses: f("Duração (meses)"),
  marco: m("Dia N ou Mês N"),
  dias_apos_entrada: m("Dia N ou Mês N"),
  meses_apos_inicio: m("Dia N ou Mês N"),
  prazo_sla_dias: m("Prazo de SLA"),
  objetivo_contato: m("Objetivo do contato"),
  perguntas_chave: { nome: "Perguntas-chave", g: "fp" },
  sinais_upsell: { nome: "Sinais de upsell e renovação", g: "mp" },
  estrategia_monetizacao: f("Estratégia de monetização"),
  busca: f("Busca"),
  arquivo: m("Arquivo"),
  transcricao: f("Transcrição"),
  cor: f("Cor"),
  email: m("E-mail"),
  telefone: m("Número"),
  discord: m("Discord"),
  acompanhamento_individual: m("Acompanhamento individual"),
};

// Caminho da API ("alunos.0.checkpoints.<id>.data_prevista") → o campo mais
// específico que a tela conhece.
export function rotuloDoCampoDaApi(campo: string | null | undefined): string | null {
  return rotuloDe(campo)?.nome ?? null;
}

function rotuloDe(campo: string | null | undefined): Rotulo | null {
  if (!campo) return null;
  const partes = campo.split(/[.[\]/]+/).filter(Boolean);
  for (let i = partes.length - 1; i >= 0; i--) {
    const r = ROTULOS[partes[i]];
    if (r) return r;
  }
  return null;
}

const obrigatorio = (r: Rotulo) =>
  `${r.nome} ${r.g === "mp" || r.g === "fp" ? "são" : "é"} ${{ m: "obrigatório", f: "obrigatória", mp: "obrigatórios", fp: "obrigatórias" }[r.g]}`;

const ehData = (campo: string) => /(^|[._])(data|prazo)/.test(campo) && !/prazo_sla/.test(campo);
const ehEscolha = (campo: string) =>
  /(_id|^status|[._]status|mentoria|nivel_inicial|tipo|autorizacao_prova_social)$/.test(campo.split(/[.[\]/]+/).filter(Boolean).at(-1) ?? "");

function oQueFazer(campo: string): string {
  if (ehData(campo)) return "Informe a data.";
  if (ehEscolha(campo)) return "Escolha uma opção da lista.";
  return "Preencha o campo.";
}

const comPonto = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const minuscula = (t: string) => (/^[A-ZÀ-Ú][a-zà-ú]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Inglês da validação do backend (zod 3 e 4) e de bibliotecas.
const RE_INGLES =
  /\b(invalid|expected|received|required|must|too (small|big)|unrecognized|characters?|string|number|boolean|undefined|null|nan|greater|less|failed|error|bad request|forbidden|not found|unauthorized|internal|server|the|is|are|has|have|not|of|to|be|should|cannot|only|active|inactive|exists?|found|field|key|value)\b/i;
const RE_PORTUGUES = /[ãõçáéíóúâêôà]|\b(use|informe|escolha|precisa|não|nao|campo|valor|para|com|de|do|da|ao|um|uma)\b/i;
export const ehIngles = (t: string) => RE_INGLES.test(t) && !RE_PORTUGUES.test(t);

const VAZIO = /\b(required|received (undefined|null)|expected .* received (undefined|null))\b/i;

// Uma mensagem da validação (em inglês) → português, com o rótulo do campo.
function doIngles(texto: string, campo: string, r: Rotulo | null): string {
  const quem = r?.nome;
  // "Programa: escolha uma opção da lista." (sem rótulo, a frase sozinha)
  const com = (frase: string) => (quem ? `${quem}: ${minuscula(frase)}` : frase);
  let n: RegExpMatchArray | null;
  if (VAZIO.test(texto) || /(at least|>=)\s*1 character|>=1 characters|must not be empty|cannot be empty/i.test(texto)) {
    return r ? `${obrigatorio(r)}. ${oQueFazer(campo)}` : "Falta preencher um campo obrigatório. Confira o formulário.";
  }
  if (/unrecognized key/i.test(texto)) {
    const chave = texto.match(/["'`]([a-z_]+)["'`]/i)?.[1];
    const outro = rotuloDe(chave)?.nome ?? quem;
    return outro ? `Não é possível alterar ${outro} por aqui.` : "Algum campo não pode ser alterado por aqui. Atualize a página e tente de novo.";
  }
  if (/uuid/i.test(texto)) return com("Escolha uma opção da lista.");
  if (/invalid (enum|option)|expected one of/i.test(texto)) return com("Escolha uma das opções da lista.");
  if (/date|datetime|iso/i.test(texto) || (ehData(campo) && /invalid|pattern|regex|format/i.test(texto))) return com("Informe uma data válida.");
  if ((n = texto.match(/(?:at least|>=)\s*(\d+)\s*character/i))) return `${quem ?? "O texto"} precisa ter pelo menos ${n[1]} caracteres.`;
  if ((n = texto.match(/(?:at most|<=)\s*(\d+)\s*character/i))) return `${quem ?? "O texto"} pode ter no máximo ${n[1]} caracteres.`;
  if (/\bint(eger)?\b/i.test(texto)) return com("Use um número inteiro.");
  if ((n = texto.match(/(?:greater than or equal to|>=)\s*(-?\d+(?:\.\d+)?)/i))) return com(`Use ${n[1]} ou mais.`);
  if ((n = texto.match(/(?:greater than|>)\s*(-?\d+(?:\.\d+)?)/i))) return com(`Use um número maior que ${n[1]}.`);
  if ((n = texto.match(/(?:less than or equal to|<=)\s*(-?\d+(?:\.\d+)?)/i))) return com(`Use no máximo ${n[1]}.`);
  if ((n = texto.match(/(?:less than|<)\s*(-?\d+(?:\.\d+)?)/i))) return com(`Use um número menor que ${n[1]}.`);
  if (/expected number|received nan|not a number/i.test(texto)) return com("Use um número.");
  if (/expected boolean/i.test(texto)) return com("Escolha Sim ou Não.");
  if (/expected array/i.test(texto)) return com("Escolha ao menos uma opção.");
  return quem ? `${quem}: valor inválido. Confira o campo e tente de novo.` : "Algum dado está inválido. Confira o formulário e tente de novo.";
}

// Mensagem que já veio em português: completa o campo e o que fazer quando faltam.
function doPortugues(texto: string, campo: string, r: Rotulo | null): string {
  const t = comPonto(texto);
  if (/^(campo|data)? ?obrigat[óo]ri[oa]\.?$/i.test(t.trim())) return r ? `${obrigatorio(r)}. ${oQueFazer(campo)}` : t;
  if (/inexistente|inativ[oa]|n[ãa]o existe/i.test(t)) {
    const frase = "a opção escolhida não existe mais ou foi inativada. Escolha outra na lista.";
    return r ? `${r.nome}: ${frase}` : maiuscula(frase);
  }
  if (/fora d[oa] (dom[íi]nio|lista)/i.test(t)) {
    return `${r && campo !== "valor" ? `${r.nome}: v` : "V"}alor fora do permitido. Escolha ou digite um valor válido e tente de novo.`;
  }
  if (/^aluno arquivado/i.test(t)) return "Aluno arquivado: reative o aluno antes de salvar.";
  if (campo === "versao") return "Não foi possível salvar: atualize a página e tente de novo.";
  if (!r) return maiuscula(t);
  const menciona = semAcento(t).includes(semAcento(r.nome.split(" (")[0]).split(" ")[0]);
  return menciona ? maiuscula(t) : `${r.nome}: ${minuscula(t)}`;
}

// Várias falhas numa mensagem só: JSON de issues (`ZodError.message`) ou "a; b".
type Falha = { campo: string; texto: string };
function falhasDa(mensagem: string, campo: string): Falha[] {
  const t = mensagem.trim();
  if (t.startsWith("[")) {
    try {
      const lista = JSON.parse(t) as { path?: unknown[]; message?: unknown }[];
      if (Array.isArray(lista) && lista.length) {
        return lista.map((i) => ({
          campo: Array.isArray(i.path) && i.path.length ? i.path.join(".") : campo,
          texto: typeof i.message === "string" ? i.message : "",
        }));
      }
    } catch {
      // não é JSON: segue como texto
    }
  }
  return t.split(/;\s+/).map((parte) => {
    // "nome: Invalid input…" ou "nome — Invalid input…"
    const p = parte.match(/^([a-z_][a-z0-9_.[\]]*)\s*(?::|—|-)\s+(.+)$/i);
    return p && (ROTULOS[p[1]] || p[1].includes("_") || p[1].includes(".")) ? { campo: p[1], texto: p[2] } : { campo, texto: parte };
  });
}

export function traduzirMensagem(mensagem: string | null | undefined, campo?: string | null): string {
  const base = campo ?? "";
  if (!mensagem?.trim()) {
    const r = rotuloDe(base);
    return r ? `${r.nome}: valor inválido. Confira o campo e tente de novo.` : "Algum dado está inválido. Confira o formulário e tente de novo.";
  }
  const textos = falhasDa(mensagem, base).map(({ campo: c, texto }) => {
    const r = rotuloDe(c);
    return ehIngles(texto) ? doIngles(texto, c, r) : doPortugues(texto, c, r);
  });
  return [...new Set(textos)].join(" ");
}

// Sem mensagem (ou só em inglês) e sem campo: pelo status da resposta.
export function mensagemDoStatus(status: number): string {
  if (status === 0) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  if (status === 400) return "Algum dado está inválido. Confira o formulário e tente de novo.";
  if (status === 401) return "Sua sessão expirou. Entre de novo para continuar.";
  if (status === 403) return "Você não tem permissão para esta ação.";
  if (status === 404) return "Registro não encontrado. Ele pode ter sido arquivado ou removido; atualize a página.";
  if (status === 409) return "Este registro foi alterado por outra pessoa. Atualize a página e tente de novo.";
  if (status === 413) return "O arquivo é grande demais. Envie um arquivo de até 4 MB.";
  if (status === 429) return "Muitas tentativas seguidas. Espere alguns segundos e tente de novo.";
  if (status >= 500) return `O serviço educacional está com problema (erro ${status}). Tente de novo em instantes.`;
  return `Não foi possível concluir (erro ${status}). Tente de novo em instantes.`;
}

// Corpo de erro da API → texto da tela. `null` quando não há o que mostrar além
// do status (quem chama decide: 409 de etapa com alunos tem texto próprio).
export function mensagemDoCorpo(
  status: number,
  corpo: { error?: unknown; campo?: unknown; mensagem?: unknown } | null | undefined,
): string {
  const campo = typeof corpo?.campo === "string" ? corpo.campo : null;
  const mensagem = typeof corpo?.mensagem === "string" ? corpo.mensagem : null;
  if (status === 400 || corpo?.error === "validacao") {
    if (mensagem || campo) return traduzirMensagem(mensagem, campo);
  }
  if (mensagem && !ehIngles(mensagem)) return maiuscula(comPonto(mensagem));
  return mensagemDoStatus(status);
}

// O corpo com a `mensagem` já em português. Mensagem em inglês fora da validação
// (ex.: 409 de etapa com alunos) sai do corpo: a tela usa o texto próprio dela.
export function traduzirCorpo<C extends { error?: unknown; campo?: unknown; mensagem?: unknown }>(
  status: number,
  corpo: C | null,
): { texto: string; corpo: C | null } {
  const texto = mensagemDoCorpo(status, corpo);
  if (!corpo) return { texto, corpo };
  const validacao = status === 400 || corpo.error === "validacao";
  const tinha = typeof corpo.mensagem === "string";
  if (validacao && (tinha || typeof corpo.campo === "string")) return { texto, corpo: { ...corpo, mensagem: texto } };
  if (tinha && ehIngles(corpo.mensagem as string)) {
    const { mensagem: _, ...resto } = corpo;
    return { texto, corpo: resto as C };
  }
  return { texto, corpo: tinha ? { ...corpo, mensagem: texto } : corpo };
}

// Qualquer erro (inclusive os que não vieram da API) → texto em português.
export function textoDoErro(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (msg && !ehIngles(msg) && RE_PORTUGUES.test(msg)) return msg;
  if (/failed to fetch|network|load failed/i.test(msg)) return mensagemDoStatus(0);
  return "Algo deu errado. Tente de novo em instantes.";
}
