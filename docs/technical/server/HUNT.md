# A Caçada

Este documento cobre a caçada no servidor: a simulação determinística, o runtime que mantém a caçada viva em memória, o conteúdo das áreas, a persistência, as rotas HTTP e o canal WebSocket. A caçada é jogável: o jogador entra por uma rota, recebe o estado pelo canal e o servidor avança a luta sozinho.

> Este documento cobre **o servidor**. As regras do ponto de vista do jogador estão em [Caçada](../../game/HUNT.md), e a cena do cliente, em [Mundo (cliente)](../client/WORLD.md#a-cena-da-caçada). O que ainda está em aberto do produto continua em [Pendências](../../game/HUNT.md#pendências).

## Índice

| Tópico | Descrição |
| --- | --- |
| [O que existe](#o-que-existe) | As peças da caçada jogável e o que continua fora de escopo. |
| [O conteúdo da área](#o-conteúdo-da-área) | O mapa commitado, os spawns e o catálogo que a simulação lê. |
| [A simulação](#a-simulação) | O estado serializável, o avanço determinístico e o RNG. |
| [Combate e IA](#combate-e-ia) | Dano, rotação, criatura do jogador, selvagens, ondas e consumíveis. |
| [Loot, XP e mortes](#loot-xp-e-mortes) | Drops, experiência, troca por desmaio e o fim sem criatura viável. |
| [O runtime](#o-runtime) | Manager, start, hydrate, advance, checkpoint e close. |
| [Sessão e schema](#sessão-e-schema) | A tabela `hunt_sessions`, o `simulation_state` e o soft-close. |
| [Rotas HTTP](#rotas-http) | `POST`, `GET` e `DELETE` de `/api/hunts`. |
| [WebSocket](#websocket) | `hunt_state`, `hunt_delta`, `hunt_ended` e os comandos. |
| [Fim da caçada](#fim-da-caçada) | Os motivos de fim e quem decide cada um. |
| [Pendências](#pendências) | O que ainda não existe ou é provisório. |
| [Arquivos e testes](#arquivos-e-testes) | Onde cada peça mora e o que a suíte cobre. |

## O que existe

| Peça | Onde |
| --- | --- |
| Motor puro da simulação | `apps/server/src/hunt/sim/` |
| RNG determinístico | `apps/server/src/hunt/rng.ts` |
| Conteúdo da área e do time | `apps/server/src/hunt/content.ts`, `contentMappers.ts`, `teamMappers.ts` |
| Leitura do catálogo no banco | `apps/server/src/db/huntContentRepository.ts` |
| Runtime da caçada | `apps/server/src/hunt/runtime/` |
| Repositório da sessão | `apps/server/src/hunt/session.ts` |
| Rotas HTTP | `apps/server/src/routes/hunts.ts` |
| Canal WebSocket | `apps/server/src/ws/gameSocket.ts`, `apps/server/src/ws/huntCommands.ts` |
| Schema | `supabase/migrations/20261021130000_hunt_sessions.sql`, `20261024120000_hunt_combat.sql`, `20261025120000_last_creature_guard.sql` e `20261027120000_hunt_ability_catalog.sql` |
| Contratos | `apps/shared/contracts/huntMap.ts`, `huntSim.ts` e `game.ts` |
| Mapas das áreas | `apps/shared/contracts/hunts/*.json` |

**O que continua fora de escopo.**

- Captura e dispositivos: o slot existe na barra, mas nenhuma tentativa de captura é resolvida.
- Party, PvP e interação entre caçadas. A colisão entre os atores da caçada existe; a colisão entre jogadores na cidade não faz parte deste domínio.
- Level-up: a experiência é acumulada, mas o nível não sobe.
- Recuperação de stamina e tipo de conta pago: a caçada lê sempre a conta gratuita.
- Múltiplos processos: o runtime vive na memória de um processo só.

> A base anterior da caçada (`clock.ts` e `closings.ts`) continua no repositório e coberta por testes, mas o caminho jogável usa `advanceUntil`, do motor em `hunt/sim/`. A seção [Sessão e schema](#sessão-e-schema) registra o que restou dessa camada.

## O conteúdo da área

Cada área tem um mapa commitado em `apps/shared/contracts/hunts/<slug>.json`, carregado por `huntMapBySlug`. Servidor e cliente leem os mesmos bytes; o mapa não viaja pelo socket. O gerador `apps/server/scripts/genHuntMaps.ts` escreve os JSONs de forma determinística. As quatro áreas atuais têm **96x64 sqm** e um loop de patrulha fechado que serpenteia pelo mapa. Cada área tem **clusters de spawn** — 4 na Campina (12 pontos), 5 no Lago (15), 5 no Bosque (20) e 6 nas Ruínas (24) —, cada cluster com 3–4 pontos adjacentes, a pelo menos 6 sqm de outro cluster e 10 sqm do início. As áreas têm obstáculos internos (montanha/muro, água e bosque) que formam corredores; o loop, o início e os clusters são escavados por cima, então nunca ficam bloqueados. Conectores de 1 tile ligam cada cluster ao loop.

O respawn atual é de 30 s na Campina Cinzenta, 35 s no Lago Congelado, 40 s no Bosque Urrante e 45 s nas Ruínas de Pedra.

O formato tem `name`, `width`, `height`, `spawn`, `tiles`, `loop` e `spawns`. Cada spawn define `species`, `x`, `y`, `level` e `respawnMs`. O loader achata as linhas de `tiles` e valida:

- `tiles.length === width × height`.
- O `spawn` da criatura ativa é andável.
- O `loop` não é vazio, todos os nós são andáveis e cada nó é adjacente ao seguinte, fechando o ciclo.
- Cada ponto de spawn é andável, tem espécie não vazia, nível inteiro maior ou igual a 1 e `respawnMs` entre 5 s e 1 h.

O catálogo da caçada vem do banco, não do JSON do mapa: `loadHuntAreaContent` lê a área, as espécies da área e as espécies do time, as habilidades de espécie, os drops e a tabela de efetividade. O resultado é o `SimContent` imutável que a simulação recebe. As listas são ordenadas nos mappers, e não pelo banco, para dois processos sortearem a mesma sequência.

`loadHuntTeam` lê o time na ordem de `team_slot`, as quatro habilidades equipadas de cada criatura, os slots de equipamento e a quantidade de cada item na mochila. Só entram como consumíveis os itens de cura dos slots 4 e 5; item sem `heal_percent` não é usado pela criatura. A criatura ativa é a primeira viva na ordem do time.

### O catálogo de habilidades

A migration `20261027120000_hunt_ability_catalog.sql` permite `target_type = 'area_self'` e `species_abilities.slot` entre 0 e 5. O seed grava **30 linhas** de `species_abilities` — 6 por espécie —, com duas habilidades de cada tipo:

| Tipo | Habilidades |
| --- | --- |
| `target` | Brasa, Garra |
| `area` | Ígnea, Espinho |
| `area_self` | Explosão, Vendaval |

A selvagem usa as 6. O jogador equipa 4 nos slots de `creature_ability_slots`, e a validação aceita qualquer habilidade da espécie, não só as dos quatro primeiros slots.

## A simulação

### O estado

`SimState` é o estado inteiro da caçada e é serializável em JSONB:

| Parte | O que guarda |
| --- | --- |
| `areaSlug`, `endsAt`, `simulatedAt` | A área, o fim da janela e o cursor da simulação. |
| `team` | As criaturas do jogador, vivas ou não, com vida, experiência, atributos, habilidades, consumíveis e cooldowns. |
| `activeCreatureId` | A criatura em campo. |
| `wilds` | As selvagens vivas, com posição, vida, alvo, cooldowns e estado de comportamento. |
| `spawns` | Cada ponto de spawn, com `respawnAt` e a selvagem que o ocupa. |
| `waves` | As ondas de área em voo, com um `arrivalAt` por tile. |
| `projectiles` | As habilidades de alvo em voo, com o dano congelado e o `impactAt`. |
| `trainer` | O treinador que segue o rastro, com posição, direção e trail; ele bloqueia o tile como os outros atores. |
| `ledger` | Abates, encontros, drops, experiência e consumíveis gastos. |
| `rng` | A semente e o contador de sorteios. |

O estado não guarda o conteúdo: ele referencia o `SimContent` carregado do banco. É isso que mantém o checkpoint pequeno.

### O avanço

`advanceUntil(state, until, content)` move a simulação até o instante pedido. Ele é determinístico e não lê o relógio da parede nem `Math.random`: o tempo vem por argumento e a aleatoriedade vem do estado.

O laço encontra o próximo instante interessante, salta para ele e aplica a transição. Os instantes considerados são:

- o fim de um passo de qualquer ator;
- o `nextDecisionAt` de uma selvagem;
- o `nextAbilityAt` e o `readyAt` das habilidades da criatura ativa;
- o `readyAt` dos consumíveis;
- o `arrivalAt` de cada tile de uma onda;
- o `respawnAt` de cada spawn;
- o fim da janela (`endsAt`) e o próprio `until`.

Em cada instante ele confirma passos, resolve ondas, resolve mortes, respawna, decide a criatura do jogador, decide as selvagens, move o treinador e usa consumíveis. Depois de uma decisão que pode matar alguém, as mortes são resolvidas de novo no mesmo instante, para o abate, o loot e a experiência serem creditados na hora exata.

Os fatos produzidos são `step`, `target_changed`, `ability_cast`, `damage`, `heal`, `death`, `spawn`, `loot`, `experience` e `consumable_used`. O runtime os traduz para o delta; a simulação nunca escreve no banco.

### Colisão e ocupação

`occupancy.ts` é a fonte da colisão entre atores. Um ator ocupa o **tile confirmado** e o **`segment.to`** do passo em curso; `isTileBlocked(state, tile, moverId)` recusa o tile ocupado por qualquer outro ator.

- A criatura ativa e as selvagens bloqueiam o tile; o treinador é decorativo e **não bloqueia** a passagem, para não prender a própria criatura no retorno ao loop. As criaturas no banco não estão em campo e não bloqueiam nada.
- `startStep`, `stepToward` e `nextStepToward` recebem o teste de ocupação. `findPath` aceita `isBlocked` e tira os tiles ocupados da busca, inclusive do alvo, então a perseguição desvia dos atores em vez de parar no primeiro tile bloqueado.
- O destino da perseguição é um tile livre próximo do alvo (`findFreeTileNear`), porque mirar no tile ocupado faria a busca falhar. Quando há mais de um tile livre, a escolha é a de **menor distância real** até quem está chegando (`preferFrom`), não a primeira na ordem fixa dos vizinhos: uma criatura vinda de baixo-esquerda ocupa a diagonal de baixo-esquerda em vez de dar a volta.
- O treinador nasce **três nós do loop atrás** do spawn da criatura ativa, nunca no mesmo tile. Se o loop for pequeno ou o spawn não estiver nele, o código escolhe outro nó para manter a distância.
- Na troca da criatura ativa e na entrada depois de um desmaio, o novo ator usa o tile de quem saiu; se ele estiver ocupado, `findFreeTileNear` procura um vizinho livre e andável.

Com alvo, a criatura ativa e a selvagem recebem `dir = directionBetween(...)` para o alvo. A selvagem também reaplica o olhar entre decisões (`faceTarget`), para o fim de um passo não a deixar virada para a direção da caminhada.

### O RNG

O gerador é counter-based: o valor de um sorteio é função da semente e do número do sorteio, nunca do sorteio anterior. O estado cabe em dois números (`seed` e `draws`), e o contador é o próprio cursor.

| Função | O que devolve |
| --- | --- |
| `createHuntSeed` | A semente de uma caçada nova. É o **único** sorteio não reproduzível, e acontece uma vez, no começo. |
| `drawUnit` | Um número entre zero e um. |
| `drawInt` | Um inteiro entre zero e o limite dado. |
| `drawWeighted` | Um elemento de uma lista ponderada, ou `null` quando a lista está vazia ou todo peso é zero. |

O stream é **um só** e tem ordem fixa: spawns na ordem dos pontos, selvagens na ordem estável do spawn, habilidades na ordem em que a espécie as declara. Qualquer sorteio novo entra no fim desse fluxo, nunca em um contexto paralelo.

## Combate e IA

### Dano e vida

A vida máxima é o atributo de vitalidade da criatura. O dano usa a fórmula de [Criaturas](../../game/CREATURES.md#dano):

```
levelFactor = 1 + (nível − 1) × 0.05
ataque = elemento da habilidade é neutro ? ataque físico : ataque mágico
defesa = elemento da habilidade é neutro ? defesa física : defesa mágica
ratio = ataque / (ataque + defesa)
dano = max(1, round(poder × levelFactor × DAMAGE_SCALE × ratio × efetividade))
```

`DAMAGE_SCALE = 0.25` é provisório. A efetividade vem de `type_effectiveness`; hoje só fogo contra planta é 1,5×. O ataque corpo a corpo implícito das selvagens usa `poder = ataque físico`, elemento neutro e efetividade 1.

### Alcance efetivo e tipos de área

`effectiveRange(ability)` é a distância que a habilidade consegue alcançar:

- `target` e `area` com alvo usam o `range` declarado;
- `area_self` não tem alvo de lançamento: o alcance é o `area_radius` do círculo ao redor do conjurador, com piso 1.

O cast de `area_self` não leva `targetTile` no evento. A onda é centrada no tile do conjurador, e `readVictims` garante que ela atinge só o lado oposto — o conjurador e os aliados não são vítimas. A área com alvo continua centrada no alvo.

### A rotação da criatura do jogador

Cada habilidade equipada tem o seu `readyAt`, um timestamp absoluto. Existe um intervalo global de 1000 ms entre usos (`nextAbilityAt`). Quando a criatura tem alvo e está no alcance de pelo menos uma habilidade, são elegíveis as habilidades com `readyAt <= agora` e alvo dentro do `effectiveRange` da habilidade; a escolha é a de menor `readyAt` (pronta há mais tempo) e, no empate, o slot mais à esquerda. Usar define `readyAt = agora + cooldown` e `nextAbilityAt = agora + 1000`.

A criatura do jogador **não tem ataque básico**: todo o dano sai das quatro habilidades equipadas.

### A criatura do jogador

- Sem alvo, segue o `loop` fechado da área, um sqm por passo (300 ms ortogonal, 424 ms diagonal).
- Adquire como alvo a selvagem mais próxima a até 7 sqm (Chebyshev), e mantém o alvo até ela morrer ou passar de 9 sqm.
- Com alvo, abandona o loop e persegue até entrar no `desiredRange` — o menor `effectiveRange` entre as habilidades equipadas. O destino da caminhada é um tile livre próximo do alvo, e `findPath` desvia dos atores ocupados.
- Sem alvo, volta ao nó mais próximo do loop por pathfinding.
- O treinador segue a criatura pelo rastro, três sqm atrás, e é decorativo: não luta, não interfere no combate e não bloqueia o tile; ele acompanha o rastro sem prender a criatura no retorno ao loop.

### As criaturas selvagens

- Todas nascem na entrada da caçada, uma por ponto de spawn, com o nível definido pela área e todos os potenciais em 50%.
- Adquirem a criatura do jogador como alvo a até 7 sqm e desistem ao passar de 9 sqm ou quando ela desmaia.
- Com alvo, perseguem até o menor `effectiveRange` entre as habilidades da espécie e usam o que estiver ao alcance. A caminhada usa um tile livre próximo do alvo, escolhido pela menor distância até a selvagem, e `findPath` desvia dos atores ocupados.
- O melee é implícito: um golpe a cada 2000 ms, quando adjacente. O piso é 1000 ms; o valor atual é 2000 ms.
- Usam as **6** habilidades da espécie, independentemente do nível, com `target`, `area` e `area_self`. Cada habilidade tem `wild_chance` e `wild_interval_ms`; a decisão roda a cada 1000 ms e cada habilidade rola a própria chance, com cooldown próprio.
- Sem alvo, vagam em passos curtos com pausas. Acima de 3 sqm do spawn, voltam para perto dele antes de continuar.
- Não fogem com vida baixa.
- Ao morrer, o ponto espera o `respawnMs` da área; se o ponto estiver ocupado, tenta de novo 1 s depois.

### Ondas e consumíveis

Uma habilidade de área vira uma onda no cast: a geometria é resolvida na hora e cada tile recebe um `arrivalAt`. O dano é aplicado quando a frente alcança o tile, cada criatura é atingida no máximo uma vez por cast, e a onda continua mesmo se o conjurador morrer. Linha e círculo usam `area_length`, `area_radius` e `area_step_ms`.

Uma habilidade de alvo com `travelMs > 0` vira um projétil: o dano é calculado no cast, congelado com o atacante e aplicado em `impactAt`. O evento `ability_cast` leva `travelMs` e `impactAt`; o cliente desenha o projétil e o número de dano na chegada. A morte do alvo no impacto é resolvida no mesmo instante. O ataque corpo a corpo continua instantâneo.

Cada slot de consumível tem `triggerHpPercent`: o uso acontece quando `hp / maxHp × 100` é menor ou igual ao gatilho. A cura é `round(maxHp × healPercent / 100)`, limitada à vida máxima, e consome 1 unidade da mochila. O relógio do consumível é separado do relógio das habilidades, e cada item tem o próprio `cooldown_ms`.

## Loot, XP e mortes

O ledger da simulação guarda `kills`, `encounters`, `drops`, `experience` e `spent`.

- **Loot:** cada item da espécie é sorteado separadamente com a chance do catálogo. Um sorteio por item, no abate. O evento `loot` leva item e quantidade; o runtime credita na mochila na hora.
- **Experiência:** `round(baseExperience × (1 + (nível − 1) × 0.1))`. A criatura ativa recebe 100% e as demais vivas do time recebem 10%. A experiência é acumulada no abate; não há level-up nesta fase.
- **Morte de selvagem:** a selvagem sai de `wilds`, o abate e o loot são resolvidos, o ponto recebe `respawnAt` e a experiência é distribuída.
- **Morte da criatura ativa:** ela vira `dead`, a próxima criatura viva do time entra no tile dela — ou em um vizinho livre, se houver outro ator ali — e a caçada termina no instante exato da morte quando não há mais nenhuma criatura viva.
- **Troca manual:** `swapActive` troca a criatura ativa na hora, mantém os cooldowns de cada criatura, usa o tile de quem saiu ou um vizinho livre e reinicia o rastro do treinador.

O HP e a experiência do time não são gravados a cada evento: o checkpoint e o close agregam e gravam `current_hp` e `experience` de cada criatura. Loot e consumíveis, por outro lado, são escritos na mochila assim que o evento acontece.

## O runtime

### Manager e fila

`createHuntManager` mantém `Map<trainerId, HuntRuntime>` e uma fila serial por treinador. Duas operações da mesma caçada nunca rodam ao mesmo tempo, e uma caçada não espera pela outra. O manager não tem relógio próprio: o runner chama `advanceAll`.

Cada `HuntRuntime` guarda a sessão, a área, o conteúdo, o estado da simulação, o `huntRev`, o motivo do fim da janela, o instante do último checkpoint e o que já foi creditado na mochila (`credited.drops` e `credited.spent`).

### Loadout ao vivo

`refreshLoadout(trainerId)` roda na fila serial da caçada e relê o time do banco. Ele substitui só o que o jogador edita; vida, nível, posição, experiência, alvo e comportamento continuam como a simulação deixou.

- **Habilidades:** as quatro posições são reaplicadas. A habilidade que permanece no mesmo slot com o mesmo slug mantém o `readyAt`; a que entra — nova ou trocada — nasce em `agora + cooldown`; slot vazio fica sem cooldown. A removida deixa de existir no array e some da barra.
- **Consumíveis:** o slot que mantém o mesmo item mantém o cooldown, mesmo quando o gatilho mudou; o gatilho novo passa a valer na próxima decisão. Item diferente ou slot novo nasce em `agora + cooldown`. A quantidade é a da mochila no momento da releitura, e o slot removido desaparece com o cooldown.

As rotas `PUT /api/creatures/:id/ability-slots`, `PUT /api/gear-slots/:slot` e `DELETE /api/gear-slots/:slot` chamam `refreshHuntLoadout` depois da escrita. A resposta `204` não espera a caçada: o runtime publica um `hunt_delta` quando o novo loadout está aplicado, e uma falha no refresh é logada sem desfazer o comando que já gravou no banco.

### Start

`start({ accountId, areaId, trainerId })`:

1. Recusa se já existe runtime em memória ou sessão ativa no banco (`already_hunting`).
2. Lê o time e o treinador.
3. Carrega a área e valida nível mínimo (`level_too_low`), stamina mínima (`stamina_insufficient`) e a existência de uma criatura viva (`no_viable_creature`).
4. Sorteia a semente, calcula o fim da janela e cria o `SimState`.
5. Insere a linha em `hunt_sessions`.
6. Monta o runtime, grava o primeiro `simulation_state` e devolve o snapshot.

O snapshot também é empurrado para o canal da conta pelo hook `onSnapshot`.

### Hydrate e sweep

`hydrate(session)` retoma uma sessão ativa que não está em memória:

- lê `simulation_state`; se ele não existe, reconstrói o estado a partir do time atual, da semente e do contador de sorteios da sessão;
- carrega o conteúdo da área e monta o runtime;
- avança a simulação até agora;
- fecha a caçada se ela já terminou durante o catch-up.

`ensureHunt` tenta o runtime em memória e, se não houver, hidrata a sessão ativa antes de responder. É o caminho da rota `GET` e do `select_trainer`.

`sweep()` lista as sessões ativas com `last_simulated_at` atrás de agora e hidrata uma a uma. O `index.ts` inicia o runner e roda o sweep uma vez no boot, depois de o servidor começar a ouvir.

### Advance

Cada wake do scheduler chama `advance` na fila serial do treinador:

1. `advanceUntil` move a simulação até o instante.
2. `toDelta` monta um delta incremental: só os atores cuja vida, direção, alvo, comportamento ou passo mudou; habilidades, consumíveis, ondas e ledger só quando mudaram.
3. O delta é publicado **antes** dos efeitos colaterais assíncronos, para o passo não esperar o banco.
4. Os efeitos colaterais (loot e consumíveis) entram numa cadeia própria em background; o checkpoint e o close esperam por ela, mas a próxima decisão da simulação não.
5. O checkpoint roda em background sobre um **clone** do estado, fora da fila serial; um Supabase lento não atrasa um passo.
6. Se a simulação terminou, `closeHunt` espera pelos efeitos e pelo checkpoint em voo, grava o estado final e publica `hunt_ended`.

O `huntRev` só avança quando o delta tem conteúdo. Um wake que não mudou nada não gasta revisão nem mensagem.

### Checkpoint

Uma caçada `dirty` é gravada no máximo a cada 2 s. O checkpoint clona o estado, escreve `simulation_state`, `last_simulated_at`, `rng_seed`, `rng_draws`, `encounters`, `kills` e `stamina_spent_minutes` na sessão, e `current_hp` e `experience` de cada criatura do time em `creatures`, **sem segurar a fila serial**. Se o estado mudar durante a escrita, a versão do runtime não bate e ele continua sujo para o próximo intervalo. O close sempre espera o checkpoint em voo e grava o estado final, independentemente do intervalo.

### Close

`closeHunt`:

1. Marca o estado como encerrado, se ainda não estiver.
2. Credita na mochila o que o ledger tem e o runtime ainda não escreveu, sem duplicar o que já foi creditado no abate.
3. Grava o estado final e o time.
4. Faz o soft-close da sessão, com `end_reason` e `ended_at`.
5. Debita a stamina do treinador com `staminaAtStart - minutos decorridos`.
6. Chama `healTrainerCreatures`, que grava `current_hp = null` em todas as criaturas do treinador — time e armazenamento. Vida nula é vida cheia no domínio.
7. Remove o runtime da memória e publica `hunt_ended` com o ledger final. O `onEnded` do `index.ts` também chama `broadcaster.pushState`, para o cliente receber o retrato da cidade já com a vida e a stamina novas.

### Scheduler e watchdog

Cada `HuntRuntime` agenda o próprio próximo instante com `nextInstant` — fim de passo, decisão de selvagem, cooldown, chegada de onda ou projétil, respawn e fim da janela. O scheduler chama `advance` nesse instante exato e publica o delta ali, então um passo chega ao cliente quando começa, não no tick seguinte.

O `startHuntRunner` mantém um `setInterval` de 250 ms como **watchdog**: cobre um timer perdido, faz o checkpoint dos estados sujos e recupera sessões. O caminho normal de publicação é o scheduler. O timer é armado no start, no hydrate/sweep e depois de cada avanço; é limpo no close e no finalize.

## Sessão e schema

A sessão é o registro durável da caçada. Ela é criada no start e fechada por soft-close; a linha nunca é apagada.

| Coluna | Tipo | O que é |
| --- | --- | --- |
| `id` | `uuid` | A identidade da sessão. |
| `account_id` | `uuid` → `auth.users(id)` | A conta dona da caçada. |
| `trainer_id` | `uuid` → `public.trainers(id)` | O treinador que está caçando. |
| `hunt_area_id` | `uuid` → `public.hunt_areas(id)` | A área caçada. |
| `status` | `text` | `active` ou `finished`. |
| `started_at`, `last_simulated_at`, `ended_at` | `timestamptz` | O começo, o cursor da simulação e o fim. |
| `end_reason` | `text` | O motivo do fim. |
| `rng_seed`, `rng_draws` | `bigint` | O estado do RNG. |
| `encounters`, `kills` | `bigint` | Os contadores agregados da sessão. |
| `stamina_spent_minutes` | `int` | Os minutos de stamina consumidos. |
| `stamina_at_start` | `int` | A stamina do treinador no começo. |
| `actions` | `jsonb` | A timeline da camada anterior de avanço. |
| `simulation_state` | `jsonb` | O snapshot completo do `SimState`, gravado pelos checkpoints. |

`simulation_state` foi adicionada pela migration `20261024120000_hunt_combat.sql`. É o dado que permite retomar a caçada sem replay: o runtime lê o estado e avança até agora.

A restrição `hunt_sessions_consistency_check` amarra `status`, `ended_at` e `end_reason`: uma caçada `active` não tem fim, e uma `finished` tem os dois. A `hunt_sessions_ended_at_check` impede fim antes do começo, e a `hunt_sessions_counters_check` impede contadores negativos e stamina acima do teto de 720 minutos.

### Os índices

| Índice | Tipo | Por que existe |
| --- | --- | --- |
| `hunt_sessions_active_last_simulated_at_idx` | parcial, sobre `last_simulated_at`, onde `status = 'active'` | É o índice do sweep do boot. |
| `hunt_sessions_active_trainer_id_idx` | único e parcial, sobre `trainer_id`, onde `status = 'active'` | Um treinador caça uma área por vez. |
| `hunt_sessions_account_id_idx` | comum, sobre `account_id` | As caçadas de uma conta quando ela volta. |

### O acesso e o soft-close

RLS ligado, `anon` e `authenticated` sem grant e sem policy, e só o `service_role` enxerga as linhas. O servidor é o único caminho de escrita.

Apagar a linha jogaria fora o `end_reason`, o loot da sessão e a contabilidade da sessão offline. Por isso o fim é um soft-close: `finishHuntSession` escreve `status`, `end_reason` e `ended_at`, e não existe `delete` na tabela.

> A coluna `actions`, `appendHuntAction` e a camada `clock.ts` continuam no repositório, mas o runtime jogável não os usa: `finalize_hunt` e `swap_creature` são aplicados na hora pelo manager. Os checkpoints da caçada em andamento usam `simulation_state`, não a timeline.

### A última criatura

A migration `20261025120000_last_creature_guard.sql` substitui `remove_creature_from_team` e `release_creature` com a trava da última criatura, na mesma transação que altera as linhas.

| Operação | Quando recusa | Código |
| --- | --- | --- |
| Remover do time | A criatura é a única do time. | `last_team_member` |
| Soltar | A criatura é a única do treinador. | `last_creature` |
| Soltar | A criatura está no time e é a única do time, mesmo que existam outras no armazenamento. | `last_creature` |

A API mapeia os dois códigos para `409`, e a mensagem de cada um está em `validation/trainer.ts`: **O time não pode ficar vazio.** para `last_team_member` e **O treinador precisa ter pelo menos uma criatura.** para `last_creature`. A trava garante que o start da caçada nunca encontre um time vazio e que a criatura ativa exista.

## Rotas HTTP

As três rotas são protegidas; o treinador vem da sessão do token, nunca do corpo.

| Rota | Resposta | Recusas |
| --- | --- | --- |
| `POST /api/hunts` com `{ huntAreaId }` | `201 { hunt: snapshot }` | `400 invalid_hunt`, `401 unauthenticated`, `403 level_too_low`, `404 area_not_found`, `409 already_hunting`, `409 no_viable_creature`, `409 stamina_insufficient` e `409 trainer_not_found`. |
| `GET /api/hunts/current` | `200 { hunt: snapshot }` | `401 unauthenticated` e `404 hunt_not_found`. |
| `DELETE /api/hunts/current` | `204`, mesmo sem caçada | `401 unauthenticated`. |

O `GET` passa por `ensureHunt`: se a sessão está aberta no banco mas o processo não tem o runtime, ela é hidratada antes da resposta. O `DELETE` finaliza pelo manager quando a caçada está em memória; sem runtime, responde `204` sem tocar a sessão do banco.

## WebSocket

As mensagens da caçada têm ramo próprio no protocolo, com revisão própria (`huntRev`), além do `v` do envelope.

| Mensagem | Direção | Conteúdo |
| --- | --- | --- |
| `hunt_state` | Servidor → cliente | Snapshot completo: sessão, criatura ativa, treinador, selvagens, ondas, cooldowns, consumíveis, ledger, `huntRev` e `serverNow`. |
| `hunt_delta` | Servidor → cliente | Atores alterados, selvagens removidas, ondas quando mudam, eventos, cooldowns quando mudam, consumíveis quando mudam, ledger quando muda e `huntRev`. |
| `hunt_ended` | Servidor → cliente | Motivo e ledger final. |
| `command { type: 'finalize_hunt' }` | Cliente → servidor | Encerra a caçada. |
| `command { type: 'swap_creature', creatureId }` | Cliente → servidor | Troca a criatura ativa. |

O `hunt_state` chega no `select_trainer`, depois do `command_result` e do `world_state`, e também é empurrado quando a caçada começa. O `hunt_delta` é publicado pelo scheduler no instante do passo, e ainda pela troca de criatura e pelo refresh de loadout. O `hunt_ended` é publicado no close.

O servidor recusa `use_ability` e `use_consumable` com `invalid_command`: a rotação e os consumíveis pertencem à simulação. O `move` continua no canal do mundo e não é um comando da caçada.

Cada ator no snapshot e no delta carrega `dir`, `segment` e `tile`. O `segment` tem `startsAt`/`endsAt` absolutos; o cliente interpola pelo relógio corrigido e **não estica** o passo. Uma criatura que decide esperar fica parada no tile, não desliza. O `dir` é o olhar atual: a criatura com alvo olha para o alvo, não para a direção do passo.

O delta é incremental: `upserts` só com os atores cuja vida, direção, alvo, comportamento ou passo mudou; `waves` só quando o conjunto de ondas mudou; `abilities` e `consumables` só quando o cooldown ou a quantidade mudou; e `ledger` só quando mudou. O cliente mantém o que o delta omite.

Quando o jogador troca de treinador, o runtime da caçada anterior é fechado com `trainer_switched` antes de a nova sessão começar.

> O `huntRev` é monotônico por runtime. O cliente descarta qualquer delta com revisão menor ou igual à que já aplicou. O snapshot aceita a revisão igual ou maior, porque é ele que reconstrói o estado.

## Fim da caçada

| Motivo | Quem decide | O instante |
| --- | --- | --- |
| `stamina_depleted` | O runtime, pelo limite de stamina da sessão. | `startedAt` + a stamina do começo. |
| `offline_session_expired` | O runtime, pela duração da sessão offline da conta. | `startedAt` + a duração da conta. |
| `player_finalized` | O comando `finalize_hunt` ou a rota `DELETE`. | O instante da ação. |
| `trainer_switched` | O `select_trainer`, ao trocar de treinador. | O instante da troca. |
| `no_viable_creature` | A simulação, quando a última criatura viva desmaia. | O instante exato do desmaio. |

O `SimState` fecha a janela em `endsAt` com o rótulo `offline_session_expired`, porque a simulação não conhece a regra de stamina. O runtime conhece o motivo calculado no start (`windowEndReason`) e corrige o rótulo para `stamina_depleted` quando a stamina é o limite mais curto.

No fim, o cliente volta para a cidade, a stamina restante é debitada e a sessão fica `finished`. A conta gratuita vale para toda caçada hoje: 4 horas de sessão offline. O tipo de conta pago ainda não existe.

## Pendências

- **Tipo de conta:** `HUNT_ACCOUNT_TYPE` é fixo em `free` no start e no hydrate; não há coluna que diga se a conta é paga, então a sessão offline é sempre de 4 horas.
- **Recuperação de stamina:** `stamina_minutes` continua um valor estático do treinador. A recuperação fora da caçada não é calculada no servidor.
- **Captura e dispositivos:** não há resolução de captura nem consumo de dispositivo; o slot é um no-op.
- **Party:** não há party, PvP nem interação entre caçadas. A colisão entre os atores da caçada existe.
- **Balanceamento:** `DAMAGE_SCALE`, densidade de spawn, níveis, tempos de respawn e a fórmula de XP são provisórios.
- **Camada anterior:** `clock.ts`, `closings.ts`, `actions` e `appendHuntAction` continuam no repositório, mas não são o caminho da caçada jogável.

## Arquivos e testes

| Arquivo | O que está garantido |
| --- | --- |
| `apps/server/src/__tests__/hunt/sim/combat.spec.ts` | Dano, ondas, morte, loot e experiência. |
| `apps/server/src/__tests__/hunt/sim/simulate.spec.ts` | Loop, alvo, rotação, passos, encontros e determinismo do avanço. |
| `apps/server/src/__tests__/hunt/sim/stats.spec.ts` | Atributos, dano e efetividade. |
| `apps/server/src/__tests__/hunt/sim/wildAbilities.spec.ts` | Chance, intervalo e uso das habilidades das selvagens. |
| `apps/server/src/__tests__/hunt/sim/geometry.spec.ts` | Distância, direção, passo e geometria das áreas. |
| `apps/server/src/__tests__/hunt/sim/collision.spec.ts` | Ocupação do tile confirmado e do `segment.to`, e recusa do passo para tile bloqueado. |
| `apps/server/src/__tests__/hunt/sim/areaSelf.spec.ts` | `effectiveRange` e a área centrada no conjurador. |
| `apps/server/src/__tests__/hunt/runtime/manager.spec.ts` | Start, recusas, checkpoint, crédito de loot e finalização. |
| `apps/server/src/__tests__/hunt/runtime/managerLifecycle.spec.ts` | Hidratação do estado gravado e de sessão antiga, consumo de poção e fim sem criatura viável. |
| `apps/server/src/__tests__/hunt/runtime/wire.spec.ts` | Snapshot, delta incremental, atores, cooldowns e consumíveis. |
| `apps/server/src/__tests__/hunt/runtime/content.spec.ts` | Mapeamento do conteúdo e do time. |
| `apps/server/src/__tests__/hunt/runtime/loadout.spec.ts` | Loadout ao vivo: troca de habilidade, cooldown, gatilho e quantidade de consumível. |
| `apps/server/src/__tests__/loadoutRefresh.spec.ts` | As rotas de habilidade e equipamento chamando o refresh da caçada. |
| `apps/server/src/__tests__/hunt/runner.spec.ts` | Watchdog de 250 ms, parada e falha de um tick. |
| `apps/server/src/__tests__/hunt/clock.spec.ts` | A camada anterior de avanço por regras. |
| `apps/server/src/__tests__/hunt/rng.spec.ts` | Reprodutibilidade e limites do RNG. |
| `apps/server/src/__tests__/hunt/session.spec.ts` | Criação, leitura, cursor, ação e soft-close da sessão. |
| `apps/server/src/__tests__/hunt/map.spec.ts` | As quatro áreas, o loop fechado e as validações do mapa. |
| `apps/server/src/__tests__/hunts.spec.ts` | As rotas `POST`, `GET` e `DELETE` e as recusas. |
| `apps/server/src/__tests__/lastCreature.spec.ts` e `apps/server/src/__tests__/integration/lastCreature.integration.spec.ts` | As recusas `last_creature` e `last_team_member`. |
| `apps/server/src/__tests__/integration/abilityCatalog.integration.spec.ts` | O catálogo 2.2 no banco: 6 habilidades por espécie, os três tipos e os slots 0–5. |
| `apps/server/src/__tests__/gameSocket.spec.ts` | `select_trainer`, `hunt_state`, `finalize_hunt`, `swap_creature` e a recusa de habilidade manual. |

A suíte roda com `bun test apps/server`.
