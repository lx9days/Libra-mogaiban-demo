import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

// global constants
const MARGIN = { top: 20, right: 0, bottom: 30, left: 40 };
const WIDTH = 500 - MARGIN.left - MARGIN.right;
const HEIGHT = 380 - MARGIN.top - MARGIN.bottom;
const BAR_FILL = "steelblue";
const BAR_OPACITY = 1;

// Dimming config for non-highlighted marks:
// mode: "none" | "opacity" | "color"
// - "none": do not dim non-highlighted marks (default)
// - "opacity": set non-highlighted marks to `opacity`
// - "color": set non-highlighted marks to `color` (and optional `opacity`)
const NON_HIGHLIGHT_DIMMING = {
  // mode: "none",
  opacity: 0.25,
  // color: "#d3d3d3",
};

// global variables
let data = [];

// shared scales
let x = null;
let y = null;

async function loadData() {
  const alphabet = {
    A: 0.08167,
    B: 0.01492,
    C: 0.02782,
    D: 0.04253,
    E: 0.12702,
    F: 0.02288,
    G: 0.02015,
    H: 0.06094,
    I: 0.06966,
    J: 0.00153,
    K: 0.00772,
    L: 0.04025,
    M: 0.02406,
    N: 0.06749,
    O: 0.07507,
    P: 0.01929,
    Q: 0.00095,
    R: 0.05987,
    S: 0.06327,
    T: 0.09056,
    U: 0.02758,
    V: 0.00978,
    W: 0.0236,
    X: 0.0015,
    Y: 0.01974,
    Z: 0.00074,
  };

  data = [];
  Object.keys(alphabet).forEach((key) => {
    data.push({
      name: key,
      value: alphabet[key],
    });
  });
}

function renderStaticVisualization() {
  // append the svg object to the body of the page
  const svg = d3
    .select("#LibraPlayground")
    .append("svg")
    .attr(
      "width",
      WIDTH + MARGIN.left + MARGIN.right
    )
    .attr(
      "height",
      HEIGHT + MARGIN.top + MARGIN.bottom
    )
    .attr("viewbox", `0 0 ${WIDTH} ${HEIGHT}`)
    .append("g")
    .attr(
      "transform",
      "translate(" + MARGIN.left + "," + MARGIN.top + ")"
    );

  // Add X axis
  x = d3
    .scaleBand()
    .domain(data.map((d) => d.name))
    .range([0, WIDTH])
    .padding(0.1);
  svg
    .append("g")
    .attr("transform", "translate(0," + HEIGHT + ")")
    .call(d3.axisBottom(x).tickSizeOuter(0))
    .call((g) =>
      g
        .selectAll(".tick line")
        .clone()
        .attr("stroke-opacity", 0.1)
        .attr("y2", -HEIGHT)
    );

  // Add Y axis
  y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value)])
    .nice()
    .range([HEIGHT, 0]);
  svg
    .append("g")
    .call(d3.axisLeft(y))
    .call((g) =>
      g
        .selectAll(".tick line")
        .clone()
        .attr("stroke-opacity", 0.1)
        .attr("x2", WIDTH)
    );
}

async function main() {
  await loadData();
  renderStaticVisualization();
  const mainLayer = renderMainVisualization();
  await mountInteraction(mainLayer);
}

