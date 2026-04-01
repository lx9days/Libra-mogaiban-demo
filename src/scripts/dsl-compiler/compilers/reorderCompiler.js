import { createPlan } from "./shared";

export const reorderCompiler = {
  id: "reorder",
  families: ["reorder"],
  match(spec = {}) {
    return spec.family === "reorder" || spec.instrument === "reorder";
  },
  compile(spec, context) {
    return [
      createPlan(spec, context, "reorder", {
        compilerId: this.id,
      }),
    ];
  },
};

export default reorderCompiler;
