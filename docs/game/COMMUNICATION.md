# Comunicação Cliente-Servidor

Este documento é o contrato vivo da comunicação do Empirage. Ele descreve todas as chamadas feitas pelo navegador, as mensagens do WebSocket e as operações relevantes entre servidor e banco.

> Toda alteração de HTTP, Supabase Auth ou WebSocket deve atualizar este arquivo na mesma mudança. Consulte também `AGENTS.md`.

## Escopo e termos

Há três canais de comunicação:

| Canal | Quem conversa | Uso |
| --- | --- | --- |
| Supabase Auth | navegador e Supabase | conta, login e sessão |
| HTTP | navegador e servidor | consultas e comandos pontuais |
| WebSocket | navegador e servidor | cidade e caça em tempo real |

Uma operação entre o servidor e o Supabase não é exposta diretamente ao navegador, mas é registrada aqui quando explica a durabilidade, validação ou idempotência de uma ação do jogo.

Os UUIDs e JWTs nos exemplos são fictícios. Nunca registrar JWTs reais em logs.

## Regras comuns

### Autorização HTTP

As rotas protegidas recebem o cabeçalho abaixo:

```http
Authorization: Bearer <jwt>
```

O middleware verifica a presença e formato do cabeçalho, chama `auth.getUser(token)` no Supabase e cria um cliente associado ao usuário. Token ausente retorna `401 authentication_required`; token inválido retorna `401 invalid_access_token`.

Erros HTTP seguem este formato:

```json
{
  "code": "invalid_access_token",
  "message": "invalid_access_token"
}
```

### Envelope WebSocket

Toda mensagem JSON possui `type` e `version`.

```json
{
  "type": "example",
  "version": 1
}
```

Mensagens do servidor incluem ainda `serverEpoch` e, após autenticação, `connectionGeneration`. O cliente descarta eventos de conexões anteriores quando necessário. A versão 1 permanece em uso; campos novos devem ser aditivos até a introdução coordenada da versão 2.

O WebSocket aceita somente `GET /ws` com upgrade e origem permitida. Também limita tamanho de mensagem, mensagens por segundo, conexões por IP e buffer de saída. O servidor fecha a conexão se não puder manter o cliente sincronizado com segurança. Métricas agregadas por tipo de mensagem registram volume, bytes, conexões e descartes por backpressure; JWTs não são registrados.

### Três sincronizações diferentes

| Nome | Frequência | Escreve no banco? | Objetivo |
| --- | --- | --- | --- |
| `snapshot` da cidade | a cada 5 s e na entrada | não | reconciliar somente jogadores na área de interesse visível |
| `hunt_clock` | a cada 7 s durante a caça | não | sincronizar relógio do cliente e servidor |
| checkpoint da caça | em transições importantes, após cada derrota e, no máximo, a cada 5 min enquanto alterada | sim | recuperar o estado mínimo da caça |

`snapshot` da cidade nunca é um histórico de banco.

## Supabase Auth

### Cadastro

| Item | Valor |
| --- | --- |
| Origem | tela `/signup` |
| Destino | Supabase Auth |
| Objetivo | criar conta e sessão |

```json
{
  "email": "ana@example.com",
  "password": "SenhaSegura123"
}
```

```json
{
  "user": { "id": "user-uuid", "email": "ana@example.com" },
  "session": { "access_token": "jwt...", "refresh_token": "refresh..." }
}
```

O cliente valida e-mail, senha de ao menos seis caracteres e confirmação igual à senha. O Supabase valida credenciais e disponibilidade da conta. A confirmação de senha não sai do navegador.

### Login

| Item | Valor |
| --- | --- |
| Origem | tela `/signin` |
| Destino | Supabase Auth |
| Objetivo | obter sessão autenticada |

```json
{
  "email": "ana@example.com",
  "password": "SenhaSegura123"
}
```

```json
{
  "user": { "id": "user-uuid", "email": "ana@example.com" },
  "session": { "access_token": "jwt...", "refresh_token": "refresh..." }
}
```

O cliente valida formato do formulário; o Supabase valida as credenciais. A interface apresenta erro genérico para não revelar qual campo falhou.

### Sessão e logout

