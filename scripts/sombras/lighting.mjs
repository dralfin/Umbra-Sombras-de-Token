import { MOD } from "./constants.mjs";

/** Coleta luzes de cena e de tokens em pixels. */
export function collectLights() {
  const dp = canvas.dimensions.distancePixels;
  const lights = [];

  for (const light of canvas.lighting.placeables) {
    const doc = light.document;
    const src = light.source;
    if (doc.hidden || src?.active === false || doc.flags?.[MOD]?.aberturaLuz) continue; // luzes simuladas das aberturas não contam
    const cfg = doc.config;
    const dim = Math.abs(cfg.dim) * dp;
    const bright = Math.abs(cfg.bright) * dp;
    const radius = Math.max(dim, bright);
    if (!radius) continue;
    lights.push({
      x: doc.x, y: doc.y, radius, bright,
      lum: cfg.luminosity ?? 0.5,
      negative: !!cfg.negative || !!light.isDarkness,
      animation: cfg.animation?.type ? cfg.animation : null,
      source: src, tokenId: null
    });
  }

  for (const token of canvas.tokens.placeables) {
    const doc = token.document;
    const l = doc.light;
    const src = token.light;
    if (doc.hidden || src?.active === false) continue;
    const dim = Math.abs(l.dim) * dp;
    const bright = Math.abs(l.bright) * dp;
    if (!dim && !bright) continue;
    const ext = token.externalRadius ?? 0;
    lights.push({
      x: token.center.x, y: token.center.y,
      radius: Math.max(dim, bright) + ext, bright: bright + ext,
      lum: l.luminosity ?? 0.5,
      negative: !!l.negative,
      animation: l.animation?.type ? l.animation : null,
      source: src, tokenId: doc.id
    });
  }
  return lights;
}
