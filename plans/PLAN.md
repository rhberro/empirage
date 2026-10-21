# Plano — Camada de tempo real do Creatures

> Este documento é a fonte da verdade do plano de trabalho da camada de tempo real. Ele
> registra o que foi diagnosticado, as decisões que já foram tomadas e o contrato de
> protocolo que os implementação devem seguir.
>
> O documento descreve **como** o sistema é construído. As regras do jogo continuam
> em [Game Design](../docs/game/GAME.md).

---

## 1. Diagnóstico

O inventário completo das chamadas de rede do cliente está na seção 12. O resumo do
diagnóstico:

1. O **WebSocket é um canal de push unidirecional**: hoje ele transporta apenas
   `state_snapshot`, `pong` e `error`. Nenhum comando.
2. **Existem dois caminhos para o mesmo estado**: o push do WebSocket e
   `GET /api/player/state`. Esse duplicismo é a causa raiz dos dois timers de
   reconciliação de 600 ms (`useSkillPanelReconciliation.ts` e `useTeam.ts`).
3. **Cada push reconstrói o estado inteiro do banco** — `loadPlayerState` faz 8
   chamadas de repositório em 3 ondas. Isso é o custo real do push, não o tamanho do
   JSON.
4. **Não existe camada de cache** de rede. Nenhum `Cache-Control`, nenhum ETag,
   nenhuma TTL no cliente.
5. **O cooldown da troca de criatura é cronometrado no cliente**
   (`useSwapCooldown.ts`), espelhando uma regra do servidor. O cliente é a fonte da
   verdade de um valor que o servidor valida.
6. **Não há detecção de conexão morta confiável.** O cliente manda ping a cada 30 s,
   que o navegador estrangula em aba de segundo plano; o `pong` é descartado; e o
   servidor não tem nenhum mecanismo de vivacidade.

### 1.1 O código divergiu dos próprios documentos

Os documentos técnicos do projeto já descreviam a arquitetura correta, e o código
não a implementou:

| Documento | Diz | Código faz |
| --- | --- | --- |
| `docs/technical/client/STACK.md:177` | "O cliente nunca pergunta o estado num intervalo de tempo." | `GET /api/player/state` após cada comando + 2 timers de 600 ms |
| `docs/technical/client/STACK.md:177` | "o cliente responde apenas com comandos" | Zero comandos no WebSocket |
| `docs/technical/server/STACK.md:92` | "O desenho é que o servidor empurra as atualizações de estado e receba apenas comandos." | Só empurra |
| `docs/technical/server/STACK.md:106` | "Comandos nunca alteram o estado diretamente: são validados e aplicados pelas mesmas regras que avançam a simulação." | Não há comandos |
| `docs/technical/server/STACK.md:100` | "O estado de um jogador fica no processo que atendeu a conexão dele." | Estado reconstruído do banco a cada push |

**Este plano é a execução do que os documentos já decidiam.** Nenhuma decisão de
arquitetura nova precisa ser tomada aqui — todas já estavam escritas.

---

## 2. Decisões

### 2.1 O jogo é idle

`docs/game/PLAY_SCREEN.md:11` — "É um jogo idle". A caçada continua com o navegador
fechado, até o fim da sessão offline da conta (`docs/game/TRAINER.md`, *Sessão
Offline*: 4 h na conta gratuita, 8 h na paga).

**Consequência:** o WebSocket é uma **assinatura de visualização**, nunca o motor. A
simulação é independente da conexão.

### 2.2 O mapa da caçada é visível

**Decisão do responsável pelo produto.** O hunting place dita o mapa que o cliente
renderiza. O servidor envia **caminhos e coordenadas**, e o cliente **interpola**.

O servidor também envia **efeitos** — magia, ataque, cura, drop — com posição e
duração, e o cliente os anima. A simulação inteira é visualizada: o treinador, a
criatura dele e as outras criaturas envolvidas.

**Consequência para o protocolo:** o WebSocket carrega mensagens de efeito e
movimento, não apenas contadores. O transporte é orientado a eventos, não a
snapshot.

### 2.3 Tempo é timestamp, nunca contagem

Stamina, cooldown e fim de sessão são valores derivados de timestamps: `readyAt`,
`startedAt`, `endsAt`, `staminaEarnedAt`. O servidor **não** empurra "faltam 3 s";
manda o timestamp e o cliente calcula a contagem regressiva.

O servidor manda `serverNow` junto, para o cliente corrigir o próprio relógio.

**Consequências:**

- Resolve o timer estrangulado em aba de segundo plano: o cliente não depende de
  tique local para saber quanto falta.
