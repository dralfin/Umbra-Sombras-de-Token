/**
 * Migração dos dados dos antigos módulos "t20-sombras" e "t20-visao" para este módulo:
 *  - configurações do mundo (opacidade, desfoque, altura padrão, limites etc.);
 *  - flags de cenas (luz natural), tokens das cenas e tokens protótipo dos atores
 *    (altura, projetar sombra, máximo de sombras);
 *  - comportamentos de região "Interior" (recriados com o novo tipo; os comportamentos
 *    nativos gerenciados pelo módulo antigo são removidos e o novo recria os seus).
 * Roda uma vez, pelo mestre ativo. Os demais dados antigos não são apagados.
 */

import { MOD } from "./sombras/constants.mjs";

const ANTIGOS = ["t20-sombras", "t20-visao"]; // o último tem prioridade
const CHAVES = ["shadowOpacity", "shadowBlur", "defaultHeight", "defaultMaxShadows", "maxLengthFactor",
  "efeitosSemSombra", "tremorSombras", "luzPropriaDistancia"];
const IGNORAR = ["noLightEffects"]; // flag de recurso que não existe mais

const dadosAntigos = (flags) => {
  const saida = {};
  for (const id of ANTIGOS) {
    const f = flags?.[id];
    if (f) for (const [k, v] of Object.entries(f)) if (!IGNORAR.includes(k)) saida[k] = foundry.utils.deepClone(v);
  }
  return saida;
};
const temDados = (flags) => Object.keys(dadosAntigos(flags)).length > 0;

async function migrarInteriores(cena) {
  let n = 0;
  for (const regiao of cena.regions) {
    const antigos = regiao.behaviors.contents.filter((b) => ANTIGOS.some((id) => b.type === `${id}.interior`));
    const gerenciados = regiao.behaviors.contents.filter((b) => ANTIGOS.some((id) => b.getFlag(id, "gerenciado")));
    for (const b of antigos) {
      const escuridao = Number(b._source?.system?.escuridao ?? 0.8);
      await regiao.createEmbeddedDocuments("RegionBehavior", [{
        type: `${MOD}.interior`, name: b.name, disabled: b.disabled, system: { escuridao }
      }]);
      n++;
    }
    const remover = [...new Set([...antigos, ...gerenciados].map((b) => b.id))];
    if (remover.length) await regiao.deleteEmbeddedDocuments("RegionBehavior", remover);
  }
  return n;
}

export async function migrarSombras() {
  if (!game.user.isGM) return 0;
  let n = 0;

  const armazem = game.settings.storage.get("world");
  for (const antigo of ANTIGOS) {
    for (const chave of CHAVES) {
      const s = armazem?.find?.((x) => x.key === `${antigo}.${chave}`);
      if (!s) continue;
      try {
        await game.settings.set(MOD, chave, JSON.parse(s.value));
        n++;
      } catch (err) {
        console.warn(`${MOD} | não foi possível migrar a configuração ${chave}`, err);
      }
    }
  }

  for (const cena of game.scenes) {
    if (temDados(cena.flags)) {
      await cena.update({ flags: { [MOD]: dadosAntigos(cena.flags) } });
      n++;
    }
    const tokens = cena.tokens.filter((tk) => temDados(tk.flags))
      .map((tk) => ({ _id: tk.id, flags: { [MOD]: dadosAntigos(tk.flags) } }));
    if (tokens.length) {
      await cena.updateEmbeddedDocuments("Token", tokens);
      n += tokens.length;
    }
    n += await migrarInteriores(cena);
  }

  for (const ator of game.actors) {
    const flags = ator.prototypeToken?.flags;
    if (temDados(flags)) {
      await ator.update({ prototypeToken: { flags: { [MOD]: dadosAntigos(flags) } } });
      n++;
    }
  }
  return n;
}

Hooks.once("init", () => {
  game.settings.register(MOD, "sombrasMigradas", { scope: "world", config: false, type: Boolean, default: false });
});

Hooks.once("ready", async () => {
  if (!game.user.isGM || game.users.activeGM !== game.user || game.settings.get(MOD, "sombrasMigradas")) return;
  const n = await migrarSombras();
  await game.settings.set(MOD, "sombrasMigradas", true);
  if (n) ui.notifications.info(`Umbra: ${n} item(ns) migrado(s) dos módulos antigos.`);
});
