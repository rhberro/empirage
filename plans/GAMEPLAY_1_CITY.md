# Gameplay 1 — Cidade em grid (PixiJS, servidor autoritativo)

> **Status**: plano revisado pelo @oracle (ses_9724a902f); vereditos reconciliados.
> Quem manda em caso de divergência: o código. Continuidade para outra sessão: §11.
> Fontes: recon focado de play/ws/contracts + `plans/PLAN.md` + decisões do usuário (2026-10-23).

## 1. Objetivo

Primeira gameplay real: na **cidade**, o jogador vê o mapa em grid (PixiJS),
o próprio treinador e os **outros jogadores** (visíveis, sem colisão),
**clica para andar** e a câmera segue o treinador. Estilo Pokémon GBA/Tibia:
top-down, pixel-perfect, 16px/sqm, escala inteira, roda em máquinas fracas.

## 2. Decisões fechadas (usuário)

| # | Decisão | Valor |
| --- | --- | --- |
| D1 | Tiles | 16px por sqm; movimento 8 direções, 1 sqm por passo |
| D2 | Sprite | Tamanho livre, sempre com ponto base centralizado no sqm |
| D3 | Pixel perfect | Inteiros sempre; escala inteira; `roundPixels` |
| D4 | Janela de visão | **34x20 fixo** (544x320 lógico), zoom inteiro **cover** (sem barras; recorta) — rodada 2 |
| D5 | Assets | Procedural por agora; troca por arte real = sobrescrever PNGs |
| D6 | Direções da sprite | 4 (U/D/L/R) + espelho nas laterais-esquerda (GBA) |
| D7 | Pathfinding | **Servidor calcula tudo** (BFS); cliente só interpola |
| D8 | Outros jogadores | Visíveis na cidade, sem colisão |
| D9 | Câmera | Segue o treinador na cidade (caçada seguirá criatura — fase futura) |

Animações: `idle` e `walking` nesta fase; `hit`/`attacking` ficam para o combate
—a máquina de estados do ator já prevê os estados extras.

## 3. Não-objetivos desta fase (YAGNI — revisão @oracle)

- Batalha/caçada, magias, efeitos em sqm, NPCs, interação entre jogadores.
- **Persistência durável de posição** (sem migration): posição vive em memória
  do processo; disconnect mantém o último tile no registry durante o boot;
  reconnect no mesmo boot volta ao último tile conhecido (caminho pendente é
  descartado); após restart, spawn no centro. Multi-instância é pendência.
- **Comando `face` cortado**: o facing deriva do `move` aceito.
- Andares/ocultação (o nosso mundo não tem isso). Mobile landscape.

## 4. Estado atual (fontes conferidas)

- Cliente: canal completo em `pages/play/model` (ticket → `select_trainer` →
  `command_result{rev}` → `state_snapshot`, `epoch/rev`, fallback REST).
  `CanvasPlaceholder.tsx:219` é o slot do canvas. Parser `gameProtocol.ts`
  e despacho em `gameSocket.ts:readPayload` são os pontos de extensão.
- Servidor: `gameSocket.ts` recusa todo `command` (`invalid_command`) — o
  movimento é o **primeiro comando real** e vira o padrão da caçada (Fase 4
  de `plans/PLAN.md`). `pushState` (rebuild do banco por push) fica dono do
  snapshot do jogador; o mundo usa canal próprio e leve.
- Contratos: nenhum tipo de mundo existe; tudo é criação nova.
- PixiJS não instalado; configs já decididas em `STACK.md` §PixiJS
  (`resolution: 1`, `antialias: false`, `roundPixels`, `nearest`, escala inteira,
  canvas dimensionado pelo container).

## 5. Arquitetura

### 5.1 Contratos e mapa (Fase 1 — fonte única)

