import * as d3 from "d3";
import LibraManager from "../../core/LibraManager";
import { createFlintInteractionPage } from "../_shared/flintInteractionShowcase";

const FIELD_X = "horsepower";
const FIELD_Y = "mpg";
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
      x: { field: FIELD_X },
      y: { field: FIELD_Y },
      color: { field: "origin" },
    },
    baseSize: { width: 520, height: 320 },
  },
};

const INTERACTIONS = [
  {
    name: "flintScatterPan",
    instrument: "pan",
    trigger: {
      type: "pan",
      modifierKey: "ctrl",
      priority: 2,
      stopPropagation: true,
    },
    target: {
      layer: "mainLayer",
    },
    feedback: {
      context: {
        fixRange: true,
      },
    },
  },
  {
    name: "flintScatterZoom",
    instrument: "zoom",
    trigger: {
      type: "zoom",
      modifierKey: "ctrl",
      priority: 3,
      stopPropagation: true,
    },
    target: {
      layer: "mainLayer",
    },
    feedback: {
      context: {
        fixRange: true,
      },
    },
  },
];

function createBaseScales(input) {
  const values = input.data.values;
  const { width, height } = input.chart_spec.baseSize;
  const xMax = d3.max(values, (d) => d[FIELD_X]) ?? 0;
  const yMax = d3.max(values, (d) => d[FIELD_Y]) ?? 0;
  return {
    scaleX: d3.scaleLinear().domain([0, xMax]).range([0, width]).nice().clamp(false),
    scaleY: d3.scaleLinear().domain([0, yMax]).range([height, 0]).nice().clamp(false),
  };
}

function buildAffineMatrix(baseScaleX, baseScaleY, scaleX, scaleY) {
  const [baseX0, baseX1] = baseScaleX.domain();
  const [baseY0, baseY1] = baseScaleY.domain();
  const x0 = baseScaleX(baseX0);
  const x1 = baseScaleX(baseX1);
  const y0 = baseScaleY(baseY0);
  const y1 = baseScaleY(baseY1);

  const nextX0 = scaleX(baseX0);
  const nextX1 = scaleX(baseX1);
  const nextY0 = scaleY(baseY0);
  const nextY1 = scaleY(baseY1);

  const scaleFactorX = x1 === x0 ? 1 : (nextX1 - nextX0) / (x1 - x0);
  const scaleFactorY = y1 === y0 ? 1 : (nextY1 - nextY0) / (y1 - y0);
  const translateX = nextX0 - scaleFactorX * x0;
  const translateY = nextY0 - scaleFactorY * y0;

  return {
    scaleFactorX,
    scaleFactorY,
    translateX,
    translateY,
  };
}

async function onLayerReady({ layer, flintInput }) {
  const graphic = layer.getGraphic();
  const { scaleX: baseScaleX, scaleY: baseScaleY } = createBaseScales(flintInput);

  LibraManager.buildGeometricTransformer(layer, {
    scaleX: baseScaleX.copy(),
    scaleY: baseScaleY.copy(),
    redraw: (scaleX, scaleY) => {
      const { scaleFactorX, scaleFactorY, translateX, translateY } = buildAffineMatrix(
        baseScaleX,
        baseScaleY,
        scaleX,
        scaleY
      );
      d3.select(graphic).attr(
        "transform",
        `matrix(${scaleFactorX},0,0,${scaleFactorY},${translateX},${translateY})`
      );
      layer.postUpdate?.();
    },
  });
}

const SOURCE_CODE = String.raw`import * as d3 from "d3";
import LibraManager from "../../core/LibraManager";
import { createFlintInteractionPage } from "../_shared/flintInteractionShowcase";

const FIELD_X = "horsepower";
const FIELD_Y = "mpg";
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
      x: { field: FIELD_X },
      y: { field: FIELD_Y },
      color: { field: "origin" },
    },
    baseSize: { width: 520, height: 320 },
  },
};

const INTERACTIONS = [
  {
    name: "flintScatterPan",
    instrument: "pan",
    trigger: { type: "pan", modifierKey: "ctrl", priority: 2, stopPropagation: true },
    target: { layer: "mainLayer" },
    feedback: { context: { fixRange: true } },
  },
  {
    name: "flintScatterZoom",
    instrument: "zoom",
    trigger: { type: "zoom", modifierKey: "ctrl", priority: 3, stopPropagation: true },
    target: { layer: "mainLayer" },
    feedback: { context: { fixRange: true } },
  },
];

function createBaseScales(input) {
  const values = input.data.values;
  const { width, height } = input.chart_spec.baseSize;
  const xMax = d3.max(values, (d) => d[FIELD_X]) ?? 0;
  const yMax = d3.max(values, (d) => d[FIELD_Y]) ?? 0;
  return {
    scaleX: d3.scaleLinear().domain([0, xMax]).range([0, width]).nice().clamp(false),
    scaleY: d3.scaleLinear().domain([0, yMax]).range([height, 0]).nice().clamp(false),
  };
}

function buildAffineMatrix(baseScaleX, baseScaleY, scaleX, scaleY) {
  const [baseX0, baseX1] = baseScaleX.domain();
  const [baseY0, baseY1] = baseScaleY.domain();
  const x0 = baseScaleX(baseX0);
  const x1 = baseScaleX(baseX1);
  const y0 = baseScaleY(baseY0);
  const y1 = baseScaleY(baseY1);
  const nextX0 = scaleX(baseX0);
  const nextX1 = scaleX(baseX1);
  const nextY0 = scaleY(baseY0);
  const nextY1 = scaleY(baseY1);
  const scaleFactorX = x1 === x0 ? 1 : (nextX1 - nextX0) / (x1 - x0);
  const scaleFactorY = y1 === y0 ? 1 : (nextY1 - nextY0) / (y1 - y0);
  const translateX = nextX0 - scaleFactorX * x0;
  const translateY = nextY0 - scaleFactorY * y0;
  return { scaleFactorX, scaleFactorY, translateX, translateY };
}

async function onLayerReady({ layer, flintInput }) {
  const graphic = layer.getGraphic();
  const { scaleX: baseScaleX, scaleY: baseScaleY } = createBaseScales(flintInput);
  LibraManager.buildGeometricTransformer(layer, {
    scaleX: baseScaleX.copy(),
    scaleY: baseScaleY.copy(),
    redraw: (scaleX, scaleY) => {
      const { scaleFactorX, scaleFactorY, translateX, translateY } = buildAffineMatrix(
        baseScaleX,
        baseScaleY,
        scaleX,
        scaleY
      );
      d3.select(graphic).attr(
        "transform",
        \`matrix(\${scaleFactorX},0,0,\${scaleFactorY},\${translateX},\${translateY})\`
      );
      layer.postUpdate?.();
    },
  });
}

export default createFlintInteractionPage({
  pageTitle: "Flint Scatter Pan Zoom",
  routeName: "flint-scatter-pan-zoom",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  onLayerReady,
  successMessage:
    "Hold Ctrl and drag to pan. Hold Ctrl and use the mouse wheel to zoom the Flint-generated marks inside VegaLayer.",
});`;

export default createFlintInteractionPage({
  pageTitle: "Flint Scatter Pan Zoom",
  routeName: "flint-scatter-pan-zoom",
  flintInput: FLINT_INPUT,
  interactions: INTERACTIONS,
  sourceCode: SOURCE_CODE,
  onLayerReady,
  successMessage:
    "Hold Ctrl and drag to pan. Hold Ctrl and use the mouse wheel to zoom the Flint-generated marks inside VegaLayer.",
});
