/**
 * Interiores: regiões (Regions) com o comportamento "Interior".
 *
 * Dentro de um interior:
 *  - o clima é suprimido (o módulo mantém um comportamento nativo "Suprimir Clima");
 *  - o sol/lua não projeta sombra nos tokens;
 *  - o interior fica mais escuro: a escuridão do interior vale na região inteira, na tela (o módulo
 *    mantém um comportamento nativo "Ajustar nível de escuridão") e na força das sombras.
 *    O interior nunca fica mais claro que a cena.
 * Se a região tiver também um "Ajustar nível de escuridão" seu, ele é aplicado por cima.
 */

import { MOD } from "./constants.mjs";

export const TIPO_INTERIOR = `${MOD}.interior`;

Hooks.once("init", () => {
  try {
    const f = foundry.data.fields;
    class ComportamentoInterior extends foundry.data.regionBehaviors.RegionBehaviorType {
      static LOCALIZATION_PREFIXES = ["UMBRA.Interior"];
      static defineSchema() {
        return {
          escuridao: new f.NumberField({ required: true, nullable: false, min: 0, max: 1, step: 0.05, initial: 0.8 })
        };
      }
    }
    CONFIG.RegionBehavior.dataModels[TIPO_INTERIOR] = ComportamentoInterior;
    (CONFIG.RegionBehavior.typeLabels ??= {})[TIPO_INTERIOR] = "UMBRA.Interior.Tipo";
    (CONFIG.RegionBehavior.typeIcons ??= {})[TIPO_INTERIOR] = "fa-solid fa-house";
  } catch (err) {
    console.warn(`${MOD} | não foi possível registrar o comportamento de região Interior`, err);
  }
});

function pontoNaRegiao(regiao, x, y) {
  const ponto = { x, y };
  try {
    const arvore = regiao.document?.polygonTree;
    if (arvore?.testPoint) return !!arvore.testPoint(ponto);
    return !!(regiao.testPoint?.(ponto, 0) ?? regiao.document?.testPoint?.(ponto, 0));
  } catch {
    return false;
  }
}

/** Aplica o comportamento nativo "Ajustar nível de escuridão" (substituir / clarear / escurecer). */
function aplicarAjuste(base, sistema) {
  const modo = Number(sistema?.mode ?? 0);
  const m = Number(sistema?.modifier ?? 0);
  if (modo === 1) return base * (1 - m);          // clarear
  if (modo === 2) return base + (1 - base) * m;   // escurecer
  return m;                                       // substituir
}

/* ------------------------------------------------------------------ */
/*  Análise de um ponto                                                */
/* ------------------------------------------------------------------ */

/**
 * { dentro, escuridao (a do interior, ou null), ajustes: comportamentos
 *   "Ajustar nível de escuridão" do próprio usuário nas regiões que contêm o ponto }
 */
function analisar(x, y) {
  const resultado = { dentro: false, escuridao: null, ajustes: [] };
  for (const regiao of canvas.regions?.placeables ?? []) {
    const comportamentos = regiao.document.behaviors?.contents ?? [];
    const interior = comportamentos.find((b) => b.type === TIPO_INTERIOR && !b.disabled);
    const ajuste = comportamentos.find((b) => b.type === "adjustDarknessLevel" && !b.disabled && !b.getFlag(MOD, "gerenciado"));
    if (!interior && !ajuste) continue;
    if (!pontoNaRegiao(regiao, x, y)) continue;
    if (interior) {
      resultado.dentro = true;
      const e = Number(interior.system?.escuridao ?? 0.8);
      resultado.escuridao = Math.max(resultado.escuridao ?? 0, e);
    }
    if (ajuste) resultado.ajustes.push(ajuste);
  }
  return resultado;
}

export const analisarPonto = (x, y) => analisar(x, y);

