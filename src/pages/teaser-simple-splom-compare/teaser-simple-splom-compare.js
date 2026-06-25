import * as d3 from "d3";
import Libra from "libra-vis";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import vegaEmbed from "vega-embed";
import LibraManager from "../../core/LibraManager";
import { compileDSL } from "../../scripts/dsl-compiler";

const MARGIN = { top: 10, right: 10, bottom: 50, left: 50 };
const WIDTH = 400 - MARGIN.left - MARGIN.right;
const HEIGHT = 400 - MARGIN.top - MARGIN.bottom;
const TICK_COUNT = 5;

const LIBRA_PLUS_CODE = String.raw`import { compileDSL } from "../../scripts/dsl-compiler";

const redrawFromTransform = (transform) => {
  const nextX = transform.rescaleX(localX.copy());
  const nextY = transform.rescaleY(localY.copy());
  const onRedraw = cellLayer.__panZoomOnRedraw;
  if (typeof onRedraw === "function") onRedraw(nextX, nextY);
};

const redrawSPLOM = (newNames, newX, newY) => {
  renderSPLOM(
    svg,
    xAxisLayer,
    yAxisLayer,
    data,
    newNames,
    newX,
    newY,
    color,
    panZoomLinker,
    fieldColor
  );
};

const panZoomInteractions = [
  {
    instrument: "pan",
    trigger: {
      type: "pan",
      modifierKey: "ctrl",
      priority: 3,
      stopPropagation: true,
    },
    target: { layer: layerName },
    feedback: {
      context: {
        scaleX: localX,
        scaleY: localY,
        fixRange: true,
        redraw: redrawFromTransform,
      },
    },
  },
  {
    instrument: "zoom",
    trigger: {
      type: "zoom",
      modifierKey: "ctrl",
      priority: 4,
      stopPropagation: true,
    },
    target: { layer: layerName },
    feedback: {
      context: {
        scaleX: localX,
        scaleY: localY,
        fixRange: true,
        redraw: redrawFromTransform,
      },
    },
  },
];

const reorderInteractions = [
  {
    instrument: "reorder",
    trigger: { type: "drag" },
    target: { layer: "xAxisLayer" },
    feedback: {
      redrawFunc: redrawSPLOM,
      service: { reorderDirection: "x" },
      feedforward: {
        sourceLayer: Object.values(cellLayers),
        offset: { x: MARGIN.left, y: MARGIN.top },
      },
      context: {
        names,
        scales: { x: scaleX, y: scaleY },
      },
    },
  },
  {
    instrument: "reorder",
    trigger: { type: "drag" },
    target: { layer: "yAxisLayer" },
    feedback: {
      redrawFunc: redrawSPLOM,
      service: { reorderDirection: "y" },
      feedforward: {
        sourceLayer: Object.values(cellLayers),
        offset: { x: MARGIN.left, y: MARGIN.top },
      },
      context: {
        names,
        scales: { x: scaleX, y: scaleY },
      },
    },
  },
];

function renderSPLOM(svg, xAxisLayer, yAxisLayer, data, fields, scaleX, scaleY, color, panZoomLinker, fieldColor) {
  d3.select(xAxisLayer.getGraphic()).selectAll("*").remove();
  d3.select(yAxisLayer.getGraphic()).selectAll("*").remove();

  const cellWidth = scaleX.bandwidth();
  const cellHeight = scaleY.bandwidth();
  const cellClipPadding = 10;
  const defs = svg.selectAll("defs#splom-defs").data([null]).join("defs").attr("id", "splom-defs");
  const xAxisG = d3.select(xAxisLayer.getGraphic()).append("g").attr("transform", "translate(" + MARGIN.left + ",0)");
  const yAxisG = d3.select(yAxisLayer.getGraphic()).append("g").attr("transform", "translate(" + MARGIN.left + "," + MARGIN.top + ")");
  const cellLayers = {};

  const xScales = {};
  const yScales = {};
  fields.forEach((field) => {
    xScales[field] = d3.scaleLinear().domain(d3.extent(data, (datum) => datum[field])).range([0, cellWidth]).nice(TICK_COUNT);
    yScales[field] = d3.scaleLinear().domain(d3.extent(data, (datum) => datum[field])).range([cellHeight, 0]).nice(TICK_COUNT);
  });

  fields.forEach((xiField) => {
    const cellOffsetX = scaleX(xiField);

    xAxisG
      .append("text")
      .text(xiField)
      .attr("class", "col-label")
      .attr("x", cellOffsetX + cellWidth / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px");

    fields.forEach((yiField) => {
      const cellOffsetY = scaleY(yiField);
      const layerName = "cell-" + xiField + "-" + yiField;
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
      cell.selectAll(":not(.ig-layer-background)").remove();

      const localX = xScales[xiField];
      const localY = yScales[yiField];

      const drawCell = (sX, sY) => {
        const lx = sX || localX;
        const ly = sY || localY;
        const clipId = "splom-clip-" + layerName;
        const clipPath = defs.selectAll("clipPath#" + clipId).data([null]).join("clipPath").attr("id", clipId);
        clipPath
          .selectAll("rect")
          .data([null])
          .join("rect")
          .attr("class", "ignore")
          .attr("x", -cellClipPadding)
          .attr("y", -cellClipPadding)
          .attr("width", cellWidth + cellClipPadding * 2)
          .attr("height", cellHeight + cellClipPadding * 2);

        cell.selectAll(":not(.ig-layer-background)").remove();
        cell.append("rect").attr("class", "frame ignore").attr("width", cellWidth).attr("height", cellHeight).attr("fill", "none").attr("stroke", "#ddd");

        const pointsG = cell.append("g").attr("clip-path", "url(#" + clipId + ")");
        if (xiField === yiField) {
          const bins = d3.bin().domain(lx.domain()).value((datum) => datum[xiField]).thresholds(lx.ticks(15))(data);
          const histY = d3.scaleLinear().domain([0, d3.max(bins, (datum) => datum.length)]).range([cellHeight, 0]).nice();

          pointsG
            .selectAll("rect.bar")
            .data(bins)
            .join("rect")
            .attr("class", "bar")
            .attr("x", (datum) => lx(datum.x0) + 1)
            .attr("y", (datum) => histY(datum.length))
            .attr("width", (datum) => Math.max(0, lx(datum.x1) - lx(datum.x0) - 1))
            .attr("height", (datum) => Math.max(0, cellHeight - histY(datum.length)))
            .attr("fill", "#4e79a7")
            .attr("fill-opacity", 0.7);
        } else {
          pointsG
            .selectAll("circle")
            .data(data)
            .join("circle")
            .attr("r", 3)
            .attr("cx", (datum) => lx(datum[xiField]))
            .attr("cy", (datum) => ly(datum[yiField]))
            .attr("fill", (datum) => color(datum[fieldColor]))
            .attr("fill-opacity", 0.2);
        }

        const axesG = cell.append("g");
        axesG.append("g").attr("transform", "translate(0," + cellHeight + ")").call(d3.axisBottom(lx).ticks(3).tickSize(3));
        if (xiField !== yiField) axesG.append("g").call(d3.axisLeft(ly).ticks(3).tickSize(3));
      };

      drawCell(localX, localY);

      cellLayer.__drawCell = drawCell;
      cellLayer.__panZoomOnRedraw = (sX, sY) => {
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
        const redrawFromTransform = (transform) => {
          if (!transform) return;
          const nextX = typeof transform.rescaleX === "function" ? transform.rescaleX(localX.copy()) : localX;
          const nextY = typeof transform.rescaleY === "function" ? transform.rescaleY(localY.copy()) : localY;
          const onRedraw = cellLayer.__panZoomOnRedraw;
          if (typeof onRedraw === "function") onRedraw(nextX, nextY);
        };

        const panZoomInteractions = [
          {
            instrument: "pan",
            trigger: { type: "pan", modifierKey: "ctrl", priority: 3, stopPropagation: true },
            target: { layer: layerName },
            feedback: {
              context: { scaleX: localX, scaleY: localY, fixRange: true, redraw: redrawFromTransform },
            },
          },
          {
            instrument: "zoom",
            trigger: { type: "zoom", modifierKey: "ctrl", priority: 4, stopPropagation: true },
            target: { layer: layerName },
            feedback: {
              context: { scaleX: localX, scaleY: localY, fixRange: true, redraw: redrawFromTransform },
            },
          },
        ];

        compileDSL(panZoomInteractions, { layersByName: { [layerName]: cellLayer } }, { execute: true });
      }
    });
  });

  fields.forEach((yiField) => {
    const cellOffsetY = scaleY(yiField);
    yAxisG
      .append("text")
      .text(yiField)
      .attr("class", "row-label")
      .attr("x", -40)
      .attr("y", cellOffsetY + cellHeight / 2)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px")
      .attr("transform", "rotate(-90, -40, " + (cellOffsetY + cellHeight / 2) + ")");
  });

  return cellLayers;
}

const groupSelectionInteractions = Object.keys(cellLayers)
  .map((layerName) => ({
    instrument: "groupSelection",
    trigger: {
      type: "brush",
      remnantKey: "shift",
      priority: 2,
      stopPropagation: true,
    },
    target: { layer: layerName },
    feedback: {
      redrawFunc: {
        highlight: { color: (datum) => color(datum[fieldColor]) },
      },
      context: {
        scaleX: sx,
        scaleY: sy,
        attrName: [xiField, yiField],
        link: {
          layers: Object.values(cellLayers),
          matchMode: "datum",
          defaultOpacity: 0.7,
          baseOpacity: 0.08,
          selectedOpacity: 0.95,
          strokeWidth: 1,
        },
      },
    },
  }))
  .filter(Boolean);

compileDSL(panZoomInteractions, { layersByName: { [layerName]: cellLayer } }, { execute: true });
compileDSL(
  reorderInteractions.concat(groupSelectionInteractions),
  { layersByName: { xAxisLayer, yAxisLayer, ...cellLayers } },
  { execute: true }
);`;

