# A Caçada

Este documento descreve a fundação determinística da caçada que existe no servidor hoje: a tabela da sessão, o cursor da simulação e a função de avanço.

> A caçada **não é jogável**. Este documento descreve a **fundação**, e não as regras da caçada: as regras de combate, de drop e de spawn **não existem em documento nenhum**, e o que ainda está em aberto do produto continua em [Caçada](../../game/HUNT.md#pendências) e no [escopo das fases alfa e beta](../../game/HUNT.md#escopo-das-fases-alfa-e-beta). A fundação não inventa regra de jogo: ela dá o lugar onde a regra vai entrar.

## Índice

| Tópico | Descrição |
| --- | --- |
| [O que existe e o que não existe](#o-que-existe-e-o-que-não-existe) | A fronteira entre a fundação e a caçada jogável. |
| [A tabela da sessão](#a-tabela-da-sessão) | A tabela `hunt_sessions`, o soft-close, os índices e o RLS. |
| [O cursor da simulação](#o-cursor-da-simulação) | O que a sessão guarda para que a simulação possa continuar de onde parou. |
| [O determinismo](#o-determinismo) | Por que o estado aleatório mora dentro do estado da caçada. |
| [As regras implementadas](#as-regras-implementadas) | O consumo de stamina, os motivos de fim e o replay das ações. |
| [As costuras](#as-costuras) | Os pontos onde a regra de jogo que ainda não existe vai entrar. |
| [As lacunas de schema](#as-lacunas-de-schema) | As duas regras sem casa no banco que a caçada jogável exige. |
| [Testes](#testes) | O que está garantido pela suíte. |

## O que existe e o que não existe

**O que foi construído.**

| Peça | Onde |
| --- | --- |
| A tabela da sessão e os índices | `supabase/migrations/20261021130000_hunt_sessions.sql` |
| O repositório da sessão | `apps/server/src/hunt/session.ts` |
| O gerador determinístico | `apps/server/src/hunt/rng.ts` |
| A função de avanço | `apps/server/src/hunt/clock.ts` |
| As regras que fecham a caçada | `apps/server/src/hunt/rules.ts` e `apps/server/src/hunt/closings.ts` |
| Os fatos de uma janela | `apps/server/src/hunt/events.ts` |
| Os tipos e as fórmulas puras | `apps/shared/contracts/huntSession.ts` |

**O que não foi construído.**

- **Não há rota HTTP que inicie, termine ou consulte uma caçada.** O módulo `apps/server/src/hunt/` não é importado por nenhuma rota: ele é a fundação, e ainda não tem chamador no servidor.
- **Não há publicação no WebSocket.** Os eventos que a simulação produz (`HuntEvent`) não são publicados: o canal do jogo continua empurrando o retrato do estado, como está em [API de Treinadores](TRAINERS.md#o-push-do-estado).
- **Não há regra de combate, de captura, de drop nem de spawn.** Nada resolve um encontro, e nada sorteia loot.
- **Os contadores de encontros e abates ficam em zero.** As colunas `encounters` e `kills` existem na tabela e são gravadas no checkpoint, mas nada as incrementa.
- **Não há regra de conteúdo das áreas.** A lista de criaturas e itens de cada área continua em aberto no produto.

> O que a fundação decide é **onde** a regra vai entrar, e não **o que** a regra é. Cada costura documentada em [As costuras](#as-costuras) é um ponto de entrada esperando a regra de combate, de drop e de spawn.

## A tabela da sessão

A sessão é o registro durável da caçada. Ela é criada quando o jogador entra em uma área e fechada quando uma regra manda fechar. A migration é a `20261021130000_hunt_sessions.sql`.

### As colunas

| Coluna | Tipo | O que é |
| --- | --- | --- |
| `id` | `uuid` | A identidade da sessão. |
| `account_id` | `uuid` → `auth.users(id)`, `on delete cascade` | A conta que é dona da caçada. |
| `trainer_id` | `uuid` → `public.trainers(id)`, `on delete cascade` | O treinador que está caçando. |
| `hunt_area_id` | `uuid` → `public.hunt_areas(id)`, `on delete restrict` | A área que está sendo caçada. |
| `status` | `text` | `active` ou `finished`. |
| `started_at` | `timestamptz` | O instante em que a caçada começou. |
| `last_simulated_at` | `timestamptz` | O instante até onde a caçada foi simulada. É o cursor. |
| `ended_at` | `timestamptz` | O instante em que a caçada acabou, ou `null` enquanto ela corre. |
| `end_reason` | `text` | Por que a caçada acabou, ou `null` enquanto ela corre. |
| `rng_seed` | `bigint` | A semente do estado aleatório. |
| `rng_draws` | `bigint` | Quantos números já foram tirados da semente. |
| `encounters` | `bigint` | Quantos encontros a simulação resolveu. |
| `kills` | `bigint` | Quantas criaturas foram derrotadas. |
| `stamina_spent_minutes` | `int` | Quantos minutos de stamina a caçada consumiu. |
| `stamina_at_start` | `int` | A stamina do treinador quando a caçada começou. |
| `actions` | `jsonb` | A timeline das ações do jogador, com o instante de cada uma. |

A restrição `hunt_sessions_consistency_check` amarra `status`, `ended_at` e `end_reason`: uma caçada `active` não tem `ended_at` nem `end_reason`, e uma `finished` tem os dois. A `hunt_sessions_ended_at_check` impede que a caçada termine antes de começar, e a `hunt_sessions_counters_check` impede contadores negativos e uma `stamina_at_start` acima do teto de 720 minutos.

### O soft-close

A linha da sessão **nunca é apagada**. O fim da caçada é um *soft-close*: a linha passa a `finished`, com `ended_at` e `end_reason`, e continua no banco.

> Apagar a linha jogaria fora exatamente o que o jogo ainda precisa: o `end_reason` diz por que a caçada acabou, o loot obtido nela fica com a sessão, e a contabilidade da sessão offline — que é de caçadas **consecutivas** — precisa saber quando a caçada começou e quando terminou.

O repositório implementa isso em `apps/server/src/hunt/session.ts`: `finishHuntSession` escreve `status`, `end_reason` e `ended_at`, e não existe nenhuma chamada de `delete` na tabela.

### Os índices

| Índice | Tipo | Por que existe |
| --- | --- | --- |
| `hunt_sessions_active_last_simulated_at_idx` | parcial, sobre `last_simulated_at`, onde `status = 'active'` | É o índice da varredura do boot, que retoma por catch-up as caçadas abertas cujo cursor ficou para trás. É **parcial** porque as caçadas fechadas são a maioria da tabela e nunca participam da varredura. |
| `hunt_sessions_active_trainer_id_idx` | **único** e parcial, sobre `trainer_id`, onde `status = 'active'` | Um treinador caça uma área por vez. O índice impede que existam duas caçadas abertas do mesmo treinador, o que tornaria a sessão do treinador ambígua. |
| `hunt_sessions_account_id_idx` | comum, sobre `account_id` | As caçadas de uma conta são lidas quando a conta volta e a caçada do treinador é procurada. |

### O acesso

O acesso é **deny-by-default**, como em todas as outras tabelas: RLS ligado, `anon` e `authenticated` sem grant e sem policy, e só o `service_role` — que ignora RLS — enxerga as linhas. A migration cria a policy explícita `hunt_sessions_service_role_all`, `for all to service_role`, e o `grant` vai para `service_role` e `postgres`. O servidor é o único caminho de escrita.

## O cursor da simulação

O cursor é o estado de onde a simulação pode continuar. Uma caçada que foi simulada até o minuto 40 e parada no banco precisa voltar exatamente do minuto 40.

| Parte do cursor | O que é | Por que é cursor |
| --- | --- | --- |
| `startedAt` | O instante em que a caçada começou. | Os dois limites que fecham a caçada contam a partir dele. Não é derivável de nada: é a definição da caçada. |
| `lastSimulatedAt` | O instante até onde a caçada foi simulada. | É de onde o próximo `advance` parte. Uma janela sem tempo não move a sessão. |
| `rngSeed` e `rngDraws` | O estado aleatório da caçada. | O catch-up precisa tirar os números do mesmo lugar onde a simulação parou. |
| `staminaAtStart` | A stamina do treinador quando a caçada nasceu. | O instante em que a caçada acaba por stamina depende desse valor. |
| `actions` | A timeline das ações do jogador. | O catch-up reproduz as ações na ordem em que elas aconteceram. |

### A stamina no início

A `stamina_at_start` é capturada **uma vez**, quando a caçada nasce, e viaja com a sessão.

> Derivá-la do treinador amarraria o instante do fim de **toda** caçada a uma regra de persistência da stamina que não está garantida em lugar nenhum. A derivação sugerida era `trainers.stamina_minutes + session.staminaSpentMinutes`, e ela **presume** que o banco guarda a stamina *restante* — o que hoje não é verdade. Uma mudança nessa regra de persistência moveria, silenciosamente, o fim de toda caçada já registrada.

A stamina não recupera durante a caçada. O que sobra é o que o treinador tinha quando a caçada começou, menos o que a caçada consumiu: `computeRemainingStamina` faz essa conta.

## O determinismo

### O estado aleatório mora dentro do estado

O estado aleatório da caçada é um par — a semente e o número de sorteios — e ele mora **dentro do estado da caçada**, e não em um singleton do módulo.

> O catch-up de uma caçada offline roda depois, em outro processo, e tem que produzir exatamente o mesmo sorteio. Se o gerador vivesse na memória do módulo, ele sortearia de novo, e o jogador receberia loot diferente do que ganhou antes de fechar a aba.

O gerador é **counter-based**: o valor de um sorteio é função da semente e do número do sorteio, e nunca do sorteio anterior. É isso que permite que o estado aleatório caiba em dois números e que o cursor do gerador seja o próprio contador.

| Função | O que devolve |
| --- | --- |
| `createHuntSeed` | A semente de uma caçada nova. É o **único** sorteio não reproduzível, e acontece uma vez, quando a caçada começa. |
| `drawUnit` | Um número entre zero e um. |
| `drawInt` | Um inteiro entre zero e o limite dado. |
| `drawWeighted` | Um elemento de uma lista ponderada, ou `null` quando a lista está vazia ou quando todo peso é zero. |

### O avanço é uma função pura

`advance(session, untilTs, rules)` é uma **função pura**: o mesmo estado, o mesmo instante e as mesmas regras dão sempre o mesmo resultado. Não há relógio dentro do módulo e não há `Math.random`: o tempo vem do argumento e a aleatoriedade vem do estado da sessão.

> Uma função que lesse o relógio da parede faria o catch-up de uma caçada offline depender do dia em que ela foi reproduzida.

A mesma função é usada nos três momentos que precisam dela:

| Momento | O que é |
| --- | --- |
| **Online** | O avanço da caçada enquanto o jogador está com o jogo aberto. |
| **Catch-up** | A retomada da caçada que ficou aberta — no reconnect do cliente ou no boot do servidor. |
| **Checkpoint** | O batch de persistência, quando a linha da sessão é gravada. |

## As regras implementadas

### O consumo de stamina

Cada minuto de caçada consome 1 minuto de stamina, com o jogo aberto ou não. A stamina **não** recupera durante a caçada: o consumo é o tempo que a caçada durou, em minutos inteiros, e o valor nunca diminui — uma sessão que já foi avançada mantém o que tinha.

O teto do treinador é 720 minutos, e uma caçada **começa** com pelo menos 30 minutos de stamina (`HUNT_MINIMUM_STAMINA_MINUTES`, em `canStartHunt`). O mínimo vale para o começo da caçada, e não para a continuidade dela.

### Os motivos de fim

Uma caçada fecha por cinco motivos. Dois fecham em fórmula, dois dependem de um instante que vem de fora da simulação, e um não é um instante.

| Motivo | Quando | O instante do fim |
| --- | --- | --- |
| `stamina_depleted` | A stamina do treinador zera. | `startedAt` + a stamina do início da caçada. |
| `offline_session_expired` | A sessão offline da conta se esgota. | `startedAt` + a duração da sessão offline da conta. |
| `player_finalized` | O jogador finalizou a caçada. | O instante da ação. |
| `trainer_switched` | O jogador trocou de treinador. | O instante da troca, que vem do contexto do avanço. |
| `no_viable_creature` | O time não tem nenhuma criatura apta a batalhar. | **Não é um instante**: é uma condição conferida dentro do avanço. |

A duração da sessão offline e a velocidade da recuperação vêm do tipo da conta, lidas pelo contrato em `readHuntAccountRules`: 4 horas e 1 minuto de stamina a cada 2 na conta gratuita, 8 horas e 1 a cada 1 na conta paga.

### O empate vai para a stamina

Os dois limites começam no mesmo instante — o começo da caçada —, e o que fecha a caçada é o mais curto dos dois. No empate, a stamina vence.

> O empate vai para a stamina porque ela é o limite do treinador, e a regra do jogo lista o fim da stamina antes do fim da sessão offline.

O mesmo vale dentro da janela: quando uma regra e uma ação do jogador caem no mesmo instante, a regra vence. **O fim da caçada não é escolha do jogador.**

### O replay das ações

As ações do jogador quebram o avanço por tempo puro, e por isso a caçada guarda uma **timeline** delas, com o instante de cada uma.

O avanço de uma janela é: o relógio corre até o instante da próxima ação, a ação é aplicada, o relógio corre de novo. As ações da janela são as que estão entre `lastSimulatedAt` e o fim da janela, ordenadas pelo instante (`readPendingActions`). As anteriores já estão no estado persistido, e as seguintes são da próxima janela.

A ação `finalize_hunt` é a única que fecha a caçada por ação do jogador. As outras — `swap_creature`, `use_ability` e `use_consumable` — são reportadas como evento e a caçada continua.

### O atraso do fechamento

Uma sessão que ficou aberta além do momento em que devia ter fechado é fechada quando ela é retomada: o fim vai para o cursor — o último instante simulado —, com o motivo da regra que passou (`readOverdueClosing`). A caçada não fica aberta para sempre, e o fim não é empurrado para o instante da retomada.

### Os eventos

Uma janela devolve fatos, e não um retrato. O cliente os aplica na ordem em que chegam.

| Evento | O que é |
| --- | --- |
| `stamina_spent` | Os minutos de stamina que a janela consumiu. |
| `action_applied` | Uma ação do jogador, aplicada. |
| `hunt_ended` | O fim da caçada, com o motivo. |

## As costuras

A fundação foi desenhada com três costuras: pontos onde a regra de jogo entra, e que hoje não têm regra.

### A criatura apta a batalhar

O callback `canKeepFighting(at)` é o ponto onde a regra de "o time ainda tem criatura apta a batalhar" entra. Ele vem no contexto do avanço (`HuntAdvanceRules`) e é conferido no começo da janela e no instante de cada ação do jogador.

> O callback é injetado porque essa regra não é um momento: o time pode ficar sem criatura apta no meio da caçada, e não há timestamp para isso. E o que faz uma criatura apta a batalhar é decidido pela luta, e não pelo relógio — e a luta não existe.

### A resolução dos encontros e o sorteio do loot

Os encontros e o loot entram na **mesma janela** do avanço, e consomem os sorteios do estado aleatório da caçada. É o que garante que o loot do catch-up seja o loot que o jogador ganhou.

Hoje essa costura está vazia: nada resolve um encontro, nada sorteia loot, e os contadores de encontros e abates ficam em zero. As funções de sorteio (`drawUnit`, `drawInt`, `drawWeighted`) já existem e são reprodutíveis.

### O tipo da conta

O `accountType` chega pelo contexto do avanço, e não pela sessão. Ele decide a duração da sessão offline e a velocidade da recuperação, e é o que separa `stamina_depleted` de `offline_session_expired`.

A troca de treinador (`trainerSwitchedAt`) chega pelo mesmo contexto: ela vem da sessão da conta, e não da caçada, e por isso não é uma ação da timeline.

## As lacunas de schema

A fundação foi construída sobre duas regras que **não têm implementação nem casa no banco**. Nenhuma das duas é bloqueante para a fundação, e nenhuma pode ser inventada sem decisão de produto. As duas são pré-requisitos da caçada jogável.

### A recuperação de stamina não é calculada no servidor

O `PlayerState.staminaMinutes` vem de `trainers.stamina_minutes`, um valor **estático** na tabela do treinador (`apps/server/src/state/playerState.ts`). A regra de [Recuperação](../../game/TRAINER.md#recuperação) — 1 minuto de stamina a cada 2 minutos na conta gratuita, 1 a cada 1 na paga, sempre que o treinador não está caçando — **não está implementada em lugar nenhum**: a função `computeRecoveredStamina` do contrato não tem chamador.

Consequência: a barra de stamina do cliente mostra um número que não muda, e a regra que decide quanto tempo de caça ainda resta é ficção.

**Precisa de:** o estado da stamina virar um par `staminaMinutes` + `staminaEarnedAt`, com o valor derivado por `computeRecoveredStamina`. É a mesma mudança de forma que o cooldown tem: timestamp no servidor, contagem no cliente.

### O tipo da conta não tem casa no schema

`HuntAccountType` (`free` ou `paid`) decide a **duração da sessão offline** (4 h ou 8 h) e a **velocidade da recuperação**. Ele chega hoje pelo contexto do avanço, mas não existe em nenhuma tabela.

> O tipo da conta é da conta, e não do treinador — está escrito em [Por Treinador](../../game/TRAINER.md#por-treinador). A conta gratuita é comprada com diamantes por um prazo, e o dado tem dono natural: a conta.

**Precisa de:** uma decisão de schema sobre onde o tipo da conta vive — uma coluna na conta, um registro de assinatura, ou derivar de um saldo — antes da caçada ser jogável.

## Testes

A suíte da caçada vive em `apps/server/src/__tests__/hunt/`.

| Arquivo | O que está garantido |
| --- | --- |
| `rng.spec.ts` | A mesma semente dá a mesma sequência; o contador avança e retoma de onde parou; os sorteios ficam dentro do intervalo; a escolha ponderada é reprodutível e favorece o peso maior; a semente nova é um inteiro seguro. |
| `clock.spec.ts` | O mesmo insumo dá a mesma saída; a janela consome a stamina e a reporta; a caçada acaba por stamina, por sessão offline e por troca de treinador; a conta paga caça por mais tempo; o jogador finaliza; o time sem criatura apta acaba a caçada; as ações são reproduzidas na ordem; a caçada acabada não é avançada de novo; a janela sem tempo não move a sessão. |
| `session.spec.ts` | A sessão é criada com a stamina do início; a caçada ativa do treinador é lida; as sessões atrás do cursor são listadas; o cursor é gravado; a ação entra na timeline; o fim é um soft-close; a sessão nunca é apagada. |

A suíte toda roda com `bun test` na raiz, como as demais.
