# Mundo (cliente)

Este documento cobre a implementação do mundo renderizado no cliente: a fatia `entities/world`, o pipeline dos assets procedurais, o desenho do chão e dos atores, a câmera, o ciclo de vida do canvas, o protocolo de mundo e a cena da caçada. O comportamento do ponto de vista do jogador está em [Mundo](../../game/WORLD.md) e [Caçada](../../game/HUNT.md).

> O cliente **desenha** o mundo, não o decide. A posição, o caminho, a simulação da caçada e as revisões vêm do servidor, conforme a [Arquitetura](../ARCHITECTURE.md). O canvas vive dentro da [tela do jogo](../../game/PLAY_SCREEN.md), abaixo da toolbar.

## Onde o código mora

A fatia segue o FSD descrito em [Estrutura](STRUCTURE.md). A divisão central é entre o **modelo puro** e a **camada Pixi**:

| Caminho | Papel |
| --- | --- |
| `apps/client/src/entities/world/model/` | Modelo puro, sem Pixi e sem WebGL: coordenadas, zoom, passos, animação, câmera e o store do mundo. É o que os testes do Bun exercitam. |
| `apps/client/src/entities/world/model/tiles.ts` | `TILE_SIZE_PX = 16`, conversão entre tile e pixel, tile da tela a partir do recorte do canvas, do zoom e da câmera, tile adjacente a uma direção. |
| `apps/client/src/entities/world/model/scale.ts` | Janela fixa de 34x20 sqm (544x320 px), `computeWorldScale` (o zoom inteiro cover, com `ceil` nos dois eixos) e `computeCanvasLayout` (tamanho CSS e recorte central do canvas). |
| `apps/client/src/entities/world/model/steps.ts` | Posição em pixels de um ator pelo relógio corrigido; delega a resolução para a timeline. |
| `apps/client/src/entities/world/model/actorTimeline.ts` | Fila curta de segmentos por ator, interpolação entre passos, pausa no fim e snap quando o passo se perde. |
| `apps/client/src/entities/world/model/serverClock.ts` | Relógio do servidor com RTT, jitter e buffer de reprodução (`now`/`renderNow`). |
| `apps/client/src/entities/world/model/prediction.ts` | Predição do primeiro passo na cidade e reconciliação com a resposta do servidor. |
| `apps/client/src/entities/world/model/actorState.ts` | Pose, quadro e estado (`idle`/`walking`) a partir da direção e do segmento. |
| `apps/client/src/entities/world/model/camera.ts` | Câmera em pixels inteiros, centralizada no ponto seguido e limitada ao mapa. |
| `apps/client/src/entities/world/model/worldStore.ts` | Dono único da dinâmica do mundo no cliente: atores, caminhada, predição, revisão, relógio do servidor e as ações que aplicam as mensagens. |
| `apps/client/src/entities/world/ui/pixiApp.ts` | Criação e destruição da `Application` do PixiJS com as configurações de pixel art. |
| `apps/client/src/entities/world/ui/WorldCanvas.tsx` | Componente React que monta o canvas, segue o jogador, trata clique e teclado e desenha a cada quadro. |
| `apps/client/src/entities/world/ui/layers/groundRenderer.ts` | Desenho de qualquer mapa em uma única `RenderTexture`: cidade e áreas de caça passam o mapa, e o renderer não conhece qual é. |
| `apps/client/src/entities/world/ui/layers/actorsRenderer.ts` | Um `AnimatedSprite` por ator, reconciliado por id a cada quadro. |
| `apps/client/src/entities/world/index.ts` | API pública da fatia: `worldStore`, `useWorldState` e os tipos do mundo. |
| `apps/client/src/entities/hunt/model/huntStore.ts` | Store Zustand da caçada: snapshot, fase, revisão, eventos recentes, fim e erro. |
| `apps/client/src/entities/hunt/model/huntSelectors.ts` | Seletores da caçada para o HUD: vida, habilidades, consumíveis, ondas, ledger e selvagens. |
| `apps/client/src/entities/hunt/model/creatureAnimation.ts` | Pose e quadro de uma criatura a partir da direção, do segmento e do cast. |
| `apps/client/src/entities/hunt/ui/HuntCanvas.tsx` | Componente React que monta a cena da caçada. |
| `apps/client/src/entities/hunt/ui/huntScene.ts` | Cena Pixi da caçada: mapa, câmera, camadas e tick. |
| `apps/client/src/entities/hunt/ui/layers/groundLayer.ts` | Chão da área: o mapa commitado mais o tom sutil da região. |
| `apps/client/src/entities/hunt/ui/layers/creatureLayer.ts` | Criaturas e treinador, um sprite por ator, com ataque, alvo e flash de dano. |
| `apps/client/src/entities/hunt/ui/layers/healthLayer.ts` | Barras de vida acima de cada criatura. |
| `apps/client/src/entities/hunt/ui/layers/effectLayer.ts` | Ondas de área, projéteis e números de dano. |
| `apps/client/src/pages/play/model/gameWorldProtocol.ts` | Leitura e validação das mensagens de mundo (`world_state`, `move_result`, `actor_update`, `actor_leave`). |
| `apps/client/src/pages/play/model/gameHuntProtocol.ts` | Leitura e validação das mensagens de caçada (`hunt_state`, `hunt_delta`, `hunt_ended`). |
| `apps/client/src/pages/play/model/gameSocket.ts` | Despacho das mensagens para os handlers e envio do `move`, correlacionado por `reqId`. |
| `apps/client/src/pages/play/model/moveRequests.ts` | Movimentos que aguardam resposta, com timeout e rejeição em massa quando o canal cai. |
| `apps/client/src/pages/play/model/gameChannelHandlers.ts` | Handlers do canal que aplicam as mensagens no `worldStore` e sincronizam o relógio. |
| `apps/client/src/pages/play/model/useHuntSession.ts` | Conecta o store da caçada às rotas de início e fim e ao canal de comandos. |
| `apps/client/src/pages/play/ui/GameScreen.tsx` | Escolhe entre `WorldCanvas` e `HuntCanvas` conforme a fase da caçada e mantém os modais montados sobre a cena. |
| `apps/client/src/pages/play/ui/GameModals.tsx` | Mochila, armazenamento e loja sempre montados; passa `isHunting` ao armazenamento. |
| `apps/client/src/pages/play/ui/PlayScreenPage.tsx` | Monta a tela do jogo, o `WorldCanvas` com o `requestMove` da sessão e os `GameModals`. |
| `apps/client/scripts/gen-assets.ts` | Gerador determinístico dos PNGs e dos atlas em `apps/client/public/world/`. |
| `apps/shared/contracts/world.ts` | Tipos de direção, tile, segmento, ator, ids e metadados de tile, além de `tileAt` e `isWalkableTile`. |
| `apps/shared/contracts/city.ts` e `city.json` | Carregador e mapa commitado que servidor e cliente compartilham. |
| `apps/shared/contracts/huntMap.ts` e `hunts/*.json` | Carregador e mapas commitados das áreas de caça. |

