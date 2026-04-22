import { compileDSL } from "./src/scripts/dsl-compiler/index.js";

const layersByName = {
  mainLayer: {
    _name: "mainLayer",
    getLayerFromQueue(name) {
      if (!this._queue) this._queue = {};
      if (!this._queue[name]) {
        this._queue[name] = { _name: name, _parent: this };
      }
      return this._queue[name];
    }
  }
};

const interactionsDSL = [
  {
    name: "brushMain",
    instrument: "GroupSelection",
    trigger: { type: "brush" },
    target: { layer: "mainLayer" },
  },
  {
    instrument: "Zoom",
    trigger: { type: "zoom" },
    target: { layer: "transientLayer" },
    feedback: {
      context: {
        updateBrush: "scale"
      },
    },
  },
];

const result = compileDSL(interactionsDSL, { layersByName }, { execute: true });
console.log("diagnostics:", result.diagnostics);
