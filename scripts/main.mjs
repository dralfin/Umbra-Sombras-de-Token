/**
 * Umbra - Sombras de Token (qualquer sistema)
 *
 * Altura do token, sombras projetadas a partir da imagem do token, luz natural (sol/lua)
 * com editor do sol e interiores (regiões). Veja scripts/sombras/.
 */

import { abrirMenuSol, diagnosticarSombra } from "./sombras/index.mjs";
import "./migracao-sombras.mjs"; // migra dados dos antigos módulos t20-sombras / t20-visao

const MOD = "umbra-sombras";

Hooks.once("ready", () => {
  game.modules.get(MOD).api = { diagnosticarSombra, abrirMenuLuzNatural: abrirMenuSol };
});
