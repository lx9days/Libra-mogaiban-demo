import { addDiagnostic, registerInstrument } from "../context";

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function resolveNamedLayer(layersByName = {}, layerName, sourceLayerName = null) {
  if (!layerName || typeof layerName !== "string") return null;
  const direct = layersByName[layerName];
  if (direct) return direct;

  // If a sourceLayer is explicitly provided, we ONLY search its children
  if (sourceLayerName && typeof sourceLayerName === "string") {
    const specificParent = layersByName[sourceLayerName];
    if (specificParent && typeof specificParent.getLayerFromQueue === "function") {
      const isKnownQueueLayer = ["transientLayer", "selectionLayer", "lensLayer", "LensLayer"].includes(layerName);
      if (isKnownQueueLayer) {
        const childLayer = specificParent.getLayerFromQueue(layerName);
        if (childLayer) return childLayer;
      } else {
        const existingChild = specificParent._children?.find?.(child => child._name === layerName);
        if (existingChild) return existingChild;
      }
    }
    // If a specific source layer was asked for but we couldn't resolve the child from it, fail fast
    return null;
  }

  // Try to find the layer as a child queue layer of any registered main layer
  for (const parentLayer of Object.values(layersByName)) {
    if (typeof parentLayer?.getLayerFromQueue === "function") {
      // transientLayer, selectionLayer, lensLayer 等是特殊的队列图层，应该被允许动态创建
      const isKnownQueueLayer = ["transientLayer", "selectionLayer", "lensLayer", "LensLayer"].includes(layerName);
      
      // 出于性能考虑，我们不希望用户瞎写一个 layerName 就触发底层所有图层的 getLayerFromQueue
      // 但对于已知名字的队列图层，我们通过 getLayerFromQueue 去获取（如果不存在，底层会自动创建）
      if (isKnownQueueLayer) {
         const childLayer = parentLayer.getLayerFromQueue(layerName);
         if (childLayer) return childLayer;
      } else {
         // 对于未知的名字，我们只检查它是否已经被挂载过，避免错误地意外生成新图层
         const existingChild = parentLayer._children?.find?.(child => child._name === layerName);
         if (existingChild) return existingChild;
      }
    }
  }

  return null;
}

function resolveLayerReference(value, context = {}) {
  if (typeof value !== "string") return value;
  return resolveNamedLayer(context.layersByName, value) || value;
}

function resolveLayerReferenceList(value, context = {}) {
  return ensureArray(value).flatMap((entry) => {
    const resolved = resolveLayerReference(entry, context);
    if (Array.isArray(resolved)) return resolved;
    return resolved !== undefined && resolved !== null && resolved !== "" ? [resolved] : [];
  });
}

function resolveFeedbackOptions(feedbackOptions = {}, context = {}) {
  const resolved = {
    ...feedbackOptions,
  };

  if (resolved.LinkLayers !== undefined) {
    resolved.LinkLayers = resolveLayerReferenceList(resolved.LinkLayers, context);
  }
  if (resolved.linkLayers !== undefined) {
    resolved.linkLayers = resolveLayerReferenceList(resolved.linkLayers, context);
  }
  if (resolved.LinkTo !== undefined) {
    resolved.LinkTo = resolveLayerReference(resolved.LinkTo, context);
  }
  if (resolved.linkTo !== undefined) {
    resolved.linkTo = resolveLayerReference(resolved.linkTo, context);
  }
  if (resolved.link && typeof resolved.link === "object" && !Array.isArray(resolved.link)) {
    resolved.link = {
      ...resolved.link,
    };
    if (resolved.link.layers !== undefined) {
      resolved.link.layers = resolveLayerReferenceList(resolved.link.layers, context);
    }
    if (resolved.link.layer !== undefined) {
      resolved.link.layer = resolveLayerReference(resolved.link.layer, context);
    }
    if (resolved.link.linkTo !== undefined) {
      resolved.link.linkTo = resolveLayerReference(resolved.link.linkTo, context);
    }
  }

  return resolved;
}

