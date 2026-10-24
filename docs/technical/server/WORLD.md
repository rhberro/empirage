# Mundo (servidor)

Este documento cobre o domínio de mundo no servidor: o mapa commitado que servidor e cliente compartilham, o pathfinding, o registro em memória dos atores, a régua que aplica o `move`, o canal leve que anuncia o movimento e a costura com o WebSocket. O comportamento do ponto de vista do jogador está em [Mundo](../../game/WORLD.md); o lado do cliente, em [Mundo (cliente)](../client/WORLD.md).

> O domínio de mundo do servidor é o da **cidade**. A caçada tem mapas próprios em `apps/shared/contracts/hunts/` e a simulação fica em `apps/server/src/hunt/sim/`, que reaproveita o pathfinding e as durações de passo deste domínio, mas não usa o registro, o broadcaster nem a persistência de posição da cidade. A posição de cada treinador na cidade é persistida em banco por write-behind; o estado vivo da caminhada vive na memória do processo.

## Módulos

| Módulo | Papel |
| --- | --- |
| `apps/shared/contracts/world.ts` | Tipos de direção, tile, segmento e ator; ids e metadados dos tiles; `tileAt`, `isSolidTile` e `isWalkableTile`. |
| `apps/shared/contracts/city.ts` | Carrega o `city.json` commitado e entrega `CITY_MAP`; confere a quantidade de tiles na carga. |
| `apps/shared/contracts/city.json` | O mapa: 96x64 sqm, spawn em (48,31), uma linha de tiles por linha do mapa. |
| `apps/server/scripts/genCityMap.ts` | Gerador do mapa commitado; valida que o spawn é andável. |
| `apps/server/src/world/map.ts` | Re-exporta `CITY_MAP` do pacote de contratos, para o servidor importar pelo próprio domínio. |
| `apps/shared/contracts/path.ts` | Busca ponderada (Dijkstra 1/3) nas oito direções, com heap determinístico, canto fechado, alvo sólido e fallback BFS acima de 512 passos. O cliente usa a mesma busca para predizer o primeiro passo. |
| `apps/shared/contracts/priorityQueue.ts` | Heap mínimo com desempate por ordem de inserção, o que torna a busca determinística. |
| `apps/server/src/world/path.ts` | Re-exporta a busca compartilhada para o domínio do servidor. |
| `apps/server/src/world/priorityQueue.ts` | Re-exporta o heap compartilhado. |
| `apps/server/src/world/registry.ts` | Estado em memória por processo: posição, direção, perfil, segmentos e revisões por observador; confirma passos pelo relógio. |
| `apps/server/src/world/moveCache.ts` | Cache de 30 s do resultado de um `reqId`, para um retry não replanejar o caminho. |
| `apps/server/src/world/ruler.ts` | Aplica o `move`: valida, planeja (preservando o passo em curso), carimba os tempos absolutos e responde. |
| `apps/server/src/world/broadcaster.ts` | Canal leve do mundo: `world_state`, `actor_update`, `actor_leave` e o agendamento do próximo passo. |
| `apps/server/src/world/channel.ts` | Costura entre o WebSocket e o mundo: entrada (lê a posição durável), saída (completa o passo e faz flush) e `move`. |
| `apps/server/src/world/positionWriter.ts` | Write-behind da posição: coleta os passos confirmados e grava o último da janela (~1 s) em uma única UPSERT. |
| `apps/server/src/db/positionRepository.ts` | Leitura e escrita (UPSERT) da posição durável em `trainer_positions`. |
| `supabase/migrations/20261023120000_trainer_positions.sql` | Tabela `trainer_positions`: um sqm + facing por treinador, RLS negada por padrão. |
| `apps/server/src/world/command.ts` | Leitura do alvo do `move`: objeto com `x` e `y` inteiros. |
| `apps/server/src/world/index.ts` | API pública do domínio de mundo. |
| `apps/server/src/ws/gameSocket.ts` | Aceita o `move` no `readCommand`, cria o canal de mundo e liga a entrada do ator ao `select_trainer`. |

