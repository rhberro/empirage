# Plano de execução agent-ready

Plano futuro para checkout equivalente a `a140ea6`. Antes de cada fase, reconferir HEAD, caminhos e instruções. **Não** começar com otimização de payload, redesign, migração de banco ou regras de jogo. Owners abaixo são roles; o orquestrador atribui uma pessoa/agente por caminho.

## DAG e exclusividade

| ID | Único dono (paths de escrita) | Depende de | Pode paralelizar com | Gate |
|---|---|---|---|---|
| R0.1-S instrumentação server | **Um owner server** para os arquivos existentes `apps/server/src/ws/stateBroadcaster.ts`, `apps/server/src/state/playerState.ts`, `apps/server/src/hunt/runtime/advance.ts`, `apps/server/src/hunt/runtime/scheduler.ts` e testes pontuais `apps/server/src/__tests__/support.ts` (arquivo, não diretório); relatório sob `refactoring/` não faz parte da implementação | Nenhuma | R0.1-C, pois paths não se cruzam | F0 dataset server completo e instrumentação removida antes de R3.1 |
| R0.1-C instrumentação client/browser | **Um owner client** para harness temporário novo sob `apps/client/scripts/refactoring-baseline/` e/ou teste diagnóstico isolado em `apps/client/src/pages/play/model/__tests__/`; reservar nomes exatos antes de escrever. Artefatos anonimizados fora do source em pasta temporária aprovada, não no código | Nenhuma | R0.1-S, em paths sem interseção | F0 dataset client completo e harness removido |
| R1.1 TeamPanel source/selectors/tests | Owner TeamPanel: `apps/client/src/features/team-panel/**` | F0 baseline | R1.2 em discovery/testes separados, não escrita de seus arquivos | Model tests rerender |
| R1.2 GameHud integration | Owner HUD: `apps/client/src/pages/play/ui/GameHud.tsx` somente | R1.1 interface/API acordada; designer `05-ux-hud.md` para UI acceptance | R1.1 apenas em arquivos TeamPanel distintos | integration behavior + UX gate |
| R1.3 SkillBar | Owner de composição em `GameHud.tsx`; owner visual em `apps/client/src/widgets/game-hud/**`, serializados por arquivo | R1.2 e interface de dados/UX acordada | R2.1 em paths server, sem tocar HUD | matriz de fontes por fase, integração e aceite UX próprios |
| R2.1 server huntRev proof | Owner server: `apps/server/src/hunt/runtime/**`, `apps/server/src/__tests__/**` paths de hunt | F0 | R2.2 apenas preparar casos/fixtures, sem compartilhar contrato | contiguidade documentada/testada |
| R2.2 contract integration | Integrator único `apps/shared/contracts/game.ts`, `huntSim.ts` e contract tests compartilhados | R2.1 antes de exigir gap semantics | Sem implementação client/server antes de congelar | contrato estável/compat plan |
| R2.3-C client gap/resync | Owner client: `apps/client/src/entities/hunt/model/huntStore.ts`, `apps/client/src/pages/play/model/gameHuntProtocol.ts` e os testes correspondentes nesses diretórios; sem contrato/server | R2.2 contrato congelado | R2.3-S em paths server exclusivos | suite client passa; depois gate conjunto |
| R2.3-S server snapshot/recovery | Owner server: `apps/server/src/hunt/runtime/**` e testes hunt server explicitamente nomeados; não editar contratos/client. Conferir R2.1/2.2 sem reabrir semântica | R2.2 contrato congelado | R2.3-C | suite server passa; depois gate conjunto client-server |
| R3.1 player snapshot opt (conditional) | Owner server: `apps/server/src/ws/stateBroadcaster.ts`, `apps/server/src/state/playerState.ts`, routes específicas acordadas. R0.1-S temporários já removidos. Contrato, se necessário, integrator separado. | F0 fechado, baseline salva e decisão/ADR | Não com R2 em broadcaster/contracts; instrumentação R0 encerrada | métricas antes/depois e rollout |
| R4.1 theme guard audit | Owner theme/script: `apps/client/src/shared/theme/**`, `apps/client/scripts/check-tokens.ts` | R1 behavior stable | Só discovery de UI; sem editar componentes sobrepostos | typecheck/guard |
| R4.2 UI/token fixes | Owner visual, único: componentes listados `TeamSlotName.tsx`, `CreatureDetail.tsx`, Toolbar/TeamPanel paths escolhidos | R4.1 + UX designer | Não paralelizar com R4.1 nesses mesmos components; nem dois owners por arquivo | accessibility + agent-browser |
| R5.1 capture gameplay | Owner server, depois shared contract single-writer, depois DB e client/UI em fases serializadas | Decisão produto + inspeção WIP/testes | Não paraleliza entre alterações compartilhadas | deterministic/offline tests + migration/rollback se schema |
| R5.2 XP/level-up | Owner server/simulation, shared contract integrator, DB migration owner, client presentation; fases após produto | Decisão produto + inspeção WIP/testes | Implementação server pode preparar testes apenas contra contrato congelado | deterministic replay/catch-up + data migration safety |
| R5.3 stamina/account tier | Owner DB/schema first, server derivation/runtime, shared contract integrator, client display; serial migration rollout | Decisão produto/schema + inspeção WIP/testes | No cross-layer parallel code before schema/contract decisions | offline/time boundary tests + migration/backfill/rollback |

