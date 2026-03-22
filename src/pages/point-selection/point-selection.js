import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";
import { setupCarsScatter } from "../_shared/carsScatter";

async function main() {
  const { mainLayer } = await setupCarsScatter();
  await mountInteraction(mainLayer);
}
  
async function mountInteraction(layer) {
  // Attach HoverInstrument to the main layer
  const interactions = [
    {
      Instrument: "point selection",
      Trigger: "click",
      targetLayer: "mainLayer",
      feedbackOptions: {
        Highlight: "#ff0000",
        Dim: { opacity: 0.1, selector: ".mark" },
      },
      priority: 1,
      stopPropagation: true,
    },
  ];
  await compileInteractionsDSL(interactions);
  if (Libra.createHistoryTrack) {
    await Libra.createHistoryTrack();
  }
}

main();