const LIBRA_CODE = String.raw`import * as d3 from "d3";
import Libra from "libra-vis";

// Constants, data loading and the initial SVG setup are the same as the page runtime.
// The code below shows the rest of the native Libra implementation.

function ensureNativeSimpleSplomLibraPrimitives() {
  Libra.Service.register("NativeSimpleSplomReorderService", {
    sharedVar: {
      names: [],
      scaleX: null,
      scaleY: null,
    },
    evaluate({ startOffsetX, offsetx, startOffsetY, offsety, self, dragging }) {
      const direction = self.getSharedVar("direction");
      const names = self.getSharedVar("names");
      const scaleX = self.getSharedVar("scaleX");
      const scaleY = self.getSharedVar("scaleY");

      let startItem;
      let targetItem;

      if (direction === "x" && offsetx !== undefined && scaleX) {
        startItem = scaleX
          .domain()
          .find((name) => scaleX(name) <= startOffsetX && startOffsetX <= scaleX(name) + scaleX.bandwidth());
        targetItem = scaleX
          .domain()
          .find((name) => scaleX(name) <= offsetx && offsetx <= scaleX(name) + scaleX.bandwidth());
      } else if (direction === "y" && offsety !== undefined && scaleY) {
        startItem = scaleY
          .domain()
          .find((name) => scaleY(name) <= startOffsetY && startOffsetY <= scaleY(name) + scaleY.bandwidth());
        targetItem = scaleY
          .domain()
          .find((name) => scaleY(name) <= offsety && offsety <= scaleY(name) + scaleY.bandwidth());
      } else {
        return {
          reorderedNames: names,
          x: scaleX,
          y: scaleY,
          dragging,
        };
      }

      if (!startItem || !targetItem) {
        return {
          reorderedNames: names.slice(),
          x: scaleX,
          y: scaleY,
          dragging,
        };
      }

      const reorderedNames = names.slice();
      const startIndex = reorderedNames.indexOf(startItem);
      const targetIndex = reorderedNames.indexOf(targetItem);

      if (startIndex !== -1 && targetIndex !== -1) {
        reorderedNames.splice(startIndex, 1);
        reorderedNames.splice(targetIndex, 0, startItem);
      }

      if (!dragging) {
        names.splice(0, names.length, ...reorderedNames);
        scaleX.domain(reorderedNames);
        if (scaleY) scaleY.domain(reorderedNames);
        return {
          reorderedNames: names.slice(),
          x: scaleX,
          y: scaleY,
          dragging,
        };
      }

      return {
        reorderedNames,
        x: scaleX.copy().domain(reorderedNames),
        y: scaleY ? scaleY.copy().domain(reorderedNames) : undefined,
        dragging,
      };
    },
  });

  Libra.GraphicalTransformer.register("NativeSimpleSplomRedrawTransformer", {
    layer: null,
    redraw({ transformer }) {
      const result = transformer.getSharedVar("result");
      const redraw = transformer.getSharedVar("redraw");
      if (!result || typeof redraw !== "function") return;
      const { reorderedNames, x, y, dragging } = result;
      if (reorderedNames && !dragging) redraw(reorderedNames, x, y);
    },
  });

  Libra.Service.register("NativeSimpleSplomFilterService", {
    evaluate({ result, extents, state, brushKey, brushBoxTransformer, x, y, width, height }) {
      if (!state || !brushKey) {
        return { filteredData: [], hasActiveBrush: false };
      }

      if (!state.activeBrushKeys) state.activeBrushKeys = new Set();
      const hasCurrentBox = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
      const hasExtent =
        extents &&
        typeof extents === "object" &&
        Object.keys(extents).length > 0 &&
        Object.values(extents).some((extent) => Array.isArray(extent) && extent.length > 0);

      if (brushBoxTransformer) {
        if (hasCurrentBox) {
          const overlayLayer = brushBoxTransformer.getSharedVar("overlayLayer");
          const overlayRect = overlayLayer?.getGraphic?.()?.getBoundingClientRect?.();
          state.activeBrushKey = brushKey;
          brushBoxTransformer.setSharedVar("box", {
            x: Number.isFinite(x) && overlayRect ? x - overlayRect.left : 0,
            y: Number.isFinite(y) && overlayRect ? y - overlayRect.top : 0,
            width,
            height,
          });
        } else if (state.activeBrushKey === brushKey) {
          state.activeBrushKey = null;
          brushBoxTransformer.setSharedVar("box", null);
        }
      }

      const isActiveBrush = hasExtent || hasCurrentBox;
      if (!isActiveBrush) {
        state.brushSelections.delete(brushKey);
        state.activeBrushKeys.delete(brushKey);
      } else {
        const selectedData = (Array.isArray(result) ? result : [])
          .map((node) => node?.__data__)
          .filter(Boolean);
        state.brushSelections.set(brushKey, selectedData);
        state.activeBrushKeys.add(brushKey);
      }

      const activeBrushKeys = Array.from(state.activeBrushKeys.values());
      if (!activeBrushKeys.length) {
        return {
          filteredData: state.data.slice(),
          hasActiveBrush: false,
        };
      }

      const filteredData = state.data.filter((datum) =>
        activeBrushKeys.every((activeKey) => {
          const selection = state.brushSelections.get(activeKey) || [];
          return selection.includes(datum);
        })
      );

      return {
        filteredData,
        hasActiveBrush: true,
      };
    },
  });

  Libra.GraphicalTransformer.register("NativeSimpleSplomSharedBrushBoxTransformer", {
    layer: null,
    redraw({ transformer }) {
      const layer = transformer.getSharedVar("overlayLayer") || transformer.getSharedVar("layer");
      if (!layer) return;
      const graphic = d3.select(layer.getGraphic());
      graphic.selectAll("rect.native-splom-brush-box").remove();

      const box = transformer.getSharedVar("box");
      const width = box?.width ?? 0;
      const height = box?.height ?? 0;
      if (width <= 0 || height <= 0) return;

      const brushStyle = transformer.getSharedVar("brushStyle") || {};
      const fill = brushStyle.fill ?? "#5c5c5c";
      const opacity = brushStyle.opacity ?? 0.25;
      const stroke = brushStyle.stroke ?? "none";

      const rect = graphic
        .append("rect")
        .attr("class", "native-splom-brush-box")
        .attr("x", box?.x ?? 0)
        .attr("y", box?.y ?? 0)
        .attr("width", width)
        .attr("height", height)
        .attr("fill", fill)
        .attr("opacity", opacity)
        .attr("stroke", stroke);

      Object.entries(brushStyle).forEach(([key, value]) => {
        if (value !== undefined && value !== null) rect.attr(key, value);
      });
    },
  });

  Libra.GraphicalTransformer.register("NativeSimpleSplomLinkedScatterTransformer", {
    layer: null,
    redraw({ layer, transformer }) {
      const result = transformer.getSharedVar("result") || {};
      const filteredData = Array.isArray(result.filteredData) ? result.filteredData : [];
      const hasActiveBrush = !!result.hasActiveBrush;
      const filteredSet = new Set(filteredData);
      const colorAccessor = transformer.getSharedVar("colorAccessor");
      const baseOpacity = transformer.getSharedVar("baseOpacity") ?? 0.2;
      const dimOpacity = transformer.getSharedVar("dimOpacity") ?? 0.06;
      const activeOpacity = transformer.getSharedVar("activeOpacity") ?? 0.85;

      d3.select(layer.getGraphic())
        .selectAll("circle.mark")
        .attr("fill", (datum) => (typeof colorAccessor === "function" ? colorAccessor(datum) : "#4e79a7"))
        .attr("stroke", (datum) => (typeof colorAccessor === "function" ? colorAccessor(datum) : "#4e79a7"))
        .attr("stroke-width", (datum) => (hasActiveBrush && filteredSet.has(datum) ? 0.8 : 0))
        .attr("fill-opacity", (datum) => {
          if (!hasActiveBrush) return baseOpacity;
          return filteredSet.has(datum) ? activeOpacity : dimOpacity;
        })
        .attr("stroke-opacity", (datum) => {
          if (!hasActiveBrush) return 0;
          return filteredSet.has(datum) ? 1 : 0.08;
        });
    },
  });

  Libra.GraphicalTransformer.register("NativeSimpleSplomPanZoomTransformer", {
    layer: null,
    redraw({ transformer }) {
      const redrawCell = transformer.getSharedVar("redrawCell");
      if (typeof redrawCell !== "function") return;
      redrawCell(transformer.getSharedVar("scaleX"), transformer.getSharedVar("scaleY"));
    },
  });
}

function ensureNativeD3Layer(scene, layerKey, width, height, offset = { x: 0, y: 0 }) {
  if (!scene.layers[layerKey]) {
    scene.layers[layerKey] = Libra.Layer.initialize("D3Layer", {
      name: \`\${scene.prefix}-\${layerKey}\`,
      width,
      height,
      offset,
      container: scene.svg.node(),
    });
  }

  const layer = scene.layers[layerKey];
  const graphic = d3.select(layer.getGraphic());
  graphic.attr("transform", \`translate(\${offset.x || 0}, \${offset.y || 0})\`);
  graphic.select("rect.ig-layer-background").attr("width", width).attr("height", height);
  return layer;
}

function drawNativeLibraCell(scene, cellLayer, xiField, yiField, scaleXForCell, scaleYForCell) {
  const { svg, data, color, fieldColor } = scene;
  const cellWidth = scene.scaleX.bandwidth();
  const cellHeight = scene.scaleY.bandwidth();
  const defs = svg.selectAll("defs#native-splom-defs").data([null]).join("defs").attr("id", "native-splom-defs");
  const cell = d3.select(cellLayer.getGraphic());
  const clipId = \`\${scene.prefix}-clip-\${xiField}-\${yiField}\`;

  defs
    .selectAll(\`clipPath#\${clipId}\`)
    .data([null])
    .join("clipPath")
    .attr("id", clipId)
    .selectAll("rect")
    .data([null])
    .join("rect")
    .attr("x", -10)
    .attr("y", -10)
    .attr("width", cellWidth + 20)
    .attr("height", cellHeight + 20);

  cell.selectAll(":not(.ig-layer-background)").remove();

  const marksG = cell.append("g").attr("clip-path", \`url(#\${clipId})\`);
  if (xiField === yiField) {
    const bins = d3
      .bin()
      .domain(scaleXForCell.domain())
      .value((datum) => datum[xiField])
      .thresholds(scaleXForCell.ticks(15))(data);
    const histY = d3
      .scaleLinear()
      .domain([0, d3.max(bins, (datum) => datum.length)])
      .range([cellHeight, 0])
      .nice();

    marksG
      .selectAll("rect.bar")
      .data(bins)
      .join("rect")
      .attr("class", "bar")
      .attr("x", (datum) => scaleXForCell(datum.x0) + 1)
      .attr("y", (datum) => histY(datum.length))
      .attr("width", (datum) => Math.max(0, scaleXForCell(datum.x1) - scaleXForCell(datum.x0) - 1))
      .attr("height", (datum) => Math.max(0, cellHeight - histY(datum.length)))
      .attr("fill", "#4e79a7")
      .attr("fill-opacity", 0.7);
  } else {
    marksG
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("class", "mark")
      .attr("r", 3)
      .attr("cx", (datum) => scaleXForCell(datum[xiField]))
      .attr("cy", (datum) => scaleYForCell(datum[yiField]))
      .attr("fill", (datum) => color(datum[fieldColor]))
      .attr("fill-opacity", 0.2);
  }

  const axesG = cell.append("g");
  axesG.append("g").attr("transform", \`translate(0,\${cellHeight})\`).call(d3.axisBottom(scaleXForCell).ticks(3).tickSize(3));
  if (xiField !== yiField) {
    axesG.append("g").call(d3.axisLeft(scaleYForCell).ticks(3).tickSize(3));
  }
}

function renderNativeLibraSplom(scene, names, scaleX, scaleY) {
  scene.names = names;
  scene.scaleX = scaleX;
  scene.scaleY = scaleY;
  scene.scatterLayers = [];

  const { data } = scene;
  const cellWidth = scaleX.bandwidth();
  const cellHeight = scaleY.bandwidth();
  const xAxisLayer = ensureNativeD3Layer(scene, "xAxisLayer", WIDTH + MARGIN.left + MARGIN.right, MARGIN.bottom, {
    x: 0,
    y: HEIGHT + MARGIN.top,
  });
  const yAxisLayer = ensureNativeD3Layer(scene, "yAxisLayer", MARGIN.left, HEIGHT + MARGIN.top + MARGIN.bottom, {
    x: 0,
    y: 0,
  });

  scene.axisLayers = { xAxisLayer, yAxisLayer };

  const xAxisG = d3
    .select(xAxisLayer.getGraphic())
    .selectAll("g.native-axis-root")
    .data([null])
    .join("g")
    .attr("class", "native-axis-root")
    .attr("transform", \`translate(\${MARGIN.left},0)\`);
  xAxisG.selectAll("*").remove();

  const yAxisG = d3
    .select(yAxisLayer.getGraphic())
    .selectAll("g.native-axis-root")
    .data([null])
    .join("g")
    .attr("class", "native-axis-root")
    .attr("transform", \`translate(\${MARGIN.left},\${MARGIN.top})\`);
  yAxisG.selectAll("*").remove();

  const localXScales = {};
  const localYScales = {};
  names.forEach((field) => {
    localXScales[field] = d3.scaleLinear().domain(d3.extent(data, (datum) => datum[field])).range([0, cellWidth]).nice(TICK_COUNT);
    localYScales[field] = d3.scaleLinear().domain(d3.extent(data, (datum) => datum[field])).range([cellHeight, 0]).nice(TICK_COUNT);
  });
  scene.localScales = { x: localXScales, y: localYScales };

  names.forEach((xiField) => {
    const cellOffsetX = scaleX(xiField);
    xAxisG
      .append("text")
      .text(xiField)
      .attr("class", "col-label")
      .attr("x", cellOffsetX + cellWidth / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px");

    names.forEach((yiField) => {
      const cellOffsetY = scaleY(yiField);
      const layerName = \`cell-\${xiField}-\${yiField}\`;
      const cellLayer = ensureNativeD3Layer(scene, layerName, cellWidth, cellHeight, {
        x: MARGIN.left + cellOffsetX,
        y: MARGIN.top + cellOffsetY,
      });
      const lx = localXScales[xiField];
      const ly = localYScales[yiField];
      const panZoomState = scene.panZoomScales?.get(layerName);
      const renderScaleX = panZoomState?.scaleX || lx;
      const renderScaleY = panZoomState?.scaleY || ly;

      drawNativeLibraCell(scene, cellLayer, xiField, yiField, renderScaleX, renderScaleY);

      if (xiField !== yiField) {
        scene.scatterLayers.push({
          layer: cellLayer,
          layerName,
          xiField,
          yiField,
          baseScaleX: lx,
          baseScaleY: ly,
        });
      }
    });
  });

  names.forEach((yiField) => {
    const cellOffsetY = scaleY(yiField);
    yAxisG
      .append("text")
      .text(yiField)
      .attr("class", "row-label")
      .attr("x", -40)
      .attr("y", cellOffsetY + cellHeight / 2)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px")
      .attr("transform", \`rotate(-90, -40, \${cellOffsetY + cellHeight / 2})\`);
  });
}

function mountNativeLibraLinkBrushing(scene) {
  const brushStyle = {
    fill: "#5c5c5c",
    opacity: 0.25,
    stroke: "none",
  };

  if (!scene.linkBrushingState) {
    scene.linkBrushingState = {
      data: scene.data.slice(),
      brushSelections: new Map(),
      activeBrushKeys: new Set(),
      activeBrushKey: null,
    };
  }

  const sharedBrushLayer = ensureNativeD3Layer(scene, "sharedBrushOverlay", WIDTH, HEIGHT, {
    x: MARGIN.left,
    y: MARGIN.top,
  });
  d3.select(sharedBrushLayer.getGraphic()).attr("pointer-events", "none").selectAll(":not(.ig-layer-background)").remove();

  if (!scene.sharedBrushBoxTransformer) {
    scene.sharedBrushBoxTransformer = Libra.GraphicalTransformer.initialize("NativeSimpleSplomSharedBrushBoxTransformer", {
      layer: sharedBrushLayer,
      sharedVar: {
        overlayLayer: sharedBrushLayer,
        brushStyle,
        box: null,
      },
    });
  } else {
    scene.sharedBrushBoxTransformer.setSharedVars({
      overlayLayer: sharedBrushLayer,
      brushStyle,
    });
  }

  const scatterTransformers = (scene.scatterLayers || []).map(({ layer }) => {
    let transformer = scene.linkScatterTransformers?.get(layer);
    if (!transformer) {
      transformer = Libra.GraphicalTransformer.initialize("NativeSimpleSplomLinkedScatterTransformer", {
        layer,
        sharedVar: {
          result: { filteredData: scene.data.slice(), hasActiveBrush: false },
          colorAccessor: (datum) => scene.color(datum?.[scene.fieldColor]),
          baseOpacity: 0.2,
          dimOpacity: 0.06,
          activeOpacity: 0.9,
        },
      });
      if (!scene.linkScatterTransformers) scene.linkScatterTransformers = new Map();
      scene.linkScatterTransformers.set(layer, transformer);
    } else {
      transformer.setSharedVars({
        layer,
        colorAccessor: (datum) => scene.color(datum?.[scene.fieldColor]),
      });
    }
    return transformer;
  });

  if (!scene.brushInstruments) scene.brushInstruments = new Map();

  (scene.scatterLayers || []).forEach(({ layer, layerName, xiField, yiField }) => {
    const graphic = d3.select(layer.getGraphic());
    if (graphic.attr("data-native-link-brush-attached")) return;

    const brushInstrument = Libra.Interaction.build({
      inherit: "BrushInstrument",
      priority: 2,
      stopPropagation: true,
      remove: [
        { find: "SelectionTransformer", cascade: true },
        { find: "TransientRectangleTransformer", cascade: true },
      ],
      insert: [
        {
          find: "RectSelectionService",
          flow: [
            {
              comp: "NativeSimpleSplomFilterService",
              sharedVar: {
                state: scene.linkBrushingState,
                brushKey: \`\${xiField}-\${yiField}\`,
                brushBoxTransformer: scene.sharedBrushBoxTransformer,
              },
            },
            scatterTransformers,
          ],
        },
      ],
      layers: [{ layer, options: { pointerEvents: "viewport" } }],
      sharedVar: {
        brushStyle,
        scaleX: scene.localScales?.x?.[xiField],
        scaleY: scene.localScales?.y?.[yiField],
      },
    });

    scene.brushInstruments.set(layerName, brushInstrument);
    graphic.attr("data-native-link-brush-attached", "1");
  });
}

function syncNativeModifierRouting(scene, ctrlPressed) {
  scene.nativeCtrlPressed = !!ctrlPressed;

  const brushModifier = scene.nativeCtrlPressed ? "alt" : null;
  const panModifier = scene.nativeCtrlPressed ? null : "ctrl";

  scene.brushInstruments?.forEach((instrument) => {
    instrument.setSharedVar("modifierKey", brushModifier);
  });
  scene.panInstruments?.forEach((instrument) => {
    instrument.setSharedVar("modifierKey", panModifier);
  });
  scene.zoomInstruments?.forEach((instrument) => {
    instrument.setSharedVar("modifierKey", panModifier);
  });
}

function ensureNativeModifierRouting(scene) {
  if (scene.nativeModifierRoutingReady) return;
  scene.nativeModifierRoutingReady = true;

  const onKeyDown = (event) => {
    if (event.key === "Control") syncNativeModifierRouting(scene, true);
  };
  const onKeyUp = (event) => {
    if (event.key === "Control") syncNativeModifierRouting(scene, false);
  };
  const onWindowBlur = () => syncNativeModifierRouting(scene, false);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onWindowBlur);
}

function mountNativeLibraPanZoom(scene) {
  if (!scene.panZoomTransformers) scene.panZoomTransformers = new Map();
  if (!scene.panZoomScales) scene.panZoomScales = new Map();
  if (!scene.panInstruments) scene.panInstruments = new Map();
  if (!scene.zoomInstruments) scene.zoomInstruments = new Map();

  (scene.scatterLayers || []).forEach(({ layer, layerName, xiField, yiField, baseScaleX, baseScaleY }) => {
    const graphic = d3.select(layer.getGraphic());
    const currentScaleX = scene.panZoomScales.get(layerName)?.scaleX || baseScaleX.copy();
    const currentScaleY = scene.panZoomScales.get(layerName)?.scaleY || baseScaleY.copy();

    const redrawCell = (scaleXValue, scaleYValue) => {
      scene.panZoomScales.set(layerName, {
        scaleX: scaleXValue,
        scaleY: scaleYValue,
      });
      drawNativeLibraCell(scene, layer, xiField, yiField, scaleXValue, scaleYValue);

      const brushInstrument = scene.brushInstruments?.get(layerName);
      const brushService = brushInstrument?.services?.find("RectSelectionService")?.[0];
      if (brushService) {
        brushService.setSharedVars({
          scaleX: scaleXValue,
          scaleY: scaleYValue,
        });
      }
    };

    let transformer = scene.panZoomTransformers.get(layerName);
    if (!transformer) {
      transformer = Libra.GraphicalTransformer.initialize("NativeSimpleSplomPanZoomTransformer", {
        layer,
        sharedVar: {
          scaleX: currentScaleX,
          scaleY: currentScaleY,
          redrawCell,
        },
      });
      scene.panZoomTransformers.set(layerName, transformer);
    } else {
      transformer.setSharedVars({
        layer,
        scaleX: currentScaleX,
        scaleY: currentScaleY,
        redrawCell,
      });
    }

    if (!graphic.attr("data-native-pan-attached")) {
      const panInstrument = Libra.Interaction.build({
        inherit: "PanInstrument",
        layers: [{ layer, options: { pointerEvents: "viewport" } }],
        transformers: [transformer],
        priority: 4,
        stopPropagation: true,
        sharedVar: {
          modifierKey: "ctrl",
          fixRange: true,
        },
      });
      scene.panInstruments.set(layerName, panInstrument);
      graphic.attr("data-native-pan-attached", "1");
    }

    if (!graphic.attr("data-native-zoom-attached")) {
      const zoomInstrument = Libra.Interaction.build({
        inherit: "GeometricZoomInstrument",
        layers: [{ layer, options: { pointerEvents: "viewport" } }],
        transformers: [transformer],
        priority: 5,
        stopPropagation: true,
        sharedVar: {
          modifierKey: "ctrl",
          fixRange: true,
        },
      });
      scene.zoomInstruments.set(layerName, zoomInstrument);
      graphic.attr("data-native-zoom-attached", "1");
    }
  });

  ensureNativeModifierRouting(scene);
  syncNativeModifierRouting(scene, !!scene.nativeCtrlPressed);
}

function mountNativeLibraReorder(scene) {
  const { xAxisLayer, yAxisLayer } = scene.axisLayers;
  const redraw = (newNames, newX, newY) => {
    renderNativeLibraSplom(scene, newNames, newX, newY);
    mountNativeLibraLinkBrushing(scene);
    mountNativeLibraPanZoom(scene);
  };

  Libra.Interaction.build({
    inherit: "ReorderInstrument",
    layers: [xAxisLayer],
    insert: [
      {
        find: "SelectionService",
        flow: [
          { comp: "NativeSimpleSplomReorderService" },
          { comp: "NativeSimpleSplomRedrawTransformer" },
        ],
      },
    ],
    sharedVar: {
      direction: "x",
      names: scene.names,
      scaleX: scene.scaleX,
      scaleY: scene.scaleY,
      redraw,
    },
  });

  Libra.Interaction.build({
    inherit: "ReorderInstrument",
    layers: [yAxisLayer],
    insert: [
      {
        find: "SelectionService",
        flow: [
          { comp: "NativeSimpleSplomReorderService" },
          { comp: "NativeSimpleSplomRedrawTransformer" },
        ],
      },
    ],
    sharedVar: {
      direction: "y",
      names: scene.names,
      scaleX: scene.scaleX,
      scaleY: scene.scaleY,
      redraw,
    },
  });
}

async function renderNativeLibraPanel(mountNode) {
  ensureNativeSimpleSplomLibraPrimitives();

  const fieldColor = (window.FIELD_COLOR || "class");
  mountNode.innerHTML = "";

  const raw = await d3.csv("./public/data/bezdekIris.csv");
  const fields = ["sepal_length", "sepal_width"];
  const data = raw.map((datum) => {
    const record = { ...datum };
    for (const field of fields) record[field] = parseFloat(datum[field]);
    return record;
  });

  const svg = d3
    .select(mountNode)
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr("viewBox", \`0 0 \${WIDTH + MARGIN.left + MARGIN.right} \${HEIGHT + MARGIN.top + MARGIN.bottom}\`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const color = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(data.map((datum) => datum[fieldColor]))))
    .range(d3.schemeTableau10);

  const scene = {
    prefix: "native-simple-splom-demo",
    svg,
    data,
    color,
    fieldColor,
    names: fields.slice(),
    scaleX: d3.scaleBand().domain(fields).range([0, WIDTH]).padding(0.05),
    scaleY: d3.scaleBand().domain(fields).range([0, HEIGHT]).padding(0.05),
    layers: {},
    axisLayers: null,
  };

  renderNativeLibraSplom(scene, scene.names, scene.scaleX, scene.scaleY);
  mountNativeLibraReorder(scene);
  mountNativeLibraLinkBrushing(scene);
  mountNativeLibraPanZoom(scene);
}`;
const VEGALITE_CODE = String.raw`import vegaEmbed from "vega-embed";

function buildVegaLiteSplomSpec(data, fieldColor) {
  const fields = ["sepal_length", "sepal_width"];

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    background: "white",
    padding: 8,
    spacing: 8,
    data: { values: data },
    params: [
      {
        name: "brush",
        select: {
          type: "interval",
          on: "[pointerdown[!event.ctrlKey], window:pointerup] > window:pointermove!",
          translate: "[pointerdown[!event.ctrlKey], window:pointerup] > window:pointermove!",
          clear: "dblclick[!event.ctrlKey]",
        },
      },
      {
        name: "grid",
        select: {
          type: "interval",
          bind: "scales",
          on: "[pointerdown[event.ctrlKey], window:pointerup] > window:pointermove!",
          translate: "[pointerdown[event.ctrlKey], window:pointerup] > window:pointermove!",
          zoom: "wheel![event.ctrlKey]",
          clear: "dblclick[event.ctrlKey]",
        },
      },
    ],
    repeat: {
      row: fields.slice().reverse(),
      column: fields,
    },
    spec: {
      width: 135,
      height: 135,
      mark: {
        type: "point",
        filled: true,
        size: 36,
      },
      encoding: {
        x: {
          field: { repeat: "column" },
          type: "quantitative",
          scale: { zero: false },
          axis: { title: null, tickCount: 3 },
        },
        y: {
          field: { repeat: "row" },
          type: "quantitative",
          scale: { zero: false },
          axis: { title: null, tickCount: 3 },
        },
        color: {
          field: fieldColor,
          type: "nominal",
          scale: { scheme: "tableau10" },
          legend: { title: fieldColor },
        },
        opacity: {
          condition: { param: "brush", value: 0.95 },
          value: 0.16,
        },
        tooltip: [
          { field: "sepal_length", type: "quantitative" },
          { field: "sepal_width", type: "quantitative" },
          { field: fieldColor, type: "nominal" },
        ],
      },
    },
    resolve: {
      scale: {
        x: "independent",
        y: "independent",
      },
    },
    config: {
      view: { stroke: "#d8d5c8" },
      axis: {
        labelColor: "#516074",
        titleColor: "#10233f",
        gridColor: "rgba(16, 35, 63, 0.08)",
      },
    },
  };
}

async function renderVegaLitePanel(mountNode) {
  const g = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {};
  const fieldColor = g.FIELD_COLOR || "class";

  mountNode.innerHTML = "";

  const raw = await d3.csv("./public/data/bezdekIris.csv");
  const fields = ["sepal_length", "sepal_width"];
  const data = raw.map((datum) => {
    const record = { ...datum };
    for (const field of fields) record[field] = parseFloat(datum[field]);
    return record;
  });

  await vegaEmbed(mountNode, buildVegaLiteSplomSpec(data, fieldColor), {
    actions: false,
    renderer: "svg",
  });
}`;
const D3_CODE = String.raw`import * as d3 from "d3";

let d3SplomUid = 0;

function createD3SplomPrefix() {
  d3SplomUid += 1;
  return \`d3-simple-splom-\${d3SplomUid}\`;
}

function moveD3Field(names, source, target) {
  const next = names.slice();
  const sourceIndex = next.indexOf(source);
  const targetIndex = next.indexOf(target);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return next;
  next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source);
  return next;
}

function findD3BandTarget(scale, value) {
  return scale.domain().find((name) => {
    const start = scale(name);
    return start !== undefined && start <= value && value <= start + scale.bandwidth();
  });
}

function clearAllD3Brushes(scene, exceptKey = null) {
  if (scene.isClearingBrushes) return;
  scene.isClearingBrushes = true;
  try {
    scene.cells?.forEach((cell, key) => {
      if (cell.type !== "scatter" || !cell.brush || !cell.brushG || key === exceptKey) return;
      cell.brushG.call(cell.brush.move, null);
    });
  } finally {
    scene.isClearingBrushes = false;
  }

  if (exceptKey) {
    const current = scene.brushSelections.get(exceptKey);
    scene.brushSelections = current ? new Map([[exceptKey, current]]) : new Map();
  } else {
    scene.brushSelections.clear();
  }
}

function updateD3LinkedHighlight(scene) {
  const selectionSets = Array.from(scene.brushSelections.values()).filter((set) => set && set.size);
  let activeSet = null;

  if (selectionSets.length) {
    activeSet = new Set(selectionSets[0]);
    selectionSets.slice(1).forEach((set) => {
      activeSet = new Set(Array.from(activeSet).filter((datum) => set.has(datum)));
    });
  }

  scene.cells?.forEach((cell) => {
    if (cell.type !== "scatter") return;
    cell.marksG
      .selectAll("circle.mark")
      .attr("fill", (datum) => scene.color(datum[scene.fieldColor]))
      .attr("stroke", (datum) => scene.color(datum[scene.fieldColor]))
      .attr("stroke-width", (datum) => (activeSet && activeSet.has(datum) ? 0.8 : 0))
      .attr("stroke-opacity", (datum) => {
        if (!activeSet) return 0;
        return activeSet.has(datum) ? 1 : 0.08;
      })
      .attr("fill-opacity", (datum) => {
        if (!activeSet) return 0.2;
        return activeSet.has(datum) ? 0.9 : 0.06;
      });
  });
}

function updateD3HistogramCell(scene, cell) {
  const { marksG, axesG, xiField, cellHeight } = cell;
  const scaleX = scene.panZoomX?.get(xiField) || scene.localXScales[xiField].copy();
  cell.scaleX = scaleX;
  marksG.selectAll("*").remove();
  if (axesG) axesG.selectAll("*").remove();

  const bins = d3
    .bin()
    .domain(scaleX.domain())
    .value((datum) => datum[xiField])
    .thresholds(scaleX.ticks(15))(scene.data);

  const histY = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (datum) => datum.length)])
    .range([cellHeight, 0])
    .nice();

  marksG
    .selectAll("rect.bar")
    .data(bins)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (datum) => scaleX(datum.x0) + 1)
    .attr("y", (datum) => histY(datum.length))
    .attr("width", (datum) => Math.max(0, scaleX(datum.x1) - scaleX(datum.x0) - 1))
    .attr("height", (datum) => Math.max(0, cellHeight - histY(datum.length)))
    .attr("fill", "#4e79a7")
    .attr("fill-opacity", 0.7);

  if (axesG) {
    axesG
      .append("g")
      .attr("transform", \`translate(0,\${cellHeight})\`)
      .call(d3.axisBottom(scaleX).ticks(3).tickSize(3));
  }
}

function updateD3ScatterCell(scene, cell) {
  const { marksG, axesG, xiField, yiField, cellHeight, state } = cell;
  state.xScale = (scene.panZoomX?.get(xiField) || state.baseX.copy()).copy();
  state.yScale = (scene.panZoomY?.get(yiField) || state.baseY.copy()).copy();
  marksG.selectAll("*").remove();
  axesG.selectAll("*").remove();

  marksG
    .selectAll("circle.mark")
    .data(scene.data)
    .join("circle")
    .attr("class", "mark")
    .attr("r", 3)
    .attr("cx", (datum) => state.xScale(datum[xiField]))
    .attr("cy", (datum) => state.yScale(datum[yiField]));

  axesG.append("g").attr("transform", \`translate(0,\${cellHeight})\`).call(d3.axisBottom(state.xScale).ticks(3).tickSize(3));
  axesG.append("g").call(d3.axisLeft(state.yScale).ticks(3).tickSize(3));

  updateD3LinkedHighlight(scene);
}

function propagateD3PanZoom(scene, originCell, transform) {
  if (!originCell || !transform) return;

  scene.panZoomX.set(originCell.xiField, transform.rescaleX(originCell.state.baseX.copy()));
  scene.panZoomY.set(originCell.yiField, transform.rescaleY(originCell.state.baseY.copy()));

  scene.cells?.forEach((cell) => {
    if (cell.type === "histogram") {
      if (cell.xiField === originCell.xiField) updateD3HistogramCell(scene, cell);
      return;
    }

    if (cell.xiField === originCell.xiField || cell.yiField === originCell.yiField) {
      updateD3ScatterCell(scene, cell);
    }
  });
}

function attachD3ScatterInteractions(scene, cell) {
  cell.brush = d3
    .brush()
    .extent([
      [0, 0],
      [cell.cellWidth, cell.cellHeight],
    ])
    .filter((event) => !event.ctrlKey && !event.button)
    .on("start", (event) => {
      if (scene.isClearingBrushes) return;
      if (event.sourceEvent && !event.sourceEvent.shiftKey) {
        clearAllD3Brushes(scene, cell.key);
      }
    })
    .on("brush end", (event) => {
      if (scene.isClearingBrushes) return;
      if (!event.selection) {
        scene.brushSelections.delete(cell.key);
        updateD3LinkedHighlight(scene);
        return;
      }

      const [[x0, y0], [x1, y1]] = event.selection;
      const selected = new Set(
        scene.data.filter((datum) => {
          const px = cell.state.xScale(datum[cell.xiField]);
          const py = cell.state.yScale(datum[cell.yiField]);
          return x0 <= px && px <= x1 && y0 <= py && py <= y1;
        })
      );
      scene.brushSelections.set(cell.key, selected);
      updateD3LinkedHighlight(scene);
    });

  cell.brushG.call(cell.brush);

  cell.zoom = d3
    .zoom()
    .scaleExtent([1, 8])
    .filter((event) => {
      if (event.type === "wheel") return !!event.ctrlKey;
      return !!event.ctrlKey && !event.button;
    })
    .on("start", () => {
      clearAllD3Brushes(scene);
      updateD3LinkedHighlight(scene);
    })
    .on("zoom", (event) => {
      cell.state.transform = event.transform;
      propagateD3PanZoom(scene, cell, event.transform);
    });

  cell.root.call(cell.zoom).on("dblclick.zoom", null);
}

function renderD3Splom(scene) {
  scene.scaleX.domain(scene.names);
  scene.scaleY.domain(scene.names);
  scene.svg.selectAll("*").remove();
  scene.cells = new Map();

  const defs = scene.svg.selectAll("defs#d3-splom-defs").data([null]).join("defs").attr("id", "d3-splom-defs");
  const xAxisG = scene.svg.append("g").attr("transform", \`translate(\${MARGIN.left},0)\`);
  const yAxisG = scene.svg.append("g").attr("transform", \`translate(\${MARGIN.left},\${MARGIN.top})\`);

  const cellWidth = scene.scaleX.bandwidth();
  const cellHeight = scene.scaleY.bandwidth();
  scene.localXScales = {};
  scene.localYScales = {};
  if (!scene.panZoomX) scene.panZoomX = new Map();
  if (!scene.panZoomY) scene.panZoomY = new Map();

  scene.names.forEach((field) => {
    scene.localXScales[field] = d3
      .scaleLinear()
      .domain(d3.extent(scene.data, (datum) => datum[field]))
      .range([0, cellWidth])
      .nice(TICK_COUNT);
    scene.localYScales[field] = d3
      .scaleLinear()
      .domain(d3.extent(scene.data, (datum) => datum[field]))
      .range([cellHeight, 0])
      .nice(TICK_COUNT);
  });

  const xLabelDrag = d3.drag().on("end", (event, field) => {
    const [pointerX] = d3.pointer(event, scene.svg.node());
    const target = findD3BandTarget(scene.scaleX, pointerX - MARGIN.left);
    if (!target || target === field) return;
    scene.names = moveD3Field(scene.names, field, target);
    scene.scatterStates.clear();
    scene.brushSelections.clear();
    renderD3Splom(scene);
  });

  const yLabelDrag = d3.drag().on("end", (event, field) => {
    const [, pointerY] = d3.pointer(event, scene.svg.node());
    const target = findD3BandTarget(scene.scaleY, pointerY - MARGIN.top);
    if (!target || target === field) return;
    scene.names = moveD3Field(scene.names, field, target);
    scene.scatterStates.clear();
    scene.brushSelections.clear();
    renderD3Splom(scene);
  });

  scene.names.forEach((xiField) => {
    const cellOffsetX = scene.scaleX(xiField);
    xAxisG
      .append("text")
      .datum(xiField)
      .text(xiField)
      .attr("class", "col-label")
      .attr("x", cellOffsetX + cellWidth / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px")
      .style("cursor", "grab")
      .call(xLabelDrag);

    scene.names.forEach((yiField) => {
      const cellOffsetY = scene.scaleY(yiField);
      const key = \`d3-cell-\${xiField}-\${yiField}\`;
      const cellG = scene.svg
        .append("g")
        .attr("transform", \`translate(\${MARGIN.left + cellOffsetX},\${MARGIN.top + cellOffsetY})\`);

      const clipId = \`\${scene.prefix}-clip-\${xiField}-\${yiField}\`;
      defs
        .selectAll(\`clipPath#\${clipId}\`)
        .data([null])
        .join("clipPath")
        .attr("id", clipId)
        .selectAll("rect")
        .data([null])
        .join("rect")
        .attr("x", -10)
        .attr("y", -10)
        .attr("width", cellWidth + 20)
        .attr("height", cellHeight + 20);

      cellG.append("rect").attr("class", "frame").attr("width", cellWidth).attr("height", cellHeight).attr("fill", "none").attr("stroke", "#ddd");

      const marksG = cellG.append("g").attr("clip-path", \`url(#\${clipId})\`);
      const axesG = cellG.append("g");

      if (xiField === yiField) {
        const histCell = {
          key,
          type: "histogram",
          xiField,
          cellHeight,
          marksG,
          axesG,
        };
        updateD3HistogramCell(scene, histCell);
        scene.cells.set(key, histCell);
        return;
      }

      const previousState = scene.scatterStates.get(key);
      const baseX = scene.localXScales[xiField].copy();
      const baseY = scene.localYScales[yiField].copy();
      const transform = previousState?.transform || d3.zoomIdentity;
      const state = {
        transform,
        baseX,
        baseY,
        xScale: transform.rescaleX(baseX.copy()),
        yScale: transform.rescaleY(baseY.copy()),
      };
      scene.scatterStates.set(key, state);

      const brushG = cellG.append("g").attr("class", "brush");
      const cell = {
        key,
        type: "scatter",
        root: cellG,
        marksG,
        axesG,
        brushG,
        xiField,
        yiField,
        state,
        cellWidth,
        cellHeight,
      };
      scene.cells.set(key, cell);
      updateD3ScatterCell(scene, cell);
      attachD3ScatterInteractions(scene, cell);
    });
  });

  scene.names.forEach((yiField) => {
    const cellOffsetY = scene.scaleY(yiField);
    yAxisG
      .append("text")
      .datum(yiField)
      .text(yiField)
      .attr("class", "row-label")
      .attr("x", -40)
      .attr("y", cellOffsetY + cellHeight / 2)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px")
      .attr("transform", \`rotate(-90, -40, \${cellOffsetY + cellHeight / 2})\`)
      .style("cursor", "grab")
      .call(yLabelDrag);
  });

  updateD3LinkedHighlight(scene);
}

async function renderD3Panel(mountNode) {
  const g = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {};
  const fieldColor = g.FIELD_COLOR || "class";

  mountNode.innerHTML = "";

  const raw = await d3.csv("./public/data/bezdekIris.csv");
  const fields = ["sepal_length", "sepal_width"];
  const data = raw.map((datum) => {
    const record = { ...datum };
    for (const field of fields) record[field] = parseFloat(datum[field]);
    return record;
  });

  const svg = d3
    .select(mountNode)
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr(
      "viewBox",
      \`0 0 \${WIDTH + MARGIN.left + MARGIN.right} \${HEIGHT + MARGIN.top + MARGIN.bottom}\`
    )
    .attr("preserveAspectRatio", "xMidYMid meet");

  const color = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(data.map((datum) => datum[fieldColor]))))
    .range(d3.schemeTableau10);

  const scene = {
    prefix: createD3SplomPrefix(),
    svg,
    data,
    color,
    fieldColor,
    names: fields.slice(),
    scaleX: d3.scaleBand().domain(fields).range([0, WIDTH]).padding(0.05),
    scaleY: d3.scaleBand().domain(fields).range([0, HEIGHT]).padding(0.05),
    brushSelections: new Map(),
    scatterStates: new Map(),
    cells: new Map(),
  };

  renderD3Splom(scene);
}`;

