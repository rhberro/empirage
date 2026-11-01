# Web

Este documento é a porta de entrada para todas as instruções dos agentes que trabalham neste projeto. Tudo o que está aqui obrigatoriamente deve ser seguido pelos agentes, sem exceções.

## Documentações

A tabela a seguir lista todas as documentações disponíveis para consulta pelos agentes. Se estiver com dúvidas e não souber qual documento consultar, pergunte ao usuário qual documentação carregar e não carregue nenhuma automaticamente.

| Documentação | Descrição | Quando consultar | Onde consultar |
| --- | --- | --- | --- |
| Architecture | Definições e padrões de arquitetura, metodologia utilizada e outras definições de pastas e arquivos. | Sempre que for escrever, alterar ou revisar código, antes de criar novos arquivos ou módulos, e diante de qualquer dúvida sobre como algo deve ser escrito ou estruturado. | `apps/web/docs/ARCHITECTURE.md` |

## Validações

### Steiger

O Steiger verifica se o projeto está seguindo os padrões do Feature-Sliced Design e deve obrigatóriamente ser utilizado depois de cada alteração na estrutura do projeto, arquivos, pastas, edição, adição e qualquer outra operação que envolva decisões de arquitetura. Um tarefa nunca é considerada concluida sem as verificações do Steiger, por isso depois de todas essas operações rode `bun run steiger`.

> Se o Steiger encontrar problemas, corrija-os antes de finalizar a tarefa. Não desabilite uma regra ou crie exceções apenas para silenciar o diagnóstico.
