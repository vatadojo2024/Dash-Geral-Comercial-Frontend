"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Archive, ImagePlus, PencilLine, Send, X } from "lucide-react";
import {
  arquivarComentario,
  buscarMural,
  comentar,
  editarComentario,
  enviarImagemDoMural,
  erroDaImagemDoMural,
} from "@/lib/educacional/apiEducacional";
import {
  ENTIDADES_HISTORICO,
  LIMITE_TEXTO_COMENTARIO,
  MAX_IMAGENS_COMENTARIO,
  TIPOS_IMAGEM_MURAL,
  type Comentario,
  type FiltroMural,
  type ImagemMural,
  type ItemHistorico,
} from "@/lib/educacional/contrato";
import { dataHoraBr, ROTULO_ENTIDADE } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { ConfirmarAcao } from "./Blocos";
import { CAMPO } from "./Dialogo";
import { CHAVES, useConfig } from "./dados";
import { formatarDoHistorico, rotuloDoCampo, type NomesDoHistorico } from "./Historico";
import { mensagemDoErro } from "./partes";

// ---------------------------------------------------------------------------
// Mural do aluno (Entrega 2, M2) — substitui a aba Histórico do Raio-X. Uma
// lista só, mais recente primeiro: comentários da equipe (texto e imagens) e as
// alterações do histórico, com "Mostrar mais" para as antigas. Comentar grava
// na hora (fora da ficha e sem a versão do aluno). Editar e arquivar aparecem
// só quando a API diz que pode (`pode_editar`: o autor). Respostas e reações
// ficam para depois.
// ---------------------------------------------------------------------------

const FILTROS: { valor: FiltroMural | null; rotulo: string }[] = [
  { valor: null, rotulo: "Tudo" },
  { valor: "comentario", rotulo: "Comentários" },
  ...ENTIDADES_HISTORICO.map((e) => ({ valor: e, rotulo: ROTULO_ENTIDADE[e] })),
];

