import vegaEmbed from "vega-embed";
import { assembleVegaLite } from "flint-chart";

const CHART_INPUT = {
  data: {
    values: [
      { year: 2021, revenue: 42, region: "North" },
      { year: 2022, revenue: 56, region: "North" },
      { year: 2023, revenue: 61, region: "North" },
      { year: 2021, revenue: 35, region: "South" },
      { year: 2022, revenue: 47, region: "South" },
      { year: 2023, revenue: 58, region: "South" },
      { year: 2021, revenue: 28, region: "West" },
      { year: 2022, revenue: 40, region: "West" },
      { year: 2023, revenue: 52, region: "West" },
    ],
  },
  semantic_types: {
    year: "Year",
    revenue: "Quantity",
    region: "Category",
  },
  chart_spec: {
    chartType: "Line Chart",
    encodings: {
      x: { field: "year" },
      y: { field: "revenue" },
      color: { field: "region" },
    },
    baseSize: { width: 760, height: 440 },
  },
  theme_spec: "economist",
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPage({ inputText, specText }) {
  return `
    <div class="showcase-page showcase-page--compare flint-static-page">
      <header class="showcase-topbar">
        <a class="showcase-brand" href="?page=home">
          <strong>Libra+</strong>
          <span>Flint Static Example</span>
        </a>
        <nav class="showcase-nav" aria-label="Primary">
          <a href="?page=home">Home</a>
          <a href="?page=gallery">Gallery</a>
          <a href="?page=flint-static" aria-current="page">Flint Static</a>
        </nav>
      </header>

      <section class="compare-grid">
        <article class="compare-panel flint-static-panel flint-static-panel-main">
          <div class="compare-panel-head">
            <h2 class="compare-panel-title">Flint -> Vega-Lite -> SVG</h2>
          </div>

          <div class="compare-panel-section compare-panel-section--stage">
            <div id="FlintStaticMount" class="compare-panel-stage"></div>
            <p class="compare-panel-status">
              这个页面先只验证 Flint 能否作为本地依赖接入 CompilerDemo，并生成一个静态图表。
            </p>
          </div>
        </article>

        <article class="compare-panel flint-static-panel">
          <div class="compare-panel-head">
            <h2 class="compare-panel-title">Flint Input</h2>
          </div>
          <div class="compare-panel-section compare-panel-section--code">
            <pre class="flint-static-code-block">${escapeHtml(inputText)}</pre>
          </div>
        </article>

        <article class="compare-panel flint-static-panel">
          <div class="compare-panel-head">
            <h2 class="compare-panel-title">Compiled Vega-Lite Spec</h2>
          </div>
          <div class="compare-panel-section compare-panel-section--code">
            <pre class="flint-static-code-block">${escapeHtml(specText)}</pre>
          </div>
        </article>
      </section>
    </div>
  `;
}

export default async function initFlintStaticPage() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;

  const spec = assembleVegaLite(CHART_INPUT);
  const inputText = JSON.stringify(CHART_INPUT, null, 2);
  const specText = JSON.stringify(spec, null, 2);

  container.innerHTML = renderPage({ inputText, specText });

  const mountNode = container.querySelector("#FlintStaticMount");
  if (!mountNode) return;

  await vegaEmbed(mountNode, spec, {
    actions: false,
    renderer: "svg",
  });

  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}
