import {
  AREAS,
  AreaSchema,
  MODULOS,
  ModuloSchema,
  type Area,
  type Modulo,
  type Role,
  type SessionUser,
} from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// Acesso por área (desde 30/09/2026). A FONTE é a API: GET /api/me devolve
// `areas`, a lista pronta do que o usuário pode ver, e toda rota de dados
// responde 403 para quem não tem a área. O front só lê essa lista — menu,
// páginas e home saem dela.
//
// AREAS_DO_PAPEL é só RESERVA, espelho da tabela "Acesso por papel" da
// DOCUMENTACAO-FRONT.md do backend (seção 6). Usada em dois casos: login mock
// (sem API) e sessão sem `areas` (cookie gravado antes de 30/09 ou API ainda
// sem o campo). Se a tabela mudar no backend, a API já manda a lista nova;
// aqui só precisa acompanhar para o modo mock.
// ---------------------------------------------------------------------------

export const AREAS_DO_PAPEL: Record<Role, Area[]> = {
  admin: [...AREAS],
  closer: ["dashboard", "leads", "agendamentos", "chat", "salesops"],
  sdr: ["dashboard", "leads", "agendamentos", "chat", "produtividade_sdr", "retencao"],
  marketing: ["retencao"],
  educacional: ["educacional"],
};

// Lista da API, tolerante: valor desconhecido é ignorado (uma área nova no
// backend não derruba o login); sem lista nenhuma, cai na reserva do papel.
export function normalizarAreas(raw: unknown, role: Role): Area[] {
  if (!Array.isArray(raw)) return [...AREAS_DO_PAPEL[role]];
  const areas: Area[] = [];
  for (const v of raw) {
    const r = AreaSchema.safeParse(typeof v === "string" ? v.trim().toLowerCase() : v);
    if (r.success && !areas.includes(r.data)) areas.push(r.data);
  }
  return areas;
}

export function temArea(user: Pick<SessionUser, "areas">, area: Area): boolean {
  return user.areas.includes(area);
}

// Página de entrada de cada área. Liderança é uma sub-aba da Produtividade SDR;
// Histórico, uma sub-aba de Agendamentos.
export const ROTA_DA_AREA: Record<Area, string> = {
  visao_geral: "/visao-geral",
  dashboard: "/dashboard",
  leads: "/leads",
  agendamentos: "/agendamentos",
  historico_agendamentos: "/agendamentos/historico",
  chat: "/chat",
  salesops: "/salesops",
  produtividade_sdr: "/produtividade-sdr",
  lideranca_pre_venda: "/produtividade-sdr/lideranca",
  retencao: "/retencao",
  educacional: "/educacional",
};

export const ROTA_SEM_AREA = "/sem-area";

// Home pós-login: a primeira área da lista (a API manda na ordem do menu —
// admin cai na Visão Geral, closer e SDR no Dashboard, marketing na Retenção).
// Sem área nenhuma → tela "Sua área ainda não está disponível", nunca um
// redirect que volte para a própria home.
export function homeDoUsuario(user: Pick<SessionUser, "areas">): string {
  const primeira = user.areas[0];
  return primeira ? ROTA_DA_AREA[primeira] : ROTA_SEM_AREA;
}

// ---------------------------------------------------------------------------
// Módulos (Comercial | Educacional). A API manda `modulos` em GET /api/me; sem
// o campo (API antiga, cookie antigo), eles são DEDUZIDOS das `areas` que o
// servidor mandou — nunca do papel: quem não recebeu a área `educacional` não
// entra no módulo, por mais que o papel sugira.
// ---------------------------------------------------------------------------

export const AREAS_DO_MODULO_EDUCACIONAL: readonly Area[] = ["educacional"];

export function moduloDaArea(area: Area): Modulo {
  return AREAS_DO_MODULO_EDUCACIONAL.includes(area) ? "educacional" : "comercial";
}

export function modulosDeAreas(areas: readonly Area[]): Modulo[] {
  return MODULOS.filter((m) => areas.some((a) => moduloDaArea(a) === m));
}

export function normalizarModulos(raw: unknown, areas: readonly Area[]): Modulo[] {
  if (!Array.isArray(raw)) return modulosDeAreas(areas);
  const modulos: Modulo[] = [];
  for (const v of raw) {
    const r = ModuloSchema.safeParse(typeof v === "string" ? v.trim().toLowerCase() : v);
    if (r.success && !modulos.includes(r.data)) modulos.push(r.data);
  }
  return MODULOS.filter((m) => modulos.includes(m));
}

export const ROTA_EDUCACIONAL = "/educacional";

// Módulo em que o usuário está: com um módulo só, é ele; com os dois (admin),
// decide o caminho.
export function moduloAtivo(user: Pick<SessionUser, "modulos">, pathname: string): Modulo {
  if (user.modulos.length === 1) return user.modulos[0];
  return pathname === ROTA_EDUCACIONAL || pathname.startsWith(ROTA_EDUCACIONAL + "/") ? "educacional" : "comercial";
}

// Home de um módulo: a primeira área do usuário que pertence a ele.
export function homeDoModulo(user: Pick<SessionUser, "areas">, modulo: Modulo): string {
  const area = user.areas.find((a) => moduloDaArea(a) === modulo);
  return area ? ROTA_DA_AREA[area] : ROTA_SEM_AREA;
}

// Última área escolhida no seletor do admin (só conveniência do navegador).
export const CHAVE_MODULO_LEMBRADO = "mdc_modulo";
