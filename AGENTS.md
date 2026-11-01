# Creatures

Este documento é a porta de entrada para todas as instruções dos agentes que trabalham neste projeto. Tudo o que está aqui obrigatoriamente deve ser seguido pelos agentes, sem exceções.

## Documentações

A tabela a seguir lista todas as documentações disponíveis para consulta pelos agentes. Se estiver com dúvidas e não souber qual documento consultar, pergunte ao usuário qual documentação carregar e não carregue nenhuma automaticamente.

| Documentação | Descrição | Quando consultar | Onde consultar |
| --- | --- | --- | --- |
| Coding Styles | Convenções de código do projeto: padrões de estilo, nomenclatura, organização e boas práticas que o código deve seguir. | Sempre que for escrever, alterar ou revisar código, antes de criar novos arquivos ou módulos, e diante de qualquer dúvida sobre como algo deve ser escrito ou estruturado. | `docs/CODING_STYLES.md` |
| Game Design | Fonte de verdade sobre como o jogo funciona no nível de produto: regras, entidades, mecânicas e opções disponíveis. | Sempre que a tarefa envolver comportamento, regras ou conteúdo do jogo, ou quando houver dúvida sobre alguma mecânica ou regra. | `docs/game/GAME.md` |

## Context7

Sempre que você precisar consultar uma documentação, independente de qual seja o tipo de documentação, você obrigatoriamente deve usar o MCP do Context7 — mesmo que seja uma documentação já conhecida por você, a menos que a informação já tenha sido consultada anteriormente utilizando o MCP do Context7 — seus dados de treinamento podem não refletir a documentação mais recente. Prefira sempre consultar o MCP do Context7 do que qualquer outra forma de consulta, como por exemplo, usar a busca na web.

Esta regra vale somente para documentações externas. As documentações internas do projeto estão na tabela acima.

## Aplicações

A tabela a seguir lista as aplicações disponíveis no projeto, onde encontrar a documentação correspondente e quando consultar cada uma delas.

| Aplicação | Descrição | Quando consultar | Documentação |
| --- | --- | --- | --- |
| Web | A aplicação web que o jogador utiliza para interagir com o jogo. | Quando precisar de informações sobre a interface do usuário. | `apps/web/README.md` |
| Servidor | O servidor que gerencia as conexões e a lógica do jogo. | Quando precisar de informações sobre o servidor. | `apps/server/README.md` |

## Comandos

O gerenciador de pacotes é o `bun`, não use `npm`, `yarn` ou `pnpm`.

### Instalar Dependências

Para instalar as dependências do projeto, execute o seguinte comando:

```
bun install
```

### Inicialização

Para iniciar ambas as aplicações (web e servidor), execute o seguinte comando:

```
bun run dev
```

## Testes

Nunca escrever testes automatizados incluindo testes unitário, integração e end-to-end, em nenhuma aplicação, em nenhum momento.

## Pós-edição

O que fazer (e o que não fazer) depois de alterar código, antes de declarar a tarefa concluída e antes de iniciar a validação visual.

### Setup

Antes de rodar os scripts que iniciam o web ou o servidor, verifique se eles já estão em execução consultando a disponibilidade das portas que utilizam. Se estiverem, reutilize o processo existente. Não inicie outro em uma porta diferente.

### Formatação

Depois de usar `write` ou `edit` em arquivos de código (`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`), rode nos arquivos alterados, nesta ordem:

1. `bun run format`
2. `bun run lint:fix`
3. `bun run lint`

Se ainda restarem erros de lint, corrija-os. Não pule esta etapa mesmo que o pre-commit hook rode no commit: o objetivo é evitar ciclos de retrabalho.

> Nunca alterar regras de formatação ou linting sem antes questionar o usuário e confirmar a modificação.

### Validação

Faça a validação visual (navegação, interação e conferência do resultado) com a skill `agent-browser`. Use o MCP do `chrome-devtools` apenas como fallback, quando a skill não estiver disponível ou falhar.

## Respostas

### Linguagem

Responda sempre em Português, o código gerado é sempre em Inglês (incluindo comentários).

### Resumo

Ao final de cada execução, você obrigatoriamente deve informar o que foi utilizado, no formato abaixo. Liste apenas os itens que realmente foram usados e omita as categorias vazias.

```
O que eu utilizei durante a execução:

- Documentações
  - <caminho do documento interno>
    - <caminho do sub-documento interno>
    - <caminho do sub-documento interno>
- MCPs
  - <nome do MCP>
- Skills
  - <nome da skill>
```

Não liste operações básicas de leitura e edição de arquivos nem comandos de terminal comuns. Se você não usou nenhum MCP, skill nem documentação, responda apenas: "Execução sem ferramentas."