> O modelo não importa Pixi, e a camada `ui/` não decide regra de mundo. É essa fronteira que permite testar posição, zoom, animação e câmera no Bun, sem WebGL.

## Pipeline de assets

Os assets são **procedurais** nesta fase. O gerador é um script do Bun em `apps/client/scripts/gen-assets.ts` e escreve seis arquivos em `apps/client/public/world/`:

| Arquivo | Conteúdo |
| --- | --- |
| `tiles.png` | Folha com os tiles de 16x16 px, incluindo os quadros extras de água e grama alta. |
| `tiles.json` | Atlas no formato de spritesheet do Pixi: `frames` e `animations`. |
| `trainer.png` | Folha do treinador: 4 poses x 6 quadros de 16x24 px. |
| `trainer.json` | Atlas do treinador com as animações `idle` e `walk` por pose. |
| `creatures.png` | Folha das 5 espécies: 4 poses x 8 quadros de 16x16 px. |
| `creatures.json` | Atlas das criaturas com as animações `idle`, `walk` e `attack` por espécie e pose. |

O gerador não depende de `canvas` nem de `sharp`: ele desenha em buffers RGBA e codifica o PNG com o `zlib` do próprio runtime. O resultado é determinístico — sem RNG, e o deflate é estável para a mesma entrada —, então um rebuild só produz diff quando a arte muda.

Os seis arquivos são commitados em `apps/client/public/world/`. Para regenerá-los, o comando é `bun run scripts/gen-assets.ts`, executado dentro de `apps/client`.

