import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

const MARGIN = { top: 0, right: 30, bottom: 12, left: 50 };
const WIDTH = 550 - MARGIN.left - MARGIN.right;
const HEIGHT = 520 - MARGIN.top - MARGIN.bottom;

let data = { nodes: [], links: [] };
let radius = null;

async function loadData() {
  try {
    data = await d3.json("./public/data/miserables.json");
  } catch (e) {
    data = await d3.json("/data/miserables.json");
  }

  data.nodes.forEach((node) => {
    node.degree = data.links.filter(
      (link) => link.target === node.id || link.source === node.id
    ).length;
  });

  d3.forceSimulation(data.nodes)
    .force("charge", d3.forceManyBody().strength(-100))
    .force(
      "link",
      d3
        .forceLink(data.links)
        .id((d) => d.id)
        .distance(0)
        .strength(0.3)
    )
    .force("x", d3.forceX())
    .force("y", d3.forceY())
    .force(
      "center",
      d3.forceCenter(
        WIDTH / 2 + MARGIN.left,
        HEIGHT / 2 + MARGIN.top
      )
    )
    .stop()
    .tick(200);

  const extentRadius = d3.extent(data.nodes, (d) => d.degree);
  radius = d3.scaleLinear().domain(extentRadius).range([3, 10]);
}

function renderStaticVisualization() {
  const svg = d3
    .select("#LibraPlayground")
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr("viewbox", `0 0 ${WIDTH} ${HEIGHT}`);

  const g = svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  g.selectAll("line")
    .data(data.links)
    .join("line")
    .attr("class", "mark")
    .attr("x1", (d) => d.source.x)
    .attr("y1", (d) => d.source.y)
    .attr("x2", (d) => d.target.x)
    .attr("y2", (d) => d.target.y)
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.3);
}

async function main() {
  await loadData();
  renderStaticVisualization();
  const mainLayer = renderMainVisualization();
  await mountInteraction(mainLayer);
}

function renderMainVisualization() {
  const svg = d3.select("#LibraPlayground svg");

  const mainLayer = Libra.Layer.initialize("D3Layer", {
    name: "mainLayer",
    width: WIDTH,
    height: HEIGHT,
    offset: { x: MARGIN.left, y: MARGIN.top },
    container: svg.node(),
  });
  const g = d3.select(mainLayer.getGraphic());

  g.selectAll("circle")
    .data(data.nodes)
    .join("circle")
    .attr("class", "mark")
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("fill", "steelblue")
    .attr("stroke", "#000")
    .attr("r", (d) => radius(d.degree));

  return mainLayer;
}

async function mountInteraction(layer) {
  const interactions = [
    {
      Instrument: "group selection",
      Trigger: "brush",
      targetLayer: "mainLayer",
      feedbackOptions: {
        Highlight: "#ff0000",
      },
      priority: 1,
      stopPropagation: true,
    },
  ];

  await compileInteractionsDSL(interactions);

  if (typeof Libra.createHistoryTrack === "function") {
    await Libra.createHistoryTrack();
  }
}

main();
