import * as d3 from "d3";

const MARGIN = { top: 54, right: 136, bottom: 56, left: 218 };
const WIDTH = 1080 - MARGIN.left - MARGIN.right;
const HEIGHT = 620 - MARGIN.top - MARGIN.bottom;
const MAX_DIVISIONS = 8;
const YEARS_TO_SHOW = 8;
const BRUSH_COLOR = "#0f766e";
const BASE_STROKE = "#5b6474";
const GRID_COLOR = "#d7dde5";

let svg = null;
let plotRoot = null;
let xAxisRoot = null;
let legendRoot = null;
let rowsRoot = null;
let brushRoot = null;

let order = [];
let dragState = null;
let brushedIds = new Set();
let data = [];
let rowsByDivision = new Map();
let scales = null;
let annotationRoot = null;

export default async function init() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;
  container.innerHTML = "";

  renderHeading(container);
  const loaded = await loadData();
  data = loaded.data;
  order = loaded.topics.slice();
  rowsByDivision = d3.group(data, (d) => d.division);
  scales = createScales(order, loaded.dateExtent, loaded.unempExtent);

  svg = d3
    .select(container)
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr("viewBox", `0 0 ${WIDTH + MARGIN.left + MARGIN.right} ${HEIGHT + MARGIN.top + MARGIN.bottom}`);

  setupScene();
  renderLegend();
  renderChart();
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
        Drag a single row from the category axis to reorder it. Brush within the plot to switch selected marks from hollow outlines to filled highlights.
      </div>
    `);

  shell
    .append("div")
    .style("display", "flex")
    .style("gap", "8px")
    .style("flex-wrap", "wrap")
    .html(`
      <span style="padding:6px 10px;border-radius:999px;background:#eef6f4;color:#0f766e;font:600 12px/1.1 system-ui;">Drag one row</span>
      <span style="padding:6px 10px;border-radius:999px;background:#f4f5f7;color:#4b5563;font:600 12px/1.1 system-ui;">Brush to fill-highlight</span>
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
  };
}

function setupScene() {
  const defs = svg.append("defs");
  defs
    .append("clipPath")
    .attr("id", "categorical-axis-clip")
    .append("rect")
    .attr("width", WIDTH)
    .attr("height", HEIGHT);

  plotRoot = svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left}, ${MARGIN.top})`);

  plotRoot
    .append("rect")
    .attr("x", -12)
    .attr("y", -16)
    .attr("width", WIDTH + 24)
    .attr("height", HEIGHT + 32)
    .attr("rx", 18)
    .attr("fill", "#fbfcfd");

  xAxisRoot = svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left}, ${MARGIN.top + HEIGHT + 8})`);

  legendRoot = svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left + WIDTH + 26}, ${MARGIN.top})`);

  annotationRoot = svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left}, ${MARGIN.top})`);

  rowsRoot = plotRoot.append("g").attr("class", "rows-root");
  brushRoot = plotRoot.append("g").attr("class", "brush-root");

  const brush = d3
    .brush()
    .extent([
      [0, 0],
      [WIDTH, HEIGHT],
    ])
    .on("brush end", brushed);

  brushRoot.call(brush);
  brushRoot.selectAll(".overlay").attr("cursor", "crosshair");
  brushRoot
    .selectAll(".selection")
    .attr("fill", BRUSH_COLOR)
    .attr("fill-opacity", 0.08)
    .attr("stroke", BRUSH_COLOR)
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "6 4");

  brushRoot.selectAll(".handle").attr("fill", BRUSH_COLOR).attr("fill-opacity", 0.16);
}

