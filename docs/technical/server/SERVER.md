# Servidor

Este documento é a porta de entrada da documentação técnica do servidor. Ele indica onde está cada detalhe.

> O servidor vive em `apps/server`. Ele é **a única fonte de verdade do jogo**: toda a simulação acontece aqui, conforme descrito na [Arquitetura](../ARCHITECTURE.md).

## Documentações

| Documentação | Descrição | Quando consultar | Onde consultar |
| --- | --- | --- | --- |
| Stack | As tecnologias escolhidas para o servidor, com as decisões e os motivos por trás de cada uma. | Antes de escrever código do servidor, ao adicionar uma dependência, ou diante de dúvida sobre qual biblioteca usar e por quê. | `docs/technical/server/STACK.md` |
| API de Treinadores | API HTTP para criar, listar, editar e deletar treinadores, a rota de merge Google, a sessão do jogador e o WebSocket do jogo. Cobre o roteador próprio, middleware de auth, a persistência no Postgres, a RPC de criação, os contratos e os testes. | Quando for criar, alterar ou depurar endpoints de trainer, o roteador HTTP do servidor, a persistência ou o canal do jogo. | `docs/technical/server/TRAINERS.md` |
| A Caçada | A caçada jogável no servidor: o motor determinístico, o runtime em memória, o conteúdo das áreas, o checkpoint em `simulation_state`, as rotas de `/api/hunts`, o canal WebSocket e os motivos de fim. | Quando for criar ou alterar a simulação da caçada, o runtime, a sessão, as rotas, os comandos ou as mensagens de caçada. | `docs/technical/server/HUNT.md` |
| Mundo | O domínio de mundo no servidor: o mapa commitado, o pathfinding em oito direções, o registro em memória dos atores, a régua do `move`, o broadcaster leve e a costura com o WebSocket. | Quando for criar ou alterar o movimento, o mapa da cidade, o pathfinding, o estado em memória dos atores ou as mensagens de mundo do canal. | `docs/technical/server/WORLD.md` |
