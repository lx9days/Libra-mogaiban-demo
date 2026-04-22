const defaultInstrumentRules = {
  "point-selection": {
    id: "point-selection",
    family: "selection",
    compiler: "selection",
    runtimeBuilder: "point-selection",
    inherit: null,
    aliases: ["pointselection", "point", "selection"],
    triggers: ["hover", "click"],
    requiresTargetLayer: true,
  },
  "group-selection": {
    id: "group-selection",
    family: "selection",
    compiler: "selection",
    runtimeBuilder: "group-selection",
    inherit: null,
    aliases: ["groupselection", "brush"],
    triggers: ["brush"],
    requiresTargetLayer: true,
  },
  lasso: {
    id: "lasso",
    family: "selection",
    compiler: "selection",
    runtimeBuilder: "lasso",
    inherit: null,
    aliases: ["lassoselection"],
    triggers: ["lasso"],
    requiresTargetLayer: true,
  },
  "axis-selection": {
    id: "axis-selection",
    family: "selection",
    compiler: "selection",
    runtimeBuilder: "axis-selection",
    inherit: null,
    aliases: ["axisselection", "axis selection"],
    triggers: ["brushx", "brush-x", "brushy", "brush-y", "brush"],
    requiresTargetLayer: true,
  },
  pan: {
    id: "pan",
    family: "transform",
    compiler: "navigation",
    runtimeBuilder: "view-pan",
    inherit: "PanInstrument",
    aliases: ["panning"],
    triggers: ["pan", "drag"],
    requiresTargetLayer: true,
  },
  zoom: {
    id: "zoom",
    family: "transform",
    compiler: "navigation",
    runtimeBuilder: "view-zoom",
    inherit: "GeometricZoomInstrument",
    aliases: ["zooming"],
    triggers: ["zoom", "wheel"],
    requiresTargetLayer: true,
  },
  "move": {
    id: "move",
    family: "transform",
    compiler: "transform",
    runtimeBuilder: "move",
    inherit: null,
    aliases: ["moving", "brush-move", "brushmove"],
    triggers: ["drag", "move"],
    requiresTargetLayer: true,
  },
  "brush-zoom": {
    id: "brush-zoom",
    family: "transform",
    compiler: "transform",
    runtimeBuilder: "brush-zoom",
    inherit: null,
    aliases: ["brushzoom"],
    triggers: ["zoom", "brush"],
    requiresTargetLayer: true,
  },
  lens: {
    id: "lens",
    family: "lens",
    compiler: "lens",
    runtimeBuilder: "lens",
    inherit: null,
    aliases: ["excentric-labeling", "excentriclabeling"],
    triggers: ["hover", "click"],
    requiresTargetLayer: true,
  },
  "lens-zoom": {
    id: "lens-zoom",
    family: "lens",
    compiler: "lens",
    runtimeBuilder: "lens-zoom",
    inherit: null,
    aliases: ["lenszoom"],
    triggers: ["zoom", "wheel"],
    requiresTargetLayer: true,
  },
  reorder: {
    id: "reorder",
    family: "reorder",
    compiler: "reorder",
    runtimeBuilder: "reorder",
    inherit: null,
    aliases: ["reordering", "reorderinstrument"],
    triggers: ["drag"],
    requiresTargetLayer: true,
  },
  "helper-line": {
    id: "helper-line",
    family: "helper",
    compiler: "helper",
    runtimeBuilder: "generic-interaction",
    inherit: null,
    aliases: ["helperline"],
    triggers: ["hover", "click", "drag"],
    requiresTargetLayer: true,
  },
};

export function normalizeRuleToken(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

export function createInstrumentRules(overrides = {}) {
  return {
    ...defaultInstrumentRules,
    ...overrides,
  };
}

export function findInstrumentRule(instrumentRules = {}, instrumentId = "") {
  const token = normalizeRuleToken(instrumentId);
  if (!token) return null;

  const direct = instrumentRules[token];
  if (direct) return direct;

  return (
    Object.values(instrumentRules).find((rule) => {
      if (!rule) return false;
      if (normalizeRuleToken(rule.id) === token) return true;
      if (!Array.isArray(rule.aliases)) return false;
      return rule.aliases.some((alias) => normalizeRuleToken(alias) === token);
    }) || null
  );
}

export function listInstrumentRules(instrumentRules = {}) {
  return Object.values(instrumentRules).filter(Boolean);
}

export { defaultInstrumentRules };
