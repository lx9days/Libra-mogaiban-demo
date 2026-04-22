import * as d3 from "d3";
import Libra from "libra-vis";
import LibraManager from "../../core/LibraManager";
import { compileDSL } from "../../scripts/dsl-compiler";

const MARGIN = { top: 10, right: 10, bottom: 50, left: 50 };
const WIDTH = 800 - MARGIN.left - MARGIN.right;
const HEIGHT = 800 - MARGIN.top - MARGIN.bottom;
const TICK_COUNT = 5;

export default async function init() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;
  container.innerHTML = "";

  const raw = await d3.csv("./public/data/bezdekIris.csv");
  const fields = ["sepal_length", "sepal_width", "petal_length", "petal_width"];
  const data = raw.map((d) => {
    const r = { ...d };
    for (const f of fields) r[f] = parseFloat(d[f]);
    return r;
  });

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr("viewBox", `0 0 ${WIDTH + MARGIN.left + MARGIN.right} ${HEIGHT + MARGIN.top + MARGIN.bottom}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  // Create layers
  const xAxisLayer = LibraManager.getOrCreateLayer(svg, "xAxisLayer", WIDTH + MARGIN.left + MARGIN.right, MARGIN.bottom, 0, HEIGHT + MARGIN.top);
  const yAxisLayer = LibraManager.getOrCreateLayer(svg, "yAxisLayer", MARGIN.left, HEIGHT + MARGIN.top + MARGIN.bottom);


  // Scales setup
  // We need global scales for reordering logic (mapping names to positions)
  const scaleX = d3.scaleBand()
    .domain(fields)
    .range([0, WIDTH])
    .padding(0.05);

  const scaleY = d3.scaleBand()
    .domain(fields)
    .range([0, HEIGHT])
    .padding(0.05);

  const color = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(data.map((d) => d.class))))
    .range(d3.schemeTableau10);

  const panZoomLinker = createPanZoomLinker();
  const cellLayers = renderSPLOM(svg, xAxisLayer, yAxisLayer, data, fields, scaleX, scaleY, color, panZoomLinker);
  // Mount interaction
  await mountInteraction(svg, xAxisLayer, yAxisLayer, fields, scaleX, scaleY, color, data, cellLayers, panZoomLinker);
}

function createPanZoomLinker() {
  const transformersByLayerName = new Map();
  const layerNamesByXField = new Map();
  const layerNamesByYField = new Map();
  let isPropagating = false;

  const ensureSet = (map, key) => {
    const existing = map.get(key);
    if (existing) return existing;
    const created = new Set();
    map.set(key, created);
    return created;
  };

  return {
    register({ layerName, xField, yField, transformer }) {
      if (!layerName || !transformer) return;
      transformersByLayerName.set(layerName, transformer);
      ensureSet(layerNamesByXField, xField).add(layerName);
      ensureSet(layerNamesByYField, yField).add(layerName);
    },
    propagate({ originLayerName, xField, yField, scaleX: sX, scaleY: sY }) {
      if (isPropagating) return;
      isPropagating = true;
      try {
        const sameColumn = layerNamesByXField.get(xField);
        if (sameColumn && sX) {
          for (const layerName of sameColumn) {
            if (layerName === originLayerName) continue;
            const transformer = transformersByLayerName.get(layerName);
            if (transformer) transformer.setSharedVar("scaleX", sX);
          }
        }

        const sameRow = layerNamesByYField.get(yField);
        if (sameRow && sY) {
          for (const layerName of sameRow) {
            if (layerName === originLayerName) continue;
            const transformer = transformersByLayerName.get(layerName);
            if (transformer) transformer.setSharedVar("scaleY", sY);
          }
        }
      } finally {
        isPropagating = false;
      }
    },
  };
}

function renderSPLOM(svg, xAxisLayer, yAxisLayer, data, fields, scaleX, scaleY, color, panZoomLinker) {
  // Clear layers
  d3.select(xAxisLayer.getGraphic()).selectAll("*").remove();
  d3.select(yAxisLayer.getGraphic()).selectAll("*").remove();

  const cellWidth = scaleX.bandwidth();
  const cellHeight = scaleY.bandwidth();
  const cellClipPadding = 10;
  const defs = svg.selectAll("defs#splom-defs").data([null]).join("defs").attr("id", "splom-defs");
  const xAxisG = d3.select(xAxisLayer.getGraphic()).append("g")
    .attr("transform", `translate(${MARGIN.left},0)`);
  const yAxisG = d3.select(yAxisLayer.getGraphic()).append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
  const cellLayers = {};

  // Compute local scales for each dimension
  const xScales = {};
  const yScales = {};
  fields.forEach(f => {
    xScales[f] = d3.scaleLinear()
      .domain(d3.extent(data, d => d[f]))
      .range([0, cellWidth])
      .nice(TICK_COUNT);
    yScales[f] = d3.scaleLinear()
      .domain(d3.extent(data, d => d[f]))
      .range([cellHeight, 0])
      .nice(TICK_COUNT);
  });

  fields.forEach((xiField) => {
    const cellOffsetX = scaleX(xiField);

    // Draw X Axis labels (only at bottom of the whole chart or per column)
    // In SPLOM, typically labels are on diagonal or outside. 
    // Following original code logic: labels at bottom of the last row
    xAxisG.append("text")
      .text(xiField)
      .attr("class", "col-label") // Added class for easier selection if needed
      .attr("x", cellOffsetX + cellWidth / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px");

    fields.forEach((yiField) => {
      const cellOffsetY = scaleY(yiField);

      const layerName = `cell-${xiField}-${yiField}`;
      const cellLayer = LibraManager.getOrCreateLayer(
        svg,
        layerName,
        cellWidth,
        cellHeight,
        MARGIN.left + cellOffsetX,
        MARGIN.top + cellOffsetY
      );
      cellLayers[layerName] = cellLayer;
      const cell = d3.select(cellLayer.getGraphic());
      cell.selectAll("*").remove();

      // Draw frame
      cell.append("rect")
        .attr("width", cellWidth)
        .attr("height", cellHeight)
        .attr("fill", "none")
        .attr("stroke", "#ddd");

      // Draw points
      const localX = xScales[xiField];
      const localY = yScales[yiField];

      const drawCell = (sX, sY) => {
        const lx = sX || localX;
        const ly = sY || localY;
        const clipId = `splom-clip-${layerName}`;
        const clipPath = defs.selectAll(`clipPath#${clipId}`).data([null]).join("clipPath").attr("id", clipId);
        clipPath.selectAll("rect")
          .data([null])
          .join("rect")
          .attr("x", -cellClipPadding)
          .attr("y", -cellClipPadding)
          .attr("width", cellWidth + cellClipPadding * 2)
          .attr("height", cellHeight + cellClipPadding * 2);

        cell.selectAll("*").remove();
        cell.append("rect")
          .attr("width", cellWidth)
          .attr("height", cellHeight)
          .attr("fill", "none")
          .attr("stroke", "#ddd");

        const pointsG = cell.append("g").attr("clip-path", `url(#${clipId})`);
        
        if (xiField === yiField) {
          const bins = d3.bin()
            .domain(lx.domain())
            .value(d => d[xiField])
            .thresholds(lx.ticks(15))(data);
            
          const histY = d3.scaleLinear()
            .domain([0, d3.max(bins, d => d.length)])
            .range([cellHeight, 0])
            .nice();

          pointsG.selectAll("rect.bar")
            .data(bins)
            .join("rect")
            .attr("class", "bar")
            .attr("x", d => lx(d.x0) + 1)
            .attr("y", d => histY(d.length))
            .attr("width", d => Math.max(0, lx(d.x1) - lx(d.x0) - 1))
            .attr("height", d => Math.max(0, cellHeight - histY(d.length)))
            .attr("fill", "#4e79a7")
            .attr("fill-opacity", 0.7);
        } else {
          pointsG.selectAll("circle")
            .data(data)
            .join("circle")
            .attr("r", 3)
            .attr("cx", (d) => lx(d[xiField]))
            .attr("cy", (d) => ly(d[yiField]))
            .attr("fill", (d) => color(d.class))
            .attr("fill-opacity", 0.3);
        }

        const axesG = cell.append("g");
        axesG.append("g")
          .attr("transform", `translate(0,${cellHeight})`)
          .call(d3.axisBottom(lx).ticks(3).tickSize(3));
          
        if (xiField !== yiField) {
          axesG.append("g").call(d3.axisLeft(ly).ticks(3).tickSize(3));
        }
      };

      drawCell(localX, localY);

      cellLayer.__drawCell = drawCell;
      cellLayer.__panZoomOnRedraw = (sX, sY) => {
        console.log(`panZoomOnRedraw triggered for layer ${layerName}`, { sX: sX?.domain(), sY: sY?.domain() });
        const currentDrawCell = cellLayer.__drawCell;
        if (typeof currentDrawCell === "function") currentDrawCell(sX, sY);
        if (panZoomLinker) {
          panZoomLinker.propagate({
            originLayerName: layerName,
            xField: xiField,
            yField: yiField,
            scaleX: sX,
            scaleY: sY,
          });
        }
      };

      const attached = d3.select(cellLayer.getGraphic()).attr("data-panzoom-attached");
      if (!attached) {
        const panZoomInteractions = [
          {
            instrument: "pan",
            trigger: { type: "pan", priority: 3, modifierKey: "ctrl", stopPropagation: true },
            target: { layer: layerName },
            feedback: {
              context: { scaleX: localX, scaleY: localY, fixRange: true }
            }
          },
          {
            instrument: "zoom",
            trigger: { type: "zoom", priority: 4, modifierKey: "ctrl", stopPropagation: true },
            target: { layer: layerName },
            feedback: {
              context: { scaleX: localX, scaleY: localY, fixRange: true }
            }
          }
        ];
        compileDSL(panZoomInteractions, {
          layersByName: { [layerName]: cellLayer }
        }, { execute: true });
        const geometricTransformer = LibraManager.buildGeometricTransformer(cellLayer, {
          scaleX: localX,
          scaleY: localY,
          redraw: (sX, sY) => {
            const onRedraw = cellLayer.__panZoomOnRedraw;
            if (typeof onRedraw === "function") onRedraw(sX, sY);
          },
        });
        cellLayer.__geometricTransformer = geometricTransformer;
        if (panZoomLinker) {
          panZoomLinker.register({
            layerName,
            xField: xiField,
            yField: yiField,
            transformer: geometricTransformer,
          });
        }
        d3.select(cellLayer.getGraphic()).attr("data-panzoom-attached", "1");
      } else if (panZoomLinker && cellLayer.__geometricTransformer) {
        panZoomLinker.register({
          layerName,
          xField: xiField,
          yField: yiField,
          transformer: cellLayer.__geometricTransformer,
        });
      }
    });
  });

  // Draw Y Axis labels
  fields.forEach((yiField) => {
    const cellOffsetY = scaleY(yiField);
    yAxisG.append("text")
      .text(yiField)
      .attr("class", "row-label") // Added class for easier selection
      .attr("x", -40)
      .attr("y", cellOffsetY + cellHeight / 2)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px")
      .attr("transform", `rotate(-90, -40, ${cellOffsetY + cellHeight / 2})`);
  });
  return cellLayers;
}


