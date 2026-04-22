import Libra from "libra-vis";
import { addDiagnostic } from "../context";
import LibraManager from "../../../core/LibraManager";

function forEachLayer(plan, callback) {
  const layers = Array.isArray(plan.layers) ? plan.layers : [];
  return layers.map((layer) => callback(layer)).filter((value) => value !== undefined);
}

function createLayerBuilder(executor) {
  return (plan, runtimeContext) =>
    forEachLayer(plan, (layer) => executor(layer, plan.buildContext || {}, plan, runtimeContext));
}

function getLensInstrumentName(buildContext = {}, plan = {}) {
  const rawName = buildContext.instrumentName ?? buildContext.name ?? plan.name;
  return typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;
}

function getLensStateToken(stateKey) {
  if (typeof stateKey !== "string" || !stateKey.includes("::")) return null;
  const token = stateKey.split("::").slice(1).join("::").trim();
  return token || null;
}

function upsertRuntimeRegistryEntry(runtimeContext = {}, key, entry = {}) {
  if (!runtimeContext?.registry || !key) return;

  const previous = runtimeContext.registry.get(key) || {};
  runtimeContext.registry.set(key, {
    ...previous,
    ...entry,
  });
}

function registerLensRuntimeEntry(runtimeContext = {}, plan, layer, buildContext, stateKey) {
  const name = getLensInstrumentName(buildContext, plan);
  const stateToken = name || getLensStateToken(stateKey);
  const registryKey = plan.name || name || stateKey;
  if (!registryKey) return;

  upsertRuntimeRegistryEntry(runtimeContext, registryKey, {
    type: "lens",
    instrument: plan.instrument,
    family: plan.family,
    layer,
    layers: [layer],
    name,
    stateToken,
    stateKey,
    planId: plan.planId,
  });
}

function registerSelectionRuntimeEntry(runtimeContext = {}, plan, layer, instance) {
  const name = plan.name;
  const registryKey = name || plan.instrument;
  if (!registryKey) return;

  upsertRuntimeRegistryEntry(runtimeContext, registryKey, {
    type: "selection",
    instrument: plan.instrument,
    family: plan.family || "selection",
    layer,
    layers: [layer],
    name,
    instance,
    planId: plan.planId,
  });
}

function isLensCandidateForLayer(entry, layer) {
  const lensLayers = Array.isArray(entry?.layers) ? entry.layers : (entry?.layer ? [entry.layer] : []);
  if (!layer || lensLayers.length === 0) return false;

  return lensLayers.some(lensLayer => 
    lensLayer === layer ||
    (typeof lensLayer.getLayerFromQueue === "function" &&
      (lensLayer.getLayerFromQueue("lensLayer") === layer ||
        lensLayer.getLayerFromQueue("LensLayer") === layer))
  );
}

function addLensZoomDiagnostic(runtimeContext, plan, message, code = "runtime/lens-zoom-target") {
  addDiagnostic(runtimeContext, {
    level: "error",
    code,
    message,
    specIndex: plan?.specIndex,
    instrument: plan?.instrument || "zoom",
    compiler: plan?.compilerId || "navigation",
  });
}

function resolveTargetLens(plan, layer, runtimeContext = {}) {
  const buildContext = plan.buildContext || {};
  const targetLensName =
    typeof buildContext.targetLensName === "string" && buildContext.targetLensName.trim()
      ? buildContext.targetLensName.trim()
      : typeof buildContext.TargetLensName === "string" && buildContext.TargetLensName.trim()
        ? buildContext.TargetLensName.trim()
        : null;

  if (!layer || !runtimeContext?.registry) {
    addLensZoomDiagnostic(runtimeContext, plan, "lens-zoom 缺少可用于反查目标 lens 的 layer 上下文");
    return null;
  }

  const lensCandidates = [];
  runtimeContext.registry.forEach((entry) => {
    if (entry?.type !== "lens") return;
    if (isLensCandidateForLayer(entry, layer)) lensCandidates.push(entry);
  });

  if (lensCandidates.length === 0) {
    addLensZoomDiagnostic(runtimeContext, plan, "lens-zoom 未在 target.layer 上找到任何 lensInstrument");
    return null;
  }

  if (lensCandidates.length === 1) {
    return lensCandidates[0];
  }

  if (!targetLensName) {
    addLensZoomDiagnostic(
      runtimeContext,
      plan,
      "lens-zoom 在 target.layer 上找到多个 lensInstrument，请通过 feedback.lens.targetLensName 指定目标",
      "runtime/lens-zoom-ambiguous-target"
    );
    return null;
  }

  const matchedLenses = lensCandidates.filter((entry) => entry.name === targetLensName);
  if (matchedLenses.length === 1) {
    return matchedLenses[0];
  }

  if (matchedLenses.length === 0) {
    addLensZoomDiagnostic(
      runtimeContext,
      plan,
      `lens-zoom 未在 target.layer 上找到名为 ${targetLensName} 的 lensInstrument`,
      "runtime/lens-zoom-target-not-found"
    );
    return null;
  }

  addLensZoomDiagnostic(
    runtimeContext,
    plan,
    `lens-zoom 在 target.layer 上找到多个同名 lensInstrument: ${targetLensName}`,
    "runtime/lens-zoom-duplicate-target"
  );
  return null;
}

