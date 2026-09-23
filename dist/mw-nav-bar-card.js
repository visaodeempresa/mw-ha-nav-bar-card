/* MW Nav Bar Card — custom:mw-nav-bar-card
 *
 * A barra de navegação da casa, com ENTALHE LÍQUIDO: o item ativo é uma peça
 * assentada num recorte côncavo da borda da barra. Ao tocar outro item ela
 * salta para fora (o entalhe se desfaz), voa em arco deformada como gota, e
 * pousa no destino, onde o entalhe se forma de novo.
 *
 * Drop-in do `custom:navbar-card`: a mesma config (`routes`, `haptic`,
 * `desktop.position`, `submenu`) funciona sem alteração — trocar o `type:`
 * basta.
 *
 * Arquivo único, sem build: este arquivo é fonte E artefato (padrão da casa).
 *
 * Invariante: MONTAR UMA VEZ, PINTAR POR VARIÁVEL CSS. O card não depende de
 * entidade nenhuma — o `hass` que o HA empurra a cada state_changed da casa só
 * é comparado com o tema anterior.
 *
 * A animação escreve o atributo `d` de um <path> durante ~15 quadros por toque
 * (as fases de entalhe). A fase longa — o voo — é `transform` puro. Parado, o
 * custo é zero: o requestAnimationFrame se cancela ao fim da transição.
 *
 * Autor: MAYCON WILLIAN OLIVEIRA <visaodeempresa@gmail.com>
 */