export function resolveTargetLayers(spec, context = {}) {
  const layers = [];
  const targetDescriptor =
    spec.target && typeof spec.target === "object" && !Array.isArray(spec.target)
      ? spec.target
      : {};
  const targetLayers = ensureArray(targetDescriptor.layer ?? targetDescriptor.layers ?? spec.targetLayer);
  const fallbackLayer = context.layersByName.mainLayer || context.layersByName.layer || null;

  const pushLayer = (layer) => {
    if (!layer) return;
    if (targetDescriptor.pointerEvents) {
      if (typeof layer.getGraphic === "function") {
        const graphic = layer.getGraphic();
        if (graphic && typeof graphic.style === "object") {
          graphic.style.pointerEvents = targetDescriptor.pointerEvents;
        }
      }
    }
    layers.push(layer);
  };

  targetLayers.forEach((targetLayer) => {
    if (typeof targetLayer === "string") {
      const resolved = resolveNamedLayer(context.layersByName, targetLayer, targetDescriptor.sourceLayer);
      if (Array.isArray(resolved)) resolved.forEach(pushLayer);
      else if (resolved) pushLayer(resolved);
      else {
        addDiagnostic(context, {
          level: "warning",
          code: "compiler/unresolved-layer",
          message: `未解析到目标图层 ${targetLayer}`,
          specIndex: spec.specIndex,
          instrument: spec.instrument,
        });
      }
      return;
    }

    if (targetLayer) pushLayer(targetLayer);
  });

  if (layers.length === 0 && fallbackLayer) {
    if (Array.isArray(fallbackLayer)) fallbackLayer.forEach(pushLayer);
    else pushLayer(fallbackLayer);
  }

  return layers;
}

export function createBaseBuildContext(spec, context = {}) {
  const feedbackOptions = resolveFeedbackOptions(spec.feedbackOptions, context);
  const buildContext = {
    Trigger: spec.trigger,
    ...feedbackOptions,
  };

  if (spec.name) {
    buildContext.name = spec.name;
    buildContext.instrumentName = spec.name;
  }
  if (spec.modifierKey !== undefined) buildContext.modifierKey = spec.modifierKey;
  if (spec.remnantKey !== undefined) buildContext.remnantKey = spec.remnantKey;
  if (spec.syntheticEvent !== undefined) buildContext.syntheticEvent = spec.syntheticEvent;
  if (spec.priority !== undefined) buildContext.priority = spec.priority;
  if (spec.stopPropagation !== undefined) buildContext.stopPropagation = spec.stopPropagation;

  return buildContext;
}

export function resolveCustomFeedbackFlow(customFeedbackFlow = {}, context = {}) {
  const resolved = { ...customFeedbackFlow };
  // If it's an array, assume it's the old 'flow' array format
  if (Array.isArray(customFeedbackFlow)) {
    return { insert: [{ flow: customFeedbackFlow }] };
  }
  // Otherwise it's an object with insert, remove, override
  // Note: we can further resolve layers in insert/remove/override if needed
  if (resolved.flow && !resolved.insert) {
    resolved.insert = [{ flow: resolved.flow }];
    delete resolved.flow;
  }
  return resolved;
}

export function createPlan(spec, context, runtimeBuilderId, extra = {}) {
  const layers = resolveTargetLayers(spec, context);
  const buildContext = {
    ...createBaseBuildContext(spec, context),
    ...(extra.buildContext || {}),
  };
  const sharedVar = {
    ...spec.feedbackOptions,
    ...(extra.sharedVar || {}),
  };

  const customFeedbackFlow = spec.customFeedbackFlow 
    ? resolveCustomFeedbackFlow(spec.customFeedbackFlow, context)
    : undefined;

  if (customFeedbackFlow) {
    buildContext.customFeedbackFlow = customFeedbackFlow;
  }

  const plan = {
    planId: `${runtimeBuilderId}:${spec.name || spec.instrument || spec.specIndex}`,
    specIndex: spec.specIndex,
    compilerId: extra.compilerId || spec.compiler || null,
    runtimeBuilderId,
    instrument: spec.instrument,
    family: spec.family,
    trigger: spec.trigger,
    inherit: extra.inherit !== undefined ? extra.inherit : spec.inherit,
    layers,
    buildContext,
    sharedVar,
    name: spec.name,
    targetInstrument: spec.targetInstrument,
    rawSpec: spec.rawSpec,
    customFeedbackFlow,
    metadata: extra.metadata || {},
  };

  const registryKey = spec.name || `__anonymous_instrument_${spec.specIndex}`;
  registerInstrument(context, registryKey, {
    instrument: spec.instrument,
    family: spec.family,
    targetInstrument: spec.targetInstrument || null,
    layers,
    planId: plan.planId,
  });

  return plan;
}
