import { createPlan } from "./shared";

const builderByInstrument = {
  pan: "pan",
  zoom: "zoom",
};

export const navigationCompiler = {
  id: "navigation",
  families: ["navigation"],
  match(spec = {}) {
    return Object.prototype.hasOwnProperty.call(builderByInstrument, spec.instrument);
  },
  compile(spec, context) {
    const rawSpec = spec.rawSpec || {};
    const feedback = rawSpec.feedback || {};
    const contextObj = feedback.context || {};
    const extraBuildContext = {
      Trigger: typeof spec.trigger === "string" ? spec.trigger : spec.trigger?.type || spec.instrument,
      scaleX: contextObj.scaleX || contextObj.scales?.x,
      scaleY: contextObj.scaleY || contextObj.scales?.y,
      fixRange: contextObj.fixRange,
    };

    const runtimeBuilderId = builderByInstrument[spec.instrument] || spec.runtimeBuilder || "generic-interaction";
    return [
      createPlan(spec, context, runtimeBuilderId, {
        compilerId: this.id,
        buildContext: extraBuildContext,
      }),
    ];
  },
};

export default navigationCompiler;
