import vegaEmbed from "vega-embed";
import Libra from "libra-vis";

// 兼容示例中的调用：将 vega 规范渲染到容器（使用 SVG 渲染器）
async function vega(container, spec) {
  const result = await vegaEmbed(container, spec, { renderer: "svg", actions: false });
  return result;
}

// local spec variable (avoid globalThis for lint compatibility)
let vegaSpec = {};

async function loadData() {
  vegaSpec = {
    $schema: "https://vega.github.io/schema/vega/v5.json",
    description: "A basic bar chart with brushing",
    width: 200,
    height: 200,
    padding: 5,
    data: [
      {
        name: "source",
        url: "/data/testBar.json",
        transform: [
          {
            type: "filter",
            expr: "datum['x'] != null && datum['y'] != null"
          }
        ]
      }
    ],
    scales: [
      {
        name: "x",
        type: "band", // 将x轴类型改为band以绘制柱状图
        domain: { data: "source", field: "x" },
        range: "width",
        padding: 0.1
      },
      {
        name: "y",
        type: "linear",
        nice: true,
        zero: true,
        domain: { data: "source", field: "y" },
        range: "height"
      }
    ],
    axes: [
      { scale: "x", orient: "bottom", title: "x" },
      { scale: "y", orient: "left", titlePadding: 5, title: "y" }
    ],
    marks: [
      {
        name: "marks",
        type: "rect", // 将标记类型改为rect以绘制柱状
        from: { data: "source" },
        encode: {
          update: {
            x: { scale: "x", field: "x" },
            width: { scale: "x", band: 1, offset: -1 },
            y: { scale: "y", field: "y" },
            y2: { scale: "y", value: 0 },
            fill: { value: "steelblue" }
          }
        }
      }
    ]
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
    group: "role-axis-mark",
    container: svg,
  });
  console.log(mainLayer.getGraphic());
  

  Libra.Interaction.build({
    inherit: "HoverInstrument",
    layers: [mainLayer],
    sharedVar: {
      highlightAttrValues: { "stroke-width": 3, opacity: 0.9 , fill:"red"},
    },
  });
}