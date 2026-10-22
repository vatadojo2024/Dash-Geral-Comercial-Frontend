import semente from "@/lib/mock/data_educacional.json";
import { diasEntre } from "./motor";
import type { Banco } from "./tipos";

// ---------------------------------------------------------------------------
// Persistência do modo demonstração (spec Fase 2, seção 7.2): o banco fica no
// localStorage do navegador (`mdc_edu_demo_v2`), então as edições sobrevivem ao
// recarregar. Sem localStorage (aba privada, teste, servidor) cai para memória.
// "Restaurar dados de demonstração" volta à semente.
//   - A semente tem `data_referencia`: ao semear, todas as datas andam até hoje,
//     para a demonstração não envelhecer.
//   - A cada dia, imita a tarefa diária do backend: checkpoint `previsto` cuja
//     data chegou vira `pendente`.
// ---------------------------------------------------------------------------

export const CHAVE_BANCO = "mdc_edu_demo_v2";
// Sobe quando o formato da semente muda: banco salvo com outra versão é trocado.
export const VERSAO_DADOS = 1;

type Semente = Omit<Banco, "versao_dados"> & { data_referencia: string };
type Salvo = { banco: Banco; tarefa_em: string };

let memoria: Salvo | null = null;

function armazenamento(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}/;

function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Anda N dias em toda string que começa com data (AAAA-MM-DD…), mantendo o resto (hora, fuso).
function deslocar<T>(valor: T, n: number): T {
  if (typeof valor === "string") return (RE_DATA.test(valor) ? somarDias(valor, n) + valor.slice(10) : valor) as T;
  if (Array.isArray(valor)) return valor.map((v) => deslocar(v, n)) as T;
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, deslocar(v, n)])) as T;
  }
  return valor;
}

export function bancoDaSemente(hoje: string): Banco {
  const s = semente as unknown as Semente;
  const n = diasEntre(s.data_referencia, hoje);
  const { data_referencia: _ref, config, ...tabelas } = structuredClone(s);
  return { versao_dados: VERSAO_DADOS, config, ...deslocar(tabelas, n) };
}

// Tarefa diária (seção 5 do backend), uma vez por dia.
function tarefaDiaria(banco: Banco, hoje: string) {
  for (const c of banco.checkpoints) {
    if (c.status === "previsto" && c.data_prevista && c.data_prevista <= hoje) c.status = "pendente";
  }
}

function ler(): Salvo | null {
  const ls = armazenamento();
  if (!ls) return memoria;
  try {
    const bruto = ls.getItem(CHAVE_BANCO);
    if (!bruto) return null;
    const salvo = JSON.parse(bruto) as Salvo;
    return salvo?.banco?.versao_dados === VERSAO_DADOS ? salvo : null;
  } catch {
    return null;
  }
}

function gravar(salvo: Salvo) {
  memoria = salvo;
  const ls = armazenamento();
  if (!ls) return;
  try {
    ls.setItem(CHAVE_BANCO, JSON.stringify(salvo));
  } catch {
    // Cota cheia ou bloqueado: segue em memória nesta aba.
  }
}

// Cópia do banco para uma escrita: só volta a ser salva se a escrita terminar sem erro.
export function carregarBanco(hoje: string): Banco {
  let salvo = ler() ?? memoria;
  if (!salvo) salvo = { banco: bancoDaSemente(hoje), tarefa_em: "" };
  if (salvo.tarefa_em !== hoje) {
    tarefaDiaria(salvo.banco, hoje);
    salvo = { banco: salvo.banco, tarefa_em: hoje };
    gravar(salvo);
  }
  return structuredClone(salvo.banco);
}

export function salvarBanco(banco: Banco, hoje: string) {
  gravar({ banco, tarefa_em: hoje });
}

export function restaurarBanco(hoje: string): Banco {
  const banco = bancoDaSemente(hoje);
  tarefaDiaria(banco, hoje);
  gravar({ banco, tarefa_em: hoje });
  return structuredClone(banco);
}

// Só para testes.
export function _zerarMemoria() {
  memoria = null;
}
