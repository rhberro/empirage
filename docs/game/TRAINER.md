# Treinador

Este documento cobre o treinador como personagem do jogador dentro do jogo: seu nível, sua stamina, seu time de criaturas e onde ficam as criaturas que não estão no time. São regras do treinador, que valem em qualquer lugar, na cidade ou em uma caçada.

> Este documento cobre **o treinador em jogo**. Como o treinador é criado e selecionado no nível da conta está em [Autenticação](AUTHENTICATION.md). A tela onde ele é acompanhado está em [Tela do Jogo](PLAY_SCREEN.md), e a atividade que consome a stamina dele está em [Caçada](HUNT.md).

## Nível

O treinador tem o próprio nível, exibido na [toolbar da tela do jogo](PLAY_SCREEN.md#treinador).

O nível do treinador sobe apenas completando missões e missões diárias. Batalhas não dão experiência ao treinador.

> O nível do treinador não tem relação com o nível das criaturas, que é individual de cada criatura. São duas progressões separadas: a do personagem do jogador e a das criaturas.

> No futuro, o nível do treinador vai liberar benefícios, como melhor chance de captura e mais experiência para as criaturas. Por enquanto, apenas esses dois benefícios estão definidos.

## Stamina

A stamina é o tempo de caça do treinador. Ela é medida em horas, e o máximo é **12 horas**, para todo e qualquer treinador.

A stamina máxima é sempre 12 horas. Nenhum item, habilidade ou situação aumenta ou diminui esse valor.

> A stamina é exibida na [barra de habilidades](SKILL_BAR.md): a barra mostra o percentual restante de forma visual, e o rótulo da barra mostra o tempo ainda disponível, em horas e minutos.

> A barra e o rótulo não repetem a mesma informação. A porcentagem já está na barra, e o que o jogador planeja é o tempo: mostrar os dois números obriga a ler duas vezes para responder à mesma pergunta, "quanto tempo de caça ainda tenho?". Por isso o rótulo mostra só o tempo.

> Um número único e imutável existe para o jogo ter uma regra só. Enquanto o treinador tem stamina, ele pode caçar; quando ela acaba, ele para. Nenhum jogador tem tempo de caça extra por item ou por construção de personagem.

### Recuperação

A stamina recupera sempre que o treinador não está caçando. Online, offline, na cidade ou em qualquer outro local, andando ou parado: não importa onde nem como, o que bloqueia a recuperação é apenas estar em uma caçada. A recuperação é o passar do tempo, e não uma atividade do treinador.

A velocidade da recuperação depende do tipo de conta:

- **Conta gratuita:** 1 minuto de stamina a cada 2 minutos.
- **Conta paga:** 1 minuto de stamina a cada 1 minuto.

### Consumo

Cada minuto de caçada consome 1 minuto de stamina, com o jogo aberto ou não. A stamina não é um banco de horas de caça offline: ela é consumida do mesmo jeito com o treinador online ou caçando sozinho.

Enquanto caça, o treinador não recupera stamina. A recuperação só acontece entre caçadas.

### Mínimo para Caçar

Iniciar uma caçada exige pelo menos **30 minutos** de stamina. Um treinador pode estar caçando com menos do que isso — a caçada começa com 30 minutos ou mais e consome até acabar —, mas não pode começar uma nova com menos.

> A regra vale para qualquer início de caçada, sem exceção: entrar em uma área nova e entrar de novo em uma área já conhecida passam pelo mesmo mínimo.

### Sessão Offline

A caçada começada continua mesmo se o jogador fechar o jogo. Ela segue sozinha até o fim da sessão offline, cuja duração depende do tipo de conta:

- **Conta gratuita:** 4 horas de caçada seguidas.
- **Conta paga:** 8 horas de caçada seguidas.

Quando o tempo da sessão acaba, a caçada é finalizada automaticamente, mesmo que ainda haja stamina disponível. Para caçar de novo, o jogador precisa conectar no jogo e iniciar a caçada novamente.

### Por Treinador

A stamina é do treinador, não da conta. Cada treinador tem a sua própria stamina de 12 horas, e usar a de um não afeta a dos outros: o jogador pode zerar a stamina de um treinador e em seguida começar a caçar com outro.

O tipo de conta é da conta, e não do treinador. A velocidade de recuperação e a duração da sessão offline valem para todos os treinadores da conta.

## Moedas

O treinador lida com duas moedas, e as duas ficam visíveis na [toolbar](PLAY_SCREEN.md#menu-da-direita) da tela do jogo.

- **Gold coin:** a moeda do jogo, ganha vendendo loot e gasta em NPCs e comércios. As regras dela estão na [loja da cidade](CITY.md#lojas).
- **Diamante:** a moeda premium, obtida com doações em dinheiro real e gasta em serviços. Por enquanto, no alfa e no beta, o único uso do diamante é comprar a conta paga: **30 diamantes por 30 dias de conta paga**.

> O diamante é a ponte entre o dinheiro real e o jogo: o jogador faz uma doação, recebe diamantes e troca por serviços. Os benefícios da conta paga estão em [Recuperação](TRAINER.md#recuperação) e [Sessão Offline](TRAINER.md#sessão-offline).

> O valor do diamante ainda não está definido. A referência é algo em torno de R$20 por 50 diamantes.

## Time

O treinador carrega consigo no máximo **5 criaturas**. O time é exibido nas [linguetas da tela do jogo](PLAY_SCREEN.md#linguetas-do-time).

### Fora da Caçada

Fora de uma caçada, na [cidade](CITY.md), o treinador pode remanejar o time à vontade: adicionar criaturas, remover criaturas e trocar. A ordem do time também pode ser alterada, e é ela que define quem entra em campo quando uma criatura desmaia.

### Durante a Caçada

Durante a caçada o time está fechado: o time que o treinador entra é o time que ele sai. Fora de uma exceção, ele não adiciona nem remove criaturas do time.

A exceção é a captura. Se existe um slot disponível, a criatura capturada entra direto no próximo slot vago do time, em vez de ir para o [armazenamento](#armazenamento). Um treinador pode entrar em uma caçada com 3 criaturas, capturar duas durante ela e sair com 5, preenchendo os slots 4 e 5. A chance de captura de cada espécie e o multiplicador dos dispositivos estão em [Captura](CREATURES.md#captura).

> A exceção existe porque reabrir o time no meio da caçada daria ao jogador a chance de consertar um time perdido sem custo nenhum. Um slot vago, porém, é espaço que já existia quando a caçada começou, e ocupá-lo não é remanejo.

Com o time cheio, qualquer criatura capturada vai para o [armazenamento](#armazenamento) automaticamente.

### Última Criatura

O time nunca fica vazio, e o treinador nunca fica sem nenhuma criatura. As duas recusas são diferentes:

- **Remover do time** a única criatura do time fica indisponível; o time não pode ficar vazio. A criatura pode continuar no armazenamento, mas não pode sair do time enquanto for a única.
- **Soltar** a única criatura do treinador é recusado com **O treinador precisa ter pelo menos uma criatura.** Soltar uma criatura que está no time e é a única do time também é recusado, porque a soltura deixaria o time vazio.

Soltar uma criatura do armazenamento continua permitido enquanto houver outra criatura no treinador. Uma criatura do time só pode ser solta quando outra companheira continua no time.

## Criaturas Desmaiadas

Uma criatura desmaiada não entra mais em batalha, e o slot dela é exibido em tons de cinza com opacidade reduzida, para o jogador perceber de longe. Ela volta a batalhar com a vida cheia no fim da caçada, quando todas as criaturas do treinador são curadas.

Ao fim de qualquer caçada, o treinador volta para a cidade com **todas** as criaturas com a vida cheia, no time e no armazenamento, inclusive as que desmaiaram. O [local de cura](CITY.md#local-de-cura) da cidade continua existindo, mas a volta da caçada não depende mais dele para esse caso. Essa cura de volta é a regra provisória desta fase.

### Entrada Automática

Quando a criatura ativa desmaia, a primeira criatura apta, da esquerda para a direita, entra automaticamente no lugar dela, sem espera.

> A troca automática não tem os 5 segundos da troca manual. Ela não é uma escolha do jogador e sim a continuidade da caçada: se a criatura que entrou desmaiar 1 segundo depois, a próxima entra também sem espera.

> A ordem do time é o que decide a prioridade de entrada. Quem quer que a criatura C seja a primeira e que a A entre quando ela desmaiar deixa o time na ordem C, A, B.

> A entrada não muda a ordem do time: a criatura que entrou e a desmaiada continuam nas suas posições. Quem entra é decidido pela ordem, e a batalha não reordena nada.

Se não existir mais nenhuma criatura apta no time, a caçada é finalizada automaticamente e o treinador volta para a [cidade](CITY.md).

### Troca Manual

O jogador pode clicar em qualquer criatura apta do time, em qualquer posição, para colocá-la no lugar da criatura ativa. A criatura clicada e a criatura ativa trocam de lugar. Clicar em uma criatura desmaiada não faz nada.

Para evitar spam, depois de uma troca manual qualquer nova troca fica bloqueada por **5 segundos**, para qualquer criatura. Enquanto a criatura A está em campo e o jogador clica na criatura B, elas trocam na hora, mas voltar para a A ou ir para uma C exige esperar os 5 segundos.

> A máscara com a contagem sobre os slots faz parte da [tela do jogo](PLAY_SCREEN.md#troca-de-criatura), e existe para o jogador entender que a troca está em espera, e não impedida por um erro.

> A troca é a única coisa que o jogador faz com o time durante uma caçada, além de receber criaturas capturadas em slots vagos. Adicionar, remover e reordenar criaturas não acontecem nos slots: os slots são para clicar e para acompanhar o estado das criaturas.

## Experiência das Criaturas

Cada criatura tem a própria experiência, ganha em batalhas. A criatura ativa, que está em campo, recebe a experiência da batalha.

As criaturas do time que não estão em campo recebem 10% da experiência da batalha. A fração vale para todas as criaturas fora de campo, e uma criatura desmaiada não ganha experiência.

> A experiência da criatura é separada do nível do treinador, conforme o [nível](#nível): são duas progressões independentes. Como a experiência é ganha e como o nível sobe está em [Criaturas](CREATURES.md#experiência).

## Armazenamento

O armazenamento é onde ficam as criaturas capturadas que não estão no time, quando o time já está cheio.

O nome é provisório. No futuro o armazenamento pode ser um computador ou qualquer outra coisa, e o comportamento continua o mesmo: criaturas que não estão no time ficam guardadas.

O jogador pode consultar o armazenamento de qualquer lugar, caçando ou não, para acompanhar as criaturas que capturou sem precisar voltar para a [cidade](CITY.md). Não existe limite de criaturas guardadas.

> A consulta de qualquer lugar existe porque sair da caçada para ver as criaturas seria punir o jogador por querer informação. A interface do armazenamento está em [Armazenamento](STORAGE.md).

## Escopo das Fases Alfa e Beta

Os pontos abaixo ainda estão em aberto ou são provisórios nesta fase e devem ser revistos conforme o jogo evolui:

- As missões e missões diárias, que dão experiência ao treinador, ainda não existem, então por enquanto o nível do treinador não sobe.
- A experiência das criaturas fora de campo é de 10% da experiência da batalha, valor provisório.

## Pendências

Os pontos abaixo ainda não foram decididos:

- O que são os itens do treinador: como são obtidos, quais existem e o que cada um faz.
- Onde e como o jogador faz a doação que gera diamantes, e qual o valor final do diamante.
- Se a conta paga se renova sozinha ou o jogador precisa recomprar.
