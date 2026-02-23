import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

// global constants
const MARGIN = { top: 30, right: 70, bottom: 40, left: 60 };
const WIDTH = 500 - MARGIN.left - MARGIN.right;
const HEIGHT = 380 - MARGIN.top - MARGIN.bottom;
const FIELD_X = "sepal_length";
const FIELD_Y = "petal_length";
const FIELD_COLOR = "class";

// global variables
let data = [];

// shared scales
let x = null;
let y = null;
let color = null;

async function loadData() {
  const raw = await d3.csv("/public/data/bezdekIris.csv");
  data = raw
    .map((d) => ({
      ...d,
      sepal_length: parseFloat(d.sepal_length),
      petal_length: parseFloat(d.petal_length),
    }))
    .filter(
      (d) => !isNaN(d[FIELD_X]) && !isNaN(d[FIELD_Y])
    );
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

  const extentX = d3.extent(data, (d) => d[FIELD_X]);
  const extentY = d3.extent(data, (d) => d[FIELD_Y]);

  // Add X axis
  x = d3
    .scaleLinear()
    .domain(extentX)
    .range([0, WIDTH])
    .nice()
    .clamp(true);
  svg
    .append("g")
    .attr("transform", "translate(0," + HEIGHT + ")")
    .call(d3.axisBottom(x))
    .append("text")
    .text(FIELD_X)
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("x", WIDTH / 2)
    .attr("y", 30);

  // Add Y axis
  y = d3
    .scaleLinear()
    .domain(extentY)
    .nice()
    .range([HEIGHT, 0])
    .clamp(true);
  svg
    .append("g")
    .call(d3.axisLeft(y))
    .append("text")
    .text(FIELD_Y)
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("writing-mode", "tb")
    .style(
      "transform",
      `translate(${-MARGIN.left / 2}px,${
        HEIGHT / 2
      }px) rotate(180deg)`
    );

  // Add Legend
  color = d3
    .scaleOrdinal()
    .domain(
      new Set(data.map((d) => d[FIELD_COLOR])).values()
    )
    .range(d3.schemeTableau10);
  svg
    .append("g")
    .call((g) =>
      g
        .append("text")
        .text(FIELD_COLOR)
        .attr("fill", "black")
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("x", WIDTH + MARGIN.right / 2)
        .attr("y", -MARGIN.top / 2)
    )
    .call((g) =>
      g
        .append("g")
        .selectAll("g")
        .data(
          new Set(
            data.map((d) => d[FIELD_COLOR])
          ).values()
        )
        .join("g")
        .call((g) => {
          g.append("circle")
            .attr("fill-opacity", "0")
            .attr("stroke-width", 2)
            .attr("stroke", (d) => color(d))
            .attr("cx", WIDTH + 10)
            .attr("cy", (_, i) => i * 20)
            .attr("r", 5);
        })
        .call((g) => {
          g.append("text")
            .text((d) => d)
            .attr("font-size", "12px")
            .attr("x", WIDTH + 20)
            .attr("y", (_, i) => i * 20 + 5);
        })
    );
}

async function main() {
  await loadData();
  renderStaticVisualization();
  const mainLayer = renderMainVisualization();
  await mountInteraction(mainLayer);
}

function renderMainVisualization() {
  // Find the SVG element on page
  const svg = d3.select("#LibraPlayground svg");

  // Create the main layer
  const mainLayer = Libra.Layer.initialize("D3Layer", {
    name: "mainLayer",
    width: WIDTH,
    height: HEIGHT,
    offset: { x: MARGIN.left, y: MARGIN.top },
    container: svg.node(),
  });
  console.log(Libra.Layer.findLayer("mainLayer"));
  
  const g = d3.select(mainLayer.getGraphic());

  // Draw points code from the input static visualization
  g.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("class", "mark")
    .attr("fill", "white")
    .attr("stroke-width", 1)
    .attr("stroke", (d) => color(d[FIELD_COLOR]))
    .attr("cx", (d) => x(d[FIELD_X]))
    .attr("cy", (d) => y(d[FIELD_Y]))
    .attr("r", 5);

  return mainLayer;
}

async function mountInteraction(layer) {
  // Attach HoverInstrument to the main layer
  const interactions = [
    {
      Instrument: "point selection",
      Trigger: "hover",
      "Target layer": "mainLayer",
      "Feedback options": {
        Highlight: "#ff0000",
      },
      priority: 1,
      stopPropagation: true,
    },
  ];
  await compileInteractionsDSL(interactions);
  if (Libra.createHistoryTrack) {
    await Libra.createHistoryTrack();
  }
}

main();