const CODE_EDITOR_VARIABLE_META = {
  libraPlus: [
    { name: "localX", kind: "conflict", reason: "Shared X scale state for ctrl pan and zoom." },
    { name: "localY", kind: "conflict", reason: "Shared Y scale state for ctrl pan and zoom." },
    { name: "cellLayer", kind: "data", reason: "Carries the current cell redraw and interaction hooks." },
    { name: "panZoomLinker", kind: "data", reason: "Propagates pan and zoom results across views." },
    { name: "names", kind: "data", reason: "Stores the reordered field sequence." },
    { name: "scaleX", kind: "data", reason: "Passes the column scale across interactions." },
    { name: "scaleY", kind: "data", reason: "Passes the row scale across interactions." },
    { name: "cellLayers", kind: "data", reason: "Provides the full layer set to reorder and link selection." },
  ],
  libraNative: [
    { name: "scene", kind: "data", reason: "Top-level state container for the native Libra version." },
    { name: "state", kind: "data", reason: "Shares brush results and active brush state." },
    { name: "names", kind: "data", reason: "Stores the reordered field sequence." },
    { name: "scaleX", kind: "data", reason: "Reuses the X scale across reorder, brush, and pan/zoom." },
    { name: "scaleY", kind: "data", reason: "Reuses the Y scale across reorder, brush, and pan/zoom." },
    { name: "redraw", kind: "data", reason: "Sends service results back into rendering." },
    { name: "brushStyle", kind: "data", reason: "Shares the single brush visual style." },
    { name: "brushBoxTransformer", kind: "data", reason: "Keeps the single shared brush-box transformer." },
    { name: "linkBrushingState", kind: "data", reason: "Aggregates linked-brushing state." },
    { name: "sharedBrushBoxTransformer", kind: "data", reason: "Drives the one shared brush-box view." },
    { name: "panZoomScales", kind: "data", reason: "Stores the current pan/zoom scales for each view." },
    { name: "brushInstruments", kind: "conflict", reason: "Coordinates brush modifier routing." },
    { name: "panInstruments", kind: "conflict", reason: "Coordinates pan modifier routing." },
    { name: "zoomInstruments", kind: "conflict", reason: "Coordinates zoom modifier routing." },
    { name: "nativeCtrlPressed", kind: "conflict", reason: "Manually reproduces modifier-key routing state." },
  ],
  vegaLite: [
    { name: "brush", kind: "conflict", reason: "Handles the non-ctrl interval selection." },
    { name: "grid", kind: "conflict", reason: "Handles ctrl-routed scale interaction." },
    { name: "fieldColor", kind: "data", reason: "Passes the category field through encodings and tooltips." },
    { name: "data", kind: "data", reason: "Passes the full dataset into the Vega-Lite spec." },
    { name: "fields", kind: "data", reason: "Defines the repeated row and column fields." },
  ],
  d3: [
    { name: "scene", kind: "data", reason: "Top-level state container for the D3 version." },
    { name: "brushSelections", kind: "conflict", reason: "Aggregates brush results and supports mutual clearing." },
    { name: "isClearingBrushes", kind: "conflict", reason: "Prevents recursive events during brush clearing." },
    { name: "scatterStates", kind: "data", reason: "Stores local state for each scatter view." },
    { name: "panZoomX", kind: "data", reason: "Shares X zoom state by column." },
    { name: "panZoomY", kind: "data", reason: "Shares Y zoom state by row." },
    { name: "cells", kind: "data", reason: "Lets the system update all linked cells together." },
    { name: "state", kind: "data", reason: "Local state object for a single scatter cell." },
    { name: "transform", kind: "data", reason: "Current zoom transform for the active view." },
    { name: "baseX", kind: "data", reason: "Base scale used by rescaleX." },
    { name: "baseY", kind: "data", reason: "Base scale used by rescaleY." },
    { name: "localXScales", kind: "data", reason: "Caches field-level local X scales." },
    { name: "localYScales", kind: "data", reason: "Caches field-level local Y scales." },
  ],
};

