import { createFlintInteractionPage } from "../_shared/flintInteractionShowcase";

const FLINT_INPUT = {
  data: {
    values: [
      { region: "North", sales: 42, channel: "Retail" },
      { region: "North", sales: 35, channel: "Online" },
      { region: "South", sales: 38, channel: "Retail" },
      { region: "South", sales: 31, channel: "Online" },
      { region: "West", sales: 29, channel: "Retail" },
      { region: "West", sales: 44, channel: "Online" },
    ],
  },
  semantic_types: {
    region: "Category",
    sales: "Quantity",
    channel: "Category",
  },
  chart_spec: {
    chartType: "Grouped Bar Chart",
    encodings: {
      x: { field: "region" },
      y: { field: "sales" },
      group: { field: "channel" },
    },
    baseSize: { width: 520, height: 320 },
  },
};

const INTERACTIONS = [
  {
    name: "flintGroupedBarClick",
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
          "stroke-width": 1.5,
        },
      },
    },
  },
];

const SOURCE_CODE = String.raw`import { createFlintInteractionPage } from "../_shared/flintInteractionShowcase";

const FLINT_INPUT = {
  data: {
    values: [
      { region: "North", sales: 42, channel: "Retail" },
      { region: "North", sales: 35, channel: "Online" },
      { region: "South", sales: 38, channel: "Retail" },
      { region: "South", sales: 31, channel: "Online" },
      { region: "West", sales: 29, channel: "Retail" },
      { region: "West", sales: 44, channel: "Online" },
    ],
  },
  semantic_types: {
    region: "Category",
    sales: "Quantity",
    channel: "Category",
  },
  chart_spec: {
    chartType: "Grouped Bar Chart",
    encodings: {
      x: { field: "region" },
      y: { field: "sales" },
      group: { field: "channel" },
    },
    baseSize: { width: 520, height: 320 },
  },
};

const INTERACTIONS = [
  {
    name: "flintGroupedBarClick",
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
          "stroke-width": 1.5,
        },
      },
    },
  },
];

export default createFlintInteractionPage({
  pageTitle: "Flint Grouped Bar Click",
  routeName: "flint-grouped-bar-click",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  successMessage: ({ markCount }) =>
    \`Click a grouped bar on the left. Flint rendered \${markCount} .marks groups, and Libra+ highlights the selected subgroup bar through VegaLayer.\`,
});`;

export default createFlintInteractionPage({
  pageTitle: "Flint Grouped Bar Click",
  routeName: "flint-grouped-bar-click",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  successMessage: ({ markCount }) =>
    `Click a grouped bar on the left. Flint rendered ${markCount} .marks groups, and Libra+ highlights the selected subgroup bar through VegaLayer.`,
});
