"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Loader2, PencilLine } from "lucide-react";
import { STATUS_CHECKPOINT, type Ajuste, type StatusCheckpoint } from "@/lib/educacional/contrato";
import { dataHoraBr, hojeEmBrasilia, ROTULO_STATUS_CHECKPOINT } from "@/lib/educacional/rotulos";
import { Balao } from "@/components/ui/Balao";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Edição na linha (spec Fase 2, seção 4): clique na célula ou Enter com ela em
// foco → editor; Enter ou clique fora salva; Esc cancela. Enquanto grava, um
// indicador discreto na célula (o valor otimista já aparece). Campo calculado
// não edita na célula: abre o formulário de ajuste (onAbrir).
// ---------------------------------------------------------------------------

const ENTRADA = "h-8 w-full min-w-0 rounded-md border border-azul/50 bg-painel-claro px-2 text-sm text-texto";

export type Concluir = (gravacao?: Promise<unknown>) => void;
type ApiEditor = { concluir: Concluir; cancelar: () => void };

export function CelulaEditavel({
  rotulo,
  exibir,
  editor,
  onAbrir,
  bloqueada = false,
  className,
}: {
  rotulo: string;
  exibir: ReactNode;
  editor?: (api: ApiEditor) => ReactNode;
  onAbrir?: () => void;
  bloqueada?: boolean;
  className?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const alvo = useRef<HTMLDivElement>(null);

  const voltarFoco = () => setTimeout(() => alvo.current?.focus(), 0);
  const concluir: Concluir = (gravacao) => {
    setEditando(false);
    voltarFoco();
    if (!gravacao) return;
    setSalvando(true);
    void gravacao.finally(() => setSalvando(false));
  };
  const cancelar = () => {
    setEditando(false);
    voltarFoco();
  };
  const abrir = () => {
    if (bloqueada) return;
    if (onAbrir) onAbrir();
    else if (editor) setEditando(true);
  };

  if (editando && editor) return <div className={cn("min-w-0", className)}>{editor({ concluir, cancelar })}</div>;

  return (
    <div
      ref={alvo}
      role={bloqueada ? undefined : "button"}
      tabIndex={bloqueada ? undefined : 0}
      aria-label={bloqueada ? undefined : rotulo}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) {
          e.preventDefault();
          abrir();
        }
      }}
      className={cn(
        "group/celula relative -mx-1.5 flex min-h-8 min-w-0 items-center gap-1 rounded-md px-1.5 py-1",
        !bloqueada && "cursor-text hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-azul/60",
        className,
      )}
      aria-busy={salvando || undefined}
    >
      <span className="min-w-0 flex-1">{exibir}</span>
      {salvando ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-texto-sec" aria-label="Salvando" />
      ) : (
        !bloqueada && (
          <PencilLine
            className="h-3 w-3 shrink-0 text-texto-sec opacity-0 transition-opacity group-hover/celula:opacity-60 group-focus-visible/celula:opacity-60"
            aria-hidden
          />
        )
      )}
    </div>
  );
}

// Teclado e clique fora para editores com mais de um campo.
function CaixaEdicao({
  onSalvar,
  onCancelar,
  children,
  className,
}: {
  onSalvar: () => void;
  onCancelar: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const feito = useRef(false);
  const uma = (f: () => void) => () => {
    if (feito.current) return;
    feito.current = true;
    f();
  };
  const salvar = uma(onSalvar);
  const cancelar = uma(onCancelar);
  const teclas = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelar();
    } else if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      salvar();
    }
  };
  return (
    <div
      ref={ref}
      onKeyDown={teclas}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) salvar();
      }}
      onClick={(e) => e.stopPropagation()}
      className={className}
    >
      {children}
    </div>
  );
}

function useFocoInicial<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
    if (ref.current instanceof HTMLInputElement) ref.current.select();
  }, []);
  return ref;
}

