// A lightweight compiler that converts interaction JSON spec into Libra.Interaction.build calls
import Libra from "libra-vis";

// Map JSON trigger to Libra instrument inherit names
const triggerToInstrument = {
  hover: "HoverInstrument",
  click: "ClickInstrument",
  brush: "BrushInstrument",
  pan: "PanInstrument",
  zoom: "GeometricZoomInstrument",
  // You can extend this map: click -> ClickInstrument, brush -> BrushInstrument, etc.
};

function stripInlineComment(str) {
  if (typeof str !== "string") return str;
  const idx = str.indexOf("//");
  return idx >= 0 ? str.slice(0, idx).trim() : str.trim();
}

function buildSharedVar(feedback = [], scales = {}) {
  const sharedVar = {};

  for (const fb of feedback) {
    const action = fb?.action || {};
    const type = stripInlineComment(action?.type || "");

    if (!type) continue;

    // Highlight: supports constant color or scale-based color
    if (type === "highlight" || type.startsWith("highlight")) {
      const fill = action?.style?.fill;

      // Case 1: constant color as string or { value: string }
      if (typeof fill === "string") {
        const constColor = stripInlineComment(fill);
        if (constColor) sharedVar.highlightColor = () => constColor;
      } else if (fill && typeof fill === "object" && typeof fill.value === "string") {
        const constColor = stripInlineComment(fill.value);
        if (constColor) sharedVar.highlightColor = () => constColor;
      } else {
        // Case 2: scale-based color using from_data + using_scale
        const field = fill?.from_data;
        const scaleName = fill?.using_scale;
        const scaleFn = scaleName ? scales[scaleName] : undefined;
        if (field && typeof scaleFn === "function") {
          sharedVar.highlightColor = (d) => scaleFn(d[field]);
        }
      }
    }

    // Tooltip: prefix + fields
    if (type === "tooltip") {
      const content = action?.content || {};
      sharedVar.tooltip = {
        prefix: content?.prefix || "",
        fields: Array.isArray(content?.fields) ? content.fields : [],
      };
    }
  }

  return sharedVar;
}

// Compile an array of interaction specs and apply them to the provided layer
export function compileInteractions(specList = [], ctx) {
  const { layer, scales = {} } = ctx || {};
  if (!layer) return;

  const list = Array.isArray(specList) ? specList : [];

  for (const spec of list) {
    
    const trigger = stripInlineComment(spec?.trigger || "");
    const inherit = triggerToInstrument[trigger] || trigger;

    const sharedVarFromFeedback = buildSharedVar(spec?.feedback, scales);
    const sharedVarDefaults = {};

    // Provide defaults for pan/zoom instruments
    if (inherit === "PanInstrument" || inherit === "GeometricZoomInstrument") {
      if (scales.x) sharedVarDefaults.scaleX = scales.x;
      if (scales.y) sharedVarDefaults.scaleY = scales.y;
      sharedVarDefaults.fixRange = true;
    }

    const sharedVar = { ...sharedVarDefaults, ...sharedVarFromFeedback };

    console.log("build");
    Libra.Interaction.build({
      inherit,
      layers: [layer],
      sharedVar,
    });
  }
}