const CODE_EDITOR_ITEMS = [
  {
    hostId: "SimpleSplomCompareLibraPlusCode",
    fallbackId: "SimpleSplomCompareLibraPlusCodeFallback",
    value: LIBRA_PLUS_CODE,
    coordinationVars: CODE_EDITOR_VARIABLE_META.libraPlus,
  },
  {
    hostId: "SimpleSplomCompareLibraCode",
    fallbackId: "SimpleSplomCompareLibraCodeFallback",
    value: LIBRA_CODE,
    coordinationVars: CODE_EDITOR_VARIABLE_META.libraNative,
  },
  {
    hostId: "SimpleSplomCompareVegaLiteCode",
    fallbackId: "SimpleSplomCompareVegaLiteCodeFallback",
    value: VEGALITE_CODE,
    coordinationVars: CODE_EDITOR_VARIABLE_META.vegaLite,
  },
  {
    hostId: "SimpleSplomCompareD3Code",
    fallbackId: "SimpleSplomCompareD3CodeFallback",
    value: D3_CODE,
    coordinationVars: CODE_EDITOR_VARIABLE_META.d3,
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

function getCoordinationVarCount(key) {
  return CODE_EDITOR_VARIABLE_META[key]?.length || 0;
}

function renderPage() {
  return `
    <div class="showcase-page showcase-page--compare">
      <header class="showcase-topbar">
        <a class="showcase-brand" href="?page=home">
          <strong>Libra+</strong>
          <span>Simple SPLOM Compare</span>
        </a>
        <nav class="showcase-nav" aria-label="Primary">
          <a href="?page=home">Home</a>
          <a href="?page=gallery">Gallery</a>
          <a href="?page=teaser-SimpleSPLOM">Raw Demo</a>
          <a href="?page=teaser-simple-splom-compare" aria-current="page">Compare</a>
        </nav>
      </header>

      <section class="compare-grid">
        ${panelMarkup({
          title: "Libra+",
          mountId: "SimpleSplomCompareLibraPlusMount",
          statusId: "SimpleSplomCompareLibraPlusStatus",
          codeId: "SimpleSplomCompareLibraPlusCode",
          fallbackId: "SimpleSplomCompareLibraPlusCodeFallback",
          code: LIBRA_PLUS_CODE,
        })}
        ${panelMarkup({
          title: "Libra.js",
          mountId: "SimpleSplomCompareLibraMount",
          statusId: "SimpleSplomCompareLibraStatus",
          codeId: "SimpleSplomCompareLibraCode",
          fallbackId: "SimpleSplomCompareLibraCodeFallback",
          code: LIBRA_CODE,
        })}
        ${panelMarkup({
          title: "Vega-Lite",
          mountId: "SimpleSplomCompareVegaLiteMount",
          statusId: "SimpleSplomCompareVegaLiteStatus",
          codeId: "SimpleSplomCompareVegaLiteCode",
          fallbackId: "SimpleSplomCompareVegaLiteCodeFallback",
          code: VEGALITE_CODE,
        })}
        ${panelMarkup({
          title: "D3",
          mountId: "SimpleSplomCompareD3Mount",
          statusId: "SimpleSplomCompareD3Status",
          codeId: "SimpleSplomCompareD3Code",
          fallbackId: "SimpleSplomCompareD3CodeFallback",
          code: D3_CODE,
        })}
      </section>
    </div>
  `;
}

function setStatus(container, id, message, isError = false) {
  const node = container.querySelector(`#${id}`);
  if (!node) return;
  if (isError) {
    node.textContent = message || "";
  } else {
    node.innerHTML = message || "";
  }
  node.classList.toggle("is-error", isError);
  node.hidden = !message;
}

function buildPanelNoteHtml(description, variableKey, limitation = "") {
  const total = getCoordinationVarCount(variableKey);
  const limitationHtml = limitation
    ? ` <span style="color:#c62828;font-weight:700;font-size:15px;">${escapeHtml(limitation)}</span>`
    : "";

  return `
    <span style="font-size:15px;line-height:1.6;color:#10233f;">${escapeHtml(description)}</span>
    <span style="color:#c62828;font-weight:700;font-size:15px;"> Uses ${total} shared variables.</span>${limitationHtml}
  `;
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

function ensureCompareCodeHighlightStyles() {
  if (document.getElementById("simple-splom-compare-code-highlight-style")) return;
  const style = document.createElement("style");
  style.id = "simple-splom-compare-code-highlight-style";
  style.textContent = `
    .compare-code-highlight-conflict {
      background-color: rgba(255, 196, 0, 0.3);
      border-bottom: 1px solid rgba(182, 124, 0, 0.45);
      border-radius: 2px;
    }
    .compare-code-highlight-data {
      background-color: rgba(78, 121, 167, 0.22);
      border-bottom: 1px solid rgba(41, 82, 124, 0.32);
      border-radius: 2px;
    }
    .compare-code-highlight-conflict-fallback {
      background: rgba(255, 196, 0, 0.3);
      border-bottom: 1px solid rgba(182, 124, 0, 0.45);
      border-radius: 2px;
    }
    .compare-code-highlight-data-fallback {
      background: rgba(78, 121, 167, 0.22);
      border-bottom: 1px solid rgba(41, 82, 124, 0.32);
      border-radius: 2px;
    }
  `;
  document.head.appendChild(style);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyEditorHighlights(editor, coordinationVars) {
  const model = editor?.getModel?.();
  if (!model) return;

  const decorations = [];
  coordinationVars.forEach(({ name, kind, reason }) => {
    const matches = model.findMatches(`\\b${escapeRegExp(name)}\\b`, false, true, true, null, false);
    matches.forEach((match) => {
      decorations.push({
        range: match.range,
        options: {
          inlineClassName:
            kind === "conflict" ? "compare-code-highlight-conflict" : "compare-code-highlight-data",
          hoverMessage: [{ value: `**${name}**\n\n${reason}` }],
        },
      });
    });
  });

  editor.createDecorationsCollection(decorations);
}

function applyFallbackHighlights(fallbackNode, value, coordinationVars) {
  if (!fallbackNode) return;

  const matches = [];
  coordinationVars.forEach(({ name, kind, reason }) => {
    const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, "g");
    let match = regex.exec(value);
    while (match) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        name,
        kind,
        reason,
      });
      match = regex.exec(value);
    }
  });

  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const merged = [];
  let cursor = -1;
  matches.forEach((match) => {
    if (match.start < cursor) return;
    merged.push(match);
    cursor = match.end;
  });

  let html = "";
  let index = 0;
  merged.forEach((match) => {
    html += escapeHtml(value.slice(index, match.start));
    html += `<span class="${
      match.kind === "conflict" ? "compare-code-highlight-conflict-fallback" : "compare-code-highlight-data-fallback"
    }" title="${escapeHtml(match.reason)}">${escapeHtml(match.name)}</span>`;
    index = match.end;
  });
  html += escapeHtml(value.slice(index));
  fallbackNode.innerHTML = html;
}