O SDK restaura a sessão persistida e pode emitir `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED` e `USER_UPDATED`. O token vigente é usado no HTTP e na primeira mensagem do WebSocket.

No logout, o navegador chama o Supabase Auth sem payload de domínio. A resposta bem-sucedida não possui dados de jogo; o cliente remove apenas a seleção local de personagem. Personagens, criaturas e caça não são excluídos.

## HTTP

### `GET /health`

Não exige autenticação e não consulta o banco.

```json
{ "status": "ok" }
```

É uma checagem de vida do processo, não uma prova de que o Supabase ou a simulação estão disponíveis.

### `GET /characters`

| Objetivo | listar personagens da conta |
| --- | --- |
| Autorização | obrigatória |

```json
[
  {
    "id": "character-uuid",
    "name": "Ana",
    "experience": 1250,
    "level": 8,
    "gender": "female",
    "avatar_url": null
  }
]
```

O servidor valida o JWT; o banco retorna somente personagens da conta autenticada e os ordena pelo slot.

### `POST /characters`

| Objetivo | criar personagem |
| --- | --- |
| Autorização | obrigatória |

```json
{ "name": "Ana Silva", "gender": "female" }
```

```json
{ "id": "character-uuid" }
```

O cliente exige nome de 3 a 15 caracteres, formato permitido e gênero válido. O servidor verifica que `name` é texto e `gender` é `male` ou `female`. A função `create_character` no banco garante nome único sem distinguir maiúsculas/acentos, primeiro slot livre e máximo de cinco personagens por conta.

Erros de domínio possíveis:

```json
{ "code": "character_name_unavailable", "message": "character_name_unavailable" }
```

```json
{ "code": "character_limit_reached", "message": "character_limit_reached" }
```

### `GET /characters/active-hunt`

| Objetivo | direcionar a conta para a caça ativa, se existir |
| --- | --- |
| Autorização | obrigatória |

```json
{ "character_id": "character-uuid" }
```

Ou `null` quando não há caça. O servidor valida o token e filtra a busca pelo `user_id` autenticado.

### `GET /hunting-locations`

| Objetivo | listar locais e espécies disponíveis |
| --- | --- |
| Autorização | obrigatória |

```json
[
  {
    "id": 1,
    "slug": "forest",
    "name": "Floresta",
    "description": "Uma área inicial.",
    "tilesetUrl": "/assets/hunting-locations/grassland-tiles.png",
    "map": {
      "width": 12,
      "height": 8,
      "tileSize": 16,
      "defaultTileFrame": 0,
      "tiles": [],
      "objects": [
        { "kind": "player_spawn", "x": 2, "y": 3 },
        { "kind": "ally_spawn", "x": 6, "y": 3 }
      ]
    },
    "positionX": 12,
    "positionY": 8,
    "species": [
      {
        "id": 25,
        "name": "Exemplo",
        "description": "Uma criatura encontrada neste local.",
        "minimumLevel": 2,
        "maximumLevel": 5,
        "encounterWeight": 70
      }
    ],
    "waveRanges": [
      { "minimumSize": 1, "maximumSize": 2 },
      { "minimumSize": 2, "maximumSize": 4 }
    ]
  }
]
```

Valida o token e retorna a configuração disponível no banco. `tilesetUrl` referencia o spritesheet do cenário; `map` contém o tamanho, tiles por coordenada e objetos posicionados. O cliente usa esses dados para pré-carregar e, futuramente, pré-visualizar o mapa antes da transição.

`waveRanges` lista, em ordem crescente, as únicas faixas de criaturas por onda que o jogador pode selecionar naquele local.

### `GET /ws` sem upgrade

```json
{ "code": "upgrade_required", "message": "upgrade_required" }
```

É somente uma proteção: a conexão do jogo deve fazer upgrade WebSocket.

## WebSocket: cliente para servidor

### `authenticate`

Enviada imediatamente após abrir a conexão.

```json
{
  "type": "authenticate",
  "version": 1,
  "token": "jwt...",
  "characterId": "character-uuid"
}
```

O servidor valida versão, tipos, JWT no Supabase, existência e propriedade do personagem, exclusividade de uma caça por conta e substitui uma conexão anterior da mesma conta após persistir sua posição. A confirmação é enviada por `snapshot`, `authenticated`, `collection_state` e sempre por `hunt_state` — com `hunt: null` quando o personagem está na cidade.

