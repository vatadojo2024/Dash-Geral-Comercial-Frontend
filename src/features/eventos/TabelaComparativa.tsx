import {
  DICA_NAO_MEDIDO,
  dicaAgendamentoNulo,
  doModo,
  entraNaMedia,
  formatarPct,
  mediaDaMetrica,
  mediaDe,
  pctOuNulo,
  rotuloData,
  taxa,
  TRAVESSAO,
  type Evento,
  type Media,
  type ModoPresenca,
  type Taxa,
} from "@/lib/eventos/comparativo";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import {
  DICA_EM_ANDAMENTO,
  IconeAvisos,
  SeloBaseInsuficiente,
  SeloJanelaAberta,
  SeloModo,
  TextoContagem,
  TextoTaxa,
} from "./Pecas";

// ---------------------------------------------------------------------------
// Tabela comparativa: um evento por linha, o mais recente primeiro, e a linha
// fixa da média no topo (dos eventos na tela). Clicar numa linha seleciona o
// evento. Cada célula: a contagem e, embaixo, a taxa (sobre a etapa anterior do
// bloco). Nas colunas que dependem da presença, a média só usa eventos do mesmo
// modo do evento selecionado: exata e aproximada não se misturam.
// ---------------------------------------------------------------------------

type Coluna = {
  grupo: "Ao vivo" | "Replay" | "Total" | "Resgate";
  rotulo: string;
  n: (e: Evento) => number | null;
  taxa?: (e: Evento) => Taxa;
  /** A contagem depende da presença: média só no mesmo modo. */
  presencaN?: boolean;
  /** A taxa depende da presença: média só no mesmo modo, e ≈ no modo aproximado. */
  presencaTaxa?: boolean;
  agendamento?: boolean;
  /** Bloco inteiro nulo: a dica do travessão diz que o bloco não existiu. */
  semBloco?: (e: Evento) => string | null;
};

const semReplay = (e: Evento) => (e.replay ? null : "sem replay neste evento");
const semResgate = (e: Evento) => (e.resgate ? null : "sem resgate neste evento");

const COLUNAS: Coluna[] = [
  { grupo: "Ao vivo", rotulo: "Assistiram", n: (e) => e.ao_vivo.assistiram, taxa: (e) => taxa(e.ao_vivo.assistiram, e.inscritos), presencaN: true, presencaTaxa: true },
  { grupo: "Ao vivo", rotulo: "Levantaram", n: (e) => e.ao_vivo.aplicaram, taxa: (e) => taxa(e.ao_vivo.aplicaram, e.ao_vivo.assistiram), presencaTaxa: true },
  { grupo: "Ao vivo", rotulo: "Agendaram", n: (e) => e.ao_vivo.agendaram, taxa: (e) => taxa(e.ao_vivo.agendaram, e.ao_vivo.aplicaram), agendamento: true },
  { grupo: "Replay", rotulo: "Acessaram", n: (e) => e.replay?.acessaram ?? null, semBloco: semReplay },
  { grupo: "Replay", rotulo: "Assistiram", n: (e) => e.replay?.assistiram ?? null, taxa: (e) => taxa(e.replay?.assistiram, e.replay?.acessaram), semBloco: semReplay },
  { grupo: "Replay", rotulo: "Aplicaram", n: (e) => e.replay?.aplicaram ?? null, taxa: (e) => taxa(e.replay?.aplicaram, e.replay?.assistiram), semBloco: semReplay },
  { grupo: "Replay", rotulo: "Agendaram", n: (e) => e.replay?.agendaram ?? null, taxa: (e) => taxa(e.replay?.agendaram, e.replay?.aplicaram), semBloco: semReplay, agendamento: true },
  { grupo: "Total", rotulo: "Assistiram", n: (e) => e.total.assistiram, presencaN: true },
  { grupo: "Total", rotulo: "Aplicaram", n: (e) => e.total.aplicaram, taxa: (e) => taxa(e.total.aplicaram, e.total.assistiram), presencaTaxa: true },
  { grupo: "Total", rotulo: "Agendaram", n: (e) => e.total.agendaram, taxa: (e) => taxa(e.total.agendaram, e.total.aplicaram), agendamento: true },
  { grupo: "Resgate", rotulo: "Convidados", n: (e) => e.resgate?.convidados ?? null, semBloco: semResgate },
  { grupo: "Resgate", rotulo: "Assistiram", n: (e) => e.resgate?.assistiram ?? null, taxa: (e) => taxa(e.resgate?.assistiram, e.resgate?.convidados), semBloco: semResgate },
  { grupo: "Resgate", rotulo: "Aplicaram", n: (e) => e.resgate?.aplicaram ?? null, taxa: (e) => taxa(e.resgate?.aplicaram, e.resgate?.assistiram), semBloco: semResgate },
  { grupo: "Resgate", rotulo: "Agendaram", n: (e) => e.resgate?.agendaram ?? null, taxa: (e) => taxa(e.resgate?.agendaram, e.resgate?.aplicaram), semBloco: semResgate, agendamento: true },
];

