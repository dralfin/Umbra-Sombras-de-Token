# Umbra - Sombras de Token

Módulo para **Foundry VTT v13** que projeta sombras realistas a partir da imagem de tokens e tiles. Funciona em **qualquer sistema**.

A sombra é a própria silhueta da imagem, esticada para o lado oposto à luz, e muda conforme a altura do objeto, a distância da fonte de luz e as paredes do mapa.

## Instalação
No Foundry: *Add-on Modules > Install Module* e cole em **Manifest URL**:

```
https://github.com/dralfin/Umbra-Sombras-de-Token/releases/latest/download/module.json
```

Depois ative o módulo no mundo. Instalação manual: copie esta pasta para `Data/modules/umbra-sombras` e reinicie o Foundry.

## O que o módulo faz

| Recurso | Resumo |
|---|---|
| Sombras de tokens | Silhueta da imagem projetada pelo sol e por luzes da cena e de outros tokens |
| Sombras de tiles | Opcional, por tile (pilares, estátuas, móveis, árvores) |
| Luz natural | Sol/lua por cena, com editor visual de direção, altura e força |
| Paredes | Sombras param nas paredes; portas abertas deixam passar |
| Interiores | Regiões onde não há sol, clima nem sombra natural, com escuridão própria |
| Luz própria | Token que emite luz projeta a própria sombra para trás |
| Efeitos | Caído e Invisível (configurável) removem a sombra |
| Animação | Sombras de luzes animadas (tocha, chama...) tremem levemente |

## Como as sombras se comportam
- **Direção:** a sombra cai no lado oposto à fonte de luz.
- **Tamanho:** quanto mais perto da luz, maior a sombra; ela diminui até sumir na borda do alcance da luz. Para o sol, o comprimento depende da altura do objeto e da altura do sol (sol baixo = sombra longa, sol a pino = sem sombra).
- **Força:** luzes mais fortes e mais próximas geram sombras mais escuras. A luz natural enfraquece conforme a cena escurece, e luz artificial em pleno dia projeta sombra mais fraca.
- **Várias fontes:** cada token pode ter mais de uma sombra ao mesmo tempo. As mais fortes vencem, até o máximo configurado.
- **Paredes:** cada ponto da sombra para na primeira parede que bloqueia luz, sem vazar para o outro lado. Portas abertas e paredes sem restrição de luz não cortam. A luz de uma fonte também só gera sombra onde ela chega (uma parede bloqueia a luz do outro lado).

## Tokens
Em *Configuração do Token > Aparência*, seção **Umbra - Sombras de Token** (vale também para o token protótipo do ator):

- **Altura:** na unidade da cena. Em branco usa a altura padrão do módulo; `0` = sem sombra.
- **Projetar sombra:** liga/desliga a sombra deste token (ligado por padrão).
- **Máximo de sombras:** quantas sombras o token pode ter ao mesmo tempo (0 a 8). Em branco usa o padrão do módulo.

### Luz própria do token
Um token que emite luz projeta a própria sombra para trás, como se a luz estivesse um pouco à frente dele, na direção da rotação do token. A distância é configurável (veja *Configurações*).

### Efeitos que removem a sombra
Tokens com certos efeitos ativos não projetam sombra. O padrão é **Caído** e **Invisível** (o módulo também reconhece os status `prone` e `invisible` do Foundry). Pela configuração você troca a lista por nomes EXATOS de efeitos, separados por vírgula. Acento e maiúsculas não importam, e um efeito de nome parecido (como "Espírito Caído") não conta.

## Tiles
Em *Configuração do Tile > Aparência*, seção **Umbra - Sombras de Token**:

- **Projetar sombra:** **desligado por padrão**. Ligue só nos tiles que são objetos.
- **Altura** e **Máximo de sombras:** iguais aos do token.

A sombra do tile é desenhada logo abaixo dele, então não cobre o próprio tile. Tiles de piso no mesmo nível ficam por cima da sombra. Tiles ocultos não projetam sombra, e tiles que desaparecem ao revelar (teto com oclusão) acompanham a opacidade.

## Luz natural (sol/lua)
Cada cena tem a sua luz natural, desligada por padrão. Ela gera uma sombra direcional em todos os tokens e tiles habilitados.

