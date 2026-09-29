import { z } from "zod";
import { formatarPct, pct } from "./oportunidades";

// ---------------------------------------------------------------------------
// Recorte "Descartes" de Oportunidades do Evento. Fonte:
// GET /api/sdr/descartes?de&ate[&tags] — dos INSCRITOS de cada evento, quantos
// leads cada pessoa da pré-venda tirou do funil, por via: desqualificou (etapa
// de desqualificação), perdeu (negócio marcado como perdido — creditado a quem
// marcou, não ao dono) e nutrição (card movido para o pipeline Nutrição).
// Só o pipeline "Pré Vendas". Métrica de time, sem escopo por papel.
//
// ATRIBUIÇÃO POR EVENTO: o descarte conta para o evento de origem do lead (a
// tag WG que ele carrega), não para o mês do descarte — e só se aconteceu do
// dia do evento em diante. `de/ate` escolhem os eventos (terças do intervalo),
// como nas outras rotas de evento (máx. 90 dias).
//
// Duas armadilhas:
//  1. As três colunas SE SOBREPÕEM. Total de LEADS = `leads_distintos`; a soma
//     das colunas, se aparecer, é "descartes" (eventos), nunca "leads".
//  2. O `por_usuario` do topo NÃO é a soma dos eventos: um lead em dois eventos
//     conta em cada bloco, mas uma vez só no consolidado.
// ---------------------------------------------------------------------------

const contagem = z.number().int().nonnegative();

export const PapelSchema = z.enum(["sdr", "closer", "admin"]);
export type Papel = z.infer<typeof PapelSchema>;

export const TotaisDescartesSchema = z
  .object({
    desqualificou: contagem,
    perdeu: contagem,
    nutricao: contagem,
    leads_distintos: contagem,
  })
  .passthrough();
export type TotaisDescartes = z.infer<typeof TotaisDescartesSchema>;

export const DescarteUsuarioSchema = z
  .object({
    // users.id do Mapa de Calor (null se o e-mail não casar).
    usuario_id: z.string().nullish(),
    // id na Clint — OUTRO id, não serve para cruzar com o nosso.
    usuario_clint_id: z.string().nullish(),
    nome: z.string(),
    email: z.string().nullish(),
    // Papel desconhecido vira null (não derruba a tela).
    papel: z
      .string()
      .nullish()
      .transform((v) => (PapelSchema.safeParse(v).success ? (v as Papel) : null)),
    desqualificou: contagem,
    perdeu: contagem,
    nutricao: contagem,
    leads_distintos: contagem,
  })
  .passthrough();
export type DescarteUsuario = z.infer<typeof DescarteUsuarioSchema>;

export const DescartesDoEventoSchema = z
  .object({
    evento_tag: z.string(),
    // Denominador da taxa de descarte do evento.
    inscritos: z.number().int().nonnegative().nullish(),
    totais: TotaisDescartesSchema,
    // Ordenado pelo backend: leads_distintos desc, "Sem dono" por último.
    por_usuario: z.array(DescarteUsuarioSchema),
  })
  .passthrough();
export type DescartesDoEvento = z.infer<typeof DescartesDoEventoSchema>;

export const DescartesResponseSchema = z.object({
  de: z.string(),
  ate: z.string(),
  eventos: z.array(z.string()),
  // Consolidado do intervalo (lead em dois eventos conta uma vez).
  totais: TotaisDescartesSchema,
  // Ordem cronológica dos eventos.
  por_evento: z.array(DescartesDoEventoSchema),
  por_usuario: z.array(DescarteUsuarioSchema),
  // Auditoria: etapas e pipelines consultados.
  fontes: z
    .object({
      etapas_desqualificacao: z.array(z.string()).nullish(),
      origin_id_pre_venda: z.string().nullish(),
      origin_id_nutricao: z.string().nullish(),
    })
    .passthrough()
    .nullish(),
  avisos: z.array(z.string()).nullish(),
  gerado_em: z.string(),
  cache: z.enum(["hit", "miss"]).nullish(),
});
export type DescartesResponse = z.infer<typeof DescartesResponseSchema>;

// Soma das três colunas = número de DESCARTES (eventos), não de leads.
export function totalDeDescartes(v: Pick<TotaisDescartes, "desqualificou" | "perdeu" | "nutricao">): number {
  return v.desqualificou + v.perdeu + v.nutricao;
}

// Quantos descartes caíram em mais de uma via (sobreposição): eventos − leads.
export function sobreposicao(v: TotaisDescartes): number {
  return Math.max(0, totalDeDescartes(v) - v.leads_distintos);
}

// Taxa de descarte do evento: leads distintos / inscritos. null sem inscritos.
export function taxaDeDescarte(leads: number, inscritos: number | null | undefined): number | null {
  return inscritos && inscritos > 0 ? pct(leads, inscritos) : null;
}

export function rotuloDaTaxa(taxa: number | null): string {
  return taxa == null ? "—" : formatarPct(taxa);
}

export const PAPEL_LABEL: Record<Papel, string> = { sdr: "SDR", closer: "Closer", admin: "Admin" };

// "Sem dono" = linha sem usuário no Mapa e com o nome que o backend põe.
export function ehSemDono(u: Pick<DescarteUsuario, "usuario_id" | "nome">): boolean {
  return !u.usuario_id && /^sem dono$/i.test(u.nome.trim());
}

// "WG - 22.09.26" → "22/09". Tag fora do padrão volta como veio.
export function dataDoEvento(tag: string): string {
  const m = /^WG\s*-\s*(\d{2})\.(\d{2})\.\d{2}$/.exec(tag.trim());
  return m ? `${m[1]}/${m[2]}` : tag;
}
