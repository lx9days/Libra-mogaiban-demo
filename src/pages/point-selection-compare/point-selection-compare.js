import * as d3 from "d3";
import Libra from "libra-vis";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import vegaEmbed from "vega-embed";
import { compileDSL } from "../../scripts/dsl-compiler";
import { loadCarsScatterData, setupCarsScatter } from "../_shared/carsScatter";

const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 250;
const PANEL_MARGIN = { top: 26, right: 70, bottom: 42, left: 56 };
const FIELD_X = "Horsepower";
const FIELD_Y = "Miles_per_Gallon";
const FIELD_COLOR = "Origin";
const HIGHLIGHT_COLOR = "#ff0000";
const DIM_OPACITY = 0.1;

const DSL_CODE = `import Libra from "libra-vis";
import { compileDSL } from "../../scripts/dsl-compiler";
import { setupCarsScatter } from "../_shared/carsScatter";

const { mainLayer } = await setupCarsScatter();

await compileDSL(
  [
    {
      instrument: "pointSelection",
      trigger: {
        type: "click",
        priority: 1,
        stopPropagation: true,
      },
      target: { layer: "mainLayer" },
      feedback: {
        redrawFunc: {
          highlight: "#ff0000",
          dim: { opacity: 0.1, selector: ".mark" },
        },
      },
    },
  ],
  { layersByName: { mainLayer } },
  { execute: true }
);

if (Libra.createHistoryTrack) {
  await Libra.createHistoryTrack();
}`;

const NATIVE_LIBRA_CODE = `import Libra from "libra-vis";
import { setupCarsScatter } from "../_shared/carsScatter";

const { mainLayer } = await setupCarsScatter();

globalThis.FIELD_COLOR = "Origin";
globalThis.color = color;

Libra.Interaction.build({
  inherit: "ClickInstrument",
  layers: [mainLayer],
  sharedVar: {
    highlightColor: (d) => globalThis.color(d[globalThis.FIELD_COLOR]),
  },
});`;

const VEGALITE_CODE = `import vegaEmbed from "vega-embed";

await vegaEmbed(mountNode, {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  width: 360,
  height: 250,
  data: { values: carsData },
  params: [
    {
      name: "picked",
      select: { type: "point", on: "click", fields: ["Name"] },
    },
  ],
  mark: { type: "point", filled: true, size: 72, strokeWidth: 1.2 },
  encoding: {
    x: { field: "Horsepower", type: "quantitative" },
    y: { field: "Miles_per_Gallon", type: "quantitative" },
    color: {
      condition: { param: "picked", value: "#ff0000" },
      field: "Origin",
      type: "nominal",
      scale: { scheme: "tableau10" },
    },
    opacity: {
      condition: { param: "picked", value: 1 },
      value: 0.12,
    },
  },
}, { actions: false });`;

const D3_CODE = `import * as d3 from "d3";

let selectedDatum = null;

function update() {
  circles
    .attr("fill", (d) => (d === selectedDatum ? "#ff0000" : "white"))
    .attr("opacity", (d) => (!selectedDatum || d === selectedDatum ? 1 : 0.1));
}

svg.on("click", () => {
  selectedDatum = null;
  update();
});

const circles = plot
  .selectAll("circle")
  .data(carsData)
  .join("circle")
  .attr("class", "mark")
  .attr("cx", (d) => x(d.Horsepower))
  .attr("cy", (d) => y(d.Miles_per_Gallon))
  .attr("r", 4)
  .attr("fill", "white")
  .attr("stroke", (d) => color(d.Origin))
  .on("click", (event, d) => {
    event.stopPropagation();
    selectedDatum = d === selectedDatum ? null : d;
    update();
  });`;

