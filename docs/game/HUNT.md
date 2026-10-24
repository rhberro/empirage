# Caçada

Este documento cobre a atividade de caça: o que acontece quando o treinador está em uma área de caça.

> Este documento cobre **a atividade em si**. Como o jogador escolhe a área está em [Seleção de Área de Caça](HUNT_AREA_SELECT.md), os detalhes de cada área estão em [Detalhes da Área de Caça](HUNT_AREA_DETAILS.md), e o que o jogador pode fazer na cidade está em [Cidade](CITY.md). A stamina do treinador, que limita a duração da caçada, está em [Treinador](TRAINER.md).

## Visão Geral

A caçada é a atividade principal do jogo. O treinador está em uma área de caça, com o seu time, e encontra criaturas selvagens lá.

Cada caçada é uma instância do treinador. O que acontece nela não é visto nem afetado por outro jogador: não há party, PvP nem interação entre caçadas nesta fase.

Durante a caçada o jogador não anda nem controla a criatura: a criatura ativa é automatizada e as batalhas acontecem sozinhas. O treinador apenas acompanha. Andar livremente pelo mapa é exclusivo da [cidade](CITY.md).

## A Criatura Ativa

A criatura ativa é a criatura do time que está em campo. Ela é quem se move, escolhe alvo e usa as habilidades; o jogador não comanda nenhuma dessas ações.

Sem nenhuma criatura selvagem por perto, a criatura ativa percorre o **loop fechado** da área: uma sequência de sqms que volta ao início depois do último nó. O loop é definido no mapa da área.

Quando uma criatura selvagem entra a até **7 sqm** de distância, ela vira o alvo automaticamente. O alvo é mantido até a selvagem morrer ou se afastar a mais de **9 sqm**. Os dois raios são diferentes de propósito: a histerese evita que o alvo fique trocando quando a selvagem anda na borda do alcance.