Não há independência de escrita se ambos tocam arquivo comum; acordo de interface não transforma arquivo compartilhado em paralelizável. Contratos shared são single-writer e distribuídos aos outros lanes como dependência versionada.

## F0 — baseline reproduzível (pré-requisito)

### R0.1-S — Instrumentação do lado servidor

**Precondição:** o dono server reserva exatamente `apps/server/src/ws/stateBroadcaster.ts`, `apps/server/src/state/playerState.ts`, `apps/server/src/hunt/runtime/advance.ts`, `apps/server/src/hunt/runtime/scheduler.ts` e, se necessário, `apps/server/src/__tests__/support.ts` (arquivo único). Não existe `apps/server/src/__tests__/support/`. Sem owner concorrente. Instrumentação diagnóstica não deve logar token, payload pessoal ou credenciais. Não persistir dados identificáveis em fixture.

**Passos:** envolver call sites de `pushState` com counters/timestamps por motivo; medir fila enqueue→load→send, bytes serializados e falhas. Instrumentar fronteira das chamadas PostgREST/repos em `loadPlayerState`, contar funções e requests reais separadamente, latência e payloads; registrar transições/cadência por tipo WS e hunt runtime publish. Medir com cardinalidade/fakes e ambiente controlado; manter lógica de gameplay inalterada.

**Lifecycle:** counters/traces in-process e alterações temporárias nos paths acima são removidos ao fechar F0, antes de R3.1; não deixar logging permanente. Harness/metrics podem durar somente se dados justificarem instrumentação operacional e houver aprovação separada de privacidade/custo/ownership.

**Aceite/artefato:** script/roteiro, versão e environment, tabela por cenário e tipo de mensagem, request count comprovado (não estimado pelo número de funções), bytes raw e duração p50/p95, método de coleta, erro/limitação. Revelar rajadas e não presumir 1 push/s. Testes garantem instrumentação não muda ordem/resultado. Marcar hash de fonte instrumentada e hash de build para correlação.

### R0.1-C — Instrumentação cliente

**Precondição:** browser/harness identificados; owner client reserva `apps/client/scripts/refactoring-baseline/` (harness temporário, sem reutilizar script de produto) e, apenas se teste automatizado necessário, um spec novo e isolado em `apps/client/src/pages/play/model/__tests__/`. Não tocar paths de instrumentação server. Captura não introduz subscribers adicionais permanentes nem muda frame loop.

**Passos:** registro WebSocket frames por type/bytes; React Profiler em GameHud, TeamPanel, TeamStrip/slots e SkillBar; FPS Pixi e long frames com janela/duração fixas; correlacionar transição/evento de mensagem a commits React e frame timing. Anotar versão do build e desligar DevTools quando medir FPS final para controlar overhead, mantendo uma rodada profiler explícita.

**Ambiente obrigatório:** hardware (CPU/GPU/RAM), OS, resolução/scale, versão do browser e Bun, build mode, tipo de rede/latência, servidor/localidade, número de atores, warm/cold cache, janela e repetição; mesmo browser e máquina para antes/depois. Cenários fixos: city idle; caminhada contínua/replanejamento; hunt combate com atores/eventos; swap; capture e level **somente se fluxo real suportar**; reconnect após desconexão e resync. Para capture/level atualmente não comprovados, reportar bloqueado/não executável, não simular como real.

**Lifecycle:** remover harness/probes de source ao encerrar baseline. Guardar somente dados anonimizados/roteiro fora do source em local aprovado; tornar instrumentação durável exige evidência de valor e aprovação posterior.