const CODE_EDITOR_ITEMS = [
  { hostId: "PointSelectionLibraPlusCode", fallbackId: "PointSelectionLibraPlusCodeFallback", value: DSL_CODE },
  { hostId: "PointSelectionLibraJsCode", fallbackId: "PointSelectionLibraJsCodeFallback", value: NATIVE_LIBRA_CODE },
  { hostId: "PointSelectionVegaLiteCode", fallbackId: "PointSelectionVegaLiteCodeFallback", value: VEGALITE_CODE },
  { hostId: "PointSelectionD3Code", fallbackId: "PointSelectionD3CodeFallback", value: D3_CODE },
];

let codeEditors = [];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function panelMarkup({ title, mountId, statusId, codeId, fallbackId, code }) {
  return `
    <article class="compare-panel">
      <div class="compare-panel-head">
        <h2 class="compare-panel-title">${escapeHtml(title)}</h2>
      </div>

      <div class="compare-panel-section compare-panel-section--stage">
        <div id="${escapeHtml(mountId)}" class="compare-panel-stage"></div>
        <p id="${escapeHtml(statusId)}" class="compare-panel-status"></p>
      </div>

      <div class="compare-panel-section compare-panel-section--code">
        <div id="${escapeHtml(codeId)}" class="editor-pane compare-code-editor"></div>
        <pre id="${escapeHtml(fallbackId)}" class="editor-fallback compare-code-fallback">${escapeHtml(code)}</pre>
      </div>
    </article>
  `;
}

function renderComparePage() {
  return `
    <div class="showcase-page showcase-page--compare">
      <header class="showcase-topbar">
        <a class="showcase-brand" href="?page=home">
          <strong>Libra+</strong>
          <span>Point Selection Compare</span>
        </a>
        <nav class="showcase-nav" aria-label="Primary">
          <a href="?page=home">Home</a>
          <a href="?page=gallery">Gallery</a>
          <a href="?page=point-selection">Raw Demo</a>
          <a href="?page=point-selection-compare" aria-current="page">Compare</a>
        </nav>
      </header>

      <section class="compare-grid">
        ${panelMarkup({
          title: "Libra+",
          mountId: "CompareDslMount",
          statusId: "CompareDslStatus",
          codeId: "PointSelectionLibraPlusCode",
          fallbackId: "PointSelectionLibraPlusCodeFallback",
          code: DSL_CODE,
        })}
        ${panelMarkup({
          title: "Libra.js",
          mountId: "CompareLibraMount",
          statusId: "CompareLibraStatus",
          codeId: "PointSelectionLibraJsCode",
          fallbackId: "PointSelectionLibraJsCodeFallback",
          code: NATIVE_LIBRA_CODE,
        })}
        ${panelMarkup({
          title: "Vega-Lite",
          mountId: "CompareVegaLiteMount",
          statusId: "CompareVegaLiteStatus",
          codeId: "PointSelectionVegaLiteCode",
          fallbackId: "PointSelectionVegaLiteCodeFallback",
          code: VEGALITE_CODE,
        })}
        ${panelMarkup({
          title: "D3",
          mountId: "CompareD3Mount",
          statusId: "CompareD3Status",
          codeId: "PointSelectionD3Code",
          fallbackId: "PointSelectionD3CodeFallback",
          code: D3_CODE,
        })}
      </section>
    </div>
  `;
}

function setStatus(container, id, message, isError = false) {
  const node = container.querySelector(`#${id}`);
  if (!node) return;
  node.textContent = isError ? message : "";
  node.classList.toggle("is-error", isError);
  node.hidden = !isError;
}

function disposeCodeEditors() {
  codeEditors.forEach((editor) => {
    try {
      editor.dispose();
    } catch (error) {
      console.warn("Failed to dispose compare code editor", error);
    }
  });
  codeEditors = [];
}

