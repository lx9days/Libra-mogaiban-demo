import * as d3 from "d3";

const WIDTH = 760;
const HEIGHT = 500;
const MAX_LABELS = 14;
const LENS_RADIUS = 62;

let root = null;
let leaves = [];
let color = null;
let svg = null;
let viewportRoot = null;
let labelsRoot = null;
let overlayRoot = null;
let zoomTransform = d3.zoomIdentity;
let hoverPoint = null;
let hoveredIds = new Set();

export default async function init() {
  await loadData();
  renderScene();
  renderTreemap();
  installInteractions();
  applyZoom();
}

async function loadData() {
  let data = null;
  try {
    data = await d3.json("/public/data/flare-2.json");
  } catch (error) {
    data = await d3.json("/data/flare-2.json");
  }

  root = d3
    .hierarchy(data)
    .sum((d) => d.value || 0)
    .sort((a, b) => b.value - a.value);

  root.children?.forEach((node, index) => {
    node.groupId = index;
    node.each((child) => {
      child.groupId = index;
    });
  });

  d3.treemap().size([WIDTH, HEIGHT]).paddingOuter(8).paddingInner(2)(root);
  leaves = root.leaves().map((node) => ({
    ...node,
    id: node.data.name,
    center: [(node.x0 + node.x1) / 2, (node.y0 + node.y1) / 2],
  }));

  color = d3
    .scaleOrdinal()
    .domain((root.children || []).map((node) => node.groupId))
    .range(d3.schemeTableau10);
}

function renderScene() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;
  container.innerHTML = "";
  zoomTransform = d3.zoomIdentity;
  hoverPoint = null;
  hoveredIds = new Set();

  d3.select(container)
    .append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "baseline")
    .style("gap", "20px")
    .style("margin-bottom", "12px")
    .html(`
      <div>
        <div style="font:700 26px/1.1 Iowan Old Style, Palatino Linotype, serif;color:#1f2937;">Treemap: Excentric Labeling + Semantic Zoom</div>
        <div style="margin-top:6px;font:14px/1.45 system-ui;color:#556070;">
          Wheel and drag zoom the treemap itself. Hover any dense region to reveal excentric labels in screen space.
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span style="padding:6px 10px;border-radius:999px;background:#eef6ff;color:#2563eb;font:600 12px/1 system-ui;">Zoom treemap</span>
        <span style="padding:6px 10px;border-radius:999px;background:#eefaf5;color:#047857;font:600 12px/1 system-ui;">Hover for excentric labels</span>
      </div>
    `);

  svg = d3
    .select(container)
    .append("svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
    .style("background", "#fbfcfd")
    .style("border", "1px solid #d7dde5")
    .style("border-radius", "22px")
    .style("box-shadow", "0 14px 34px rgba(15, 23, 42, 0.08)")
    .style("cursor", "grab");

  svg
    .append("rect")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .attr("fill", "#fbfcfd");

  viewportRoot = svg.append("g").attr("class", "treemap-viewport");
  labelsRoot = viewportRoot.append("g").attr("class", "treemap-labels");
  overlayRoot = svg.append("g").attr("class", "treemap-overlay").style("pointer-events", "none");
}

function renderTreemap() {
  viewportRoot
    .selectAll("rect.cell")
    .data(leaves, (d) => d.id)
    .join("rect")
    .attr("class", "cell")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("width", (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0))
    .attr("rx", 2)
    .attr("fill", (d) => color(d.groupId))
    .attr("fill-opacity", 0.78)
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1);

  labelsRoot
    .selectAll("g.base-label")
    .data(leaves, (d) => d.id)
    .join((enter) => {
      const group = enter.append("g").attr("class", "base-label");
      group.append("text").attr("class", "name");
      group.append("text").attr("class", "value");
      return group;
    })
    .each(function(d) {
      const group = d3.select(this);
      group.attr("transform", `translate(${d.x0 + 6}, ${d.y0 + 15})`);
      group
        .select("text.name")
        .attr("fill", "#0f172a")
        .style("font", "600 11px system-ui")
        .text(d.data.name);
      group
        .select("text.value")
        .attr("y", 14)
        .attr("fill", "#475569")
        .style("font", "500 10px system-ui")
        .text(d.value >= 1000 ? d3.format(".2s")(d.value) : String(d.value || ""));
    });
}

function installInteractions() {
  const zoomBehavior = d3
    .zoom()
    .scaleExtent([1, 6])
    .translateExtent([
      [-WIDTH, -HEIGHT],
      [WIDTH * 2, HEIGHT * 2],
    ])
    .on("start", () => {
      svg.style("cursor", "grabbing");
    })
    .on("zoom", (event) => {
      zoomTransform = event.transform;
      applyZoom();
      renderOverlay();
    })
    .on("end", () => {
      svg.style("cursor", "grab");
    });

  svg.call(zoomBehavior).on("dblclick.zoom", null);

  svg.on("pointermove", (event) => {
    hoverPoint = d3.pointer(event, svg.node());
    renderOverlay();
  });

  svg.on("pointerleave", () => {
    hoverPoint = null;
    hoveredIds = new Set();
    renderOverlay();
    applyHighlight();
  });
}

