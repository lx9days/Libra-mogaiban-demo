import { createPlan } from "./shared";

const builderByInstrument = {
  lens: "lens",
  "lens-zoom": "lens-zoom",
};

export const lensCompiler = {
  id: "lens",
  families: ["lens"],
  match(spec = {}) {
    return spec.family === "lens" || Object.prototype.hasOwnProperty.call(builderByInstrument, spec.instrument);
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

export default lensCompiler;