async function mountInteraction(svg, xAxisLayer, yAxisLayer, names, scaleX, scaleY, color, data, cellLayers, panZoomLinker) {

  const redrawSPLOM = (newNames, newX, newY) => {
    renderSPLOM(svg, xAxisLayer, yAxisLayer, data, newNames, newX, newY, color, panZoomLinker);
  };

  const cellWidth = scaleX.bandwidth();
  const cellHeight = scaleY.bandwidth();
  const xScales = {};
  const yScales = {};
  names.forEach((f) => {
    xScales[f] = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d[f]))
      .range([0, cellWidth])
      .nice(TICK_COUNT);
    yScales[f] = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d[f]))
      .range([cellHeight, 0])
      .nice(TICK_COUNT);
  });

  const interactions = [
    {
      instrument: "reorder",
      trigger: { type: "drag" },
      target: { layer: "xAxisLayer" },
      feedback: {
        redrawFunc: redrawSPLOM,
        service: {
          reorderDirection: "x"
        },
        feedforward: {
          sourceLayer: Object.values(cellLayers),
          offset: { x: MARGIN.left, y: MARGIN.top }
        },
        context: {
          names,
          scales: { x: scaleX, y: scaleY }
        }
      }
    },
    {
      instrument: "reorder",
      trigger: { type: "drag" },
      target: { layer: "yAxisLayer" },
      feedback: {
        redrawFunc: redrawSPLOM,
        service: {
          reorderDirection: "y"
        },
        feedforward: {
          sourceLayer: Object.values(cellLayers),
          offset: { x: MARGIN.left, y: MARGIN.top }
        },
        context: {
          names,
          scales: { x: scaleX, y: scaleY }
        }
      }
    }
  ];
  const pointSelectionInteractions = [
    // {
    //   instrument: "pointSelection",
    //   trigger: { type: "hover" },
    //   target: { layer: Object.keys(cellLayers), stopPropagation: true, priority: 0 },
    //   feedback: {
    //     redrawFunc: {
    //       highlight: "#ff0000",
    //       tooltip: {
    //         fields: ["class"],
    //         offset: { x: -20 - MARGIN.left, y: -MARGIN.top }
    //       }
    //     }
    //   }
    // }
  ];
  const groupSelectionInteractions = Object.keys(cellLayers)
    .map((layerName) => {
      const match = /^cell-(.+?)-(.+)$/.exec(layerName);
      if (!match) return null;
      const xiField = match[1];
      const yiField = match[2];
      if (xiField === yiField) return null; // 禁用对角线柱状图的刷选
      const sx = xScales[xiField];
      const sy = yScales[yiField];
      if (!sx || !sy) return null;
      return {
        instrument: "groupSelection",
        trigger: { type: "brush", remnantKey: "shift" },
        target: { layer: layerName, stopPropagation: true, priority: 2 },
        feedback: {
          redrawFunc: {
            highlight: { color: (d) => d ? color(d["class"]) : "#00ff1aff" },
          },
          context: {
            scaleX: sx,
            scaleY: sy,
            attrName: [xiField, yiField],
            link: {
              layers: Object.values(cellLayers),
              matchMode: "field",
              defaultOpacity: 0.7,
              baseOpacity: 0.08,
              selectedOpacity: 0.95,
              strokeWidth: 1
            }
          }
        }
      };
    })
    .filter(Boolean);
  await compileDSL(interactions.concat(pointSelectionInteractions, groupSelectionInteractions), {
    layersByName: { xAxisLayer, yAxisLayer, ...cellLayers }
  }, { execute: true });

  await Libra.createHistoryTrack();
}
