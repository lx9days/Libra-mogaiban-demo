import * as d3 from "d3";
import Libra from "libra-vis";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import vegaEmbed from "vega-embed";
import { compileDSL } from "../../scripts/dsl-compiler";

const CODE_DSL = `const interactions = [
    {
    name: "brushMain",
    instrument: "GroupSelection",
    trigger: {
      type: "brush",
      priority: 1,
      stopPropagation: true,
    },
    target: {
      layer: "mainLayer",
    },
    feedback: {
      redrawFunc: {
        highlight: { color: (d) => color(d[g.FIELD_COLOR || fieldColor]) },
        brushStyle: {
          fill: "#5c5c5cff",
          opacity: 0.3,
          stroke: "none",
        },
      },
    },
  },
  {
    name: "brushMain2",
    instrument: "GroupSelection",
    trigger: {
      type: "brush",
      priority: 2,
      modifierKey: "ctrl",
      stopPropagation: true,
    },
    target: {
      layer: "mainLayer",
    },
    feedback: {
      redrawFunc: {
        highlight: { color: (d) => color(d[g.FIELD_COLOR || fieldColor]) },
        brushStyle: {
          fill: "#ff6b6b",
          opacity: 0.3,
          stroke: "none",
        },
      },
    },
  },
];

await compileDSL(interactions, { layersByName: { mainLayer } }, { execute: true });`;

const CODE_NATIVE_LIBRA = `registerExampleBrushInstrument("PrimaryBrushInstrument", null);
registerExampleBrushInstrument("SecondaryBrushInstrument", "ctrl");

Libra.Service.register("NativeBrushGeometryService", {
  evaluate({ offsetx, offsety, width, height, layer, self }) {
    const hostLayer = layer ?? self?._layerInstances?.[0];
    const rect =
      Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
        ? { x: offsetx, y: offsety, width, height }
        : null;
    return {
      rect,
      nodes: queryNodesInRect(hostLayer, rect),
    };
  },
});

Libra.Service.register("NativeDoubleBrushIntersectionService", {
  evaluate({ result, self }) {
    const brushKey = self?.getSharedVar("brushKey") || "primary";
    const current = result || {};

    brushStore[brushKey] = {
      ...brushStore[brushKey],
      rect: current.rect || null,
      nodes: current.nodes || [],
    };

    return {
      nodes: unionNodes(brushStore.primary.nodes, brushStore.secondary.nodes),
      brushes: brushStore,
      hasActiveBrush: Boolean(brushStore.primary.rect || brushStore.secondary.rect),
    };
  },
});

const intersectionTransformer = Libra.GraphicalTransformer.initialize("NativeDoubleBrushTransformer", {
  layer: mainLayer,
  sharedVar: { result: { nodes: [], brushes: {} } },
  redraw({ layer, transformer }) {
    const result = transformer.getSharedVar("result") || {};
    redrawPointsAndBrushes(layer, result);
  },
});

Libra.Interaction.build({
  inherit: "PrimaryBrushInstrument",
  layers: [mainLayer],
  sharedVar: { geometryServiceName: "NativeBrushGeometryService" },
  insert: [{
    find: "PrimaryBrushInstrument",
    flow: [
      { name: "PrimaryGeometryService", comp: "NativeBrushGeometryService" },
      { name: "PrimaryIntersectionService", comp: "NativeDoubleBrushIntersectionService", sharedVar: { brushKey: "primary" } },
      intersectionTransformer,
    ],
  }],
});

Libra.Interaction.build({
  inherit: "SecondaryBrushInstrument",
  layers: [mainLayer],
  sharedVar: { geometryServiceName: "NativeBrushGeometryService" },
  insert: [{
    find: "SecondaryBrushInstrument",
    flow: [
      { name: "SecondaryGeometryService", comp: "NativeBrushGeometryService" },
      { name: "SecondaryIntersectionService", comp: "NativeDoubleBrushIntersectionService", sharedVar: { brushKey: "secondary" } },
      intersectionTransformer,
    ],
  }],
});`;