- O cooldown deixa de ser cronometrado no cliente e passa a ser autoritativo no
  servidor.
- Um snapshot não precisa ser empurrado a cada segundo.

### 2.4 A simulação é uma função pura de avanço

`advance(state, untilTs)` devolve o novo estado. É usada em três lugares:

- **online**, a cada evento de luta;
- **catch-up offline**, quando o cliente reconecta ou quando o servidor volta;
- **batch de persistência**, no checkpoint.

O RNG mora **dentro do estado** (`rng_seed` + `rng_draws`). Sem isso o catch-up
sorteia de novo e o jogador recebe loot diferente do que "ganhou" antes de fechar a
aba.

O tempo offline **não** é simulado em tempo real: é simulado em tempo virtual, de uma
vez.

### 2.5 Um caminho único de mutação, com revisão

- O comando HTTP responde `{ ok, rev }`, **sem estado**.
- O estado chega **só** pelo WebSocket, com `rev`.
- O cliente aplica apenas revisões maiores e ignora as antigas.
- Se a revisão do comando não chegar em 1–2 s, o cliente faz uma busca de
  fallback.
- Um **gap** de revisão numa fatia significa resync.

Isso substitui os dois timers de 600 ms por um mecanismo só.

### 2.6 O estado é dividido em fatias, não um blob

| Fatia | Conteúdo | Como é empurrada |
| --- | --- | --- |
| **estrutural** | time, mochila, ouro, loadout | fatia inteira, só quando muda |
| **caçada** | inimigo atual, HP, contadores, ledger | eventos ou fatia pequena com timestamps |
| **derivado** | stamina, cooldowns | timestamps, nunca empurradas em tique |

### 2.7 O estado vivo do servidor fica em memória

O `PlayerState` do jogador fica no processo, com persistência periódica e checkpoint.
O banco guarda o registro durável de **o que existe e até onde foi**, não a fila de
trabalho da simulação.

**Consequência de escala:** o projeto assume processo único. `ConnectionRegistry` e
`TrainerSessionStore` já são `Map`s em memória. Se isso mudar, o estado precisa de
Redis ou de sessão sticky. **Registrado como pendência.**

---

## 3. Protocolo

### 3.1 Envelope versionado

Toda mensagem do WebSocket é um envelope com versão:

```ts
type Envelope<T extends string, P> = {
  v: 1;
  type: T;
  reqId?: string;
  payload: P;
};
```

O campo `v` existe para que uma mudança de protocolo possa ser rejeitada com
clareza em vez de mal interpretada.

### 3.2 Mensagens

```ts
export const PROTOCOL_VERSION = 1;

export type GameCommand =
  | { type: 'finalize_hunt' }
  | { type: 'swap_creature'; creatureId: string }
  | { type: 'use_ability'; slot: SkillSlot }
  | { type: 'use_consumable'; slot: SkillSlot };

export type ClientMessage =
  | { v: 1; type: 'ping'; sentAt: number }
  | { v: 1; type: 'select_trainer'; reqId: string; trainerId: string }
  | { v: 1; type: 'command'; reqId: string; command: GameCommand };

export type ServerMessage =
  | { v: 1; type: 'pong'; sentAt: number }
  | { v: 1; type: 'state_snapshot'; state: PlayerState }
  | { v: 1; type: 'command_result'; reqId: string; ok: boolean; rev: number; code?: GameErrorCode }
  | { v: 1; type: 'error'; code: GameErrorCode; message: string };
```

`GameCommand` é **definido agora** e entra em uso na Fase 4. `select_trainer` já
passa a ser um comando com `reqId` e resposta, o que exercita a mecânica de ack
desde já.

### 3.3 Revisão do estado

`PlayerState` ganha três campos:

```ts
export type PlayerState = {
  // ...o que já existe
  /** A revisão do estado. Monotônica por conta, dentro de um epoch. */
  rev: number;
  /** O identificador do boot do servidor. Muda quando o servidor reinicia. */
  epoch: string;
  /** O relógio do servidor no momento do snapshot. */
  serverNow: number;
};
```

**Comparação no cliente:** o par `(epoch, rev)`.

- `epoch` diferente do que o cliente tinha → **resync**: aceita o que vier, descarta
  o contador.
- `epoch` igual e `rev` maior → aplica.
- `epoch` igual e `rev` menor ou igual → **ignora**.

O `epoch` existe porque o contador vive em memória: se o servidor reinicia e zera o
contador, um cliente que só compara `rev` rejeitaria todos os snapshots novos e
ficaria congelado num estado obsoleto.

### 3.4 Ticket de uso único para o WebSocket

O token do Supabase **não** viaja mais na query string.

