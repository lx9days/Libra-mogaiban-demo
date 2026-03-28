import * as d3 from "d3";
import Libra from "libra-vis";
import LibraManager from "../../core/LibraManager";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

const MARGIN = { top: 54, right: 136, bottom: 56, left: 218 };
const WIDTH = 1080 - MARGIN.left - MARGIN.right;
const HEIGHT = 620 - MARGIN.top - MARGIN.bottom;
const MAX_DIVISIONS = 8;
const YEARS_TO_SHOW = 8;
const BRUSH_COLOR = "#0f766e";
const BASE_STROKE = "#5b6474";
const GRID_COLOR = "#d7dde5";
const TREND_STROKE = "#94a3b8";

let data = [];
let order = [];
let scales = null;
let layersByName = {};

export default async function init() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;
  container.innerHTML = "";

  renderHeading(container);
  const loaded = await loadData();
  data = loaded.data;
  order = loaded.topics.slice();
  scales = createScales(order, loaded.dateExtent, loaded.unempExtent);
  interactions = buildInteractions();

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr("viewBox", `0 0 ${WIDTH + MARGIN.left + MARGIN.right} ${HEIGHT + MARGIN.top + MARGIN.bottom}`);

  layersByName = createLayers(svg);
  renderAll();
  await mountInteractions();
}

function renderHeading(container) {
  const shell = d3
    .select(container)
    .append("div")
    .style("display", "flex")
    .style("align-items", "baseline")
    .style("justify-content", "space-between")
    .style("gap", "24px")
    .style("margin", "0 0 12px 0")
    .style("font-family", "Iowan Old Style, Palatino Linotype, serif");

  shell
    .append("div")
    .html(`
      <div style="font-size:26px;font-weight:700;color:#1f2937;">Categorical Axis: Reorder + Brush</div>
      <div style="margin-top:6px;font-size:14px;color:#5b6474;">
        Libra DSL version: a reordering rule targets the category axis layer, and a group-selection rule targets the plot layer.
      </div>
    `);

  shell
    .append("div")
    .style("display", "flex")
    .style("gap", "8px")
    .style("flex-wrap", "wrap")
    .html(`
      <span style="padding:6px 10px;border-radius:999px;background:#eef6f4;color:#0f766e;font:600 12px/1.1 system-ui;">Drag labels</span>
      <span style="padding:6px 10px;border-radius:999px;background:#f4f5f7;color:#4b5563;font:600 12px/1.1 system-ui;">Brush circles</span>
    `);
}

async function loadData() {
  let rawData = null;
  try {
    rawData = await d3.csv("/public/data/bls-metro-unemployment.csv");
  } catch (error) {
    rawData = await d3.csv("/data/bls-metro-unemployment.csv");
  }

  const parseDate = d3.timeParse("%Y-%m-%d");
  const normalized = rawData
    .map((d) => {
      const parsedDate = parseDate(d.date);
      return {
        id: `${d.division}-${d.date}`,
        division: String(d.division || "")
          .replace(", Met Div", "")
          .replace(", MS Met Div", "")
          .trim(),
        date: parsedDate,
        year: parsedDate?.getFullYear(),
        unemployment: Number(d.unemployment),
      };
    })
    .filter((d) => d.date && d.division && Number.isFinite(d.unemployment));

  const maxYear = d3.max(normalized, (d) => d.year) ?? 0;
  const recentRows = normalized.filter((d) => d.year >= maxYear - (YEARS_TO_SHOW - 1));

  const topics = d3
    .rollups(
      recentRows,
      (rows) => ({
        mean: d3.mean(rows, (d) => d.unemployment) ?? 0,
        deviation: d3.deviation(rows, (d) => d.unemployment) ?? 0,
      }),
      (d) => d.division,
    )
    .sort((a, b) => (b[1].mean + b[1].deviation) - (a[1].mean + a[1].deviation))
    .slice(0, MAX_DIVISIONS)
    .map(([division]) => division)
    .sort(d3.ascending);

  const topicSet = new Set(topics);
  const data = d3
    .rollups(
      recentRows.filter((d) => topicSet.has(d.division)),
      (rows) => d3.mean(rows, (d) => d.unemployment) ?? 0,
      (d) => d.division,
      (d) => d.year,
    )
    .flatMap(([division, years]) =>
      years.map(([year, unemployment]) => ({
        id: `${division}-${year}`,
        division,
        year,
        date: new Date(year, 0, 1),
        unemployment,
      })),
    );

  return {
    data,
    topics,
    dateExtent: d3.extent(data, (d) => d.date),
    unempExtent: d3.extent(data, (d) => d.unemployment),
  };
}

