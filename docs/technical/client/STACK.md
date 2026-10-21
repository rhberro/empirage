# Stack do Cliente

Este documento lista as tecnologias escolhidas para o cliente, o motivo de cada escolha e o que elas obrigam a fazer.

> O cliente vive em `apps/client`. Ele **não decide nada sobre o jogo**: toda a simulação acontece no servidor, conforme descrito na [Arquitetura](../ARCHITECTURE.md). Aqui só está registrado como o cliente representa e comunica esse estado.

## Stack

| Tecnologia | Papel |
| --- | --- |
| Bun | Runtime, gerenciador de pacotes e runner de testes |
| TypeScript | Tipagem do código, no cliente e no servidor |
| Vite | Build e servidor de desenvolvimento |
| React | Renderização da interface e componentes sobrepostos ao canvas |
| React Router | Roteamento entre as telas do cliente |
| React Hook Form | Estado dos formulários: valor, erro e envio |
| Zod | Schema de validação dos formulários e dos dados do cliente |
| Chakra UI | Design system dos elementos de interface |
| PixiJS | Renderização do mundo do jogo no canvas |
| Zustand | Armazenamento do estado do cliente |
| TanStack Query | Cache dos recursos HTTP de leitura |
| Supabase Auth | Autenticação do usuário |
| WebSocket | Comunicação com o servidor durante o jogo |

## Bun

O Bun é o gerenciador de pacotes e o runner de testes do projeto.

> Não se usa `npm`, `yarn` nem `pnpm`. Um único gerenciador de pacotes em todo o projeto, com um lockfile só.

O mesmo runner de testes cobre o cliente e o servidor, o que faz o teste de uma regra de negócio não exigir configuração separada da aplicação onde ela vive.

## TypeScript

Todo o código é TypeScript, no cliente e no servidor.

> Escolha feita uma única vez para o projeto inteiro. Não há JavaScript sem tipagem, nem em configuração de build.

A tipagem também serve de documentação nos pontos onde o cliente e o servidor trocam mensagens: os tipos do protocolo descrevem o que cada lado espera.

## Vite

O build e o servidor de desenvolvimento do cliente são feitos pelo Vite, na versão 8.

> Escolhido por ser enxuto e por não exigir configuração para começar. O bundle sai rápido e o servidor de desenvolvimento sobe na hora.

O Vite serve o cliente em `http://localhost:5173` durante o desenvolvimento.

A versão 8 usa o **Rolldown** no lugar do Rollup, e o bundle sai em menos de meio segundo. O `vite.config.ts` continua o mesmo: o Rolldown converte as opções do `esbuild` e do Rollup sozinho.

## React

A interface é construída em React.

> Escolhido pela equipe e pelo ecossistema: Chakra, as ferramentas de teste e o conhecimento de quem vai manter o código.

O React cuida dos elementos de interface, e não do mundo do jogo, que é desenhado pelo PixiJS.

## React Router

O roteamento entre as telas é feito pelo React Router.

> Escolhido porque o controle de acesso descrito em [Autenticação](../../game/AUTHENTICATION.md) é o problema central do roteamento aqui: das nove rotas, seis são públicas e três exigem sessão. Isso é uma rota intermediária que verifica a sessão e redireciona, e é exatamente o que o React Router resolve de forma direta.

O TanStack Router foi considerado e descartado. Os diferenciais dele são search params tipado e code splitting automático por rota, e nenhum dos dois se aplica: o estado do jogo chega pelo WebSocket e não por busca de dados na rota.

> O code splitting existe, com carregamento preguiçoso por rota: a tela de criar treinador e a tela do jogo só são baixadas quando alguém chega nelas.

> O `lazy` é o do React, e não o do roteador. O `lazy` do roteador descobre a página depois que ela entra, e essa espera acontece no meio do commit — o React avisa que o `flushSync` do Ark UI caiu dentro de um ciclo de vida. Com o `lazy` do React, quem espera é a própria tela, e a `LoadingScreen` cobre a espera.

