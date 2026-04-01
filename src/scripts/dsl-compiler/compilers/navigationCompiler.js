import { createPlan } from "./shared";

const builderByInstrument = {
  pan: "view-pan",
  zoom: "view-zoom",
};

export const navigationCompiler = {
  id: "navigation",
  families: ["navigation"],
  match(spec = {}) {
    return Object.prototype.hasOwnProperty.call(builderByInstrument, spec.instrument);
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

export default navigationCompiler;
