# Cliente

Este documento é a porta de entrada da documentação técnica do cliente. Ele indica onde está cada detalhe.

> O cliente vive em `apps/client`. Ele **não decide nada sobre o jogo**. Toda a simulação acontece no servidor, conforme descrito na [Arquitetura](../ARCHITECTURE.md).

## Documentações

| Documentação | Descrição | Quando consultar | Onde consultar |
| --- | --- | --- | --- |
| Estrutura | Como o código do cliente está organizado: as camadas do FSD, onde cada tipo de código mora, a API pública de uma fatia e a regra de dependência. | Antes de criar um arquivo, uma fatia ou uma camada, e diante de dúvida sobre onde o código deve morar. | `docs/technical/client/STRUCTURE.md` |
| Stack | As tecnologias escolhidas para o cliente, com as decisões e os motivos por trás de cada uma. | Antes de escrever código do cliente, ao adicionar uma dependência, ou diante de dúvida sobre qual biblioteca usar e por quê. | `docs/technical/client/STACK.md` |
| Design System | Os tokens do design system, a direção visual e as regras de uso da interface. | Antes de criar ou alterar qualquer elemento visual, e diante de dúvida sobre cor, tipografia, espaçamento ou estado. | `docs/technical/client/DESIGN_SYSTEM.md` |
| Formulários | Como o estado de um campo mora, quando o erro aparece e como o envio trata a espera. | Antes de criar, alterar ou depurar qualquer formulário do cliente. | `docs/technical/client/FORMS.md` |
| Autenticação | Arquitetura técnica do módulo de autenticação no cliente: máquina de estados, store, adapter, roteamento protegido e fluxos. | Quando for criar, alterar ou depurar código relacionado a sessão, login, signup, OAuth ou recuperação de senha no cliente. | `docs/technical/client/AUTH.md` |
| Mundo | O canvas do mundo renderizado: a fatia `entities/world`, a cena da caçada em `entities/hunt`, o modelo puro e a camada PixiJS, o pipeline de assets procedurais, o desenho do chão e dos atores, a câmera, o ciclo de vida e os protocolos de mundo e de caçada. | Quando for criar, alterar ou depurar a renderização do mundo ou da caçada, o movimento do treinador, os assets do mundo ou as mensagens de mundo e de caçada no cliente. | `docs/technical/client/WORLD.md` |
