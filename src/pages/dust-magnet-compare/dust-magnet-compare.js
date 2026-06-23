import * as d3 from "d3";
import Libra from "libra-vis";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { compileDSL } from "../../scripts/dsl-compiler";

const PANEL_WIDTH = 500;
const PANEL_HEIGHT = 360;
const PANEL_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
const DATA_URL = "/public/data/cars.json";
const DUST_RADIUS = 8;
const MAGNET_SIZE = 50;
const HOVER_COLOR = "greenyellow";

const DSL_CODE = `const interactions = [
  {
    instrument: "move",
    trigger: {
      type: "drag",
      priority: 3,
      stopPropagation: true,
    },
    target: {
      layer: "magnetLayer",
      pointerEvents: "visiblePainted",
    },
    feedback: {},
    customFeedbackFlow: {
      remove: [{ find: "SelectionTransformer" }],
      insert: commonInsertFlows,
    },
  },
  {
    instrument: "pointSelection",
    trigger: {
      type: "click",
      priority: 2,
      stopPropagation: true,
    },
    target: {
      layer: "bgLayer",
    },
    feedback: {},
    customFeedbackFlow: {
      insert: commonInsertFlows,
    },
  },
  {
    instrument: "pointSelection",
    trigger: {
      type: "hover",
      priority: 1,
      stopPropagation: true,
    },
    target: {
      layer: "dustLayer",
    },
    feedback: {
      redrawFunc: {
        highlight: "${HOVER_COLOR}",
      },
    },
  },
];

await compileDSL(interactions, {
  layersByName: { bgLayer, dustLayer, magnetLayer },
}, { execute: true });`;

const NATIVE_LIBRA_CODE = `const dustTransformer = Libra.GraphicalTransformer.initialize(
  "DustTransformer",
  {
    layer: dustLayer,
    sharedVar: { result: data },
    redraw({ transformer }) {
      renderDust(transformer.getSharedVar("result"));
    },
  }
);

const magnetTransformer = Libra.GraphicalTransformer.initialize(
  "MagnetTransformer",
  {
    layer: magnetLayer,
    sharedVar: { result: magnet },
    redraw({ transformer }) {
      renderMagnet(transformer.getSharedVar("result"));
    },
  }
);

const commonInsertFlows = [
  {
    find: "SelectionService",
    flow: [
      {
        comp: "MagnetPositionService",
        name: "MagnetPositionService",
        sharedVar: { magnets: magnet },
        evaluate({ magnets, offsetx, offsety, result }) {
          if (result && result.length) {
            const datum = d3.select(result[0]).datum();
            datum.x = offsetx - 25;
            datum.y = offsety - 25;
          } else if (offsetx && offsety) {
            magnets.push({
              x: offsetx - 25,
              y: offsety - 25,
              property: properties[magnets.length % properties.length],
            });
          }
          return magnets;
        },
      },
      magnetTransformer,
    ],
  },
  {
    find: "MagnetPositionService",
    flow: [
      {
        comp: "DustLayoutService",
        name: "DustLayoutService",
        sharedVar: { result: magnet, dusts: data },
        evaluate({ result: magnets, dusts, self }) {
          cancelAnimationFrame(tickUpdate);

          const copyDusts = JSON.parse(JSON.stringify(dusts));
          for (const magnet of magnets) {
            const extent = d3.extent(copyDusts.map((datum) => datum[magnet.property]));
            for (const dust of copyDusts) {
              let x = dust.x;
              let y = dust.y;
              x += ((magnet.x - x) * dust[magnet.property]) / 100 / extent[1];
              y += ((magnet.y - y) * dust[magnet.property]) / 100 / extent[1];
              dust.x = x;
              dust.y = y;
            }
          }

          tickUpdate = requestAnimationFrame(() =>
            self.setSharedVar("dusts", copyDusts)
          );
          return copyDusts;
        },
      },
      dustTransformer,
    ],
  },
];

Libra.Interaction.build({
  inherit: "DragInstrument",
  layers: [
    { layer: magnetLayer, options: { pointerEvents: "visiblePainted" } },
  ],
  remove: [{ find: "SelectionTransformer" }],
  insert: commonInsertFlows,
});

Libra.Interaction.build({
  inherit: "ClickInstrument",
  layers: [bgLayer],
  insert: commonInsertFlows,
});

Libra.Interaction.build({
  inherit: "HoverInstrument",
  layers: [dustLayer],
  sharedVar: {
    highlightColor: "${HOVER_COLOR}",
  },
});`;

