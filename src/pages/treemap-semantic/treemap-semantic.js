import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

const WIDTH = 760;
const HEIGHT = 500;
const MAX_LABELS = 14;
const LENS_RADIUS = 62;

let root = null;
let leaves = [];
let color = null;
let svgRoot = null;
let mainLayer = null;
let overlayRoot = null;
let viewState = { transform: d3.zoomIdentity };
let hoveredIds = new Set();
let interactions = [];

function buildTreemapSemanticDSL() {
  return [
    {
      Name: "semanticPan",
      Instrument: "panning",
      trigger: {
        type: "pan",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        ViewTransform: {
          stateRef: viewState,
          redrawRef: redrawView,
          translateExtent: [[0, 0], [WIDTH, HEIGHT]],
        },
      },
      stopPropagation: true,
    },
    {
      Name: "semanticZoom",
      Instrument: "zooming",
      trigger: {
        type: "zoom",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        SemanticZoom: {
          stateRef: viewState,
          redrawRef: redrawView,
          scaleExtent: [1, 6],
          translateExtent: [[0, 0], [WIDTH, HEIGHT]],
          valueThreshold: 2.25,
          step: 0.16,
        },
      },
      stopPropagation: true,
    },
    {
      Name: "excentricLabels",
      Instrument: "Lens",
      trigger: {
        type: "hover",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        flow: {
          remove: [{ find: "SelectionTransformer" }],
          insert: [
            {
              find: "SelectionService",
              Operator: ({ result = [], event }) => {
                const hovered = result
                  .map((node) => d3.select(node).datum())
                  .filter(Boolean);
                hoveredIds = new Set(hovered.map((d) => d.id));
                return {
                  hovered,
                  pointer: event
                    ? d3.pointer(event, svgRoot.node())
                    : null,
                };
              },
              Renderer: (payload) => {
                applyHighlight();
                renderExcentricOverlay(payload);
              },
            },
          ],
        },
      },
      priority: 1,
      stopPropagation: false,
    },
  ];
}

export default async function init() {
  await loadData();
  interactions = buildTreemapSemanticDSL();
  renderScene();
  renderTreemap();
  await mountInteractions();
  redrawView(viewState.transform);
}

