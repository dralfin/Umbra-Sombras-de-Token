/**
 * Editor da luz natural, em três controles:
 *  - Altura do sol (barra vertical): arraste o sol para cima (sol alto, sombra curta) ou para baixo (sol baixo, sombra longa);
 *  - Posição do sol (círculo): arraste o sol ao longo do círculo para escolher a direção (N no topo do mapa);
 *  - Força do sol (barra vertical): arraste para cima (mais forte) ou para baixo (mais fraco).
 * Um token de exemplo no centro do círculo mostra a sombra resultante, que cai do lado oposto ao sol.
 * Janela própria (ApplicationV2): o DialogV2 limpa o HTML (remove SVG e estilos) e não serve aqui.
 */

import { MOD, sceneFlags } from "./constants.mjs";

// Geometria do SVG (viewBox 700 x 380)
const VB_W = 700, VB_H = 380;
const X_ALTURA = 95, X_FORCA = 605;
const Y0 = 80, Y1 = 330;                 // topo e base das barras
const CX = 350, CY = 205, CR = 120;      // círculo da posição

// Tamanhos de fonte (unidades do SVG: a janela tem ~720 px, então 1 unidade ≈ 1 px). Ajuste aqui.
const FONTE_TITULO = 24;  // "Altura do sol", "Posição do sol", "Força do sol"
const FONTE_VALOR = 22;   // valor atual embaixo de cada controle
const FONTE_ESCALA = 18;  // N/S/L/O e marcas 90°, 5°, 100%, 0%

const RUMOS = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
const rumo = (az) => RUMOS[Math.round((((az % 360) + 360) % 360) / 45) % 8];
const rad = (g) => (g * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const L = (k) => game.i18n.localize(`UMBRA.Sol.${k}`);

/** Estrela do sol (12 raios) com o miolo branco, como no esboço. */
function glifo(classe) {
  const pontos = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 === 0 ? 28 : 12;
    const a = (Math.PI * 2 * i) / 24 - Math.PI / 2;
    pontos.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
  }
  return `<g class="${classe}" style="pointer-events:none">
    <polygon points="${pontos.join(" ")}" fill="#ffd54a" stroke="#7a5c00" stroke-width="1.5" stroke-linejoin="round"/>
    <circle r="9" fill="#fff" stroke="#7a5c00" stroke-width="3"/>
  </g>`;
}

function conteudo(est) {
  return `
  <label style="display:flex;gap:8px;align-items:center;font-size:1.2em">
    ${L("Habilitar")} <input type="checkbox" data-campo="ativa" ${est.ativa ? "checked" : ""}>
  </label>
  <svg viewBox="0 0 ${VB_W} ${VB_H}" style="width:100%;touch-action:none;display:block;margin-top:6px">
    <g fill="#e8eaed" text-anchor="middle">
      <text x="${X_ALTURA}" y="38" font-size="${FONTE_TITULO}">${L("Altura")}</text>
      <text x="${CX}" y="38" font-size="${FONTE_TITULO}">${L("Posicao")}</text>
      <text x="${X_FORCA}" y="38" font-size="${FONTE_TITULO}">${L("Forca")}</text>
    </g>

    <g stroke="#cfd8dc" stroke-width="4" stroke-linecap="round" fill="none">
      <line x1="${X_ALTURA}" y1="${Y0}" x2="${X_ALTURA}" y2="${Y1}"/>
      <line x1="${X_FORCA}" y1="${Y0}" x2="${X_FORCA}" y2="${Y1}"/>
      <circle cx="${CX}" cy="${CY}" r="${CR}"/>
    </g>

    <g fill="#9aa5ab" font-size="${FONTE_ESCALA}" text-anchor="middle">
      <text x="${CX}" y="${CY - CR - 10}">N</text><text x="${CX}" y="${CY + CR + 24}">S</text>
      <text x="${CX + CR + 18}" y="${CY + 6}">L</text><text x="${CX - CR - 18}" y="${CY + 6}">O</text>
      <text x="${X_ALTURA + 20}" y="${Y0 + 6}" text-anchor="start">90°</text>
      <text x="${X_ALTURA + 20}" y="${Y1 + 6}" text-anchor="start">5°</text>
      <text x="${X_FORCA - 20}" y="${Y0 + 6}" text-anchor="end">100%</text>
      <text x="${X_FORCA - 20}" y="${Y1 + 6}" text-anchor="end">0%</text>
    </g>

    <polygon class="sombra" fill="#000"/>
    <circle cx="${CX}" cy="${CY}" r="11" fill="#cfd8dc" stroke="#546e7a" stroke-width="3"/>

    <rect class="area-altura" x="${X_ALTURA - 45}" y="${Y0 - 25}" width="90" height="${Y1 - Y0 + 50}" fill="transparent" style="cursor:ns-resize"/>
    <rect class="area-forca" x="${X_FORCA - 45}" y="${Y0 - 25}" width="90" height="${Y1 - Y0 + 50}" fill="transparent" style="cursor:ns-resize"/>
    <circle class="area-pos" cx="${CX}" cy="${CY}" r="${CR + 40}" fill="transparent" style="cursor:grab"/>

    ${glifo("sol-altura")}${glifo("sol-pos")}${glifo("sol-forca")}

    <g fill="#e8eaed" font-size="${FONTE_VALOR}" text-anchor="middle">
      <text class="v-altura" x="${X_ALTURA}" y="368"></text>
      <text class="v-pos" x="${CX}" y="368"></text>
      <text class="v-forca" x="${X_FORCA}" y="368"></text>
    </g>
  </svg>
  <p style="font-size:0.95em;opacity:.85;margin:8px 0 0;line-height:1.35">${L("Ajuda")}</p>`;
}

