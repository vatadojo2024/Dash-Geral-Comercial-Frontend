import type { OperadoresDoMes, OperadorSdr } from "@/lib/data/sdrDashboard";

// ---------------------------------------------------------------------------
// Modo demonstração de GET /api/sdr/operadores?mes= (backend 4197783): os SDRs
// e as metas "efetivas a partir de" um mês, como a tabela comercial_metas.
// Nomes e apelidos espelham os do backend (tests/setup-operadores.ts); os ids
// são os das contas de demonstração, para o "você" casar com a sessão.
// Diferença deliberada: aqui as metas valem desde 01/2026, para os dados de
// exemplo (abril a junho) terem meta; no backend elas começam em 11/2026.
// ---------------------------------------------------------------------------

type Vigencia = { desde: string; faixas: [number, number, number]; regra_ninja_qc?: boolean };
type Cadastro = Omit<OperadorSdr, "faixas" | "meta_desde" | "regra_ninja_qc"> & { metas: Vigencia[] };

const PADRAO: Vigencia[] = [{ desde: "2026-01", faixas: [40, 50, 60] }];

const CADASTRO: Cadastro[] = [
  { id: "benhur", nome: "Benhur Ramos", nomes_externos: ["Benhur", "Ben", "Ramos", "Joao Filipe"], metas: PADRAO },
  { id: "glaucio", nome: "Glaucio Portela", nomes_externos: ["Glaucio", "Portela", "Lucio Borges"], metas: PADRAO },
  { id: "guilherme", nome: "Guilherme Alves", nomes_externos: ["Guilherme", "Delrue", "Alves"], metas: PADRAO },
  { id: "arthur", nome: "Arthur", nomes_externos: ["Arthur", "Artur"], metas: [{ desde: "2026-01", faixas: [30, 40, 50], regra_ninja_qc: true }] },
  {
    id: "fatima",
    nome: "Fátima Consuelo",
    nomes_externos: ["Fatima Consuelo"],
    metas: [
      { desde: "2026-11", faixas: [20, 30, 40] },
      { desde: "2026-12", faixas: [30, 40, 50] },
    ],
  },
];
const EQUIPE: Vigencia[] = [{ desde: "2026-01", faixas: [150, 188, 225] }];

// A meta de um mês é a da vigência mais recente que já começou (sem coluna de fim).
const vigente = (metas: Vigencia[], mes: string) =>
  [...metas].filter((m) => m.desde <= mes).sort((a, b) => b.desde.localeCompare(a.desde))[0] ?? null;

export function operadoresDoMes(mes: string): OperadoresDoMes {
  const equipe = vigente(EQUIPE, mes);
  return {
    mes,
    metrica: "leads_qualificados",
    equipe: { faixas: equipe?.faixas ?? null, meta_desde: equipe?.desde ?? null },
    operadores: CADASTRO.map(({ metas, ...o }) => {
      const m = vigente(metas, mes);
      return { ...o, faixas: m?.faixas ?? null, meta_desde: m?.desde ?? null, regra_ninja_qc: m?.regra_ninja_qc ?? false };
    }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}