O atlas usa as chaves que o renderer procura:

- **Tiles:** cada quadro é `tiles/<id>:<frame>`; quando o tile tem mais de um quadro, o atlas também publica a animação `tiles/<id>`.
- **Treinador:** cada quadro é `trainer/<pose>/<frame>`; cada pose tem a animação `trainer/<pose>/idle` (2 quadros) e `trainer/<pose>/walk` (4 quadros).
- **Criaturas:** cada quadro é `creature/<espécie>/<pose>/<frame>`; cada pose tem as animações `idle` (2 quadros), `walk` (4 quadros) e `attack` (2 quadros).

O carregamento é feito por `Assets.load<Spritesheet>` com `textureOptions: { scaleMode: 'nearest' }`, para os tiles, o treinador e as criaturas. O filtro nearest vale para todas as texturas do atlas e é o que mantém o pixel art nítido sob o zoom inteiro.

> Trocar por arte real é substituir os PNGs — e o JSON do atlas, se o recorte dos quadros mudar — sem tocar no código do renderer. O contrato é o nome das chaves e o tamanho dos quadros, não o desenho.

## Chão em uma RenderTexture

O mapa inteiro é desenhado **uma vez** em uma única `RenderTexture`. O tick não redesenha tile nenhum: ele move a câmera sobre um único `Sprite`.

`createGroundLayer(renderer, map)` recebe qualquer mapa com `width`, `height` e `tiles`; a cidade passa o `CITY_MAP` e a caçada passa o `HuntMap` carregado pelo slug. O renderer não conhece a origem do mapa.

O desenho acontece em `groundRenderer.ts`:

1. O atlas de tiles é carregado e cada sqm do mapa vira um `Sprite` de 16x16 px na posição inteira correspondente.
2. Esses sprites são agrupados em um `Container` temporário.
3. A `RenderTexture` é criada com `scaleMode: 'nearest'`, `autoGenerateMipmaps: false` e dimensões inteiras.
4. `renderer.render({ container, target: texture })` pinta o container na textura.
5. O container temporário é destruído; a textura vira o único `Sprite` do chão.

Como o mapa é o mesmo arquivo commitado dos dois lados, o cliente pinta os ids que o servidor usa para colidir.

> O tile é sempre o primeiro quadro (`tiles/<id>:0`). A água e a grama alta têm animação no atlas, mas o chão desta fase é estático: a camada de tiles animados ainda não existe.

## Atores

Os atores são desenhados por `actorsRenderer.ts`. O layer mantém um `Map` de `actorId` para `AnimatedSprite` e reconcilia esse mapa a cada quadro:

- O ator da conexão (`you`) usa a caminhada inteira que veio no `move_result`, guardada em `worldStore.path`.
- Os outros atores usam apenas o segmento em curso que veio no `actor_update`; o servidor manda um segmento por vez.
- Um ator que não aparece mais no estado é removido do mapa e o sprite é destruído.

Para cada ator, o quadro faz três coisas:

1. **Resolve o segmento atual** pelo relógio corrigido. Se o ator está entre dois sqm, o segmento diz a direção e a duração; se está parado, não há segmento.
2. **Calcula pose, estado e quadro.** A pose vem da direção; `idle` usa 2 quadros em ciclo de 800 ms, e `walking` distribui 4 quadros pela duração do passo. O `AnimatedSprite` é criado com `autoUpdate: false` e recebe `gotoAndStop(frame)`, porque quem manda no tempo é o relógio, não o ticker do Pixi.
3. **Posiciona o sprite** no pixel inteiro derivado do sqm e do progresso do passo. O `anchor` é `(0.5, 1)`, então o sprite é ancorado no centro da base do sqm: os pés ficam ali, e a cabeça sobe 24 px.

As oito direções são reduzidas a quatro poses. A pose `left` já é gerada espelhada no atlas, então não há flip em tempo de execução; as diagonais reaproveitam a pose vertical correspondente.

> O nome e o gênero do ator viajam no contrato, mas não são desenhados: não há nome sobre a cabeça nesta fase. A ordem de desenho é a ordem de criação dos sprites; também não há ordenação por Y.

## Canvas, zoom e câmera

