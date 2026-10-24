# Pacote de handoff: refatoração incremental

Este conjunto descreve investigação e execução futura sobre o workspace WIP no checkpoint `a140ea6`. É documentação advisory: não altera produto, arquitetura vigente ou código, e não é autorização para implementar toda proposta sem gates.

## Leitura obrigatória

1. [Diagnóstico](01-diagnostico.md): comportamento observado e evidências. Separar código existente de intenção dos docs/plans.
2. [Arquitetura-alvo](02-arquitetura-alvo.md): ownership e invariantes; decisões condicionadas a medição estão marcadas.
3. [Plano de execução](03-plano-de-execucao.md): IDs, owners exclusivos, DAG, precondições, procedimentos, testes e rollback.
4. [Decisões pendentes](04-decisoes-pendentes.md): perguntas que bloqueiam produto, protocolo ou aceites.
5. UX/HUD: consulte [handoff visual](05-ux-hud.md), sob responsabilidade do designer; este pacote técnico não especifica layout nem substitui a decisão visual.

## Destinatários e advisory owners

Owners abaixo são papéis sugeridos, não atribuições nominais. Cada tarefa do plano exige um owner de escrita por arquivo e revisão independente. Papéis sugeridos: **instrumentação server**, **instrumentação client**, **estado/HUD client**, **protocolo server**, **protocolo client**, **tema/FSD**, **designer UX**, **orquestrador/revisor de integração**. Não conceder a lanes concorrentes o mesmo arquivo; contratos em `apps/shared/contracts/**` exigem integrador único.

## Como usar com agentes paralelos

- Comece pelo DAG e gates em `03-plano-de-execucao.md`; um lane não inicia enquanto suas pré-condições estiverem pendentes.
- Em cada entrega cite ID, arquivos realmente alterados, comandos/testes e métricas antes/depois; alterações fora do ownership requerem acordo do orquestrador.
- A baseline F0 separa instrumentação client e server em paths não sobrepostos. F1 separa TeamPanel de GameHud. F2 separa runtime server, cliente e contrato com owner explícito. F4 não paraleliza theme/guarda e UI que toca nos mesmos componentes.
- IDs atuais: `R0.1-S`/`R0.1-C` baseline; `R1.1` selector TeamPanel, `R1.2` integração que substitui TeamStrip, `R1.3` SkillBar serial; `R2.1` prova server, `R2.2` contrato, `R2.3-C` client e `R2.3-S` server resync; `R3.1` otimização condicionada; `R4.1` guarda/theme, `R4.2` UI; `R5.1` captura, `R5.2` XP/level, `R5.3` stamina/account tier (auditoria primeiro, implementação apenas após gates).
- Faça re-check do HEAD e das linhas das fontes antes de implementar: os números de linha referem-se ao checkpoint inspecionado e podem mudar.

## Vocabulário de evidência

- **Observado:** confirmado em código/documentação atual, citado com path e linhas.
- **Planejado:** recomendação do pacote; não existe até implementação aceita.
- **Hipótese:** alegação que precisa de experimento, perfil ou decisão. Não converter em fato.

`plans/` serve de contexto histórico/intencional e não substitui código ou regras atuais; não editar `plans/` neste trabalho. Captura, level-up e stamina aparecem como roadmap futuro bloqueado por decisões de produto, não como feature de escopo aprovado.

## Uso operacional

Toda execução que subir apps deve primeiro consultar portas e reutilizar processos existentes. Usar `bun`, nunca npm/yarn/pnpm. Para arquivos TS/TSX alterados: `bun run format`, `bun run lint:fix`, `bun run lint`; para alteração do cliente também `bun run --filter @creatures/client typecheck`. Validar UI com `agent-browser`; chrome-devtools apenas fallback se a skill indisponível/falhar. O orquestrador decide os comandos efetivos e valida referências/escopo deste pacote.

Sem commit como parte do handoff.
