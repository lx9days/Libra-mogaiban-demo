import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

const MARGIN = { top: 10, right: 30, bottom: 50, left: 70 };
const WIDTH = 800 - MARGIN.left - MARGIN.right;
const HEIGHT = 600 - MARGIN.top - MARGIN.bottom;

let data = [];
let keys = [];
let stackedData = [];
let yMax = 0;
let stackedV = 0;
let stack = null;
let alignmentBottom = true;

let Style = {
  colors: [
    "#e41a1c",
    "#377eb8",
    "#4daf4a",
    "#984ea3",
    "#ff7f00",
    "#ffff33",
    "#a65628",
    "#f781bf",
  ],
};

let xMain = null;
let yMain = null;
let color = null;

async function loadData() {
  let csv = null;
  try {
    csv = await d3.csv("/public/data/5_OneCatSevNumOrdered_wide.csv", d3.autoType);
  } catch (e) {
    csv = await d3.csv("/data/5_OneCatSevNumOrdered_wide.csv", d3.autoType);
  }
  data = csv.map((d) => ({ ...d, year: +d.year }));
  keys = csv.columns.slice(1);
  
  color = d3.scaleOrdinal().domain(keys).range(Style.colors);

  const stack = d3.stack().keys(keys);
  stackedData = stack(data);
  yMax = d3.max(stackedData, (series) => d3.max(series, (d) => d[1]));
}

function renderStaticVisualization() {
  const svg = d3
    .select("#LibraPlayground")
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr(
      "viewBox",
      `0 0 ${WIDTH + MARGIN.left + MARGIN.right} ${HEIGHT + MARGIN.top + MARGIN.bottom}`,
    )
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  const xDomain = d3.extent(data, (d) => d.year);
  xMain = d3.scaleLinear().domain(xDomain).range([0, WIDTH]);
  yMain = d3.scaleLinear().domain([0, yMax]).range([HEIGHT, 0]);
}

function renderMainVisualization() {
  const svg = d3.select("#LibraPlayground svg");

  const mainLayer = Libra.Layer.initialize("D3Layer", {
    name: "mainLayer",
    width: WIDTH,
    height: HEIGHT,
    offset: { x: MARGIN.left, y: MARGIN.top },
    container: svg.node(),
  });
  const backgroundLayer = mainLayer.getLayerFromQueue("backgroundLayer");
  const g = d3.select(mainLayer.getGraphic()).attr("class", "main");
  g.selectAll("*").remove();
  d3.select(backgroundLayer.getGraphic())
    .append("g")
    .attr("transform", `translate(0,${HEIGHT})`)
    .call(d3.axisBottom(xMain).ticks(6));
  d3.select(backgroundLayer.getGraphic()).append("g").call(d3.axisLeft(yMain));

  drawMainLayer(g, xMain, yMain);

  return mainLayer;
}

function drawMainLayer(g, scaleX, scaleY) {
  /*Param:chartType*/
  g.selectAll("*").remove();

  if (!data || data.length === 0 || !Array.isArray(stackedData) || stackedData.length === 0) return;

  stack = true;

  const area = d3
    .area()
    .x((d) => scaleX(d.data.year))
    .y0((d) => scaleY(d[0]))
    .y1((d) => scaleY(d[1]));

  g.append("g")
    .attr("class", "areas")
    .selectAll("path")
    .data(stackedData, (d) => d.key)
    .join("path")
    .attr("fill", (d) => (color ? color(d.key) : "#999"))
    .attr("opacity", 0.85)
    .attr("d", area);

  const legendX = Math.max(0, WIDTH - 160);
  const legendY = 10;
  const itemH = 18;

  const legend = g.append("g").attr("class", "legend").attr("transform", `translate(${legendX},${legendY})`);
  const getLegendKey = (d) => (typeof d === "string" ? d : d?.id);

  const items = legend
    .selectAll("g")
    .data(keys, (d) => d)
    .join("g")
    .attr("transform", (d, i) => `translate(0,${i * itemH})`)
    .each(function (key) {
      d3.select(this).datum({ id: key });
    });

  items
    .append("rect")
    .attr("x", 0)
    .attr("y", -10)
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", (d) => {
      const key = getLegendKey(d);
      return color ? color(key) : "#999";
    })
    .attr("opacity", 1);

  items
    .append("text")
    .attr("x", 18)
    .attr("y", 0)
    .attr("dominant-baseline", "middle")
    .attr("fill", "#111")
    .attr("opacity", 1)
    .text((d) => getLegendKey(d));
}

