import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
const WIDTH = 500 - MARGIN.left - MARGIN.right;
const HEIGHT = 380 - MARGIN.top - MARGIN.bottom;

let data = null;
let root = null;
let leavesL3 = [];
let color = null;

async function loadData() {
  data = await d3.json("./data/flare-2.json");
  root = d3
    .hierarchy(data)
    .sum((d) => d.value)
    .sort((a, b) => b.height - a.height || b.value - a.value);
  root.children?.forEach((node, i) => (node.groupId = i));
  d3.treemap().size([WIDTH, HEIGHT]).padding(0.5)(root);
  const l1 = [root].flatMap((n) => n.children || [n]);
  const l2 = l1.flatMap((n) => n.children?.map((x) => ({ ...x, groupId: n.groupId })) ?? [n]);
  leavesL3 = l2.flatMap((n) => n.children?.map((x) => ({ ...x, groupId: n.groupId })) ?? [n]);
}

function renderStaticVisualization() {
  const svg = d3
    .select("#LibraPlayground")
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr("viewBox", `0 0 ${WIDTH + MARGIN.left + MARGIN.right} ${HEIGHT + MARGIN.top + MARGIN.bottom}`)
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  color = d3
    .scaleOrdinal()
    .domain((root.children || []).map((n) => n.groupId))
    .range(d3.schemeTableau10);
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

  g
    .selectAll(".mark")
    .data(leavesL3)
    .join("rect")
    .attr("class", "mark")
    .attr("fill", (d) => color(d.groupId))
    .attr("fill-opacity",0.7)
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => d.y1 - d.y0);

  return mainLayer;
}

async function mountInteraction(mainLayer) {
  const interactions = [
    {
      instrument: "lens",
      trigger: {
        type: "hover",
        stopPropagation: true,
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        lens: {
          excentricLabeling: {
            renderSelection: true,
            r: 45,
                stroke: "#000000",
            strokeWidth: 3,
            countLabelDistance: 18,
            fontSize: 18,
            countLabelWidth: 64,
            maxLabelsNum: 12,
            labelAccessor: (elem) => d3.select(elem).datum()?.data?.name ?? "",
            colorAccessor: () => "black",
            syntheticEvent: "mousemove",
          },
        },
      },
    },
  ];

  await compileInteractionsDSL(interactions, {
    layersByName: { mainLayer },
  });
  mainLayer.setLayersOrder({
    selectionLayer: 1,
    LensLayer: 2,
    LabelLayer: 3,
  });
  mainLayer.onUpdate(() => {
    mainLayer.setLayersOrder({
      selectionLayer: 1,
      LensLayer: 2,
      LabelLayer: 3,
    });
  });
  await Libra.createHistoryTrack?.();
}

async function main() {
  await loadData();
  renderStaticVisualization();
  const mainLayer = renderMainVisualization();
  await mountInteraction(mainLayer);
}

main();