A galeria do design system é a exceção: ela fica no bundle inicial. É a tela com todos os componentes do Chakra ao mesmo tempo, e montar tudo isso em um commit separado é o que dispara o aviso. Doze quilobytes de gzip é um preço menor que um erro no console.

## React Hook Form

Os formulários do cliente usam o **React Hook Form**, com o **Zod** como validador.

> Escolhido porque o formulário é a parte do cliente que mais precisa de estado: o valor de cada campo, o erro de cada campo, o que já foi tocado, o que está sendo enviado. O React Hook Form guarda esse estado fora do React, revalida só o campo que mudou, e devolve o `isSubmitting` que o botão de enviar precisa para não aceitar dois cliques.

**Todo formulário usa o React Hook Form.** Não há `useState` para o valor de um campo, não há validação escrita à mão dentro do componente, e não há biblioteca de formulário fora desta. A regra de um campo mora em um **schema do Zod**, e o `zodResolver` conecta o schema ao formulário.

Dois pontos do design system fazem a liaison com o RHF:

| Peça | Import | O que faz |
| --- | --- | --- |
| `useZodForm` | `~/shared/ui/form` | Cria o formulário com o `zodResolver`, o schema e a política de validação do projeto. |
| `FormField` | `~/shared/ui/form` | Liga o `useController` ao `TextField`: valor, `onChange`, `onBlur` e o erro do campo saem do hook e chegam no controle. |

**O schema é a fonte da verdade, e é o mesmo do servidor.** O schema que valida o formulário é o que valida o pedido que sai para a API: o que o jogador vê no campo é o que o servidor vai exigir. O `zodResolver` é o único lugar onde o schema entra em cena; o resto do formulário só conversa com o RHF.

> O `FormField` exige o `control` de forma explícita, em vez de lê-lo de um context. É o `control` que segura o tipo dos valores do formulário, e é ele que faz o nome do campo ser verificado na compilação: um nome errado não compila.

As regras de uso — quando o erro aparece, o que é erro de campo e o que é erro de formulário, o que acontece quando o jogador clica em enviar — estão em [Formulários](FORMS.md).

## Zod

O Zod valida os dados do cliente: os formulários e os pedidos que saem para a API.

> Escolhido porque o schema é código, e código se tipa: o tipo dos valores do formulário vem do schema, e o mesmo schema valida o que sai para o servidor. Com o `zodResolver`, o formulário e a API passam a conferir a mesma regra.

O `zodResolver` do `@hookform/resolvers` é a ponte entre o Zod e o React Hook Form.

> O Zod é o mesmo no cliente e no servidor: a versão 4. A migração do cliente aproveitou que o `@hookform/resolvers` já falava com as duas versões, e o que mudou no código foi o uso das APIs novas — `z.email()` e `z.uuid()` no lugar dos métodos da string, e `error` no lugar de `message` nos parâmetros do `refine`.

## Chakra UI

O Chakra é o design system dos elementos de interface, usado exatamente como foi feito, sem customização de componentes.

> Para as fases alfa e beta a diretriz é customizar o mínimo possível. A interface ainda vai mudar muito, e customizar componente agora é trabalho que provavelmente será jogado fora.

A saída para customizar algo no Chakra é criar um **token semântico** no sistema de temas, e não alterar o estilo do componente. Assim a customização fica em um único lugar e é fácil de reverter.

O design system em si, com as escalas, os tokens semânticos, as receitas, o catálogo de componentes e as regras de uso, está em [Design System](DESIGN_SYSTEM.md). Ele é a fonte da verdade da interface: toda tela do cliente sai dos componentes de `apps/client/src/shared/ui/`, e nenhum componente do Chakra é reescrito.