```
POST /api/ws-ticket          →  { ticket, expiresAt }
GET  /ws?ticket=<ticket>     →  upgrade
```

O ticket vale ~30 s, é de **uso único** e é consumido no upgrade. Ele existe porque
o upgrade do Bun não recebe headers, e um JWT na query string é registrado por
qualquer proxy ou balanceador à frente do servidor.

> O servidor já registra a abertura pelo `userId` e nunca pelo token
> (`docs/technical/server/STACK.md:98`). O ticket fecha a lacuna do log do proxy.

### 3.5 Códigos de fechamento

| Código | Significado | O cliente reconecta? |
| --- | --- | --- |
| `1000` | Encerramento normal, inclusive a **saída** do treinador (`DELETE /api/session/trainer`) | Sim, com backoff |
| `4001` | Conexão **substituída** — seja por outra conexão da mesma conta, seja pela **entrada** em um treinador (`POST /api/session/trainer`) | **Não** |

O `4001` é obrigatório: a regra é uma conexão por conta
(`docs/game/PLAY_SCREEN.md:165`). Com reconexão automática e o código `1000`, duas
abas se derrubariam em laço.

**Ticket recusado não é um código de fechamento.** O upgrade recusado responde HTTP
`401` e o handshake falha — o navegador abre e fecha o socket sem nunca ter
conversado. O cliente trata isso como "abertura falhou": busca um ticket novo e
tenta de novo, com backoff.

### 3.6 Vivacidade

**Servidor conduz.** O cliente **observa o silêncio**.

- O Bun envia ping de protocolo e o navegador responde sozinho, inclusive em aba
  oculta.
- O servidor fecha a conexão ociosa depois de um limite.
- O cliente marca a conexão como morta quando não recebe **nada** por mais de um
  limite, e reconecta com backoff e jitter.

**Números do Round 1:**

| Parâmetro | Valor | Por quê |
| --- | --- | --- |
| Ping do cliente | **45 s** | O `idleTimeout` do Bun conta o que o cliente manda; sem ping, o servidor derruba uma conexão saudável. 45 s sobrevive ao estrangulamento de timer em aba oculta (~1/min), que é o estrangulamento do navegador. |
| `idleTimeout` do servidor | **120 s** | Maior que o ping do cliente, com folga para o timer estrangulado |
| Vigia do cliente | **100 s** sem receber nada → conexão morta | O `pong` hoje é descartado; passa a ser o sinal de vida |
| Backoff da reconexão | base 1 s, fator 2, teto 30 s, jitter ±20 %, **6 tentativas** | Aba de idle game fica horas aberta; notebook dormindo derruba o socket |

O ping de protocolo do Bun é **invisível** para o JavaScript do browser — o
`pong` de protocolo não chega no evento `message`. Por isso o ping da aplicação, de
45 s, continua existindo: é ele que o JavaScript enxerga.

### 3.6.1 A regra da conexão única

Uma conta, uma conexão. A conexão substituída fecha com `4001` e **não** é
reconectada pelo cliente. A conexão que fica valendo é a mais recente.

### 3.7 Revisão e fatias no payload

O snapshot carrega o estado inteiro, com `rev`, `epoch` e `serverNow` no topo. As
fatias finer-grained (structural / hunt / derived) chegam na Fase 3, quando a caçada
existir. **Round 1 implementa o mecanismo de revisão sobre o snapshot inteiro.**

### 3.8 Fallback

```
GET /api/player/state?sinceRev=<rev>
```

- `rev` ausente → estado completo (comportamento atual).
- `rev` presente e o estado atual já está na revisão → `204 No Content`.
- `rev` presente e o estado atual é mais novo → estado completo.

A resposta por delta é otimização da Fase 3.

### 3.9 Idempotência

`POST /api/store/buy` e `POST /api/store/sell` aceitam o header `Idempotency-Key`.
O servidor guarda a chave e o resultado por conta, com TTL de ~10 min. A mesma
chave devolve o mesmo resultado, sem cobrar duas vezes.

### 3.10 Autenticação do restante

Nada muda para o resto: o servidor valida o token do Supabase e trabalha com ele
(`docs/technical/server/STACK.md`). O ticket é **só** para a abertura do canal.

---

## 4. O modelo de caçada

### 4.1 A linha no banco é checkpoint, não fila de trabalho

```
hunt_sessions
  id, account_id, trainer_id, hunt_area_id
  status              'active' | 'finished'
  started_at, last_simulated_at, ended_at, end_reason
  rng_seed, rng_draws
  encounters, kills, stamina_spent_minutes
  actions             jsonb  -- timeline de ações do jogador
```

