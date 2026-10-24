# Plano: gameplay em tempo real

Este plano cobre a reforma do movimento, da sincronização, das animações, dos
efeitos e da distribuição dos mapas de caça. Ele parte do código que existe hoje
e das decisões de produto tomadas para esta fase.

> O cliente mostra, o servidor decide. O que muda aqui é **quando** e **como** o
> servidor conta o que decidiu, e como o cliente transforma isso em movimento
> contínuo.

## Diagnóstico do que existe

### Caçada

- `apps/server/src/hunt/runtime/runner.ts` avança todas as caçadas a cada
  **100 ms**. `advanceUntil` é orientado a eventos e gera os segmentos com
  `startsAt` exato, mas o `hunt_delta` só sai no tick seguinte.
- Consequência: um passo de 300 ms termina em `T`; o delta com o próximo passo
  chega ao cliente em `T + [0,100) + latência` e já traz `startsAt = T`. O
  cliente fica parado no tile e então salta até 33% do passo. Isso acontece a
  cada passo.
- `apps/client/src/entities/hunt/model/stepStretch.ts` estica o passo visual até
  `nextStepAt`. Na selvagem, `nextStepAt = max(endsAt, nextDecisionAt)`, então um
  passo de 300 ms é desenhado em 600–1800 ms. A criatura anda em câmera lenta e
  teleporta na próxima decisão.
- `apps/server/src/hunt/runtime/wire.ts` manda **todos** os atores em cada delta,
  além da lista inteira de ondas, mesmo quando nada mudou.
- A câmera segue o segmento esticado, então a câmera também trava.

### Cidade

- O broadcaster (`apps/server/src/world/broadcaster.ts`) já manda um segmento por
  vez, no fim do passo atual, que é o início do próximo. Isso está correto no
  princípio, mas não há predição para o próprio jogador: a tecla/clique só anda
  depois do `move_result`.
- O relógio (`worldStore.now()`) é `Date.now() + offset`, com o offset calculado
  uma única vez por snapshot (`serverNow - Date.now()`). Não há RTT, jitter nem
  reavaliação; qualquer variação de latência entra na animação.
- O cliente não tem fila de passos: guarda no máximo um segmento por ator e
  resolve a posição por timestamps absolutos.

### Efeitos

- Projétil de habilidade de alvo tem duração fixa de 260 ms no cliente
  (`CAST_PROJECTILE_MS`) e o dano do servidor é instantâneo. O número de dano e
  o flash não coincidem com a chegada do projétil.
- Onda de área é um `Graphics` redesenhado do zero a cada quadro.
- Números de dano criam e destroem um `Text` por evento, o que é caro no Pixi.
- A animação de ataque é 2 quadros por 350 ms, sem estágios de windup/hit/recovery.

## O que o Tibia faz (e o que vamos aproveitar)

Pesquisa feita em `opentibiabr/canary` e `opentibiabr/otclient` (main):

- O servidor é **orientado a eventos**. Cada criatura agenda o próximo passo no
  dispatcher; não há tick global de movimento. O passo é aplicado no mapa e o
  pacote é enviado **no início do intervalo**, com a posição de destino.
- O cliente reinicia um timer local na chegada do pacote e anima com a **mesma
  duração** que o servidor usa. Como a duração é igual, o próximo pacote chega
  exatamente quando a animação termina: os passos encadeiam sem folga.
- O jogador local tem **predição de 1 passo** (`preWalk`), com ack por
  `newPos == preWalk` e cancelamento explícito (`0xB5`).
- A duração do passo vem da velocidade, quantizada em 50 ms; diagonal custa mais.
  O Tibia usa ×3; nós usamos √2 (424 ms para 300 ms), que é mais natural.
- Efeitos, mísseis e números de dano são mensagens **posicionais e
  independentes** da criatura. Míssil viaja `150 * sqrt(tiles)` ms; texto sobe
  48 px em 1 s e some depois de 833 ms; números iguais na mesma tile se fundem.
- A câmera segue a **posição interpolada** (offset do walk), não o tile.
- O cliente não recebe timestamp do servidor. Nós recebemos, e vamos usar isso
  para fazer melhor: **timestamps absolutos + buffer de reprodução**.

O que **não** copiamos: diagonal ×3, posição lógica no destino sem timestamp,
strip de mapa por passo, pacote completo de stats a cada mudança.

