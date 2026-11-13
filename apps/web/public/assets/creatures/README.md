# Creatures

Em resumo, utilizamos a direção e o identificador da criatura para saber quais frames utilizar, o caminho do frame segue o seguinte padrão: O primeiro frame fica em `/apps/web/public/assets/creatures/{direction}/frame1/{identifier}.png` e o segundo frame fica em `/apps/web/public/assets/creatures/{direction}/frame2/{identifier}.png`. Uma criatura andando ou parada a animação é a mesma, infinitamente circula entre os frames 1 e 2.

## Direção

Os assets estão divididos da seguinte forma, dentro da pasta `apps/web/public/assets/creatures/` existem 4 outras pastas com o nome das 4 posiveis direcões, south, north, west e east. Cada pasta de direção possui outras 2 pastas, essas pastas representam os frames de animação, que para todas as criaturas são 2 frames, `frame1` e `frame2`.

## Frames

Dentro da pasta de frames, existem os arquivos `.png` nomeado com o identificador da criatura, por exemplo, a criatura de `id` 1 andando para o sul vai animar entre os frames `/apps/web/public/assets/creatures/south/frame1/1.png` e `/apps/web/public/assets/creatures/south/frame2/1.png`, se a mesma criatura precisar olhar para o norte, então os frames dessa animação são `/apps/web/public/assets/creatures/north/frame1/1.png` e `/apps/web/public/assets/creatures/north/frame2/1.png`. Mudar a criatura muda o `id`, então por exemplo, se eu preciso da criatura com `id` 120 andando para a esquerda, vou utilizar os frames `/apps/web/public/assets/creatures/west/frame1/120.png` e `/apps/web/public/assets/creatures/west/frame2/120.png`.
