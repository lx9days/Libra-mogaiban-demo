import * as d3 from "d3";
import { createPlan } from "./shared";

function parseRotateTransform(transformStr) {
  if (!transformStr) return null;
  const match = transformStr.match(/rotate\(([^,)]+)(?:,\s*([^,)]+))?(?:,\s*([^,)]+))?\)/);
  if (match) {
    return {
      angle: Number(match[1]),
      cx: match[2] ? Number(match[2]) : undefined,
      cy: match[3] ? Number(match[3]) : undefined,
    };
  }
  return null;
}

function resolveLayer(layersByName, layerRef) {
  if (!layerRef) return null;
  if (typeof layerRef === "string") return layersByName[layerRef] || null;
  if (Array.isArray(layerRef)) return layerRef[0] || null;
  return layerRef;
}

function createMatrixAutoRedraw(autoRedraw = {}, layersByName = {}) {
  const cfg = autoRedraw && typeof autoRedraw === "object" ? autoRedraw : {};
  const cellLayerName = cfg.cellLayer || "cellLayer";
  const xAxisLayerName = cfg.xAxisLayer || "xAxisLayer";
  const yAxisLayerName = cfg.yAxisLayer || "yAxisLayer";
  const cellSelector = cfg.cellSelector || ".cell";
  const xLabelSelector = cfg.xLabelSelector || ".col-label";
  const yLabelSelector = cfg.yLabelSelector || ".row-label";
  const colField = cfg.colField || "col";
  const rowField = cfg.rowField || "row";
  let xLabelY = cfg.xLabelY;
  let yLabelX = cfg.yLabelX;
  let xLabelRotate = cfg.xLabelRotate;

  const cellLayer = resolveLayer(layersByName, cellLayerName);
  const xAxisLayer = resolveLayer(layersByName, xAxisLayerName);
  const yAxisLayer = resolveLayer(layersByName, yAxisLayerName);

  let xLabelRotateCenterY;
  if (xAxisLayer) {
    const firstXLabel = d3.select(xAxisLayer.getGraphic()).select(xLabelSelector).node();
    if (firstXLabel) {
      if (xLabelY === undefined) {
        const yAttr = firstXLabel.getAttribute("y");
        const yNum = yAttr !== null ? Number(yAttr) : NaN;
        if (!Number.isNaN(yNum)) xLabelY = yNum;
      }
      const parsed = parseRotateTransform(firstXLabel.getAttribute("transform"));
      if (xLabelRotate === undefined && parsed) xLabelRotate = parsed.angle;
      if (parsed && parsed.cy !== undefined && !Number.isNaN(parsed.cy)) {
        xLabelRotateCenterY = parsed.cy;
      }
    }
  }
  if (yAxisLayer) {
    const firstYLabel = d3.select(yAxisLayer.getGraphic()).select(yLabelSelector).node();
    if (firstYLabel && yLabelX === undefined) {
      const xAttr = firstYLabel.getAttribute("x");
      const xNum = xAttr !== null ? Number(xAttr) : NaN;
      if (!Number.isNaN(xNum)) yLabelX = xNum;
    }
  }

  return (newNames, newScaleX, newScaleY) => {
    if (cellLayer && newScaleX && newScaleY) {
      const cellG = d3.select(cellLayer.getGraphic());
      const cellSel = cellG.selectAll(cellSelector);
      if (typeof newScaleX.bandwidth === "function") {
        cellSel.attr("width", newScaleX.bandwidth());
      }
      if (typeof newScaleY.bandwidth === "function") {
        cellSel.attr("height", newScaleY.bandwidth());
      }
      cellSel
        .attr("x", (d) => newScaleX(d?.[colField]))
        .attr("y", (d) => newScaleY(d?.[rowField]));
    }

    if (xAxisLayer && newScaleX) {
      const xG = d3.select(xAxisLayer.getGraphic());
      const xLabels = xG.selectAll(xLabelSelector).data(newNames || []);
      const bandwidth =
        typeof newScaleX.bandwidth === "function" ? newScaleX.bandwidth() : 0;
      const centeredX = (d) => newScaleX(d) + bandwidth / 2;
      xLabels.attr("x", centeredX);
      if (xLabelY !== undefined) xLabels.attr("y", xLabelY);
      xLabels.text((d) => d);
      if (xLabelRotate !== undefined) {
        const rotateY =
          xLabelY !== undefined
            ? xLabelY
            : xLabelRotateCenterY !== undefined
              ? xLabelRotateCenterY
              : 0;
        xLabels.attr("transform", (d) => `rotate(${xLabelRotate}, ${centeredX(d)}, ${rotateY})`);
      }
    }

    if (yAxisLayer && newScaleY) {
      const yG = d3.select(yAxisLayer.getGraphic());
      const yLabels = yG.selectAll(yLabelSelector).data(newNames || []);
      const bandwidth =
        typeof newScaleY.bandwidth === "function" ? newScaleY.bandwidth() : 0;
      const centeredY = (d) => newScaleY(d) + bandwidth / 2;
      yLabels.attr("y", centeredY);
      if (yLabelX !== undefined) yLabels.attr("x", yLabelX);
      yLabels.text((d) => d);
    }
  };
}