// Sugestões nativas do navegador (<datalist>): sugere enquanto digita e aceita
// valor novo. D2: mentorias existentes, vindas do /config.
export function Sugestoes({ id, opcoes }: { id: string; opcoes?: readonly string[] }) {
  if (!opcoes?.length) return null;
  return (
    <datalist id={id}>
      {opcoes.map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  );
}

export function EditorTexto({
  valor,
  obrigatorio = false,
  rotulo,
  sugestoes,
  onSalvar,
  onCancelar,
}: {
  valor: string;
  obrigatorio?: boolean;
  rotulo: string;
  sugestoes?: readonly string[];
  onSalvar: (v: string | null) => void;
  onCancelar: () => void;
}) {
  const [v, setV] = useState(valor);
  const ref = useFocoInicial<HTMLInputElement>();
  const lista = useId();
  return (
    <CaixaEdicao
      onCancelar={onCancelar}
      onSalvar={() => {
        const limpo = v.trim();
        if (limpo === valor.trim() || (obrigatorio && !limpo)) onCancelar();
        else onSalvar(limpo || null);
      }}
    >
      <input
        ref={ref}
        aria-label={rotulo}
        value={v}
        onChange={(e) => setV(e.target.value)}
        list={sugestoes?.length ? lista : undefined}
        autoComplete="off"
        className={ENTRADA}
      />
      <Sugestoes id={lista} opcoes={sugestoes} />
    </CaixaEdicao>
  );
}

export function EditorLista({
  valor,
  opcoes,
  rotulo,
  vazio,
  onSalvar,
  onCancelar,
}: {
  valor: string;
  opcoes: { valor: string; rotulo: string }[];
  rotulo: string;
  vazio?: string; // opção "nenhum"
  onSalvar: (v: string) => void;
  onCancelar: () => void;
}) {
  const ref = useFocoInicial<HTMLSelectElement>();
  const [v, setV] = useState(valor);
  const escolhido = useRef(valor); // lido no salvar (o estado ainda não atualizou no mesmo evento)
  return (
    <CaixaEdicao
      onCancelar={onCancelar}
      onSalvar={() => (escolhido.current === valor ? onCancelar() : onSalvar(escolhido.current))}
    >
      <select
        ref={ref}
        aria-label={rotulo}
        value={v}
        onChange={(e) => {
          // Não salva na troca (as setas do teclado trocam o valor): Enter ou clique fora.
          escolhido.current = e.target.value;
          setV(e.target.value);
        }}
        className={ENTRADA}
      >
        {vazio != null && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </CaixaEdicao>
  );
}

export function EditorAcao({
  descricao,
  prazo,
  onSalvar,
  onCancelar,
}: {
  descricao: string;
  prazo: string;
  onSalvar: (v: { descricao: string | null; prazo: string | null }) => void;
  onCancelar: () => void;
}) {
  const [d, setD] = useState(descricao);
  const [p, setP] = useState(prazo);
  const ref = useFocoInicial<HTMLInputElement>();
  return (
    <CaixaEdicao
      className="flex min-w-[220px] flex-col gap-1"
      onCancelar={onCancelar}
      onSalvar={() => {
        if (d.trim() === descricao && p === prazo) return onCancelar();
        onSalvar({ descricao: d.trim() || null, prazo: d.trim() ? p || null : null });
      }}
    >
      <input ref={ref} aria-label="Próxima ação" value={d} onChange={(e) => setD(e.target.value)} placeholder="Próxima ação" className={ENTRADA} />
      <input aria-label="Prazo da próxima ação" type="date" value={p} onChange={(e) => setP(e.target.value)} className={ENTRADA} />
    </CaixaEdicao>
  );
}

export function EditorCheckpoint({
  status,
  onSalvar,
  onCancelar,
}: {
  status: StatusCheckpoint;
  onSalvar: (v: { status: StatusCheckpoint; data_realizada?: string }) => void;
  onCancelar: () => void;
}) {
  const [s, setS] = useState<StatusCheckpoint>(status);
  const [data, setData] = useState(hojeEmBrasilia());
  const ref = useFocoInicial<HTMLSelectElement>();
  return (
    <CaixaEdicao
      className="flex min-w-[150px] flex-col gap-1"
      onCancelar={onCancelar}
      onSalvar={() => {
        if (s === status) return onCancelar();
        onSalvar(s === "realizado" ? { status: s, data_realizada: data || hojeEmBrasilia() } : { status: s });
      }}
    >
      <select ref={ref} aria-label="Status do checkpoint" value={s} onChange={(e) => setS(e.target.value as StatusCheckpoint)} className={ENTRADA}>
        {STATUS_CHECKPOINT.map((x) => (
          <option key={x} value={x}>
            {ROTULO_STATUS_CHECKPOINT[x]}
          </option>
        ))}
      </select>
      {s === "realizado" && (
        <input aria-label="Data em que foi realizado" type="date" value={data} onChange={(e) => setData(e.target.value)} className={ENTRADA} />
      )}
    </CaixaEdicao>
  );
}

// Ícone de "ajustado" com quem, quando e por quê (passar o mouse, focar ou tocar).
export function MarcaAjuste({ ajuste, automatico }: { ajuste: Ajuste<unknown> | null; automatico?: string }) {
  if (!ajuste) return null;
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="inline-flex">
      <Balao
        rotulo="Valor ajustado manualmente"
        gatilho={<PencilLine className="h-3 w-3 text-amarelo" aria-hidden />}
        lado="esquerda"
      >
        <span className="block text-xs">
          <span className="font-semibold text-texto">Ajustado</span> por {ajuste.ajustado_por.nome} em {dataHoraBr(ajuste.ajustado_em)}
          <span className="mt-1 block text-texto-sec">“{ajuste.motivo}”</span>
          {automatico != null && <span className="mt-1 block text-texto-sec">Automático: {automatico}</span>}
        </span>
      </Balao>
    </span>
  );
}
