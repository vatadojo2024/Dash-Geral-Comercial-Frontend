import { CAMPOS_AJUSTAVEIS, type CampoAjustavel, type MudancaMural } from "@/lib/educacional/contrato";
import {
  dataCurta,
  dataHoraBr,
  ROTULO_AUTORIZACAO,
  ROTULO_CAMPO_AJUSTAVEL,
  ROTULO_NIVEL,
  ROTULO_STATUS_ALUNO,
  ROTULO_STATUS_AULA,
  ROTULO_STATUS_CHECKPOINT,
  ROTULO_STATUS_INTERVENCAO,
} from "@/lib/educacional/rotulos";
import { formatarValor } from "./campos";

// ---------------------------------------------------------------------------
// Texto de uma alteração do histórico (o que mudou, antes → depois). Desde a
// Entrega 2 (M2) o histórico aparece no Mural do aluno (Mural.tsx), entre os
// comentários; aqui ficam só os rótulos e a formatação dos valores.
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
  etapa_desde: "Na etapa desde",
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
  email: "E-mail",
  telefone: "Número",
  discord: "Discord",
  acompanhamento_individual: "Acompanhamento individual",
  data_inicio_programa: "Início do programa",
  substituido: "Saiu da jornada (troca de programa)",
  // aulas (Entrega 2)
  total_aulas: "Total de aulas",
  data: "Data",
  hora: "Hora",
  mentor: "Mentor",
  mentor_id: "Mentor",
};

type Alteracao = { entidade: string; campo: string };

// "Mês 1 · status" → { prefixo: "Mês 1", campo: "status" }
function partes(item: Alteracao) {
  const i = item.campo.lastIndexOf(" · ");
  return i < 0 ? { prefixo: null, campo: item.campo } : { prefixo: item.campo.slice(0, i), campo: item.campo.slice(i + 3) };
}

export function rotuloDoCampo(item: Alteracao): string {
  const { prefixo, campo } = partes(item);
  const nome = item.entidade === "ajuste" ? (ROTULO_CAMPO_AJUSTAVEL[campo as CampoAjustavel] ?? campo) : (ROTULO_CAMPO[campo] ?? campo);
  return prefixo ? `${prefixo} · ${nome}` : nome;
}

// O backend manda o nome da coluna da planilha. Campo sem coluna vem cru ("Aula 3 ·
// programa_id"): aí vale o nosso nome.
export function rotuloDaMudanca(m: Pick<MudancaMural, "entidade" | "campo" | "rotulo">): string {
  const cru = m.rotulo === m.campo || m.rotulo.endsWith(` · ${m.campo}`);
  return cru ? rotuloDoCampo({ entidade: m.entidade, campo: m.rotulo }) : m.rotulo;
}

// Nomes que o backend manda como id: resolvidos pela config. O programa e o
// mentor sempre; etapa, tipo e responsável dentro do objeto de "criado"/"criada".
type Nome = (id: string) => string | undefined;
export type NomesDoHistorico = { programa?: Nome; responsavel?: Nome; etapa?: Nome; tipo?: Nome };
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_SUBSTITUIDO = "Substituído (troca de programa)";

export function formatarDoHistorico(item: Alteracao, valor: unknown, nomes: NomesDoHistorico = {}): string {
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
  const porId = { mentor_id: nomes.responsavel, responsavel_id: nomes.responsavel, etapa_id: nomes.etapa, tipo_id: nomes.tipo }[campo];
  if (porId && RE_UUID.test(valor)) return porId(valor) ?? "Registro não encontrado";
  if (valor === "substituido") return STATUS_SUBSTITUIDO;
  if (campo === "nivel_inicial") return ROTULO_NIVEL[valor as keyof typeof ROTULO_NIVEL] ?? valor;
  if (campo === "status_aluno") return ROTULO_STATUS_ALUNO[valor as keyof typeof ROTULO_STATUS_ALUNO] ?? valor;
  if (campo === "autorizacao_prova_social") return ROTULO_AUTORIZACAO[valor as keyof typeof ROTULO_AUTORIZACAO] ?? valor;
  if ((campo === "status" || campo === "substituido") && item.entidade === "checkpoint") {
    return ROTULO_STATUS_CHECKPOINT[valor as keyof typeof ROTULO_STATUS_CHECKPOINT] ?? valor;
  }
  if (campo === "status" && item.entidade === "aula") return ROTULO_STATUS_AULA[valor as keyof typeof ROTULO_STATUS_AULA] ?? valor;
  if (campo === "status" && item.entidade === "intervencao") {
    return ROTULO_STATUS_INTERVENCAO[valor as keyof typeof ROTULO_STATUS_INTERVENCAO] ?? valor;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(valor)) return dataHoraBr(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return dataCurta(valor);
  // Hora como o banco guarda ("08:30:00"): a tela mostra hora e minuto.
  if (/^\d{2}:\d{2}:\d{2}$/.test(valor)) return valor.slice(0, 5);
  // Nunca um id cru na tela.
  if (RE_UUID.test(valor)) return "Registro não encontrado";
  return valor;
}
