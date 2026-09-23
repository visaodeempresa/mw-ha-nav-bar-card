/* Probe headless — instancia card e editor sem navegador.
 * Falha o CI se a geometria do entalhe, a rota ativa, o mover da lista ou a
 * regra de "default fora do YAML" quebrar. */
"use strict";

const stubEl = () => ({
  style: { setProperty() {}, removeProperty() {} },
  classList: { toggle() {}, add() {}, remove() {} },
  dataset: {},
  addEventListener() {}, removeEventListener() {},
  setAttribute() {}, getAttribute() { return null; },
  querySelector() { return stubEl(); }, querySelectorAll() { return []; },
  appendChild() {}, dispatchEvent() { return true; },
});

global.HTMLElement = class {
  attachShadow() {
    this.shadowRoot = {
      innerHTML: "",
      querySelector: () => stubEl(),
      querySelectorAll: () => [],
    };
    return this.shadowRoot;
  }
  addEventListener() {} removeEventListener() {} dispatchEvent() { return true; }
  get isConnected() { return false; }
};
const reg = {};
global.customElements = { define: (n, c) => { reg[n] = c; }, get: (n) => reg[n] };
global.document = { createElement: () => stubEl() };
global.window = {
  innerWidth: 390, location: { pathname: "/sala-7-1" },
  addEventListener() {}, removeEventListener() {},
  matchMedia: () => ({ matches: false }),
  customCards: [],
};
if (!global.navigator) global.navigator = {};
global.performance = { now: () => 0 };
global.getComputedStyle = () => ({ getPropertyValue: () => "#ffffff" });
global.history = { pushState() {}, replaceState() {} };
global.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
global.console.info = () => {};

const api = require("../dist/mw-nav-bar-card.js");
const { plateD, cyOf, mapper, DEFAULTS } = api;
const Card = reg["mw-nav-bar-card"];
const Editor = reg["mw-nav-bar-card-editor"];

let fails = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log(`  ok  ${name}`); return; }
  fails++; console.log(`FAIL  ${name}${extra ? " — " + extra : ""}`);
};

/* ---- geometria ---- */
const R = 29;
const flat = plateD("bottom", 400, 62, 28, null);
const notched = plateD("bottom", 400, 62, 28, { cl: 200, cy: cyOf(1, R), r: R });

ok("sem entalhe não emite Bézier", !/Q /.test(flat));
ok("com entalhe emite duas rampas Q", (notched.match(/Q /g) || []).length === 2);
ok("com entalhe emite o arco da bolha", (notched.match(/A /g) || []).length === 5);
ok("entalhe some sozinho quando a bolha sobe",
  !/Q /.test(plateD("bottom", 400, 62, 28, { cl: 200, cy: cyOf(0, R), r: R })));
ok("profundidade máxima encaixa meia bolha", Math.abs(cyOf(1, R) + R * 0.5) < 1e-9);
ok("profundidade zero tira a bolha da barra", -cyOf(0, R) > R);

const deep = /A 29 29 0 0 0 ([\d.]+),([\d.]+)/.exec(notched);
ok("o entalhe cava para dentro da barra", deep && +deep[2] > 0 && +deep[2] < 62,
  deep && deep[2]);

for (const pos of ["bottom", "top", "left", "right"]) {
  const d = plateD(pos, 400, 62, 28, { cl: 200, cy: cyOf(1, R), r: R });
  ok(`posição ${pos} gera path finito`, /^M [\d.]+,[\d.]+/.test(d) && !/NaN/.test(d));
}
const vert = mapper("left", 400, 62);
ok("barra vertical troca os eixos", vert.w === 62 && vert.h === 400);

/* ---- config ---- */
let threw = false;
try { new Card().setConfig({}); } catch (_) { threw = true; }
ok("config sem rotas é recusada", threw);

const card = new Card();
card.setConfig({ routes: [{ url: "/cozinha-7-1", icon: "mdi:pot" }, { url: "/sala-7-1", icon: "mdi:sofa" }] });
ok("drop-in: defaults aplicados", card._config.anim === "liquid" && card._config.desktop.position === "left");
ok("rota ativa casa por prefixo", card._routeIndex() === 1);
global.window.location.pathname = "/sala-7-1/0";
ok("rota ativa casa com a view junto", card._routeIndex() === 1);
global.window.location.pathname = "/outra";
ok("fora das rotas, ninguém fica ativo", card._routeIndex() === -1);

const card2 = new Card();
card2.setConfig({ routes: [{ url: "/a" }], desktop: { position: "bottom" } });
ok("desktop.position do navbar-card é respeitado", card2._config.desktop.position === "bottom");
ok("desktop.show cai no default", card2._config.desktop.show === DEFAULTS.desktop.show);

global.window.innerWidth = 390;
ok("perfil celular abaixo de 768", card2._profile().name === "mobile");
global.window.innerWidth = 900;
ok("perfil tablet entre 768 e 1280", card2._profile().name === "tablet");
global.window.innerWidth = 1600;
ok("perfil computador a partir de 1280", card2._profile().name === "desktop");

