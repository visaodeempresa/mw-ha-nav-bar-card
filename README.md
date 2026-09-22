# MW Nav Bar Card

Barra de navegação para o Home Assistant com **entalhe líquido**: o item ativo é
uma bolha assentada num recorte côncavo da borda da barra. Ao tocar outro item a
bolha salta para fora — o entalhe se desfaz —, voa em arco deformada como gota, e
pousa no destino, onde o entalhe se forma de novo.

`custom:mw-nav-bar-card` · arquivo único, sem build · instalação por HACS
(tipo Dashboard).

---

## Drop-in do `navbar-card`

A config do `custom:navbar-card` funciona sem alteração — trocar o `type:` basta:

```yaml
type: custom:mw-nav-bar-card       # era custom:navbar-card
routes:
  - { url: /sala-7-1, label: SALA, icon: mdi:sofa }
haptic: true
desktop: { position: left }
```

O bloco `styles:` de CSS cru que o `navbar-card` exigia **não é mais preciso**:
papel, cor, relevo e sombra são opções da peça.

## Opções

| chave | default | o que faz |
|---|---|---|
| `routes` | — | lista de `{url, label, icon}`; aceita `tap_action` por rota |
| `anim` | `liquid` | `liquid` (entalhe + voo) · `slide` · `none` |
| `paper` / `paper_dark` | `paper` | tom do papel nos temas claro e escuro (49 opções cada) |
| `accent` | `var(--primary-color)` | cor da bolha (qualquer cor CSS) |
| `bubble` | `46` | diâmetro da bolha, em px |
| `float` | `true` | barra flutuante com margem; `false` cola na borda |
| `max_width` | `560` | largura máxima da barra deitada |
| `haptic` | `true` | vibra ao tocar (dentro do app companion) |
| `breakpoints` | `{tablet: 768, desktop: 1280}` | largura mínima de cada faixa |
| `mobile` / `tablet` / `desktop` | ver abaixo | perfil por tamanho de tela |

Perfil — `{ position, show, hidden }`:

| faixa | `position` | `show` |
|---|---|---|
| `mobile` (`< 768`) | `bottom` | `icon` |
| `tablet` (`768–1279`) | `bottom` | `both` |
| `desktop` (`≥ 1280`) | `left` | `both` |

`position`: `bottom` · `top` · `left` · `right` — o entalhe acompanha a borda.
`show`: `icon` · `label` · `both`. `hidden: true` some com a barra na faixa.

## Exemplos

Todos também em [`examples/`](examples/), prontos para colar. As entidades e as
rotas são as de uma casa real — troque pelas suas.

### 1 · O mínimo que funciona

```yaml
type: custom:mw-nav-bar-card
routes:
  - { url: /cozinha-7-1,           label: COZINHA,           icon: mdi:food-takeout-box }
  - { url: /sala-7-1,              label: SALA,              icon: mdi:sofa }
  - { url: /escritorio-7-1,        label: ESCRITÓRIO,        icon: mdi:monitor }
  - { url: /quarto-7-1,            label: QUARTO,            icon: mdi:laptop }
  - { url: /banheiro-social-7-1,   label: BANHEIRO SOCIAL,   icon: mdi:shower-head }
  - { url: /suite-7-1,             label: SUÍTE,             icon: mdi:bed }
  - { url: /banheiro-da-suite-7-1, label: BANHEIRO DA SUÍTE, icon: mdi:shower }
```

### 2 · Drop-in do `navbar-card`

```yaml
type: custom:mw-nav-bar-card        # era: custom:navbar-card
routes:
  - { url: /cozinha-7-1, label: COZINHA, icon: mdi:food-takeout-box }
  - { url: /sala-7-1,    label: SALA,    icon: mdi:sofa }
  - { url: /suite-7-1,   label: SUÍTE,   icon: mdi:bed }
haptic: true
desktop: { position: left }
```

O bloco `styles:` de CSS cru que o `navbar-card` exigia **não é mais preciso**.

### 3 · Um desenho por tamanho de tela

```yaml
type: custom:mw-nav-bar-card
accent: "#b3246b"
paper: blue-2
paper_dark: indigo-5
routes:
  - { url: /cozinha-7-1, label: COZINHA, icon: mdi:food-takeout-box }
  - { url: /sala-7-1,    label: SALA,    icon: mdi:sofa }
  - { url: /suite-7-1,   label: SUÍTE,   icon: mdi:bed }
mobile:  { position: bottom, show: icon }
tablet:  { position: bottom, show: both }
desktop: { position: left,   show: both }
```