/** Escuridão no ponto: a da cena; em interiores, a do interior (nunca menor que a da cena); depois os ajustes nativos. */
export function darknessNoPonto(x, y) {
  const cena = canvas.environment?.darknessLevel ?? canvas.scene?.environment?.darknessLevel ?? 0;
  const a = analisar(x, y);
  let d = a.escuridao === null ? cena : Math.max(cena, a.escuridao);
  for (const ajuste of a.ajustes) d = aplicarAjuste(d, ajuste.system);
  return Math.min(1, Math.max(0, d));
}

/** Multiplicador da luz natural (sombras do sol): 0 dentro de um interior, 1 ao ar livre. */
export const fatorLuzNatural = (x, y) => (analisar(x, y).dentro ? 0 : 1);

/* ------------------------------------------------------------------ */
/*  Sincronização: clima e escuridão na tela                           */
/* ------------------------------------------------------------------ */

async function garantir(regiao, tipo, querer, sistema, nomeChave) {
  const lista = (regiao.behaviors?.contents ?? []).filter((b) => b.type === tipo && b.getFlag(MOD, "gerenciado"));
  if (querer && !lista.length) {
    await regiao.createEmbeddedDocuments("RegionBehavior", [{
      type: tipo, name: game.i18n.localize(`UMBRA.Interior.${nomeChave}`),
      system: sistema, flags: { [MOD]: { gerenciado: true } }
    }]);
  } else if (querer) {
    const b = lista[0];
    const mudou = Object.entries(sistema).some(([k, v]) => Math.abs(Number(b.system?.[k]) - Number(v)) > 0.001);
    if (mudou) await b.update({ system: sistema });
  } else if (lista.length) {
    await regiao.deleteEmbeddedDocuments("RegionBehavior", lista.map((b) => b.id));
  }
}

async function sincronizar(regiao) {
  if (!regiao || !game.user.isGM || game.users.activeGM !== game.user) return;
  const interior = (regiao.behaviors?.contents ?? []).find((b) => b.type === TIPO_INTERIOR && !b.disabled);
  const cena = regiao.parent?.environment?.darknessLevel ?? 0;
  const escuridao = Number(interior?.system?.escuridao ?? 0);
  try {
    await garantir(regiao, "suppressWeather", !!interior, {}, "ClimaNome");
    // Só escurece se o interior for mais escuro que a cena.
    await garantir(regiao, "adjustDarknessLevel", !!interior && escuridao > cena, { mode: 0, modifier: escuridao }, "EscurecerNome");

    // Limpeza de itens de versões anteriores (regiões auxiliares e luzes simuladas).
    const cenaDoc = regiao.parent;
    const auxiliares = cenaDoc?.regions?.contents.filter((r) => r.getFlag(MOD, "gerenciada") === regiao.id) ?? [];
    if (auxiliares.length) await cenaDoc.deleteEmbeddedDocuments("Region", auxiliares.map((r) => r.id));
    const luzes = cenaDoc?.lights?.contents.filter((l) => l.getFlag(MOD, "aberturaLuz") === regiao.id) ?? [];
    if (luzes.length) await cenaDoc.deleteEmbeddedDocuments("AmbientLight", luzes.map((l) => l.id));
  } catch (err) {
    console.warn(`${MOD} | não foi possível sincronizar o Interior`, err);
  }
}

const sincronizarCena = foundry.utils.debounce(async () => {
  if (!game.user.isGM || game.users.activeGM !== game.user || !canvas.scene) return;
  for (const regiao of canvas.scene.regions) {
    if (!regiao.getFlag(MOD, "gerenciada")) await sincronizar(regiao);
  }
}, 700);

for (const h of ["createRegionBehavior", "updateRegionBehavior", "deleteRegionBehavior"]) {
  Hooks.on(h, (comportamento) => { if (comportamento.type === TIPO_INTERIOR) sincronizar(comportamento.parent); });
}
Hooks.on("canvasReady", sincronizarCena);
Hooks.on("updateScene", (cena, mudancas) => { if (cena.id === canvas.scene?.id && mudancas.environment) sincronizarCena(); });