function renderMainVisualization() {
  // append the svg object to the body of the page
  const svg = d3.select("#LibraPlayground svg");

  // create layer
  const mainLayer = Libra.Layer.initialize("D3Layer", {
    name: "mainLayer",
    width: WIDTH,
    height: HEIGHT,
    offset: { x: MARGIN.left, y: MARGIN.top },
    container: svg.node(),
  });
  const g = d3.select(mainLayer.getGraphic());

  // Draw the bars
  g.selectAll(".bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("opacity", BAR_OPACITY)
    .attr("fill", BAR_FILL)
    .attr("stroke", "#fff")
    .attr("x", (d) => x(d.name))
    .attr("y", (d) => y(d.value))
    .attr("height", (d) => {
      return y(0) - y(d.value);
    })
    .attr("width", x.bandwidth());

  return mainLayer;
}

function normalizeDimmingConfig(config = {}) {
  const modeRaw = typeof config?.mode === "string" ? config.mode.toLowerCase() : null;
  const rawOpacity = Number(config?.opacity);
  const hasOpacity =
    Number.isFinite(rawOpacity) && rawOpacity >= 0 && rawOpacity <= 1;
  const hasColor = typeof config?.color === "string" && config.color.length > 0;
  const mode =
    modeRaw === "opacity" || modeRaw === "color" || modeRaw === "none"
      ? modeRaw
      : hasColor
        ? "color"
        : hasOpacity
          ? "opacity"
          : "none";
  if (mode === "opacity") {
    return {
      mode: "opacity",
      opacity: hasOpacity ? rawOpacity : 0.25,
    };
  }
  if (mode === "color") {
    return {
      mode: "color",
      color: hasColor ? config.color : "#d3d3d3",
      opacity: hasOpacity ? rawOpacity : null,
    };
  }
  return { mode: "none" };
}

function getSelectedDatum(layer, mark) {
  if (!mark) return null;
  const direct = d3.select(mark).datum();
  if (direct) return direct;

  const sourceMark = mark.__libra__screenElement;
  if (sourceMark) {
    const sourceDatum = d3.select(sourceMark).datum();
    if (sourceDatum) return sourceDatum;
    if (layer?.getDatum) return layer.getDatum(sourceMark);
  }

  if (layer?.getDatum) return layer.getDatum(mark);
  return null;
}

function applyNonHighlightDimming(layer, selectedMarks = [], dimmingConfig = { mode: "none" }) {
  if (!layer) return;
  const bars = d3.select(layer.getGraphic()).selectAll(".bar");
  if (bars.empty()) return;

  const selectedNames = new Set(
    (Array.isArray(selectedMarks) ? selectedMarks : [])
      .map((mark) => getSelectedDatum(layer, mark)?.name)
      .filter((name) => !!name)
  );
  const hasSelection = selectedNames.size > 0;

  bars.each(function (datum) {
    const bar = d3.select(this);
    const isSelected = hasSelection && selectedNames.has(datum?.name);
    bar.attr("fill", BAR_FILL).attr("opacity", BAR_OPACITY);

    if (!hasSelection || isSelected || dimmingConfig.mode === "none") return;

    if (dimmingConfig.mode === "opacity") {
      bar.attr("opacity", dimmingConfig.opacity);
      return;
    }

    if (dimmingConfig.mode === "color") {
      bar.attr("fill", dimmingConfig.color);
      if (dimmingConfig.opacity !== null) {
        bar.attr("opacity", dimmingConfig.opacity);
      }
    }
  });
}

async function mountInteraction(layer) {
  const dimmingConfig = normalizeDimmingConfig(NON_HIGHLIGHT_DIMMING);

  const barChartClickFeedback = () => {
    const feedback = {
      Highlight: "red",
    };

    if (dimmingConfig.mode !== "none") {
      feedback.Insert = [
        {
          find: "SelectionService",
          Renderer: (selectedMarks) => {
            applyNonHighlightDimming(layer, selectedMarks, dimmingConfig);
          },
        },
      ];
    }

    return feedback;
  };

  const interactions = [
    {
      Name: "Click",
      Instrument: "point selection",
      Trigger: "click",
      targetLayer: "mainLayer",
      feedbackOptions: barChartClickFeedback,
    },
  ];

  await compileInteractionsDSL(interactions, {
    layersByName: { mainLayer: layer },
  });

  if (typeof Libra.createHistoryTrack === "function") {
    await Libra.createHistoryTrack();
  }
}

main();
