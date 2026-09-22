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

Exemplos completos em [`examples/`](examples/).

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
