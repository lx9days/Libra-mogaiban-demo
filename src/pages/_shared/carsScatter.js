import * as d3 from "d3";
import Libra from "libra-vis";

const DEFAULT_MARGIN = { top: 30, right: 70, bottom: 40, left: 60 };
const DEFAULT_WIDTH = 500 - DEFAULT_MARGIN.left - DEFAULT_MARGIN.right;
const DEFAULT_HEIGHT = 340 - DEFAULT_MARGIN.top - DEFAULT_MARGIN.bottom;
const CARS_DATA_URL = "https://raw.githubusercontent.com/vega/vega/main/docs/data/cars.json";

let carsDataPromise = null;

export async function loadCarsScatterData() {
  if (!carsDataPromise) {
    carsDataPromise = d3.json(CARS_DATA_URL);
  }
  return carsDataPromise;
}

export async function setupCarsScatter(options = {}) {
  const {
    fieldX = "Horsepower",
    fieldY = "Miles_per_Gallon",
    fieldColor = "Origin",
    margin = DEFAULT_MARGIN,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    pointRadius = 4,
    pointFill = () => "white",
    pointStroke = (d, { color }) => color(d[fieldColor]),
    pointFillOpacity = 1,
    pointStrokeWidth = 1,
    data: providedData = null,
    container = null,
    clearContainer = true,
    layerName = "mainLayer",
  } = options;

  const rawData = Array.isArray(providedData) ? providedData : await loadCarsScatterData();
  const data = rawData.filter(
    (d) => !!(d[fieldX] && d[fieldY])
  );

  const mountNode = container || document.getElementById("LibraPlayground");
  if (!mountNode) {
    throw new Error("setupCarsScatter requires a mount container.");
  }
  if (clearContainer) mountNode.innerHTML = "";

  const svg = d3
    .select(mountNode)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);

  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d[fieldX])])
    .range([0, width])
    .nice()
    .clamp(true);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d[fieldY])])
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
    .style("transform", `translate(${-margin.left / 2 + 10}px,${height / 2}px) rotate(180deg)`)
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
    .attr("y", -margin.top / 2 + 10)
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
    name: layerName,
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
    container: mountNode,
    mainLayer,
    layersByName: { [layerName]: mainLayer },
  };
}
