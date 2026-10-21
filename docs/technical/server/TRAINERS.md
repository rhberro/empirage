# API de Treinadores

Este documento descreve a API HTTP que o servidor expõe para criar, listar, editar e deletar treinadores, a rota de merge da conta Google e os endpoints de sessão do jogador. Cobre a forma do roteador HTTP, o middleware de autenticação, a persistência no Postgres, os contratos de request/response e os testes.

> O que o jogo decide sobre treinadores (regras, validações, fluxo) está em [Autenticação do Jogo](../../game/AUTHENTICATION.md#tela-de-criar-treinador) e em [Game Design](../../game/GAME.md). Este documento descreve apenas a **arquitetura técnica** da API.

## Índice

| Tópico | Descrição |
| --- | --- |
| [Princípios](#princípios) | As regras que governam a API. |
| [Roteador HTTP](#roteador-http) | A camada fina entre o `Bun.serve` e os handlers. |
| [Middleware de Autenticação](#middleware-de-autenticação) | Como o token do Supabase é validado em cada request. |
| [Rate Limit](#rate-limit) | A regra de tentativas excessivas e onde o estado dela mora. |
| [Logging Estruturado](#logging-estruturado) | O que o log de cada rota registra, e o que nunca é registrado. |
| [Persistência](#persistência) | Onde o dado vive: Postgres, repositório e a RPC de criação. |
| [Rotas](#rotas) | Os contratos de cada endpoint. |
| [A Carga da Barra](#a-carga-da-barra-de-habilidades) | As duas tabelas da carga, a fórmula dos atributos, a vida e as rotas novas. |
| [Áreas de Caça](#áreas-de-caça) | Os endpoints do catálogo de áreas de caça, o tom e a união dos itens. |
| [A Loja](#a-loja) | Os endpoints da loja: o catálogo, a compra e a venda. |
| [Regras de Negócio](#regras-de-negócio) | O que o servidor valida e por quê. |
| [Erros](#erros) | Formato padrão das respostas de falha. |
| [Sessão do Treinador](#sessão-do-treinador) | Como o servidor sabe qual trainer o cliente tem aberto. |
| [WebSocket](#websocket) | O canal do jogo e o que ele já faz. |
| [Contratos Compartilhados](#contratos-compartilhados) | Os tipos que cliente e servidor importam. |
| [Testes](#testes) | O que está coberto e como. |
| [Pendências](#pendências) | Limitações conhecidas. |

## Princípios

1. **O servidor é a única fonte de verdade.** Validação de nome único, limite de 5 trainers, merge de conta e deleção em cascata são decisões do servidor. O cliente só valida formato para feedback rápido.
2. **HTTP antes do WebSocket.** Trainer é setup de conta, não estado de jogo. CRUD de trainer usa request/response. O WebSocket fica focado em jogo rodando.
3. **Mesmo processo que o WebSocket.** O servidor HTTP e o WebSocket rodam no mesmo `Bun.serve`. Isso preserva a regra de "uma conta, uma conexão ativa" e a validação única de token na abertura do canal.
4. **Sem framework.** O roteador é escrito pelo projeto, em um punhado de linhas. Cobre o que o Creatures precisa hoje e aceita middleware e validação como extensões.
5. **Token Supabase no header.** O cliente envia o access token do Supabase no header `Authorization: Bearer`. O servidor valida com `getClaims()` (local) em cada chamada REST, e com `getUser()` (com rede) na **abertura do canal WebSocket**.
6. **Respostas JSON.** Toda resposta é `application/json`. Erros seguem o formato descrito em [Erros](#erros).
7. **Tipos compartilhados, schemas locais.** O pacote `apps/shared/contracts/` exporta **tipos puros de TypeScript** (sem Zod, sem runtime) — tipos de input/output, enums, códigos de erro. Cada lado (cliente, servidor) escreve seus próprios schemas Zod usando `satisfies z.ZodType<T>` contra o tipo compartilhado. Cliente valida formulários para feedback rápido; servidor valida no boundary da API. Ver [Contratos Compartilhados](#contratos-compartilhados).
8. **O Postgres é a fonte da verdade.** Treinadores, criaturas e espécies vivem no Postgres do Supabase. Não há estado de trainer em memória no servidor: a leitura e a escrita passam por uma camada de repositório.

## Roteador HTTP

Um arquivo, `apps/server/src/router.ts`, exporta:

```
type RouteHandler = (
  req: Request,
  params: Record<string, string>,
  ctx: RequestContext,
) => Promise<Response>;

type Route = {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
};

type Middleware = (
  req: Request,
  ctx: RequestContext,
) => Promise<Response | null>;

type ResponseObserver = (req: Request, ctx: RequestContext, response: Response) => void;
```

### API

```
function defineRoute(method: string, path: string, handler: RouteHandler): Route;

function composeMiddleware(
  middlewares: Middleware[],
  handler: RouteHandler,
): RouteHandler;

function buildHttpHandler(routes: Route[], observer?: ResponseObserver): RouteHandler;

function createRequestContext(): RequestContext;

function createErrorBoundary(logger: Logger, handler: RouteHandler): RouteHandler;

function jsonResponse(body: unknown, status: number): Response;

function errorResponse(status: number, error: string, message: string): Response;
```

### Comportamento

- `defineRoute('/api/trainers/:id', handler)` compila `:id` em RegExp e extrai `paramNames` na ordem.
- `composeMiddleware` executa middlewares em ordem; o primeiro que retornar `Response` interrompe a cadeia.
- `buildHttpHandler` recebe a lista de rotas, faz match por método + pathname, extrai params do match, e chama `handler(req, params, ctx)`.
- Se nenhuma rota casar, retorna `404` com `{ error: 'not_found' }`.
- Se o método não casar mas o path casar, retorna `405` com `{ error: 'method_not_allowed' }`.

### Middlewares globais

Montados em `apps/server/src/index.ts` e aplicados a todas as rotas:

1. **Logging** — marca o início do request (`startedAt`) e garante um `requestId` (uuid) no contexto. Um `ResponseObserver` registra método, path, status, duração e `requestId`. Usa `pino`.
2. **CORS** — permite a origem do cliente dev (`http://localhost:5173`) e o que vier de `process.env.CLIENT_ORIGIN` em produção. Responde `204` a um `OPTIONS`, já com os headers de CORS.

O middleware de **auth** não é global: cada grupo de rotas o aplica com `createAuthMiddleware(deps.claims)`. A única rota pública é `GET /api/health`.

### `RequestContext`

```
type RequestContext = {
  requestId: string;
  responseHeaders: Headers;
  startedAt: number;
  userId: string | null;
};
```

`userId` é `null` até o middleware de auth passar, e continua `null` nas rotas sem auth. `responseHeaders` é onde o middleware de CORS deposita os headers que o roteador copia para a resposta no final.

### Erro não tratado

`createErrorBoundary` envolve o handler inteiro. Uma exceção lançada em qualquer rota é logada com o `requestId` e vira uma resposta `500` com `{ error: 'internal_error', message: 'Erro interno do servidor.' }`. O cliente nunca recebe stack trace, nem mensagem de SQL crua.

## Middleware de Autenticação

`apps/server/src/supabase.ts` monta o `supabaseServer` com dois clients: o `admin`, que usa a chave de serviço, e o `user`, que usa a chave anon. O middleware de auth usa o **client user-side** com o token do cliente — a chave de serviço não é usada para validar token.

### Fluxo

```
1. Extrai "Bearer <token>" do header Authorization.
2. Se ausente → 401 { error: 'unauthenticated' }.
3. Chama claims.readUserId(token) — supabase.auth.getClaims(token), que valida assinatura e expiração localmente.
4. Se as claims não valem → 401.
5. Anexa claims.sub (userId) ao ctx.
6. Chama next().
```

### Por que `getClaims()` e não `getUser()`

`getUser()` consulta o Auth server (com rede). É usado **na abertura do canal WebSocket** porque precisa detectar sessão revogada. Nas chamadas REST, `getClaims()` é suficiente e mais rápido — basta verificar assinatura e expiração.

**Limitação conhecida**: um token revogado (logout de outra aba) ainda passa no `getClaims()` até expirar. Para as rotas de trainer, isso é aceitável: a operação é idempotente dentro do horizonte de validade do token (~1h). Para o WebSocket, o `getUser()` na abertura já cobre.

### Renovação de token

O cliente acompanha a validade do token e renova antes de expirar. O servidor não renova nada.

## Rate Limit

O servidor tem limitação própria de tentativas, com a regra de produto do [jogo](../../game/AUTHENTICATION.md#proteção-contra-tentativas-excessivas): **5 tentativas falhas em 15 minutos, para o mesmo e-mail ou o mesmo IP**, e as novas tentativas ficam bloqueadas temporariamente.

### A regra

| Parte | Regra |
| --- | --- |
| O que conta | Uma **tentativa falha**: a resposta de cliente (4xx) de uma rota limitada. Uma resposta de sucesso não conta, e o erro de servidor (5xx) também não. |
| Janela | Os 15 minutos são uma janela deslizante: as tentativas mais velhas que a janela saem da contagem sozinhas. |
| Bloqueio | A partir da quinta falha, as tentativas seguintes são recusadas com `429` até a janela esvaziar — de poucos minutos a quinze. |
| A conta | A chave é o **e-mail da identidade autenticada**, lido do token validado. O e-mail do corpo da requisição nunca é uma chave. |
| O endereço | A chave é o endereço de onde a requisição veio. |

A resposta do bloqueio é a mesma do produto, no formato de erro padrão:

```
429 {
  "error": "rate_limited",
  "message": "Muitas tentativas. Tente novamente em alguns minutos."
}
```

A resposta traz também o header `Retry-After`, com os segundos que faltam para a janela esvaziar.

### As rotas limitadas

| Rota | Por quê |
| --- | --- |
| `POST /api/trainers` | A criação de treinador é a escrita de conta mais abusável. |
| `PATCH /api/trainers/:id` | A tentativa de renomear é a tentativa de tomar o nome de outro. |
| `DELETE /api/trainers/:id` | A deleção em cascata é a tentativa de apagar a conta de outro. |
| `POST /api/auth/google-merge` | A fusão de contas é a rota que move/trainers entre contas. |

**As leituras não são limitadas.** `GET /api/player/state` roda a cada comando do jogo, e as rotas de catálogo são lidas o tempo todo: uma leitura recusada não impede um abuso, apenas quebra o jogo. O limite conta tentativas, e uma leitura bem-sucedida não é uma tentativa.

> A tentativa que o servidor **não** conta é a que o jogador não pode repetir com outro resultado: `max_trainers_reached` (a conta já tem 5 treinadores) é estado da conta, e não uma tentativa que falhou.

### Onde o estado mora

O contador vive **na memória do processo**, em `apps/server/src/ratelimit/attemptLimiter.ts`. É a mesma restrição de instância única que a sessão do treinador já assume: o mapa `userId → trainerId` também é de processo.

> **Com mais de uma instância o limite enfraquece na proporção do número de instâncias.** Cada processo conta só as tentativas que ele viu, e o jogador que cair em uma instância diferente não é contado pelas outras. A correção é um contador compartilhado (Redis ou uma tabela do Postgres), que é o mesmo desenho da decisão de instância única ainda em aberto no [Stack](STACK.md#pendências).

### O endereço do cliente

O endereço vem do socket da conexão. Quando o servidor roda **atrás de um proxy**, a variável `TRUST_PROXY=1` faz o servidor ler o header `x-forwarded-for` — sem ela, todos os clientes compartilham o endereço do proxy, e o limite de IP vira um limite global.

> O header só é lido quando o servidor está configurado para confiar nele: um cliente que chega direto ao servidor poderia inventar qualquer endereço e escapar do limite.

### Onde o limite é aplicado

O limite é aplicado pelo guardião da rota, em `apps/server/src/ratelimit/protectedRoute.ts`, que é montado depois do middleware de autenticação — é por isso que a chave da conta é o e-mail do token, e não o do corpo. O guardião também é quem registra a falha, porque só ele conhece a resposta.

## Logging Estruturado

O log do servidor é feito com o `pino`, em JSON, e cada linha carrega o `requestId` da requisição — é ele que correlaciona a entrada, a saída e a recusa de um mesmo pedido.

### Os três momentos

| Momento | Onde | O que registra |
| --- | --- | --- |
| Entrada | Middleware de logging | Método, path, `requestId`, endereço do cliente. **O corpo da requisição nunca é registrado.** |
| Saída | Observador de resposta | Método, path, `requestId`, `userId`, status e duração. |
| Recusa | Guardião da rota | `requestId`, `userId`, status e o **código do erro** (`invalid_name`, `rate_limited`, `not_google_account`, …). |

E, por cima disso, **cada rota acrescenta o que é específico dela**, no sucesso:

| Rota | O que a rota registra |
| --- | --- |
| `POST /api/trainers` | `trainer created`: nome, gênero, espécie inicial e id do treinador |
| `GET /api/trainers` | `trainers listed`: a quantidade de treinadores da conta |
| `PATCH /api/trainers/:id` | `trainer updated`: nome e id do treinador |
| `DELETE /api/trainers/:id` | `trainer deleted`: id do treinador |
| `POST /api/session/trainer` | `trainer session opened`: id do treinador ativo |
| `POST /api/team` | `creature added to team`: id da criatura |
| `DELETE /api/team/:creatureId` | `creature removed from team`: id da criatura |
| `PUT /api/team` | `team reordered`: o tamanho do time |
| `POST /api/team/swap` | `active creature swapped`: id da criatura |
| `PUT /api/creatures/:id/ability-slots` | `ability slots written`: id da criatura e a quantidade de slots |
| `PUT /api/gear-slots/:slot` | `gear slot written`: id do item e slot |
| `DELETE /api/gear-slots/:slot` | `gear slot cleared`: slot |
| `POST /api/store/buy` | `store item bought`: id do item, quantidade e o custo |
| `POST /api/store/sell` | `store item sold`: id do item, quantidade e o rendimento |
| `POST /api/auth/google-merge` | `google account merged`: id da conta |

> A compra e a venda registram o **custo** e o **rendimento** da operação, e não o saldo de gold antes e depois. O saldo é estado da conta, e não da operação: ele é lido pela rota do estado, e um log que vira retrato da economia do jogador não serve para diagnosticar a operação.

### O que nunca é registrado

**Senha, token, `Authorization`, `refresh_token` e `access_token` não chegam ao log.** A defesa é dupla:

1. O logger é criado com a redação do `pino` (`apps/server/src/logging/logger.ts`), que apaga esses campos em qualquer nível.
2. Os campos das rotas passam pelo saneador (`apps/server/src/logging/sanitize.ts`), que remove recursivamente as chaves sensíveis, qualquer que seja a profundidade.

O corpo da requisição não é registrado em nenhum nível: a rota registra **campo por campo** o que ela recebeu, e o que ela recebeu é o que ela decidiu registrar.

## Persistência

O estado do trainer vive no Postgres do Supabase. O `trainerStore` que era um `Map` in-memory foi removido: não existe mais cópia do treinador em memória no servidor.

### Onde o schema mora

| Item | Onde |
| --- | --- |
| Migrations versionadas | `supabase/migrations/` |
| Catálogo de espécies, habilidades e itens | `supabase/seed.sql` |

| Migration | O que faz |
| --- | --- |
| `20261020230000_init.sql` | Schema inicial: `species`, `abilities`, `species_abilities`, `items`, `species_drops`, `type_effectiveness`, `trainers` e `creatures`, com RLS ligado e sem grant nem policy para `anon` e `authenticated`. |
| `20261020230001_service_role_policies.sql` | Policy explícita `for all to service_role` em cada tabela, e `search_path` fixo na função de `updated_at`. |
| `20261020230002_starter_species_and_atomicity.sql` | `trainers.starter_species_id`, a remoção de `creatures.owner_id`, a unicidade de `(species_id, ability_id)` e a RPC `create_trainer_with_starter`. |
| `20261020230003_trainers_starter_species_index.sql` | Índice de `trainers.starter_species_id`. |
| `20261020230004_city_inventory.sql` | A tabela `trainer_items`, o inventário do treinador, com RLS deny-by-default e trigger de `updated_at`. |
| `20261020230005_team_operations.sql` | As funções transacionais `add_creature_to_team`, `remove_creature_from_team` e `reorder_team`. |
| `20261020230006_hunt_areas.sql` | As tabelas `hunt_areas` e `hunt_area_species`, com RLS deny-by-default, índice em `species_id` e trigger de `updated_at`. |
| `20261020230007_skill_loadout.sql` | A coluna `creatures.current_hp`, as tabelas `creature_ability_slots` e `trainer_gear_slots`, a RPC `set_creature_ability_slots`, a RPC `swap_active_creature` e a carga inicial da criatura na RPC `create_trainer_with_starter`. |
| `20261020230008_skill_loadout_empty_slots.sql` | A RPC `set_creature_ability_slots` passa a aceitar `NULL` no lugar dos slots vazios da carga. |
| `20261020230009_swap_active_creature_positions.sql` | A RPC `swap_active_creature` passa a trocar a criatura escolhida com a criatura em campo, em vez de deslocar as outras. |
| `20261020230010_starter_backpack.sql` | A mochila inicial do treinador novo, sorteada dentro da RPC de criação. |
| `20261021100000_store_items.sql` | A coluna `items.is_store_item`, a restrição de preço dos itens da loja, e as RPCs transacionais `store_buy_item` e `store_sell_item`. |

O acesso é **deny-by-default**: RLS está ligado em todas as tabelas, `anon` e `authenticated` não têm grant nem policy, e só o `service_role` — que ignora RLS — enxerga os dados. O servidor, com a chave de serviço, é o único caminho de escrita.

### A camada de repositório

As rotas não falam com o Supabase diretamente. Elas recebem as dependências por injeção, em `apps/server/src/dependencies.ts`:

```
type ServerDependencies = {
  admin: SupabaseClient;
  claims: ClaimsReader;
  logger: Logger;
  sessions: TrainerSessionStore;
  users: UserReader;
};
```

Os repositórios vivem em `apps/server/src/db/`:

| Arquivo | Responsabilidade |
| --- | --- |
| `trainerRepository.ts` | Leitura e escrita de trainer, e a chamada da RPC de criação. |
| `speciesRepository.ts` | Leitura das espécies iniciais e das habilidades de cada uma. |
| `playerRepository.ts` | Leitura do time, do armazenamento, da mochila e das habilidades da espécie. |
| `teamRepository.ts` | As operações de time, que são chamadas transacionais no Postgres. |
| `huntAreaRepository.ts` | A leitura das áreas de caça e das espécies de cada área. |
| `loadoutRepository.ts` | A leitura e a escrita da carga da barra de habilidades, dos slots de habilidade e dos slots de equipamento. |
| `creatureAttributes.ts` | A fórmula dos atributos atuais da criatura e a leitura da vida. |
| `swapCooldown.ts` | A regra da espera de 5 segundos entre duas trocas manuais. |
| `huntAreaMappers.ts` | A tradução das linhas de área de caça para o tipo do contrato. |
| `tones.ts` | A derivação do tom de uma espécie e de um item. |
| `mappers.ts` | Tradução da linha do Postgres para o tipo do contrato. |
| `errors.ts` | Tradução do erro do Postgres para a resposta da API. |
| `types.ts` | O formato das linhas que o repositório lê. |

### O inventário do treinador

A mochila é a tabela `public.trainer_items`:

```
trainer_id  uuid  -> public.trainers (id)   on delete cascade
item_id     uuid  -> public.items (id)      on delete restrict
quantity    int   not null, check (quantity >= 0)
created_at  timestamptz
updated_at  timestamptz
```

A chave primária é o par `(trainer_id, item_id)`: um item aparece uma vez por treinador, com a quantidade que ele tem. A linha com quantidade zero é mantida — é o lugar onde o item volta quando é gasto —, e a mochila só mostra o que o treinador tem.

> O acesso é deny-by-default como em todas as outras tabelas: RLS ligado, `anon` e `authenticated` sem grant e sem policy, e só o `service_role` enxerga as linhas.

#### A mochila do treinador novo

Um treinador novo **não nasce de mãos vazias**: a mochila dele é sorteada no momento da criação, com consumíveis e dispositivos do catálogo, para que a interface tenha o que mostrar desde o primeiro minuto.

O sorteio acontece **dentro da RPC de criação**, na mesma transação que cria o treinador e a criatura inicial. Não existe janela em que o treinador existe sem a mochila.

A quantidade é sorteada em duas faixas:

| Categoria | Quantidade | Quantidade de cada item |
| --- | --- | --- |
| `consumable` | 3 a 5 itens, sem repetição | 1 a 99 |
| `device` | 2 a 3 itens, sem repetição | 1 a 99 |

O sorteio é **com semente**, e a semente vem da própria criação:

- A RPC `public.create_trainer_with_starter_seeded(p_owner_id, p_name, p_normalized_name, p_gender, p_starter_species_id, p_seed)` aceita a semente, e a mesma semente sempre dá a mesma mochila. É por aí que o teste controla o resultado.
- A RPC `public.create_trainer_with_starter(...)` é a mesma criação sem semente: quando a semente não é dada, **o id do treinador novo é a semente**. Como o id é um `uuid` aleatório, a mochila é aleatória, e ainda pode ser reproduzida a partir do id do treinador.

O gerador é um LCG (constantes de Numerical Recipes) mantido em `numeric`, para que a aritmética nunca transborde e a sequência seja a mesma em qualquer máquina. O sorteio vive em `public.fill_starter_backpack(p_trainer_id, p_seed)`, e o próximo número da sequência em `public.starter_next_random(p_state)`. As duas funções são `security invoker`, com `set search_path = ''`, e o `EXECUTE` é concedido só ao `service_role`.

> O repositório (`apps/server/src/db/trainerRepository.ts`) aceita a semente opcional em `CreateTrainerInput`: sem ela, o servidor chama a RPC sem semente; com ela, chama a RPC com semente.


### A carga da barra de habilidades

A barra de habilidades tem sete slots, e eles não são todos do mesmo dono: os quatro slots de habilidade são da criatura em campo, e os dois slots de consumível e o slot de dispositivo são do treinador. Por isso a carga mora em duas tabelas.

Os slots de habilidade da criatura:

```
creature_ability_slots
  creature_id  uuid  -> public.creatures (id)  on delete cascade
  slot         int   not null, check (slot between 0 and 3)
  ability_id   uuid  -> public.abilities (id)  on delete restrict
  created_at   timestamptz
  updated_at   timestamptz
  primary key (creature_id, slot)
```

Os slots do treinador:

```
trainer_gear_slots
  trainer_id         uuid  -> public.trainers (id)  on delete cascade
  slot               int   not null, check (slot between 4 and 6)
  kind               text  not null, check (kind in ('consumable','device'))
  item_id            uuid  -> public.items (id)     on delete restrict
  trigger_hp_percent int
  created_at         timestamptz
  updated_at         timestamptz
  primary key (trainer_id, slot)
```

A restrição de forma da tabela garante a regra dos slots: um slot de consumível (4 ou 5) tem `kind = 'consumable'` e um gatilho de vida entre 1 e 100, e o slot de dispositivo (6) tem `kind = 'device'` e nenhum gatilho. O acesso é deny-by-default como em todas as outras tabelas, e o `updated_at` das duas é mantido pelo trigger que reaproveita `public.set_updated_at()`.

> A carga inicial é escrita na mesma transação que cria a criatura: a RPC `create_trainer_with_starter` grava as habilidades da espécie nos slots da criatura inicial, na ordem do `slot` da espécie. Uma espécie com menos de quatro habilidades deixa o resto dos slots vazio.

A escrita da carga de uma criatura é a RPC `public.set_creature_ability_slots(p_creature_id, p_owner_id, p_ability_ids)`. Ela é transacional porque a carga é gravada como um todo: as linhas que faltam são criadas e as que sobraram são apagadas. A mesma habilidade não pode ocupar dois slots, e a RPC recusa a habilidade que não é da espécie com `P0001` e a mensagem `invalid_team_command`.

A troca da criatura em campo é a RPC `public.swap_active_creature(p_trainer_id, p_owner_id, p_creature_id)`. Ela **troca de lugar** a criatura escolhida com a criatura em campo: a escolhida toma o primeiro slot do time, que é o slot da criatura em campo, e a que estava em campo toma o slot que a escolhida tinha. As criaturas do meio **não mudam de lugar**: com o time `[A, B, C, D]` e a ativa em `A`, clicar em `D` deixa `[D, B, C, A]`. Como a troca toca em duas linhas de `creatures` ao mesmo tempo e o índice único parcial de `(trainer_id, team_slot)` recusa duas criaturas no mesmo slot, as duas criaturas saem dos slots por um instante e voltam, dentro da mesma transação.

### Os atributos atuais e a vida

Os atributos da criatura não são armazenados: eles são calculados no momento em que são usados, a partir do valor base da espécie, do potencial da criatura e do nível. A fórmula é a de [Criaturas](../../game/CREATURES.md#atributos-atuais):

```
Atributo = floor( Base × (1 − d + 2d × PV/100) × (1 + (Nível − 1) × k) )
```

As duas constantes são decididas pelo servidor:

| Constante | Valor | O que é |
| --- | --- | --- |
| `d` | `0.3` | O quanto o potencial pesa: o pior potencial tira 30% do valor base e o melhor acrescenta 30%. |
| `k` | `0.05` | O quanto a criatura cresce por nível: 5% do valor base para cada nível acima do primeiro. |

Com o potencial em 50% e no nível 1, o atributo sai exatamente o valor base, que é o que a fórmula exige. A fórmula vive em `apps/server/src/db/creatureAttributes.ts`, em funções puras.

> A documentação de produto ainda marca a fórmula dos atributos, e as constantes `d` e `k`, como pendentes. A decisão acima é do servidor e ainda precisa ser refletida em [Criaturas](../../game/CREATURES.md#atributos-atuais).

A **vida máxima** é o atributo de Vitalidade (`base_vitality`) calculado assim. A **vida restante** é o único valor da criatura que não pode ser derivado, e por isso ela é guardada em `creatures.current_hp`:

```sql
alter table public.creatures
  add column current_hp int null check (current_hp is null or current_hp >= 0);
```

Um valor `null` significa vida cheia: é o estado de uma criatura que nunca apanhou. Quem ainda escreve essa coluna é o gameplay, que não existe.

### A RPC de criação

Criar um treinador é uma chamada a `public.create_trainer_with_starter(p_owner_id, p_name, p_normalized_name, p_gender, p_starter_species_id)`. A função é `plpgsql`, `security invoker`, com `set search_path = ''`, e o `EXECUTE` é concedido só ao `service_role`.

A criação com semente é a mesma função com um parâmetro a mais: `public.create_trainer_with_starter_seeded(p_owner_id, p_name, p_normalized_name, p_gender, p_starter_species_id, p_seed)`. A função sem semente é uma casca que chama a outra com `null`, e a semente nula quer dizer "o id do treinador novo é a semente" — veja [A mochila do treinador novo](#a-mochila-do-treinador-novo).

Ela existe por dois motivos que o PostgREST não resolve:

1. **Atomicidade.** Criar o treinador e a criatura inicial exige escrever em duas tabelas. Pelo PostgREST, cada requisição é sua própria transação: uma falha no meio deixaria um treinador sem a criatura inicial. Dentro da RPC, as duas escritas acontecem na mesma transação — ou as duas acontecem, ou nenhuma.
2. **A corrida do limite de 5.** Contar os treinadores antes de inserir não serializa a contagem com a inserção: dois pedidos simultâneos da mesma conta poderiam ver 4 treinadores e criar dois, chegando a 6. A RPC toma um `pg_advisory_xact_lock` por conta antes de contar, o que serializa as criações concorrentes da mesma conta até a transação terminar.

Dentro da transação, a RPC:

- Conta os treinadores da conta e levanta `P0001` com a mensagem `max_trainers_reached` se já houver 5.
- Confere que a espécie existe e está marcada como inicial e levanta `P0001` com a mensagem `starter_unavailable` caso contrário.
- Insere o treinador. Um nome normalizado repetido viola o índice único e a RPC **não** engole o erro: o servidor traduz `23505` em `409 name_taken`.
- Insere a criatura inicial: nível 1, experiência 0, todos os potenciais em 50%, `is_in_team = true`, `team_slot = 1` e o nome do treinador como apelido.
- Equipa na criatura inicial as habilidades da espécie, na ordem do `slot` da espécie.
- Sorteia a mochila inicial do treinador — consumíveis e dispositivos — com a semente da criação.
- Devolve `{ trainer_id, creature_id }`.

### As funções de time

As três operações de time são funções transacionais no Postgres: `public.add_creature_to_team`, `public.remove_creature_from_team` e `public.reorder_team`. Todas são `plpgsql`, `security invoker`, com `set search_path = ''`, e o `EXECUTE` é concedido só ao `service_role`.

> A atomicidade é a mesma razão da [RPC de criação](#a-rpc-de-criação): o índice único parcial de `(trainer_id, team_slot)` recusa a troca de dois slots, porque as duas criaturas ocupariam o mesmo slot no meio da operação. Uma sequência de requisições ao PostgREST deixaria o time meio trocado e visível para o jogador; dentro de uma função, a troca é inteira ou não acontece.

- **`add_creature_to_team`** serializa as operações do treinador com um `for update` na linha do treinador, confere que a criatura é do treinador, e ocupa o primeiro slot livre de 1 a 5. Devolve o slot ocupado.
- **`remove_creature_from_team`** tira a criatura do time: `is_in_team = false` e `team_slot = null`, que a leva de volta ao [armazenamento](../../game/STORAGE.md).
- **`reorder_team`** esvazia os slots do time e os preenche de novo na ordem pedida. A lista recebida precisa ser exatamente o time atual: um id que não é do treinador é `creature_not_found` e um conjunto diferente do time atual é `invalid_team_command`.

As três levantam `P0001` com a mensagem do motivo da recusa, e o servidor traduz a exceção na resposta da API.

### Tradução dos erros do banco

`apps/server/src/db/errors.ts` traduz o erro do Postgres para a resposta da API:

| Código do Postgres | Situação | Resposta |
| --- | --- | --- |
| `23505` | Nome normalizado repetido | `409 name_taken` |
| `P0001` (`max_trainers_reached`) | Limite de 5 atingido | `409 max_trainers_reached` |
| `P0001` (`starter_unavailable`) | A espécie não é mais inicial | `400 starter_unavailable` |
| `P0001` (`creature_not_found`) | A criatura não existe ou não é do treinador | `404 creature_not_found` |
| `P0001` (`invalid_team_command`) | O comando não se aplica ao time atual | `400 invalid_team_command` |
| `P0001` (`team_full`) | O time já tem 5 criaturas | `409 team_full` |
| qualquer outro | — | `500 internal_error` |

## Rotas

Todas as rotas exigem `Authorization: Bearer <token>` válido, com uma exceção: `GET /api/health`.

| Rota | Resposta |
| --- | --- |
| `POST /api/trainers` | `201` com o trainer criado |
| `GET /api/trainers` | `200` com a lista de trainers da conta |
| `PATCH /api/trainers/:id` | `200` com o trainer atualizado |
| `DELETE /api/trainers/:id` | `204` sem body |
| `GET /api/starters` | `200` com as espécies iniciais |
| `POST /api/session/trainer` | `204` sem body |
| `GET /api/player/state` | `200` com o `PlayerState` |
| `POST /api/team` | `204` sem body |
| `PUT /api/team` | `204` sem body |
| `DELETE /api/team/:creatureId` | `204` sem body |
| `POST /api/team/swap` | `204` sem body |
| `PUT /api/creatures/:id/ability-slots` | `204` sem body |
| `PUT /api/gear-slots/:slot` | `204` sem body |
| `DELETE /api/gear-slots/:slot` | `204` sem body |
| `POST /api/auth/google-merge` | `200` com o resultado do merge |
| `GET /api/hunt-areas` | `200` com a lista de áreas de caça |
| `GET /api/hunt-areas/:id` | `200` com o detalhe de uma área de caça |
| `GET /api/store` | `200` com o catálogo da loja, a mochila e o gold |
| `POST /api/store/buy` | `200` com a mochila e o gold novos |
| `POST /api/store/sell` | `200` com a mochila e o gold novos |
| `POST /api/ws-ticket` | `200` com o ticket de uso único que abre o canal |
| `GET /api/health` | `200` com `{ status: 'ok' }` |

### `POST /api/trainers`

Cria um treinador para a conta autenticada, junto com a criatura inicial.

**Request**

```
{
  "name": string,           // 3-15 chars, letras/números/espaço/traço/underscore
  "gender": "male" | "female",
  "starterSpeciesId": string  // id da espécie inicial escolhida
}
```

`starterSpeciesId` é o id de uma **espécie**, não de uma criatura: a coluna `trainers.starter_species_id` guarda a espécie com a qual o treinador nasceu.

**Response 201**

```
{
  "id": string,
  "name": string,
  "gender": "male" | "female",
  "level": number,
  "starterSpeciesId": string,
  "createdAt": string,       // ISO 8601
  "gold": number,
  "diamonds": number,
  "staminaMinutes": number
}
```

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 400 | `invalid_name` | Formato do nome inválido |
| 400 | `invalid_gender` | `gender` não é `male` ou `female` |
| 400 | `invalid_starter` | `starterSpeciesId` não é um uuid |
| 400 | `starter_unavailable` | A espécie não existe ou não está marcada como inicial |
| 409 | `name_taken` | Nome já existe (case/acento-insensitive) |
| 409 | `max_trainers_reached` | Conta já tem 5 trainers |
| 401 | `unauthenticated` | Token ausente ou inválido |
| 500 | `internal_error` | Falha inesperada |

O limite de 5 também é conferido na rota, antes da RPC, para devolver `409 max_trainers_reached` sem chegar ao banco. A conferência dentro da RPC é a que fecha a corrida.

### `GET /api/trainers`

Lista os trainers da conta autenticada.

**Response 200**

```
{
  "trainers": [
    {
      "id": string,
      "name": string,
      "gender": "male" | "female",
      "level": number,
      "starterSpeciesId": string,
      "createdAt": string,
      "gold": number,
      "diamonds": number,
      "staminaMinutes": number
    }
  ]
}
```

**Erros**

| Status | code |
| --- | --- |
| 401 | `unauthenticated` |

A lista é sempre ordenada por `createdAt ASC` (mais antigo primeiro), com no máximo 5 entradas.

### `PATCH /api/trainers/:id`

Edita campos editáveis do trainer. Hoje apenas `name` e `gender`.

**Request**

```
{
  "name"?: string,
  "gender"?: "male" | "female"
}
```

Ao menos um dos dois precisa vir. O `starterSpeciesId` não é editável.

**Response 200** — o trainer atualizado, no mesmo formato do `POST /api/trainers`.

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 400 | `invalid_name` | Formato do nome inválido, ou nenhum campo editável no body |
| 400 | `invalid_gender` | `gender` não é `male` ou `female` |
| 409 | `name_taken` | Nome já existe |
| 404 | `trainer_not_found` | Trainer não existe ou não pertence à conta |
| 401 | `unauthenticated` | |

### `DELETE /api/trainers/:id`

Deleta o trainer e tudo ligado a ele (criaturas e, por cascata, o resto).

**Response 204** — sem body.

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 404 | `trainer_not_found` | Trainer não existe ou não pertence à conta |
| 401 | `unauthenticated` | |

A deleção é um único `DELETE` filtrado pelo dono: as criaturas do treinador caem por `on delete cascade` da chave estrangeira, na mesma transação do `DELETE`. Se qualquer parte falhar, nada é apagado.

### `GET /api/starters`

Lista as espécies iniciais, lidas do banco.

**Response 200**

```
{
  "starters": [
    {
      "id": string,
      "slug": string,
      "name": string,
      "element": "fire" | "water" | "plant" | "neutral",
      "description": string,
      "baseVitality": number,
      "basePhysicalAttack": number,
      "baseMagicAttack": number,
      "basePhysicalDefense": number,
      "baseMagicDefense": number,
      "captureChance": number,
      "baseExperience": number,
      "isStarter": true,
      "abilities": [
        {
          "id": string,
          "slug": string,
          "name": string,
          "element": "fire" | "water" | "plant" | "neutral",
          "damage": number,
          "cooldownMs": number,
          "description": string
        }
      ]
    }
  ]
}
```

**Erros**

| Status | code |
| --- | --- |
| 401 | `unauthenticated` |

A lista vem de `species where is_starter`, ordenada por nome, com as habilidades buscadas em `species_abilities` e ordenadas por slot. Não há constante hardcoded no servidor: mudar as espécies iniciais no banco muda o que a tela de criar treinador oferece, sem deploy.

### `POST /api/session/trainer`

Registra qual é o treinador ativo da conta.

**Request**

```
{
  "trainerId": string  // uuid
}
```

**Response 204** — sem body.

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 400 | `invalid_trainer` | Body ausente, sem `trainerId`, ou `trainerId` que não é um uuid |
| 404 | `trainer_not_found` | Trainer não existe ou não pertence à conta |
| 401 | `unauthenticated` | |

O `trainerId` precisa ser um uuid: ele chega ao Postgres como filtro, e um valor malformado quebraria a própria query. O servidor valida o formato antes de consultar.

### `GET /api/player/state`

Devolve o estado do jogador a partir do treinador ativo.

**Response 200**

```
{
  "trainer": Trainer,
  "team": [
    {
      "slot": number,
      "creature": {
        "id": string,
        "trainerId": string,
        "speciesId": string,
        "species": {
          "id": string,
          "slug": string,
          "name": string,
          "element": "fire" | "water" | "plant" | "neutral"
        },
        "nickname": string | null,
        "level": number,
        "experience": number,
        "potential": {
          "vitality": number,
          "physicalAttack": number,
          "magicAttack": number,
          "physicalDefense": number,
          "magicDefense": number
        },
        "isInTeam": boolean,
        "teamSlot": number | null,
        "capturedAt": string | null,
        "createdAt": string
      }
    }
  ],
  "storage": Creature[],
  "backpack": [
    {
      "itemId": string,
      "slug": string,
      "name": string,
      "category": "consumable" | "device" | "material",
      "description": string,
      "quantity": number
    }
  ],
  "activeCreatureId": string | null,
  "activeAbilities": [
    {
      "abilityId": string,
      "slug": string,
      "name": string,
      "element": "fire" | "water" | "plant" | "neutral",
      "damage": number,
      "cooldownMs": number,
      "slot": number
    }
  ],
  "activeVitals": {
    "currentHp": number,
    "maxHp": number
  } | null,
  "equippedAbilities": [
    {
      "abilityId": string,
      "slug": string,
      "name": string,
      "element": "fire" | "water" | "plant" | "neutral",
      "damage": number,
      "cooldownMs": number,
      "slot": number
    }
  ],
  "equippedConsumables": [
    {
      "itemId": string,
      "name": string,
      "quantity": number,
      "slot": number,
      "triggerHpPercent": number
    }
  ],
  "equippedDevice": {
    "itemId": string,
    "name": string,
    "quantity": number,
    "slot": number
  } | null,
  "gold": number,
  "diamonds": number,
  "staminaMinutes": number,
  "maxStaminaMinutes": number
}
```

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 404 | `trainer_not_found` | A conta não tem treinador ativo, ou ele não existe mais |
| 401 | `unauthenticated` | |

O teto de stamina é o mesmo para todo treinador: 720 minutos (12 horas).

Cada parte do estado tem uma regra de leitura:

- **`team`** — as criaturas com `is_in_team = true`, ordenadas por `team_slot`. É a ordem que define quem entra em campo.
- **`storage`** — as criaturas com `is_in_team = false`, ordenadas por `captured_at desc`: a captura mais recente vem primeiro, como a grade do [armazenamento](../../game/STORAGE.md) mostra.
- **`backpack`** — as linhas de `trainer_items` com `quantity > 0`, lidas junto do catálogo de itens. O item sem quantidade restante não aparece.
- **`activeCreatureId`** — a criatura do primeiro slot do time, ou `null` quando o time está vazio.
- **`activeAbilities`** — as habilidades da espécie da criatura ativa, ordenadas por `slot`.
- **`activeVitals`** — a vida da criatura ativa: o `currentHp` é o valor guardado em `creatures.current_hp` (a vida máxima, quando o valor é `null`) e o `maxHp` é o atributo de Vitalidade da criatura. É `null` quando o time está vazio.
- **`equippedAbilities`** — a carga de habilidades da criatura ativa, lida de `creature_ability_slots` e ordenada por `slot`. É a barra que a criatura usa, e não a lista de habilidades da espécie.
- **`equippedConsumables`** — os slots de consumível do treinador (4 e 5), com a `quantity` vinda da mochila: zero quando o treinador não tem o item.
- **`equippedDevice`** — o slot de dispositivo (6), ou `null` quando o slot está vazio.

### `POST /api/team`

Põe uma criatura do treinador no primeiro slot livre do time.

**Request**

```
{
  "creatureId": string  // uuid
}
```

**Response 204** — sem body.

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 400 | `invalid_team_command` | O body está ausente, sem `creatureId`, ou o `creatureId` não é um uuid |
| 400 | `invalid_team_command` | A criatura já está no time |
| 404 | `creature_not_found` | A criatura não existe ou não é do treinador |
| 404 | `trainer_not_found` | A conta não tem treinador ativo |
| 409 | `team_full` | O time já tem 5 criaturas |
| 401 | `unauthenticated` | |

O primeiro slot livre é o menor número entre 1 e 5 que nenhuma criatura do time ocupa. A criatura que entra no time sai do [armazenamento](../../game/STORAGE.md).

### `PUT /api/team`

Reescreve a ordem do time.

**Request**

```
{
  "order": string[]  // os ids das criaturas do time, na ordem desejada
}
```

**Response 204** — sem body.

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 400 | `invalid_team_command` | O body está ausente, sem `order`, ou a lista não tem ids válidos ou repetidos |
| 400 | `invalid_team_command` | A lista não é exatamente o time atual |
| 404 | `creature_not_found` | Algum id não é uma criatura do treinador |
| 404 | `trainer_not_found` | A conta não tem treinador ativo |
| 401 | `unauthenticated` | |

A ordem do time é o que define quem entra em campo quando uma criatura desmaia, então a reordenação muda o `activeCreatureId` do `GET /api/player/state`.

### `DELETE /api/team/:creatureId`

Tira uma criatura do time. A criatura volta para o [armazenamento](../../game/STORAGE.md).

**Response 204** — sem body.

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 404 | `creature_not_found` | A criatura não existe, não é do treinador, ou não está no time |
| 404 | `trainer_not_found` | A conta não tem treinador ativo |
| 401 | `unauthenticated` |

### `POST /api/team/swap`

A troca manual da criatura em campo: a criatura escolhida **troca de lugar** com a criatura em campo. A escolhida toma o primeiro slot do time, que é o slot da criatura em campo, e a que estava em campo toma o slot que a escolhida tinha. As criaturas do meio ficam onde estão: com o time `[A, B, C, D]` e a ativa em `A`, o resultado é `[D, B, C, A]`.

**Request**

```
{
  "creatureId": string  // uuid
}
```

**Response 204** — sem body.

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 400 | `invalid_team_command` | O body está ausente, sem `creatureId`, ou o `creatureId` não é um uuid |
| 404 | `creature_not_found` | A criatura não existe, não é do treinador, ou não está no time |
| 404 | `trainer_not_found` | A conta não tem treinador ativo |
| 429 | `swap_cooldown` | Houve uma troca manual nos últimos 5 segundos |
| 401 | `unauthenticated` | |

A espera de 5 segundos é a regra do [Treinador](../../game/TRAINER.md#troca-manual): depois de uma troca manual, nenhuma outra troca acontece até que a espera passe. O instante da última troca mora no [store de sessão](#a-sessão-do-treinador), na memória do processo, e não no banco: é uma regra do momento, e não um dado da conta.

> A espera é da **troca da criatura em campo**, e não do remanejamento do time. O `PUT /api/team`, que reordena o time na cidade, não tem espera nenhuma. A troca automática, que acontece quando a criatura em campo desmaia, também não: ela não é uma escolha do jogador.

> A espera é conferida antes da troca: uma segunda troca dentro dos 5 segundos responde `429`, mesmo que a criatura pedida não exista.

### `PUT /api/creatures/:id/ability-slots`

Grava a carga de habilidades de uma criatura: os quatro slots de habilidade da barra.

**Request**

```
{
  "abilityIds": string[]  // até 4 entradas, na ordem dos slots
}
```

A lista é a carga inteira, na ordem dos slots: a entrada de índice `i` é a habilidade do slot `i`, e uma entrada vazia (`""`) é um slot vazio. Uma lista com menos de quatro entradas deixa os slots do fim vazios.

> A lista é a carga da criatura, e não a lista de habilidades da espécie: a espécie é o que a criatura **pode** usar, e a carga é o que ela **está** usando. Uma habilidade que não é da espécie da criatura é recusada, e a mesma habilidade não pode ocupar dois slots.

**Response 204** — sem body.

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 400 | `invalid_team_command` | O body está ausente, `abilityIds` não é uma lista, ou a lista tem mais de 4 entradas |
| 400 | `invalid_team_command` | Uma entrada não é um uuid nem uma string vazia |
| 400 | `invalid_team_command` | A mesma habilidade aparece duas vezes na lista |
| 400 | `invalid_team_command` | Alguma habilidade não é da espécie da criatura |
| 404 | `creature_not_found` | A criatura não existe ou não é do treinador |
| 404 | `trainer_not_found` | A conta não tem treinador ativo |
| 401 | `unauthenticated` | |

A gravação é transacional: as linhas que faltam são criadas e as que sobraram são apagadas, na mesma transação. É a RPC `public.set_creature_ability_slots`, que recebe a lista com `NULL` no lugar dos slots vazios.

### `PUT /api/gear-slots/:slot`

Põe um item em um dos três slots da barra que pertencem ao treinador: os dois slots de consumível (4 e 5) e o slot de dispositivo (6).

**Request**

```
{
  "itemId": string,             // uuid
  "triggerHpPercent"?: number  // 1 a 100, obrigatório nos slots de consumível
}
```

O slot 6 é o dispositivo: ele não tem gatilho de vida, e um `triggerHpPercent` no corpo é recusado. Os slots 4 e 5 são os consumíveis: eles exigem o gatilho, que é a porcentagem de vida que dispara o consumível.

**Response 204** — sem body.

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 400 | `invalid_team_command` | O slot não é 4, 5 ou 6 |
| 400 | `invalid_team_command` | O body está ausente, o `itemId` não é um uuid, ou o gatilho está fora de 1 a 100 |
| 400 | `invalid_team_command` | O slot de consumível não recebeu o gatilho, ou o slot de dispositivo recebeu um |
| 400 | `invalid_team_command` | O item não existe, ou a categoria dele não é a do slot |
| 404 | `trainer_not_found` | A conta não tem treinador ativo |
| 401 | `unauthenticated` | |

### `DELETE /api/gear-slots/:slot`

Esvazia um dos três slots da barra que pertencem ao treinador.

**Response 204** — sem body.

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 400 | `invalid_team_command` | O slot não é 4, 5 ou 6 |
| 404 | `trainer_not_found` | A conta não tem treinador ativo |
| 401 | `unauthenticated` | |

### `POST /api/auth/google-merge`

Executa o merge da conta Google com conta de e-mail+senha, conforme `docs/game/AUTHENTICATION.md`.

**Quando é chamado**: depois que o usuário entra via Google e o cliente detecta que existe conta de e-mail+senha com o mesmo e-mail verificado.

**Request**

```
{
  "email": string
}
```

**Comportamento do servidor**

1. Lê o usuário autenticado no Auth admin e tira o **e-mail da identidade** dele.
2. Se o corpo trouxer um `email` diferente do e-mail da identidade, **recusa com `400 invalid_email`** — a fusão não acontece.
3. Verifica que o usuário autenticado tem uma identidade Google.
4. Verifica que o e-mail dessa identidade Google está verificado.
5. Procura uma conta de e-mail+senha com **o e-mail da identidade**, em outra conta. A busca percorre a listagem de usuários do Auth admin.
6. **Transfere os treinadores** da conta de senha para a conta Google.
7. **Deleta a conta de e-mail+senha**, o que descarta a senha e encerra as sessões dela.
8. Mantém o usuário logado na sessão Google atual.

**Response 200**

```
{
  "merged": true,
  "userId": string
}
```

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 400 | `invalid_email` | E-mail do corpo com formato inválido, ou diferente do e-mail da identidade autenticada |
| 409 | `not_google_account` | Usuário atual não entrou via Google |
| 409 | `email_unverified` | E-mail Google não verificado |
| 409 | `no_password_account` | Não existe conta de e-mail+senha com esse e-mail |
| 429 | `rate_limited` | A conta ou o endereço excedeu o [rate limit](#rate-limit) |
| 401 | `unauthenticated` | |
| 500 | `internal_error` | Falha inesperada |

> **O e-mail que a busca usa é o da identidade autenticada, nunca o do corpo.** O `email` do body é opcional e serve apenas para conferência: quando ele vem, precisa ser igual ao e-mail da identidade autenticada, e um e-mail diferente é recusado com `400 invalid_email`. Sem essa conferência, um usuário Google poderia pedir a fusão com o e-mail de outra pessoa e trazer os treinadores dela para a sua conta. A conferência vem **antes** das verificações de Google: a resposta não depende de como a conta entrou, e um e-mail divergente nunca chega a fundir conta nenhuma.

### `GET /api/health`

Verifica que o processo está no ar.

**Response 200**

```
{
  "status": "ok"
}
```

Única rota pública: não exige token.

## Áreas de Caça

O catálogo de áreas de caça é lido do Postgres e servido em duas rotas. As duas exigem `Authorization: Bearer <token>` válido.

### O que está no banco

```
hunt_areas
  id uuid primary key
  slug text unique
  name text
  description text
  recommended_level int     -- nível sugerido, não bloqueia
  minimum_level int
  tone text                 -- 'arcane' | 'blood' | 'ember' | 'frost' | 'gold' | 'neutral' | 'verdant'
  created_at timestamptz
  updated_at timestamptz
```

```
hunt_area_species
  hunt_area_id uuid  -> public.hunt_areas (id)  on delete cascade
  species_id    uuid  -> public.species (id)     on delete restrict
  is_primary    boolean
  position      int
  primary key (hunt_area_id, species_id)
```

O acesso é deny-by-default como em todas as outras tabelas: RLS ligado, `anon` e `authenticated` sem grant nem policy, e só o `service_role` enxerga as linhas. O `updated_at` da área é mantido pelo trigger que reaproveita `public.set_updated_at()`.

O catálogo inicial está em `supabase/seed.sql`, com as áreas em `upsert` por `slug`. As áreas do seed são **catálogo do jogo**, não dado de teste: elas não são apagadas pela suíte de integração.

### `GET /api/hunt-areas`

Lista as áreas de caça.

**Response 200**

```
{
  "areas": [
    {
      "id": string,
      "slug": string,
      "name": string,
      "description": string,
      "recommendedLevel": number,
      "minimumLevel": number,
      "tone": "arcane" | "blood" | "ember" | "frost" | "gold" | "neutral" | "verdant",
      "species": [
        {
          "species": { "id": string, "slug": string, "name": string, "element": Element },
          "tone": HuntAreaTone
        }
      ],
      "primarySpecies": { "species": SpeciesSummary, "tone": HuntAreaTone }
    }
  ]
}
```

A lista **não traz itens**: a lista de itens é do detalhe.

A ordem é do servidor, **do menor nível recomendado para o maior** (desempate pelo `slug`). A ordem vem do servidor porque o cliente não decide nada sobre o conteúdo da lista.

A espécie principal vem **primeiro** em `species`, e `primarySpecies` é a mesma criatura. Assim o card da área pode desenhar a criatura principal sem procurar, e a busca por nome de criatura no cliente tem o nome de cada espécie à mão.

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 401 | `unauthenticated` | Token ausente ou inválido |
| 500 | `internal_error` | Falha inesperada |

### `GET /api/hunt-areas/:id`

Devolve o detalhe de uma área.

**Response 200** — o mesmo formato da área da lista, mais:

```
{
  ...
  "items": [
    {
      "itemId": string,
      "slug": string,
      "name": string,
      "category": "consumable" | "device" | "material",
      "tone": HuntAreaTone
    }
  ]
}
```

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 404 | `trainer_not_found` | A área não existe, ou o id não é um uuid |
| 401 | `unauthenticated` | Token ausente ou inválido |
| 500 | `internal_error` | Falha inesperada |

> O código de erro da área não encontrada é `trainer_not_found`, o mesmo das rotas de treinador. `TrainerErrorCode` é um conjunto fechado e o cliente tem um `Record` exaustivo dele: usar um código novo quebraria o cliente. A semântica do código é de treinado, mas o formato da resposta é o mesmo.

### A união dos itens

Os itens de uma área são a **união dos drops das espécies da área**. Não há tabela de itens por área: a regra vale sem dado duplicado, e um item que duas espécies dropam aparece uma única vez.

O servidor lê `species_drops` das espécies da área e deduplica por item. O drop continua sendo decided no serviço, no desmaio da criatura selvagem.

### O tom

O tom é uma regra de apresentação, e a apresentação é do servidor. O cliente resolve o tom nos tokens de paleta e nunca inventa o tom de uma criatura ou de um item.

| Origem | Regra |
| --- | --- |
| Espécie | `fire` → `ember`, `water` → `frost`, `plant` → `verdant`, `neutral` → `neutral` |
| Item | `consumable` → `verdant`, `device` → `frost`, `material` → `gold` |
| Área | Escolhido pelo design e guardado em `hunt_areas.tone` |

O mapeamento está em `apps/server/src/db/tones.ts`.

### A busca

A busca por nome de área **ou** por nome de criatura é feita no cliente, e o servidor devolve a lista completa. O nome de cada espécie está em `species[].species.name`, o que torna a busca por criatura possível do lado do cliente, sem endpoint de busca.

> A normalização da busca (acentos e maiúsculas) é do cliente, como em toda busca de interface. O servidor não filtra, para que a lista do servidor continue sendo a lista do servidor.

## A Loja

A loja da cidade compra consumíveis e dispositivos e vende o que o treinador tem na mochila. As regras de jogo estão em [Loja](../../game/STORE.md); esta seção descreve a API.

### O que a loja vende

A coluna `public.items.is_store_item` decide o catálogo da loja: ela marca os **3 consumíveis** (Poção de Cura, Poção de Cura Forte, Poção Fraca) e os **3 dispositivos** (Prisma de Captura, Cristal Bruto, Prisma Simples). O resto do catálogo — Elixir de Stamina, Frasco Antídoto e os materiais — não é vendido pela loja.

O preço é o da coluna `items.price`: a compra cobra o valor cheio e a venda rende **90%** dele, arredondado para o inteiro mais próximo. A restrição `items_store_price_check` recusa um item da loja sem preço.

### A transação

Comprar e vender são **funções transacionais no Postgres**: `public.store_buy_item(p_trainer_id, p_item_id, p_quantity)` e `public.store_sell_item(p_trainer_id, p_item_id, p_quantity)`. São `plpgsql`, `security invoker`, com `set search_path = ''`, e o `EXECUTE` é concedido só ao `service_role`.

A transação é o que garante que o saldo nunca fica inconsistente:

- **A compra** debita o gold e soma a quantidade na mochila, na mesma transação. A linha de `trainer_items` é criada quando ela não existe. A linha do treinador é travada com `for update`, então dois pedidos ao mesmo tempo não gastam o mesmo gold.
- **A venda** remove a quantidade da mochila e credita o gold, na mesma transação. A linha da mochila é travada com `for update`, então a quantidade vendida nunca passa da que o treinador tem.

As duas levantam `P0001` com a mensagem do motivo da recusa, e o servidor traduz a exceção na resposta.

### `GET /api/store`

O catálogo da loja, a mochila do treinador e o gold.

**Response 200**

```
{
  "items": [
    {
      "id": string,          // uuid
      "slug": string,
      "name": string,
      "description": string,
      "category": "consumable" | "device" | "material",
      "price": number        // o preço de compra, em gold
    }
  ],
  "bag": [
    {
      "itemId": string,      // uuid
      "slug": string,
      "name": string,
      "description": string,
      "category": "consumable" | "device" | "material",
      "quantity": number,    // o total do item, agrupado por itemId
      "sellPrice": number    // 90% do preço de compra, arredondado
    }
  ],
  "gold": number
}
```

A mochila vem com o catálogo porque a aba de venda mostra ela: o jogador vende o que tem, e o valor da venda vem do mesmo catálogo que a aba de compra mostra.

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 404 | `trainer_not_found` | A conta não tem treinador ativo, ou ele não existe mais |
| 401 | `unauthenticated` | |

### `POST /api/store/buy`

Compra um item da loja. A compra **não tem confirmação**: o clique executa.

**Request**

```
{
  "itemId": string,   // uuid
  "quantity": number  // inteiro de 1 a 999999
}
```

**Response 200**

```
{
  "bag": [ /* a mochila nova, no mesmo formato do GET */ ],
  "gold": number,     // o gold novo
  "total": number     // o que a compra custou
}
```

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 400 | `store_invalid_quantity` | A quantidade não é um inteiro entre 1 e 999999 |
| 400 | `store_item_unavailable` | O `itemId` não é um uuid |
| 404 | `store_item_unavailable` | O item não existe ou não está à venda |
| 409 | `store_insufficient_gold` | O gold do treinador não paga a compra |
| 404 | `trainer_not_found` | A conta não tem treinador ativo |
| 401 | `unauthenticated` | |

### `POST /api/store/sell`

Vende uma quantidade de um item da mochila. A venda **não tem confirmação** e, nesta fase, é **sempre total**: o jogador não escolhe a quantidade.

**Request**

```
{
  "itemId": string,   // uuid
  "quantity": number  // inteiro de 1 a 999999
}
```

**Response 200** — o mesmo formato da compra, com o `total` sendo o que a venda rendeu.

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 400 | `store_invalid_quantity` | A quantidade não é um inteiro entre 1 e 999999 |
| 400 | `store_item_unavailable` | O `itemId` não é um uuid |
| 404 | `store_item_unavailable` | O item não existe ou não tem preço |
| 404 | `store_item_not_in_backpack` | O treinador não tem o item, ou não tem a quantidade pedida |
| 404 | `trainer_not_found` | A conta não tem treinador ativo |
| 401 | `unauthenticated` | |

### O push do estado

As duas operações empurram o `state_snapshot` pelo WebSocket depois de responder: o gold e a mochila mudaram, e a tela precisa saber. O push usa o mesmo broadcaster das outras rotas (`apps/server/src/ws/stateBroadcaster.ts`).

### Os códigos de erro

Os códigos da loja vivem no namespace do contrato da loja (`apps/shared/contracts/store.ts`), e não em `TrainerErrorCode`: aquele é um conjunto fechado, e o cliente tem um `Record` exaustivo dele.

| code | Status | Quando |
| --- | --- | --- |
| `store_invalid_quantity` | 400 | A quantidade não é um inteiro entre 1 e 999999 |
| `store_item_unavailable` | 400 / 404 | O item não existe, não está à venda ou o `itemId` está malformado |
| `store_insufficient_gold` | 409 | O gold do treinador não paga a compra |
| `store_item_not_in_backpack` | 404 | O treinador não tem o item na quantidade pedida |
| `trainer_not_found` | 404 | A conta não tem treinador ativo |

## Regras de Negócio

### Validação de nome

Regras aplicadas pelo servidor (espelham o `docs/game/AUTHENTICATION.md`):

- 3 a 15 caracteres após `trim()`.
- Apenas letras (com ou sem acento), números, espaços, traços e underscores.
- Sem espaços consecutivos. Sem espaço no início ou no fim (já removidos pelo `trim()`).
- Comparação de unicidade é case-insensitive e accent-insensitive.

A normalização accent-insensitive usa `String.prototype.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`. O servidor compara a versão normalizada.

O `trainers.normalized_name` tem restrição de unicidade no banco, e é ele que garante a regra em nível de dado, e não só de aplicação.

### Limite de 5 trainers

Verificado em `POST /api/trainers`. Se a conta já tem 5, retorna `409 max_trainers_reached`. A verificação acontece na rota e de novo dentro da RPC, que serializa as criações concorrentes da mesma conta.

### Unicidade de nome

Verificado em `POST` e `PATCH`. O nome normalizado é gravado em `trainers.normalized_name`, que é único no banco: a violação chega como `23505` e vira `409 name_taken`.

### Deleção em cascata

`DELETE /api/trainers/:id` apaga o trainer e todas as linhas referenciadas. O dono é filtrado na própria query, então um trainer de outra conta responde `404` em vez de ser apagado.

### Merge Google

Veja `POST /api/auth/google-merge` acima. A regra de descartar a senha é crítica: se a conta pré-existente tinha senha, ela some junto com a conta. O usuário que quiser continuar usando e-mail+senha precisa redefinir via fluxo de recovery (`docs/game/AUTHENTICATION.md`).

## Erros

Toda resposta de erro tem o formato:

```
{
  "error": string,        // código machine-readable
  "message": string,      // mensagem human-readable, exibida ao usuário
  "details"?: object      // opcional, dados extras (e.g. campo que falhou)
}
```

O servidor nunca retorna stack trace, mensagem de SQL crua, ou qualquer informação de implementação. A mensagem é genérica o suficiente para ser mostrada ao usuário sem revelar detalhes internos.

### Códigos do contrato de trainer

`TrainerErrorCode` (`apps/shared/contracts/trainer.ts`) é o conjunto fechado dos códigos das rotas de trainer:

| code | Status | Quando |
| --- | --- | --- |
| `invalid_name` | 400 | Formato do nome inválido |
| `invalid_gender` | 400 | `gender` fora de `male`/`female` |
| `invalid_starter` | 400 | `starterSpeciesId` não é um uuid |
| `invalid_trainer` | 400 | `trainerId` ausente ou malformado em `POST /api/session/trainer` |
| `invalid_team_command` | 400 | Comando de time inválido, ou que não se aplica ao time atual |
| `starter_unavailable` | 400 | A espécie não existe ou não está marcada como inicial |
| `name_taken` | 409 | Nome normalizado já existe |
| `max_trainers_reached` | 409 | A conta já tem 5 treinadores |
| `team_full` | 409 | O time já tem 5 criaturas |
| `swap_cooldown` | 429 | Houve uma troca manual da criatura em campo nos últimos 5 segundos |
| `trainer_not_found` | 404 | Trainer não existe, não pertence à conta, ou não há treinador ativo |
| `creature_not_found` | 404 | A criatura não existe, não pertence ao treinador, ou não está no time |
| `unauthenticated` | 401 | Token ausente ou inválido |

Fora do contrato de trainer, o servidor também responde `not_found` (404), `method_not_allowed` (405), `invalid_email` (400), `not_google_account`, `email_unverified` e `no_password_account` (409), `upgrade_failed` (400, na abertura do WebSocket) e `internal_error` (500).

### Códigos do contrato de rate limit

O código do [rate limit](#rate-limit) vive no namespace do contrato do rate limit (`apps/shared/contracts/rateLimit.ts`), e não em `TrainerErrorCode`: aquele é um conjunto fechado, e o cliente tem um `Record` exaustivo dele.

| code | Status | Quando |
| --- | --- | --- |
| `rate_limited` | 429 | A conta ou o endereço já teve 5 tentativas falhas em 15 minutos |

## Sessão do Treinador

> Decisão de produto confirmada: a sessão do trainer é **server-side, opaca para o cliente**.

O servidor mantém um mapa `userId → trainerId ativo` em memória (`apps/server/src/session/trainerSession.ts`). O `trainerId` chega ao servidor em dois momentos — `POST /api/session/trainer` e a mensagem `select_trainer` do WebSocket — e, a partir daí, é o servidor quem sabe qual trainer está aberto: as operações de jogo não precisam mandar `trainerId` no payload.

O mapa é por processo: ele não sobrevive a um reinício do servidor e não é compartilhado entre instâncias.

### A memória da troca

O store de sessão guarda também o instante da última troca manual da criatura em campo, que é o que segura a [espera de 5 segundos](#post-apiteamswap). Essa memória é do processo, como o resto do store: ela não vai para o banco e não sobrevive a um reinício.

> A espera é uma regra do momento, e não um dado da conta. Guardá-la no Postgres daria a ela uma sobrevida que a regra não tem: depois de um reinício do servidor, a troca recomeça como se nunca tivesse acontecido.

A memória é por treinador: quando o jogador troca de treinador, a espera da batalha anterior não o acompanha.

### Como o trainer ativo é definido

- `POST /api/session/trainer` registra `userId → trainerId` no mapa, depois de confirmar que o trainer pertence à conta.
- A mensagem `select_trainer` do WebSocket faz o mesmo.
- Quando o jogador troca de treinador, o registro é sobrescrito.

### Por que não em localStorage

- Cliente não pode mudar para outro trainer sem o servidor saber.
- Se o cliente forjar `trainerId`, o servidor aceita (e o cliente "logado" como outro trainer). Com sessão server-side, isso é impossível.
- A regra de "uma conta pode ter um treinador conectado por vez" é do servidor — manter o estado no servidor é coerente com essa regra.

### Implicação para a API REST

As rotas de trainer (`POST /api/trainers`, `GET /api/trainers`, `PATCH`, `DELETE`) **não** operam sobre um trainer ativo — operam sobre qualquer trainer da conta. A sessão de trainer importa para o WebSocket, para `GET /api/player/state` e para as rotas de time (`POST /api/team`, `PUT /api/team`, `DELETE /api/team/:creatureId`), que operam sempre sobre o treinador ativo: o cliente não manda o `trainerId` no corpo do comando.

> As rotas de time só leem o registro da sessão. Elas não o alteram: trocar de treinador continua sendo `POST /api/session/trainer`.

## WebSocket

O canal fica em `/ws`, no mesmo `Bun.serve` que serve o HTTP. A implementação está em `apps/server/src/ws/gameSocket.ts`.

### Abertura

O canal é aberto com um **ticket de uso único** na query string: `GET /ws?ticket=<ticket>`.

1. Sem ticket, ou com ticket vazio → `401 { error: 'unauthenticated' }`.
2. O ticket é consumido do store. Ticket desconhecido, já usado ou expirado → `401`.
3. O token que viaja dentro do ticket é revalidado no Auth server, com `getUser()`. É essa validação com rede que detecta uma sessão revogada. Token inválido, expirado, ou de outra conta → `401`.
4. Se o upgrade falhar → `400 { error: 'upgrade_failed' }`.

> O token do Supabase **não** viaja na query string. O upgrade do Bun não recebe headers, e um JWT na query string é registrado por qualquer proxy ou balanceador à frente do servidor. O token viaja dentro do ticket, que é opaco, de uso único e válido por 30 s. O ticket e o token **nunca são logados**: o servidor registra a abertura pelo `userId`, e o log de requisição HTTP registra apenas o `pathname`, sem a query.

Depois da abertura, o canal **não** revalida o token: as mensagens seguintes são atendidas com o `userId` registrado na conexão.

### `POST /api/ws-ticket`

Emite o ticket que abre o canal do jogo.

**Request** — sem corpo. Exige `Authorization: Bearer <token>` válido, como toda rota de trainer.

**Response 200**

```
{
  "ticket": string,      // opaco, de uso único
  "expiresAt": number    // em milissegundos, o instante em que o ticket deixa de abrir o canal
}
```

**Erros**

| Status | code | Quando |
| --- | --- | --- |
| 401 | `unauthenticated` | Token ausente ou inválido |

O ticket carrega a identidade da conta **e** o token dela. O token precisa viajar junto porque o upgrade revalida o token no Auth server: sem a revalidação haveria uma janela de 30 s em que uma sessão revogada ainda abriria canal.

> O ticket é de uso único: consumir o ticket o remove do store, e o mesmo valor nunca abre dois canais. Ele vive na memória do processo, como a sessão do treinador e o registro das conexões. O `ticket` e o `token` nunca são registrados em log.

### Uma conta, uma conexão

O servidor mantém um mapa `userId → conexão`. Quando uma segunda conexão chega para a mesma conta, a anterior é fechada com o código `4001` e a razão `replaced by a newer connection`.

> O código não é `1000` de propósito: o cliente reconecta automaticamente depois de um encerramento normal, e duas abas da mesma conta se derrubariam em laço, cada uma reconectando logo depois de a outra fechá-la. O cliente lê o `4001` e não reabre.

O mapa mora em `apps/server/src/ws/connections.ts`, fora do handler do WebSocket: as rotas HTTP precisam dele para empurrar o estado. O `ConnectionRegistry` é criado em `apps/server/src/index.ts` e entregue tanto ao handler do WebSocket quanto ao broadcaster.

### A entrada e a saída do treinador

A sessão do treinador decide o canal do jogo.

- **`POST /api/session/trainer`** registra o treinador ativo e **derruba a conexão anterior** da conta, com o código `4001`. A conta tem uma sessão e um canal: a conexão antiga continuaria recebendo o estado de uma sessão que já não é a do cliente.
- **`DELETE /api/session/trainer`** desconecta o treinador e **fecha o canal** da conta, com o código `1000`. A sessão da conta continua viva: só o treinador sai.

> O cliente sabe que o fechamento é consequência do comando dele, e não trata isso como conexão perdida. O `4001` da entrada é o que impede as duas abas de se derrubarem em laço; o `1000` da saída é o encerramento normal, e o cliente não o conta como perda.

### Os códigos de fechamento

| Código | Significado |
| --- | --- |
| `1000` | Encerramento normal, inclusive a desconexão do treinador |
| `4001` | A conexão foi substituída por outra mais recente |

### A vivacidade

O Bun manda ping de protocolo (`sendPings`) e o `idleTimeout` de 120 s fecha a conexão ociosa. O `pong` de protocolo não chega no evento `message` do browser: ele tem o seu próprio handler, e é lá que o servidor marca a conexão como viva.

Uma varredura a cada 30 s fecha as conexões silenciosas há mais de 120 s. O servidor não confia só no timer do runtime: o limite do servidor é o que decide o que é "ocioso".

### O push do estado

O servidor **empurra o estado** depois de cada comando que muda o estado, para que o cliente não precise rebuscar o estado inteiro depois do comando. O push é o mesmo `state_snapshot` que o `select_trainer` devolve: o cliente aplica o push e reconcilia.

O empurrador é o `StateBroadcaster`, em `apps/server/src/ws/stateBroadcaster.ts`, e ele vive em `ServerDependencies` (`broadcaster`). Ele:

1. Procura a conexão da conta no registro. **Sem conexão, nada acontece** — o cliente usa a rebusca REST como reserva.
2. Enfileira o push por conta, para que dois comandos seguidos gerem dois snapshots **na ordem**.
3. Carrega o `PlayerState` novo do banco — o push sai **depois** da transação, então é o estado novo — e envia pelo canal.

O que empurra estado:

| Comando | Rota |
| --- | --- |
| Equipar habilidades | `PUT /api/creatures/:id/ability-slots` |
| Equipar consumível ou dispositivo | `PUT /api/gear-slots/:slot` |
| Limpar um slot | `DELETE /api/gear-slots/:slot` |
| Trocar a criatura em campo | `POST /api/team/swap` |
| Adicionar uma criatura ao time | `POST /api/team` |
| Remover uma criatura do time | `DELETE /api/team/:creatureId` |
| Reordenar o time | `PUT /api/team` |

A resposta HTTP do comando continua sendo `204`, sem corpo: o que o cliente precisa é o retrato, e ele chega pelo canal. O `select_trainer` usa o mesmo caminho do broadcaster, então há um único lugar que monta e envia o retrato.

### Mensagens

Toda mensagem carrega a versão do protocolo, no campo `v`. Uma mensagem de outra versão é recusada com `error` e o código `invalid_message`: o envelope existe para que uma mudança de protocolo seja rejeitada com clareza, em vez de mal interpretada.

Cliente → servidor:

| type | Campos | O que o servidor faz |
| --- | --- | --- |
| `select_trainer` | `trainerId` (uuid), `reqId` | Confirma que o trainer pertence à conta, registra-o como trainer ativo e responde com um `state_snapshot`. Trainer de outra conta → `command_result` com `ok: false` e o código `trainer_not_found`. |
| `command` | `command` (o comando da caçada), `reqId` | Responde com `command_result`. Os comandos da caçada ainda não são executados: a resposta é `ok: false` com o código `invalid_command`. |
| `ping` | `sentAt` (number) | Responde `pong` com o mesmo `sentAt`. |

Servidor → cliente:

| type | Campos |
| --- | --- |
| `state_snapshot` | `state` (`PlayerState`, com `rev`, `epoch` e `serverNow`) |
| `command_result` | `reqId`, `ok`, `rev`, e `code` quando o comando não funcionou |
| `pong` | `sentAt` |
| `error` | `code` (`GameErrorCode`), `message` |

O `reqId` é o que correlaciona a resposta com o pedido. O motivo da falha viaja na resposta do comando, e não em um `error`: a mensagem de erro do canal não tem `reqId`, e sem ele o cliente não saberia qual pedido falhou.

Uma mensagem que não é JSON, que não é uma das três conhecidas, ou que é de outra versão do protocolo, recebe `error` com o código `invalid_message`.

### A revisão do estado

O `PlayerState` carrega três campos que não são do jogo:

| Campo | O que é |
| --- | --- |
| `rev` | A revisão do estado, monotônica por conta, dentro de um `epoch`. |
| `epoch` | O identificador do boot do processo. Muda quando o servidor reinicia. |
| `serverNow` | O relógio do servidor no momento do snapshot. |

O `epoch` existe porque o contador de revisões vive na memória do processo: um restart o zera, e um cliente que comparasse só a revisão recusaria todo snapshot novo e ficaria congelado num estado obsoleto.

O `state_snapshot` é o que o canal empurra, e ele carrega os três. O cliente compara o par `(epoch, rev)`: `epoch` diferente é resync, `rev` maior aplica, `rev` menor ou igual é ignorado.

### O fallback

`GET /api/player/state?sinceRev=<n>` devolve o estado completo quando o estado atual é mais novo que `n`, e **204** quando o estado atual já está na revisão pedida — nesse caso, não há o que mandar.

> O cliente usa o fallback quando a revisão de um comando não chega em 2 s, e quando um salto de revisão denuncia um estado perdido no caminho.

### O que o canal ainda não faz

O canal ainda está no esqueleto do transporte. **Não existe simulação de jogo**: não há ciclo de simulação nem comandos de jogo. O que o canal já faz é abrir a sessão do trainer, entregar o retrato do estado e **empurrar o estado novo** depois de cada comando que muda o estado (veja [O push do estado](#o-push-do-estado)). O que ele faz quando o jogador entra na caçada, quando um treino termina ou quando uma criatura desmaiou ainda não está escrito.

## Contratos Compartilhados

Os tipos de input e output desta API vivem em `apps/shared/contracts/`, um pacote sem runtime que tanto o cliente quanto o servidor importam. Os **schemas** de validação (Zod) ficam em cada lado.

### O que vive no pacote compartilhado

```
apps/shared/contracts/
  auth.ts        # AuthErrorCode, AuthResult, AuthUser, AuthSession, AuthAdapter
  creature.ts    # Creature, SpeciesSummary, CreatureAbility, Potential
  game.ts        # ClientMessage, ServerMessage, GameErrorCode
  inventory.ts   # InventoryItem, ItemCategory
  player.ts      # PlayerState, TeamSlot
  rateLimit.ts   # RateLimitErrorCode
  species.ts     # Species, StarterSpecies, Ability, Element
  store.ts       # StoreItem, StoreBagItem, StoreCatalog, StoreErrorCode
  trainer.ts     # NewTrainerInput, Trainer, Gender, TrainerErrorCode
  index.ts
  package.json   # name: "@creatures/contracts"
```

Nenhum Zod, nenhuma dependência de runtime. Apenas tipos puros de TypeScript.

### O que NÃO vive no pacote compartilhado

- Schemas Zod. Cada lado escreve o seu.
- Mensagens de erro user-facing. Cliente quer português (pt-BR); servidor quer algo neutro e estável.
- Lógica de validação. Validação é por ambiente — cliente valida input de formulário, servidor valida body da API.

### Como cada lado consome os tipos

**Servidor** (`apps/server/src/validation/trainer.ts`):

```
export const newTrainerRequestSchema = z.object({
  gender: z.enum(GENDERS) satisfies z.ZodType<Gender>,
  name: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH).regex(NAME_PATTERN),
  starterSpeciesId: z.string().uuid(),
}) satisfies z.ZodType<NewTrainerInput>;
```

O `satisfies z.ZodType<NewTrainerInput>` garante que o schema satisfaz o tipo compartilhado em tempo de compilação. Se alguém mudar `NewTrainerInput` em `contracts/` sem atualizar o schema, o typecheck falha.

O schema do servidor pode divergir do cliente (validação extra, normalização diferente, mensagens distintas), mas o **tipo de entrada é o mesmo**. Quando o cliente envia um body, o servidor sabe que o shape bate com `NewTrainerInput` antes mesmo de validar.

## Testes

A suíte do servidor vive em `apps/server/src/__tests__/`.

### Testes de unidade

Não tocam o banco: o `admin` das dependências é um stub e as rotas que precisam do Postgres não são exercitadas.

- `router.spec.ts` — o error boundary responde `500` sem vazar a falha, e o contexto carrega um `requestId`.
- `routes.spec.ts` — cada rota exige token; `GET /api/health` é pública; `GET /api/player/state` sem treinador ativo responde `404`.
- `gameSocket.spec.ts` — o parser de mensagem do WebSocket lê `ping` e `select_trainer` e rejeita o resto.
- `errors.spec.ts` — a tradução do erro do Postgres para a resposta da API.
- `mappers.spec.ts` — a tradução da linha do Postgres para o tipo do contrato.
- `playerState.spec.ts` — a montagem do `PlayerState`: o time, o armazenamento, a mochila, a criatura em campo e as habilidades da espécie ativa.
- `team.spec.ts` — a validação dos comandos de time, e o corpo que o servidor aceita ou recusa.
- `huntAreas.spec.ts` — a derivação do tom, o mapeamento da área, a espécie principal, a ordenação por nível recomendado e a exigência de token nas duas rotas de área.
- `creatureAttributes.spec.ts` — a fórmula do atributo: o potencial de 50% no nível 1 devolve a base, o de 0% devolve 0,7×, o de 100% devolve 1,3×, o nível 2 multiplica por 1,05, e o resultado é sempre inteiro.
- `skillLoadout.spec.ts` — o mapeamento da carga equipada (habilidades, consumíveis e dispositivo) e a leitura da vida, com `current_hp` nulo valendo a vida máxima.
- `swapCooldown.spec.ts` — a espera de 5 segundos entre duas trocas manuais.
- `loadoutValidation.spec.ts` — a validação da carga: a lista dos quatro slots com a string vazia no slot vazio, a habilidade repetida, a entrada que não é um uuid e o slot do equipamento.
- `store.spec.ts` — a validação do comando da loja: a quantidade zero, a fracionária e acima do limite, o item malformado, e a tradução da recusa do Postgres para a resposta da API.
- `rateLimit.spec.ts` — o limite de tentativas: cinco falhas bloqueiam a tentativa seguinte com `429`, as falhas de uma conta não bloqueiam outra conta, a leitura do estado do jogador nunca é bloqueada, e a contagem esquece depois de quinze minutos.
- `logging.spec.ts` — o log: a senha do corpo da requisição não aparece no log, os campos da rota são saneados, e o logger apaga os campos sensíveis.
- `googleMerge.spec.ts` — o merge: um e-mail divergente no corpo é recusado com `400 invalid_email` sem tocar em conta nenhuma, e a busca usa o e-mail da identidade.

### Testes de integração

`apps/server/src/__tests__/integration/` roda contra o Postgres real, com usuários de teste criados e removidos no Supabase Auth. A suíte só roda com `CREATURES_TEST_DB=1`:

```
CREATURES_TEST_DB=1 bun run test:integration
```

- `trainers.integration.spec.ts` — a conta começa sem trainers; o `POST` cria o trainer e a criatura inicial; nome duplicado responde `409 name_taken`; o `PATCH` renomeia; o `DELETE` remove o trainer e as criaturas; outra conta não alcança o trainer; o banco fica limpo no fim.
- `session.integration.spec.ts` — as espécies iniciais vêm do banco; a sessão seleciona o trainer e o estado é lido a partir dele; sem treinador ativo o estado responde `404 trainer_not_found`.
- `team.integration.spec.ts` — o treinador começa com a criatura inicial no time; a criatura capturada entra no primeiro slot livre; o time fecha em 5 criaturas; a ordem é reescrita; a criatura removida volta para o armazenamento; o estado do jogador segue o time; o banco fica limpo no fim.
- `inventory.integration.spec.ts` — a mochila mostra o item que o treinador tem e esconde o que ficou sem quantidade; o banco fica limpo no fim.
- `huntAreas.integration.spec.ts` — as áreas vêm do banco e na ordem esperada; o detalhe traz a união dos itens das espécies da área; uma área inexistente responde `404`; o catálogo do seed continua no banco no fim.
- `skillBar.integration.spec.ts` — a criatura inicial nasce com a carga da espécie; o estado traz a vida da criatura em campo; as habilidades são equipadas nos slots; uma habilidade de outra espécie é recusada; o consumível entra com o gatilho e a quantidade da mochila; o dispositivo entra no slot 6; o slot é esvaziado; o banco fica limpo no fim.
- `swap.integration.spec.ts` — a troca manual põe a criatura escolhida em campo; a segunda troca do mesmo momento responde `429 swap_cooldown`; uma criatura que não está no time responde `404 creature_not_found`; o banco fica limpo no fim.
- `starterBackpack.integration.spec.ts` — o treinador novo nasce com consumíveis e dispositivos na mochila; a mesma semente dá a mesma mochila; outra semente dá outra mochila; o banco fica limpo no fim.
- `statePush.integration.spec.ts` — o comando que muda o estado empurra o retrato novo pelo canal, sem o cliente pedir; o comando responde `204`; o banco fica limpo no fim.
- `store.integration.spec.ts` — o catálogo vem do banco com o preço de compra; a compra debita o gold e enche a mochila; a compra sem gold é recusada com `409`; a venda credita 90% do preço e esvazia a mochila; a venda de um item que o treinador não tem é recusada; o banco fica limpo no fim.
- `rateLimit.integration.spec.ts` — as tentativas falhas do banco de verdade bloqueiam a conta com `429 rate_limited`; as falhas de uma conta não bloqueiam outra conta; o banco fica limpo no fim.

A suíte toda, unidade e integração, roda com `bun test` na raiz.

## Pendências

- **O rate limit é por processo** — o contador das tentativas mora na memória do processo, como a sessão do treinador. Com mais de uma instância, cada uma conta só as tentativas que ela viu, e o limite enfraquece na proporção do número de instâncias. A correção é um contador compartilhado, e liga com a decisão de instância única, ainda em aberto no [Stack](STACK.md#pendências).
- **O endereço do cliente depende do proxy** — sem `TRUST_PROXY=1`, o servidor usa o endereço do socket, e um servidor atrás de um proxy passa a ver todos os clientes com o mesmo endereço. A variável precisa ser ligada em produção; o [rate limit](#rate-limit) explica o porquê.
- **Sessão do treinador por processo** — o mapa `userId → trainerId` vive na memória do processo. Ele não sobrevive a um reinício e não é compartilhado entre instâncias. Isso liga com a decisão de instância única, ainda em aberto no [Stack](STACK.md#pendências), e é o que impede o servidor de subir com mais de uma instância, conforme o [runbook](../DEPLOY.md#o-que-ainda-não-está-pronto-para-o-público).
- **O time pode ser remanejado durante a caçada** — as rotas de time não recusam nada além do que a regra do [time](../../game/TRAINER.md#time) já proíbe hoje. Quando a caçada existir, o servidor precisa saber que ela está em andamento para fechar o time, como está escrito em [Durante a Caçada](../../game/TRAINER.md#durante-a-caçada).
- **A mochila é só de leitura** — o servidor entrega os itens que o treinador tem, mas nada os dá ou os gasta. Quem escreve a quantidade é o gameplay, que ainda não existe. A única escrita automática é o sorteio da mochila do treinador novo, na criação.
- **A caçada não existe** — as rotas de área entregam o catálogo e o detalhe do local. Quem entra na caçada, quem encontra a criatura selvagem, quem resolve a captura e quem entrega o drop é o marco seguinte, e ainda não foi escrito.
- **O catálogo de áreas é pequeno e fixo** — o seed traz quatro áreas com as cinco espécies existentes. Crescer o catálogo é mexer no `seed.sql`, sem migration.
- **A área não sabe nada do treinador** — as rotas de área não olham o nível nem o time do treinador: o nível recomendado é um conselho, e nenhuma área é bloqueada por nível.
- **A fórmula dos atributos ainda não está na documentação de produto** — o servidor implementa `d = 0.3` e `k = 0.05`, e a decisão precisa ser escrita em [Criaturas](../../game/CREATURES.md#atributos-atuais), que ainda marca a fórmula como pendente.
- **A carga da barra é a lista dos slots** — o `PUT /api/creatures/:id/ability-slots` recebe a carga como a lista dos quatro slots, com a string vazia no slot vazio. A lista pode ser mais curta, e aí os slots do fim ficam vazios.
- **A vida da criatura não tem dono ainda** — `creatures.current_hp` existe e é lida, mas nada escreve nela: quem fere a criatura é o gameplay, que ainda não existe.
- **A espera da troca é por processo** — o instante da última troca vive na memória do processo, como o resto da sessão do treinador, e se perde no reinício. A troca automática, que acontece quando a criatura em campo desmaia, não tem espera: o gameplay é quem a resolve, e ele ainda não existe.