function initCodeEditors(container) {
  disposeCodeEditors();

  CODE_EDITOR_ITEMS.forEach(({ hostId, fallbackId, value }) => {
    const host = container.querySelector(`#${hostId}`);
    const fallback = container.querySelector(`#${fallbackId}`);
    if (!host) return;

    try {
      const editor = monaco.editor.create(host, {
        value,
        language: "javascript",
        readOnly: true,
        automaticLayout: true,
        minimap: { enabled: false },
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        theme: "vs",
      });
      codeEditors.push(editor);
      if (fallback) fallback.style.display = "none";
    } catch (error) {
      host.style.display = "none";
      if (fallback) fallback.style.display = "block";
    }
  });
}

function filterCarsData(rawData = []) {
  return rawData.filter((d) => d && d[FIELD_X] && d[FIELD_Y]);
}

function buildVegaLiteSpec(data) {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    background: "white",
    data: { values: data },
    params: [
      {
        name: "picked",
        select: { type: "point", on: "click", fields: ["Name"] },
      },
    ],
    mark: {
      type: "point",
      filled: true,
      size: 72,
      strokeWidth: 1.2,
    },
    encoding: {
      x: {
        field: FIELD_X,
        type: "quantitative",
        axis: { title: FIELD_X, tickCount: 5 },
      },
      y: {
        field: FIELD_Y,
        type: "quantitative",
        axis: { title: FIELD_Y, tickCount: 5 },
      },
      color: {
        condition: { param: "picked", value: HIGHLIGHT_COLOR },
        field: FIELD_COLOR,
        type: "nominal",
        scale: { scheme: "tableau10" },
        legend: { title: FIELD_COLOR },
      },
      opacity: {
        condition: { param: "picked", value: 1 },
        value: 0.12,
      },
      tooltip: [
        { field: "Name", type: "nominal" },
        { field: FIELD_X, type: "quantitative" },
        { field: FIELD_Y, type: "quantitative" },
        { field: FIELD_COLOR, type: "nominal" },
      ],
    },
    config: {
      view: { stroke: "#d8d5c8" },
      axis: {
        labelColor: "#516074",
        titleColor: "#10233f",
        gridColor: "rgba(16, 35, 63, 0.08)",
      },
    },
  };
}

async function renderDslPanel(mountNode, data) {
  const layerName = "compareDslPointSelectionLayer";
  const { mainLayer } = await setupCarsScatter({
    data,
    container: mountNode,
    layerName,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    margin: PANEL_MARGIN,
  });

  await compileDSL(
    [
      {
        instrument: "pointSelection",
        trigger: {
          type: "click",
          priority: 1,
          stopPropagation: true,
        },
        target: { layer: layerName },
        feedback: {
          redrawFunc: {
            highlight: HIGHLIGHT_COLOR,
            dim: { opacity: DIM_OPACITY, selector: ".mark" },
          },
        },
      },
    ],
    { layersByName: { [layerName]: mainLayer } },
    { execute: true }
  );
}

async function renderNativeLibraPanel(mountNode, data) {
  const layerName = "compareNativePointSelectionLayer";
  const { mainLayer, color } = await setupCarsScatter({
    data,
    container: mountNode,
    layerName,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    margin: PANEL_MARGIN,
  });

  const runtimeGlobal = typeof window !== "undefined"
    ? window
    : (typeof self !== "undefined" ? self : {});

  runtimeGlobal.FIELD_COLOR = FIELD_COLOR;
  runtimeGlobal.color = color;

  Libra.Interaction.build({
    inherit: "ClickInstrument",
    layers: [mainLayer],
    sharedVar: {
      highlightColor: (d) => runtimeGlobal.color(d[runtimeGlobal.FIELD_COLOR]),
    },
  });
}

async function renderVegaLitePanel(mountNode, data) {
  mountNode.innerHTML = "";
  await vegaEmbed(mountNode, buildVegaLiteSpec(data), {
    actions: false,
    renderer: "svg",
  });
}

