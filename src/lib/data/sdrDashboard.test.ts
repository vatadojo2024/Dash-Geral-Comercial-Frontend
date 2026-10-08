import { describe, expect, it } from "vitest";
import {
  agregarDashboard,
  INICIO_META_SEM_NINJA_QC,
  metasDoSdr,
  normalizarSdr,
  SDRS_DASHBOARD,
  type SdrDashboardPayload,
} from "./sdrDashboard";

function payload(
  por_produto: SdrDashboardPayload["por_produto"],
): SdrDashboardPayload {
  return { agendadas: [], realizadas: [], no_show: [], remarcadas: [], por_produto };
}

const linha = (sdr: string, data: string, produto: string, total: number) => ({
  sdr,
  data_referencia: data,
  produto,
  total,
});

describe("Arthur no dashboard SDR", () => {
  it("é reconhecido pelo nome, com e sem h, sem roubar o Benhur", () => {
    expect(SDRS_DASHBOARD).toContain("Arthur");
    expect(normalizarSdr("Arthur")).toBe("Arthur");
    expect(normalizarSdr("Artur Souza")).toBe("Arthur");
    expect(normalizarSdr("Benhur Ramos")).toBe("Benhur");
  });

  it("tem metas próprias 30/40/50; os demais seguem 40/50/60; Hana sem meta", () => {
    expect(metasDoSdr("Arthur")).toEqual([30, 40, 50]);
    expect(metasDoSdr("Benhur")).toEqual([40, 50, 60]);
    expect(metasDoSdr("Hana")).toBeNull();
  });
});

describe("Meta individual sem Ninja e QC (a partir de 08/10/2026)", () => {
  it("o corte é 08/10/2026", () => {
    expect(INICIO_META_SEM_NINJA_QC).toBe("2026-10-08");
  });

  it("SDR regular: Ninja/QC antes do corte contam, depois não", () => {
    const d = agregarDashboard(
      payload([
        linha("Benhur", "2026-10-03", "Ninja", 5),
        linha("Benhur", "2026-10-08", "Ninja", 4), // dia do corte: já não conta
        linha("Benhur", "2026-10-02", "Quebrando o Código", 6),
        linha("Benhur", "2026-10-10", "QC", 3),
        linha("Benhur", "2026-10-09", "Black", 10),
      ]),
      "2026-10",
    );
    const b = d.sdrs.find((s) => s.sdr === "Benhur")!;
    // Qualificados (equipe) seguem a regra antiga: 9 Ninja + 10 Black + ⌊9/3⌋.
    expect(b.qualificados).toBe(22);
    // Meta: 5 Ninja + 10 Black + ⌊6/3⌋ — só o que veio antes do corte.
    expect(b.qualificadosMeta).toBe(17);
    expect(b.foraDaMeta).toBe(7);
    expect(b.metas).toEqual([40, 50, 60]);
    expect(b.gap).toBe(23);
  });

  it("Arthur: toda reunião conta 1 para a meta, QC inclusive", () => {
    const d = agregarDashboard(
      payload([
        linha("Arthur", "2026-10-09", "Ninja", 20),
        linha("Arthur", "2026-10-10", "QC", 12),
        linha("Arthur", "2026-10-11", "Prime", 1),
      ]),
      "2026-10",
    );
    const a = d.sdrs.find((s) => s.sdr === "Arthur")!;
    expect(a.qualificadosMeta).toBe(33);
    expect(a.foraDaMeta).toBe(0);
    expect(a.metasBatidas).toBe(1);
    expect(a.metaAtual).toBe(40);
    expect(a.nivelAtual).toBe("M2");
    expect(a.gap).toBe(7);
    // O número da equipe não muda de fórmula: 21 Ninja+ + ⌊12/3⌋.
    expect(a.qualificados).toBe(25);
  });

  it("meses anteriores ao corte não mudam", () => {
    const d = agregarDashboard(
      payload([
        linha("Glaucio", "2026-09-15", "Ninja", 8),
        linha("Glaucio", "2026-09-20", "QC", 9),
      ]),
      "2026-09",
    );
    const g = d.sdrs.find((s) => s.sdr === "Glaucio")!;
    expect(g.qualificadosMeta).toBe(g.qualificados);
    expect(g.qualificadosMeta).toBe(11);
    expect(g.foraDaMeta).toBe(0);
  });
});
