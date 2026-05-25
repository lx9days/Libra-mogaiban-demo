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
      const updateBrush = spec.feedbackContext?.updateBrush || spec.feedback?.context?.updateBrush || spec.feedbackService?.updateBrush || spec.feedback?.service?.updateBrush;
      if (updateBrush === "translate") {
        runtimeBuilderId = "brush-move";
      } else {
        // fallback
        runtimeBuilderId = "generic-interaction";
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