(() => {
  "use strict";

  const VERSION = "0.4.1";

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
    inline: false,             // true = mora dentro do card, não colada na tela
    float: true,
    paper: "paper",
    paper_dark: "paper",
    bar_3d: false,
    bar_opacity: 1,
    accent: "",                // vazio = var(--primary-color)
    bubble: 46,
    bubble_shape: "circle",    // circle | squircle | triangle | diamond | hexagon
    bubble_style: "flat",      // flat | sphere | glass | paper | metal
    bubble_opacity: 1,
    bubble_rotate: 0,          // graus; 180 deixa o triângulo de ponta-cabeça
    bubble_margin: 6,          // vão entre a peça e a barra, em px
    bubble_bevel: true,        // aresta 3D em volta da peça
    triangle_angle: 60,        // ângulo do topo; 60 = equilátero
    bubble_image: "",
    image_3d: false,
    dock: 0,                   // 0 = saltada para fora · 1 = dentro da barra
    gap: 0,                    // folga extra entre os botões, em px
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
  const num = (v, d) => (v === undefined || v === null || v === "" || isNaN(+v) ? d : +v);

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

  /* Contorno da barra. `notch` = {cl, cy, r} com cy negativo (centro da peça
   * acima da borda). Sem interseção com a borda (|cy| >= r, ou cy >= 0 porque
   * a peça afundou para dentro), devolve o retângulo arredondado — é assim que
   * o entalhe some sozinho, tanto no voo quanto com `dock` alto. */
  const plateD = (pos, L, T, R, notch) => {
    const { m, flip } = mapper(pos, L, T);
    const P = (l, t) => { const p = m(l, t); return `${rnd(p[0])},${rnd(p[1])}`; };
    const sw = flip ? 0 : 1, nsw = flip ? 1 : 0;
    let d = `M ${P(R, 0)}`;
    if (notch && notch.chain) {
      const ch = notch.chain;
      const first = ch[0], last = ch[ch.length - 1];
      const inner = ch.slice(1, -1);
      if (inner.length) {
        d += ` L ${P(clamp(first[0] - S1, R, L - R), 0)}`;
        d += ` Q ${P(first[0], 0)} ${P(inner[0][0], inner[0][1])}`;
        for (let i = 1; i < inner.length; i++) d += ` L ${P(inner[i][0], inner[i][1])}`;
        d += ` Q ${P(last[0], 0)} ${P(clamp(last[0] + S1, R, L - R), 0)}`;
      }
    } else if (notch) {
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

  /* Profundidade normalizada d (0..1) → altura do centro da peça.
   * `dock` diz onde ela repousa: 0 encaixada no entalhe com metade de fora,
   * 1 afundada no meio da barra (e aí não há entalhe nenhum). */
  const cyOf = (d, r, dock, T) => {
    const rest = -r * 0.5 + clamp(num(dock, 0), 0, 1.6) * (r * 0.5 + (T || 62) * 0.5);
    const out = -r * 1.25;
    return out + d * (rest - out);
  };

  const isVertical = (pos) => pos === "left" || pos === "right";

  /* ==== formas da peça ====
   * Círculo e "squircle" por border-radius (antisserrilhado melhor e sombra
   * externa de verdade); as demais por clip-path. */
  const SHAPES = {
    circle: { round: true, radius: "50%" },
    squircle: { round: true, radius: "30%" },
    triangle: { tri: true },
    diamond: { poly: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]] },
    hexagon: { poly: [[0.5, 0], [0.93, 0.25], [0.93, 0.75], [0.5, 1], [0.07, 0.75], [0.07, 0.25]] },
  };

  /* Triângulo isósceles pelo ÂNGULO DO TOPO, centrado na caixa. 60° dá o
   * equilátero (os três ângulos iguais); menos que isso afina a ponta, mais
   * que isso achata. A peça é escalada para caber sem deformar o ângulo — o
   * que importa aqui é o ângulo, não encher a caixa. */
  const triPoly = (apexDeg) => {
    const a = clamp(num(apexDeg, 60), 8, 160) * Math.PI / 180;
    const half = Math.tan(a / 2);            // meia-base por unidade de altura
    const k = Math.min(1, 0.5 / half);
    const h = k, b = half * k;
    const top = 0.5 - h / 2, bot = 0.5 + h / 2;
    return [[0.5, top], [0.5 + b, bot], [0.5 - b, bot]];
  };

  /* O polígono de uma forma, já resolvido com as opções do card. Devolve null
   * para as formas redondas, que têm matemática própria. */
  const polyOf = (name, apexDeg) => {
    const s = SHAPES[name];
    if (!s) return null;
    if (s.tri) return triPoly(apexDeg);
    return s.poly || null;
  };
  const polyClip = (poly) =>
    `polygon(${poly.map((p) => `${rnd(p[0] * 100)}% ${rnd(p[1] * 100)}%`).join(", ")})`;
  const shapeOf = (name) => SHAPES[name] || SHAPES.circle;

  /* Contorno da peça já afastado do vão, em coordenadas da barra deitada.
   * O afastamento é uma ampliação em torno do centro da caixa: para as formas
   * regulares que a peça usa, isso dá um vão de espessura uniforme — que é o
   * que o olho cobra ao ver o triângulo encaixado. */
  const pieceOutline = (shape, size, margin, rotDeg, cl, cy, apexDeg) => {
    const poly = polyOf(shape, apexDeg);
    if (!poly) return null;
    const rel = poly.map((p) => [(p[0] - 0.5) * size, (p[1] - 0.5) * size]);
    const rbar = rel.reduce((a, p) => a + Math.hypot(p[0], p[1]), 0) / rel.length;
    const k = rbar > 0 ? (rbar + margin) / rbar : 1;
    const a = (rotDeg || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    return rel.map(([x0, y0]) => {
      const x = x0 * k, y = y0 * k;
      return [cl + x * ca - y * sa, cy + x * sa + y * ca];
    });
  };

  /* Recorta o contorno na borda da barra (t = 0) e devolve a cadeia que entra
   * nela, da interseção da esquerda para a da direita. Devolve null quando a
   * peça está toda fora (nada a entalhar) ou toda dentro (seria um buraco, não
   * um entalhe) — é assim que o entalhe some sozinho no voo e no `dock` alto. */
  const notchChain = (poly) => {
    if (!poly || poly.length < 3) return null;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length];
      if (A[1] >= 0) out.push([A[0], A[1], false]);
      if ((A[1] >= 0) !== (B[1] >= 0)) {
        const u = A[1] / (A[1] - B[1]);
        out.push([A[0] + (B[0] - A[0]) * u, 0, true]);
      }
    }
    const marks = out.filter((p) => p[2]).length;
    if (out.length < 3 || marks !== 2) return null;
    // Das duas voltas entre as marcas, a boa é a que tem vértices no meio: a
    // outra é o trecho que anda por fora da barra. Escolher sempre a primeira
    // deixava o triângulo INVERTIDO sem entalhe — o vértice que entra fica do
    // outro lado da volta.
    const m1 = out.findIndex((p) => p[2]);
    const m2 = out.findIndex((p, i) => i > m1 && p[2]);
    const volta1 = out.slice(m1, m2 + 1);
    const volta2 = out.slice(m2).concat(out.slice(0, m1 + 1));
    let chain = volta1.length >= volta2.length ? volta1 : volta2;
    if (chain.length < 3) return null;
    if (chain[0][0] > chain[chain.length - 1][0]) chain = chain.slice().reverse();
    return chain.map((p) => [p[0], p[1]]);
  };


  /* ==== pedras ====
   * Acabamentos de alto realismo sem uma única imagem: cada pedra é uma pilha
   * de gradientes. Facetas por `conic-gradient` (a luz que gira na lapidação),
   * brilho especular fixo em cima à esquerda, oclusão embaixo à direita e a
   * cor de corpo por baixo de tudo. Custo: zero — é pintura, não animação.
   *
   * A pedra manda na cor: `accent` e a `color` da rota ficam de fora, senão o
   * rubi sairia azul. `ink` diz de que cor o ícone tem de ser para se ler. */
  const FACETS = (a) => "conic-gradient(from 200deg at 50% 45%,"
    + `rgba(255,255,255,${a}) 0deg, rgba(255,255,255,0) 38deg,`
    + `rgba(255,255,255,${rnd(a * 0.7)}) 74deg, rgba(0,0,0,${rnd(a * 0.5)}) 118deg,`
    + `rgba(255,255,255,${a}) 168deg, rgba(0,0,0,${rnd(a * 0.6)}) 232deg,`
    + `rgba(255,255,255,${rnd(a * 0.8)}) 292deg, rgba(255,255,255,0) 340deg)`;
  const SPEC = "radial-gradient(circle at 33% 25%, rgba(255,255,255,.95) 0 9%,"
    + " rgba(255,255,255,.4) 21%, rgba(255,255,255,0) 46%)";
  const NACRE = "conic-gradient(from 30deg at 40% 35%, rgba(255,214,235,.55),"
    + " rgba(214,255,238,.5) 60deg, rgba(214,229,255,.55) 130deg,"
    + " rgba(255,246,214,.5) 200deg, rgba(255,214,235,.55) 280deg,"
    + " rgba(214,255,238,.5) 360deg)";
  const veins = (cor, ang, passo, larg) =>
    `repeating-linear-gradient(${ang}deg, rgba(0,0,0,0) 0 ${passo}px,`
    + ` ${cor} ${passo}px ${passo + larg}px, rgba(0,0,0,0) ${passo + larg}px ${passo * 2 + larg}px)`;

  const gem = (c1, c2, c3, a, ink, oclusao) => ({
    ink: ink || "light",
    bg: [FACETS(a), SPEC, `radial-gradient(circle at 72% 82%, ${oclusao || "rgba(0,0,0,.45)"}, rgba(0,0,0,0) 62%)`,
      `linear-gradient(145deg, ${c1}, ${c2} 58%, ${c3})`],
    sh: "inset 0 -4px 10px rgba(0,0,0,.42), inset 0 3px 8px rgba(255,255,255,.55)",
  });

  const STONES = {
    diamante: gem("#f7fbff", "#d5e7f8", "#9dbfdc", 0.8, "dark", "rgba(70,110,150,.4)"),
    rubi: gem("#ff92a6", "#cf1b3b", "#5e0413", 0.62),
    topazio: gem("#ffeab4", "#eda51a", "#7d4604", 0.6, "dark"),
    esmeralda: gem("#a6f2ca", "#0f9a5a", "#033d26", 0.6),
    obsidiana: gem("#71717c", "#1a1a1f", "#000000", 0.85),
    "quartzo-rosa": gem("#fff0f5", "#f2b7ca", "#c37e96", 0.3, "dark", "rgba(120,70,90,.3)"),
    "agua-marinha": gem("#e4fdff", "#8ddbea", "#3b8fa8", 0.42, "dark", "rgba(40,100,120,.35)"),
    "marmore-branco": {
      ink: "dark",
      bg: [SPEC, veins("rgba(110,112,122,.45)", 118, 7, 1), veins("rgba(150,152,162,.28)", 64, 12, 1),
        "radial-gradient(circle at 70% 80%, rgba(0,0,0,.18), rgba(0,0,0,0) 60%)",
        "linear-gradient(145deg, #ffffff, #ededed 60%, #d6d6d6)"],
      sh: "inset 0 -3px 9px rgba(0,0,0,.22), inset 0 3px 7px rgba(255,255,255,.85)",
    },
    "marmore-negro": {
      ink: "light",
      bg: [SPEC, veins("rgba(226,214,186,.55)", 122, 8, 1), veins("rgba(255,255,255,.18)", 58, 13, 1),
        "radial-gradient(circle at 70% 80%, rgba(0,0,0,.5), rgba(0,0,0,0) 62%)",
        "linear-gradient(145deg, #3a3a3e, #1d1d21 58%, #0b0b0d)"],
      sh: "inset 0 -3px 9px rgba(0,0,0,.6), inset 0 3px 7px rgba(255,255,255,.28)",
    },
    "perola-branca": {
      ink: "dark",
      bg: [SPEC, NACRE, "radial-gradient(circle at 68% 78%, rgba(120,110,130,.35), rgba(0,0,0,0) 62%)",
        "radial-gradient(circle at 38% 32%, #ffffff, #f1ebe4 52%, #cbc2b8)"],
      sh: "inset 0 -4px 11px rgba(90,80,90,.35), inset 0 3px 8px rgba(255,255,255,.9)",
    },
    "perola-negra": {
      ink: "light",
      bg: [SPEC.replace(".95", ".75"), NACRE, "radial-gradient(circle at 70% 80%, rgba(0,0,0,.55), rgba(0,0,0,0) 60%)",
        "radial-gradient(circle at 38% 32%, #8b9895, #333c3a 55%, #12161a)"],
      sh: "inset 0 -4px 11px rgba(0,0,0,.6), inset 0 3px 8px rgba(255,255,255,.35)",
    },
  };
  /* Relevo da peça. `cor` é a cor de destaque já resolvida. */
  const faceStyle = (style, cor, dark) => {
    const spec = dark ? 0.55 : 0.85;
    const pedra = STONES[style];
    if (pedra) return { background: pedra.bg.join(", "), shadow: pedra.sh, ink: pedra.ink };
    // "none" existe para a peça ser só a imagem — a logo da casa sem pastilha
    // de cor atrás dela.
    if (style === "none") return { background: "transparent", shadow: "none" };
    if (style === "sphere") {
      return {
        background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,${spec}), rgba(255,255,255,.18) 34%, rgba(255,255,255,0) 56%),`
          + ` radial-gradient(circle at 72% 82%, rgba(0,0,0,.42), rgba(0,0,0,0) 58%), ${cor}`,
        shadow: `inset 0 -3px 8px rgba(0,0,0,.35), inset 0 2px 5px rgba(255,255,255,.35)`,
      };
    }
    if (style === "glass") {
      return {
        background: `linear-gradient(160deg, rgba(255,255,255,.42), rgba(255,255,255,.06) 46%, rgba(255,255,255,0) 60%), ${cor}`,
        shadow: `inset 0 0 0 1px rgba(255,255,255,.45), inset 0 -4px 10px rgba(0,0,0,.22)`,
      };
    }
    if (style === "paper") {
      // o mesmo relevo dos botões de papel MW: luz em cima à esquerda,
      // sombra embaixo à direita, valores assimétricos entre claro e escuro.
      return {
        background: `linear-gradient(145deg, ${cor}, ${cor})`,
        shadow: dark
          ? `inset 2px 2px 4px rgba(255,255,255,.14), inset -2px -2px 4px rgba(0,0,0,.55)`
          : `inset 2px 2px 4px rgba(255,255,255,.55), inset -2px -2px 4px rgba(0,0,0,.30)`,
      };
    }
    if (style === "metal") {
      return {
        background: `linear-gradient(135deg, rgba(255,255,255,.55), rgba(255,255,255,0) 28%,`
          + ` rgba(0,0,0,.28) 62%, rgba(255,255,255,.35) 88%), ${cor}`,
        shadow: `inset 0 0 0 1px rgba(255,255,255,.28)`,
      };
    }
    return { background: cor, shadow: `inset 0 -2px 6px rgba(0,0,0,.18)` };
  };

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

  const esc = (s) => String(s == null ? "" : s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const norm = (u) => String(u || "").split("?")[0].replace(/\/$/, "");

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
      this._pop = -1;
      this._onRoute = () => { this._closePop(); this._syncRoute(true); };
      this._onResize = () => this._layout();
      this._onAway = (e) => { if (this._pop >= 0 && !e.composedPath().includes(this)) this._closePop(); };
    }

    setConfig(config) {
      if (!config || !Array.isArray(config.routes) || !config.routes.length) {
        throw new Error("mw-nav-bar-card: informe ao menos uma rota em `routes`");
      }
      const c = { ...DEFAULTS, ...config };
      c.breakpoints = { ...DEFAULTS.breakpoints, ...(config.breakpoints || {}) };
      // `desktop: {position: left}` do navbar-card cai aqui sem tradução.
      for (const p of PROFILES) c[p] = { ...DEFAULTS[p], ...(config[p] || {}) };
      c.routes = config.routes.map((r) => ({
        ...r,
        submenu: Array.isArray(r.submenu) ? r.submenu.map((s) => ({ ...s })) : undefined,
      }));
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
      window.addEventListener("pointerdown", this._onAway, true);
      // No modo `inline` a largura é a do card, não a da janela — e o card
      // ainda está encolhido no primeiro quadro. Sem isto a barra nasce curta
      // e só conserta no próximo resize da janela.
      if (window.ResizeObserver && !this._ro) {
        this._ro = new ResizeObserver(() => {
          if (this._roRaf) return;
          this._roRaf = requestAnimationFrame(() => { this._roRaf = 0; this._layout(); });
        });
        this._ro.observe(this);
      }
      if (this._config) this._build();
    }

    disconnectedCallback() {
      window.removeEventListener("location-changed", this._onRoute);
      window.removeEventListener("popstate", this._onRoute);
      window.removeEventListener("resize", this._onResize);
      window.removeEventListener("pointerdown", this._onAway, true);
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
    }

    /* Dentro do editor a barra não pode ser `fixed`: ela cobriria os controles
     * do diálogo. Na pré-visualização — e no modo de edição da tela, onde o HA
     * embrulha cada card num `hui-card-options` — ela vira `absolute` dentro do
     * próprio card, que passa a ter altura. Sem isso o card fica com 0 px e não
     * há onde clicar para editá-lo. */
    _inPreview() {
      let n = this;
      for (let i = 0; i < 14 && n; i++) {
        n = n.parentNode || n.host;
        if (!n) break;
        const t = n.localName || "";
        if (t === "hui-card-preview" || t === "hui-dialog-edit-card"
          || t === "hui-card-element-editor" || t === "hui-card-options"
          || t === "hui-card-edit-mode") return true;
        if (t === "hui-view" || t === "hui-sections-view" || t === "home-assistant") return false;
      }
      return false;
    }

    /* ---------- montagem: uma vez ---------- */
    _build() {
      if (this._built || !this._config) return;
      const routes = this._config.routes;
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; height: 0; }
          :host(.preview) { position: relative; }
          .wrap {
            position: fixed; z-index: 4; overflow: visible;
            -webkit-tap-highlight-color: transparent;
          }
          .wrap.inset { position: absolute; }
          .wrap.hidden { display: none; }
          svg { display: block; overflow: visible; opacity: var(--mw-nav-bar-opacity, 1); }
          .shape { filter: drop-shadow(0 6px 14px rgba(0,0,0,.22)) drop-shadow(0 2px 4px rgba(0,0,0,.14)); }
          .shape.relief { filter: drop-shadow(0 10px 22px rgba(0,0,0,.30)) drop-shadow(0 3px 6px rgba(0,0,0,.18)); }
          .emboss { display: none; fill: none; }
          .relief3d .emboss { display: block; }
          .items { position: absolute; inset: 0; }
          .item {
            position: absolute; display: flex; align-items: center; justify-content: center;
            flex-direction: column; gap: 2px; cursor: pointer; user-select: none;
            color: var(--mw-nav-ink); background: none; border: 0; padding: 0;
          }
          .item ha-icon { --mdc-icon-size: 24px; transition: opacity .16s ease; }
          .item .lbl {
            font-size: 11px; line-height: 1.2; font-weight: 500; letter-spacing: .02em;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            max-width: 100%; color: var(--mw-nav-dim);
          }
          .item .dot {
            position: absolute; width: 4px; height: 4px; border-radius: 50%;
            background: var(--mw-nav-dim); opacity: .55;
          }
          .item.active ha-icon { opacity: 0; }
          .item.active .lbl { color: var(--mw-nav-now); font-weight: 700; }
          .bubble {
            position: absolute; left: 0; top: 0; will-change: transform; pointer-events: none;
            filter: drop-shadow(0 2px 3px rgba(0,0,0,.30)) drop-shadow(0 7px 14px rgba(0,0,0,.34));
            display: flex; align-items: center; justify-content: center;
          }
          /* A borda 3D da peça: numa forma recortada por clip-path o
             box-shadow externo é cortado fora, então o bisel é uma camada
             atrás, com a MESMA forma, um pouco maior — o que sobra na volta
             é a aresta iluminada de um lado e sombreada do outro. */
          .rim {
            position: absolute; inset: 0; display: none;
            background: linear-gradient(145deg, rgba(255,255,255,.92), rgba(255,255,255,.25) 38%,
              rgba(0,0,0,.35) 62%, rgba(0,0,0,.62));
            border-radius: var(--mw-nav-face-radius, 50%);
            clip-path: var(--mw-nav-face-clip, none);
            transform: rotate(var(--mw-nav-face-rot, 0deg)) scale(var(--mw-nav-rim, 1.1));
          }
          .bubble.bevel .rim { display: block; }
          .face {
            position: absolute; inset: 0;
            background: var(--mw-nav-face-bg);
            box-shadow: var(--mw-nav-face-shadow);
            border-radius: var(--mw-nav-face-radius, 50%);
            clip-path: var(--mw-nav-face-clip, none);
            opacity: var(--mw-nav-face-opacity, 1);
            transform: rotate(var(--mw-nav-face-rot, 0deg));
          }
          .bicon { position: relative; color: var(--mw-nav-on-accent); --mdc-icon-size: 22px; }
          .bimg {
            position: relative; width: 62%; height: 62%; object-fit: contain;
            filter: drop-shadow(0 1px 1px rgba(0,0,0,.35));
          }
          .bubble.img3d .bimg {
            width: 68%; height: 68%;
            filter: drop-shadow(0 1px 0 rgba(255,255,255,.55))
                    drop-shadow(0 2px 2px rgba(0,0,0,.45))
                    drop-shadow(0 6px 10px rgba(0,0,0,.30));
          }
          /* No triângulo o ícone desce para o centro de massa; com o giro,
           * esse deslocamento gira junto — senão o triângulo invertido fica
           * com o ícone empurrado para fora da peça. */
          .bubble.triangle .bicon, .bubble.triangle .bimg {
            transform: translate(var(--mw-nav-icon-dx, 0%), var(--mw-nav-icon-dy, 14%));
          }
          .bubble.img .bicon { display: none !important; }
          .pop {
            position: absolute; display: none; flex-direction: column; gap: 2px;
            padding: 6px; border-radius: 14px; min-width: 150px; z-index: 2;
            background: var(--mw-nav-pop-bg); box-shadow: 0 10px 26px rgba(0,0,0,.32);
            border: 1px solid var(--mw-nav-line);
          }
          .pop.open { display: flex; }
          .pitem {
            display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 0;
            border-radius: 10px; background: none; cursor: pointer; color: var(--mw-nav-ink);
            font-size: 13px; text-align: left; white-space: nowrap;
          }
          .pitem:hover { background: rgba(127,127,127,.16); }
          .pitem.on { color: var(--mw-nav-now); font-weight: 700; }
          .pitem ha-icon { --mdc-icon-size: 20px; }
          @media (prefers-reduced-motion: reduce) { .item ha-icon { transition: none; } }
        </style>
        <div class="wrap">
          <svg xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="paper" x1="0" y1="0" x2="0.7" y2="1">
                <stop class="s1" offset="0"/><stop class="s2" offset="1"/>
              </linearGradient>
              <clipPath id="plate"><path class="clip"/></clipPath>
            </defs>
            <path class="shape" fill="url(#paper)"/>
            <g clip-path="url(#plate)">
              <path class="emboss lit" stroke="rgba(255,255,255,.55)" stroke-width="4.2"/>
              <path class="emboss dent" stroke="rgba(0,0,0,.30)" stroke-width="4.2"/>
            </g>
          </svg>
          <div class="items">
            ${routes.map((r, i) => `
              <button class="item" data-i="${i}" title="${esc(r.label)}">
                <ha-icon icon="${esc(r.icon || "mdi:circle-outline")}"></ha-icon>
                <span class="lbl">${esc(r.label)}</span>
                ${r.submenu && r.submenu.length ? '<span class="dot"></span>' : ""}
              </button>`).join("")}
          </div>
          <div class="bubble"><div class="rim"></div><div class="face"></div><ha-icon class="bicon"></ha-icon></div>
          <div class="pop"></div>
        </div>`;

      const sr = this.shadowRoot;
      this.$ = {
        wrap: sr.querySelector(".wrap"),
        svg: sr.querySelector("svg"),
        path: sr.querySelector(".shape"),
        clip: sr.querySelector(".clip"),
        lit: sr.querySelector(".emboss.lit"),
        dent: sr.querySelector(".emboss.dent"),
        s1: sr.querySelector(".s1"),
        s2: sr.querySelector(".s2"),
        items: Array.from(sr.querySelectorAll(".item")),
        bubble: sr.querySelector(".bubble"),
        face: sr.querySelector(".face"),
        rim: sr.querySelector(".rim"),
        bicon: sr.querySelector(".bicon"),
        pop: sr.querySelector(".pop"),
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

    _avail() {
      if (this._preview) {
        const r = this.getBoundingClientRect();
        if (r.width > 40) return r.width;
      }
      return window.innerWidth || 1024;
    }

    /* ---------- layout: só em resize/mudança de perfil ---------- */
    _layout() {
      if (!this._built) return;
      const c = this._config, p = this._profile(), n = c.routes.length;
      // `inline` é o mesmo modo que o editor usa: a barra mora dentro do
      // próprio card em vez de colar na borda da tela. Serve para vitrine e
      // para quem quer a barra no meio do conteúdo.
      this._preview = !!c.inline || this._inPreview();
      this.classList.toggle("preview", this._preview);
      this.$.wrap.classList.toggle("inset", this._preview);
      this.$.wrap.classList.toggle("hidden", !!p.hidden);
      if (p.hidden) { this.style.height = "0"; return; }

      const vert = isVertical(p.position);
      const labels = p.show === "label" || p.show === "both";
      const icons = p.show !== "label";
      const gap = clamp(num(c.gap, 0), -40, 64);   // negativo aperta os botões
      const avail = this._avail();
      const T = vert ? (labels ? 88 : 64) : (labels ? 74 : 62);
      const base = vert ? (labels ? 72 : 58)
        : clamp(Math.min(avail - 24, c.max_width) / n, 48, 108);
      const slot = Math.max(34, base + gap);
      const L = vert ? n * slot : clamp(n * slot, n * 48, Math.max(n * 48, Math.min(avail - 24, c.max_width + n * gap)));
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
      const overhang = c.bubble;                 // sobra da peça fora da barra
      if (p.position === "bottom") {
        st.left = "50%"; st.transform = "translateX(-50%)";
        st.bottom = this._preview ? `${pad}px` : `calc(env(safe-area-inset-bottom, 0px) + ${pad}px)`;
      } else if (p.position === "top") {
        st.left = "50%"; st.transform = "translateX(-50%)";
        st.top = this._preview ? `${overhang}px`
          : `calc(env(safe-area-inset-top, 0px) + ${pad + 56}px)`;
      } else if (p.position === "left") {
        st.top = "50%"; st.transform = "translateY(-50%)"; st.left = `${pad}px`;
      } else {
        st.top = "50%"; st.transform = "translateY(-50%)"; st.right = `${pad}px`;
      }
      // Na pré-visualização o card ocupa espaço de verdade, senão a barra
      // escapa da caixa e cobre os controles do diálogo de edição.
      this.style.height = this._preview ? `${h + 2 * pad + overhang}px` : "0";

      const size = vert ? { wpx: T, hpx: slot } : { wpx: slot, hpx: T };
      const mp = mapper(p.position, L, T);
      this.$.items.forEach((el, i) => {
        const l = (i + 0.5) * (L / n);
        const [x, y] = mp.m(l, T / 2);
        el.style.width = `${size.wpx}px`;
        el.style.height = `${size.hpx}px`;
        el.style.left = `${x - size.wpx / 2}px`;
        el.style.top = `${y - size.hpx / 2}px`;
        el.querySelector("ha-icon").style.display = icons ? "" : "none";
        const lb = el.querySelector(".lbl");
        lb.style.display = labels ? "" : "none";
        lb.style.maxWidth = `${size.wpx - 6}px`;
        const dot = el.querySelector(".dot");
        if (dot) { dot.style.bottom = "5px"; dot.style.left = "calc(50% - 2px)"; }
      });

      this.$.bubble.style.width = this.$.bubble.style.height = `${c.bubble}px`;
      this._paintTheme();
      this._render(this._i, 1, this._i);
    }

    /* ---------- cores e relevo ---------- */
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
      this.$.path.classList.toggle("relief", !!c.bar_3d);
      this.$.wrap.classList.toggle("relief3d", !!c.bar_3d);
      this.$.lit.setAttribute("stroke", dark ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.75)");
      this.$.dent.setAttribute("stroke", dark ? "rgba(0,0,0,.60)" : "rgba(0,0,0,.26)");
      const ink = dark
        ? { text: "rgba(247, 244, 236, 0.94)", dim: "rgba(247, 244, 236, 0.62)", line: "rgba(255,255,255,.14)" }
        : { text: "rgba(28, 25, 20, 0.92)", dim: "rgba(28, 25, 20, 0.58)", line: "rgba(0,0,0,.14)" };
      const st = this.$.wrap.style;
      st.setProperty("--mw-nav-ink", ink.text);
      st.setProperty("--mw-nav-dim", ink.dim);
      st.setProperty("--mw-nav-line", ink.line);
      st.setProperty("--mw-nav-pop-bg", dark ? "#241f1b" : "#fbf8f1");
      st.setProperty("--mw-nav-on-accent", "var(--text-primary-color, #fff)");
      st.setProperty("--mw-nav-bar-opacity", String(clamp(num(c.bar_opacity, 1), 0, 1)));
      const shape = shapeOf(c.bubble_shape);
      const poly = polyOf(c.bubble_shape, c.triangle_angle);
      st.setProperty("--mw-nav-face-radius", shape.radius || "0");
      st.setProperty("--mw-nav-face-clip", poly ? polyClip(poly) : "none");
      const rot = num(c.bubble_rotate, 0);
      st.setProperty("--mw-nav-face-rot", `${rot}deg`);
      const ra = rot * Math.PI / 180;
      st.setProperty("--mw-nav-icon-dx", `${rnd(-14 * Math.sin(ra))}%`);
      st.setProperty("--mw-nav-icon-dy", `${rnd(14 * Math.cos(ra))}%`);
      st.setProperty("--mw-nav-face-opacity", String(clamp(num(c.bubble_opacity, 1), 0, 1)));
      this.$.bubble.classList.toggle("triangle", c.bubble_shape === "triangle");
      this.$.bubble.classList.toggle("img3d", !!c.image_3d);
      this.$.bubble.classList.toggle("bevel", c.bubble_bevel !== false && c.bubble_style !== "none");
      // formas de ponta precisam de mais aresta para a luz virar volume
      st.setProperty("--mw-nav-rim", poly ? "1.14" : "1.09");
      this._paintFace();
    }

    /* Cor de destaque: a da rota ativa quando ela tem `color` própria — é o que
     * deixa cada dashboard com a sua cor sem escrever CSS na tela. */
    _paintFace(idx) {
      const c = this._config;
      const r = c.routes[idx === undefined ? this._i : idx];
      const cor = (r && r.color) || c.accent || "var(--primary-color, #03a9f4)";
      const f = faceStyle(c.bubble_style, cor, this._dark);
      const st = this.$.wrap.style;
      st.setProperty("--mw-nav-on-accent", f.ink === "dark"
        ? "rgba(24,22,20,.92)" : "var(--text-primary-color, #fff)");
      st.setProperty("--mw-nav-face-bg", f.background);
      st.setProperty("--mw-nav-face-shadow", f.shadow);
      st.setProperty("--mw-nav-now", cor);
      st.setProperty("--mw-nav-accent", cor);
    }

    /* ---------- rota ativa ----------
     * O submenu conta: uma rota cujo subitem é a tela de agora fica acesa —
     * senão o botão pai apaga justamente onde o dono está. */
    _routeIndex() {
      const path = norm(window.location.pathname);
      let best = -1, bestLen = -1;
      const test = (u, i) => {
        const n2 = norm(u);
        if (!n2) return;
        if ((path === n2 || path.startsWith(n2 + "/")) && n2.length > bestLen) { best = i; bestLen = n2.length; }
      };
      this._config.routes.forEach((r, i) => {
        test(r.url, i);
        (r.submenu || []).forEach((s) => test(s.url, i));
      });
      return best;
    }

    _syncRoute(animate) {
      const i = this._routeIndex();
      if (i < 0 || i === this._i) return;
      if (animate) { this._animateTo(i); return; }
      this._i = i;
      this.$.items.forEach((el, k) => el.classList.toggle("active", k === i));
      this._paintFace(i);
      this._render(i, 1, i);
    }

    /* ---------- submenu ---------- */
    _closePop() {
      if (this._pop < 0) return;
      this._pop = -1;
      this.$.pop.classList.remove("open");
    }

    _openPop(i) {
      const c = this._config, g = this._geo, r = c.routes[i];
      if (!g) return;
      const itens = [].concat(r.url ? [{ url: r.url, label: r.label, icon: r.icon }] : [], r.submenu || []);
      const path = norm(window.location.pathname);
      this.$.pop.innerHTML = itens.map((s, k) => `
        <button class="pitem${norm(s.url) === path ? " on" : ""}" data-k="${k}">
          <ha-icon icon="${esc(s.icon || "mdi:chevron-right")}"></ha-icon><span>${esc(s.label || s.url)}</span>
        </button>`).join("");
      this.$.pop.querySelectorAll(".pitem").forEach((el) => {
        el.addEventListener("click", () => {
          const s = itens[+el.dataset.k];
          this._closePop();
          if (c.haptic !== false) haptic("selection");
          if (i !== this._i) this._animateTo(i);
          navigate(s.url, false);
        });
      });
      const l = (i + 0.5) * (g.L / g.n);
      const [x, y] = mapper(g.p.position, g.L, g.T).m(l, g.T / 2);
      const st = this.$.pop.style;
      st.left = st.right = st.top = st.bottom = "auto"; st.transform = "none";
      if (g.vert) {
        st.top = `${y}px`; st.transform = "translateY(-50%)";
        if (g.p.position === "left") st.left = `${g.T + 14}px`; else st.right = `${g.T + 14}px`;
      } else {
        st.left = `${x}px`; st.transform = "translateX(-50%)";
        if (g.p.position === "bottom") st.bottom = `${g.T + 16}px`; else st.top = `${g.T + 16}px`;
      }
      this._pop = i;
      this.$.pop.classList.add("open");
    }

    /* ---------- toque ---------- */
    _pick(i, user) {
      const c = this._config, r = c.routes[i];
      if (!r) return;
      if (user && c.haptic !== false) haptic("selection");
      if (r.submenu && r.submenu.length) {
        if (this._pop === i) this._closePop(); else this._openPop(i);
        return;
      }
      this._closePop();
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
      navigate((r.tap_action && r.tap_action.navigation_path) || r.url, false);
    }

    /* ---------- animação ---------- */
    _animateTo(to) {
      const c = this._config;
      const from = this._i;
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this._i = to;
      this.$.items.forEach((el, k) => el.classList.toggle("active", k === to));
      if (c.anim === "none" || reduce || from < 0 || !this._geo) {
        this._paintFace(to);
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
     * profundidade ou a posição mudam) e o transform da peça. */
    _render(idx, depth, iconIdx, lift, squash) {
      const g = this._geo;
      if (!g) return;
      // Nenhuma rota casa com a tela de agora (é comum: a barra leva para
      // fora dela mesma). A peça some, mas a barra continua lá — sumir inteira
      // deixava o card invisível, sem erro nenhum.
      if (idx < 0) {
        this.$.bubble.style.opacity = "0";
        this.$.path.setAttribute("d", plateD(g.p.position, g.L, g.T, g.R, null));
        this._lastD = -1; this._lastCl = -1;
        return;
      }
      this.$.bubble.style.opacity = "1";
      const c = this._config;
      const margin = clamp(num(c.bubble_margin, 6), 0, 40);
      const r = c.bubble / 2 + margin;
      const cl = (idx + 0.5) * (g.L / g.n);
      const cy = cyOf(depth, r, c.dock, g.T);

      if (depth !== this._lastD || cl !== this._lastCl) {
        // O entalhe copia a FORMA da peça, não um círculo genérico: com o
        // triângulo (ou o triângulo de cabeça para baixo) o vão precisa ter a
        // mesma espessura em toda a volta.
        const poly = pieceOutline(c.bubble_shape, c.bubble, margin, c.bubble_rotate, cl, cy, c.triangle_angle);
        const notch = depth > 0.02
          ? (poly ? { chain: notchChain(poly) } : { cl, cy, r })
          : null;
        const d = plateD(g.p.position, g.L, g.T, g.R,
          notch && (notch.chain || notch.r) ? notch : null);
        this.$.path.setAttribute("d", d);
        if (c.bar_3d) {
          this.$.clip.setAttribute("d", d);
          this.$.lit.setAttribute("d", d);
          this.$.dent.setAttribute("d", d);
          this.$.lit.setAttribute("transform", "translate(1.6,1.6)");
          this.$.dent.setAttribute("transform", "translate(-1.6,-1.6)");
        }
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

      if (this._faceIdx !== iconIdx) { this._paintFace(iconIdx); this._faceIdx = iconIdx; }
      const route = c.routes[iconIdx] || {};
      const img = route.image || c.bubble_image;
      if (this._bimg !== img) {
        const old = this.$.bubble.querySelector(".bimg");
        if (old) old.remove();
        if (img) {
          const el = document.createElement("img");
          el.className = "bimg"; el.src = img; el.alt = "";
          this.$.bubble.appendChild(el);
        }
        // por classe, não por estilo inline: o <ha-icon> do HA escreve no
        // próprio `style.display` e apagaria a nossa regra.
        this.$.bubble.classList.toggle("img", !!img);
        this._bimg = img;
      }
      const ico = route.icon || "mdi:circle-outline";
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
  const SHAPE_OPTS = [
    { value: "circle", label: "Redondo" }, { value: "squircle", label: "Quadrado arredondado" },
    { value: "triangle", label: "Triângulo" }, { value: "diamond", label: "Losango" },
    { value: "hexagon", label: "Hexágono" },
  ];
  const STYLE_OPTS = [
    { value: "flat", label: "Chapado" }, { value: "sphere", label: "Esfera 3D" },
    { value: "glass", label: "Vidro" }, { value: "paper", label: "Papel em relevo" },
    { value: "metal", label: "Metal escovado" },
    { value: "none", label: "Sem fundo (só a imagem)" },
    { value: "diamante", label: "Pedra · Diamante" },
    { value: "rubi", label: "Pedra · Rubi" },
    { value: "topazio", label: "Pedra · Topázio" },
    { value: "esmeralda", label: "Pedra · Esmeralda" },
    { value: "obsidiana", label: "Pedra · Obsidiana" },
    { value: "quartzo-rosa", label: "Pedra · Quartzo rosa" },
    { value: "agua-marinha", label: "Pedra · Água-marinha" },
    { value: "marmore-branco", label: "Pedra · Mármore branco" },
    { value: "marmore-negro", label: "Pedra · Mármore negro" },
    { value: "perola-branca", label: "Pérola branca" },
    { value: "perola-negra", label: "Pérola negra" },
  ];
  const PROFILE_LABEL = { mobile: "Celular", tablet: "Tablet", desktop: "Computador" };

  class MwNavBarCardEditor extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: "open" }); this._open = {}; }

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
            { name: "inline", selector: { boolean: {} } },
            { name: "bar_3d", selector: { boolean: {} } },
            { name: "bar_opacity", selector: { number: { min: 0.2, max: 1, step: 0.05, mode: "slider" } } },
            { name: "gap", selector: { number: { min: -40, max: 64, mode: "slider" } } },
            { name: "max_width", selector: { number: { min: 240, max: 1400, mode: "box" } } },
          ],
        },
        { name: "paper", selector: { select: { mode: "dropdown", options: paperOptions() } } },
        { name: "paper_dark", selector: { select: { mode: "dropdown", options: paperDarkOptions() } } },
        {
          name: "", type: "grid", column_min_width: "180px", schema: [
            { name: "bubble_shape", selector: { select: { mode: "dropdown", options: SHAPE_OPTS } } },
            { name: "bubble_style", selector: { select: { mode: "dropdown", options: STYLE_OPTS } } },
            { name: "accent", selector: { text: {} } },
            { name: "bubble", selector: { number: { min: 24, max: 140, mode: "slider" } } },
            { name: "dock", selector: { number: { min: 0, max: 1.6, step: 0.05, mode: "slider" } } },
            { name: "bubble_opacity", selector: { number: { min: 0.2, max: 1, step: 0.05, mode: "slider" } } },
            { name: "bubble_rotate", selector: { number: { min: 0, max: 360, step: 5, mode: "slider" } } },
            { name: "bubble_margin", selector: { number: { min: 0, max: 24, mode: "slider" } } },
            { name: "triangle_angle", selector: { number: { min: 15, max: 150, step: 5, mode: "slider" } } },
            { name: "bubble_bevel", selector: { boolean: {} } },
          ],
        },
        {
          name: "", type: "grid", column_min_width: "220px", schema: [
            { name: "bubble_image", selector: { text: {} } },
            { name: "image_3d", selector: { boolean: {} } },
          ],
        },
        ...PROFILES.map(prof),
      ];
    }

    _label(s) {
      const L = {
        anim: "Animação", float: "Barra flutuante",
        inline: "Dentro do card (não colada na tela)", bar_3d: "Barra em relevo 3D",
        bar_opacity: "Transparência da barra",
        gap: "Espaço entre os botões (px; negativo aperta)",
        bubble_bevel: "Aresta 3D em volta do botão",
        max_width: "Largura máxima (px)", accent: "Cor de destaque (CSS)",
        bubble: "Tamanho do botão (px)", bubble_shape: "Forma do botão",
        bubble_style: "Acabamento do botão", bubble_opacity: "Transparência do botão",
        bubble_image: "Imagem dentro do botão (ex.: /local/mw/mw-logo.png)",
        image_3d: "Relevo 3D na imagem",
        dock: "Quanto o botão entra na barra",
        bubble_rotate: "Giro do botão (graus)", bubble_margin: "Vão entre o botão e a barra (px)",
        triangle_angle: "Ângulo do topo do triângulo (60° = equilátero)", paper: "Papel (tema claro)",
        paper_dark: "Papel (tema escuro)", position: "Posição", show: "Mostrar",
        hidden: "Esconder", ...PROFILE_LABEL,
      };
      return L[s.name] || s.name;
    }

    _row(r, i, sub) {
      const k = sub === undefined ? `${i}` : `${i}.${sub}`;
      const n = r.submenu ? r.submenu.length : 0;
      return `
        <div class="rt${sub === undefined ? "" : " sub"}" data-k="${k}">
          <input class="ico" value="${esc(r.icon)}" placeholder="mdi:sofa" data-f="icon">
          <input class="lb" value="${esc(r.label)}" placeholder="SALA" data-f="label">
          <input class="url" value="${esc(r.url)}" placeholder="/sala-7-1" data-f="url">
          <input class="cor" value="${esc(r.color)}" placeholder="cor" data-f="color">
          ${sub === undefined ? `<button class="btn sb" title="Subitens">▾${n || ""}</button>` : ""}
          ${sub === undefined ? '<button class="btn up" title="Subir">↑</button><button class="btn dn" title="Descer">↓</button>' : ""}
          <button class="btn rm" title="Remover">✕</button>
        </div>`;
    }

    _render() {
      if (!this._config) return;
      const routes = this._config.routes || [];
      this.shadowRoot.innerHTML = `
        <style>
          .rt { display:flex; align-items:center; gap:5px; padding:3px 0; }
          .rt.sub { padding-left:22px; opacity:.92; }
          .rt input { flex:1; min-width:0; padding:7px; border-radius:8px;
            border:1px solid var(--divider-color); background:var(--card-background-color);
            color:var(--primary-text-color); font-size:13px; }
          .rt .ico { width:104px; flex:0 0 104px; }
          .rt .lb { width:96px; flex:0 0 96px; }
          .rt .cor { width:66px; flex:0 0 66px; }
          .btn { cursor:pointer; background:none; border:0; color:var(--secondary-text-color);
            font-size:14px; padding:4px 5px; line-height:1; }
          .btn:hover { color:var(--primary-color); }
          h4 { margin:14px 0 4px; font-size:13px; color:var(--secondary-text-color);
            text-transform:uppercase; letter-spacing:.04em; }
          .add { color:var(--primary-color); font-size:13px; }
          .add.s { margin-left:22px; font-size:12px; }
        </style>
        <h4>Rotas</h4>
        <div class="rows">
          ${routes.map((r, i) => this._row(r, i)
            + (this._open[i]
              ? (r.submenu || []).map((s, j) => this._row(s, i, j)).join("")
                + `<button class="btn add s" data-addsub="${i}">+ subitem</button>`
              : "")).join("")}
        </div>
        <button class="btn add">+ rota</button>
        <h4>Aparência</h4>
        <ha-form></ha-form>`;

      const form = this.shadowRoot.querySelector("ha-form");
      form.hass = this._hass;
      form.schema = this._schema();
      form.data = {
        ...DEFAULTS, ...this._config,
        ...Object.fromEntries(PROFILES.map((p) => [p, { ...DEFAULTS[p], ...(this._config[p] || {}) }])),
      };
      form.computeLabel = (s) => this._label(s);
      form.addEventListener("value-changed", (e) => this._onForm(e));
      this._form = form;

      this.shadowRoot.querySelectorAll(".rt").forEach((row) => {
        const [i, j] = row.dataset.k.split(".").map(Number);
        const isSub = !isNaN(j);
        row.querySelectorAll("input").forEach((inp) => {
          inp.addEventListener("change", () => {
            const rs = this._clone();
            const alvo = isSub ? rs[i].submenu[j] : rs[i];
            const v = inp.value.trim();
            if (v) alvo[inp.dataset.f] = v; else delete alvo[inp.dataset.f];
            this._emit({ ...this._config, routes: rs });
          });
        });
        const sb = row.querySelector(".sb");
        if (sb) sb.addEventListener("click", () => {
          this._open[i] = !this._open[i];
          if (this._open[i] && !this._config.routes[i].submenu) {
            const rs = this._clone(); rs[i].submenu = [];
            this._emit({ ...this._config, routes: rs });
          }
          this._render();
        });
        const up = row.querySelector(".up");
        if (up) up.addEventListener("click", () => this._move(i, i - 1));
        const dn = row.querySelector(".dn");
        if (dn) dn.addEventListener("click", () => this._move(i, i + 1));
        row.querySelector(".rm").addEventListener("click", () => {
          const rs = this._clone();
          if (isSub) rs[i].submenu.splice(j, 1); else rs.splice(i, 1);
          this._emit({ ...this._config, routes: rs }); this._render();
        });
      });
      this.shadowRoot.querySelectorAll("[data-addsub]").forEach((b) =>
        b.addEventListener("click", () => {
          const i = +b.dataset.addsub, rs = this._clone();
          rs[i].submenu = (rs[i].submenu || []).concat([{ url: "", label: "", icon: "mdi:chevron-right" }]);
          this._emit({ ...this._config, routes: rs }); this._render();
        }));
      this.shadowRoot.querySelector(".add:not(.s)").addEventListener("click", () => {
        const rs = this._clone().concat([{ url: "", label: "", icon: "mdi:circle-outline" }]);
        this._emit({ ...this._config, routes: rs }); this._render();
      });
    }

    _clone() { return (this._config.routes || []).map((r) => ({ ...r, submenu: r.submenu ? r.submenu.map((s) => ({ ...s })) : undefined })); }

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
      this._emit({ ...this._config, routes: MwNavBarCardEditor.move(this._clone(), from, to) });
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
    description: "Barra de navegação com entalhe líquido — o item ativo é uma peça que salta, voa e pousa.",
    preview: true,
    documentationURL: "https://github.com/visaodeempresa/mw-ha-nav-bar-card",
  });

  console.info(`%c MW-NAV-BAR-CARD %c ${VERSION} `,
    "color:#fff;background:#3f51b5;font-weight:700", "color:#3f51b5;background:#fff");

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { MwNavBarCard, MwNavBarCardEditor, plateD, cyOf, mapper, faceStyle,
      SHAPES, STONES, polyClip, polyOf, triPoly, pieceOutline, notchChain, DEFAULTS };
  }
})();
