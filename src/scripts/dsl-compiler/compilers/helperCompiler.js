import { createPlan } from "./shared";

export const helperCompiler = {
  id: "helper",
  families: ["helper"],
  match(spec = {}) {
    return spec.family === "helper" || spec.instrument === "helper-line";
  },
  compile(spec, context) {
    if (spec.instrument === "helper-line" || spec.instrument === "helperline") {
      const orientation = spec.feedbackService?.orientation || ["horizontal"];
      const scales = spec.feedbackContext?.scales || {};
      
      const sharedVar = {
        orientation,
        ...(scales.y ? { scaleY: scales.y } : {}),
        ...(scales.x ? { scaleX: scales.x } : {}),
      };

      if (!spec.customFeedbackFlow) {
        if (spec.feedbackService?.showIntersection) {
          const intersectionData = spec.feedbackContext?.data || [];
          const scaleColor = spec.feedbackContext?.scales?.color;
          const layer = context.layersByName?.mainLayer || context.layersByName?.layer;
          
          spec.customFeedbackFlow = {
            remove: [{ find: "SelectionTransformer" }],
            insert: [
              {
                find: "SelectionService",
                flow: [
                  {
                    comp: "IntersectionService",
                    sharedVar: {
                      data: intersectionData,
                      ...(scales.x ? { scaleX: scales.x } : {}),
                      ...(scales.y ? { scaleY: scales.y } : {}),
                      ...(scaleColor ? { scaleColor: scaleColor } : {}),
                      layer: layer,
                      type: "Hover",
                    },
                  },
                ],
              },
              {
                find: "IntersectionService",
                flow: [
                  {
                    comp: "TooltipLineTransformer",
                    sharedVar: {
                      orientation,
                      showIntersection: true,
                    },
                  },
                ],
              },
            ],
          };
        } else {
          spec.customFeedbackFlow = {
            insert: [
              {
                find: "SelectionService",
                flow: [
                  {
                    comp: "LineTransformer",
                    sharedVar,
                  },
                ],
              },
            ],
          };
        }
      }

      if (!spec.feedbackOptions.tooltip) {
        spec.feedbackOptions.tooltip = { prefix: " " };
      }
    }

    return [
      createPlan(spec, context, spec.runtimeBuilder || "generic-interaction", {
        compilerId: this.id,
      }),
    ];
  },
};

export default helperCompiler;