function createScales(topics, dateExtent, unempExtent) {
  return {
    x: d3.scaleTime().domain(dateExtent).range([0, WIDTH]),
    y: d3.scaleBand().domain(topics).range([0, HEIGHT]).padding(0.34),
    radius: d3.scaleSqrt().domain([0, unempExtent[1] ?? 0]).range([4, 17]),
    color: d3.scaleSequential(d3.interpolateYlOrRd).domain(unempExtent),
    reorderX: d3.scaleBand().domain(topics).range([0, topics.length]).padding(0),
  };
}

function createLayers(svg) {
  const annotationLayer = LibraManager.getOrCreateLayer(
    svg,
    "annotationLayer",
    WIDTH + MARGIN.left + MARGIN.right,
    MARGIN.top,
  );
  const yAxisLayer = LibraManager.getOrCreateLayer(
    svg,
    "yAxisLayer",
    MARGIN.left,
    HEIGHT,
    0,
    MARGIN.top,
  );
  const trendLayer = LibraManager.getOrCreateLayer(
    svg,
    "trendLayer",
    WIDTH,
    HEIGHT,
    MARGIN.left,
    MARGIN.top,
  );
  const plotLayer = LibraManager.getOrCreateLayer(
    svg,
    "plotLayer",
    WIDTH,
    HEIGHT,
    MARGIN.left,
    MARGIN.top,
  );
  const xAxisLayer = LibraManager.getOrCreateLayer(
    svg,
    "xAxisLayer",
    WIDTH + MARGIN.left + MARGIN.right,
    MARGIN.bottom,
    0,
    MARGIN.top + HEIGHT,
  );
  const legendLayer = LibraManager.getOrCreateLayer(
    svg,
    "legendLayer",
    MARGIN.right,
    HEIGHT + MARGIN.top,
    MARGIN.left + WIDTH,
    0,
  );

  return {
    annotationLayer,
    yAxisLayer,
    trendLayer,
    plotLayer,
    xAxisLayer,
    legendLayer,
  };
}

function renderAll() {
  renderAnnotation();
  renderYAxis();
  renderTrendLayer();
  renderPlotLayer();
  renderXAxis();
  renderLegend();
}

function renderAnnotation() {
  const root = d3.select(layersByName.annotationLayer.getGraphic());
  root.selectAll("*").remove();

  root
    .append("text")
    .attr("x", MARGIN.left)
    .attr("y", MARGIN.top - 16)
    .attr("fill", "#334155")
    .style("font", "700 13px system-ui")
    .text("Metro division");

  root
    .append("text")
    .attr("x", MARGIN.left + 140)
    .attr("y", MARGIN.top - 16)
    .attr("fill", "#64748b")
    .style("font", "12px system-ui")
    .text("Each row is a division. X is year. Circle size and selected fill encode unemployment.");

  root
    .append("text")
    .attr("x", MARGIN.left + WIDTH + 10)
    .attr("y", MARGIN.top - 16)
    .attr("fill", "#334155")
    .style("font", "700 12px system-ui")
    .text("Latest");
}