O canvas tem um **buffer lógico fixo de 544x320 px** — a janela de 34x20 sqm. Ele não é redimensionado para o tamanho do container: o renderer é ajustado uma vez para `VIEWPORT_W` por `VIEWPORT_H`, e o zoom é aplicado por CSS sobre o canvas pronto.

A cada mudança de tamanho do container, o `ResizeObserver` chama `computeCanvasLayout(width, height)`, que devolve:

- `zoom`: o menor inteiro cujo canvas cobre as duas dimensões do container, nunca abaixo de 1 (`computeWorldScale` calcula `max(1, ceil(w/544), ceil(h/320))`).
- `canvasWidth` e `canvasHeight`: `544 * zoom` por `320 * zoom`, o tamanho CSS do canvas.
- `offsetX` e `offsetY`: `floor((container - canvas) / 2)`, o recorte que centraliza o canvas. Como o zoom arredonda para cima, o canvas é sempre ao menos do tamanho do container e o offset fica **negativo** quando ele estoura — o excesso é cortado, nunca mostrado como barra.

O `WorldScene` aplica esse layout no `style` do canvas: `position: absolute`, `left` e `top` com os offsets, `width` e `height` com o tamanho CSS. O host tem `position: relative` e `overflow: hidden`, então o offset negativo recorta de verdade e não há letterbox. No momento em que o canvas é anexado, o scene também define `canvas.style.imageRendering = 'pixelated'`, para o navegador não suavizar a ampliação por CSS.

A `Application` é inicializada com `autoDensity: false` e `resolution: 1`: o backing store do canvas continua 544x320, sem multiplicação por `devicePixelRatio`. O `stage` não é ampliado; a `hitArea` é a tela lógica de 544x320.

O clique é convertido em duas etapas, ambas fora do Pixi:

1. O ponto do evento vira coordenada do container: `clientX - rect.left` e `clientY - rect.top`.
2. `screenToTile(screen, offset, zoom, camera)` subtrai o recorte do canvas, divide pelo zoom, soma a câmera e encontra o tile com `pixelToTile`.

A função é pura e testada em `tiles.spec.ts`, incluindo o caso de recorte negativo. Ela é a mesma para clique e toque, porque os dois chegam como `pointertap`.

A cada quadro, o tick lê o `worldStore`:

- A posição do jogador é calculada pelo relógio corrigido.
- A câmera usa o viewport fixo de 544x320, centraliza o **sqm** do jogador — o centro do tile, não os pés — e é limitada aos limites do mapa.
- O container do mundo é posicionado em `-camera`, sempre em pixels inteiros.

O resultado é que a câmera sempre cobre a janela lógica de 34x20 sqm, e a câmera anda em passos de pixel inteiros, com uma suavização curta de poucos quadros (`smoothCamera`) e sem subpixel. Redimensionar a tela muda o zoom e o recorte, não o viewport da câmera nem a janela lógica; o mundo não gira.

> A câmera centralizar o sqm, e não os pés, é o que deixa o personagem ligeiramente acima do centro da tela. O ponto de referência do sprite e o ponto seguido pela câmera são coisas diferentes: um é a base do sprite, o outro é o quadrado que o servidor confirma.

## Ciclo de vida

O `WorldCanvas` monta uma `WorldScene` imperativa em um `useEffect` de montagem única. O `requestMove` chega por uma ref, para uma nova função da sessão não remontar o canvas.

A montagem:

1. O `ResizeObserver` começa a observar o container e o listener de teclado é registrado na janela.
2. `createPixiApp()` resolve uma `Application` já inicializada.
3. O canvas é anexado ao container; o renderer é ajustado para 544x320, o canvas recebe `image-rendering: pixelated` e o `stage` recebe `eventMode = 'static'`, a `hitArea` da tela lógica, o `pointertap` e o ticker.
4. O layout do canvas é aplicado a partir do tamanho do host (`computeCanvasLayout`), e as camadas de chão e de atores são carregadas em paralelo e adicionadas ao container do mundo.

A destruição:

- Marca a cena como descartada, desconecta o `ResizeObserver`, remove o listener de teclado e o `pointertap`, tira o tick do ticker e destrói o chão.
- `destroyPixiApp` chama `app.destroy({ removeView: true }, { children: true })`: os filhos do stage são destruídos, mas **as texturas do cache de assets não são**. Elas continuam no cache e são reutilizadas por uma remontagem.
- A `RenderTexture` do chão é destruída explicitamente, porque ela é criada pela cena e não pertence ao cache.
- Se a montagem assíncrona termina depois de a cena já ter sido descartada, a `Application` é destruída na hora; a camada de chão também é destruída se chegou a ser criada.

