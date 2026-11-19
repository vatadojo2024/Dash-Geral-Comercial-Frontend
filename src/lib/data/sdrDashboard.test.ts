import { describe, expect, it } from "vitest";
import {
  agregarDashboard,
  contarNaoIdentificadas,
  INICIO_REGRA_NINJA_QC,
  detalheDosQualificados,
  montarTime,
  POOL,
  qualificadosDoCard,
  textoDasMetas,
  totalDosQualificados,
  type OperadoresDoMes,
  type SdrDashboardPayload,
} from "./sdrDashboard";
import { operadoresDoMes } from "@/lib/mock/operadores_sdr";

// O time do mês como a rota de operadores manda (no modo demonstração).
const timeDe = (mes: string) => montarTime(operadoresDoMes(mes));

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
    ]), "2026-10", timeDe("2026-10"));
  // Pelo nome curto de antes; a chave agora é o id do operador da rota.
  const ID: Record<string, string> = { Glaucio: "glaucio", Delrue: "guilherme", Benhur: "benhur", Arthur: "arthur" };
  const de = (sdr: string) => outubro.sdrs.find((s) => s.sdr === (ID[sdr] ?? sdr))!;

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
      payload([linha("Glaucio", "2026-11-02", "Ninja", 6), linha("Glaucio", "2026-11-03", "Black", 24)]), "2026-11", timeDe("2026-11"));
    const g = d.sdrs.find((s) => s.sdr === "glaucio")!;
    expect([g.qualificadosMeta, g.metaAtual, g.gap]).toEqual([24, 40, 16]);
    expect(detalheDosQualificados(g)).toBe("30 qualificados · 6 Ninja fora · 0 bônus QC");
  });

  it("demais SDRs: QC não conta direto, mas cada 3 valem +1", () => {
    const d = agregarDashboard(
      payload([
        linha("Benhur", "2026-10-03", "Ninja", 3),
        linha("Benhur", "2026-10-04", "QC", 7),
        linha("Benhur", "2026-10-05", "Black", 8),
      ]), "2026-10", timeDe("2026-10"));
    const b = d.sdrs.find((s) => s.sdr === "benhur")!;
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
      ]), "2026-10", timeDe("2026-10"));
    const a = d.sdrs.find((s) => s.sdr === "arthur")!;
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
      ]), "2026-10", timeDe("2026-10"));
    const dl = d.sdrs.find((s) => s.sdr === "guilherme")!;
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
      ]), "2026-09", timeDe("2026-09"));
    const g = d.sdrs.find((s) => s.sdr === "glaucio")!;
    expect(g.qualificados).toBe(15);
    expect(g.qualificadosMeta).toBe(15); // 8 Ninja + 4 Black + ⌊9/3⌋
    expect(g.foraDaMeta).toBe(0);
    expect(detalheDosQualificados(g)).toBe("12 qualificados · 3 bônus QC · regra antiga (antes de out/2026)");
  });
});

describe("Total \"Leads qualificados\" do topo (pedido de 03/11/2026)", () => {
  const time = (d: ReturnType<typeof agregarDashboard>) => d.sdrs.filter((s) => !s.pool);

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
      ]), "2026-11", timeDe("2026-11"));
    const sdrs = time(d);
    const t = totalDosQualificados(sdrs);
    // Cards, na ordem da rota (alfabética): Arthur 4 + 5 = 9, Benhur 3, Fátima 0,
    // Glaucio 24, Guilherme 5 + ⌊7/3⌋ = 7. Antes: Glaucio 24, Delrue 5 + ⌊7/3⌋ = 7, Benhur 3, Arthur 4 + 5 = 9.
    expect(sdrs.map(qualificadosDoCard)).toEqual([9, 3, 0, 24, 7]);
    expect(t.total).toBe(43);
    expect(t.detalhe).toBe("44 qualificados · 8 Ninja fora · 2 bônus QC · 5 QC que valem 1 (Arthur)");
    expect(44 - 8 + 2 + 5).toBe(t.total);
  });

  it("sem QC do Arthur, a dica tem o formato do card", () => {
    const d = agregarDashboard(payload([linha("Glaucio", "2026-11-02", "Ninja", 6), linha("Glaucio", "2026-11-03", "Black", 24)]), "2026-11", timeDe("2026-11"));
    expect(totalDosQualificados(time(d))).toEqual({ total: 24, detalhe: "30 qualificados · 6 Ninja fora · 0 bônus QC" });
  });

  it("meses antes de out/2026: regra antiga, como no card", () => {
    const d = agregarDashboard(
      payload([
        linha("Glaucio", "2026-09-15", "Ninja", 8),
        linha("Glaucio", "2026-09-20", "QC", 9),
        linha("Arthur", "2026-09-21", "QC", 3),
        linha("Arthur", "2026-09-22", "Black", 2),
      ]), "2026-09", timeDe("2026-09"));
    const t = totalDosQualificados(time(d));
    expect(t.total).toBe(11 + 3); // Glaucio 8 + ⌊9/3⌋; Arthur 2 + ⌊3/3⌋
    expect(t.detalhe).toBe("10 qualificados · 4 bônus QC · regra antiga (antes de out/2026)");
  });
});

