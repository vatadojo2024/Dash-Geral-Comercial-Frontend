import {
  DestaqueResponseSchema,
  LeadDetailSchema,
  LeadsResponseSchema,
  UsuariosResponseSchema,
  type DestaqueResponse,
  type LeadDetail,
  type LeadListItem,
  type SessionUser,
  type Usuario,
} from "@/lib/api/contracts";
import {
  AgendamentosResponseSchema,
  type Agendamento,
} from "@/lib/sdr/agendamentos";
import {
  OportunidadesResponseSchema,
  type CodigoErroOportunidades,
  type OportunidadesResponse,
} from "@/lib/sdr/oportunidades";
import { NaoAbordadosResponseSchema, type NaoAbordadosResponse } from "@/lib/sdr/naoAbordados";
import { RetencaoResponseSchema, type RetencaoResponse } from "@/lib/sdr/retencao";
import { PresentesResponseSchema, type PresentesResponse } from "@/lib/sdr/presentesSemAplicar";
import { InscritosResponseSchema, type InscritosResponse } from "@/lib/sdr/inscritos";
import { AusentesResponseSchema, type AusentesResponse } from "@/lib/sdr/ausentes";

// ---------------------------------------------------------------------------
// ÚNICA porta de acesso a dados de leads no client. Os componentes só
// conhecem fetchLeads/fetchLeadDetail; a FONTE (mock | API real) é decidida
// no servidor pelos route handlers /api/leads (env LEADS_MODE) — trocar o
// modo no .env muda a fonte SEM tocar em componente.
// Quando há sessão Supabase (AUTH_MODE=supabase), o access token segue no
// Authorization e o route handler o repassa à API real como Bearer.
// ---------------------------------------------------------------------------

export class DataError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "invalid_contract" | "request_failed",
  ) {
    super(message);
  }
}

async function headersComToken(): Promise<HeadersInit> {
  // Sem as envs públicas do Supabase (modo mock) não há token a anexar.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return {};
  }
  const { getSupabaseClient } = await import("@/lib/auth/supabase");
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : {};
}

async function buscar(caminho: string): Promise<unknown> {
  const res = await fetch(caminho, { headers: await headersComToken() });
  if (!res.ok) {
    // Sem token / sessão expirada → volta ao login. Limpa o cookie antes de
    // redirecionar para não cair em loop com o middleware (cookie presente o
    // faria bater de volta no app).
    if (res.status === 401 && typeof window !== "undefined") {
      const { limparCookieSessao } = await import("@/lib/auth/clientSession");
      limparCookieSessao();
      window.location.href = "/login";
    }
    const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
    const mensagem = corpo?.error ?? `A busca de leads respondeu ${res.status}.`;
    throw new DataError(mensagem, res.status === 404 ? "not_found" : "request_failed");
  }
  return res.json();
}

// O parâmetro user existe só para compor a queryKey das telas — a filtragem
// por papel acontece no servidor (mock) ou na própria API real.
export async function fetchLeads(_user: SessionUser): Promise<LeadListItem[]> {
  const json = await buscar("/api/leads");
  const parsed = LeadsResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new DataError(
      `Resposta de /api/leads fora do contrato: ${parsed.error.issues[0]?.path.join(".")} — ${parsed.error.issues[0]?.message}`,
      "invalid_contract",
    );
  }
  return parsed.data.items;
}

// Diretório de usuários (id→nome). Buscado uma vez e cacheado pelo React Query
// (ver useUsuariosMap); traduz os UUIDs de closer_id/sdr_id em nomes.
export async function fetchUsuarios(): Promise<Usuario[]> {
  const json = await buscar("/api/usuarios");
  const parsed = UsuariosResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new DataError(
      `Resposta de /api/usuarios fora do contrato: ${parsed.error.issues[0]?.path.join(".")} — ${parsed.error.issues[0]?.message}`,
      "invalid_contract",
    );
  }
  return parsed.data.usuarios;
}

// Aba "Calls por Ciclo": única porta dos agendamentos por ciclo. Isolada de
// propósito — a fonte (endpoint agregado /api/sdr/agendamentos, sem escopo e sem
// PII) pode mudar sem tocar a UI. O corte por ciclo é feito no servidor
// (occurred_at); aqui só passamos a janela inicio/fim (datas do ciclo).
export async function fetchAgendamentos(
  inicio: string,
  fim: string,
): Promise<Agendamento[]> {
  const qs = `inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`;
  const json = await buscar(`/api/sdr/agendamentos?${qs}`);
  const parsed = AgendamentosResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new DataError(
      `Resposta de /api/sdr/agendamentos fora do contrato: ${parsed.error.issues[0]?.path.join(".")} — ${parsed.error.issues[0]?.message}`,
      "invalid_contract",
    );
  }
  return parsed.data.agendamentos;
}

// Aba "Levantou a Mão": erro tipado com o STATUS e o CÓDIGO do backend
// (seção 10 do endpoint) — a UI escolhe a mensagem/ação por eles, não pelo texto.
export class OportunidadesError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly codigo: CodigoErroOportunidades,
  ) {
    super(message);
  }
}

