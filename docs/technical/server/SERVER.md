# Servidor

Este documento é a porta de entrada da documentação técnica do servidor. Ele indica onde está cada detalhe.

> O servidor vive em `apps/server`. Ele é **a única fonte de verdade do jogo**: toda a simulação acontece aqui, conforme descrito na [Arquitetura](../ARCHITECTURE.md).

## Documentações

| Documentação | Descrição | Quando consultar | Onde consultar |
| --- | --- | --- | --- |
| Stack | As tecnologias escolhidas para o servidor, com as decisões e os motivos por trás de cada uma. | Antes de escrever código do servidor, ao adicionar uma dependência, ou diante de dúvida sobre qual biblioteca usar e por quê. | `docs/technical/server/STACK.md` |
| API de Treinadores | API HTTP para criar, listar, editar e deletar treinadores, a rota de merge Google, a sessão do jogador e o WebSocket do jogo. Cobre o roteador próprio, middleware de auth, a persistência no Postgres, a RPC de criação, os contratos e os testes. | Quando for criar, alterar ou depurar endpoints de trainer, o roteador HTTP do servidor, a persistência ou o canal do jogo. | `docs/technical/server/TRAINERS.md` |
| A Caçada | A fundação determinística da caçada no servidor: a tabela `hunt_sessions`, o cursor da simulação, o gerador reprodutível e a função pura de avanço, com o que ainda não existe. | Quando for criar ou alterar a simulação da caçada, a tabela da sessão, o cursor ou o determinismo. | `docs/technical/server/HUNT.md` |