function createAutoRedraw(autoRedraw, layersByName) {
  if (!autoRedraw) return null;
  if (autoRedraw === true || autoRedraw === "default") return createMatrixAutoRedraw({ type: "matrix" }, layersByName);
  if (typeof autoRedraw === "string")
    return createAutoRedraw({ type: autoRedraw }, layersByName);
  if (typeof autoRedraw === "function") return autoRedraw;
  if (typeof autoRedraw !== "object") return null;
  const type = typeof autoRedraw.type === "string" ? autoRedraw.type.toLowerCase() : "matrix";
  if (type === "matrix") return createMatrixAutoRedraw(autoRedraw, layersByName);
  return null;
}

export const reorderCompiler = {
  id: "reorder",
  families: ["reorder"],
  match(spec = {}) {
    return spec.family === "reorder" || spec.instrument === "reorder";
  },
  compile(spec, context) {
    const rawSpec = spec.rawSpec || {};
    const feedback = rawSpec.feedback || {};
    const redrawFunc = feedback.redrawFunc;
    const service = feedback.service || {};
    const feedforward = feedback.feedforward || feedback.feedForward || {};
    const contextObj = feedback.context || {};
    
    let direction = service.reorderDirection || service.direction || "x";
    let names = contextObj.names || [];
    let scaleX = contextObj.scales?.x;
    let scaleY = contextObj.scales?.y;
    let copyFromRaw = feedforward.sourceLayer || contextObj.copyFrom;
    let copyFrom;
    if (Array.isArray(copyFromRaw)) {
      copyFrom = copyFromRaw.map(ref => typeof ref === "string" ? context.layersByName[ref] : ref).filter(Boolean);
    } else {
      copyFrom = resolveLayer(context.layersByName, copyFromRaw);
    }
    let offset = feedforward.offset || { x: 0, y: 0 };
    
    let redraw = null;
    if (typeof redrawFunc === "function") {
      redraw = redrawFunc;
    } else if (redrawFunc) {
      redraw = createAutoRedraw(redrawFunc, context.layersByName);
    }

    const extraBuildContext = {
      direction,
      names,
      scaleX,
      scaleY,
      copyFrom,
      offset,
      redraw,
      syntheticEvent: typeof rawSpec.trigger?.syntheticEvent === "string" ? rawSpec.trigger.syntheticEvent : undefined,
      gestureMoveDelay: undefined,
    };

    return [
      createPlan(spec, context, "reorder", {
        compilerId: this.id,
        buildContext: extraBuildContext
      }),
    ];
  },
};

export default reorderCompiler;
