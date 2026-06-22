import type { Role } from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// Mapa papel → agente (design.md §4). Objeto único, fácil de ajustar.
// Os textos de exibição são PLACEHOLDERS a confirmar com o Vata; a estrutura é
// o que importa. O `papel` vem da mesma fonte que o painel já usa (useSession).
//
// Nota: o design lista "admin / gestor" como o mesmo agente. A fonte de papel
// real (RoleSchema) só emite admin | closer | sdr, então 'gestor' é coberto
// pelo papel `admin` — não há papel novo aqui.
// ---------------------------------------------------------------------------

export type Agente = {
  id: string;
  nome_exibicao: string;
  subtitulo: string;
};

export const AGENTES: Record<Role, Agente> = {
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
  return AGENTES[papel];
}
