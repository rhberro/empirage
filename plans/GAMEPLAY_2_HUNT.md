# Gameplay 2 — Caçada em tempo real (servidor autoritativo)

> **Status**: plano aprovado pelo usuário em 2026-10-23; arquitetura revisada pelo @oracle.
> Quem manda em caso de divergência: o código. Continuidade para outra sessão: §12.
> Fontes: recon de servidor/cliente, `docs/technical/server/HUNT.md`, `docs/game/SKILL_BAR.md`,
> `docs/game/CREATURES.md`, `docs/game/TRAINER.md`, pesquisa TFS/Canary e decisões do usuário.

## 1. Objetivo

Entregar o **vertical slice** da caçada: o jogador entra em uma área, assiste à criatura
ativa seguir um loop, targetar e lutar sozinha contra criaturas selvagens, com
habilidades, áreas, consumíveis, drops e barras de vida — tudo simulado no servidor.

A caçada é uma **instância por treinador**. Não há party, colisão entre jogadores nem
interação entre instâncias nesta fase.

## 2. Decisões fechadas

| # | Decisão | Valor |
| --- | --- | --- |
| D1 | Curva de combate | Vida = vitalidade (22–28 no nível 1); o dano efetivo usa `DAMAGE_SCALE = 0.25` sobre o poder da habilidade |
| D2 | Ataque básico do jogador | **Não existe**: a criatura do treinador só usa as 4 habilidades equipadas |
| D3 | Ataque básico selvagem | Melee implícito, 1 golpe a cada 2000 ms (piso de 1000 ms), alcance 1 (8 vizinhos) |
| D4 | Escopo | Vertical slice completo (servidor + protocolo + cliente + uma área jogável, com as 4 áreas geradas) |
| D5 | Assets | Procedurais, estendendo `scripts/gen-assets.ts`; trocar por arte real = sobrescrever PNGs |
| D6 | Loot | Creditado na mochila **no abate**; rolls independentes por item |
| D7 | XP | Fórmula provisória, acumulada no abate; **sem level-up** nesta fase |
| D8 | Captura | Fora de escopo; o slot de dispositivo fica no-op |
| D9 | Motor | Determinístico **event-driven** (`advanceUntil`), não tick fixo; 100 ms é só coalescência de push |
| D10 | Instância | Uma sessão em memória por treinador; estado serializado em `hunt_sessions.simulation_state` |
| D11 | Câmera | Segue a criatura ativa; o treinador a segue a 3 sqm e é decorativo |
| D12 | Área | Mapa, loop, spawns e respawn vêm de um JSON por área em `apps/shared/contracts/hunts/` |

## 3. Não-objetivos (YAGNI desta fase)

- Party, PvP, colisão entre criaturas, multi-processo/Redis.
- Captura e dispositivos.
- Level-up, evolução, missões, conta paga e recuperação de stamina.
- Arte definitiva, tiles animados, ordenação por Y, nome sobre a cabeça.
- Habilidades com condições (veneno, buff, escudo) e efeitos sonoros.
- Reposicionamento manual da criatura ou do treinador pelo jogador.

## 4. Regras de combate

### 4.1 Atributos e vida

Os atributos atuais seguem a fórmula existente em `docs/game/CREATURES.md`:

```
Atributo = floor(BV × (1 − 0.3 + 0.6 × PV/100) × (1 + (N−1) × 0.05))
```

A vida máxima é o atributo de vitalidade. A vida restante é `current_hp`, persistida.
Criatura sem `current_hp` entra na caçada com a vida cheia.

### 4.2 Dano

```
levelFactor = 1 + (level − 1) × 0.05
attack  = habilidade.element === 'neutral' ? ataqueFísico : ataqueMágico
defense = habilidade.element === 'neutral' ? defesaFísica : defesaMágica
ratio   = attack / (attack + defense)          // 0 < ratio <= 1
effect  = type_effectiveness[element][defender.element] ?? 1
damage  = max(1, round(habilidade.damage × levelFactor × 0.25 × ratio × effect))
```

- O elemento neutro é físico; fogo/água/planta são mágicos.
- A tabela de efetividade hoje só tem `fire > plant = 1.5`; o resto é 1.
- O dano é sempre ≥ 1.
- Não há crítico, esquiva nem resistência além da defesa e do elemento.

### 4.3 Habilidades

O catálogo ganha os campos que faltam (migration):