- **O banco não é consultado em loop para achar trabalho.** O servidor mantém a
  simulação viva em memória e grava o checkpoint a cada N segundos.
- **No boot**, o servidor varre as caçadas `active` com `last_simulated_at < now()` e
  retoma cada uma por catch-up.
- **A linha é encerrada em soft-close**, nunca deletada: `ended_at` + `end_reason`
  (`stamina_depleted`, `offline_session_expired`, `no_viable_creature`,
  `player_finalized`, `trainer_switched`).

O soft-close preserva o que o delete destruiria: por que a caçada acabou, o loot
obtido — que é a pendência aberta em `docs/game/HUNT.md:65` — e a contabilidade da
sessão offline, que é de caçada **consecutiva**.

### 4.2 Catch-up é analítico, não tick-based

O custo do catch-up depende inteiramente da granularidade:

| | Tick-based (pathfinding por passo) | Analítico (encontros resolvidos por fórmula) |
| --- | --- | --- |
| Passos por hora | ~36.000 (a 10 Hz) | ~120 encontros |
| Catch-up de 4 h | 144.000 passos × A\* por treinador | 480 avaliações de fórmula |
| Custo no boot | segundos de CPU **por treinador** | microssegundos |

Com 4 h de sessão offline e centenas de jogadores, o modelo tick-based derruba o
servidor a cada deploy ou crash.

**O pathfinding é derivado, não simulado.** Para cada encontro o servidor calcula o
caminho uma vez; o gameplay é fórmula sobre a semente:

```
travelTime = f(distância, velocidade)
battle     = f(stats, elemento, semente)
loot       = f(tabela de drops, semente)
```

O cliente recebe o caminho e **interpola**. O servidor recebe os efeitos
(posição, duração) e o cliente os **anima**.

### 4.3 Ações do jogador durante a caçada

Trocar de criatura, usar consumível e finalizar são ações que quebram o avanço por
tempo puro. Por isso a caçada persiste uma **timeline de ações**, e o catch-up
reproduz:

```
advance(estado, t1) → aplicar ação A → advance(estado, t2) → aplicar ação B → …
```

### 4.4 Fim da caçada

Duas das três condições de `docs/game/HUNT.md:35-39` fecham em fórmula:

```
endsAt = min(startedAt + duraçãoDaSessãoOffline, momentoEmQueStaminaZera)
```

A terceira — "o time não tem mais nenhuma criatura apta a batalhar" — não é
timestamp: é uma condição avaliada dentro do `advance()`.

A stamina é do **treinador**; a duração da sessão offline e a velocidade de
recuperação são da **conta**. O `advance()` precisa das duas entradas.

### 4.5 O que o cliente vê

| Mensagem | Conteúdo |
| --- | --- |
| `hunt_state` | sessão atual: área, momento, contadores, `endsAt` |
| `hunt_actor` | uma criatura/treinador: id, posição, caminho, `readyAt` |
| `hunt_effect` | efeito: tipo, posição, duração, alvo |

O cliente interpola posição pelo caminho e anima o efeito pela duração. O
servidor **não** empurra posição a cada quadro.

---

## 5. O cache no cliente

### 5.1 TanStack Query, para os recursos HTTP de leitura

| Dado | Onde vive | Por quê |
| --- | --- | --- |
| **Estado vivo** (trainer, time, HP, cooldown, caçada) | **Zustand** | O canvas do PixiJS lê fora do React, a cada quadro (`docs/technical/client/STACK.md:149`) |
| **Catálogo** (loja, áreas de caça, iniciais) | **TanStack Query** | Read-through cache; o conteúdo muda em deploy |
| **Lista de treinadores** | **TanStack Query** | Dedup, `isLoading` e `isError` de graça |
| **Sessão** | **Zustand** | — |
| **Formulários** | **React Hook Form + Zod** | — |

O estado vivo **não** vira query do TanStack Query: ele é empurrado pelo servidor e
o `rev` decide a aplicação. Fica no Zustand, com a comparação de revisão na
aplicação.

### 5.2 Revisão e versão de conteúdo são coisas diferentes

- **`rev`** — monotonônica por conta, dentro de um `epoch`. Mede a **frescor do
  estado vivo**.
- **`contentVersion`** — contador de deploy. Mede a **frescor do conteúdo**.

Não são intercambiáveis. A `contentVersion` é otimização do catálogo e fica para a
Fase 5.

---

## 6. Fases

