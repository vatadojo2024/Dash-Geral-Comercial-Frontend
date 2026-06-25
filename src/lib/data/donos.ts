import type { LeadListItem } from "@/lib/api/contracts";
import { nomeDoUsuario } from "@/lib/mock/users";

// ---------------------------------------------------------------------------
// Opções dos filtros de Closer/SDR derivadas dos PRÓPRIOS leads carregados
// (sem endpoint dedicado). O `value` da opção é o id REAL que está no lead
// (slug no mock, UUID na API) — é o que o filtro compara, então sempre casa.
//
// O rótulo prioriza o NOME que já vem no lead (closer_nome/sdr_nome, do GET
// /api/leads). Sem ele, cai no diretório (/api/usuarios) e, por fim, no próprio
// id — nunca quebra e nunca exibe UUID quando há nome.
// ---------------------------------------------------------------------------

export type OpcaoDono = { id: string; nome: string };

// Sentinela do filtro de SDR para os leads SEM sdr individual (Hana / pool).
export const SEM_SDR = "sem_sdr";

function distintos(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

// Monta as opções {id, nome} de um dono (closer ou SDR). O nome vindo do lead
// vence; só na ausência usamos o diretório/id (nomeDoUsuario).
function opcoesDe(
  leads: LeadListItem[],
  pegarId: (l: LeadListItem) => string | null | undefined,
  pegarNome: (l: LeadListItem) => string | null | undefined,
  mapa?: ReadonlyMap<string, string> | null,
): OpcaoDono[] {
  const nomePorId = new Map<string, string>();
  for (const l of leads) {
    const id = pegarId(l);
    if (!id) continue;
    const nomeLead = pegarNome(l)?.trim();
    if (nomeLead) nomePorId.set(id, nomeLead); // nome do lead tem prioridade
    else if (!nomePorId.has(id)) nomePorId.set(id, nomeDoUsuario(id, mapa));
  }
  return [...nomePorId.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

// Opção "Hana"/"Sem SDR" quando houver leads sem sdr_id. Rótulo "Hana (IA)" se
// algum desses leads é do pool da Hana; senão "Sem SDR". value = SEM_SDR.
export function opcaoSemSdr(leads: LeadListItem[]): OpcaoDono | null {
  const semSdr = leads.filter((l) => !l.sdr_id);
  if (semSdr.length === 0) return null;
  const hana = semSdr.some((l) => l.sdr_pool);
  return { id: SEM_SDR, nome: hana ? "Hana (IA)" : "Sem SDR" };
}

export function opcoesDeDono(
  leads: LeadListItem[],
  mapa?: ReadonlyMap<string, string> | null,
): {
  closers: OpcaoDono[];
  sdrs: OpcaoDono[];
} {
  const sdrs = opcoesDe(leads, (l) => l.sdr_id, (l) => l.sdr_nome, mapa);
  const sem = opcaoSemSdr(leads);
  return {
    closers: opcoesDe(leads, (l) => l.closer_id, (l) => l.closer_nome, mapa),
    // A opção "Hana/Sem SDR" entra no fim da lista de SDRs (quando há).
    sdrs: sem ? [...sdrs, sem] : sdrs,
  };
}

// Casa um lead contra o valor do filtro de SDR (inclui a sentinela SEM_SDR).
// Vazio = sem filtro. Usado por Fila, Heatmap e Ações para o mesmo comportamento.
export function leadDoSdr(lead: LeadListItem, sdrFiltro: string | null): boolean {
  if (!sdrFiltro) return true;
  if (sdrFiltro === SEM_SDR) return !lead.sdr_id;
  return lead.sdr_id === sdrFiltro;
}

// Nome de exibição do closer/SDR de um lead: prioriza o nome do lead, cai no
// diretório e, por fim, no id (nomeDoUsuario). Nunca exibe UUID havendo nome.
export function nomeDoCloser(
  lead: LeadListItem,
  mapa?: ReadonlyMap<string, string> | null,
): string {
  return lead.closer_nome?.trim() || nomeDoUsuario(lead.closer_id, mapa);
}

export function nomeDoSdr(
  lead: LeadListItem,
  mapa?: ReadonlyMap<string, string> | null,
): string {
  return lead.sdr_nome?.trim() || nomeDoUsuario(lead.sdr_id, mapa);
}
