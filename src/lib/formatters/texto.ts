// ---------------------------------------------------------------------------
// Helpers de TEXTO de exibição.
//
// brParaQuebras: o briefing da IA (vindo do Clint) chega com <br/> e <br> no
// meio de texto estruturado (Resumo, Evidências…). Convertemos essas tags em
// quebras de linha REAIS (\n) e nada mais. O resultado é exibido como TEXTO
// puro — React escapa por padrão — com `whitespace-pre-wrap` para preservar as
// quebras. NÃO geramos HTML nem usamos dangerouslySetInnerHTML: qualquer outra
// tag que venha no conteúdo aparece escapada (literal), sem risco de injeção.
// ---------------------------------------------------------------------------

export function brParaQuebras(texto: string): string {
  // <br>, <br/>, <br /> e variações de caixa → uma quebra de linha.
  return texto.replace(/<br\s*\/?>/gi, "\n");
}
