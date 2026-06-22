"use client";

import { Component, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Limite de erro de RENDERIZAÇÃO. Um valor inesperado num campo não pode
// derrubar a página inteira: envolvemos seções/campos do detalhe do lead para
// que, se a renderização de uma parte estourar, só AQUELA parte caia num
// fallback limpo — o resto do lead continua de pé. Mesma filosofia da
// tolerância item-a-item da lista, aqui aplicada à renderização.
//
// Erros de DADOS (parse/contrato) já são tratados no adapter/route; este é o
// cinto de segurança para o que escapar até a árvore React.
// ---------------------------------------------------------------------------

type Props = {
  children: ReactNode;
  // Fallback exibido no lugar do conteúdo que estourou. Default: um aviso enxuto.
  fallback?: ReactNode;
  // Rótulo curto p/ log — ajuda a localizar QUAL seção falhou.
  rotulo?: string;
};

type State = { erro: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: false };

  static getDerivedStateFromError(): State {
    return { erro: true };
  }

  componentDidCatch(erro: unknown) {
    console.error(
      `[ErrorBoundary]${this.props.rotulo ? ` ${this.props.rotulo}` : ""} falhou ao renderizar:`,
      erro,
    );
  }

  render() {
    if (this.state.erro) {
      return (
        this.props.fallback ?? (
          <span className="text-sm text-texto-sec">— indisponível</span>
        )
      );
    }
    return this.props.children;
  }
}
