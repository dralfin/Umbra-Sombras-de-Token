export const MOD = "umbra-sombras";
export const setting = (key) => game.settings.get(MOD, key);
export const tokenFlags = (doc) => doc?.flags?.[MOD] ?? {};
export const sceneFlags = (scene) => scene?.flags?.[MOD] ?? {};
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