**Aceite/artefato:** captura protocol/network export sem secrets; commits React por componente, taxa/fps e p50/p95 ou método definido, roteiro reexecutável e limites. Não definir threshold arbitrário antes de baseline.

**Gate F0:** juntar os dois artefatos, confirmar mesma build/roteiro e revisar observabilidade em conjunto. Medição server/client pode rodar em paralelo nos paths independentes; os perfis comparáveis precisam mesma sessão e cenário. Se resultado não reproduzível, consertar harness primeiro, não otimizar.

## F1 — HUD e seletor de TeamPanel

### R1.1 — TeamPanel com fontes city/hunt e isolamento por slot

**Owner:** `apps/client/src/features/team-panel/**`; não edita `GameHud.tsx` nem legado `widgets/game-hud/TeamStrip`.

**Dependências:** baseline F0 e contrato de seleção de dados acordado com R1.2. **Passos:** mapear shape `PlayerState.team` versus `HuntSnapshot.team`; criar seletor por fase que usa player state na cidade e hunt snapshot durante hunt; preservar slot order/id e estados de vazio/fainted conforme dados existentes; selecionar apenas campos usados; usar structural sharing estável para valor imutável por slot; separar função de seleção da view e testes do hook/store. Não adicionar timer nem converter estado para prop global se store já é caminho inferior.

**Testes/assertions exemplificativas:** montar probe por slot em ambiente controlado, registrar contagem basal depois de mount/settle e comparar **renders adicionais**, não contagem absoluta. React StrictMode pode montar/renderizar deliberadamente mais de uma vez. (a) initial city state: slots igual ao `PlayerState.team`; (b) ausência de hunt snapshot em city não esvazia slot; (c) hunt snapshot troca fonte para team live; (d) delta atualiza somente slot afetado; (e) change de ledger/wave/event ou coordenada não altera selector result/props dos slots não afetados; (f) slot vazio permanece vazio; (g) active swap mantém identidade/order conforme resposta do servidor. Assertion central: depois do baseline, editar slot 2 gera commit/render adicional no slot 2 e nenhum render adicional atribuível a essa atualização nos demais slots, salvo campo selecionado realmente alterado. Comparar resultado de selector/reference e render trace, não confiar apenas em `renderCount` bruto.

**Aceite:** testes unitários de selectors + React render-count test; sem rerender por tick/eventos de campo não selecionado; nenhuma regra de ação transferida ao client.

### R1.2 — Compor TeamPanel no HUD, substituindo TeamStrip

**Decisão já tomada:** TeamPanel é o **substituto visual do TeamStrip**, não um segundo painel paralelo nem nova semântica de time. Ele também é a prova técnica de seletor city/hunt e isolamento de rerender. O designer define UX/layout no [handoff visual](05-ux-hud.md); owner visual não presume desenho.

**Owner:** `apps/client/src/pages/play/ui/GameHud.tsx` exclusivamente. **Depende de:** API/props definida em R1.1 e gate UX designer. **Passos:** ligar props/handlers existentes e estados em `GameHud`, montar TeamPanel no ponto apropriado conforme design aprovado, remover TeamStrip da composição ativa só depois de paridade. Não remover/deletar TeamStrip legado até funcionalidade, ações, teclado, acesso e dados estarem equivalentes e aceite explícito; então depreciação/remoção pode ser tarefa posterior com inventário de consumidores e owner.

**Aceite:** city/hunt apresenta mesmos propósitos funcionais do TeamStrip: slots e estado live, seleção/troca e cooldown conforme contratos reais; teclado/alvo acessível e superfícies vazias/erro/loading definidos pelo UX; screenshots e fluxo pelo `agent-browser`. Teste de integração garante apenas uma representação visual ativa e nenhuma dupla interação.

### R1.3 — SkillBar (trilho separado)

SkillBar está incompleta/comentada em `apps/client/src/pages/play/ui/GameHud.tsx`; **não** é parte de substituição TeamStrip/TeamPanel. R1.3 é etapa posterior serializada após R1.2, porque `GameHud.tsx` tem owner único. **Owner de composição:** `GameHud.tsx`; **owner de componentes visuais:** `apps/client/src/widgets/game-hud/**` com um owner serializado por arquivo e interface acordada antes de edição; não editar widget enquanto o designer ainda define a UX nem criar segundo owner no `GameHud.tsx`.