/* ---- editor ---- */
const L = ["a", "b", "c", "d"];
ok("subir uma casa", Editor.move(L, 2, 1).join("") === "acbd");
ok("DESCER uma casa sai do lugar", Editor.move(L, 1, 2).join("") === "acbd");
ok("mover para o fim", Editor.move(L, 0, 3).join("") === "bcda");
ok("índice fora da lista não quebra", Editor.move(L, 9, 0).join("") === "abcd");

const ed = new Editor();
ed._config = { routes: [{ url: "/a" }] };
let last = null;
ed.dispatchEvent = (e) => { last = e.detail.config; return true; };
ed._onForm({ detail: { value: { ...DEFAULTS, anim: "liquid", paper: "blue-3", mobile: { ...DEFAULTS.mobile } } } });
ok("default não polui o YAML", last && last.anim === undefined && last.mobile === undefined);
ok("valor customizado entra no YAML", last && last.paper === "blue-3");
ok("rotas sobrevivem à edição de aparência", last && last.routes.length === 1);

/* ---- v0.2.0: dock, formas, acabamento, submenu, cor por rota ---- */
const { faceStyle, SHAPES } = api;
ok("dock 0 mantém a peça meio fora", cyOf(1, R, 0, 62) < 0);
ok("dock 1 afunda a peça na barra", cyOf(1, R, 1, 62) > 0);
ok("peça afundada apaga o entalhe",
  !/Q /.test(plateD("bottom", 400, 62, 28, { cl: 200, cy: cyOf(1, R, 1, 62), r: R })));
ok("dock meio-termo ainda entalha",
  /Q /.test(plateD("bottom", 400, 62, 28, { cl: 200, cy: cyOf(1, R, 0.3, 62), r: R })));
ok("dock fora de 0..1 não quebra", isFinite(cyOf(1, R, 9, 62)) && isFinite(cyOf(1, R, -3, 62)));

ok("triângulo é calculado pelo ângulo", !!SHAPES.triangle.tri && !SHAPES.triangle.poly);
ok("redondo é raio, não polígono", SHAPES.circle.radius === "50%" && !SHAPES.circle.poly);
ok("cinco formas disponíveis", Object.keys(SHAPES).length === 5);

/* ---- entalhe com a forma da peça (vão uniforme) e giro ---- */
const { pieceOutline, notchChain, polyClip, polyOf, triPoly } = api;
ok("clip-path sai do mesmo polígono do entalhe",
  polyClip(polyOf("triangle", 60)) === polyClip(triPoly(60)));

/* 60° é o equilátero: os três lados iguais. */
const eq = triPoly(60);
const lado = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const l1 = lado(eq[0], eq[1]), l2 = lado(eq[1], eq[2]), l3 = lado(eq[2], eq[0]);
ok("60° dá os três lados iguais", Math.abs(l1 - l2) < 1e-9 && Math.abs(l2 - l3) < 1e-9);
ok("equilátero ocupa a largura da caixa", Math.abs(l2 - 1) < 1e-9);
const agudo = triPoly(30), obtuso = triPoly(120);
const baseDe = (p) => Math.abs(p[1][0] - p[2][0]);
ok("ângulo menor afina a ponta", baseDe(agudo) < baseDe(eq));
// Passando de 60° a base já encosta na largura da caixa: o que muda daí para
// frente é a ALTURA, não a base.
const alturaDe = (p) => Math.abs(p[1][1] - p[0][1]);
ok("ângulo maior achata o triângulo", alturaDe(obtuso) < alturaDe(eq));
ok("ângulo menor alonga o triângulo", alturaDe(agudo) > alturaDe(eq));
const apex = (p) => {
  const v1 = [p[1][0] - p[0][0], p[1][1] - p[0][1]], v2 = [p[2][0] - p[0][0], p[2][1] - p[0][1]];
  const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2));
  return Math.acos(cos) * 180 / Math.PI;
};
ok("o ângulo pedido é o ângulo entregue (30°)", Math.abs(apex(agudo) - 30) < 0.01, apex(agudo).toFixed(2));
ok("o ângulo pedido é o ângulo entregue (120°)", Math.abs(apex(obtuso) - 120) < 0.01, apex(obtuso).toFixed(2));
ok("ângulo absurdo é contido", isFinite(triPoly(999)[0][1]) && isFinite(triPoly(-5)[0][1]));
const triOut = pieceOutline("triangle", 52, 6, 0, 200, -18, 60);
ok("contorno do triângulo tem 3 vértices", triOut.length === 3);
ok("contorno é maior que a peça (vão)",
  Math.hypot(triOut[0][0] - 200, triOut[0][1] + 18) > 52 * 0.46);
ok("círculo não gera polígono", pieceOutline("circle", 52, 6, 0, 200, -18, 60) === null);

