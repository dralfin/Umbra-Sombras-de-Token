# 🌑 Umbra — Sombras de Token

**Luz e sombra. Mais profundidade. Uma experiência visual mais imersiva.**

Um módulo para **Foundry Virtual Tabletop v13**, compatível com qualquer sistema de jogo, que projeta sombras realistas a partir das imagens de tokens e tiles.

As sombras são geradas a partir da própria silhueta dos objetos e se adaptam à direção e à altura da fonte de luz, à distância, às paredes do mapa e às condições da cena, trazendo mais profundidade e realismo para suas aventuras.

## ✨ Funcionalidades

### 🌑 Sombras de tokens e tiles

- **Sombras realistas:** projete a silhueta dos tokens na direção oposta à fonte de luz.
- **Altura configurável:** ajuste o comprimento das sombras conforme a altura dos objetos.
- **Múltiplas fontes de luz:** combine sombras produzidas pelo sol, pela lua e por luzes artificiais.
- **Sombras personalizadas:** habilite ou desabilite a projeção individualmente para cada token ou tile.
- **Controle de intensidade:** ajuste a opacidade, a suavização e a quantidade máxima de sombras.
- **Luz própria:** tokens que emitem luz podem projetar sua própria sombra.

### ☀️ Luz natural — Sol e Lua

Configure a iluminação natural de cada cena por meio de um editor visual com prévia em tempo real.

- **Direção do sol:** escolha de onde vem a luz e para qual lado as sombras serão projetadas.
- **Altura do sol:** simule desde um sol próximo ao horizonte, com sombras longas, até o sol a pino, com sombras mínimas.
- **Intensidade luminosa:** ajuste a força da iluminação natural.
- **Configuração por cena:** personalize a iluminação de cada mapa independentemente.

A luz natural é desativada por padrão e pode ser configurada pelo botão de sol nos controles de iluminação, pela configuração da cena ou pela API do módulo.

### 🧱 Paredes e bloqueio de luz

As sombras respeitam a geometria das paredes e os limites da iluminação.

- As paredes bloqueiam a projeção das sombras.
- Portas abertas e paredes sem restrição de luz não interrompem a projeção.
- As sombras das fontes artificiais aparecem apenas nas áreas alcançadas pela luz.
- A projeção considera os obstáculos presentes entre a fonte luminosa e os objetos.

### 🏠 Interiores e áreas cobertas

Transforme casas, cavernas e masmorras em ambientes protegidos da iluminação natural.

- Defina regiões com comportamento de interior.
- Suprima o clima e as sombras naturais dentro dessas áreas.
- Configure a escuridão própria de cada interior.
- Integre o comportamento às ferramentas nativas de regiões do Foundry VTT.

### 🎭 Integração com efeitos

Alguns efeitos podem impedir que um token projete sombras.

- **Caído e Invisível:** reconhecidos por padrão.
- **Status nativos:** o módulo também reconhece os estados `prone` e `invisible` do Foundry.
- **Personalização:** configure os nomes exatos dos efeitos que removem a sombra.

### 🔥 Sombras animadas

As sombras de luzes animadas, como tochas e chamas, podem apresentar um leve tremor para simular a variação natural da iluminação.

O efeito pode ser ativado ou desativado nas configurações do módulo.

## ⚙️ Personalização

O Umbra oferece configurações globais e individuais para adaptar as sombras ao seu mapa e ao desempenho do computador.

- Opacidade máxima das sombras.
- Suavização e desfoque das bordas.
- Altura padrão dos tokens.
- Quantidade máxima de sombras por objeto.
- Comprimento máximo das sombras.
- Distância da luz própria dos tokens.
- Lista de efeitos que removem sombras.
- Animação das sombras de luzes.
- Exibição de sombras individualmente em cada computador.

As opções individuais de tokens e tiles ficam disponíveis na seção **Umbra — Sombras de Token**, dentro das configurações de aparência.

## 🛠️ Diagnóstico

Se um token não estiver projetando sombras, utilize a ferramenta de diagnóstico para identificar possíveis causas.

Execute a seguinte macro ou comando no console do Foundry:

`game.modules.get("umbra-sombras").api.diagnosticarSombra();`

O diagnóstico apresenta um relatório com indicadores de verificação para opções de configuração, efeitos ativos, carregamento da imagem, visibilidade, altura, quantidade de sombras e fontes de luz.

## 🚀 Desempenho

O módulo foi desenvolvido para recalcular as sombras somente quando necessário, reduzindo o trabalho da placa de vídeo durante a sessão.

Para melhorar o desempenho em mapas grandes ou computadores menos potentes, você pode:

- Reduzir a quantidade máxima de sombras por objeto.
- Diminuir a suavização ou desativar o desfoque.
- Desativar o tremor das sombras animadas.
- Ocultar as sombras individualmente no computador que precisar de mais desempenho.

## 📦 Instalação

**Instalação pelo Foundry VTT:**

1. Acesse *Add-on Modules → Install Module*.
2. Cole a URL abaixo no campo **Manifest URL**.
3. Instale o módulo e ative-o no mundo desejado.

`https://github.com/dralfin/Umbra-Sombras-de-Token/releases/latest/download/module.json`

**Instalação manual:** extraia o módulo em `Data/modules/umbra-sombras` e reinicie o Foundry VTT.

## 📋 Requisitos

- **Foundry Virtual Tabletop:** versão 13.
- **Sistema de jogo:** compatível com qualquer sistema.

## ⚠️ Limitações conhecidas

- O recorte das sombras pelas paredes utiliza uma malha que pode produzir bordas levemente facetadas em cantos e paredes muito inclinadas.
- As sombras dos tiles ficam abaixo da camada de tiles; portanto, tiles de piso no mesmo nível podem cobrir as sombras dos objetos.
- A ferramenta de diagnóstico funciona apenas para tokens.

## 🤝 Suporte e contribuições

Encontrou um problema ou tem uma sugestão? Acesse o [repositório do Umbra no GitHub](https://github.com/dralfin/Umbra-Sombras-de-Token) para consultar o projeto e contribuir com melhorias.

---

**Desenvolvido para trazer mais profundidade, realismo e imersão às suas cenas no Foundry VTT.**

**Desenvolvido por Olho da Tormenta**
