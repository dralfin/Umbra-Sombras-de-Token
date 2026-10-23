// Sombras projetadas de tokens, luz natural e interiores.
import { MOD } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { ShadowManager } from "./shadows.mjs";
import { onRenderTokenConfig, onRenderTileConfig, onRenderSceneConfig } from "./config-ui.mjs";
import { abrirMenuSol } from "./menu-sol.mjs";
export { abrirMenuSol };

let manager = null;

// Duas portas para atualizar as sombras (as duas passam pelo mesmo debounce):
//  - softRefresh: eventos de luz/visão, muito frequentes; só recalcula se as luzes realmente mudaram;
//  - fullRefresh: algo que as luzes não mostram (flags, efeitos, regiões, cena); recalcula tudo.
let sujo = false;
const rodar = foundry.utils.debounce(() => {
  if (!manager) return;
  manager.collect(sujo);
  sujo = false;
  manager.refreshAll();
}, 60);
const fullRefresh = () => { sujo = true; rodar(); };
const softRefresh = () => rodar();

Hooks.once("init", () => {
  registerSettings(() => fullRefresh());
});

Hooks.on("canvasReady", () => {
  manager?.destroy();
  manager = new ShadowManager();
  fullRefresh();
});

Hooks.on("canvasTearDown", () => {
  manager?.destroy();
  manager = null;
});

Hooks.on("lightingRefresh", softRefresh);
Hooks.on("sightRefresh", softRefresh);
Hooks.on("refreshToken", (token) => manager?.refreshToken(token));
Hooks.on("refreshTile", (tile) => manager?.refreshTile(tile));
Hooks.on("deleteToken", (doc) => manager?.remove(`token:${doc.id}`));
Hooks.on("deleteTile", (doc) => manager?.remove(`tile:${doc.id}`));

Hooks.on("updateScene", (scene) => {
  if (scene.id !== canvas.scene?.id) return;
  fullRefresh();
});

Hooks.on("updateToken", (doc, change) => {
  if (change.flags?.[MOD] || "hidden" in change) fullRefresh();
});
Hooks.on("updateTile", (doc, change) => {
  if (change.flags?.[MOD] || "hidden" in change) fullRefresh();
});

// Efeitos como Caído e Invisível removem a sombra: atualiza ao criar/alterar/remover efeitos.
const efeitoMudou = (efeito) => { if (efeito.parent?.documentName === "Actor") fullRefresh(); };
Hooks.on("createActiveEffect", efeitoMudou);
Hooks.on("updateActiveEffect", efeitoMudou);
Hooks.on("deleteActiveEffect", efeitoMudou);

/** Diagnóstico: por que um token tem ou não sombra (sussurra o resultado). */
export async function diagnosticarSombra(token = canvas.tokens.controlled[0]) {
  if (!token) return ui.notifications.warn("Selecione um token.");
  if (!manager) return ui.notifications.warn("As sombras ainda não foram iniciadas nesta cena.");
  manager.collect(true);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const itens = manager.diagnosticar(token).map((l) => `<li>${esc(l)}</li>`).join("");
  await ChatMessage.create({ content: `<h3>Diagnóstico de sombra — ${esc(token.name)}</h3><ul>${itens}</ul>`, whisper: [game.user.id] });
}

// Regiões de interior: atualiza as sombras quando regiões/comportamentos mudam.
for (const h of ["createRegion", "updateRegion", "deleteRegion", "createRegionBehavior", "updateRegionBehavior", "deleteRegionBehavior",
                 "createWall", "updateWall", "deleteWall"]) {
  Hooks.on(h, () => fullRefresh());
}

// Botão do editor do sol nos controles de iluminação (mestre).
Hooks.on("getSceneControlButtons", (controles) => {
  if (!game.user.isGM) return;
  const grupo = controles.lighting ?? (Array.isArray(controles) ? controles.find((c) => c.name === "lighting") : null);
  if (!grupo) return;
  const titulo = game.i18n.localize("UMBRA.Sol.Botao");
  if (Array.isArray(grupo.tools)) {
    grupo.tools.push({ name: "umbra-sol", title: titulo, icon: "fa-solid fa-sun", button: true, onClick: () => abrirMenuSol() });
  } else if (grupo.tools) {
    grupo.tools["umbra-sol"] = { name: "umbra-sol", title: titulo, icon: "fa-solid fa-sun", order: 99, button: true, onChange: () => abrirMenuSol() };
  }
});

// Prévia em tempo real do editor do sol (valores locais, ainda não gravados).
Hooks.on(`${MOD}.previewSol`, (cena) => { if (cena?.id === canvas.scene?.id) fullRefresh(); });

Hooks.on("renderTokenConfig", onRenderTokenConfig);
Hooks.on("renderSceneConfig", onRenderSceneConfig);
Hooks.on("renderTileConfig", onRenderTileConfig);
