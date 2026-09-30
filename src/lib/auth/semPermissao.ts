// ---------------------------------------------------------------------------
// 403 da API = "sem acesso a esta área", NÃO erro de sistema: a tela mostra um
// aviso de acesso, sem "tentar novamente". Reconhece os erros das portas de
// dados (DataError.code, OportunidadesError.status/codigo) e este aqui, usado
// pelos fetchers que lançam Error simples.
// ---------------------------------------------------------------------------

export const MENSAGEM_SEM_PERMISSAO = "Sem permissão";

export class SemPermissaoError extends Error {
  readonly semPermissao = true;
  constructor(message = MENSAGEM_SEM_PERMISSAO) {
    super(message);
  }
}

export function ehSemPermissao(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const x = e as { semPermissao?: unknown; code?: unknown; codigo?: unknown; status?: unknown };
  return x.semPermissao === true || x.code === "sem_permissao" || x.codigo === "sem_permissao" || x.status === 403;
}
