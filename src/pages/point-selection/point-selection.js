import Libra from "libra-vis";
import { compileDSL } from "../../scripts/dsl-compiler";
import { setupCarsScatter } from "../_shared/carsScatter";

async function main() {
  const { mainLayer } = await setupCarsScatter();
  await mountInteraction(mainLayer);
}

async function mountInteraction(layer) {
  const interactions = [
    {
      instrument: "pointSelection",
      trigger: {
        type: "click",
        priority: 1,
        stopPropagation: true,
      },
      target: { layer: "mainLayer" },
      feedback: {
        redrawFunc: {
          highlight: "#ff0000",
          dim: { opacity: 0.1, selector: ".mark" },
        },
      },
    },
  ];
  await compileDSL(interactions, { layersByName: { mainLayer: layer } }, { execute: true });
  if (Libra.createHistoryTrack) {
    await Libra.createHistoryTrack();
  }
}

main();
