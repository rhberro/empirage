# Autenticação

Este documento cobre todo o processo de autenticação, desde a criação de contas até a criação de personagens.

## Rotas

| Rota              | Tela                                                                | Acesso    |
| ----------------- | ------------------------------------------------------------------- | --------- |
| `/signin`         | [Tela de signin](#tela-de-signin)                                   | Visitante |
| `/signup`         | [Tela de signup](#tela-de-signup)                                   | Visitante |
| `/terms`          | [Tela de termos de serviço](#tela-de-termos-de-serviço)             | Pública   |
| `/privacy`        | [Tela de política de privacidade](#tela-de-política-de-privacidade) | Pública   |
| `/characters`     | [Tela de lista de personagens](#tela-de-lista-de-personagens)       | Protegida |
| `/characters/new` | [Tela de criar personagem](#tela-de-criar-personagem)               | Protegida |
| `/game`           | [Tela do jogo](#tela-do-jogo)                                       | Protegida |

## Tela de Signin

A tela de acesso ao jogo, com o cartão "Entrar no Jogo": os campos de e-mail e senha, e os botões "Entrar" e "Criar Conta", que leva à [tela de signup](#tela-de-signup).

Se o e-mail ou a senha estiverem incorretos, é exibida sempre a mesma mensagem genérica "E-mail ou senha inválidos.", sem indicar qual dos dois está errado.

Na parte inferior da página é exibida a seguinte frase "Ao continuar, você concorda com os [Termos de Serviço](/terms) e a [Política de Privacidade](/privacy) do Empirage.". Ambos os links redirecionam o usuário para os [termos de serviço](#tela-de-termos-de-serviço) e a [política de privacidade](#tela-de-política-de-privacidade) respectivamente.

![Mockup da tela de signin](../assets/signin.png)

## Tela de Signup

A tela de criação de contas, com o cartão "Criar Conta": os campos e-mail, senha e confirmar senha. Os botões são "Criar Conta" e "Entrar", que volta para a [tela de signin](#tela-de-signin).

> Ao realizar o cadastro com sucesso, o usuário já autenticado é redirecionado conforme o [controle de redirecionamento](#controle-de-redirecionamento). Se o e-mail informado já estiver cadastrado, o usuário é redirecionado para a [tela de signin](#tela-de-signin).

Nesse primeiro momento não é necessário confirmação de e-mail.

![Mockup da tela de signup](../assets/signup.png)

## Tela de Termos de Serviço

Tela em branco por enquanto.

## Tela de Política de Privacidade

Tela em branco por enquanto.

## Tela de Lista de Personagens

Tela com o cartão "Lista de Personagens" e uma lista vertical de cards, um por personagem, com no máximo 5. Cada card exibe o avatar, o nome e o nível do personagem e, no lado direito, um botão de deletar. Com menos de 5 personagens, um card "+ Criar personagem" aparece sempre na última posição da lista — um card só, sem slots vazios —, e clicar nele leva à [tela de criar personagem](#tela-de-criar-personagem). Sem nenhum personagem, a lista mostra apenas esse card.

Na parte de baixo da lista ficam dois botões: "Entrar", único para qualquer persomagem e desabilitado até que um seja selecionado, e "Sair da conta", que encerra a sessão.

Ao clicar em um card, o personagem é selecionado e o card ganha um destaque visual na borda. Clicar novamente no card selecionado remove a seleção, e o botão "Entrar" volta a ficar desabilitado.

Com um personagem selecionado, ao clicar em "Entrar" o usuário é redirecionado para a [tela do jogo](PLAY_SCREEN.md) onde pode começar a jogar.

> Ao clicar no botão de deletar, um diálogo de confirmação deve ser exibido para o usuário, evitando exclusões errôneas. A confirmação deve deixar explícito que a remoção é definitiva: itens, criaturas e todo o progresso do personagem são perdidos.

> Ao remover um personagem, todos os dados vinculados a ele, incluindo itens e criaturas, são apagados do banco de dados, como se o personagem nunca tivesse sido criado. A conta em si continua existindo. Se o último personagem for removido, o usuário permanece na tela com apenas o card de criar, sem redirecionamento automático.

![Mockup da lista de personagens](../assets/characters_list.png)

![Mockup da lista de personagens selecionada](../assets/characters_list_selected.png)

## Tela de Criar Personagem

Tela com o cartão "Criar Personagem", no mesmo formato dos outros formulários de autenticação. De cima para baixo ela exibe: o avatar do personagem, que muda de acordo com o gênero selecionado; a seleção de gênero, em uma toggle entre Masculino e Feminino, sendo Masculino a opção selecionada por padrão; e o campo de nome, com as mesmas validações.

Na parte inferior ficam dois botões, "Criar" e "Voltar", sendo que "Voltar" está sempre habilitado.

> O nome deve ter entre 3 e 15 caracteres e conter apenas letras (com ou sem acento), números, espaços, traços e underscores, nada mais do que isso. Espaços no início ou no fim são removidos, e espaços consecutivos não são permitidos. A validação deve apontar o erro de caractere com a mensagem "Apenas caracteres simples, espaços, traços e underscores são permitidos." e o erro de tamanho com a mensagem "O nome deve ter entre 3 e 15 caracteres.".

> O nome é único em todo o jogo, e a comparação ignora diferenças de maiúsculas, minúsculas e acentos, ou seja, "Ana", "ana" e "Aná" são considerados o mesmo nome.

> Como o nome pode ser ocupado por outro jogador entre o "blur" e o clique em "Criar", o servidor deve validar o nome novamente no momento da criação. Se o nome não estiver mais disponível, o personagem não é criado, o usuário permanece na tela e é exibida a mensagem "Nome indisponível".

Ao clicar em criar, o personagem é criado e o usuário é redirecionado para a [tela de lista de personagems](#tela-de-lista-de-personagems).

Cada conta pode ter no máximo 5 personagens, limite que também deve ser imposto pelo servidor. Se a conta já tiver 5 personagens, ao acessar essa tela o usuário é redirecionado para a [tela de lista de personagens](#tela-de-lista-de-personagens), que exibe um [alerta](INTERFACE.md#alerta) com a mensagem "Você atingiu o limite de 5 personagens.".

Ao clicar em voltar, o usuário é redirecionado de volta para a [tela de lista de personagens](#tela-de-lista-de-personagens).

![Mockup da tela de criar personagem](../assets/create_character.png)

![Mockup da tela de criar personagem preenchido e válido](../assets/create_character_valid.png)

![Mockup da tela de criar personagem preenchido e inválido](../assets/create_character_invalid.png)

## Controle de Redirecionamento

Após uma autenticação bem-sucedida, o usuário é redirecionado conforme o estado da conta: Se a conta ainda não possui nenhum personagem, vai para a [tela de criar personagem](#tela-de-criar-personagem); Se a conta já possui personagens, vai para a [tela de lista de personagens](#tela-de-lista-de-personagens).
