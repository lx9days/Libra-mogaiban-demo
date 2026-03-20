import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";
import { setupIrisScatter } from "../_shared/irisScatter";

export default async function init() {
  const { layersByName } = await setupIrisScatter();

  const interactions = [
    {
      instrument: "GroupSelection",
      trigger: {
        type: "brush",
        priority: 1,
        stopPropagation: true,
      },
      target: {
        layer: "mainLayer",
        name: "brushMain",
      },
      feedback: {
        selection: {
          highlight: "#14c94a",
          dim: { opacity: 0.08, selector: ".mark" },
          brushStyle: {
            fill: "#9d9d9d",
            opacity: 0.55,
            stroke: "none",
          },
        },
      },
    },
    {
      instrument: "Move",
      trigger: {
        type: "drag",
        priority: 2,
        stopPropagation: true,
      },
      target: {
        instrument: "brushMain",
        layer: "transientLayer",
        pointerEvents: "visiblePainted",
      },
      feedback: {
        brush: {
          transform: "translate",
        },
      },
    },
  ];

  await compileInteractionsDSL(interactions, { layersByName });
  await Libra.createHistoryTrack?.();
}
