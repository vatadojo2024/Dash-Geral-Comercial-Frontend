"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { buscarHistorico, TAMANHO_PAGINA_HISTORICO } from "@/lib/educacional/apiEducacional";
import {
  CAMPOS_AJUSTAVEIS,
  ENTIDADES_HISTORICO,
  type CampoAjustavel,
  type EntidadeHistorico,
  type ItemHistorico,
} from "@/lib/educacional/contrato";
import {
  dataCurta,
  dataHoraBr,
  ROTULO_AUTORIZACAO,
  ROTULO_CAMPO_AJUSTAVEL,
  ROTULO_ENTIDADE,
  ROTULO_NIVEL,
  ROTULO_STATUS_ALUNO,
  ROTULO_STATUS_CHECKPOINT,
  ROTULO_STATUS_INTERVENCAO,
} from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { formatarValor } from "./campos";
import { CHAVES, useConfig } from "./dados";
import { mensagemDoErro } from "./partes";

// ---------------------------------------------------------------------------
// Aba Histórico do Raio-X (spec Fase 2, 5.2): GET /alunos/:id/historico, mais
// recente primeiro, paginado, com filtro por tipo. Cada linha: quando, quem, o
// que mudou, antes → depois e o motivo (quando houver).
// ---------------------------------------------------------------------------

const ROTULO_CAMPO: Record<string, string> = {
  criado: "Cadastro",
  arquivado: "Arquivado",
  nome: "Nome",
  mentoria: "Mentoria",
  data_entrada: "Data de entrada",
  data_termino: "Data de término",
  objetivo: "Objetivo",
  nivel_inicial: "Nível inicial",
  status_aluno: "Status do aluno",
  etapa: "Etapa",
  responsavel: "Responsável",
  proxima_acao: "Próxima ação",
  proxima_acao_prazo: "Prazo da próxima ação",
  diagnostico: "Diagnóstico",
  motivo_risco: "Motivo do risco",
  autorizacao_prova_social: "Autorização de prova social",
  observacoes: "Observações",
  // checkpoint
  data_prevista: "Data prevista",
  data_realizada: "Data realizada",
  status: "Status",
  observacao: "Observação",
  big_win: "Big Win",
  // intervenção
  criada: "Criada",
  arquivada: "Arquivada",
  tipo: "Tipo",
  descricao: "Descrição",
  prazo: "Prazo",
  // nomes do backend (o valor já vem com o nome resolvido)
  etapa_id: "Etapa",
  responsavel_id: "Responsável",
  tipo_id: "Tipo",
  arquivado_em: "Arquivado em",
  concluida_em: "Concluída em",
  // programas
  programa: "Programa",
  programa_id: "Programa",
  data_inicio_programa: "Início do programa",
  substituido: "Saiu da jornada (troca de programa)",
};

// "Mês 1 · status" → { prefixo: "Mês 1", campo: "status" }
function partes(item: ItemHistorico) {
  const i = item.campo.lastIndexOf(" · ");
  return i < 0 ? { prefixo: null, campo: item.campo } : { prefixo: item.campo.slice(0, i), campo: item.campo.slice(i + 3) };
}

function rotuloDoCampo(item: ItemHistorico): string {
  const { prefixo, campo } = partes(item);
  const nome = item.entidade === "ajuste" ? (ROTULO_CAMPO_AJUSTAVEL[campo as CampoAjustavel] ?? campo) : (ROTULO_CAMPO[campo] ?? campo);
  return prefixo ? `${prefixo} · ${nome}` : nome;
}

// Nomes que o backend manda como id (hoje, o programa): resolvidos pela config.
export type NomesDoHistorico = { programa?: (id: string) => string | undefined };
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_SUBSTITUIDO = "Substituído (troca de programa)";