**Passos:** inventariar props atuais do `SkillBar` e formatos `PlayerState`/`HuntSnapshot`; mapear por campo, sem assumir que todo campo hunt tem equivalente city: vitals, equipped abilities, device/consumables, stamina e cooldowns. Em city, usar player projection/configurada; em hunt, usar valores live da hunt snapshot/deltas quando presentes; se uma fonte não fornece campo, aplicar fallback documentado e UX aprovado ou manter indisponível, sem fabricar regra/gameplay. Estabelecer interface de props entre GameHud e widget antes de paralelizar. Conectar handlers já suportados pelo servidor; não ativar `use_ability`/`use_consumable` se atualmente recusados. Não mexer no TeamPanel/TeamStrip.

**Aceite e artefatos:** matriz de campo × fase × fonte × fallback, teste selector para atualizações irrelevantes e relevante, integração city/hunt e estados de loading/empty/error quando aplicável; acessibilidade/interação e validação com `agent-browser` após designer gate. Nenhuma seleção de campo pode gerar gameplay local ou ação não suportada.

## F2 — Gap, revisão e resync

### R2.1 — Prova de ordenação/contiguidade server hunt

**Owner único:** runtime hunt server + testes de server. **Precondição:** F0. Inspecionar publishers (delta, snapshot, ended), serial queue por trainer, callbacks e conexão/account delivery; criar testes que simulem advances consecutivos, deltas vazios, fim, erro no publish e reconexão. Documentar precisamente quais números o cliente pode observar e se revisão é contígua por conexão ou pode saltar legitimamente.

**Aceite/artefato:** matriz de casos + teste que prova ordem ou demonstra contraexemplo; não editar client/contrato. Se contiguidade não existe, propor token/epoch/snapshot protocol sem ativá-lo.

### R2.2 — Contrato e interação de recuperação

**Owner único do contrato:** `apps/shared/contracts/game.ts`, `huntSim.ts` e contract tests; acorda integração e versioning com owners server/client. **Depende de R2.1.** Definir evento de gap/resync por hunt e semântica session/epoch se necessário, compatibilidade/mixed versions, como obter snapshot sem reentrar ou duplicar side effects. Não reaproveitar `worldRev` ou player epoch.

**Aceite:** contrato validado por schemas/parsers e fixtures; versão antiga rejeitada ou compatível com caminho seguro explicitado; threat review de audiência/authorization. Depois, R2.3 client e tarefa server publisher/resync podem ser paralelas em paths distintos contra contrato congelado.

### R2.3-C — Cliente: aplicação e solicitação de resync

**Owner client:** `apps/client/src/entities/hunt/model/huntStore.ts`, `apps/client/src/pages/play/model/gameHuntProtocol.ts` e specs client correspondentes. **Depende exclusivamente do contrato R2.2 congelado.** Rejeitar duplicatas/antigas; em lacuna, impedir merge parcial como se atual e invocar interface de resync definida. Snapshot resync precisa identificar sessão e sincronizar store/clock sem efeito persistente.

**Aceite client:** testes unitários para snapshot bootstrap, delta contíguo, duplicata, antiga, gap, snapshot de reparo, ended e sessão nova; events visuais não reaplicam estado persistente. Não mudar contrato nem server files.

### R2.3-S — Server: emissão/recuperação de snapshot

**Owner server:** paths runtime hunt `apps/server/src/hunt/runtime/**` e tests server hunt previamente listados; não altera contrato/client. **Depende exclusivamente do mesmo contrato R2.2 congelado.** Implementar endpoint/mensagem/resposta de snapshot no ponto do ownership do runtime, validar account/trainer/session authorization, serializar com advances e entregar estado completo sem duplicar side effects. Caso R2.1 determine que já existe mecanismo suficiente, documentar não alteração ao invés de introduzir outro.

**Aceite server:** teste authorization/isolation, snapshot atomicamente consistente com a revisão, concorrência snapshot-vs-advance, reconnect e falha de entrega; nenhum efeito persistente acontece por recuperar snapshot.

**Gate conjunto R2.3:** integração client-server testa bootstrap → deltas → gap → recovery, mensagens fora de ordem após snapshot, nova session, hunt_ended e follow-up player snapshot; replay/catch-up reproduz o mesmo estado final. R2.3-C e R2.3-S podem implementar em paralelo somente depois de R2.2 congelado, em paths não sobrepostos; integração e merge aguardam ambas.

