import { createFlintInteractionPage } from "../_shared/flintInteractionShowcase";

const FLINT_INPUT = {
  data: {
    values: [
      { letter: "A", frequency: 0.08167 },
      { letter: "B", frequency: 0.01492 },
      { letter: "C", frequency: 0.02782 },
      { letter: "D", frequency: 0.04253 },
      { letter: "E", frequency: 0.12702 },
      { letter: "F", frequency: 0.02288 },
      { letter: "G", frequency: 0.02015 },
      { letter: "H", frequency: 0.06094 },
    ],
  },
  semantic_types: {
    letter: "Category",
    frequency: "Quantity",
  },
  chart_spec: {
    chartType: "Bar Chart",
    encodings: {
      x: { field: "letter" },
      y: { field: "frequency" },
    },
    baseSize: { width: 520, height: 320 },
  },
};

const INTERACTIONS = [
  {
    name: "flintBarHover",
    instrument: "point-selection",
    trigger: {
      type: "hover",
      priority: 1,
      stopPropagation: true,
    },
    target: {
      layer: "mainLayer",
    },
    feedback: {
      redrawFunc: {
        highlight: {
          fill: "#e4572e",
        },
      },
    },
  },
];

const SOURCE_CODE = String.raw`import { createFlintInteractionPage } from "../_shared/flintInteractionShowcase";

const FLINT_INPUT = {
  data: {
    values: [
      { letter: "A", frequency: 0.08167 },
      { letter: "B", frequency: 0.01492 },
      { letter: "C", frequency: 0.02782 },
      { letter: "D", frequency: 0.04253 },
      { letter: "E", frequency: 0.12702 },
      { letter: "F", frequency: 0.02288 },
      { letter: "G", frequency: 0.02015 },
      { letter: "H", frequency: 0.06094 },
    ],
  },
  semantic_types: {
    letter: "Category",
    frequency: "Quantity",
  },
  chart_spec: {
    chartType: "Bar Chart",
    encodings: {
      x: { field: "letter" },
      y: { field: "frequency" },
    },
    baseSize: { width: 520, height: 320 },
  },
};

const INTERACTIONS = [
  {
    name: "flintBarHover",
    instrument: "point-selection",
    trigger: {
      type: "hover",
      priority: 1,
      stopPropagation: true,
    },
    target: {
      layer: "mainLayer",
    },
    feedback: {
      redrawFunc: {
        highlight: {
          fill: "#e4572e",
        },
      },
    },
  },
];

export default createFlintInteractionPage({
  pageTitle: "Flint Bar Hover",
  routeName: "flint-bar-hover",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  successMessage: ({ markCount }) =>
    \`Hover the bars on the left. Flint rendered \${markCount} .marks groups, and Libra+ now targets their shared VegaLayer scope.\`,
});`;

export default createFlintInteractionPage({
  pageTitle: "Flint Bar Hover",
  routeName: "flint-bar-hover",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  successMessage: ({ markCount }) =>
    `Hover the bars on the left. Flint rendered ${markCount} .marks groups, and Libra+ now targets their shared VegaLayer scope.`,
});
