import type { Role } from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// Mapa papel → agente (design.md §4). Objeto único, fácil de ajustar.
// Os textos de exibição são PLACEHOLDERS a confirmar com o Vata; a estrutura é
// o que importa. O `papel` vem da mesma fonte que o painel já usa (useSession).
//
// Nota: o design lista "admin / gestor" como o mesmo agente; 'gestor' é coberto
// pelo papel `admin`. Marketing e educacional não têm a área `chat` (30/09);
// se um dia uma conversa vier com um papel sem agente, usa o da gestão.
// ---------------------------------------------------------------------------

export type Agente = {
  id: string;
  nome_exibicao: string;
  subtitulo: string;
};

export const AGENTES: Partial<Record<Role, Agente>> & Record<"admin", Agente> = {
  admin: {
    id: "guia_gestao",
    nome_exibicao: "Guia Vata/Cindy",
    subtitulo: "Estratégia comercial",
  },
  closer: {
    id: "guia_closer",
    nome_exibicao: "Guia do Closer",
    subtitulo: "Condução e fechamento",
  },
  sdr: {
    id: "guia_sdr",
    nome_exibicao: "Guia do SDR",
    subtitulo: "Qualificação e agendamento",
  },
};

export function agenteDoPapel(papel: Role): Agente {
  return AGENTES[papel] ?? AGENTES.admin;
}