Novo `apps/shared/contracts/world.ts` (tipos de mundo) + adições em
`game.ts`. **Sem bump de `PROTOCOL_VERSION`** (revisão @oracle): o deploy é
atômico no monorepo; mensagem/comando desconhecido é ignorado com clareza;
bump fica reservado para quebra de envelope.

```ts
// apps/shared/contracts/world.ts
type Direction = 'up'|'upRight'|'right'|'downRight'|'down'|'downLeft'|'left'|'upLeft';
type Tile = { x: number; y: number };

// Segmento(curso) com timestamps ABSOLUTOS do servidor (SERVER CLOCK):
// o cliente recalcula a posição pelo seu serverNow corrigido — aba oculta,
// lag e reconnect derivam a posição certa em vez de "aderir" a durações.
type PathSegment = { from: Tile; to: Tile; dir: Direction; startsAt: number; endsAt: number };

// O que circula no socket (dinâmica, leve):
type ActorMedia = {
  actorId: string;          // userId
  name: string; gender: Gender;
  dir: Direction;
  position: Tile;           // tile confirmado (base do sqm)
  segment?: PathSegment;    // passo em curso, quando houver
};

// worldRev: monotônico por observador (ordenação de applicação no cliente,
// espelho do padrão rev/epoch do PlayerState — rev própria, dona: worldStore).
```

Comandos (`GameCommand`): apenas `{ type: 'move'; target: Tile; withRequestSeq }`
(com `reqId` do envelope) — dedup por `reqId` no registry.

Mensagens (`ServerMessage` estimadas):
- `move_result { reqId; ok; code?: GameErrorCode; worldRev; path: PathSegment[] }`
  — **única** resposta ao `move` (o próprio ator não espera broadcast).
- `world_state { worldRev; you: ActorMedia; actors: ActorMedia[] }` — após
  `select_trainer` OK e a cada reconnect (com progresso atualizado: `segment`
  vigente é parte do `you`/atores; caminhos pêndabs nome vetor de segmentos
  futuros vão nos `move_result` apenas). Não é reenviado em outras trocas.
- `actor_update { worldRev; actor: ActorMedia }` — outro jogador entrou no
  alcance, virou/vai andar (um segmento de cada vez).
- `actor_leave { worldRev; actorId }` — saiu da cidade/conexão caiu.

Códigos novos: `invalid_target`, `tile_blocked`.

**Mapa — fonte única** (mata o risco de drift): `apps/shared/world/` contém
`city.json` (gerador commitado) + `mapSchema.ts` (shape + ids de tile + flags
`solid`). Servidor importa para colisão/pathfinding; cliente importa via
bundle (não via socket). `blocked` deriva dos ids sólidos + spawn not solid.

### 5.2 Servidor — `apps/server/src/world/` (padrão de `hunt/`)

- `registry.ts` — estado em memória por processo: posição/direção confirmadas,
  segmento em curso e fila de segmentos por `userId`; relogio do servidor;
  `worldRev` por observador; dedup `reqId`; "confirmTile" avança quando o
  `endsAt` do segmento passa (registro roda por relógio, sem tick explícito).
- `path.ts` — **BFS 8-direção** custo uniforme: checagem de canto (não cruza
  por diagonais quando dois ortogonais vizinhos são sólidos), alvo sólido →
  **alcance+1** (parar no sqm livre adjacente mais próximo); `move` recebido
  durante caminho **cancela o segmento em curso e replaneja a partir do tile
  confirmado** (segunda revisão @oracle); `move` para o tile atual = parar.
- `ruler.ts` — aplica `move`: valida alvo dentro do mapa/alcance; constrói
  segmentos com duração real (300 ms orto / ~424 ms diagonal); responde
  `move_result`; agenda `actor_update` para os **outros** sockets da cidade.
- `broadcaster.ts` — espelho leve do `stateBroadcaster`: fila por conta, envia
  só dinâmica de mundo. Entrada/saisse da cidade = `actor_update`/`actor_leave`
  para todos os sockets conectados. Sem tocar banco.