### Editor do sol
Abra por:
- o botão de sol nos controles de iluminação (somente mestre);
- o botão em *Configuração da Cena > Iluminação*;
- macro: `game.modules.get("umbra-sombras").api.abrirMenuLuzNatural();`

No editor, arraste o sol em três controles, com **prévia em tempo real** no mapa:
- **Posição do sol** (círculo): direção. N no topo do mapa; a sombra cai do lado oposto. Um token de exemplo mostra o resultado.
- **Altura do sol** (barra da esquerda): de 5° (quase no horizonte, sombra longa) a 90° (a pino, sem sombra).
- **Força do sol** (barra da direita): de 0% a 100%.

**Salvar** grava na cena; **Cancelar** volta ao valor anterior. Os mesmos valores existem como campos numéricos em *Configuração da Cena > Iluminação*: posição do sol (0 = norte, 90 = leste, 180 = sul, 270 = oeste), altura (5 a 90) e intensidade (0 a 1).

## Interiores (regiões)
Para marcar uma área coberta (casa, caverna, masmorra):

1. Crie uma **Região** cobrindo a área.
2. Adicione o comportamento **Interior (escurece, suprime clima e sombra)**.
3. Ajuste a **Escuridão do interior** (0 a 1).

Dentro da região:
- o clima é suprimido;
- o sol/lua não projeta sombra natural;
- a escuridão do interior vale na região inteira e na força das sombras (nunca fica mais clara que a da cena).

O módulo cria e mantém, por conta própria, os comportamentos nativos *Suprimir clima (Interior)* e *Escurecer interior (Interior)* dentro da região. Não apague esses dois à mão.

## Configurações do módulo
Em *Configurações > Módulos > Umbra - Sombras de Token*:

| Configuração | Escopo | Descrição |
|---|---|---|
| Mostrar sombras | só para você | Desligue para ganhar desempenho neste computador |
| Opacidade máxima das sombras | mundo | Opacidade de uma sombra com força total |
| Suavização das sombras | mundo | Desfoque das bordas; `0` desliga o filtro |
| Altura padrão do token | mundo | Usada quando o token/tile não tem altura própria |
| Máximo padrão de sombras por token | mundo | Usado quando o token/tile não define o seu |
| Comprimento máximo da sombra | mundo | Alcance da sombra colada na luz, como múltiplo da altura |
| Efeitos que removem a sombra | mundo | Lista de nomes exatos separados por vírgula |
| Distância da luz própria do token | mundo | Em quadrados; `0` desliga a sombra da luz própria |
| Sombras tremem com a animação da luz | mundo | Tremor leve em sombras de luzes animadas |

## Desempenho
O módulo foi feito para ser leve:
- cada token/tile só recalcula a sombra quando algo que a afeta muda (posição, rotação, luzes, cena, efeitos);
- eventos frequentes de luz e visão só disparam recálculo se as luzes realmente mudaram;
- uma malha pequena por sombra, enviada à placa de vídeo só quando a sombra muda;
- o tremor roda a cerca de 20 quadros por segundo, só nas sombras animadas que aparecem na tela;
- o desfoque usa uma passada em meia resolução e só existe se houver sombra para desfocar;
- as paredes próximas de cada sombra são buscadas só quando algo muda.

Para aliviar ainda mais em mapas grandes: reduza o **Máximo padrão de sombras** para 1, diminua a **Suavização** (0 desliga o filtro), desligue o **tremor** ou use **Mostrar sombras** nos computadores mais fracos.

## Diagnóstico
Se um token não mostra sombra, selecione-o e rode no console ou numa macro:

```js
game.modules.get("umbra-sombras").api.diagnosticarSombra();
```

O módulo sussurra para você um relatório com ✔/✘ dos motivos possíveis: opção ligada, projetar sombra, efeito que remove a sombra, imagem carregada, visibilidade, altura, máximo de sombras, luz natural e luzes que alcançam o token.

## Limitações
- O corte pelas paredes é feito por vértice numa malha de 9 colunas, então em cantos e paredes muito inclinadas a borda pode ficar levemente facetada.
- Sombras de tiles ficam abaixo da camada de tiles: um tile de piso no mesmo nível cobre a sombra de um objeto.
- O diagnóstico funciona só para tokens.

## Autor
Olho da Tormenta