async function mountInteraction(layer) {

  Libra.Service.register("IntersectionService", {
    sharedVar: {
      data: data,
    },
    evaluate(options = {}) {
      const self = options.self;
      const optionData = options.data;
      const serviceData = self?.getSharedVar("data");
      const dataValues =
        Array.isArray(optionData) && optionData.length > 0
          ? optionData
          : Array.isArray(serviceData) && serviceData.length > 0
            ? serviceData
            : Array.isArray(data) && data.length > 0
              ? data
              : [];
      const scaleX = options.scaleX ?? self?.getSharedVar("scaleX") ?? xMain;
      const offsetx =
        Number.isFinite(options.offsetx) ? options.offsetx : options.x;
      const layer = options.layer ?? self?.getSharedVar("layer") ?? null;
      const type = options.type ?? self?.getSharedVar("type") ?? "Hover";
      const width =
        Number.isFinite(options.width) ? options.width : self?.getSharedVar("width");

      function interpolateAllAt(data, xVal, opts = {}) {
        if (!Array.isArray(data) || data.length === 0 || !Number.isFinite(xVal)) {
          return {};
        }
        const xKey = opts.xKey ?? "year";
        const keys =
          opts.keys ?? Object.keys(data[0]).filter((k) => k !== xKey);
        if (!Array.isArray(keys) || keys.length === 0) return {};
        const clamp = opts.clamp ?? true;
        const getX = (d) => +d[xKey];
        const bisect = d3.bisector(getX).left;
        let i = bisect(data, xVal);

        if (i <= 0) {
          const out = {};
          const row = data[0];
          stackedV = 0;
          for (const k of keys) {
            const v = +row[k];
            out[k] = { value: v };
            if (stack) {
              stackedV += v;
              out[k].stackedValue = stackedV;
            }
          }
          return clamp ? out : {};
        }
        if (i >= data.length) {
          const out = {};
          const row = data[data.length - 1];
          stackedV = 0;
          for (const k of keys) {
            const v = +row[k];
            out[k] = { value: v };
            if (stack) {
              stackedV += v;
              out[k].stackedValue = stackedV;
            }
          }
          return clamp ? out : {};
        }

        const d0 = data[i - 1];
        const d1 = data[i];
        const x0 = getX(d0);
        const x1 = getX(d1);
        const t = (xVal - x0) / (x1 - x0);

        const out = {};
        const round2 = (v) =>
          Number.isFinite(v) ? Math.round((v + Number.EPSILON) * 100) / 100 : v;
        stackedV = 0;
        for (const k of keys) {
          const y0 = +d0[k],
            y1 = +d1[k];
          const v =
            Number.isFinite(y0) && Number.isFinite(y1)
              ? y0 + (y1 - y0) * t
              : Number.isFinite(y0)
                ? y0
                : Number.isFinite(y1)
                  ? y1
                  : NaN;
          out[k] = { value: round2(v) };
          if (stack) {
            stackedV += v;
            out[k].stackedValue = stackedV;
          }
        }
        return out;
      }

      let result = {};
      if (!scaleX?.invert || !Number.isFinite(offsetx) || !layer) {
        return { lines: {}, type };
      }
      const xVal = scaleX.invert(offsetx - (layer._offset?.x ?? 0));
      const interpolate = interpolateAllAt(dataValues, xVal);
      result.lines = interpolate;
      if (Number.isFinite(width) && width !== 0) {
        const xVal = scaleX.invert(offsetx + width - (layer._offset?.x ?? 0));
        const interpolate2 = interpolateAllAt(dataValues, xVal);
        result.lines2 = interpolate2;
      }
      result.type = type;

      return result;
    },
  });
  Libra.GraphicalTransformer.register("TooltipLineTransformer", {
    transient: true,
    sharedVar: {
      orientation: ["horizontal", "vertical"],
      style: {},
      showIntersection: false,
    },
    redraw({ layer, transformer }) {
      const mainLayer = layer.getLayerFromQueue("mainLayer");
      const orientation = transformer.getSharedVar("orientation");
      const style = transformer.getSharedVar("style");
      const showIntersection = transformer.getSharedVar("showIntersection");
      const x = transformer.getSharedVar("offsetx")
        ? transformer.getSharedVar("offsetx")
        : transformer.getSharedVar("x");
      const y = transformer.getSharedVar("offsety")
        ? transformer.getSharedVar("offsety")
        : transformer.getSharedVar("y");
      // const offsetx = transformer.getSharedVar("offsetx");
      // const offsety = transformer.getSharedVar("offsety");
      // const tooltipConfig = transformer.getSharedVar("tooltip");
      const scaleX = transformer.getSharedVar("scaleX");
      const scaleY = transformer.getSharedVar("scaleY");
      const result = transformer.getSharedVar("result");
      const scaleC = transformer.getSharedVar("scaleColor");
      const width = transformer.getSharedVar("width");
      const lines = result?.lines ? result.lines : null;
      const lines2 = result?.lines2 ? result.lines2 : null;
      const type = result?.type ? result.type : null;
      
      function renderLine(layer, orientation, x, y, style) {
        if (orientation.includes("horizontal") && typeof y === "number") {
          const line = d3
            .select(layer.getGraphic())
            .append("line")
            .attr("x1", 0)
            .attr("x2", layer.getGraphic().getBoundingClientRect().width)
            .attr("y1", y - (layer._offset?.y ?? 0))
            .attr("y2", y - (layer._offset?.y ?? 0))
            .attr("stroke-width", 1)
            .attr("stroke", "#000");
          if (style) {
            Object.entries(style).forEach(([key, value]) => {
              line.attr(key, value);
            });
          }
        }
        if (orientation.includes("vertical") && typeof x === "number") {
          const line = d3
            .select(layer.getGraphic())
            .append("line")
            .attr("y1", 0)
            .attr("y2", layer.getGraphic().getBoundingClientRect().height)
            .attr("x1", x - (layer._offset?.x ?? 0) - 1)
            .attr("x2", x - (layer._offset?.x ?? 0) - 1)
            .attr("stroke-width", 1)
            .attr("stroke", "#000");
          if (style) {
            Object.entries(style).forEach(([key, value]) => {
              line.attr(key, value);
            });
          }
        }
      }
      function renderTooltip(
        root,
        layer,
        x,
        y,
        lines,
        scaleY,
        scaleC,
        alignmentBottom = false,
      ) {
        if (!lines || typeof lines !== "object") return;
        const keys = Object.keys(lines).filter((k) => lines[k] && Number.isFinite(lines[k].value));
        if (keys.length === 0) return;
        const firstLine = lines[keys[0]];
        const yBase =
          alignmentBottom && scaleY && firstLine
            ? scaleY(firstLine.stackedValue ?? firstLine.value)
            : y;

        keys.forEach((key, i) => {
          root
            .append("text")
            .attr("x", x - (layer._offset?.x ?? 0) + 10)
            .attr("y", yBase - (layer._offset?.y ?? 0) - 20 * i)
            .text(`${key}: ${lines[key].value}`)
            .attr("opacity", 1)
            .attr("fill", scaleC ? scaleC(key) : "#0E0")
            .attr("stroke", "#b9b9b9ff")
            .attr("stroke-width", 3)
            .attr("stroke-linejoin", "round")
            .attr("paint-order", "stroke")
            .attr("vector-effect", "non-scaling-stroke");

          root
            .append("circle")
            .attr("cx", x - (layer._offset?.x ?? 0))
            .attr(
              "cy",
              scaleY
                ? scaleY(
                    lines[key].stackedValue
                      ? lines[key].stackedValue
                      : lines[key].value,
                  )
                : y - (layer._offset?.y ?? 0),
            )
            .attr("r", 5)
            .attr("fill", scaleC ? scaleC(key) : "#0E0")
            .attr("opacity", 1)
            .attr("stroke-width", 2)
            .attr("stroke", "#000");
        });
      }

      if (type === "BrushX" && Number.isFinite(x) && width >= 5) {
        renderLine(layer, orientation, x, y, style);
        renderLine(layer, orientation, x + width, y, style);

        const root = d3.select(layer.getGraphic());
        if (showIntersection) {
          renderTooltip(
            root,
            layer,
            x,
            y,
            lines,
            scaleY,
            scaleC,
            (alignmentBottom = true),
          );
          renderTooltip(
            root,
            layer,
            x + width,
            y,
            lines2,
            scaleY,
            scaleC,
            (alignmentBottom = true),
          );
        }
      } else if (type === "Hover" && Number.isFinite(x)) {
        renderLine(layer, orientation, x, y, style);
        const root = d3.select(layer.getGraphic());
        if (showIntersection) {
          renderTooltip(root, layer, x, y, lines, scaleY, scaleC);
        }
      }
    },
  });

  const helperLineHoverFeedback = (opts) => ({
    Remove: [{ find: "SelectionTransformer" }],
    Insert: [
      {
        find: "SelectionService",
        flow: [
          {
            comp: "IntersectionService",
            sharedVar: {
              data,
              scaleX: xMain,
              scaleY: yMain,
              scaleColor: color,
              layer,
              type: "Hover",
            },
          },
        ],
      },
      {
        find: "IntersectionService",
        flow: [
          {
            comp: "TooltipLineTransformer",
            sharedVar: {
              orientation: ["vertical"],
              showIntersection: opts?.showIntersection ?? true, // Default to true if not specified to maintain behavior
            },
          },
        ],
      },
    ],
  });



  const interactions = [
    {
      Name: "HelperLineHover",
      Instrument: "helperLine",
      Trigger: "hover",
      "Target layer": "mainLayer",
      "Feedback options": helperLineHoverFeedback({ showIntersection: true }),
    },
  ];

  await compileInteractionsDSL(interactions, {
    layersByName: { mainLayer: layer },
  });

  if (typeof Libra.createHistoryTrack === "function") {
    await Libra.createHistoryTrack();
  } else if (typeof Libra.createHistoryTrrack === "function") {
    await Libra.createHistoryTrrack();
  }
}

async function main() {
  await loadData();
  renderStaticVisualization();
  let mainLayer = renderMainVisualization();
  await mountInteraction(mainLayer);
}

export default async function init() {
  await main();
}
