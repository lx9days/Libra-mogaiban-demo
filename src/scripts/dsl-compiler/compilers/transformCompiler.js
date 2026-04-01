import { createPlan } from "./shared";

const builderByInstrument = {
  "brush-move": "brush-move",
  "brush-zoom": "brush-zoom",
};

export const transformCompiler = {
  id: "transform",
  families: ["transform"],
  match(spec = {}) {
    return spec.family === "transform" || Object.prototype.hasOwnProperty.call(builderByInstrument, spec.instrument);
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

export default transformCompiler;