function isBrushCandidateForLayer(entry, layer) {
  const brushLayers = Array.isArray(entry?.layers) ? entry.layers : (entry?.layer ? [entry.layer] : []);
  if (!layer || brushLayers.length === 0) return false;

  return brushLayers.some(brushLayer => 
    brushLayer === layer ||
    (typeof brushLayer.getLayerFromQueue === "function" &&
      (brushLayer.getLayerFromQueue("transientLayer") === layer ||
        brushLayer.getLayerFromQueue("selectionLayer") === layer))
  );
}

function addBrushZoomDiagnostic(runtimeContext, plan, message, code = "runtime/brush-zoom-target") {
  addDiagnostic(runtimeContext, {
    level: "error",
    code,
    message,
    specIndex: plan?.specIndex,
    instrument: plan?.instrument || "zoom",
    compiler: plan?.compilerId || "navigation",
  });
}

function resolveTargetBrush(plan, layer, runtimeContext = {}) {
  const buildContext = plan.buildContext || {};
  const targetBrushName =
    typeof buildContext.targetBrushName === "string" && buildContext.targetBrushName.trim()
      ? buildContext.targetBrushName.trim()
      : typeof buildContext.TargetBrushName === "string" && buildContext.TargetBrushName.trim()
        ? buildContext.TargetBrushName.trim()
        : null;

  if (!layer || !runtimeContext?.registry) {
    addBrushZoomDiagnostic(runtimeContext, plan, "brush-zoom 缺少可用于反查目标 brush 的 layer 上下文");
    return null;
  }

  const brushCandidates = [];
  runtimeContext.registry.forEach((entry) => {
    if (entry?.family !== "selection") return;
    if (isBrushCandidateForLayer(entry, layer)) brushCandidates.push(entry);
  });

  if (brushCandidates.length === 0) {
    addBrushZoomDiagnostic(runtimeContext, plan, "brush-zoom 未在 target.layer 上找到任何 brushInstrument");
    return null;
  }

  if (brushCandidates.length === 1) {
    return brushCandidates[0];
  }

  if (!targetBrushName) {
    addBrushZoomDiagnostic(
      runtimeContext,
      plan,
      "brush-zoom 在 target.layer 上找到多个 brushInstrument，请通过 targetBrushName 指定目标",
      "runtime/brush-zoom-ambiguous-target"
    );
    return null;
  }

  const matchedBrushes = brushCandidates.filter((entry) => entry.name === targetBrushName);
  if (matchedBrushes.length === 1) {
    return matchedBrushes[0];
  }

  if (matchedBrushes.length === 0) {
    addBrushZoomDiagnostic(
      runtimeContext,
      plan,
      `brush-zoom 未在 target.layer 上找到名为 ${targetBrushName} 的 brushInstrument`,
      "runtime/brush-zoom-target-not-found"
    );
    return null;
  }

  addBrushZoomDiagnostic(
    runtimeContext,
    plan,
    `brush-zoom 在 target.layer 上找到多个同名 brushInstrument: ${targetBrushName}`,
    "runtime/brush-zoom-duplicate-target"
  );
  return null;
}

function runGenericInteraction(plan) {
  const layers = Array.isArray(plan.layers) ? plan.layers : [];
  if (layers.length === 0) return null;

  // Derive inherit exclusively from trigger type
  let inherit = plan.instrument; // Fallback to instrument name if no trigger
  
  if (plan.trigger) {
    let triggerType = null;
    // Support both string shorthand (trigger: "drag") and object (trigger: { type: "drag" })
    if (typeof plan.trigger === "string") {
      triggerType = plan.trigger;
    } else if (typeof plan.trigger === "object" && plan.trigger.type) {
      triggerType = plan.trigger.type;
    }
    
    if (triggerType) {
      const triggerPascal = triggerType.charAt(0).toUpperCase() + triggerType.slice(1);
      inherit = `${triggerPascal}Instrument`;
    }
  }

  const buildOptions = {
    inherit,
    layers,
    sharedVar: plan.sharedVar || {},
  };

  if (plan.trigger) buildOptions.trigger = plan.trigger;

  if (plan.buildContext?.priority !== undefined) buildOptions.priority = plan.buildContext.priority;
  if (plan.buildContext?.stopPropagation !== undefined) {
    buildOptions.stopPropagation = plan.buildContext.stopPropagation;
  }

  if (plan.customFeedbackFlow) {
    if (plan.customFeedbackFlow.insert) buildOptions.insert = plan.customFeedbackFlow.insert;
    if (plan.customFeedbackFlow.remove) buildOptions.remove = plan.customFeedbackFlow.remove;
    if (plan.customFeedbackFlow.override) buildOptions.override = plan.customFeedbackFlow.override;
  }

  return Libra.Interaction.build(buildOptions);
}

