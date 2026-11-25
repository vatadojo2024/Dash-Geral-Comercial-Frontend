import type { ReactNode } from "react";
import {
  comparacaoComMedia,
  contagemDe,
  dicaAgendamentoNulo,
  entraNaMedia,
  mediaDaMetrica,
  mediaParaComparar,
  eventoAnterior,
  rotuloData,
  taxaDe,
  variacaoColorivel,
  variacaoContraAnterior,
  type ChaveMetrica,
  type Evento,
} from "@/lib/eventos/comparativo";
import { Card } from "@/components/ui/Card";
import {
  IconeAvisos,
  SeloBaseInsuficiente,
  SeloJanelaAberta,
  SeloModo,
  TextoContagem,
  TextoTaxa,
  TextoVariacao,
} from "./Pecas";

// ---------------------------------------------------------------------------
// Os quatro cards do evento selecionado: contagem, taxa, variação contra o
// evento anterior (% na contagem, p.p. na taxa) e comparação com a média dos
// eventos na tela. Nas métricas de presença, só se compara no mesmo modo
// (exata × aproximada não se comparam).
// ---------------------------------------------------------------------------

type DefCard = { titulo: string; contagem: ChaveMetrica; taxa: ChaveMetrica | null; rotuloTaxa: string | null };

const CARDS: DefCard[] = [
  { titulo: "Inscritos", contagem: "inscritos", taxa: null, rotuloTaxa: null },
  { titulo: "Assistiram ao vivo", contagem: "assistiram", taxa: "presenca", rotuloTaxa: "presença" },
  { titulo: "Levantaram a mão", contagem: "aplicaram", taxa: "levantaram", rotuloTaxa: "dos presentes" },
  { titulo: "Agendaram", contagem: "agendaram", taxa: "agendamento", rotuloTaxa: "de quem levantou" },
];

export function CardsDoEvento({
  eventos,
  visiveis,
  evento,
}: {
  /** Todos os eventos buscados: o "anterior" sai daqui. */
  eventos: Evento[];
  /** Os eventos na tela: a média sai daqui. */
  visiveis: Evento[];
  evento: Evento;
}) {
  const anterior = eventoAnterior(eventos, evento);
  const aproximado = evento.modo_presenca === "aproximado";
  const nNaMedia = visiveis.filter(entraNaMedia).length;
  // Quantos eventos do mesmo modo têm a presença medida (os que entram na média dela).
  const nNoModo = mediaDaMetrica(visiveis, "presenca", evento.modo_presenca).eventos;
  const dicaMedia = (chave: ChaveMetrica) => {
    const m = mediaParaComparar(visiveis, evento, chave);
    return m.motivo ? undefined : `média de ${m.eventos} ${m.eventos === 1 ? "evento" : "eventos"}`;
  };

  return (
    <section aria-label="Evento selecionado" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-texto">
          {evento.tag} <span className="opacity-70">· {rotuloData(evento.data_evento)}</span>
        </span>
        <SeloModo modo={evento.modo_presenca} />
        {!evento.janela_fechada && <SeloJanelaAberta />}
        {evento.base_insuficiente && <SeloBaseInsuficiente />}
        <IconeAvisos avisos={evento.avisos} />
        <span className="text-xs opacity-70">
          {anterior ? `Anterior: ${rotuloData(anterior.data_evento)}` : "Sem evento anterior no período"}
          {` · Média de ${nNaMedia} ${nNaMedia === 1 ? "evento" : "eventos"} na tela (presença: ${nNoModo} com medição ${
            evento.modo_presenca === "exato" ? "exata" : "aproximada"
          })`}
          {` · 1ªs calls na janela (toda a base): ${evento.primeiras_calls_na_janela.toLocaleString("pt-BR")}`}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {CARDS.map((c) => {
          const agendamento = c.contagem === "agendaram";
          const emAndamento = agendamento && !evento.janela_fechada;
          // Aproximado: a presença e o que é medido sobre ela. Quem levantou a mão
          // sai de uma tag permanente: a contagem é exata, só a taxa é aproximada.
          const aproxContagem = aproximado && c.contagem === "assistiram";
          const aproxTaxa = aproximado && (c.taxa === "presenca" || c.taxa === "levantaram");
          return (
            <Card key={c.titulo} className="space-y-2 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide opacity-70">{c.titulo}</p>
                {emAndamento && <SeloJanelaAberta />}
              </div>
              <p className="text-3xl font-semibold text-texto">
                {aproxContagem && contagemDe(evento, c.contagem) != null ? <span className="opacity-70">≈ </span> : null}
                <TextoContagem
                  n={contagemDe(evento, c.contagem)}
                  dica={agendamento ? dicaAgendamentoNulo(evento) : undefined}
                />
              </p>
              <p className="min-h-[1.25rem] text-sm">
                {c.taxa && (
                  <>
                    <TextoTaxa taxa={taxaDe(evento, c.taxa)} aproximado={aproxTaxa} className="font-medium text-texto" />{" "}
                    <span className="opacity-70">{c.rotuloTaxa}</span>
                  </>
                )}
              </p>
              <dl className="space-y-1 border-t border-white/10 pt-2 text-xs">
                <LinhaComparacao
                  rotulo="vs. anterior"
                  contagem={
                    <TextoVariacao
                      v={variacaoContraAnterior(eventos, evento, c.contagem)}
                      colorir={variacaoColorivel(evento, c.contagem)}
                    />
                  }
                  taxa={
                    c.taxa && (
                      <TextoVariacao
                        v={variacaoContraAnterior(eventos, evento, c.taxa)}
                        colorir={variacaoColorivel(evento, c.taxa)}
                      />
                    )
                  }
                />
                <LinhaComparacao
                  rotulo="vs. média"
                  contagem={
                    <TextoVariacao
                      v={comparacaoComMedia(visiveis, evento, c.contagem)}
                      colorir={variacaoColorivel(evento, c.contagem)}
                      dica={dicaMedia(c.contagem)}
                    />
                  }
                  taxa={
                    c.taxa && (
                      <TextoVariacao
                        v={comparacaoComMedia(visiveis, evento, c.taxa)}
                        colorir={variacaoColorivel(evento, c.taxa)}
                        dica={dicaMedia(c.taxa)}
                      />
                    )
                  }
                />
              </dl>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function LinhaComparacao({ rotulo, contagem, taxa }: { rotulo: string; contagem: ReactNode; taxa: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="opacity-70">{rotulo}</dt>
      <dd className="flex items-baseline gap-2">
        {contagem}
        {taxa && (
          <>
            <span className="opacity-40" aria-hidden>
              ·
            </span>
            {taxa}
          </>
        )}
      </dd>
    </div>
  );
}
