"use client";

import { useEffect, useId, useState } from "react";
import { criarAula, EducacionalError } from "@/lib/educacional/apiEducacional";
import type { AlunoDetalhe } from "@/lib/educacional/contrato";
import { Button } from "@/components/ui/Button";
import { CamposDaAula, camposDosValores, opcoesDeMentor, valoresIniciaisDaAula } from "./Aulas";
import { useConfig } from "./dados";
import { Dialogo, ErroDoEnvio } from "./Dialogo";
import { EscolherAluno, type AlunoEscolhido } from "./EscolherAluno";
import { useGravacao } from "./useGravacao";

// ---------------------------------------------------------------------------
// Nova aula fora da ficha (Calendário, Entrega 2): escolhe o aluno e grava na
// hora (POST /alunos/:id/aulas, com a versão do aluno; 409 tratado como nas
// outras gravações imediatas). Data (e hora, se veio da semana) preenchidas.
// ---------------------------------------------------------------------------

export function NovaAulaImediata({
  aberto,
  dia,
  hora,
  onFechar,
  onCriada,
}: {
  aberto: boolean;
  dia: string;
  hora?: string | null;
  onFechar: () => void;
  onCriada?: (aluno: AlunoDetalhe) => void;
}) {
  const id = useId();
  const gravar = useGravacao();
  const config = useConfig();
  const [busca, setBusca] = useState("");
  const [aluno, setAluno] = useState<AlunoEscolhido | null>(null);
  const [valores, setValores] = useState(() => valoresIniciaisDaAula(null, { data: dia }));
  const [erroAluno, setErroAluno] = useState<string | undefined>();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Abre limpo, com o dia (e a hora) clicados.
  useEffect(() => {
    if (!aberto) return;
    setBusca("");
    setAluno(null);
    setValores({ ...valoresIniciaisDaAula(null, { data: dia }), hora: hora ?? "" });
    setErroAluno(undefined);
    setErro(null);
  }, [aberto, dia, hora]);

  async function enviar() {
    setErroAluno(aluno ? undefined : "Escolha um aluno da lista.");
    const r = camposDosValores(valores);
    setErro("erro" in r ? r.erro : null);
    if (!aluno || "erro" in r) return;
    setEnviando(true);
    const g = await gravar({ alunoId: aluno.id, versao: aluno.versao, executar: (v) => criarAula(aluno.id, v, r.campos) });
    setEnviando(false);
    if (g.ok) {
      onCriada?.(g.aluno);
      onFechar();
    } else if (g.erro instanceof EducacionalError && g.erro.status === 400) {
      setErro(g.erro.corpo.mensagem ?? g.erro.message);
    } else onFechar();
  }

  return (
    <Dialogo
      aberto={aberto}
      titulo="Nova aula"
      subtitulo="Grava na hora, na ficha do aluno."
      onFechar={onFechar}
      onEnviar={enviar}
      rodape={
        <>
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando}>
            Registrar aula
          </Button>
        </>
      }
    >
      <EscolherAluno id={id} aberto={aberto} busca={busca} onBusca={setBusca} aluno={aluno} onAluno={setAluno} erro={erroAluno} />
      <CamposDaAula valores={valores} onMudar={setValores} mentores={opcoesDeMentor(config.data, null)} />
      <ErroDoEnvio texto={erro} />
    </Dialogo>
  );
}