### `input`

Enviada ao mudar a entrada de movimento na cidade.

```json
{
  "type": "input",
  "version": 1,
  "sequence": 42,
  "priority": "right",
  "input": {
    "up": false,
    "down": false,
    "left": false,
    "right": true,
    "running": false
  }
}
```

O servidor verifica versão, formato completo, sequência inteira crescente, prioridade válida, personagem fora de caça/transição e limites do mapa. O efeito retorna por `movement_started`, `player_idle` e `snapshot`.

Uma rejeição recuperável é:

```json
{
  "type": "input_rejected",
  "version": 1,
  "code": "stale_sequence",
  "reason": "stale_sequence"
}
```

### `hunt_clock`

Enviada ao autenticar e a cada sete segundos enquanto houver caça.

```json
{ "type": "hunt_clock", "version": 1, "sentAt": 1794672000000 }
```

O servidor exige versão e timestamp finito e responde com `hunt_clock`. Não grava no banco.

### `start_hunt` e `leave_hunt`

```json
{ "type": "start_hunt", "version": 1, "huntingLocationId": 1 }
```

```json
{ "type": "leave_hunt", "version": 1 }
```

`start_hunt` exige um identificador inteiro de local existente, personagem e recursos válidos, evita corridas de criação e garante uma caça por conta. O servidor usa exclusivamente o local solicitado; não há seleção aleatória. `leave_hunt` exige checkpoint final confirmado antes de declarar a caça encerrada. Ambos respondem com `hunt_state`.

### `configure_healing_item`

```json
{
  "type": "configure_healing_item",
  "version": 1,
  "healingItemId": 4,
  "healingThresholdPercentage": 30
}
```

Para desativar: `healingItemId: 0`. Valida inteiros, percentual entre 1 e 100, posse da caça e disponibilidade do item. A configuração é persistida e a resposta é `hunt_state`.

### `configure_capture`

```json
{
  "type": "configure_capture",
  "version": 1,
  "captureItemId": 7,
  "captureRarities": ["common", "uncommon"]
}
```

Para desativar: `captureItemId: 0` e lista vazia. Valida item, raridades permitidas, lista não vazia quando ativa e propriedade da caça. A seleção de raridades é comparada à raridade calculada pelos seis IVs sorteados quando o encontro surge; os mesmos IVs são persistidos caso a captura tenha sucesso. As faixas de raridade estão em `docs/game/HUNTING.md`. Responde com `hunt_state`.

### `configure_wave_range`

```json
{
  "type": "configure_wave_range",
  "version": 1,
  "waveRangeMinimumSize": 2,
  "waveRangeMaximumSize": 4
}
```

Exige uma caça ativa e inteiros que correspondam exatamente a uma faixa do local de caça atual. Atualiza a faixa selecionada no checkpoint da caça e responde com `hunt_state`. A troca nunca muda os inimigos da onda em curso: passa a ser usada somente no sorteio da próxima onda.

### `configure_ability`

```json
{
  "type": "configure_ability",
  "version": 1,
  "abilitySlot": 1,
  "abilityId": 13
}
```

`abilityId: null` remove a habilidade do slot. Valida slot de 1 a 4, habilidade, nível necessário, criatura ativa e propriedade. Pode ser enviada tanto na cidade quanto na caça: durante a caça responde com `hunt_state`; na cidade responde com `collection_state` atualizado.

### `switch_active_creature`

```json
{
  "type": "switch_active_creature",
  "version": 1,
  "creatureId": "creature-uuid"
}
```

Valida criatura ativa da equipe e propriedade. Na cidade, persiste imediatamente a seleção no personagem e responde com `collection_state`. Na caça, também dispara checkpoint de estado e responde com `hunt_state`. A criatura ativa é recuperada ao reconectar, iniciar outra caça ou retornar à cidade.

### `request_creature_storage`

```json
{ "type": "request_creature_storage", "version": 1, "storagePage": 2 }
```

Exige página inteira maior ou igual a um e responde com `collection_state`.

