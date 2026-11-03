import { describe, expect, it } from "vitest";
import {
  agregarDashboard,
  INICIO_REGRA_NINJA_QC,
  detalheDosQualificados,
  metasDoSdr,
  normalizarSdr,
  qualificadosDoCard,
  SDRS_DASHBOARD,
  totalDosQualificados,
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

describe("Meta individual: Ninja e QC (decisões de 11/10/2026)", () => {
  it("a regra vale para calls de 01/10/2026 em diante", () => {
    expect(INICIO_REGRA_NINJA_QC).toBe("2026-10-01");
  });

  // Os números do card em outubro (prints do Vata, 11/10).
  const outubro = agregarDashboard(
    payload([
      linha("Glaucio", "2026-10-02", "Ninja", 2),
      linha("Glaucio", "2026-10-09", "Ninja", 1),
      linha("Glaucio", "2026-10-06", "Black", 6),
      linha("Glaucio", "2026-10-07", "Prime", 2),
      linha("Delrue", "2026-10-01", "Ninja", 4), // o próprio dia 01 já está na regra
      linha("Delrue", "2026-10-05", "Black", 6),
      linha("Benhur", "2026-10-03", "Black", 7),
      linha("Benhur", "2026-10-10", "Private", 3),
    ]),
    "2026-10",
  );
  const de = (sdr: string) => outubro.sdrs.find((s) => s.sdr === sdr)!;

  it("demais SDRs: desconta todo Ninja do mês; o total de qualificados não muda", () => {
    expect([de("Glaucio").qualificados, de("Glaucio").qualificadosMeta, de("Glaucio").gap]).toEqual([11, 8, 32]);
    expect([de("Delrue").qualificados, de("Delrue").qualificadosMeta, de("Delrue").gap]).toEqual([10, 6, 34]);
    expect([de("Benhur").qualificados, de("Benhur").qualificadosMeta, de("Benhur").gap]).toEqual([10, 10, 30]);
  });

  it("dica do card: os números fecham a conta da meta", () => {
    expect(detalheDosQualificados(de("Glaucio"))).toBe("11 qualificados · 3 Ninja fora · 0 bônus QC");
    expect(detalheDosQualificados(de("Delrue"))).toBe("10 qualificados · 4 Ninja fora · 0 bônus QC");
    expect(detalheDosQualificados(de("Benhur"))).toBe("10 qualificados · 0 Ninja fora · 0 bônus QC");
  });

  it("exemplo do pedido de 03/11: 30 qualificados, 6 Ninja fora → card 24, gap 16", () => {
    const d = agregarDashboard(
      payload([linha("Glaucio", "2026-11-02", "Ninja", 6), linha("Glaucio", "2026-11-03", "Black", 24)]),
      "2026-11",
    );
    const g = d.sdrs.find((s) => s.sdr === "Glaucio")!;
    expect([g.qualificadosMeta, g.metaAtual, g.gap]).toEqual([24, 40, 16]);
    expect(detalheDosQualificados(g)).toBe("30 qualificados · 6 Ninja fora · 0 bônus QC");
  });

  it("demais SDRs: QC não conta direto, mas cada 3 valem +1", () => {
    const d = agregarDashboard(
      payload([
        linha("Benhur", "2026-10-03", "Ninja", 3),
        linha("Benhur", "2026-10-04", "QC", 7),
        linha("Benhur", "2026-10-05", "Black", 8),
      ]),
      "2026-10",
    );
    const b = d.sdrs.find((s) => s.sdr === "Benhur")!;
    expect(b.qualificadosMeta).toBe(10); // 8 Black + ⌊7/3⌋
    expect(b.foraDaMeta).toBe(10);
    expect(detalheDosQualificados(b)).toBe("11 qualificados · 3 Ninja fora · 2 bônus QC");
    expect(b.qualificados).toBe(13); // total segue a regra antiga: 11 Ninja+ + ⌊7/3⌋
  });

  it("Arthur: toda reunião vale 1, Ninja e QC inclusive", () => {
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
    expect([a.metasBatidas, a.metaAtual, a.nivelAtual, a.gap]).toEqual([1, 40, "M2", 7]);
    expect(detalheDosQualificados(a)).toBe("21 qualificados · 12 QC · Ninja e QC valem 1 cada");
    expect(a.qualificados).toBe(25); // número da equipe: 21 Ninja+ + ⌊12/3⌋
  });

  it("Ninja e QC por qualquer nome que os contenha; produto novo conta", () => {
    const d = agregarDashboard(
      payload([
        linha("Delrue", "2026-10-03", "Ninja Anual", 2),
        linha("Delrue", "2026-10-04", "Quebrando Código", 6),
        linha("Delrue", "2026-10-05", "Mentoria Nova", 3),
      ]),
      "2026-10",
    );
    const dl = d.sdrs.find((s) => s.sdr === "Delrue")!;
    expect(dl.metaDetalhe).toEqual({ ninja: 2, qc: 6, bonusQC: 2, regra: "padrao" });
    expect(dl.qualificadosMeta).toBe(5); // 3 do produto novo + ⌊6/3⌋
    expect(detalheDosQualificados(dl)).toBe("5 qualificados · 2 Ninja fora · 2 bônus QC");
  });

  it("meses anteriores não mudam: setembro segue a regra antiga", () => {
    const d = agregarDashboard(
      payload([
        linha("Glaucio", "2026-09-15", "Ninja", 8),
        linha("Glaucio", "2026-09-20", "QC", 9),
        linha("Glaucio", "2026-09-30", "Black", 4),
      ]),
      "2026-09",
    );
    const g = d.sdrs.find((s) => s.sdr === "Glaucio")!;
    expect(g.qualificados).toBe(15);
    expect(g.qualificadosMeta).toBe(15); // 8 Ninja + 4 Black + ⌊9/3⌋
    expect(g.foraDaMeta).toBe(0);
    expect(detalheDosQualificados(g)).toBe("12 qualificados · 3 bônus QC · regra antiga (antes de out/2026)");
  });
});

describe("Total \"Leads qualificados\" do topo (pedido de 03/11/2026)", () => {
  const time = (d: ReturnType<typeof agregarDashboard>) => d.sdrs.filter((s) => s.sdr !== "Hana");

  it("regra nova: soma dos cards, com a dica somada que fecha a conta (Arthur à parte)", () => {
    const d = agregarDashboard(
      payload([
        linha("Glaucio", "2026-11-02", "Ninja", 6),
        linha("Glaucio", "2026-11-03", "Black", 24),
        linha("Delrue", "2026-11-03", "Ninja", 2),
        linha("Delrue", "2026-11-04", "QC", 7),
        linha("Delrue", "2026-11-05", "Prime", 5),
        linha("Benhur", "2026-11-05", "Private", 3),
        linha("Arthur", "2026-11-06", "Ninja", 4),
        linha("Arthur", "2026-11-06", "QC", 5),
      ]),
      "2026-11",
    );
    const sdrs = time(d);
    const t = totalDosQualificados(sdrs);
    // Cards: Glaucio 24, Delrue 5 + ⌊7/3⌋ = 7, Benhur 3, Arthur 4 + 5 = 9.
    expect(sdrs.map(qualificadosDoCard)).toEqual([24, 7, 3, 9]);
    expect(t.total).toBe(43);
    expect(t.detalhe).toBe("44 qualificados · 8 Ninja fora · 2 bônus QC · 5 QC que valem 1 (Arthur)");
    expect(44 - 8 + 2 + 5).toBe(t.total);
  });

  it("sem QC do Arthur, a dica tem o formato do card", () => {
    const d = agregarDashboard(payload([linha("Glaucio", "2026-11-02", "Ninja", 6), linha("Glaucio", "2026-11-03", "Black", 24)]), "2026-11");
    expect(totalDosQualificados(time(d))).toEqual({ total: 24, detalhe: "30 qualificados · 6 Ninja fora · 0 bônus QC" });
  });

  it("meses antes de out/2026: regra antiga, como no card", () => {
    const d = agregarDashboard(
      payload([
        linha("Glaucio", "2026-09-15", "Ninja", 8),
        linha("Glaucio", "2026-09-20", "QC", 9),
        linha("Arthur", "2026-09-21", "QC", 3),
        linha("Arthur", "2026-09-22", "Black", 2),
      ]),
      "2026-09",
    );
    const t = totalDosQualificados(time(d));
    expect(t.total).toBe(11 + 3); // Glaucio 8 + ⌊9/3⌋; Arthur 2 + ⌊3/3⌋
    expect(t.detalhe).toBe("10 qualificados · 4 bônus QC · regra antiga (antes de out/2026)");
  });
});
