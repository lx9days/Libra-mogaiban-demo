import * as d3 from "d3";
import Libra from "libra-vis";
import LibraManager from "../../core/LibraManager";
import { compileDSL } from "../../scripts/dsl-compiler";

const CONFIG = {
  MARGIN: { top: 30, right: 70, bottom: 40, left: 60 },
  WIDTH: 500 - 60 - 70,
  HEIGHT: 380 - 30 - 40,
  FIELD_X: "Horsepower",
  FIELD_Y: "Miles_per_Gallon",
  FIELD_COLOR: "Origin",
};

let dataset = [];
let xScale = null;
let yScale = null;
let colorScale = null;

/*
图层追踪机制（Lens Zoom，更新版）
- Lens（悬停）：在宿主 mainLayer 上注册 HoverInstrument，并将覆盖元素绘制到队列层 LensLayer。
- Zoom（滚轮缩放半径）：应绑定宿主 mainLayer。滚轮事件在绑定图层处理，更新绑定键(bindingKey)对应的镜头状态，并向宿主层派发刷新事件；绑定到 LensLayer 不会驱动宿主层的 HoverInstrument。
- 反向查找：当未显式提供 bindingKey 时，编译器会在同宿主层上反查唯一的 Lens 实例并自动绑定；多 Lens 场景下可显式提供 bindingKey 以消除歧义。
*/
async function loadData() {
  const url = "https://raw.githubusercontent.com/vega/vega/main/docs/data/cars.json";
  const rawData = await d3.json(url);
  dataset = rawData
    .filter((d) => !!(d[CONFIG.FIELD_X] && d[CONFIG.FIELD_Y]));
    // .slice(0, 10);
}

function renderStaticVisualization() {
  const container = document.getElementById("LibraPlayground");
  if (container) {
    container.innerHTML = "";
  }

  const svg = d3
    .select("#LibraPlayground")
    .append("svg")
    .attr("width", CONFIG.WIDTH + CONFIG.MARGIN.left + CONFIG.MARGIN.right)
    .attr("height", CONFIG.HEIGHT + CONFIG.MARGIN.top + CONFIG.MARGIN.bottom);

  const g = svg.append("g")
    .attr("transform", `translate(${CONFIG.MARGIN.left},${CONFIG.MARGIN.top})`)
    .attr("class", "static-background-layer");

  g
    .append("clipPath")
    .attr("id", "clipMainLayer")
    .append("rect")
    .attr("width", CONFIG.WIDTH)
    .attr("height", CONFIG.HEIGHT);

  const extentX = [0, d3.max(dataset, (d) => d[CONFIG.FIELD_X])];
  const extentY = [0, d3.max(dataset, (d) => d[CONFIG.FIELD_Y])];

  xScale = d3.scaleLinear().domain(extentX).range([0, CONFIG.WIDTH]).nice();
  yScale = d3.scaleLinear().domain(extentY).range([CONFIG.HEIGHT, 0]).nice();

  colorScale = d3
    .scaleOrdinal()
    .domain(new Set(dataset.map((d) => d[CONFIG.FIELD_COLOR])))
    .range(d3.schemeTableau10);

  const legendG = g
    .append("g")
    .attr("transform", `translate(${CONFIG.WIDTH + 10}, 0)`);

  legendG
    .append("text")
    .text(CONFIG.FIELD_COLOR)
    .attr("fill", "black")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("y", -10);

  const categories = Array.from(new Set(dataset.map((d) => d[CONFIG.FIELD_COLOR])));
  const legendItems = legendG
    .selectAll(".legend-item")
    .data(categories)
    .enter()
    .append("g")
    .attr("transform", (_, i) => `translate(0, ${i * 20})`);

  legendItems
    .append("circle")
    .attr("r", 5)
    .attr("stroke", (d) => colorScale(d))
    .attr("fill", "white")
    .attr("stroke-width", 2);

  legendItems
    .append("text")
    .text((d) => d)
    .attr("x", 12)
    .attr("y", 5)
    .attr("font-size", "12px");

  // No static axes added to background here anymore
}

