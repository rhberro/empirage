# Deploy

Este documento cobre como subir o projeto: o que precisa estar instalado, quais variáveis de ambiente cada aplicação exige, como aplicar o banco, como rodar os scripts e o que verificar depois que o serviço está no ar.

> Este documento cobre **a subida do projeto**. A divisão entre cliente e servidor está em [Arquitetura](ARCHITECTURE.md), o servidor está em [Servidor](server/SERVER.md) e o cliente em [Cliente](client/CLIENT.md). O que ainda não está pronto para o público está em [O Que Ainda Não Está Pronto para o Público](#o-que-ainda-não-está-pronto-para-o-público).

## Pré-requisitos

| Ferramenta | Para quê |
| --- | --- |
| Bun | Runtime do servidor, gerenciador de pacotes e runner de testes |
| Supabase CLI | Aplicar as migrations e o seed no projeto do Supabase |
| Docker | Stack local do Supabase, usada só pelo `db:reset` |
| Um projeto Supabase hospedado | Autenticação, banco de dados e validação de token |

**Bun.** O Bun é o runtime do servidor, o gerenciador de pacotes e o runner de testes do projeto inteiro, conforme a [Stack do Servidor](server/STACK.md#bun). A versão não está fixada no repositório: não há `engines`, `packageManager` nem arquivo de versão, e o único lockfile é o `bun.lock`. O `@types/bun` em `^1.4.3` indica a linha 1.4 do runtime.

> Não se usa `npm`, `yarn` nem `pnpm`. Um único gerenciador de pacotes em todo o projeto, com um lockfile só.

**Node.** O Node não é requisito do projeto: o repositório não o declara em lugar nenhum, e o Vite do cliente é executado pelo Bun (`bun run dev:client` roda `vite`). O `bun.lock` e o `bun install` resolvem todas as dependências.

> O servidor também não é compilado: ele roda o TypeScript direto no Bun, e o cliente é o único que tem build.

**Supabase CLI.** É ela que aplica as migrations e o seed. A versão também não está fixada. O projeto do Supabase precisa estar criado e o servidor precisa ter as três chaves: URL, anon key e service role key.

**Docker.** Só é necessário para a stack local do Supabase, usada pelo `db:reset`. Quem usa o projeto hospedado não precisa dele.

## Variáveis de Ambiente

### Servidor

O servidor lê as variáveis do processo, e o arquivo que as carrega é o `apps/server/.env` — o Bun o carrega sozinho, porque os scripts do pacote rodam de dentro de `apps/server`. O modelo está em `apps/server/.env.example`.

| Variável | Obrigatória | Onde é lida | Para quê |
| --- | --- | --- | --- |
| `SUPABASE_URL` | Sim | `apps/server/src/supabase.ts` | URL do projeto do Supabase, usada no Auth e no banco |
| `SUPABASE_ANON_KEY` | Sim | `apps/server/src/supabase.ts` | Chave pública, usada para validar o token do jogador e listar usuários no merge Google |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | `apps/server/src/supabase.ts` | Chave de serviço, com permissão total no banco. Nunca vai para o cliente |
| `CLIENT_ORIGIN` | Não | `apps/server/src/index.ts` | Origem do cliente liberada no CORS, para além de `http://localhost:5173` |
| `PORT` | Não | `apps/server/src/index.ts` | Porta do servidor. O padrão é `3001` |

As três primeiras são obrigatórias de verdade: `readSupabaseEnv` chama `readRequiredEnv`, que derruba o processo com `Variável de ambiente obrigatória ausente: <nome>` quando a variável falta ou está vazia. O servidor não sobe sem as três.

> A `CLIENT_ORIGIN` é o que liga o cliente ao servidor em produção. O middleware de CORS sempre libera `http://localhost:5173` e acrescenta a `CLIENT_ORIGIN` quando ela existe, conforme a [API de Treinadores](server/TRAINERS.md#middleware-de-autenticação).

### Cliente

O cliente lê as variáveis do Vite, e o arquivo que as carrega é o `apps/client/.env.local` — ou o `apps/client/.env`, que o Vite também lê. O modelo está em `apps/client/.env.example`.

| Variável | Obrigatória | Onde é lida | Para quê |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Sim | `apps/client/src/shared/auth/supabase/env.ts` | URL do projeto, para o cliente do Supabase Auth |
| `VITE_SUPABASE_ANON_KEY` | Sim | `apps/client/src/shared/auth/supabase/env.ts` | Chave pública do Auth |
| `VITE_API_BASE_URL` | Sim no build | `apps/client/src/shared/api/client.ts` | Base da API do jogo e do canal do jogo |

> A `VITE_API_BASE_URL` é a única variável do cliente que é obrigatória **em produção**: em desenvolvimento a ausência aponta para `http://localhost:3001`, e em um build a ausência é um erro, porque o fallback levaria os jogadores para a máquina de quem compilou. O canal do jogo sai da mesma base: `https` vira `wss` e `http` vira `ws`.

> Tudo que começa com `VITE_` vai para o bundle do navegador. A anon key é pública por isso, e é o RLS que decide o que ela enxerga. A service role key nunca entra no cliente.

### No painel do Supabase

Duas configurações do projeto do Supabase são feitas no painel, e não por arquivo:

- **Redirect URLs** (`Authentication → URL Configuration`): a origem do cliente seguida da rota de destino depois da autenticação (`/trainers`). O cliente usa o fluxo PKCE, então o link de confirmação e o de recuperação voltam como `?code=`, e o SDK troca o código por uma sessão no primeiro carregamento da página.
- **Google** (`Authentication → Providers → Google`): a criação automática de contas precisa estar ligada, que é o que garante que o primeiro login pelo Google crie a conta.

> A segunda configuração está descrita em [Autenticação do Cliente](client/AUTH.md#o-merge-da-conta-google).

## Banco de Dados

O schema vive em migrations versionadas, em `supabase/migrations/`, e o catálogo inicial em `supabase/seed.sql`. A aplicação no projeto hospedado é feita pelos scripts da raiz.

```
bun run db:link
bun run db:push
bun run db:seed
```

| Script | Comando | O que faz |
| --- | --- | --- |
| `db:link` | `supabase link --project-ref xgrgubceyawigdnvfhou` | Liga a CLI ao projeto do Supabase. O `project-ref` está no próprio script, e a CLI pede acesso ao projeto na primeira vez |
| `db:push` | `supabase db push --linked` | Aplica as migrations que ainda não estão no banco |
| `db:seed` | `supabase db query --linked --file supabase/seed.sql` | Aplica o catálogo de espécies, habilidades, itens, drops, compatibilidade entre elementos e áreas de caça |
| `db:reset` | `supabase db reset --local` | Recria o banco **local**, aplicando migrations e seed. Precisa da stack local, que roda em Docker |

> **O seed não é aplicado pelo `db push`.** Nesta versão da CLI, `supabase db push --include-seed` apenas atualiza o hash do seed no histórico de migrações, sem executar o arquivo. O seed só roda com `bun run db:seed`, que chama o `db query --file`.

> O `seed.sql` é idempotente de propósito: as linhas são inseridas com `upsert` por `slug`, então aplicá-lo de novo converge em vez de falhar.

O seed é **catálogo do jogo**, e não dado de teste: as espécies iniciais, as habilidades, os itens, os drops e as quatro áreas de caça são o conteúdo que o jogo usa, e a suíte de integração não os apaga no fim.

## Como Rodar

Todos os scripts são executados da raiz do projeto.

| Comando | O que faz |
| --- | --- |
| `bun install` | Instala as dependências dos três workspaces: cliente, servidor e contratos |
| `bun run dev` | Sobe servidor e cliente juntos, em paralelo. O servidor em `http://localhost:3001` e o cliente em `http://localhost:5173` |
| `bun run dev:server` | Sobe só o servidor, com watch. `bun run --watch src/index.ts` |
| `bun run dev:client` | Sobe só o cliente, com o Vite em `http://localhost:5173` |
| `bun run build` | Build de todos os pacotes que têm script de build. Hoje é só o cliente: `bun run typegen && vite build`, com a saída em `apps/client/dist` |
| `bun run --filter @creatures/server start` | Sobe o servidor sem watch, para um ambiente que não é de desenvolvimento |
| `bun run test` | Roda os testes de unidade do cliente e do servidor: `bun test apps/client apps/server` |
| `bun run test:integration` | Roda a suíte de integração do servidor, contra o Postgres real |
| `bun run --filter @creatures/client typecheck` | Typecheck do cliente, com o guarda de tokens |
| `bun run --filter @creatures/server typecheck` | Typecheck do servidor |
| `bun run lint` e `bun run lint:fix` | Lint com o `oxlint` |
| `bun run format` e `bun run format:check` | Formatação com o `oxfmt` |

A suíte de integração **só roda com a variável `CREATURES_TEST_DB=1`**, porque ela mexe no banco real:

```
CREATURES_TEST_DB=1 bun run test:integration
```

> O `typecheck` do cliente carrega o guarda de tokens, que falha quando um componente usa uma cor que não existe no tema, uma cor crua ou um passo cru de escala no lugar de um token semântico. O `build` do cliente roda o `typegen`, que gera os tipos do tema no pacote do Chakra instalado — é ele que faz o `tsc` enxergar os tokens.

## O Que Verificar Depois de Subir

### O servidor está no ar

```
curl -s http://localhost:3001/api/health
```

A resposta é `{"status":"ok"}`. É a única rota pública do servidor: ela não exige token, e é ela que diz que o processo subiu.

### A autenticação funciona

O servidor valida o access token do próprio Supabase, e não emite token nenhum. Para ter um token, é preciso entrar na conta. A conta de teste do repositório é `qa.e2e.2026@exemplo.com`, com a senha `Creatures#2026qa`, e ela é criada por um script:

```
bun run --filter @creatures/server seed:test-account
```

O script é idempotente e deixa o treinador **Time de Teste** com quatro criaturas de espécies diferentes no time, para que a troca da criatura em campo possa ser exercitada. Ele usa o `apps/server/.env`.

Com a conta criada, o token sai do Auth do Supabase — o mesmo endpoint que o `signInWithPassword` do cliente usa:

```
TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"qa.e2e.2026@exemplo.com","password":"Creatures#2026qa"}' | jq -r .access_token)
```

O `jq` é só para ler o campo `access_token` da resposta: quem não tem pode rodar o `curl` sem o pipe e copiar o valor do campo direto da resposta.

### O estado do jogador responde

```
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/player/state
```

A resposta é `200` com o `PlayerState`: o treinador, o time, o armazenamento, a mochila, a carga da barra e as moedas. Se a conta ainda não tiver treinador ativo, a resposta é `404` com `trainer_not_found` — e o estado só existe depois que a sessão do treinador é registrada:

```
curl -i -X POST http://localhost:3001/api/session/trainer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"trainerId":"<uuid-do-treinador>"}'
```

A resposta é `204`, sem corpo.

> A rota do estado é a que melhor mostra se as três pontas estão no lugar: ela passa pelo token do Supabase, pelo Postgres e pela sessão do treinador. Um `401` significa token inválido; um `404 trainer_not_found` significa que o token é bom e a sessão do treinador é que não está registrada.

### O canal do jogo abre

O canal fica em `/ws`, no mesmo `Bun.serve` que serve o HTTP. O token do jogador **não** viaja na query string: o upgrade do Bun não recebe headers, e um token na query é registrado por qualquer proxy à frente do servidor. O que viaja é um **ticket de uso único**, emitido pelo servidor para a conta autenticada.

Primeiro o ticket:

```
TICKET=$(curl -s -X POST http://localhost:3001/api/ws-ticket \
  -H "Authorization: Bearer $TOKEN" | jq -r .ticket)
```

Depois o canal, com o ticket:

```
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "http://localhost:3001/ws?ticket=$TICKET"
```

A resposta é `101 Switching Protocols`. O ticket vale 30 segundos e é de uso único: um ticket desconhecido, expirado ou já usado responde `401` no upgrade, e o navegador vê um handshake que falhou.

O token viaja **dentro** do ticket, e o servidor o revalida no Auth server antes de abrir o canal — é o que permite detectar uma sessão revogada enquanto o token ainda parece válido. Por isso o canal demora um pouco mais que uma rota comum.

> O ticket **não pode ser logado** pela mesma razão do token: o servidor registra a abertura pelo `userId`, nunca pelo ticket, e o log de requisição HTTP registra apenas o `pathname`, sem a query. O proxy à frente do servidor, porém, registra a query inteira — e é por isso que o token do jogador não viaja nela.

### O cliente sobe

```
bun run dev:client
```

Abra `http://localhost:5173`, entre na conta e confirme que a tela do jogo carrega o estado do treinador. O botão de **play** abre o modal de áreas de caça, e a listagem de áreas vem do banco — o que confere, de passagem, que o seed está aplicado.

### O build do cliente aponta para o servidor certo

```
bun run build
```

O bundle sai em `apps/client/dist`. Confira que a base da API do bundle é a do ambiente, e não `http://localhost:3001`: sem a `VITE_API_BASE_URL` no build, o cliente não sobe, porque o fallback leva os jogadores para a máquina de quem compilou.

## O Que Ainda Não Está Pronto para o Público

Os pontos abaixo estão registrados como pendência no repositório e precisam ser resolvidos antes da abertura ao público.

- **As rotas do servidor não têm rate limit próprio.** As rotas de treinador confiam no cliente não abusar, na premissa de alfa e beta. O que existe é o limite do Supabase Auth, configurado no painel do projeto, e ele vale para o login e para o envio do e-mail de recuperação — as regras de produto estão em [Autenticação](../game/AUTHENTICATION.md#proteção-contra-tentativas-excessivas). A migração para limitação dedicada está pendente na [API de Treinadores](server/TRAINERS.md#pendências).
- **A proteção de e-mail do painel do Supabase precisa estar configurada no projeto hospedado.** O `supabase/config.toml` traz os limites do ambiente local (`[auth.rate_limit]`), e o projeto de produção precisa dos limites de produção, com a proteção de envio de e-mail do Auth habilitada.
- **Não há SMTP de produção.** O bloco `[auth.email.smtp]` do `supabase/config.toml` está comentado, e o SMTP padrão do Supabase não é para produção: ele tem limite de e-mails por hora e serve para desenvolvimento. Um servidor de SMTP próprio precisa ser configurado antes da abertura.
- **A sessão do treinador é por processo.** O mapa `userId → trainerId` vive na memória do processo: ele não sobrevive a um reinício do servidor e não é compartilhado entre instâncias. A decisão de instância única ainda está em aberto na [Stack do Servidor](server/STACK.md#pendências), então **suba uma única instância do servidor** até ela ser resolvida.
- **O `/api/auth/google-merge` ainda recebe `email` no corpo.** O campo é opcional e apenas conferido contra o e-mail da identidade autenticada, e a busca da conta de senha usa sempre o e-mail do usuário Google autenticado. A dívida restante é cosmética: a versão final deixa de receber o campo.
- **Os termos de serviço e a política de privacidade são placeholders.** As duas telas precisam estar publicadas antes da abertura do jogo ao público, em conformidade com a LGPD, conforme a [Autenticação](../game/AUTHENTICATION.md#termos-de-serviço-e-política-de-privacidade).
- **O jogo ainda está no vertical slice.** O que sobe hoje é a API de treinador, inventário, time, carga da barra, loja, catálogo de áreas e a caçada jogável com simulação autoritativa. Captura, party, level-up, recuperação de stamina e conta paga ainda não existem.

## O Que o Repositório Não Define

Estas lacunas não têm resposta no repositório, e quem for publicar o projeto precisa decidir por fora:

- **Como e onde as duas aplicações são publicadas.** Não há Dockerfile, nem configuração de hospedagem, nem pipeline de CI. O servidor sobe com `bun run --filter @creatures/server start` e o cliente é um bundle estático em `apps/client/dist`.
- **O TLS.** O navegador não abre um canal `ws://` a partir de uma página em `https`, e o cliente deriva o `wss` do `https` da base da API. A terminação de TLS fica na frente das duas aplicações.
- **O management dos segredos.** As chaves do Supabase são lidas do ambiente do processo, e o repositório só traz o `.env.example` de cada aplicação. Como elas chegam ao ambiente de produção é decisão de infra.
- **Backup, monitoramento e alertas.** O servidor loga em JSON estruturado com o `pino`, e o conteúdo do log de cada rota ainda não foi definido, conforme a [API de Treinadores](server/TRAINERS.md#pendências).