## Mapa

O mapa é um arquivo commitado, `apps/shared/contracts/city.json`, e é a única fonte de verdade da grade. O servidor o importa para julgar colisão e caminho; o cliente importa os mesmos bytes para desenhar. Ele não viaja pelo socket.

- **Formato:** `width`, `height`, `spawn` e `tiles` em ordem de linha; o carregador achata as linhas uma única vez e confere `width * height`.
- **Tamanho atual:** 96x64 sqm, com spawn no centro, em (48,31).
- **Fora do mapa:** `tileAt` devolve `TREE` para qualquer coordenada fora dos limites. O muro de árvores ao redor é o que permite ao pathfinding consultar qualquer vizinho sem uma checagem de limites própria.
- **Sólidos:** água, cerca, muro, árvore e poço. Grama, caminho, flores, grama alta e porta são andáveis.
- **Validação do spawn:** o gerador do mapa recusa um spawn que não seja andável; o carregador valida a contagem de tiles.

> O mapa é gerado e commitado em vez de sorteado em runtime. Servidor e cliente nunca podem discordar sobre onde há uma parede, porque não existem duas cópias do mapa.

## A Caçada

A caçada não usa o `CITY_MAP`: cada área tem um mapa commitado próprio, carregado por `huntMapBySlug` a partir de `apps/shared/contracts/hunts/<slug>.json`. O mapa define o `spawn`, o `loop` da criatura ativa, os tiles e os pontos de spawn das selvagens.

O motor da caçada reaproveita `findPath` de `apps/server/src/world/path.ts` para perseguição e retorno ao loop, usando o mapa da área como grid. O passo continua ortogonal de 300 ms e diagonal de 424 ms, e as regras de colisão são as mesmas do terreno.

O que a caçada **não** usa é o resto do domínio de mundo: não há registro de atores, broadcaster, revisão de mundo nem persistência de posição. A posição da criatura ativa, das selvagens e do treinador vive no `simulation_state` da sessão, e o movimento chega ao cliente pelos eventos e atores do `hunt_delta`.

## Registro

`registry.ts` guarda o estado do mundo em memória, por processo. Cada conta presente tem um registro com posição confirmada, direção, nome, gênero, um indicador de presença e a fila de segmentos da caminhada.

| Operação | Comportamento |
| --- | --- |
| `join(userId, profile, at)` | Entra o ator na posição durável do perfil (`start`), olhando para o facing salvo. Se não há posição salva, cria o ator no spawn, olhando para baixo. Se o ator já existe, atualiza o perfil, marca presença e **descarta o caminho**: uma conexão nova não retoma a caminhada de uma conexão que já morreu. |
| `leave(userId, at)` | Confirma os passos que o relógio já encerrou, marca o ator como ausente e descarta o caminho. |
| `advance(userId, at)` | Confirma todos os segmentos cujo `endsAt` já passou e devolve o ator com o segmento em curso, se houver. |
| `completeStep(userId, at)` | Completa o passo em curso: o ator pousa no `to` do segmento, vira na direção dele e a caminhada é limpa. É o que a desconexão usa para não deixar o treinador no meio de um passo. |
| `actor` / `actors` | Devolvem o ator (ou todos os presentes, com exceção de um observador) já avançados pelo relógio. |
| `setPath(userId, path, at)` | Substitui a caminhada inteira e atualiza a direção para a do primeiro passo. Um caminho vazio apenas para a caminhada; a direção permanece. |
| `nextWorldRev(observerId)` | Incrementa e devolve a revisão **daquele observador**. Cada conexão tem o próprio contador monotônico. |
| `cacheMove` / `readCachedMove` | Guardam e leem o resultado de um `reqId` por 30 s, com a chave composta por conta e requisição. |

**Não existe tick do mundo.** O registro avança quando é lido: o relógio é a fonte, e um ator que ninguém observou enquanto andava está no sqm certo na próxima leitura. O único timer do domínio é o do broadcaster, para avisar o próximo segmento.

