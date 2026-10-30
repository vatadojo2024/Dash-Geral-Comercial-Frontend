"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRightLeft, Loader2, PencilLine } from "lucide-react";
import type { AlunoLinha, Etapa } from "@/lib/educacional/contrato";
import { cn } from "@/lib/utils/cn";
import { temAjusteNoCard } from "./campos";
import { alteracaoDaEtapa } from "./lote/alteracoes";
import { MenuDesfazer } from "./lote/MarcaPendente";
import type { Entrada, Pendencias } from "./lote/pendencias";
import { useAcoesDoLote } from "./lote/ProvedorLote";
import { AvisosDoAluno, BadgeCheckpoint, Faixa, NomeResponsavel } from "./partes";

// ---------------------------------------------------------------------------
// Kanban (spec Fase 2, seção 3): uma coluna por etapa ativa, na ordem da
// configuração. Arrastar o card para outra coluna grava a etapa (PATCH
// etapa_id) com atualização otimista — se falhar, o card volta com aviso. O
// menu "Mover para…" faz o mesmo sem arrastar (teclado e celular). A ordem
// dentro da coluna vem da API (faixa de saúde, risco primeiro, depois dias na
// etapa desc). Sem paginação: cada coluna rola na vertical.
// ---------------------------------------------------------------------------

// Solta na coluna sob o ponteiro; no teclado (sem ponteiro), pela área do card.
const colisao: CollisionDetection = (args) => {
  const sob = pointerWithin(args);
  return sob.length > 0 ? sob : rectIntersection(args);
};

// Teclado: cada seta ← → pula uma coluna inteira (o padrão anda 25px por vez).
const porColuna: KeyboardCoordinateGetter = (event, { context: { droppableRects, collisionRect }, currentCoordinates }) => {
  const passo = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (!passo || !collisionRect) return undefined;
  event.preventDefault();
  const colunas = [...droppableRects.values()].sort((a, b) => a.left - b.left);
  const centro = collisionRect.left + collisionRect.width / 2;
  let atual = colunas.findIndex((r) => centro >= r.left && centro <= r.left + r.width);
  if (atual < 0) atual = passo > 0 ? -1 : colunas.length;
  const alvo = colunas[atual + passo];
  if (!alvo) return undefined;
  return { x: alvo.left + (alvo.width - collisionRect.width) / 2, y: currentCoordinates.y };
};