function renderD3Panel(mountNode, data) {
  mountNode.innerHTML = "";

  const width = PANEL_WIDTH;
  const height = PANEL_HEIGHT;
  const margin = PANEL_MARGIN;
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
    .domain([0, d3.max(data, (d) => d[FIELD_X])])
    .range([0, width])
    .nice()
    .clamp(true);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d[FIELD_Y])])
    .range([height, 0])
    .nice()
    .clamp(true);

  const color = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(data.map((d) => d[FIELD_COLOR]))))
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
    .attr("y", 32)
    .text(FIELD_X);

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
    .text(FIELD_Y);

  const legend = root.append("g");
  const legendValues = Array.from(new Set(data.map((d) => d[FIELD_COLOR])));
  legend
    .append("text")
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("x", width + margin.right / 2)
    .attr("y", -margin.top / 2 + 10)
    .text(FIELD_COLOR);

  const legendItem = legend
    .append("g")
    .selectAll("g")
    .data(legendValues)
    .join("g");

  legendItem
    .append("circle")
    .attr("fill-opacity", 0)
    .attr("stroke-width", 2)
    .attr("stroke", (d) => color(d))
    .attr("cx", width + 10)
    .attr("cy", (_, index) => index * 20)
    .attr("r", 5);

  legendItem
    .append("text")
    .attr("font-size", "12px")
    .attr("x", width + 20)
    .attr("y", (_, index) => index * 20 + 5)
    .text((d) => d);

  const plot = root.append("g");
  let selectedDatum = null;

  function updateSelection() {
    circles
      .attr("fill", (d) => (selectedDatum && d === selectedDatum ? HIGHLIGHT_COLOR : "white"))
      .attr("fill-opacity", (d) => (selectedDatum && d === selectedDatum ? 1 : 0.95))
      .attr("opacity", (d) => (!selectedDatum || d === selectedDatum ? 1 : DIM_OPACITY));
  }

  const circles = plot
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("class", "mark")
    .attr("cx", (d) => x(d[FIELD_X]))
    .attr("cy", (d) => y(d[FIELD_Y]))
    .attr("r", 4)
    .attr("fill", "white")
    .attr("stroke-width", 1)
    .attr("stroke", (d) => color(d[FIELD_COLOR]))
    .style("cursor", "pointer")
    .on("click", (event, datum) => {
      event.stopPropagation();
      selectedDatum = datum === selectedDatum ? null : datum;
      updateSelection();
    });

  svg.style("cursor", "default").on("click", () => {
    selectedDatum = null;
    updateSelection();
  });

  updateSelection();
}

async function renderPanels(container) {
  const rawData = await loadCarsScatterData();
  const data = filterCarsData(rawData);
  const panels = [
    {
      mountId: "CompareDslMount",
      statusId: "CompareDslStatus",
      render: renderDslPanel,
    },
    {
      mountId: "CompareLibraMount",
      statusId: "CompareLibraStatus",
      render: renderNativeLibraPanel,
    },
    {
      mountId: "CompareVegaLiteMount",
      statusId: "CompareVegaLiteStatus",
      render: renderVegaLitePanel,
    },
    {
      mountId: "CompareD3Mount",
      statusId: "CompareD3Status",
      render: async (mountNode, filteredData) => renderD3Panel(mountNode, filteredData),
    },
  ];

  for (const panel of panels) {
    const mountNode = container.querySelector(`#${panel.mountId}`);
    if (!mountNode) continue;

    try {
      // 顺序挂载可避免多套交互系统同时初始化时相互干扰。
      // eslint-disable-next-line no-await-in-loop
      await panel.render(mountNode, data);
      setStatus(container, panel.statusId, "");
    } catch (error) {
      setStatus(container, panel.statusId, `Failed to mount: ${error.message}`, true);
    }
  }

  if (Libra && typeof Libra.createHistoryTrack === "function") {
    try {
      await Libra.createHistoryTrack();
    } catch (error) {
      // The compare page can still work without history tracking.
    }
  }
}

export default async function initPointSelectionComparePage() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;

  disposeCodeEditors();
  container.innerHTML = renderComparePage();
  initCodeEditors(container);
  await renderPanels(container);
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}
