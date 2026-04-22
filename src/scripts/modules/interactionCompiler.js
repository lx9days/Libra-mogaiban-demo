// A lightweight compiler that converts interaction JSON spec into Libra.Interaction.build calls
import Libra from "libra-vis";
import * as d3 from "d3";
import LibraManager from "../../core/LibraManager";

// Map JSON trigger to Libra instrument inherit names
const triggerToInstrument = {
  hover: "HoverInstrument",
  click: "ClickInstrument",
  brush: "BrushInstrument",
  lasso: "LassoInstrument",
  "brush-x": "BrushXInstrument",
  brushx: "BrushXInstrument",
  "brush-y": "BrushYInstrument",
  brushy: "BrushYInstrument",
  drag: "DragInstrument",
  pan: "PanInstrument",
  zoom: "GeometricZoomInstrument",
  // You can extend this map: click -> ClickInstrument, brush -> BrushInstrument, etc.
};

const interactionAlias = {
  move: "moving",
  zoom: "zooming",
  pan: "panning",
};

function stripInlineComment(str) {
  if (typeof str !== "string") return str;
  const idx = str.indexOf("//");
  return idx >= 0 ? str.slice(0, idx).trim() : str.trim();
}

function resolveFirstLayer(layersByName, name) {
  if (!name) return null;
  const direct = layersByName?.[name];
  if (direct) return Array.isArray(direct) ? direct[0] : direct;
  const found = Libra.Layer.findLayer(name);
  if (Array.isArray(found)) return found[0] || null;
  return found || null;
}

