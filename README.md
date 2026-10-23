# Umbra - Sombras de Token (Foundry VTT v13)

Sombras projetadas a partir da imagem do token, altura de token, luz natural (editor do sol) e interiores. Funciona em **qualquer sistema**.

## Instalação
Pelo Foundry: *Add-on Modules > Install Module* e cole no campo **Manifest URL**:
`https://github.com/dralfin/Umbra-Sombras-de-Token/releases/latest/download/module.json`

Manualmente:
1. Copie a pasta `umbra-sombras` para `Data/modules/`, reinicie o Foundry e ative o módulo no mundo.
2. Na primeira vez que o mestre entrar, o módulo migra os dados dos módulos antigos: configurações, luz natural das cenas, altura/sombras de tokens e protótipos e os comportamentos “Interior” das regiões. Os dados antigos não são apagados.

## Sombras e luz natural
- **Token** (Configuração do Token > Aparência): altura, projetar sombra e máximo de sombras.
- **Tile** (Configuração do Tile > Aparência): os mesmos campos, mas a sombra vem **desligada por padrão**; ligue nos tiles que são objetos (pilar, estátua, móvel). A sombra do tile aparece abaixo dele, então não cobre o próprio tile (tiles de piso no mesmo nível ficam por cima dela).
- **Editor do sol:** arraste o sol para definir **direção**, **altura** e **força**, com prévia em tempo real. Abre pelo botão de sol nos controles de iluminação, pelo botão na Configuração da Cena ou por macro: `game.modules.get("umbra-sombras").api.abrirMenuLuzNatural();`.
- **Cena** (Configuração da Cena > Iluminação): luz natural, posição e altura do sol, intensidade.
- **Luzes da cena e de tokens:** quanto mais perto da luz, maior a sombra; ela some onde a luz acaba. A sombra cai no lado oposto à fonte.
- **Paredes cortam a sombra:** qualquer sombra (sol, luzes, luz própria; tokens e tiles) para na primeira parede que bloqueia luz, sem vazar. O corte é feito ponto a ponto, então a sombra passa pelo vão de portas abertas e termina rente à parede. Portas abertas e paredes sem restrição de luz não cortam (o estado vem direto do documento da parede). As paredes próximas de cada sombra são buscadas só quando algo muda.
- **Sem sombra por efeito:** tokens com **Caído** ou **Invisível** (nome exato; lista configurável em *Efeitos que removem a sombra*; reconhece também os status `prone` e `invisible`).
- **Tremor:** sombras de luzes com animação (tocha, chama, pulso etc.) tremem levemente.
- **Luz própria:** token que emite luz projeta a própria sombra para trás (*Distância da luz própria do token*; 0 desliga).

## Interiores (regiões)
Crie uma **Região** e adicione o comportamento **“Interior (escurece, suprime clima e sombra)”**. Dentro dela: o clima é suprimido, o sol/lua não projeta sombra e a escuridão do interior vale na região inteira e na força das sombras (nunca mais clara que a da cena). O módulo mantém por conta própria os comportamentos nativos “Suprimir Clima” e “Ajustar nível de escuridão”: não os apague à mão.

## Diagnóstico
Selecione o token e rode `game.modules.get("umbra-sombras").api.diagnosticarSombra();` para ver, com ✔/✘, por que ele tem ou não sombra.

## Desempenho
- As configurações são lidas uma vez por atualização, e cada token/tile só recalcula a sombra quando algo que a afeta mudou (posição, rotação, luzes, cena, efeitos).
- Eventos frequentes de luz e visão só recalculam se as luzes realmente mudaram.
- Malha pequena por sombra, com envio à GPU só quando a sombra muda.
- O tremor das luzes animadas roda a cerca de 20 quadros/s, só nas sombras visíveis na tela (desligue em *Tremor das sombras* se quiser zerar esse custo).
- O desfoque usa uma passada em meia resolução e só existe se houver sombra para desfocar. Em *Desfoque da sombra*, 0 desliga o filtro por completo.
- Para aliviar ainda mais em mapas grandes: reduza o *Máximo de sombras* padrão para 1.