async function loadData() {
  let data = null;
  try {
    data = await d3.json("./public/data/flare-2.json");
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
  viewState = { transform: d3.zoomIdentity };
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
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span style="padding:6px 10px;border-radius:999px;background:#eef6ff;color:#2563eb;font:600 12px/1 system-ui;">DSL pan + zoom</span>
        <span style="padding:6px 10px;border-radius:999px;background:#eefaf5;color:#047857;font:600 12px/1 system-ui;">DSL lens</span>
      </div>
    `);

  svgRoot = d3
    .select(container)
    .append("svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
    .style("background", "#fbfcfd")
    .style("border", "1px solid #d7dde5")
    .style("border-radius", "22px")
    .style("box-shadow", "0 14px 34px rgba(15, 23, 42, 0.08)");

  mainLayer = Libra.Layer.initialize("D3Layer", {
    name: "mainLayer",
    width: WIDTH,
    height: HEIGHT,
    offset: { x: 0, y: 0 },
    container: svgRoot.node(),
  });

  d3.select(mainLayer.getGraphic()).attr("class", "treemap-main");
  overlayRoot = svgRoot.append("g").attr("class", "treemap-overlay").style("pointer-events", "none");
}

function renderTreemap() {
  const rootSel = d3.select(mainLayer.getGraphic());
  rootSel.selectAll("*").remove();

  rootSel
    .selectAll("rect.cell")
    .data(leaves, (d) => d.id)
    .join("rect")
    .attr("class", "cell mark")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("width", (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0))
    .attr("rx", 2)
    .attr("fill", (d) => color(d.groupId))
    .attr("fill-opacity", 0.78)
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1);

  rootSel
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

async function mountInteractions() {
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

  const labelLayer = mainLayer.getLayerFromQueue("LabelLayer");
  const lensLayer = mainLayer.getLayerFromQueue("LensLayer");
  if (labelLayer?.getGraphic) d3.select(labelLayer.getGraphic()).style("pointer-events", "none");
  if (lensLayer?.getGraphic) d3.select(lensLayer.getGraphic()).style("pointer-events", "none");

  await Libra.createHistoryTrack?.();
}

function redrawView(transform) {
  viewState.transform = transform || d3.zoomIdentity;
  d3.select(mainLayer.getGraphic()).attr("transform", viewState.transform.toString());

  const valueThreshold =
    interactions.find((rule) => String(rule.Name || "").toLowerCase() === "semanticzoom")?.Feedback?.SemanticZoom?.valueThreshold ?? 2.25;

  d3.select(mainLayer.getGraphic())
    .selectAll("g.base-label")
    .each(function(d) {
      const screenWidth = (d.x1 - d.x0) * viewState.transform.k;
      const screenHeight = (d.y1 - d.y0) * viewState.transform.k;
      const group = d3.select(this);
      const showName =
        (viewState.transform.k < 1.5 && screenWidth > 92 && screenHeight > 34) ||
        (viewState.transform.k >= 1.5 && viewState.transform.k < 2.5 && screenWidth > 64 && screenHeight > 24) ||
        (viewState.transform.k >= 2.5 && screenWidth > 34 && screenHeight > 18);
      const showValue = viewState.transform.k >= valueThreshold && screenWidth > 70 && screenHeight > 34;

      group.attr("display", showName ? null : "none");
      group.select("text.value").attr("display", showValue ? null : "none");
    });

  applyHighlight();
  renderExcentricOverlay(null);
}

function applyHighlight() {
  d3.select(mainLayer.getGraphic())
    .selectAll("rect.cell")
    .attr("fill-opacity", (d) => {
      if (!hoveredIds.size) return 0.78;
      return hoveredIds.has(d.id) ? 0.96 : 0.24;
    })
    .attr("stroke", (d) => (hoveredIds.has(d.id) ? "#0f172a" : "#ffffff"))
    .attr("stroke-width", (d) => (hoveredIds.has(d.id) ? 1.8 / viewState.transform.k : 1 / viewState.transform.k));
}

function formatLabel(datum) {
  if (!datum) return "";
  if (viewState.transform.k >= 2.25) {
    return `${datum.data.name} · ${d3.format(".2s")(datum.value)}`;
  }
  return datum.data.name;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function renderExcentricOverlay(payload) {
  if (!overlayRoot) return;
  overlayRoot.selectAll("*").remove();
  if (!payload?.hovered?.length || !payload.pointer) return;

  const lensRadius = LENS_RADIUS;
  const [px, py] = payload.pointer;
  const neighbors = leaves
    .map((leaf) => {
      const centerX = leaf.x0 + (leaf.x1 - leaf.x0) / 2;
      const centerY = leaf.y0 + (leaf.y1 - leaf.y0) / 2;
      const screenCenter = viewState.transform.apply([centerX, centerY]);
      return {
        leaf,
        center: screenCenter,
        distance: Math.hypot(screenCenter[0] - px, screenCenter[1] - py),
      };
    })
    .filter((item) => item.distance <= lensRadius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_LABELS);

  if (!neighbors.length) return;

  overlayRoot
    .append("circle")
    .attr("cx", px)
    .attr("cy", py)
    .attr("r", lensRadius)
    .attr("fill", "rgba(15, 118, 110, 0.04)")
    .attr("stroke", "#0f766e")
    .attr("stroke-width", 1.6);

  drawOverlaySide(neighbors.filter((d) => d.center[0] < px), "left", px, py, lensRadius);
  drawOverlaySide(neighbors.filter((d) => d.center[0] >= px), "right", px, py, lensRadius);
}

function drawOverlaySide(items, side, px, py, lensRadius) {
  if (!items.length) return;
  const labelWidth = 180;
  const labelHeight = 22;
  const gap = 8;
  const stackHeight = items.length * labelHeight + (items.length - 1) * gap;
  const startY = clamp(py - stackHeight / 2, 18, HEIGHT - stackHeight - 18);
  const boxX = side === "left" ? px - lensRadius - 18 - labelWidth : px + lensRadius + 18;
  const lineAnchorX = side === "left" ? boxX + labelWidth : boxX;

  const lines = overlayRoot.append("g");
  lines
    .selectAll("path")
    .data(items, (d) => d.leaf.id)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d) => color(d.leaf.groupId))
    .attr("stroke-width", 1.4)
    .attr("d", (d, index) => {
      const targetY = startY + index * (labelHeight + gap) + labelHeight / 2;
      const x1 = lineAnchorX;
      const midX = side === "left" ? x1 + 16 : x1 - 16;
      return `M${d.center[0]},${d.center[1]} C${midX},${d.center[1]} ${midX},${targetY} ${x1},${targetY}`;
    });

  const rows = overlayRoot
    .append("g")
    .selectAll("g.label-row")
    .data(items, (d) => d.leaf.id)
    .join("g")
    .attr("class", "label-row")
    .attr("transform", (_, index) => `translate(${boxX}, ${startY + index * (labelHeight + gap)})`);

  rows
    .append("rect")
    .attr("width", labelWidth)
    .attr("height", labelHeight)
    .attr("rx", 8)
    .attr("fill", "rgba(255,255,255,0.92)")
    .attr("stroke", (d) => color(d.leaf.groupId))
    .attr("stroke-width", 1.1);

  rows
    .append("text")
    .attr("x", side === "left" ? labelWidth - 10 : 10)
    .attr("y", 14)
    .attr("text-anchor", side === "left" ? "end" : "start")
    .attr("fill", "#0f172a")
    .style("font", "600 11px system-ui")
    .text((d) => formatLabel(d.leaf));
}