export function formatarDoHistorico(item: ItemHistorico, valor: unknown, nomes: NomesDoHistorico = {}): string {
  if (valor == null || valor === "") return "—";
  const { campo } = partes(item);
  if (item.entidade === "ajuste" && campo in CAMPOS_AJUSTAVEIS) return formatarValor(campo as CampoAjustavel, valor);
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  // Cadastro no backend ("criado"/"criada"): objeto com os campos iniciais.
  // Cada um é formatado como o campo de mesmo nome; vazios ficam de fora.
  if (typeof valor === "object" && !Array.isArray(valor)) {
    const textos = Object.entries(valor as Record<string, unknown>)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => formatarDoHistorico({ ...item, campo: k }, v, nomes));
    return textos.length ? textos.join(" · ") : "—";
  }
  if (typeof valor !== "string") return String(valor);
  if (campo === "programa_id" || campo === "programa") return nomes.programa?.(valor) ?? (RE_UUID.test(valor) ? "Programa não encontrado" : valor);
  if (valor === "substituido") return STATUS_SUBSTITUIDO;
  if (campo === "nivel_inicial") return ROTULO_NIVEL[valor as keyof typeof ROTULO_NIVEL] ?? valor;
  if (campo === "status_aluno") return ROTULO_STATUS_ALUNO[valor as keyof typeof ROTULO_STATUS_ALUNO] ?? valor;
  if (campo === "autorizacao_prova_social") return ROTULO_AUTORIZACAO[valor as keyof typeof ROTULO_AUTORIZACAO] ?? valor;
  if ((campo === "status" || campo === "substituido") && item.entidade === "checkpoint") {
    return ROTULO_STATUS_CHECKPOINT[valor as keyof typeof ROTULO_STATUS_CHECKPOINT] ?? valor;
  }
  if (campo === "status" && item.entidade === "intervencao") {
    return ROTULO_STATUS_INTERVENCAO[valor as keyof typeof ROTULO_STATUS_INTERVENCAO] ?? valor;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(valor)) return dataHoraBr(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return dataCurta(valor);
  // Nunca um id cru na tela.
  if (RE_UUID.test(valor)) return "Registro não encontrado";
  return valor;
}

export function HistoricoDoAluno({ alunoId }: { alunoId: string }) {
  const [entidade, setEntidade] = useState<EntidadeHistorico | null>(null);
  const [pagina, setPagina] = useState(1);
  const consulta = useQuery({
    queryKey: [...CHAVES.historico(alunoId), entidade, pagina],
    queryFn: () => buscarHistorico(alunoId, { pagina, entidade }),
    retry: false,
  });
  const config = useConfig();
  const nomes: NomesDoHistorico = { programa: (id) => config.data?.programas.find((p) => p.id === id)?.nome };
  const total = consulta.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA_HISTORICO));

  return (
    <Card>
      <CardHeader title="Histórico de alterações" subtitle="Tudo o que mudou neste aluno, mais recente primeiro." />
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
          {[null, ...ENTIDADES_HISTORICO].map((e) => (
            <button
              key={e ?? "todos"}
              type="button"
              aria-pressed={entidade === e}
              onClick={() => {
                setEntidade(e);
                setPagina(1);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                entidade === e ? "border-azul/60 bg-azul/15 text-texto" : "border-white/10 text-texto-sec hover:border-white/25 hover:text-texto",
              )}
            >
              {e ? ROTULO_ENTIDADE[e] : "Todos"}
            </button>
          ))}
        </div>

        {consulta.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : consulta.isError ? (
          <ErrorState
            titulo="Não foi possível carregar o histórico"
            descricao={mensagemDoErro(consulta.error)}
            onRetry={() => consulta.refetch()}
            retryLabel="Tentar de novo"
          />
        ) : !consulta.data || consulta.data.itens.length === 0 ? (
          <EmptyState titulo="Nada por aqui" descricao={entidade ? "Nenhuma alteração deste tipo." : "Nenhuma alteração registrada."} />
        ) : (
          <ol className="divide-y divide-white/10">
            {consulta.data.itens.map((h) => (
              <li key={h.id} className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <div className="text-xs text-texto-sec">
                  <p className="tabular-nums">{dataHoraBr(h.em)}</p>
                  <p>{h.usuario.nome}</p>
                </div>
                <div className="min-w-0 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="tag">{ROTULO_ENTIDADE[h.entidade]}</span>
                    <span className="font-medium text-texto">{rotuloDoCampo(h)}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 break-words text-texto-sec">
                    <span className="line-through decoration-white/30">{formatarDoHistorico(h, h.valor_antes, nomes)}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" aria-label="para" />
                    <span className="text-texto">{formatarDoHistorico(h, h.valor_depois, nomes)}</span>
                  </p>
                  {h.motivo && <p className="mt-1 text-xs italic text-texto-sec">“{h.motivo}”</p>}
                </div>
              </li>
            ))}
          </ol>
        )}

        {total > TAMANHO_PAGINA_HISTORICO && (
          <nav className="flex items-center justify-between text-xs text-texto-sec" aria-label="Paginação do histórico">
            <span>
              {total} alterações · página {pagina} de {paginas}
            </span>
            <span className="flex gap-1">
              <Button variant="ghost" size="sm" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} aria-label="Página anterior">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button variant="ghost" size="sm" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)} aria-label="Próxima página">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </span>
          </nav>
        )}
      </CardContent>
    </Card>
  );
}