function resolveFeedbackOptionsValue(raw, buildCtx) {
  if (typeof raw === "function") {
    const resolved = raw(buildCtx);
    return resolved && typeof resolved === "object" ? resolved : {};
  }
  if (!raw || typeof raw !== "object") return {};

  const build =
    raw.build ??
    raw.Build ??
    raw.builder ??
    raw.Builder ??
    raw.buildRef ??
    raw.buildref;

  let built = null;
  if (typeof build === "function") {
    built = build(buildCtx);
  } else if (
    typeof build === "string" &&
    buildCtx?.handlers &&
    typeof buildCtx.handlers[build] === "function"
  ) {
    built = buildCtx.handlers[build](buildCtx);
  }

  if (built && typeof built === "object") return { ...raw, ...built };
  return raw;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function normalizeHighlightValue(raw) {
  if (!isPlainObject(raw)) return raw;
  if (isPlainObject(raw.style)) return raw.style;
  return raw;
}

function normalizeFeedbackObject(rawFeedback = {}, instrumentRaw = "", triggerRaw = "") {
  if (!isPlainObject(rawFeedback)) return rawFeedback;

  const selection = isPlainObject(rawFeedback.selection) ? rawFeedback.selection : {};
  const geometry = isPlainObject(rawFeedback.geometry) ? rawFeedback.geometry : {};
  const axis = isPlainObject(rawFeedback.axis) ? rawFeedback.axis : {};
  const link = isPlainObject(rawFeedback.link) ? rawFeedback.link : {};
  const lens = isPlainObject(rawFeedback.lens) ? rawFeedback.lens : {};
  const zoom = isPlainObject(rawFeedback.zoom) ? rawFeedback.zoom : {};

  const normalized = { ...rawFeedback };
  const setIfDefined = (key, value) => {
    if (value !== undefined) normalized[key] = value;
  };

  setIfDefined(
    "Highlight",
    normalizeHighlightValue(
      pickFirstDefined(selection.highlight, selection.Highlight, rawFeedback.highlight, rawFeedback.Highlight)
    )
  );
  setIfDefined("Dim", pickFirstDefined(selection.dim, selection.Dim, rawFeedback.dim, rawFeedback.Dim));
  setIfDefined(
    "RemnantKey",
    pickFirstDefined(
      selection.remnantKey,
      selection.RemnantKey,
      rawFeedback.remnantKey,
      rawFeedback.RemnantKey
    )
  );
  setIfDefined(
    "BrushStyle",
    pickFirstDefined(
      selection.brushStyle,
      selection.BrushStyle,
      rawFeedback.brushStyle,
      rawFeedback.BrushStyle
    )
  );
  setIfDefined("Tooltip", pickFirstDefined(selection.tooltip, rawFeedback.tooltip, rawFeedback.Tooltip));
  setIfDefined("ScaleX", pickFirstDefined(geometry.scaleX, geometry.ScaleX, rawFeedback.scaleX, rawFeedback.ScaleX));
  setIfDefined("ScaleY", pickFirstDefined(geometry.scaleY, geometry.ScaleY, rawFeedback.scaleY, rawFeedback.ScaleY));
  setIfDefined(
    "FixRange",
    pickFirstDefined(geometry.fixRange, geometry.FixRange, rawFeedback.fixRange, rawFeedback.FixRange)
  );
  setIfDefined(
    "Direction",
    pickFirstDefined(geometry.direction, geometry.Direction, rawFeedback.direction, rawFeedback.Direction)
  );
  setIfDefined(
    "Scale",
    pickFirstDefined(
      axis.scale,
      axis.Scale,
      selection.scale,
      selection.Scale,
      rawFeedback.scale,
      rawFeedback.Scale
    )
  );
  setIfDefined(
    "AttrName",
    pickFirstDefined(
      axis.attrName,
      axis.AttrName,
      selection.attrName,
      selection.AttrName,
      rawFeedback.attrName,
      rawFeedback.AttrName
    )
  );
  setIfDefined(
    "SelectionMode",
    pickFirstDefined(
      selection.mode,
      selection.Mode,
      rawFeedback.selectionMode,
      rawFeedback.SelectionMode
    )
  );
  setIfDefined(
    "BaseOpacity",
    pickFirstDefined(
      selection.baseOpacity,
      selection.BaseOpacity,
      rawFeedback.baseOpacity,
      rawFeedback.BaseOpacity
    )
  );
  setIfDefined(
    "axisDirection",
    pickFirstDefined(axis.direction, axis.Direction, rawFeedback.axisDirection, rawFeedback.AxisDirection)
  );
  setIfDefined(
    "highlightAttrValues",
    pickFirstDefined(
      selection.highlightAttrValues,
      selection.HighlightAttrValues,
      rawFeedback.highlightAttrValues,
      rawFeedback.HighlightAttrValues
    )
  );
  setIfDefined("LinkLayers", pickFirstDefined(link.layers, link.Layers, rawFeedback.linkLayers, rawFeedback.LinkLayers));
  setIfDefined(
    "LinkMatchMode",
    pickFirstDefined(link.matchMode, link.MatchMode, rawFeedback.linkMatchMode, rawFeedback.LinkMatchMode)
  );
  setIfDefined(
    "LinkFields",
    pickFirstDefined(
      link.fields,
      link.Fields,
      link.field,
      link.Field,
      rawFeedback.linkFields,
      rawFeedback.LinkFields,
      rawFeedback.linkField,
      rawFeedback.LinkField
    )
  );
  setIfDefined(
    "LinkDefaultOpacity",
    pickFirstDefined(link.defaultOpacity, link.DefaultOpacity, rawFeedback.linkDefaultOpacity, rawFeedback.LinkDefaultOpacity)
  );
  setIfDefined(
    "LinkBaseOpacity",
    pickFirstDefined(link.baseOpacity, link.BaseOpacity, rawFeedback.linkBaseOpacity, rawFeedback.LinkBaseOpacity)
  );
  setIfDefined(
    "LinkSelectedOpacity",
    pickFirstDefined(
      link.selectedOpacity,
      link.SelectedOpacity,
      rawFeedback.linkSelectedOpacity,
      rawFeedback.LinkSelectedOpacity
    )
  );
  setIfDefined(
    "LinkStrokeColor",
    pickFirstDefined(link.strokeColor, link.StrokeColor, rawFeedback.linkStrokeColor, rawFeedback.LinkStrokeColor)
  );
  setIfDefined(
    "LinkStrokeWidth",
    pickFirstDefined(link.strokeWidth, link.StrokeWidth, rawFeedback.linkStrokeWidth, rawFeedback.LinkStrokeWidth)
  );

  const normalizedInstrument = String(instrumentRaw || "").trim().toLowerCase();
  const normalizedTrigger = String(triggerRaw || "").trim().toLowerCase();

  const excentricConfig = pickFirstDefined(
    lens.excentricLabeling,
    lens.ExcentricLabeling,
    rawFeedback.excentricLabeling,
    rawFeedback.ExcentricLabeling
  );
  if (excentricConfig !== undefined) {
    normalized.ExcentricLabeling = excentricConfig;
  } else if (normalizedInstrument === "lens" || normalizedTrigger === "hover") {
    const lensFallback = Object.keys(lens).length > 0 ? lens : null;
    if (lensFallback && lensFallback.zoom === undefined && lensFallback.Zoom === undefined) {
      normalized.ExcentricLabeling = lensFallback;
    }
  }

  const lensZoomConfig = pickFirstDefined(
    lens.zoom,
    lens.Zoom,
    zoom.lens,
    zoom.Lens,
    rawFeedback.lensZoom,
    rawFeedback.LensZoom
  );
  if (lensZoomConfig !== undefined) {
    normalized.LensZoom = lensZoomConfig;
  }

  return normalized;
}

function normalizeDslSpec(rawSpec = {}) {
  const triggerDescriptor = isPlainObject(rawSpec?.trigger) ? rawSpec.trigger : {};
  const targetDescriptor = isPlainObject(rawSpec?.target) ? rawSpec.target : {};
  const feedbackDescriptor = isPlainObject(rawSpec?.feedback) ? rawSpec.feedback : {};

  const instrumentRaw = pickFirstDefined(
    rawSpec?.instrument,
    rawSpec?.Instrument,
    rawSpec?.Interaction,
    rawSpec?.interaction
  );
  const triggerType = pickFirstDefined(
    triggerDescriptor?.type,
    triggerDescriptor?.Type,
    triggerDescriptor?.on,
    triggerDescriptor?.On,
    rawSpec?.trigger,
    rawSpec?.Trigger
  );

  const feedbackRaw = pickFirstDefined(
    rawSpec?.feedback,
    rawSpec?.Feedback,
    rawSpec?.feedbackOptions,
    rawSpec?.FeedbackOptions,
    rawSpec?.["Feedback options"],
    {}
  );

  const targetLayer = pickFirstDefined(
    targetDescriptor?.layer,
    targetDescriptor?.Layer,
    targetDescriptor?.layers,
    targetDescriptor?.Layers,
    rawSpec?.targetLayer,
    rawSpec?.Target,
    rawSpec?.layer,
    rawSpec?.["Target layer"]
  );

  const targetInstrument = pickFirstDefined(
    targetDescriptor?.instrument,
    targetDescriptor?.Instrument,
    targetDescriptor?.targetInstrument,
    targetDescriptor?.TargetInstrument,
    rawSpec?.["Target Instrument"],
    rawSpec?.targetInstrument,
    rawSpec?.TargetInstrument
  );

  const instrumentName = pickFirstDefined(
    rawSpec?.name,
    rawSpec?.Name,
    targetDescriptor?.name,
    targetDescriptor?.Name,
    rawSpec?.["Instrument Name"],
    rawSpec?.instrumentName
  );

  const feedbackOptions = normalizeFeedbackObject(feedbackRaw, instrumentRaw, triggerType);
  const customFeedbackFlow = pickFirstDefined(
    rawSpec?.customFeedbackFlow,
    rawSpec?.CustomFeedbackFlow,
    feedbackDescriptor?.flow,
    feedbackDescriptor?.Flow,
    feedbackDescriptor?.custom,
    feedbackDescriptor?.Custom,
    feedbackRaw?.customFeedbackFlow,
    feedbackRaw?.CustomFeedbackFlow
  );

  const layerOptionsFromTarget =
    pickFirstDefined(
      rawSpec?.layerOptions,
      rawSpec?.LayerOptions,
      targetDescriptor?.layerOptions,
      targetDescriptor?.LayerOptions
    ) ??
    (targetDescriptor?.pointerEvents !== undefined
      ? { pointerEvents: targetDescriptor.pointerEvents }
      : undefined);

  return {
    Instrument: instrumentRaw,
    instrument: instrumentRaw,
    Trigger: triggerType,
    trigger: triggerType,
    Name: instrumentName,
    name: instrumentName,
    targetLayer,
    Target: targetLayer,
    layer: targetLayer,
    "Target Instrument": targetInstrument,
    targetInstrument: targetInstrument,
    feedbackOptions,
    Feedback: feedbackOptions,
    feedback: feedbackRaw,
    feedbackRaw,
    customFeedbackFlow,
    layerOptions: layerOptionsFromTarget,
    modifierKey: pickFirstDefined(
      rawSpec?.modifierKey,
      rawSpec?.ModifierKey,
      triggerDescriptor?.modifierKey,
      triggerDescriptor?.ModifierKey,
      triggerDescriptor?.key,
      triggerDescriptor?.Key
    ),
    priority: pickFirstDefined(
      rawSpec?.priority,
      rawSpec?.Priority,
      triggerDescriptor?.priority,
      triggerDescriptor?.Priority
    ),
    stopPropagation: pickFirstDefined(
      rawSpec?.stopPropagation,
      rawSpec?.StopPropagation,
      triggerDescriptor?.stopPropagation,
      triggerDescriptor?.StopPropagation
    ),
    syntheticEvent: pickFirstDefined(
      rawSpec?.syntheticEvent,
      rawSpec?.SyntheticEvent,
      triggerDescriptor?.syntheticEvent,
      triggerDescriptor?.SyntheticEvent
    ),
    gestureMoveDelay: pickFirstDefined(
      rawSpec?.gestureMoveDelay,
      rawSpec?.GestureMoveDelay,
      triggerDescriptor?.gestureMoveDelay,
      triggerDescriptor?.GestureMoveDelay
    ),
  };
}

function parseRotateTransform(transform) {
  if (typeof transform !== "string") return null;
  const m = /rotate\(\s*([-\d.]+)(?:[ ,]+([-\d.]+)[ ,]+([-\d.]+))?\s*\)/.exec(transform);
  if (!m) return null;
  const angle = Number(m[1]);
  const cx = m[2] !== undefined ? Number(m[2]) : undefined;
  const cy = m[3] !== undefined ? Number(m[3]) : undefined;
  if (Number.isNaN(angle)) return null;
  return { angle, cx, cy };
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

  const cellLayer = resolveFirstLayer(layersByName, cellLayerName);
  const xAxisLayer = resolveFirstLayer(layersByName, xAxisLayerName);
  const yAxisLayer = resolveFirstLayer(layersByName, yAxisLayerName);

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
  if (autoRedraw === true) return createMatrixAutoRedraw({ type: "matrix" }, layersByName);
  if (typeof autoRedraw === "string")
    return createAutoRedraw({ type: autoRedraw }, layersByName);
  if (typeof autoRedraw === "function") return autoRedraw;
  if (typeof autoRedraw !== "object") return null;
  const type = typeof autoRedraw.type === "string" ? autoRedraw.type.toLowerCase() : "matrix";
  if (type === "matrix") return createMatrixAutoRedraw(autoRedraw, layersByName);
  return null;
}

function resolveNamedOrInlineRef(value, refs = {}, handlers = {}) {
  if (typeof value === "function") return value;
  if (typeof value === "string") {
    if (refs && value in refs) return refs[value];
    if (handlers && value in handlers) return handlers[value];
  }
  return value;
}

function buildSharedVar(feedback = [], scales = {}) {
  const sharedVar = {};

  for (const fb of feedback) {
    const action = fb?.action || {};
    const type = stripInlineComment(action?.type || "");

    if (!type) continue;

    // Highlight: supports constant color or scale-based color
    if (type === "highlight" || type.startsWith("highlight")) {
      const fill = action?.style?.fill;

      // Case 1: constant color as string or { value: string }
      if (typeof fill === "string") {
        const constColor = stripInlineComment(fill);
        if (constColor) sharedVar.highlightColor = () => constColor;
      } else if (fill && typeof fill === "object" && typeof fill.value === "string") {
        const constColor = stripInlineComment(fill.value);
        if (constColor) sharedVar.highlightColor = () => constColor;
      } else {
        // Case 2: scale-based color using from_data + using_scale
        const field = fill?.from_data;
        const scaleName = fill?.using_scale;
        const scaleFn = scaleName ? scales[scaleName] : undefined;
        if (field && typeof scaleFn === "function") {
          sharedVar.highlightColor = (d) => scaleFn(d[field]);
        }
      }
    }

    // Tooltip: prefix + fields
    if (type === "tooltip") {
      const content = action?.content || {};
    sharedVar.tooltip = {
      prefix: content?.prefix || "",
      fields: Array.isArray(content?.fields) ? content.fields : [],
    };
    if (typeof content?.position === "string") {
      sharedVar.tooltip.position = content.position;
    }
    if (content?.offset && typeof content.offset === "object") {
      sharedVar.tooltip.offset = content.offset;
    }
    }
  }

  return sharedVar;
}

// Compile an array of interaction specs and apply them to the provided layer
export function compileInteractions(specList = [], ctx) {
  const { layer, scales = {} } = ctx || {};
  if (!layer) return;

  const list = Array.isArray(specList) ? specList : [];

  for (const spec of list) {
    
    const trigger = stripInlineComment(spec?.trigger || "");
    const inherit = triggerToInstrument[trigger] || trigger;

    const sharedVarFromFeedback = buildSharedVar(spec?.feedback, scales);
    const sharedVarDefaults = {};

    // Provide defaults for pan/zoom instruments
    if (inherit === "PanInstrument" || inherit === "GeometricZoomInstrument") {
      if (scales.x) sharedVarDefaults.scaleX = scales.x;
      if (scales.y) sharedVarDefaults.scaleY = scales.y;
      sharedVarDefaults.fixRange = true;
    }

    const sharedVar = { ...sharedVarDefaults, ...sharedVarFromFeedback };

    console.log("build");
    Libra.Interaction.build({
      inherit,
      layers: [layer],
      sharedVar,
    });
  }
}

// Compile interactions from a DSL similar to Dust&Magnet.json
export function compileInteractionsDSL(specList = [], ctx) {
  const { layersByName = {}, scales = {}, handlers = {}, refs = {} } = ctx || {};
  const list = Array.isArray(specList) ? specList : [];
  const atomic = { instruments: new Set(), triggers: new Map() };
  const load = d3
    .csv("./public/atomic.csv")
    .then((rows) => {
      rows.forEach((r) => {
        const name = String(r["Instruments"] || "").trim().toLowerCase();
        if (!name) return;
        atomic.instruments.add(name);

        // Add normalized name (remove spaces) to support "axisselection" matching "axis selection"
        const nameNoSpace = name.replace(/\s+/g, "");
        if (nameNoSpace !== name) {
          atomic.instruments.add(nameNoSpace);
        }

        const triggers = String(r["Available Triggers"] || "")
          .toLowerCase()
          .split(/[/\s]+/)
          .filter((t) => !!t);

        const triggersSet = new Set(triggers);
        // Add normalized triggers (remove hyphens) to support "brushy" matching "brush-y"
        triggers.forEach((t) => {
          if (t.includes("-")) {
            triggersSet.add(t.replace(/-/g, ""));
          }
        });

        atomic.triggers.set(name, triggersSet);
        if (nameNoSpace !== name) {
          atomic.triggers.set(nameNoSpace, triggersSet);
        }
      });
    })
    .catch(() => {});
  const ensureLoaded = (fn) => {
    if (atomic.instruments.size > 0) fn();
    else load.finally(fn);
  };
  return new Promise((resolve) => {
    ensureLoaded(() => {
    const instrumentRegistry = new Map();
    let autoLensBindingIndex = 0;
    let anonymousInstrumentIndex = 0;
    for (const rawSpec of list) {
      const spec = { ...rawSpec, ...normalizeDslSpec(rawSpec) };
      const instrumentRaw =
        spec?.Instrument ??
        spec?.instrument ??
        spec?.Interaction ??
        spec?.interaction;
      const interaction =
        typeof instrumentRaw === "string"
          ? stripInlineComment(instrumentRaw).toLowerCase()
          : "";
      const interactionForAtomic = interactionAlias[interaction] || interaction;
      if (interaction && atomic.instruments.size > 0) {
        if (!atomic.instruments.has(interactionForAtomic)) continue;
      }
      const triggerRaw = spec?.Trigger || spec?.trigger;
      const trigger = stripInlineComment(
        typeof triggerRaw === "string" ? triggerRaw.toLowerCase() : ""
      );
      const instrumentNameRaw =
        spec?.Name ??
        spec?.name ??
        spec?.["Instrument Name"] ??
        spec?.instrumentName;
      const instrumentName =
        typeof instrumentNameRaw === "string" && instrumentNameRaw.trim() !== ""
          ? stripInlineComment(instrumentNameRaw)
          : `__anonymous_instrument_${++anonymousInstrumentIndex}`;
      const targetInstrumentRaw =
        spec?.["Target Instrument"] ??
        spec?.targetInstrument ??
        spec?.TargetInstrument;
      const targetInstrumentName =
        typeof targetInstrumentRaw === "string"
          ? stripInlineComment(targetInstrumentRaw)
          : "";
      if (interactionForAtomic && atomic.triggers.has(interactionForAtomic)) {
        const allowed = atomic.triggers.get(interactionForAtomic);
        if (allowed && !allowed.has(trigger)) continue;
      }
      const inherit = triggerToInstrument[trigger] || (trigger ? trigger : "");
      if (!inherit && !interaction) continue;

      const targetName =
        spec?.targetLayer ||
        spec?.Target ||
        spec?.layer ||
        spec?.["Target layer"];
      let layers = [];
      let autoLayerOptions = null;
      if (Array.isArray(targetName)) {
        targetName.forEach((name) => {
          let resolved =
            (typeof name === "string" && layersByName[name]) ||
            null;
          if (resolved) {
            const arr = Array.isArray(resolved) ? resolved : [resolved];
            layers = layers.concat(arr);
          } else if (typeof name === "string") {
            const found = Libra.Layer.findLayer(name);
            if (Array.isArray(found)) layers = layers.concat(found);
            else if (found) layers.push(found);
          }
        });
      } else {
        if (targetInstrumentName && instrumentRegistry.has(targetInstrumentName)) {
          const targetInstrument = instrumentRegistry.get(targetInstrumentName);
          if (targetInstrument?.layer) layers = [targetInstrument.layer];
          const queueLayerName = typeof targetName === "string" ? stripInlineComment(targetName) : "";
          if (queueLayerName && layers.length > 0 && typeof layers[0]?.getLayerFromQueue === "function") {
            const hostLayer = layers[0];
            const hostLayerName = hostLayer?._name || hostLayer?.name;
            if (queueLayerName !== hostLayerName) {
              const queuedLayer = hostLayer.getLayerFromQueue(queueLayerName);
              if (queuedLayer) {
                layers = [queuedLayer];
                if (/^labellayer$/i.test(queueLayerName)) {
                  autoLayerOptions = { pointerEvents: "viewPort" };
                } else if (/^(selectionlayer|transientlayer|lenslayer)$/i.test(queueLayerName)) {
                  autoLayerOptions = { pointerEvents: "visiblePainted" };
                }
              }
            }
          }
        } else {
          let resolved = null;
          if (typeof targetName === "string" && layersByName[targetName]) {
            resolved = layersByName[targetName];
          } else if (typeof targetName === "string") {
            const found = Libra.Layer.findLayer(targetName);
            if (found) {
              resolved = found;
            }
          }
          
          if (!resolved && typeof targetName === "string" && targetName) {
            // Try to find it in the queue of mainLayer/layer
            const defaultHost = layersByName.mainLayer || layersByName.layer;
            if (defaultHost && typeof defaultHost.getLayerFromQueue === "function") {
              let queuedLayer = defaultHost.getLayerFromQueue(targetName);
              if (!queuedLayer) {
                // Try pascal case or lowercase variations
                queuedLayer = defaultHost.getLayerFromQueue(targetName.charAt(0).toUpperCase() + targetName.slice(1)) || 
                              defaultHost.getLayerFromQueue(targetName.toLowerCase());
              }
              if (queuedLayer) resolved = queuedLayer;
            }
          }

          if (!resolved) {
            resolved = layersByName.mainLayer || layersByName.layer || null;
          }

          if (resolved) {
            layers = Array.isArray(resolved) ? resolved : [resolved];
          }
        }
      }
      if (!layers || layers.length === 0) continue;

      const feedbackOptionsRaw =
        spec?.feedbackOptions ||
        spec?.FeedbackOptions ||
        spec?.["Feedback options"] ||
        spec?.Feedback ||
        {};
      const feedbackOptions = resolveFeedbackOptionsValue(feedbackOptionsRaw, {
        spec,
        layers,
        layer: layers[0],
        layersByName,
        scales,
        handlers,
        refs,
        ctx,
      });
      const highlight = feedbackOptions?.Highlight || feedbackOptions?.highlight;
      let highlightAttrValues = null;
      if (highlight && typeof highlight === "object") {
        const attrValues =
          (highlight.attrValues &&
            typeof highlight.attrValues === "object" &&
            highlight.attrValues) ||
          (highlight.AttrValues &&
            typeof highlight.AttrValues === "object" &&
            highlight.AttrValues) ||
          null;
        if (attrValues) {
          highlightAttrValues = attrValues;
        } else {
          const { color, Color, ...rest } = highlight;
          if (Object.keys(rest).length > 0) highlightAttrValues = rest;
        }
      }

      const brushStyleValue = feedbackOptions?.BrushStyle ?? feedbackOptions?.brushStyle;
      const dimValue = feedbackOptions?.Dim ?? feedbackOptions?.dim;
      const modifierKeyRaw =
        spec?.modifierKey ??
        spec?.ModifierKey ??
        feedbackOptions?.modifierKey ??
        feedbackOptions?.ModifierKey;
      const priority =
        spec?.priority !== undefined ? spec.priority : spec?.Priority;
      const stopPropagation =
        spec?.stopPropagation !== undefined
          ? spec.stopPropagation
          : spec?.StopPropagation;

      if (
        (interaction === "group selection" ||
          interaction === "groupselection" ||
          interaction === "lasso selection" ||
          interaction === "lassoselection" ||
          interaction === "lasso") &&
        trigger === "lasso"
      ) {
        const buildContext = {
          Trigger: "lasso",
        };
        if (typeof highlight === "string") {
          buildContext.HighlightColor = highlight;
        } else if (highlight && typeof highlight === "object") {
          if (highlight.color !== undefined) buildContext.HighlightColor = highlight.color;
          if (highlight.Color !== undefined) buildContext.HighlightColor = highlight.Color;
          if (highlightAttrValues && typeof highlightAttrValues === "object") {
            buildContext.highlightAttrValues = highlightAttrValues;
          }
        }
        if (brushStyleValue !== undefined) buildContext.brushStyle = brushStyleValue;
        if (dimValue !== undefined) buildContext.dim = dimValue;
        if (modifierKeyRaw !== undefined) buildContext.modifierKey = modifierKeyRaw;
        if (priority !== undefined) buildContext.priority = priority;
        if (stopPropagation !== undefined) buildContext.stopPropagation = stopPropagation;

        for (const layer of layers) {
          LibraManager.buildLassoSelectionInstrument(layer, buildContext);
        }

        if (instrumentName) {
          instrumentRegistry.set(instrumentName, {
            type: "brush",
            layer: layers[0],
            selectionLayer:
              typeof layers[0]?.getLayerFromQueue === "function"
                ? layers[0].getLayerFromQueue("selectionLayer")
                : null,
            transientLayer:
              typeof layers[0]?.getLayerFromQueue === "function"
                ? layers[0].getLayerFromQueue("transientLayer")
                : null,
          });
        }
        continue;
      }

      const viewTransformRaw =
        feedbackOptions?.ViewTransform ??
        feedbackOptions?.viewTransform ??
        feedbackOptions?.SemanticZoom ??
        feedbackOptions?.semanticZoom;

      if (
        (interaction === "panning" || interaction === "pan") &&
        viewTransformRaw &&
        typeof viewTransformRaw === "object"
      ) {
        const buildContext = { ...viewTransformRaw };
        buildContext.redraw =
          resolveNamedOrInlineRef(
            buildContext.redraw ?? buildContext.redrawRef ?? buildContext.Renderer ?? buildContext.renderer,
            refs,
            handlers,
          ) || null;
        buildContext.stateRef =
          resolveNamedOrInlineRef(
            buildContext.stateRef ?? buildContext.state ?? buildContext.viewState,
            refs,
            handlers,
          ) || buildContext.stateRef;
        if (buildContext.stateRef && typeof buildContext.stateRef === "object") {
          buildContext.state = buildContext.stateRef;
        }
        if (modifierKeyRaw !== undefined) buildContext.modifierKey = modifierKeyRaw;
        if (priority !== undefined) buildContext.priority = priority;
        if (stopPropagation !== undefined) buildContext.stopPropagation = stopPropagation;

        for (const layer of layers) {
          LibraManager.buildViewTransformPanInstrument(layer, buildContext);
        }
        if (instrumentName) {
          instrumentRegistry.set(instrumentName, {
            type: "panning",
            layer: layers[0],
          });
        }
        continue;
      }

      if (
        (interaction === "zooming" || interaction === "zoom") &&
        viewTransformRaw &&
        typeof viewTransformRaw === "object"
      ) {
        const buildContext = { ...viewTransformRaw };
        buildContext.redraw =
          resolveNamedOrInlineRef(
            buildContext.redraw ?? buildContext.redrawRef ?? buildContext.Renderer ?? buildContext.renderer,
            refs,
            handlers,
          ) || null;
        buildContext.stateRef =
          resolveNamedOrInlineRef(
            buildContext.stateRef ?? buildContext.state ?? buildContext.viewState,
            refs,
            handlers,
          ) || buildContext.stateRef;
        if (buildContext.stateRef && typeof buildContext.stateRef === "object") {
          buildContext.state = buildContext.stateRef;
        }
        if (modifierKeyRaw !== undefined) buildContext.modifierKey = modifierKeyRaw;
        if (priority !== undefined) buildContext.priority = priority;
        if (stopPropagation !== undefined) buildContext.stopPropagation = stopPropagation;

        for (const layer of layers) {
          LibraManager.buildViewTransformZoomInstrument(layer, buildContext);
        }
        if (instrumentName) {
          instrumentRegistry.set(instrumentName, {
            type: "zooming",
            layer: layers[0],
          });
        }
        continue;
      }

      if (interaction === "reordering" || interaction === "reorderinstrument" || interaction === "reorder") {
        const directionRaw = spec?.Direction || spec?.direction || feedbackOptions?.Direction || feedbackOptions?.direction;
        const direction = typeof directionRaw === "string" ? stripInlineComment(directionRaw).toLowerCase() : "x";
        const syntheticEventRaw =
          spec?.syntheticEvent ??
          spec?.SyntheticEvent ??
          feedbackOptions?.syntheticEvent ??
          feedbackOptions?.SyntheticEvent;
        const gestureMoveDelayRaw =
          spec?.gestureMoveDelay ??
          spec?.GestureMoveDelay ??
          feedbackOptions?.gestureMoveDelay ??
          feedbackOptions?.GestureMoveDelay;
        const syntheticEvent = typeof syntheticEventRaw === "string" ? stripInlineComment(syntheticEventRaw).toLowerCase() : undefined;
        const gestureMoveDelay =
          typeof gestureMoveDelayRaw === "number" && Number.isFinite(gestureMoveDelayRaw)
            ? gestureMoveDelayRaw
            : undefined;
        const redrawRef = feedbackOptions?.redrawRef || feedbackOptions?.redrawref;
        const contextRef = feedbackOptions?.contextRef || feedbackOptions?.contextref;
        let redraw = typeof feedbackOptions?.redraw === "function" ? feedbackOptions.redraw : null;
        if (!redraw && typeof redrawRef === "function") redraw = redrawRef;
        if (!redraw && typeof redrawRef === "string" && handlers && handlers[redrawRef]) redraw = handlers[redrawRef];
        let contextObject = {};
        if (typeof contextRef === "object" && contextRef) contextObject = contextRef;
        else if (typeof contextRef === "string" && refs) contextObject = refs[contextRef] || {};
        else if (feedbackOptions?.context) contextObject = feedbackOptions.context;
        const names = contextObject?.names || (ctx?.reorder ? ctx.reorder.names : undefined) || [];
        const sX = (contextObject?.scales && contextObject.scales.x) || scales.x || (ctx?.reorder ? ctx.reorder.scaleX : undefined);
        const sY = (contextObject?.scales && contextObject.scales.y) || scales.y || (ctx?.reorder ? ctx.reorder.scaleY : undefined);
        const copyFrom = contextObject?.copyFrom || (ctx?.reorder ? ctx.reorder.copyFrom : undefined) || null;
        const offset = contextObject?.offset || (ctx?.reorder ? ctx.reorder.offset : undefined) || { x: 0, y: 0 };
        if (!redraw) {
          const autoRedraw =
            contextObject?.autoRedraw ??
            feedbackOptions?.autoRedraw ??
            feedbackOptions?.AutoRedraw;
          redraw = createAutoRedraw(autoRedraw, layersByName);
        }
        for (const layer of layers) {
          LibraManager.buildReorderInstrument(layer, {
            direction,
            copyFrom,
            names,
            scaleX: sX,
            scaleY: sY,
            redraw,
            offset,
            syntheticEvent,
            gestureMoveDelay
          });
        }
        continue;
      }

      if (interaction === "lens") {
        const excentric =
          feedbackOptions?.ExcentricLabeling ??
          feedbackOptions?.excentricLabeling ??
          feedbackOptions?.excentriclabeling;
        if (excentric) {
          const options =
            excentric && typeof excentric === "object" ? excentric : {};
          const priority =
            spec?.priority !== undefined ? spec.priority : spec?.Priority;
          const stopPropagation =
            spec?.stopPropagation !== undefined
              ? spec.stopPropagation
              : spec?.StopPropagation;
          const modifierKeyRaw =
            spec?.modifierKey ??
            spec?.ModifierKey ??
            feedbackOptions?.modifierKey ??
            feedbackOptions?.ModifierKey ??
            options?.modifierKey ??
            options?.ModifierKey;

          const syntheticEvent = spec?.syntheticEvent ?? spec?.SyntheticEvent ?? feedbackOptions?.syntheticEvent ?? feedbackOptions?.SyntheticEvent;

          const buildContext = { ...options };
          if (syntheticEvent !== undefined) {
             buildContext.syntheticEvent = syntheticEvent;
          }
          if (typeof modifierKeyRaw === "string") {
            buildContext.modifierKey = stripInlineComment(modifierKeyRaw);
          } else if (Array.isArray(modifierKeyRaw)) {
            buildContext.modifierKey = modifierKeyRaw
              .map((k) => stripInlineComment(k))
              .filter((k) => !!k);
          } else if (modifierKeyRaw === null) {
            buildContext.modifierKey = null;
          }
          const bindingKeyRaw =
            buildContext.bindingKey ??
            buildContext.BindingKey ??
            spec?.bindingKey ??
            spec?.BindingKey ??
            (instrumentName || `lens_${autoLensBindingIndex++}`);
          if (typeof bindingKeyRaw === "string") {
            buildContext.bindingKey = stripInlineComment(bindingKeyRaw);
          }
          if (priority !== undefined) buildContext.priority = priority;
          if (stopPropagation !== undefined)
            buildContext.stopPropagation = stopPropagation;
          buildContext.__lensCompareSource = "old-compiler";

          for (const layer of layers) {
            console.log("[lens-compare][old-compiler] buildContext", {
              instrumentName,
              layerName: layer?._name || layer?.name || "unknown",
              buildContext,
            });
            const stateKey = LibraManager.buildExcentricLabelingInstrument(layer, buildContext);
            const registryName = instrumentName || buildContext.bindingKey;
            if (registryName) {
              instrumentRegistry.set(registryName, {
                type: "lens",
                layer,
                bindingKey: buildContext.bindingKey,
                stateKey,
              });
            }
          }
          continue;
        }
      }

      if (
        (interaction === "moving" || interaction === "move") &&
        targetInstrumentName &&
        instrumentRegistry.has(targetInstrumentName)
      ) {
        const targetInstrument = instrumentRegistry.get(targetInstrumentName);
        if (targetInstrument?.type === "brush" && targetInstrument?.instrument) {
          const brushConfig =
            (spec?.feedbackRaw && isPlainObject(spec.feedbackRaw)
              ? spec.feedbackRaw.service || spec.feedbackRaw.brush
              : feedbackOptions?.BrushMove ?? feedbackOptions?.brushMove ?? {}) || {};
          if (brushConfig.updateBrush) {
            const buildContext = { ...brushConfig, brushEntry: targetInstrument };
            const modifierKeyRaw =
              spec?.modifierKey ??
              spec?.ModifierKey ??
              feedbackOptions?.modifierKey ??
              feedbackOptions?.ModifierKey;
            if (modifierKeyRaw !== undefined) buildContext.modifierKey = modifierKeyRaw;
            const priority =
              spec?.priority !== undefined ? spec.priority : spec?.Priority;
            const stopPropagation =
              spec?.stopPropagation !== undefined
                ? spec.stopPropagation
                : spec?.StopPropagation;
            if (priority !== undefined) buildContext.priority = priority;
            if (stopPropagation !== undefined) buildContext.stopPropagation = stopPropagation;
            const layerOptions =
              spec?.layerOptions ??
              spec?.LayerOptions ??
              feedbackOptions?.layerOptions ??
              feedbackOptions?.LayerOptions ??
              autoLayerOptions;
            buildContext.layers =
              layerOptions && typeof layerOptions === "object"
                ? layers.map((layer) => ({ layer, options: layerOptions }))
                : layers;

            for (const layer of layers) {
              LibraManager.buildBrushMoveInstrument(layer, buildContext);
            }
            if (instrumentName) {
              instrumentRegistry.set(instrumentName, {
                type: "move",
                layer: layers[0],
              });
            }
            continue;
          }
        }
      }
      // Reverse lookup for Brush Move via queue layer when targetInstrumentName is not provided
      if ((interaction === "moving" || interaction === "move") && (!targetInstrumentName || !instrumentRegistry.has(targetInstrumentName))) {
        const queueLayerName = typeof targetName === "string" ? stripInlineComment(targetName) : "";
        if (layers && layers.length > 0) {
          const activeLayer = layers[0];
          const candidates = [];
          instrumentRegistry.forEach((entry) => {
            if (entry?.type === "brush") {
              const matched =
                entry.selectionLayer === activeLayer ||
                entry.transientLayer === activeLayer ||
                (queueLayerName &&
                  typeof entry.layer?.getLayerFromQueue === "function" &&
                  entry.layer.getLayerFromQueue(queueLayerName) === activeLayer);
              if (matched) candidates.push(entry);
            }
          });
          if (candidates.length === 1) {
            const targetInstrument = candidates[0];
            const brushConfig =
              (spec?.feedbackRaw && isPlainObject(spec.feedbackRaw)
                ? spec.feedbackRaw.service || spec.feedbackRaw.brush
                : feedbackOptions?.BrushMove ?? feedbackOptions?.brushMove ?? {}) || {};
            if (brushConfig.updateBrush) {
              const buildContext = { ...brushConfig, brushEntry: targetInstrument };
              const modifierKeyRaw =
                spec?.modifierKey ??
                spec?.ModifierKey ??
                feedbackOptions?.modifierKey ??
                feedbackOptions?.ModifierKey;
              if (modifierKeyRaw !== undefined) buildContext.modifierKey = modifierKeyRaw;
              const priority =
                spec?.priority !== undefined ? spec.priority : spec?.Priority;
              const stopPropagation =
                spec?.stopPropagation !== undefined
                  ? spec.stopPropagation
                  : spec?.StopPropagation;
              if (priority !== undefined) buildContext.priority = priority;
              if (stopPropagation !== undefined) buildContext.stopPropagation = stopPropagation;
              const layerOptions =
                spec?.layerOptions ??
                spec?.LayerOptions ??
                feedbackOptions?.layerOptions ??
                feedbackOptions?.LayerOptions ??
                autoLayerOptions;
              buildContext.layers =
                layerOptions && typeof layerOptions === "object"
                  ? layers.map((layer) => ({ layer, options: layerOptions }))
                  : layers;

              for (const layer of layers) {
                LibraManager.buildBrushMoveInstrument(layer, buildContext);
              }
              if (instrumentName) {
                instrumentRegistry.set(instrumentName, {
                  type: "move",
                  layer: layers[0],
                });
              }
              continue;
            }
          }
        }
      }

      if (interaction === "zoom") {
        if (targetInstrumentName && instrumentRegistry.has(targetInstrumentName)) {
          const targetInstrument = instrumentRegistry.get(targetInstrumentName);
          if (targetInstrument?.type === "brush" && targetInstrument?.instrument) {
            const brushConfig =
              (spec?.feedbackRaw && isPlainObject(spec.feedbackRaw)
                ? spec.feedbackRaw.service || spec.feedbackRaw.brush
                : feedbackOptions?.BrushZoom ?? feedbackOptions?.brushZoom ?? {}) || {};
            if (brushConfig.updateBrush) {
              const zoomContext = { ...brushConfig, brushEntry: targetInstrument };
              const modifierKeyRaw =
                spec?.modifierKey ??
                spec?.ModifierKey ??
                feedbackOptions?.modifierKey ??
                feedbackOptions?.ModifierKey ??
                zoomContext?.modifierKey ??
                zoomContext?.ModifierKey;
              if (typeof modifierKeyRaw === "string") {
                zoomContext.modifierKey = stripInlineComment(modifierKeyRaw);
              } else if (Array.isArray(modifierKeyRaw)) {
                zoomContext.modifierKey = modifierKeyRaw
                  .map((k) => stripInlineComment(k))
                  .filter((k) => !!k);
              } else if (modifierKeyRaw === null) {
                zoomContext.modifierKey = null;
              }
              const priority =
                spec?.priority !== undefined ? spec.priority : spec?.Priority;
              const stopPropagation =
                spec?.stopPropagation !== undefined
                  ? spec.stopPropagation
                  : spec?.StopPropagation;
              if (priority !== undefined) zoomContext.priority = priority;
              if (stopPropagation !== undefined)
                zoomContext.stopPropagation = stopPropagation;
              const layerOptions =
                spec?.layerOptions ??
                spec?.LayerOptions ??
                feedbackOptions?.layerOptions ??
                feedbackOptions?.LayerOptions ??
                autoLayerOptions;
              zoomContext.layers =
                layerOptions && typeof layerOptions === "object"
                  ? layers.map((layer) => ({ layer, options: layerOptions }))
                  : layers;

              for (const layer of layers) {
                LibraManager.buildBrushZoomInstrument(layer, zoomContext);
              }
              if (instrumentName) {
                instrumentRegistry.set(instrumentName, {
                  type: "zoom",
                  layer: layers[0],
                });
              }
              continue;
            }
          }
        }
        // Reverse lookup for Brush Zoom via queue layer when targetInstrumentName is not provided
        if (!targetInstrumentName || !instrumentRegistry.has(targetInstrumentName)) {
          const queueLayerName = typeof targetName === "string" ? stripInlineComment(targetName) : "";
          if (layers && layers.length > 0) {
            const activeLayer = layers[0];
            const candidates = [];
            instrumentRegistry.forEach((entry) => {
              if (entry?.type === "brush") {
                const matched =
                  entry.selectionLayer === activeLayer ||
                  entry.transientLayer === activeLayer ||
                  (queueLayerName &&
                    typeof entry.layer?.getLayerFromQueue === "function" &&
                    entry.layer.getLayerFromQueue(queueLayerName) === activeLayer);
                if (matched) candidates.push(entry);
              }
            });
            if (candidates.length === 1) {
              const targetInstrument = candidates[0];
              const brushConfig =
                (spec?.feedbackRaw && isPlainObject(spec.feedbackRaw)
                  ? spec.feedbackRaw.service || spec.feedbackRaw.brush
                  : feedbackOptions?.BrushZoom ?? feedbackOptions?.brushZoom ?? {}) || {};
              if (brushConfig.updateBrush) {
                const zoomContext = { ...brushConfig, brushEntry: targetInstrument };
                const modifierKeyRaw =
                  spec?.modifierKey ??
                  spec?.ModifierKey ??
                  feedbackOptions?.modifierKey ??
                  feedbackOptions?.ModifierKey ??
                  zoomContext?.modifierKey ??
                  zoomContext?.ModifierKey;
                if (typeof modifierKeyRaw === "string") {
                  zoomContext.modifierKey = stripInlineComment(modifierKeyRaw);
                } else if (Array.isArray(modifierKeyRaw)) {
                  zoomContext.modifierKey = modifierKeyRaw
                    .map((k) => stripInlineComment(k))
                    .filter((k) => !!k);
                } else if (modifierKeyRaw === null) {
                  zoomContext.modifierKey = null;
                }
                const priority =
                  spec?.priority !== undefined ? spec.priority : spec?.Priority;
                const stopPropagation =
                  spec?.stopPropagation !== undefined
                    ? spec.stopPropagation
                    : spec?.StopPropagation;
                if (priority !== undefined) zoomContext.priority = priority;
                if (stopPropagation !== undefined)
                  zoomContext.stopPropagation = stopPropagation;
                const layerOptions =
                  spec?.layerOptions ??
                  spec?.LayerOptions ??
                  feedbackOptions?.layerOptions ??
                  feedbackOptions?.LayerOptions ??
                  autoLayerOptions;
                zoomContext.layers =
                  layerOptions && typeof layerOptions === "object"
                    ? layers.map((layer) => ({ layer, options: layerOptions }))
                    : layers;

                for (const layer of layers) {
                  LibraManager.buildBrushZoomInstrument(layer, zoomContext);
                }
                if (instrumentName) {
                  instrumentRegistry.set(instrumentName, {
                    type: "zoom",
                    layer: layers[0],
                  });
                }
                continue;
              }
            }
          }
        }

        const lensZoomOptionsRaw =
          (spec?.feedbackRaw && isPlainObject(spec.feedbackRaw)
            ? spec.feedbackRaw.service || spec.feedbackRaw.lens
            : null) ??
          feedbackOptions?.LensZoom ??
          feedbackOptions?.lensZoom ??
          feedbackOptions?.RadiusZoom ??
          feedbackOptions?.radiusZoom ??
          feedbackOptions;
        const lensZoomOptions =
          lensZoomOptionsRaw && typeof lensZoomOptionsRaw === "object"
            ? lensZoomOptionsRaw
            : null;

        const tryResolveLensBindingKey = () => {
          if (targetInstrumentName && instrumentRegistry.has(targetInstrumentName)) {
            const targetInstrument = instrumentRegistry.get(targetInstrumentName);
            if (targetInstrument?.type === "lens" && targetInstrument.bindingKey) {
              return targetInstrument.bindingKey;
            }
          }

          const bindingKeyRaw =
            spec?.bindingKey ??
            spec?.BindingKey ??
            lensZoomOptions?.bindingKey ??
            lensZoomOptions?.BindingKey ??
            feedbackOptions?.bindingKey ??
            feedbackOptions?.BindingKey;
          if (typeof bindingKeyRaw === "string" && stripInlineComment(bindingKeyRaw)) {
            return stripInlineComment(bindingKeyRaw);
          }

          if (layers && layers.length > 0) {
            const hostLayer = layers[0];
            const lensCandidates = [];
            instrumentRegistry.forEach((value) => {
              if (value?.type === "lens" && value.bindingKey) {
                if (value.layer === hostLayer || 
                   (typeof value.layer?.getLayerFromQueue === "function" && 
                    (value.layer.getLayerFromQueue("lensLayer") === hostLayer || 
                     value.layer.getLayerFromQueue("LensLayer") === hostLayer))) {
                  lensCandidates.push(value.bindingKey);
                }
              }
            });
            if (lensCandidates.length === 1) return lensCandidates[0];
          }

          return null;
        };

        const bindingKey = tryResolveLensBindingKey();
        if (bindingKey && lensZoomOptions && lensZoomOptions.updateLens) {
          const zoomContext = { ...lensZoomOptions.updateLens };
          zoomContext.bindingKey = bindingKey;
          const modifierKeyRaw =
            spec?.modifierKey ??
            spec?.ModifierKey ??
            feedbackOptions?.modifierKey ??
            feedbackOptions?.ModifierKey ??
            zoomContext?.modifierKey ??
            zoomContext?.ModifierKey;
          if (typeof modifierKeyRaw === "string") {
            zoomContext.modifierKey = stripInlineComment(modifierKeyRaw);
          } else if (Array.isArray(modifierKeyRaw)) {
            zoomContext.modifierKey = modifierKeyRaw
              .map((k) => stripInlineComment(k))
              .filter((k) => !!k);
          } else if (modifierKeyRaw === null) {
            zoomContext.modifierKey = null;
          }
          const priority =
            spec?.priority !== undefined ? spec.priority : spec?.Priority;
          const stopPropagation =
            spec?.stopPropagation !== undefined
              ? spec.stopPropagation
              : spec?.StopPropagation;
          if (priority !== undefined) zoomContext.priority = priority;
          if (stopPropagation !== undefined)
            zoomContext.stopPropagation = stopPropagation;

          for (const layer of layers) {
            LibraManager.buildExcentricLabelingZoomInstrument(layer, zoomContext);
          }
          if (instrumentName) {
            instrumentRegistry.set(instrumentName, {
              type: "zoom",
              layer: layers[0],
            });
          }
          continue;
        }
      }

      if (
        interaction === "axis selection" ||
        interaction === "axisselection" ||
        interaction === "axis-selection" ||
        interaction === "axisselection"
      ) {
        const buildContext = {};
        buildContext.Trigger = trigger;
        if (spec?.axisDirection !== undefined) buildContext.axisDirection = spec.axisDirection;
        if (spec?.AxisDirection !== undefined) buildContext.axisDirection = spec.AxisDirection;
        if (feedbackOptions?.axisDirection !== undefined) buildContext.axisDirection = feedbackOptions.axisDirection;
        if (feedbackOptions?.AxisDirection !== undefined) buildContext.axisDirection = feedbackOptions.AxisDirection;
        if (spec?.dimension !== undefined) buildContext.dimension = spec.dimension;
        if (spec?.Dimension !== undefined) buildContext.dimension = spec.Dimension;
        if (feedbackOptions?.dimension !== undefined) buildContext.dimension = feedbackOptions.dimension;
        if (feedbackOptions?.Dimension !== undefined) buildContext.dimension = feedbackOptions.Dimension;
        if (spec?.SelectionMode !== undefined) buildContext.SelectionMode = spec.SelectionMode;
        if (spec?.selectionMode !== undefined) buildContext.selectionMode = spec.selectionMode;
        if (feedbackOptions?.SelectionMode !== undefined) buildContext.SelectionMode = feedbackOptions.SelectionMode;
        if (feedbackOptions?.selectionMode !== undefined) buildContext.selectionMode = feedbackOptions.selectionMode;
        if (spec?.BaseOpacity !== undefined) buildContext.BaseOpacity = spec.BaseOpacity;
        if (spec?.baseOpacity !== undefined) buildContext.baseOpacity = spec.baseOpacity;
        if (feedbackOptions?.BaseOpacity !== undefined) buildContext.BaseOpacity = feedbackOptions.BaseOpacity;
        if (feedbackOptions?.baseOpacity !== undefined) buildContext.baseOpacity = feedbackOptions.baseOpacity;
        if (spec?.highlightAttrValues !== undefined) buildContext.highlightAttrValues = spec.highlightAttrValues;
        if (spec?.HighlightAttrValues !== undefined) buildContext.highlightAttrValues = spec.HighlightAttrValues;
        if (feedbackOptions?.highlightAttrValues !== undefined) buildContext.highlightAttrValues = feedbackOptions.highlightAttrValues;
        if (feedbackOptions?.HighlightAttrValues !== undefined) buildContext.highlightAttrValues = feedbackOptions.HighlightAttrValues;

        const linkLayersRaw =
          feedbackOptions?.LinkLayers ?? feedbackOptions?.linkLayers;
        let resolvedLinkLayers = linkLayersRaw;
        if (typeof linkLayersRaw === "string") {
          const key = stripInlineComment(linkLayersRaw);
          const resolved = layersByName?.[key] || Libra.Layer.findLayer(key);
          resolvedLinkLayers = resolved ? [resolved] : [];
        } else if (Array.isArray(linkLayersRaw)) {
          const acc = [];
          linkLayersRaw.forEach((entry) => {
            if (typeof entry === "string") {
              const key = stripInlineComment(entry);
              const resolved = layersByName?.[key] || Libra.Layer.findLayer(key);
              if (Array.isArray(resolved)) acc.push(...resolved);
              else if (resolved) acc.push(resolved);
            } else if (entry) {
              acc.push(entry);
            }
          });
          resolvedLinkLayers = acc;
        }

        buildContext.feedbackOptions = {
          ...feedbackOptions,
          ...(highlight !== undefined ? { Highlight: highlight } : {}),
          ...(feedbackOptions?.Scale !== undefined ? { Scale: feedbackOptions.Scale } : {}),
          ...(feedbackOptions?.scale !== undefined ? { Scale: feedbackOptions.scale } : {}),
          ...(feedbackOptions?.AttrName !== undefined ? { AttrName: feedbackOptions.AttrName } : {}),
          ...(feedbackOptions?.attrName !== undefined ? { AttrName: feedbackOptions.attrName } : {}),
          ...(resolvedLinkLayers !== undefined ? { LinkLayers: resolvedLinkLayers } : {}),
        };

        const modifierKeyRaw =
          spec?.modifierKey ??
          spec?.ModifierKey ??
          feedbackOptions?.modifierKey ??
          feedbackOptions?.ModifierKey;
        if (modifierKeyRaw !== undefined) buildContext.modifierKey = modifierKeyRaw;

        const priority =
          spec?.priority !== undefined ? spec.priority : spec?.Priority;
        const stopPropagation =
          spec?.stopPropagation !== undefined
            ? spec.stopPropagation
            : spec?.StopPropagation;
        if (priority !== undefined) buildContext.priority = priority;
        if (stopPropagation !== undefined)
          buildContext.stopPropagation = stopPropagation;

        for (const layer of layers) {
          LibraManager.buildAxisSelectionInstrument(layer, buildContext);
        }
        if (instrumentName) {
          instrumentRegistry.set(instrumentName, {
            type: "axis selection",
            layer: layers[0],
          });
        }
        continue;
      }

      const sharedVarDefaults = {};
      if (inherit === "PanInstrument" || inherit === "GeometricZoomInstrument") {
        const scaleXInSpec = feedbackOptions?.ScaleX ?? feedbackOptions?.scaleX;
        const scaleYInSpec = feedbackOptions?.ScaleY ?? feedbackOptions?.scaleY;
        const fixRangeInSpec =
          feedbackOptions?.FixRange ?? feedbackOptions?.fixRange;
        if (scaleXInSpec === undefined && scales.x)
          sharedVarDefaults.scaleX = scales.x;
        if (scaleYInSpec === undefined && scales.y)
          sharedVarDefaults.scaleY = scales.y;
        if (fixRangeInSpec === undefined) sharedVarDefaults.fixRange = true;
      }

      const sharedVar = { ...sharedVarDefaults };
      if (typeof highlight === "string") {
        sharedVar.highlightColor = highlight;
      } else if (highlight && typeof highlight === "object") {
        if (highlight.color) sharedVar.highlightColor = highlight.color;
        if (highlight.Color) sharedVar.highlightColor = highlight.Color;
        if (highlightAttrValues && typeof highlightAttrValues === "object") {
          sharedVar.highlightAttrValues = highlightAttrValues;
        }
      }
      const remnantKey = feedbackOptions?.remnantKey || feedbackOptions?.RemnantKey;
      if (remnantKey) {
        sharedVar.remnantKey = remnantKey;
      }
      const brushStyle = feedbackOptions?.BrushStyle ?? feedbackOptions?.brushStyle;
      if (brushStyle !== undefined) {
        sharedVar.brushStyle = brushStyle;
      }
      const tooltip = feedbackOptions?.Tooltip || feedbackOptions?.tooltip;
      if (tooltip && typeof tooltip === "object") {
        const fields = Array.isArray(tooltip.fields) ? tooltip.fields : undefined;
        const prefix = typeof tooltip.prefix === "string" ? tooltip.prefix : undefined;
        const position = typeof tooltip.position === "string" ? tooltip.position : undefined;
        const offset = tooltip.offset && typeof tooltip.offset === "object" ? tooltip.offset : undefined;
        sharedVar.tooltip = {};
        if (fields) sharedVar.tooltip.fields = fields;
        if (prefix) sharedVar.tooltip.prefix = prefix;
        if (position) sharedVar.tooltip.position = position;
        if (offset) sharedVar.tooltip.offset = offset;
      }

      const scaleX = feedbackOptions?.ScaleX ?? feedbackOptions?.scaleX;
      if (scaleX) {
        sharedVar.scaleX = scaleX;
      }
      const scaleY = feedbackOptions?.ScaleY ?? feedbackOptions?.scaleY;
      if (scaleY) {
        sharedVar.scaleY = scaleY;
      }
      const fixRange = feedbackOptions?.FixRange ?? feedbackOptions?.fixRange;
      if (fixRange !== undefined) {
        sharedVar.fixRange = fixRange;
      }
      const direction = feedbackOptions?.Direction ?? feedbackOptions?.direction;
      if (direction !== undefined) {
        sharedVar.direction = direction;
      }
      const attrName = feedbackOptions?.AttrName ?? feedbackOptions?.attrName;
      if (attrName) {
        sharedVar.attrName = attrName;
      }
      
      const linkLayersRaw = feedbackOptions?.LinkLayers ?? feedbackOptions?.linkLayers;
      let resolvedLinkLayers = linkLayersRaw;
      if (typeof linkLayersRaw === "string") {
        const key = stripInlineComment(linkLayersRaw);
        const resolved = layersByName?.[key] || Libra.Layer.findLayer(key);
        resolvedLinkLayers = resolved ? [resolved] : [];
      } else if (Array.isArray(linkLayersRaw)) {
        const acc = [];
        linkLayersRaw.forEach((entry) => {
          if (typeof entry === "string") {
            const key = stripInlineComment(entry);
            const resolved = layersByName?.[key] || Libra.Layer.findLayer(key);
            if (Array.isArray(resolved)) acc.push(...resolved);
            else if (resolved) acc.push(resolved);
          } else if (entry) {
            acc.push(entry);
          }
        });
        resolvedLinkLayers = acc;
      }
      
      if (resolvedLinkLayers) {
        sharedVar.linkLayers = resolvedLinkLayers;
      }
      const linkMatchMode =
        feedbackOptions?.LinkMatchMode ?? feedbackOptions?.linkMatchMode;
      if (linkMatchMode !== undefined) {
        sharedVar.linkMatchMode = linkMatchMode;
      }
      const linkFields =
        feedbackOptions?.LinkFields ??
        feedbackOptions?.linkFields ??
        feedbackOptions?.LinkField ??
        feedbackOptions?.linkField ??
        feedbackOptions?.LinkBy ??
        feedbackOptions?.linkBy;
      if (linkFields !== undefined) {
        sharedVar.linkFields = linkFields;
      }
      const linkDefaultOpacity =
        feedbackOptions?.LinkDefaultOpacity ?? feedbackOptions?.linkDefaultOpacity;
      if (linkDefaultOpacity !== undefined) {
        sharedVar.linkDefaultOpacity = linkDefaultOpacity;
      }
      const linkBaseOpacity =
        feedbackOptions?.LinkBaseOpacity ?? feedbackOptions?.linkBaseOpacity;
      if (linkBaseOpacity !== undefined) {
        sharedVar.linkBaseOpacity = linkBaseOpacity;
      }
      const linkSelectedOpacity =
        feedbackOptions?.LinkSelectedOpacity ?? feedbackOptions?.linkSelectedOpacity;
      if (linkSelectedOpacity !== undefined) {
        sharedVar.linkSelectedOpacity = linkSelectedOpacity;
      }
      const linkStrokeColor =
        feedbackOptions?.LinkStrokeColor ?? feedbackOptions?.linkStrokeColor;
      if (linkStrokeColor !== undefined) {
        sharedVar.linkStrokeColor = linkStrokeColor;
      }
      const linkStrokeWidth =
        feedbackOptions?.LinkStrokeWidth ?? feedbackOptions?.linkStrokeWidth;
      if (linkStrokeWidth !== undefined) {
        sharedVar.linkStrokeWidth = linkStrokeWidth;
      }

      const dim = feedbackOptions?.Dim ?? feedbackOptions?.dim;
      if (dim !== undefined) {
        sharedVar.dim = dim;
      }

      if (typeof modifierKeyRaw === "string") {
        sharedVar.modifierKey = stripInlineComment(modifierKeyRaw);
      } else if (Array.isArray(modifierKeyRaw)) {
        sharedVar.modifierKey = modifierKeyRaw
          .map((k) => stripInlineComment(k))
          .filter((k) => !!k);
      } else if (modifierKeyRaw === null) {
        sharedVar.modifierKey = null;
      }

      const syntheticEventRaw =
        spec?.syntheticEvent ??
        spec?.SyntheticEvent ??
        feedbackOptions?.syntheticEvent ??
        feedbackOptions?.SyntheticEvent;
      const gestureMoveDelayRaw =
        spec?.gestureMoveDelay ??
        spec?.GestureMoveDelay ??
        feedbackOptions?.gestureMoveDelay ??
        feedbackOptions?.GestureMoveDelay;
      const syntheticEvent = typeof syntheticEventRaw === "string" ? stripInlineComment(syntheticEventRaw).toLowerCase() : undefined;
      const gestureMoveDelay =
        typeof gestureMoveDelayRaw === "number" && Number.isFinite(gestureMoveDelayRaw)
          ? gestureMoveDelayRaw
          : undefined;
      if (syntheticEvent) {
        sharedVar.syntheticEvent = syntheticEvent;
      }
      if (gestureMoveDelay !== undefined) {
        sharedVar.gestureMoveDelay = gestureMoveDelay;
      }

      const onMap = spec?.on ?? spec?.On ?? feedbackOptions?.on ?? feedbackOptions?.On;

      // Handle Operator/Renderer in feedbackOptions (Top level)
      let autoInsert = [];
      if (feedbackOptions?.Operator || feedbackOptions?.Renderer) {
        const op = feedbackOptions.Operator;
        const ren = feedbackOptions.Renderer;
        const find = feedbackOptions.find || "SelectionService"; // Default to SelectionService if not specified
        
        const flow = [];
        const suffix = `_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        if (op) {
          const serviceName = `GenService${suffix}`;
          Libra.Service.register(serviceName, {
            evaluate(options) {
              const hostLayer = options?.self?._layerInstances?.[0];
              return op({ ...options, hostLayer });
            }
          });
          flow.push({ comp: serviceName });
        }

        if (ren) {
          const transformerName = `GenTransformer${suffix}`;
          Libra.GraphicalTransformer.register(transformerName, {
            redraw(options) {
              const result = options.transformer ? options.transformer.getSharedVar("result") : undefined;
              ren(result, { ...options, hostLayer: options?.layer });
            }
          });
          flow.push({ comp: transformerName });
        }

        autoInsert.push({
          find: find,
          flow: flow
        });
      }

      let remove =
        spec?.remove ?? spec?.Remove ?? feedbackOptions?.remove ?? feedbackOptions?.Remove;
      let insert =
        spec?.insert ?? spec?.Insert ?? feedbackOptions?.insert ?? feedbackOptions?.Insert;
      let override =
        spec?.override ??
        spec?.Override ??
        feedbackOptions?.override ??
        feedbackOptions?.Override;

      const customFeedbackFlowRaw =
        spec?.customFeedbackFlow ??
        spec?.CustomFeedbackFlow ??
        spec?.customfeedbackflow ??
        feedbackOptions?.customFeedbackFlow ??
        feedbackOptions?.CustomFeedbackFlow ??
        feedbackOptions?.customfeedbackflow;
      let customFeedbackFlow = customFeedbackFlowRaw;
      if (typeof customFeedbackFlowRaw === "string") {
        const key = stripInlineComment(customFeedbackFlowRaw);
        if (refs && key in refs) customFeedbackFlow = refs[key];
        else if (handlers && key in handlers) customFeedbackFlow = handlers[key];
      }
      if (typeof customFeedbackFlow === "function") {
        try {
          customFeedbackFlow = customFeedbackFlow({
            spec,
            layers,
            layer: layers[0],
            layersByName,
            scales,
            handlers,
            refs,
            ctx,
            feedbackOptions,
          });
        } catch {
          customFeedbackFlow = null;
        }
      }
      if (customFeedbackFlow && typeof customFeedbackFlow === "object") {
        const cfInsert =
          customFeedbackFlow.insert ??
          customFeedbackFlow.Insert ??
          customFeedbackFlow.flow ??
          customFeedbackFlow.Flow;
        const cfRemove =
          customFeedbackFlow.remove ??
          customFeedbackFlow.Remove;
        const cfOverride =
          customFeedbackFlow.override ??
          customFeedbackFlow.Override;

        if (Array.isArray(cfInsert) && cfInsert.length > 0) {
          insert = Array.isArray(insert) ? [...insert, ...cfInsert] : cfInsert;
        }
        if (Array.isArray(cfRemove) && cfRemove.length > 0) {
          remove = Array.isArray(remove) ? [...remove, ...cfRemove] : cfRemove;
        }
        if (Array.isArray(cfOverride) && cfOverride.length > 0) {
          override = Array.isArray(override)
            ? [...override, ...cfOverride]
            : cfOverride;
        }
      }
      
      // Process Operator/Renderer inside Insert array
      if (Array.isArray(insert)) {
        insert = insert.map(item => {
           if (item.Operator || item.Renderer) {
              const op = item.Operator;
              const ren = item.Renderer;
              const find = item.find || "SelectionService";
              
              const flow = [];
              const suffix = `_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

              if (op) {
                const serviceName = `GenService${suffix}`;
                Libra.Service.register(serviceName, {
                  evaluate(options) {
                    const hostLayer = options?.self?._layerInstances?.[0];
                    return op({ ...options, hostLayer });
                  }
                });
                flow.push({ comp: serviceName });
              }

              if (ren) {
                const transformerName = `GenTransformer${suffix}`;
                Libra.GraphicalTransformer.register(transformerName, {
                  redraw(options) {
                    const result = options.transformer ? options.transformer.getSharedVar("result") : undefined;
                    ren(result, { ...options, hostLayer: options?.layer });
                  }
                });
                flow.push({ comp: transformerName });
              }

              return {
                find: find,
                flow: flow
              };
           }
           return item;
        });
      }

      if (autoInsert.length > 0) {
        insert = insert ? [...insert, ...autoInsert] : autoInsert;
      }

      const layerOptions =
        spec?.layerOptions ??
        spec?.LayerOptions ??
        feedbackOptions?.layerOptions ??
        feedbackOptions?.LayerOptions;
      const finalLayerOptions = layerOptions || autoLayerOptions;
      const buildLayers =
        finalLayerOptions && typeof finalLayerOptions === "object"
          ? layers.map((layer) => ({ layer, options: finalLayerOptions }))
          : layers;

      const buildOptions = { inherit, layers: buildLayers, sharedVar };
      if (priority !== undefined) buildOptions.priority = priority;
      if (stopPropagation !== undefined)
        buildOptions.stopPropagation = stopPropagation;
      if (Array.isArray(remove)) buildOptions.remove = remove;
      if (Array.isArray(insert)) buildOptions.insert = insert;
      if (Array.isArray(override)) buildOptions.override = override;

      const interactionInstance = Libra.Interaction.build(buildOptions);
      if (
        onMap &&
        typeof onMap === "object" &&
        interactionInstance &&
        typeof interactionInstance.on === "function"
      ) {
        Object.entries(onMap).forEach(([actionName, handlerValue]) => {
          const rawHandlers = Array.isArray(handlerValue)
            ? handlerValue
            : [handlerValue];
          rawHandlers.forEach((rawHandler) => {
            let handler = rawHandler;
            if (typeof rawHandler === "string" && handlers) {
              handler = handlers[rawHandler];
            }
            if (typeof handler === "function") {
              interactionInstance.on(actionName, handler);
            } else if (handler && typeof handler.execute === "function") {
              interactionInstance.on(actionName, handler);
            }
          });
        });
      }
      if (instrumentName) {
        let registryType = interaction || inherit;
        if (
          interaction === "group selection" ||
          interaction === "groupselection" ||
          inherit === "BrushInstrument"
        ) {
          registryType = "brush";
        }
        instrumentRegistry.set(instrumentName, {
          type: registryType,
          layer: layers[0],
          hostLayer:
            registryType === "brush" && targetInstrumentName && instrumentRegistry.has(targetInstrumentName)
              ? instrumentRegistry.get(targetInstrumentName)?.layer
              : layers[0],
          selectionLayer:
            typeof layers[0]?.getLayerFromQueue === "function"
              ? layers[0].getLayerFromQueue("selectionLayer")
              : null,
          transientLayer:
            typeof layers[0]?.getLayerFromQueue === "function"
              ? layers[0].getLayerFromQueue("transientLayer")
              : null,
          instrument: interactionInstance,
        });
      }
    }
      resolve({ instrumentRegistry });
    });
  });
}