const CODE_VEGALITE = `const spec = {
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": { "url": "https://vega.github.io/editor/data/cars.json" },
  "width": 370,
  "height": 270,
  "params": [
    {
      "name": "brush1",
      "select": {
        "type": "interval",
        "on": "[mousedown[!event.ctrlKey], window:mouseup] > window:mousemove",
        "translate": "[mousedown[!event.ctrlKey], window:mouseup] > window:mousemove",
        "clear": "dblclick[!event.ctrlKey]"
      }
    },
    {
      "name": "brush2",
      "select": {
        "type": "interval",
        "on": "[mousedown[event.ctrlKey], window:mouseup] > window:mousemove",
        "translate": "[mousedown[event.ctrlKey], window:mouseup] > window:mousemove",
        "clear": "dblclick[event.ctrlKey]",
        "mark": { "stroke": "red", "fill": "red", "fillOpacity": 0.1 }
      }
    }
  ],
  "mark": "point",
  "encoding": {
    "x": { "field": "Horsepower", "type": "quantitative" },
    "y": { "field": "Miles_per_Gallon", "type": "quantitative" },
    "color": {
      "condition": {
        "test": { "or": [{ "param": "brush1" }, { "param": "brush2" }] },
        "field": "Cylinders",
        "type": "ordinal"
      },
      "value": "lightgrey"
    }
  }
};

vegaEmbed(mountNode, spec, { actions: false });`;

const CODE_D3 = `const brushes = {
  primary: { rect: null, nodes: [] },
  secondary: { rect: null, nodes: [] },
};

function unionNodes(nodesA = [], nodesB = []) {
  return Array.from(new Set([...nodesA, ...nodesB]));
}

function updateHighlight() {
  const selected = unionNodes(brushes.primary.nodes, brushes.secondary.nodes);
  const hasBrush = Boolean(brushes.primary.rect || brushes.secondary.rect);

  circles
    .attr("fill", "white")
    .attr("stroke", (d) => color(d[fieldColor]))
    .attr("opacity", hasBrush ? 0.22 : 1);

  d3.selectAll(selected)
    .attr("fill", (d) => color(d[fieldColor]))
    .attr("stroke", (d) => color(d[fieldColor]))
    .attr("opacity", 1);

  brushLayer.selectAll("*").remove();
  [["primary", "#5c5c5c"], ["secondary", "#ff6b6b"]].forEach(([key, fill]) => {
    const rect = brushes[key].rect;
    if (!rect) return;
    brushLayer
      .append("rect")
      .attr("x", rect.x)
      .attr("y", rect.y)
      .attr("width", rect.width)
      .attr("height", rect.height)
      .attr("fill", fill)
      .attr("opacity", 0.3);
  });
}

overlay
  .on("mousedown", (event) => {
    const key = event.ctrlKey ? "secondary" : "primary";
    const [x0, y0] = d3.pointer(event, plot.node());

    d3.select(window)
      .on("mousemove.d3-double-brush", (moveEvent) => {
        const [x1, y1] = d3.pointer(moveEvent, plot.node());
        const rect = {
          x: Math.min(x0, x1),
          y: Math.min(y0, y1),
          width: Math.abs(x1 - x0),
          height: Math.abs(y1 - y0),
        };

        brushes[key].rect = rect.width > 0 && rect.height > 0 ? rect : null;
        brushes[key].nodes = circles
          .filter(function () {
            const cx = Number(this.getAttribute("cx"));
            const cy = Number(this.getAttribute("cy"));
            return rect.x <= cx && cx <= rect.x + rect.width && rect.y <= cy && cy <= rect.y + rect.height;
          })
          .nodes();

        updateHighlight();
      })
      .on("mouseup.d3-double-brush", () => {
        d3.select(window).on(".d3-double-brush", null);
      });
  })
  .on("dblclick", (event) => {
    const key = event.ctrlKey ? "secondary" : "primary";
    brushes[key] = { rect: null, nodes: [] };
    updateHighlight();
  });`;

const CODE_EDITOR_ITEMS = [
  {
    hostId: "ComposedDoubleGroupDslCode",
    fallbackId: "ComposedDoubleGroupDslCodeFallback",
    value: CODE_DSL,
    tokens: [],
  },
  {
    hostId: "ComposedDoubleGroupLibraCode",
    fallbackId: "ComposedDoubleGroupLibraCodeFallback",
    value: CODE_NATIVE_LIBRA,
    tokens: ["brushStore", "brushKey"],
  },
  {
    hostId: "ComposedDoubleGroupVegaLiteCode",
    fallbackId: "ComposedDoubleGroupVegaLiteCodeFallback",
    value: CODE_VEGALITE,
    tokens: ["brush1", "brush2"],
  },
  {
    hostId: "ComposedDoubleGroupD3Code",
    fallbackId: "ComposedDoubleGroupD3CodeFallback",
    value: CODE_D3,
    tokens: ["brushes"],
  },
];

let codeEditors = [];