| Fase | Conteúdo | Estado |
| --- | --- | --- |
| **0** | Doc técnica de simulação e estado. Este documento. | ✅ |
| **1** | Protocolo e infraestrutura: envelope, `reqId`, ack, ticket, close codes, vivacidade, `rev`, fallback, idempotência, starters público, sessão única, `select_trainer` unificado. | ✅ |
| **1b** | TanStack Query no cliente para catálogo e lista de treinadores. | ✅ |
| **2** | Estado vivo do jogador em memória, com checkpoint e retomada no boot. Deixa de reconstruir o banco a cada push. | ⏭️ Round 2 |
| **3** | A caçada sobre `advance()`: `hunt_sessions`, catch-up, ledger, eventos e efeitos no WebSocket, cliente interpola. | ⏭️ Round 2/3 |
| **4** | Comandos de caçada no WebSocket (`swap_creature`, `use_ability`, `finalize_hunt`). Decisão de coerência de canal, não de corretude. | ⏭️ Round 3 |
| **5** | `contentVersion` e invalidação de catálogo. | ⏭️ Round 3 |

### 6.1 O que o Round 1 deixou para o Round 2

Além das fases acima, a revisão do Round 1 descobriu **duas regras do jogo que não
têm implementação nem casa no banco** (seção 11.1):

- a **recuperação de stamina**, que hoje é um valor estático na tabela do
  treinador;
- o **tipo da conta**, que decide a duração da sessão offline e a velocidade da
  recuperação, e que não tem onde morar.

As duas são pré-requisitos da Fase 3 e exigem decisão de produto antes de serem
implementadas.

---

## 7. Round 1 — divisão de trabalho

Cada lane tem **exclusividade de escrita**. Nenhuma lane edita arquivo de outra.

| Lane | Escopo de escrita | Entrega |
| --- | --- | --- |
| **srv-protocol** | `apps/server/src/ws/**`, `apps/server/src/routes/**`, `apps/server/src/state/**`, `apps/server/src/session/**`, `apps/server/src/db/**`, `apps/server/src/__tests__/**`, `apps/server/src/index.ts`, `apps/server/src/dependencies.ts`, `apps/server/src/middleware/**`, `apps/server/src/router.ts`, `apps/server/src/validation/**`, `apps/server/src/ratelimit/**` | Ticket, close codes, vivacidade, envelope, `rev`, fallback, idempotência, starters público, sessão única, `select_trainer` unificado |
| **cli-protocol** | `apps/client/src/pages/play/**`, `apps/client/src/features/skill-panel/**`, `apps/client/src/entities/team/**`, `apps/client/src/widgets/game-hud/**`, `apps/client/src/shared/auth/**` | Fluxo do ticket, reconexão automática com backoff, close codes, vigia de vivacidade, envelope, aplicação por `rev` |
| **cli-data** | `apps/client/src/shared/api/**`, `apps/client/src/entities/trainer/**`, `apps/client/src/features/store/**`, `apps/client/src/features/hunt-area/**`, `apps/client/src/app/**`, `apps/client/src/pages/trainers/**`, `apps/client/src/pages/new-trainer/**` | TanStack Query para catálogo e treinadores, helper do ticket |
| **hunt-foundation** | `apps/server/src/hunt/**` (novo), `apps/server/src/__tests__/hunt/**` (novo), `supabase/migrations/*` (arquivo novo) | Schema da caçada, ciclo de vida da sessão, relógio determinístico, matemática de stamina e sessão offline |

### 7.1 O orquestrador é dono de

- `plans/**`
- `apps/shared/contracts/game.ts`, `player.ts`, `index.ts`

O orquestrador escreve os contratos **antes** de as lanes começarem, para que ninguém
precise coordenar sobre o arquivo.

### 7.2 Dependências entre lanes

| Precisa de | Quem precisa |
| --- | --- |
| `requestWsTicket(deps) → Promise<WsTicketResult>` em `~/shared/api/endpoints/wsTicket` | cli-protocol |
| `PlayerState` com `rev`, `epoch`, `serverNow` | todos |
| `ClientMessage`/`ServerMessage` versionados | todos |

As assinaturas exatas estão nas seções 3 e 9. As lanes podem ser executadas em
paralelo: cada uma escreve contra a assinatura, sem esperar a outra.

### 7.3 Reconciliação do Round 1

