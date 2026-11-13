import Libra from "libra-vis";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import vegaEmbed from "vega-embed";
import { assembleVegaLite } from "flint-chart";
import { compileDSL } from "../../scripts/dsl-compiler";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function resolveSharedMarkScope(svgNode, scopeClass) {
  const markGroups = [...svgNode.querySelectorAll(".marks")];
  if (markGroups.length === 0) {
    throw new Error("No .marks nodes were found in the rendered Flint SVG.");
  }

  const sharedAncestor = findNearestCommonAncestor(markGroups, svgNode);
  if (!sharedAncestor || sharedAncestor === svgNode) {
    throw new Error("Unable to resolve a shared Flint mark scope below the SVG root.");
  }

  svgNode.querySelectorAll(`.${scopeClass}`).forEach((node) => {
    node.classList.remove(scopeClass);
  });
  sharedAncestor.classList.add(scopeClass);

  return {
    group: scopeClass,
    markCount: markGroups.length,
  };
}

export function createFlintInteractionPage({
  pageTitle,
  routeName,
  flintInput,
  interactions,
  sourceCode,
  successMessage,
  panelTitle = "Visualization",
  onLayerReady,
}) {
  const idPrefix = routeName.replace(/[^\w-]+/g, "-");
  const mountId = `${idPrefix}-mount`;
  const statusId = `${idPrefix}-status`;
  const codeId = `${idPrefix}-code`;
  const fallbackId = `${idPrefix}-code-fallback`;
  const scopeClass = `${idPrefix}-shared-scope`;
  let codeEditor = null;

  function disposeCodeEditor() {
    if (!codeEditor) return;
    try {
      codeEditor.dispose();
    } catch (error) {
      console.warn(`Failed to dispose ${routeName} code editor`, error);
    }
    codeEditor = null;
  }

  function initCodeEditor(container) {
    disposeCodeEditor();
    const fallbackNode = document.getElementById(fallbackId);

    try {
      codeEditor = monaco.editor.create(container, {
        value: sourceCode,
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
      <div class="showcase-page showcase-page--compare vega-bar-hover-page flint-interaction-page">
        <header class="showcase-topbar">
          <a class="showcase-brand" href="?page=home">
            <strong>Libra+</strong>
            <span>${escapeHtml(pageTitle)}</span>
          </a>
          <nav class="showcase-nav" aria-label="Primary">
            <a href="?page=home">Home</a>
            <a href="?page=gallery">Gallery</a>
            <a href="?page=${escapeHtml(routeName)}" aria-current="page">${escapeHtml(pageTitle)}</a>
          </nav>
        </header>

        <section class="compare-grid">
          <article class="compare-panel vega-bar-hover-panel vega-bar-hover-panel-main">
            <div class="compare-panel-head">
              <h2 class="compare-panel-title">${escapeHtml(panelTitle)}</h2>
            </div>

            <div class="compare-panel-section compare-panel-section--stage">
              <div id="${mountId}" class="compare-panel-stage"></div>
              <p id="${statusId}" class="compare-panel-status"></p>
            </div>
          </article>

          <article class="compare-panel vega-bar-hover-panel">
            <div class="compare-panel-head">
              <h2 class="compare-panel-title">Full Code</h2>
            </div>

            <div class="compare-panel-section compare-panel-section--code">
              <div id="${codeId}" class="editor-pane compare-code-editor"></div>
              <pre id="${fallbackId}" class="editor-fallback compare-code-fallback">${escapeHtml(sourceCode)}</pre>
            </div>
          </article>
        </section>
      </div>
    `;

    return {
      mountNode: document.getElementById(mountId),
      statusNode: document.getElementById(statusId),
      codeNode: document.getElementById(codeId),
    };
  }

  async function renderVisualization(mountNode) {
    const spec = assembleVegaLite(flintInput);
    await vegaEmbed(mountNode, spec, {
      actions: false,
      renderer: "svg",
    });

    const svgNode = mountNode.querySelector("svg");
    if (!svgNode) {
      throw new Error("Flint did not render an SVG root for VegaLayer.");
    }

    const { group, markCount } = resolveSharedMarkScope(svgNode, scopeClass);
    const layer = Libra.Layer.initialize("VegaLayer", {
      name: "mainLayer",
      group,
      container: svgNode,
    });

    return {
      layer,
      markCount,
      spec,
    };
  }

  async function mountInteraction(mainLayer) {
    compileDSL(interactions, { layersByName: { mainLayer } }, { execute: true });
    if (typeof Libra.createHistoryTrack === "function") {
      await Libra.createHistoryTrack();
    }
  }

  return async function init() {
    disposeCodeEditor();

    const shell = renderShell();
    if (!shell) return;

    const { mountNode, statusNode, codeNode } = shell;
    if (codeNode) {
      initCodeEditor(codeNode);
    }

    try {
      const { layer, markCount, spec } = await renderVisualization(mountNode);
      if (typeof onLayerReady === "function") {
        await onLayerReady({ layer, markCount, spec, mountNode, flintInput });
      }
      await mountInteraction(layer);
      if (statusNode) {
        statusNode.textContent =
          typeof successMessage === "function"
            ? successMessage({ markCount, spec })
            : successMessage;
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
  };
}
