"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { EducacionalError, type PaginaAlunos } from "@/lib/educacional/apiEducacional";
import { linhaDoDetalhe, type AlunoDetalhe, type AlunoLinha } from "@/lib/educacional/contrato";
import { useAvisos, type Aviso } from "./Avisos";
import { CHAVES } from "./dados";
import { avisarGravacao } from "./lote/eventos";
import { mensagemDoErro } from "./partes";

// ---------------------------------------------------------------------------
// Gravação com atualização otimista (spec Fase 2, seção 7.1):
//   1. aplica a mudança na hora no Raio-X e nas listas (tabela e Kanban);
//   2. ao responder, troca pelo AlunoDetalhe devolvido (já recalculado);
//   3. no erro, desfaz e avisa: 400 → mensagem do campo; 409 → texto da spec
//      e recarrega o aluno; rede → "Tentar de novo"; 403 → home do módulo.
//   4. "Salvo" discreto; Cockpit e funil recarregam quando afeta totais.
// O front não calcula nada aqui: o otimista é só o que o usuário digitou.
// ---------------------------------------------------------------------------

export const MENSAGEM_409 = "Este aluno foi alterado por outra pessoa. Os dados foram atualizados; refaça sua alteração.";

export type Gravacao = {
  alunoId: string;
  versao: number;
  executar: (versao: number) => Promise<AlunoDetalhe>;
  // O que aparece na hora (só os campos editados). Sem isso, espera a resposta.
  noAluno?: (a: AlunoDetalhe) => AlunoDetalhe;
  naLinha?: (l: AlunoLinha) => AlunoLinha;
  // Etapa, checkpoint, faixa, sinais, arquivar: recarrega Cockpit e funil.
  afetaTotais?: boolean;
};

export type Resultado = { ok: true; aluno: AlunoDetalhe } | { ok: false; erro: unknown };

function mapearLinhas(dados: unknown, id: string, f: (l: AlunoLinha) => AlunoLinha): unknown {
  const p = dados as PaginaAlunos | undefined;
  if (!p || !Array.isArray(p.itens)) return dados;
  return { ...p, itens: p.itens.map((l) => (l.id === id ? f(l) : l)) };
}

// O AlunoDetalhe devolvido pelo servidor passa a valer no Raio-X e nas listas
// (também usado pelo salvar em lote).
export function trocarAlunoNoCache(queryClient: QueryClient, aluno: AlunoDetalhe) {
  queryClient.setQueriesData({ queryKey: CHAVES.aluno(aluno.id) }, aluno);
  const linha = linhaDoDetalhe(aluno);
  queryClient.setQueriesData({ queryKey: CHAVES.alunos }, (dados: unknown) => mapearLinhas(dados, aluno.id, () => linha));
}

type Dependencias = { queryClient: QueryClient; avisar: (a: Aviso) => void; irParaHome: () => void };

// Lógica pura (testável sem React); o hook só injeta as dependências.
export async function gravarAluno(d: Dependencias, g: Gravacao): Promise<Resultado> {
  const { queryClient, avisar } = d;
  const chaveAluno = CHAVES.aluno(g.alunoId);
  await Promise.all([
    queryClient.cancelQueries({ queryKey: chaveAluno }),
    queryClient.cancelQueries({ queryKey: CHAVES.alunos }),
  ]);
  const antes: [QueryKey, unknown][] = [
    ...queryClient.getQueriesData({ queryKey: chaveAluno }),
    ...queryClient.getQueriesData({ queryKey: CHAVES.alunos }),
  ];

  // 1. Na hora.
  if (g.noAluno) {
    const f = g.noAluno;
    queryClient.setQueriesData<AlunoDetalhe>({ queryKey: chaveAluno }, (a) => (a ? f(a) : a));
  }
  if (g.naLinha) {
    const f = g.naLinha;
    queryClient.setQueriesData({ queryKey: CHAVES.alunos }, (dados: unknown) => mapearLinhas(dados, g.alunoId, f));
  }

  try {
    const aluno = await g.executar(g.versao);
    // 2. A resposta manda (e as pendências do aluno, se houver, passam para a versão nova).
    trocarAlunoNoCache(queryClient, aluno);
    avisarGravacao({ aluno, versaoEnviada: g.versao });
    void queryClient.invalidateQueries({ queryKey: CHAVES.alunos });
    void queryClient.invalidateQueries({ queryKey: CHAVES.historico(g.alunoId) });
    if (g.afetaTotais) void queryClient.invalidateQueries({ queryKey: CHAVES.resumo });
    avisar({ tipo: "sucesso", texto: "Salvo" });
    return { ok: true, aluno };
  } catch (erro) {
    // 3. Desfaz.
    for (const [chave, dados] of antes) queryClient.setQueryData(chave, dados);
    if (erro instanceof EducacionalError && erro.status === 409) {
      const atual = erro.alunoAtual;
      if (atual) trocarAlunoNoCache(queryClient, atual);
      void queryClient.invalidateQueries({ queryKey: chaveAluno });
      void queryClient.invalidateQueries({ queryKey: CHAVES.alunos });
      avisar({ tipo: "erro", texto: MENSAGEM_409 });
    } else if (erro instanceof EducacionalError && erro.rede) {
      avisar({
        tipo: "erro",
        texto: "Não foi possível salvar: sem conexão com o servidor.",
        acao: { rotulo: "Tentar de novo", onClick: () => void gravarAluno(d, g) },
      });
    } else if (erro instanceof EducacionalError && erro.status === 403) {
      d.irParaHome();
    } else {
      avisar({ tipo: "erro", texto: textoDoErro(erro) });
    }
    return { ok: false, erro };
  }
}

function textoDoErro(erro: unknown): string {
  const motivo = erro instanceof EducacionalError ? (erro.corpo.mensagem ?? erro.message) : mensagemDoErro(erro);
  return `Não foi possível salvar. ${motivo}`;
}

export function useGravacao() {
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const router = useRouter();
  return useCallback(
    (g: Gravacao) => gravarAluno({ queryClient, avisar, irParaHome: () => router.replace("/") }, g),
    [queryClient, avisar, router],
  );
}

// Escritas sem aluno (aluno novo, configuração): mesmo tratamento de erro, sem otimista.
export function useAcaoComAviso() {
  const avisar = useAvisos();
  const router = useRouter();
  return useCallback(
    async <T,>(executar: () => Promise<T>, sucesso = "Salvo"): Promise<{ ok: true; valor: T } | { ok: false; erro: unknown }> => {
      try {
        const valor = await executar();
        avisar({ tipo: "sucesso", texto: sucesso });
        return { ok: true, valor };
      } catch (erro) {
        if (erro instanceof EducacionalError && erro.status === 403) router.replace("/");
        else if (erro instanceof EducacionalError && erro.rede) {
          avisar({ tipo: "erro", texto: "Não foi possível salvar: sem conexão com o servidor." });
        } else avisar({ tipo: "erro", texto: textoDoErro(erro) });
        return { ok: false, erro };
      }
    },
    [avisar, router],
  );
}