const GRUPOS = ["Ao vivo", "Replay", "Total", "Resgate"] as const;
// Borda à esquerda do primeiro sub-cabeçalho de cada grupo.
const INICIO_DE_GRUPO = new Set(COLUNAS.map((c, i) => (i === 0 || COLUNAS[i - 1].grupo !== c.grupo ? i : -1)));

const TH = "px-1 py-2 text-right text-[11px] font-medium opacity-70";
const TD = "px-1 py-2 text-right align-top";

export function TabelaComparativa({
  eventos,
  modoReferencia,
  selecionado,
  onSelecionar,
  total,
  verTodos,
  onVerTodos,
}: {
  /** Os eventos na tela (12 mais recentes, ou todos): são eles que entram na média. */
  eventos: Evento[];
  /** Modo de presença do evento selecionado: o das médias que dependem da presença. */
  modoReferencia: ModoPresenca;
  selecionado: string | null;
  onSelecionar: (data: string) => void;
  total: number;
  verTodos: boolean;
  onVerTodos: (v: boolean) => void;
}) {
  const media = (f: (e: Evento) => number | null, presenca = false) =>
    mediaDe(presenca ? doModo(eventos, modoReferencia) : eventos, f);
  const nNaMedia = eventos.filter(entraNaMedia).length;
  // Quantos eventos do modo do selecionado têm a presença medida.
  const nNoModo = mediaDaMetrica(eventos, "presenca", modoReferencia).eventos;
  const nomeModo = modoReferencia === "exato" ? "exata" : "aproximada";

  return (
    <Card>
      <CardHeader
        title="Comparativo por evento"
        subtitle="Taxa embaixo de cada número: sobre a etapa anterior do bloco (resgate a partir dos convidados). Clique numa linha para ver o evento nos cards."
        action={
          total > eventos.length || verTodos ? (
            <button
              type="button"
              onClick={() => onVerTodos(!verTodos)}
              className="whitespace-nowrap text-xs font-medium text-azul-claro hover:underline"
            >
              {verTodos ? "Ver só os 12 mais recentes" : `Ver todos (${total})`}
            </button>
          ) : undefined
        }
      />
      <div className="overflow-x-auto px-2 pb-4">
        <table className="w-full min-w-[1080px] border-collapse text-xs">
          <thead>
            <tr>
              <th rowSpan={2} className="px-1.5 py-2 text-left text-[11px] font-medium opacity-70">
                Evento
              </th>
              <th rowSpan={2} className={TH}>
                Inscritos
              </th>
              {GRUPOS.map((g) => (
                <th
                  key={g}
                  colSpan={COLUNAS.filter((c) => c.grupo === g).length}
                  className="border-l border-white/10 px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-texto"
                >
                  {g}
                </th>
              ))}
              <th rowSpan={2} className={cn(TH, "border-l border-white/10")} title="Todas as 1ªs calls marcadas na janela do evento, em toda a base. Só informativo.">
                1ªs calls
                <br />
                na janela
              </th>
            </tr>
            <tr>
              {COLUNAS.map((c, i) => (
                <th key={`${c.grupo}-${c.rotulo}`} className={cn(TH, INICIO_DE_GRUPO.has(i) && "border-l border-white/10")}>
                  {c.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Linha fixa: média dos eventos na tela (janela fechada, base suficiente, sem nulos). */}
            <tr className="border-y border-white/15 bg-white/[0.04]">
              <td className="px-1.5 py-2 text-left align-top">
                <p className="font-medium text-texto">
                  Média de {nNaMedia} {nNaMedia === 1 ? "evento" : "eventos"}
                </p>
                <p className="text-[10px] opacity-70" title="Só eventos com a janela fechada e base suficiente; nulos ficam de fora.">
                  presença: {nNoModo} com medição {nomeModo}
                </p>
              </td>
              <td className={TD}>
                <TextoMedia m={media((e) => e.inscritos)} />
              </td>
              {COLUNAS.map((c, i) => (
                <td key={`m-${c.grupo}-${c.rotulo}`} className={cn(TD, INICIO_DE_GRUPO.has(i) && "border-l border-white/10")}>
                  <TextoMedia m={media(c.n, c.presencaN)} />
                  {c.taxa && (
                    <p className="opacity-70">
                      <TextoMedia m={media((e) => pctOuNulo(c.taxa!(e)), c.presencaTaxa)} pct />
                    </p>
                  )}
                </td>
              ))}
              <td className={cn(TD, "border-l border-white/10")}>
                <TextoMedia m={media((e) => e.primeiras_calls_na_janela)} />
              </td>
            </tr>

            {eventos.map((e) => {
              const ativo = e.data_evento === selecionado;
              const aprox = e.modo_presenca === "aproximado";
              return (
                <tr
                  key={e.data_evento}
                  onClick={() => onSelecionar(e.data_evento)}
                  onKeyDown={(k) => (k.key === "Enter" || k.key === " ") && (k.preventDefault(), onSelecionar(e.data_evento))}
                  tabIndex={0}
                  aria-selected={ativo}
                  className={cn(
                    "cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none",
                    ativo && "bg-azul/15 hover:bg-azul/20",
                    e.base_insuficiente && "opacity-70",
                  )}
                >
                  <td className="px-2 py-2 text-left align-top">
                    <p className="flex items-center gap-1.5 font-medium text-texto">
                      {rotuloData(e.data_evento)}
                      <IconeAvisos avisos={e.avisos} />
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <SeloModo modo={e.modo_presenca} />
                      {!e.janela_fechada && <SeloJanelaAberta />}
                      {e.base_insuficiente && <SeloBaseInsuficiente />}
                    </div>
                  </td>
                  <td className={TD}>
                    <TextoContagem n={e.inscritos} className="text-texto" />
                  </td>
                  {COLUNAS.map((c, i) => {
                    const dicaBloco = c.semBloco?.(e) ?? null;
                    // "em andamento" só onde há número de agendamento que ainda pode subir.
                    const emAndamento = c.agendamento && !e.janela_fechada && c.n(e) != null;
                    return (
                      <td
                        key={`${c.grupo}-${c.rotulo}`}
                        className={cn(TD, INICIO_DE_GRUPO.has(i) && "border-l border-white/10")}
                        title={emAndamento ? DICA_EM_ANDAMENTO : undefined}
                      >
                        <TextoContagem
                          n={c.n(e)}
                          dica={dicaBloco ?? (c.agendamento ? dicaAgendamentoNulo(e) : DICA_NAO_MEDIDO)}
                          className="text-texto"
                        />
                        {c.taxa && (
                          <p className={cn("opacity-80", emAndamento && "text-info")}>
                            <TextoTaxa taxa={c.taxa(e)} aproximado={aprox && c.presencaTaxa} />
                          </p>
                        )}
                        {emAndamento && <p className="text-[10px] text-info">em andamento</p>}
                      </td>
                    );
                  })}
                  <td className={cn(TD, "border-l border-white/10")}>
                    <TextoContagem n={e.primeiras_calls_na_janela} className="text-texto" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Valor da média, com quantos eventos entraram nela na dica.
function TextoMedia({ m, pct = false }: { m: Media; pct?: boolean }) {
  if (m.valor == null) {
    return (
      <span className="tabular-nums" title="nenhum evento com este dado na tela">
        {TRAVESSAO}
      </span>
    );
  }
  return (
    <span className="tabular-nums font-medium text-texto" title={`média de ${m.eventos} ${m.eventos === 1 ? "evento" : "eventos"}`}>
      {pct ? formatarPct(m.valor) : m.valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
    </span>
  );
}
