import { createPlan } from "./shared";

const builderByInstrument = {
  "move": "move",
  "brush-zoom": "brush-zoom",
};

export const transformCompiler = {
  id: "transform",
  families: ["transform"],
  match(spec = {}) {
    return spec.family === "transform" || Object.prototype.hasOwnProperty.call(builderByInstrument, spec.instrument);
  },
  compile(spec, context) {
    let runtimeBuilderId = builderByInstrument[spec.instrument] || spec.runtimeBuilder || "generic-interaction";
    
    if (spec.instrument === "move") {
      const updateBrush = spec.feedback?.context?.updateBrush;
      if (updateBrush === "translate") {
        runtimeBuilderId = "brush-move";
      } else {
        // fallback
        runtimeBuilderId = "brush-move";
      }
    }

    return [
      createPlan(spec, context, runtimeBuilderId, {
        compilerId: this.id,
      }),
    ];
  },
};

export default transformCompiler;
