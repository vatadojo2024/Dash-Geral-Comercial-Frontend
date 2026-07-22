import {
  LeadDetailSchema,
  LeadsResponseSchema,
  UsuariosResponseSchema,
  type LeadDetail,
  type LeadListItem,
  type SessionUser,
  type Usuario,
} from "@/lib/api/contracts";
import {
  AgendamentosResponseSchema,
  type Agendamento,
} from "@/lib/sdr/agendamentos";

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