## Decisões desta fase

| Decisão | Escolha |
| --- | --- |
| Movimento do próprio jogador na cidade | Autoritativo com predição e reconciliação |
| Jitter | Buffer de reprodução adaptativo, 30–160 ms |
| Dispositivo na caçada | Espelha o equipado; sem efeito de combate nesta fase |
| Spawns | Pontos individuais agrupados em clusters |
| Mapas | As quatro áreas redesenhadas agora |
| Arte | Melhorar a arte procedural atual (mais quadros, projéteis, impacto) |

## Arquitetura

### 1. Relógio do cliente

Um `ServerClock` em `apps/client/src/entities/world/model/serverClock.ts`:

- `ping` a cada 2 s enquanto a partida está ativa (1 s nos primeiros 10 s).
- O servidor responde `pong { sentAt, serverNow }`.
- `rtt = receivedAt - sentAt`; `offset = serverNow + rtt / 2 - receivedAt`.
- Guarda a amostra de **menor RTT** da janela (10 s) para o offset e calcula
  `jitter` como a EMA de `|rtt - minRtt|`.
- `serverNow()` = `Date.now() + offset`.
- `bufferMs` = `clamp(30, 160, minRtt / 2 + 2 * jitter + 20)`.
- `renderNow()` = `serverNow() - bufferMs`.

O `worldStore` expõe `serverNow()` e `renderNow()`. O `huntStore` usa o mesmo
relógio. Ao voltar de uma aba oculta, o `renderNow` é recalculado do zero; um
salto grande é tratado como snap.

### 2. Timeline de ator

Um modelo puro em `apps/client/src/entities/world/model/actorTimeline.ts`:

- Cada ator tem uma fila curta de `PathSegment` (máximo 4).
- `pushSegment(segment)`:
  - descarta duplicatas por `startsAt`/`from`/`to`;
  - se a fila estiver cheia, remove o segmento mais antigo já concluído;
  - se o novo segmento começar antes do fim do último, mantém os dois e resolve
    pela ordem de `startsAt`.
- `resolveAt(renderNow, fallbackTile)`:
  - antes do primeiro `startsAt`: segura em `first.from`;
  - dentro de um segmento: interpola `from → to` com `renderNow`;
  - depois do último `endsAt`: segura em `last.to`;
  - se a posição calculada estiver a mais de 2 tiles do `fallbackTile` do
    snapshot, faz snap para o snapshot (proteção contra perda de mensagem).
- Não existe esticamento. Um passo de 300 ms é desenhado em 300 ms; se a
  criatura espera 1 s antes do próximo, ela fica **parada** nesse intervalo.

A posição visual é sempre arredondada para pixel inteiro depois da interpolação,
como hoje, para manter o pixel art nítido.

### 3. Publicação no servidor

#### Cidade

- O broadcaster continua mandando um segmento por vez, mas o envio do próximo
  passa a ser agendado no **início** do segmento atual (que é o fim do anterior).
  O timer já faz isso; falta tolerar atraso do event loop com um `max(0, ...)` e
  um watchdog de 250 ms.
- O `move_result` passa a carregar `serverNow`, para o cliente reconciliar a
  predição com o relógio do servidor.

#### Caçada

- O runner de 100 ms deixa de ser o publicador. Cada `HuntRuntime` ganha um
  **scheduler** que calcula o próximo instante interessante (`readNextInstant`:
  fim de passo, decisão de selvagem, cooldown, chegada de onda, respawn, fim da
  janela) e agenda um `setTimeout` para ele.
- Ao acordar, o scheduler chama `advance` e publica o delta **no instante exato**
  em que o segmento começou. O cliente recebe o segmento antes de `renderNow`
  alcançar `startsAt` (graças ao buffer), então começa o passo do zero.
- O tick de 100 ms continua existindo como **watchdog** (250 ms) para
  checkpoints, sessões órfãs e timers perdidos; ele não é o caminho normal de
  publicação.
- O delta passa a ser **incremental**:
  - `upserts` só com atores que mudaram (passo, alvo, dano, cura, morte, spawn,
    troca de criatura, loadout);
  - `waves` só quando a lista de ondas mudou (nova onda ou onda removida);
  - `abilities`/`consumables` só quando o cooldown ou a quantidade mudou;
  - `ledger` só quando mudou.
