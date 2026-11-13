import { createFlintInteractionPage } from "../_shared/flintInteractionShowcase";

const FLINT_INPUT = {
  data: {
    values: [
      { horsepower: 68, mpg: 40, origin: "Japan" },
      { horsepower: 72, mpg: 37, origin: "Japan" },
      { horsepower: 88, mpg: 35, origin: "Europe" },
      { horsepower: 95, mpg: 32, origin: "Europe" },
      { horsepower: 105, mpg: 28, origin: "USA" },
      { horsepower: 120, mpg: 26, origin: "Japan" },
      { horsepower: 132, mpg: 24, origin: "Japan" },
      { horsepower: 145, mpg: 21, origin: "USA" },
      { horsepower: 160, mpg: 18, origin: "USA" },
      { horsepower: 175, mpg: 16, origin: "USA" },
    ],
  },
  semantic_types: {
    horsepower: "Quantity",
    mpg: "Quantity",
    origin: "Category",
  },
  chart_spec: {
    chartType: "Scatter Plot",
    encodings: {
      x: { field: "horsepower" },
      y: { field: "mpg" },
      color: { field: "origin" },
    },
    baseSize: { width: 520, height: 320 },
  },
};

const INTERACTIONS = [
  {
    name: "flintScatterBrush",
    instrument: "GroupSelection",
    trigger: {
      type: "brush",
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
          stroke: "#7f1d1d",
          "stroke-width": 2,
        },
        brushStyle: {
          fill: "#475569",
          opacity: 0.18,
          stroke: "#0f172a",
          "stroke-width": 1,
        },
      },
    },
  },
];

const SOURCE_CODE = String.raw`import { createFlintInteractionPage } from "../_shared/flintInteractionShowcase";

const FLINT_INPUT = {
  data: {
    values: [
      { horsepower: 68, mpg: 40, origin: "Japan" },
      { horsepower: 72, mpg: 37, origin: "Japan" },
      { horsepower: 88, mpg: 35, origin: "Europe" },
      { horsepower: 95, mpg: 32, origin: "Europe" },
      { horsepower: 105, mpg: 28, origin: "USA" },
      { horsepower: 120, mpg: 26, origin: "Japan" },
      { horsepower: 132, mpg: 24, origin: "Japan" },
      { horsepower: 145, mpg: 21, origin: "USA" },
      { horsepower: 160, mpg: 18, origin: "USA" },
      { horsepower: 175, mpg: 16, origin: "USA" },
    ],
  },
  semantic_types: {
    horsepower: "Quantity",
    mpg: "Quantity",
    origin: "Category",
  },
  chart_spec: {
    chartType: "Scatter Plot",
    encodings: {
      x: { field: "horsepower" },
      y: { field: "mpg" },
      color: { field: "origin" },
    },
    baseSize: { width: 520, height: 320 },
  },
};

const INTERACTIONS = [
  {
    name: "flintScatterBrush",
    instrument: "GroupSelection",
    trigger: {
      type: "brush",
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
          stroke: "#7f1d1d",
          "stroke-width": 2,
        },
        brushStyle: {
          fill: "#475569",
          opacity: 0.18,
          stroke: "#0f172a",
          "stroke-width": 1,
        },
      },
    },
  },
];

export default createFlintInteractionPage({
  pageTitle: "Flint Scatter Brush",
  routeName: "flint-scatter-brush",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  successMessage: ({ markCount }) =>
    \`Drag a brush over the points on the left. Flint rendered \${markCount} .marks groups, and Libra+ group selection highlights points inside the brush.\`,
});`;

export default createFlintInteractionPage({
  pageTitle: "Flint Scatter Brush",
  routeName: "flint-scatter-brush",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  successMessage: ({ markCount }) =>
    `Drag a brush over the points on the left. Flint rendered ${markCount} .marks groups, and Libra+ group selection highlights points inside the brush.`,
});
