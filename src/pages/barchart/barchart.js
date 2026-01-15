import * as d3 from "d3";
import Libra from "libra-vis";

const MARGIN = { top: 30, right: 40, bottom: 40, left: 50 };
const WIDTH = 500 - MARGIN.left - MARGIN.right;
const HEIGHT = 360 - MARGIN.top - MARGIN.bottom;

async function loadData() {
  try {
    const data = await d3.json("/public/data/testBar.json");
    return Array.isArray(data) ? data.filter((d) => d && d.x != null && d.y != null) : [];
  } catch (e) {
    return [
      { x: "A", y: 28 },
      { x: "B", y: 55 },
      { x: "C", y: 43 },
      { x: "D", y: 91 },
      { x: "E", y: 81 },
      { x: "F", y: 53 },
      { x: "G", y: 19 },
      { x: "H", y: 87 }
    ];
  }
}

function renderAxes(svg, x, y) {
  svg
    .append("g")
    .attr("transform", "translate(0," + HEIGHT + ")")
    .call(d3.axisBottom(x))
    .append("text")
    .text("x")
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("x", WIDTH / 2)
    .attr("y", 30);

  svg
    .append("g")
    .call(d3.axisLeft(y))
    .append("text")
    .text("y")
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("writing-mode", "tb")
    .style("transform", `translate(${-MARGIN.left / 2}px,${HEIGHT / 2}px) rotate(180deg)`);
}

function mountInteraction(layer) {
  Libra.Interaction.build({
    inherit: "HoverInstrument",
    layers: [layer],
    sharedVar: {
      modifierKey:"ctrl",
      highlightAttrValues: { "stroke-width": 2, opacity: 0.95, fill: "orange" },
    },
  });
}

export default async function init() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;
  container.innerHTML = "";

  const data = await loadData();

  const svgEl = d3
    .select(container)
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr("viewBox", `0 0 ${WIDTH + MARGIN.left + MARGIN.right} ${HEIGHT + MARGIN.top + MARGIN.bottom}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const svg = svgEl
    .append("g")
    .attr("transform", "translate(" + MARGIN.left + "," + MARGIN.top + ")");

  const x = d3.scaleBand()
    .domain(data.map((d) => d.x))
    .range([0, WIDTH])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, (d) => d.y)])
    .nice()
    .range([HEIGHT, 0]);

  renderAxes(svg, x, y);

  const layer = Libra.Layer.initialize("D3Layer", {
    name: "mainLayer",
    width: WIDTH,
    height: HEIGHT,
    offset: { x: MARGIN.left, y: MARGIN.top },
    container: svgEl.node(),
  });

  const g = d3.select(layer.getGraphic());
  g.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("class", "mark")
    .attr("x", (d) => x(d.x))
    .attr("y", (d) => y(d.y))
    .attr("width", x.bandwidth())
    .attr("height", (d) => HEIGHT - y(d.y))
    .attr("fill", "steelblue");

  mountInteraction(layer);
}