O tema tem uma divisão em quatro camadas: `shared/theme/tokens` traz os valores brutos, `shared/theme/semanticTokens` diz para que cada um serve, `shared/theme/textStyles` traz os estilos de texto prontos, e `shared/theme/recipes` traz as receitas — o estilo que **cruza** camadas, como a anatomia da camada e o anel de seleção. Nenhum componente do Chakra é reescrito, e a identidade visual vem inteira dessas camadas.

Quando o Chakra já resolve um comportamento — *focus trap*, `aria-modal`, posicionamento, região `aria-live`, navegação por setas — o design system usa o Chakra. O que é nosso é a aparência.

**Os tipos do tema são gerados.** O `@chakra-ui/cli` gera os tipos dos tokens, das receitas e das paletas a partir do tema, e o resultado é escrito no pacote do Chakra instalado. O comando roda no `postinstall` e antes do `build`, para que os tipos nunca fiquem velhos.

**O guarda dos tokens roda no typecheck.** O Chakra aceita qualquer string em uma prop de cor: `bg="coin"` compila, passa no typecheck e vira `background: coin` — CSS inválido, que o navegador descarta em silêncio. `scripts/check-tokens.ts` resolve cada valor de cor pelo mesmo dicionário de tokens que a interface usa e falha o build quando o token não existe, quando a cor é crua, ou quando um componente de `shared/ui/` consome um passo cru de escala em vez de um token semântico.

A fonte é servida pelo Google Fonts, com quatro famílias: Cinzel para o nome do jogo e os nomes de criatura, Barlow Semi Condensed para os rótulos de interface, Barlow para o texto corrido, e JetBrains Mono para números. A escolha de uma fonte por categoria vem da necessidade de caixa alta com entreletra aberta nos rótulos, de um serifa gravado nos títulos e de números tabulares nos valores.

O Cinzel entra no **peso 900** nos títulos e nos nomes de criatura. O Cinzel é um serifa de contraste alto, e no peso 800 a haste fina ainda competia com o fundo escuro da interface; no 900 o título tem presença sem perder o desenho gravado.

> O Dota 2 usa Reaver na interface e Radiance nos títulos. As duas não estão no Google Fonts, e o Cinzel é a aproximação mais próxima da Radiance dentro do que está disponível.

## PixiJS

O mundo do jogo é renderizado com o PixiJS, em um canvas separado dos elementos de interface.

> Escolhido por ser um renderizador 2D leve, feito para WebGL, que lida bem com cenas grandes e muitos sprites — que é exatamente o caso de um jogo top-down com várias criaturas visíveis.

O estilo do jogo impõe um conjunto de configurações que não são o padrão da biblioteca:

- `resolution` em 1, porque o jogo roda também em celular e resolução maior dobra o trabalho de renderização.
- `antialias` desligado, `roundPixels` ligado e `scaleMode` em nearest nos sprites, porque o jogo é em pixel art e escala fracionária deixa a imagem borrada.
- Escala sempre inteira, calculada a partir do espaço disponível e do tamanho do tile.

> Essas configurações são consequência do estilo de arte, não preferência. Se o jogo deixar de ser pixel art, as três últimas saem e a primeira volta a ser avaliada.

O canvas é dimensionado pelo elemento que o contém, e não pela janela do browser, porque a tela do jogo ocupa apenas a altura restante abaixo da toolbar.

## Zustand

O estado do cliente é guardado em stores Zustand.

> Escolhido porque o estado do jogo muda com frequência, com o servidor empurrando atualizações enquanto a partida acontece. Se esse estado passasse por `useState`, cada atualização viraria um novo render do React e a tela não acompanharia o ritmo do servidor.

**O estado do jogo não é estado do React.** O canvas lê o store diretamente a cada quadro, sem passar por render de componente. A interface em React também pode ler, mas só o que ela precisa exibir.

> Essa é a razão de existir o Zustand aqui e a regra que decorre dela. O React serve para a interface, e o estado que muda rápido é lido fora dele.

O estado da conta e da sessão fica em um store separado do estado do jogo.

> Separar os dois evita que a troca de tela recrie o estado do treinador, que foi carregado uma vez ao entrar no jogo.