### 4 · Papel e cor

```yaml
type: custom:mw-nav-bar-card
paper: blue-2            # 49 tons: <matiz>-<1..7> (1 = quase branco)
paper_dark: indigo-5     # 49 tons de noite
accent: "#b3246b"        # qualquer cor CSS, ou var(--mw-cor-do-ambiente)
bubble: 52               # diâmetro da bolha, em px
routes:
  - { url: /sala-7-1,  label: SALA,  icon: mdi:sofa }
  - { url: /suite-7-1, label: SUÍTE, icon: mdi:bed }
```

O tema escuro é o que o HA diz (`themes.darkMode`), não o relógio.

### 5 · Deslizando, colada no topo

```yaml
type: custom:mw-nav-bar-card
anim: slide              # a bolha não sai da barra; o entalhe viaja com ela
float: false             # colada na borda, sem margem e sem canto arredondado
paper: green-2
paper_dark: green-6
accent: "#2e7d32"
mobile:  { position: top, show: icon }
tablet:  { position: top, show: both }
desktop: { position: top, show: both }
routes:
  - { url: /reino-do-dende-7-0, label: CASA,  icon: mdi:home }
  - { url: /clima-3-0,          label: CLIMA, icon: mdi:weather-partly-cloudy }
  - { url: /saude-3-0,          label: SAÚDE, icon: mdi:heart-pulse }
```

### 6 · Em pé na direita, escondida no celular

```yaml
type: custom:mw-nav-bar-card
mobile:  { hidden: true }
tablet:  { position: right, show: icon }
desktop: { position: right, show: both }
breakpoints: { tablet: 700, desktop: 1100 }
routes:
  - { url: /planta-mw-01,     label: PLANTA,    icon: mdi:floor-plan }
  - { url: /home-security-01, label: SEGURANÇA, icon: mdi:cctv }
  - { url: /mw-components,    label: PEÇAS,     icon: mdi:puzzle }
```

### 7 · Rota que não navega

```yaml
type: custom:mw-nav-bar-card
routes:
  - { url: /sala-7-1, label: SALA, icon: mdi:sofa }
  - label: LETÍCIA
    icon: mdi:microphone
    entity: assist_satellite.leticia_escritorio
    tap_action: { action: more-info }
  - label: CENA
    icon: mdi:movie-open
    tap_action:
      action: call-service
      service: scene.turn_on
      target: { entity_id: scene.sala_cinema }
```

O `entity` da rota viaja junto com a ação — sem ele o `more-info` não sabe de
quem é a ficha.

## O que custa na tela

O card **não depende de entidade nenhuma**: o `hass` que o HA empurra a cada
`state_changed` da casa só é comparado com o tema anterior — nenhum pixel é
repintado por causa de uma lâmpada.

A animação escreve o atributo `d` de um `<path>` durante as duas fases de
entalhe (~15 quadros por toque). A fase longa — o voo — é `transform` puro.
Parado, o custo é zero: o `requestAnimationFrame` se cancela ao fim da
transição. Quem preferir pagar ainda menos usa `anim: slide` ou `anim: none`;
`prefers-reduced-motion` já desliga a animação sozinho.

## Instalação

HACS → repositório customizado `visaodeempresa/mw-ha-nav-bar-card`, categoria
**Dashboard**.

## Verificação

```bash
node --check dist/mw-nav-bar-card.js
node tools/probe.js        # 30 provas: geometria, rota ativa, perfis, editor
```

Bancada visual (não abre por `file://` — sirva por HTTP):

```bash
python3 -m http.server 8799 --directory . && open http://localhost:8799/tools/preview.html
```

---

<!-- MW-BRAND:BEGIN — gerado por IA/tools/mw-brand.sh · não editar à mão -->
<p align="center">
  <a href="https://github.com/visaodeempresa">
    <img src="https://mayconsoftware.github.io/assets/ve/LOGO_VISAO_DE_EMPRESA_HEIGHT-64px.png" alt="Visão de Empresa — MAYCON WILLIAN OLIVEIRA" height="64">
  </a>
  <br>
  <sub><b>Visão de Empresa</b> · card de navegação para o Home Assistant</sub>
</p>
<!-- MW-BRAND:END -->
