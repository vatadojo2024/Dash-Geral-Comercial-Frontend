"use client";

import { Database, RefreshCw } from "lucide-react";
import { OportunidadesError } from "@/lib/data/dataClient";
import { tagsEventoNoIntervalo } from "@/lib/sdr/ciclo";
import { traduzirAvisos } from "@/lib/sdr/oportunidades";
import { dataHora } from "@/lib/formatters/date";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Peças COMPARTILHADAS pelas abas que consultam os endpoints de evento
// (/api/eventos/oportunidades, /nao-abordados, /retencao): mesmo protocolo de
// erro, mesmo rodapé (gerado_em, cache, tags consultadas), mesma faixa de
// avisos e o controle segmentado usado nos filtros.
// ---------------------------------------------------------------------------

// Controle segmentado de duas ou mais opções (Ciclo | Intervalo, Lista | Por SDR).
export function Alternador<T extends string>({
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  rotulo: string;
  valor: T;
  onChange: (v: T) => void;
  opcoes: { valor: T; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1"
    >
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            "nav-link rounded-lg border px-3 py-1 text-xs font-medium transition-all",
            valor === o.valor ? "border-azul/50 bg-azul/15 text-texto" : "border-transparent text-texto",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CarregandoEventos({ rotulo }: { rotulo: string }) {
  return (
    <div className="space-y-4" aria-label={`Carregando ${rotulo}`} aria-busy>
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

// Erro dos endpoints de evento: a mensagem/ação sai do CÓDIGO do backend
// (OportunidadesError.codigo), nunca do texto.
export function ErroEventos({
  error,
  onRetry,
  rotulo,
}: {
  error: unknown;
  onRetry: () => void;
  // Nome do dado, para a mensagem genérica ("as oportunidades", "a retenção").
  rotulo: string;
}) {
  const e = error instanceof OportunidadesError ? error : null;
  const codigo = e?.codigo ?? "desconhecido";

  if (codigo === "clint_auth" || codigo === "clint_indisponivel") {
    return (
      <Card>
        <ErrorState
          titulo="Integração com a Clint indisponível. Avise o time técnico."
          descricao={
            codigo === "clint_auth"
              ? "A Clint recusou as credenciais da integração (token ausente ou inválido)."
              : "A Clint não respondeu (limite de requisições, instabilidade ou timeout)."
          }
          onRetry={codigo === "clint_indisponivel" ? onRetry : undefined}
          retryLabel="Tentar de novo"
        />
      </Card>
    );
  }
  if (codigo === "agendamentos_indisponivel") {
    return (
      <Card>
        <ErrorState
          titulo="Base de agendamentos indisponível"
          descricao="Sem o conjunto de quem agendou, a lista de pendentes não pode ser calculada."
          onRetry={onRetry}
          retryLabel="Tentar de novo"
        />
      </Card>
    );
  }
  if (codigo === "supabase_indisponivel") {
    return (
      <Card>
        <ErrorState
          titulo="Base de dados indisponível"
          descricao="O backend não conseguiu consultar o Supabase. Tente de novo em instantes."
          onRetry={onRetry}
          retryLabel="Tentar de novo"
        />
      </Card>
    );
  }
  if (codigo === "leads_indisponivel") {
    return (
      <Card>
        <ErrorState
          titulo="Base de leads indisponível"
          descricao="O cruzamento com os leads do Mapa de Calor falhou no backend. Tente de novo em instantes."
          onRetry={onRetry}
          retryLabel="Tentar de novo"
        />
      </Card>
    );
  }
  if (codigo === "intervalo_muito_grande") {
    return (
      <Card>
        <ErrorState
          titulo="Período muito amplo. Reduza o intervalo."
          descricao="A consulta à Clint ultrapassou o limite de páginas. Escolha um intervalo menor."
        />
      </Card>
    );
  }
  if (codigo === "parametros_invalidos") {
    return (
      <Card>
        <ErrorState titulo="Datas inválidas" descricao={e?.message ?? "Confira as datas do período."} />
      </Card>
    );
  }
  return (
    <Card>
      <ErrorState
        titulo={`Não foi possível carregar ${rotulo}`}
        descricao={error instanceof Error ? error.message : "Tente novamente."}
        onRetry={onRetry}
      />
    </Card>
  );
}

// Faixa discreta com os avisos de sanidade do backend (traduzidos em
// lib/sdr/oportunidades — a chave crua nunca vai para a tela).
export function FaixaAvisos({ avisos }: { avisos: readonly string[] | null | undefined }) {
  const textos = traduzirAvisos(avisos);
  if (textos.length === 0) return null;
  return (
    <div
      role="note"
      aria-label="Avisos sobre os números deste período"
      className="ds-card px-6 py-4 text-xs opacity-80"
    >
      <p className="font-medium text-texto">Atenção aos números deste período</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {textos.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export function RodapeEventos({
  data,
  atualizando,
  onAtualizar,
}: {
  data: { de: string; ate: string; eventos: string[]; gerado_em: string; cache?: "hit" | "miss" | null };
  atualizando: boolean;
  onAtualizar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-texto-sec">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Atualizado em{" "}
          <time dateTime={data.gerado_em} className="text-texto">
            {dataHora(data.gerado_em)}
          </time>
        </span>
        {data.cache === "hit" && (
          <span className="inline-flex items-center gap-1 text-texto-sec/70" title="Resposta servida do cache do backend">
            <Database className="h-3 w-3" aria-hidden />
            Dado em cache — pode ter até 5 min.
          </span>
        )}
        <span className="text-texto-sec/70">
          Tags consultadas:{" "}
          {data.eventos.length > 0
            ? data.eventos.join(", ")
            : tagsEventoNoIntervalo(data.de, data.ate).join(", ") || "nenhuma"}
        </span>
      </p>
      <Button variant="outline" size="sm" onClick={onAtualizar} loading={atualizando}>
        {!atualizando && <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
        Atualizar
      </Button>
    </div>
  );
}
