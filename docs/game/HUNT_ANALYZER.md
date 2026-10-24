# Analisador de Caçada

Este documento cobre os painéis da caçada, no canto superior esquerdo da tela durante a caçada: o painel da sessão, com o local, os tempos e o botão de finalizar, e a análise da sessão, com os números e os itens da caçada.

> Este documento cobre **os painéis da caçada**. A atividade da caçada em si está em [Caçada](HUNT.md), e a tela de onde os painéis fazem parte é a [Tela do Jogo](PLAY_SCREEN.md).

## Visão Geral

Os painéis ficam no canto superior esquerdo da [tela do jogo](PLAY_SCREEN.md#painéis-da-caçada), logo abaixo da toolbar, e existem só durante a caçada. Eles são flutuantes: ficam por cima do canvas, sem empurrá-lo, como a barra de habilidades. Na cidade eles não existem.

Os dois painéis são um módulo só e aparecem juntos, um sobre o outro:

- **Painel da sessão:** mostra onde o treinador está caçando, há quanto tempo e por quanto tempo ainda pode ficar, e tem o botão **Finalizar Caçada**.
- **Análise da sessão:** mostra os números da caçada e o que ela rendeu e gastou até agora. Pode ser recolhida em uma única linha.

## Mockup

![Mockup do analisador de caçada](../assets/hunt_analyzer.png)

![Mockup do analisador de caçada recolhido](../assets/hunt_analyzer_closed.png)

> O mockup é ilustrativo e mostra a disposição geral, não o design final. Ele serve para conferir a estrutura da tela, não cores, tipografia ou espaçamento.

O mockup mostra os dois painéis abertos. O painel da sessão traz o local (Planices), o tempo decorrido, o tempo restante e o botão Finalizar Caçada. A análise traz as quatro estatísticas no topo e, abaixo delas, as seções de ganhos, gastos e criaturas, com os slots agrupados mostrando as quantidades, e a barra de rolagem sempre visível na lateral direita da área das seções.

O segundo mockup mostra a análise recolhida: ela fica em uma única linha com o título **Análise da Sessão** e um **+**, que a expande de novo, enquanto o painel da sessão segue visível e inteiro.

## Estrutura

### Painel da Sessão

O painel da sessão mostra três informações sobre a caçada em andamento:

- **Local:** o nome da área onde o treinador está caçando.
- **Tempo:** o tempo decorrido desde o início da caçada.
- **Restante:** o tempo que o treinador ainda pode ficar caçando antes de a [sessão offline](TRAINER.md#sessão-offline) acabar e ele ser expulso automaticamente. O total depende do tipo de conta — 4 horas para a conta gratuita e 8 para a paga —, então um treinador de conta gratuita com 30 minutos de caçada vê 03:30:00, e um de conta paga na mesma situação vê 07:30:00.

No rodapé do painel fica o botão **Finalizar Caçada**, que encerra a caçada.

#### Finalizar a Caçada

Clicar em **Finalizar Caçada** começa uma contagem de **5 segundos**, a mesma da entrada em uma área. Durante a espera o botão fica desabilitado e o rótulo muda para **Finalizando caçada em 5**, contando até **Finalizando caçada em 1**. O painel não sai do lugar durante a espera: ele fica visível com o botão desabilitado, e a tela só muda quando a contagem termina.

Quando a contagem chega a zero, a [tela de carregamento](PLAY_SCREEN.md#estados-da-tela) é exibida e o treinador segue para a cidade, como em qualquer troca de área.

> A contagem fica no próprio botão, que já é o lugar onde o jogador está olhando, e segue a mesma regra da [entrada na caçada](HUNT_AREA_SELECT.md#iniciar-caçada): uma tela de espera separada esconderia a ação que o jogador acabou de tomar.

> A caçada não pausa durante a contagem. O jogo continua rodando até a tela de carregamento entrar, conforme a regra da [tela do jogo](PLAY_SCREEN.md).

> A demora existe para que a saída não seja imediata: um jogador que entra e sai de uma área em segundos consegue escapar de uma situação imprevisível, como uma criatura desmaiando.

### Análise da Sessão

A análise tem três partes: as estatísticas, sempre visíveis, e as seções de ganhos, gastos e criaturas capturadas, que ficam juntas em uma área rolável.

#### Estatísticas

As estatísticas mostram quatro números da sessão:

- **Experiência / hora** e **experiência total:** a experiência que a criatura ativa ganhou na sessão, no ritmo por hora e no total, conforme as regras de [experiência das criaturas](TRAINER.md#experiência-das-criaturas). O total vem do ledger da simulação, e a taxa por hora é o total dividido pelo tempo decorrido da sessão, em horas.
- **Abates / hora** e **abates totais:** as criaturas selvagens derrotadas na sessão, no ritmo por hora e no total. O total também vem do ledger da simulação, e a taxa por hora usa o mesmo tempo decorrido.

> Por enquanto são só essas quatro informações. A análise é o painel que mais vai crescer, e novas contas e estatísticas entram nela conforme o jogo evolui.

> As taxas por hora podem ser calculadas a qualquer momento sobre o tempo decorrido, então elas sobem e descem durante a caçada, em vez de esperar o fim da sessão.

#### Ganhos

A seção **Ganhos** lista os itens que as criaturas droparam durante a sessão. Itens iguais são agrupados em um slot só, com a quantidade na label: 150 unidades do mesmo item aparecem como um slot com 150, e não como 150 slots. A lista vem do ledger da simulação, que registra cada drop no abate.

#### Gastos

A seção **Gastos** lista os itens consumidos durante a sessão, no mesmo formato de slots agrupados. Por enquanto, os gastos são os itens de cura usados pela criatura ativa, também vindos do ledger da simulação. Dispositivos de captura não entram porque a captura está fora de escopo nesta fase, e novos tipos de item entram na seção conforme o jogo cresce.

#### Criaturas Capturadas

A seção **Criaturas** lista as criaturas capturadas durante a sessão, no mesmo formato das seções de itens: criaturas iguais ficam em um slot só, com a quantidade na label, então 56 criaturas iguais capturadas aparecem como um slot com 56.

> Nesta fase a captura está fora de escopo, então a seção fica vazia. Ela existe para quando a captura estiver em jogo.

#### Rolagem

A área que tem as três seções — ganhos, gastos e criaturas capturadas — é a única parte rolável do painel. As estatísticas e o painel da sessão ficam fixos, e a rolagem não muda o tamanho do painel, conforme a convenção de [tamanho fixo](INTERFACE.md#tamanho-fixo).

Uma barra de rolagem fica fixa na lateral direita da área rolável, sempre visível, mesmo quando o conteúdo cabe.

> A [barra de rolagem](INTERFACE.md#barra-de-rolagem) sempre visível vale para toda área rolável do jogo.

#### Recolher e Expandir

O título da análise tem um ícone de negativo (−) na direita. Clicar nele recolhe a análise em uma única linha com o título, e o ícone vira um (+), que a expande de novo.

O recolhimento vale só para a análise: o painel da sessão, com o local, os tempos e o botão Finalizar Caçada, segue inteiro.

> O jogador que quer só o básico recolhe a análise e ganha a tela de volta, e quem quer os números os tem a um clique. O painel da sessão não some porque o tempo e a saída da caçada importam o tempo todo.

## Comportamento

Os painéis são flutuantes e existem só durante a caçada: aparecem quando a caçada começa e somem quando ela acaba, e não existem na cidade.

> Os painéis seguem a regra da [tela do jogo](PLAY_SCREEN.md): nenhum elemento flutuando sobre o canvas o empurra ou o bloqueia, e o jogo continua rodando com eles abertos.

Se a conexão com o servidor cai, os painéis são fechados junto com o restante da tela.

> Isso acontece por consequência da regra de [conexão da tela do jogo](PLAY_SCREEN.md#estados-da-tela): ao perder a conexão, o cliente sai da tela do jogo e exibe a tela de conexão perdida. Não é preciso nenhum tratamento específico para esse caso.

## Escopo das Fases Alfa e Beta

Os pontos abaixo ainda estão em aberto ou são provisórios nesta fase e devem ser revistos conforme o jogo evolui:

- A análise tem apenas as quatro estatísticas definidas. Novas contas e estatísticas entrarão nela.
- Os gastos cobrem apenas itens de cura. Dispositivos de captura não entram porque a captura está fora de escopo nesta fase, e novos tipos de item entram na seção conforme o jogo cresce.
- A seção de criaturas capturadas fica vazia enquanto a captura estiver fora de escopo.

## Pendências

Os pontos abaixo ainda não foram decididos:

- Se as seções de ganhos, gastos e criaturas exibem slots vazios quando a sessão não tem nada nelas.