const CODE_EDITOR_ITEMS = [
  {
    hostId: "DustMagnetDslCode",
    fallbackId: "DustMagnetDslCodeFallback",
    value: DSL_CODE,
  },
  {
    hostId: "DustMagnetNativeCode",
    fallbackId: "DustMagnetNativeCodeFallback",
    value: NATIVE_LIBRA_CODE,
  },
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

function renderPage() {
  return `
    <div class="showcase-page showcase-page--compare">
      <header class="showcase-topbar">
        <a class="showcase-brand" href="?page=home">
          <strong>Libra+</strong>
          <span>Dust & Magnet Compare</span>
        </a>
        <nav class="showcase-nav" aria-label="Primary">
          <a href="?page=home">Home</a>
          <a href="?page=gallery">Gallery</a>
          <a href="?page=Dust%26Magnet">Raw Demo</a>
          <a href="?page=dust-magnet-compare" aria-current="page">Compare</a>
        </nav>
      </header>

      <section class="compare-grid">
        ${panelMarkup({
          title: "Libra+",
          mountId: "DustMagnetDslMount",
          statusId: "DustMagnetDslStatus",
          codeId: "DustMagnetDslCode",
          fallbackId: "DustMagnetDslCodeFallback",
          code: DSL_CODE,
        })}
        ${panelMarkup({
          title: "Libra.js",
          mountId: "DustMagnetNativeMount",
          statusId: "DustMagnetNativeStatus",
          codeId: "DustMagnetNativeCode",
          fallbackId: "DustMagnetNativeCodeFallback",
          code: NATIVE_LIBRA_CODE,
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

function cloneDustMagnetData(source) {
  return {
    dusts: source.dusts.map((datum) => ({ ...datum })),
    magnets: source.magnets.map((datum) => ({ ...datum })),
    properties: [...source.properties],
  };
}

async function loadDustMagnetData() {
  const rawData = await d3.json(DATA_URL);
  const data = Array.isArray(rawData) ? rawData : [];
  const properties = [];
  const magnets = [];
  const firstDatum = data[0] || {};

  Object.entries(firstDatum).forEach(([property, value]) => {
    if (typeof value !== "number") return;
    properties.push(property);
    if (magnets.length >= 3) return;

    magnets.push({
      x: PANEL_WIDTH / 2 - Math.pow(-1, magnets.length) * (PANEL_WIDTH / 2 - 100),
      y: PANEL_HEIGHT / 2 - Math.pow(-1, Math.floor(magnets.length / 2)) * (PANEL_HEIGHT / 2 - 100),
      property,
    });
  });

  return {
    dusts: data.slice(0, 50).map((datum) => ({
      ...datum,
      x: PANEL_WIDTH / 2,
      y: PANEL_HEIGHT / 2,
    })),
    magnets,
    properties,
  };
}

function createScene(container, runtimeName, initialData) {
  container.innerHTML = "";

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", PANEL_WIDTH + PANEL_MARGIN.left + PANEL_MARGIN.right)
    .attr("height", PANEL_HEIGHT + PANEL_MARGIN.top + PANEL_MARGIN.bottom)
    .attr("viewBox", `0 0 ${PANEL_WIDTH} ${PANEL_HEIGHT}`);

  const root = svg
    .append("g")
    .attr("transform", `translate(${PANEL_MARGIN.left},${PANEL_MARGIN.top})`);

  const dustLayer = Libra.Layer.initialize("D3Layer", {
    name: `${runtimeName}DustLayer`,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    offset: { x: PANEL_MARGIN.left, y: PANEL_MARGIN.top },
    container: svg.node(),
  });
  const magnetLayer = dustLayer.getLayerFromQueue("magnetLayer");
  const bgLayer = dustLayer.getLayerFromQueue("backgroundLayer");

  dustLayer.setLayersOrder({
    backgroundLayer: 0,
    dustLayer: 1,
    magnetLayer: 2,
  });

  d3.select(root.node()).style("pointer-events", "none");
  d3.select(dustLayer.getGraphic()).attr("class", `${runtimeName}-dust-layer`);
  d3.select(magnetLayer.getGraphic()).attr("class", `${runtimeName}-magnet-layer`);

  d3.select(bgLayer.getGraphic())
    .select("rect")
    .attr("stroke", "#000")
    .attr("fill", "none")
    .attr("opacity", 1);

  const runtime = {
    name: runtimeName,
    container,
    svg,
    dustLayer,
    magnetLayer,
    bgLayer,
    dusts: initialData.dusts,
    magnets: initialData.magnets,
    properties: initialData.properties,
    tickUpdate: null,
  };

  renderDust(runtime);
  renderMagnet(runtime);
  return runtime;
}

function renderDust(runtime, dustData = runtime.dusts) {
  d3.select(runtime.dustLayer.getGraphic())
    .selectAll("circle")
    .data(dustData)
    .join("circle")
    .attr("cx", (datum) => datum.x)
    .attr("cy", (datum) => datum.y)
    .attr("stroke", "#000")
    .attr("fill", "#b9b9b9")
    .attr("r", DUST_RADIUS);
}

function renderMagnet(runtime, magnetData = runtime.magnets) {
  const group = d3
    .select(runtime.magnetLayer.getGraphic())
    .call((selection) => selection.selectChildren().remove())
    .selectAll("g")
    .data(magnetData)
    .enter()
    .append("g");

  group
    .append("rect")
    .attr("x", (datum) => datum.x)
    .attr("y", (datum) => datum.y)
    .attr("width", MAGNET_SIZE)
    .attr("height", MAGNET_SIZE)
    .attr("fill", "orange");

  group
    .append("text")
    .attr("x", (datum) => datum.x + MAGNET_SIZE / 2)
    .attr("y", (datum) => datum.y + MAGNET_SIZE / 2)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("font-size", "11px")
    .text((datum) => datum.property);
}

function createInteractionFlow(runtime, runtimeName) {
  const dustTransformer = Libra.GraphicalTransformer.initialize(
    `${runtimeName}DustTransformer`,
    {
      layer: runtime.dustLayer,
      sharedVar: { result: runtime.dusts },
      redraw({ transformer }) {
        const dusts = transformer.getSharedVar("result");
        renderDust(runtime, dusts);
      },
    }
  );

  const magnetTransformer = Libra.GraphicalTransformer.initialize(
    `${runtimeName}MagnetTransformer`,
    {
      layer: runtime.magnetLayer,
      sharedVar: { result: runtime.magnets },
      redraw({ transformer }) {
        const magnets = transformer.getSharedVar("result");
        renderMagnet(runtime, magnets);
      },
    }
  );

  const magnetPositionServiceName = `${runtimeName}MagnetPositionService`;
  const dustLayoutServiceName = `${runtimeName}DustLayoutService`;

  return [
    {
      find: "SelectionService",
      flow: [
        {
          comp: "MagnetPositionService",
          name: magnetPositionServiceName,
          sharedVar: {
            magnets: runtime.magnets,
          },
          evaluate({ magnets, offsetx, offsety, result }) {
            if (result && result.length) {
              const datum = d3.select(result[0]).datum();
              datum.x = offsetx - MAGNET_SIZE / 2;
              datum.y = offsety - MAGNET_SIZE / 2;
            } else if (Number.isFinite(offsetx) && Number.isFinite(offsety) && runtime.properties.length) {
              magnets.push({
                x: offsetx - MAGNET_SIZE / 2,
                y: offsety - MAGNET_SIZE / 2,
                property: runtime.properties[magnets.length % runtime.properties.length],
              });
            }
            return magnets;
          },
        },
        magnetTransformer,
      ],
    },
    {
      find: magnetPositionServiceName,
      flow: [
        {
          comp: "DustLayoutService",
          name: dustLayoutServiceName,
          sharedVar: { result: runtime.magnets, dusts: runtime.dusts },
          evaluate({ result: magnets, dusts, self }) {
            cancelAnimationFrame(runtime.tickUpdate);

            const nextDusts = dusts.map((datum) => ({ ...datum }));
            for (const magnet of magnets) {
              const extent = d3.extent(nextDusts.map((datum) => datum[magnet.property]));
              const denominator = extent[1] || 1;

              for (const dust of nextDusts) {
                let x = dust.x;
                let y = dust.y;
                x += ((magnet.x - x) * dust[magnet.property]) / 100 / denominator;
                y += ((magnet.y - y) * dust[magnet.property]) / 100 / denominator;
                dust.x = x;
                dust.y = y;
              }
            }

            runtime.tickUpdate = requestAnimationFrame(() => {
              self.setSharedVar("dusts", nextDusts);
            });
            return nextDusts;
          },
        },
        dustTransformer,
      ],
    },
  ];
}

async function renderDslPanel(mountNode, sourceData) {
  const runtime = createScene(
    mountNode,
    "dustMagnetDslCompare",
    cloneDustMagnetData(sourceData)
  );
  const commonInsertFlows = createInteractionFlow(runtime, "dustMagnetDslCompare");

  await compileDSL(
    [
      {
        instrument: "move",
        trigger: {
          type: "drag",
          priority: 3,
          stopPropagation: true,
        },
        target: {
          layer: "magnetLayer",
          pointerEvents: "visiblePainted",
        },
        feedback: {},
        customFeedbackFlow: {
          remove: [{ find: "SelectionTransformer" }],
          insert: commonInsertFlows,
        },
      },
      {
        instrument: "pointSelection",
        trigger: {
          type: "click",
          priority: 2,
          stopPropagation: true,
        },
        target: {
          layer: "bgLayer",
        },
        feedback: {},
        customFeedbackFlow: {
          insert: commonInsertFlows,
        },
      },
      {
        instrument: "pointSelection",
        trigger: {
          type: "hover",
          priority: 1,
          stopPropagation: true,
        },
        target: {
          layer: "dustLayer",
        },
        feedback: {
          redrawFunc: {
            highlight: HOVER_COLOR,
          },
        },
      },
    ],
    {
      layersByName: {
        bgLayer: runtime.bgLayer,
        dustLayer: runtime.dustLayer,
        magnetLayer: runtime.magnetLayer,
      },
    },
    { execute: true }
  );
}

function renderNativeLibraPanel(mountNode, sourceData) {
  const runtime = createScene(
    mountNode,
    "dustMagnetNativeCompare",
    cloneDustMagnetData(sourceData)
  );
  const commonInsertFlows = createInteractionFlow(runtime, "dustMagnetNativeCompare");

  Libra.Interaction.build({
    inherit: "DragInstrument",
    layers: [
      {
        layer: runtime.magnetLayer,
        options: { pointerEvents: "visiblePainted" },
      },
    ],
    remove: [
      {
        find: "SelectionTransformer",
      },
    ],
    insert: commonInsertFlows,
  });

  Libra.Interaction.build({
    inherit: "ClickInstrument",
    layers: [runtime.bgLayer],
    insert: commonInsertFlows,
  });

  Libra.Interaction.build({
    inherit: "HoverInstrument",
    layers: [runtime.dustLayer],
    sharedVar: {
      highlightColor: HOVER_COLOR,
    },
  });
}

async function renderPanels(container) {
  const sourceData = await loadDustMagnetData();
  const panels = [
    {
      mountId: "DustMagnetDslMount",
      statusId: "DustMagnetDslStatus",
      render: renderDslPanel,
      note: "Core-only Dust & Magnet: drag magnets, click blank area to add magnets, hover dust to highlight.",
    },
    {
      mountId: "DustMagnetNativeMount",
      statusId: "DustMagnetNativeStatus",
      render: async (mountNode, data) => renderNativeLibraPanel(mountNode, data),
      note: "Native LIBRA version adapted from the legacy D&M.js flow and scoped to a single compare panel.",
    },
  ];

  for (const panel of panels) {
    const mountNode = container.querySelector(`#${panel.mountId}`);
    if (!mountNode) continue;

    try {
      // eslint-disable-next-line no-await-in-loop
      await panel.render(mountNode, sourceData);
      setStatus(container, panel.statusId, panel.note);
    } catch (error) {
      setStatus(container, panel.statusId, `Failed to mount: ${error.message}`, true);
    }
  }

  await Libra.createHistoryTrack?.();
}

export default async function initDustMagnetComparePage() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;

  disposeCodeEditors();
  container.innerHTML = renderPage();
  initCodeEditors(container);
  await renderPanels(container);
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}
