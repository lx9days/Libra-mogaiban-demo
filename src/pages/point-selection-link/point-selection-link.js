import * as d3 from "d3";
import Libra from "libra-vis";
import LibraManager from "../../core/LibraManager";
import { compileDSL } from "../../scripts/dsl-compiler";

const MARGIN = { top: 10, right: 10, bottom: 50, left: 50 };
const WIDTH = 800 - MARGIN.left - MARGIN.right;
const HEIGHT = 800 - MARGIN.top - MARGIN.bottom;
const TICK_COUNT = 5;

export default async function init() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;
  container.innerHTML = "";

  const raw = await d3.csv("/public/data/bezdekIris.csv");
  const fields = ["sepal_length", "sepal_width", "petal_length", "petal_width"];
  const data = raw.map((d) => {
    const r = { ...d };
    for (const f of fields) r[f] = parseFloat(d[f]);
    return r;
  });

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr("viewBox", `0 0 ${WIDTH + MARGIN.left + MARGIN.right} ${HEIGHT + MARGIN.top + MARGIN.bottom}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  // Create layers
  const xAxisLayer = LibraManager.getOrCreateLayer(svg, "xAxisLayer", WIDTH + MARGIN.left + MARGIN.right, MARGIN.bottom, 0, HEIGHT + MARGIN.top);
  const yAxisLayer = LibraManager.getOrCreateLayer(svg, "yAxisLayer", MARGIN.left, HEIGHT + MARGIN.top + MARGIN.bottom);


  // Scales setup
  // We need global scales for reordering logic (mapping names to positions)
  const scaleX = d3.scaleBand()
    .domain(fields)
    .range([0, WIDTH])
    .padding(0.05);

  const scaleY = d3.scaleBand()
    .domain(fields)
    .range([0, HEIGHT])
    .padding(0.05);

  const color = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(data.map((d) => d.class))))
    .range(d3.schemeTableau10);

  const cellLayers = renderSPLOM(svg, xAxisLayer, yAxisLayer, data, fields, scaleX, scaleY, color);
  // Mount interaction
  await mountInteraction(svg, xAxisLayer, yAxisLayer, fields, scaleX, scaleY, color, data, cellLayers);
}

function renderSPLOM(svg, xAxisLayer, yAxisLayer, data, fields, scaleX, scaleY, color) {
  // Clear layers
  d3.select(xAxisLayer.getGraphic()).selectAll("*").remove();
  d3.select(yAxisLayer.getGraphic()).selectAll("*").remove();

  const cellWidth = scaleX.bandwidth();
  const cellHeight = scaleY.bandwidth();
  const cellClipPadding = 10;
  const defs = svg.selectAll("defs#splom-defs").data([null]).join("defs").attr("id", "splom-defs");
  const xAxisG = d3.select(xAxisLayer.getGraphic()).append("g")
    .attr("transform", `translate(${MARGIN.left},0)`);
  const yAxisG = d3.select(yAxisLayer.getGraphic()).append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
  const cellLayers = {};

  // Compute local scales for each dimension
  const xScales = {};
  const yScales = {};
  fields.forEach(f => {
    xScales[f] = d3.scaleLinear()
      .domain(d3.extent(data, d => d[f]))
      .range([0, cellWidth])
      .nice(TICK_COUNT);
    yScales[f] = d3.scaleLinear()
      .domain(d3.extent(data, d => d[f]))
      .range([cellHeight, 0])
      .nice(TICK_COUNT);
  });

  fields.forEach((xiField) => {
    const cellOffsetX = scaleX(xiField);

    // Draw X Axis labels (only at bottom of the whole chart or per column)
    // In SPLOM, typically labels are on diagonal or outside. 
    // Following original code logic: labels at bottom of the last row
    xAxisG.append("text")
      .text(xiField)
      .attr("class", "col-label") // Added class for easier selection if needed
      .attr("x", cellOffsetX + cellWidth / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px");

    fields.forEach((yiField) => {
      const cellOffsetY = scaleY(yiField);

      const layerName = `cell-${xiField}-${yiField}`;
      const cellLayer = LibraManager.getOrCreateLayer(
        svg,
        layerName,
        cellWidth,
        cellHeight,
        MARGIN.left + cellOffsetX,
        MARGIN.top + cellOffsetY
      );
      cellLayers[layerName] = cellLayer;
      const cell = d3.select(cellLayer.getGraphic());
      cell.selectAll("*").remove();

      // Draw frame
      cell.append("rect")
        .attr("width", cellWidth)
        .attr("height", cellHeight)
        .attr("fill", "none")
        .attr("stroke", "#ddd");

      // Draw points
      const localX = xScales[xiField];
      const localY = yScales[yiField];

      const drawCell = (sX, sY) => {
        const lx = sX || localX;
        const ly = sY || localY;
        const clipId = `splom-clip-${layerName}`;
        const clipPath = defs.selectAll(`clipPath#${clipId}`).data([null]).join("clipPath").attr("id", clipId);
        clipPath.selectAll("rect")
          .data([null])
          .join("rect")
          .attr("x", -cellClipPadding)
          .attr("y", -cellClipPadding)
          .attr("width", cellWidth + cellClipPadding * 2)
          .attr("height", cellHeight + cellClipPadding * 2);

        cell.selectAll("*").remove();
        cell.append("rect")
          .attr("width", cellWidth)
          .attr("height", cellHeight)
          .attr("fill", "none")
          .attr("stroke", "#ddd");

        const pointsG = cell.append("g").attr("clip-path", `url(#${clipId})`);
        pointsG.selectAll("circle")
          .data(data)
          .join("circle")
          .attr("r", 3)
          .attr("cx", (d) => lx(d[xiField]))
          .attr("cy", (d) => ly(d[yiField]))
          .attr("fill", (d) => color(d.class))
          .attr("fill-opacity", 0.7);

        const axesG = cell.append("g");
        axesG.append("g")
          .attr("transform", `translate(0,${cellHeight})`)
          .call(d3.axisBottom(lx).ticks(3).tickSize(3));
        axesG.append("g").call(d3.axisLeft(ly).ticks(3).tickSize(3));
      };

      drawCell(localX, localY);

    });
  });

  // Draw Y Axis labels
  fields.forEach((yiField) => {
    const cellOffsetY = scaleY(yiField);
    yAxisG.append("text")
      .text(yiField)
      .attr("class", "row-label") // Added class for easier selection
      .attr("x", -40)
      .attr("y", cellOffsetY + cellHeight / 2)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px")
      .attr("transform", `rotate(-90, -40, ${cellOffsetY + cellHeight / 2})`);
  });
  return cellLayers;
}