function renderLegend() {
  legendRoot.selectAll("*").remove();

  const legendWidth = 12;
  const legendHeight = 216;
  const defs = svg.append("defs").attr("id", "categorical-axis-legend-defs");
  const gradient = defs
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

  legendRoot
    .append("text")
    .attr("x", -4)
    .attr("y", -14)
    .attr("fill", "#334155")
    .style("font", "600 12px system-ui")
    .text("Avg. unemployment");

  legendRoot
    .append("rect")
    .attr("rx", 6)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#categorical-axis-gradient)");

  legendRoot
    .append("g")
    .attr("transform", `translate(${legendWidth + 6}, 0)`)
    .call(d3.axisRight(d3.scaleLinear().domain(scales.color.domain()).range([legendHeight, 0])).ticks(5).tickFormat((d) => `${d}%`))
    .call((g) => g.select(".domain").remove())
    .selectAll("text")
    .style("font", "12px system-ui")
    .attr("fill", "#4b5563");

  legendRoot
    .append("text")
    .attr("x", -4)
    .attr("y", legendHeight + 24)
    .attr("fill", "#64748b")
    .style("font", "12px system-ui")
    .text("Circle size + selected fill");

  legendRoot
    .append("text")
    .attr("x", -4)
    .attr("y", legendHeight + 40)
    .attr("fill", "#64748b")
    .style("font", "12px system-ui")
    .text("encode unemployment");
}

