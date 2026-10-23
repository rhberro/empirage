# Interface

Este documento cobre as convenções de interface do jogo: os comportamentos que os elementos da tela compartilham, como popup, tamanho de modais e barra de rolagem.

> Este documento cobre **a interface como um todo**. A tela do jogo e seus elementos estão em [Tela do Jogo](PLAY_SCREEN.md), e cada superfície — [mochila](BACKPACK.md), [armazenamento](STORAGE.md), [analisador de caçada](HUNT_ANALYZER.md) e as demais — tem documento próprio. Cada superfície descreve o que ela exibe; aqui fica como esses elementos se comportam.

## Visão Geral

A interface do jogo é uma só, para desktop e celular. O conteúdo é o mesmo em qualquer tamanho de tela, e o que muda é o tamanho dos elementos dentro de um limite, em vez de uma versão separada para cada dispositivo.

Cada superfície tem as suas regras no documento dela, e aqui ficam as convenções que elas compartilham. Novas convenções entram neste documento conforme forem definidas.

## Popup

O popup é o elemento que mostra informações de um item, de uma criatura ou de outro conteúdo. Ele segue o mesmo comportamento em qualquer superfície.

O popup tem duas camadas, e o gesto do jogador escolhe qual delas aparece:

- O **hover** exibe o popup como um *tooltip*: ele aparece depois de um instante, some quando o cursor sai do elemento e **fica aberto enquanto o cursor está sobre o próprio popup**. O jogador pode passar o mouse do slot para o painel e ler sem que ele pisque.
- O **clique** — ou o **botão direito do mouse** — abre um **menu contextual** com as ações daquele elemento. O menu fica aberto até o jogador clicar em qualquer outro lugar, e, no botão direito, ele nasce no ponto do clique.

> O popup funciona nos dois formatos de tela. No desktop, o hover mostra o tooltip e o clique abre o menu; no celular, onde não existe hover, o toque abre o menu, e ele lê a informação sem precisar segurar o toque em nenhum lugar da tela.

O conteúdo do tooltip é um resumo, e o do menu é o mesmo resumo com as **ações** daquele elemento, quando ele tem alguma — o botão de enviar uma criatura para o time fica no menu, e não no tooltip, porque um botão que aparece sozinho no hover é um acidente esperando para acontecer.

O clique num item **não tem efeito nenhum**: o item da loja é escolhido no clique porque a loja precisa da seleção, e o item da mochila e o drop de uma área só mostram a informação.

## Tamanho Fixo

Modais e drawers têm tamanho fixo: depois de abertos, eles não mudam de altura nem de largura por causa do conteúdo. A única escala que existe é a da tela, para caber em telas menores.

> O tamanho fixo existe para a interface não pular debaixo do jogador. Uma lista que muda o tamanho do modal a cada item mexe no que está ao redor e faz o jogador perder o lugar do clique.

## Barra de Rolagem

As áreas roláveis mostram a barra de rolagem sempre visível, mesmo quando o conteúdo cabe na tela.

> A barra sempre visível é preferível a aparecer e sumir: a barra que só aparece quando precisa muda a largura do conteúdo e faz o layout piscar. Com ela sempre presente, o jogador vê a mesma tela com ou sem rolagem.

## Animação de Cooldown

Tudo que tem cooldown mostra o progresso pelo ícone: uma sombra cobre 100% da altura do ícone e vai descendo conforme o tempo passa, chegando a zero quando o item está pronto de novo.

A animação é o padrão do jogo para cooldown, e vale para habilidades e consumíveis na barra de habilidades. Dispositivo fica de fora porque não tem cooldown.

> A sombra que desce informa duas coisas de uma vez: que aquele item está em espera e quanto falta, sem precisar de texto nenhum no ícone.

## Fechamento de Painéis

Cada tipo de camada sobre a tela tem o seu jeito de fechar, e o jogador aprende uma vez só:

- **Painéis e popups simples**, como os de seleção de habilidade, consumível e dispositivo: fecham ao clicar em qualquer lugar fora deles.
- **Modais compostos**, como a mochila, a loja e o modal de locais de caça: fecham só pelo ESC ou pelo botão de fechar no canto superior direito. Clicar fora não fecha.
- **Drawer**, como o de detalhes da área: fecha pelo ESC e pelo clique no dropshadow — a área escura em volta dele.

> Quanto mais conteúdo a camada tem, mais fácil é fechar sem querer. O painel simples some com um clique fora porque não há nada a perder; o modal cheio só fecha por ação explícita, para um clique errado não derrubar o que o jogador montou.

## Alerta

O alerta é o aviso que aparece no canto superior direito da tela, por cima de tudo. Ele é um quadrado com o ícone na esquerda e o conteúdo na direita, um botão de fechar no canto superior direito e uma barra de tempo embaixo, que vai diminuindo até zerar — quando zera, o alerta desaparece sozinho.

> O alerta é para o aviso que não exige ação: ele avisa, some sozinho e pode ser fechado antes. Quem precisa de uma decisão do jogador usa diálogo, e não alerta.

## Pendências

Os pontos abaixo ainda não foram decididos:

- Os valores de tamanho mínimo e máximo da escala da interface.
- A cor de destaque dos elementos ativos.