| Campo | Tipo | Uso |
| --- | --- | --- |
| `target_type` | `target` \| `area` | Como a habilidade escolhe os alvos |
| `range` | int | Alcance máximo em sqm (Chebyshev) para `target` |
| `area_shape` | `line` \| `circle` \| null | Geometria da área |
| `area_length` | int | Comprimento da linha, na direção do alvo |
| `area_radius` | int | Raio do círculo, centrado no alvo |
| `area_step_ms` | int | Intervalo de propagação por sqm |
| `travel_ms` | int | Atraso do impacto target (animação), padrão 0 |

Seed das 5 habilidades existentes:

| Habilidade | Elemento | Tipo | Alcance/área |
| --- | --- | --- | --- |
| Brasa | fogo | target | range 5 |
| Ígnea | fogo | area | círculo raio 2 no alvo, 150 ms/sqm |
| Garra | neutro | target | range 1 |
| Jato | água | target | range 6 |
| Espinho | planta | area | linha 4 na direção do alvo, 200 ms/sqm |

Habilidade de área:

- A geometria é resolvida no cast e vira uma lista de tiles com `arrivalAt`.
- O dano é aplicado quando a frente alcança cada tile; cada criatura é atingida no máximo uma vez por cast.
- Não há friendly fire: a área atinge apenas o lado oposto ao conjurador.
- A onda continua mesmo se o conjurador morrer.

### 4.4 Rotação do jogador (SKILL_BAR)

Implementação exata de `docs/game/SKILL_BAR.md`:

- Cada habilidade equipada tem `readyAt` próprio (timestamp absoluto no servidor).
- Existe um intervalo global de 1000 ms entre usos de habilidade (`nextAbilityAt`).
- No instante da decisão, são elegíveis as habilidades com `readyAt <= now` e alvo dentro do alcance.
- A escolha ordena por `readyAt` ascendente (quem está pronta há mais tempo vence) e, no empate, pelo slot da esquerda para a direita.
- Usar define `readyAt = now + cooldown_ms` e `nextAbilityAt = now + 1000`.
- Equipar/trocar habilidade define `readyAt = now + cooldown_ms` (a regra já documentada).
- Trocar de criatura não zera cooldown: o estado é por criatura, guardado no `simulation_state`.

### 4.5 Consumíveis

- Cada slot tem `triggerHpPercent`; o uso acontece quando `hp/maxHp × 100 <= trigger`.
- O relógio é separado do de habilidades: um consumível pode ser usado no mesmo segundo de uma habilidade.
- Cada item tem `heal_percent` (0–100) e `cooldown_ms`; itens sem `heal_percent` não são usados pela criatura.
- Usar cura `round(maxHp × heal_percent / 100)`, limitado a `maxHp`, e decrementa 1 unidade da mochila.
- O decremento é atômico no checkpoint; se a mochila zerar, o slot para de disparar.
- Poções propostas: Fraca 25% (2000 ms), Cura 50% (2000 ms), Cura Forte 80% (2500 ms).

## 5. IA

### 5.1 Criatura do jogador

- Sem target: segue o `loop` da área, um sqm por passo (300 ms ortogonal / 424 ms diagonal).
- Target: a **selvagem mais próxima** a até **7 sqm** (Chebyshev). O target é mantido até a selvagem morrer ou sair de **9 sqm** (histerese para não oscilar na borda).
- Com target: para o loop, persegue até entrar no alcance da habilidade elegível e usa a rotação.
- Sem target: retorna ao **nó mais próximo do loop** por pathfinding e retoma o loop.
- Prioridade absoluta: target > loop.

### 5.2 Criaturas selvagens

- Todas nascem na entrada da caçada.
- Target: a criatura do jogador se estiver a até 7 sqm (Chebyshev); perde ao passar de 9 sqm ou se ela desmaiar.
- Com target: persegue até o menor alcance entre as habilidades da espécie (1 quando não há habilidades); usa melee quando adjacente.
- Sem target: random walk no estilo pedido — 1 ou 2 passos, pausa de 0,6–1,8 s, repete. Um passo por vez, no máximo 1 por segundo. Se estiver a mais de 3 sqm do spawn, caminha de volta antes de vagar.
- Habilidades: **todas as da espécie**, independentemente de nível. Cada uma tem `chance` (0–100) e `interval_ms`; a decisão roda a cada 1000 ms e cada habilidade rola independentemente, com cooldown próprio.
- Melee: implícito, 2000 ms, alcance 1, dano pela fórmula com `power = ataqueFísico` (sem `ability.damage`). O piso é 1000 ms; o valor atual é 2000 ms para o jogador sobreviver à primeira área.
- A selvagem não persegue fora do raio: ao perder o target, volta ao comportamento idle/spawn.
- Não há fuga por vida baixa nesta fase.