function renderAxes(currentXScale = xScale, currentYScale = yScale, container) {
  const g = container || d3.select("#LibraPlayground svg g.static-background-layer");

  const axisX = g.selectAll(".static-axis-x").data([null]).join("g").attr("class", "static-axis-x");
  axisX.selectAll("*").remove();
  axisX
    .attr("transform", `translate(0,${CONFIG.HEIGHT})`)
    .call(d3.axisBottom(currentXScale))
    .append("text")
    .text(CONFIG.FIELD_X)
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("x", CONFIG.WIDTH / 2)
    .attr("y", 35);

  const axisY = g.selectAll(".static-axis-y").data([null]).join("g").attr("class", "static-axis-y");
  axisY.selectAll("*").remove();
  axisY
    .call(d3.axisLeft(currentYScale))
    .append("text")
    .text(CONFIG.FIELD_Y)
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .style(
      "transform",
      `translate(${-CONFIG.MARGIN.left + 15}px, ${CONFIG.HEIGHT / 2}px) rotate(-90deg)`
    );
}

function renderMainVisualization(
  currentXScale = xScale,
  currentYScale = yScale,
  hostLayer = null
) {
  const svg = d3.select("#LibraPlayground svg");
  let g = svg.select(".main-content-layer");
  let returnVal = null;
  let activeLayer = hostLayer;

  if (g.empty()) {
    const mainLayer = Libra.Layer.initialize("D3Layer", {
      name: "mainLayer",
      width: CONFIG.WIDTH,
      height: CONFIG.HEIGHT,
      offset: { x: CONFIG.MARGIN.left, y: CONFIG.MARGIN.top },
      container: svg.node(),
    });

    g = d3.select(mainLayer.getGraphic());
    g.attr("class", "main-content-layer");
    
    activeLayer = mainLayer;

    const transformer = LibraManager.buildGeometricTransformer(mainLayer, {
      scaleX: xScale,
      scaleY: yScale,
      redraw: (sX, sY) => renderMainVisualization(sX, sY, mainLayer),
    });

    returnVal = [mainLayer, transformer];
  }

  // Clear only the main content layer
  g.selectAll("*").remove();
  
  renderAxes(currentXScale, currentYScale);

  g
    .attr("clip-path", "url(#clipMainLayer)")
    .selectAll("circle")
    .data(dataset)
    .join("circle")
    .attr("class", "mark")
    .attr("fill", "none")
    .attr("stroke", (d) => colorScale(d[CONFIG.FIELD_COLOR]))
    .attr("stroke-width", 1.5)
    .attr("cx", (d) => currentXScale(d[CONFIG.FIELD_X]))
    .attr("cy", (d) => currentYScale(d[CONFIG.FIELD_Y]))
    .attr("r", 4);

  if (activeLayer) {
    activeLayer.postUpdate();
  }

  return returnVal;
}

async function mountInteraction(layer) {
  const interactions = [
    {
      name: "lensMain",
      instrument: "lens",
      trigger: {
        type: "hover",
        priority: 1,
        stopPropagation: true,
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        service: {
          lens: {
            renderSelection: false,
            r: 36,
            stroke: "#1d8f43",
            strokeWidth: 2,
            fontSize: 12,
            countLabelWidth: 56,
          },
          excentricLabeling: {
            countLabelDistance: 18,
            maxLabelsNum: 1,
            labelAccessor: (elem) => {
              const datum = d3.select(elem).datum();
              return `${datum.Name} (${datum.Horsepower}, ${datum.Miles_per_Gallon})`;
            },
            // colorAccessor: (elem) => colorScale(d3.select(elem).datum()[CONFIG.FIELD_COLOR]),
            // filter: (elem) => {
            //   return d3.select(elem).datum().Origin === "Europe";
            //   // return false;
            // },
          },
        },
      },
    },
    // {
    //   instrument: "zoom",
    //   trigger: {
    //     type: "zoom",
    //     priority: 2,
    //     stopPropagation: true,
    //   },
    //   target: {
    //     layer: "mainLayer",
    //   },
    //   feedback: {
    //     lens: {
    //       zoom: {
    //         step: 3,
    //         minR: 12,
    //         maxR: 96,
    //       }
    //     },
    //   },
    // },
  ];

  await compileDSL(
    interactions,
    { layersByName: { mainLayer: layer } },
    { execute: true }
  );

  // const labelLayer = layer.getLayerFromQueue("LabelLayer");
  // const lensLayer = layer.getLayerFromQueue("LensLayer");
  // if (labelLayer?.getGraphic) {
  //   d3.select(labelLayer.getGraphic()).style("pointer-events", "none");
  // }
  // if (lensLayer?.getGraphic) {
  //   d3.select(lensLayer.getGraphic()).style("pointer-events", "none");
  // }

  await Libra.createHistoryTrack?.();
}

export default async function init() {
  await loadData();
  renderStaticVisualization();
  const result = renderMainVisualization();
  if (!result) return;
  const [layer] = result;
  await mountInteraction(layer);
}
