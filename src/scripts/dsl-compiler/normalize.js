import { findInstrumentRule, normalizeRuleToken } from "./rules/instrumentRules";

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function normalizeTrigger(value) {
  const token = normalizeRuleToken(value);
  return token.replace(/-+/g, "-");
}

function normalizeFeedbackBranch(branch) {
  return isPlainObject(branch) ? branch : {};
}

function mergeFeedbackOptions(...branches) {
  return branches.reduce((acc, branch) => {
    if (!isPlainObject(branch)) return acc;
    return {
      ...acc,
      ...branch,
    };
  }, {});
}

function flattenLinkContext(link) {
  if (!isPlainObject(link)) return {};

  const flattened = {};

  if (link.layers !== undefined) flattened.linkLayers = link.layers;
  if (link.matchMode !== undefined) flattened.linkMatchMode = link.matchMode;
  if (link.fields !== undefined) flattened.linkFields = link.fields;
  if (link.field !== undefined) flattened.linkField = link.field;
  if (link.defaultOpacity !== undefined) flattened.linkDefaultOpacity = link.defaultOpacity;
  if (link.baseOpacity !== undefined) flattened.linkBaseOpacity = link.baseOpacity;
  if (link.selectedOpacity !== undefined) flattened.linkSelectedOpacity = link.selectedOpacity;
  if (link.strokeColor !== undefined) flattened.linkStrokeColor = link.strokeColor;
  if (link.strokeWidth !== undefined) flattened.linkStrokeWidth = link.strokeWidth;

  return flattened;
}

function flattenLensService(service) {
  if (!isPlainObject(service)) return {};

  const lens = isPlainObject(service.lens) ? service.lens : {};
  const excentricLabeling = isPlainObject(service.excentricLabeling) ? service.excentricLabeling : {};

  return {
    ...lens,
    ...excentricLabeling,
  };
}

export function normalizeSpec(rawSpec = {}, specIndex = 0, context = {}) {
  const triggerDescriptor = isPlainObject(rawSpec.trigger) ? rawSpec.trigger : {};
  const targetDescriptor = isPlainObject(rawSpec.target) ? rawSpec.target : {};
  const feedbackDescriptor = isPlainObject(rawSpec.feedback) ? rawSpec.feedback : {};

  const rawInstrument = rawSpec.instrument;
  const rawTrigger = pickFirstDefined(
    triggerDescriptor.type,
    triggerDescriptor.on,
    rawSpec.trigger
  );
  const rawName = rawSpec.name;
  const rawTargetLayer = pickFirstDefined(
    targetDescriptor.layer,
    targetDescriptor.layers
  );
  const rawTargetInstrument = pickFirstDefined(
    targetDescriptor.instrument,
    targetDescriptor.targetInstrument
  );
  const normalizedTarget =
    rawSpec.target !== undefined
      ? rawSpec.target
      : rawTargetLayer !== undefined || rawTargetInstrument !== undefined
        ? {
            ...(rawTargetLayer !== undefined ? { layer: rawTargetLayer } : {}),
            ...(rawTargetInstrument !== undefined ? { instrument: rawTargetInstrument } : {}),
          }
        : undefined;
  const rawFeedback = rawSpec.feedback;
  const feedbackRedraw = normalizeFeedbackBranch(
    feedbackDescriptor.redrawFunc
  );
  const feedbackService = normalizeFeedbackBranch(
    feedbackDescriptor.service
  );
  const feedbackFeedforward = normalizeFeedbackBranch(
    feedbackDescriptor.feedforward
  );
  const feedbackContext = normalizeFeedbackBranch(
    feedbackDescriptor.context
  );
  const normalizedFeedback = isPlainObject(rawFeedback) ? rawFeedback : {};
  const feedbackOptions = mergeFeedbackOptions(
    feedbackRedraw,
    feedbackService,
    flattenLensService(feedbackService),
    feedbackContext,
    flattenLinkContext(feedbackContext.link)
  );

  const instrumentId = normalizeRuleToken(rawInstrument);
  const triggerId = normalizeTrigger(rawTrigger);
  const rule = findInstrumentRule(context.instrumentRules || {}, instrumentId);

  return {
    rawSpec,
    specIndex,
    name: typeof rawName === "string" ? rawName.trim() : "",
    instrument: instrumentId,
    trigger: triggerId,
    target: normalizedTarget,
    targetLayer: rawTargetLayer,
    targetInstrument:
      typeof rawTargetInstrument === "string" ? rawTargetInstrument.trim() : rawTargetInstrument,
    feedback: normalizedFeedback,
    feedbackRedraw,
    feedbackService,
    feedbackFeedforward,
    feedbackContext,
    feedbackOptions: isPlainObject(feedbackOptions) ? feedbackOptions : {},
    priority: triggerDescriptor.priority,
    stopPropagation: pickFirstDefined(
      triggerDescriptor.stopPropagation
    ),
    modifierKey: pickFirstDefined(
      triggerDescriptor.modifierKey
    ),
    inherit: rule?.inherit || null,
    runtimeBuilder: rule?.runtimeBuilder || null,
    compiler: rule?.compiler || null,
    family: rule?.family || null,
    rule,
    customFeedbackFlow: rawSpec.customFeedbackFlow,
  };
}

export function normalizeSpecList(specList = [], context = {}) {
  const list = Array.isArray(specList) ? specList : [];
  return list.map((rawSpec, index) => normalizeSpec(rawSpec, index, context));
}
