import * as d3 from "d3";
import Libra from "libra-vis";

const DEFAULT_MARGIN = { top: 30, right: 70, bottom: 40, left: 60 };
const DEFAULT_WIDTH = 500 - DEFAULT_MARGIN.left - DEFAULT_MARGIN.right;
const DEFAULT_HEIGHT = 380 - DEFAULT_MARGIN.top - DEFAULT_MARGIN.bottom;

export async function setupIrisScatter(options = {}) {
  const {
    fieldX = "sepal_length",
    fieldY = "petal_length",
    fieldColor = "class",
    margin = DEFAULT_MARGIN,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    pointRadius = 5,
    pointFill = () => "white",
    pointStroke = (d, { color }) => color(d[fieldColor]),
    pointFillOpacity = 1,
    pointStrokeWidth = 1,
  } = options;

  const raw = await d3.csv("/public/data/bezdekIris.csv");
  const data = raw
    .map((d) => ({
      ...d,
      [fieldX]: Number(d[fieldX]),
      [fieldY]: Number(d[fieldY]),
    }))
    .filter((d) => Number.isFinite(d[fieldX]) && Number.isFinite(d[fieldY]));

  const container = document.getElementById("LibraPlayground");
  if (container) container.innerHTML = "";

  const svg = d3
    .select("#LibraPlayground")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);

  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d[fieldX]))
    .range([0, width])
    .nice()
    .clamp(true);

  const y = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d[fieldY]))
    .range([height, 0])
    .nice()
    .clamp(true);

  const color = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(data.map((d) => d[fieldColor]))))
    .range(d3.schemeTableau10);

  root
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .append("text")
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("x", width / 2)
    .attr("y", 30)
    .text(fieldX);

  root
    .append("g")
    .call(d3.axisLeft(y))
    .append("text")
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("writing-mode", "tb")
    .style("transform", `translate(${-margin.left / 2}px,${height / 2}px) rotate(180deg)`)
    .text(fieldY);

  const legendDomain = Array.from(new Set(data.map((d) => d[fieldColor])));
  const legend = root.append("g");
  legend
    .append("text")
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("x", width + margin.right / 2)
    .attr("y", -margin.top / 2)
    .text(fieldColor);

  const legendItem = legend
    .append("g")
    .selectAll("g")
    .data(legendDomain)
    .join("g");

  legendItem
    .append("circle")
    .attr("fill-opacity", 0)
    .attr("stroke-width", 2)
    .attr("stroke", (d) => color(d))
    .attr("cx", width + 10)
    .attr("cy", (_, i) => i * 20)
    .attr("r", 5);

  legendItem
    .append("text")
    .attr("font-size", "12px")
    .attr("x", width + 20)
    .attr("y", (_, i) => i * 20 + 5)
    .text((d) => d);

  const mainLayer = Libra.Layer.initialize("D3Layer", {
    name: "mainLayer",
    width,
    height,
    offset: { x: margin.left, y: margin.top },
    container: svg.node(),
  });

  const layerGraphic = d3.select(mainLayer.getGraphic());
  const renderContext = { x, y, color, fieldX, fieldY, fieldColor, width, height, margin };

  layerGraphic
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("class", "mark")
    .attr("fill", (d) => pointFill(d, renderContext))
    .attr("fill-opacity", pointFillOpacity)
    .attr("stroke-width", pointStrokeWidth)
    .attr("stroke", (d) => pointStroke(d, renderContext))
    .attr("cx", (d) => x(d[fieldX]))
    .attr("cy", (d) => y(d[fieldY]))
    .attr("r", pointRadius);

  return {
    data,
    x,
    y,
    color,
    margin,
    width,
    height,
    fieldX,
    fieldY,
    fieldColor,
    svg,
    mainLayer,
    layersByName: { mainLayer },
  };
}