Decisões tomadas durante a revisão do código entregue pelas lanes. Todas valem
para o código e precisam ser refletidas na documentação técnica.| Assunto | Decisão | Por quê |
| --- | --- | --- |
| `command_result` | Ganhou `code?: GameErrorCode` | Sem ele, a falha de um comando exigia **duas** mensagens — um `error` sem `reqId` e um `command_result` sem código — e o cliente não conseguia correlacionar a falha com o pedido |
| Sessão revogada | O ticket carrega o token junto com a identidade, e o upgrade **revalida** o token no Auth server | O `UserReader` existe exatamente para isso ("a única forma de detectar uma sessão revogada enquanto o token ainda parece válido"). Sem a revalidação, havia uma janela de 30 s. O custo é uma chamada de rede por abertura de canal — o mesmo do código original |
| Idempotência de compra | Reserva **síncrona** da chave antes de executar | O fluxo `get` → operação (await) → `set` deixa a transação inteira como janela: duas requisições com a mesma chave em voo cobravam duas vezes. A reserva fecha a janela, e a chave é liberada quando a operação falha, para o retry poder tentar de novo |
| Destino pós-auth | A decisão "conta sem treinador → tela de criação" mora na **tela da lista**, e o pós-auth vai sempre para `/trainers` | O destino era decidido por um `GET /api/trainers` que a tela da lista pedia de novo. Com a query compartilhada, a decisão fica onde a lista é lida |
| `staleTime` | `starters`, `hunt-areas`, `hunt-area` → `Infinity`; `trainers` e `store/catalog` → `0` com invalidação explícita | O conteúdo muda em deploy; a lista de treinadores e o catálogo da loja mudam por ação do jogador. O catálogo da loja ainda **mistura** conteúdo estático com `bag` e `gold` do jogador — a divisão exige mudança de servidor e fica para a Fase 5 |
| Retry de query | Só uma falha **sem resposta do servidor** é repetida; um 4xx nomeado nunca é | Todo código nomeado pelo servidor é uma decisão: repetir o pedido repetiria a mesma recusa |

### 7.4 O que a documentação técnica precisa registrar

| Documento | O que mudou |
| --- | --- |
| `docs/technical/server/STACK.md` | O canal não valida mais o token do Supabase na query string. A identidade vem de um **ticket de uso único** (`POST /api/ws-ticket`), e o token é revalidado no upgrade. Registrar também os close codes e a vivacidade |
| `docs/technical/server/TRAINERS.md` | A rota `POST /api/ws-ticket`, os close codes (`1000` e `4001`) e a regra do canal |
| `docs/technical/client/STACK.md` | **TanStack Query** entra na tabela de stack. A lista de treinadores deixa de ser um store com dedup manual e passa a ser uma query. A reconexão automática deixa de ser um botão e passa a existir |
| `docs/technical/client/AUTH.md` | O destino pós-auth é sempre `/trainers`; a decisão de "conta sem treinador" mora na tela da lista |
| `docs/technical/client/STRUCTURE.md` | A camada `shared/api/queries/` (chave e fetcher) e o `QueryClient` em `app/query/` |

---

## 8. Fora do escopo do Round 1

Fica registrado para não ser percebido como esquecido:

- **Estado em memória no servidor** (Fase 2). O valor só aparece quando os pushes
  ficarem frequentes, ou seja, com a caçada. Fazer junto da mudança de protocolo
  dobra o raio de explosão no núcleo do jogo.
- **A caçada jogável** (Fase 3). As regras de combate e de drop ainda não estão
  escritas em documento nenhum — `docs/game/HUNT.md:59` e `:65` estão em aberto. O
  Round 1 entrega só a **fundação** determinística, sem inventar regra de jogo.
- **`contentVersion`** (Fase 5).
- **Comandos de caçada no WebSocket** (Fase 4).

---

## 9. Assinaturas que as lanes devem respeitar

### 9.1 Cliente — helper do ticket

```ts
// apps/client/src/shared/api/endpoints/wsTicket.ts
export type WsTicketResult =
  | { ok: true; ticket: string; expiresAt: number }
  | { ok: false; code: TrainerClientErrorCode };

export function requestWsTicket(deps: ApiDeps): Promise<WsTicketResult>;
```

`deps` é o mesmo `ApiDeps` dos outros endpoints. A requisição **exige** token.

### 9.2 Servidor — rota do ticket

```
POST /api/ws-ticket
→ 200 { ticket: string, expiresAt: number }
→ 401 { error: 'unauthenticated', message: string }
```

O ticket é opaco, de uso único, com validade de 30 s.

### 9.3 Servidor — estado com revisão

`buildPlayerState` passa a receber `rev`, `epoch` e `serverNow`.

`rev` é monotônico por conta, dentro do `epoch` do processo. `epoch` é gerado uma
vez por boot do servidor.

### 9.4 Servidor — fallback

```
GET /api/player/state?sinceRev=<n>
→ 200 <PlayerState>   quando o estado atual é mais novo que <n>
→ 204                 quando o estado atual já está na revisão <n>
```

---

## 10. Invariantes de segurança

Aplicam-se a todas as lanes.