- Cada ator carrega `startsAt`/`endsAt` absolutos. `nextStepAt` deixa de ser
  usado para esticar; permanece apenas como dica informativa (pode ser removido
  do contrato se não houver consumidor).

### 4. Predição do jogador (cidade)

- O pathfinding Dijkstra 1/3 e o heap saem de `apps/server/src/world/` para
  `apps/shared/contracts/` (ou `apps/shared/world/`), com os mesmos testes.
  Servidor e cliente passam a importar a mesma implementação.
- No input (tecla ou clique):
  1. o cliente calcula o caminho a partir do tile confirmado (ou do `to` do
     passo em curso) com a mesma função do servidor;
  2. se o caminho é válido, cria os segmentos preditos com os mesmos tempos
     (`startsAt = max(agora, fim do passo em curso)`), aplica no `worldStore` e
     envia o `move`;
  3. a câmera e o sprite andam imediatamente.
- No `move_result`:
  - **aceito e mesmo primeiro passo:** mantém o passo visual em curso (não
    reinicia) e substitui os passos seguintes pelos do servidor, deslocando os
    timestamps para começarem no fim do passo em curso;
  - **aceito com caminho diferente:** mantém o passo em curso e troca o resto;
  - **recusado:** faz snap para o último tile confirmado e trava o input por um
    passo, como o `lockWalk` do Tibia.
- A predição é limitada a um passo em curso; os passos seguintes vêm do
  `move_result` (que já traz o caminho inteiro). O cliente não prediz além do
  que o servidor respondeu.

### 5. Animação

Um `Animator` por ator, alimentado por `renderNow`:

- Clipes declarativos: `idle` (4 quadros, 800 ms), `walk` (6 quadros distribuídos
  pela duração do passo), `attack` (4 quadros: windup, hit, recovery), `hit`
  (2 quadros, 220 ms), `death` (4 quadros, 550 ms).
- O clipe de `walk` é fase-alinhado ao segmento: `frame = floor(progress * 6)`.
  O de `attack` começa no `castAt` do evento; o de `hit` no `at` do dano; o de
  `death` no `at` da morte.
- Prioridade: `death` > `hit` > `attack` > `walk` > `idle`.
- A pose vem da direção do passo; com alvo, a criatura olha para o alvo
  (o servidor já manda `dir`).
- O atlas procedural ganha os quadros novos; o gerador mantém as chaves atuais e
  adiciona `walk` com 6 quadros, `attack` com 4, `hit` e `death`.

### 6. Efeitos

- **Projéteis de alvo:** o servidor passa a tratar habilidades de alvo com
  `travelMs > 0` como projéteis, com `impactAt = now + travelMs`. O dano é
  aplicado no impacto (não no cast). O evento `ability_cast` leva `travelMs` e
  `impactAt`; o cliente desenha o projétil do conjurador ao alvo e o número de
  dano no impacto.
- **Ondas de área:** o cliente desenha a frente de onda a partir de `startedAt`,
  com um tile aceso por `arrivalAt` e fade de 200 ms. Um único `Graphics`
  redesenhado por quadro é aceitável para poucas ondas; se houver muitas, usar
  sprites pooled por tile.
- **Números de dano:** pool fixo de `Text` (ou `BitmapText`) com merge por
  tile/cor dentro de 400 ms, subida de 48 px em 1 s e fade após 833 ms.
- **Cura/consumível:** brilho verde no alvo e ícone do item subindo.
- **Morte:** fade + partículas curtas; o ator sai da lista depois de 550 ms.
- **Spawn:** puff de fumaça e fade-in.
- **Alvo:** anel pulsante (alpha/tamanho) no alvo atual.
- **Ataque corpo a corpo:** slash curto no alvo, sem projétil.

### 7. Render

- `app.ticker.maxFPS = 60`; `resolution: 1`; `autoDensity: false` (já).
- Chão em uma única `RenderTexture` (já). Tiles animados ficam para depois; se
  entrarem, usar um shader com `uTime` ou sprites pooled só da viewport.
- Atores: um `AnimatedSprite` por ator, texturas trocadas só quando pose/estado
  mudam. `gotoAndStop(frame)` por quadro.
- `zIndex` só é escrito quando o pixel vertical muda; `sortableChildren` já
  ordena.
