"use client";

import { Ban, Info, Layers, Sprout, Trash2, UserX, Users } from "lucide-react";
import {
  dataDoEvento,
  ehSemDono,
  PAPEL_LABEL,
  rotuloDaTaxa,
  sobreposicao,
  taxaDeDescarte,
  totalDeDescartes,
  type DescarteUsuario,
  type DescartesDoEvento,
  type DescartesResponse,
  type TotaisDescartes,
} from "@/lib/sdr/descartes";
import { rotuloCiclo } from "@/lib/sdr/ciclo";
import { formatarPct, pct } from "@/lib/sdr/oportunidades";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { FaixaAvisos, RodapeEventos } from "./EventosComuns";
import { KpiChip } from "./KpiChip";

// ---------------------------------------------------------------------------
// Recorte "Descartes" de Oportunidades do Evento (conteúdo abaixo da barra de
// recortes; o período é o mesmo das outras abas). Dos INSCRITOS de cada
// evento, quantos leads cada pessoa da pré-venda descartou — desqualificou,
// perdeu, Nutrição —, só no pipeline "Pré Vendas". Um bloco por evento, com a
// taxa de descarte (leads distintos / inscritos), que compara evento com
// evento. Com vários eventos, o consolidado do intervalo vem por último e NÃO
// é a soma dos blocos.
// ---------------------------------------------------------------------------

const TAG_PAPEL: Record<string, string> = { sdr: "tag-info", closer: "tag-warning", admin: "tag-success" };

function BadgePapel({ papel }: { papel: DescarteUsuario["papel"] }) {
  if (!papel) return <span className="tag opacity-70">Sem papel</span>;
  return <span className={cn("tag", TAG_PAPEL[papel])}>{PAPEL_LABEL[papel]}</span>;
}

function textoDeOnde(etapas: string[]): string {
  return [
    "Pipeline Pré Vendas apenas (Outbound, Social Selling, Vendas etc. não entram).",
    "Cada lead conta para o evento de origem (a tag WG que carrega), e só se o descarte aconteceu do dia do evento em diante.",
    etapas.length
      ? `Desqualificou: card movido para ${etapas.join(", ")} — creditado ao dono do card.`
      : "Desqualificou: card movido para uma etapa de desqualificação — creditado ao dono do card.",
    "Perdeu: negócio marcado como perdido (status, em qualquer etapa) — creditado a quem marcou.",
    "Nutrição: card movido para o pipeline Nutrição — creditado ao dono do card.",
  ].join("\n");
}

export function ConteudoDescartes({
  data,
  atualizando,
  onAtualizar,
}: {
  data: DescartesResponse;
  atualizando: boolean;
  onAtualizar: () => void;
}) {
  const t = data.totais;
  const inscritos = data.por_evento.reduce((s, e) => s + (e.inscritos ?? 0), 0);
  const umEvento = data.por_evento.length === 1;
  const deOnde = textoDeOnde(data.fontes?.etapas_desqualificacao ?? []);
  const taxaUnica = umEvento ? taxaDeDescarte(t.leads_distintos, data.por_evento[0].inscritos) : null;

  return (
    <>
      <FaixaAvisos avisos={data.avisos} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiChip
          icon={Users}
          rotulo="Inscritos"
          valor={String(inscritos)}
          detalhe={umEvento ? data.por_evento[0].evento_tag : `em ${data.por_evento.length} eventos`}
          filtro="denominador da taxa"
        />
        <KpiChip
          icon={Layers}
          rotulo="Leads descartados"
          valor={String(t.leads_distintos)}
          detalhe={
            umEvento
              ? `${rotuloDaTaxa(taxaUnica)} dos inscritos · ${totalDeDescartes(t)} descartes`
              : `no intervalo · ${totalDeDescartes(t)} descartes`
          }
          filtro="leads distintos"
          destaque
        />
        <KpiChip icon={Ban} rotulo="Desqualificou" valor={String(t.desqualificou)} detalhe={pctDosLeads(t.desqualificou, t)} filtro="etapa de desqualificação" />
        <KpiChip icon={UserX} rotulo="Perdeu" valor={String(t.perdeu)} detalhe={pctDosLeads(t.perdeu, t)} filtro="marcado como perdido" />
        <KpiChip icon={Sprout} rotulo="Nutrição" valor={String(t.nutricao)} detalhe={pctDosLeads(t.nutricao, t)} filtro="movido para Nutrição" />
      </div>

      {data.por_evento.length === 0 ? (
        <Card>
          <EmptyState
            icon={Trash2}
            titulo="Nenhum evento no período"
            descricao={`Nenhuma terça entre ${rotuloCiclo({ inicio: data.de, fim: data.ate })} — nenhuma tag WG para consultar.`}
          />
        </Card>
      ) : (
        data.por_evento.map((ev) => <BlocoDoEvento key={ev.evento_tag} ev={ev} deOnde={deOnde} />)
      )}

      {data.por_evento.length > 1 && data.por_usuario.length > 0 && (
        <Card>
          <CardHeader
            title="Consolidado do intervalo"
            subtitle={`${rotuloCiclo({ inicio: data.de, fim: data.ate })} · pipeline Pré Vendas · cada pessoa somada em todos os eventos — um lead inscrito em dois eventos conta uma vez só aqui, por isso este total pode ser menor que a soma dos blocos.`}
          />
          <TabelaPorPessoa linhas={data.por_usuario} totais={t} rotuloTotal="Intervalo" />
        </Card>
      )}

      <RodapeEventos data={data} atualizando={atualizando} onAtualizar={onAtualizar} />
    </>
  );
}