A cada passo que o relógio confirma, o registro emite uma confirmação (`onStepConfirmed`) com o sqm, o facing e o treinador. É essa confirmação que alimenta o write-behind de posição; o registro em si não conhece o banco.

## Pathfinding

`findPath(map, from, to)` faz uma busca ponderada (Dijkstra) nas oito direções, com um heap mínimo. O custo não é uniforme: um passo ortogonal custa 1 e um diagonal custa 3 (`ORTHOGONAL_STEP_COST` / `DIAGONAL_STEP_COST`). Dois passos ortogonais custam 2, então continuam mais baratos do que cortar a esquina na diagonal: o caminho segue as linhas retas primeiro e só usa a diagonal quando ela realmente encurta o percurso.

O heap desempata empates de custo pela ordem de inserção, que segue a ordem fixa dos vizinhos. Por isso a busca é **determinística**: o mesmo clique sempre produz a mesma caminhada.

As regras:

- **Canto fechado:** uma diagonal é recusada quando os dois vizinhos ortogonais que ela atravessa são sólidos. O treinador não corta o canto de uma parede.
- **Alvo livre:** o caminho termina no próprio alvo.
- **Alvo sólido:** o alvo é trocado por todos os vizinhos andáveis ao redor. A busca termina no que for alcançado primeiro; quando há caminho até um deles, um clique em uma árvore leva o treinador para o lado dela.
- **Alvo cercado:** se nenhum vizinho do alvo sólido for andável, ou se nenhum for alcançável, o resultado é `tile_blocked`.
- **Fora do mapa:** `invalid_target`.
- **Origem não andável:** `invalid_target`.
- **Caminho muito longo:** `MAX_PATH_STEPS` é 512. O limite é da resposta, não da busca: se o caminho ponderado mais barato passar de 512 passos, o servidor tenta uma **busca em largura de passos mínimos** (custo uniforme, que usa mais diagonais para caber no limite); só se nem essa caber é que o resultado é `invalid_target`, para a resposta não inundar o canal.
- **Mesmo tile:** caminho vazio, que o chamador interpreta como parar.

O caminho é reconstruído de trás para frente pelos pais da busca e devolvido na ordem em que é percorrido.

> A ordem dos vizinhos na busca é o desempate: cima, cima-direita, direita, baixo-direita, baixo, baixo-esquerda, esquerda, cima-esquerda. Um caminho mais barato vence; entre caminhos de mesmo custo, a ordem dos vizinhos (refletida na ordem de inserção no heap) decide.

## Régua

`ruler.ts` é o único lugar em que um `move` muda o registro. A sequência de `move(userId, reqId, target)`:

1. Lê o relógio e procura o `reqId` no cache. Se ele já foi respondido, devolve o mesmo caminho e os mesmos tempos; só a revisão do observador é nova.
2. Avança o ator pelo relógio. Se ele não está presente, responde `invalid_command`.
3. **Sem passo em curso:** se o alvo é o tile confirmado, limpa a caminhada e responde `ok` com caminho vazio — é a forma de parar. Senão, calcula o caminho a partir do tile confirmado e devolve o código da falha quando não há caminho.
4. **Com passo em curso:** o passo atual **não é cancelado**. O caminho é recalculado a partir do `to` do segmento em curso — o tile em que o treinador está entrando — e o segmento atual é mantido no início da resposta. Se não há caminho a partir dali, o treinador termina só o passo que já começou e para.
5. Carimba os segmentos novos com tempos absolutos: o primeiro passo novo começa em `at` quando não havia passo em curso, ou no `endsAt` do segmento preservado quando havia — e cada seguinte começa quando o anterior termina.
6. Substitui a caminhada no registro e atualiza a direção.
7. Guarda o resultado no cache de 30 s e responde com a próxima revisão do observador.

As durações:

| Passo | Duração |
| --- | --- |
| Ortogonal | 300 ms |
| Diagonal | 424 ms |

