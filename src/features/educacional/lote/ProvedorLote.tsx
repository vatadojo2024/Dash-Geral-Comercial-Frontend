"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { EducacionalError, salvarLote } from "@/lib/educacional/apiEducacional";
import { definirGuardaDeSaida } from "@/lib/navegacao/guardaDeSaida";
import { useSession } from "@/features/session/SessionProvider";
import { useAvisos } from "../Avisos";
import { ConfirmarAcao } from "../Blocos";
import { CHAVES } from "../dados";
import { mensagemDoErro } from "../partes";
import { trocarAlunoNoCache } from "../useGravacao";
import { lerDoServidor } from "./alteracoes";
import { ouvirGravacoes } from "./eventos";
import { BarraDeAlteracoes } from "./BarraDeAlteracoes";
import {
  aplicarFalha,
  aplicarResposta,
  CHAVE_SESSAO,
  contar,
  descartar,
  descartarAluno,
  desfazer,
  lerGuardado,
  marcarSalvando,
  montarPedido,
  paraEnviar,
  reaplicar,
  rebasear,
  registrar,
  serializar,
  SEM_PENDENCIAS,
  type Alteracao,
  type Pendencias,
} from "./pendencias";

// ---------------------------------------------------------------------------
// Salvar em lote (Fase 3, seção 4), na casca do módulo: as alterações da aba
// Alunos ficam aqui até "Salvar" (um POST /lote), sobrevivem a recarregar a
// aba (sessionStorage) e seguem entre as telas do módulo. Sair do módulo com
// alterações pede confirmação (D6). As linhas leem o estado por
// useSyncExternalStore e recebem a entrada delas por prop (memo).
// ---------------------------------------------------------------------------

export type ResultadoDoEnvio = { salvas: number; comErro: number } | { falha: string };
type EstadoDoLote = { pendencias: Pendencias; enviando: boolean; resultado: ResultadoDoEnvio | null };

function criarArmazem() {
  let estado: EstadoDoLote = { pendencias: SEM_PENDENCIAS, enviando: false, resultado: null };
  const ouvintes = new Set<() => void>();
  return {
    get: () => estado,
    set(f: (e: EstadoDoLote) => EstadoDoLote) {
      estado = f(estado);
      ouvintes.forEach((o) => o());
    },
    subscribe(o: () => void) {
      ouvintes.add(o);
      return () => {
        ouvintes.delete(o);
      };
    },
  };
}
type Armazem = ReturnType<typeof criarArmazem>;

export type AcoesDoLote = {
  registrar: (aluno: { id: string; nome: string; versao: number }, alt: Alteracao | null) => void;
  desfazer: (alunoId: string, chave: string) => void;
  descartar: () => void;
  // Sem `apenas`, salva tudo (barra); com ele, só esses alunos ("Salvar ficha").
  salvar: (apenas?: readonly string[]) => Promise<ResultadoDoEnvio | null>;
  descartarAluno: (alunoId: string) => void;
  verVersaoAtual: (alunoId: string) => void;
  reaplicar: (alunoId: string) => void;
};

const Contexto = createContext<{ armazem: Armazem; acoes: AcoesDoLote } | null>(null);
const INICIAL: EstadoDoLote = { pendencias: SEM_PENDENCIAS, enviando: false, resultado: null };

function useContexto() {
  const c = useContext(Contexto);
  if (!c) throw new Error("Fora do ProvedorLote");
  return c;
}

export function useEstadoDoLote(): EstadoDoLote {
  const { armazem } = useContexto();
  return useSyncExternalStore(armazem.subscribe, armazem.get, () => INICIAL);
}

export function usePendencias(): Pendencias {
  const { armazem } = useContexto();
  return useSyncExternalStore(
    armazem.subscribe,
    () => armazem.get().pendencias,
    () => SEM_PENDENCIAS,
  );
}

export function useAcoesDoLote(): AcoesDoLote {
  return useContexto().acoes;
}

const dentroDoModulo = (caminho: string) => caminho === "/educacional" || caminho.startsWith("/educacional/") || caminho.startsWith("/educacional?");

