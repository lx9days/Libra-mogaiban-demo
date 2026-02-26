// A lightweight compiler that converts interaction JSON spec into Libra.Interaction.build calls
import Libra from "libra-vis";
import * as d3 from "d3";
import LibraManager from "../../core/LibraManager";

// Map JSON trigger to Libra instrument inherit names
const triggerToInstrument = {
  hover: "HoverInstrument",
  click: "ClickInstrument",
  brush: "BrushInstrument",
  drag: "DragInstrument",
  pan: "PanInstrument",
  zoom: "GeometricZoomInstrument",
  // You can extend this map: click -> ClickInstrument, brush -> BrushInstrument, etc.
};

const interactionAlias = {
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
    .csv("/public/atomic.csv")
    .then((rows) => {
      rows.forEach((r) => {
        const name = String(r["Instruments"] || "").trim().toLowerCase();
        if (!name) return;
        atomic.instruments.add(name);
        const triggers = String(r["Available Triggers"] || "")
          .toLowerCase()
          .split(/[/\s]+/)
          .filter((t) => !!t);
        atomic.triggers.set(name, new Set(triggers));
      });
    })
    .catch(() => {});
  const ensureLoaded = (fn) => {
    if (atomic.instruments.size > 0) fn();
    else load.finally(fn);
  };
  ensureLoaded(() => {
    const instrumentRegistry = new Map();
    let autoLensBindingIndex = 0;
    for (const spec of list) {
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
        typeof instrumentNameRaw === "string"
          ? stripInlineComment(instrumentNameRaw)
          : "";
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
        spec?.["Target layer"] ||
        spec?.Target ||
        spec?.layer ||
        spec?.targetLayer;
      let layers = [];
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
        } else {
          let resolved =
            (typeof targetName === "string" && layersByName[targetName]) ||
            layersByName.mainLayer ||
            layersByName.layer ||
            null;
          if (resolved) {
            layers = Array.isArray(resolved) ? resolved : [resolved];
          } else if (typeof targetName === "string") {
            const found = Libra.Layer.findLayer(targetName);
            if (Array.isArray(found)) layers = found;
            else if (found) layers = [found];
          }
        }
      }
      if (!layers || layers.length === 0) continue;

      const feedbackOptions = spec?.["Feedback options"] || spec?.Feedback || {};
      const highlight = feedbackOptions?.Highlight || feedbackOptions?.highlight;

      if (interaction === "reordering" || interaction === "reorderinstrument" || interaction === "reorder") {
        const directionRaw = spec?.Direction || spec?.direction || feedbackOptions?.Direction || feedbackOptions?.direction;
        const direction = typeof directionRaw === "string" ? stripInlineComment(directionRaw).toLowerCase() : "x";
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
            offset
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

          const buildContext = { ...options };
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
          const persistOnClick =
            buildContext.persistOnClick ??
            buildContext.PersistOnClick ??
            buildContext.pinOnClick ??
            buildContext.PinOnClick ??
            buildContext.persistByClick ??
            buildContext.PersistByClick ??
            false;
          const clickPriorityRaw =
            buildContext.clickPriority ??
            buildContext.ClickPriority;
          let clickPriority = clickPriorityRaw;
          if (clickPriority === undefined && stopPropagation === true) {
            const basePriority =
              typeof priority === "number" ? priority : 0;
            clickPriority = basePriority + 1;
          }
          if (priority !== undefined) buildContext.priority = priority;
          if (stopPropagation !== undefined)
            buildContext.stopPropagation = stopPropagation;

          for (const layer of layers) {
            const stateKey = LibraManager.buildExcentricLabelingInstrument(layer, buildContext);
            if (persistOnClick) {
              LibraManager.buildExcentricLabelingClickInstrument(layer, {
                bindingKey: buildContext.bindingKey,
                modifierKey:
                  buildContext.clickModifierKey ??
                  buildContext.ClickModifierKey ??
                  buildContext.modifierKey,
                pinThreshold:
                  buildContext.pinThreshold ??
                  buildContext.PinThreshold,
                togglePin:
                  buildContext.togglePin ??
                  buildContext.TogglePin,
                priority: clickPriority,
                stopPropagation,
              });
            }
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
        interaction === "zoom" &&
        targetInstrumentName &&
        instrumentRegistry.has(targetInstrumentName)
      ) {
        const targetInstrument = instrumentRegistry.get(targetInstrumentName);
        if (targetInstrument?.type === "lens") {
          const lensZoomOptionsRaw =
            feedbackOptions?.LensZoom ??
            feedbackOptions?.lensZoom ??
            feedbackOptions?.RadiusZoom ??
            feedbackOptions?.radiusZoom ??
            feedbackOptions;
          const lensZoomOptions =
            lensZoomOptionsRaw && typeof lensZoomOptionsRaw === "object"
              ? lensZoomOptionsRaw
              : {};
          const zoomContext = { ...lensZoomOptions };
          if (targetInstrument.bindingKey) {
            zoomContext.bindingKey = targetInstrument.bindingKey;
          }
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

      const sharedVarDefaults = {};
      if (inherit === "PanInstrument" || inherit === "GeometricZoomInstrument") {
        if (scales.x) sharedVarDefaults.scaleX = scales.x;
        if (scales.y) sharedVarDefaults.scaleY = scales.y;
        sharedVarDefaults.fixRange = true;
      }

      const sharedVar = { ...sharedVarDefaults };
      if (typeof highlight === "string") {
        sharedVar.highlightColor = highlight;
      } else if (highlight && typeof highlight === "object" && highlight.color) {
        sharedVar.highlightColor = highlight.color;
      }
      const remnantKey = feedbackOptions?.remnantKey || feedbackOptions?.RemnantKey;
      if (remnantKey) {
        sharedVar.remnantKey = remnantKey;
      }
      const tooltip = feedbackOptions?.Tooltip || feedbackOptions?.tooltip;
      if (tooltip && typeof tooltip === "object") {
        const fields = Array.isArray(tooltip.fields) ? tooltip.fields : undefined;
        const prefix = typeof tooltip.prefix === "string" ? tooltip.prefix : undefined;
        const offset = tooltip.offset && typeof tooltip.offset === "object" ? tooltip.offset : undefined;
        sharedVar.tooltip = {};
        if (fields) sharedVar.tooltip.fields = fields;
        if (prefix) sharedVar.tooltip.prefix = prefix;
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
      const attrName = feedbackOptions?.AttrName ?? feedbackOptions?.attrName;
      if (attrName) {
        sharedVar.attrName = attrName;
      }
      const linkLayers = feedbackOptions?.LinkLayers ?? feedbackOptions?.linkLayers;
      if (linkLayers) {
        sharedVar.linkLayers = linkLayers;
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

      const modifierKeyRaw =
        spec?.modifierKey ??
        spec?.ModifierKey ??
        feedbackOptions?.modifierKey ??
        feedbackOptions?.ModifierKey;
      if (typeof modifierKeyRaw === "string") {
        sharedVar.modifierKey = stripInlineComment(modifierKeyRaw);
      } else if (Array.isArray(modifierKeyRaw)) {
        sharedVar.modifierKey = modifierKeyRaw
          .map((k) => stripInlineComment(k))
          .filter((k) => !!k);
      } else if (modifierKeyRaw === null) {
        sharedVar.modifierKey = null;
      }

      const priority =
        spec?.priority !== undefined ? spec.priority : spec?.Priority;
      const stopPropagation =
        spec?.stopPropagation !== undefined
          ? spec.stopPropagation
          : spec?.StopPropagation;
      const remove = spec?.remove ?? spec?.Remove;
      const insert = spec?.insert ?? spec?.Insert;
      const override = spec?.override ?? spec?.Override;
      const onMap = spec?.on ?? spec?.On;

      const buildOptions = { inherit, layers, sharedVar };
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
        instrumentRegistry.set(instrumentName, {
          type: interaction || inherit,
          layer: layers[0],
          instrument: interactionInstance,
        });
      }
    }
  });
}
