import { createPlan } from "./shared";

export const helperCompiler = {
  id: "helper",
  families: ["helper"],
  match(spec = {}) {
    return spec.family === "helper" || spec.instrument === "helper-line";
  },
  compile(spec, context) {
    return [
      createPlan(spec, context, spec.runtimeBuilder || "generic-interaction", {
        compilerId: this.id,
      }),
    ];
  },
};

export default helperCompiler;
