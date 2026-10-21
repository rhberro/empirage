# Stack do Servidor

Este documento lista as tecnologias escolhidas para o servidor, o motivo de cada escolha e o que elas obrigam a fazer.

> O servidor vive em `apps/server`. Ele é **a única fonte de verdade do jogo**: toda a simulação acontece aqui, conforme descrito na [Arquitetura](../ARCHITECTURE.md). O cliente recebe o estado e o exibe, mas não altera nada.

## Stack

| Tecnologia | Papel |
| --- | --- |
| Bun | Runtime, servidor HTTP e servidor WebSocket |
| TypeScript | Tipagem do código, no cliente e no servidor |
| pino | Logs estruturados |
| Supabase | Autenticação, banco de dados e validação de token |
| Zod | Validação dos corpos das requisições |
| Contratos compartilhados | Tipos de input e output usados pelo cliente e pelo servidor |
| WebSocket | Comunicação com o cliente durante o jogo |

## Bun

O Bun é o runtime do servidor, o gerenciador de pacotes e o runner de testes do projeto.

> Não se usa `npm`, `yarn` nem `pnpm`. Um único gerenciador de pacotes em todo o projeto, com um lockfile só.

O mesmo runner de testes cobre o cliente e o servidor, o que faz o teste de uma regra de negócio não exigir configuração separada da aplicação onde ela vive.

## TypeScript

Todo o código é TypeScript, no cliente e no servidor.

> Escolha feita uma única vez para o projeto inteiro. Não há JavaScript sem tipagem, nem em configuração de build.

A tipagem é especialmente importante no servidor, porque é onde vive a simulação. As regras do jogo são funções puras que recebem um estado e devolvem um novo estado, e os tipos são o que garantem que o estado do servidor continue coerente ao longo de uma partida.

## pino

Os logs do servidor são feitos com o pino, em formato estruturado.

> Escolhido porque log em JSON é pesquisável e agregável, e um log de texto livre exige parser para ser útil. Em servidor, sem isso, diagnosticar um erro em produção vira trabalho manual.

> Não se usa `console.log` em código de servidor. A exceção é depuração local rápida, que é removida antes do commit.

## Supabase

O servidor usa o Supabase para três coisas: validar o token do jogador, ler e escrever no banco de dados, e detectar sessão revogada.

> Escolhido porque o mesmo projeto já cuida da autenticação no cliente, e ter um único lugar para identidade, banco e sessão evita a parte mais cara de manter dois sistemas: a consistência entre eles.

### Validação de Token

O servidor trabalha com o **access token do próprio Supabase**. Não existe token emitido pelo servidor, e o servidor não renova nada.

> O token chega do cliente e é validado aqui. Isso mantém uma única fonte de verdade sobre quem é o jogador: o Supabase Auth.

O `@supabase/supabase-js` roda no servidor e é ele que faz a validação, usando as chaves do próprio projeto.

> Usar o SDK do Supabase para falar com o servidor da aplicação própria não funciona, e essa confusão é fácil de ter. O SDK conversa com os serviços do Supabase — banco, autenticação, storage, realtime. Ele não é um mecanismo de autenticar requisições em uma aplicação própria.

**A validação tem duas formas, e o servidor usa as duas em lugares diferentes.**

- **Nas chamadas REST**, o servidor valida localmente com `getClaims()`, que confere assinatura e expiração sem nenhuma chamada de rede.
- **Na abertura do canal**, o servidor revalida o token no Auth server, com `getUser()`, que consulta o Auth server e devolve o registro canônico do usuário. O token chega ao canal **dentro do ticket de uso único**, e nunca na URL.

> A distinção importa porque o token continua válido mesmo depois que a sessão por trás dele é encerrada. O fluxo de [Autenticação](../../game/AUTHENTICATION.md) exige que encerrar sessão em um lugar invalide o acesso em todos os outros — o merge da conta Google e a redefinição de senha fazem isso. Só o `getUser()` detecta a revogação, e é por isso que ele é chamado na abertura do canal. Uma validação só no início é o suficiente: enquanto a partida dura, nenhuma regra do jogo encerra a sessão do jogador.