function initCodeEditors(container) {
  disposeCodeEditors();
  ensureCompareCodeHighlightStyles();

  CODE_EDITOR_ITEMS.forEach(({ hostId, fallbackId, value, coordinationVars }) => {
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
      applyEditorHighlights(editor, coordinationVars || []);
      codeEditors.push(editor);
      if (fallback) fallback.style.display = "none";
    } catch (error) {
      host.style.display = "none";
      if (fallback) {
        fallback.style.display = "block";
        applyFallbackHighlights(fallback, value, coordinationVars || []);
      }
    }
  });
}

function renderPlaceholder(mountNode, title) {
  mountNode.innerHTML = `
    <div style="width:100%;padding:24px;border:1px dashed rgba(16,35,63,.2);color:#516074;background:#fff;">
      ${escapeHtml(title)} is not implemented yet.
    </div>
  `;
}

let nativeSimpleSplomUid = 0;

function createNativeSimpleSplomPrefix() {
  nativeSimpleSplomUid += 1;
  return `native-simple-splom-${nativeSimpleSplomUid}`;
}

function getRuntimeGlobal() {
  if (typeof window !== "undefined") return window;
  if (typeof self !== "undefined") return self;
  return {};
}

function ensureNativeSimpleSplomLibraPrimitives() {
  const runtimeGlobal = getRuntimeGlobal();
  if (runtimeGlobal.__nativeSimpleSplomLibraPrimitivesReady) return;

  Libra.Service.register("NativeSimpleSplomReorderService", {
    sharedVar: {
      names: [],
      scaleX: null,
      scaleY: null,
    },
    evaluate({ startOffsetX, offsetx, startOffsetY, offsety, self, dragging }) {
      const direction = self.getSharedVar("direction");
      const names = self.getSharedVar("names");
      const scaleX = self.getSharedVar("scaleX");
      const scaleY = self.getSharedVar("scaleY");

      let startItem;
      let targetItem;

      if (direction === "x" && offsetx !== undefined && scaleX) {
        startItem = scaleX
          .domain()
          .find((name) => scaleX(name) <= startOffsetX && startOffsetX <= scaleX(name) + scaleX.bandwidth());
        targetItem = scaleX
          .domain()
          .find((name) => scaleX(name) <= offsetx && offsetx <= scaleX(name) + scaleX.bandwidth());
      } else if (direction === "y" && offsety !== undefined && scaleY) {
        startItem = scaleY
          .domain()
          .find((name) => scaleY(name) <= startOffsetY && startOffsetY <= scaleY(name) + scaleY.bandwidth());
        targetItem = scaleY
          .domain()
          .find((name) => scaleY(name) <= offsety && offsety <= scaleY(name) + scaleY.bandwidth());
      } else {
        return {
          reorderedNames: names,
          x: scaleX,
          y: scaleY,
          dragging,
        };
      }

      if (!startItem || !targetItem) {
        return {
          reorderedNames: names.slice(),
          x: scaleX,
          y: scaleY,
          dragging,
        };
      }

      const reorderedNames = names.slice();
      const startIndex = reorderedNames.indexOf(startItem);
      const targetIndex = reorderedNames.indexOf(targetItem);

      if (startIndex !== -1 && targetIndex !== -1) {
        reorderedNames.splice(startIndex, 1);
        reorderedNames.splice(targetIndex, 0, startItem);
      }

      if (!dragging) {
        names.splice(0, names.length, ...reorderedNames);
        scaleX.domain(reorderedNames);
        if (scaleY) scaleY.domain(reorderedNames);
        return {
          reorderedNames: names.slice(),
          x: scaleX,
          y: scaleY,
          dragging,
        };
      }

      return {
        reorderedNames,
        x: scaleX.copy().domain(reorderedNames),
        y: scaleY ? scaleY.copy().domain(reorderedNames) : undefined,
        dragging,
      };
    },
  });

  Libra.GraphicalTransformer.register("NativeSimpleSplomRedrawTransformer", {
    layer: null,
    redraw({ transformer }) {
      const result = transformer.getSharedVar("result");
      const redraw = transformer.getSharedVar("redraw");
      if (!result || typeof redraw !== "function") return;
      const { reorderedNames, x, y, dragging } = result;
      if (reorderedNames && !dragging) redraw(reorderedNames, x, y);
    },
  });

  Libra.Service.register("NativeSimpleSplomFilterService", {
    evaluate({ self, result, extents, state, brushKey, brushBoxTransformer, x, y, width, height }) {
      if (!state || !brushKey) {
        return { filteredData: [], hasActiveBrush: false };
      }

      if (!state.activeBrushKeys) state.activeBrushKeys = new Set();
      const hasCurrentBox = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
      const hasExtent =
        extents &&
        typeof extents === "object" &&
        Object.keys(extents).length > 0 &&
        Object.values(extents).some((extent) => Array.isArray(extent) && extent.length > 0);

      if (brushBoxTransformer) {
        if (hasCurrentBox) {
          const overlayLayer = brushBoxTransformer.getSharedVar("overlayLayer");
          const overlayRect = overlayLayer?.getGraphic?.()?.getBoundingClientRect?.();
          state.activeBrushKey = brushKey;
          brushBoxTransformer.setSharedVar("box", {
            x: Number.isFinite(x) && overlayRect ? x - overlayRect.left : 0,
            y: Number.isFinite(y) && overlayRect ? y - overlayRect.top : 0,
            width,
            height,
          });
        } else if (state.activeBrushKey === brushKey) {
          state.activeBrushKey = null;
          brushBoxTransformer.setSharedVar("box", null);
        }
      }

      const isActiveBrush = hasExtent || hasCurrentBox;
      if (!isActiveBrush) {
        state.brushSelections.delete(brushKey);
        state.activeBrushKeys.delete(brushKey);
      } else {
        const selectedData = (Array.isArray(result) ? result : [])
          .map((node) => node?.__data__)
          .filter(Boolean);
        state.brushSelections.set(brushKey, selectedData);
        state.activeBrushKeys.add(brushKey);
      }

      const activeBrushKeys = Array.from(state.activeBrushKeys.values());
      if (!activeBrushKeys.length) {
        return {
          filteredData: state.data.slice(),
          hasActiveBrush: false,
        };
      }

      const filteredData = state.data.filter((datum) =>
        activeBrushKeys.every((activeKey) => {
          const selection = state.brushSelections.get(activeKey) || [];
          return selection.includes(datum);
        })
      );

      return {
        filteredData,
        hasActiveBrush: true,
      };
    },
  });

  Libra.GraphicalTransformer.register("NativeSimpleSplomSharedBrushBoxTransformer", {
    layer: null,
    redraw({ transformer }) {
      const layer = transformer.getSharedVar("overlayLayer") || transformer.getSharedVar("layer");
      if (!layer) return;
      const graphic = d3.select(layer.getGraphic());
      graphic.selectAll("rect.native-splom-brush-box").remove();

      const box = transformer.getSharedVar("box");
      const width = box?.width ?? 0;
      const height = box?.height ?? 0;
      if (width <= 0 || height <= 0) return;

      const brushStyle = transformer.getSharedVar("brushStyle") || {};
      const fill = brushStyle.fill ?? "#5c5c5c";
      const opacity = brushStyle.opacity ?? 0.25;
      const stroke = brushStyle.stroke ?? "none";
      const x = box?.x ?? 0;
      const y = box?.y ?? 0;

      const rect = graphic
        .append("rect")
        .attr("class", "native-splom-brush-box")
        .attr("x", x)
        .attr("y", y)
        .attr("width", width)
        .attr("height", height)
        .attr("fill", fill)
        .attr("opacity", opacity)
        .attr("stroke", stroke);

      Object.entries(brushStyle).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          rect.attr(key, value);
        }
      });
    },
  });

  Libra.GraphicalTransformer.register("NativeSimpleSplomLinkedScatterTransformer", {
    layer: null,
    redraw({ layer, transformer }) {
      const result = transformer.getSharedVar("result") || {};
      const filteredData = Array.isArray(result.filteredData) ? result.filteredData : [];
      const hasActiveBrush = !!result.hasActiveBrush;
      const filteredSet = new Set(filteredData);
      const colorAccessor = transformer.getSharedVar("colorAccessor");
      const baseOpacity = transformer.getSharedVar("baseOpacity") ?? 0.2;
      const dimOpacity = transformer.getSharedVar("dimOpacity") ?? 0.06;
      const activeOpacity = transformer.getSharedVar("activeOpacity") ?? 0.85;

      d3.select(layer.getGraphic())
        .selectAll("circle.mark")
        .attr("fill", (datum) => (typeof colorAccessor === "function" ? colorAccessor(datum) : "#4e79a7"))
        .attr("stroke", (datum) => (typeof colorAccessor === "function" ? colorAccessor(datum) : "#4e79a7"))
        .attr("stroke-width", (datum) => (hasActiveBrush && filteredSet.has(datum) ? 0.8 : 0))
        .attr("fill-opacity", (datum) => {
          if (!hasActiveBrush) return baseOpacity;
          return filteredSet.has(datum) ? activeOpacity : dimOpacity;
        })
        .attr("stroke-opacity", (datum) => {
          if (!hasActiveBrush) return 0;
          return filteredSet.has(datum) ? 1 : 0.08;
        });
    },
  });

  Libra.GraphicalTransformer.register("NativeSimpleSplomPanZoomTransformer", {
    layer: null,
    redraw({ transformer }) {
      const redrawCell = transformer.getSharedVar("redrawCell");
      if (typeof redrawCell !== "function") return;
      redrawCell(transformer.getSharedVar("scaleX"), transformer.getSharedVar("scaleY"));
    },
  });

  runtimeGlobal.__nativeSimpleSplomLibraPrimitivesReady = true;
}

function ensureNativeD3Layer(scene, layerKey, width, height, offset = { x: 0, y: 0 }) {
  if (!scene.layers[layerKey]) {
    scene.layers[layerKey] = Libra.Layer.initialize("D3Layer", {
      name: `${scene.prefix}-${layerKey}`,
      width,
      height,
      offset,
      container: scene.svg.node(),
    });
  }

  const layer = scene.layers[layerKey];
  const graphic = d3.select(layer.getGraphic());
  graphic.attr("transform", `translate(${offset.x || 0}, ${offset.y || 0})`);
  graphic
    .select("rect.ig-layer-background")
    .attr("width", width)
    .attr("height", height);
  return layer;
}

function drawNativeLibraCell(scene, cellLayer, xiField, yiField, scaleXForCell, scaleYForCell) {
  const { svg, data, color, fieldColor } = scene;
  const cellWidth = scene.scaleX.bandwidth();
  const cellHeight = scene.scaleY.bandwidth();
  const cellClipPadding = 10;
  const defs = svg.selectAll("defs#native-splom-defs").data([null]).join("defs").attr("id", "native-splom-defs");
  const cell = d3.select(cellLayer.getGraphic());
  const clipId = `${scene.prefix}-clip-${xiField}-${yiField}`;
  const clipPath = defs.selectAll(`clipPath#${clipId}`).data([null]).join("clipPath").attr("id", clipId);

  clipPath
    .selectAll("rect")
    .data([null])
    .join("rect")
    .attr("x", -cellClipPadding)
    .attr("y", -cellClipPadding)
    .attr("width", cellWidth + cellClipPadding * 2)
    .attr("height", cellHeight + cellClipPadding * 2);

  cell.selectAll(":not(.ig-layer-background)").remove();

  const marksG = cell.append("g").attr("clip-path", `url(#${clipId})`);
  if (xiField === yiField) {
    const bins = d3
      .bin()
      .domain(scaleXForCell.domain())
      .value((datum) => datum[xiField])
      .thresholds(scaleXForCell.ticks(15))(data);
    const histY = d3
      .scaleLinear()
      .domain([0, d3.max(bins, (datum) => datum.length)])
      .range([cellHeight, 0])
      .nice();

    marksG
      .selectAll("rect.bar")
      .data(bins)
      .join("rect")
      .attr("class", "bar")
      .attr("x", (datum) => scaleXForCell(datum.x0) + 1)
      .attr("y", (datum) => histY(datum.length))
      .attr("width", (datum) => Math.max(0, scaleXForCell(datum.x1) - scaleXForCell(datum.x0) - 1))
      .attr("height", (datum) => Math.max(0, cellHeight - histY(datum.length)))
      .attr("fill", "#4e79a7")
      .attr("fill-opacity", 0.7);
  } else {
    marksG
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("class", "mark")
      .attr("r", 3)
      .attr("cx", (datum) => scaleXForCell(datum[xiField]))
      .attr("cy", (datum) => scaleYForCell(datum[yiField]))
      .attr("fill", (datum) => color(datum[fieldColor]))
      .attr("fill-opacity", 0.2);
  }

  const axesG = cell.append("g");
  axesG
    .append("g")
    .attr("transform", `translate(0,${cellHeight})`)
    .call(d3.axisBottom(scaleXForCell).ticks(3).tickSize(3));
  if (xiField !== yiField) {
    axesG.append("g").call(d3.axisLeft(scaleYForCell).ticks(3).tickSize(3));
  }
}

