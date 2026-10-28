"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { buscarAlunos, type Simular } from "@/lib/educacional/apiEducacional";
import type { AlunoLinha } from "@/lib/educacional/contrato";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { CHAVES } from "./dados";
import { hrefDoRaioX, ROTA_ALUNOS } from "./estado";
import { BadgeCheckpoint, Faixa, mensagemDoErro, NomeResponsavel } from "./partes";

// ---------------------------------------------------------------------------
// "Precisam de atenção" (Fase 3, 3.2): os 10 primeiros pela ordem `atencao`
// do backend (faixa efetiva — risco, atenção, saudável —, depois dias sem
// atividade decrescente, nulos no fim). A tela só mostra; a ordem vem pronta.
// Fica sob CHAVES.alunos: qualquer gravação de aluno também atualiza a lista.
// ---------------------------------------------------------------------------

const QUANTOS = 10;

export function PrecisamDeAtencao({ simular }: { simular: Simular }) {
  const filtros = { ordem: "atencao" as const, por_pagina: QUANTOS };
  const lista = useQuery({
    queryKey: [...CHAVES.alunos, filtros, simular],
    queryFn: () => buscarAlunos(filtros, simular),
    retry: false,
  });
  const comSimular = (rota: string) => (simular ? `${rota}?simular=${simular}` : rota);
  const voltar = comSimular("/educacional");

  return (
    <Card>
      <CardHeader
        title="Precisam de atenção"
        subtitle="Primeiro a faixa de saúde, depois quem está há mais tempo sem atividade"
        action={
          <Link
            href={comSimular(ROTA_ALUNOS)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-azul-claro hover:bg-white/10"
          >
            Ver todos os alunos
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      />
      <CardContent>
        {lista.isLoading ? (
          // Mesma altura das 10 linhas: nada abaixo se desloca ao carregar.
          <div className="space-y-1" aria-busy="true" aria-label="Carregando os alunos que precisam de atenção">
            {Array.from({ length: QUANTOS }, (_, i) => (
              <Skeleton key={i} className="h-11 rounded-lg" />
            ))}
          </div>
        ) : lista.isError ? (
          <ErrorState
            titulo="Não foi possível carregar os alunos"
            descricao={mensagemDoErro(lista.error)}
            onRetry={() => lista.refetch()}
            retryLabel="Tentar de novo"
          />
        ) : !lista.data?.itens.length ? (
          <EmptyState titulo="Nenhum aluno na jornada" descricao="Quando houver alunos ativos, os que pedem atenção aparecem aqui." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs text-texto-sec">
                  <th className="px-2 py-2 font-medium">Aluno</th>
                  <th className="px-2 py-2 font-medium">Faixa</th>
                  <th className="px-2 py-2 font-medium">Sem atividade</th>
                  <th className="px-2 py-2 font-medium">Próximo checkpoint</th>
                  <th className="px-2 py-2 font-medium">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {lista.data.itens.map((a) => (
                  <Linha key={a.id} a={a} href={hrefDoRaioX(a.id, voltar)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Linha({ a, href }: { a: AlunoLinha; href: string }) {
  const dias = a.dias_sem_atividade.valor;
  return (
    <tr className="h-11 border-b border-borda/40 last:border-b-0">
      <td className="px-2 py-1.5">
        <Link href={href} className="font-semibold text-texto hover:text-azul-claro hover:underline">
          {a.nome}
        </Link>
        <span className="block text-xs text-texto-sec">{a.programa?.nome ?? a.mentoria}</span>
      </td>
      <td className="px-2 py-1.5">
        <Faixa faixa={a.faixa_saude.valor} />
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-texto">
        {dias == null ? <span className="text-texto-sec/70">—</span> : `${dias} ${dias === 1 ? "dia" : "dias"}`}
      </td>
      <td className="px-2 py-1.5">
        {a.proximo_checkpoint ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <BadgeCheckpoint status={a.proximo_checkpoint.status} />
            <span className="text-xs text-texto-sec">{a.proximo_checkpoint.nome}</span>
          </span>
        ) : (
          <span className="text-texto-sec/70">—</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        <NomeResponsavel responsavel={a.responsavel} />
      </td>
    </tr>
  );
}
