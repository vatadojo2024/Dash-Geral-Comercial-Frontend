# Programas e roteiros de checkpoint — Requisitos (frontend)

Pedido do Vata em 28/10/2026. O checkpoint deixa de ser uma lista única e passa a pertencer a um **programa** (mentoria + duração). Cada checkpoint do programa tem um **roteiro de contato**.

## Programas da demonstração

| Programa | Checkpoints |
| --- | --- |
| Blackbelt 6 meses | Dia 0 (Boas-vindas), Dia 3 (Sprint), Mês 1 (Revisão), Mês 3 (Big Win), Mês 5 (Reta Final), Mês 6 (Fim) |
| Blackbelt 12 meses | Dia 0 (Boas-vindas), Dia 3 (Onboarding), Mês 1 (Revisão), Mês 4 (Big Win), Mês 6 (Metade), Mês 12 (Fim) |
| Prime 6 meses | Dia 0 (Welcome), Dia 3 (Check-in), Mês 1 (Revisão), Mês 3 (Big Win), Mês 5 (Pré-fim), Mês 6 (Fim) |
| Prime 12 meses | Dia 0 (Welcome), Dia 3 (Check-in), Mês 1 (Avaliação), Mês 6 (Metade), Mês 9 (Big Win), Mês 12 (Decisão) |
| Private 6 meses | Dia 0 (Welcome), Dia 3 (Check-in), Mês 1 (Revisão), Mês 3 (Big Win), Mês 5 (Pré-fim), Mês 6 (Fim) |
| Private 12 meses | Dia 0 (Welcome), Dia 3 (Check-in), Mês 1 (Avaliação), Mês 6 (Metade), Mês 9 (Big Win), Mês 12 (Decisão) |

Observação do programa Blackbelt: "Em que momento solicitar indicação? Idealmente após o primeiro UAU."

## R1. Cadastro e edição do aluno
- "Programa" é lista obrigatória com os programas ativos, no lugar do texto livre de mentoria.
- A data de término é sugerida (início + duração do programa) e continua editável. Se a pessoa já mexeu no término, a sugestão não sobrescreve.
- A mentoria continua aparecendo como hoje (vem do programa).

## R2. Raio-X
- Mostra o programa e, quando houver, a observação do programa.
- Cada checkpoint da timeline abre o roteiro do contato: objetivo, perguntas-chave, sinais de upsell/renovação e estratégia de monetização.
- O roteiro do próximo checkpoint já vem aberto.

## R3. Trocar programa
- Ação própria, fora do "Salvar" em lote.
- Escolhe o programa novo e a data de início: padrão = data de entrada; opção "começa hoje" para novo ciclo.
- Mostra a prévia do backend: o que fica, o que sai e o que é criado.
- Só grava ao confirmar, com motivo (mínimo de 5 caracteres, como o ajuste manual).

## R4. Configurações
- Nova aba **Programas**: criar, editar e inativar; campos nome, mentoria, duração em meses e observação.
- A aba **Checkpoints padrão** ganha um seletor de programa no topo, o campo "Dia N ou Mês N" e os 4 campos do roteiro, como textos longos.

## R5. Aba Alunos e lista
- Filtro por programa.

## R6. Modo demonstração
- As 6 listas acima. Roteiros com textos curtos de exemplo; os textos reais vêm do backend.

## Fora do escopo
- Regra de quais checkpoints ficam, saem ou são criados na troca: é do backend (a tela só mostra a prévia).
- Cálculo das datas dos checkpoints ("Mês N" no calendário): backend (no mock, imitado).
