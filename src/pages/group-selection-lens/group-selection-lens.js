import * as d3 from "d3";
import Libra from "libra-vis";
import LibraManager from "../../core/LibraManager";
import { compileDSL } from "../../scripts/dsl-compiler";
import excentricLabeling from "excentric-labeling";
// 全局安全对象获取
const g = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {};

const CONFIG = {
  MARGIN: { top: 30, right: 70, bottom: 40, left: 60 },
  WIDTH: 500 - 60 - 70, // 减去左、右边距
  HEIGHT: 380 - 30 - 40, // 减去上、下边距
  FIELD_X: "Horsepower",
  FIELD_Y: "Miles_per_Gallon",
  FIELD_COLOR: g.FIELD_COLOR || "Origin",
};

// 状态变量
let dataset = [];
let xScale = null;
let yScale = null;
let colorScale = null;

/**
 * 加载数据
 */
async function loadData() {
  // 使用公开的 JSON 数据源以便演示运行
  const url = "https://raw.githubusercontent.com/vega/vega/main/docs/data/cars.json";
  const rawData = await d3.json(url);
  dataset = rawData.filter(
    (d) => !!(d[CONFIG.FIELD_X] && d[CONFIG.FIELD_Y])
  );
}

/**
 * 渲染静态背景（SVG 容器、剪切路径、图例）
 */
function renderStaticVisualization() {
  // 选择或创建容器
  const container = d3.select("#LibraPlayground");
  if (container.empty()) {
    d3.select("body").append("div").attr("id", "LibraPlayground");
  }

  const svg = d3
    .select("#LibraPlayground")
    .append("svg")
    .attr("width", CONFIG.WIDTH + CONFIG.MARGIN.left + CONFIG.MARGIN.right)
    .attr("height", CONFIG.HEIGHT + CONFIG.MARGIN.top + CONFIG.MARGIN.bottom)
    .append("g")
    .attr("transform", `translate(${CONFIG.MARGIN.left},${CONFIG.MARGIN.top})`);

  // 定义裁剪区域，防止点溢出到轴外
  svg
    .append("clipPath")
    .attr("id", "clipMainLayer")
    .append("rect")
    .attr("width", CONFIG.WIDTH)
    .attr("height", CONFIG.HEIGHT);

  // 初始化比例尺
  const extentX = [0, d3.max(dataset, (d) => d[CONFIG.FIELD_X])];
  const extentY = [0, d3.max(dataset, (d) => d[CONFIG.FIELD_Y])];

  xScale = d3.scaleLinear().domain(extentX).range([0, CONFIG.WIDTH]).nice();
  yScale = d3.scaleLinear().domain(extentY).range([CONFIG.HEIGHT, 0]).nice();

  colorScale = d3
    .scaleOrdinal()
    .domain(new Set(dataset.map((d) => d[CONFIG.FIELD_COLOR])))
    .range(d3.schemeTableau10);

  // 绘制图例
  const legendG = svg.append("g")
    .attr("transform", `translate(${CONFIG.WIDTH + 10}, 0)`);

  legendG.append("text")
    .text(CONFIG.FIELD_COLOR)
    .attr("fill", "black")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("y", -10);

  const categories = Array.from(new Set(dataset.map((d) => d[CONFIG.FIELD_COLOR])));
  const legendItems = legendG.selectAll(".legend-item")
    .data(categories)
    .enter()
    .append("g")
    .attr("transform", (_, i) => `translate(0, ${i * 20})`);

  legendItems.append("circle")
    .attr("r", 5)
    .attr("stroke", d => colorScale(d))
    .attr("fill", "none")
    .attr("stroke-width", 2);

  legendItems.append("text")
    .text(d => d)
    .attr("x", 12)
    .attr("y", 5)
    .attr("font-size", "12px");
}

/**
 * 渲染主要可视化内容（轴和散点）
 * 此函数会被 Libra 的 Transformer 在交互时反复调用
 */