describe("SDRs e metas da rota de operadores (backend 4197783)", () => {
  const time = timeDe("2026-11");
  it("reconhece pelo nome do cadastro e pelos nomes externos, sem acento e sem maiúsculas, inclusive os antigos", () => {
    for (const n of ["Glaucio", "Glaucio Portela", "GLÁUCIO  portela", "Lúcio Borges", "lucio borges", "Portela"]) expect(time.reconhecer(n)).toBe("glaucio");
    for (const n of ["Benhur", "Benhur Ramos", "João Filipe", "Ben", "Ramos"]) expect(time.reconhecer(n)).toBe("benhur");
    for (const n of ["Delrue", "Guilherme Alves", "Guilherme"]) expect(time.reconhecer(n)).toBe("guilherme");
    for (const n of ["Arthur", "Artur"]) expect(time.reconhecer(n)).toBe("arthur");
    expect(time.reconhecer("Fátima Consuelo")).toBe("fatima");
    // Parte das palavras de um nome aceito também casa ("Lúcio" → "Lucio Borges"; "Fátima" → "Fatima Consuelo").
    expect([time.reconhecer("Lúcio"), time.reconhecer("Fátima")]).toEqual(["glaucio", "fatima"]);
  });

  it("palavra solta de outra pessoa não casa por pedaço ('Ruben', 'Pedro Ramos', 'Ana Borges'); vazio é não identificado", () => {
    for (const n of ["Ruben", "Pedro Ramos", "Ana Borges", "Bento", "", null]) expect(time.reconhecer(n)).toBeNull();
  });

  it("nome que serve para mais de um operador fica não identificado (não se chuta)", () => {
    const o: OperadoresDoMes = {
      mes: "2026-11",
      equipe: { faixas: null, meta_desde: null },
      operadores: [
        { id: "a", nome: "Ana Souza", nomes_externos: ["Ana"], faixas: null, meta_desde: null, regra_ninja_qc: false },
        { id: "b", nome: "Ana Lima", nomes_externos: ["Ana"], faixas: null, meta_desde: null, regra_ninja_qc: false },
      ],
    };
    expect([montarTime(o).reconhecer("Ana"), montarTime(o).reconhecer("Ana Lima")]).toEqual([null, "b"]);
  });

  it("a Fátima aparece com 20/30/40 em novembro e 30/40/50 a partir de dezembro; o nome exibido é o do cadastro", () => {
    const linhaFatima = [linha("Fatima Consuelo", "2026-11-05", "Black", 7)];
    const nov = agregarDashboard(payload(linhaFatima), "2026-11", timeDe("2026-11"));
    const fatima = nov.sdrs.find((s) => s.sdr === "fatima")!;
    expect([fatima.nome, fatima.metas, fatima.qualificadosMeta, fatima.metaAtual, fatima.gap]).toEqual(["Fátima Consuelo", [20, 30, 40], 7, 20, 13]);
    const dez = agregarDashboard(payload([]), "2026-12", timeDe("2026-12"));
    expect(dez.sdrs.find((s) => s.sdr === "fatima")?.metas).toEqual([30, 40, 50]);
    expect(nov.sdrs.find((s) => s.sdr === "glaucio")?.nome).toBe("Glaucio Portela");
  });

  it("sem meta no mês: metas null, sem gap nem nível (a tela mostra 'sem meta definida', não zero)", () => {
    const out = agregarDashboard(payload([linha("Fatima Consuelo", "2026-10-05", "Black", 3)]), "2026-10", timeDe("2026-10"));
    const fatima = out.sdrs.find((s) => s.sdr === "fatima")!;
    expect([fatima.metas, fatima.metaAtual, fatima.gap, fatima.nivelAtual, fatima.qualificadosMeta]).toEqual([null, null, null, null, 3]);
    expect(qualificadosDoCard(fatima)).toBe(3);
  });

  it("regra Ninja/QC pelo sinalizador da rota (o cálculo continua aqui)", () => {
    const linhas = [linha("Arthur", "2026-11-09", "Ninja", 4), linha("Arthur", "2026-11-10", "QC", 3), linha("Glaucio", "2026-11-09", "Ninja", 4)];
    const d = agregarDashboard(payload(linhas), "2026-11", timeDe("2026-11"));
    expect(d.sdrs.find((s) => s.sdr === "arthur")?.qualificadosMeta).toBe(7); // tudo vale 1
    expect(d.sdrs.find((s) => s.sdr === "glaucio")?.qualificadosMeta).toBe(0); // Ninja não conta
  });

  it("o pool (Hana) fica fora dos SDRs e conta na equipe; nome desconhecido é contado no aviso", () => {
    const d = agregarDashboard(
      payload([linha("Hana", "2026-11-02", "Black", 5), linha("Pessoa Desconhecida", "2026-11-02", "Black", 2), linha("Glaucio", "2026-11-03", "Black", 1)]),
      "2026-11",
      time,
    );
    const pool = d.sdrs.find((s) => s.sdr === POOL)!;
    expect([pool.pool, pool.nome, pool.metas, pool.qualificados]).toEqual([true, "Hana", null, 5]);
    expect(d.naoIdentificadas).toBe(1);
    expect(contarNaoIdentificadas([{ sdr: "Glaucio" }, { sdr: "x" }, { sdr: "Hana" }], time.reconhecer)).toBe(1);
  });

  it("o texto do topo sai dos dados do mês (era fixo '40/50/60 (Arthur 30/40/50)')", () => {
    expect(textoDasMetas(time, "2026-11")).toBe(
      "meta escalonada individual do mês: 30/40/50 (Arthur), 40/50/60 (Benhur Ramos, Glaucio Portela, Guilherme Alves), 20/30/40 (Fátima Consuelo) · Ninja e QC contam 1 cada só para Arthur; para os demais, Ninja não conta e cada 3 QC valem +1",
    );
    expect(textoDasMetas(timeDe("2026-10"), "2026-10")).toMatch(/sem meta definida: Fátima Consuelo/);
    expect(textoDasMetas(timeDe("2026-06"), "2026-06")).toMatch(/antes de out\/2026, regra antiga/);
  });
});
