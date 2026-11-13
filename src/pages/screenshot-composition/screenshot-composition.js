import * as d3 from "d3";
import Libra from "libra-vis";
import LibraManager from "../../core/LibraManager";
import { compileDSL } from "../../scripts/dsl-compiler";

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
let xScale = d3.scaleLinear();
let yScale = d3.scaleLinear();
let colorScale = null;

/**
 * 加载数据
 */
async function loadData() {
  // 使用项目内数据，保证截图示例无需访问外部数据源
  const url = "./public/data/cars.json";
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
  // Axes share the scales, but must not belong to the selectable mark layer.
  let axes = svg.select(".axes-layer");
  if (axes.empty()) {
    axes = svg.append("g")
      .attr("class", "axes-layer")
      .attr("transform", `translate(${CONFIG.MARGIN.left},${CONFIG.MARGIN.top})`)
      .style("pointer-events", "none");
  }
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
  // Keep the layer bounds anchored at (0, 0) for brush coordinate conversion.
  // Libra excludes this background class from picking, so lenses only see marks.
  g.append("rect")
    .attr("class", "ig-layer-background")
    .attr("width", CONFIG.WIDTH)
    .attr("height", CONFIG.HEIGHT)
    .attr("opacity", 0);
  axes.selectAll("*").remove();

  // 绘制 X 轴
  axes.append("g")
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
  axes.append("g")
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
function createInteractions() {
  const interactions = [
      {
      name: "lensMain",
      instrument: "lens",
      trigger: {
        type: "hover",
        syntheticEvent: "idle",
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
        modifierKey: "none",
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
    {
      instrument: "pan",
      trigger: {
        type: "pan",
        modifierKey: "ctrl",
        priority: 2,
        stopPropagation: true,
      },
      target: { layer: "mainLayer" },
      feedback: {
        context: {
          scaleX: xScale,
          scaleY: yScale,
          fixRange: true,
        },
      },
    },
    {
      instrument: "zoom",
      trigger: {
        type: "zoom",
        modifierKey: "ctrl",
        priority: 3,
        stopPropagation: true,
      },
      target: { layer: "mainLayer" },
      feedback: {
        context: {
          scaleX: xScale,
          scaleY: yScale,
          fixRange: true,
        },
      },
    },
  ];

  return interactions;
}

async function mountInteraction(layer) {
  const interactions = resolveConfig(JSON.parse(decodeURIComponent(location.hash.slice(1))));
  const validation = compileDSL(interactions, { layersByName: { mainLayer: layer } });
  const errors = validation.diagnostics.filter(item => item.level === 'error');
  if (errors.length) throw new Error(errors.map(item => item.message).join('; '));
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
      parent.postMessage({ type: 'screenshot-preview-ready' }, location.origin);
    }
  } catch (err) {
    parent.postMessage({ type: 'screenshot-preview-error', message: err.message }, location.origin);
  }
}

// 执行主函数
function configReferences() {
  const defaults = createInteractions();
  return {
    scaleX: xScale,
    scaleY: yScale,
    labelAccessor: defaults[0].feedback.service.excentricLabeling.labelAccessor,
    colorAccessor: defaults[0].feedback.service.excentricLabeling.colorAccessor,
    highlightColor: defaults[1].feedback.redrawFunc.highlight.color,
  };
}

function resolveConfig(config) {
  if (!Array.isArray(config)) throw new Error('配置必须是交互数组。');
  const refs = configReferences();
  return JSON.parse(JSON.stringify(config), (key, value) => {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      throw new Error(`不支持的字段：${key}`);
    }
    if (value && typeof value === 'object' && Object.hasOwn(value, '$ref')) {
      if (Object.keys(value).length !== 1 || !Object.hasOwn(refs, value.$ref)) {
        throw new Error(`未知引用：${value.$ref}`);
      }
      return refs[value.$ref];
    }
    return value;
  });
}

let cancelPendingPreview = null;
export const liveEditor = {
  cancel() {
    if (cancelPendingPreview) cancelPendingPreview();
  },
  initialValue() {
    return JSON.parse(JSON.stringify(createInteractions(), (key, value) => {
      if (typeof value !== 'function') return value;
      return { $ref: key === 'color' ? 'highlightColor' : key };
    }));
  },
  apply(config) {
    if (cancelPendingPreview) cancelPendingPreview();
    resolveConfig(config);
    const root = document.getElementById('LibraPlayground');
    const frame = document.createElement('iframe');
    frame.title = '实时交互预览';
    frame.className = 'screenshot-preview-frame';
    frame.style.visibility = 'hidden';
    frame.style.position = 'absolute';
    frame.src = `?page=screenshot-composition&livePreview=1#${encodeURIComponent(JSON.stringify(config))}`;
    return new Promise((resolve, reject) => {
      let timer;
      const cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener('message', receive);
        if (cancelPendingPreview === cancel) cancelPendingPreview = null;
      };
      const fail = (message) => {
        cleanup();
        frame.remove();
        reject(new Error(message));
      };
      const cancel = () => fail('已被更新的配置替代');
      const receive = (event) => {
        if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
        if (event.data?.type === 'screenshot-preview-error') fail(event.data.message);
        if (event.data?.type === 'screenshot-preview-ready') {
          cleanup();
          frame.style.visibility = '';
          frame.style.position = '';
          root.replaceChildren(frame);
          resolve();
        }
      };
      cancelPendingPreview = cancel;
      window.addEventListener('message', receive);
      timer = setTimeout(() => fail('预览加载超时，请修改配置重试。'), 30000);
      root.append(frame);
    });
  },
};

export const previewOnly = new URLSearchParams(location.search).has('livePreview');
if (previewOnly) {
  document.body.classList.add('screenshot-live-preview');
  main();
}


