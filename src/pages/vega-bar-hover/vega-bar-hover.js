import Libra from "libra-vis";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import vegaEmbed from "vega-embed";
import { compileDSL } from "../../scripts/dsl-compiler";

const BAR_DATA = [
  { x: "A", y: 0.08167 },
  { x: "B", y: 0.01492 },
  { x: "C", y: 0.02782 },
  { x: "D", y: 0.04253 },
  { x: "E", y: 0.12702 },
  { x: "F", y: 0.02288 },
  { x: "G", y: 0.02015 },
  { x: "H", y: 0.06094 },
];

const VEGA_SPEC = {
  $schema: "https://vega.github.io/schema/vega/v5.json",
  description: "A minimal Vega bar chart used to test Libra+ hover on VegaLayer.",
  width: 520,
  height: 320,
  padding: 5,
  data: [
    {
      name: "source",
      values: BAR_DATA,
    },
  ],
  scales: [
    {
      name: "x",
      type: "band",
      domain: { data: "source", field: "x" },
      range: "width",
      padding: 0.12,
    },
    {
      name: "y",
      type: "linear",
      nice: true,
      zero: true,
      domain: { data: "source", field: "y" },
      range: "height",
    },
  ],
  axes: [
    { scale: "x", orient: "bottom", title: "Letter" },
    { scale: "y", orient: "left", title: "Frequency" },
  ],
  marks: [
    {
      name: "marks1",
      type: "rect",
      from: { data: "source" },
      encode: {
        update: {
          x: { scale: "x", field: "x" },
          width: { scale: "x", band: 1, offset: -1 },
          y: { scale: "y", field: "y" },
          y2: { scale: "y", value: 0 },
          fill: { value: "steelblue" },
          cornerRadiusTopLeft: { value: 3 },
          cornerRadiusTopRight: { value: 3 },
        },
      },
    },
  ],
};

const HOVER_DSL = [
  {
    name: "vegaBarHover",
    instrument: "point-selection",
    trigger: {
      type: "hover",
      priority: 1,
      stopPropagation: true,
    },
    target: {
      layer: "mainLayer",
    },
    feedback: {
      redrawFunc: {
        highlight: {
          fill: "#e4572e",
        },
      },
    },
  },
];

const SOURCE_CODE = String.raw`import Libra from "libra-vis";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import vegaEmbed from "vega-embed";
import { compileDSL } from "../../scripts/dsl-compiler";

const BAR_DATA = [
  { x: "A", y: 0.08167 },
  { x: "B", y: 0.01492 },
  { x: "C", y: 0.02782 },
  { x: "D", y: 0.04253 },
  { x: "E", y: 0.12702 },
  { x: "F", y: 0.02288 },
  { x: "G", y: 0.02015 },
  { x: "H", y: 0.06094 },
];

const VEGA_SPEC = {
  $schema: "https://vega.github.io/schema/vega/v5.json",
  width: 520,
  height: 320,
  data: [{ name: "source", values: BAR_DATA }],
  scales: [
    { name: "x", type: "band", domain: { data: "source", field: "x" }, range: "width", padding: 0.12 },
    { name: "y", type: "linear", nice: true, zero: true, domain: { data: "source", field: "y" }, range: "height" },
  ],
  axes: [
    { scale: "x", orient: "bottom", title: "Letter" },
    { scale: "y", orient: "left", title: "Frequency" },
  ],
  marks: [
    {
      name: "marks",
      type: "rect",
      from: { data: "source" },
      encode: {
        update: {
          x: { scale: "x", field: "x" },
          width: { scale: "x", band: 1, offset: -1 },
          y: { scale: "y", field: "y" },
          y2: { scale: "y", value: 0 },
          fill: { value: "steelblue" },
        },
      },
    },
  ],
};

const HOVER_DSL = [
  {
    name: "vegaBarHover",
    instrument: "point-selection",
    trigger: { type: "hover", priority: 1, stopPropagation: true },
    target: { layer: "mainLayer" },
    feedback: {
      redrawFunc: {
        highlight: { fill: "#e4572e" },
      },
    },
  },
];

let codeEditor = null;

function disposeCodeEditor() {
  if (!codeEditor) return;
  codeEditor.dispose();
  codeEditor = null;
}

function initCodeEditor(container) {
  disposeCodeEditor();
  codeEditor = monaco.editor.create(container, {
    value: SOURCE_CODE,
    language: "javascript",
    readOnly: true,
    automaticLayout: true,
    minimap: { enabled: false },
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    theme: "vs",
  });
}

async function renderVisualization(mountNode) {
  await vegaEmbed(mountNode, VEGA_SPEC, { actions: false, renderer: "svg" });
  const svgNode = mountNode.querySelector("svg");
  return Libra.Layer.initialize("VegaLayer", {
    name: "mainLayer",
    group: "marks",
    container: svgNode,
  });
}

async function mountInteraction(mainLayer) {
  compileDSL(HOVER_DSL, { layersByName: { mainLayer } }, { execute: true });
  if (Libra.createHistoryTrack) {
    await Libra.createHistoryTrack();
  }
}`;

