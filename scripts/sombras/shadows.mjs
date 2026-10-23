import { fatorLuzNatural, darknessNoPonto } from "./interiores.mjs";
import { MOD, setting, tokenFlags, sceneFlags, clamp } from "./constants.mjs";
import { collectLights } from "./lighting.mjs";

const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");
const ALIAS_STATUS = { caido: ["prone"], invisivel: ["invisible"] };

/** Lista de efeitos que removem a sombra, já normalizada (calculada uma vez por atualização, não por token). */
function lerEfeitos(texto = setting("efeitosSemSombra")) {
  const nomes = String(texto ?? "").split(/[,;]/).map(normalizar).filter(Boolean);
  return { nomes, ids: new Set(nomes.flatMap((n) => [n, ...(ALIAS_STATUS[n] ?? [])])) };
}

/** Nome do efeito (configurável; padrão: Caído, Invisível) que remove a sombra do token, ou null. */
export function efeitoSemSombra(token, ef = lerEfeitos()) {
  const actor = token.actor;
  if (!actor || !ef.nomes.length) return null;
  for (const e of actor.effects.contents) {
    if (e.disabled || e.isSuppressed) continue;
    const rotulo = e.name ?? e.label;
    if ([...(e.statuses ?? [])].some((s) => ef.ids.has(normalizar(s)))) return rotulo;
    if (ef.nomes.includes(normalizar(rotulo))) return rotulo; // nome exato ("Espírito Caído" não conta)
  }
  return null;
}

/** Configurações lidas uma vez por atualização (game.settings.get a cada token é desperdício). */
function lerConfig() {
  const cfg = {
    show: setting("showShadows"),
    opacity: setting("shadowOpacity"),
    blur: setting("shadowBlur"),
    height: setting("defaultHeight"),
    maxShadows: setting("defaultMaxShadows"),
    lengthFactor: setting("maxLengthFactor"),
    tremor: setting("tremorSombras"),
    ownDist: Number(setting("luzPropriaDistancia")),
    efeitosTxt: setting("efeitosSemSombra")
  };
  cfg.efeitos = lerEfeitos(cfg.efeitosTxt);
  cfg.chave = [cfg.show, cfg.opacity, cfg.blur, cfg.height, cfg.maxShadows, cfg.lengthFactor, cfg.tremor, cfg.ownDist, cfg.efeitosTxt].join("|");
  return cfg;
}

/** Assinatura barata das luzes: só muda quando alguma luz (ou a forma bloqueada por paredes) muda. */
function assinaturaLuzes(lights) {
  let sig = "";
  for (const l of lights) {
    let forma = 0;
    const pts = l.source?.shape?.points;
    if (pts) for (let i = 0; i < pts.length; i++) forma += pts[i];
    sig += `${l.x | 0},${l.y | 0},${l.radius | 0},${l.lum},${l.negative ? 1 : 0},${l.animation?.type ?? ""},${pts?.length ?? 0},${forma | 0};`;
  }
  return sig;
}

const MIN_STRENGTH = 0.04;

/**
 * Sombra gerada pela luz do próprio token: a luz é tratada como se estivesse um pouco à frente
 * dele (na direção da rotação do token), então a sombra cai para trás.
 */
function sombraDaLuzPropria(token, luz, maxLen, lightFactor, passos) {
  if (!(passos > 0)) return null;
  const dist = passos * canvas.dimensions.size;
  if (dist >= luz.radius) return null;
  const ang = Math.toRadians((token.document.rotation ?? 0) + 90); // rotação 0 = voltado para baixo
  const vx = -Math.cos(ang) * dist, vy = -Math.sin(ang) * dist;    // da luz (à frente) para o token
  const near = 1 - dist / luz.radius;
  const strength = Math.pow(near, 0.6) * Math.min(1, 0.6 + luz.lum) * lightFactor;
  if (strength < MIN_STRENGTH) return null;
  return { strength, phi: Math.atan2(vy, vx), length: maxLen * Math.pow(near, 1.2), anim: luz.animation };
}
/**
 * Segmentos de parede que podem cortar uma sombra dentro do círculo (cx, cy, raio).
 * Lê o estado direto do documento da parede: portas abertas e paredes sem restrição de luz ficam de fora.
 */