### 5.3 Números iniciais (Tibia-like, ajustáveis)

| Parâmetro | Valor |
| --- | --- |
| Aquisição de target | 7 sqm |
| Perda de target | 9 sqm |
| Perseguição melee | para a 1 sqm |
| Perseguição ranged | para o alcance da habilidade |
| Melee selvagem | 2000 ms, 1 sqm |
| Chance de habilidade selvagem | 4–15% por decisão (1000 ms) |
| Intervalo de habilidade selvagem | 2000–7000 ms (cooldown próprio) |
| Random walk | 1–2 passos, pausa 600–1800 ms, ≤ 1 passo/s |
| Retorno ao spawn | acima de 3 sqm |
| Respawn | definido por spawn no JSON da área |

## 6. Conteúdo da área (JSON)

Arquivo por área em `apps/shared/contracts/hunts/<slug>.json`, carregado pelo mesmo
padrão de `city.ts` (commitado, lido pelos dois lados, sem viajar pelo socket):

```json
{
  "name": "Campina Cinzenta",
  "width": 40,
  "height": 30,
  "spawn": { "x": 20, "y": 15 },
  "tiles": [[0]],
  "loop": [{ "x": 10, "y": 10 }],
  "spawns": [
    {
      "species": "brasa",
      "x": 8,
      "y": 8,
      "level": 2,
      "respawnMs": 12000
    }
  ]
}
```

Regras de validação na carga:

- `tiles.length === width × height`.
- Todo tile do `loop` é andável e o loop é fechado (o último nó é adjacente ao primeiro).
- `spawn` e todos os pontos de `spawns` são andáveis.
- `species` existe no catálogo; `level >= 1`; `respawnMs` entre 5000 e 3600000.
- O caminho do loop não atravessa tile sólido entre nós consecutivos.

Geração: `apps/server/scripts/genHuntMaps.ts` cria as 4 áreas de forma determinística
(reaproveitando os ids de tile da cidade) e valida tudo antes de gravar. O mapa tem
96x64, bordas de árvore, um loop fechado em 20,16–75,47 e 16 spawns internos
em grade 4x4, com pelo menos 6 sqm entre si (ver D13).

## 7. Simulação e persistência

### 7.1 Estado

`HuntSimState` (JSONB) contém:

- `simulatedAt` — cursor próprio da simulação.
- `areaSlug`, `loopIndex`, `trainer: { tile, path }`.
- `creature` — criatura ativa: id, espécie, nível, HP, posição, segmento, alvo, `abilityReadyAt[4]`, `nextAbilityAt`, `consumableReadyAt[2]`, trail.
- `wilds[]` — cada selvagem: id, spawnIndex, espécie, nível, HP, posição, segmento, alvo, cooldowns, `nextDecisionAt`, `state`.
- `spawns[]` — `spawnIndex`, `respawnAt`, `aliveWildId | null`.
- `waves[]` — ondas de área em voo: `abilityId`, `casterId`, `startedAt`, `tiles[]` com `arrivalAt`.
- `ledger` — abates, drops, XP, consumíveis gastos, encontros.
- `rng` — `seed` e `draws` (o mesmo fluxo `rng.ts`).

### 7.2 Avanço

`advanceUntil(state, untilMs, content) -> { state, events }` é **puro**:

- Encontra o próximo instante interessante: fim de passo, `readyAt`, `nextDecisionAt`, `arrivalAt` de onda, `respawnAt`, ou `untilMs`.
- Salta para ele, aplica a transição e repete até `untilMs`.
- Nunca lê `Date.now()` nem `Math.random`; o tempo vem por argumento e a aleatoriedade do `rng`.
- Eventos: `step`, `target_changed`, `ability_cast`, `damage`, `heal`, `death`, `spawn`, `loot`, `xp`, `hunt_ended`.
- O stream de RNG tem ordem fixa e é **um só**: qualquer novo sorteio entra no fim do fluxo, nunca em um contexto paralelo.

### 7.3 Sessão e runner