function applyZoom() {
  viewportRoot.attr("transform", zoomTransform.toString());

  labelsRoot.selectAll("g.base-label").each(function(d) {
    const screenWidth = (d.x1 - d.x0) * zoomTransform.k;
    const screenHeight = (d.y1 - d.y0) * zoomTransform.k;
    const group = d3.select(this);
    const showName =
      (zoomTransform.k < 1.5 && screenWidth > 92 && screenHeight > 34) ||
      (zoomTransform.k >= 1.5 && zoomTransform.k < 2.5 && screenWidth > 64 && screenHeight > 24) ||
      (zoomTransform.k >= 2.5 && screenWidth > 34 && screenHeight > 18);
    const showValue = zoomTransform.k >= 2.25 && screenWidth > 70 && screenHeight > 34;

    group.attr("display", showName ? null : "none");
    group.select("text.value").attr("display", showValue ? null : "none");
  });

  applyHighlight();
}

function renderOverlay() {
  overlayRoot.selectAll("*").remove();
  if (!hoverPoint) return;

  const candidates = leaves
    .map((leaf) => {
      const center = zoomTransform.apply(leaf.center);
      const dx = center[0] - hoverPoint[0];
      const dy = center[1] - hoverPoint[1];
      return {
        leaf,
        center,
        distance: Math.hypot(dx, dy),
      };
    })
    .filter(({ leaf, center, distance }) => {
      const screenWidth = (leaf.x1 - leaf.x0) * zoomTransform.k;
      const screenHeight = (leaf.y1 - leaf.y0) * zoomTransform.k;
      return (
        distance <= LENS_RADIUS &&
        center[0] >= 0 &&
        center[0] <= WIDTH &&
        center[1] >= 0 &&
        center[1] <= HEIGHT &&
        screenWidth > 8 &&
        screenHeight > 8
      );
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_LABELS);

  hoveredIds = new Set(candidates.map(({ leaf }) => leaf.id));
  applyHighlight();

  if (!candidates.length) return;

  overlayRoot
    .append("circle")
    .attr("cx", hoverPoint[0])
    .attr("cy", hoverPoint[1])
    .attr("r", LENS_RADIUS)
    .attr("fill", "rgba(15, 118, 110, 0.04)")
    .attr("stroke", "#0f766e")
    .attr("stroke-width", 1.6);

  const left = candidates
    .filter(({ center }) => center[0] < hoverPoint[0])
    .sort((a, b) => a.center[1] - b.center[1]);
  const right = candidates
    .filter(({ center }) => center[0] >= hoverPoint[0])
    .sort((a, b) => a.center[1] - b.center[1]);

  drawExcentricSide(left, "left");
  drawExcentricSide(right, "right");
}

function drawExcentricSide(items, side) {
  if (!items.length) return;

  const labelWidth = 180;
  const labelHeight = 22;
  const gap = 8;
  const stackHeight = items.length * labelHeight + (items.length - 1) * gap;
  const startY = clamp(hoverPoint[1] - stackHeight / 2, 18, HEIGHT - stackHeight - 18);
  const boxX = side === "left" ? hoverPoint[0] - LENS_RADIUS - 18 - labelWidth : hoverPoint[0] + LENS_RADIUS + 18;
  const lineAnchorX = side === "left" ? boxX + labelWidth : boxX;

  const group = overlayRoot.append("g").attr("class", `side-${side}`);
  const lineGroup = group.append("g").attr("class", "label-lines");
  lineGroup
    .selectAll("path")
    .data(items, (d) => d.leaf.id)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d) => color(d.leaf.groupId))
    .attr("stroke-width", 1.4)
    .attr("d", (d, index) => {
      const targetY = startY + index * (labelHeight + gap) + labelHeight / 2;
      const x0 = d.center[0];
      const y0 = d.center[1];
      const x1 = lineAnchorX;
      const midX = side === "left" ? x1 + 16 : x1 - 16;
      return `M${x0},${y0} C${midX},${y0} ${midX},${targetY} ${x1},${targetY}`;
    });

  const row = group
    .selectAll("g.label-row")
    .data(items, (d) => d.leaf.id)
    .join("g")
    .attr("class", "label-row")
    .attr("transform", (_, index) => `translate(${boxX}, ${startY + index * (labelHeight + gap)})`);

  row
    .append("rect")
    .attr("width", labelWidth)
    .attr("height", labelHeight)
    .attr("rx", 8)
    .attr("fill", "rgba(255, 255, 255, 0.92)")
    .attr("stroke", (d) => color(d.leaf.groupId))
    .attr("stroke-width", 1.1);

  row
    .append("text")
    .attr("x", side === "left" ? labelWidth - 10 : 10)
    .attr("y", 14)
    .attr("text-anchor", side === "left" ? "end" : "start")
    .attr("fill", "#0f172a")
    .style("font", "600 11px system-ui")
    .text((d) => formatLabel(d.leaf));
}

function applyHighlight() {
  viewportRoot
    .selectAll("rect.cell")
    .attr("fill-opacity", (d) => {
      if (!hoveredIds.size) return 0.78;
      return hoveredIds.has(d.id) ? 0.96 : 0.24;
    })
    .attr("stroke", (d) => (hoveredIds.has(d.id) ? "#0f172a" : "#ffffff"))
    .attr("stroke-width", (d) => (hoveredIds.has(d.id) ? 1.8 / zoomTransform.k : 1 / zoomTransform.k));
}

function formatLabel(leaf) {
  if (zoomTransform.k >= 2.25) {
    return `${leaf.data.name} · ${d3.format(".2s")(leaf.value)}`;
  }
  return leaf.data.name;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
