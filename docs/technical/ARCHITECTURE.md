# Arquitetura

Este documento é a porta de entrada da documentação técnica do projeto. Ele descreve como o Creatures está dividido, o que pertence a cada aplicação e onde estão os detalhes de cada uma.

> A documentação técnica responde **como o projeto é construído**. O que o jogo faz — suas regras, mecânicas e conteúdo — está em [Game Design](../game/GAME.md).

## Divisão do Projeto

O Creatures é composto por duas aplicações independentes que se comunicam entre si:

- **Cliente** (`apps/client`): aplicação web que o jogador utiliza. Renderiza o estado do jogo, recebe as interações do usuário e as comunica ao servidor.
- **Servidor** (`apps/server`): responsável por toda a simulação do jogo. Processa e valida as ações do cliente e é a única fonte de verdade do estado.

## Responsabilidades

| Responsabilidade | Cliente | Servidor |
| --- | --- | --- |
| Renderização | Renderiza o mundo do jogo, a interface e o estado recebido | — |
| Interação do usuário | Captura cliques e teclas e as transforma em comandos | — |
| Estado do jogo | Apenas exibe o estado recebido, nunca o altera por conta própria | Calcula, mantém e distribui o estado do jogo |
| Validação | Valida apenas o formato da entrada antes de enviá-la | Valida se a ação é permitida e aplica as regras do jogo |
| Regras e mecânicas | Nenhuma decisão de gameplay | Todas as regras, mecânicas e computações |
| Persistência | Não guarda dados do jogo | Persiste o estado da conta e do treinador |
| Conexão | Mantém o canal e, ao perdê-lo, reabre sozinho, com espera crescente e um limite de tentativas | Mantém as conexões ativas, fecha as que ficaram mudas e derruba a anterior quando a conta abre outra |

> A regra que resume a tabela: **o cliente mostra, o servidor decide.** Se a resposta muda ao desligar o servidor, ela é do servidor.

## Índice

| Documento | Descrição | Quando consultar | Onde consultar |
| --- | --- | --- | --- |
| Cliente | Arquitetura da aplicação cliente: estrutura interna, stack e responsabilidades de cada módulo. | Quando for criar ou alterar código do cliente, ou dúvida sobre onde uma responsabilidade pertence. | `docs/technical/client/CLIENT.md` |
| Servidor | Arquitetura da aplicação servidora: estrutura interna, stack, persistência e simulação. | Quando for criar ou alterar código do servidor, ou dúvida sobre como uma ação é processada. | `docs/technical/server/SERVER.md` |
| Deploy | Como subir o projeto: variáveis de ambiente, banco de dados, scripts e o que verificar depois. | Quando for preparar uma publicação ou um ambiente de produção. | `docs/technical/DEPLOY.md` |

## Documentos Relacionados

- [Game Design](../game/GAME.md) — as regras e mecânicas do jogo.
- [Coding Styles](../CODING_STYLES.md) — convenções de escrita de código.
- [Plano da camada de tempo real](../../plans/PLAN.md) — o plano da camada de tempo real: o que a revisão do código encontrou, as decisões que valem para a documentação e o que ainda está em aberto. É um **plano**, não a documentação do que existe: quando o código e o plano divergirem, quem manda é o código.