- O runner mantém `Map<trainerId, Runtime>` em memória.
- Um `setInterval` de 100 ms chama `advanceUntil(runtime.state, now)` e, se houve evento, publica delta e marca dirty.
- O shell de stamina/offline continua usando `resolveHuntRuleEnd`; o runner encerra pelo mesmo motivo e faz soft-close.
- Checkpoint: `hunt_sessions.simulation_state` + `last_simulated_at` a cada 2 s quando dirty e no close; escrita em lote.
- Hidratação: no boot e no reconnect, lê `simulation_state`, roda `advanceUntil(now)` e retoma.
- `no_viable_creature`: encerra no instante exato em que a última criatura desmaia, não no próximo minuto.
- `swap_creature` troca a ativa na hora, mantém os cooldowns por criatura e atualiza o trail.
- `finalize_hunt` agenda o fim para `now` e responde `command_result`.
- O jogador não pode usar habilidade/consumível manualmente; `use_ability`/`use_consumable` são recusados.

### 7.4 Persistência de efeitos colaterais

- Loot: `trainer_items` upsert (+1 por unidade) no abate.
- XP: `creatures.experience` da ativa (+100%) e das demais vivas do time (+10%).
- HP: `creatures.current_hp` da ativa no checkpoint e no close.
- Stamina: debitada do treinador no close, com o valor restante calculado pelo shell.
- Nenhuma escrita por evento de dano; o checkpoint agrega.

## 8. Protocolo (WebSocket)

Novas mensagens em `apps/shared/contracts/game.ts` / `huntSim.ts`:

| Mensagem | Direção | Conteúdo |
| --- | --- | --- |
| `hunt_state` | S→C | snapshot completo ao entrar/reconectar: sessão, criatura, treinador, selvagens, ondas, cooldowns, vitals, ledger, `huntRev`, `serverNow` |
| `hunt_delta` | S→C | atores alterados, spawns/despawns, ondas, eventos, `huntRev` |
| `hunt_ended` | S→C | motivo, ledger final, `huntRev` |
| `command { type: 'finalize_hunt' }` | C→S | encerra |
| `command { type: 'swap_creature', creatureId }` | C→S | troca a ativa |

- `huntRev` é monotônica por observador, como `worldRev`.
- O cliente descarta mensagens com revisão não estritamente maior.
- O delta de 100 ms coalesce o que mudou; movimento viaja como `PathSegment` uma vez por passo, nunca por frame.
- Cooldown viaja como `readyAt` absoluto; o cliente conta o tempo com o `serverNow` corrigido.

## 9. Rotas

- `POST /api/hunts` `{ huntAreaId }` — valida área, nível mínimo, stamina ≥ 30 e ausência de sessão ativa; cria a sessão e responde `{ hunt }`.
- `GET /api/hunts/current` — devolve a sessão ativa do treinador ou 404; usado no reconnect/refresh.
- `DELETE /api/hunts/current` — finaliza (mesma regra do comando).
- Todas protegidas; o treinador vem do token, nunca do corpo.

## 10. Cliente

### 10.1 Estado

- `huntStore` (zustand vanilla) com `huntRev`, `status`, sessão, atores, ondas, cooldowns, vitals e ledger.
- `SkillBar`/`Vitals` preferem o valor vivo da caçada e caem para `PlayerState` na cidade.
- Relógio: reutilizar o offset do `worldStore`; não criar um terceiro relógio.

### 10.2 Cena

- `PlayScreenPage` escolhe `HuntCanvas` quando `huntStore.status === 'active'`, senão `WorldCanvas`.
- `HuntCanvas`/`HuntScene` reutiliza `pixiApp`, `scale`, `tiles`, `steps`, `camera`.
- `groundRenderer` passa a receber o mapa (cidade ou área) em vez de `CITY_MAP` fixo.
- Camada de criaturas: um `AnimatedSprite` por criatura, atlas por espécie, poses down/up/right/left, animações idle/walk/attack.
- Camada de barras de vida: `Graphics` acima de cada criatura, incluindo a do jogador; cor por lado (aliado/ selvagem) e fundo escuro.
- Camada de efeitos: ondas de área por tile com `arrivalAt`, flash/projétil para target, número de dano opcional.
- Câmera segue a criatura ativa; o treinador é desenhado atrás, no trail.

### 10.3 Fluxo

- `StartHuntButton` chama `POST /api/hunts`, fecha modal/drawer e mostra loading até `hunt_state`.
- `Finalizar Caçada` faz a contagem de 5 s e envia `finalize_hunt`; ao receber `hunt_ended`, mostra loading e volta para a cidade.
- Elementos de cidade somem na caçada; painéis da sessão/análise aparecem com números reais.

### 10.4 Assets