export function MuralDoAluno({ alunoId }: { alunoId: string }) {
  const [filtro, setFiltro] = useState<FiltroMural | null>(null);
  const queryClient = useQueryClient();
  const config = useConfig();
  const nomes: NomesDoHistorico = { programa: (id) => config.data?.programas.find((p) => p.id === id)?.nome };
  const consulta = useInfiniteQuery({
    // Sob a chave do histórico: o "Salvar ficha" e as ações imediatas já a invalidam.
    queryKey: [...CHAVES.historico(alunoId), "mural", filtro],
    queryFn: ({ pageParam }) => buscarMural(alunoId, { antes: pageParam, tipo: filtro }),
    initialPageParam: null as string | null,
    getNextPageParam: (ultima) => ultima.proximo ?? undefined,
    retry: false,
  });
  const atualizar = () => queryClient.invalidateQueries({ queryKey: CHAVES.historico(alunoId) });
  const itens = consulta.data?.pages.flatMap((p) => p.itens) ?? [];

  return (
    <Card>
      <CardHeader title="Mural" subtitle="Comentários da equipe e alterações deste aluno, mais recentes primeiro." />
      <CardContent className="space-y-4">
        <EditorDeComentario
          rotuloEnviar="Comentar"
          onEnviar={async (texto, imagens) => {
            await comentar(alunoId, { texto, imagens });
            await atualizar();
          }}
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar o mural">
          {FILTROS.map((f) => (
            <button
              key={f.valor ?? "tudo"}
              type="button"
              aria-pressed={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filtro === f.valor ? "border-azul/60 bg-azul/15 text-texto" : "border-white/10 text-texto-sec hover:border-white/25 hover:text-texto",
              )}
            >
              {f.rotulo}
            </button>
          ))}
        </div>

        {consulta.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : consulta.isError && !itens.length ? (
          <ErrorState
            titulo="Não foi possível carregar o mural"
            descricao={mensagemDoErro(consulta.error)}
            onRetry={() => consulta.refetch()}
            retryLabel="Tentar de novo"
          />
        ) : itens.length === 0 ? (
          <EmptyState
            titulo="Nada por aqui"
            descricao={filtro ? "Nada deste tipo no mural." : "Nenhum comentário ou alteração. Escreva o primeiro comentário acima."}
          />
        ) : (
          <ol className="space-y-1" aria-label="Itens do mural">
            {itens.map((x) =>
              x.tipo === "comentario" ? (
                <ItemComentario key={`c-${x.id}`} c={x} onMudou={atualizar} />
              ) : (
                <ItemAlteracao key={`h-${x.id}`} h={x} nomes={nomes} />
              ),
            )}
          </ol>
        )}

        {consulta.hasNextPage && (
          <div className="flex flex-col items-center gap-1">
            <Button variant="outline" size="sm" loading={consulta.isFetchingNextPage} onClick={() => void consulta.fetchNextPage()}>
              Mostrar mais
            </Button>
            {consulta.isFetchNextPageError && <p className="text-xs text-erro" role="alert">{mensagemDoErro(consulta.error)}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Comentário
// ---------------------------------------------------------------------------

// Primeira letra do primeiro e do último nome ("Carla Mendes" → "CM").
function iniciais(nome: string): string {
  const p = nome
    .split(/\s+/)
    .map((x) => x.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (!p.length) return "?";
  return `${p[0][0]}${p.length > 1 ? p[p.length - 1][0] : ""}`.toUpperCase();
}

function ItemComentario({ c, onMudou }: { c: Comentario; onMudou: () => Promise<unknown> }) {
  const [editando, setEditando] = useState(false);
  const [arquivar, setArquivar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<ImagemMural | null>(null);

  async function confirmarArquivar() {
    setErro(null);
    try {
      await arquivarComentario(c.id);
      await onMudou();
    } catch (e) {
      setErro(mensagemDoErro(e));
    }
  }

  return (
    <li className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3" aria-label={`Comentário de ${c.autor.nome}`}>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-azul/20 text-xs font-semibold text-texto"
        aria-hidden
      >
        {iniciais(c.autor.nome)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-texto">{c.autor.nome}</span>
          <span className="text-xs tabular-nums text-texto-sec">{dataHoraBr(c.em)}</span>
          {c.editado_em && (
            <span className="text-xs text-texto-sec" title={`Editado em ${dataHoraBr(c.editado_em)}`}>
              · editado
            </span>
          )}
          {c.pode_editar && !editando && (
            <span className="ml-auto flex gap-0.5">
              <Button variant="ghost" size="sm" onClick={() => setEditando(true)} aria-label="Editar comentário" title="Editar">
                <PencilLine className="h-3.5 w-3.5" aria-hidden />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setArquivar(true)} aria-label="Arquivar comentário" title="Arquivar">
                <Archive className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </span>
          )}
        </div>
        {editando ? (
          <div className="mt-2">
            <EditorDeComentario
              inicial={{ texto: c.texto, imagens: c.imagens }}
              rotuloEnviar="Salvar"
              onCancelar={() => setEditando(false)}
              onEnviar={async (texto, imagens) => {
                await editarComentario(c.id, { texto, imagens });
                await onMudou();
                setEditando(false);
              }}
            />
          </div>
        ) : (
          <>
            {c.texto && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-texto">{c.texto}</p>}
            {c.imagens.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Imagens do comentário">
                {c.imagens.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => setAmpliada(i)}
                      className="block overflow-hidden rounded-lg border border-white/10 hover:border-white/30 focus-visible:border-azul/60 focus-visible:outline-none"
                      aria-label={`Ampliar ${i.nome}`}
                    >
                      <img src={i.url} alt={i.nome} className="h-32 max-w-[16rem] object-cover" loading="lazy" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {erro && (
          <p className="mt-2 text-xs text-erro" role="alert">
            {erro}
          </p>
        )}
      </div>
      <ConfirmarAcao
        aberto={arquivar}
        titulo="Arquivar comentário?"
        texto="Ele sai do mural do aluno. Continua guardado no banco."
        confirmar="Arquivar"
        onConfirmar={() => void confirmarArquivar()}
        onFechar={() => setArquivar(false)}
      />
      {ampliada && <ImagemAmpliada imagem={ampliada} onFechar={() => setAmpliada(null)} />}
    </li>
  );
}

// Imagem em tela cheia (no <body>: o vidro do card prenderia o `fixed`).
function ImagemAmpliada({ imagem, onFechar }: { imagem: ImagemMural; onFechar: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar]);
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={imagem.nome}>
      <div className="absolute inset-0 bg-black/80" onClick={onFechar} aria-hidden />
      <img src={imagem.url} alt={imagem.nome} className="relative max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
      <button type="button" onClick={onFechar} aria-label="Fechar" className="icon-button absolute right-4 top-4">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Caixa de comentário (novo ou edição): texto e imagens (colar, anexar ou
// arrastar). As imagens novas sobem uma a uma no envio; a que já subiu não
// sobe de novo se o comentário falhar e a pessoa tentar outra vez.
// ---------------------------------------------------------------------------

type Anexo = { chave: string; nome: string; url: string; arquivo?: File; enviada?: ImagemMural };

const ACEITOS = TIPOS_IMAGEM_MURAL.join(",");
let contador = 0;

function EditorDeComentario({
  inicial,
  rotuloEnviar,
  onEnviar,
  onCancelar,
}: {
  inicial?: { texto: string; imagens: ImagemMural[] };
  rotuloEnviar: string;
  onEnviar: (texto: string, imagens: string[]) => Promise<void>;
  onCancelar?: () => void;
}) {
  const [texto, setTexto] = useState(inicial?.texto ?? "");
  const [anexos, setAnexos] = useState<Anexo[]>(() => (inicial?.imagens ?? []).map((i) => ({ chave: i.id, nome: i.nome, url: i.url, enviada: i })));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);
  const locais = useRef(new Set<string>());

  // Prévias locais (object URL) liberadas ao sair.
  useEffect(() => {
    const urls = locais.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function adicionar(arquivos: File[]) {
    const erros: string[] = [];
    const novos: Anexo[] = [];
    for (const f of arquivos) {
      if (anexos.length + novos.length >= MAX_IMAGENS_COMENTARIO) {
        erros.push(`No máximo ${MAX_IMAGENS_COMENTARIO} imagens por comentário.`);
        break;
      }
      const e = erroDaImagemDoMural(f);
      if (e) {
        erros.push(e);
        continue;
      }
      const url = URL.createObjectURL(f);
      locais.current.add(url);
      contador += 1;
      novos.push({ chave: `local-${contador}`, nome: f.name || "imagem colada", url, arquivo: f });
    }
    if (novos.length) setAnexos((a) => [...a, ...novos]);
    setErro(erros.length ? erros.join(" ") : null);
  }

  function remover(chave: string) {
    setAnexos((a) => a.filter((x) => x.chave !== chave));
  }

  function aoColar(e: ClipboardEvent<HTMLTextAreaElement>) {
    const imagens = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (!imagens.length) return;
    if (!e.clipboardData.getData("text/plain")) e.preventDefault();
    adicionar(imagens);
  }

  function aoSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    adicionar([...e.dataTransfer.files]);
  }

  async function enviar() {
    if (enviando) return;
    const t = texto.trim();
    if (!t && !anexos.length) return setErro("Escreva um comentário ou anexe uma imagem.");
    setErro(null);
    setEnviando(true);
    try {
      const prontos = [...anexos];
      for (let i = 0; i < prontos.length; i += 1) {
        const a = prontos[i];
        if (a.enviada || !a.arquivo) continue;
        const enviada = await enviarImagemDoMural(a.arquivo);
        prontos[i] = { ...a, enviada };
        setAnexos((lista) => lista.map((x) => (x.chave === a.chave ? { ...x, enviada } : x)));
      }
      await onEnviar(t, prontos.map((a) => a.enviada!.id));
      if (!inicial) {
        setTexto("");
        setAnexos([]);
      }
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className={cn("rounded-xl border border-white/10 bg-white/[0.02] p-2", arrastando && "border-azul/60 bg-azul/[0.06]")}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={aoSoltar}
    >
      <textarea
        aria-label={inicial ? "Editar comentário" : "Novo comentário"}
        placeholder={inicial ? undefined : "Escreva um comentário… Cole ou arraste imagens aqui."}
        value={texto}
        maxLength={LIMITE_TEXTO_COMENTARIO}
        rows={inicial ? 3 : 2}
        disabled={enviando}
        onChange={(e) => setTexto(e.target.value)}
        onPaste={aoColar}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void enviar();
          }
          if (e.key === "Escape" && onCancelar) onCancelar();
        }}
        className={cn(CAMPO, "h-auto resize-y border-transparent bg-transparent py-2 focus:border-transparent")}
      />
      {anexos.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-2 pb-2" aria-label="Imagens anexadas">
          {anexos.map((a) => (
            <li key={a.chave} className="relative">
              <img src={a.url} alt={a.nome} className="h-16 w-24 rounded-md border border-white/10 object-cover" />
              <button
                type="button"
                onClick={() => remover(a.chave)}
                disabled={enviando}
                aria-label={`Tirar ${a.nome}`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-painel text-texto hover:bg-erro/80"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-1 pt-2">
        <input
          ref={seletor}
          type="file"
          accept={ACEITOS}
          multiple
          hidden
          onChange={(e) => {
            adicionar([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="ghost" size="sm" disabled={enviando} onClick={() => seletor.current?.click()}>
          <ImagePlus className="h-3.5 w-3.5" aria-hidden />
          Anexar imagem
        </Button>
        <span className="text-[11px] text-texto-sec">PNG, JPG, WEBP ou GIF, até 4 MB cada · Ctrl+Enter envia</span>
        <span className="ml-auto flex gap-2">
          {onCancelar && (
            <Button type="button" variant="ghost" size="sm" disabled={enviando} onClick={onCancelar}>
              Cancelar
            </Button>
          )}
          <Button type="button" size="sm" loading={enviando} onClick={() => void enviar()}>
            <Send className="h-3.5 w-3.5" aria-hidden />
            {rotuloEnviar}
          </Button>
        </span>
      </div>
      {erro && (
        <p className="px-2 pb-1 pt-2 text-xs text-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alteração do histórico (linha compacta entre os comentários)
// ---------------------------------------------------------------------------

function ItemAlteracao({ h, nomes }: { h: ItemHistorico; nomes: NomesDoHistorico }) {
  return (
    <li className="flex gap-3 px-3 py-2 text-sm">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="tag">{ROTULO_ENTIDADE[h.entidade]}</span>
          <span className="font-medium text-texto">{rotuloDoCampo(h)}</span>
          <span className="text-xs text-texto-sec">
            {h.usuario.nome} · <span className="tabular-nums">{dataHoraBr(h.em)}</span>
          </span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 break-words text-texto-sec">
          <span className="line-through decoration-white/30">{formatarDoHistorico(h, h.valor_antes, nomes)}</span>
          <ArrowRight className="h-3 w-3 shrink-0" aria-label="para" />
          <span className="text-texto">{formatarDoHistorico(h, h.valor_depois, nomes)}</span>
        </p>
        {h.motivo && <p className="mt-1 text-xs italic text-texto-sec">“{h.motivo}”</p>}
      </div>
    </li>
  );
}
