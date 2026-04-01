import Libra from "libra-vis";
import LibraManager from "../../../core/LibraManager";

function forEachLayer(plan, callback) {
  const layers = Array.isArray(plan.layers) ? plan.layers : [];
  return layers.map((layer) => callback(layer)).filter((value) => value !== undefined);
}

function createLayerBuilder(executor) {
  return (plan) => forEachLayer(plan, (layer) => executor(layer, plan.buildContext || {}));
}

function runGenericInteraction(plan) {
  const layers = Array.isArray(plan.layers) ? plan.layers : [];
  if (layers.length === 0) return null;

  const buildOptions = {
    inherit: plan.inherit || plan.instrument,
    layers,
    sharedVar: plan.sharedVar || {},
  };

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
    "point-selection": createLayerBuilder((layer, buildContext) =>
      LibraManager.buildPointSelectionInstrument(layer, buildContext)
    ),
    "group-selection": createLayerBuilder((layer, buildContext) =>
      LibraManager.buildGroupSelectionInstrument(layer, buildContext)
    ),
    lasso: createLayerBuilder((layer, buildContext) => LibraManager.buildLassoSelectionInstrument(layer, buildContext)),
    "axis-selection": createLayerBuilder((layer, buildContext) =>
      LibraManager.buildAxisSelectionInstrument(layer, buildContext)
    ),
    "view-pan": createLayerBuilder((layer, buildContext) =>
      LibraManager.buildViewTransformPanInstrument(layer, buildContext)
    ),
    "view-zoom": createLayerBuilder((layer, buildContext) =>
      LibraManager.buildViewTransformZoomInstrument(layer, buildContext)
    ),
    lens: createLayerBuilder((layer, buildContext) => LibraManager.buildExcentricLabelingInstrument(layer, buildContext)),
    "lens-zoom": createLayerBuilder((layer, buildContext) =>
      LibraManager.buildExcentricLabelingZoomInstrument(layer, buildContext)
    ),
    reorder: createLayerBuilder((layer, buildContext) => LibraManager.buildReorderInstrument(layer, buildContext)),
    "brush-move": createLayerBuilder((layer, buildContext) =>
      LibraManager.buildBrushMoveInstrument(layer, buildContext)
    ),
    "brush-zoom": createLayerBuilder((layer, buildContext) =>
      LibraManager.buildBrushZoomInstrument(layer, buildContext)
    ),
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