- `gameSocket.ts` — aceitar `move` em `readCommand`; `world_state` é enviado
  logo após o `command_result` do `select_trainer` (e após reconnect); a
  mensagem de mundo é **posterior e separada** do snapshot do jogador.

### 5.3 Cliente — fatia `entities/world/` (FSD, domínio reutilizável)

```
entities/world/
  index.ts          API pública (fim de imports internos)
  model/            MÓDULO PURO (testes bun, sem WebGL)
    tiles.ts        coord math global↔tile com escala inteira
    scale.ts        computeWorldScale(w,h interchange/reference): floor, min param
    steps.ts        posição px por relógio corrigido; snap ao voltar de aba oculta
    actorState.ts   idle/walking (+futuros) → frame/flip; 4 dir + espelho
    camera.ts       câmera px inteira, clamp aos limites do mapa
    worldStore.ts   dono ÚNICO da dinâmica (precede playerStateSync; rev própria)
  ui/
    WorldCanvas.tsx  monta/destr mutations App; container domina o tamanho
    pixiApp.ts       Application (configs STACK.md), `app.init()` async, StrictMode-safe
    layers/          ground (RenderTexture 1x), actors, animatedTiles (fase B)
    actorSprite.ts   AnimatedSprite do atlas; pés no sqm; flip no espelho
```

- **Assets fora da fatia** (Steiger): generated ao `public/world/` (PNGs +
  atlas JSON) carregado por `Assets.load`; o mapa vem do bundle (shared).
- **Ground inteiro em 1 RenderTexture** (~1536x1024): desenhado uma vez z
  carga; o tick só move. Disciplina (oracle): `scaleMode: 'nearest'`,
  `mipmap: false`, `destroy(true, { children, texture })`, dimensões inteiras.
- Inteiros **antes** de `roundPixels` (rede de segurança, não fonte).
- `ResizeObserver` no container; `scale = max(min, floor(min(w/544, h/320)))`,
  min configurável (1 now); resize **não rotaciona**.
- Câmera: `floor(ator.px - viewport/2)` clampado ao mapa — a câmera anda em
  px inteiros junto do passo (nada de subpixel).
- Input: clique/toque → `toLocal` → tile → `move`; WASD/setas = `move` para o
  adjacente da direção. Feedback honesto: nada anda antes do `move_result`
  (D7), mas o `moving_result` chega rápido e com timestamps: a posição certa
  é derivada por relógio — sem predição local.
- Aba oculta: ticker do Pixi pausa; ao voltar, posição vem do relógio
  corrigido (snap) — porque os timestamps são absolutos.

### 5.4 Assets procedurais (D5) — `apps/client/scripts/gen-assets.ts` (bun)

- Gera PNGs em `public/world/`: tiles 16x16 (chão, caminho, água x2 frames,
  grama x2 frames, casa/cerca/etc.), atlas do treinador 16x24 x 4 direções
  (idle 2 frames ~800ms/loop; walk **4 frames** por passo — oracle: 2 fica
  picotado), dispar o JSON atlas formato spritesheet do Pixi.
- Paleta fixa, pixels alinhados: pixel-perfect por construção. Arte real
  futura = sobrescrever PNGs sem tocar código.
- **Fase A/B**: A gera tudo com frames prontos; render core (Fase 4) usa
  static primeiro; B ativa `animatedTiles` (água/grama) — atlas já feito.

## 6. Constantes de design (validar feel com designer/HUD na Fase 7)

| Constante | Valor |
| --- | --- |
| Tile | 16px |
| Janela de referência | 34x20 tiles (parametrizada) |
| Passo ortogonal | 300 ms/sqm |
| Passo diagonal | ~424 ms/sqm (√2 × 300 — diagonal não pode parecer rápida) |
| Idle | 2 frames, ~800 ms/loop |
| Walk | 4 frames/passo |
| Trainer | 16x24, ponto base = pés no centro do sqm |
| Mapa | 96x64 tiles, spawn no centro (ajustável pelo gerador) |

