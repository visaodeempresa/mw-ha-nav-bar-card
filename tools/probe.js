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

const stub = Card.getStubConfig({ panels: {} });
ok("stub config traz rotas", Array.isArray(stub.routes) && stub.routes.length === 3);

console.log(fails ? `\n${fails} prova(s) falharam` : "\ntodas as provas passaram");
process.exit(fails ? 1 : 0);