## F3 — Player state snapshot: somente se custo demonstrado

### R3.1 — Otimização condicionada

**Pré-requisitos cumulativos:** F0 identifica custo material e reproducível; explicar por que não basta reduzir fanout/evitar duplicata; decisão de arquitetura em ADR; modelo de consistência e rollout aprovados. Se chamadas/bytes são aceitáveis, fechar como “não alterar”, guardar baseline e evitar nova infra.

**Owner:** Server `stateBroadcaster.ts`, loader e rotas que o chamam; contrato shared pertence ao integrator separado; client sync owner separado. Enumerar paths exatos na issue para excluir concorrência. Passos: formular menor mudança (ex. dedupe segura de push pending somente se snapshot/reflete todas as mutações em ordem; ou fatia/delta com resync completo); provar autorização, ownership, ordering e transições; escrever teste de rajada, compra/itens distintos, chamada REST, conexão substituída, erro load e epoch restart; comparar perfis F0 equivalentes.

**Aceite:** taxa/bytes/requests/latência melhoram contra limite aprovado; comportamento e determinismo iguais, sem loss, sem cross-account, sem coalescer comandos side-effect. Migration/cache exige plano e fallback. Caso coalesça push, uma revisão mais nova precisa representar todas mutações anteriores confirmadas e a resposta de command waiter não pode ficar sem estado.

## F4 — FSD/design system e UX validation

### R4.1 — Auditoria do token guard

**Owner:** scripts + `shared/theme/**`; sem editar componentes da UI. Ler implementação atual `apps/client/scripts/check-tokens.ts`; comparar AST scope com regra `docs/technical/client/DESIGN_SYSTEM.md`. Emitir inventário falso negativo/positivo e proposta mínima. Não ampliar escala/palette nem reescrever provider.

### R4.2 — Correções de componentes e validação visual

**Owner único por arquivo** para `TeamSlotName.tsx`, `CreatureDetail.tsx`, Toolbar e TeamPanel; não paralelizar se há paths sobrepostos. Depende de R4.1 e UX designer; FSD move só se regra de ownership justificar. Corrigir somente inconsistências confirmadas (fontSize com text variant, primitive palette, Box decorativo) e conferir documentação/componentes oficiais; respeitar CSS local adequado. Navegação visual/interações via `agent-browser`; chrome-devtools fallback se skill falhar. Keyboard, focus, touch targets, cor não exclusiva, loading/empty/error/populated/limit conforme regras aplicáveis.

**Aceite:** `bun run --filter @creatures/client typecheck` passa guarda; testes do componente; evidência visual aprovada e acessibilidade; não alegar melhoria perf sem repetir F0. Formatação TSX, lint e porta conforme instruções raiz.

## F5 — Roadmap gameplay posterior e bloqueado

### R5.1 — Captura: auditoria e eventual extensão, não pressupor ausência

**Gate antes do escopo:** pesquisar implementação e testes no HEAD para chance/device consumption, corpse timing, team/storage insertion, event wire, persistence side effects, replay e offline catch-up. A inspeção inicial do WIP já encontra captura em `apps/server/src/hunt/sim/deaths.ts` (roll e distribuição), `apps/server/src/hunt/runtime/effects.ts` e `persistence.ts`; preservar o comportamento atual como baseline. Não chamar isso de “feature inexistente”. Se docs e código divergirem, obter decisão de produto sobre comportamento antes de alterar.

**Owners faseados:** (1) produto decide regras abertas; (2) server owner exclusivo em `apps/server/src/hunt/sim/deaths.ts`, runtime/effects e sim tests implementa regra aprovada; (3) shared-contract owner separado em `apps/shared/contracts/huntSim.ts`/`game.ts` atualiza eventos sem overlap; (4) DB owner em migrations e `apps/server/src/hunt/runtime/persistence.ts` só se regra aprovada exigir schema/semântica nova; (5) client owner em protocol/store/effects UI somente após contrato congelado; designer é dono do feedback UX.

**Aceite:** existente não regrede; fixtures determinísticas verificam seed/roll/ordem capture-versus-loot, destino de criatura e device quantity conforme decisão assinada; replay/offline catch-up reproduz mesmo resultado sem side effect duplicado. Migração só se necessária: expand/backfill/contract, idempotência e rollback testado. Nenhuma fórmula ou consumo é decidido por este plano.

### R5.2 — Experiência e level-up: auditoria e evolução gated