A diagonal é mais longa porque cobre mais distância na tela. Como os tempos são absolutos, o cliente não precisa receber a duração: ele recebe `startsAt` e `endsAt` e deriva a posição do próprio relógio corrigido.

> Um `move` recebido no meio de uma caminhada não reinicia do tile anterior: o treinador **termina o passo em curso** e o novo caminho nasce do tile em que ele está entrando. Andar é uma decisão, não uma fila — mas o clique de novo nunca corta a animação que já estava na tela. A resposta (`move_result.path`) começa pelo segmento em curso, para o cliente nunca ver aquele passo sumir entre dois cliques.

A resposta é uma única `move_result`, com `reqId`, `ok`, `code?`, `path`, `v` e `worldRev`. O ator que pediu o movimento não espera broadcast: a resposta é a prova de que o comando chegou.

O cliente prediz o primeiro passo com a mesma busca e o mesmo caminho, mas o `move_result` continua sendo a verdade: quando a resposta chega, o cliente mantém o passo que já estava na tela e substitui o resto. O relógio que coloca os atores em tempo é corrigido pelos pongs, que levam o `sentAt` do ping e o `serverNow` do servidor.

## Broadcaster

O `broadcaster.ts` é o canal leve do mundo, espelho do broadcaster de estado do jogador. Ele **nunca lê o banco e nunca reconstrói o snapshot do jogador**: só encaminha o que mudou no mundo.

| Operação | O que faz |
| --- | --- |
| `sendWorldState(ws, userId)` | Envia `world_state` para uma conexão: o ator da conexão, os outros atores presentes e a revisão daquele observador. |
| `broadcastActor(userId)` | Envia `actor_update` do ator para todos os outros presentes. É usado quando alguém entra na cidade. |
| `announce(userId)` | Envia o primeiro segmento para os outros e agenda o próximo. É usado depois de um `move` aceito. |
| `broadcastLeave(userId)` | Cancela o timer do ator e envia `actor_leave` para os outros presentes. |

O anúncio de uma caminhada é feito **um segmento por vez**:

1. O primeiro segmento é anunciado logo depois da resposta do `move`.
2. Um timer acorda quando aquele segmento termina e anuncia o próximo, que é o segmento em curso naquele instante.
3. O último segmento não tem próximo: o cliente já recebeu o `to` e sabe, pelo `endsAt`, quando chega. O timer simplesmente não é reagendado.

A revisão é tirada no momento do envio, para cada observador; cada conexão vê a própria sequência monotônica.

> Não há push por quadro. O cliente recebe um segmento por vez e interpola; o servidor só fala de novo quando o próximo passo começa.

## Canal e WebSocket

`channel.ts` é a costura entre a lane do WebSocket e o mundo. O handler não toca no registro diretamente.

| Operação | Comportamento |
| --- | --- |
| `enter(ws, profile)` | Só age se a conexão ainda é a atual da conta. Lê a posição durável do treinador (com fallback para o spawn) e coloca o ator no mundo naquele sqm, envia o `world_state` para ele e anuncia o `actor_update` aos outros. |
| `move(ws, reqId, target)` | Aplica a régua, envia o `move_result` para a conexão que pediu e, se o movimento foi aceito, anuncia o ator aos outros. |
| `close(ws)` | Se a conexão foi substituída por outra da mesma conta, fecha a antiga sem tirar o ator do mundo: a conexão nova continua com ele. Se era a conexão atual, **completa o passo em curso**, faz o flush da posição e só então anuncia `actor_leave` — o sqm durável fica no banco antes de os outros saberem que o ator saiu. |

No `ws/gameSocket.ts`:

