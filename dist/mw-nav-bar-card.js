/* MW Nav Bar Card — custom:mw-nav-bar-card
 *
 * A barra de navegação da casa, com ENTALHE LÍQUIDO: o item ativo é uma bolha
 * assentada num recorte côncavo da borda da barra. Ao tocar outro item a bolha
 * salta para fora (o entalhe se desfaz), voa em arco deformada como gota, e
 * pousa no destino, onde o entalhe se forma de novo.
 *
 * Drop-in do `custom:navbar-card`: a mesma config (`routes`, `haptic`,
 * `desktop.position`) funciona sem alteração — trocar o `type:` basta.
 *
 * Arquivo único, sem build: este arquivo é fonte E artefato (padrão da casa).
 *
 * Invariante: MONTAR UMA VEZ, PINTAR POR VARIÁVEL CSS. O card não depende de
 * entidade nenhuma — `hass` só é guardado para o editor. Redesenhar a cada
 * `state_changed` é o jeito mais fácil de travar o celular.
 *
 * A animação escreve o atributo `d` de um <path> durante ~15 quadros por toque
 * (as fases de entalhe). A fase longa — o voo — é `transform` puro. Parado, o
 * custo é zero: o requestAnimationFrame se cancela ao fim da transição.
 *
 * Autor: MAYCON WILLIAN OLIVEIRA <visaodeempresa@gmail.com>
 */
