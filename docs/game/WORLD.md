# Mundo

Este documento cobre o mundo em grid onde o treinador anda: as medidas da grade, as direções, o passo, a câmera e o que aparece no canvas. Hoje o jogador anda na [cidade](CITY.md) e acompanha a caçada nas áreas de caça.

> O mundo é a base de todas as áreas do jogo. A tela que contém o canvas está em [Tela do Jogo](PLAY_SCREEN.md), as regras da área segura estão em [Cidade](CITY.md), e a atividade da caçada está em [Caçada](HUNT.md).

## Visão Geral

O mundo é visto de cima (top-down), em pixel art, com a referência de Pokémon do GBA e de Tibia já registrada na [Tela do Jogo](PLAY_SCREEN.md#visão-geral). Dessa referência vêm as decisões que valem hoje: a grade de quadrados, o passo de um quadrado por vez, as quatro poses do personagem com a lateral esquerda espelhada e a câmera que acompanha o treinador.

O chão é uma grade de quadrados (sqm). Tudo o que existe no mundo tem uma posição na grade: o treinador, os outros jogadores e cada tile do mapa. A posição de uma pessoa é sempre o quadrado em que ela está, e a posição em pixels é derivada dele.

## A Caçada no Mundo

Na caçada, o mundo é a área de caça escolhida. Cada área tem o seu próprio mapa, com o chão, o loop da criatura ativa e os clusters de spawn das selvagens. Os mapas de caça têm **96x64 sqm**, com um loop fechado que serpenteia pelo mapa e **obstáculos internos** — montanhas, água e bosque — que formam corredores. Os pontos de spawn ficam em clusters de 3–4 pontos adjacentes, longe do início e separados uns dos outros.

O jogador não anda nem escolhe destino: a criatura ativa percorre o loop e persegue as selvagens, e o treinador segue três sqm atrás, como acompanhante decorativo. A criatura ativa e as selvagens bloqueiam o tile em que estão e o destino do passo em curso; o treinador não bloqueia. Na perseguição, os atores desviam uns dos outros e os dois lados avançam para o encontro.

A caminhada da caçada é interpolada pelo relógio do servidor. A criatura anda a duração real do passo e fica **parada** quando espera; o cliente não estica o passo para preencher a pausa. Isso é renderização, não uma regra nova de velocidade; o tile confirmado continua sendo o do servidor.

A câmera segue a criatura ativa pela **posição interpolada**, não pelo tile confirmado, e não o treinador. Sobre cada criatura aparece uma barra de vida, e o combate é visível no canvas: a pose de ataque, o anel do alvo, as ondas das habilidades de área e os efeitos de impacto. As regras da caçada estão em [Caçada](HUNT.md).

A [mochila](BACKPACK.md) e o [armazenamento](STORAGE.md) continuam abrindo sobre o canvas durante a caçada. A leitura é permitida; no armazenamento, as ações que mudam o time ficam bloqueadas.

> O chão da área usa os mesmos tiles da cidade nesta fase, com um tom sutil que diferencia o lugar. O que muda entre cidade e caçada é o mapa, os atores e a câmera, não a linguagem visual do mundo.

## Grade, Janela e Zoom

| Constante | Valor |
| --- | --- |
| Tamanho do sqm | 16x16 px na resolução base |
| Sprite do treinador | 16x24 px, com os pés no centro da base do sqm |
| Janela de visão | fixa em 34x20 sqm (544x320 px) |
| Zoom do canvas | inteiro, nunca menor que 1 |
| Mapa da cidade | 96x64 sqm, com spawn no centro (48,31) |

A resolução base é 16 px por sqm e toda a arte é desenhada nessa medida. O canvas lógico tem sempre 544x320 px — a janela de 34x20 sqm —, independentemente do tamanho da tela. O que muda é o zoom aplicado ao canvas, sempre em número inteiro: o jogo nunca desenha um pixel de arte em uma fração de pixel da tela. O canvas cobre o container em modo **cover**: o zoom é o menor inteiro que cobre os dois eixos, o canvas fica centralizado e a sobra é recortada. Nunca aparece barra (letterbox).

> A janela é fixa: o jogador não vê mais mapa em uma tela grande, e sim a mesma janela de 34x20 sqm — com pixels maiores quando o zoom sobe. O zoom arredonda para cima nos dois eixos (`ceil`), então o canvas é sempre ao menos do tamanho do container e o excesso é cortado nas bordas: em uma tela cuja proporção não bate com a janela, alguns tiles das bordas podem ficar fora da vista. A câmera continua com o viewport de 544x320 px.

> Pixel perfect não é um efeito: é a consequência de todas as posições serem inteiras e de o zoom ser inteiro. O canvas também não usa antialias, os sprites são filtrados por nearest e o navegador é instruído a não suavizar o canvas ampliado.

## Direções e Passo

O treinador anda nas oito direções: cima, cima-direita, direita, baixo-direita, baixo, baixo-esquerda, esquerda e cima-esquerda. Cada passo ocupa exatamente um sqm.

| Passo | Duração |
| --- | --- |
| Ortogonal | 300 ms por sqm |
| Diagonal | 424 ms por sqm |

A diagonal leva mais tempo que a ortogonal de propósito: ela cobre mais distância na tela, e com a mesma duração o treinador pareceria andar mais rápido na diagonal.

### Como o treinador anda

O jogador clica em um sqm do chão, ou usa WASD e as setas do teclado. O clique é convertido para o sqm correspondente e enviado ao servidor como um destino. O servidor calcula o caminho e devolve a caminhada inteira; o cliente prediz o primeiro passo para responder no mesmo frame e reconcilia com a resposta.

> O cliente não decide o caminho: a predição é de **um passo**, feita com a mesma busca ponderada do servidor. O servidor confirma o caminho e o cliente mantém o passo que já estava na tela, trocando só o resto. Se a resposta recusar, o personagem volta ao tile confirmado e o passo é travado por um instante.

O caminho é calculado por uma busca ponderada (Dijkstra) nas oito direções: o passo ortogonal custa 1 e o diagonal custa 3, no estilo de Tibia. Como cortar na diagonal sai mais caro, o caminho segue as linhas retas primeiro e só usa a diagonal quando ela realmente encurta o percurso — clicar em linha reta não gera um zigue-zague diagonal. As regras que o jogador percebe:

- **Clique em um sqm livre:** o treinador anda até ele.
- **Clique em um sqm sólido:** o treinador para em um sqm livre ao redor do alvo, em vez de recusar o clique — o primeiro que o caminho alcança. Um clique em uma árvore ainda leva o treinador para o lado dela.
- **Clique em um alvo cercado:** se nenhum sqm ao redor puder ser alcançado, o movimento é recusado e o treinador não sai do lugar.
- **Clique fora do mapa:** o movimento é recusado.
- **Clique no sqm em que ele está:** o treinador para e cancela a caminhada em curso.
- **Clique durante uma caminhada:** o treinador **termina o passo em curso** e só então recalcula o caminho a partir do tile em que está entrando — nunca reinicia do tile anterior. Clicar de novo muda o rumo, mas não corta a animação que já começou.
- **Caminho muito longo:** o limite da resposta é de 512 passos. Se o caminho mais barato não couber no limite, o servidor tenta um caminho de menos passos (com mais diagonais); se nem esse couber, o comando é recusado, para a resposta não inundar o canal.

O teclado anda nas quatro direções ortogonais, um sqm por tecla. As diagonais existem no caminho calculado pelo clique; elas não têm tecla própria.

O personagem não tem um comando separado de virar: a direção em que ele olha é a direção do último passo aceito, e ele continua olhando para lá quando para.

> Dois jogadores não colidem. A colisão do mundo é só com o terreno; dois treinadores podem ocupar o mesmo sqm, e um não bloqueia o passo do outro.

## Sprites e Animações

O treinador é um sprite de 16x24 px, e o ponto de referência dele é o centro da base do sqm: os pés ficam no centro horizontal e na base do quadrado em que ele está. A parte de cima do sprite sobe livremente pelo sqm de cima, sem alterar a posição.

O atlas tem quatro poses: cima, baixo, direita e esquerda. A pose da esquerda é gerada como espelho da direita, então o jogo não vira o sprite em tempo de execução. As oito direções usam essas quatro poses: as diagonais reaproveitam a pose vertical correspondente, para cima ou para baixo.

| Animação | Quadros | Como toca |
| --- | --- | --- |
| Parado (`idle`) | 2 | Em ciclo de 800 ms, pelo relógio, mesmo com o jogador parado |
| Andando (`walking`) | 4 | Distribuídos pela duração do passo, para as pernas acompanharem a distância |

A animação de andar não tem uma taxa fixa de quadros por segundo: os quatro quadros são divididos pela duração do passo, e por isso um passo diagonal, que dura mais, também mostra os quadros por mais tempo. Ao terminar o passo, o personagem volta ao `idle` olhando para a direção em que andou.

As criaturas têm atlas próprio, com as poses de parado, andando e ataque. O treinador continua com as poses de parado e andando: ele não ataca, porque na caçada quem luta é a criatura ativa. A animação de `hit` do treinador não existe; o flash de dano é das criaturas.

> Todos os treinadores usam o mesmo atlas nesta fase. O nome e o gênero de cada jogador viajam no protocolo, mas o renderer atual não desenha nome sobre a cabeça nem usa o gênero para escolher a arte.

## Tiles

O mapa é feito de tiles de 16x16 px. Cada tile tem um tipo, e o tipo decide se o sqm é sólido e quantos quadros de animação ele tem.

| Tiles | Sólido? |
| --- | --- |
| Grama, caminho, flores, grama alta, porta | Não |
| Água, cerca, muro, árvore, poço | Sim |

O mundo fora do mapa também é sólido: nenhum caminho sai pelos limites do mapa.

Cada mapa é o mesmo dos dois lados: o servidor usa os tipos para julgar colisão e caminho, e o cliente usa os mesmos tipos para desenhar. Cidade e áreas de caça são arquivos commitados no repositório e não viajam pelo socket; servidor e cliente leem exatamente os mesmos bytes.

### Tiles animados

A água e a grama alta têm dois quadros no atlas, e o atlas já está pronto. O renderer desta fase desenha o primeiro quadro e mantém o tile estático: **os tiles animados ainda não tocam no jogo**.

> O atlas ter os quadros não é o mesmo que o mundo animar: a camada que anima os tiles ainda não existe.

## Câmera

Na cidade, a câmera segue o treinador do jogador. Ela centraliza o sqm em que ele está e se move em pixels inteiros; uma suavização curta de poucos quadros acompanha o passo, sem subpixel e sem mostrar o vazio além do mapa.

A câmera é limitada aos limites do mapa: perto de uma borda ela para, em vez de mostrar o vazio além do mapa.

Redimensionar a tela muda o zoom, não a janela lógica: o canvas cobre o container em modo cover, com zoom inteiro e recorte central — sem barras. O jogador vê a mesma janela de 34x20 sqm (com pixels maiores quando o zoom sobe), e as bordas do canvas podem cortar tiles. A câmera não gira: o mundo não tem rotação.

Na caçada, a câmera usa o mesmo viewport e o mesmo zoom, mas segue a criatura ativa em vez do treinador. O treinador aparece no rastro, atrás dela.

## Outros Jogadores

Os outros jogadores aparecem na cidade com o mesmo personagem, andando pelos caminhos que o servidor calculou. Eles são visíveis e se movem, mas não colidem com o treinador do jogador nem entre si, e não há interação entre eles.

Nesta fase, todos os jogadores conectados ao mesmo processo do servidor aparecem uns para os outros: não existe recorte por distância. O nome de cada um não é desenhado, e não há chat nem informação de alvo no canvas.

Quando um jogador desconecta, o personagem dele desaparece do mundo. A posição é persistida em banco: a cada passo confirmado, o servidor marca o sqm para gravar e, na desconexão, o passo em curso é completado e gravado na hora. Uma reconexão volta ao tile em que o treinador estava entrando — não ao início nem ao fim do caminho —, e o caminho em curso é descartado. A posição sobrevive ao reinício do servidor; se a posição salva não for mais andável, o treinador reaparece no spawn.

## Relógio

O tempo do mundo é o do servidor. Cada passo tem um início e um fim absolutos, e o cliente corrige o próprio relógio pelo horário que recebe no estado do jogador e nos pongs. Ele mede o RTT, usa o menor RTT da janela para o offset e desenha os outros atores com um pequeno buffer; o próprio jogador é desenhado sem buffer, porque a predição já respondeu.

> É por isso que uma aba oculta, um atraso de rede ou uma reconexão não deixam o personagem no lugar errado: ao voltar, o cliente recalcula a posição pelo relógio corrigido em vez de somar durações que passaram. O passo pode até ser pulado visualmente, mas o personagem aparece no sqm certo.

## O Que Ainda Não Existe

| Recurso | Estado |
| --- | --- |
| Chat e informação do alvo em texto | Não existem; a caçada desenha o anel do alvo, mas não uma etiqueta com nome ou vida |
| Captura e dispositivos | A captura está fora de escopo nesta fase; o slot de dispositivo não tem efeito |
| Party e PvP | Não existem; a caçada é uma instância por treinador. A colisão entre os atores da caçada existe |
| NPCs e pontos de interação | Não existem; não há NPC de cura nem de loja, e a ação de cura não está implementada. O modal da loja existe e é aberto pelo botão da tela, não por um NPC |
| Colisão e interação entre jogadores | Não existem na cidade; os jogadores só se veem |
| Nome sobre a cabeça | Não existe; nome e gênero viajam no protocolo, mas não são desenhados |
| Animação de `hit` do treinador | Não existe; as criaturas têm ataque e flash de dano, o treinador só tem parado e andando |
| Tiles animados | O atlas tem os quadros; o renderer desenha o primeiro e não anima |
| Mobile em paisagem | O overlay "Vire o celular" não existe; a tela não trata orientação |
| Múltiplas instâncias | Não existem; o servidor assume um processo só |
| Predição local do movimento | Existe para o primeiro passo na cidade; o caminho confirmado vem do servidor |

## Referências

A referência visual é Pokémon do GBA e Tibia, como registrado na [Tela do Jogo](PLAY_SCREEN.md#visão-geral). O que foi adotado delas nesta fase: a grade de 16 px, o passo de um sqm por vez, as quatro poses com a lateral espelhada, a câmera que segue o personagem e a leitura top-down em pixel art.