async function mountInteraction(svg, xAxisLayer, yAxisLayer, names, scaleX, scaleY, color, data, cellLayers) {
  const cellWidth = scaleX.bandwidth();
  const cellHeight = scaleY.bandwidth();
  const xScales = {};
  const yScales = {};
  names.forEach((f) => {
    xScales[f] = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d[f]))
      .range([0, cellWidth])
      .nice(TICK_COUNT);
    yScales[f] = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d[f]))
      .range([cellHeight, 0])
      .nice(TICK_COUNT);
  });

  const interactions = [

  ];
  const pointSelectionInteractions = Object.keys(cellLayers)
    .map((layerName) => {
      const match = /^cell-(.+?)-(.+)$/.exec(layerName);
      if (!match) return null;
      const xiField = match[1];
      const yiField = match[2];
      const sx = xScales[xiField];
      const sy = yScales[yiField];
      if (!sx || !sy) return null;
      return {
        instrument: "pointSelection",
        trigger: {
          type: "hover",
          priority: 2,
          stopPropagation: true,
        },
        target: {
          layer: layerName,
        },
        feedback: {
          redrawFunc: {
            highlight: "#00ff1aff",
          },
          context: {
            link: {
              layers: Object.values(cellLayers),
              matchMode: "datum",
              defaultOpacity: 0.7,
              baseOpacity: 0.08,
              selectedOpacity: 0.95,
              strokeWidth: 1,
            },
            scaleX: sx,
            scaleY: sy,
          },
        },
      };
    })
    .filter(Boolean);
  await compileDSL(
    interactions.concat(pointSelectionInteractions),
    {
      layersByName: { xAxisLayer, yAxisLayer, ...cellLayers },
    },
    { execute: true }
  );

  await Libra.createHistoryTrack();
}