function renderNativeLibraSplom(scene, names, scaleX, scaleY) {
  scene.names = names;
  scene.scaleX = scaleX;
  scene.scaleY = scaleY;
  scene.scatterLayers = [];

  const { svg, data, color, fieldColor } = scene;
  const cellWidth = scaleX.bandwidth();
  const cellHeight = scaleY.bandwidth();
  const cellClipPadding = 10;

  const defs = svg.selectAll("defs#native-splom-defs").data([null]).join("defs").attr("id", "native-splom-defs");
  const xAxisLayer = ensureNativeD3Layer(
    scene,
    "xAxisLayer",
    WIDTH + MARGIN.left + MARGIN.right,
    MARGIN.bottom,
    { x: 0, y: HEIGHT + MARGIN.top }
  );
  const yAxisLayer = ensureNativeD3Layer(
    scene,
    "yAxisLayer",
    MARGIN.left,
    HEIGHT + MARGIN.top + MARGIN.bottom,
    { x: 0, y: 0 }
  );

  scene.axisLayers = { xAxisLayer, yAxisLayer };

  const xAxisG = d3
    .select(xAxisLayer.getGraphic())
    .selectAll("g.native-axis-root")
    .data([null])
    .join("g")
    .attr("class", "native-axis-root")
    .attr("transform", `translate(${MARGIN.left},0)`);
  xAxisG.selectAll("*").remove();

  const yAxisG = d3
    .select(yAxisLayer.getGraphic())
    .selectAll("g.native-axis-root")
    .data([null])
    .join("g")
    .attr("class", "native-axis-root")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
  yAxisG.selectAll("*").remove();

  const localXScales = {};
  const localYScales = {};
  names.forEach((field) => {
    localXScales[field] = d3
      .scaleLinear()
      .domain(d3.extent(data, (datum) => datum[field]))
      .range([0, cellWidth])
      .nice(TICK_COUNT);
    localYScales[field] = d3
      .scaleLinear()
      .domain(d3.extent(data, (datum) => datum[field]))
      .range([cellHeight, 0])
      .nice(TICK_COUNT);
  });
  scene.localScales = { x: localXScales, y: localYScales };

  names.forEach((xiField) => {
    const cellOffsetX = scaleX(xiField);
    xAxisG
      .append("text")
      .text(xiField)
      .attr("class", "col-label")
      .attr("x", cellOffsetX + cellWidth / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px");

    names.forEach((yiField) => {
      const cellOffsetY = scaleY(yiField);
      const layerName = `cell-${xiField}-${yiField}`;
      const cellLayer = ensureNativeD3Layer(
        scene,
        layerName,
        cellWidth,
        cellHeight,
        { x: MARGIN.left + cellOffsetX, y: MARGIN.top + cellOffsetY }
      );
      const lx = localXScales[xiField];
      const ly = localYScales[yiField];
      const panZoomState = scene.panZoomScales?.get(layerName);
      const renderScaleX = panZoomState?.scaleX || lx;
      const renderScaleY = panZoomState?.scaleY || ly;
      drawNativeLibraCell(scene, cellLayer, xiField, yiField, renderScaleX, renderScaleY);

      if (xiField !== yiField) {
        scene.scatterLayers.push({
          layer: cellLayer,
          layerName,
          xiField,
          yiField,
          baseScaleX: lx,
          baseScaleY: ly,
        });
      }
    });
  });

  names.forEach((yiField) => {
    const cellOffsetY = scaleY(yiField);
    yAxisG
      .append("text")
      .text(yiField)
      .attr("class", "row-label")
      .attr("x", -40)
      .attr("y", cellOffsetY + cellHeight / 2)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px")
      .attr("transform", `rotate(-90, -40, ${cellOffsetY + cellHeight / 2})`);
  });
}

function mountNativeLibraLinkBrushing(scene) {
  const brushStyle = {
    fill: "#5c5c5c",
    opacity: 0.25,
    stroke: "none",
  };

  if (!scene.linkBrushingState) {
    scene.linkBrushingState = {
      data: scene.data.slice(),
      brushSelections: new Map(),
      activeBrushKeys: new Set(),
      activeBrushKey: null,
    };
  }

  const sharedBrushLayer = ensureNativeD3Layer(scene, "sharedBrushOverlay", WIDTH, HEIGHT, {
    x: MARGIN.left,
    y: MARGIN.top,
  });
  d3.select(sharedBrushLayer.getGraphic())
    .attr("pointer-events", "none")
    .selectAll(":not(.ig-layer-background)")
    .remove();

  if (!scene.sharedBrushBoxTransformer) {
    scene.sharedBrushBoxTransformer = Libra.GraphicalTransformer.initialize(
      "NativeSimpleSplomSharedBrushBoxTransformer",
      {
        layer: sharedBrushLayer,
        sharedVar: {
          overlayLayer: sharedBrushLayer,
          brushStyle,
          box: null,
        },
      }
    );
  } else {
    scene.sharedBrushBoxTransformer.setSharedVars({
      overlayLayer: sharedBrushLayer,
      brushStyle,
    });
  }

  const scatterTransformers = (scene.scatterLayers || []).map(({ layer }) => {
    const graphic = d3.select(layer.getGraphic());
    let transformer = scene.linkScatterTransformers?.get(layer);
    if (!transformer) {
      transformer = Libra.GraphicalTransformer.initialize("NativeSimpleSplomLinkedScatterTransformer", {
        layer,
        sharedVar: {
          result: { filteredData: scene.data.slice(), hasActiveBrush: false },
          colorAccessor: (datum) => scene.color(datum?.[scene.fieldColor]),
          baseOpacity: 0.2,
          dimOpacity: 0.06,
          activeOpacity: 0.9,
        },
      });
      if (!scene.linkScatterTransformers) scene.linkScatterTransformers = new Map();
      scene.linkScatterTransformers.set(layer, transformer);
    } else {
      transformer.setSharedVars({
        layer,
        colorAccessor: (datum) => scene.color(datum?.[scene.fieldColor]),
      });
    }
    graphic.selectAll("circle.mark").attr("class", "mark");
    return transformer;
  });

  if (!scene.brushInstruments) scene.brushInstruments = new Map();

  (scene.scatterLayers || []).forEach(({ layer, layerName, xiField, yiField }) => {
    const graphic = d3.select(layer.getGraphic());
    if (graphic.attr("data-native-link-brush-attached")) return;

    const brushInstrument = Libra.Interaction.build({
      inherit: "BrushInstrument",
      priority: 2,
      stopPropagation: true,
      remove: [
        { find: "SelectionTransformer", cascade: true },
        { find: "TransientRectangleTransformer", cascade: true },
      ],
      insert: [
        {
          find: "RectSelectionService",
          flow: [
            {
              comp: "NativeSimpleSplomFilterService",
              sharedVar: {
                state: scene.linkBrushingState,
                brushKey: `${xiField}-${yiField}`,
                brushBoxTransformer: scene.sharedBrushBoxTransformer,
              },
            },
            scatterTransformers,
          ],
        },
      ],
      layers: [
        {
          layer,
          options: { pointerEvents: "viewport" },
        },
      ],
      sharedVar: {
        brushStyle,
        scaleX: scene.localScales?.x?.[xiField],
        scaleY: scene.localScales?.y?.[yiField],
      },
    });

    scene.brushInstruments.set(layerName, brushInstrument);
    graphic.attr("data-native-link-brush-attached", "1");
  });
}

function syncNativeModifierRouting(scene, ctrlPressed) {
  scene.nativeCtrlPressed = !!ctrlPressed;

  const brushModifier = scene.nativeCtrlPressed ? "alt" : null;
  const panModifier = scene.nativeCtrlPressed ? null : "ctrl";

  scene.brushInstruments?.forEach((instrument) => {
    instrument.setSharedVar("modifierKey", brushModifier);
  });
  scene.panInstruments?.forEach((instrument) => {
    instrument.setSharedVar("modifierKey", panModifier);
  });
  scene.zoomInstruments?.forEach((instrument) => {
    instrument.setSharedVar("modifierKey", panModifier);
  });
}

function ensureNativeModifierRouting(scene) {
  if (scene.nativeModifierRoutingReady) return;
  scene.nativeModifierRoutingReady = true;

  const onKeyDown = (event) => {
    if (event.key === "Control") syncNativeModifierRouting(scene, true);
  };
  const onKeyUp = (event) => {
    if (event.key === "Control") syncNativeModifierRouting(scene, false);
  };
  const onWindowBlur = () => syncNativeModifierRouting(scene, false);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onWindowBlur);
  scene.cleanupNativeModifierRouting = () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onWindowBlur);
  };
}

function mountNativeLibraPanZoom(scene) {
  if (!scene.panZoomTransformers) scene.panZoomTransformers = new Map();
  if (!scene.panZoomScales) scene.panZoomScales = new Map();
  if (!scene.panInstruments) scene.panInstruments = new Map();
  if (!scene.zoomInstruments) scene.zoomInstruments = new Map();

  (scene.scatterLayers || []).forEach(({ layer, layerName, xiField, yiField, baseScaleX, baseScaleY }) => {
    const graphic = d3.select(layer.getGraphic());
    const currentScaleX = scene.panZoomScales.get(layerName)?.scaleX || baseScaleX.copy();
    const currentScaleY = scene.panZoomScales.get(layerName)?.scaleY || baseScaleY.copy();

    const redrawCell = (scaleXValue, scaleYValue) => {
      scene.panZoomScales.set(layerName, {
        scaleX: scaleXValue,
        scaleY: scaleYValue,
      });
      drawNativeLibraCell(scene, layer, xiField, yiField, scaleXValue, scaleYValue);

      const brushInstrument = scene.brushInstruments?.get(layerName);
      const brushService = brushInstrument?.services?.find("RectSelectionService")?.[0];
      if (brushService) {
        brushService.setSharedVars({
          scaleX: scaleXValue,
          scaleY: scaleYValue,
        });
      }
    };

    let transformer = scene.panZoomTransformers.get(layerName);
    if (!transformer) {
      transformer = Libra.GraphicalTransformer.initialize("NativeSimpleSplomPanZoomTransformer", {
        layer,
        sharedVar: {
          scaleX: currentScaleX,
          scaleY: currentScaleY,
          redrawCell,
        },
      });
      scene.panZoomTransformers.set(layerName, transformer);
    } else {
      transformer.setSharedVars({
        layer,
        scaleX: currentScaleX,
        scaleY: currentScaleY,
        redrawCell,
      });
    }

    if (!graphic.attr("data-native-pan-attached")) {
      const panInstrument = Libra.Interaction.build({
        inherit: "PanInstrument",
        layers: [{ layer, options: { pointerEvents: "viewport" } }],
        transformers: [transformer],
        priority: 4,
        stopPropagation: true,
        sharedVar: {
          modifierKey: "ctrl",
          fixRange: true,
        },
      });
      scene.panInstruments.set(layerName, panInstrument);
      graphic.attr("data-native-pan-attached", "1");
    }

    if (!graphic.attr("data-native-zoom-attached")) {
      const zoomInstrument = Libra.Interaction.build({
        inherit: "GeometricZoomInstrument",
        layers: [{ layer, options: { pointerEvents: "viewport" } }],
        transformers: [transformer],
        priority: 5,
        stopPropagation: true,
        sharedVar: {
          modifierKey: "ctrl",
          fixRange: true,
        },
      });
      scene.zoomInstruments.set(layerName, zoomInstrument);
      graphic.attr("data-native-zoom-attached", "1");
    }
  });

  ensureNativeModifierRouting(scene);
  syncNativeModifierRouting(scene, !!scene.nativeCtrlPressed);
}