const PANEL_HINTS = {
  ComposedDoubleGroupDslStatus:
    "Explicit communication vars: 0. Left drag uses GroupSelection1; Ctrl + drag uses GroupSelection2.",
  ComposedDoubleGroupLibraStatus:
    "Explicit communication vars: 2. Highlighted: brushStore, brushKey. Left drag uses GroupSelection1; Ctrl + drag uses GroupSelection2.",
  ComposedDoubleGroupVegaLiteStatus:
    "Explicit communication vars: 2. Highlighted: brush1, brush2. Left drag uses GroupSelection1; Ctrl + drag uses GroupSelection2.",
  ComposedDoubleGroupD3Status:
    "Explicit communication vars: 1. Highlighted: brushes. Left drag uses GroupSelection1; Ctrl + drag uses GroupSelection2.",
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPanel({ title, mountId, statusId, codeId, fallbackId, code }) {
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

function renderPage() {
  return `
    <div class="showcase-page showcase-page--compare">
      <header class="showcase-topbar">
        <a class="showcase-brand" href="?page=home">
          <strong>Libra+</strong>
          <span>Composed Double Group Selection Compare</span>
        </a>
        <nav class="showcase-nav" aria-label="Primary">
          <a href="?page=home">Home</a>
          <a href="?page=gallery">Gallery</a>
          <a href="?page=composed-double-group-selection">Raw Demo</a>
          <a href="?page=composed-double-group-selection-compare" aria-current="page">Compare</a>
        </nav>
      </header>

      <section class="compare-grid">
        ${renderPanel({
          title: "Libra+",
          mountId: "ComposedDoubleGroupDslMount",
          statusId: "ComposedDoubleGroupDslStatus",
          codeId: "ComposedDoubleGroupDslCode",
          fallbackId: "ComposedDoubleGroupDslCodeFallback",
          code: CODE_DSL,
        })}
        ${renderPanel({
          title: "Libra.js",
          mountId: "ComposedDoubleGroupLibraMount",
          statusId: "ComposedDoubleGroupLibraStatus",
          codeId: "ComposedDoubleGroupLibraCode",
          fallbackId: "ComposedDoubleGroupLibraCodeFallback",
          code: CODE_NATIVE_LIBRA,
        })}
        ${renderPanel({
          title: "Vega-Lite",
          mountId: "ComposedDoubleGroupVegaLiteMount",
          statusId: "ComposedDoubleGroupVegaLiteStatus",
          codeId: "ComposedDoubleGroupVegaLiteCode",
          fallbackId: "ComposedDoubleGroupVegaLiteCodeFallback",
          code: CODE_VEGALITE,
        })}
        ${renderPanel({
          title: "D3",
          mountId: "ComposedDoubleGroupD3Mount",
          statusId: "ComposedDoubleGroupD3Status",
          codeId: "ComposedDoubleGroupD3Code",
          fallbackId: "ComposedDoubleGroupD3CodeFallback",
          code: CODE_D3,
        })}
      </section>
    </div>
  `;
}

function setStatus(container, id, message, isError = false) {
  const node = container.querySelector(`#${id}`);
  if (!node) return;
  node.textContent = message || "";
  node.classList.toggle("is-error", isError);
  node.hidden = !message;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectTokenDecorations(editor, source, tokens = []) {
  return tokens.flatMap((token) => {
    const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, "g");
    const decorations = [];
    let match = pattern.exec(source);
    while (match) {
      const start = editor.getModel().getPositionAt(match.index);
      const end = editor.getModel().getPositionAt(match.index + token.length);
      decorations.push({
        range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
        options: {
          inlineClassName: "compare-code-highlight",
        },
      });
      match = pattern.exec(source);
    }
    return decorations;
  });
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

  CODE_EDITOR_ITEMS.forEach(({ hostId, fallbackId, value, tokens }) => {
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
      editor.deltaDecorations([], collectTokenDecorations(editor, value, tokens));
      codeEditors.push(editor);
      if (fallback) fallback.style.display = "none";
    } catch (error) {
      host.style.display = "none";
      if (fallback) fallback.style.display = "block";
    }
  });
}

function renderPlaceholder(mountNode, title) {
  mountNode.innerHTML = `
    <div style="width:100%;padding:24px;border:1px dashed rgba(16,35,63,.2);color:#516074;background:#fff;">
      ${escapeHtml(title)} is not implemented yet.
    </div>
  `;
}

function createCarsScatterScene(mountNode, layerName) {
  const DEFAULT_MARGIN = { top: 30, right: 70, bottom: 40, left: 60 };
  const DEFAULT_WIDTH = 500 - DEFAULT_MARGIN.left - DEFAULT_MARGIN.right;
  const DEFAULT_HEIGHT = 340 - DEFAULT_MARGIN.top - DEFAULT_MARGIN.bottom;

  const g = typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : {});
  const fieldX = g.FIELD_X || "Horsepower";
  const fieldY = g.FIELD_Y || "Miles_per_Gallon";
  const fieldColor = g.FIELD_COLOR || "Origin";

  const margin = DEFAULT_MARGIN;
  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;

  return d3.json("https://raw.githubusercontent.com/vega/vega/main/docs/data/cars.json").then((rawData) => {
    const data = rawData.filter((d) => !!(d?.[fieldX] && d?.[fieldY]));

    mountNode.innerHTML = "";

    const svg = d3
      .select(mountNode)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);

    const root = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

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

    const legendItem = legend.append("g").selectAll("g").data(legendDomain).join("g");
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

    const mainLayer = Libra.Layer.initialize("D3Layer", {
      name: layerName,
      width,
      height,
      offset: { x: margin.left, y: margin.top },
      container: svg.node(),
    });

    d3.select(mainLayer.getGraphic())
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("class", "mark")
      .attr("fill", "white")
      .attr("fill-opacity", 1)
      .attr("stroke-width", 1)
      .attr("stroke", (d) => color(d[fieldColor]))
      .attr("cx", (d) => x(d[fieldX]))
      .attr("cy", (d) => y(d[fieldY]))
      .attr("r", 4);

    return {
      data,
      fieldX,
      fieldY,
      fieldColor,
      x,
      y,
      color,
      mainLayer,
    };
  });
}

