import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

const MARGIN = { top: 30, right: 40, bottom: 40, left: 90 };
const WIDTH = 500 - MARGIN.left - MARGIN.right;
const HEIGHT = 420 - MARGIN.top - MARGIN.bottom;
const CATEGORY_FIELD = "species";
const VALUE_FIELD = "body_mass_g";
const RADIUS = 4;
const PADDING = 1.5;
const ITERATIONS = 220;

let data = [];
let x = null;
let y = null;
let color = null;
let categories = [];
let reorderScaleX = null;

async function loadData() {
  try {
    const raw = await d3.csv("/public/data/penguins.csv", d3.autoType);
    data = raw
      .filter((d) => d[CATEGORY_FIELD] != null && Number.isFinite(+d[VALUE_FIELD]))
      .map((d) => ({
        category: String(d[CATEGORY_FIELD]),
        value: +d[VALUE_FIELD],
      }));
  } catch (e) {
    const raw2 = await d3.csv("/data/penguins.csv", d3.autoType);
    data = raw2
      .filter((d) => d[CATEGORY_FIELD] != null && Number.isFinite(+d[VALUE_FIELD]))
      .map((d) => ({
        category: String(d[CATEGORY_FIELD]),
        value: +d[VALUE_FIELD],
      }));
  }
}

function renderStatic() {
  const svg = d3
    .select("#LibraPlayground")
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr("viewBox", `0 0 ${WIDTH + MARGIN.left + MARGIN.right} ${HEIGHT + MARGIN.top + MARGIN.bottom}`)
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  categories = Array.from(new Set(data.map((d) => d.category)));
  const extentX = d3.extent(data, (d) => d.value);

  x = d3.scaleLinear().domain(extentX).nice().range([0, WIDTH]).clamp(true);
  y = d3.scaleBand().domain(categories).range([0, HEIGHT]).paddingInner(0.4).paddingOuter(0.2);
  reorderScaleX = d3.scaleBand().domain(categories).range([0, categories.length]).padding(0);
  color = d3.scaleOrdinal().domain(categories).range(d3.schemeTableau10);

  svg
    .append("g")
    .attr("transform", `translate(0,${HEIGHT})`)
    .call(d3.axisBottom(x))
    .call((g) =>
      g
        .append("text")
        .text(VALUE_FIELD)
        .attr("x", WIDTH / 2)
        .attr("y", 32)
        .attr("fill", "black")
        .attr("font-size", 12)
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle")
    );

  svg
    .append("g")
    .attr("stroke-opacity", 0.08)
    .call((g) =>
      g
        .selectAll("line.grid")
        .data(x.ticks())
        .join("line")
        .attr("class", "grid")
        .attr("x1", (d) => x(d))
        .attr("x2", (d) => x(d))
        .attr("y1", 0)
        .attr("y2", HEIGHT)
        .attr("stroke", "currentColor")
    );
}

function renderYAxis(yAxisLayer) {
  const g = d3.select(yAxisLayer.getGraphic());
  g.selectAll("*").remove();
  g
    .append("g")
    .call(d3.axisLeft(y))
    .call((axisG) =>
      axisG
        .append("text")
        .text(CATEGORY_FIELD)
        .attr("fill", "black")
        .attr("font-size", 12)
        .attr("font-weight", "bold")
        .attr("writing-mode", "tb")
        .style("transform", `translate(${-(MARGIN.left - 20)}px,${HEIGHT / 2}px) rotate(180deg)`)
    );
}

function layoutBeeswarm(nodesByCategory) {
  nodesByCategory.forEach(({ nodes, yCenter }) => {
    const sim = d3
      .forceSimulation(nodes)
      .force("x", d3.forceX((d) => x(d.value)).strength(1))
      .force("y", d3.forceY(yCenter).strength(0.25))
      .force("collide", d3.forceCollide(RADIUS + PADDING))
      .stop();
    for (let i = 0; i < ITERATIONS; i++) sim.tick();
  });
}

function updateBeeswarm(mainLayer) {
  const g = d3.select(mainLayer.getGraphic());
  const grouped = d3.group(data, (d) => d.category);
  const nodesByCategory = [];
  grouped.forEach((arr, key) => {
    const yc = (y(key) ?? 0) + y.bandwidth() / 2;
    const nodes = arr.map((d) => ({ ...d }));
    nodesByCategory.push({ nodes, yCenter: yc });
  });

  layoutBeeswarm(nodesByCategory);
  const nodesAll = nodesByCategory.flatMap((d) => d.nodes);

  const marks = g
    .selectAll("circle.mark")
    .data(nodesAll, (d) => `${d.category}-${d.value}-${d.index || 0}`);
  marks
    .join(
      (enter) =>
        enter
          .append("circle")
          .attr("class", "mark")
          .attr("r", RADIUS)
          .attr("fill", "#bbb")
          .attr("fill-opacity", 0.8)
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.5)
          .attr("cx", (d) => d.x)
          .attr("cy", (d) => d.y)
          .call((s) => s.append("title").text((d) => `${d.category}, ${VALUE_FIELD}: ${d.value}`)),
      (update) =>
        update
          .attr("cx", (d) => d.x)
          .attr("cy", (d) => d.y),
      (exit) => exit.remove()
    );
}

function renderMain() {
  const svg = d3.select("#LibraPlayground svg");
  const mainLayer = Libra.Layer.initialize("D3Layer", {
    name: "mainLayer",
    width: WIDTH,
    height: HEIGHT,
    offset: { x: MARGIN.left, y: MARGIN.top },
    container: svg.node(),
  });
  updateBeeswarm(mainLayer);

  return mainLayer;
}

async function mountInteraction(mainLayer, yAxisLayer) {
  const redraw = (newNames, _newX, newY) => {
    if (Array.isArray(newNames) && newNames.length > 0) {
      categories = newNames.slice();
      y.domain(categories);
      reorderScaleX.domain(categories);
    }
    if (newY) {
      y = newY;
    }
    renderYAxis(yAxisLayer);
    updateBeeswarm(mainLayer);
  };

  const interactions = [
    {
      Instrument: "reordering",
      Trigger: "Drag",
      targetLayer: "yAxisLayer",
      Direction: "y",
      feedbackOptions: {
        redrawRef: redraw,
        contextRef: {
          names: categories,
          scales: { x: reorderScaleX, y },
          copyFrom: mainLayer,
          offset: { x: 0, y: 0 },
        },
      },
    },
    {
      Instrument: "group selection",
      Trigger: "Brush",
      targetLayer: "mainLayer",
      feedbackOptions: {
        Highlight: {
          color: (d) => color(d.category),
        },
        Tooltip: {
          prefix: "Penguin",
          fields: ["category", "value"],
        },
      },
    },
  ];

  await compileInteractionsDSL(interactions, {
    layersByName: { yAxisLayer, mainLayer },
  });
  if (typeof Libra.createHistoryTrack === "function") {
    await Libra.createHistoryTrack();
  }
}

export default async function init() {
  await loadData();
  renderStatic();
  const svg = d3.select("#LibraPlayground svg");
  const yAxisLayer = Libra.Layer.initialize("D3Layer", {
    name: "yAxisLayer",
    width: MARGIN.left,
    height: HEIGHT,
    offset: { x: MARGIN.left, y: MARGIN.top },
    container: svg.node(),
  });
  renderYAxis(yAxisLayer);
  const mainLayer = renderMain();
  await mountInteraction(mainLayer, yAxisLayer);
}