const g0 = notchChain(pieceOutline("triangle", 52, 6, 0, 200, -14, 60));
ok("triângulo em pé entra na barra", !!g0 && g0.length >= 3);
const g180 = notchChain(pieceOutline("triangle", 52, 6, 180, 200, -14, 60));
ok("triângulo invertido também entalha", !!g180 && g180.length >= 3);
ok("o giro muda o desenho do entalhe",
  JSON.stringify(g0) !== JSON.stringify(g180));
ok("cadeia vai da esquerda para a direita", g180[0][0] < g180[g180.length - 1][0]);
ok("peça toda fora não entalha",
  notchChain(pieceOutline("triangle", 52, 6, 0, 200, -90, 60)) === null);
ok("peça toda dentro não vira buraco",
  notchChain(pieceOutline("triangle", 52, 6, 0, 200, 31, 60)) === null);
const dTri = plateD("bottom", 400, 62, 28, { chain: g180 });
ok("entalhe de polígono vira path", /Q /.test(dTri) && !/NaN/.test(dTri));
ok("entalhe de polígono não usa arco de bolha", (dTri.match(/A /g) || []).length === 4);
ok("vão maior afasta mais o contorno",
  Math.hypot(pieceOutline("triangle", 52, 16, 0, 0, 0, 60)[0][0], pieceOutline("triangle", 52, 16, 0, 0, 0, 60)[0][1])
  > Math.hypot(triOut[0][0] - 200, triOut[0][1] + 18));

ok("esfera tem luz especular", /radial-gradient/.test(faceStyle("sphere", "#f00", false).background));
ok("papel muda o relevo entre claro e escuro",
  faceStyle("paper", "#f00", true).shadow !== faceStyle("paper", "#f00", false).shadow);
ok("chapado não inventa gradiente", faceStyle("flat", "#f00", false).background === "#f00");
ok("acabamento desconhecido cai no chapado", faceStyle("xyz", "#f00", false).background === "#f00");

/* ---- pedras ---- */
const { STONES } = api;
const PEDRAS = ["diamante", "rubi", "topazio", "esmeralda", "obsidiana", "quartzo-rosa",
  "agua-marinha", "marmore-branco", "marmore-negro", "perola-branca", "perola-negra"];
ok("as onze pedras existem", PEDRAS.every((k) => !!STONES[k]) && Object.keys(STONES).length === 11);
ok("toda pedra diz a tinta do ícone",
  PEDRAS.every((k) => STONES[k].ink === "light" || STONES[k].ink === "dark"));
ok("a pedra ignora a cor de destaque",
  faceStyle("rubi", "#00ff00", false).background === faceStyle("rubi", "#0000ff", true).background);
ok("a pedra não deixa a cor vazar", !/00ff00/.test(faceStyle("rubi", "#00ff00", false).background));
ok("pedra clara pede tinta escura",
  ["diamante", "marmore-branco", "perola-branca", "quartzo-rosa"].every((k) => STONES[k].ink === "dark"));
ok("pedra escura pede tinta clara",
  ["obsidiana", "marmore-negro", "perola-negra", "rubi"].every((k) => STONES[k].ink === "light"));
ok("toda pedra tem faceta ou veio e brilho especular",
  PEDRAS.every((k) => {
    const bg = STONES[k].bg.join(" ");
    return /conic-gradient|repeating-linear-gradient/.test(bg) && /radial-gradient/.test(bg);
  }));
ok("nenhuma pedra usa imagem externa",
  PEDRAS.every((k) => !/url\(/.test(STONES[k].bg.join(" "))));
ok("mármore tem veio, não faceta",
  /repeating-linear-gradient/.test(STONES["marmore-branco"].bg.join(" ")));
ok("pérola tem nácar iridescente",
  /conic-gradient/.test(STONES["perola-negra"].bg.join(" ")));

const card3 = new Card();
card3.setConfig({ routes: [
  { url: "/a", label: "A", color: "#ff0000" },
  { label: "B", submenu: [{ url: "/b1" }, { url: "/b2" }] },
] });
global.window.location.pathname = "/b2";
ok("subitem acende o botão pai", card3._routeIndex() === 1);
global.window.location.pathname = "/a";
ok("rota de primeiro nível continua acendendo", card3._routeIndex() === 0);
ok("cor por rota sobrevive ao setConfig", card3._config.routes[0].color === "#ff0000");
ok("submenu é copiado, não referenciado", card3._config.routes[1].submenu.length === 2);

const ed2 = new Editor();
ed2._config = { routes: [{ url: "/a", submenu: [{ url: "/a1" }] }, { url: "/b" }] };
const moved = Editor.move(ed2._clone(), 0, 1);
ok("mover rota leva o submenu junto", moved[1].submenu && moved[1].submenu.length === 1);
ok("clone não compartilha o submenu", ed2._clone()[0].submenu !== ed2._config.routes[0].submenu);

const stub = Card.getStubConfig({ panels: {} });
ok("stub config traz rotas", Array.isArray(stub.routes) && stub.routes.length === 3);

console.log(fails ? `\n${fails} prova(s) falharam` : "\ntodas as provas passaram");
process.exit(fails ? 1 : 0);