export function createRuntimeBuilderRegistry(extraBuilders = {}) {
  return {
    "generic-interaction": runGenericInteraction,
    "point-selection": createLayerBuilder((layer, buildContext, plan, runtimeContext) => {
      const instance = LibraManager.buildPointSelectionInstrument(layer, buildContext);
      registerSelectionRuntimeEntry(runtimeContext, plan, layer, instance);
      return instance;
    }),
    "group-selection": createLayerBuilder((layer, buildContext, plan, runtimeContext) => {
      const instance = LibraManager.buildGroupSelectionInstrument(layer, buildContext);
      registerSelectionRuntimeEntry(runtimeContext, plan, layer, instance);
      return instance;
    }),
    lasso: createLayerBuilder((layer, buildContext, plan, runtimeContext) => {
      const instance = LibraManager.buildLassoSelectionInstrument(layer, buildContext);
      registerSelectionRuntimeEntry(runtimeContext, plan, layer, instance);
      return instance;
    }),
    "axis-selection": createLayerBuilder((layer, buildContext, plan, runtimeContext) => {
      const instance = LibraManager.buildAxisSelectionInstrument(layer, buildContext);
      registerSelectionRuntimeEntry(runtimeContext, plan, layer, instance);
      return instance;
    }),
    "pan": createLayerBuilder((layer, buildContext) =>
      LibraManager.buildPanInstrument(layer, buildContext)
    ),
    "zoom": createLayerBuilder((layer, buildContext) =>
      LibraManager.buildGeometricZoomInstrument(layer, buildContext)
    ),
    "view-pan": createLayerBuilder((layer, buildContext) =>
      LibraManager.buildViewTransformPanInstrument(layer, buildContext)
    ),
    "view-zoom": createLayerBuilder((layer, buildContext) =>
      LibraManager.buildViewTransformZoomInstrument(layer, buildContext)
    ),
    lens: createLayerBuilder((layer, buildContext, plan, runtimeContext) => {
      const nextBuildContext = {
        ...buildContext,
        __lensCompareSource: "new-dsl",
      };
      const stateKey = LibraManager.buildExcentricLabelingInstrument(layer, nextBuildContext);
      registerLensRuntimeEntry(runtimeContext, plan, layer, nextBuildContext, stateKey);
      return stateKey;
    }),
    "lens-zoom": createLayerBuilder((layer, buildContext, plan, runtimeContext) => {
      const targetLens = resolveTargetLens(plan, layer, runtimeContext);
      if (!targetLens) return null;

      const nextBuildContext = {
        ...buildContext,
        instrumentName: targetLens.name || targetLens.stateToken,
      };
      return LibraManager.buildExcentricLabelingZoomInstrument(layer, nextBuildContext);
    }),
    reorder: createLayerBuilder((layer, buildContext) => LibraManager.buildReorderInstrument(layer, buildContext)),
    "brush-move": createLayerBuilder((layer, buildContext) =>
      LibraManager.buildBrushMoveInstrument(layer, buildContext)
    ),
    "brush-zoom": createLayerBuilder((layer, buildContext, plan, runtimeContext) => {
      const targetBrush = resolveTargetBrush(plan, layer, runtimeContext);
      if (!targetBrush) return null;

      const nextBuildContext = {
        ...buildContext,
        brushEntry: targetBrush,
      };
      return LibraManager.buildBrushZoomInstrument(layer, nextBuildContext);
    }),
    ...extraBuilders,
  };
}

export function runBuildPlan(plan, context = {}) {
  const runtimeBuilder = context.runtimeBuilders?.[plan.runtimeBuilderId];
  if (typeof runtimeBuilder !== "function") return null;
  return runtimeBuilder(plan, context);
}

export function runBuildPlans(plans = [], context = {}) {
  return plans.map((plan) => runBuildPlan(plan, context));
}
