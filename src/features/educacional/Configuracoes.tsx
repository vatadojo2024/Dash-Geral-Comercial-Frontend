"use client";

import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ArrowDown, ArrowUp, DatabaseBackup, GripVertical, Info, PencilLine, Plus, Star } from "lucide-react";
import {
  atualizarItemConfig,
  criarItemConfig,
  EducacionalError,
  FONTE_EDUCACIONAL,
  restaurarDemonstracao,
  type ColecaoConfig,
} from "@/lib/educacional/apiEducacional";
import { TIPOS_RESPONSAVEL, type Config } from "@/lib/educacional/contrato";
import { ROTULO_TIPO_RESPONSAVEL } from "@/lib/educacional/rotulos";
import { Alternador } from "@/components/ui/Alternador";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useSession } from "@/features/session/SessionProvider";
import { cn } from "@/lib/utils/cn";
import { useAvisos } from "./Avisos";
import { ConfirmarAcao } from "./Blocos";
import { CHAVES, useConfig } from "./dados";
import { CAMPO } from "./Dialogo";
import { EtiquetaDemonstracao, mensagemDoErro, useRedirecionarSeSemPermissao } from "./partes";

// ---------------------------------------------------------------------------
// Configurações do módulo (spec Fase 2, 6.3) — /educacional/configuracoes.
// Quatro abas: Etapas (arrastar para reordenar), Checkpoints padrão, Tipos de
// intervenção e Responsáveis. Itens inativos aparecem aqui, mas não nas listas
// de escolha. Inativar etapa com alunos mostra o erro da API com a contagem.
// ---------------------------------------------------------------------------

type Aba = "etapas" | "checkpoints" | "tipos" | "responsaveis";

type Coluna = {
  chave: string;
  rotulo: string;
  tipo: "texto" | "numero" | "numero_opcional" | "booleano" | "lista";
  opcoes?: { valor: string; rotulo: string }[];
  largura?: string;
  exibir?: (v: unknown) => ReactNode;
};

type Item = { id: string; nome: string; ativo: boolean; ordem?: number } & Record<string, unknown>;

const ABAS: Record<Aba, { colecao: ColecaoConfig; chave: keyof Config; titulo: string; novo: string; ordenavel: boolean; colunas: Coluna[] }> = {
  etapas: {
    colecao: "etapas",
    chave: "etapas",
    titulo: "Etapas da jornada",
    novo: "Nova etapa",
    ordenavel: true,
    colunas: [{ chave: "nome", rotulo: "Nome", tipo: "texto", largura: "min-w-[12rem] flex-1" }],
  },
  checkpoints: {
    colecao: "checkpoints-modelo",
    chave: "checkpoints_modelo",
    titulo: "Checkpoints padrão",
    novo: "Novo checkpoint",
    ordenavel: true,
    colunas: [
      { chave: "nome", rotulo: "Nome", tipo: "texto", largura: "min-w-[9rem] flex-1" },
      { chave: "dias_apos_entrada", rotulo: "Dias após a entrada", tipo: "numero", largura: "w-32", exibir: (v) => `${v} dias` },
      {
        chave: "prazo_sla_dias",
        rotulo: "Prazo de SLA",
        tipo: "numero_opcional",
        largura: "w-32",
        exibir: (v) => (v == null ? <span className="text-texto-sec/60">—</span> : `${v} dias`),
      },
      {
        chave: "big_win",
        rotulo: "Big Win",
        tipo: "booleano",
        largura: "w-24",
        exibir: (v) => (v ? <Star className="h-4 w-4 text-amarelo" aria-label="Big Win" /> : <span className="text-texto-sec/60">—</span>),
      },
    ],
  },
  tipos: {
    colecao: "tipos-intervencao",
    chave: "tipos_intervencao",
    titulo: "Tipos de intervenção",
    novo: "Novo tipo",
    ordenavel: false,
    colunas: [{ chave: "nome", rotulo: "Nome", tipo: "texto", largura: "min-w-[12rem] flex-1" }],
  },
  responsaveis: {
    colecao: "responsaveis",
    chave: "responsaveis",
    titulo: "Responsáveis",
    novo: "Novo responsável",
    ordenavel: false,
    colunas: [
      { chave: "nome", rotulo: "Nome", tipo: "texto", largura: "min-w-[10rem] flex-1" },
      {
        chave: "tipo",
        rotulo: "Tipo",
        tipo: "lista",
        largura: "w-36",
        opcoes: TIPOS_RESPONSAVEL.map((t) => ({ valor: t, rotulo: ROTULO_TIPO_RESPONSAVEL[t] })),
        exibir: (v) => ROTULO_TIPO_RESPONSAVEL[v as keyof typeof ROTULO_TIPO_RESPONSAVEL] ?? String(v),
      },
    ],
  },
};