**A revalidação acontece no upgrade, e é ela que fecha a janela do ticket.** O ticket viaja dentro da URL do upgrade, e o token viaja dentro do ticket: o upgrade consome o ticket e revalida o token no Auth server antes de abrir o canal. Token inválido ou expirado recusa o upgrade com `401`, e o handshake falha — o navegador abre e fecha o socket sem nunca ter conversado. O custo é uma chamada de rede por abertura de canal, o mesmo do código anterior.

**O token é conferido uma vez.** Na API REST, a cada requisição. No canal, só na abertura: as mensagens seguintes são atendidas com o `userId` registrado na conexão, sem uma nova validação.

> A revalidação por mensagem e o encerramento do canal quando o token deixa de valer ainda não foram implementados. O desenho é que o servidor recuse o token velho e feche a conexão, e o cliente reaja com a tela de [conexão perdida](../../game/PLAY_SCREEN.md#estados-da-tela). A renovação é responsabilidade do cliente, que acompanha a validade do token; o servidor não renova nada.

### Banco de Dados

O estado do jogo é lido e escrito no Postgres do Supabase, pelo mesmo SDK.

> O servidor usa a chave de serviço, que tem permissão total, e nunca a expõe ao cliente. O cliente só fala com o Supabase Auth.

**O que existe no banco hoje.** O schema está aplicado no Supabase hospedado, com as migrations versionadas em `supabase/migrations/` e o catálogo inicial em `supabase/seed.sql`. Todas as tabelas são **deny-by-default**: RLS ligado, `anon` e `authenticated` sem grant e sem policy, e só o `service_role` — que ignora RLS — enxerga os dados. O servidor é o único caminho de escrita.

O que está persistido é a **conta e o treinador**: espécies, habilidades, itens, treinadores, criaturas, o inventário do treinador, a carga da barra de habilidades (os slots de habilidade de cada criatura e os slots de consumível e de dispositivo do treinador), a vida restante das criaturas e o catálogo de áreas de caça. A criação de treinador é uma RPC transacional, que grava o treinador e a criatura inicial na mesma transação — o motivo está em [API de Treinadores](TRAINERS.md#a-rpc-de-criação). As operações de time também são transações no Postgres, porque trocar a ordem do time toca em mais de uma linha de uma vez — o motivo está em [API de Treinadores](TRAINERS.md#as-funções-de-time).

> **O estado de jogo ainda não existe.** Não há ciclo de avanço de tempo, nem estado de jogo em memória para persistir. A pergunta "como o estado em memória é persistido, e com que frequência" tem a seguinte resposta honesta: hoje não há estado de jogo em memória para persistir, e o que o Postgres guarda é a conta e o treinador, escritos em tempo real, a cada requisição que altera algo. A resposta definitiva depende do desenho do ciclo de simulação, que ainda não foi feito.
>
> O que existe é a **fundação** da caçada: uma função de avanço pura e determinística, e a sessão da caçada com o cursor que permite retomá-la. Não há rota que a use, e nada a executa. Está em [A Caçada](HUNT.md).

Uma conta pode ter um treinador conectado por vez. Quando uma segunda conexão chega para o mesmo jogador, a anterior é derrubada.

> O [fluxo de autenticação](../../game/AUTHENTICATION.md) e a [tela do jogo](../../game/PLAY_SCREEN.md) exigem que a sessão anterior seja derrubada ao entrar com o mesmo treinador em outra aba ou dispositivo. Isso é controle do servidor, porque o servidor é quem sabe quem está conectado.

## WebSocket

O servidor atende WebSocket com a API nativa do Bun, sem biblioteca intermediária.

> Escolhido porque o Bun já traz servidor WebSocket embutido, com upgrade de conexão e envio e recebimento de mensagens no mesmo `Bun.serve` que serve o HTTP. Adicionar uma biblioteca seria trocar algo que já existe por algo que ainda precisaria ser configurado.

O canal é aberto quando o jogador entra no jogo, e fica aberto até a saída. O desenho é que o servidor empurra as atualizações de estado e receba apenas comandos.

> A WebSocket foi escolhida porque o servidor precisa iniciar a comunicação: ele avisa que uma criatura desmaiou, que um cooldown terminou ou que um treino terminou, e nada disso acontece em resposta a uma pergunta do cliente.

**O canal já existe.** Ele é aberto em `/ws`, com um **ticket de uso único** na query string (`?ticket=`), e a validação do token, a regra de uma conexão por conta e as mensagens trocadas estão descritas em [API de Treinadores](TRAINERS.md#websocket).

> O token do Supabase **não** viaja na query string. O upgrade do Bun não recebe headers, e um JWT na query string é registrado por qualquer proxy ou balanceador à frente do servidor. O cliente pede `POST /api/ws-ticket`, que devolve um ticket opaco, de uso único, válido por 30 s, com a identidade e o token dentro. O upgrade consome o ticket e revalida o token no Auth server: token inválido ou expirado recusa o upgrade com `401`, e o handshake falha. O ticket nunca é logado.

**A revisão do estado.** O `PlayerState` carrega `rev`, `epoch` e `serverNow`. O `rev` é monotônico **por conta**, dentro de um `epoch`, que é o identificador do boot do processo. O `epoch` existe porque o contador vive na memória: um restart do servidor zera o contador, e um cliente que comparasse só a revisão recusaria todo snapshot novo e ficaria congelado num estado obsoleto. O `state_snapshot` carrega os três.

**O fallback.** `GET /api/player/state?sinceRev=<n>` devolve o estado completo quando o estado atual é mais novo que `n`, e **204** quando o estado atual já está na revisão pedida.

**Os códigos de fechamento.**

| Código | Significado |
| --- | --- |
| `1000` | Encerramento normal, inclusive a desconexão do treinador, que o `DELETE /api/session/trainer` dispara fechando o canal |
| `4001` | A conexão foi substituída por outra mais recente |

> A entrada num treinador (`POST /api/session/trainer`) derruba a conexão anterior da conta com o `4001`, e a saída (`DELETE /api/session/trainer`) fecha o canal com o `1000`.

**A vivacidade é do servidor.** O Bun manda ping de protocolo (`sendPings`), e o `idleTimeout` de 120 s fecha a conexão que ficou ociosa. O `pong` de protocolo do Bun não chega no evento `message` do browser — ele tem o seu próprio handler, e é lá que o servidor marca a conexão como viva. Uma varredura a cada 30 s fecha as conexões silenciosas há mais de 120 s: o servidor não confia só no timer do runtime.

**A idempotência.** `POST /api/store/buy` e `POST /api/store/sell` aceitam o header `Idempotency-Key`. A chave é **reservada** antes de a operação rodar, de modo que dois pedidos da mesma chave em voo não cobrem duas vezes: o segundo recebe `409` com `store_request_in_flight`. A chave é liberada quando o pedido é recusado **sem ter rodado** — corpo inválido, ausência da sessão do treinador, ou recusa do banco —, para que uma retentativa possa tentar de novo.

> A chave **não** é liberada quando a operação **lança** exceção: pode ter havido cobrança no banco, e liberar a chave ali abriria a cobrança dupla. Nesse caso a chave sai pela janela de dez minutos, e uma retentativa com a mesma chave recebe o mesmo resultado.

O estado de um jogador fica no processo que atendeu a conexão dele.

> Isso é o que torna a regra da conexão única simples de cumprir: o servidor mantém o registro de quem está conectado, e uma nova conexão para o mesmo jogador encontra e fecha a anterior. A origem dessa regra está na [tela do jogo](../../game/PLAY_SCREEN.md).

> Isso vai mudar: a caçada sobrevive à conexão, e o estado do jogador vai virar um estado em memória com checkpoint no banco. É a pendência registrada abaixo.

O servidor distingue o que é comando, que vem do cliente, do que é atualização de estado, que ele mesmo produz.

> Comandos nunca alteram o estado diretamente: são validados e aplicados pelas mesmas regras que avançam a simulação. É isso que garante que o cliente não consiga sair do que as [regras do jogo](../../game/GAME.md) permitem.

**O que o canal ainda não faz.** Não existe simulação de jogo: o canal abre a sessão do treinador, empurra o retrato do estado depois de cada comando, e nada mais. Os comandos de jogo — as ações que só existem dentro de uma caçada — e o ciclo de simulação são o marco do gameplay, e ainda não foram escritos. O envelope do protocolo já os comporta, e o servidor recusa um comando de caçada com `invalid_command`.

## Simulação

A simulação é executada por um ciclo do servidor, que avança o estado do jogo com o passar do tempo.

> **A simulação ainda não existe.** Esta seção descreve o desenho que a stack pressupõe; o ciclo de simulação é o marco do gameplay e ainda não foi escrito. Hoje o servidor persiste a conta e o treinador no Postgres, e o estado que entrega ao cliente é lido do banco a cada requisição.
>
> A **fundação** da caçada já está escrita: a função de avanço é pura e determinística, e a sessão da caçada guarda o cursor que permite retomá-la. O que falta é o ciclo que a chama e a rota que a inicia. Está em [A Caçada](HUNT.md).

> O servidor é a única fonte de verdade porque é o único que sabe o tempo do jogo. O cliente não tem relógio próprio para nada que afete o estado, e nenhum temporizador do cliente tem autoridade sobre nada.

Quando o jogador fecha o jogo, a simulação do treinador continua, se a atividade permitir.

> Essa é a razão do servidor manter o estado em memória e persistir no banco: uma atividade que pode continuar sem o jogador precisa continuar rodando sem conexão nenhuma. O que isso exige do ciclo de simulação ainda não foi definido.

Os tipos das mensagens trocadas entre cliente e servidor são compartilhados pelos dois lados, em `apps/shared/contracts/game.ts`.

> Os tipos do protocolo são a documentação do contrato entre as aplicações e ficam num lugar acessível por ambas. O que cada mensagem significa para o jogo está em [Game Design](../../game/GAME.md).

## Testes

O servidor usa o runner de testes do Bun, o mesmo do cliente.

> As regras do jogo são funções puras, sem estado global e sem dependência de rede, o que as torna testáveis sem subir servidor nem banco. Essa é a razão de a simulação ser descrita assim, e não como uma consequência que convenha depois.

O que já roda contra o Postgres de verdade é a suíte de integração, em `apps/server/src/__tests__/integration/`: ela cria usuários de teste no Supabase Auth, escreve no banco e limpa tudo no fim. A suíte só roda com a variável `CREATURES_TEST_DB=1`, porque ela mexe no banco real.

> `CREATURES_TEST_DB=1 bun run test:integration`

## Pendências

Os pontos abaixo dizem respeito à stack e ainda estão em aberto:

- **O estado de jogo não existe.** O que o servidor persiste hoje é a conta e o treinador, no Postgres, em tempo real. O que o ciclo de simulação vai persistir — e com que frequência — depende do desenho do ciclo, que ainda não foi feito. A **fundação** da caçada — a função de avanço e a sessão com o cursor — já existe e está em [A Caçada](HUNT.md).
- **O estado do jogador é reconstruído do banco a cada push.** A caçada vai sobreviver à conexão, e o estado do jogador vai virar um estado **em memória com checkpoint no banco**, retomado no boot do servidor. É a Fase 2 do [plano da camada de tempo real](../../../plans/PLAN.md). Hoje o `rev`, o registro das conexões e a sessão do treinador são mapas na memória do processo: um restart zera o contador de revisões, e é por isso que o `epoch` existe.
- **O rate limit é por processo.** O contador das tentativas falhas mora na memória do processo, como a sessão do treinador e o registro das conexões. Com mais de uma instância, cada uma conta só as tentativas que ela viu, e o limite enfraquece na proporção do número de instâncias. A regra está em [Rate Limit](TRAINERS.md#rate-limit).

Decisões que afetam a estrutura do servidor e ainda não foram tomadas:

- Como o servidor se comporta com mais de uma instância, já que o estado de um jogador fica no processo dele. Hoje o registro do treinador ativo, o registro das conexões e o contador do rate limit são mapas na memória do processo: não sobrevivem a um reinício e não são compartilhados. Enquanto a decisão não sai, o servidor sobe em instância única, como manda o [runbook](../DEPLOY.md#o-que-ainda-não-está-pronto-para-o-público).
- Como a cidade agrupa os jogadores em instâncias, e como a presença de outros jogadores aparece para quem está em outro processo.
- Qual a frequência do ciclo de simulação.
