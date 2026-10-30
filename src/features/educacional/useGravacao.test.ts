import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  _simularGravacaoEmTeste,
  atualizarAluno,
  buscarAluno,
  buscarAlunos,
  buscarConfig,
  type PaginaAlunos,
} from "@/lib/educacional/apiEducacional";
import type { AlunoDetalhe } from "@/lib/educacional/contrato";
import { _zerarMemoria } from "@/lib/educacional/mock/banco";
import type { Aviso } from "./Avisos";
import { CHAVES } from "./dados";
import { gravarAluno, MENSAGEM_409, type Gravacao } from "./useGravacao";

// Gravação otimista (spec Fase 2, 7.1) sobre o adapter do modo demonstração.

let qc: QueryClient;
let avisos: Aviso[];
const irParaHome = vi.fn();
const LISTA = [...CHAVES.alunos, { ordem: "risco" }, null];

async function preparar() {
  const lista = await buscarAlunos({});
  const aluno = await buscarAluno(lista.itens[0].id);
  qc.setQueryData(LISTA, lista);
  qc.setQueryData([...CHAVES.aluno(aluno.id), null], aluno);
  qc.setQueryData([...CHAVES.resumo, null], { marcador: true });
  return aluno;
}

const naLista = (id: string) => qc.getQueryData<PaginaAlunos>(LISTA)!.itens.find((l) => l.id === id)!;
const noRaioX = (id: string) => qc.getQueryData<AlunoDetalhe>([...CHAVES.aluno(id), null])!;

function renomear(a: AlunoDetalhe, nome: string): Gravacao {
  return {
    alunoId: a.id,
    versao: a.versao,
    executar: (v) => atualizarAluno(a.id, v, { nome }),
    noAluno: (x) => ({ ...x, nome }),
    naLinha: (l) => ({ ...l, nome }),
  };
}

beforeEach(() => {
  _zerarMemoria();
  _simularGravacaoEmTeste(null);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  avisos = [];
  irParaHome.mockReset();
});

const deps = () => ({ queryClient: qc, avisar: (a: Aviso) => void avisos.push(a), irParaHome });

describe("gravarAluno", () => {
  it("muda na hora, troca pela resposta da API e avisa 'Salvo'", async () => {
    const a = await preparar();
    let liberar!: () => void;
    const segura = new Promise<void>((ok) => (liberar = ok));
    const g = renomear(a, "Nome Novo");
    const pendente = gravarAluno(deps(), { ...g, executar: async (v) => (await segura, g.executar(v)) });
    await vi.waitFor(() => expect(naLista(a.id).nome).toBe("Nome Novo")); // otimista, antes da resposta
    expect(noRaioX(a.id).nome).toBe("Nome Novo");
    expect(noRaioX(a.id).versao).toBe(a.versao);
    liberar();
    const r = await pendente;
    expect(r.ok).toBe(true);
    expect(noRaioX(a.id).versao).toBe(a.versao + 1); // veio da resposta
    expect(naLista(a.id).versao).toBe(a.versao + 1);
    expect(avisos).toEqual([{ tipo: "sucesso", texto: "Salvo" }]);
  });

  it("Kanban: mudar de etapa move o card na hora e os dias zeram com a resposta", async () => {
    const a = await preparar();
    const destino = (await buscarConfig()).etapas.find((e) => e.id !== a.etapa.id)!;
    const r = await gravarAluno(deps(), {
      alunoId: a.id,
      versao: a.versao,
      executar: (v) => atualizarAluno(a.id, v, { etapa_id: destino.id }),
      naLinha: (l) => ({ ...l, etapa: { id: destino.id, nome: destino.nome } }),
      afetaTotais: true,
    });
    expect(r.ok).toBe(true);
    expect(naLista(a.id).etapa.id).toBe(destino.id);
    expect(naLista(a.id).dias_na_etapa.automatico).toBe(0);
    expect(qc.getQueryState([...CHAVES.resumo, null])?.isInvalidated).toBe(true);
  });

  it("409: desfaz, mostra o texto da spec e recarrega o aluno atual", async () => {
    const a = await preparar();
    _simularGravacaoEmTeste("409");
    const r = await gravarAluno(deps(), renomear(a, "Não pode"));
    expect(r.ok).toBe(false);
    expect(naLista(a.id).nome).toBe(a.nome);
    expect(noRaioX(a.id).nome).toBe(a.nome);
    expect(noRaioX(a.id).versao).toBe(a.versao + 1); // aluno atual do servidor
    expect(avisos).toEqual([{ tipo: "erro", texto: MENSAGEM_409 }]);
  });

  it("400: desfaz e mostra a mensagem do campo", async () => {
    const a = await preparar();
    const r = await gravarAluno(deps(), renomear(a, "   "));
    expect(r.ok).toBe(false);
    expect(naLista(a.id).nome).toBe(a.nome);
    expect(avisos[0]).toEqual({ tipo: "erro", texto: "Não foi possível salvar. Nome é obrigatório. Preencha o campo." });
  });

  it("rede: desfaz e oferece 'Tentar de novo', que grava de verdade", async () => {
    const a = await preparar();
    _simularGravacaoEmTeste("rede");
    const r = await gravarAluno(deps(), renomear(a, "Depois da rede"));
    expect(r.ok).toBe(false);
    expect(naLista(a.id).nome).toBe(a.nome);
    expect(avisos[0].acao?.rotulo).toBe("Tentar de novo");
    _simularGravacaoEmTeste(null);
    avisos[0].acao!.onClick();
    await vi.waitFor(() => expect(avisos.at(-1)).toEqual({ tipo: "sucesso", texto: "Salvo" }));
    expect((await buscarAluno(a.id)).nome).toBe("Depois da rede");
  });

  it("403: vai para a home do módulo permitido", async () => {
    const a = await preparar();
    const { EducacionalError } = await import("@/lib/educacional/apiEducacional");
    const r = await gravarAluno(deps(), {
      ...renomear(a, "X"),
      executar: () => Promise.reject(new EducacionalError("Sem permissão", 403)),
    });
    expect(r.ok).toBe(false);
    expect(irParaHome).toHaveBeenCalled();
    expect(naLista(a.id).nome).toBe(a.nome);
  });
});