### `move_creature_to_party` e `move_creature_to_storage`

```json
{
  "type": "move_creature_to_party",
  "version": 1,
  "creatureId": "creature-uuid"
}
```

Validam identificador, posse, capacidade da equipe e consistência no banco. Não é permitido remover a última criatura da equipe: sempre há uma criatura ativa enquanto houver equipe. Ao remover a criatura ativa, o banco seleciona a próxima criatura da equipe. A resposta é sempre um `collection_state` completo.

## WebSocket: servidor para cliente

### `authenticated`

```json
{
  "type": "authenticated",
  "version": 1,
  "characterId": "character-uuid",
  "position": { "x": 10, "y": 14 },
  "profile": { "name": "Ana", "level": 8, "gold": 250, "avatarUrl": null }
}
```

Confirma que a conexão está autorizada a operar o personagem.

### `snapshot`

```json
{
  "type": "snapshot",
  "version": 1,
  "tick": 120,
  "players": [{ "characterId": "other-character", "x": 10, "y": 14 }]
}
```

É enviada na entrada e a cada cinco segundos para corrigir estado visual da cidade. Ela contém apenas a célula lógica de 16 × 16 tiles do destinatário e as oito células vizinhas; não inclui jogadores caçando e não persiste no banco. O tamanho da célula é configurável no servidor por `WEBSOCKET_INTEREST_CELL_SIZE_TILES`.

### Presença e movimento

```json
{
  "type": "player_joined",
  "version": 1,
  "characterId": "character-uuid",
  "position": { "x": 10, "y": 14 },
  "direction": "down",
  "mode": "idle",
  "tick": 120
}
```

```json
{
  "type": "movement_started",
  "version": 1,
  "characterId": "character-uuid",
  "movementId": "movement-uuid",
  "from": { "x": 10, "y": 14 },
  "to": { "x": 11, "y": 14 },
  "direction": "right",
  "mode": "walking",
  "startTick": 120,
  "durationTicks": 12
}
```

`player_left` remove um jogador da cidade; `player_idle` confirma seu fim de movimento. Ambos contêm `characterId` e `tick`; `player_idle` também contém posição, direção e modo.

### `hunt_clock`

```json
{
  "type": "hunt_clock",
  "version": 1,
  "sentAt": 1794672000000,
  "serverTime": 1794672000034
}
```

É a resposta ao relógio do cliente, usada para sincronização visual de tempo.

### `hunt_state`

```json
{
  "type": "hunt_state",
  "version": 1,
  "huntId": "hunt-uuid",
  "hunt": {
    "revision": 12,
    "serverTime": 1794672000034,
    "wave": 3,
    "waveRange": { "minimumSize": 2, "maximumSize": 4 },
    "gold": 180,
    "activeCreatureId": "creature-uuid",
    "activeCreatureHealth": 42,
    "activeCreatureMaximumHealth": 80,
    "playerPosition": { "x": 2, "y": 3 },
    "enemies": [],
    "combatEvents": [],
    "captureAttempts": []
  }
}
```

É a fonte de verdade visual da caça. É enviado no início, ações de configuração, atualizações do motor, captura, cura, pausa, reconexão e finalização. `revision` aumenta em toda mudança observável do estado, inclusive na criação, no resultado e na remoção de uma tentativa de captura; o cliente descarta somente estados com revisão anterior ou igual. `waveRange` é a faixa escolhida para a próxima onda; o payload completo também contém mapa, habilidades, cooldowns, itens, configurações, criatura ativa e experiência. Cada item em `captureAttempts` começa como `pending` durante a animação. Ao enfileirar a tentativa, o servidor decide o resultado da captura, reserva o custo da bola e inicia imediatamente a persistência atômica no banco. Exatamente em `completesAt`, ele envia `succeeded` ou `failed`, garantindo o feedback visual verde ou vermelho no prazo planejado. Se a persistência falhar ou expirar após 10 s, a tentativa permanece na fila interna do servidor e é repetida após 3 s com o mesmo `id`, usado como `command_id` idempotente; ela não volta a ficar amarela no cliente. `collection_state` é atualizado somente após a persistência de uma captura bem-sucedida. Quando a caça termina, `hunt` é `null`.

### `collection_state`