function desenhar(raiz, est) {
  const colocar = (classe, x, y) => raiz.querySelector(`.${classe}`).setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);

  colocar("sol-altura", X_ALTURA, Y0 + ((90 - est.elev) / 85) * (Y1 - Y0));
  colocar("sol-forca", X_FORCA, Y0 + (1 - est.forca) * (Y1 - Y0));
  colocar("sol-pos", CX + CR * Math.sin(rad(est.az)), CY - CR * Math.cos(rad(est.az)));

  // Sombra do token de exemplo: oposta ao sol; mais longa quanto mais baixo o sol.
  const dx = -Math.sin(rad(est.az)), dy = Math.cos(rad(est.az));
  const comp = Math.min(CR - 14, 40 / Math.tan(rad(Math.max(est.elev, 5))));
  const px = -dy, py = dx;
  const pts = [[CX + px * 9, CY + py * 9], [CX - px * 9, CY - py * 9], [CX + dx * comp, CY + dy * comp]];
  const sombra = raiz.querySelector(".sombra");
  sombra.setAttribute("points", pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" "));
  sombra.setAttribute("opacity", est.ativa ? 0.15 + 0.6 * est.forca : 0.06);

  raiz.querySelector(".v-altura").textContent = `${est.elev}°`;
  raiz.querySelector(".v-pos").textContent = `${est.az}° (${rumo(est.az)})`;
  raiz.querySelector(".v-forca").textContent = `${Math.round(est.forca * 100)}%`;
  raiz.querySelector("svg").style.opacity = est.ativa ? 1 : 0.5;
}