- `scripts/gen-assets.ts` ganha o atlas `creatures.json/png` para as 5 espécies.
- Reaproveitar os tiles da cidade no chão das áreas nesta fase.
- Efeitos são `Graphics`/sprites simples; sem atlas dedicado.

## 11. Fases e aceite

| Fase | Entrega | Aceite |
| --- | --- | --- |
| A | Migration, contratos, JSONs das 4 áreas, loader e validação | `bun test` verde; carregar as 4 áreas sem erro; migration aplicada |
| B | Motor puro `advanceUntil` + dano + rotação + IA + ondas + loot/XP | Testes determinísticos com seed fixa cobrindo: loop, target 7/9, rotação dos 4 slots, área por sqm, melee 2 s, morte, respawn, drop, consumível |
| C | Runner, checkpoint, hidratação, rotas, comandos, WS | Integração: entrar, receber `hunt_state`, avançar, trocar, finalizar, reconectar e retomar |
| D | Cliente: store, cena, criaturas, barras, efeitos, HUD, fluxo | Validação visual com `agent-browser`: loop, combate, HP, cooldown, dano em área, loot, finalizar |
| E | Documentação e limpeza | `docs/game/HUNT.md`, `CREATURES.md` e `SKILL_BAR.md` atualizados; `bun run lint`, `format`, `typecheck` verdes |

## 12. Pendências registradas

- Fórmula de XP e level-up definitivos.
- Recuperação de stamina e tipo de conta no schema.
- Captura e dispositivos.
- Efeitos de status (veneno, buff) e habilidades de cura/buff.
- Colisão entre criaturas e party.
- Arte definitiva, tiles animados e ordenação por Y.
- Balanceamento fino de dano, spawn density e respawn.

## 13. Ajustes 2.1 — mapas, colisão e conforto

| # | Decisão | Valor |
| --- | --- | --- |
| D13 | Tamanho dos locais | 96x64 sqm; loop retangular 20,16–75,47; 16 spawns internos em grade 4x4, com pelo menos 6 sqm entre si |
| D14 | Colisão | A ativa, as selvagens e o treinador bloqueiam o tile confirmado e o `segment.to`; ninguém entra no mesmo tile de outro ator |
| D15 | Spawn do treinador | 3 nós do loop atrás do spawn da criatura, nunca no mesmo tile |
| D16 | Olhar | Criatura ativa e selvagens olham na direção do alvo enquanto o têm |
| D17 | Caminhada | O wire envia `nextStepAt`; o cliente estica a interpolação do passo até esse instante (selvagem: `max(endsAt, nextDecisionAt)`) |
| D18 | Mochila e armazenamento | Os modais continuam disponíveis durante a caçada, por cima do canvas |
| D19 | Última criatura | Soltar é recusado quando é a única criatura do treinador; remover do time é recusado quando é a única do time |
| D20 | Volta para a cidade | Todo fim de caçada devolve o treinador com `current_hp = null` em todas as criaturas (vida cheia) |

> O balanceamento fino de spawn/respawn continua aberto; D13 é o recorte inicial para evitar acúmulo de selvagens nos mapas iniciais.

## 14. Ajustes 2.2 — câmera, catálogo e loadout ao vivo

| # | Decisão | Valor |
| --- | --- | --- |
| D21 | Câmera da caçada | Segue a posição **interpolada** da criatura ativa (segmento esticado), não o tile confirmado |
| D22 | Animação da caminhada | Usa o segmento esticado também no `walk`; a animação dura o intervalo até o próximo passo |
| D23 | Tipos de habilidade | `target`, `area` (com target) e `area_self` (sem target, centrada no conjurador) |
| D24 | Catálogo | Toda espécie tem 2 target, 2 area com target e 2 area sem target; `species_abilities` passa a aceitar slots 0–5 |
| D25 | Loadout ao vivo | Editar habilidades/consumíveis durante a caçada atualiza o runtime: removida sai, nova entra em cooldown, trigger/quantidade atualizam |
| D26 | Pathfinding | Selvagens e ativa desviam de atores ocupados (treinador/outras criaturas) e ambos avançam para o encontro |
| D27 | Respawn | 30 s (Campina), 35 s (Lago), 40 s (Bosque), 45 s (Ruínas) |
| D28 | Armazenamento | Remover a mensagem fixa “O time não pode ficar vazio.”; a trava continua |

Catálogo 2.2: as seis habilidades são Brasa e Garra (`target`), Ígnea e Espinho (`area` com target), Explosão e Vendaval (`area_self`). As espécies compartilham o catálogo nesta fase; o jogador equipa 4 e a selvagem usa todas.
