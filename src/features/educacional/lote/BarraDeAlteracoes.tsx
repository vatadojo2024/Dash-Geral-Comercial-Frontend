"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertTriangle, Loader2, RotateCcw, Save, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { ConfirmarAcao } from "../Blocos";
import { hrefDoRaioX } from "../estado";
import { contar, type Entrada } from "./pendencias";
import { useAcoesDoLote, useEstadoDoLote } from "./ProvedorLote";

// ---------------------------------------------------------------------------
// Barra fixa no rodapé (Fase 3, 4.2): "N alterações em M alunos · Descartar ·
// Salvar"; "Salvando…" durante o envio (a tela segue navegável); depois,
// "N salvas · M com erro" com "Ver erros". Vai para o <body> por portal: dentro
// do vidro (backdrop-filter) o `fixed` ficaria preso ao card.
// ---------------------------------------------------------------------------

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function BarraDeAlteracoes() {
  const { pendencias, enviando, resultado } = useEstadoDoLote();
  const acoes = useAcoesDoLote();
  const [verErros, setVerErros] = useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const { alteracoes, alunos } = contar(pendencias);
  if (!alunos || typeof document === "undefined") return null;

  const comErro = Object.values(pendencias).filter((e) => e.estado === "erro");
  // O Raio-X volta para onde a pessoa está (lido na hora: a barra fica no layout).
  const aqui = window.location.pathname + window.location.search;
  const falha = resultado && "falha" in resultado ? resultado.falha : null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 md:left-60">
      <div className="pointer-events-auto w-full max-w-3xl">
        {verErros && comErro.length > 0 && (
          <div
            role="region"
            aria-label="Alunos com erro"
            className="mb-2 max-h-[50vh] overflow-y-auto rounded-2xl border border-white/15 bg-painel p-3 shadow-2xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-texto">{plural(comErro.length, "aluno com erro", "alunos com erro")}</p>
              <button type="button" onClick={() => setVerErros(false)} aria-label="Fechar a lista de erros" className="icon-button h-7 w-7">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <ul className="space-y-2">
              {comErro.map((e) => (
                <ErroDoAluno key={e.aluno_id} e={e} href={hrefDoRaioX(e.aluno_id, aqui)} />
              ))}
            </ul>
          </div>
        )}

        <div
          role="region"
          aria-label="Alterações não salvas"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-amarelo/30 bg-painel px-4 py-3 shadow-2xl"
        >
          <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm text-texto" role="status" aria-live="polite">
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-amarelo" aria-hidden />
                Salvando…
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amarelo" aria-hidden />
                <span className="font-semibold">{plural(alteracoes, "alteração", "alterações")}</span>
                <span className="text-texto-sec">em {plural(alunos, "aluno", "alunos")}</span>
              </>
            )}
            {/* O resumo do último envio vale enquanto houver aluno com erro dele. */}
            {!enviando && resultado && "salvas" in resultado && comErro.length > 0 && (
              <span className="text-texto-sec">
                · {plural(resultado.salvas, "salva", "salvas")} · <span className="text-erro">{resultado.comErro} com erro</span>
              </span>
            )}
            {!enviando && falha && (
              <span className="inline-flex items-center gap-1 text-erro">
                <WifiOff className="h-3.5 w-3.5" aria-hidden />
                {falha}
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            {!enviando && comErro.length > 0 && !falha && (
              <Button variant="ghost" size="sm" onClick={() => setVerErros((v) => !v)} aria-expanded={verErros}>
                <AlertTriangle className="h-3.5 w-3.5 text-erro" aria-hidden />
                Ver erros
              </Button>
            )}
            <Button variant="ghost" size="sm" disabled={enviando} onClick={() => setConfirmarDescarte(true)}>
              Descartar
            </Button>
            <Button size="sm" loading={enviando} onClick={() => void acoes.salvar()}>
              {falha ? <RotateCcw className="h-3.5 w-3.5" aria-hidden /> : <Save className="h-3.5 w-3.5" aria-hidden />}
              {falha ? "Tentar de novo" : "Salvar"}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmarAcao
        aberto={confirmarDescarte}
        titulo="Descartar as alterações?"
        texto={`${plural(alteracoes, "alteração", "alterações")} em ${plural(alunos, "aluno", "alunos")} ${alteracoes === 1 ? "será apagada" : "serão apagadas"} sem salvar.`}
        confirmar="Descartar"
        perigo
        onConfirmar={() => {
          setVerErros(false);
          acoes.descartar();
        }}
        onFechar={() => setConfirmarDescarte(false)}
      />
    </div>,
    document.body,
  );
}

function ErroDoAluno({ e, href }: { e: Entrada; href: string }) {
  const acoes = useAcoesDoLote();
  const erro = e.erro;
  return (
    <li className={cn("rounded-xl border px-3 py-2 text-sm", erro?.tipo === "versao" ? "border-aviso/40 bg-aviso/[0.06]" : "border-erro/30 bg-erro/[0.06]")}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <Link href={href} className="font-semibold text-texto hover:text-azul-claro hover:underline">
          {e.nome}
        </Link>
        <span className="text-xs text-texto-sec">{plural(Object.keys(e.alteracoes).length, "alteração", "alterações")}</span>
      </p>
      {erro?.tipo === "versao" ? (
        <>
          <p className="mt-1 text-texto">Este aluno foi alterado por outra pessoa.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => acoes.verVersaoAtual(e.aluno_id)}>
              Ver versão atual
            </Button>
            <Button size="sm" onClick={() => acoes.reaplicar(e.aluno_id)}>
              Reaplicar minhas alterações
            </Button>
          </div>
        </>
      ) : erro?.tipo === "validacao" ? (
        <p className="mt-1 text-erro">{erro.mensagem}</p>
      ) : erro?.tipo === "rede" ? (
        <p className="mt-1 text-erro">{erro.mensagem}</p>
      ) : null}
    </li>
  );
}
