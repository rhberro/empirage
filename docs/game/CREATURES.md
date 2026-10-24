# Criaturas

Este documento cobre as criaturas do jogo: o que são, os elementos, níveis, experiência, atributos, captura, habilidades, drops e as criaturas iniciais.

> Este documento cobre **as criaturas em si**. As regras do time, do armazenamento e da experiência dividida em batalha estão em [Treinador](TRAINER.md), o uso das habilidades na barra está em [Barra de Habilidades](SKILL_BAR.md), e as criaturas selvagens de cada área de caça estão em [Detalhes da Área de Caça](HUNT_AREA_DETAILS.md).

## Visão Geral

Criaturas são monstros selvagens que vivem na natureza: cavernas, florestas, campos, céu e montanhas. Elas são o coração do jogo. Existem as criaturas do treinador, que ele carrega no time e no armazenamento, e as criaturas selvagens, que ele encontra caçando.

Cada criatura é um indivíduo, e cada indivíduo pertence a uma única espécie. A espécie é o registro no banco de dados, e a criatura é a materialização desse registro, com os valores próprios gerados no momento em que ela foi capturada.

A base do jogo começa com cinco espécies, sendo três delas as opções de criatura inicial do jogador. As espécies exatas, com todos os seus dados, são cadastradas no banco de dados.

## Espécie

A espécie é o registro da criatura no banco de dados. Toda criatura pertence a uma única espécie, e é a espécie que carrega o que é fixo: os valores de base, a chance de captura, o set de habilidades, o set de drops e a experiência base.

O que é individual — os valores de potencial — nasce com a criatura, no momento da captura.

## Elemento

Toda espécie pertence a um único elemento, e no alfa e no beta essa regra se mantém. No futuro uma criatura pode ter dois ou mais elementos, mas não agora.

O elemento da espécie é o elemento da criatura, e ele é usado na **defesa**: a efetividade de um ataque compara o elemento da habilidade com o elemento da espécie. O elemento da criatura não prende as habilidades dela — uma criatura de fogo pode ter habilidades de água ou neutras, porque o elemento é definido por habilidade, e não por espécie.

> Um ataque de fogo contra uma criatura de planta é super efetivo, e o dano é 1,5× o normal. A comparação é sempre elemento da habilidade contra elemento da espécie.

## Níveis

O nível da criatura não é pré-calculado nem guardado em lugar nenhum: ele é calculado na hora, por fórmula, para ser exibido na interface. A mesma regra vale para os atributos finais.

```
fórmula ainda para ser definida
```

## Experiência

Cada espécie tem a sua experiência base, cadastrada e pertencente à espécie. Casos especiais — multiplicadores, ou itens que aumentam a experiência ganha por um tempo — são aplicados em outro momento; a espécie em si guarda apenas a base.

Quando uma criatura da espécie é derrotada, o nível dela e a experiência base da espécie definem quanta experiência vai para a criatura que a derrotou. A fórmula é provisória:

```
experiência = round(baseExperience × (1 + (nível − 1) × 0.1))
```

A criatura ativa recebe 100% da experiência, e as demais criaturas vivas do time recebem 10%. A experiência é creditada no abate, e não no fim da caçada. Nesta fase não há level-up: a experiência acumula, mas o nível não sobe.

