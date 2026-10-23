import { abrirMenuSol } from "./menu-sol.mjs";
import { MOD, setting } from "./constants.mjs";

const L = (k) => game.i18n.localize(`UMBRA.${k}`);

function inject(root, tab, markup, id) {
  if (root.querySelector(`#${id}`)) return;
  const target = root.querySelector(`.tab[data-tab="${tab}"]`);
  if (target) target.insertAdjacentHTML("beforeend", markup);
  else {
    const footer = root.querySelector("footer.form-footer, .form-footer");
    if (footer) footer.insertAdjacentHTML("beforebegin", markup);
    else root.querySelector("form")?.insertAdjacentHTML("beforeend", markup);
  }
}

const num = (name, value, extra = "") =>
  `<input type="number" step="any" name="flags.${MOD}.${name}" value="${value ?? ""}" data-dtype="Number" ${extra}>`;

/** Aba "Aparência" do token (e do token protótipo do ator). */
export function onRenderTokenConfig(app, html) {
  const root = html instanceof HTMLElement ? html : html[0];
  const f = (app.document ?? app.token)?.flags?.[MOD] ?? {};
  const markup = `
  <fieldset id="${MOD}-token">
    <legend>${L("Title")}</legend>
    <div class="form-group">
      <label>${L("Height")}</label>
      <div class="form-fields">${num("height", f.height, `min="0" placeholder="${setting("defaultHeight")}"`)}</div>
      <p class="hint">${L("HeightHint")}</p>
    </div>
    <div class="form-group">
      <label>${L("CastShadow")}</label>
      <div class="form-fields"><input type="checkbox" name="flags.${MOD}.castShadow" ${f.castShadow !== false ? "checked" : ""}></div>
    </div>
    <div class="form-group">
      <label>${L("MaxShadows")}</label>
      <div class="form-fields">${num("maxShadows", f.maxShadows, `min="0" max="8" step="1" placeholder="${setting("defaultMaxShadows")}"`)}</div>
      <p class="hint">${L("MaxShadowsHint")}</p>
    </div>
  </fieldset>`;
  inject(root, "appearance", markup, `${MOD}-token`);
}

/** Aba "Aparência" do tile: sombra é opcional (desligada por padrão). */
export function onRenderTileConfig(app, html) {
  const root = html instanceof HTMLElement ? html : html[0];
  const f = (app.document ?? app.tile)?.flags?.[MOD] ?? {};
  const markup = `
  <fieldset id="${MOD}-tile">
    <legend>${L("Title")}</legend>
    <div class="form-group">
      <label>${L("CastShadow")}</label>
      <div class="form-fields"><input type="checkbox" name="flags.${MOD}.castShadow" ${f.castShadow === true ? "checked" : ""}></div>
      <p class="hint">${L("TileCastShadowHint")}</p>
    </div>
    <div class="form-group">
      <label>${L("Height")}</label>
      <div class="form-fields">${num("height", f.height, `min="0" placeholder="${setting("defaultHeight")}"`)}</div>
      <p class="hint">${L("HeightHint")}</p>
    </div>
    <div class="form-group">
      <label>${L("MaxShadows")}</label>
      <div class="form-fields">${num("maxShadows", f.maxShadows, `min="0" max="8" step="1" placeholder="${setting("defaultMaxShadows")}"`)}</div>
      <p class="hint">${L("MaxShadowsHint")}</p>
    </div>
  </fieldset>`;
  inject(root, "appearance", markup, `${MOD}-tile`);
}

/** Aba "Iluminação" da cena. */
export function onRenderSceneConfig(app, html) {
  const root = html instanceof HTMLElement ? html : html[0];
  const f = app.document?.flags?.[MOD] ?? {};
  const markup = `
  <fieldset id="${MOD}-scene">
    <legend>${L("Scene.Title")}</legend>
    <p><button type="button" data-umbra-sol><i class="fas fa-sun"></i> ${L("Sol.Botao")}</button></p>
    <div class="form-group">
      <label>${L("NaturalLight")}</label>
      <div class="form-fields"><input type="checkbox" name="flags.${MOD}.naturalLight" ${f.naturalLight ? "checked" : ""}></div>
      <p class="hint">${L("NaturalLightHint")}</p>
    </div>
    <div class="form-group">
      <label>${L("SunAngle")}</label>
      <div class="form-fields">${num("sunAngle", f.sunAngle ?? 315, `min="0" max="360" step="1"`)}</div>
      <p class="hint">${L("SunAngleHint")}</p>
    </div>
    <div class="form-group">
      <label>${L("SunElevation")}</label>
      <div class="form-fields">${num("sunElevation", f.sunElevation ?? 45, `min="5" max="90" step="1"`)}</div>
      <p class="hint">${L("SunElevationHint")}</p>
    </div>
    <div class="form-group">
      <label>${L("SunIntensity")}</label>
      <div class="form-fields">${num("sunIntensity", f.sunIntensity ?? 1, `min="0" max="1" step="0.05"`)}</div>
    </div>
  </fieldset>`;
  inject(root, "lighting", markup, `${MOD}-scene`);

  // Editor do sol: ao salvar, reflete os valores nos campos desta janela (evita sobrescrever ao salvar a cena).
  root.querySelector("[data-umbra-sol]")?.addEventListener("click", async () => {
    const novo = await abrirMenuSol(app.document);
    if (!novo) return;
    const definir = (nome, v) => {
      const el = root.querySelector(`[name="flags.${MOD}.${nome}"]`);
      if (!el) return;
      if (el.type === "checkbox") el.checked = !!v; else el.value = v;
    };
    definir("naturalLight", novo.ativa); definir("sunAngle", novo.az);
    definir("sunElevation", novo.elev); definir("sunIntensity", novo.forca);
  });
}