export function ConfiguracoesView() {
  const user = useSession();
  const config = useConfig();
  const [aba, setAba] = useState<Aba>("etapas");
  const [restaurar, setRestaurar] = useState(false);
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const semPermissao = useRedirecionarSeSemPermissao([config.error]);
  if (semPermissao) return null;

  const erros = config.data?.sync_planilha_erros ?? 0;

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-azul-claro">Educacional · Configurações</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-jakarta text-2xl font-semibold tracking-tight text-texto">Configurações</h1>
            <EtiquetaDemonstracao />
          </div>
          <p className="mt-1 text-sm opacity-80">Etapas, checkpoints, tipos de intervenção e responsáveis do módulo</p>
        </div>
        {FONTE_EDUCACIONAL === "mock" && (
          <Button variant="secondary" size="sm" onClick={() => setRestaurar(true)}>
            <DatabaseBackup className="h-3.5 w-3.5" aria-hidden />
            Restaurar dados de demonstração
          </Button>
        )}
      </header>

      <div className="space-y-4">
        {user.role === "admin" && erros > 0 && (
          <p className="flex items-center gap-2 rounded-xl border border-aviso/40 bg-aviso/10 px-4 py-2.5 text-sm text-texto" role="alert">
            <AlertTriangle className="h-4 w-4 shrink-0 text-aviso" aria-hidden />
            {erros} {erros === 1 ? "aluno não foi copiado" : "alunos não foram copiados"} para a planilha de backup
          </p>
        )}
        <Alternador<Aba>
          rotulo="Seção das configurações"
          valor={aba}
          onChange={setAba}
          opcoes={[
            { valor: "etapas", label: "Etapas" },
            { valor: "checkpoints", label: "Checkpoints padrão" },
            { valor: "tipos", label: "Tipos de intervenção" },
            { valor: "responsaveis", label: "Responsáveis" },
          ]}
        />
        {config.isLoading ? (
          <Skeleton className="h-72 rounded-2xl" />
        ) : config.isError || !config.data ? (
          <Card>
            <ErrorState
              titulo="Não foi possível carregar as configurações"
              descricao={mensagemDoErro(config.error)}
              onRetry={() => config.refetch()}
              retryLabel="Tentar de novo"
            />
          </Card>
        ) : (
          <ListaConfig key={aba} aba={aba} config={config.data} />
        )}
      </div>

      <ConfirmarAcao
        aberto={restaurar}
        titulo="Restaurar dados de demonstração?"
        texto="Todas as mudanças feitas neste navegador (alunos, ajustes, histórico e configurações) voltam ao estado inicial da demonstração."
        confirmar="Restaurar"
        perigo
        onConfirmar={async () => {
          await restaurarDemonstracao();
          await queryClient.resetQueries({ queryKey: CHAVES.tudo });
          avisar({ tipo: "sucesso", texto: "Dados de demonstração restaurados" });
        }}
        onFechar={() => setRestaurar(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Lista de uma aba
// ---------------------------------------------------------------------------

function ListaConfig({ aba, config }: { aba: Aba; config: Config }) {
  const def = ABAS[aba];
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [salvando, setSalvando] = useState(false);
  const itens = [...(config[def.chave] as unknown as Item[])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Toda escrita devolve a configuração inteira; nomes e ordem de etapa mexem nas listas e no funil.
  async function gravar(executar: () => Promise<Config>): Promise<boolean> {
    setSalvando(true);
    try {
      const nova = await executar();
      queryClient.setQueryData(CHAVES.config, nova);
      void queryClient.invalidateQueries({ queryKey: CHAVES.alunos });
      void queryClient.invalidateQueries({ queryKey: CHAVES.resumo });
      avisar({ tipo: "sucesso", texto: "Salvo" });
      return true;
    } catch (e) {
      void queryClient.invalidateQueries({ queryKey: CHAVES.config });
      if (e instanceof EducacionalError && e.status === 409 && e.corpo.error === "etapa_com_alunos") {
        const n = e.corpo.alunos ?? 0;
        avisar({
          tipo: "erro",
          texto:
            e.corpo.mensagem ?? `Esta etapa ainda tem ${n} ${n === 1 ? "aluno" : "alunos"}. Mova-os para outra etapa antes de inativar.`,
        });
      } else if (e instanceof EducacionalError && e.rede) {
        avisar({ tipo: "erro", texto: "Não foi possível salvar: sem conexão com o servidor." });
      } else {
        avisar({ tipo: "erro", texto: `Não foi possível salvar. ${e instanceof EducacionalError ? (e.corpo.mensagem ?? e.message) : mensagemDoErro(e)}` });
      }
      return false;
    } finally {
      setSalvando(false);
    }
  }

  // Item novo de lista ordenável entra no fim: o backend exige `ordem` no POST.
  const proximaOrdem = Math.max(0, ...itens.map((i) => i.ordem ?? 0)) + 1;
  const salvarItem = async (id: string | null, campos: Record<string, unknown>) => {
    const novo = def.ordenavel ? { ordem: proximaOrdem, ...campos } : campos;
    const ok = await gravar(() => (id ? atualizarItemConfig(def.colecao, id, campos) : criarItemConfig(def.colecao, novo)));
    if (ok) setEditando(null);
  };

  const alternarAtivo = (i: Item) => void gravar(() => atualizarItemConfig(def.colecao, i.id, { ativo: !i.ativo }));

  // Reordenar: grava a nova `ordem` só de quem mudou (otimista na lista).
  async function reordenar(novaOrdem: Item[]) {
    const mudancas = novaOrdem.flatMap((i, k) => (i.ordem === k + 1 ? [] : [{ id: i.id, ordem: k + 1 }]));
    if (!mudancas.length) return;
    queryClient.setQueryData<Config>(CHAVES.config, (c) =>
      c ? { ...c, [def.chave]: novaOrdem.map((i, k) => ({ ...i, ordem: k + 1 })) } : c,
    );
    await gravar(async () => {
      let ultima: Config | null = null;
      for (const m of mudancas) ultima = await atualizarItemConfig(def.colecao, m.id, { ordem: m.ordem });
      return ultima as Config;
    });
  }

  const aoSoltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const de = itens.findIndex((i) => i.id === e.active.id);
    const para = itens.findIndex((i) => i.id === e.over?.id);
    void reordenar(arrayMove(itens, de, para));
  };

  const linhas = itens.map((i, k) => (
    <Linha
      key={i.id}
      item={i}
      def={def}
      editando={editando === i.id}
      salvando={salvando}
      primeiro={k === 0}
      ultimo={k === itens.length - 1}
      onEditar={() => setEditando(i.id)}
      onCancelar={() => setEditando(null)}
      onSalvar={(campos) => void salvarItem(i.id, campos)}
      onAtivo={() => alternarAtivo(i)}
      onMover={(d) => void reordenar(arrayMove(itens, k, k + d))}
    />
  ));

  return (
    <Card>
      <CardHeader
        title={def.titulo}
        subtitle={def.ordenavel ? "Arraste pela alça (ou use as setas) para mudar a ordem." : undefined}
        action={
          <Button size="sm" onClick={() => setEditando("novo")} disabled={editando === "novo"}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {def.novo}
          </Button>
        }
      />
      <CardContent className="space-y-3">
        {aba === "checkpoints" && (
          <p className="flex items-start gap-2 rounded-xl border border-info/30 bg-info-forte/10 px-3 py-2 text-xs text-texto" role="note">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" aria-hidden />
            Mudanças nos checkpoints padrão valem só para alunos novos. Os checkpoints de quem já está na jornada não mudam.
          </p>
        )}
        {aba === "etapas" && (
          <p className="text-xs text-texto-sec">Só é possível inativar uma etapa sem alunos ativos. Etapas inativas somem do Kanban e das listas.</p>
        )}
        {def.colunas.length > 1 && (
          <div className="hidden items-center gap-x-3 border-b border-white/10 pb-2 text-xs text-texto-sec sm:flex" aria-hidden>
            {def.ordenavel && <span className="w-[6.75rem] shrink-0">Ordem</span>}
            {def.colunas.map((c) => (
              <span key={c.chave} className={cn("min-w-0", c.largura)}>
                {c.rotulo}
              </span>
            ))}
            <span className="ml-auto w-[9.5rem] text-right">Situação</span>
          </div>
        )}
        {def.ordenavel ? (
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
            <SortableContext items={itens.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-white/10">{linhas}</ul>
            </SortableContext>
          </DndContext>
        ) : (
          <ul className="divide-y divide-white/10">{linhas}</ul>
        )}
        {editando === "novo" && (
          <FormItem def={def} salvando={salvando} onCancelar={() => setEditando(null)} onSalvar={(c) => void salvarItem(null, c)} />
        )}
      </CardContent>
    </Card>
  );
}

function Linha({
  item,
  def,
  editando,
  salvando,
  primeiro,
  ultimo,
  onEditar,
  onCancelar,
  onSalvar,
  onAtivo,
  onMover,
}: {
  item: Item;
  def: (typeof ABAS)[Aba];
  editando: boolean;
  salvando: boolean;
  primeiro: boolean;
  ultimo: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onSalvar: (campos: Record<string, unknown>) => void;
  onAtivo: () => void;
  onMover: (d: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !def.ordenavel,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("py-2.5", isDragging && "relative z-10 rounded-lg bg-painel-claro shadow-2xl")}
    >
      {editando ? (
        <FormItem def={def} item={item} salvando={salvando} onCancelar={onCancelar} onSalvar={onSalvar} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {def.ordenavel && (
            <span className="flex items-center">
              <button
                ref={setActivatorNodeRef}
                type="button"
                {...attributes}
                {...listeners}
                aria-label={`Arrastar ${item.nome} para mudar a ordem`}
                className="icon-button h-7 w-7 cursor-grab touch-none"
              >
                <GripVertical className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" disabled={primeiro} onClick={() => onMover(-1)} aria-label={`Subir ${item.nome}`} className="icon-button h-7 w-7 disabled:opacity-30">
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button type="button" disabled={ultimo} onClick={() => onMover(1)} aria-label={`Descer ${item.nome}`} className="icon-button h-7 w-7 disabled:opacity-30">
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
              </button>
              <span className="ml-1 w-5 text-right text-xs tabular-nums text-texto-sec">{item.ordem}</span>
            </span>
          )}
          {def.colunas.map((c) => (
            <span key={c.chave} className={cn("min-w-0 text-sm", c.largura, !item.ativo && "text-texto-sec")}>
              {c.chave !== "nome" && <span className="mr-1 text-xs text-texto-sec sm:hidden">{c.rotulo}:</span>}
              {c.exibir ? c.exibir(item[c.chave]) : String(item[c.chave] ?? "")}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={item.ativo}
              onClick={onAtivo}
              aria-label={`${item.ativo ? "Inativar" : "Ativar"} ${item.nome}`}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                item.ativo ? "border-sucesso-forte/40 bg-sucesso-forte/15 text-sucesso" : "border-white/15 text-texto-sec hover:text-texto",
              )}
            >
              {item.ativo ? "Ativo" : "Inativo"}
            </button>
            <Button variant="ghost" size="sm" onClick={onEditar} aria-label={`Editar ${item.nome}`}>
              <PencilLine className="h-3.5 w-3.5" aria-hidden />
              Editar
            </Button>
          </span>
        </div>
      )}
    </li>
  );
}

function FormItem({
  def,
  item,
  salvando,
  onCancelar,
  onSalvar,
}: {
  def: (typeof ABAS)[Aba];
  item?: Item;
  salvando: boolean;
  onCancelar: () => void;
  onSalvar: (campos: Record<string, unknown>) => void;
}) {
  const inicial = Object.fromEntries(
    def.colunas.map((c) => {
      const v = item?.[c.chave];
      if (c.tipo === "booleano") return [c.chave, v ? "true" : "false"];
      if (c.tipo === "lista") return [c.chave, String(v ?? c.opcoes?.[0]?.valor ?? "")];
      return [c.chave, v == null ? "" : String(v)];
    }),
  );
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const [erro, setErro] = useState<string | null>(null);

  function enviar() {
    const campos: Record<string, unknown> = {};
    for (const c of def.colunas) {
      const v = valores[c.chave] ?? "";
      if (c.tipo === "texto") {
        if (!v.trim()) return setErro(`Informe ${c.rotulo.toLowerCase()}.`);
        campos[c.chave] = v.trim();
      } else if (c.tipo === "numero" || c.tipo === "numero_opcional") {
        if (v === "" && c.tipo === "numero_opcional") campos[c.chave] = null;
        else {
          const n = Number(v);
          if (!Number.isInteger(n) || n < 0) return setErro(`${c.rotulo}: use um número inteiro, 0 ou mais.`);
          campos[c.chave] = n;
        }
      } else if (c.tipo === "booleano") campos[c.chave] = v === "true";
      else campos[c.chave] = v;
    }
    // Só o que mudou (na criação, tudo).
    const mudou = item ? Object.fromEntries(Object.entries(campos).filter(([k, v]) => item[k] !== v)) : campos;
    if (item && !Object.keys(mudou).length) return onCancelar();
    setErro(null);
    onSalvar(mudou);
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancelar()}
      className="space-y-2 rounded-xl border border-azul/30 bg-azul/5 p-3"
    >
      <div className="flex flex-wrap items-end gap-3">
        {def.colunas.map((c) => (
          <label key={c.chave} className={cn("flex min-w-0 flex-col gap-1 text-xs font-medium text-texto-sec", c.largura)}>
            {c.rotulo}
            {c.tipo === "booleano" ? (
              <select
                aria-label={c.rotulo}
                value={valores[c.chave]}
                onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })}
                className={CAMPO}
              >
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </select>
            ) : c.tipo === "lista" ? (
              <select
                aria-label={c.rotulo}
                value={valores[c.chave]}
                onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })}
                className={CAMPO}
              >
                {c.opcoes?.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={c.rotulo}
                type={c.tipo === "texto" ? "text" : "number"}
                min={c.tipo === "texto" ? undefined : 0}
                placeholder={c.tipo === "numero_opcional" ? "Sem prazo" : undefined}
                value={valores[c.chave]}
                onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })}
                className={CAMPO}
                autoFocus={c.chave === "nome"}
              />
            )}
          </label>
        ))}
        <span className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={salvando}>
            Salvar
          </Button>
        </span>
      </div>
      {erro && (
        <p className="text-xs text-erro" role="alert">
          {erro}
        </p>
      )}
    </form>
  );
}
