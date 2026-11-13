import Libra from "libra-vis";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import vegaEmbed from "vega-embed";
import { assembleVegaLite } from "flint-chart";
import { compileDSL } from "../../scripts/dsl-compiler";

const FLINT_INPUT = {
  data: {
    values: [
      { letter: "A", frequency: 0.08167 },
      { letter: "B", frequency: 0.01492 },
      { letter: "C", frequency: 0.02782 },
      { letter: "D", frequency: 0.04253 },
      { letter: "E", frequency: 0.12702 },
      { letter: "F", frequency: 0.02288 },
      { letter: "G", frequency: 0.02015 },
      { letter: "H", frequency: 0.06094 },
    ],
  },
  semantic_types: {
    letter: "Category",
    frequency: "Quantity",
  },
  chart_spec: {
    chartType: "Bar Chart",
    encodings: {
      x: { field: "letter" },
      y: { field: "frequency" },
    },
    baseSize: { width: 520, height: 320 },
  },
};

const HOVER_DSL = [
  {
    name: "flintBarHover",
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
import { assembleVegaLite } from "flint-chart";
import { compileDSL } from "../../scripts/dsl-compiler";

const FLINT_INPUT = {
  data: {
    values: [
      { letter: "A", frequency: 0.08167 },
      { letter: "B", frequency: 0.01492 },
      { letter: "C", frequency: 0.02782 },
      { letter: "D", frequency: 0.04253 },
      { letter: "E", frequency: 0.12702 },
      { letter: "F", frequency: 0.02288 },
      { letter: "G", frequency: 0.02015 },
      { letter: "H", frequency: 0.06094 },
    ],
  },
  semantic_types: {
    letter: "Category",
    frequency: "Quantity",
  },
  chart_spec: {
    chartType: "Bar Chart",
    encodings: {
      x: { field: "letter" },
      y: { field: "frequency" },
    },
    baseSize: { width: 520, height: 320 },
  },
};

const HOVER_DSL = [
  {
    name: "flintBarHover",
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

function getAncestorChain(node, stopNode) {
  const chain = [];
  let current = node;
  while (current) {
    chain.push(current);
    if (current === stopNode) break;
    current = current.parentElement;
  }
  return chain;
}

function findNearestCommonAncestor(nodes, stopNode) {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];

  const firstChain = getAncestorChain(nodes[0], stopNode);
  for (const candidate of firstChain) {
    if (nodes.every((node) => candidate.contains(node))) {
      return candidate;
    }
    if (candidate === stopNode) break;
  }
  return stopNode;
}

function resolveSharedMarkScope(svgNode) {
  const markGroups = [...svgNode.querySelectorAll(".marks")];
  if (markGroups.length === 0) {
    throw new Error("No .marks nodes were found in the rendered Flint SVG.");
  }

  const sharedAncestor = findNearestCommonAncestor(markGroups, svgNode);
  if (!sharedAncestor || sharedAncestor === svgNode) {
    throw new Error("Unable to resolve a shared Flint mark scope below the SVG root.");
  }

  const scopeClass = "libra-flint-shared-scope";
  svgNode.querySelectorAll("." + scopeClass).forEach((node) => {
    node.classList.remove(scopeClass);
  });
  sharedAncestor.classList.add(scopeClass);

  return { group: scopeClass };
}

async function renderVisualization(mountNode) {
  const spec = assembleVegaLite(FLINT_INPUT);
  await vegaEmbed(mountNode, spec, { actions: false, renderer: "svg" });
  const svgNode = mountNode.querySelector("svg");
  const { group } = resolveSharedMarkScope(svgNode);
  return Libra.Layer.initialize("VegaLayer", {
    name: "mainLayer",
    group,
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
    console.warn("Failed to dispose Flint bar hover code editor", error);
  }
  codeEditor = null;
}

function initCodeEditor(container) {
  disposeCodeEditor();
  const fallbackNode = document.getElementById("FlintBarHoverCodeFallback");

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

function getAncestorChain(node, stopNode) {
  const chain = [];
  let current = node;
  while (current) {
    chain.push(current);
    if (current === stopNode) break;
    current = current.parentElement;
  }
  return chain;
}

function findNearestCommonAncestor(nodes, stopNode) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return null;
  }
  if (nodes.length === 1) {
    return nodes[0];
  }

  const firstChain = getAncestorChain(nodes[0], stopNode);
  for (const candidate of firstChain) {
    const containsAll = nodes.every((node) => candidate.contains(node));
    if (containsAll) {
      return candidate;
    }
    if (candidate === stopNode) {
      break;
    }
  }
  return stopNode;
}

function resolveSharedMarkScope(svgNode) {
  const markGroups = [...svgNode.querySelectorAll(".marks")];
  if (markGroups.length === 0) {
    throw new Error("No .marks nodes were found in the rendered Flint SVG.");
  }

  const sharedAncestor = findNearestCommonAncestor(markGroups, svgNode);
  if (!sharedAncestor || sharedAncestor === svgNode) {
    throw new Error("Unable to resolve a shared Flint mark scope below the SVG root.");
  }

  const scopeClass = "libra-flint-shared-scope";
  svgNode.querySelectorAll(`.${scopeClass}`).forEach((node) => {
    node.classList.remove(scopeClass);
  });
  sharedAncestor.classList.add(scopeClass);

  return {
    group: scopeClass,
    markCount: markGroups.length,
  };
}

function renderShell() {
  const root = document.getElementById("LibraPlayground");
  if (!root) return null;

  root.innerHTML = `
    <div class="showcase-page showcase-page--compare vega-bar-hover-page vegalite-bar-hover-page flint-bar-hover-page">
      <header class="showcase-topbar">
        <a class="showcase-brand" href="?page=home">
          <strong>Libra+</strong>
          <span>Flint Bar Hover</span>
        </a>
        <nav class="showcase-nav" aria-label="Primary">
          <a href="?page=home">Home</a>
          <a href="?page=gallery">Gallery</a>
          <a href="?page=vegalite-bar-hover" aria-current="page">Flint Bar Hover</a>
        </nav>
      </header>

      <section class="compare-grid">
        <article class="compare-panel vega-bar-hover-panel vega-bar-hover-panel-main">
          <div class="compare-panel-head">
            <h2 class="compare-panel-title">Visualization</h2>
          </div>

          <div class="compare-panel-section compare-panel-section--stage">
            <div id="FlintBarHoverMount" class="compare-panel-stage"></div>
            <p id="FlintBarHoverStatus" class="compare-panel-status"></p>
          </div>
        </article>

        <article class="compare-panel vega-bar-hover-panel">
          <div class="compare-panel-head">
            <h2 class="compare-panel-title">Full Code</h2>
          </div>

          <div class="compare-panel-section compare-panel-section--code">
            <div id="FlintBarHoverCode" class="editor-pane compare-code-editor"></div>
            <pre id="FlintBarHoverCodeFallback" class="editor-fallback compare-code-fallback">${escapeHtml(SOURCE_CODE)}</pre>
          </div>
        </article>
      </section>
    </div>
  `;

  return {
    mountNode: document.getElementById("FlintBarHoverMount"),
    statusNode: document.getElementById("FlintBarHoverStatus"),
    codeNode: document.getElementById("FlintBarHoverCode"),
  };
}

async function renderVisualization(mountNode) {
  const spec = assembleVegaLite(FLINT_INPUT);
  await vegaEmbed(mountNode, spec, {
    actions: false,
    renderer: "svg",
  });

  const svgNode = mountNode.querySelector("svg");
  if (!svgNode) {
    throw new Error("Flint did not render an SVG root for VegaLayer.");
  }

  const { group, markCount } = resolveSharedMarkScope(svgNode);
  const layer = Libra.Layer.initialize("VegaLayer", {
    name: "mainLayer",
    group,
    container: svgNode,
  });

  return {
    layer,
    markCount,
  };
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
    const { layer: mainLayer, markCount } = await renderVisualization(mountNode);
    await mountInteraction(mainLayer);
    if (statusNode) {
      statusNode.textContent =
        `Hover the bars on the left. Flint generated a Vega-Lite chart with ${markCount} .marks groups, and Libra+ binds VegaLayer to their shared ancestor.`;
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