- Barras de vida: `Graphics` desenhado uma vez por mudança de ratio; movimento
  só no `container.position`.
- Efeitos: `Graphics`/sprites pooled; nada de `new Text` por dano.
- HUD: `useHuntFrame` a 150 ms é suficiente para cooldowns; o canvas lê o store
  no ticker, sem React.
- Sem alocações por quadro nos caminhos quentes (evitar `Object.values`, spreads
  e `map` dentro do tick quando possível).

### 8. Mapas

- 96x64, borda de 2 tiles.
- Cada área tem um **loop de patrulha** fechado, denso, que serpenteia pelo mapa;
  o `spawn` é um nó do loop.
- **Clusters de spawn**: 4–6 por área, cada um com 3–4 pontos adjacentes (2x2 ou
  L), a pelo menos 6 tiles de outro cluster e a pelo menos 10 tiles do spawn.
  A quantidade total cresce com a dificuldade: 12 / 15 / 20 / 24.
- **Obstáculos** (montanha/muro, água, bosque) pintados antes; o loop, o spawn e
  os clusters são **escavados** por cima, garantindo corredores walkáveis.
- Conectores de 1 tile ligam cada cluster ao loop, para a selvagem conseguir
  perseguir e voltar.
- O chão do loop é `PATH`, para o jogador ler o percurso; o resto é grama com
  flores/grama alta.
- Validação no gerador: loop fechado e andável, spawn no loop e andável, cada
  ponto de spawn andável, alcançável a partir do spawn por BFS, e distâncias
  mínimas.

### 9. Loadout ao vivo

- As rotas de habilidade/consumível/dispositivo já chamam `refreshHuntLoadout`.
- O cliente não pode bloquear a abertura do painel de habilidades durante a
  caçada; a troca é aplicada localmente e reconciliada pelo `hunt_delta`.
- O dispositivo é espelhado no HUD da caçada a partir do estado do jogador; sem
  efeito de combate nesta fase.
- O delta de loadout precisa incluir as habilidades/consumíveis do slot e o
  dispositivo (mesmo que só para exibição).

## Ordem de implementação

1. **Relógio e timeline** (cliente): `serverClock`, `actorTimeline`, remoção do
   `stretchSegment`, câmera pela posição interpolada.
2. **Publicação da caçada** (servidor): scheduler por runtime, delta
   incremental, remoção do `nextStepAt` como esticamento.
3. **Predição da cidade** (cliente + shared): mover pathfinding, predição,
   reconciliação.
4. **Animações e efeitos** (cliente + servidor): clipes, projéteis com impacto,
   dano/cura/morte/spawn, pools.
5. **Mapas** (servidor): gerador e JSONs, testes de mapa.
6. **Loadout ao vivo** (cliente + servidor): painel na caçada e dispositivo.
7. **Docs e testes**: atualizar `docs/technical` e `docs/game`, cobrir o modelo
   puro e o scheduler.

## Critérios de aceite

- Andar na cidade responde no mesmo frame do input e não "volta" quando o
  servidor confirma.
- Um ator da caçada anda 300 ms por tile ortogonal e 424 ms por diagonal, sem
  pausa no fim do tile e sem saltos.
- Uma selvagem que decide esperar fica **parada**, não desliza.
- Um projétil de fogo sai do conjurador, chega ao alvo e só então o dano aparece.
- A câmera acompanha a posição interpolada, em pixel inteiro.
- O delta de uma caçada sem mudanças não é enviado; um passo típico gera um delta
  pequeno, só com o ator que mudou.
- `bun test apps/client`, `bun test apps/server`, `bun run --filter
  @creatures/client typecheck` e `bun run lint` passam.
- Validação visual com a skill `agent-browser` na cidade e nas quatro áreas.

## Riscos

- **Timers por runtime** em muitos jogadores: usar um único heap de timers por
  processo se passar de algumas centenas de caçadas; nesta fase, um timer por
  runtime é suficiente.
- **Predição com caminho divergente**: mitigada por usar o mesmo pathfinding e
  por manter o passo em curso; o pior caso é um snap de 1 tile.
- **Buffer alto** em redes ruins: a sensação de latência aumenta; o buffer é
  adaptativo e limitado a 160 ms nesta fase.
- **Mapas com corredores estreitos** podem prender atores; a validação BFS e o
  corredor de 3 tiles mitigam.