1. **O cliente nunca decide regra de jogo.** Toda validação de regra é do servidor.
   O cliente valida formato.
2. **O token nunca é logado.** Nem em log de aplicação, nem em log de proxy. O
   ticket substitui o token na query string.
3. **O WebSocket valida toda mensagem recebida.** Tipo conhecido, payload no
   formato, campos obrigatórios presentes. Mensagem inválida vira `error` e a
   conexão continua.
4. **Comandos com efeito não são coalescidos.** "Último vence" vale para push de
   estado, não para `buy` com quantidades diferentes.
5. **Toda escrita é idempotente quando há risco de cobrança.** `buy`/`sell`
   aceitam `Idempotency-Key`.
6. **Uma conta, uma conexão.** A conexão substituída fecha com `4001` e o cliente
   substituído **não** reconecta.
7. **Nenhum segredo em log.** Nenhum token, nenhum ticket, nenhum cabeçalho de
   autorização.
8. **A fila por conta é serial.** Comandos do mesmo usuário são aplicados em ordem.
9. **O estado do jogador nunca é reconstruído do banco em caminho quente** depois
   da Fase 2. Antes disso, a reconstrução continua correta, apenas cara.
10. **Nenhuma rota nova fica sem autenticação**, exceto `GET /api/starters`, que é
    conteúdo público por definição.
11. **Todo header que o cliente envia tem que estar na lista do CORS do
    servidor.** Um header que falta é respondido pelo preflight e **bloqueado
    pelo navegador**: a requisição não chega ao servidor, e nenhum teste de
    unidade ou de integração do lado do servidor percebe — eles não passam pelo
    navegador. O header `Idempotency-Key` quebrou a loja exatamente assim, e só
    a validação visual o revelou.

---

## 11. Decisões de design ainda abertas

| Questão | Onde | Impacto |
| --- | --- | --- |
| O que acontece com os itens obtidos quando o jogador finaliza a caçada? | `docs/game/HUNT.md:65` | Define o ledger e o `end_reason` |
| Quais criaturas e itens existem em cada área? | `docs/game/HUNT.md:59` | Conteúdo; a simulação é parametrizada por isso |
| Regras de combate: dano, duração de batalha, chance de captura | — | **Não existe em documento nenhum.** Precisa ser escrito antes da Fase 3 |
| Lista de criaturas e itens renderizados no canvas da caçada | `docs/game/HUNT.md:66` | Parcialmente resolvido pela decisão 2.2 |
| O que acontece com a caçada quando o treinador troca de treinador | `docs/game/PLAY_SCREEN.md:169` | `end_reason: trainer_switched` |

### 11.1 Lacunas de schema descobertas na fundação da caçada

A fundação determinística da caçada (Fase 0/3) foi construída sobre duas
regras que **não têm implementação nem casa no banco**. Nenhuma das duas é
bloqueante para o Round 1, e nenhuma pode ser inventada sem decisão de produto.

#### A recuperação de stamina não é calculada no servidor

`PlayerState.staminaMinutes` vem de `trainer.stamina_minutes` — um valor
**estático** no banco (`apps/server/src/state/playerState.ts`). A regra de
`docs/game/TRAINER.md` (*Recuperação*) — 1 minuto de stamina a cada 2 minutos na
conta gratuita, 1 a cada 1 na paga, sempre que o treinador não está caçando — **não
está implementada em lugar nenhum**. A função `computeRecoveredStamina` do
contrato não tem chamador.

Consequência: a barra de stamina do cliente mostra um número que não muda, e a
regra que decide quanto tempo de caça ainda resta é ficção.

**Precisa de:** o estado da stamina virar um par `staminaMinutes` + `staminaEarnedAt`,
com o valor derivado por `computeRecoveredStamina`. É a mesma mudança de forma que
o cooldown tem: timestamp no servidor, contagem no cliente.

#### O tipo da conta não tem casa no schema

`HuntAccountType` (`free` | `paid`) decide **a duração da sessão offline** (4 h ou
8 h) e **a velocidade da recuperação**. Ele chega hoje pelo contexto do `advance`,
mas não existe em nenhuma tabela.

`docs/game/TRAINER.md` (*Por Treinador*) é explícito: *"O tipo de conta é da conta,
e não do treinador."* A conta gratuita é comprada com 30 diamantes por 30 dias
(*Moedas*), então o dado tem dono natural — a conta — e não o treinador.

**Precisa de:** uma decisão de schema sobre onde o tipo da conta vive (uma coluna
na conta, um registro de assinatura, ou derivar de um saldo), antes da Fase 3.

#### A stamina no início da caçada é cursor, não derivação