- Um único `WorldChannel` é criado junto com o handler e vive enquanto o servidor viver.
- O `select_trainer` bem-sucedido responde o `command_result` e, **depois**, chama `world.enter`. O `world_state` é uma mensagem separada e posterior ao snapshot do jogador, que continua sendo dono do `pushState`.
- O `move` é o comando de movimento do canal. `finalize_hunt` e `swap_creature` são encaminhados ao manager da caçada; `use_ability` e `use_consumable` continuam recusados com `invalid_command`, porque a rotação e os consumíveis pertencem à simulação.
- `readMoveTarget` valida a forma: objeto com `x` e `y` numéricos e inteiros. Os limites do mapa e a colisão são julgados pelo mundo, e um alvo fora do mapa vira `invalid_target`, não uma mensagem inválida.
- Um payload de `move` quebrado é `invalid_message`; um `move` de um ator que ainda não entrou é `invalid_command`.

## Persistência, limites e instâncias

- **Posição durável:** a posição vai para a tabela `trainer_positions` (um sqm + facing por treinador), via UPSERT em `trainer_id`. A escrita é **write-behind**: cada passo confirmado marca a posição como pendente, mas só o último da janela (~1 s) chega ao banco — uma caminhada de dez passos vira um único UPSERT, não dez.
- **Close completa o passo:** na desconexão da conexão atual, o passo em curso é completado (o treinador pousa no `to`) e a posição é gravada **na hora**, antes do `actor_leave`. Uma reconexão de outro processo já lê o sqm certo.
- **Enter lê a posição durável:** o `enter` lê `trainer_positions` e entra no sqm salvo. Se a leitura falhar, ou o sqm não for andável, o fallback é o spawn.
- **Sem caminho após reconexão:** o caminho em curso é descartado no `leave` e no `join`. A conexão nova recebe apenas o sqm confirmado (que é o `to` do passo que estava em curso na queda).
- **Um processo:** o servidor assume uma instância só. Multi-instância, Redis e sticky session não existem; um segundo processo teria dois mundos independentes.
- **Sem colisão entre atores:** o pathfinding considera só o terreno. Dois jogadores podem planejar o mesmo sqm e ocupá-lo ao mesmo tempo.
- **Sem recorte por distância:** todos os atores presentes na cidade são enviados a todos os observadores.
- **Sem tick de mundo:** não há laço periódico avançando atores; o relógio e os timers de anúncio bastam.
- **Limites:** 512 passos por caminho e 30 s de cache por `reqId`.

## Testes

| Arquivo | O que cobre |
| --- | --- |
| `apps/server/src/world/path.spec.ts` | Custo ponderado (ortogonal 1 vs diagonal 3), canto fechado, alvo sólido, alvo cercado, alvo fora do mapa, caminho longo demais (com fallback de passos mínimos), caminho vazio e determinismo. |
| `apps/server/src/world/registry.spec.ts` | Revisão monotônica por observador, spawn e permanência do tile, confirmação de passos pelo relógio, entrada na posição durável e cache de `reqId` por conta. |
| `apps/server/src/world/ruler.spec.ts` | Duração por direção, timestamps crescentes, replanejamento **preservando o segmento em curso**, parada, deduplicação de `reqId`, código da falha e ator ausente. |
| `apps/server/src/world/channel.spec.ts` | Entrada lendo a posição durável (e fallback spawn), close completando o passo e fazendo flush antes do `actor_leave`. |
| `apps/server/src/world/positionWriter.spec.ts` | Coalescência da janela (~1 s), serialização dos writes e flush imediato por treinador. |
| `apps/server/src/__tests__/gameSocketWorld.spec.ts` | Integração do `move` pelo WebSocket: `select_trainer` responde `command_result` e depois `world_state`; o `move` responde só `move_result`; alvo sólido para no adjacente; fora do mapa é `invalid_target`; `reqId` repetido recebe o mesmo walk; um segundo ator é anunciado e o `leave` também. |
| `apps/server/src/__tests__/gameSocket.spec.ts` | Parse do envelope, `select_trainer`, `hunt_state`, `finalize_hunt`, `swap_creature` e a recusa de habilidade manual. |

O comando é `bun test apps/server`. O registro recebe o relógio por opção, e a régua lê o relógio do registro; por isso os testes não dependem do tempo real.

> A cobertura inclui o caminho, o registro, a régua, a persistência de posição e o fluxo completo de `move` pelo WebSocket.