function renderMainVisualization(currentXScale = xScale, currentYScale = yScale) {
  const svg = d3.select("#LibraPlayground svg");
  let g = svg.select(".main-content-layer");
  let returnVal = null;

  // 如果层不存在，初始化 Libra Layer
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

    // 注册图形转换器
    const transformer = LibraManager.buildGeometricTransformer(mainLayer, {
      scaleX: xScale,
      scaleY: yScale,
      redraw: (sX, sY) => renderMainVisualization(sX, sY),
    });

    returnVal = [mainLayer, transformer];
  }

  // 清除之前绘制的内容重新绘制
  g.selectAll("*").remove();

  // 绘制 X 轴
  g.append("g")
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

  // 绘制 Y 轴
  g.append("g")
    .call(d3.axisLeft(currentYScale))
    .append("text")
    .text(CONFIG.FIELD_Y)
    .attr("fill", "black")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .style("transform", `translate(${-CONFIG.MARGIN.left + 15}px, ${CONFIG.HEIGHT / 2}px) rotate(-90deg)`);

  // 绘制数据点
  g.append("g")
    .attr("clip-path", "url(#clipMainLayer)")
    .selectAll("circle")
    .data(dataset)
    .join("circle")
    .attr("class", "mark")
    .attr("fill", "white")
    .attr("stroke", (d) => colorScale(d[CONFIG.FIELD_COLOR]))
    .attr("cx", (d) => currentXScale(d[CONFIG.FIELD_X]))
    .attr("cy", (d) => currentYScale(d[CONFIG.FIELD_Y]))
    .attr("r", 4);

  // 触发图层更新，驱动交互选区（如 Brush）自动重算
  const mainLayer = Libra.Layer.findLayer("mainLayer")?.[0];
  if (mainLayer) {
    mainLayer.postUpdate();
  }

  return returnVal;
}

/**
 * 挂载交互
 */
async function mountInteraction(layer) {
  const interactions = [
      {
      name: "lensMain",
      instrument: "lens",
      trigger: {
        type: "hover",
        priority: 0,
        stopPropagation: true,
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        service: {
          lens: {
            renderSelection: false,
            r: 40,
            stroke: "#1d8f43",
            strokeWidth: 4,
            fontSize: 12,
            countLabelWidth: 56,
            count: {
              op: "count",
            },
          },
          excentricLabeling: {
            countLabelDistance: 18,
            maxLabelsNum: 12,
            labelAccessor: (elem) => {
              const d = d3.select(elem).datum();
              console.log(123);
              
              return d ? `${d.Name} (${d.Horsepower}, ${d.Miles_per_Gallon})` : "";
            },
            colorAccessor: (elem) => {
              const d = d3.select(elem).datum();
              return d ? colorScale(d[CONFIG.FIELD_COLOR]) : "#ffffffff";
            },
          }
        },
      },
    },
    {
      instrument: "groupSelection",
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
          highlight: {
            color: (d) => d ? colorScale(d[CONFIG.FIELD_COLOR]) : "red",
          },
        },
      },
    },
  ];

  await compileDSL(
    interactions,
    {
      layersByName: { mainLayer: layer },
    },
    { execute: true }
  );

  // 历史记录（撤销/重做）
  if (Libra.createHistoryTrack) {
    await Libra.createHistoryTrack();
  }

  const labelLayer = layer.getLayerFromQueue("LabelLayer");
  const lensLayer = layer.getLayerFromQueue("LensLayer");
  if (labelLayer?.getGraphic) {
    // d3.select(labelLayer.getGraphic()).style("pointer-events", "none");
  }
  if (lensLayer?.getGraphic) {
    // d3.select(lensLayer.getGraphic()).style("pointer-events", "none");
  }
}

/**
 * 主入口
 */
async function main() {
  try {
    await loadData();
    renderStaticVisualization();
    const result = renderMainVisualization();
    if (result) {
      const [layer] = result;
      await mountInteraction(layer);
    }
  } catch (err) {
    console.error("初始化可视化失败:", err);
  }
}

// 执行主函数
main();