Com alvo, a criatura ativa abandona o loop e persegue a selvagem até entrar no alcance de uma habilidade equipada, desviando dos atores ocupados no caminho. A partir daí ela usa a rotação de habilidades descrita na [barra de habilidades](SKILL_BAR.md#uso-automático). Sem alvo, ela volta ao nó mais próximo do loop e retoma a caminhada. A prioridade é sempre alvo antes de loop.

A criatura ativa e a selvagem avançam uma para a outra no encontro: as duas se movem, e nenhuma fica parada esperando a outra chegar.

Enquanto tem alvo, a criatura ativa olha na direção dele, mesmo quando o passo em curso aponta para outro lado.

O treinador segue a criatura ativa a **3 sqm** de distância, pelo rastro dela. Ele é decorativo: não luta, não interfere no combate e **não bloqueia a passagem**; a criatura ativa pode atravessá-lo. A câmera segue a criatura ativa pela **posição interpolada** dela, não pelo tile confirmado, e não o treinador.

## Criaturas Selvagens

As criaturas selvagens nascem em **clusters** espalhados pela área, cada ponto com a sua espécie e o seu nível. Os clusters ficam longe do início e são separados uns dos outros, então o treinador e a criatura precisam caminhar até o primeiro grupo. A quantidade de pontos cresce com a dificuldade da área: 12 na Campina, 15 no Lago, 20 no Bosque e 24 nas Ruínas.

Quando uma selvagem é derrotada, o ponto dela fica vazio pelo tempo de respawn definido na área e depois cria outra selvagem no mesmo lugar. Se o ponto estiver ocupado na hora de renascer, o respawn espera.

A selvagem segue as mesmas regras de alcance da criatura ativa:

- **Aquisição de alvo:** a criatura ativa vira alvo quando chega a até **7 sqm**.
- **Perda de alvo:** a selvagem desiste quando a criatura ativa passa de **9 sqm** ou desmaia.
- **Perseguição:** com alvo, ela persegue até o alcance das habilidades e ataca. Adjacente ao alvo, usa o ataque corpo a corpo implícito, um golpe a cada **2 segundos** (o piso é 1 segundo). Ela desvia dos atores ocupados no caminho em vez de parar no primeiro tile bloqueado.
- **Sem alvo:** vaga pela área em passos curtos, com pausas. Se estiver a mais de **3 sqm** do ponto de spawn, volta para perto dele antes de continuar vagando.

A selvagem usa **todas as habilidades da espécie**, independentemente do nível, cada uma com a sua chance de uso e o seu intervalo. A espécie tem **6 habilidades**: 2 de alvo (`target`), 2 de área com alvo (`area`) e 2 de área sem alvo (`area_self`). A criatura ativa do jogador equipa **4** delas nos slots da barra.

As habilidades de área com alvo voam até o alvo, como a Ígnea e o Espinho. As de área sem alvo — Explosão e Vendaval — são centradas no conjurador e atingem o círculo ao redor dele, mas só o lado oposto: não atingem o próprio conjurador nem os aliados.

A selvagem não olha para a direção do passo quando tem alvo: olha para a criatura ativa. E não foge quando a vida está baixa nesta fase.

Os detalhes de atributos, dano e experiência das selvagens estão em [Criaturas](CREATURES.md#criaturas-selvagens).

## Colisão e Caminhada

A criatura ativa e as criaturas selvagens bloqueiam o tile em que estão e o destino do passo em curso. O treinador é decorativo e não bloqueia. Ninguém termina um passo no mesmo tile de outro ator nem atravessa outro ator.

O caminho da perseguição considera os atores ocupados: a criatura ativa e a selvagem desviam umas das outras, em vez de ficar paradas atrás do primeiro tile bloqueado. As duas avançam para o encontro. O tile de aproximação é o mais próximo da criatura que está chegando, não o primeiro na ordem fixa dos vizinhos.

O treinador nasce **três nós do loop atrás** do spawn da criatura ativa, nunca no mesmo tile. Durante a caçada ele não bloqueia o tile; ele apenas acompanha o rastro.

A caminhada do cliente é interpolada pelo relógio do servidor: a criatura anda a duração real do passo e **fica parada** quando espera, sem deslizar. O cliente não estica o passo para preencher a pausa; a pausa é parte do movimento.

## O Que Aparece na Tela

Durante a caçada, o canvas mostra o chão da área, a criatura ativa e as criaturas selvagens com as poses de parado, andando e ataque, uma barra de vida sobre cada criatura e os efeitos das habilidades, incluindo as ondas das habilidades de área. Habilidades de alvo com tempo de voo atravessam a tela como projéteis e só aplicam o dano na chegada. O treinador é desenhado atrás da criatura ativa, no rastro dela.

## Entrar na Caçada

O jogador entra em uma caçada pelo drawer de [detalhes da área](HUNT_AREA_DETAILS.md#iniciar-caçada): seleciona a área, espera os 5 segundos e a caçada começa.

A entrada só termina quando a área está carregada: depois da contagem, a [tela de carregamento](PLAY_SCREEN.md#estados-da-tela) fica visível até a caçada estar pronta para ser renderizada.

A entrada sempre acontece a partir da cidade. O [modal de seleção](HUNT_AREA_SELECT.md) só é acessível pelo [botão de play](PLAY_SCREEN.md#botão-de-play), que existe apenas na cidade, então não há como iniciar uma caçada — nem trocar de área — no meio de outra caçada.

## Trocar de Área

Trocar de área não acontece durante a caçada. Como o [modal de seleção](HUNT_AREA_SELECT.md) só é acessível pelo [botão de play](PLAY_SCREEN.md#botão-de-play), que existe apenas na cidade, o jogador que está caçando não tem acesso à lista de áreas.

Para trocar de área, ou para reiniciar a caçada na mesma, o jogador precisa primeiro sair da caçada atual. De volta à cidade, ele abre o modal, escolhe a área — que pode ser a mesma onde estava — e inicia a caçada pelo [fluxo de sempre](#entrar-na-caçada).

> A troca e o reinício são a mesma ação: começar uma caçada. O que muda é só a área escolhida, e não vale uma regra própria para cada caso.

> O jogador encerra a caçada pelo botão **Finalizar Caçada**, no painel da sessão do [analisador de caçada](HUNT_ANALYZER.md), e só então escolhe a próxima área.

## Fim da Caçada

A caçada é finalizada automaticamente em três situações:

- A [stamina](TRAINER.md#stamina) do treinador chega a zero.
- A [sessão offline](TRAINER.md#sessão-offline) da conta se esgota, mesmo com stamina sobrando.
- O [time](TRAINER.md#time) do treinador não tem mais nenhuma criatura apta a batalhar.

A caçada continua com o jogador offline: fechar o jogo não a interrompe, e ela segue até o fim da sessão offline ou até uma das outras condições de fim.

Nas três situações o treinador volta para a [cidade](CITY.md), e a caçada só recomeça se o jogador entrar em uma área de novo. A volta passa pela [tela de carregamento](PLAY_SCREEN.md#estados-da-tela), como qualquer entrada em uma área. Ao fim de **qualquer** caçada — automática ou finalizada pelo jogador —, todas as criaturas do treinador, no time e no armazenamento, voltam com a vida cheia, inclusive as desmaiadas. Esse caso não depende mais do [local de cura](CITY.md#local-de-cura); é a regra provisória desta fase.

O jogador também pode finalizar a caçada quando quiser, pelo botão **Finalizar Caçada** no painel da sessão do [analisador de caçada](HUNT_ANALYZER.md): a caçada passa pela mesma contagem de 5 segundos e pela [tela de carregamento](PLAY_SCREEN.md#estados-da-tela), e o treinador volta para a cidade.

> Nas três situações acima o fim vem do jogo, e não de uma ação do jogador. Finalizar a caçada é a escolha do jogador.

> O loot é creditado na mochila no abate de cada selvagem, e não no fim da caçada: finalizar não muda os itens que o treinador já obteve.

## Loot e Experiência

O loot de cada selvagem é rolado no abate e creditado direto na mochila do treinador, item por item, conforme as regras de [drops](CREATURES.md#drops).

A experiência também é creditada no abate: a criatura ativa recebe a experiência da selvagem derrotada, e as demais criaturas vivas do time recebem uma fração, conforme as regras de [experiência das criaturas](TRAINER.md#experiência-das-criaturas). Não há level-up nesta fase.

## Áreas de Caça

Cada área de caça tem suas próprias criaturas e itens, descritos nos [detalhes da área](HUNT_AREA_DETAILS.md).

Os mapas das áreas têm **96x64 sqm**. O loop da criatura ativa é fechado e serpenteia pelo mapa, e os pontos de spawn ficam em **clusters** de 3–4 pontos adjacentes, a pelo menos 6 sqm de outro cluster e 10 sqm do início. As áreas têm **obstáculos internos** — montanhas, água e bosque — que formam corredores; o loop, o início e os clusters são sempre caminháveis, e conectores ligam cada cluster ao loop. A quantidade de pontos cresce com a dificuldade: 12 na Campina, 15 no Lago, 20 no Bosque e 24 nas Ruínas.

O respawn atual é de **30 s** na Campina Cinzenta, **35 s** no Lago Congelado, **40 s** no Bosque Urrante e **45 s** nas Ruínas de Pedra.

O mapa da área define o loop da criatura ativa e os pontos de spawn, com a espécie, o nível e o tempo de respawn de cada ponto.

O que uma criatura selvagem deixa são as partes e os itens que ela carrega, e nada além disso: criatura não dropa gold coin. A única exceção admitida é uma criatura criada de propósito com tema de dinheiro, que possa ter o gold coin como drop específico.

> O drop é o que a criatura carrega, e não uma recompensa inventada. O que cada espécie dropa está em [Drops](CREATURES.md#drops). O dinheiro do jogo vem da venda do loot, conforme a [loja da cidade](CITY.md#lojas), e não de criatura nenhuma.

## Escopo das Fases Alfa e Beta

Os pontos abaixo ainda estão em aberto ou são provisórios nesta fase e devem ser revistos conforme o jogo evolui:

- A lista de criaturas e de itens de cada área é provisória.
- O balanceamento das áreas — quantidade de spawns, níveis e tempo de respawn — é provisório.

## Pendências

Os pontos abaixo ainda não foram decididos:

- A captura de criaturas e o uso do slot de dispositivo.
- Party, PvP e interação entre caçadas.
- A fórmula definitiva de experiência e o level-up.
- O balanceamento fino de dano, densidade de spawn e respawn.