**Gate:** conferir WIP/tests e comportamento atual antes de descrever gap. Há lógica de experiência/level-up no WIP em `apps/server/src/hunt/sim/deaths.ts` (`experience` e função que recalcula nível/evento `level_up`); validar faixas, chamadas, atributos, persistência e contrato atuais. Decisões documentais pendentes ou provisórias não autorizam reescrever regra que já está no código sem decisão de produto.

**Owners faseados:** (1) produto aprova fórmula/thresholds e semântica de catch-up; (2) server simulation owner em `apps/server/src/hunt/sim/**` e tests de simulação; (3) shared-contract integrator em `apps/shared/contracts/huntSim.ts`/player contract se evento/snapshot mudar; (4) DB owner (`apps/server/src/hunt/runtime/persistence.ts`, schema/migrations) apenas se dados atuais não suportarem regra; (5) client owner em parser/store/HUD após contrato; designer define feedback. Paths não podem ser editados em paralelo por owners diferentes.

**Aceite:** golden tests por seed de XP, distribuição, level transitions e eventos; replay e catch-up offline produzem estado idêntico; persistence atualizada uma vez e snapshot/reconnect reproduzem a projeção; migração/backfill/rollback quando aplicável. Preservar regra corrente fora da mudança aprovada.

### R5.3 — Stamina e tipo de conta: audit-first, alteração gated

**Gate:** WIP observado tem `stamina_minutes`, leitura agregada `playerState.ts` e validação de início de hunt; não concluir que nada existe. Auditar recuperação fora da hunt, timestamps, duração offline, origem account-tier e testes. A proposta só é implementada depois de produto resolver fórmula/ownership e arquitetura de dados.

**Owners faseados:** (1) produto define regras e exceções; (2) DB/schema owner decide campo/tabela account e migration/backfill; (3) server owner em `apps/server/src/state/playerState.ts`, `apps/server/src/hunt/clock.ts`, `rules.ts` e runtime após schema congelado deriva/valida; (4) contracts owner em player/hunt contracts separado; (5) client owner em selectors/HUD mostra timestamps/valores conforme contrato aprovado. DB → server/contract → client; evitar rollout client antes de compat server.

**Aceite:** testes de limites temporais (início/fim, online/offline, reconnect, zona de horário, conta tier expirada) e catch-up determinístico; mesma stamina final por replay; server authorization e concorrência preservadas. Migration inclui backfill coerente, rollout compatível, métricas e rollback com tratamento para dados já atualizados. Não inventar taxa, cap ou duração.

Esses R5 são tarefas de auditoria/planejamento até gate de produto; se código e testes já satisfazem o objetivo, registrar paridade e não reimplementar. Consultar `docs/game/CREATURES.md:29-49,132-138,188-197`, `docs/game/HUNT.md:102-136`, `docs/game/TRAINER.md:17-57,131-158` e `plans/CAPTURE_AND_LEVELING.md` como documentação de produto/intenção que deve ser conciliada, não como prova da implementação nem contrato autoritativo.

## Validação, rollout, mixed version e rollback

- Tarefas TS/TSX: na ordem exata `bun run format` → `bun run lint:fix` → `bun run lint`. Em toda alteração cliente, `bun run --filter @creatures/client typecheck`. Testar mínimo suficiente (`bun test apps/client`/`bun test apps/server` ou spec alvo) e integração para protocolo/persistência.
- Antes de subir apps: consultar disponibilidade das portas e reutilizar serviço existente, não iniciar instância em outra porta. UI usa `agent-browser`; chrome-devtools apenas fallback.
- Tarefa de protocolo exige política mixed version: deployments rolling podem manter client old/server new ou inverso; definir negociação/version rejection, fallback snapshot seguro e janela de compat antes de deploy. Não alterar `PROTOCOL_VERSION` sem compatibility tests e plano rollback.
- Rollout faseado em ambiente de staging/percentual aprovado, acompanhar erros, desconexões, gaps/resync, bytes, DB, commits React e FPS. Interromper se estado divergir, autorização falhar, operação duplicar ou regressão superar threshold definido após baseline.
- Rollback deve permitir versão anterior consumir fluxo antigo/snapshot completo ou reverter server/client em ordem segura; migrations exigem expansão/backfill/contract separado e rollback testado. Reverter código não basta se schema/data irreversível.
- Fixtures anonymized de mensagens/comandos validam replay e mesmo estado final; comparar outputs determinísticos, sem reproduzir side effects reais de DB.