> O `StrictMode` do React monta, desmonta e monta de novo em desenvolvimento. O ciclo acima é o que faz a segunda montagem funcionar: o app é recriado, mas os PNGs e os atlas já estão no cache do `Assets`, e as texturas compartilhadas não foram destruídas junto com o primeiro app.

## A cena da caçada

`GameScreen` troca o canvas pela fase da caçada: `WorldCanvas` na cidade e `HuntCanvas` quando `hunt.phase` é `entering`, `active` ou `leaving`. Enquanto a entrada ou a saída acontece, uma camada de transição cobre a cena, mas o canvas da caçada continua montado embaixo.

`HuntScene` segue o mesmo desenho do `WorldScene`: a `Application` do Pixi é criada pelo mesmo `createPixiApp`, o canvas tem o buffer lógico de 544x320 px e o layout é o mesmo `computeCanvasLayout`. A diferença é a fonte do estado: a cena lê o `huntStore` dentro do ticker, não pelo React.

| Camada | O que desenha |
| --- | --- |
| Chão (`groundLayer`) | O mapa da área em uma `RenderTexture`, com um banho de cor sutil por área. |
| Ondas (`effectLayer.waves`) | As ondas de área sob as criaturas, com o alpha caindo depois do `arrivalAt` de cada tile. |
| Criaturas (`creatureLayer`) | A criatura ativa, as selvagens e o treinador, um `AnimatedSprite` por ator. |
| Vida (`healthLayer`) | Uma barra acima de cada criatura: verde para a ativa, vermelha para as selvagens. |
| Efeitos (`effectLayer.fx`) | Projéteis de habilidades de alvo e números de dano flutuantes. |

A ordem das camadas é fixa: ondas, criaturas, vida e efeitos. As criaturas são ordenadas pelo pé (`zIndex` do pixel vertical), então a que está mais abaixo na tela desenha por cima.

A câmera segue a **posição interpolada** da criatura ativa, não o tile confirmado. A cada quadro, o `huntScene` lê o `renderNow`, resolve o segmento do jogador na timeline e calcula o pixel com `computeActorPosition`; esse pixel é o centro enviado ao `computeCamera`, limitado ao tamanho do mapa da área. O treinador não é seguido: ele aparece no rastro, desenhado atrás.

### Criaturas e treinador

O `creatureLayer` carrega dois atlas: `/world/creatures.json` para as espécies e `/world/trainer.json` para o treinador. Cada ator tem um `AnimatedSprite` próprio, reconciliado por id.

- **Criaturas:** a pose vem da direção; `idle` usa 2 quadros em ciclo, `walk` distribui 4 quadros pela duração do segmento esticado e `attack` toca 2 quadros por 350 ms depois do `ability_cast`.
- **Treinador:** usa o mesmo atlas da cidade, com as animações `idle` e `walk`.
- **Alvo:** a criatura ativa mostra um anel no alvo atual (`targetId`).
- **Dano:** uma criatura atingida pisca em vermelho por 220 ms.

O `creatureLayer` também remove o sprite de quem saiu do estado, então uma selvagem morta desaparece do canvas sem depender de um evento de remoção separado.

### Timeline e buffer

Cada ator tem uma timeline curta (`actorTimeline`): o cliente enfileira os segmentos que chegam e resolve a posição pelo `renderNow`, que é o relógio do servidor menos o buffer de reprodução. O buffer é adaptativo (`minRtt/2 + 2 × jitter + 20 ms`, limitado a 30–160 ms) e existe para o segmento chegar antes de o render alcançar o `startsAt`.

O passo **não é esticado**: ele dura o que dura no servidor. Quando a criatura decide esperar, ela fica parada no tile até a próxima decisão; quando o passo chega adiantado, a timeline guarda o próximo e continua sem voltar o sprite.

A caçada usa o `renderNow` para todos os atores, inclusive a criatura ativa. A cidade usa o `now` (sem buffer) para o próprio jogador, porque ele é predito, e o `renderNow` para os outros.