function segmentosParede(cx, cy, raio) {
  const caixa = new PIXI.Rectangle(cx - raio, cy - raio, raio * 2, raio * 2);
  const candidatas = canvas.walls.quadtree?.getObjects?.(caixa) ?? canvas.walls.placeables;
  const ABERTA = CONST.WALL_DOOR_STATES?.OPEN ?? 1;
  const segs = [];
  for (const w of candidatas) {
    const d = w.document;
    if (!d.light) continue;                  // não restringe luz
    if (d.door && d.ds === ABERTA) continue; // porta aberta: a sombra passa
    segs.push(d.c);
  }
  return segs;
}

const GRID = 8; // subdivisões da malha da sombra (81 vértices: leve e suficiente para a curva)

/**
 * Desenha as sombras de tokens e tiles em containers dentro de canvas.primary:
 * as dos tokens logo abaixo da camada de tokens; as dos tiles logo abaixo da camada de tiles
 * (assim a sombra do tile não cobre o próprio tile).
 *
 * Custo reduzido de propósito:
 *  - configurações lidas uma vez por atualização (não por token);
 *  - cada objeto guarda uma assinatura do que importa e não recalcula se nada mudou
 *    (o hook refreshToken dispara a todo momento: hover, mira, seleção...);
 *  - luzes só invalidam as sombras quando realmente mudam;
 *  - malha pequena (GRID 8) com envio de vértices à GPU só quando a sombra muda;
 *  - o tremor roda a ~20 quadros/s, só nas sombras animadas e visíveis na tela;
 *  - desfoque em meia resolução e uma passada, e só existe filtro se houver sombra a desfocar.
 */
export class ShadowManager {
  constructor() {
    this.entries = new Map();
    this.lights = [];
    this.version = 0;
    this.sig = "";
    this.cfg = lerConfig();
    this.animados = new Set();
    this.tilesComSombra = new Set();
    this.cacheParedes = new Map(); // limites de parede por sombra (limpo quando paredes/portas mudam)
    this._acc = 0;

    const layers = canvas.primary.constructor.SORT_LAYERS ?? {};
    const criar = (nome, sortLayer) => {
      const c = new PIXI.Container();
      c.name = `${MOD}-${nome}`;
      c.eventMode = "none";
      // propriedades usadas pela ordenação do PrimaryCanvasGroup
      c.elevation = 0;
      c.sortLayer = sortLayer;
      c.sort = 0;
      c.zIndex = 0;
      canvas.primary.addChild(c);
      return c;
    };
    this.container = criar("shadows", (layers.TOKENS ?? 700) - 1);
    this.tileContainer = criar("tile-shadows", (layers.TILES ?? 500) - 1);
    this.#aplicarBlur();
    // Sombras de luzes animadas tremem levemente (ver animar()).
    this._tick = () => this.animar();
    canvas.app.ticker.add(this._tick);
  }

  /** Faz as sombras de luzes com animação (tocha, chama, pulso...) tremerem levemente. */
  animar() {
    if (!this.animados.size) return;
    this._acc += canvas.app.ticker.deltaMS;
    if (this._acc < 50) return; // ~20 quadros por segundo bastam para um tremor suave
    this._acc = 0;
    const t = performance.now() / 1000;
    const vr = canvas.visibleRect;
    for (const sm of this.animados) {
      const b = sm._base;
      if (!b || !sm.visible) continue;
      if (vr) { // fora da tela: não gasta cálculo
        const pad = b.length + Math.max(b.w, b.h);
        if (b.c.x < vr.x - pad || b.c.x > vr.x + vr.width + pad || b.c.y < vr.y - pad || b.c.y > vr.y + vr.height + pad) continue;
      }
      const { type, speed = 5, intensity = 5 } = b.anim;
      const freq = 2 * Math.PI * (0.5 + 0.25 * speed);
      const ruidoso = ["torch", "flame", "fumes"].includes(type);
      // tocha/chama/fumaça: tremor irregular; demais animações: oscilação suave
      const onda = (a, off) => ruidoso
        ? (Math.sin(t * freq * a + b.fase + off) + Math.sin(t * freq * a * 1.7 + b.fase * 1.3 + off) + Math.sin(t * freq * a * 2.9 + b.fase * 0.7 + off)) / 3
        : Math.sin(t * freq * a * 0.6 + b.fase + off);
      const k = (0.4 + 0.06 * intensity) * (ruidoso ? 1.3 : 0.8);
      const dPhi = 0.025 * k * onda(1, 0);      // cerca de 1° de balanço
      const dLen = 0.06 * k * onda(1.3, 2);     // comprimento varia poucos %
      const dAlpha = 0.10 * k * onda(0.9, 4);   // opacidade varia levemente
      sm.alpha = clamp(b.alpha * (1 + dAlpha), 0, 1);
      this.#deform(sm, b, b.phi + dPhi, Math.max(0, b.length * (1 + dLen)));
    }
  }