async function renderDslPanel(mountNode) {
  const {
    fieldColor,
    color,
    mainLayer,
  } = await createCarsScatterScene(mountNode, "composedDoubleGroupSelectionCompareMainLayer");
  const g = typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : {});

  const interactions = [
    {
      name: "brushMain",
      instrument: "GroupSelection",
      trigger: {
        type: "brush",
        priority: 1,
        stopPropagation: true,
      },
      target: {
        layer: "composedDoubleGroupSelectionCompareMainLayer",
      },
      feedback: {
        redrawFunc: {
          highlight: { color: (d) => color(d[g.FIELD_COLOR || fieldColor]) },
          brushStyle: {
            fill: "#5c5c5cff",
            opacity: 0.3,
            stroke: "none",
          },
        },
      },
    },
    {
      name: "brushMain2",
      instrument: "GroupSelection",
      trigger: {
        type: "brush",
        priority: 2,
        modifierKey: "ctrl",
        stopPropagation: true,
      },
      target: {
        layer: "composedDoubleGroupSelectionCompareMainLayer",
      },
      feedback: {
        redrawFunc: {
          highlight: { color: (d) => color(d[g.FIELD_COLOR || fieldColor]) },
          brushStyle: {
            fill: "#ff6b6b",
            opacity: 0.3,
            stroke: "none",
          },
        },
      },
    },
  ];

  await compileDSL(interactions, {
    layersByName: { composedDoubleGroupSelectionCompareMainLayer: mainLayer },
  }, { execute: true });
}

function unionNodes(nodesA = [], nodesB = []) {
  return Array.from(new Set([...(Array.isArray(nodesA) ? nodesA : []), ...(Array.isArray(nodesB) ? nodesB : [])]));
}

function resolveBrushRect(options = {}, layer) {
  const layerOffsetX = layer?._offset?.x ?? 0;
  const layerOffsetY = layer?._offset?.y ?? 0;
  const width = Number.isFinite(options.width) ? options.width : 0;
  const height = Number.isFinite(options.height) ? options.height : 0;
  const x = Number.isFinite(options.offsetx)
    ? options.offsetx
    : Number.isFinite(options.x)
      ? options.x - layerOffsetX
      : 0;
  const y = Number.isFinite(options.offsety)
    ? options.offsety
    : Number.isFinite(options.y)
      ? options.y - layerOffsetY
      : 0;

  if (width <= 0 || height <= 0) return null;
  return {
    x,
    y,
    width,
    height,
  };
}

function queryNodesInRect(layer, rect) {
  if (!layer || !rect) return [];
  return d3.select(layer.getGraphic())
    .selectAll("circle.mark")
    .filter(function querySelected() {
      const cx = Number(this.getAttribute("cx"));
      const cy = Number(this.getAttribute("cy"));
      return (
        cx >= rect.x &&
        cx <= rect.x + rect.width &&
        cy >= rect.y &&
        cy <= rect.y + rect.height
      );
    })
    .nodes();
}

