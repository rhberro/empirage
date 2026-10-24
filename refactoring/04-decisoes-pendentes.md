# Decisões abertas, gates e riscos

As decisões do usuário já fechadas não reaparecem como perguntas: base WIP `a140ea6`; TeamPanel substitui visualmente TeamStrip e é a prova técnica de isolamento de rerender; performance thresholds só após baseline reproduzível; roadmap capture/level/stamina deve ser documentado como futuro, regras em aberto; nenhuma edição de código/`plans/` nesta redação. UI visual detalhada pertence ao designer em `05-ux-hud.md`.

## Perguntas realmente abertas

| ID | Pergunta | Bloqueia | Evidência/ação para decidir |
|---|---|---|---|
| D1 | Qual frequência, burst, bytes e latência observados de player snapshot? Qual request count PostgREST real por load, e qual impacto de collection size? | Qualquer R3.1 | R0.1-S/R0.1-C perfis correlacionados; distinguir chamadas de repository vs HTTP requests. Código `apps/server/src/ws/stateBroadcaster.ts:42-60`, `apps/server/src/state/playerState.ts:106-143,174-185`. |
| D2 | Que limiares de p95/p99, FPS, render commits, DB e payload caracterizam regressão/materialidade? | Fechar baseline como objetivo e aprovar R3.1 | Registrar dados F0 primeiro; dono de produto/engenharia aprova alvo e variância aceitável. Não escolher número de memória. |
| D3 | É `huntRev` contígua por conexão/receptor, inclusive snapshot, delta, end, close e reconexão? | Exigir rev+1 e mecanismo de gap | R2.1 testa publishers/callback/serialização; `advance.ts:61-69`, `huntStore.ts:153-167`. Não assumir por increment monotônico apenas. |
| D4 | Qual contrato de recuperação de hunt após gap e como obter snapshot de sessão sem reentrar/mutar gameplay? | R2.2/2.3 | Decidir após D3; definir session identity, auth/audience, old/new messages e version negotiation. |
| D5 | Como rollout suporta mistura de versões client/server e por quanto tempo? | Mudança de contrato/payload | Escolher deploy order e fallback full snapshot; incompatibilidade deve falhar claramente, nunca interpretar silenciosamente. |
| D6 | Qual scope de visibilidade futuro para world/hunt domains e dados de perfil? | Distribuição para espectador/multiplayer | Estado atual hunt é individual (`docs/game/HUNT.md:9-13`), cidade usa observador (`docs/technical/client/WORLD.md:282-295`). Revalidar authorization em novo escopo. |
| D7 | Quando produto requer operação em múltiplos processos/instâncias e qual consistência/sticky strategy? | Escala além do processo atual | Não construir infra por hipótese; `WORLD.md:327-338` descreve ausência de múltiplas instâncias. |
| D8 | Para capture, quais chance/fórmula, consumo dispositivo, destino da criatura (slot/storage) e ordenação em relação a loot? | Roadmap capture | `docs/game/CREATURES.md:132-138,188-197`; `docs/game/TRAINER.md:84-92`. Conferir WIP/código/testes antes de chamar qualquer regra ausente/inexistente. |
| D9 | Level/XP: qual fórmula definitiva, thresholds, timing de level-up, atributos, notificação e comportamento no catch-up offline? | Roadmap progressão | Documentos têm provisões/pendências (`CREATURES.md:29-49,188-197`, `HUNT.md:102-106,129-136`); procurar implementação e testes no WIP antes de alegar ausência. |
| D10 | Stamina: regra de recuperação e plano de contas/schema, fonte do tipo de conta, timestamps e transições durante hunt? | Roadmap stamina | Consultar `docs/game/TRAINER.md:17-57`; distinguir regra documentada de cálculo realmente implementado. Migração/rollback necessário se schema mudar. |

## UX/HUD: gates, não decisão técnica pendente

Decidido: TeamPanel substitui TeamStrip visualmente; manter TeamStrip legado até paridade aprovada. Ainda precisa gate do designer, não nova decisão sobre se substitui. Consultar [handoff visual](05-ux-hud.md):

- formato visual por slots, estados e dados apresentados em city/hunt, feedback de seleção/cooldown, hierarquia e convivência com skillbar;
- teclado/foco/semântica acessível, touch target, contraste, responsividade, estados empty/loading/error e comportamento em reconnect;
- avaliação visual de integração e screenshots com `agent-browser`.

O [handoff visual existente](05-ux-hud.md) é de responsabilidade do designer e não é alterado por este pacote. SkillBar incompleta segue fluxo independente, não requisito implícito da substituição TeamPanel.

## Riscos

- Aceitar hunt delta com gap pode mostrar campos antigos; rejeitar por `+1` antes de provar contiguidade pode criar falsos gaps. Recuperação requer mecanismo e snapshot íntegro.
- Coalescer snapshots pode perder estado/ACK se não respeitar serialização de mutações, revisão, conexão atual e mudanças distintas de inventário/compra.
- Usar snapshot/cache de um trainer para outra sessão pode vazar dado pessoal; authorization tem que ser testada em todas as rotas/publishers.
- Evento replay/duplicado pode gerar animação repetida; não pode creditar duas vezes persistent side effect.
- UI atual é WIP: comentários de componentes não provam funcionalidade, fontes de city/hunt ou UX acordada.
- `plans/` e docs técnicos podem ser históricos ou aspiracionais. Checar código/testes do HEAD; não reportar ausência de capture/level sem pesquisa explícita por handler, simulação, endpoint e teste.
- Telemetria em staging pode conter dados de jogador; fixtures e métricas precisam ser anonimizadas e sem credentials/tokens.

## ADRs sugeridos (somente quando aprovados)

1. Semântica de revisão, identidade de sessão e recovery por domínio.
2. Otimização player snapshot, justificada por baseline e com compatibilidade/rollback.
3. Regras gameplay de capture, progressão/level-up e stamina + schema.
4. Escopo de audiência e operação multi-instância, quando houver requisito de produto.