function renderYAxis() {
  const root = d3.select(layersByName.yAxisLayer.getGraphic());
  root.selectAll("*").remove();

  root
    .selectAll("g.axis-row")
    .data(order, (d) => d)
    .join((enter) => {
      const row = enter.append("g").attr("class", "axis-row");
      row.append("rect").attr("class", "row-hit");
      row.append("text").attr("class", "row-label");
      return row;
    })
    .attr("transform", (topic) => `translate(0, ${(scales.y(topic) ?? 0) + scales.y.bandwidth() / 2})`)
    .each(function(topic) {
      const row = d3.select(this);
      row
        .select("rect.row-hit")
        .attr("x", 12)
        .attr("y", -scales.y.bandwidth() / 2)
        .attr("width", MARGIN.left - 30)
        .attr("height", scales.y.bandwidth())
        .attr("rx", 10)
        .attr("fill", "rgba(255,255,255,0.001)");

      row
        .select("text.row-label")
        .attr("x", MARGIN.left - 18)
        .attr("y", 5)
        .attr("text-anchor", "end")
        .attr("fill", "#1f2937")
        .style("font", "600 13px system-ui")
        .text(topic);
    });
}

function renderTrendLayer() {
  const root = d3.select(layersByName.trendLayer.getGraphic());
  root.selectAll("*").remove();

  root
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .attr("rx", 18)
    .attr("fill", "#fbfcfd");

  const rows = root
    .selectAll("g.row-trend")
    .data(order, (d) => d)
    .join("g")
    .attr("class", "row-trend")
    .attr("transform", (topic) => `translate(0, ${(scales.y(topic) ?? 0) + scales.y.bandwidth() / 2})`);

  rows
    .append("line")
    .attr("x1", 0)
    .attr("x2", WIDTH)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", GRID_COLOR)
    .attr("stroke-width", 1.2)
    .attr("stroke-dasharray", "3 5");

  rows
    .append("path")
    .attr("fill", "none")
    .attr("stroke", TREND_STROKE)
    .attr("stroke-width", 1.2)
    .attr("stroke-opacity", 0.75)
    .attr(
      "d",
      (topic) =>
        d3
          .line()
          .x((d) => scales.x(d.date))
          .y(() => 0)(
          data
            .filter((d) => d.division === topic)
            .sort((a, b) => d3.ascending(a.date, b.date)),
        ),
    );

  rows
    .append("text")
    .attr("x", WIDTH + 10)
    .attr("y", 5)
    .attr("fill", "#556070")
    .style("font", "600 12px system-ui")
    .text((topic) => {
      const latest = data
        .filter((d) => d.division === topic)
        .sort((a, b) => d3.ascending(a.date, b.date))
        .at(-1);
      return latest ? `${latest.unemployment.toFixed(1)}%` : "";
    });
}

function renderPlotLayer() {
  const root = d3.select(layersByName.plotLayer.getGraphic());
  root.selectAll("*").remove();

  root
    .selectAll("circle.dot")
    .data(data, (d) => d.id)
    .join("circle")
    .attr("class", "dot mark")
    .attr("cx", (d) => scales.x(d.date))
    .attr("cy", (d) => (scales.y(d.division) ?? 0) + scales.y.bandwidth() / 2)
    .attr("r", (d) => scales.radius(d.unemployment))
    .attr("fill", "#ffffff")
    .attr("fill-opacity", 0)
    .attr("stroke", BASE_STROKE)
    .attr("stroke-width", 1.2)
    .attr("stroke-opacity", 0.58)
    .append("title")
    .text((d) => `${d.division}\n${d.year}: ${d.unemployment.toFixed(1)}%`);
}