function hasAnyModifier(event) {
  return Boolean(event?.ctrlKey || event?.shiftKey || event?.altKey || event?.metaKey);
}

function matchesModifier(event, modifierKey) {
  if (!modifierKey) return !hasAnyModifier(event);
  const pointer = event?.changedTouches ? event.changedTouches[0] : event;
  switch (String(modifierKey).toLowerCase()) {
    case "ctrl":
      return Boolean(pointer?.ctrlKey);
    case "shift":
      return Boolean(pointer?.shiftKey);
    case "alt":
      return Boolean(pointer?.altKey);
    case "meta":
    case "cmd":
    case "command":
      return Boolean(pointer?.metaKey);
    default:
      return false;
  }
}

function getLayerLocalPoint(layer, event) {
  const pointer = event?.changedTouches ? event.changedTouches[0] : event;
  const graphic = layer?.getGraphic?.();
  if (!pointer || !graphic?.getBoundingClientRect) return null;
  const bbox = graphic.getBoundingClientRect();
  return {
    clientX: pointer.clientX,
    clientY: pointer.clientY,
    localX: pointer.clientX - bbox.left,
    localY: pointer.clientY - bbox.top,
    event: pointer,
  };
}

function buildGeometryPayload(instrument, layer, event, clear = false) {
  const pointer = event?.changedTouches ? event.changedTouches[0] : event;
  if (!pointer) return null;
  if (clear) {
    return {
      x: 0,
      y: 0,
      offsetx: 0,
      offsety: 0,
      width: 0,
      height: 0,
      currentx: pointer.clientX,
      currenty: pointer.clientY,
      endx: pointer.clientX,
      endy: pointer.clientY,
      event: pointer,
    };
  }

  const startx = instrument.getSharedVar("startx");
  const starty = instrument.getSharedVar("starty");
  const startoffsetx = instrument.getSharedVar("startlocalx");
  const startoffsety = instrument.getSharedVar("startlocaly");
  const localPoint = getLayerLocalPoint(layer, event);
  if (!localPoint) return null;
  const x = Math.min(startx, pointer.clientX);
  const y = Math.min(starty, pointer.clientY);
  const diffx = pointer.clientX - startx;
  const diffy = pointer.clientY - starty;
  const offsetx = Math.min(startoffsetx, localPoint.localX);
  const offsety = Math.min(startoffsety, localPoint.localY);
  const width = Math.abs(diffx);
  const height = Math.abs(diffy);

  return {
    x,
    y,
    offsetx,
    offsety,
    width,
    height,
    currentx: pointer.clientX,
    currenty: pointer.clientY,
    event: pointer,
  };
}

function pushBrushGeometryToService(instrument, layer, event, clear = false) {
  const geometryServiceName = instrument.getSharedVar("geometryServiceName");
  const geometryService = instrument.services.find(geometryServiceName);
  const payload = buildGeometryPayload(instrument, layer, event, clear);
  if (!geometryService || !payload) return;
  geometryService.setSharedVars(payload, { layer });
}

function registerExampleBrushInstrument(name, modifierKey) {
  Libra.Instrument.register(name, {
    constructor: Libra.Instrument,
    interactors: ["MouseTraceInteractor", "TouchTraceInteractor"],
    on: {
      dragstart: [
        async ({ event, layer, instrument }) => {
          if (!matchesModifier(event, modifierKey)) {
            instrument.setSharedVar("interactionValid", false);
            return;
          }

          instrument.setSharedVar("interactionValid", true);
          const localPoint = getLayerLocalPoint(layer, event);
          if (!localPoint) return;

          instrument.setSharedVar("startx", localPoint.clientX);
          instrument.setSharedVar("starty", localPoint.clientY);
          instrument.setSharedVar("startlocalx", localPoint.localX);
          instrument.setSharedVar("startlocaly", localPoint.localY);
          pushBrushGeometryToService(instrument, layer, event);
        },
      ],
      drag: [
        async ({ event, layer, instrument }) => {
          if (!instrument.getSharedVar("interactionValid")) return;
          if (!matchesModifier(event, modifierKey)) return;
          pushBrushGeometryToService(instrument, layer, event);
        },
      ],
      dragend: [
        async ({ event, layer, instrument }) => {
          if (!instrument.getSharedVar("interactionValid")) return;
          if (!matchesModifier(event, modifierKey)) {
            pushBrushGeometryToService(instrument, layer, event, true);
            instrument.emit("brushabort", { event, layer, instrument });
            return;
          }
          pushBrushGeometryToService(instrument, layer, event);
          Libra.Command.initialize("Log", { execute() {} }).execute({ event, layer, instrument });
        },
      ],
      dragabort: [
        async ({ event, layer, instrument }) => {
          pushBrushGeometryToService(instrument, layer, event, true);
          instrument.emit("brushabort", { event, layer, instrument });
        },
      ],
    },
  });
}

