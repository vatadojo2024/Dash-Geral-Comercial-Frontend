import { ROTULO_FAIXA, ROTULO_STATUS_ALUNO } from "../rotulos";
import { montarAluno } from "./motor";
import { ErroDaApi, type Banco } from "./tipos";

// ---------------------------------------------------------------------------
// POST /alunos/exportar no modo demonstração (16/11/2026). Imita o contrato do
// backend (docs/educacional-exportar-csv.md): corpo estrito { ids }, de 1 a 2000;
// id inexistente é ignorado; repetido conta uma vez, na primeira posição. E o
// formato do arquivo: UTF-8 com BOM, ";" como separador, CRLF, aspas só quando
// precisa e apóstrofo na frente de valor que viraria fórmula no Excel. As
// colunas aqui são um resumo; as 44 da "Base de Alunos" vêm do backend.
// ---------------------------------------------------------------------------

export const LIMITE_IDS = 2000;

const validacao = (mensagem: string) => new ErroDaApi(400, { error: "validacao", campo: "ids", mensagem });

const dataBR = (d: string | null | undefined) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");

// Valor de uma célula: proteção contra fórmula e aspas quando o conteúdo exige.
export function celula(v: string | number | null | undefined): string {
  let t = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function exportarAlunos(banco: Banco, corpo: Record<string, unknown>, hoje: string) {
  const extras = Object.keys(corpo).filter((k) => k !== "ids");
  if (extras.length) throw new ErroDaApi(400, { error: "validacao", campo: extras[0], mensagem: "Campo não permitido." });
  const ids = corpo.ids;
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) throw validacao("Envie a lista de ids.");
  if (ids.length < 1) throw validacao("Envie ao menos um aluno.");
  if (ids.length > LIMITE_IDS) throw validacao(`Envie no máximo ${LIMITE_IDS} alunos.`);

  const linhas = [...new Set(ids as string[])].flatMap((id) => {
    const a = banco.alunos.find((x) => x.id === id);
    if (!a) return [];
    const d = montarAluno(banco, a, hoje);
    const faixa = d.faixa_saude.valor;
    return [
      [
        d.nome,
        d.email,
        d.telefone,
        d.mentoria,
        d.programa?.nome,
        ROTULO_STATUS_ALUNO[d.status_aluno],
        d.etapa.nome,
        d.responsavel?.nome,
        dataBR(d.data_entrada),
        dataBR(d.data_termino),
        faixa ? ROTULO_FAIXA[faixa] : "",
        d.health_score.valor,
        d.proximo_checkpoint?.nome,
        d.total_aulas,
        d.aulas_aplicadas,
        d.saldo_aulas,
        d.observacoes,
      ],
    ];
  });
  const cabecalho = [
    "Nome",
    "E-mail",
    "Telefone",
    "Mentoria",
    "Programa",
    "Status",
    "Etapa",
    "Responsável",
    "Data de Entrada",
    "Data de Término",
    "Faixa de Saúde",
    "Health Score",
    "Próximo Checkpoint",
    "Total de Aulas",
    "Aulas Aplicadas",
    "Saldo de Aulas",
    "Observações",
  ];
  const conteudo = "﻿" + [cabecalho, ...linhas].map((l) => l.map(celula).join(";") + "\r\n").join("");
  return { conteudo, nome: `alunos-educacional-${hoje}.csv`, alunos: linhas.length };
}