**A lista de treinadores da conta não é um store: é uma query.** A tela que lista e a tela que cria treinador mostram a mesma lista, e elas a leem do mesmo cache do TanStack Query (`shared/api/queries/trainerQueries.ts`). O pedido em andamento é aguardado pela própria query, sem dedup manual. O store Zustand ficou só com o que é **da sessão**: o treinador que o jogador escolheu e o fato de a lista já ter sido lida. Ele é zerado quando a sessão deixa de existir.

**O estado vivo do jogo não entra no TanStack Query.** Ele é empurrado pelo WebSocket, e a revisão decide a aplicação: só o estado mais novo é aplicado, e um estado velho é descartado. Uma query de cache não sabe o que é uma revisão, e por isso o estado do jogador não pode morar lá — ele fica no registro global de `entities/team/model/playerStateSync.ts`.

## TanStack Query

Os recursos HTTP de leitura do cliente são cacheados pelo TanStack Query.

> Escolhido porque o que o cliente lê do servidor é o estado do servidor, e o estado do servidor muda por ação do jogador. A query já entrega o que a tela precisa para pedir — o dado, o carregando e o erro — e o pedido que já está em andamento é aguardado em vez de duplicado.

**O que é query.** O catálogo (espécies iniciais, áreas de caça, catálogo da loja) e a lista de treinadores da conta. A chave e o fetcher de cada uma moram em `shared/api/queries/`, e a `staleTime` de cada uma está escrita na própria query: o conteúdo do catálogo muda em deploy, e a lista de treinadores muda por ação do jogador — por isso ela nunca fica velha sozinha, e é invalidada pela mutação que a mudou.

**O que não é query.** O estado vivo do jogo — treinador, time, vida, cooldown, caçada. Ele é empurrado pelo WebSocket, e a revisão decide a aplicação.