function mountNativeLibraReorder(scene) {
  const { xAxisLayer, yAxisLayer } = scene.axisLayers;
  const redraw = (newNames, newX, newY) => {
    renderNativeLibraSplom(scene, newNames, newX, newY);
    mountNativeLibraLinkBrushing(scene);
    mountNativeLibraPanZoom(scene);
  };

  Libra.Interaction.build({
    inherit: "ReorderInstrument",
    layers: [xAxisLayer],
    insert: [
      {
        find: "SelectionService",
        flow: [
          { comp: "NativeSimpleSplomReorderService" },
          { comp: "NativeSimpleSplomRedrawTransformer" },
        ],
      },
    ],
    sharedVar: {
      direction: "x",
      names: scene.names,
      scaleX: scene.scaleX,
      scaleY: scene.scaleY,
      redraw,
    },
  });

  Libra.Interaction.build({
    inherit: "ReorderInstrument",
    layers: [yAxisLayer],
    insert: [
      {
        find: "SelectionService",
        flow: [
          { comp: "NativeSimpleSplomReorderService" },
          { comp: "NativeSimpleSplomRedrawTransformer" },
        ],
      },
    ],
    sharedVar: {
      direction: "y",
      names: scene.names,
      scaleX: scene.scaleX,
      scaleY: scene.scaleY,
      redraw,
    },
  });
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

function renderSPLOM(
  svg,
  xAxisLayer,
  yAxisLayer,
  data,
  fields,
  scaleX,
  scaleY,
  color,
  panZoomLinker,
  fieldColor
) {
  d3.select(xAxisLayer.getGraphic()).selectAll("*").remove();
  d3.select(yAxisLayer.getGraphic()).selectAll("*").remove();

  const cellWidth = scaleX.bandwidth();
  const cellHeight = scaleY.bandwidth();
  const cellClipPadding = 10;
  const defs = svg.selectAll("defs#splom-defs").data([null]).join("defs").attr("id", "splom-defs");
  const xAxisG = d3
    .select(xAxisLayer.getGraphic())
    .append("g")
    .attr("transform", `translate(${MARGIN.left},0)`);
  const yAxisG = d3
    .select(yAxisLayer.getGraphic())
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
  const cellLayers = {};

  const xScales = {};
  const yScales = {};
  fields.forEach((field) => {
    xScales[field] = d3
      .scaleLinear()
      .domain(d3.extent(data, (datum) => datum[field]))
      .range([0, cellWidth])
      .nice(TICK_COUNT);
    yScales[field] = d3
      .scaleLinear()
      .domain(d3.extent(data, (datum) => datum[field]))
      .range([cellHeight, 0])
      .nice(TICK_COUNT);
  });

  fields.forEach((xiField) => {
    const cellOffsetX = scaleX(xiField);

    xAxisG
      .append("text")
      .text(xiField)
      .attr("class", "col-label")
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
      cell.selectAll(":not(.ig-layer-background)").remove();

      const localX = xScales[xiField];
      const localY = yScales[yiField];

      const drawCell = (sX, sY) => {
        const lx = sX || localX;
        const ly = sY || localY;
        const clipId = `splom-clip-${layerName}`;
        const clipPath = defs.selectAll(`clipPath#${clipId}`).data([null]).join("clipPath").attr("id", clipId);
        clipPath
          .selectAll("rect")
          .data([null])
          .join("rect")
          .attr("class", "ignore")
          .attr("x", -cellClipPadding)
          .attr("y", -cellClipPadding)
          .attr("width", cellWidth + cellClipPadding * 2)
          .attr("height", cellHeight + cellClipPadding * 2);

        cell.selectAll(":not(.ig-layer-background)").remove();
        cell
          .append("rect")
          .attr("class", "frame ignore")
          .attr("width", cellWidth)
          .attr("height", cellHeight)
          .attr("fill", "none")
          .attr("stroke", "#ddd");

        const pointsG = cell.append("g").attr("clip-path", `url(#${clipId})`);

        if (xiField === yiField) {
          const bins = d3
            .bin()
            .domain(lx.domain())
            .value((datum) => datum[xiField])
            .thresholds(lx.ticks(15))(data);

          const histY = d3
            .scaleLinear()
            .domain([0, d3.max(bins, (datum) => datum.length)])
            .range([cellHeight, 0])
            .nice();

          pointsG
            .selectAll("rect.bar")
            .data(bins)
            .join("rect")
            .attr("class", "bar")
            .attr("x", (datum) => lx(datum.x0) + 1)
            .attr("y", (datum) => histY(datum.length))
            .attr("width", (datum) => Math.max(0, lx(datum.x1) - lx(datum.x0) - 1))
            .attr("height", (datum) => Math.max(0, cellHeight - histY(datum.length)))
            .attr("fill", "#4e79a7")
            .attr("fill-opacity", 0.7);
        } else {
          pointsG
            .selectAll("circle")
            .data(data)
            .join("circle")
            .attr("r", 3)
            .attr("cx", (datum) => lx(datum[xiField]))
            .attr("cy", (datum) => ly(datum[yiField]))
            .attr("fill", (datum) => color(datum[fieldColor]))
            .attr("fill-opacity", 0.2);
        }

        const axesG = cell.append("g");
        axesG
          .append("g")
          .attr("transform", `translate(0,${cellHeight})`)
          .call(d3.axisBottom(lx).ticks(3).tickSize(3));

        if (xiField !== yiField) {
          axesG.append("g").call(d3.axisLeft(ly).ticks(3).tickSize(3));
        }
      };

      drawCell(localX, localY);

      cellLayer.__drawCell = drawCell;
      cellLayer.__panZoomOnRedraw = (sX, sY) => {
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
        const redrawFromTransform = (transform) => {
          if (!transform) return;
          const nextX = typeof transform.rescaleX === "function" ? transform.rescaleX(localX.copy()) : localX;
          const nextY = typeof transform.rescaleY === "function" ? transform.rescaleY(localY.copy()) : localY;
          const onRedraw = cellLayer.__panZoomOnRedraw;
          if (typeof onRedraw === "function") onRedraw(nextX, nextY);
        };
        const panZoomInteractions = [
          {
            instrument: "pan",
            trigger: {
              type: "pan",
              modifierKey: "ctrl",
              priority: 3,
              stopPropagation: true,
            },
            target: { layer: layerName },
            feedback: {
              context: {
                scaleX: localX,
                scaleY: localY,
                fixRange: true,
                redraw: redrawFromTransform,
              },
            },
          },
          {
            instrument: "zoom",
            trigger: {
              type: "zoom",
              modifierKey: "ctrl",
              priority: 4,
              stopPropagation: true,
            },
            target: { layer: layerName },
            feedback: {
              context: {
                scaleX: localX,
                scaleY: localY,
                fixRange: true,
                redraw: redrawFromTransform,
              },
            },
          },
        ];
        compileDSL(
          panZoomInteractions,
          {
            layersByName: { [layerName]: cellLayer },
          },
          { execute: true }
        );
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

  fields.forEach((yiField) => {
    const cellOffsetY = scaleY(yiField);
    yAxisG
      .append("text")
      .text(yiField)
      .attr("class", "row-label")
      .attr("x", -40)
      .attr("y", cellOffsetY + cellHeight / 2)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px")
      .attr("transform", `rotate(-90, -40, ${cellOffsetY + cellHeight / 2})`);
  });

  return cellLayers;
}

async function mountInteraction(
  svg,
  xAxisLayer,
  yAxisLayer,
  names,
  scaleX,
  scaleY,
  color,
  data,
  cellLayers,
  panZoomLinker,
  fieldColor
) {
  const redrawSPLOM = (newNames, newX, newY) => {
    renderSPLOM(
      svg,
      xAxisLayer,
      yAxisLayer,
      data,
      newNames,
      newX,
      newY,
      color,
      panZoomLinker,
      fieldColor
    );
  };

  const cellWidth = scaleX.bandwidth();
  const cellHeight = scaleY.bandwidth();
  const xScales = {};
  const yScales = {};
  names.forEach((field) => {
    xScales[field] = d3
      .scaleLinear()
      .domain(d3.extent(data, (datum) => datum[field]))
      .range([0, cellWidth])
      .nice(TICK_COUNT);
    yScales[field] = d3
      .scaleLinear()
      .domain(d3.extent(data, (datum) => datum[field]))
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
          reorderDirection: "x",
        },
        feedforward: {
          sourceLayer: Object.values(cellLayers),
          offset: { x: MARGIN.left, y: MARGIN.top },
        },
        context: {
          names,
          scales: { x: scaleX, y: scaleY },
        },
      },
    },
    {
      instrument: "reorder",
      trigger: { type: "drag" },
      target: { layer: "yAxisLayer" },
      feedback: {
        redrawFunc: redrawSPLOM,
        service: {
          reorderDirection: "y",
        },
        feedforward: {
          sourceLayer: Object.values(cellLayers),
          offset: { x: MARGIN.left, y: MARGIN.top },
        },
        context: {
          names,
          scales: { x: scaleX, y: scaleY },
        },
      },
    },
  ];

  const groupSelectionInteractions = Object.keys(cellLayers)
    .map((layerName) => {
      const match = /^cell-(.+?)-(.+)$/.exec(layerName);
      if (!match) return null;
      const xiField = match[1];
      const yiField = match[2];
      if (xiField === yiField) return null;

      const sx = xScales[xiField];
      const sy = yScales[yiField];
      if (!sx || !sy) return null;

      return {
        instrument: "groupSelection",
        trigger: {
          type: "brush",
          remnantKey: "shift",
          priority: 2,
          stopPropagation: true,
        },
        target: { layer: layerName },
        feedback: {
          redrawFunc: {
            highlight: { color: (datum) => (datum ? color(datum[fieldColor]) : "red") },
          },
          context: {
            scaleX: sx,
            scaleY: sy,
            attrName: [xiField, yiField],
            link: {
              layers: Object.values(cellLayers),
              matchMode: "datum",
              defaultOpacity: 0.7,
              baseOpacity: 0.08,
              selectedOpacity: 0.95,
              strokeWidth: 1,
            },
          },
        },
      };
    })
    .filter(Boolean);

  await compileDSL(
    interactions.concat(groupSelectionInteractions),
    {
      layersByName: { xAxisLayer, yAxisLayer, ...cellLayers },
    },
    { execute: true }
  );
}

async function renderLibraPlusPanel(mountNode) {
  const g = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {};
  const fieldColor = g.FIELD_COLOR || "class";

  mountNode.innerHTML = "";

  const raw = await d3.csv("./public/data/bezdekIris.csv");
  const fields = ["sepal_length", "sepal_width"];
  const data = raw.map((datum) => {
    const record = { ...datum };
    for (const field of fields) record[field] = parseFloat(datum[field]);
    return record;
  });

  const svg = d3
    .select(mountNode)
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr(
      "viewBox",
      `0 0 ${WIDTH + MARGIN.left + MARGIN.right} ${HEIGHT + MARGIN.top + MARGIN.bottom}`
    )
    .attr("preserveAspectRatio", "xMidYMid meet");

  const xAxisLayer = LibraManager.getOrCreateLayer(
    svg,
    "xAxisLayer",
    WIDTH + MARGIN.left + MARGIN.right,
    MARGIN.bottom,
    0,
    HEIGHT + MARGIN.top
  );
  const yAxisLayer = LibraManager.getOrCreateLayer(
    svg,
    "yAxisLayer",
    MARGIN.left,
    HEIGHT + MARGIN.top + MARGIN.bottom
  );

  const scaleX = d3.scaleBand().domain(fields).range([0, WIDTH]).padding(0.05);
  const scaleY = d3.scaleBand().domain(fields).range([0, HEIGHT]).padding(0.05);

  const color = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(data.map((datum) => datum[fieldColor]))))
    .range(d3.schemeTableau10);

  const panZoomLinker = createPanZoomLinker();
  const cellLayers = renderSPLOM(
    svg,
    xAxisLayer,
    yAxisLayer,
    data,
    fields,
    scaleX,
    scaleY,
    color,
    panZoomLinker,
    fieldColor
  );

  await mountInteraction(
    svg,
    xAxisLayer,
    yAxisLayer,
    fields,
    scaleX,
    scaleY,
    color,
    data,
    cellLayers,
    panZoomLinker,
    fieldColor
  );
}

async function renderNativeLibraPanel(mountNode) {
  ensureNativeSimpleSplomLibraPrimitives();

  const g = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {};
  const fieldColor = g.FIELD_COLOR || "class";

  mountNode.innerHTML = "";

  const raw = await d3.csv("./public/data/bezdekIris.csv");
  const fields = ["sepal_length", "sepal_width"];
  const data = raw.map((datum) => {
    const record = { ...datum };
    for (const field of fields) record[field] = parseFloat(datum[field]);
    return record;
  });

  const svg = d3
    .select(mountNode)
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr(
      "viewBox",
      `0 0 ${WIDTH + MARGIN.left + MARGIN.right} ${HEIGHT + MARGIN.top + MARGIN.bottom}`
    )
    .attr("preserveAspectRatio", "xMidYMid meet");

  const color = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(data.map((datum) => datum[fieldColor]))))
    .range(d3.schemeTableau10);

  const scene = {
    prefix: createNativeSimpleSplomPrefix(),
    svg,
    data,
    color,
    fieldColor,
    names: fields.slice(),
    scaleX: d3.scaleBand().domain(fields).range([0, WIDTH]).padding(0.05),
    scaleY: d3.scaleBand().domain(fields).range([0, HEIGHT]).padding(0.05),
    layers: {},
    axisLayers: null,
  };

  renderNativeLibraSplom(scene, scene.names, scene.scaleX, scene.scaleY);
  mountNativeLibraReorder(scene);
  mountNativeLibraLinkBrushing(scene);
  mountNativeLibraPanZoom(scene);
}

function moveD3Field(names, source, target) {
  const next = names.slice();
  const sourceIndex = next.indexOf(source);
  const targetIndex = next.indexOf(target);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return next;
  next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source);
  return next;
}

function findD3BandTarget(scale, value) {
  return scale.domain().find((name) => {
    const start = scale(name);
    return start !== undefined && start <= value && value <= start + scale.bandwidth();
  });
}

function clearAllD3Brushes(scene, exceptKey = null) {
  if (scene.isClearingBrushes) return;
  scene.isClearingBrushes = true;
  try {
    scene.cells?.forEach((cell, key) => {
      if (cell.type !== "scatter" || !cell.brush || !cell.brushG || key === exceptKey) return;
      cell.brushG.call(cell.brush.move, null);
    });
  } finally {
    scene.isClearingBrushes = false;
  }

  if (exceptKey) {
    const current = scene.brushSelections.get(exceptKey);
    scene.brushSelections = current ? new Map([[exceptKey, current]]) : new Map();
  } else {
    scene.brushSelections.clear();
  }
}

function updateD3LinkedHighlight(scene) {
  const selectionSets = Array.from(scene.brushSelections.values()).filter((set) => set && set.size);
  let activeSet = null;

  if (selectionSets.length) {
    activeSet = new Set(selectionSets[0]);
    selectionSets.slice(1).forEach((set) => {
      activeSet = new Set(Array.from(activeSet).filter((datum) => set.has(datum)));
    });
  }

  scene.cells?.forEach((cell) => {
    if (cell.type !== "scatter") return;
    cell.marksG
      .selectAll("circle.mark")
      .attr("fill", (datum) => scene.color(datum[scene.fieldColor]))
      .attr("stroke", (datum) => scene.color(datum[scene.fieldColor]))
      .attr("stroke-width", (datum) => (activeSet && activeSet.has(datum) ? 0.8 : 0))
      .attr("stroke-opacity", (datum) => {
        if (!activeSet) return 0;
        return activeSet.has(datum) ? 1 : 0.08;
      })
      .attr("fill-opacity", (datum) => {
        if (!activeSet) return 0.2;
        return activeSet.has(datum) ? 0.9 : 0.06;
      });
  });
}

function updateD3HistogramCell(scene, cell) {
  const { marksG, axesG, xiField, cellHeight } = cell;
  const scaleX = scene.panZoomX?.get(xiField) || scene.localXScales[xiField].copy();
  cell.scaleX = scaleX;
  marksG.selectAll("*").remove();
  if (axesG) axesG.selectAll("*").remove();

  const bins = d3
    .bin()
    .domain(scaleX.domain())
    .value((datum) => datum[xiField])
    .thresholds(scaleX.ticks(15))(scene.data);

  const histY = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (datum) => datum.length)])
    .range([cellHeight, 0])
    .nice();

  marksG
    .selectAll("rect.bar")
    .data(bins)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (datum) => scaleX(datum.x0) + 1)
    .attr("y", (datum) => histY(datum.length))
    .attr("width", (datum) => Math.max(0, scaleX(datum.x1) - scaleX(datum.x0) - 1))
    .attr("height", (datum) => Math.max(0, cellHeight - histY(datum.length)))
    .attr("fill", "#4e79a7")
    .attr("fill-opacity", 0.7);

  if (axesG) {
    axesG
      .append("g")
      .attr("transform", `translate(0,${cellHeight})`)
      .call(d3.axisBottom(scaleX).ticks(3).tickSize(3));
  }
}