async function renderNativeLibraPanel(mountNode) {
  const {
    fieldColor,
    color,
    mainLayer,
  } = await createCarsScatterScene(mountNode, "composedDoubleGroupSelectionNativeMainLayer");

  const runtime = {
    brushes: {
      primary: { rect: null, nodes: [], fill: "#5c5c5c", opacity: 0.3 },
      secondary: { rect: null, nodes: [], fill: "#ff6b6b", opacity: 0.3 },
    },
  };

  const geometryServiceName = "NativeBrushGeometryService";
  const serviceName = "NativeDoubleBrushIntersectionService";
  const transformerName = "NativeDoubleBrushTransformer";
  const primaryInstrumentName = "PrimaryBrushInstrument";
  const secondaryInstrumentName = "SecondaryBrushInstrument";

  registerExampleBrushInstrument(primaryInstrumentName, null);
  registerExampleBrushInstrument(secondaryInstrumentName, "ctrl");

  Libra.Service.register(geometryServiceName, {
    evaluate(options = {}) {
      const self = options.self;
      const layer = options.layer ?? self?._layerInstances?.[0];
      const rect = resolveBrushRect(options, layer);
      return {
        rect,
        nodes: queryNodesInRect(layer, rect),
      };
    },
  });

  Libra.Service.register(serviceName, {
    evaluate(options = {}) {
      const self = options.self;
      const brushKey = self?.getSharedVar("brushKey") || "primary";
      const currentResult = options.result || {};
      const rect = currentResult.rect || null;
      const nodes = Array.isArray(currentResult.nodes) ? currentResult.nodes : [];

      runtime.brushes[brushKey] = {
        ...runtime.brushes[brushKey],
        rect,
        nodes,
      };

      return {
        nodes: unionNodes(runtime.brushes.primary.nodes, runtime.brushes.secondary.nodes),
        brushes: runtime.brushes,
        hasActiveBrush: Boolean(runtime.brushes.primary.rect || runtime.brushes.secondary.rect),
      };
    },
  });

  Libra.GraphicalTransformer.register(transformerName, {
    redraw({ layer, transformer }) {
      const result = transformer.getSharedVar("result") || {};
      const selectedNodes = Array.isArray(result.nodes) ? result.nodes : [];
      const hasActiveBrush = Boolean(result.hasActiveBrush);
      const pointSelection = d3.select(layer.getGraphic()).selectAll("circle.mark");

      pointSelection
        .attr("fill", "white")
        .attr("fill-opacity", 1)
        .attr("stroke-width", 1)
        .attr("stroke", (d) => color(d[fieldColor]))
        .attr("opacity", hasActiveBrush ? 0.22 : 1);

      if (selectedNodes.length) {
        d3.selectAll(selectedNodes)
          .attr("fill", (d) => color(d[fieldColor]))
          .attr("stroke", (d) => color(d[fieldColor]))
          .attr("opacity", 1);
      }

      const selectionLayer = layer.getLayerFromQueue("selectionLayer");
      const overlay = d3.select(selectionLayer.getGraphic());
      overlay.style("pointer-events", "none");
      overlay.selectAll("*").remove();

      Object.values(result.brushes || {}).forEach((brush) => {
        if (!brush?.rect) return;
        overlay
          .append("rect")
          .attr("x", brush.rect.x)
          .attr("y", brush.rect.y)
          .attr("width", brush.rect.width)
          .attr("height", brush.rect.height)
          .attr("fill", brush.fill)
          .attr("opacity", brush.opacity)
          .attr("stroke", "none");
      });
    },
  });

  const intersectionTransformer = Libra.GraphicalTransformer.initialize(transformerName, {
    layer: mainLayer,
    sharedVar: {
      result: {
        nodes: [],
        brushes: runtime.brushes,
        hasActiveBrush: false,
      },
    },
  });

  const buildBrushFlow = (brushKey) => ([
    {
      name: `${brushKey}GeometryService`,
      comp: geometryServiceName,
    },
    {
      name: `${brushKey}IntersectionService`,
      comp: serviceName,
      sharedVar: {
        brushKey,
      },
    },
    intersectionTransformer,
  ]);

  Libra.Interaction.build({
    inherit: primaryInstrumentName,
    layers: [mainLayer],
    sharedVar: {
      geometryServiceName,
    },
    remove: [
      {
        find: "SelectionService",
        cascade: true,
      },
    ],
    insert: [
      {
        find: primaryInstrumentName,
        flow: buildBrushFlow("primary"),
      },
    ],
  });

  Libra.Interaction.build({
    inherit: secondaryInstrumentName,
    layers: [mainLayer],
    sharedVar: {
      geometryServiceName,
    },
    remove: [
      {
        find: "SelectionService",
        cascade: true,
      },
    ],
    insert: [
      {
        find: secondaryInstrumentName,
        flow: buildBrushFlow("secondary"),
      },
    ],
  });
}