class EditorDoSol extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "umbra-editor-sol",
    classes: ["umbra-sol"],
    window: { title: "UMBRA.Sol.Titulo", icon: "fa-solid fa-sun", resizable: false },
    position: { width: 720, height: "auto" }
  };

  constructor(cena, resolver) {
    super();
    this.cena = cena;
    this.resolver = resolver;
    this.resultado = undefined;
    const f = sceneFlags(cena);
    this.est = {
      ativa: !!f.naturalLight,
      az: clamp(Math.round(Number(f.sunAngle ?? 315)), 0, 360),
      elev: clamp(Math.round(Number(f.sunElevation ?? 45)), 5, 90),
      forca: clamp(Number(f.sunIntensity ?? 1), 0, 1)
    };
    // Valores gravados na cena: a prévia só muda a cópia local; Cancelar volta a eles.
    this.original = { naturalLight: this.est.ativa, sunAngle: this.est.az, sunElevation: this.est.elev, sunIntensity: this.est.forca };
  }

  /** Prévia em tempo real: aplica os valores só no cliente (sem gravar) e atualiza as sombras. */
  #previa() {
    const e = this.est;
    this.cena.updateSource({ flags: { [MOD]: { naturalLight: e.ativa, sunAngle: e.az, sunElevation: e.elev, sunIntensity: e.forca } } });
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = null;
      Hooks.callAll(`${MOD}.previewSol`, this.cena);
    });
  }

  #reverter() {
    this.cena.updateSource({ flags: { [MOD]: this.original } });
    Hooks.callAll(`${MOD}.previewSol`, this.cena);
  }

  async _renderHTML() {
    const corpo = document.createElement("div");
    corpo.style.padding = "8px";
    corpo.innerHTML = `${conteudo(this.est)}
      <div style="display:flex;gap:8px;margin-top:14px">
        <button type="button" data-acao="salvar" style="flex:1"><i class="fa-solid fa-floppy-disk"></i> ${L("Salvar")}</button>
        <button type="button" data-acao="cancelar" style="flex:1"><i class="fa-solid fa-xmark"></i> ${L("Cancelar")}</button>
      </div>`;
    return corpo;
  }

  _replaceHTML(corpo, conteudoJanela) {
    conteudoJanela.replaceChildren(corpo);
    this.#ligar(corpo);
  }

  #ligar(raiz) {
    const est = this.est;
    const atualizar = () => { desenhar(raiz, est); this.#previa(); };
    const svg = raiz.querySelector("svg");
    const ponto = (ev) => {
      const p = svg.createSVGPoint();
      p.x = ev.clientX; p.y = ev.clientY;
      return p.matrixTransform(svg.getScreenCTM().inverse());
    };
    const t = (y) => clamp((y - Y0) / (Y1 - Y0), 0, 1);

    // Cada controle arrasta o sol do seu jeito.
    const arrastavel = (classe, aplicar) => {
      const area = raiz.querySelector(`.${classe}`);
      let ativo = false;
      area.addEventListener("pointerdown", (ev) => { ativo = true; area.setPointerCapture(ev.pointerId); aplicar(ponto(ev)); atualizar(); });
      area.addEventListener("pointermove", (ev) => { if (ativo) { aplicar(ponto(ev)); atualizar(); } });
      area.addEventListener("pointerup", () => { ativo = false; });
    };
    arrastavel("area-altura", (p) => { est.elev = Math.round(90 - t(p.y) * 85); });
    arrastavel("area-forca", (p) => { est.forca = Math.round((1 - t(p.y)) * 20) / 20; });
    arrastavel("area-pos", (p) => {
      est.az = Math.round((((Math.atan2(p.x - CX, -(p.y - CY)) * 180) / Math.PI) + 360) % 360);
    });

    raiz.querySelector('[data-campo="ativa"]').addEventListener("change", (ev) => { est.ativa = ev.target.checked; atualizar(); });

    raiz.querySelector('[data-acao="salvar"]').addEventListener("click", async () => {
      // Volta a cópia local ao valor gravado para o update detectar a mudança e gravar de fato.
      this.cena.updateSource({ flags: { [MOD]: this.original } });
      await this.cena.update({
        flags: { [MOD]: { naturalLight: est.ativa, sunAngle: est.az, sunElevation: est.elev, sunIntensity: est.forca } }
      });
      this.resultado = { ...est };
      this.close();
    });
    raiz.querySelector('[data-acao="cancelar"]').addEventListener("click", () => this.close());
    desenhar(raiz, est);
  }

  async close(opcoes = {}) {
    if (!this.resultado) this.#reverter(); // fechou sem salvar: desfaz a prévia
    const r = await super.close(opcoes);
    this.resolver?.(this.resultado);
    this.resolver = null;
    return r;
  }
}

/** Abre o editor da luz natural. Retorna { ativa, az, elev, forca } se salvou; senão undefined. */
export function abrirMenuSol(cena = canvas.scene) {
  if (!cena) return Promise.resolve();
  if (!game.user.isGM) { ui.notifications.warn(L("SoMestre")); return Promise.resolve(); }
  return new Promise((resolver) => new EditorDoSol(cena, resolver).render({ force: true }));
}