### Efeitos e vida

O `healthLayer` desenha uma barra de 18x3 px a 22 px acima dos pés, com o fundo escuro e a cor do lado. A barra acompanha a posição interpolada do segmento na mesma timeline, não só o tile confirmado.

O `effectLayer` desenha:

- as ondas de área, um retângulo por tile, com a cor do elemento e o alpha caindo em 200 ms a partir do `arrivalAt`;
- o projétil de um `ability_cast` com `targetTile`, que viaja do conjurador ao tile em 260 ms;
- o número de dano de cada evento `damage`, que sobe 8 px e some em 600 ms.

### HUD da caçada

O `GameHud` lê a caçada quando `hunting` é verdadeiro: a barra de habilidades usa a vida e os cooldowns do `huntStore`, e as linguetas do time usam a criatura ativa do snapshot. Os painéis da sessão e da análise aparecem no lugar do botão de play e do botão da loja, conforme [Analisador de Caçada](../../game/HUNT_ANALYZER.md).

### Modais durante a caçada

`GameModals` fica sempre montado na `PlayScreenPage`; a `GameScreen` desenha os filhos em qualquer fase, então mochila e armazenamento abrem sobre o canvas na cidade e na caçada.

O `GameModals` lê a fase do `huntStore` e passa `isHunting` para o `StorageModal`. Com `isHunting`, a leitura do armazenamento continua, mas as ações que mudam o time ficam bloqueadas e a seção do time mostra **Durante a caçada o time fica fechado.** A `BackpackModal` não recebe a trava, porque a mochila não muda o time.

## Protocolo da caçada

As mensagens da caçada formam um ramo próprio do protocolo, com revisão própria (`huntRev`) e o mesmo `v` do envelope.

| Mensagem | Direção | Conteúdo |
| --- | --- | --- |
| `hunt_state` | Servidor → cliente | O snapshot completo: sessão, criatura ativa, treinador, selvagens, ondas, cooldowns, consumíveis, ledger e `serverNow`. |
| `hunt_delta` | Servidor → cliente | Atores alterados, selvagens removidas, ondas, eventos, cooldowns, consumíveis, ledger e a revisão. |
| `hunt_ended` | Servidor → cliente | O motivo do fim e o ledger final. |
| `command { type: 'finalize_hunt' }` | Cliente → servidor | Encerra a caçada. |
| `command { type: 'swap_creature', creatureId }` | Cliente → servidor | Troca a criatura ativa. |

O `huntStore` guarda o snapshot, a fase (`idle`, `entering`, `active`, `leaving`), a revisão aplicada, o erro e os eventos dos últimos 5 s. O `hunt_state` sincroniza o relógio do `worldStore` com o `serverNow` do snapshot e reconstrói o snapshot; o `hunt_delta` faz merge dos atores, remove as selvagens de `removed` e substitui ondas, cooldowns e consumíveis.

A revisão é descartada quando não é mais nova: o delta exige revisão estritamente maior, e o snapshot aceita a revisão igual ou maior, porque ele é a reconstrução do estado. Os eventos são mantidos por 5 s para as animações e os números de dano.

O cliente não usa habilidade nem consumível por conta própria: `use_ability` e `use_consumable` são recusados pelo servidor. O jogador só decide finalizar e trocar a criatura; o resto é a simulação.

## Protocolo de mundo

As mensagens de mundo têm um ramo próprio no protocolo, com revisão própria. O envelope continua levando `v`, e o `PROTOCOL_VERSION` não mudou nesta fase.

| Mensagem | Direção | Conteúdo |
| --- | --- | --- |
| `command` com `{ type: 'move', target: Tile }` | Cliente → servidor | O sqm de destino, dentro do envelope com `reqId`. |
| `move_result` | Servidor → cliente | `ok`, `code?`, `path` (a caminhada, que pode começar pelo segmento já em curso), `reqId` e `worldRev`. |
| `world_state` | Servidor → cliente | `you`, `actors` e `worldRev`: o estado do mundo depois do `select_trainer` e em uma reconexão. |
| `actor_update` | Servidor → cliente | O ator inteiro e a revisão: um jogador entrou na cidade ou começou um passo. |
| `actor_leave` | Servidor → cliente | O id do ator que saiu e a revisão. |

