# Huerta con arte de Cozy Farm Lite y polillas en los faroles

## Cozy Farm Lite (Bramble & Byte)
Pack con licencia de uso comercial y modificación; no se puede revender ni redistribuir como assets (`src/assets/farm/Cozy-Farm-Lite-LICENSE.txt`). El crédito aparece en la pantalla de inicio.

- `scripts/build-farm-assets.py` toma del pack (en `ASSETS DESCARGADOS/ORGANIZADO/biblioteca/03_mundo_y_huerta/07/cozy-farm-lite`) las etapas de **zanahoria, tomate y trigo** (cuatro dibujos cada una) y siete objetos (fardo, cajón, barril, arbusto, flores, roca, roble), y arma un solo atlas: `src/assets/farm/farm.png` + `farm.json` (`provenance.json` guarda de dónde sale cada archivo).
- `src/art/farm.ts` los entrega al juego. Los cultivos crecen por cuatro dibujos (semillas, brote, creciendo, listo); las demás plantas siguen con el dibujo propio.
- Nuevas semillas: **tomate** (2 días) y **trigo** (3 días), en el almacén de Taro. Sus frutos (Tomate, Trigo) todavía no se usan en recetas: se pueden vender o regalar.
- Objetos `farm_*` en `data/props.ts` (se dibujan con el atlas): colocados junto a la huerta (barril, cajón, fardo, flores, arbusto, roca).

## Qué quedó sin usar y por qué
Los demás packs (sushi, pesca, animales, gatos, etc.) no traen licencia de uso suficiente en sus archivos (ver `ASSETS DESCARGADOS/ORGANIZADO/INFORME.md`): no se integraron hasta verificarlos en la página de origen. Los packs "solo no comercial" tampoco.

## Polillas en los faroles (`src/scenes/lampMoths.ts`)
De la atardecida en adelante y sin lluvia, hasta 28 polillas dibujadas por código giran alrededor de los faroles y linternas de la calle (3 por farol como máximo, no todos tienen). Solo se mueven cerca de la cámara, no se crean con "ahorro de batería" ni con "reducir movimiento". Los assets descargados no traen insectos útiles: el Farming Pack tiene una luciérnaga y la carpeta de insectos vacía, ambas solo en la vista previa "premium".
