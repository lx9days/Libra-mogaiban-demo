import { createPlan } from "./shared";

const builderByInstrument = {
  "point-selection": "point-selection",
  "group-selection": "group-selection",
  lasso: "lasso",
  "axis-selection": "axis-selection",
};

export const selectionCompiler = {
  id: "selection",
  families: ["selection"],
  match(spec = {}) {
    return spec.family === "selection" || Object.prototype.hasOwnProperty.call(builderByInstrument, spec.instrument);
  },
  compile(spec, context) {
    const runtimeBuilderId = builderByInstrument[spec.instrument] || spec.runtimeBuilder || "generic-interaction";
    return [
      createPlan(spec, context, runtimeBuilderId, {
        compilerId: this.id,
      }),
    ];
  },
};

export default selectionCompiler;
