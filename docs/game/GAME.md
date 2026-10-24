# Jogo

Este documento é a porta de entrada para todas as funcionalidades do jogo, contém uma tabela que funciona como um índice com todas as funcionalidades existentes, uma breve explicação e quando consultar cada uma.

| Fluxo | Descrição | Quando consultar | Documentação |
| --- | --- | --- | --- |
| Autenticação | Todo o processo de autenticação, desde o acesso a conta a criação e visualização dos treinadores. | Quando precisar de alguma informação do processo de autenticação, criação de contas e treinadores. | `docs/game/AUTHENTICATION.md` |
| Treinador | O personagem do jogador dentro do jogo: nível, stamina, time de criaturas e armazenamento. | Quando precisar de informação sobre o nível do treinador, a stamina, o time ou o armazenamento de criaturas. | `docs/game/TRAINER.md` |
| Criaturas | As criaturas do jogo: atributos, níveis, habilidades, captura e as criaturas iniciais. | Quando precisar de informação sobre uma criatura, seus atributos, habilidades, níveis ou como ela é capturada. | `docs/game/CREATURES.md` |
| Tela do Jogo | A tela principal do jogo, onde o usuário passa a maior parte do tempo: rendering do jogo, menus, ações e acompanhamento do que está acontecendo. | Quando precisar de informação sobre a tela principal, o rendering, os menus ou as ações do jogo. | `docs/game/PLAY_SCREEN.md` |
| Mundo | O mundo em grid onde o treinador anda: as medidas da grade, as direções, o passo, os tiles, a câmera e o que ainda não existe. | Quando precisar de informação sobre o mapa, o movimento do treinador, a câmera ou o que é renderizado no canvas. | `docs/game/WORLD.md` |
| Barra de Habilidades | A barra da parte inferior da tela, com os slots de cura, habilidades e dispositivo, e a seleção do que vai em cada um. | Quando precisar de informação sobre a barra de habilidades, os slots ou como equipar uma habilidade, dispositivo ou consumível. | `docs/game/SKILL_BAR.md` |
| Cidade | A área segura do jogo, onde o treinador anda livremente, vê outros jogadores e resolve a vida dele: cura, loja e venda de loot. | Quando precisar de informação sobre a cidade, o que existe nela ou o que o jogador faz por lá. | `docs/game/CITY.md` |
| Loja | O modal da cidade onde o jogador compra itens básicos e vende o loot de criaturas por gold coins. | Quando precisar de informação sobre comprar ou vender itens, preços, quantidade ou o funcionamento da loja. | `docs/game/STORE.md` |
| Interface | As convenções de interface do jogo: escalas, responsividade e os comportamentos que os elementos da tela compartilham. | Quando precisar de informação sobre como a interface se comporta em telas diferentes ou sobre convenções visuais. | `docs/game/INTERFACE.md` |
| Mochila | O modal onde o jogador vê todos os itens que o treinador possui, comprados, ganhos caçando ou obtidos de qualquer outra forma. | Quando precisar de informação sobre os itens do treinador ou sobre o modal da mochila. | `docs/game/BACKPACK.md` |
| Armazenamento | O modal onde o jogador vê as criaturas que capturou, com o time atual na primeira fileira. | Quando precisar de informação sobre as criaturas guardadas do treinador ou sobre o modal do armazenamento. | `docs/game/STORAGE.md` |
| Seleção de Área de Caça | O modal que o jogador abre para escolher em que área vai caçar, com a lista de áreas e a busca. | Quando precisar de informação sobre a escolha da área de caça, a lista de áreas ou a busca. | `docs/game/HUNT_AREA_SELECT.md` |
| Detalhes da Área de Caça | O drawer com as informações de uma área de caça e o botão de iniciar a caçada. | Quando precisar de informação sobre o drawer de detalhes, as criaturas e os itens de uma área, ou o início da caçada. | `docs/game/HUNT_AREA_DETAILS.md` |
| Caçada | A atividade de caça: o que acontece quando o treinador está em uma área de caça. | Quando precisar de informação sobre a caçada em si, a entrada, a troca e o reinício de área. | `docs/game/HUNT.md` |
| Analisador de Caçada | Os painéis da caçada, no canto superior esquerdo durante a caçada: a sessão e a análise dos números. | Quando precisar de informação sobre os painéis da caçada, a sessão ou a análise. | `docs/game/HUNT_ANALYZER.md` |
