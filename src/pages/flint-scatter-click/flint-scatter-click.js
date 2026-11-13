import { createFlintInteractionPage } from "../_shared/flintInteractionShowcase";

const FLINT_INPUT = {
  data: {
    values: [
      { horsepower: 68, mpg: 40, origin: "Japan" },
      { horsepower: 95, mpg: 32, origin: "Europe" },
      { horsepower: 105, mpg: 28, origin: "USA" },
      { horsepower: 120, mpg: 26, origin: "Japan" },
      { horsepower: 145, mpg: 21, origin: "USA" },
      { horsepower: 160, mpg: 18, origin: "USA" },
      { horsepower: 88, mpg: 35, origin: "Europe" },
      { horsepower: 132, mpg: 24, origin: "Japan" },
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
    name: "flintScatterClick",
    instrument: "point-selection",
    trigger: {
      type: "click",
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
      },
    },
  },
];

const SOURCE_CODE = String.raw`import { createFlintInteractionPage } from "../_shared/flintInteractionShowcase";

const FLINT_INPUT = {
  data: {
    values: [
      { horsepower: 68, mpg: 40, origin: "Japan" },
      { horsepower: 95, mpg: 32, origin: "Europe" },
      { horsepower: 105, mpg: 28, origin: "USA" },
      { horsepower: 120, mpg: 26, origin: "Japan" },
      { horsepower: 145, mpg: 21, origin: "USA" },
      { horsepower: 160, mpg: 18, origin: "USA" },
      { horsepower: 88, mpg: 35, origin: "Europe" },
      { horsepower: 132, mpg: 24, origin: "Japan" },
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
    name: "flintScatterClick",
    instrument: "point-selection",
    trigger: {
      type: "click",
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
      },
    },
  },
];

export default createFlintInteractionPage({
  pageTitle: "Flint Scatter Click",
  routeName: "flint-scatter-click",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  successMessage: ({ markCount }) =>
    \`Click a point on the left. Flint rendered \${markCount} .marks groups for the scatterplot, and Libra+ keeps the selected point highlighted.\`,
});`;

export default createFlintInteractionPage({
  pageTitle: "Flint Scatter Click",
  routeName: "flint-scatter-click",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  successMessage: ({ markCount }) =>
    `Click a point on the left. Flint rendered ${markCount} .marks groups for the scatterplot, and Libra+ keeps the selected point highlighted.`,
});