function updateD3ScatterCell(scene, cell) {
  const { marksG, axesG, xiField, yiField, cellHeight, state } = cell;
  state.xScale = (scene.panZoomX?.get(xiField) || state.baseX.copy()).copy();
  state.yScale = (scene.panZoomY?.get(yiField) || state.baseY.copy()).copy();
  marksG.selectAll("*").remove();
  axesG.selectAll("*").remove();

  marksG
    .selectAll("circle.mark")
    .data(scene.data)
    .join("circle")
    .attr("class", "mark")
    .attr("r", 3)
    .attr("cx", (datum) => state.xScale(datum[xiField]))
    .attr("cy", (datum) => state.yScale(datum[yiField]));

  axesG.append("g").attr("transform", `translate(0,${cellHeight})`).call(d3.axisBottom(state.xScale).ticks(3).tickSize(3));
  axesG.append("g").call(d3.axisLeft(state.yScale).ticks(3).tickSize(3));

  updateD3LinkedHighlight(scene);
}

function propagateD3PanZoom(scene, originCell, transform) {
  if (!originCell || !transform) return;

  scene.panZoomX.set(originCell.xiField, transform.rescaleX(originCell.state.baseX.copy()));
  scene.panZoomY.set(originCell.yiField, transform.rescaleY(originCell.state.baseY.copy()));

  scene.cells?.forEach((cell) => {
    if (cell.type === "histogram") {
      if (cell.xiField === originCell.xiField) updateD3HistogramCell(scene, cell);
      return;
    }

    if (cell.xiField === originCell.xiField || cell.yiField === originCell.yiField) {
      updateD3ScatterCell(scene, cell);
    }
  });
}

function attachD3ScatterInteractions(scene, cell) {
  cell.brush = d3
    .brush()
    .extent([
      [0, 0],
      [cell.cellWidth, cell.cellHeight],
    ])
    .filter((event) => !event.ctrlKey && !event.button)
    .on("start", (event) => {
      if (scene.isClearingBrushes) return;
      if (event.sourceEvent && !event.sourceEvent.shiftKey) {
        clearAllD3Brushes(scene, cell.key);
      }
    })
    .on("brush end", (event) => {
      if (scene.isClearingBrushes) return;
      if (!event.selection) {
        scene.brushSelections.delete(cell.key);
        updateD3LinkedHighlight(scene);
        return;
      }

      const [[x0, y0], [x1, y1]] = event.selection;
      const selected = new Set(
        scene.data.filter((datum) => {
          const px = cell.state.xScale(datum[cell.xiField]);
          const py = cell.state.yScale(datum[cell.yiField]);
          return x0 <= px && px <= x1 && y0 <= py && py <= y1;
        })
      );
      scene.brushSelections.set(cell.key, selected);
      updateD3LinkedHighlight(scene);
    });

  cell.brushG.call(cell.brush);

  cell.zoom = d3
    .zoom()
    .scaleExtent([1, 8])
    .filter((event) => {
      if (event.type === "wheel") return !!event.ctrlKey;
      return !!event.ctrlKey && !event.button;
    })
    .on("start", () => {
      clearAllD3Brushes(scene);
      updateD3LinkedHighlight(scene);
    })
    .on("zoom", (event) => {
      cell.state.transform = event.transform;
      propagateD3PanZoom(scene, cell, event.transform);
    });

  cell.root.call(cell.zoom).on("dblclick.zoom", null);
}

function renderD3Splom(scene) {
  scene.scaleX.domain(scene.names);
  scene.scaleY.domain(scene.names);
  scene.svg.selectAll("*").remove();
  scene.cells = new Map();

  const defs = scene.svg.selectAll("defs#d3-splom-defs").data([null]).join("defs").attr("id", "d3-splom-defs");
  const xAxisG = scene.svg.append("g").attr("transform", `translate(${MARGIN.left},0)`);
  const yAxisG = scene.svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  const cellWidth = scene.scaleX.bandwidth();
  const cellHeight = scene.scaleY.bandwidth();
  scene.localXScales = {};
  scene.localYScales = {};
  if (!scene.panZoomX) scene.panZoomX = new Map();
  if (!scene.panZoomY) scene.panZoomY = new Map();

  scene.names.forEach((field) => {
    scene.localXScales[field] = d3
      .scaleLinear()
      .domain(d3.extent(scene.data, (datum) => datum[field]))
      .range([0, cellWidth])
      .nice(TICK_COUNT);
    scene.localYScales[field] = d3
      .scaleLinear()
      .domain(d3.extent(scene.data, (datum) => datum[field]))
      .range([cellHeight, 0])
      .nice(TICK_COUNT);
  });

  const xLabelDrag = d3.drag().on("end", (event, field) => {
    const [pointerX] = d3.pointer(event, scene.svg.node());
    const target = findD3BandTarget(scene.scaleX, pointerX - MARGIN.left);
    if (!target || target === field) return;
    scene.names = moveD3Field(scene.names, field, target);
    scene.scatterStates.clear();
    scene.brushSelections.clear();
    renderD3Splom(scene);
  });

  const yLabelDrag = d3.drag().on("end", (event, field) => {
    const [, pointerY] = d3.pointer(event, scene.svg.node());
    const target = findD3BandTarget(scene.scaleY, pointerY - MARGIN.top);
    if (!target || target === field) return;
    scene.names = moveD3Field(scene.names, field, target);
    scene.scatterStates.clear();
    scene.brushSelections.clear();
    renderD3Splom(scene);
  });

  scene.names.forEach((xiField) => {
    const cellOffsetX = scene.scaleX(xiField);
    xAxisG
      .append("text")
      .datum(xiField)
      .text(xiField)
      .attr("class", "col-label")
      .attr("x", cellOffsetX + cellWidth / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px")
      .style("cursor", "grab")
      .call(xLabelDrag);

    scene.names.forEach((yiField) => {
      const cellOffsetY = scene.scaleY(yiField);
      const key = `d3-cell-${xiField}-${yiField}`;
      const cellG = scene.svg
        .append("g")
        .attr("transform", `translate(${MARGIN.left + cellOffsetX},${MARGIN.top + cellOffsetY})`);

      const clipId = `${scene.prefix}-clip-${xiField}-${yiField}`;
      defs
        .selectAll(`clipPath#${clipId}`)
        .data([null])
        .join("clipPath")
        .attr("id", clipId)
        .selectAll("rect")
        .data([null])
        .join("rect")
        .attr("x", -10)
        .attr("y", -10)
        .attr("width", cellWidth + 20)
        .attr("height", cellHeight + 20);

      cellG.append("rect").attr("class", "frame").attr("width", cellWidth).attr("height", cellHeight).attr("fill", "none").attr("stroke", "#ddd");

      const marksG = cellG.append("g").attr("clip-path", `url(#${clipId})`);
      const axesG = cellG.append("g");

      if (xiField === yiField) {
        const histCell = {
          key,
          type: "histogram",
          xiField,
          cellHeight,
          marksG,
          axesG,
        };
        updateD3HistogramCell(scene, histCell);
        scene.cells.set(key, histCell);
        return;
      }

      const previousState = scene.scatterStates.get(key);
      const baseX = scene.localXScales[xiField].copy();
      const baseY = scene.localYScales[yiField].copy();
      const transform = previousState?.transform || d3.zoomIdentity;
      const state = {
        transform,
        baseX,
        baseY,
        xScale: transform.rescaleX(baseX.copy()),
        yScale: transform.rescaleY(baseY.copy()),
      };
      scene.scatterStates.set(key, state);

      const brushG = cellG.append("g").attr("class", "brush");
      const cell = {
        key,
        type: "scatter",
        root: cellG,
        marksG,
        axesG,
        brushG,
        xiField,
        yiField,
        state,
        cellWidth,
        cellHeight,
      };
      scene.cells.set(key, cell);
      updateD3ScatterCell(scene, cell);
      attachD3ScatterInteractions(scene, cell);
    });
  });

  scene.names.forEach((yiField) => {
    const cellOffsetY = scene.scaleY(yiField);
    yAxisG
      .append("text")
      .datum(yiField)
      .text(yiField)
      .attr("class", "row-label")
      .attr("x", -40)
      .attr("y", cellOffsetY + cellHeight / 2)
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("font-size", "14px")
      .attr("transform", `rotate(-90, -40, ${cellOffsetY + cellHeight / 2})`)
      .style("cursor", "grab")
      .call(yLabelDrag);
  });

  updateD3LinkedHighlight(scene);
}

async function renderD3Panel(mountNode) {
  const g = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {};
  const fieldColor = g.FIELD_COLOR || "class";

  mountNode.innerHTML = "";

  const raw = await d3.csv("./public/data/bezdekIris.csv");
  const fields = ["sepal_length", "sepal_width"];
  const data = raw.map((datum) => {
    const record = { ...datum };
    for (const field of fields) record[field] = parseFloat(datum[field]);
    return record;
  });

  const svg = d3
    .select(mountNode)
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr(
      "viewBox",
      `0 0 ${WIDTH + MARGIN.left + MARGIN.right} ${HEIGHT + MARGIN.top + MARGIN.bottom}`
    )
    .attr("preserveAspectRatio", "xMidYMid meet");

  const color = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(data.map((datum) => datum[fieldColor]))))
    .range(d3.schemeTableau10);

  const scene = {
    prefix: createNativeSimpleSplomPrefix(),
    svg,
    data,
    color,
    fieldColor,
    names: fields.slice(),
    scaleX: d3.scaleBand().domain(fields).range([0, WIDTH]).padding(0.05),
    scaleY: d3.scaleBand().domain(fields).range([0, HEIGHT]).padding(0.05),
    brushSelections: new Map(),
    scatterStates: new Map(),
    cells: new Map(),
  };

  renderD3Splom(scene);
}

function buildVegaLiteSplomSpec(data, fieldColor) {
  const fields = ["sepal_length", "sepal_width"];

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    background: "white",
    padding: 8,
    spacing: 8,
    data: { values: data },
    params: [
      {
        name: "brush",
        select: {
          type: "interval",
          on: "[pointerdown[!event.ctrlKey], window:pointerup] > window:pointermove!",
          translate: "[pointerdown[!event.ctrlKey], window:pointerup] > window:pointermove!",
          clear: "dblclick[!event.ctrlKey]",
        },
      },
      {
        name: "grid",
        select: {
          type: "interval",
          bind: "scales",
          on: "[pointerdown[event.ctrlKey], window:pointerup] > window:pointermove!",
          translate: "[pointerdown[event.ctrlKey], window:pointerup] > window:pointermove!",
          zoom: "wheel![event.ctrlKey]",
          clear: "dblclick[event.ctrlKey]",
        },
      },
    ],
    repeat: {
      row: fields.slice().reverse(),
      column: fields,
    },
    spec: {
      width: 135,
      height: 135,
      mark: {
        type: "point",
        filled: true,
        size: 36,
      },
      encoding: {
        x: {
          field: { repeat: "column" },
          type: "quantitative",
          scale: { zero: false },
          axis: { title: null, tickCount: 3 },
        },
        y: {
          field: { repeat: "row" },
          type: "quantitative",
          scale: { zero: false },
          axis: { title: null, tickCount: 3 },
        },
        color: {
          field: fieldColor,
          type: "nominal",
          scale: { scheme: "tableau10" },
          legend: { title: fieldColor },
        },
        opacity: {
          condition: { param: "brush", value: 0.95 },
          value: 0.16,
        },
        tooltip: [
          { field: "sepal_length", type: "quantitative" },
          { field: "sepal_width", type: "quantitative" },
          { field: fieldColor, type: "nominal" },
        ],
      },
    },
    resolve: {
      scale: {
        x: "independent",
        y: "independent",
      },
    },
    config: {
      view: { stroke: "#d8d5c8" },
      axis: {
        labelColor: "#516074",
        titleColor: "#10233f",
        gridColor: "rgba(16, 35, 63, 0.08)",
      },
    },
  };
}

async function renderVegaLitePanel(mountNode) {
  const runtimeGlobal = getRuntimeGlobal();
  const fieldColor = runtimeGlobal.FIELD_COLOR || "class";

  mountNode.innerHTML = "";

  const raw = await d3.csv("./public/data/bezdekIris.csv");
  const fields = ["sepal_length", "sepal_width"];
  const data = raw.map((datum) => {
    const record = { ...datum };
    for (const field of fields) record[field] = parseFloat(datum[field]);
    return record;
  });

  await vegaEmbed(mountNode, buildVegaLiteSplomSpec(data, fieldColor), {
    actions: false,
    renderer: "svg",
  });
}

async function renderPanels(container) {
  const panels = [
    {
      mountId: "SimpleSplomCompareLibraPlusMount",
      statusId: "SimpleSplomCompareLibraPlusStatus",
      render: renderLibraPlusPanel,
      note: buildPanelNoteHtml(
        "This panel reuses the current Simple SPLOM interaction design with DSL-defined reorder, linked brushing, and ctrl-routed pan/zoom.",
        "libraPlus"
      ),
    },
    {
      mountId: "SimpleSplomCompareLibraMount",
      statusId: "SimpleSplomCompareLibraStatus",
      render: renderNativeLibraPanel,
      note: buildPanelNoteHtml(
        "This panel rebuilds the example with low-level Layer.initialize and Interaction.build, including reorder, linked brushing, and manual modifier routing.",
        "libraNative"
      ),
    },
    {
      mountId: "SimpleSplomCompareVegaLiteMount",
      statusId: "SimpleSplomCompareVegaLiteStatus",
      render: renderVegaLitePanel,
      note: buildPanelNoteHtml(
        "This panel uses a repeated scatterplot matrix with interval brushing and ctrl-routed scale interaction.",
        "vegaLite",
        "Reorder and linked pan/zoom are not implementable in Vega-Lite here."
      ),
    },
    {
      mountId: "SimpleSplomCompareD3Mount",
      statusId: "SimpleSplomCompareD3Status",
      render: renderD3Panel,
      note: buildPanelNoteHtml(
        "This panel implements reorder, linked brushing, and ctrl-routed pan/zoom with d3.drag, d3.brush, and d3.zoom.",
        "d3"
      ),
    },
  ];

  for (const panel of panels) {
    const mountNode = container.querySelector(`#${panel.mountId}`);
    if (!mountNode) continue;

    try {
      // Sequential mounting avoids cross-panel interaction setup conflicts.
      // eslint-disable-next-line no-await-in-loop
      await panel.render(mountNode);
      setStatus(container, panel.statusId, panel.note);
    } catch (error) {
      setStatus(container, panel.statusId, `Failed to mount: ${error.message}`, true);
    }
  }

  if (Libra && typeof Libra.createHistoryTrack === "function") {
    try {
      await Libra.createHistoryTrack();
    } catch (error) {
      // The compare page can still work without history tracking.
    }
  }
}

export default async function initSimpleSplomComparePage() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;

  disposeCodeEditors();
  container.innerHTML = renderPage();
  initCodeEditors(container);
  await renderPanels(container);
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}
