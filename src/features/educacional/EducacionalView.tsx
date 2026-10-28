"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Plus, RefreshCw } from "lucide-react";
import { buscarResumo } from "@/lib/educacional/apiEducacional";
import { dataHoraBr } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { Cockpit } from "./Cockpit";
import { CHAVES } from "./dados";
import { destinoDeLinkAntigo, lerSimular } from "./estado";
import { NovaIntervencao } from "./NovaIntervencao";
import { EtiquetaDemonstracao, useRedirecionarSeSemPermissao } from "./partes";
import { PrecisamDeAtencao } from "./PrecisamDeAtencao";

// ---------------------------------------------------------------------------
// Módulo Educacional — "Saúde da Jornada" (/educacional): Cockpit e "Precisam
// de atenção" (Fase 3, 3.2). A lista completa fica na aba Alunos. Toda leitura
// passa pelo adapter educacional; nada desta tela chama rota comercial.
// ---------------------------------------------------------------------------

export function EducacionalView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const simular = lerSimular(searchParams);
  // Link salvo da Fase 2, com os filtros da tabela: leva à aba Alunos.
  const linkAntigo = destinoDeLinkAntigo(searchParams);
  useEffect(() => {
    if (linkAntigo) router.replace(linkAntigo);
  }, [linkAntigo, router]);
  const [modalAberto, setModalAberto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const resumo = useQuery({
    queryKey: [...CHAVES.resumo, simular],
    queryFn: () => buscarResumo(simular),
    retry: false,
  });
  const semPermissao = useRedirecionarSeSemPermissao([resumo.error]);

  // 403 no módulo: não mostra nada enquanto vai para a home permitida.
  if (semPermissao || linkAntigo) return null;

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-azul-claro">Educacional · Cockpit</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-jakarta text-2xl font-semibold tracking-tight text-texto">Saúde da Jornada</h1>
            <EtiquetaDemonstracao />
          </div>
          <p className="mt-1 text-sm opacity-80">Visão macro da turma + operação de acompanhamento</p>
          {/* A linha existe desde o início (vazia enquanto carrega): nada abaixo se desloca. */}
          <p className="mt-1 text-xs text-texto-sec">
            {resumo.data ? `Atualizado em ${dataHoraBr(resumo.data.atualizado_em)}` : "\u00a0"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={resumo.isFetching}
            onClick={() => queryClient.invalidateQueries({ queryKey: CHAVES.tudo })}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setModalAberto(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Nova intervenção
          </Button>
        </div>
      </header>

      <div className="space-y-6">
        {aviso && (
          <p className="flex items-center gap-2 rounded-xl border border-sucesso-forte/30 bg-sucesso-forte/10 px-4 py-2.5 text-sm text-texto" role="status">
            <CircleCheck className="h-4 w-4 text-sucesso" aria-hidden />
            {aviso}
            <button type="button" onClick={() => setAviso(null)} className="ml-auto text-xs text-texto-sec hover:text-texto">
              Fechar
            </button>
          </p>
        )}
        <Cockpit
          resumo={resumo.data}
          carregando={resumo.isLoading}
          erro={resumo.error}
          onTentarDeNovo={() => resumo.refetch()}
          simular={simular}
        />
        <PrecisamDeAtencao simular={simular} />
      </div>

      <NovaIntervencao
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onCriada={(aluno) => {
          setAviso(`Intervenção registrada para ${aluno.nome}. Ela aparece no raio-X do aluno.`);
          void queryClient.invalidateQueries({ queryKey: CHAVES.resumo });
        }}
      />
    </>
  );
}
