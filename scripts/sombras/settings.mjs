import { MOD } from "./constants.mjs";

export function registerSettings(onChange) {
  const reg = (key, scope, type, def, extra = {}) =>
    game.settings.register(MOD, key, {
      name: `UMBRA.Settings.${key}.Name`,
      hint: `UMBRA.Settings.${key}.Hint`,
      scope, config: true, type, default: def, onChange, ...extra
    });

  reg("showShadows", "client", Boolean, true);
  reg("shadowOpacity", "world", Number, 0.85, { range: { min: 0.1, max: 1, step: 0.05 } });
  reg("shadowBlur", "world", Number, 2, { range: { min: 0, max: 10, step: 0.5 } });
  reg("defaultHeight", "world", Number, 1.5);
  reg("defaultMaxShadows", "world", Number, 2, { range: { min: 0, max: 4, step: 1 } });
  reg("maxLengthFactor", "world", Number, 3, { range: { min: 0.5, max: 6, step: 0.5 } });
  reg("efeitosSemSombra", "world", String, "Caído, Invisível");
  reg("tremorSombras", "world", Boolean, true);
  reg("luzPropriaDistancia", "world", Number, 0.6, { range: { min: 0, max: 2, step: 0.1 } });
}