## 7. Fases e lanes (escopos de escrita isolados)

| Fase | Lane | Escopo de escrita | Depende de | Status |
| --- | --- | --- | --- | --- |
| F1 | **Contratos+mapa** (orchestrator, pequeno) | `contracts/world.ts`, `contracts/game.ts`, `contracts/index.ts`, `contracts/city.json` (fonte única), `apps/server/scripts/genCityMap.ts` | — | [x] feita (typecheck verde) |
| F2 | **Servidor-world** (fixer) | `apps/server/src/world/**`, `ws/gameSocket.ts` | F1 | [x] feita (21 specs verdes; loader do mapa consolidado em `contracts/city.ts`, server re-exporta) |
| F3 | **Assets-procedural** (fixer) | `apps/client/scripts/gen-assets.ts`, `apps/client/public/world/**` | F1 (schema/id) | [x] feita (commit `1bdab00`, atlas 100% determinístico) |
| F4 | **Cliente-render** (designer) | `entities/world/model/**` (exceto worldStore), `entities/world/ui/**`, `pages/play/ui/PlayScreenPage.tsx` (slot do canvas), install pixi.js | F1, F3, F5 | [x] feita (pixi 8.22.0; 251 testes cliente verdes; API v8 real conferida nos .d.ts) |
| F5 | **Wiring canal** (fixer, pequeno) | `pages/play/model/**` + `entities/world/model/worldStore.ts` + `entities/world/index.ts` | F1 | [x] feita (223 testes/cliente verdes; `requestMove` exposto em `useGameSession`; `useWorldState`/>`worldStore` em `~/entities/world`) |
| F4B | **Animated tiles** (designer, fast follow) | só `entities/world/ui/layers` | F4 + atlas F3 | pendente |
| F4C | **Viewport fixo 34x20** (designer) | `entities/world/model/scale.ts` + `ui/WorldCanvas` (letterbox/zoom CSS inteiro) | F4 + decisão D4 estrita | [x] feita (buffer 544x320; zoom CSS 1x/2x validado no browser; clique correto) |
| F6 | **Docs** (documenter) | `docs/game/WORLD.md` novo, `docs/game/CITY.md`, `STACK.md`, `plans/PLAN.md` | F2..F5 | [x] feita — 3 docs novos + refresh F6b (viewport 34x20 estrito, spec de integração) |
| F7 | **Validação** | nada (read-only + fixes de lane própria) | tudo | [x] funcional: render, clique-andar, câmera+clamp, alcance+1, viewport fixo 34x20 (zoom 1x/2x), clique sob zoom 2, outro jogador visível, console limpo; testes/lint/format/typecheck verdes |
| F7b | **Spec integração `move`** (orchestrator) | `apps/server/src/__tests__/gameSocketWorld.spec.ts` (6 testes) | F2 | [x] feita (37 testes no canal+mundo) |

Sequência: **F1 → (F2 ∥ F3 ∥ F5) → F4 → (F4B ∥ F6) → F7**.
Ownership travado: F4 é a única lane que edita `PlayScreenPage.tsx`;
F5 nunca edita `ui/`; F2 nunca edita `pages/`; F3 nunca edita src.

## 8. Validação (F7)

- Testes bun puros: `scale.ts` (casos de contorno), `steps.ts` (relógio
  corrigido, snap), `actorState.ts` (4 dir+espelho, frames), `camera.ts`
  (clamp), `tiles.ts`; servidor: `world/path.spec.ts` (BFS: bloqueados, canto,
  alcance+1, replanejamento) + spec de `move` em ws (dup `reqId`, malígn).
- `bun run format`; `lint:fix`; `lint`; `--filter @creatures/client typecheck`
  (token guard); `test:integration` do servidor para o fluxo de ws.
