import { AlertTriangle } from "lucide-react";

// Aviso discreto: linhas que vieram com um SDR que a dash não reconhece ficam
// fora dos números, mas não somem caladas. Mostra só a QUANTIDADE (o nome pode
// ser o antigo da Clint, que não aparece na tela).
export function AvisoSdrNaoIdentificado({ quantidade }: { quantidade: number }) {
  if (quantidade <= 0) return null;
  const uma = quantidade === 1;
  return (
    <p className="flex items-center gap-1.5 text-xs text-amarelo" role="note">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {quantidade} {uma ? "linha veio" : "linhas vieram"} com um SDR que a dash não reconhece e {uma ? "ficou" : "ficaram"} fora destes
      números.
    </p>
  );
}
