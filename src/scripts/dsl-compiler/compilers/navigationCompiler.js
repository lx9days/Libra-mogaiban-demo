import { createPlan } from "./shared";

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

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
    
    const lensZoomObj = contextObj.updateLens ? contextObj : null;
    const lensZoomParams = isPlainObject(lensZoomObj?.zoom) ? lensZoomObj.zoom : {};
    const targetLensName =
      typeof lensZoomObj?.targetLensName === "string" && lensZoomObj.targetLensName.trim()
        ? lensZoomObj.targetLensName.trim()
        : typeof lensZoomParams.targetLensName === "string" && lensZoomParams.targetLensName.trim()
          ? lensZoomParams.targetLensName.trim()
          : undefined;

    const brushZoomObj = contextObj.updateBrush ? contextObj : null;
    const brushZoomParams = isPlainObject(brushZoomObj?.zoom) ? brushZoomObj.zoom : {};
    const targetBrushName =
      typeof brushZoomObj?.targetBrushName === "string" && brushZoomObj.targetBrushName.trim()
        ? brushZoomObj.targetBrushName.trim()
        : typeof brushZoomParams.targetBrushName === "string" && brushZoomParams.targetBrushName.trim()
          ? brushZoomParams.targetBrushName.trim()
          : undefined;

    if (spec.instrument === "zoom") {
      if (lensZoomObj) {
        return [
          createPlan(spec, context, "lens-zoom", {
            compilerId: this.id,
            buildContext: {
              Trigger: typeof spec.trigger === "string" ? spec.trigger : spec.trigger?.type || spec.instrument,
              ...lensZoomObj,
              ...lensZoomParams,
              ...(targetLensName ? { targetLensName } : {}),
            },
          }),
        ];
      }
      
      if (brushZoomObj) {
        return [
          createPlan(spec, context, "brush-zoom", {
            compilerId: this.id,
            buildContext: {
              Trigger: typeof spec.trigger === "string" ? spec.trigger : spec.trigger?.type || spec.instrument,
              ...brushZoomObj,
              ...brushZoomParams,
              ...(targetBrushName ? { targetBrushName } : {}),
            },
          }),
        ];
      }
    }

    const extraBuildContext = {
      Trigger: typeof spec.trigger === "string" ? spec.trigger : spec.trigger?.type || spec.instrument,
      semantic: contextObj.semantic,
      scaleLevels: contextObj.scaleLevels,
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
