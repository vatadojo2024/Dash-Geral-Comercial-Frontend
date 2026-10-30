"use client";

import { useId, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { buscarCalendario } from "@/lib/educacional/apiEducacional";
import { lerEstadoCalendario, periodoVisivel, queryDoCalendario, type EstadoCalendario } from "@/lib/educacional/calendario";
import { TIPOS_EVENTO_CALENDARIO, type EventoCalendario, type TipoEventoCalendario } from "@/lib/educacional/contrato";
import { hojeEmBrasilia, ROTULO_TIPO_EVENTO_PLURAL, ROTULO_TIPO_RESPONSAVEL } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";
import { ativos, CHAVES, useConfig } from "./dados";
import { CAMPO } from "./Dialogo";
import { hrefDoRaioX } from "./estado";
import { GradeDoCalendario, MenuDoDia, type PedidoDoDia } from "./GradeDoCalendario";
import { NovaAulaImediata } from "./NovaAulaImediata";
import { NovaIntervencao } from "./NovaIntervencao";
import { EtiquetaDemonstracao, mensagemDoErro, useRedirecionarSeSemPermissao } from "./partes";
import { programasPorMentoria } from "./programas";

// ---------------------------------------------------------------------------
// Calendário do Educacional (Entrega 2, M3) — /educacional/calendario.
// Checkpoints (SLA destacado), intervenções, próximas ações e aulas, de uma
// rota só (GET /calendario, com o período visível e os filtros). Filtros por
// responsável, programa e tipo; visão, dia e filtros ficam na URL, para o
// "Voltar" do Raio-X devolver o calendário como estava. Clicar num item abre o
// Raio-X; clicar num dia cria uma intervenção ou uma aula (gravam na hora).
// ---------------------------------------------------------------------------

type Criando = { tipo: "intervencao" | "aula"; dia: string; hora: string | null };

export function CalendarioView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const id = useId();
  const estado = lerEstadoCalendario(sp);
  const hoje = hojeEmBrasilia();
  const ancora = estado.dia ?? hoje;
  const { inicio, fim } = periodoVisivel(estado.visao, ancora);
  const config = useConfig();
  const [pedido, setPedido] = useState<PedidoDoDia | null>(null);
  const [criando, setCriando] = useState<Criando | null>(null);

  const consulta = useQuery({
    queryKey: [...CHAVES.calendario, inicio, fim, estado.responsavel, estado.programa, estado.tipo],
    queryFn: () =>
      buscarCalendario({ inicio, fim, responsavel_id: estado.responsavel, programa_id: estado.programa, tipo: estado.tipo }),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const atualizando = useIsFetching({ queryKey: CHAVES.calendario }) > 0;
  const semPermissao = useRedirecionarSeSemPermissao([consulta.error]);
  if (semPermissao) return null;

  const q = queryDoCalendario(estado);
  const aqui = `${pathname}${q ? `?${q}` : ""}`;
  const mudar = (parte: Partial<EstadoCalendario>) => {
    const nova = queryDoCalendario({ ...estado, ...parte });
    router.replace(`${pathname}${nova ? `?${nova}` : ""}`, { scroll: false });
  };
  const abrir = (e: EventoCalendario) => router.push(hrefDoRaioX(e.aluno.id, aqui));
  const gravou = () => void queryClient.invalidateQueries({ queryKey: CHAVES.calendario });
  const responsaveis = ativos(config.data?.responsaveis);
  const temFiltro = Boolean(estado.responsavel || estado.programa || estado.tipo);

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-azul-claro">Educacional · Calendário</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-jakarta text-2xl font-semibold tracking-tight text-texto">Calendário</h1>
            <EtiquetaDemonstracao />
          </div>
          <p className="mt-1 text-sm opacity-80">Checkpoints, intervenções, próximas ações e aulas dos alunos</p>
        </div>
        <Button variant="secondary" size="sm" loading={atualizando} onClick={() => void consulta.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Atualizar
        </Button>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3" role="group" aria-label="Filtros do calendário">
        <label htmlFor={`${id}-resp`} className="flex w-56 flex-col gap-1 text-xs font-medium text-texto-sec">
          Responsável
          <select id={`${id}-resp`} aria-label="Responsável" value={estado.responsavel ?? ""} onChange={(e) => mudar({ responsavel: e.target.value || null })} className={CAMPO}>
            <option value="">Todos</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome} · {ROTULO_TIPO_RESPONSAVEL[r.tipo]}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-prog`} className="flex w-56 flex-col gap-1 text-xs font-medium text-texto-sec">
          Programa
          <select id={`${id}-prog`} aria-label="Programa" value={estado.programa ?? ""} onChange={(e) => mudar({ programa: e.target.value || null })} className={CAMPO}>
            <option value="">Todos</option>
            {programasPorMentoria(config.data).map((g) => (
              <optgroup key={g.mentoria} label={g.mentoria}>
                {g.programas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-tipo`} className="flex w-48 flex-col gap-1 text-xs font-medium text-texto-sec">
          Tipo
          <select
            id={`${id}-tipo`}
            aria-label="Tipo"
            value={estado.tipo ?? ""}
            onChange={(e) => mudar({ tipo: (e.target.value || null) as TipoEventoCalendario | null })}
            className={CAMPO}
          >
            <option value="">Todos</option>
            {TIPOS_EVENTO_CALENDARIO.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_EVENTO_PLURAL[t]}
              </option>
            ))}
          </select>
        </label>
        {temFiltro && (
          <Button variant="ghost" size="sm" onClick={() => mudar({ responsavel: null, programa: null, tipo: null })}>
            Limpar filtros
          </Button>
        )}
      </div>

      {consulta.isError && !consulta.data ? (
        <Card>
          <ErrorState
            titulo="Não foi possível carregar o calendário"
            descricao={mensagemDoErro(consulta.error)}
            onRetry={() => consulta.refetch()}
            retryLabel="Tentar de novo"
          />
        </Card>
      ) : (
        <GradeDoCalendario
          itens={consulta.data ?? []}
          carregando={consulta.isLoading}
          visao={estado.visao}
          onVisao={(visao) => mudar({ visao })}
          ancora={ancora}
          onAncora={(dia) => mudar({ dia: dia === hoje ? null : dia })}
          hoje={hoje}
          onAbrir={abrir}
          onDia={setPedido}
        />
      )}

      {pedido && (
        <MenuDoDia
          pedido={pedido}
          onFechar={() => setPedido(null)}
          onEscolher={(tipo) => {
            setCriando({ tipo, dia: pedido.dia, hora: pedido.hora });
            setPedido(null);
          }}
        />
      )}
      <NovaIntervencao
        aberto={criando?.tipo === "intervencao"}
        prazoInicial={criando?.dia}
        onFechar={() => setCriando(null)}
        onCriada={gravou}
      />
      <NovaAulaImediata
        aberto={criando?.tipo === "aula"}
        dia={criando?.dia ?? hoje}
        hora={criando?.hora}
        onFechar={() => setCriando(null)}
        onCriada={gravou}
      />
    </>
  );
}
