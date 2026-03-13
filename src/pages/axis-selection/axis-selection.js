import * as d3 from "d3";
import Libra from "libra-vis";
import LibraManager from "../../core/LibraManager";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

// global constants
const MARGIN = { top: 30, right: 70, bottom: 40, left: 60 };
const WIDTH = 500 - MARGIN.left - MARGIN.right;
const HEIGHT = 380 - MARGIN.top - MARGIN.bottom;
const FIELD_X = "Horsepower";
const FIELD_Y = "Miles_per_Gallon";
const FIELD_COLOR = "Origin";

// global variables
let data = [];

// shared scales
let x = null;
let y = null;
let color = null;

async function loadData() {
  data = (await d3.json("./data/cars.json")).filter(
    (d) => !!(d["Horsepower"] && d["Miles_per_Gallon"])
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

  const extentX = [0, d3.max(data, (d) => d[FIELD_X])];
  const extentY = [0, d3.max(data, (d) => d[FIELD_Y])];

  // Add X axis
  x = d3
    .scaleLinear()
    .domain(extentX)
    .range([0, WIDTH])
    .nice()
    .clamp(true);

  // Add Y axis
  y = d3
    .scaleLinear()
    .domain(extentY)
    .nice()
    .range([HEIGHT, 0])
    .clamp(true);

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
  const [mainLayer, xAxisLayer, yAxisLayer] = renderMainVisualization();
  mountInteraction(mainLayer, xAxisLayer, yAxisLayer);
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
  const g = d3.select(mainLayer.getGraphic());

  // Create X axis layer
  const xAxisLayer = Libra.Layer.initialize("D3Layer", {
    name: "xAxisLayer",
    width: WIDTH,
    height: MARGIN.bottom,
    offset: { x: MARGIN.left, y: MARGIN.top + HEIGHT },
    container: svg.node(),
  });
  const gx = d3.select(xAxisLayer.getGraphic())
    .call(d3.axisBottom(x));
  gx.append("text")
    .text(FIELD_X)
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("x", WIDTH / 2)
    .attr("y", 30);

  // Create Y axis layer
  const yAxisLayer = Libra.Layer.initialize("D3Layer", {
    name: "yAxisLayer",
    width: MARGIN.left,
    height: HEIGHT,
    offset: { x: 0, y: MARGIN.top },
    container: svg.node(),
  });
  const gy = d3.select(yAxisLayer.getGraphic())
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`)
    .call(d3.axisLeft(y));
  gy.append("text")
    .text(FIELD_Y)
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("writing-mode", "tb")
    .style(
      "transform",
      `translate(${-MARGIN.left / 2}px,${HEIGHT / 2}px) rotate(180deg)`
    );

  // Draw points code from the input static visualization
  g.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("class", "mark")
    .attr("fill", "white")
    .attr("stroke-width", 1)
    .attr("stroke", "gray")
    .attr("cx", (d) => x(d[FIELD_X]))
    .attr("cy", (d) => y(d[FIELD_Y]))
    .attr("r", 5);

  return [mainLayer, xAxisLayer, yAxisLayer];
}

async function mountInteraction(mainLayer, xAxisLayer, yAxisLayer) {
  await compileInteractionsDSL(
    [
      {
        Instrument: "axis selection",
        Trigger: "brushx",
        "Target layer": "xAxisLayer",
        "Feedback options": {
          Highlight: "red",
          LinkLayers: ["mainLayer"],
          Scale: x,
          AttrName: FIELD_X,
        },
        SelectionMode: "overwrite",
        BaseOpacity: 0.3,
      },
      {
        Instrument: "axis selection",
        Trigger: "brushy",
        "Target layer": "yAxisLayer",
        "Feedback options": {
          Highlight: "red",
          LinkLayers: ["mainLayer"],
          Scale: y,
          AttrName: FIELD_Y,
        },
        SelectionMode: "overwrite",
        BaseOpacity: 0.3,
      },
    ],
    {
      layersByName: { mainLayer, xAxisLayer, yAxisLayer },
    }
  );
  await Libra.createHistoryTrack();
}

main();