A experiência da criatura é separada do nível do treinador, e a divisão entre a criatura em campo e as demais do time está em [Experiência das Criaturas](TRAINER.md#experiência-das-criaturas).

## Atributos

Toda criatura tem cinco atributos: **Vida**, **Ataque Físico**, **Ataque Mágico**, **Defesa Física** e **Defesa Mágica**.

Os atributos são definidos por dois grupos de valores.

### Valores de Base (BV)

Os BVs são fixos por espécie e não mudam entre criaturas da mesma espécie. Uma criatura da espécie A sempre tem os mesmos BVs, por exemplo:

| Atributo | BV |
| --- | --- |
| Vida | 22 |
| Ataque Físico | 8 |
| Ataque Mágico | 4 |
| Defesa Física | 7 |
| Defesa Mágica | 2 |

### Valores de Potencial (PV)

Os PVs são porcentagens de 0% a 100% e pertencem à criatura, não à espécie. Duas criaturas da mesma espécie podem ter PVs completamente diferentes, e eles são gerados de forma aleatória no momento da captura. Uma criatura pode ter, por exemplo:

| Atributo | PV |
| --- | --- |
| Vida | 20% |
| Ataque Físico | 33% |
| Ataque Mágico | 94% |
| Defesa Física | 84% |
| Defesa Mágica | 56% |

### Atributos Atuais

Os atributos atuais são calculados no momento de usar e não são armazenados em lugar nenhum. Eles usam o nível, os BVs e os PVs, e são os valores reais da criatura — a base do cálculo de dano das habilidades e da defesa:

```
Atributo = floor( Base × (1 − d + 2d × PV/100) × (1 + (Nível − 1) × k) )
```

As duas constantes estão definidas:

| Constante | Valor | O que é |
| --- | --- | --- |
| `d` | 0.3 | O quanto o potencial pesa: a diferença entre o pior e o melhor potencial, 30% do valor base. Com PV 0% o atributo é 0.7× a base; com PV 100% é 1.3×. |
| `k` | 0.05 | O crescimento por nível: 5% do valor base a cada nível acima do 1. No nível 10 a criatura tem 1.45× o valor base. |

> Uma criatura com todos os PVs em 50% — que é como a criatura inicial nasce — fica com o atributo exatamente igual ao valor base, em qualquer nível. É a propriedade que a fórmula precisa ter: o potencial é o desvio em torno da base, não um multiplicador dela.

A **vida máxima** de uma criatura é o seu atributo de Vitalidade calculado assim. A **vida restante** é o que sobrou dela, e é guardada — a parte que ainda não muda sozinha é o dano, que é do gameplay.

### Potencial Máximo (MP)

O potencial máximo é a média dos PVs: a soma dos cinco PVs dividida por cinco. Uma criatura com todos os PVs em 100% tem potencial máximo de 100%, e é uma criatura que vai atingir o teto da espécie.

## Dano

O dano de um ataque é calculado no momento em que ele acerta, a partir dos atributos dos dois lados, do nível de quem ataca e do elemento da habilidade. Ele não é guardado: só a vida restante é.

```
levelFactor = 1 + (nível − 1) × 0.05
ataque = elemento da habilidade é neutro ? ataque físico : ataque mágico
defesa = elemento da habilidade é neutro ? defesa física : defesa mágica
ratio = ataque / (ataque + defesa)
efetividade = tabela de efetividade[elemento da habilidade][elemento da espécie defendida]
dano = max(1, round(poder × levelFactor × DAMAGE_SCALE × ratio × efetividade))
```

O `poder` é o dano da habilidade no catálogo. No ataque corpo a corpo implícito das criaturas selvagens, o poder é o ataque físico de quem ataca.

As constantes e regras da fórmula são:

| Regra | Valor |
| --- | --- |
| `DAMAGE_SCALE` | 0.25, provisório |
| Elemento neutro | Usa ataque e defesa físicos; os demais elementos usam ataque e defesa mágicos |
| Efetividade | Só fogo contra planta é 1,5×; todo o resto é 1× |
| Piso do dano | 1 |

O `DAMAGE_SCALE` encolhe o poder da habilidade para a escala de vida atual, em que uma criatura no nível 1 tem entre 22 e 28 de vida. Ele é o principal ajuste de balanceamento do combate e é provisório.

A **vida máxima** continua sendo o atributo de vitalidade calculado em [Atributos Atuais](#atributos-atuais); o dano não muda essa regra. Não há crítico, esquiva nem resistência além da defesa e da efetividade.

## Captura

Cada espécie tem a sua chance de captura, definida no cadastro da espécie. Todas as criaturas daquela espécie têm a mesma chance: uma espécie com 0,5% de chance dá 0,5% para qualquer criatura dela.

Os dispositivos de captura carregam um multiplicador. O dispositivo mais simples é 1× — a chance exata da espécie —, e no alfa existem cinco dispositivos, sendo o melhor 5×. Com o dispositivo 5×, a espécie de 0,5% passa a ter 2,5% de chance. Nível, BVs e PVs não entram no cálculo da captura.

O fluxo de captura — dispositivo selecionado na barra, tentativa automática no desmaio — está em [Barra de Habilidades](SKILL_BAR.md#painel-de-dispositivos).

## Habilidades

Cada espécie tem o seu set de habilidades, e espécies diferentes podem compartilhar a mesma habilidade. No catálogo 2.2 cada espécie tem **6 habilidades**, duas de cada tipo:

| Tipo | Habilidades | Como atinge |
| --- | --- | --- |
| `target` | Brasa e Garra | Um alvo dentro do alcance. |
| `area` | Ígnea e Espinho | Uma área a partir do alvo: círculo ou linha. |
| `area_self` | Explosão e Vendaval | Um círculo centrado no conjurador, sem alvo. |

A selvagem usa **todas as 6** habilidades da espécie. A criatura do jogador equipa **4** delas nos slots da barra, escolhidas entre as 6.

As habilidades de área com alvo continuam indo até o alvo. A área sem alvo atinge ao redor do conjurador e **não o próprio lado**: não atinge o conjurador nem os aliados, só os adversários.

Habilidades pertencem a um elemento ou ao elemento neutro. O dano e a efetividade do ataque são baseados no elemento da **habilidade**, e a efetividade da defesa é baseada no elemento da **espécie**.

O uso das habilidades durante a caçada — slots, cooldowns e troca — está em [Barra de Habilidades](SKILL_BAR.md#painel-de-habilidades).

## Drops

Cada espécie tem o seu set de itens, e o foco é dropar apenas o que faz sentido: partes das criaturas. Um quadrúpede pode dropar "Pata de Criatura", "Pele de Criatura" ou "Couro de Criatura", e uma criatura alada pode dropar "Asas de Criatura" — um inseto não carrega uma espada, e nenhum item é inventado.

Cada item do set tem a sua própria chance de drop, e cada criatura morta faz o cálculo para ver se o item sai ou não. Os rolls são independentes: cada item é sorteado separadamente, e uma mesma criatura pode deixar mais de um item. Espécies diferentes podem compartilhar o mesmo item, com chances iguais ou diferentes, dependendo do cadastro.

O loot é creditado na mochila do treinador no abate, item por item, e não no fim da caçada.

Esses itens são vendidos na [loja da cidade](CITY.md#lojas) e viram gold coins, que compram poções e dispositivos.

Criatura capturada não dropa nada. Quem captura apenas desmaiou a criatura, não a finalizou, então ela não tem chance de dropar itens.

> A regra exige uma mecânica no serviço: no desmaio da criatura selvagem, a tentativa de captura é resolvida primeiro, e o drop só é rolado se a captura não tiver acontecido. Se a criatura foi capturada, ela não dropa; se a captura falhou ou não havia dispositivo, o drop acontece normalmente.

## Criaturas Selvagens

As criaturas selvagens não são indivíduos capturados: elas nascem no spawn da área a cada caçada, com a vida cheia e com os atributos calculados a partir do nível definido no ponto de spawn e de todos os potenciais em 50%. Na prática, os atributos delas ficam iguais aos valores de base da espécie, crescidos pelo nível.

Cada ponto de spawn da área define a espécie, o nível e o tempo de respawn. Os pontos ficam separados do spawn da criatura ativa e do treinador, e cada selvagem ocupa o próprio tile: ela bloqueia o tile confirmado e o destino do passo em curso, como os outros atores da caçada.

Enquanto tem alvo, a selvagem olha na direção da criatura ativa, mesmo quando o passo em curso aponta para outro lado. A selvagem usa todas as **6** habilidades da espécie, independentemente do nível, cada uma com a sua chance de uso e o seu intervalo, inclusive as áreas sem alvo. Além das habilidades, ela tem um ataque corpo a corpo implícito: um golpe a cada 2 segundos, quando está adjacente ao alvo. O piso é 1 segundo; o valor atual é 2 segundos para o jogador sobreviver à primeira área.

O dano da selvagem segue a fórmula de [Dano](#dano), e os drops seguem as regras de [Drops](#drops).

## Criaturas Iniciais

O jogador escolhe a sua criatura inicial entre três opções, na [tela de criar treinador](AUTHENTICATION.md#tela-de-criar-treinador). A escolha é obrigatória e faz parte da criação do treinador.

As opções vêm do banco de dados: são as espécies marcadas como iniciais, então mudar quais criaturas aparecem na tela não exige deploy. A criatura escolhida nasce com todos os PVs em 50%.

## Pendências

Os pontos abaixo ainda não foram decididos:

- A fórmula de nível, a fórmula definitiva de experiência e o level-up.
- A tabela de efetividade entre elementos — o exemplo fogo contra planta, com 1,5×, é o único definido.
- O valor definitivo do `DAMAGE_SCALE` e o balanceamento dos valores de dano, de vida e de atributos.
- Se o dispositivo de captura é consumido em toda tentativa ou só na captura bem-sucedida.
- A mecânica no serviço que segura a entrega do drop até saber se a captura aconteceu.
- O catálogo completo de espécies e de habilidades. O que existe hoje está no banco de dados — 5 espécies, 3 delas iniciais, e 5 habilidades — e é o catálogo inicial, não a lista final.