function renderXAxis() {
  const root = d3.select(layersByName.xAxisLayer.getGraphic());
  root.selectAll("*").remove();

  root
    .append("g")
    .attr("transform", `translate(${MARGIN.left}, 0)`)
    .call(d3.axisBottom(scales.x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("'%y")))
    .call((g) => g.select(".domain").attr("stroke", "#94a3b8"))
    .call((g) => g.selectAll("line").attr("stroke", "#94a3b8"))
    .selectAll("text")
    .attr("fill", "#475569")
    .style("font", "12px system-ui");

  root
    .append("text")
    .attr("x", MARGIN.left + WIDTH / 2)
    .attr("y", 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#334155")
    .style("font", "700 13px system-ui")
    .text("Year");
}

function renderLegend() {
  const root = d3.select(layersByName.legendLayer.getGraphic());
  root.selectAll("*").remove();

  const defs = d3.select("svg defs#categorical-axis-gradient-defs");
  if (!defs.empty()) defs.remove();
  const gradientDefs = d3.select("svg").append("defs").attr("id", "categorical-axis-gradient-defs");
  const gradient = gradientDefs
    .append("linearGradient")
    .attr("id", "categorical-axis-gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "0%")
    .attr("y2", "100%");

  gradient
    .selectAll("stop")
    .data(d3.range(0, 1.01, 0.1))
    .join("stop")
    .attr("offset", (d) => `${d * 100}%`)
    .attr("stop-color", (d) =>
      scales.color((1 - d) * (scales.color.domain()[1] - scales.color.domain()[0]) + scales.color.domain()[0]),
    );

  const legendWidth = 12;
  const legendHeight = 216;

  root
    .append("text")
    .attr("x", 26)
    .attr("y", MARGIN.top - 14)
    .attr("fill", "#334155")
    .style("font", "600 12px system-ui")
    .text("Avg. unemployment");

  root
    .append("rect")
    .attr("x", 26)
    .attr("y", MARGIN.top)
    .attr("rx", 6)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#categorical-axis-gradient)");

  root
    .append("g")
    .attr("transform", `translate(${26 + legendWidth + 6}, ${MARGIN.top})`)
    .call(d3.axisRight(d3.scaleLinear().domain(scales.color.domain()).range([legendHeight, 0])).ticks(5).tickFormat((d) => `${d}%`))
    .call((g) => g.select(".domain").remove())
    .selectAll("text")
    .style("font", "12px system-ui")
    .attr("fill", "#4b5563");

  root
    .append("text")
    .attr("x", 26)
    .attr("y", MARGIN.top + legendHeight + 24)
    .attr("fill", "#64748b")
    .style("font", "12px system-ui")
    .text("Circle size + selected fill");

  root
    .append("text")
    .attr("x", 26)
    .attr("y", MARGIN.top + legendHeight + 40)
    .attr("fill", "#64748b")
    .style("font", "12px system-ui")
    .text("encode unemployment");
}

async function mountInteractions() {
  const interactions = [
    {
      instrument: "reordering",
      trigger: {
        type: "drag",
      },
      target: {
        layer: "yAxisLayer",
      },
      feedback: {
        geometry: {
          direction: "y",
        },
        redrawRef: (newNames, _newX, newY) => {
          order = newNames.slice();
          scales.y = newY || scales.y;
          renderAll();
        },
        contextRef: {
          names: order,
          scales: { x: scales.reorderX, y: scales.y },
          copyFrom: [layersByName.yAxisLayer, layersByName.trendLayer, layersByName.plotLayer],
          offset: { x: 0, y: 0 },
        },
      },
      priority: 2,
      stopPropagation: true,
    },
    {
      instrument: "group selection",
      trigger: {
        type: "brush",
      },
      target: {
        layer: "plotLayer",
      },
      feedback: {
        selection: {
          dim: {
            opacity: 0.14,
            selector: ".dot",
          },
          highlight: {
            fill: (d) => scales.color(d.unemployment),
            stroke: (d) => scales.color(d.unemployment),
            "fill-opacity": 0.95,
            "stroke-opacity": 1,
            "stroke-width": 1.2,
          },
          brushStyle: {
            fill: BRUSH_COLOR,
            opacity: 0.08,
            stroke: BRUSH_COLOR,
            "stroke-width": 1.5,
            "stroke-dasharray": "6 4",
          },
        },
      },
      priority: 1,
      stopPropagation: true,
    },
  ];

  await compileInteractionsDSL(interactions, { layersByName });

  const selectionLayer = layersByName.plotLayer.getLayerFromQueue?.("selectionLayer");
  const transientLayer = layersByName.plotLayer.getLayerFromQueue?.("transientLayer");
  if (selectionLayer?.getGraphic) d3.select(selectionLayer.getGraphic()).style("pointer-events", "none");
  if (transientLayer?.getGraphic) d3.select(transientLayer.getGraphic()).style("pointer-events", "none");
  await Libra.createHistoryTrack?.();
}
