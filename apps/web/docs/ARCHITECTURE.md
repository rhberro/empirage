# Arquitetura

Este documento cobre todo o processo de criação de modulos, arquivos ou pastas, como organiza-los, onde cria-los e qual nome se deve utilizar.

## Feature-Sliced Design

Utilizamos a métodologia de arquitetura Feature-Sliced Design e você deve segui-la a risca. Se houver dúvidas ou precisar sair dos padrões definidos pla metódologia você deve confirmar se pode ser feito com o usuário.

Temos a disposição a skill `feature-sliced-design` que deve ser utilizada sempre que necessário decidir sobre onde e como criar, mover e nomear arquivos e qualquer outra decisão arquitetural. Caso a skill não seja o suficiente, você pode em últimao caso, somente em último caso, consultar as instruções em formato de texto feita especialmente para agentes [aqui](https://fsd.how/llms-small.txt).

### Widgets

Como recomendado pela documentação oficial, o uso da camada `widgets` está desencorajado e nunca deve ser utilizado.

### Processes

Assim como [widgets](#widgets) a camada `processes` nunca deve ser utilizada pois está depreciada. A versão atual recomenda utilizar as camadas `features` e `app`.