> A regra do que é query e do que é store está em [Estrutura](STRUCTURE.md#onde-mora-um-pedido-ao-servidor).

## Supabase Auth

A autenticação é feita pelo Supabase Auth, usado diretamente no cliente. Ele responde por login, cadastro, login via Google, recuperação de senha e pelo controle da sessão.

> Escolhido porque entrega quase tudo o que o [fluxo de autenticação do jogo](../../game/AUTHENTICATION.md) descreve, o que evita manter login, sessão, OAuth e recuperação de senha por conta própria.

O cliente **não valida token algum**: apenas repassa o access token ao servidor, que faz a validação. O servidor trabalha com o **token do próprio Supabase**, e não com um token próprio emitido por ele.

> Usar o SDK do Supabase para falar com o próprio servidor não funciona, e essa confusão é fácil de ter. O `@supabase/supabase-js` conversa com os serviços do Supabase — banco, autenticação, storage, realtime — e não autentica requisições em uma aplicação própria. São duas coisas separadas: o cliente fala com o Supabase Auth, e o servidor valida o token que o cliente recebeu.

Duas partes do fluxo de autenticação não vêm prontas do Supabase e são implementadas por conta própria: o merge da conta Google com uma conta já existente e o controle de tentativas de login.

> Essas regras ficam em um módulo de autenticação do cliente, e não em chamadas ao SDK espalhadas pelo código, para que o fluxo descrito em [Autenticação](../../game/AUTHENTICATION.md) possa ser implementado e testado em um lugar só.

## WebSocket

O cliente se comunica com o servidor por **WebSocket**, usando a API nativa do browser, sem biblioteca intermediária.

O canal é aberto quando o jogador entra no jogo, e fica aberto até a saída. O servidor empurra as atualizações de estado e o cliente responde apenas com comandos. O cliente nunca pergunta o estado num intervalo de tempo.

> A WebSocket foi escolhida porque o servidor precisa iniciar a comunicação: ele avisa que uma criatura desmaiou, que um cooldown terminou ou que um treino terminou, e nada disso acontece em resposta a uma pergunta do cliente.

> O Supabase Realtime foi considerado e descartado como canal do jogo. Ele adiciona um intermediário entre o cliente e o servidor, e a autorização por topic não substitui a validação que o servidor já faz do jogador. O porquê da escolha está em [Stack do Servidor](../server/STACK.md).

**O canal abre com um ticket, e o token do Supabase não viaja na URL.** O cliente pede `POST /api/ws-ticket` e abre `/ws?ticket=<ticket>`. O ticket é de uso único e vale 30 s.

> O motivo é o upgrade do Bun: ele não recebe headers, e o token teria de ir na query string — que qualquer proxy ou balanceador à frente do servidor registra. O ticket carrega a identidade **e** o token, e o servidor revalida o token no Auth server antes de abrir o canal. O que o servidor faz com o ticket está em [Stack do Servidor](../server/STACK.md).

**O protocolo é versionado.** Toda mensagem leva `v`, e uma mensagem de outra versão é recusada com clareza, em vez de ser mal interpretada.

**Os comandos levam `reqId` e recebem `command_result`.** A resposta traz a revisão que o comando produziu e, quando o comando falhou, o código do motivo. O `reqId` é o que correlaciona a falha com o pedido: a mensagem de erro do canal não tem `reqId`, e sem ele o cliente não saberia qual pedido falhou.

**O caminho de mutação é único.** O comando HTTP responde; o estado chega pelo WebSocket, com a revisão. O cliente aplica só a revisão maior e ignora as antigas. Se a revisão do comando não chegar em 2 s, o cliente busca o estado que está faltando em `GET /api/player/state?sinceRev=<rev>`.

**A reconexão é automática.** Quando o canal cai, o cliente abre outro — pedindo um ticket novo a cada tentativa, porque o ticket é de uso único — com espera crescente: base de 1 s, o dobro a cada tentativa, teto de 30 s, e um jitter de ±20 %, para que dois jogadores que perderam a conexão no mesmo segundo não voltem no mesmo milissegundo. São 6 tentativas; depois disso a tela de [conexão perdida](../../game/PLAY_SCREEN.md#estados-da-tela) aparece. O botão "Reconectar" continua existindo e força uma tentativa imediata, zerando a espera.

**A conexão substituída não reconecta.** O código de fechamento `4001` significa que outra conexão mais recente assumiu a conta. O cliente não reabre: duas abas da mesma conta se derrubariam em laço, cada uma reconectando logo depois de a outra fechá-la. Quem fica valendo é a aba mais recente, e a que foi substituída vai para a tela de conexão perdida.

**O cliente observa o silêncio do servidor.** Ele manda `ping` a cada 45 s e considera a conexão morta depois de 100 s sem receber nada. O intervalo do ping é maior que o estrangulamento de timer de uma aba em segundo plano, e o `pong` do servidor é a prova de que o canal vive.

**O relógio do servidor vem no snapshot.** Cada `state_snapshot` carrega `serverNow`, e o cliente corrige o próprio relógio por ele. Nenhum temporizador do cliente tem autoridade sobre o tempo do jogo.

> O token do Supabase não viaja mais pelo canal: ele é conferido só na abertura, e a renovação é do SDK do Supabase, com `autoRefreshToken`. O servidor não renova nada.

## Testes

O cliente usa o runner de testes do Bun, o mesmo do servidor.

> A lógica que decide o que desenhar precisa ficar separada da renderização para poder ser testada, porque o ambiente de teste não tem WebGL e não exercita o canvas.

## Pendências

Os pontos abaixo dizem respeito à stack e ainda estão em aberto:

- O bundle inicial ainda carrega o Chakra inteiro e o conjunto de ícones. A divisão por rota já existe, mas o que é comum a todas as telas continua indo junto.

O formato dos assets, o tamanho do tile e o tamanho da janela de visão não são pendências de stack: são decisões de design do jogo, e pertencem a [Game Design](../../game/GAME.md).