```json
{
  "type": "collection_state",
  "version": 1,
  "collection": {
    "activeCreatureId": "creature-uuid",
    "party": [],
    "storage": [],
    "storagePage": 1,
    "storagePageCount": 1,
    "storageTotal": 0
  }
}
```

É enviada após autenticação, pedido de armazenamento, movimentação entre equipe/armazenamento e captura concluída. `activeCreatureId` é a seleção persistente do personagem. Na cidade, `configuration` contém as habilidades e itens da criatura ativa para que os diálogos da barra inferior possam ser configurados sem uma caça em curso. Ela não acompanha dano, movimento, cooldown, onda ou relógio da caça. O servidor a produz para evitar que o cliente mantenha uma coleção divergente sem consultar o banco a cada atualização de combate.

### `error`, fechamento e heartbeat

```json
{ "type": "error", "version": 1, "code": "invalid_access_token" }
```

Erros de protocolo podem encerrar a conexão. Exemplos: `invalid_authentication_message`, `invalid_access_token`, `character_not_found`, `another_character_is_hunting`, `rate_limit_exceeded`, `message_too_large`, `connection_replaced` e `server_shutting_down`.

O heartbeat real usa frames WebSocket nativos `ping` e `pong` a cada 15 segundos; não é uma mensagem JSON de domínio. Não existe evento JSON `heartbeat` no protocolo.

## Servidor para Supabase/Postgres

| Operação | Quando ocorre | Garantia e validação |
| --- | --- | --- |
| `create_character` | criação de personagem | nome, limite, slot e concorrência no banco |
| `checkpoint_character_hunt` | fronteira relevante, cada derrota, pausa, saída, término e segurança coalescida | revisão otimista, lock da caça e `checkpoint_id` idempotente; aplica a experiência acumulada da derrota e a criatura ativa na mesma transação do checkpoint; o término retém somente um recibo compacto por 24 h para responder com segurança a retry após remover a caça |
| `complete_character_capture` | término de tentativa de captura | `command_id` idempotente, débito e criação atômicos; em falha de comunicação, o servidor reenvia o mesmo comando até obter confirmação |
| `purchase_character_battle_item` | cura automática | compra e saldo atômicos |
| `configure_creature_equipped_move` | configuração de habilidade | criatura, slot e movimento válidos |
| mover criatura | pedido de equipe/armazenamento | propriedade e limite de equipe |
| atualização de posição | a cada 30 s, desconexão e substituição de sessão | filtra por personagem e conta |

O checkpoint recebe o estado mínimo necessário para recuperar a caça, por exemplo. O `runtime_snapshot` persistido também inclui `allyHealth`, um mapa de HP atual por identificador de criatura da equipe; a recuperação valida os identificadores e limites de HP antes de restaurá-los. Snapshots legados sem esse campo mantêm a reconstrução anterior somente por compatibilidade; todo checkpoint novo grava o mapa completo.

```json
{
  "expected_hunt_id": "hunt-uuid",
  "expected_revision": 12,
  "checkpoint_id": "checkpoint-uuid",
  "next_active_creature_id": "creature-uuid",
  "next_active_creature_health": 42,
  "next_player_position": { "x": 2, "y": 3 },
  "next_enemies": [],
  "next_wave": 3,
  "experience_deltas": [{ "creatureId": "creature-uuid", "amount": 25 }],
  "finish_hunt": false
}
```

```json
[{ "applied": true, "next_revision": 13, "finished": false }]
```

O desenho não deve criar histórico de snapshots. Uma caça ativa possui uma única representação persistida; os comandos econômicos retêm somente a deduplicação compacta necessária por tempo limitado.

## Ao alterar este contrato

1. Atualizar este documento com payload, resposta, validações, frequência e efeitos no banco.
2. Atualizar os parsers e tipos de ambos os lados no mesmo change set.
3. Manter compatibilidade ou definir uma estratégia explícita de migração.
4. Elevar `version` se a mudança quebrar clientes antigos.
5. Incluir `commandId` e semântica idempotente em novos comandos que possam produzir efeito econômico ou durável.
6. Não adicionar campos grandes a eventos frequentes sem definir projeção, interesse do destinatário e limite de tamanho.