A leitura e a validação ficam em `gameWorldProtocol.ts`; o despacho fica em `gameSocket.ts`. Um `move_result` também resolve o `Promise` pendente daquele `reqId` em `moveRequests.ts`.

### Revisão

`worldRev` é monotônica **por observador** e é independente da revisão do estado do jogador. O `worldStore` guarda a última revisão aplicada e descarta qualquer mensagem cuja revisão não seja estritamente maior (`incoming > current`). A primeira mensagem é aceita qualquer que seja a revisão, porque o cliente não pode assumir onde o contador do servidor começa.

A ordenação vale para **todas** as mensagens de mundo — `world_state`, `actor_update`, `actor_leave` e também `move_result`. Um `move_result` que chega com uma revisão já ultrapassada é descartado, como qualquer outro, e não pode colocar o mundo de volta no passado.

Um `move_result` recusado também carrega uma revisão nova: ele não muda a posição, mas avança o contador. A posição do jogador só é trocada quando o resultado é aceito e tem caminho.

### Relógio

Cada `PathSegment` carrega `startsAt` e `endsAt` absolutos, no relógio do servidor. O cliente não soma durações: ele calcula a posição a partir do instante atual.

O único ponto de sincronização do relógio é o `state_snapshot`: ele traz `serverNow`, e o store guarda a diferença para o relógio local. `now()` devolve `Date.now()` mais essa diferença. O `move_result` não traz um novo `serverNow`.

> Como os tempos são absolutos, uma aba oculta que perdeu quadros volta na posição certa: o ticker do Pixi deixa de receber quadros, mas o relógio continua, e o próximo quadro recalcula a posição. O caminho pode ser pulado visualmente, mas o sqm final é o que o servidor confirmou.

### Movimento, falha e reconexão

- O cliente prediz o **primeiro passo** com a mesma busca ponderada do servidor e o envia como `move`; o personagem sai do lugar no mesmo frame. O resto do caminho vem no `move_result`.
- O `move_result.path` pode começar por um segmento **já em andamento**: quando o jogador clica no meio de um passo, o servidor preserva aquele passo e replaneja a partir do tile em que o treinador está entrando. O cliente guarda a caminhada inteira e continua a interpolação pelos `startsAt`/`endsAt` absolutos — o passo que já estava na tela **não é reiniciado**.
- Quando a resposta aceita o passo predito, o cliente mantém os timestamps do passo em curso e desloca os passos seguintes para começarem no fim dele; quando a resposta traz outro caminho, o caminho do servidor substitui a predição.
- A espera tem timeout de 2 s. Se o canal fechar, todos os movimentos pendentes são rejeitados.
- O canvas limpa a predição quando a resposta é recusada; a posição volta ao tile confirmado, e a tela de conexão assume o problema quando o canal cai.
- As recusas do servidor chegam como `invalid_target`, `tile_blocked` ou `invalid_command` no `move_result`.
- Quando o canal fecha, `resetWorld()` limpa atores, caminhada, revisão e a correção do relógio. Uma reconexão recebe um `world_state` novo e reconstrói os atores a partir dele; nenhum caminho pendente é retomado. O servidor completou o passo em curso antes de registrar a saída, então o `you` do `world_state` vem no tile em que o treinador estava entrando.

## O que o servidor decide

O cliente depende das seguintes decisões do servidor. Os detalhes de implementação estão em [Mundo (servidor)](../server/WORLD.md).

| Decisão | Efeito no cliente |
| --- | --- |
| O caminho é calculado por Dijkstra nas 8 direções, com custo 1 no ortogonal e 3 no diagonal. | O cliente usa a mesma busca para predizer o primeiro passo; o resto do caminho vem pronto e o cliente só interpola. |
| O passo ortogonal dura 300 ms e o diagonal, 424 ms. | A interpolação e os 4 quadros do `walk` usam a duração de cada segmento. |
| Um novo `move` no meio de um passo preserva o passo em curso e replaneja a partir do tile que está entrando. | O `move_result.path` começa pelo segmento em curso; o cliente continua a interpolação pelos timestamps, sem reiniciar o passo. |
| Alvo sólido termina em um sqm livre adjacente; fora do mapa ou acima de 512 passos (sem caminho de passos mínimos) é recusado. | Um clique em uma árvore ainda anda; um clique impossível não muda a posição. |
| A posição é persistida em `trainer_positions` por write-behind (~1 s), e a desconexão completa o passo e faz flush imediato. | Uma reconexão volta ao tile em que o treinador estava entrando, mesmo depois de um restart do servidor. |
| A cidade é um processo só e não há recorte por distância. | Todos os jogadores conectados aparecem uns para os outros. |
| A caçada é simulada no servidor; o cliente recebe snapshot e deltas com atores, vida, ondas e cooldowns. | A cena da caçada só interpola posição, anima e desenha; ela não decide alvo, dano nem uso de habilidade. |
| O servidor publica o delta no instante em que o passo começa. | A timeline recebe o segmento antes de o `renderNow` alcançar o `startsAt`; o passo encadeia sem pausa no fim do tile. |