- Visual (agent-browser): login conta teste → cidade renderizada; clique em
  tile → anda 34x20; câmera clampada nos limites do mapa; puxe escala/teste
  em várias larguras (inteiros); segunda aba = outro jogador visível que anda
  e não colide nem trava.
- Suíte não exercita WebGL: tudo de decisão está em `model/` puro.

## 9. Riscos / decididos (não bloqueiam)

- Latência do primeiro clique: aceitável (D7) — posicionamento por timestamps
  absolutos reduz a sensação; predição local é RFC futura, não agora.
- `pushState` full-rebuild por push continua intocado: o mundo não passa por
  ele (broadcaster de atores leve). Fase 2 do plan maior (estado em memória)
  segue como pendência geral do projeto.
- Multi-instância: single-process assumido; registrado como pendência
  (espelho do §4.5 de plans/PLAN.md; Redis/sticky quando houver 2º processo).
- O starCada listener que movimenta todos os atores adjacentes ao humano não precisa de tick: o relógio é a fonte — server e cliente derivam; barato e determinário.

## 10. Referências do jogo (consultar antes de render/feel)

- `docs/game/CITY.md` — movimento por clique/WASD/setas, cidade segura,
  cura/loja, ver outros jogadores.
- `docs/game/PLAY_SCREEN.md` — layout tela (toolbar + canvas + overlays).
- `docs/technical/client/STACK.md` §PixiJS/Zustand — configs e leitura por frame.
- `docs/technical/client/STRUCTURE.md` — FSD/Steiger.
- `docs/CODING_STYLES.md` — estilo e comentários "the why".

## 12. Rodada 2 — correções de movimento e viewport (pedido do usuário)

| Item | Problema | Decisão | Lane |
| --- | --- | --- | --- |
| R2.1 | Personagem prefere diagonal sempre | Pathfinding ponderado estilo Tibia: ortogonal custa 1, diagonal custa 3; duração 300ms orto / 424ms diag mantida | server-move |
| R2.2 | Spam de clique trava a animação | `move` durante passo em curso: **completar o passo atual** e replanejar a partir do tile que está entrando; `move_result` inclui o segmento em curso; `worldRev` mais novo vence no cliente | server-move + client-move |
| R2.3 | Letterbox gera faixas pretas | Viewport **cover** com zoom inteiro: `zoom = max(1, ceil(w/544), ceil(h/320))`, canvas centralizado/recortado, `overflow: hidden` | viewport-cover |
| R2.4 | Posição não persiste de verdade | Tabela `trainer_positions` (migration); no disconnect completa o passo em curso e faz flush; write-behind ~1s; join lê a posição persistida (fallback spawn) | server-move |

Validação R2: specs (custo diagonal, replanejamento preservando o passo, cover, persistência/reconnect), gate completo e browser (3 tiles à esquerda = sem diagonal; spam de cliques anda sem travar; sem faixas; reconectar no tile correto).

**Status**: R2 completa — R2.1/R2.2/R2.4 [x] (Dijkstra 1/3, passo em curso preservado, `trainer_positions` + write-behind/flush; 584 testes no repo); R2.3 [x] (cover inteiro); cliente [x] (ordenação `worldRev`); docs [x] (WORLD/STACK/PLAY_SCREEN/CITY/PLAN atualizados). Validação visual: 3 tiles à esquerda sem diagonal, spam de cliques sem travar, cover sem faixas, reconexão no tile persistido.

## 13. Continuidade (próxima sessão)


- Estado real: ver §7 (marcar Status com [x] ao fechar cada fase).
- Lanes no Job Board: `server-world`, `assets-procedural`, `client-render`,
  `wiring`, `docs-world`. Sempre retomar deste arquivo antes de recontar.
- Pendências deixadas de propósito: multi-instância; persistência de posição;
  `hit`/`attacking`; efeitos de magia em sqm; mobile landscape.