export function ProvedorLote({ children }: { children: ReactNode }) {
  const user = useSession();
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const router = useRouter();
  const [armazem] = useState(criarArmazem);
  const [saida, setSaida] = useState<{ destino: string; seguir: () => void } | null>(null);

  // Recupera o que estava pendente nesta aba e guarda cada mudança.
  useEffect(() => {
    let guardado: string | null = null;
    try {
      guardado = window.sessionStorage.getItem(CHAVE_SESSAO);
    } catch {
      /* sem armazenamento: segue sem recuperar */
    }
    const pendencias = lerGuardado(guardado, user.id);
    armazem.set((e) => ({ ...e, pendencias }));
    return armazem.subscribe(() => {
      try {
        const p = armazem.get().pendencias;
        if (Object.keys(p).length) window.sessionStorage.setItem(CHAVE_SESSAO, serializar(p, user.id));
        else window.sessionStorage.removeItem(CHAVE_SESSAO);
      } catch {
        /* cheio ou bloqueado: as pendências continuam na memória */
      }
    });
  }, [armazem, user.id]);

  const acoes = useMemo<AcoesDoLote>(() => {
    const mudar = (f: (p: Pendencias) => Pendencias) => armazem.set((e) => ({ ...e, pendencias: f(e.pendencias) }));
    return {
      registrar: (aluno, alt) => alt && mudar((p) => registrar(p, aluno, alt)),
      desfazer: (alunoId, chave) => mudar((p) => desfazer(p, alunoId, chave)),
      descartar: () => armazem.set((e) => ({ ...e, pendencias: descartar(e.pendencias), resultado: null })),
      descartarAluno: (alunoId) => mudar((p) => descartarAluno(p, alunoId)),
      async salvar(apenas) {
        const { pendencias, enviando } = armazem.get();
        const enviar = paraEnviar(pendencias, apenas);
        if (enviando || !enviar.length) return null;
        const ids = enviar.map((e) => e.aluno_id);
        armazem.set((e) => ({ pendencias: marcarSalvando(e.pendencias, ids), enviando: true, resultado: null }));
        try {
          const resposta = await salvarLote(montarPedido(enviar));
          const r = aplicarResposta(armazem.get().pendencias, enviar, resposta);
          for (const aluno of r.gravados) {
            trocarAlunoNoCache(queryClient, aluno);
            void queryClient.invalidateQueries({ queryKey: CHAVES.historico(aluno.id) });
          }
          const resultado = { salvas: r.salvas, comErro: r.comErro };
          armazem.set(() => ({ pendencias: r.pendencias, enviando: false, resultado: r.comErro ? resultado : null }));
          // Cockpit e totais: uma vez, no fim do lote.
          void queryClient.invalidateQueries({ queryKey: CHAVES.alunos });
          if (r.afetaTotais) void queryClient.invalidateQueries({ queryKey: CHAVES.resumo });
          if (!r.comErro) avisar({ tipo: "sucesso", texto: `${r.salvas} ${r.salvas === 1 ? "alteração salva" : "alterações salvas"}` });
          return resultado;
        } catch (erro) {
          if (erro instanceof EducacionalError && erro.status === 403) router.replace("/");
          const falha =
            erro instanceof EducacionalError && erro.rede
              ? "Sem conexão com o servidor. Nada foi perdido."
              : `Não foi possível salvar. ${erro instanceof EducacionalError ? (erro.corpo.mensagem ?? erro.message) : mensagemDoErro(erro)}`;
          armazem.set((e) => ({ pendencias: aplicarFalha(e.pendencias, ids, falha), enviando: false, resultado: { falha } }));
          return { falha };
        }
      },
      verVersaoAtual(alunoId) {
        const e = armazem.get().pendencias[alunoId];
        if (e?.erro?.tipo === "versao") trocarAlunoNoCache(queryClient, e.erro.atual);
        mudar((p) => descartarAluno(p, alunoId));
      },
      reaplicar(alunoId) {
        const e = armazem.get().pendencias[alunoId];
        if (e?.erro?.tipo !== "versao") return;
        trocarAlunoNoCache(queryClient, e.erro.atual);
        const r = reaplicar(armazem.get().pendencias, alunoId, lerDoServidor);
        mudar(() => r.pendencias);
        if (r.removidas.length) {
          avisar({
            tipo: "erro",
            texto: `${r.removidas.length === 1 ? "Uma alteração saiu" : `${r.removidas.length} alterações saíram`}: o item não existe mais na versão atual de ${e.nome}.`,
          });
        }
      },
    };
  }, [armazem, queryClient, avisar, router]);

  // Proteção ao sair do módulo com alterações (D6): fechar/recarregar a aba,
  // links para fora e o seletor Comercial | Educacional.
  const { pendencias } = useEstadoDoArmazem(armazem);
  const temPendencias = Object.keys(pendencias).length > 0;
  const pedirSaida = useCallback((destino: string, seguir: () => void) => setSaida({ destino, seguir }), []);
  useEffect(() => {
    if (!temPendencias) return;
    const antesDeFechar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const aoClicar = (ev: MouseEvent) => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = (ev.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || dentroDoModulo(url.pathname)) return;
      ev.preventDefault();
      ev.stopPropagation();
      const destino = url.pathname + url.search + url.hash;
      pedirSaida(destino, () => router.push(destino));
    };
    window.addEventListener("beforeunload", antesDeFechar);
    document.addEventListener("click", aoClicar, true);
    definirGuardaDeSaida((destino, seguir) => {
      if (dentroDoModulo(destino)) return false;
      pedirSaida(destino, seguir);
      return true;
    });
    return () => {
      window.removeEventListener("beforeunload", antesDeFechar);
      document.removeEventListener("click", aoClicar, true);
      definirGuardaDeSaida(null);
    };
  }, [temPendencias, pedirSaida, router]);

  // Gravação imediata feita por esta aba sobre a versão das pendências: elas
  // seguem na versão que a resposta trouxe (decisão de 28/10).
  useEffect(
    () => ouvirGravacoes((g) => armazem.set((e) => ({ ...e, pendencias: rebasear(e.pendencias, g, lerDoServidor) }))),
    [armazem],
  );

  const valor = useMemo(() => ({ armazem, acoes }), [armazem, acoes]);
  const n = contar(pendencias).alteracoes;
  return (
    <Contexto.Provider value={valor}>
      {children}
      <BarraDeAlteracoes />
      <ConfirmarAcao
        aberto={saida !== null}
        titulo="Sair com alterações não salvas?"
        texto={`${n} ${n === 1 ? "alteração não foi salva" : "alterações não foram salvas"}. Elas ficam guardadas nesta aba do navegador e voltam quando você abrir o módulo de novo.`}
        confirmar="Sair sem salvar"
        onConfirmar={() => saida?.seguir()}
        onFechar={() => setSaida(null)}
      />
    </Contexto.Provider>
  );
}

// O provedor lê o próprio armazém (o contexto ainda não existe acima dele).
function useEstadoDoArmazem(armazem: Armazem): EstadoDoLote {
  return useSyncExternalStore(armazem.subscribe, armazem.get, () => INICIAL);
}
