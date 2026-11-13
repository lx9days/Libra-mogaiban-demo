import { createFlintInteractionPage } from "../_shared/flintInteractionShowcase";

const FLINT_INPUT = {
  data: {
    values: [
      { channel: "Search", share: 38 },
      { channel: "Direct", share: 24 },
      { channel: "Social", share: 16 },
      { channel: "Email", share: 12 },
      { channel: "Referral", share: 10 },
    ],
  },
  semantic_types: {
    channel: "Category",
    share: "Quantity",
  },
  chart_spec: {
    chartType: "Donut Chart",
    encodings: {
      size: { field: "share" },
      color: { field: "channel" },
    },
    baseSize: { width: 420, height: 320 },
  },
};

const INTERACTIONS = [
  {
    name: "flintDonutClick",
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
      { channel: "Search", share: 38 },
      { channel: "Direct", share: 24 },
      { channel: "Social", share: 16 },
      { channel: "Email", share: 12 },
      { channel: "Referral", share: 10 },
    ],
  },
  semantic_types: {
    channel: "Category",
    share: "Quantity",
  },
  chart_spec: {
    chartType: "Donut Chart",
    encodings: {
      size: { field: "share" },
      color: { field: "channel" },
    },
    baseSize: { width: 420, height: 320 },
  },
};

const INTERACTIONS = [
  {
    name: "flintDonutClick",
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
  pageTitle: "Flint Donut Click",
  routeName: "flint-donut-click",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  successMessage: ({ markCount }) =>
    \`Click a donut slice on the left. Flint rendered \${markCount} .marks groups, and Libra+ re-colors the selected slice through the VegaLayer scope.\`,
});`;

export default createFlintInteractionPage({
  pageTitle: "Flint Donut Click",
  routeName: "flint-donut-click",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  successMessage: ({ markCount }) =>
    `Click a donut slice on the left. Flint rendered ${markCount} .marks groups, and Libra+ re-colors the selected slice through the VegaLayer scope.`,
});