  /** Cria/atualiza o desfoque só quando o valor muda (e só aplica se houver o que desfocar). */
  #aplicarBlur() {
    const b = this.cfg.blur;
    if (b > 0) {
      // qualidade 1 e meia resolução: sombra já é suave, e isso corta o custo de GPU do filtro
      this.blurToken ??= new PIXI.BlurFilter(b, 1, 0.5);
      this.blurTile ??= new PIXI.BlurFilter(b, 1, 0.5);
      this.blurToken.blur = b;
      this.blurTile.blur = b;
      this.container.filters = [this.blurToken];
    } else {
      this.container.filters = null;
    }
    this.#filtroTiles();
  }

  #filtroTiles() {
    const quer = this.cfg.blur > 0 && this.tilesComSombra.size > 0;
    const tem = !!this.tileContainer.filters;
    if (quer && !tem) this.tileContainer.filters = [this.blurTile];
    else if (!quer && tem) this.tileContainer.filters = null;
  }

  /**
   * Relê configurações e luzes. A versão só sobe quando algo que afeta as sombras mudou
   * (ou quando force = true: efeitos, regiões, flags, cena), evitando recalcular tudo à toa.
   */
  collect(force = false) {
    this.cfg = lerConfig();
    this.#aplicarBlur();
    this.lights = collectLights();
    const sf = sceneFlags(canvas.scene);
    const sig = [this.cfg.chave, JSON.stringify(sf), (canvas.environment?.darknessLevel ?? 0).toFixed(3), assinaturaLuzes(this.lights)].join("#");
    if (force) this.cacheParedes.clear();
    if (force || sig !== this.sig) this.version++;
    this.sig = sig;
  }

  refreshAll() {
    const vivos = new Set();
    for (const token of canvas.tokens.placeables) {
      vivos.add(`token:${token.document.id}`);
      this.refreshToken(token);
    }
    for (const tile of canvas.tiles.placeables) {
      vivos.add(`tile:${tile.document.id}`);
      this.refreshTile(tile);
    }
    for (const key of [...this.entries.keys()]) if (!vivos.has(key)) this.remove(key);
  }

  /** Explica, em linhas de texto, por que o token tem ou não sombra. */
  diagnosticar(token) {
    const doc = token.document;
    const flags = tokenFlags(doc);
    const mesh = token.mesh;
    const ok = (b) => (b ? "✔" : "✘");
    const L = [];
    const cfg = this.cfg;

    L.push(`${ok(cfg.show)} Opção “Mostrar sombras” (só deste computador): ${cfg.show ? "ligada" : "DESLIGADA"}`);
    L.push(`${ok(flags.castShadow !== false)} “Projetar sombra” no token: ${flags.castShadow === false ? "DESLIGADO" : "ligado"}`);
    const ef = efeitoSemSombra(token, cfg.efeitos);
    L.push(`${ok(!ef)} Efeito que remove a sombra: ${ef ?? "nenhum"}`);
    L.push(`${ok(mesh?.texture?.valid)} Imagem do token carregada`);
    L.push(`${ok(token.isVisible)} Token visível para você`);

    const altura = Number.isFinite(flags.height) ? flags.height : cfg.height;
    L.push(`${ok(altura > 0)} Altura: ${altura} (${Number.isFinite(flags.height) ? "definida no token" : "padrão"})`);
    const maxS = Number.isInteger(flags.maxShadows) && flags.maxShadows >= 0 ? flags.maxShadows : cfg.maxShadows;
    L.push(`${ok(maxS > 0)} Máximo de sombras: ${maxS}`);

    const darkness = darknessNoPonto(token.center.x, token.center.y);
    const sf = sceneFlags(canvas.scene);
    const natural = sf.naturalLight ? clamp(sf.sunIntensity ?? 1, 0, 1) * (1 - darkness) * fatorLuzNatural(token.center.x, token.center.y) : 0;
    L.push(`${ok(natural > MIN_STRENGTH)} Luz natural: ${sf.naturalLight ? `ligada, força ${natural.toFixed(2)} (escuridão da cena ${darkness.toFixed(2)})` : "desligada nesta cena"}`);

    let alcancam = 0;
    if (mesh) {
      const c = token.center;
      const base = (Math.abs(mesh.width) + Math.abs(mesh.height)) / 2;
      for (const l of this.lights) {
        if (l.negative) continue;
        if (l.tokenId === doc.id) { if (cfg.ownDist > 0) alcancam++; continue; }
        const d = Math.hypot(c.x - l.x, c.y - l.y);
        if (d > l.radius || d < base * 0.4) continue;
        if (l.source?.shape?.contains && !l.source.shape.contains(c.x, c.y)) continue;
        const near = 1 - d / l.radius;
        const forca = Math.pow(near, 0.6) * Math.min(1, 0.6 + l.lum) * (0.5 + 0.5 * darkness);
        if (forca >= MIN_STRENGTH) alcancam++;
      }
    }
    L.push(`${ok(alcancam > 0)} Luzes que alcançam o token com força suficiente: ${alcancam} de ${this.lights.length}`);
    const fontes = (natural > MIN_STRENGTH ? 1 : 0) + alcancam;
    L.push(`Fontes de sombra: ${fontes}; sombras que seriam desenhadas: ${Math.min(fontes, maxS)}`);
    return L;
  }

  refreshToken(token) { this.#refresh(token, "token"); }
  refreshTile(tile) { this.#refresh(tile, "tile"); }

  #refresh(obj, tipo) {
    const doc = obj.document;
    const key = `${tipo}:${doc.id}`;
    const ehTile = tipo === "tile";
    const mesh = obj.mesh;
    const cfg = this.cfg;
    if (!mesh || !canvas.scene) return this.hide(key);

    const flags = tokenFlags(doc);
    const visivel = ehTile ? (obj.visible && !doc.hidden) : obj.isVisible;
    const c = ehTile ? { x: doc.x + doc.width / 2, y: doc.y + doc.height / 2 } : obj.center;
    const w = Math.abs(mesh.width), h = Math.abs(mesh.height);
    const rot = mesh.rotation ?? 0;
    const mx = mesh.scale?.x < 0 ? -1 : 1, my = mesh.scale?.y < 0 ? -1 : 1;
    const alpha = mesh.alpha ?? 1;
    const tex = mesh.texture;

    // Nada mudou desde o último cálculo? Então não faz nada.
    const sig = `${this.version}|${doc.rotation ?? 0}|${visivel ? 1 : 0}|${tex?.valid ? 1 : 0}|${tex?.baseTexture?.uid}|${c.x.toFixed(1)}|${c.y.toFixed(1)}|${rot.toFixed(3)}|${w.toFixed(1)}|${h.toFixed(1)}|${mx}${my}|${alpha.toFixed(2)}`;
    const entry = this.#entry(key);
    if (entry.sig === sig) return;
    entry.sig = sig;

    const habilitado = cfg.show && (ehTile
      ? flags.castShadow === true && !doc.hidden
      : flags.castShadow !== false && !efeitoSemSombra(obj, cfg.efeitos));
    if (!habilitado || !tex?.valid || !visivel) return this.hide(key);

    const heightUnits = Number.isFinite(flags.height) ? flags.height : cfg.height;
    if (!(heightUnits > 0)) return this.hide(key);

    const H = heightUnits * canvas.dimensions.distancePixels;
    const maxLen = H * cfg.lengthFactor;
    const maxShadows = Number.isInteger(flags.maxShadows) && flags.maxShadows >= 0 ? flags.maxShadows : cfg.maxShadows;
    if (!(maxShadows > 0)) return this.hide(key);

    const base = (w + h) / 2;
    const darkness = darknessNoPonto(c.x, c.y);
    const candidates = [];

    // --- Luz natural (sol/lua) ---
    const sf = sceneFlags(canvas.scene);
    if (sf.naturalLight) {
      const strength = clamp(sf.sunIntensity ?? 1, 0, 1) * (1 - darkness) * fatorLuzNatural(c.x, c.y);
      if (strength > MIN_STRENGTH) {
        const az = Math.toRadians(sf.sunAngle ?? 315);
        const elev = clamp(sf.sunElevation ?? 45, 5, 90);
        candidates.push({
          strength,
          phi: Math.atan2(Math.cos(az), -Math.sin(az)), // oposto ao sol
          length: Math.min(H / Math.tan(Math.toRadians(elev)), maxLen)
        });
      }
    }

    // --- Luzes da cena e de tokens ---
    const lightFactor = 0.5 + 0.5 * darkness; // luz artificial projeta sombra mais fraca em pleno dia
    for (const l of this.lights) {
      if (l.negative) continue;
      if (!ehTile && l.tokenId === doc.id) {
        const propria = sombraDaLuzPropria(obj, l, maxLen, lightFactor, cfg.ownDist);
        if (propria) candidates.push(propria);
        continue;
      }
      const vx = c.x - l.x, vy = c.y - l.y;
      const d = Math.hypot(vx, vy);
      if (d > l.radius || d < base * 0.4) continue;
      if (l.source?.shape?.contains && !l.source.shape.contains(c.x, c.y)) continue; // parede bloqueia
      // proximidade: 1 colado na luz, 0 na borda do alcance
      const near = 1 - d / l.radius;
      const strength = Math.pow(near, 0.6) * Math.min(1, 0.6 + l.lum) * lightFactor;
      if (strength < MIN_STRENGTH) continue;
      // quanto mais perto da luz, maior a sombra; some onde a luz acaba
      const length = maxLen * Math.pow(near, 1.2);
      candidates.push({ strength, phi: Math.atan2(vy, vx), length, anim: l.animation });
    }

    candidates.sort((a, b) => b.strength - a.strength);
    const chosen = candidates.slice(0, maxShadows);
    if (!chosen.length) return this.hide(key);

    // Cada sombra é UMA malha deformada com a textura do objeto: a metade que
    // fica do lado da luz permanece sob o corpo e a metade oposta é esticada
    // de forma contínua, afinando na ponta. Sem cópias repetidas.
    const container = ehTile ? this.tileContainer : this.container;
    const opacity = cfg.opacity * alpha;
    const g0 = { c: { x: c.x, y: c.y }, w, h, rot, mx, my };
    chosen.forEach((s, i) => {
      // Paredes (que bloqueiam luz) cortam a sombra: ela para na parede, sem vazar para o outro lado.
      const g = { ...g0, ...this.#limitesParede(g0, s.phi, s.length) };
      let sm = entry.meshes[i];
      if (!sm) sm = entry.meshes[i] = this.#makeMesh(container);
      sm.visible = true;
      sm.texture = tex;
      sm.alpha = clamp(s.strength * opacity, 0, 1);
      this.#deform(sm, g, s.phi, s.length);
      // Só luzes com animação tremem; sem animação a sombra fica parada.
      if (s.anim?.type && cfg.tremor) {
        let fase = 0;
        for (const ch of `${doc.id}${i}`) fase = (fase * 31 + ch.charCodeAt(0)) % 1000;
        sm._base = { ...g, phi: s.phi, length: s.length, alpha: sm.alpha, anim: s.anim, fase: (fase / 1000) * 2 * Math.PI };
        this.animados.add(sm);
      } else {
        sm._base = null;
        this.animados.delete(sm);
      }
    });
    for (let i = chosen.length; i < entry.meshes.length; i++) this.#esconder(entry.meshes[i]);
    if (ehTile) { this.tilesComSombra.add(key); this.#filtroTiles(); }
  }

  /**
   * Paredes que podem cortar esta sombra (calculado uma vez por posição/alcance e guardado).
   * O corte em si é feito vértice a vértice no #deform: cada ponto da sombra para na primeira parede
   * do seu caminho, então a sombra passa por vãos de portas abertas e termina rente à parede.
   */
  #limitesParede({ c, w, h }, phi, L) {
    if (!canvas.walls?.placeables?.length) return null;
    const raio = Math.hypot(w, h) / 2 + L * 1.1 + 4; // folga para o tremor
    const key = `${c.x | 0},${c.y | 0},${raio | 0}`;
    let segs = this.cacheParedes.get(key);
    if (segs === undefined) {
      segs = segmentosParede(c.x, c.y, raio);
      if (!segs.length) segs = null;
      if (this.cacheParedes.size > 3000) this.cacheParedes.clear();
      this.cacheParedes.set(key, segs);
    }
    return segs ? { segs } : null;
  }

  /** Recalcula os vértices da malha para projetar a silhueta na direção phi. */
  #deform(sm, g, phi, L) {
    const { c, w, h, rot, mx, my, segs } = g;
    const v = sm.vertices;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    const dx = Math.cos(phi), dy = Math.sin(phi);
    const px = -dy, py = dx;
    // meia extensão da imagem na direção da sombra
    const ext = Math.max(1, (Math.abs(dx * cosR + dy * sinR) * w + Math.abs(-dx * sinR + dy * cosR) * h) / 2);
    let k = 0;
    for (let j = 0; j <= GRID; j++) {
      for (let i = 0; i <= GRID; i++) {
        const lx = (i / GRID - 0.5) * w * mx;
        const ly = (j / GRID - 0.5) * h * my;
        const rx = lx * cosR - ly * sinR;
        const ry = lx * sinR + ly * cosR;
        const along = rx * dx + ry * dy;
        const across = rx * px + ry * py;
        const x = along > 0 ? Math.min(1, along / ext) : 0;
        let alongNew = along + L * Math.pow(x, 1.25);
        const taper = clamp(alongNew / (ext + L), 0, 1);
        const acrossNew = across * (1 - 0.45 * taper);
        let vx = c.x + alongNew * dx + acrossNew * px;
        let vy = c.y + alongNew * dy + acrossNew * py;
        if (segs && alongNew > 0) {
          // Corte por parede: raio da silhueta (sobre o corpo, na mesma linha lateral) até o vértice.
          // O vértice para na primeira parede do caminho; vãos de portas abertas deixam passar.
          const ox = c.x + across * px, oy = c.y + across * py;
          const rx2 = vx - ox, ry2 = vy - oy;
          let tmin = 1;
          for (let q = 0; q < segs.length; q++) {
            const sg = segs[q];
            const sx = sg[2] - sg[0], sy = sg[3] - sg[1];
            const den = rx2 * sy - ry2 * sx;
            if (den > -1e-9 && den < 1e-9) continue; // paralela
            const ax = sg[0] - ox, ay = sg[1] - oy;
            const t = (ax * sy - ay * sx) / den;     // posição ao longo do raio
            const u = (ax * ry2 - ay * rx2) / den;   // posição ao longo da parede
            if (u >= 0 && u <= 1 && t > 1e-4 && t < tmin) tmin = t;
          }
          if (tmin < 1) { vx = ox + rx2 * tmin; vy = oy + ry2 * tmin; }
        }
        v[k++] = vx;
        v[k++] = vy;
      }
    }
    // autoUpdate está desligado: envia os vértices à GPU só quando a sombra realmente mudou
    sm.geometry.getBuffer("aVertexPosition").update();
  }

  #entry(key) {
    let e = this.entries.get(key);
    if (!e) this.entries.set(key, (e = { meshes: [], sig: null }));
    return e;
  }

  #makeMesh(container) {
    const n = (GRID + 1) * (GRID + 1);
    const verts = new Float32Array(n * 2);
    const uvs = new Float32Array(n * 2);
    const idx = new Uint16Array(GRID * GRID * 6);
    let k = 0;
    for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) { uvs[k++] = i / GRID; uvs[k++] = j / GRID; }
    k = 0;
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const a = j * (GRID + 1) + i, b = a + 1, c = a + GRID + 1, d = c + 1;
        idx.set([a, b, c, b, d, c], k);
        k += 6;
      }
    }
    const sm = new PIXI.SimpleMesh(PIXI.Texture.EMPTY, verts, uvs, idx);
    sm.autoUpdate = false; // sem reenvio de vértices a cada quadro (ver #deform)
    sm.tint = 0x000000;
    container.addChild(sm);
    return sm;
  }

  #esconder(sm) {
    sm.visible = false;
    sm._base = null;
    this.animados.delete(sm);
  }

  hide(key) {
    const e = this.entries.get(key);
    if (e) for (const m of e.meshes) this.#esconder(m);
    if (this.tilesComSombra.delete(key)) this.#filtroTiles();
  }

  remove(key) {
    const e = this.entries.get(key);
    if (!e) return;
    for (const m of e.meshes) { this.animados.delete(m); m.destroy(); }
    this.entries.delete(key);
    if (this.tilesComSombra.delete(key)) this.#filtroTiles();
  }

  destroy() {
    canvas.app?.ticker?.remove(this._tick);
    this.container?.destroy({ children: true });
    this.tileContainer?.destroy({ children: true });
    this.entries.clear();
    this.animados.clear();
    this.tilesComSombra.clear();
  }
}