let codeEditor = null;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function disposeCodeEditor() {
  if (!codeEditor) return;
  try {
    codeEditor.dispose();
  } catch (error) {
    console.warn("Failed to dispose Vega bar hover code editor", error);
  }
  codeEditor = null;
}

function initCodeEditor(container) {
  disposeCodeEditor();
  const fallbackNode = document.getElementById("VegaBarHoverCodeFallback");

  try {
    codeEditor = monaco.editor.create(container, {
      value: SOURCE_CODE,
      language: "javascript",
      readOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      theme: "vs",
    });
    if (fallbackNode) fallbackNode.style.display = "none";
  } catch (error) {
    container.style.display = "none";
    if (fallbackNode) fallbackNode.style.display = "block";
  }
}

function renderShell() {
  const root = document.getElementById("LibraPlayground");
  if (!root) return null;

  root.innerHTML = `
    <div class="showcase-page showcase-page--compare vega-bar-hover-page">
      <header class="showcase-topbar">
        <a class="showcase-brand" href="?page=home">
          <strong>Libra+</strong>
          <span>Vega Bar Hover</span>
        </a>
        <nav class="showcase-nav" aria-label="Primary">
          <a href="?page=home">Home</a>
          <a href="?page=gallery">Gallery</a>
          <a href="?page=vega-bar-hover" aria-current="page">Vega Bar Hover</a>
        </nav>
      </header>

      <section class="compare-grid">
        <article class="compare-panel vega-bar-hover-panel vega-bar-hover-panel-main">
          <div class="compare-panel-head">
            <h2 class="compare-panel-title">Visualization</h2>
          </div>

          <div class="compare-panel-section compare-panel-section--stage">
            <div id="VegaBarHoverMount" class="compare-panel-stage"></div>
            <p id="VegaBarHoverStatus" class="compare-panel-status"></p>
          </div>
        </article>

        <article class="compare-panel vega-bar-hover-panel">
          <div class="compare-panel-head">
            <h2 class="compare-panel-title">Full Code</h2>
          </div>

          <div class="compare-panel-section compare-panel-section--code">
            <div id="VegaBarHoverCode" class="editor-pane compare-code-editor"></div>
            <pre id="VegaBarHoverCodeFallback" class="editor-fallback compare-code-fallback">${escapeHtml(SOURCE_CODE)}</pre>
          </div>
        </article>
      </section>
    </div>
  `;

  return {
    mountNode: document.getElementById("VegaBarHoverMount"),
    statusNode: document.getElementById("VegaBarHoverStatus"),
    codeNode: document.getElementById("VegaBarHoverCode"),
  };
}

async function renderVisualization(mountNode) {
  await vegaEmbed(mountNode, VEGA_SPEC, {
    actions: false,
    renderer: "svg",
  });

  const svgNode = mountNode.querySelector("svg");
  if (!svgNode) {
    throw new Error("Vega did not render an SVG root for VegaLayer.");
  }
  let a = Libra.Layer.initialize("VegaLayer", {
    name: "mainLayer",
    group: "marks",
    container: svgNode,
  });
  console.log(a);
  

  return a;
}

async function mountInteraction(mainLayer) {
  compileDSL(HOVER_DSL, { layersByName: { mainLayer } }, { execute: true });
  if (typeof Libra.createHistoryTrack === "function") {
    await Libra.createHistoryTrack();
  }
}

export default async function init() {
  disposeCodeEditor();

  const shell = renderShell();
  if (!shell) return;

  const { mountNode, statusNode, codeNode } = shell;
  if (codeNode) {
    initCodeEditor(codeNode);
  }

  try {
    const mainLayer = await renderVisualization(mountNode);
    await mountInteraction(mainLayer);
    if (statusNode) {
      statusNode.textContent =
        "Hover the bars on the left to verify that Libra+ point-selection is mounted on VegaLayer.";
    }
  } catch (error) {
    if (statusNode) {
      statusNode.textContent = `Initialization failed: ${error.message}`;
      statusNode.classList.add("is-error");
      statusNode.hidden = false;
    }
    throw error;
  }

  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}