A revisão da fundação da caçada encontrou uma derivação perigosa: a stamina no
início da caçada era sugerida como `trainers.stamina_minutes +
session.staminaSpentMinutes`. Essa fórmula **presume** que o banco guarda a stamina
*restante* — o que hoje não é verdade — e amarra o instante do fim de **toda**
caçada a uma regra de persistência que não está garantida em nenhum lugar.

A stamina no início foi para a **sessão**, como parte do cursor, ao lado de
`rngSeed`, `rngDraws` e `lastSimulatedAt`. É capturada uma vez, quando a caçada
nasce, e viaja com ela.

---

## 12. Inventário de referência

### 12.1 Chamadas do cliente

| # | Momento | Transporte | Chamada |
| --- | --- | --- | --- |
| 1 | Boot | Supabase | `onAuthStateChange` |
| 2 | Boot | Supabase | `getSession()` (troca PKCE implícita) |
| 3 | Sign-in | Supabase | `signInWithPassword` |
| 4 | Sign-in Google | Supabase | `signInWithOAuth` |
| 5 | Sign-up | Supabase | `signUp` |
| 6 | Recuperação | Supabase | `resetPasswordForEmail` |
| 7 | Redefinir senha | Supabase | `updateUser({password})` |
| 8 | Logout | Supabase | `signOut` |
| 9 | Pós-auth Google | HTTP | `POST /api/auth/google-merge` |
| 10 | Pós-auth | HTTP | `GET /api/trainers` |
| 11 | Tela Trainers | HTTP | `GET /api/trainers` (2ª vez) |
| 12 | Criar treinador | HTTP | `POST /api/trainers` |
| 13 | Tela Novo Treinador | HTTP | `GET /api/starters` |
| 14 | Editar | HTTP | `PATCH /api/trainers/:id` |
| 15 | Excluir | HTTP | `DELETE /api/trainers/:id` |
| 16 | Entrar | HTTP | `POST /api/session/trainer` |
| 17 | Play (mount) | HTTP | `GET /api/player/state` |
| 18 | Play | Supabase | `getSession()` (token do canal) |
| 19 | Play | WS | `new WebSocket(/ws?token=)` |
| 20 | WS `open` | WS ↑ | `select_trainer` |
| 21 | 30 s | WS ↑ | `ping` |
| 22 | WS | WS ↓ | `state_snapshot` |
| 23 | WS | WS ↓ | `pong` (descartado) |
| 24 | WS | WS ↓ | `error` |
| 25 | Após comando | HTTP | `GET /api/player/state` |
| 26 | Timeout 600 ms | HTTP | `GET /api/player/state` (2 timers independentes) |
| 27 | Modal Loja | HTTP | `GET /api/store` |
| 28 | Comprar / Vender | HTTP | `POST /api/store/buy` / `/sell` |
| 29 | Modal Caça | HTTP | `GET /api/hunt-areas` |
| 30 | Selecionar área | HTTP | `GET /api/hunt-areas/:id` |
| 31 | Equipar habilidade | HTTP | `PUT /api/creatures/:id/ability-slots` |
| 32 | Equipar / limpar gear | HTTP | `PUT` / `DELETE /api/gear-slots/:slot` |
| 33 | Trocar criatura | HTTP | `POST /api/team/swap` |
| 34 | Mochila / Depósito | HTTP | `POST /api/team`, `PUT /api/team`, `DELETE /api/team/:id` |
| 35 | Trocar treinador | HTTP | `DELETE /api/session/trainer` |

### 12.2 Rotas do servidor

```
GET    /api/health
GET    /api/starters
GET    /api/trainers
POST   /api/trainers
PATCH  /api/trainers/:id
DELETE /api/trainers/:id
POST   /api/auth/google-merge
POST   /api/session/trainer
DELETE /api/session/trainer
GET    /api/player/state
POST   /api/team
PUT    /api/team
DELETE /api/team/:creatureId
POST   /api/team/swap
PUT    /api/creatures/:id/ability-slots
PUT    /api/gear-slots/:slot
DELETE /api/gear-slots/:slot
GET    /api/store
POST   /api/store/buy
POST   /api/store/sell
GET    /api/hunt-areas
GET    /api/hunt-areas/:id
```

---

## 13. Documentos relacionados

- [Arquitetura](../docs/technical/ARCHITECTURE.md)
- [Stack do cliente](../docs/technical/client/STACK.md)
- [Stack do servidor](../docs/technical/server/STACK.md)
- [Estrutura do cliente](../docs/technical/client/STRUCTURE.md)
- [Estilos de código](../docs/CODING_STYLES.md)
- [Game design](../docs/game/GAME.md)
