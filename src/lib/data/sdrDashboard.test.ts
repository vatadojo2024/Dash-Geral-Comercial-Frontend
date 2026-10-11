import { describe, expect, it } from "vitest";
import {
  agregarDashboard,
  metasDoSdr,
  notaDaMeta,
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

describe("Meta individual: Ninja e QC não contam (regra de 11/10/2026)", () => {
  // Os números do card em outubro (prints do Vata, 11/10).
  const outubro = agregarDashboard(
    payload([
      linha("Glaucio", "2026-10-02", "Ninja", 2),
      linha("Glaucio", "2026-10-09", "Ninja", 1),
      linha("Glaucio", "2026-10-06", "Black", 6),
      linha("Glaucio", "2026-10-07", "Prime", 2),
      linha("Delrue", "2026-10-01", "Ninja", 4),
      linha("Delrue", "2026-10-05", "Black", 6),
      linha("Benhur", "2026-10-03", "Black", 7),
      linha("Benhur", "2026-10-10", "Private", 3),
    ]),
    "2026-10",
  );
  const de = (sdr: string) => outubro.sdrs.find((s) => s.sdr === sdr)!;

  it("desconta TODO Ninja, de qualquer data; o total de qualificados não muda", () => {
    expect([de("Glaucio").qualificados, de("Glaucio").qualificadosMeta, de("Glaucio").gap]).toEqual([11, 8, 32]);
    expect([de("Delrue").qualificados, de("Delrue").qualificadosMeta, de("Delrue").gap]).toEqual([10, 6, 34]);
    expect([de("Benhur").qualificados, de("Benhur").qualificadosMeta, de("Benhur").gap]).toEqual([10, 10, 30]);
  });

  it("texto da conta: só Ninja, nada fora", () => {
    expect(notaDaMeta(de("Glaucio"))).toBe("3 Ninja fora");
    expect(notaDaMeta(de("Delrue"))).toBe("4 Ninja fora");
    expect(notaDaMeta(de("Benhur"))).toBe("nada fora");
  });

  it("QC: não conta direto, mas cada 3 valem +1", () => {
    const d = agregarDashboard(
      payload([
        linha("Benhur", "2026-10-03", "Ninja", 3),
        linha("Benhur", "2026-10-04", "QC", 7),
        linha("Benhur", "2026-10-05", "Black", 8),
      ]),
      "2026-10",
    );
    const b = d.sdrs.find((s) => s.sdr === "Benhur")!;
    expect(b.qualificadosMeta).toBe(10); // (3 + 7 + 8 − 3 − 7) + ⌊7/3⌋
    expect(b.foraDaMeta).toBe(10);
    expect(notaDaMeta(b)).toBe("3 Ninja, 7 QC fora · +2 bônus");
    expect(notaDaMeta({ metaDetalhe: { ninja: 3, qc: 2, bonusQC: 0 } })).toBe("3 Ninja, 2 QC fora · +0 bônus");
    expect(b.qualificados).toBe(13); // total segue a regra antiga: 11 Ninja+ + ⌊7/3⌋
  });

  it("vale para o Arthur também (sem exceção)", () => {
    const d = agregarDashboard(
      payload([
        linha("Arthur", "2026-10-09", "Ninja", 20),
        linha("Arthur", "2026-10-10", "QC", 12),
        linha("Arthur", "2026-10-11", "Prime", 1),
      ]),
      "2026-10",
    );
    const a = d.sdrs.find((s) => s.sdr === "Arthur")!;
    expect(a.qualificadosMeta).toBe(5); // 1 Prime + ⌊12/3⌋
    expect(a.metas).toEqual([30, 40, 50]);
    expect(a.gap).toBe(25);
  });

  it("produto desconhecido CONTA para a meta; rótulo é comparado exato", () => {
    const d = agregarDashboard(
      payload([
        linha("Glaucio", "2026-10-03", "Mentoria Nova", 2),
        linha("Glaucio", "2026-10-04", " ninja ", 1),
        linha("Glaucio", "2026-10-05", "Black", 3),
      ]),
      "2026-10",
    );
    const g = d.sdrs.find((s) => s.sdr === "Glaucio")!;
    expect(g.qualificadosMeta).toBe(5); // 2 desconhecidos + 3 Black; o Ninja sai
    expect(g.metaDetalhe).toEqual({ ninja: 1, qc: 0, bonusQC: 0 });
  });

  it("QC pelo nome completo é QC (mesmo produto); variação de nome não é", () => {
    const d = agregarDashboard(
      payload([
        linha("Delrue", "2026-10-03", "Quebrando Código", 6),
        linha("Delrue", "2026-10-04", "Quebrando o Código", 3),
        linha("Delrue", "2026-10-05", "Ninja Anual", 2), // rótulo desconhecido: conta
      ]),
      "2026-10",
    );
    const dl = d.sdrs.find((s) => s.sdr === "Delrue")!;
    expect(dl.metaDetalhe).toEqual({ ninja: 0, qc: 9, bonusQC: 3 });
    expect(dl.qualificadosMeta).toBe(5); // 2 "Ninja Anual" + ⌊9/3⌋
  });

  it("não depende de data: setembro também desconta", () => {
    const d = agregarDashboard(
      payload([
        linha("Glaucio", "2026-09-15", "Ninja", 8),
        linha("Glaucio", "2026-09-20", "QC", 9),
        linha("Glaucio", "2026-09-21", "Black", 4),
      ]),
      "2026-09",
    );
    const g = d.sdrs.find((s) => s.sdr === "Glaucio")!;
    expect(g.qualificados).toBe(15);
    expect(g.qualificadosMeta).toBe(7); // 4 Black + ⌊9/3⌋
  });
});
