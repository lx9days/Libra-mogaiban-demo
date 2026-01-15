import vegaEmbed from "vega-embed";
import Libra from "libra-vis";

// 兼容示例中的调用：将 vega 规范渲染到容器（使用 SVG 渲染器）
async function vega(container, spec) {
  const {result, vgSpec, view} = await vegaEmbed(container, spec, { renderer: "svg", actions: false });
  console.log(vgSpec);
  console.log(view);
  return result;
}

// local spec variable (avoid globalThis for lint compatibility)
let vegaSpec = {};

async function loadData() {
  vegaSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    description: "A simple bar chart with embedded data.",
    data: {
      values: [
        { a: "A", b: 28 },
        { a: "B", b: 55 },
        { a: "C", b: 43 },
        { a: "D", b: 91 },
        { a: "E", b: 81 },
        { a: "F", b: 53 },
        { a: "G", b: 19 },
        { a: "H", b: 87 },
        { a: "I", b: 52 }
      ]
    },
    mark: "bar",
    encoding: {
      x: { field: "a", type: "nominal", axis: { labelAngle: 0 } },
      y: { field: "b", type: "quantitative" }
    }
  };
}

async function renderStaticVisualization() {
  // render vega spec on screen
  await vega(document.getElementById("LibraPlayground"), vegaSpec);
  mountInteraction();
}

export default function init() {
  const container = document.getElementById("LibraPlayground");
  if (container) container.innerHTML = "";
  loadData().then(renderStaticVisualization);
}

function mountInteraction() {
  const svg = document.querySelector("#LibraPlayground svg");

  const mainLayer = Libra.Layer.initialize("VegaLayer", {
    name: "mainLayer",
    group: "role-mark",
    container: svg,
  });
  console.log(mainLayer.getGraphic());
  

  Libra.Interaction.build({
    inherit: "BrushInstrument",
    layers: [mainLayer],
    sharedVar: {
      highlightAttrValues: { "stroke-width": 3, opacity: 0.9 , fill:"red"},
    },
  });
}