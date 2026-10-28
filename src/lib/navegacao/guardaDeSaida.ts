// Guarda de saída: um módulo com trabalho não salvo (as alterações pendentes do
// Educacional) registra aqui quem pergunta antes de sair. Quem navega por
// código para fora (o seletor Comercial | Educacional da Topbar) passa por
// `navegarComGuarda`; sem guarda registrada, segue direto. Links comuns são
// tratados pelo próprio módulo (captura de clique).

// Devolve true quando segurou a navegação (e vai chamar `seguir` se a pessoa confirmar).
export type GuardaDeSaida = (destino: string, seguir: () => void) => boolean;

let guarda: GuardaDeSaida | null = null;

export function definirGuardaDeSaida(g: GuardaDeSaida | null) {
  guarda = g;
}

export function navegarComGuarda(destino: string, seguir: () => void) {
  if (!guarda || !guarda(destino, seguir)) seguir();
}