(() => {
  "use strict";

  const VERSION = "0.1.1";

  /* ==== blocos embutidos de IA/lib — conferidos por IA/tools/check-embeds.sh ==== */
  // >>> paper-palette v1 — fonte canônica: /Volumes/SSD-T1-01/CLAUDE-SSD/IA/lib/paper-palette/paper-palette.js
  // 49 papéis encardidos: 7 matizes do arco-íris × 7 tons (1 = quase branco,
  // 7 = mais encardido). Saturação baixa de propósito — papel descansa a vista.
  const PAPER_HUES = [
    ["red", "Vermelho", 6], ["orange", "Laranja", 27], ["yellow", "Amarelo", 47],
    ["green", "Verde", 96], ["blue", "Azul", 203], ["indigo", "Anil", 236],
    ["violet", "Violeta", 283],
  ];
  const PAPER_TONES = [[97, 6], [96, 9], [94, 12], [92, 15], [90, 18], [88, 21], [85, 24]];
  const PAPER_DEFAULT = "linear-gradient(145deg, #fdfaf3, #e8e3d8)";
  const paperGradient = (key) => {
    const m = /^([a-z]+)-([1-7])$/.exec(String(key || "").trim());
    if (!m) return PAPER_DEFAULT;
    const hue = PAPER_HUES.find((h) => h[0] === m[1]);
    if (!hue) return PAPER_DEFAULT;
    const [l, s] = PAPER_TONES[+m[2] - 1];
    return `linear-gradient(145deg, hsl(${hue[2]}, ${s}%, ${l}%), hsl(${hue[2]}, ${s + 4}%, ${l - 7}%))`;
  };
  const paperOptions = () => [{ value: "paper", label: "Papel original (creme)" }].concat(
    ...PAPER_HUES.map((h) => PAPER_TONES.map((t, i) => ({
      value: `${h[0]}-${i + 1}`,
      label: `${h[1]} · tom ${i + 1}${i === 0 ? " (mais claro)" : i === 6 ? " (mais encardido)" : ""}`,
    }))));
  // <<< paper-palette v1
  // >>> paper-dark-palette v1 — fonte canônica: /Volumes/SSD-T1-01/CLAUDE-SSD/IA/lib/paper-dark-palette/paper-dark-palette.js
  // 49 papéis de noite: as mesmas 7 matizes do paper-palette v1 × 7 tons
  // (1 = papel escuro mais claro, 7 = mais encardido). A saturação sobe mais
  // rápido que na rampa clara porque matiz em luminosidade baixa desaparece.
  const PAPER_DARK_HUES = [
    ["red", "Vermelho", 6], ["orange", "Laranja", 27], ["yellow", "Amarelo", 47],
    ["green", "Verde", 96], ["blue", "Azul", 203], ["indigo", "Anil", 236],
    ["violet", "Violeta", 283],
  ];
  const PAPER_DARK_TONES = [[26, 10], [24, 13], [21, 16], [19, 19], [16, 22], [14, 25], [11, 28]];
  const PAPER_DARK_DEFAULT = "linear-gradient(145deg, #2b2825, #161411)";
  const paperDarkGradient = (key) => {
    const m = /^([a-z]+)-([1-7])$/.exec(String(key || "").trim());
    if (!m) return PAPER_DARK_DEFAULT;
    const hue = PAPER_DARK_HUES.find((h) => h[0] === m[1]);
    if (!hue) return PAPER_DARK_DEFAULT;
    const [l, s] = PAPER_DARK_TONES[+m[2] - 1];
    return `linear-gradient(145deg, hsl(${hue[2]}, ${s}%, ${l}%), hsl(${hue[2]}, ${s + 6}%, ${Math.max(4, l - 6)}%))`;
  };
  const paperDarkOptions = () => [{ value: "paper", label: "Papel de noite (grafite)" }].concat(
    ...PAPER_DARK_HUES.map((h) => PAPER_DARK_TONES.map((t, i) => ({
      value: `${h[0]}-${i + 1}`,
      label: `${h[1]} · tom ${i + 1}${i === 0 ? " (mais claro)" : i === 6 ? " (mais escuro)" : ""}`,
    }))));
  // Tinta que se lê sobre o papel do modo pedido. Não é contraste calculado:
  // é o par fixo que a casa usa, para dois cards lado a lado combinarem.
  const paperInk = (dark) => (dark
    ? { text: "rgba(247, 244, 236, 0.94)", dim: "rgba(247, 244, 236, 0.62)", line: "rgba(255, 255, 255, 0.14)" }
    : { text: "rgba(28, 25, 20, 0.92)", dim: "rgba(28, 25, 20, 0.58)", line: "rgba(0, 0, 0, 0.14)" });
  // <<< paper-dark-palette v1

  /* ==== feedback táctil ====
   * O app companion (iOS/Android) escuta o evento "haptic" na window e chama o
   * motor nativo — é assim que o próprio frontend do HA vibra. Fora dele, cai
   * no navigator.vibrate (Chrome do Android; o Safari do iPhone não vibra em
   * página nenhuma, só dentro do companion). */
  const VIBRATE_MS = { selection: 5, light: 10, success: 15, medium: 20, heavy: 30 };
  const haptic = (kind) => {
    try {
      window.dispatchEvent(new CustomEvent("haptic", { detail: kind }));
      if (navigator.vibrate) navigator.vibrate(VIBRATE_MS[kind] || 10);
    } catch (_) { /* nunca lança */ }
  };

  /* ==== defaults ====
   * Default não polui o YAML: o editor remove do config tudo que for igual. */
  const PROFILES = ["mobile", "tablet", "desktop"];
  const DEFAULTS = {
    anim: "liquid",            // liquid | slide | none
    float: true,
    paper: "paper",
    paper_dark: "paper",
    accent: "",                // vazio = var(--primary-color)
    bubble: 46,
    max_width: 560,
    breakpoints: { tablet: 768, desktop: 1280 },
    mobile: { position: "bottom", show: "icon", hidden: false },
    tablet: { position: "bottom", show: "both", hidden: false },
    desktop: { position: "left", show: "both", hidden: false },
  };

  const DUR = 460;               // ms da transição inteira
  const T_EJECT = 0.26, T_LAND = 0.74;
  const S1 = 15, S2 = 1;         // largura das rampas do entalhe (Bézier)

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const rnd = (n) => Math.round(n * 100) / 100;

  /* ==== papel: dois tons de parada para o gradiente do SVG ====
   * Usa as tabelas canônicas embutidas acima; o gradiente do <path> é um
   * <linearGradient>, não um `background`, então a cor sai em hsl(). */
  const paperStops = (key, dark) => {
    const HUES = dark ? PAPER_DARK_HUES : PAPER_HUES;
    const TONES = dark ? PAPER_DARK_TONES : PAPER_TONES;
    const m = /^([a-z]+)-([1-7])$/.exec(String(key || "").trim());
    if (!m) return dark ? ["#2b2825", "#161411"] : ["#fdfaf3", "#e8e3d8"];
    const hue = HUES.find((h) => h[0] === m[1]);
    if (!hue) return dark ? ["#2b2825", "#161411"] : ["#fdfaf3", "#e8e3d8"];
    const [l, s] = TONES[+m[2] - 1];
    const d2 = dark ? [s + 6, Math.max(4, l - 6)] : [s + 4, l - 7];
    return [`hsl(${hue[2]}, ${s}%, ${l}%)`, `hsl(${hue[2]}, ${d2[0]}%, ${d2[1]}%)`];
  };

  /* ==== geometria ====
   * Tudo é calculado numa barra deitada de comprimento L e espessura T, com a
   * borda do entalhe em t=0. `mapper()` leva (l,t) para (x,y) conforme a
   * posição — uma matemática só para as quatro bordas da tela. O espelhamento
   * inverte o sentido dos arcos, daí o `flip`. */
  const mapper = (pos, L, T) => {
    if (pos === "top") return { m: (l, t) => [l, T - t], flip: true, w: L, h: T };
    if (pos === "left") return { m: (l, t) => [T - t, l], flip: false, w: T, h: L };
    if (pos === "right") return { m: (l, t) => [t, l], flip: true, w: T, h: L };
    return { m: (l, t) => [l, t], flip: false, w: L, h: T };           // bottom
  };

  /* Contorno da barra. `notch` = {cl, cy, r} com cy negativo (centro da bolha
   * acima da borda). Sem interseção com a borda (|cy| >= r), devolve o
   * retângulo arredondado — é assim que o entalhe "some" sozinho. */
  const plateD = (pos, L, T, R, notch) => {
    const { m, flip } = mapper(pos, L, T);
    const P = (l, t) => { const p = m(l, t); return `${rnd(p[0])},${rnd(p[1])}`; };
    const sw = flip ? 0 : 1, nsw = flip ? 1 : 0;
    let d = `M ${P(R, 0)}`;
    if (notch) {
      const { cl, cy, r } = notch;
      const b = -cy;
      if (b > 0 && b < r) {
        const a = -r - S2;
        const den = a * a + b * b;
        const n2 = Math.sqrt(Math.max(0, b * b * r * r * (den - r * r)));
        const xA = (a * r * r - n2) / den, xB = (a * r * r + n2) / den;
        const yA = Math.sqrt(Math.max(0, r * r - xA * xA));
        const yB = Math.sqrt(Math.max(0, r * r - xB * xB));
        const px = yA > yB ? xA : xB, py = yA > yB ? yA : yB;
        const l0 = clamp(cl + a - S1, R, L - R), l5 = clamp(cl - a + S1, R, L - R);
        d += ` L ${P(l0, 0)}`;
        d += ` Q ${P(cl + a, 0)} ${P(cl + px, cy + py)}`;
        d += ` A ${rnd(r)} ${rnd(r)} 0 0 ${nsw} ${P(cl - px, cy + py)}`;
        d += ` Q ${P(cl - a, 0)} ${P(l5, 0)}`;
      }
    }
    d += ` L ${P(L - R, 0)} A ${R} ${R} 0 0 ${sw} ${P(L, R)}`;
    d += ` L ${P(L, T - R)} A ${R} ${R} 0 0 ${sw} ${P(L - R, T)}`;
    d += ` L ${P(R, T)} A ${R} ${R} 0 0 ${sw} ${P(0, T - R)}`;
    d += ` L ${P(0, R)} A ${R} ${R} 0 0 ${sw} ${P(R, 0)} Z`;
    return d;
  };

  /* Profundidade normalizada d (0..1) → altura do centro da bolha.
   * d=1: encaixada no entalhe. d=0: fora da barra, sem entalhe nenhum. */
  const cyOf = (d, r) => -r * (0.5 * d + 1.25 * (1 - d));

  const isVertical = (pos) => pos === "left" || pos === "right";

  /* ==== tema ==== */
  const lum = (css) => {
    const s = String(css).trim();
    let r = 255, g = 255, b = 255;
    const hx = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    if (hx) {
      const h = hx[1].length === 3 ? hx[1].replace(/./g, (c) => c + c) : hx[1];
      r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
    } else {
      const rg = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(s);
      if (rg) { r = +rg[1]; g = +rg[2]; b = +rg[3]; } else return 1;
    }
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };

  const navigate = (url, replace) => {
    if (!url) return;
    if (/^https?:/i.test(url)) { window.open(url, "_blank", "noopener"); return; }
    history[replace ? "replaceState" : "pushState"](null, "", url);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: !!replace } }));
  };

  /* ================================ CARD ================================ */
  class MwNavBarCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._i = -1;
      this._raf = 0;
      this._anim = null;
      this._lastD = -1;
      this._built = false;
      this._onRoute = () => this._syncRoute(true);
      this._onResize = () => this._layout();
    }

    setConfig(config) {
      if (!config || !Array.isArray(config.routes) || !config.routes.length) {
        throw new Error("mw-nav-bar-card: informe ao menos uma rota em `routes`");
      }
      const c = { ...DEFAULTS, ...config };
      c.breakpoints = { ...DEFAULTS.breakpoints, ...(config.breakpoints || {}) };
      // `desktop: {position: left}` do navbar-card cai aqui sem tradução.
      for (const p of PROFILES) c[p] = { ...DEFAULTS[p], ...(config[p] || {}) };
      c.routes = config.routes.map((r) => ({ ...r }));
      this._config = c;
      this._built = false;
      if (this.isConnected) this._build();
    }

    /* O HA empurra um `hass` novo a cada state_changed da casa. Aqui isso custa
     * uma comparação de booleano: só o troca-tema mexe em pixel. */
    set hass(h) {
      this._hass = h;
      const dark = h && h.themes ? !!h.themes.darkMode : undefined;
      if (dark !== undefined && dark !== this._dark && this._built) this._paintTheme();
    }
    get hass() { return this._hass; }

    getCardSize() { return 1; }

    connectedCallback() {
      window.addEventListener("location-changed", this._onRoute);
      window.addEventListener("popstate", this._onRoute);
      window.addEventListener("resize", this._onResize);
      if (this._config) this._build();
    }

    disconnectedCallback() {
      window.removeEventListener("location-changed", this._onRoute);
      window.removeEventListener("popstate", this._onRoute);
      window.removeEventListener("resize", this._onResize);
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    }

    /* ---------- montagem: uma vez ---------- */
    _build() {
      if (this._built || !this._config) return;
      const c = this._config;
      const routes = c.routes;
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; height: 0; }
          .wrap {
            position: fixed; z-index: 4; overflow: visible;
            -webkit-tap-highlight-color: transparent;
          }
          .wrap.hidden { display: none; }
          svg { display: block; overflow: visible; }
          .shape {
            filter: drop-shadow(0 6px 14px rgba(0,0,0,.22)) drop-shadow(0 2px 4px rgba(0,0,0,.14));
          }
          .items { position: absolute; inset: 0; }
          .item {
            position: absolute; display: flex; align-items: center; justify-content: center;
            flex-direction: column; gap: 2px; cursor: pointer; user-select: none;
            color: var(--mw-nav-ink); background: none; border: 0; padding: 0;
            transition: opacity .18s ease;
          }
          .item ha-icon { --mdc-icon-size: 24px; transition: opacity .16s ease, transform .16s ease; }
          .item .lbl {
            font-size: 11px; line-height: 1.2; font-weight: 500; letter-spacing: .02em;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            max-width: 100%; color: var(--mw-nav-dim);
          }
          .item.active ha-icon { opacity: 0; }
          .item.active .lbl { color: var(--mw-nav-accent); font-weight: 700; }
          .bubble {
            position: absolute; left: 0; top: 0; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            background: var(--mw-nav-accent); color: var(--mw-nav-on-accent);
            box-shadow: 0 6px 14px var(--mw-nav-accent-shadow), inset 0 -2px 6px rgba(0,0,0,.18);
            will-change: transform; pointer-events: none;
          }
          .bubble ha-icon { --mdc-icon-size: 22px; }
          @media (prefers-reduced-motion: reduce) { .item ha-icon { transition: none; } }
        </style>
        <div class="wrap">
          <svg xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="paper" x1="0" y1="0" x2="0.7" y2="1">
                <stop class="s1" offset="0"/><stop class="s2" offset="1"/>
              </linearGradient>
            </defs>
            <path class="shape" fill="url(#paper)"/>
          </svg>
          <div class="items">
            ${routes.map((r, i) => `
              <button class="item" data-i="${i}" title="${(r.label || "").replace(/"/g, "&quot;")}">
                <ha-icon icon="${r.icon || "mdi:circle-outline"}"></ha-icon>
                <span class="lbl">${r.label || ""}</span>
              </button>`).join("")}
          </div>
          <div class="bubble"><ha-icon></ha-icon></div>
        </div>`;

      const sr = this.shadowRoot;
      this.$ = {
        wrap: sr.querySelector(".wrap"),
        svg: sr.querySelector("svg"),
        path: sr.querySelector(".shape"),
        s1: sr.querySelector(".s1"),
        s2: sr.querySelector(".s2"),
        items: Array.from(sr.querySelectorAll(".item")),
        bubble: sr.querySelector(".bubble"),
        bicon: sr.querySelector(".bubble ha-icon"),
      };
      this.$.items.forEach((el) => {
        el.addEventListener("click", () => this._pick(+el.dataset.i, true));
      });
      this._built = true;
      this._syncRoute(false);
      this._layout();
    }

    /* ---------- perfil em uso ---------- */
    _profile() {
      const c = this._config, w = window.innerWidth || 1024;
      const name = w >= c.breakpoints.desktop ? "desktop" : (w >= c.breakpoints.tablet ? "tablet" : "mobile");
      return { name, ...c[name] };
    }

    /* ---------- layout: só em resize/mudança de perfil ---------- */
    _layout() {
      if (!this._built) return;
      const c = this._config, p = this._profile(), n = c.routes.length;
      this.$.wrap.classList.toggle("hidden", !!p.hidden);
      if (p.hidden) return;

      const vert = isVertical(p.position);
      const labels = p.show === "label" || p.show === "both";
      const icons = p.show !== "label";
      const T = vert ? (labels ? 88 : 64) : (labels ? 74 : 62);
      const slot = vert ? (labels ? 72 : 58) : clamp(
        (Math.min(window.innerWidth - 24, c.max_width)) / n, 48, 108);
      const L = vert ? n * slot : clamp(n * slot, n * 48, Math.min(window.innerWidth - 24, c.max_width));
      const R = c.float ? Math.min(T / 2, 28) : 0;

      this._geo = { p, vert, L, T, R, slot, n, labels, icons };

      const { w, h } = mapper(p.position, L, T);
      this.$.svg.setAttribute("width", w);
      this.$.svg.setAttribute("height", h);
      this.$.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

      const pad = c.float ? 12 : 0;
      const st = this.$.wrap.style;
      st.width = `${w}px`; st.height = `${h}px`;
      st.left = st.right = st.top = st.bottom = "auto"; st.transform = "none";
      if (p.position === "bottom") {
        st.left = "50%"; st.transform = "translateX(-50%)";
        st.bottom = `calc(env(safe-area-inset-bottom, 0px) + ${pad}px)`;
      } else if (p.position === "top") {
        st.left = "50%"; st.transform = "translateX(-50%)";
        st.top = `calc(env(safe-area-inset-top, 0px) + ${pad + 56}px)`;
      } else if (p.position === "left") {
        st.top = "50%"; st.transform = "translateY(-50%)"; st.left = `${pad}px`;
      } else {
        st.top = "50%"; st.transform = "translateY(-50%)"; st.right = `${pad}px`;
      }

      // itens nas fatias
      const size = vert ? { wpx: T, hpx: slot } : { wpx: slot, hpx: T };
      this.$.items.forEach((el, i) => {
        const l = (i + 0.5) * (L / n);
        const [x, y] = mapper(p.position, L, T).m(l, T / 2);
        el.style.width = `${size.wpx}px`;
        el.style.height = `${size.hpx}px`;
        el.style.left = `${x - size.wpx / 2}px`;
        el.style.top = `${y - size.hpx / 2}px`;
        el.querySelector("ha-icon").style.display = icons ? "" : "none";
        el.querySelector(".lbl").style.display = labels ? "" : "none";
        el.querySelector(".lbl").style.maxWidth = `${size.wpx - 6}px`;
      });

      this.$.bubble.style.width = this.$.bubble.style.height = `${c.bubble}px`;
      this._paintTheme();
      this._render(this._i, 1, this._i);
    }

    /* ---------- cores ---------- */
    _paintTheme() {
      const c = this._config;
      const cs = getComputedStyle(this);
      const bg = cs.getPropertyValue("--card-background-color") || cs.getPropertyValue("--primary-background-color") || "#fff";
      // O HA sabe o tema; a luminosidade do fundo é a queda para a bancada e
      // para quem monta o card fora do frontend.
      const dark = this._hass && this._hass.themes && this._hass.themes.darkMode !== undefined
        ? !!this._hass.themes.darkMode : lum(bg) < 0.45;
      this._dark = dark;
      const [a, b] = paperStops(dark ? c.paper_dark : c.paper, dark);
      this.$.s1.setAttribute("stop-color", a);
      this.$.s2.setAttribute("stop-color", b);
      const ink = dark
        ? { text: "rgba(247, 244, 236, 0.94)", dim: "rgba(247, 244, 236, 0.62)" }
        : { text: "rgba(28, 25, 20, 0.92)", dim: "rgba(28, 25, 20, 0.58)" };
      const accent = c.accent || "var(--primary-color, #03a9f4)";
      const st = this.$.wrap.style;
      st.setProperty("--mw-nav-ink", ink.text);
      st.setProperty("--mw-nav-dim", ink.dim);
      st.setProperty("--mw-nav-accent", accent);
      st.setProperty("--mw-nav-on-accent", "var(--text-primary-color, #fff)");
      st.setProperty("--mw-nav-accent-shadow", "rgba(0,0,0,.34)");
    }

    /* ---------- rota ativa ---------- */
    _routeIndex() {
      const path = window.location.pathname || "";
      let best = -1, bestLen = -1;
      this._config.routes.forEach((r, i) => {
        const u = String(r.url || "").split("?")[0].replace(/\/$/, "");
        if (!u) return;
        if (path === u || path.startsWith(u + "/")) {
          if (u.length > bestLen) { best = i; bestLen = u.length; }
        }
      });
      return best;
    }

    _syncRoute(animate) {
      const i = this._routeIndex();
      if (i < 0 || i === this._i) return;
      if (animate) { this._animateTo(i); return; }
      this._i = i;
      this.$.items.forEach((el, k) => el.classList.toggle("active", k === i));
      this._render(i, 1, i);
    }

    /* ---------- toque ---------- */
    _pick(i, user) {
      const c = this._config, r = c.routes[i];
      if (!r) return;
      if (user && c.haptic !== false) haptic("selection");
      if (i !== this._i) this._animateTo(i);
      if (r.tap_action && r.tap_action.action && r.tap_action.action !== "navigate") {
        // O `entity` da rota viaja junto: sem ele o `more-info` do HA não sabe
        // de quem é a ficha, e a ação vira clique morto.
        this.dispatchEvent(new CustomEvent("hass-action", {
          bubbles: true, composed: true,
          detail: { config: { entity: r.entity, tap_action: r.tap_action }, action: "tap" },
        }));
        return;
      }
      const url = (r.tap_action && r.tap_action.navigation_path) || r.url;
      navigate(url, false);
    }

    /* ---------- animação ---------- */
    _animateTo(to) {
      const c = this._config;
      const from = this._i;
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this._i = to;
      this.$.items.forEach((el, k) => el.classList.toggle("active", k === to));
      if (c.anim === "none" || reduce || from < 0 || !this._geo) {
        this._render(to, 1, to);
        return;
      }
      this._anim = { from, to, t0: performance.now(), slide: c.anim === "slide" };
      this.$.items[from].classList.remove("active");
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame((now) => this._frame(now));
    }

    _frame(now) {
      const a = this._anim;
      if (!a) { this._raf = 0; return; }
      const t = clamp((now - a.t0) / DUR, 0, 1);
      let d, pos, lift = 0, squash = 0;
      if (a.slide) {
        d = 1; pos = ease(t);
      } else if (t < T_EJECT) {
        d = 1 - ease(t / T_EJECT); pos = 0;
      } else if (t < T_LAND) {
        const tf = (t - T_EJECT) / (T_LAND - T_EJECT);
        d = 0; pos = ease(tf);
        lift = -18 * Math.sin(Math.PI * tf);
        squash = 0.22 * Math.sin(Math.PI * tf);
      } else {
        d = ease((t - T_LAND) / (1 - T_LAND)); pos = 1;
      }
      const idx = a.from + (a.to - a.from) * pos;
      this._render(idx, d, pos >= 0.5 ? a.to : a.from, lift, squash);
      if (t >= 1) {
        this._anim = null; this._raf = 0;
        this.$.items[a.to].classList.add("active");
        this._render(a.to, 1, a.to);
        return;
      }
      this._raf = requestAnimationFrame((n2) => this._frame(n2));
    }

    /* Único lugar que escreve no DOM por quadro: o `d` do path (só quando a
     * profundidade muda) e o transform da bolha. */
    _render(idx, depth, iconIdx, lift, squash) {
      const g = this._geo;
      if (!g || idx < 0) { if (this.$) this.$.bubble.style.opacity = "0"; return; }
      this.$.bubble.style.opacity = "1";
      const c = this._config, r = c.bubble / 2 + 6;
      const cl = (idx + 0.5) * (g.L / g.n);
      const cy = cyOf(depth, r);

      if (depth !== this._lastD || cl !== this._lastCl) {
        this.$.path.setAttribute("d", plateD(g.p.position, g.L, g.T, g.R,
          depth > 0.02 ? { cl, cy, r } : null));
        this._lastD = depth; this._lastCl = cl;
      }

      const [bx, by] = mapper(g.p.position, g.L, g.T).m(cl, cy);
      const off = c.bubble / 2;
      const lx = g.vert ? (lift || 0) * (g.p.position === "left" ? -1 : 1) : 0;
      const ly = g.vert ? 0 : (lift || 0);
      const s = squash || 0;
      const sx = g.vert ? 1 - s : 1 + s;
      const sy = g.vert ? 1 + s : 1 - s;
      this.$.bubble.style.transform =
        `translate3d(${rnd(bx - off + lx)}px, ${rnd(by - off + ly)}px, 0) scale(${rnd(sx)}, ${rnd(sy)})`;

      const route = c.routes[iconIdx];
      const ico = (route && route.icon) || "mdi:circle-outline";
      if (this._bico !== ico) { this.$.bicon.setAttribute("icon", ico); this._bico = ico; }
    }

    static getConfigElement() { return document.createElement("mw-nav-bar-card-editor"); }

    static getStubConfig(hass) {
      const panels = Object.values((hass && hass.panels) || {})
        .filter((p) => p.url_path && p.component_name === "lovelace").slice(0, 3);
      const routes = panels.length
        ? panels.map((p) => ({ url: `/${p.url_path}`, label: (p.title || p.url_path).toUpperCase(), icon: p.icon || "mdi:view-dashboard" }))
        : [
          { url: "/lovelace/0", label: "CASA", icon: "mdi:home" },
          { url: "/lovelace/1", label: "LUZES", icon: "mdi:lightbulb" },
          { url: "/lovelace/2", label: "CLIMA", icon: "mdi:weather-partly-cloudy" },
        ];
      return { routes };
    }
  }

  /* =============================== EDITOR =============================== */
  const POSITIONS = [
    { value: "bottom", label: "Rodapé" }, { value: "top", label: "Topo" },
    { value: "left", label: "Esquerda" }, { value: "right", label: "Direita" },
  ];
  const SHOWS = [
    { value: "icon", label: "Só ícone" }, { value: "label", label: "Só rótulo" },
    { value: "both", label: "Ícone e rótulo" },
  ];
  const PROFILE_LABEL = { mobile: "Celular", tablet: "Tablet", desktop: "Computador" };

  class MwNavBarCardEditor extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: "open" }); }

    setConfig(config) { this._config = { ...config }; this._render(); }
    set hass(h) { this._hass = h; if (this._form) this._form.hass = h; }

    _schema() {
      const prof = (p) => ({
        name: p, type: "grid", column_min_width: "140px", schema: [
          { name: "position", selector: { select: { mode: "dropdown", options: POSITIONS } } },
          { name: "show", selector: { select: { mode: "dropdown", options: SHOWS } } },
          { name: "hidden", selector: { boolean: {} } },
        ],
      });
      return [
        {
          name: "", type: "grid", column_min_width: "180px", schema: [
            { name: "anim", selector: { select: { mode: "dropdown", options: [
              { value: "liquid", label: "Líquida (entalhe + voo)" },
              { value: "slide", label: "Deslizar" },
              { value: "none", label: "Sem animação" }] } } },
            { name: "float", selector: { boolean: {} } },
            { name: "accent", selector: { text: {} } },
            { name: "bubble", selector: { number: { min: 34, max: 72, mode: "slider" } } },
          ],
        },
        { name: "paper", selector: { select: { mode: "dropdown", options: paperOptions() } } },
        { name: "paper_dark", selector: { select: { mode: "dropdown", options: paperDarkOptions() } } },
        ...PROFILES.map(prof),
      ];
    }

    _label(s) {
      const L = {
        anim: "Animação", float: "Barra flutuante", accent: "Cor da bolha (CSS)",
        bubble: "Tamanho da bolha (px)", paper: "Papel (tema claro)",
        paper_dark: "Papel (tema escuro)", position: "Posição", show: "Mostrar",
        hidden: "Esconder", ...PROFILE_LABEL,
      };
      return L[s.name] || s.name;
    }

    _render() {
      if (!this._config) return;
      const c = this._config, routes = c.routes || [];
      this.shadowRoot.innerHTML = `
        <style>
          .rt { display:flex; align-items:center; gap:6px; padding:4px 0; }
          .rt input { flex:1; min-width:0; padding:8px; border-radius:8px;
            border:1px solid var(--divider-color); background:var(--card-background-color);
            color:var(--primary-text-color); font-size:13px; }
          .rt .ico { width:118px; flex:0 0 118px; }
          .rt .lb { width:110px; flex:0 0 110px; }
          .btn { cursor:pointer; background:none; border:0; color:var(--secondary-text-color);
            font-size:15px; padding:4px 6px; line-height:1; }
          .btn:hover { color:var(--primary-color); }
          h4 { margin:14px 0 4px; font-size:13px; color:var(--secondary-text-color);
            text-transform:uppercase; letter-spacing:.04em; }
          .add { color:var(--primary-color); font-size:13px; }
        </style>
        <h4>Rotas</h4>
        <div class="rows">
          ${routes.map((r, i) => `
            <div class="rt" data-i="${i}">
              <input class="ico" value="${(r.icon || "").replace(/"/g, "&quot;")}" placeholder="mdi:sofa" data-k="icon">
              <input class="lb" value="${(r.label || "").replace(/"/g, "&quot;")}" placeholder="SALA" data-k="label">
              <input class="url" value="${(r.url || "").replace(/"/g, "&quot;")}" placeholder="/sala-7-1" data-k="url">
              <button class="btn up" title="Subir">↑</button>
              <button class="btn dn" title="Descer">↓</button>
              <button class="btn rm" title="Remover">✕</button>
            </div>`).join("")}
        </div>
        <button class="btn add">+ rota</button>
        <h4>Aparência</h4>
        <ha-form></ha-form>`;

      const form = this.shadowRoot.querySelector("ha-form");
      form.hass = this._hass;
      form.schema = this._schema();
      form.data = { ...DEFAULTS, ...c, ...Object.fromEntries(PROFILES.map((p) => [p, { ...DEFAULTS[p], ...(c[p] || {}) }])) };
      form.computeLabel = (s) => this._label(s);
      form.addEventListener("value-changed", (e) => this._onForm(e));
      this._form = form;

      this.shadowRoot.querySelectorAll(".rt").forEach((row) => {
        const i = +row.dataset.i;
        row.querySelectorAll("input").forEach((inp) => {
          inp.addEventListener("change", () => {
            const rs = this._config.routes.map((x) => ({ ...x }));
            rs[i][inp.dataset.k] = inp.value.trim();
            this._emit({ ...this._config, routes: rs });
          });
        });
        row.querySelector(".up").addEventListener("click", () => this._move(i, i - 1));
        row.querySelector(".dn").addEventListener("click", () => this._move(i, i + 1));
        row.querySelector(".rm").addEventListener("click", () => {
          const rs = this._config.routes.filter((_, k) => k !== i);
          this._emit({ ...this._config, routes: rs }); this._render();
        });
      });
      this.shadowRoot.querySelector(".add").addEventListener("click", () => {
        const rs = [...(this._config.routes || []), { url: "", label: "", icon: "mdi:circle-outline" }];
        this._emit({ ...this._config, routes: rs }); this._render();
      });
    }

    /* Mover é puro e sem DOM — o probe exercita a regra inteira em Node.
     * O caso que todo mundo erra: descer uma casa não sai do lugar se o índice
     * de destino for lido na lista com o item ainda nela. */
    static move(list, from, to) {
      const out = list.slice();
      if (from < 0 || from >= out.length) return out;
      const at = clamp(to, 0, out.length - 1);
      const [it] = out.splice(from, 1);
      out.splice(at, 0, it);
      return out;
    }

    _move(from, to) {
      if (to < 0 || to >= this._config.routes.length) return;
      this._emit({ ...this._config, routes: MwNavBarCardEditor.move(this._config.routes, from, to) });
      this._render();
    }

    /* Default não polui o YAML. */
    _onForm(e) {
      const v = { ...e.detail.value };
      const out = { ...this._config };
      for (const k of Object.keys(v)) {
        const val = v[k];
        if (val === undefined || val === null || val === "") { delete out[k]; continue; }
        if (PROFILES.includes(k)) {
          const clean = {};
          for (const kk of Object.keys(val)) {
            if (val[kk] !== undefined && val[kk] !== null && val[kk] !== "" && val[kk] !== DEFAULTS[k][kk]) clean[kk] = val[kk];
          }
          if (Object.keys(clean).length) out[k] = clean; else delete out[k];
          continue;
        }
        if (JSON.stringify(val) === JSON.stringify(DEFAULTS[k])) delete out[k]; else out[k] = val;
      }
      this._emit(out);
    }

    _emit(config) {
      this._config = config;
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
    }
  }

  customElements.define("mw-nav-bar-card", MwNavBarCard);
  customElements.define("mw-nav-bar-card-editor", MwNavBarCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "mw-nav-bar-card",
    name: "MW Nav Bar Card",
    description: "Barra de navegação com entalhe líquido — o item ativo é uma bolha que salta, voa e pousa.",
    preview: true,
    documentationURL: "https://github.com/visaodeempresa/mw-ha-nav-bar-card",
  });

  console.info(`%c MW-NAV-BAR-CARD %c ${VERSION} `,
    "color:#fff;background:#3f51b5;font-weight:700", "color:#3f51b5;background:#fff");

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { MwNavBarCard, MwNavBarCardEditor, plateD, cyOf, mapper, DEFAULTS };
  }
})();