## Testes

O modelo do mundo é testado no Bun, sem WebGL:

- `apps/client/src/entities/world/model/__tests__/tiles.spec.ts`
- `apps/client/src/entities/world/model/__tests__/scale.spec.ts`
- `apps/client/src/entities/world/model/__tests__/steps.spec.ts`
- `apps/client/src/entities/world/model/__tests__/actorTimeline.spec.ts`
- `apps/client/src/entities/world/model/__tests__/serverClock.spec.ts`
- `apps/client/src/entities/world/model/__tests__/prediction.spec.ts`
- `apps/client/src/entities/world/model/__tests__/actorState.spec.ts`
- `apps/client/src/entities/world/model/__tests__/camera.spec.ts`
- `apps/client/src/entities/world/model/__tests__/worldStore.spec.ts`

A caçada tem testes próprios no modelo puro:

- `apps/client/src/entities/hunt/model/__tests__/creatureAnimation.spec.ts`
- `apps/client/src/entities/hunt/model/__tests__/huntEvents.spec.ts`
- `apps/client/src/entities/hunt/model/__tests__/huntFormat.spec.ts`

O protocolo e o canal também têm testes em `apps/client/src/pages/play/model/__tests__/` (`gameProtocol.spec.ts`, `gameSocketMove.spec.ts`, `worldChannelWiring.spec.ts`, `gameHuntProtocol.spec.ts`, `huntStore.spec.ts`, `huntChannelWiring.spec.ts`, entre outros). Do lado do servidor, o fluxo de `move` pelo WebSocket é coberto por `apps/server/src/__tests__/gameSocketWorld.spec.ts`, e o da caçada, por `apps/server/src/__tests__/gameSocket.spec.ts`.

| Comando | O que verifica |
| --- | --- |
| `bun test apps/client` | Os testes do cliente, incluindo todo o modelo puro do mundo. |
| `bun run --filter @creatures/client typecheck` | A tipagem do cliente e o guarda de tokens do tema. |
| `bun test apps/server` | Os testes do servidor, incluindo `world/path.spec.ts`, `world/registry.spec.ts`, `world/ruler.spec.ts` e `gameSocketWorld.spec.ts`. |

> A suíte não exercita o canvas: tudo o que decide posição, animação, zoom e câmera está no modelo puro. A camada Pixi é verificada visualmente, não no teste automatizado.

## O que ainda não existe

- **Tiles animados:** o atlas tem os quadros de água e grama alta, mas a camada que os anima não existe; o chão usa o primeiro quadro, na cidade e na caçada.
- **NPCs e pontos de interação:** não há NPC nem ação de interação no mundo.
- **Nome sobre a cabeça:** nome e gênero chegam no protocolo, mas não são desenhados.
- **Ordenação por Y na cidade:** a ordem de desenho da cidade é a ordem de criação dos sprites. A caçada já ordena criaturas e treinador pelo pé.
- **Chat e informações de alvo em texto:** não existem; a caçada desenha o anel do alvo, mas não uma etiqueta com nome ou vida em texto.
- **Colisão entre jogadores:** o servidor não considera a ocupação de outros atores ao planejar o caminho.
- **Recorte por distância:** todos os atores presentes na cidade são enviados e desenhados.
- **Predição local:** existe para o primeiro passo na cidade; o caminho confirmado continua vindo do servidor.
- **Múltiplas instâncias:** o servidor assume um processo só; não há Redis nem sticky session.
- **Mobile em paisagem:** o overlay de orientação não existe.
