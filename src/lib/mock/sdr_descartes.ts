import { tagsEventoNoIntervalo } from "@/lib/sdr/ciclo";

// ---------------------------------------------------------------------------
// Mock de GET /api/sdr/descartes (LEADS_MODE=mock), no formato da API real
// (por evento). Os eventos de setembro/2026 devolvem os números REAIS que o
// backend mandou para conferência (inscritos, desqualificou, perdeu, nutrição,
// leads distintos — e, em 22/09, a divisão por pessoa). Outros eventos saem
// de um padrão determinístico com um closer e um "Sem dono", para exercitar o
// badge de papel. `simular=vazio` → ninguém descartou nada; erros no proxy.
// ---------------------------------------------------------------------------

type Pessoa = {
  usuario_id: string | null;
  usuario_clint_id: string | null;
  nome: string;
  email: string | null;
  papel: "sdr" | "closer" | "admin" | null;
};
type Linha = Pessoa & { desqualificou: number; perdeu: number; nutricao: number; leads_distintos: number };

const GUILHERME: Pessoa = { usuario_id: "8a9f218f-0000-4000-8000-000000000001", usuario_clint_id: "2c538927-0000-4000-8000-00000000000a", nome: "Guilherme Delrue", email: "guilhermealwes@gmail.com", papel: "sdr" };
const GLAUCIO: Pessoa = { usuario_id: "8a9f218f-0000-4000-8000-000000000002", usuario_clint_id: "2c538927-0000-4000-8000-00000000000b", nome: "Glaucio Portela", email: "glaucio@vatadojo.com.br", papel: "sdr" };
const BENHUR: Pessoa = { usuario_id: "8a9f218f-0000-4000-8000-000000000003", usuario_clint_id: "2c538927-0000-4000-8000-00000000000c", nome: "Benhur Ramos", email: "benhur@vatadojo.com.br", papel: "sdr" };
const MARCIO: Pessoa = { usuario_id: "8a9f218f-0000-4000-8000-000000000004", usuario_clint_id: "2c538927-0000-4000-8000-00000000000d", nome: "Marcio Travassos", email: "marcio@vatadojo.com.br", papel: "closer" };
const SEM_DONO: Pessoa = { usuario_id: null, usuario_clint_id: null, nome: "Sem dono", email: null, papel: null };

const l = (p: Pessoa, desqualificou: number, perdeu: number, nutricao: number, leads_distintos: number): Linha => ({
  ...p, desqualificou, perdeu, nutricao, leads_distintos,
});

// Setembro/2026: totais por evento são os REAIS; a divisão por pessoa soma a eles.
const REAIS: Record<string, { inscritos: number; linhas: Linha[] }> = {
  "WG - 01.09.26": { inscritos: 1004, linhas: [l(GUILHERME, 7, 10, 3, 18), l(GLAUCIO, 3, 9, 1, 13), l(BENHUR, 1, 2, 1, 4)] },
  "WG - 08.09.26": { inscritos: 652, linhas: [l(GUILHERME, 4, 11, 3, 16), l(GLAUCIO, 2, 8, 1, 10), l(BENHUR, 0, 2, 1, 3)] },
  "WG - 15.09.26": { inscritos: 185, linhas: [l(GUILHERME, 2, 2, 1, 4), l(GLAUCIO, 1, 1, 0, 2)] },
  "WG - 22.09.26": { inscritos: 485, linhas: [l(GUILHERME, 1, 8, 9, 17), l(GLAUCIO, 2, 5, 3, 8), l(BENHUR, 0, 0, 2, 2)] },
  "WG - 29.09.26": { inscritos: 310, linhas: [] },
};

function generico(tag: string): { inscritos: number; linhas: Linha[] } {
  const d = Number(tag.slice(5, 7)) || 1;
  return {
    inscritos: 300 + d * 11,
    linhas: [
      l(GUILHERME, 2 + (d % 3), 7 + (d % 5), 4, 12 + (d % 4)),
      l(GLAUCIO, 1, 5 + (d % 3), 2, 7 + (d % 2)),
      l(MARCIO, 1, 1, 0, 2),
      l(SEM_DONO, 0, 3, 0, 3),
    ],
  };
}

const ordenar = (linhas: Linha[]) =>
  [...linhas].sort((a, b) => {
    if (!a.usuario_id && a.nome === "Sem dono") return 1;
    if (!b.usuario_id && b.nome === "Sem dono") return -1;
    return b.leads_distintos - a.leads_distintos || a.nome.localeCompare(b.nome, "pt-BR");
  });

const somar = (linhas: Linha[]) => ({
  desqualificou: linhas.reduce((t, x) => t + x.desqualificou, 0),
  perdeu: linhas.reduce((t, x) => t + x.perdeu, 0),
  nutricao: linhas.reduce((t, x) => t + x.nutricao, 0),
  leads_distintos: linhas.reduce((t, x) => t + x.leads_distintos, 0),
});

export function mockDescartes(de: string, ate: string, simular?: string | null) {
  const eventos = tagsEventoNoIntervalo(de, ate);
  const por_evento = eventos.map((tag) => {
    const base = REAIS[tag] ?? generico(tag);
    const linhas = simular === "vazio" ? [] : ordenar(base.linhas);
    return { evento_tag: tag, inscritos: base.inscritos, totais: somar(linhas), por_usuario: linhas };
  });

  // Consolidado: a mesma pessoa somada nos eventos. No mock nenhum lead está em
  // dois eventos, então aqui a soma coincide — no real pode ser MENOR.
  const porPessoa = new Map<string, Linha>();
  for (const ev of por_evento) {
    for (const x of ev.por_usuario) {
      const chave = x.usuario_id ?? x.nome;
      const atual = porPessoa.get(chave) ?? l(x, 0, 0, 0, 0);
      porPessoa.set(chave, l(x, atual.desqualificou + x.desqualificou, atual.perdeu + x.perdeu, atual.nutricao + x.nutricao, atual.leads_distintos + x.leads_distintos));
    }
  }
  const por_usuario = ordenar([...porPessoa.values()]);

  return {
    de,
    ate,
    eventos,
    totais: somar(por_usuario),
    por_evento,
    por_usuario,
    fontes: {
      etapas_desqualificacao: ["Desqualificado", "Desqualificados", "Tomadores/Desqualificados"],
      origin_id_pre_venda: "7c060c21-0000-4000-8000-000000000000",
      origin_id_nutricao: "4b2a834d-0000-4000-8000-000000000000",
    },
    avisos: [] as string[],
    gerado_em: new Date().toISOString(),
    cache: "miss" as const,
  };
}
