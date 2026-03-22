import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";
import { setupCarsScatter } from "../_shared/carsScatter";

export default async function init() {
  const { color, layersByName } = await setupCarsScatter({
    pointFill: () => "none",
    pointStrokeWidth: 1.5,
  });

  const interactions = [
    {
      instrument: "Lens",
      trigger: {
        type: "hover",
        priority: 1,
        stopPropagation: true,
      },
      target: {
        layer: "mainLayer",
        name: "lensMain",
      },
      feedback: {
        lens: {
          excentricLabeling: {
            renderSelection: false,
            r: 36,
            stroke: "#1d8f43",
            strokeWidth: 2,
            countLabelDistance: 18,
            fontSize: 12,
            countLabelWidth: 56,
            maxLabelsNum: 12,
            labelAccessor: (circleElem) => {
              const datum = d3.select(circleElem).datum();
              return `${datum.Name} (${datum.Horsepower}, ${datum.Miles_per_Gallon})`;
            },
            colorAccessor: (circleElem) => color(d3.select(circleElem).datum().Origin),
            filter: (circleElem) => d3.select(circleElem).datum().Origin === "USA",
            count: {
              op: "count",
            },
          },
        },
      },
    },
    {
      instrument: "point selection",
      trigger: {
        type: "hover",
        priority: 2,
        stopPropagation: true,
      },
      target: {
        instrument: "lensMain",
        layer: "LabelLayer",
      },
      feedback: {
        selection: {
          highlight: {
            stroke: "#ff4d00",
            "stroke-width": 2,
          },
        },
      },
    },
  ];

  await compileInteractionsDSL(interactions, { layersByName });
  await Libra.createHistoryTrack?.();
}