function codigoDoCorpo(status: number, corpo: unknown): CodigoErroOportunidades {
  const erro = (corpo as { erro?: unknown } | null)?.erro;
  if (
    erro === "clint_auth" ||
    erro === "clint_indisponivel" ||
    erro === "agendamentos_indisponivel" ||
    erro === "leads_indisponivel" ||
    erro === "supabase_indisponivel" ||
    erro === "intervalo_muito_grande"
  ) {
    return erro;
  }
  if (status === 422) return "intervalo_muito_grande";
  if (status === 400) return "parametros_invalidos";
  return "desconhecido";
}

// Os dois endpoints de evento têm o mesmo protocolo (de/ate, erros por código):
// uma função só, parametrizada pelo caminho e pelo schema da resposta.
async function fetchEndpointEventos<T>(
  caminho: string,
  rotulo: string,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } },
  de: string,
  ate: string,
): Promise<T> {
  const qs = `de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`;
  const res = await fetch(`${caminho}?${qs}`, { headers: await headersComToken() });
  const corpo = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      const { limparCookieSessao } = await import("@/lib/auth/clientSession");
      limparCookieSessao();
      window.location.href = "/login";
    }
    const mensagem =
      (corpo as { error?: string } | null)?.error ?? `A consulta de ${rotulo} respondeu ${res.status}.`;
    throw new OportunidadesError(mensagem, res.status, codigoDoCorpo(res.status, corpo));
  }
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new OportunidadesError(
      `Resposta de ${caminho} fora do contrato: ${issue?.path.map(String).join(".")} — ${issue?.message}`,
      res.status,
      "desconhecido",
    );
  }
  return parsed.data;
}

// Única porta da aba "Oportunidades do Evento" (GET /api/eventos/oportunidades?de&ate).
// O corte por período é do backend; MQL/busca ficam no cliente (lib/sdr/oportunidades).
export function fetchOportunidades(de: string, ate: string): Promise<OportunidadesResponse> {
  return fetchEndpointEventos("/api/eventos/oportunidades", "oportunidades", OportunidadesResponseSchema, de, ate);
}

// Recorte "Não abordados" (GET /api/eventos/nao-abordados?de&ate): outra
// população, endpoint próprio, mesmos códigos de erro (+ leads_indisponivel).
export function fetchNaoAbordados(de: string, ate: string): Promise<NaoAbordadosResponse> {
  return fetchEndpointEventos("/api/eventos/nao-abordados", "não abordados", NaoAbordadosResponseSchema, de, ate);
}

// Recorte "Presentes que não aplicaram" (GET /api/eventos/presentes-sem-aplicar?de&ate).
export function fetchPresentes(de: string, ate: string): Promise<PresentesResponse> {
  return fetchEndpointEventos("/api/eventos/presentes-sem-aplicar", "presentes sem aplicar", PresentesResponseSchema, de, ate);
}

// Recorte "Não participaram — Qualificados" (GET /api/eventos/ausentes?de&ate).
export function fetchAusentes(de: string, ate: string): Promise<AusentesResponse> {
  return fetchEndpointEventos("/api/eventos/ausentes", "ausentes", AusentesResponseSchema, de, ate);
}

// Lista completa dos inscritos (GET /api/eventos/inscritos?de&ate) — CONTRATO
// PROVISÓRIO: enquanto o backend não publicar, responde 404 e a Visão geral
// cai nos pendentes.
export function fetchInscritos(de: string, ate: string): Promise<InscritosResponse> {
  return fetchEndpointEventos("/api/eventos/inscritos", "inscritos", InscritosResponseSchema, de, ate);
}

// Aba "Retenção da audiência" (GET /api/eventos/retencao?de&ate).
export function fetchRetencao(de: string, ate: string): Promise<RetencaoResponse> {
  return fetchEndpointEventos("/api/eventos/retencao", "retenção", RetencaoResponseSchema, de, ate);
}

// PATCH do destaque do lead (só admin — a API responde 403 para os demais).
// Passa pela mesma porta das leituras: o route handler decide mock|api e anexa
// o Bearer. Erro vira DataError com a mensagem da API, para a UI reverter o
// update otimista e mostrar o toast.
export async function patchDestaque(
  leadId: string,
  destaque: boolean,
): Promise<DestaqueResponse["lead"]> {
  const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/destaque`, {
    method: "PATCH",
    headers: { ...(await headersComToken()), "Content-Type": "application/json" },
    body: JSON.stringify({ destaque }),
  });
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const mensagem =
      (json as { error?: string } | null)?.error ??
      (res.status === 403
        ? "Apenas o admin pode destacar leads."
        : `A atualização do destaque respondeu ${res.status}.`);
    throw new DataError(mensagem, res.status === 404 ? "not_found" : "request_failed");
  }
  const parsed = DestaqueResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new DataError(
      `Resposta do destaque fora do contrato: ${parsed.error.issues[0]?.path.join(".")} — ${parsed.error.issues[0]?.message}`,
      "invalid_contract",
    );
  }
  return parsed.data.lead;
}

export async function fetchLeadDetail(
  _user: SessionUser,
  leadId: string,
): Promise<LeadDetail> {
  const json = await buscar(`/api/leads/${encodeURIComponent(leadId)}`);
  const parsed = LeadDetailSchema.safeParse(json);
  if (!parsed.success) {
    throw new DataError(
      `Resposta do detalhe fora do contrato: ${parsed.error.issues[0]?.path.join(".")} — ${parsed.error.issues[0]?.message}`,
      "invalid_contract",
    );
  }
  return parsed.data;
}