function pctDosLeads(n: number, t: TotaisDescartes): string | undefined {
  return t.leads_distintos ? `${formatarPct(pct(n, t.leads_distintos))} dos leads` : undefined;
}

function BlocoDoEvento({ ev, deOnde }: { ev: DescartesDoEvento; deOnde: string }) {
  const taxa = taxaDeDescarte(ev.totais.leads_distintos, ev.inscritos);
  return (
    <Card>
      <CardHeader
        title={`${ev.evento_tag} · ${dataDoEvento(ev.evento_tag)}`}
        subtitle={`${ev.inscritos ?? "—"} inscritos · ${ev.totais.leads_distintos} ${ev.totais.leads_distintos === 1 ? "lead descartado" : "leads descartados"} · pipeline Pré Vendas · as colunas se sobrepõem: o total de leads é "Leads distintos".`}
        action={
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-right">
              <span className="block text-lg font-semibold tabular-nums text-texto">{rotuloDaTaxa(taxa)}</span>
              <span className="block text-[11px] text-texto-sec">taxa de descarte</span>
            </span>
            <span
              className="inline-flex cursor-help items-center gap-1 text-xs text-texto-sec"
              title={deOnde}
              tabIndex={0}
              aria-label={`De onde vem esse número: ${deOnde}`}
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
              De onde vem
            </span>
          </div>
        }
      />
      {ev.por_usuario.length === 0 ? (
        <EmptyState
          icon={Trash2}
          tom="positivo"
          titulo="Nenhum descarte deste evento"
          descricao="Ninguém desqualificou, deu como perdido ou mandou para a Nutrição um inscrito deste evento, no pipeline Pré Vendas."
        />
      ) : (
        <TabelaPorPessoa linhas={ev.por_usuario} totais={ev.totais} rotuloTotal="Evento" />
      )}
    </Card>
  );
}

function TabelaPorPessoa({
  linhas,
  totais,
  rotuloTotal,
}: {
  linhas: DescarteUsuario[];
  totais: TotaisDescartes;
  rotuloTotal: string;
}) {
  const chave = (u: DescarteUsuario, i: number) => u.usuario_id ?? u.usuario_clint_id ?? `${u.nome}-${i}`;
  return (
    <div className="px-6 pb-6">
      {/* ≥ md: tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-borda text-xs text-texto-sec">
              <th className="px-2 py-2 text-left font-medium">Pessoa</th>
              <th className="px-2 py-2 text-left font-medium">Papel</th>
              <th className="px-2 py-2 text-right font-medium">Desqualificou</th>
              <th className="px-2 py-2 text-right font-medium">Perdeu</th>
              <th className="px-2 py-2 text-right font-medium">Nutrição</th>
              <th className="px-2 py-2 text-right font-medium">Leads distintos</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((u, i) => (
              <tr key={chave(u, i)} className="border-b border-borda/40">
                <td className="px-2 py-2">
                  <p className={cn("font-medium", ehSemDono(u) ? "text-texto-sec" : "text-texto")}>{u.nome}</p>
                  {u.email && <p className="text-xs text-texto-sec">{u.email}</p>}
                </td>
                <td className="px-2 py-2">
                  <BadgePapel papel={u.papel} />
                </td>
                <Numero valor={u.desqualificou} />
                <Numero valor={u.perdeu} />
                <Numero valor={u.nutricao} />
                <td className="px-2 py-2 text-right">
                  <span className="font-semibold tabular-nums text-texto">{u.leads_distintos}</span>
                  {sobreposicao(u) > 0 && (
                    <span className="block text-[11px] text-texto-sec" title="Descartes que contam em mais de uma via">
                      {totalDeDescartes(u)} descartes
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-borda font-semibold text-texto">
              <td className="px-2 py-2" colSpan={2}>
                {rotuloTotal}
              </td>
              <Numero valor={totais.desqualificou} forte />
              <Numero valor={totais.perdeu} forte />
              <Numero valor={totais.nutricao} forte />
              <td className="px-2 py-2 text-right tabular-nums">{totais.leads_distintos}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* < md: cards */}
      <ul className="space-y-2 md:hidden">
        {linhas.map((u, i) => (
          <li key={chave(u, i)} className="card-interactive rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={cn("truncate font-medium", ehSemDono(u) ? "text-texto-sec" : "text-texto")}>{u.nome}</p>
                <div className="mt-1">
                  <BadgePapel papel={u.papel} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold tabular-nums text-texto">{u.leads_distintos}</p>
                <p className="text-[11px] text-texto-sec">leads distintos</p>
              </div>
            </div>
            <p className="mt-2 text-xs tabular-nums text-texto-sec">
              Desqualificou <span className="text-texto">{u.desqualificou}</span> · Perdeu{" "}
              <span className="text-texto">{u.perdeu}</span> · Nutrição <span className="text-texto">{u.nutricao}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Numero({ valor, forte = false }: { valor: number; forte?: boolean }) {
  return (
    <td className={cn("px-2 py-2 text-right tabular-nums", valor === 0 && !forte ? "text-texto-sec/50" : "text-texto")}>
      {valor}
    </td>
  );
}
