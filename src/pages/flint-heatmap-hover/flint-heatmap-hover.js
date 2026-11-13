import { createFlintInteractionPage } from "../_shared/flintInteractionShowcase";

const FLINT_INPUT = {
  data: {
    values: [
      { month: "Jan", city: "Seattle", temp: 6 },
      { month: "Feb", city: "Seattle", temp: 8 },
      { month: "Mar", city: "Seattle", temp: 10 },
      { month: "Jan", city: "Austin", temp: 12 },
      { month: "Feb", city: "Austin", temp: 15 },
      { month: "Mar", city: "Austin", temp: 19 },
      { month: "Jan", city: "Boston", temp: -1 },
      { month: "Feb", city: "Boston", temp: 1 },
      { month: "Mar", city: "Boston", temp: 6 },
    ],
  },
  semantic_types: {
    month: "Category",
    city: "Category",
    temp: "Quantity",
  },
  chart_spec: {
    chartType: "Heatmap",
    encodings: {
      x: { field: "month" },
      y: { field: "city" },
      color: { field: "temp" },
    },
    baseSize: { width: 520, height: 320 },
  },
};

const INTERACTIONS = [
  {
    name: "flintHeatmapHover",
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
          fill: "#0f172a",
        },
      },
    },
  },
];

const SOURCE_CODE = String.raw`import { createFlintInteractionPage } from "../_shared/flintInteractionShowcase";

const FLINT_INPUT = {
  data: {
    values: [
      { month: "Jan", city: "Seattle", temp: 6 },
      { month: "Feb", city: "Seattle", temp: 8 },
      { month: "Mar", city: "Seattle", temp: 10 },
      { month: "Jan", city: "Austin", temp: 12 },
      { month: "Feb", city: "Austin", temp: 15 },
      { month: "Mar", city: "Austin", temp: 19 },
      { month: "Jan", city: "Boston", temp: -1 },
      { month: "Feb", city: "Boston", temp: 1 },
      { month: "Mar", city: "Boston", temp: 6 },
    ],
  },
  semantic_types: {
    month: "Category",
    city: "Category",
    temp: "Quantity",
  },
  chart_spec: {
    chartType: "Heatmap",
    encodings: {
      x: { field: "month" },
      y: { field: "city" },
      color: { field: "temp" },
    },
    baseSize: { width: 520, height: 320 },
  },
};

const INTERACTIONS = [
  {
    name: "flintHeatmapHover",
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
          fill: "#0f172a",
        },
      },
    },
  },
];

export default createFlintInteractionPage({
  pageTitle: "Flint Heatmap Hover",
  routeName: "flint-heatmap-hover",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  successMessage: ({ markCount }) =>
    \`Hover the heatmap cells on the left. Flint rendered \${markCount} .marks groups, and Libra+ highlights the hovered cell via the shared VegaLayer scope.\`,
});`;

export default createFlintInteractionPage({
  pageTitle: "Flint Heatmap Hover",
  routeName: "flint-heatmap-hover",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  successMessage: ({ markCount }) =>
    `Hover the heatmap cells on the left. Flint rendered ${markCount} .marks groups, and Libra+ highlights the hovered cell via the shared VegaLayer scope.`,
});
