# Characters

As fontes seguem a estrutura `{body}/{action}/{direction}/{frame}.png`. O nome do frame é numérico, começa em `1` e é sequencial dentro de cada direção. Cada ação pode ter uma quantidade diferente de frames, mas todas as direções de uma mesma ação devem ter a mesma quantidade.

O arquivo `characters.manifest.json` declara as direções válidas, as dimensões dos frames e, para cada corpo, o diretório e o nome do atlas de saída. Assim, novos corpos e nomes de atlas não precisam ser adicionados ao gerador.

Execute `bun run generate:character-atlas` dentro de `apps/web` para gerar os arquivos PNG e JSON. A configuração padrão do corpo `1` gera `male/male-walking-running.png` e `male/male-walking-running.json`, que são os caminhos atualmente carregados pelo runtime.