async function renderVegaLitePanel(mountNode) {
  mountNode.innerHTML = "";

  const width = 370;
  const height = 270;

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    data: { url: "https://vega.github.io/editor/data/cars.json" },
    width,
    height,
    params: [
      {
        name: "brush1",
        select: {
          type: "interval",
          on: "[mousedown[!event.ctrlKey], window:mouseup] > window:mousemove",
          translate: "[mousedown[!event.ctrlKey], window:mouseup] > window:mousemove",
          clear: "dblclick[!event.ctrlKey]",
        },
      },
      {
        name: "brush2",
        select: {
          type: "interval",
          on: "[mousedown[event.ctrlKey], window:mouseup] > window:mousemove",
          translate: "[mousedown[event.ctrlKey], window:mouseup] > window:mousemove",
          clear: "dblclick[event.ctrlKey]",
          mark: { stroke: "red", fill: "red", fillOpacity: 0.1 },
        },
      },
    ],
    mark: "point",
    encoding: {
      x: { field: "Horsepower", type: "quantitative" },
      y: { field: "Miles_per_Gallon", type: "quantitative" },
      color: {
        condition: {
          test: { or: [{ param: "brush1" }, { param: "brush2" }] },
          field: "Cylinders",
          type: "ordinal",
        },
        value: "lightgrey",
      },
    },
  };

  await vegaEmbed(mountNode, spec, {
    actions: false,
    renderer: "svg",
  });
}

