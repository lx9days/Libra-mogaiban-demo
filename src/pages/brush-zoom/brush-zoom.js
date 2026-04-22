import Libra from "libra-vis";
import * as d3 from "d3";
import { compileDSL } from "../../scripts/dsl-compiler";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";
import { setupIrisScatter } from "../_shared/irisScatter";

/*
图层追踪机制（Brush Zoom，更新版）
- 覆盖层命中：Zoom 的滚轮缩放需首先命中 selectionLayer/transientLayer 等覆盖层，随后读取并更新选框尺寸；这些队列层需开启指针事件（如 pointerEvents: "visiblePainted"）。
- 反向查找：当 target 仅写队列图层而不写 instrument 时，编译器会按该队列图层在同宿主层上反向查找唯一的 GroupSelection（Brush）instrument 并自动绑定；如候选不唯一，则保留 target.instrument 以消除歧义。
- 推荐：目标指向队列覆盖层（transientLayer/selectionLayer），保证滚轮命中与缩放行为稳定。
*/

export default async function init() {
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

  const url = "https://raw.githubusercontent.com/vega/vega/main/docs/data/cars.json";
  const rawData = await d3.json(url);
  const data = rawData.filter((d) => !!(d?.[fieldX] && d?.[fieldY]));

  const container = document.getElementById("LibraPlayground");
  if (container) container.innerHTML = "";

  const svg = d3
    .select("#LibraPlayground")
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
    .attr("cy", (_, i) => i * 20)
    .attr("r", 5);
  legendItem
    .append("text")
    .attr("font-size", "12px")
    .attr("x", width + 20)
    .attr("y", (_, i) => i * 20 + 5)
    .text((d) => d);

  const mainLayer = Libra.Layer.initialize("D3Layer", {
    name: "mainLayer",
    width,
    height,
    offset: { x: margin.left, y: margin.top },
    container: svg.node(),
  });
  const layerGraphic = d3.select(mainLayer.getGraphic());

  layerGraphic
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
  const interactionsDSL = [
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
          // dim: { opacity: 0.1, selector: ".mark" },
          brushStyle: {
            fill: "#5c5c5cff",
            opacity: 0.3,
            stroke: "none",
          },
        },
      },
    },
    {
      instrument: "Zoom",
      trigger: {
        type: "zoom",
        priority: 2,
        stopPropagation: true,
      },
      target: {
        layer: "transientLayer",
        pointerEvents: "visiblePainted",
      },
      feedback: {
        context: {
          updateBrush: "scale",
          step: 0.18,
          minWidth: 36,
          minHeight: 36,
        },
      },
    },
  ];

  await compileDSL(interactionsDSL, {
    layersByName: { mainLayer },
  }, { execute: true });
  await Libra.createHistoryTrack?.();
}