function renderChart() {
  const rowHeight = scales.y.bandwidth();
  const dragBehavior = d3
    .drag()
    .on("start", dragStarted)
    .on("drag", dragged)
    .on("end", dragEnded);

  const rows = rowsRoot
    .selectAll("g.row")
    .data(order, (d) => d)
    .join((enter) => {
      const row = enter.append("g").attr("class", "row");
      row.append("line").attr("class", "track");
      row.append("rect").attr("class", "label-hit");
      row.append("text").attr("class", "label");
      row.append("g").attr("class", "dots");
      return row;
    });

  rows
    .call(dragBehavior)
    .attr("cursor", (d) => (dragState?.topic === d ? "grabbing" : "grab"))
    .each(function(topic) {
      const row = d3.select(this);
      const rowY = getRowCenter(topic);
      const active = dragState?.topic === topic;
      const dragY = active ? dragState.currentY : rowY;

      row
        .interrupt()
        .transition()
        .duration(active ? 0 : 180)
        .attr("transform", `translate(0, ${dragY})`);

      row.classed("is-dragging", active);

      row
        .select("line.track")
        .attr("x1", 0)
        .attr("x2", WIDTH)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", GRID_COLOR)
        .attr("stroke-width", active ? 1.8 : 1.2)
        .attr("stroke-dasharray", "3 5");

      row
        .select("rect.label-hit")
        .attr("x", -MARGIN.left + 14)
        .attr("y", -rowHeight / 2)
        .attr("width", MARGIN.left - 30)
        .attr("height", rowHeight)
        .attr("rx", 10)
        .attr("fill", active ? "rgba(15, 118, 110, 0.08)" : "transparent");

      row
        .select("text.label")
        .attr("x", -18)
        .attr("y", 5)
        .attr("text-anchor", "end")
        .attr("fill", "#1f2937")
        .style("font", active ? "700 13px system-ui" : "600 13px system-ui")
        .text(topic);

      const circles = row
        .select("g.dots")
        .attr("clip-path", "url(#categorical-axis-clip)")
        .selectAll("circle.dot")
        .data(rowsByDivision.get(topic) || [], (d) => d.id)
        .join("circle")
        .attr("class", "dot")
        .attr("cx", (d) => scales.x(d.date))
        .attr("cy", 0)
        .attr("r", (d) => scales.radius(d.unemployment))
        .style("pointer-events", "none");

      row
        .select("g.dots")
        .selectAll("path.trend")
        .data([rowsByDivision.get(topic) || []])
        .join("path")
        .attr("class", "trend")
        .attr(
          "d",
          d3
            .line()
            .x((d) => scales.x(d.date))
            .y(() => 0),
        )
        .attr("fill", "none")
        .attr("stroke", active ? "#334155" : "#94a3b8")
        .attr("stroke-width", active ? 1.8 : 1.2)
        .attr("stroke-opacity", brushedIds.size > 0 ? 0.35 : 0.7);

      circles
        .attr("fill", (d) => (brushedIds.has(d.id) ? scales.color(d.unemployment) : "#ffffff"))
        .attr("fill-opacity", (d) => (brushedIds.size === 0 ? 0 : brushedIds.has(d.id) ? 0.94 : 0))
        .attr("stroke", (d) => (brushedIds.has(d.id) ? scales.color(d.unemployment) : BASE_STROKE))
        .attr("stroke-width", 1.2)
        .attr("stroke-opacity", (d) => {
          if (brushedIds.size === 0) return 0.52;
          return brushedIds.has(d.id) ? 1 : 0.18;
        })
        .attr("opacity", (d) => {
          if (brushedIds.size === 0) return 1;
          return brushedIds.has(d.id) ? 1 : 0.22;
        });

      circles.selectAll("title").remove();
      circles
        .append("title")
        .text((d) => `${d.division}\n${d.year}: ${d.unemployment.toFixed(1)}%`);

      const latest = (rowsByDivision.get(topic) || []).slice().sort((a, b) => d3.ascending(a.date, b.date)).at(-1);
      row
        .selectAll("text.latest-value")
        .data(latest ? [latest] : [])
        .join("text")
        .attr("class", "latest-value")
        .attr("x", WIDTH + 10)
        .attr("y", 5)
        .attr("fill", active ? "#0f172a" : "#556070")
        .style("font", active ? "700 12px system-ui" : "600 12px system-ui")
        .text((d) => `${d.unemployment.toFixed(1)}%`);
    });

  xAxisRoot
    .selectAll("*")
    .remove();

  xAxisRoot
    .append("g")
    .call(d3.axisBottom(scales.x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("'%y")))
    .call((g) => g.select(".domain").attr("stroke", "#94a3b8"))
    .call((g) => g.selectAll("line").attr("stroke", "#94a3b8"))
    .selectAll("text")
    .attr("fill", "#475569")
    .style("font", "12px system-ui");

  xAxisRoot
    .append("text")
    .attr("x", WIDTH / 2)
    .attr("y", 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#334155")
    .style("font", "700 13px system-ui")
    .text("Year");

  annotationRoot.selectAll("*").remove();
  annotationRoot
    .append("text")
    .attr("x", -MARGIN.left + 18)
    .attr("y", -16)
    .attr("fill", "#334155")
    .style("font", "700 13px system-ui")
    .text("Metro division");

  annotationRoot
    .append("text")
    .attr("x", 0)
    .attr("y", -16)
    .attr("fill", "#64748b")
    .style("font", "12px system-ui")
    .text("Each row is a division. X position is year. Selected fill and circle size encode unemployment.");

  annotationRoot
    .append("text")
    .attr("x", WIDTH + 10)
    .attr("y", -16)
    .attr("fill", "#334155")
    .style("font", "700 12px system-ui")
    .text("Latest");
}

function dragStarted(event, topic) {
  const [, y] = d3.pointer(event, plotRoot.node());
  const startIndex = order.indexOf(topic);
  dragState = {
    topic,
    startIndex,
    currentY: clamp(y, 0, HEIGHT),
  };
  rowsRoot.raise();
  reorderPreview();
}

function dragged(event, topic) {
  if (!dragState || dragState.topic !== topic) return;
  const [, y] = d3.pointer(event, plotRoot.node());
  dragState.currentY = clamp(y, 0, HEIGHT);
  reorderPreview();
}

function dragEnded() {
  if (!dragState) return;
  order = computePreviewOrder();
  scales.y.domain(order);
  dragState = null;
  renderChart();
}

function reorderPreview() {
  const previewOrder = computePreviewOrder();
  scales.y.domain(previewOrder);
  renderChart();
}

function computePreviewOrder() {
  if (!dragState) return order.slice();
  const next = order.filter((topic) => topic !== dragState.topic);
  const targetIndex = clamp(
    Math.round((dragState.currentY - scales.y.bandwidth() / 2) / getRowStep()),
    0,
    next.length,
  );
  next.splice(targetIndex, 0, dragState.topic);
  return next;
}

function getRowStep() {
  const step = scales.y.step ? scales.y.step() : scales.y.bandwidth();
  return step || 1;
}

function getRowCenter(topic) {
  return (scales.y(topic) ?? 0) + scales.y.bandwidth() / 2;
}

function brushed(event) {
  const selection = event.selection;
  if (!selection) {
    brushedIds = new Set();
    renderChart();
    return;
  }

  const [[x0, y0], [x1, y1]] = selection;
  const selected = data
    .filter((d) => {
      const cx = scales.x(d.date);
      const cy = getRowCenter(d.division);
      return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
    })
    .map((d) => d.id);

  brushedIds = new Set(selected);
  renderChart();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