export function Kanban({
  itens,
  pendencias,
  etapas,
  hrefDoAluno,
}: {
  itens: AlunoLinha[];
  pendencias: Pendencias;
  etapas: Etapa[];
  hrefDoAluno: (a: AlunoLinha) => string;
}) {
  const acoes = useAcoesDoLote();
  const [arrastando, setArrastando] = useState<AlunoLinha | null>(null);
  const sensores = useSensors(
    // Distância mínima: clique simples continua abrindo o Raio-X.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // No toque, segurar um instante para arrastar; deslizar rola a tela.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: porColuna }),
  );
  const nomeDaEtapa = (id: unknown) => etapas.find((e) => e.id === id)?.nome ?? "";
  const nomeDoAluno = (id: unknown) => itens.find((a) => a.id === id)?.nome ?? "";

  // Estável: os cartões são memorizados e só redesenham quando o aluno deles
  // muda. Mover vira alteração pendente (salvar em lote): o card muda de
  // coluna na hora, com a marca, e nada vai para a API até "Salvar".
  const mover = useCallback(
    (a: AlunoLinha, etapa: Etapa) => {
      if (a.etapa.id === etapa.id) return;
      acoes.registrar(a, alteracaoDaEtapa(a, etapa));
    },
    [acoes],
  );
  const desfazer = useCallback((a: AlunoLinha) => acoes.desfazer(a.id, "campo:etapa_id"), [acoes]);

  const aoComecar = (e: DragStartEvent) => setArrastando(itens.find((a) => a.id === e.active.id) ?? null);
  const aoSoltar = (e: DragEndEvent) => {
    setArrastando(null);
    const a = itens.find((x) => x.id === e.active.id);
    const etapa = etapas.find((x) => x.id === e.over?.id);
    if (a && etapa && pendencias[a.id]?.estado !== "salvando") mover(a, etapa);
  };

  const anuncios: Announcements = {
    onDragStart: ({ active }) => `${nomeDoAluno(active.id)} pego. Use as setas para escolher a etapa e Enter para soltar.`,
    onDragOver: ({ active, over }) => (over ? `${nomeDoAluno(active.id)} sobre ${nomeDaEtapa(over.id)}.` : `${nomeDoAluno(active.id)} fora das etapas.`),
    onDragEnd: ({ active, over }) => (over ? `${nomeDoAluno(active.id)} movido para ${nomeDaEtapa(over.id)}.` : `${nomeDoAluno(active.id)} solto sem mudar de etapa.`),
    onDragCancel: ({ active }) => `Movimento de ${nomeDoAluno(active.id)} cancelado.`,
  };

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={colisao}
      onDragStart={aoComecar}
      onDragEnd={aoSoltar}
      onDragCancel={() => setArrastando(null)}
      accessibility={{
        announcements: anuncios,
        screenReaderInstructions: {
          draggable: "Para mover o aluno de etapa, pressione Espaço, use as setas e pressione Espaço de novo. Esc cancela.",
        },
      }}
    >
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, etapas.length)}, minmax(200px, 1fr))` }}
        >
          {etapas.map((etapa) => (
            <Coluna
              key={etapa.id}
              etapa={etapa}
              alunos={itens.filter((a) => a.etapa.id === etapa.id)}
              pendencias={pendencias}
              etapas={etapas}
              hrefDoAluno={hrefDoAluno}
              onMover={mover}
              onDesfazer={desfazer}
            />
          ))}
        </div>
      </div>
      {/* No <body>: dentro do Card com vidro, o `fixed` do overlay ficaria preso ao card. */}
      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay dropAnimation={null}>
            {arrastando && (
              <Cartao
                aluno={arrastando}
                entrada={pendencias[arrastando.id]}
                etapas={etapas}
                hrefDoAluno={hrefDoAluno}
                onMover={mover}
                onDesfazer={desfazer}
                flutuando
              />
            )}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}

function Coluna({
  etapa,
  alunos,
  pendencias,
  etapas,
  hrefDoAluno,
  onMover,
  onDesfazer,
}: {
  etapa: Etapa;
  alunos: AlunoLinha[];
  pendencias: Pendencias;
  etapas: Etapa[];
  hrefDoAluno: (a: AlunoLinha) => string;
  onMover: (a: AlunoLinha, e: Etapa) => void;
  onDesfazer: (a: AlunoLinha) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={etapa.nome}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2 transition-colors",
        isOver && "border-azul/60 bg-azul/10",
      )}
    >
      <header className="flex items-baseline justify-between gap-2 px-1 pt-1">
        <h3 className="text-xs font-semibold text-texto">{etapa.nome}</h3>
        <span className="text-xs tabular-nums text-texto-sec">{alunos.length}</span>
      </header>
      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-0.5">
        {alunos.length === 0 ? (
          <p className="px-1 py-3 text-center text-[11px] text-texto-sec/70">Nenhum aluno</p>
        ) : (
          alunos.map((a) => (
            <CartaoArrastavel
              key={a.id}
              aluno={a}
              entrada={pendencias[a.id]}
              etapas={etapas}
              hrefDoAluno={hrefDoAluno}
              onMover={onMover}
              onDesfazer={onDesfazer}
            />
          ))
        )}
      </div>
    </section>
  );
}

type PropsCartao = {
  aluno: AlunoLinha;
  entrada: Entrada | undefined;
  etapas: Etapa[];
  hrefDoAluno: (a: AlunoLinha) => string;
  onMover: (a: AlunoLinha, e: Etapa) => void;
  onDesfazer: (a: AlunoLinha) => void;
};

const CartaoArrastavel = memo(function CartaoArrastavel(props: PropsCartao) {
  // Em envio, o card não sai do lugar.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.aluno.id,
    disabled: props.entrada?.estado === "salvando",
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("touch-manipulation", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
      aria-roledescription="aluno arrastável"
      aria-label={`${props.aluno.nome}, etapa ${props.aluno.etapa.nome}`}
    >
      <Cartao {...props} />
    </div>
  );
});

// Parte visual do cartão, memorizada à parte: o arrasto re-renderiza os
// useDraggable a cada medição das colunas, mas o conteúdo só redesenha quando
// o aluno muda.
const Cartao = memo(function Cartao({
  aluno: a,
  entrada,
  etapas,
  hrefDoAluno,
  onMover,
  onDesfazer,
  flutuando = false,
}: PropsCartao & { flutuando?: boolean }) {
  const router = useRouter();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const fecharMenu = useCallback(() => setMenu(null), []);
  const salvando = entrada?.estado === "salvando";
  const alteracoes = entrada ? Object.values(entrada.alteracoes) : [];
  const etapaPendente = entrada?.alteracoes["campo:etapa_id"];
  const erro = entrada?.erro;
  const erroDaEtapa = erro?.tipo === "validacao" && (erro.chave === "campo:etapa_id" || erro.chave === null) ? erro.mensagem : null;
  // "Desfazer" no card desfaz o movimento de etapa (o que o Kanban edita).
  const podeDesfazer = Boolean(etapaPendente) && !salvando && !flutuando;
  return (
    <div
      onClick={() => router.push(hrefDoAluno(a))}
      onContextMenu={(e) => {
        if (!podeDesfazer) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      onKeyDown={(e) => {
        if (podeDesfazer && (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey))) {
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          setMenu({ x: r.left + 8, y: r.bottom });
        }
      }}
      title={alteracoes.length ? alteracoes.map((x) => `Antes: ${x.antes}`).join("\n") + (podeDesfazer ? "\nBotão direito: Desfazer" : "") : undefined}
      data-pendente={alteracoes.length ? "" : undefined}
      className={cn(
        "card-interactive relative block cursor-grab select-none rounded-lg p-3",
        flutuando && "rotate-1 cursor-grabbing shadow-2xl",
        alteracoes.length > 0 && "bg-amarelo/[0.12] ring-1 ring-amarelo/40",
        erroDaEtapa && "ring-1 ring-erro/70",
        entrada?.estado === "revisar" && "outline outline-1 outline-aviso/70",
        salvando && "cursor-progress opacity-80",
      )}
    >
      {alteracoes.length > 0 && <span className="absolute -left-0.5 -top-0.5 h-2 w-2 rounded-full bg-amarelo" aria-hidden />}
      {alteracoes.length > 0 && <span className="sr-only">Alteração não salva. {alteracoes.map((x) => `Antes: ${x.antes}.`).join(" ")}</span>}
      <span className="flex items-start gap-1.5 pr-7">
        <Link
          href={hrefDoAluno(a)}
          onClick={(e) => e.stopPropagation()}
          draggable={false} // o arrasto nativo do link roubaria o do card
          className="min-w-0 truncate text-sm font-semibold text-texto hover:text-azul-claro hover:underline"
        >
          {a.nome}
        </Link>
        <AvisosDoAluno avisos={a.avisos} compacto />
        {temAjusteNoCard(a) && (
          <span title="Algum campo deste card tem ajuste manual" className="mt-0.5 shrink-0">
            <PencilLine className="h-3 w-3 text-amarelo" aria-label="Com ajuste manual" />
          </span>
        )}
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Faixa faixa={a.faixa_saude.valor} className="text-xs" />
        {a.proximo_checkpoint && <BadgeCheckpoint status={a.proximo_checkpoint.status} />}
      </span>
      <span className="mt-1.5 block text-xs text-texto-sec">
        <span className="font-semibold tabular-nums text-texto">{a.dias_na_etapa.valor ?? "—"}d</span> na etapa
      </span>
      <span className="mt-1 block text-xs">
        <NomeResponsavel responsavel={a.responsavel} />
      </span>
      {salvando ? (
        <span className="mt-1.5 flex items-center gap-1 text-[11px] text-texto-sec">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Salvando…
        </span>
      ) : erro?.tipo === "versao" ? (
        <span className="mt-1.5 block text-[11px] text-aviso">Alterado por outra pessoa · veja na barra</span>
      ) : erroDaEtapa ? (
        <span className="mt-1.5 block text-[11px] text-erro" role="alert">
          {erroDaEtapa}
        </span>
      ) : null}
      {!flutuando && !salvando && <MoverPara aluno={a} etapas={etapas} onMover={onMover} />}
      {menu && <MenuDesfazer pos={menu} onDesfazer={() => onDesfazer(a)} onFechar={fecharMenu} />}
    </div>
  );
});

// "Mover para…": a alternativa garantida sem arrastar (teclado e celular). O
// menu vai para o <body> (a coluna rola e cortaria o menu), na posição do botão.
function MoverPara({ aluno, etapas, onMover }: { aluno: AlunoLinha; etapas: Etapa[]; onMover: (a: AlunoLinha, e: Etapa) => void }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const aberto = pos !== null;
  const LARGURA = 208;

  function abrir() {
    const r = botao.current?.getBoundingClientRect();
    if (!r) return;
    const altura = 40 + Math.max(1, etapas.length - 1) * 34;
    const abaixo = r.bottom + 4 + altura <= window.innerHeight;
    setPos({
      top: abaixo ? r.bottom + 4 : Math.max(8, r.top - 4 - altura),
      left: Math.max(8, Math.min(r.right - LARGURA, window.innerWidth - LARGURA - 8)),
    });
  }

  useEffect(() => {
    if (!aberto) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const fechar = () => setPos(null);
    const fora = (e: Event) => {
      const alvo = e.target as Node;
      if (!menu.current?.contains(alvo) && !botao.current?.contains(alvo)) fechar();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        fechar();
        botao.current?.focus();
      }
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  const outras = etapas.filter((e) => e.id !== aluno.etapa.id);
  const parar = {
    // Nada aqui inicia arrasto nem abre o Raio-X.
    onPointerDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
    onKeyDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
    onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  };
  return (
    <div className="absolute right-1.5 top-1.5" {...parar}>
      <button
        ref={botao}
        type="button"
        aria-label={`Mover ${aluno.nome} para…`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => (aberto ? setPos(null) : abrir())}
        className="icon-button h-7 w-7"
      >
        <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
      </button>
      {pos &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={`Mover ${aluno.nome} para`}
            style={{ top: pos.top, left: pos.left, width: LARGURA }}
            className="fixed z-[70] rounded-xl border border-white/15 bg-painel p-1 shadow-2xl"
            {...parar}
          >
            <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-texto-sec">Mover para…</p>
            {outras.map((e) => (
              <button
                key={e.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPos(null);
                  onMover(aluno, e);
                }}
                className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-texto hover:bg-white/[0.08] focus-visible:bg-white/[0.08] focus-visible:outline-none"
              >
                {e.nome}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
