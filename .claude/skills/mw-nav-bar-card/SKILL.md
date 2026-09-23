---
name: mw-nav-bar-card
description: >-
  Mexer na barra de navegação MW do Home Assistant (custom:mw-nav-bar-card) —
  a navbar com entalhe líquido, drop-in do custom:navbar-card. Use quando o
  Maycon falar em "MW Nav Bar", "navbar", "barra de navegação", "entalhe",
  "a bolha", "pedras", "trocar o navbar-card", "rota ativa errada", "a barra
  no celular/na direita/no topo", "submenu da navbar", "a logo no botão",
  "release da navbar" ou "o HACS não mostra a versão nova da navbar".
---

# MW Nav Bar Card

Arquivo único `dist/mw-nav-bar-card.js`, sem build. Versão em
`const VERSION = "X.Y.Z"` (o auto-release reescreve essa linha).

## Pré-condições
- Node 18+ para o probe; `python3` para servir a bancada.
- Config do `custom:navbar-card` vale sem mudança — só trocar o `type:`.

## Armadilhas (com o sintoma que você vai ver)
- **Bancada por `file://`** → `tools/preview.html` abre em branco. Servir por HTTP.
- **Default gravado no YAML** → o editor visual passa a escrever chaves que o
  dono não pôs; o probe reprova ("default fora do YAML"). Default mora no código.
- **Repintar no `set hass`** → tela engasga a cada `state_changed`. O card só
  compara o tema; nada de render por entidade.
- **Editar `.github/workflows/*` aqui** → some no próximo `mw-devops.sh apply`.
  A mudança vai em `IA/lib/mw-devops/templates/`.

## DevOps
`develop` (padrão) → PR → `main` → auto-release (bump pelo assunto do commit,
tag, Release com o asset) → `deploy-ha` (HACS baixa, `?v=` no recurso,
conferência no destino). Exige os segredos `HA_URL`/`HA_TOKEN`.

## Verificação
```bash
node --check dist/mw-nav-bar-card.js
node tools/probe.js                                    # 30 provas, "ok" no fim
../../IA/tools/mw-devops.sh check mw-ha-nav-bar-card   # "tudo no padrão"
```
