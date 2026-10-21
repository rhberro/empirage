# Estrutura do Cliente

Este documento descreve como o código do cliente está organizado: as camadas, onde cada tipo de código mora, a API pública de uma fatia e a regra de dependência.

> O cliente vive em `apps/client`. Ele **não decide nada sobre o jogo**: toda a simulação acontece no servidor, conforme descrito na [Arquitetura](../ARCHITECTURE.md). Aqui só está registrado onde o código do cliente mora e por quê.

## Índice

| Tópico | O que responde |
| --- | --- |
| [As camadas](#as-camadas) | Quais são as camadas e o que cabe em cada uma. |
| [A camada de queries](#a-camada-de-queries) | Onde mora a chave e o fetcher de cada query. |
| [O `QueryClient` da aplicação](#o-queryclient-da-aplicação) | Por que o cache é um singleton do `app/`. |
| [O registro global do estado do jogador](#o-registro-global-do-estado-do-jogador) | Onde o estado empurrado pelo canal é registrado. |
| [Onde o código mora](#onde-o-código-mora) | A pergunta que decide a camada de um arquivo novo. |
| [A API pública](#a-api-pública) | O que um consumidor pode importar de uma fatia. |
| [A regra de dependência](#a-regra-de-dependência) | Para onde a dependência pode apontar. |
| [Onde mora um pedido ao servidor](#onde-mora-um-pedido-ao-servidor) | A regra que decide se um pedido fica na página, no `shared/` ou na entidade. |
| [O widget do jogo](#o-widget-do-jogo) | Por que existe uma camada `widgets/` em um FSD que a desaconselha. |
| [Como verificar](#como-verificar) | O linter que fiscaliza as regras deste documento. |
| [Documentos relacionados](#documentos-relacionados) | Os outros documentos do cliente. |

## As camadas

O cliente segue o **Feature-Sliced Design** (FSD v2.1). A dependência só aponta para baixo: `app → pages → widgets → features → entities → shared`. Um arquivo nunca importa de uma camada acima, e duas fatias da mesma camada não se importam entre si.

```
apps/client/src/
  app/            ponto de entrada, providers, router, query/ e escala da interface
  pages/          uma fatia por rota, cada uma com ui/ e, quando tem estado próprio, model/
  widgets/        blocos compostos de tela: game-hud/
  features/       ações do usuário: authentication/, store/, storage/, backpack/, delete-trainer/
  entities/       modelo de domínio: trainer/ (model/, ui/), team/ (model/, ui/, api/)
  shared/         ui/ (design system), theme/ (tokens), auth/ (sessão), api/ (cliente HTTP e queries)
```

| Camada | O que vive ali | Quem importa |
| --- | --- | --- |
| `app/` | O ponto de entrada: providers, router, rotas protegidas, o `QueryClient` e a escala da interface. | O `app/` e o `shared/`. |
| `pages/` | A tela: a rota, o layout e a orquestração. | O `app/`, pelo roteador. |
| `widgets/` | Blocos de tela que mais de uma página usa — hoje, só o HUD do jogo. | `pages/`. |
| `features/` | Uma ação do usuário com dono: entrar, criar treinador, abrir a loja. | `pages/` e `widgets/`. |
| `entities/` | O modelo do jogo: o treinador e o time, com tipos, schema, regra e UI. | `features/`, `widgets/` e `pages/`. |
| `shared/` | Infraestrutura sem regra de jogo: o design system, o tema, a sessão, o cliente HTTP e as queries. | Todas as camadas. |

Dentro de uma fatia, os arquivos são agrupados por segmento: `ui/` para a tela, `model/` para o estado, a regra e a lógica, `api/` para a conversa com o servidor.

**O nome do arquivo diz o assunto.** Um arquivo se chama pelo domínio que ele serve — `trainer.schema.ts`, `trainer.types.ts`, `useTrainers.ts` — e não pelo papel técnico que ele exerce. `types.ts` e `utils.ts` soltos não respondem "de quem é este arquivo".

### A camada de queries

`shared/api/queries/` guarda a chave e o fetcher de cada query do TanStack Query.

> A chave e o fetcher moram juntos porque são a mesma coisa: a chave identifica o recurso, e o fetcher é a única forma de lê-lo. Separados, o cache e a rede poderiam divergir sem ninguém perceber.

| Arquivo | A query |
| --- | --- |
| `trainerQueries.ts` | A lista de treinadores da conta. |
| `starterQueries.ts` | As espécies iniciais. |
| `huntAreaQueries.ts` | A lista de áreas de caça e o detalhe de uma área. |
| `storeQueries.ts` | O catálogo da loja. |

A `staleTime` de cada uma está escrita na query: o conteúdo do catálogo muda em deploy, e a lista de treinadores e o catálogo da loja mudam por ação do jogador — por isso os dois são invalidados pela mutação que os mudou.

### O `QueryClient` da aplicação

O `QueryClient` mora em `app/query/`, e o provider fica em `app/query/QueryProvider.tsx`.

> Ele é **de aplicação**, e não de `shared/`: o cache é uma decisão do cliente inteiro, não uma infraestrutura que uma fatia usa. E ele precisa ser um **singleton**, porque o cache compartilhado é o que faz duas telas que pedem a mesma coisa pedirem ao servidor uma vez só.

O `QueryClient` é criado uma vez, com os padrões que toda query do jogo quer: sem retentativa numa recusa nomeada pelo servidor, sem tempestade de pedidos quando a aba volta ao primeiro plano, e sem regra de frescor que não esteja escrita na própria query.

### O registro global do estado do jogador

`entities/team/model/playerStateSync.ts` é o registro global do estado do jogador.

> Ele mora na fatia do time porque é o **slice mais baixo** que a página, as features e as entidades alcançam: o estado que o canal empurra é a mesma verdade que o time, o painel de habilidades e os comandos do cliente leem. Um store que vivesse na página não seria alcançável pelas entidades, e um provider React colocaria o estado de volta dentro do React — que é exatamente o que o estado do jogo não pode ser.

O registro não é um store Zustand: é um módulo com a revisão aplicada, o relógio do servidor corrigido e os ouvintes do estado. O estado do jogador **não** vira query do TanStack Query: ele é empurrado pelo WebSocket, e é a revisão que decide a aplicação.

## Onde o código mora

A pergunta que decide a camada de um arquivo novo:

> **O componente conhece uma regra do jogo?**

`TrainerCard` conhece o conceito de treinador: ele mostra gênero e nível, e o `TrainerAvatar` desenha o símbolo do gênero. Isso é regra de jogo — é `entities/trainer/`.

`Button` não conhece nada: ele é um botão. Isso é `shared/ui/button/`.

O teste prático: se o componente continuaria existindo se o jogo fosse outro jogo, ele é `shared`. Se ele só faz sentido neste jogo, ele é `entities/` ou `features/`.

**Erro comum:** enfiar tudo em `shared/ui/` e chamar de design system. O design system é a parte **reutilizável**; o resto tem dono, e fingir o contrário só deixa a base grande e sem dono.

**Erro comum:** dar nome de domínio a uma primitiva genérica. `AuthField` era um campo com rótulo e erro usado também pela tela de criar treinador — por isso virou `FormField`, em `shared/ui/form/`.

**A regra de extração.** O código começa na página e só desce de camada quando as três condições valem ao mesmo tempo: o mesmo código é usado em mais de um lugar, agora; ele tem um motivo para mudar que não é o de um consumidor só; e a fronteira tem uma responsabilidade só. Duplicação entre páginas, sozinha, não justifica extrair.

**A entidade é a última a existir.** Ela é a camada mais acessível — todo mundo importa dela —, então a existência da camada não é motivo para criar uma entidade. Uma entidade nasce quando a regra de domínio é reusada de verdade por mais de um consumidor e precisa de uma casa única e estável. Tudo que é só dado de transporte fica no `shared/api/`.

## A API pública

**Toda fatia expõe uma API pública** em um `index.ts`. O consumidor importa de `~/entities/trainer`, nunca de `~/entities/trainer/ui/TrainerCard`. Dentro de uma fatia, o caminho entre segmentos é absoluto (`~/entities/trainer/model/trainer.schema`), para não criar ciclo com o índice público; entre arquivos irmãos do mesmo segmento, o caminho é relativo (`./TrainerCard`).

O `shared/` não tem fatias: ele é organizado por segmento, e cada componente é a sua própria pasta com o seu índice (`~/shared/ui/button`, `~/shared/ui/frame`). O mesmo vale dentro de um segmento — `~/shared/ui/frame` é o caminho, e `~/shared/ui/frame/Slot` não é. O índice do segmento é a API pública dele: `~/shared/theme`, `~/shared/api`, `~/shared/auth`.

**O nome de uma fatia não repete o nome de um segmento do `shared/`.** A fatia `features/authentication/` e o segmento `shared/auth/` são coisas diferentes, e o nome diz qual é: a feature é a ação do usuário, o segmento é a sessão.

## A regra de dependência

```
app  →  pages  →  widgets  →  features  →  entities  →  shared
```

Um `shared/` que importa de `features/` está invertido: não há como testar o design system sem o jogo. Um `theme/` que importa de `ui/` é circular por definição.

Duas fatias da mesma camada não se importam. Quando duas precisam da mesma coisa, a saída é empurrar a parte compartilhada para baixo — uma regra de domínio vai para a entidade, uma ação de usuário vai para a feature — ou compor as duas em uma camada acima, que é a página.

## Onde mora um pedido ao servidor

Duas perguntas, nesta ordem.

**Primeira: o pedido tem um consumidor só ou é compartilhado?** Um consumidor só significa que o pedido fica com ele: o `api/` da página, ou o `api/` da feature que é dona da ação. Sendo compartilhado, vai para a segunda pergunta.

**Segunda: o pedido carrega regra de domínio?** Conhecer a URL de um recurso e o formato da resposta não é regra de domínio. Pedido sem regra é `shared/api/` — acesso puro a recurso é infraestrutura, e mais de um slice chamando não muda isso. Pedido com regra — permissão, transição de estado, cálculo derivado — vai para `entities/<nome>/api/`, uma vez que a fronteira está estável; se a regra só uma tela aplica, a regra fica com a tela.

No cliente, a conversa com o servidor sobre treinador está assim:

| Pedido | Onde mora | Por quê |
| --- | --- | --- |
| Listar, criar, editar e deletar treinador | `shared/api/endpoints/trainer.ts` | Acesso puro a recurso, sem regra de domínio. |
| Listar as criaturas iniciais | `shared/api/endpoints/starter.ts` | Idem. |
| Ler o estado do jogador e abrir a sessão de um treinador | `shared/api/endpoints/player.ts` | Idem. |
| Validar os dados do novo treinador | `entities/trainer/model/trainer.schema.ts` | É a regra do domínio: é o schema que define o que é um treinador válido. |
| A chave e o fetcher da lista de treinadores | `shared/api/queries/trainerQueries.ts` | A lista é o estado do servidor, e a query é o cache compartilhado. A regra continua no controller, a tela consome a query. |
| O que a tela faz com a lista | `entities/trainer/model/useTrainers.ts` + `entities/trainer/model/trainersStore.ts` | A query entrega o dado, o carregando e o erro; o store guarda o que é da sessão: o treinador escolhido e o fato de a lista já ter sido lida. |

O `shared/api/` guarda a base e os endereços (`client.ts`), o transporte (`http.ts`), os endpoints (`endpoints/`) e as queries (`queries/`). O `shared/` nunca importa de `entities/`, `features/`, `pages/` ou `widgets/`.

> **A camada de queries entra depois do endpoint.** O endpoint sabe falar com o servidor; a query sabe o que fazer com a resposta — a chave que identifica o recurso, o fetcher que a lê e a `staleTime` que diz por quanto tempo ela é boa. Um recurso com regra de domínio tem a query em `entities/<nome>/api/`.

O `QueryClient` que as queries usam vive em `app/query/`, e o provider em `app/query/QueryProvider.tsx`: o cache é uma decisão do cliente inteiro, e ele precisa ser um singleton para que duas telas que pedem a mesma coisa peçam ao servidor uma vez só.

A base da API vem da variável `VITE_API_BASE_URL`. Em desenvolvimento, a ausência da variável aponta para `http://localhost:3001`; em um build, a ausência é um erro — o cliente não sobe apontando para a máquina de quem compilou.

## O widget do jogo

**O `widgets/` é fino e tem um motivo.** A tela do jogo precisa do HUD, e a galeria de design (`/design-system`) mostra os componentes reais da tela do jogo. Sem uma camada entre as duas, a galeria importaria de outra página — o que o FSD proíbe.

A referência oficial do FSD desaconselha a camada `widgets/`: blocos de tela costumam carregar lógica de fluxo, e a fronteira com `features/` fica turva. Desaconselhar não é deprecar — uma camada `widgets/` que já existe continua válida e segue as mesmas regras das outras: API pública, fatias isoladas e nada de regra de jogo.

A camada é mantida porque o HUD é exatamente o caso que a referência descreve como legítimo: **barras de navegação, sidebars, dashboards e rodapés**. A `Toolbar` do jogo é uma barra de navegação, e ela não é uma ação de usuário nem um modelo de domínio.

Ela não cresce: o que for ação de usuário vira `features/`, e o que for modelo vira `entities/`.

## Como verificar

A regra do FSD é verificada pelo linter oficial, o **Steiger**:

```
bunx steiger apps/client/src
```

Ele acusa o que este documento descreve: a dependência apontando para cima, o furto da API pública de uma fatia, o nome de uma fatia repetindo o nome de um segmento do `shared/` e a fatia sem consumidor.

## Documentos relacionados

- [Cliente](CLIENT.md) — o índice da documentação do cliente.
- [Design System](DESIGN_SYSTEM.md) — os tokens, os componentes e as regras de construção da interface.
- [Formulários](FORMS.md) — o estado dos campos, a validação e o envio.
- [Autenticação](AUTH.md) — a sessão, o roteamento protegido e os fluxos.
- [Stack](STACK.md) — as tecnologias escolhidas para o cliente.