async function renderD3Panel(mountNode) {
  const DEFAULT_MARGIN = { top: 30, right: 70, bottom: 40, left: 60 };
  const DEFAULT_WIDTH = 500 - DEFAULT_MARGIN.left - DEFAULT_MARGIN.right;
  const DEFAULT_HEIGHT = 340 - DEFAULT_MARGIN.top - DEFAULT_MARGIN.bottom;
  const g = typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : {});
  const fieldX = g.FIELD_X || "Horsepower";
  const fieldY = g.FIELD_Y || "Miles_per_Gallon";
  const fieldColor = g.FIELD_COLOR || "Origin";
  const margin = DEFAULT_MARGIN;
  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;

  const rawData = await d3.json("https://raw.githubusercontent.com/vega/vega/main/docs/data/cars.json");
  const data = rawData.filter((d) => !!(d?.[fieldX] && d?.[fieldY]));

  mountNode.innerHTML = "";

  const svg = d3
    .select(mountNode)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);

  const root = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

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

  const legendItem = legend.append("g").selectAll("g").data(legendDomain).join("g");
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
  const circles = plot
    .selectAll("circle.mark")
    .data(data)
    .join("circle")
    .attr("class", "mark")
    .attr("fill", "white")
    .attr("fill-opacity", 1)
    .attr("stroke-width", 1)
    .attr("stroke", (d) => color(d[fieldColor]))
    .attr("cx", (d) => x(d[fieldX]))
    .attr("cy", (d) => y(d[fieldY]))
    .attr("r", 4);

  const brushLayer = plot.append("g").style("pointer-events", "none");
  const overlay = plot
    .append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "transparent")
    .style("cursor", "crosshair");

  const brushes = {
    primary: { rect: null, nodes: [] },
    secondary: { rect: null, nodes: [] },
  };

  function updateHighlight() {
    const selected = unionNodes(brushes.primary.nodes, brushes.secondary.nodes);
    const hasBrush = Boolean(brushes.primary.rect || brushes.secondary.rect);

    circles
      .attr("fill", "white")
      .attr("fill-opacity", 1)
      .attr("stroke-width", 1)
      .attr("stroke", (d) => color(d[fieldColor]))
      .attr("opacity", hasBrush ? 0.22 : 1);

    d3.selectAll(selected)
      .attr("fill", (d) => color(d[fieldColor]))
      .attr("stroke", (d) => color(d[fieldColor]))
      .attr("opacity", 1);

    brushLayer.selectAll("*").remove();
    [
      ["primary", "#5c5c5c"],
      ["secondary", "#ff6b6b"],
    ].forEach(([key, fill]) => {
      const rect = brushes[key].rect;
      if (!rect) return;
      brushLayer
        .append("rect")
        .attr("x", rect.x)
        .attr("y", rect.y)
        .attr("width", rect.width)
        .attr("height", rect.height)
        .attr("fill", fill)
        .attr("opacity", 0.3)
        .attr("stroke", "none");
    });
  }

  function setBrushFromPointer(key, startPoint, currentPoint) {
    const rect = {
      x: Math.max(0, Math.min(startPoint[0], currentPoint[0])),
      y: Math.max(0, Math.min(startPoint[1], currentPoint[1])),
      width: Math.min(width, Math.abs(currentPoint[0] - startPoint[0])),
      height: Math.min(height, Math.abs(currentPoint[1] - startPoint[1])),
    };

    brushes[key].rect = rect.width > 0 && rect.height > 0 ? rect : null;
    brushes[key].nodes = circles
      .filter(function filterByBrush() {
        const cx = Number(this.getAttribute("cx"));
        const cy = Number(this.getAttribute("cy"));
        return (
          rect.x <= cx &&
          cx <= rect.x + rect.width &&
          rect.y <= cy &&
          cy <= rect.y + rect.height
        );
      })
      .nodes();

    updateHighlight();
  }

  overlay
    .on("mousedown", (event) => {
      const brushKey = event.ctrlKey ? "secondary" : "primary";
      const startPoint = d3.pointer(event, plot.node());

      d3.select(window)
        .on("mousemove.composed-double-group-d3", (moveEvent) => {
          const currentPoint = d3.pointer(moveEvent, plot.node());
          setBrushFromPointer(brushKey, startPoint, currentPoint);
        })
        .on("mouseup.composed-double-group-d3", () => {
          d3.select(window).on(".composed-double-group-d3", null);
        });
    })
    .on("dblclick", (event) => {
      const brushKey = event.ctrlKey ? "secondary" : "primary";
      brushes[brushKey] = { rect: null, nodes: [] };
      updateHighlight();
    });
}

async function renderPanels(container) {
  const dslMount = container.querySelector("#ComposedDoubleGroupDslMount");
  const libraMount = container.querySelector("#ComposedDoubleGroupLibraMount");
  const vegaLiteMount = container.querySelector("#ComposedDoubleGroupVegaLiteMount");
  const d3Mount = container.querySelector("#ComposedDoubleGroupD3Mount");

  try {
    await renderDslPanel(dslMount);
    setStatus(container, "ComposedDoubleGroupDslStatus", PANEL_HINTS.ComposedDoubleGroupDslStatus);
  } catch (error) {
    setStatus(container, "ComposedDoubleGroupDslStatus", `Failed to mount: ${error.message}`, true);
  }

  try {
    await renderNativeLibraPanel(libraMount);
    setStatus(container, "ComposedDoubleGroupLibraStatus", PANEL_HINTS.ComposedDoubleGroupLibraStatus);
  } catch (error) {
    setStatus(container, "ComposedDoubleGroupLibraStatus", `Failed to mount: ${error.message}`, true);
  }

  try {
    await renderVegaLitePanel(vegaLiteMount);
    setStatus(container, "ComposedDoubleGroupVegaLiteStatus", PANEL_HINTS.ComposedDoubleGroupVegaLiteStatus);
  } catch (error) {
    setStatus(container, "ComposedDoubleGroupVegaLiteStatus", `Failed to mount: ${error.message}`, true);
  }

  try {
    await renderD3Panel(d3Mount);
    setStatus(container, "ComposedDoubleGroupD3Status", PANEL_HINTS.ComposedDoubleGroupD3Status);
  } catch (error) {
    setStatus(container, "ComposedDoubleGroupD3Status", `Failed to mount: ${error.message}`, true);
  }

  await Libra.createHistoryTrack?.();
}

export default async function initComposedDoubleGroupSelectionComparePage() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;

  disposeCodeEditors();
  container.innerHTML = renderPage();
  initCodeEditors(container);
  await renderPanels(container);
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}
