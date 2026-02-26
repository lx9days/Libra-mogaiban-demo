import * as d3 from "d3";
import Libra from "libra-vis";
import excentricLabeling from "excentric-labeling";

export default class LibraManager {
    constructor() {

    }

    static checkInput(layer, context) {
        if (!layer) return false;
        if (!context || !('Trigger' in context)) return false;

        const validTriggers = ['hover', 'click', 'brush', 'drag', 'pan', 'zoom', 'brushx', 'brushy'];
        if (typeof context.Trigger !== 'string') return false;

        const trigger = context.Trigger.toLowerCase();
        if (!validTriggers.includes(trigger)) return false;

        return true;
    }
    static buildPointSelectionInstrument(layer, context) {
        if (!this.checkInput(layer, context)) return;

        const trigger = context.Trigger.toLowerCase();
        if (!['click', 'hover'].includes(trigger)) return;

        const triggerPascal = trigger.charAt(0).toUpperCase() + trigger.slice(1);
        const sharedVar = {};
        if (context.ModifierKey) sharedVar.modifierKey = context.ModifierKey;
        if (context.modifierKey) sharedVar.modifierKey = context.modifierKey;
        if (context.HighlightColor) sharedVar.highlightColor = context.HighlightColor;
        if (context.highlightAttrValues) sharedVar.highlightAttrValues = context.highlightAttrValues;
        if (context.Tooltip) {
            sharedVar.tooltip = {
                prefix: context.Tooltip.Prefix,
                fields: context.Tooltip.Fields,
            };
        }

        const buildOptions = {
            inherit: `${triggerPascal}Instrument`,
            layers: [layer],
            sharedVar: sharedVar,
        };
        if (context.priority !== undefined) buildOptions.priority = context.priority;
        if (context.Priority !== undefined) buildOptions.priority = context.Priority;
        if (context.stopPropagation !== undefined) buildOptions.stopPropagation = context.stopPropagation;

        Libra.Interaction.build(buildOptions);
    }
    static buildGroupSelectionInstrument(layer, context) {
        if (!this.checkInput(layer, context)) return;

        const trigger = context.Trigger.toLowerCase();
        if (trigger !== 'brush') return;

        const triggerPascal = trigger.charAt(0).toUpperCase() + trigger.slice(1);
        const sharedVar = {};
        if (context.ModifierKey) sharedVar.modifierKey = context.ModifierKey;
        if (context.modifierKey) sharedVar.modifierKey = context.modifierKey;
        if (context.HighlightColor) sharedVar.highlightColor = context.HighlightColor;
        if (context.highlightAttrValues) sharedVar.highlightAttrValues = context.highlightAttrValues;
        if (context.Tooltip) {
            sharedVar.tooltip = {
                prefix: context.Tooltip.Prefix,
                fields: context.Tooltip.Fields,
            };
        }

        const buildOptions = {
            inherit: `${triggerPascal}Instrument`,
            layers: [layer],
            sharedVar: sharedVar,
        };
        if (context.priority !== undefined) buildOptions.priority = context.priority;
        if (context.Priority !== undefined) buildOptions.priority = context.Priority;
        if (context.stopPropagation !== undefined) buildOptions.stopPropagation = context.stopPropagation;

        Libra.Interaction.build(buildOptions);
    }

    static buildAxisSelectionInstrument(layer, context) {
        if (!this.checkInput(layer, context)) return;

        const trigger = context.Trigger.toLowerCase();
        let triggerPascal = "";

        if (context.axisDirection) {
            const dir = context.axisDirection.toLowerCase();
            if (dir === 'x') triggerPascal = "BrushX";
            else if (dir === 'y') triggerPascal = "BrushY";
        }

        if (!triggerPascal && ['brushx', 'brushy'].includes(trigger)) {
            triggerPascal = trigger.replace('brushx', 'BrushX').replace('brushy', 'BrushY');
        }

        if (!triggerPascal) return;

        const sharedVar = {};

        if (context.ModifierKey) sharedVar.modifierKey = context.ModifierKey;
        if (context.modifierKey) sharedVar.modifierKey = context.modifierKey;
        if (context.HighlightColor) sharedVar.highlightColor = context.HighlightColor;
        if (context.highlightAttrValues) sharedVar.highlightAttrValues = context.highlightAttrValues;
        if (context.Tooltip) {
            sharedVar.tooltip = {
                prefix: context.Tooltip.Prefix,
                fields: context.Tooltip.Fields,
            };
        }
        if (context.linkTo) sharedVar.linkTo = context.linkTo;
        if (context.SelectionMode) sharedVar.selectionMode = context.SelectionMode.toLowerCase();
        if (context.axisDirection) sharedVar.axisDirection = context.axisDirection.toLowerCase();
        if (context.dimension) sharedVar.dimension = context.dimension;
        if (context.scale) sharedVar.scale = context.scale;

        // Generate a selectionId for cross-filtering
        if (context.dimension) {
            sharedVar.selectionId = context.dimension;
        } else if (context.axisDirection) {
            sharedVar.selectionId = context.axisDirection.toLowerCase();
        } else {
            sharedVar.selectionId = triggerPascal.replace('Brush', '').toLowerCase();
        }

        if (context.BaseOpacity !== undefined) sharedVar.baseOpacity = context.BaseOpacity;
        if (context.baseOpacity !== undefined) sharedVar.baseOpacity = context.baseOpacity;

        Libra.Service.register("LinkRectSelectionService", {
            sharedVar: sharedVar,
            evaluate({ layer, self }) {
                let linkTo = self.getSharedVar("linkTo");

                let x = self.getSharedVar("offsetx");
                if (x === undefined) x = self.getSharedVar("x");

                let width = self.getSharedVar("width");

                let y = self.getSharedVar("offsety");
                if (y === undefined) y = self.getSharedVar("y");

                let height = self.getSharedVar("height");

                if (x === undefined && y === undefined && width === undefined && height === undefined) {
                    return {
                        selectionBounds: {
                            x: 0,
                            y: 0,
                            width: 0,
                            height: 0
                        }
                    };
                }

                const axisDirection = self.getSharedVar("axisDirection");
                let axisBBox = null;
                if (axisDirection && layer && typeof layer.getBBox === "function") {
                    axisBBox = layer.getBBox();
                }

                if (axisDirection === "y" && axisBBox) {
                    if (x === undefined) x = axisBBox.x;
                    if (width === undefined) width = axisBBox.width;
                } else if (axisDirection === "x" && axisBBox) {
                    if (y === undefined) y = axisBBox.y;
                    if (height === undefined) height = axisBBox.height;
                }

                if (x === undefined) x = 0;
                if (y === undefined) y = 0;
                if (width === undefined) width = linkTo.getBBox().width;
                if (height === undefined) height = linkTo.getBBox().height;

                const dimension = self.getSharedVar("dimension");
                const scale = self.getSharedVar("scale");

                return {
                    selectionBounds: {
                        x,
                        y,
                        width,
                        height,
                        dimension,
                        scale
                    }
                };
            }
        });
        Libra.GraphicalTransformer.register(
            "LinkSelectionTransformer",
            {
                layer: null,
                redraw({ transformer, layer }) {
                    const result = transformer.getSharedVar("result");
                    const linkTo = transformer.getSharedVar("linkTo");
                    const highlightColor = transformer.getSharedVar("highlightColor");
                    const highlightAttrValues = transformer.getSharedVar("highlightAttrValues");
                    const selectionId = transformer.getSharedVar("selectionId");
                    const selectionMode = transformer.getSharedVar("selectionMode") || "overwrite";
                    const baseOpacity = transformer.getSharedVar("baseOpacity");


                    if (linkTo) {
                        const linkSelectionLayer = linkTo.getLayerFromQueue("LinkSelectionLayer");

                        if (!linkSelectionLayer._selectionState) {
                            linkSelectionLayer._selectionState = new Map();
                        }

                        if (result && result.selectionBounds && selectionId) {
                            const { width, height } = result.selectionBounds;

                            if (width > 0 && height > 0) {
                                if (selectionMode === "overwrite") {
                                    for (const key of linkSelectionLayer._selectionState.keys()) {
                                        if (key !== selectionId) {
                                            linkSelectionLayer._selectionState.delete(key);
                                        }
                                    }
                                }
                                linkSelectionLayer._selectionState.set(selectionId, result.selectionBounds);
                            } else {
                                linkSelectionLayer._selectionState.delete(selectionId);
                            }
                        }

                        const g = d3.select(linkSelectionLayer.getGraphic());
                        g.html("");

                        const hasActiveSelection = linkSelectionLayer._selectionState.size > 0;

                        if (baseOpacity !== undefined) {
                            const originalLayer = d3.select(linkTo.getGraphic());
                            originalLayer.style("opacity", hasActiveSelection ? baseOpacity : 1);
                        }

                        // Compute intersection or union of all active selections
                        if (linkSelectionLayer._selectionState.size > 0) {
                            let rectSelection = [];

                            if (selectionMode === "intersection") {
                                // Check if we have any data-driven selections
                                const activeSelections = Array.from(linkSelectionLayer._selectionState.values());
                                const hasDataDriven = activeSelections.some(b => b.dimension && b.scale);

                                if (hasDataDriven) {
                                    const matchingNodes = [];

                                    d3.select(linkTo.getGraphic()).selectAll("*").each(function () {
                                        const d = d3.select(this).datum();
                                        if (!d) return;

                                        let satisfiesAll = true;
                                        for (const bounds of activeSelections) {
                                            if (bounds.dimension && bounds.scale) {
                                                const { y, height, dimension, scale } = bounds;
                                                if (typeof scale.invert === "function") {
                                                    const val1 = scale.invert(y);
                                                    const val2 = scale.invert(y + height);
                                                    const minVal = Math.min(val1, val2);
                                                    const maxVal = Math.max(val1, val2);

                                                    const val = d[dimension];
                                                    if (val === undefined || val < minVal || val > maxVal) {
                                                        satisfiesAll = false;
                                                        break;
                                                    }
                                                }
                                            }
                                            // TODO: Handle geometric intersection if needed, currently ignored for hybrid
                                        }

                                        if (satisfiesAll) {
                                            matchingNodes.push(this);
                                        }
                                    });
                                    rectSelection = matchingNodes;

                                } else {
                                    let intersectBox = null;
                                    for (const bounds of linkSelectionLayer._selectionState.values()) {
                                        if (!intersectBox) {
                                            intersectBox = { ...bounds };
                                        } else {
                                            const x1 = Math.max(intersectBox.x, bounds.x);
                                            const y1 = Math.max(intersectBox.y, bounds.y);
                                            const x2 = Math.min(intersectBox.x + intersectBox.width, bounds.x + bounds.width);
                                            const y2 = Math.min(intersectBox.y + intersectBox.height, bounds.y + bounds.height);

                                            if (x2 > x1 && y2 > y1) {
                                                intersectBox.x = x1;
                                                intersectBox.y = y1;
                                                intersectBox.width = x2 - x1;
                                                intersectBox.height = y2 - y1;
                                            } else {
                                                intersectBox = null;
                                                break;
                                            }
                                        }
                                    }
                                    if (intersectBox) {
                                        rectSelection = linkTo.picking({
                                            baseOn: 0,
                                            type: 3,
                                            x: intersectBox.x,
                                            y: intersectBox.y,
                                            width: intersectBox.width,
                                            height: intersectBox.height,
                                        });
                                    }
                                }
                            } else { // Union mode
                                const allSelectedNodes = new Set();
                                for (const bounds of linkSelectionLayer._selectionState.values()) {
                                    if (bounds.dimension && bounds.scale) {
                                        const { y, height, dimension, scale } = bounds;
                                        if (typeof scale.invert === "function") {
                                            const val1 = scale.invert(y);
                                            const val2 = scale.invert(y + height);
                                            const minVal = Math.min(val1, val2);
                                            const maxVal = Math.max(val1, val2);

                                            d3.select(linkTo.getGraphic()).selectAll("*").each(function () {
                                                const d = d3.select(this).datum();
                                                if (d && d[dimension] !== undefined) {
                                                    const val = d[dimension];
                                                    if (val >= minVal && val <= maxVal) {
                                                        allSelectedNodes.add(this);
                                                    }
                                                }
                                            });
                                        }
                                    } else {
                                        const selection = linkTo.picking({
                                            baseOn: 0,
                                            type: 3,
                                            x: bounds.x,
                                            y: bounds.y,
                                            width: bounds.width,
                                            height: bounds.height,
                                        });
                                        if (selection) {
                                            selection.forEach(node => allSelectedNodes.add(node));
                                        }
                                    }
                                }
                                rectSelection = Array.from(allSelectedNodes);
                            }

                            if (rectSelection && rectSelection.length > 0) {
                                const nodesToCopy = rectSelection.filter(node => !d3.select(node).classed("main-group"));
                                const selectionSet = new Set(nodesToCopy);
                                const topLevelNodes = nodesToCopy.filter(node => !selectionSet.has(node.parentNode));

                                topLevelNodes.forEach((node) => {
                                    const clone = node.cloneNode(true);
                                    const originalTransform = d3.select(node).attr("transform") || "";

                                    const originalData = d3.select(node).datum();
                                    d3.select(clone).datum(originalData);

                                    const cloneSelection = d3.select(clone)
                                        .attr("transform", originalTransform)
                                        .style("opacity", 0.5)
                                        .style("pointer-events", "none");

                                    if (highlightColor) {
                                        cloneSelection.style("fill", highlightColor)
                                            .style("stroke", highlightColor);
                                    }
                                    if (highlightAttrValues && typeof highlightAttrValues === "object") {
                                        Object.entries(highlightAttrValues).forEach(([key, value]) => {
                                            cloneSelection.attr(key, value);
                                        });
                                    }
                                    g.node().appendChild(clone);
                                });
                            }
                        }
                    }
                },
            }
        );

        Libra.Instrument.register("LinkBrushXInstrument", {
            constructor: Libra.Instrument,
            interactors: ["MouseTraceInteractor", "TouchTraceInteractor"],
            on: {
                dragstart: [
                    async ({ event, layer, instrument }) => {
                        if (event.changedTouches) event = event.changedTouches[0];
                        const services = instrument.services;
                        const [offsetX, offsetY] = d3.pointer(event, layer.getGraphic());
                        services.setSharedVars(
                            {
                                x: event.clientX,
                                offsetx: offsetX,
                                width: 0,
                                startx: event.clientX,
                                startoffsetx: offsetX,
                                currentx: event.clientX,
                            },
                            { layer }
                        );
                        instrument.setSharedVar("startx", event.clientX);
                        instrument.setSharedVar("startoffsetx", offsetX);
                    },
                ],
                drag: [
                    async (options) => {
                        let { event, layer, instrument } = options;


                        if (event.changedTouches) event = event.changedTouches[0];

                        const startx = instrument.getSharedVar("startx");
                        const startoffsetx = instrument.getSharedVar("startoffsetx");
                        const [currentOffsetX, currentOffsetY] = d3.pointer(event, layer.getGraphic());

                        const x = Math.min(startx, event.clientX);
                        const offsetx = Math.min(startoffsetx, currentOffsetX);
                        const width = Math.abs(currentOffsetX - startoffsetx); // Use offset diff for width to be consistent with local coords

                        // selection, currently service use client coordinates, but coordinates relative to the layer maybe more appropriate.
                        instrument.services.find("SelectionService").setSharedVars(
                            {
                                x,
                                offsetx,
                                width,
                                currentx: event.clientX,
                            },
                            { layer }
                        );

                        instrument.services.find("LinkRectSelectionService").setSharedVars(
                            {
                                x,
                                offsetx,
                                width,
                                currentx: event.clientX,

                            },
                            { layer }
                        );

                        instrument.setSharedVar("currentx", event.clientX);
                        instrument.setSharedVar("currentoffsetx", currentOffsetX);

                        instrument.emit("brush", options);
                    },
                ],
                dragend: [Libra.Command.initialize("Log", { execute() { } })],
                dragabort: [
                    async (options) => {
                        let { event, layer, instrument } = options;

                        if (event.changedTouches) event = event.changedTouches[0];
                        instrument.services.setSharedVars(
                            {
                                x: 0,
                                offsetx: 0,
                                width: 0,
                                currentx: event.clientX,
                            },
                            { layer }
                        );

                        instrument.emit("brushabort", options);
                    },
                ],
            },
            preAttach: (instrument, layer) => {
                instrument.services.add("RectSelectionService", {
                    layer,
                    sharedVar: {
                        deepClone: instrument.getSharedVar("deepClone"),
                        highlightColor: instrument.getSharedVar("highlightColor"),
                        highlightAttrValues: instrument.getSharedVar("highlightAttrValues"),
                    },
                });
                instrument.services.add("LinkRectSelectionService", {
                    layer,
                    sharedVar: {
                        deepClone: instrument.getSharedVar("deepClone"),
                        highlightColor: instrument.getSharedVar("highlightColor"),
                        highlightAttrValues: instrument.getSharedVar("highlightAttrValues"),
                    },
                });

            },
        });

        Libra.Instrument.register("LinkBrushYInstrument", {
            constructor: Libra.Instrument,
            interactors: ["MouseTraceInteractor", "TouchTraceInteractor"],
            on: {
                dragstart: [
                    async ({ event, layer, instrument }) => {
                        if (event.changedTouches) event = event.changedTouches[0];
                        const services = instrument.services;
                        const [offsetX, offsetY] = d3.pointer(event, layer.getGraphic());
                        services.setSharedVars(
                            {
                                y: event.clientY,
                                offsety: offsetY,
                                height: 0,
                                starty: event.clientY,
                                startoffsety: offsetY,
                                currenty: event.clientY,
                            },
                            { layer }
                        );
                        instrument.setSharedVar("starty", event.clientY);
                        instrument.setSharedVar("startoffsety", offsetY);
                    },
                ],
                drag: [
                    async (options) => {
                        let { event, layer, instrument } = options;
                        console.log(layer);
                        if (event.changedTouches) event = event.changedTouches[0];

                        const starty = instrument.getSharedVar("starty");
                        const startoffsety = instrument.getSharedVar("startoffsety");
                        const [currentOffsetX, currentOffsetY] = d3.pointer(event, layer.getGraphic());

                        const y = Math.min(starty, event.clientY);
                        const offsety = Math.min(startoffsety, currentOffsetY);
                        const height = Math.abs(currentOffsetY - startoffsety); // Use offset diff for height

                        instrument.services.find("SelectionService").setSharedVars(
                            {
                                y,
                                offsety,
                                height,
                                currenty: event.clientY,
                            },
                            { layer }
                        );

                        instrument.services.find("LinkRectSelectionService").setSharedVars(
                            {
                                y,
                                offsety,
                                height,
                                currenty: event.clientY,
                            },
                            { layer }
                        );

                        instrument.setSharedVar("currenty", event.clientY);
                        instrument.setSharedVar("currentoffsety", currentOffsetY);

                        instrument.emit("brush", options);
                    },
                ],
                dragend: [Libra.Command.initialize("Log", { execute() { } })],
                dragabort: [
                    async (options) => {
                        let { event, layer, instrument } = options;
                        if (event.changedTouches) event = event.changedTouches[0];
                        instrument.services.setSharedVars(
                            {
                                y: 0,
                                offsety: 0,
                                height: 0,
                                currenty: event.clientY,
                            },
                            { layer }
                        );
                        instrument.emit("brushabort", options);
                    },
                ],
            },
            preAttach: (instrument, layer) => {
                instrument.services.add("RectSelectionService", {
                    layer,
                    sharedVar: {
                        deepClone: instrument.getSharedVar("deepClone"),
                        highlightColor: instrument.getSharedVar("highlightColor"),
                        highlightAttrValues: instrument.getSharedVar("highlightAttrValues"),
                    },
                });
                instrument.services.add("LinkRectSelectionService", {
                    layer,
                    sharedVar: {
                        deepClone: instrument.getSharedVar("deepClone"),
                        highlightColor: instrument.getSharedVar("highlightColor"),
                        highlightAttrValues: instrument.getSharedVar("highlightAttrValues"),
                    },
                });
            },
        });


        const buildOptions = {
            inherit: `Link${triggerPascal}Instrument`,
            layers: [layer],
            sharedVar: sharedVar,
            insert: [
                {
                    find: "LinkBrushXInstrument",
                    flow: [
                        {
                            comp: "LinkRectSelectionService",
                        },
                        {
                            comp: "LinkSelectionTransformer",
                        }
                    ],
                },
                {
                    find: "LinkBrushYInstrument",
                    flow: [
                        {
                            comp: "LinkRectSelectionService",
                        },
                        {
                            comp: "LinkSelectionTransformer",
                        }
                    ],
                }
            ]
        };
        if (context.priority !== undefined) buildOptions.priority = context.priority;
        if (context.Priority !== undefined) buildOptions.priority = context.Priority;
        if (context.stopPropagation !== undefined) buildOptions.stopPropagation = context.stopPropagation;

        Libra.Interaction.build(buildOptions);
    }

    static getOrCreateLayer(svg, className, width, height, x = 0, y = 0) {
        let layer;
        const existingGroup = svg.select("." + className);

        if (existingGroup.empty()) {
            layer = Libra.Layer.initialize("D3Layer", {
                name: className,
                width: width,
                height: height,
                offset: { x: x, y: y },
                container: svg.node(),
            });
            d3.select(layer.getGraphic()).attr("class", className);
        } else {
            // Try to retrieve the original Libra.Layer instance by name
            const found = Libra.Layer.findLayer(className);
            const foundLayer = Array.isArray(found)
                ? found.find((l) => l && typeof l.getGraphic === "function" && l.getGraphic() === existingGroup.node()) ||
                  found.find((l) => l && typeof l.getGraphic === "function") ||
                  null
                : found;
            if (foundLayer && typeof foundLayer.getGraphic === "function") {
                if (typeof foundLayer.setOffsetCascade === "function") {
                    foundLayer.setOffsetCascade(x, y);
                } else {
                    const g = d3.select(foundLayer.getGraphic());
                    g.attr("transform", `translate(${x},${y})`);
                }
                layer = foundLayer;
            } else {
                // Fallback: update DOM group transform and return a minimal wrapper
                existingGroup.attr("transform", `translate(${x},${y})`);
                layer = {
                    getGraphic: () => existingGroup.node()
                };
            }
        }
        return layer;
    }

    static buildReorderInstrument(layer, context) {
        Libra.Service.register("copyService", {
            sharedVar: {
                // These will be overridden by instance sharedVars
                names: [],
                scaleX: null,
                scaleY: null,
                copyFrom: null
            },
            evaluate({ startx, starty, currentx, currenty, dragging, startOffsetX, startOffsetY, self }) {
                const direction = self.getSharedVar("direction");
                const scaleX = self.getSharedVar("scaleX");
                const scaleY = self.getSharedVar("scaleY");
                const copyFrom = self.getSharedVar("copyFrom");

                if (direction === "x" && scaleX) {
                    const bandwidth = scaleX.bandwidth() / 10;
                    const targetColumn = scaleX.domain().find(name => {
                        const colX = scaleX(name);
                        return startOffsetX >= colX && startOffsetX <= colX + bandwidth;
                    });

                    let pickX = startx;
                    if (targetColumn) {
                        pickX = scaleX(targetColumn);
                    }

                    const pickingOptions = {
                        baseOn: 0,
                        type: 3,
                        x: pickX,
                        y: 0,
                        width: bandwidth,
                        height: 2000
                    };

                    let rectSelection = [];
                    let finalCopyFromLayer = null;
                    if (copyFrom) {
                        if (typeof copyFrom.picking === "function") {
                            const picked = copyFrom.picking(pickingOptions) || [];
                            rectSelection = picked;
                            if (picked.length) finalCopyFromLayer = copyFrom;
                        } else if (Array.isArray(copyFrom)) {
                            copyFrom.forEach(layer => {
                                if (layer && typeof layer.picking === "function") {
                                    const picked = layer.picking(pickingOptions) || [];
                                    rectSelection = rectSelection.concat(picked);
                                    if (!finalCopyFromLayer && picked.length) finalCopyFromLayer = layer;
                                }
                            });
                        } else if (typeof copyFrom === "object") {
                            Object.values(copyFrom).forEach(layer => {
                                if (layer && typeof layer.picking === "function") {
                                    const picked = layer.picking(pickingOptions) || [];
                                    rectSelection = rectSelection.concat(picked);
                                    if (!finalCopyFromLayer && picked.length) finalCopyFromLayer = layer;
                                }
                            });
                        }
                    }

                    return { rectSelection, dx: currentx - startx, dragging, direction: "x", finalCopyFromLayer };
                } else if (direction === "y" && scaleY) {
                    const bandwidth = scaleY.bandwidth() / 10;
                    const targetRow = scaleY.domain().find(name => {
                        const rowY = scaleY(name);
                        return startOffsetY >= rowY && startOffsetY <= rowY + bandwidth;
                    });

                    let pickY = starty;
                    if (targetRow) {
                        pickY = scaleY(targetRow);
                    }

                    const pickingOptions = {
                        baseOn: 0,
                        type: 3,
                        x: 0,
                        y: pickY,
                        width: 2000,
                        height: bandwidth
                    };

                    let rectSelection = [];
                    let finalCopyFromLayer = null;
                    if (copyFrom) {
                        if (typeof copyFrom.picking === "function") {
                            const picked = copyFrom.picking(pickingOptions) || [];
                            rectSelection = picked;
                            if (picked.length) finalCopyFromLayer = copyFrom;
                        } else if (Array.isArray(copyFrom)) {
                            copyFrom.forEach(layer => {
                                if (layer && typeof layer.picking === "function") {
                                    const picked = layer.picking(pickingOptions) || [];
                                    rectSelection = rectSelection.concat(picked);
                                    if (!finalCopyFromLayer && picked.length) finalCopyFromLayer = layer;
                                }
                            });
                        } else if (typeof copyFrom === "object") {
                            Object.values(copyFrom).forEach(layer => {
                                if (layer && typeof layer.picking === "function") {
                                    const picked = layer.picking(pickingOptions) || [];
                                    rectSelection = rectSelection.concat(picked);
                                    if (!finalCopyFromLayer && picked.length) finalCopyFromLayer = layer;
                                }
                            });
                        }
                    }
                    return { rectSelection, dy: currenty - starty, dragging, direction: "y", finalCopyFromLayer: finalCopyFromLayer };
                }
                return { dragging };
            }
        });
        Libra.Service.register("ReorderService", {
            sharedVar: {
                names: [],
                scaleX: null,
                scaleY: null,
            },
            evaluate({ startx, offsetx, currentx, starty, offsety, currenty, self, dragging }) {
                const direction = self.getSharedVar("direction");
                const names = self.getSharedVar("names");
                const scaleX = self.getSharedVar("scaleX");
                const scaleY = self.getSharedVar("scaleY");

                let startItem, targetItem;

                if (direction === "x" && offsetx) {
                    const offset = offsetx - currentx;
                    startItem = scaleX
                        .domain()
                        .find(
                            (name) =>
                                scaleX(name) <= startx + offset &&
                                startx + offset <=
                                scaleX(name) + scaleX.bandwidth()
                        );
                    targetItem = scaleX
                        .domain()
                        .find(
                            (name) =>
                                scaleX(name) <= offsetx &&
                                offsetx <=
                                scaleX(name) + scaleX.bandwidth()
                        );
                } else if (direction === "y" && offsety && scaleY) {
                    const offset = offsety - currenty;
                    startItem = scaleY
                        .domain()
                        .find(
                            (name) =>
                                scaleY(name) <= starty + offset &&
                                starty + offset <=
                                scaleY(name) + scaleY.bandwidth()
                        );
                    targetItem = scaleY
                        .domain()
                        .find(
                            (name) =>
                                scaleY(name) <= offsety &&
                                offsety <=
                                scaleY(name) + scaleY.bandwidth()
                        );
                } else {
                    // Persist the result
                    const results = self.oldCachedResults;
                    if (results) {
                        names.forEach((_, i) => {
                            names[i] = results.reorderedNames[i];
                        });
                        scaleX.domain(names);
                        if (scaleY) scaleY.domain(names);
                    }
                    return {
                        reorderedNames: names,
                        x: scaleX,
                        y: scaleY,
                        dragging
                    };
                }

                if (startItem && targetItem) {
                    const reorderedNames = names.slice();
                    const startIndex = reorderedNames.indexOf(startItem);
                    const targetIndex = reorderedNames.indexOf(targetItem);

                    if (startIndex !== -1 && targetIndex !== -1) {
                        reorderedNames.splice(startIndex, 1);
                        reorderedNames.splice(targetIndex, 0, startItem);
                    }

                    const x = scaleX.copy().domain(reorderedNames);
                    const y = scaleY ? scaleY.copy().domain(reorderedNames) : undefined;

                    return { reorderedNames, x, y, dragging };
                }

                return {
                    reorderedNames: names,
                    x: scaleX,
                    y: scaleY,
                    dragging
                };
            },
        });

        Libra.GraphicalTransformer.register(
            "redrawTransformer",
            {
                layer: null,
                redraw({ transformer }) {
                    const result = transformer.getSharedVar("result");
                    const redraw = transformer.getSharedVar("redraw");

                    if (result && redraw) {
                        const { reorderedNames, x, y, dragging } = result;

                        if (reorderedNames && !dragging) {
                            redraw(reorderedNames, x, y);
                        }
                    }
                },
            }
        );
        Libra.GraphicalTransformer.register(
            "copyTransformer",
            {
                layer: null,
                redraw({ transformer, layer }) {
                    const result = transformer.getSharedVar("result");
                    const copyFrom = transformer.getSharedVar("copyFrom");

                    if (result && result.rectSelection && copyFrom) {
                        const finalCopyFromLayer = result.finalCopyFromLayer;


                        if (!finalCopyFromLayer) return;
                            let containerLayer = layer.getLayerFromQueue("copyLayer");



                        const g = d3.select(containerLayer.getGraphic());


                        // 使用 .copy-group 容器来管理复制的元素，避免每次重绘都堆积
                        let copyGroup = g.select(".copy-group");
                        if (copyGroup.empty()) {
                            copyGroup = g.append("g").attr("class", "copy-group");
                        }

                        // 清空旧的复制内容
                        copyGroup.html("");
                        if (!result.dragging) return;

                        // 过滤掉主容器，避免复制整个图表
                        const nodesToCopy = result.rectSelection.filter(node => !d3.select(node).classed("main-group"));

                        // 过滤掉子节点，避免重复复制（例如选中了 group 又选中了 group 内的 line）
                        const selectionSet = new Set(nodesToCopy);
                        const topLevelNodes = nodesToCopy.filter(node => !selectionSet.has(node.parentNode));

                        // 遍历 DOM 元素数组并进行复制
                        topLevelNodes.forEach((node) => {
                            // 使用 cloneNode(true) 进行深拷贝
                            const clone = node.cloneNode(true);
                            // 获取原始 transform (针对 Parallel Coordinate 等基于 transform 定位的图表)
                            const originalTransform = d3.select(node).attr("transform") || "";

                            // 计算来源容器相对于目标容器的坐标偏移
                            let containerOffset = { x: 0, y: 0 };
                            try {
                                const sourceNode = node.parentNode;
                                const targetNode = copyGroup.node();
                                if (sourceNode && targetNode && sourceNode.getScreenCTM && targetNode.getScreenCTM) {
                                    const sourceCTM = sourceNode.getScreenCTM();
                                    const targetCTM = targetNode.getScreenCTM();
                                    // 目标容器的逆矩阵
                                    const targetInverse = targetCTM.inverse();
                                    // 组合矩阵：Source -> Screen -> TargetLocal
                                    const combinedMatrix = targetInverse.multiply(sourceCTM);
                                    
                                    // 矩阵的 e 和 f 分别代表 x 和 y 的平移量
                                    containerOffset.x = combinedMatrix.e;
                                    containerOffset.y = combinedMatrix.f;
                                }
                            } catch (e) {
                                console.warn("Matrix calculation failed", e);
                            }

                            // 可选：添加一些样式区别，例如半透明
                            let transform = "";
                            if (result.direction === "x") {
                                transform = `translate(${result.dx + containerOffset.x}, ${containerOffset.y}) ${originalTransform}`;
                            } else {
                                transform = `translate(${containerOffset.x}, ${result.dy + containerOffset.y}) ${originalTransform}`;
                            }
                            d3.select(clone)
                                .attr("transform", transform) // 应用偏移
                                .style("opacity", 0.5)
                                .style("pointer-events", "none");
                            copyGroup.node().appendChild(clone);
                        });
                    }
                },
            }
        );
        Libra.Instrument.register("ReorderInstrument", {
            constructor: Libra.Instrument,
            interactors: ["MouseTraceInteractor", "TouchTraceInteractor"],
            on: {
                dragstart: [
                    ({ layer, event, instrument }) => {
                        if (event.changedTouches) event = event.changedTouches[0];
                        instrument.services.setSharedVars(
                            {
                                x: event.clientX,
                                y: event.clientY,
                                startx: event.clientX,
                                starty: event.clientY,
                                startOffsetX: event.offsetX,
                                startOffsetY: event.offsetY,
                                currentx: event.clientX,
                                currenty: event.clientY,
                                offsetx: event.offsetX,
                                offsety: event.offsetY,
                                offset: { x: 0, y: 0 },
                                skipPicking: false,
                            },
                            { layer }
                        );
                    },
                ],
                drag: [
                    ({ layer, event, instrument }) => {
                        if (event.changedTouches) event = event.changedTouches[0];
                        const offsetX =
                            event.clientX - instrument.services.getSharedVar("x", { layer })[0];
                        const offsetY =
                            event.clientY - instrument.services.getSharedVar("y", { layer })[0];
                        instrument.setSharedVar("offsetx", offsetX, { layer });
                        instrument.setSharedVar("offsety", offsetY, { layer });
                        instrument.services.setSharedVars(
                            {
                                x: event.clientX,
                                y: event.clientY,
                                currentx: event.clientX,
                                currenty: event.clientY,
                                offsetx: event.offsetX,
                                offsety: event.offsetY,
                                offset: { x: offsetX, y: offsetY },
                                skipPicking: true,
                                dragging: 1,
                            },
                            { layer }
                        );
                    },
                ],
                dragend: [
                    ({ layer, event, instrument }) => {
                        if (event.changedTouches) event = event.changedTouches[0];
                        const offsetX =
                            event.clientX - instrument.services.getSharedVar("x", { layer })[0];
                        const offsetY =
                            event.clientY - instrument.services.getSharedVar("y", { layer })[0];
                        instrument.services.setSharedVars(
                            {
                                x: 0,
                                y: 0,
                                currentx: event.clientX,
                                currenty: event.clientY,
                                endx: event.clientX,
                                endy: event.clientY,
                                offsetx: 0,
                                offsety: 0,
                                offset: { x: 0, y: 0 },
                                skipPicking: true,
                                dragging: 0,
                            },
                            { layer }
                        );
                        instrument.setSharedVar("offsetx", offsetX, { layer });
                        instrument.setSharedVar("offsety", offsetY, { layer });
                    },
                    Libra.Command.initialize("Log", { execute() { } }),
                ],
                dragabort: [
                    (options) => {
                        let { layer, event, instrument } = options;
                        if (event.changedTouches) event = event.changedTouches[0];
                        instrument.services.setSharedVars(
                            {
                                x: 0,
                                y: 0,
                                currentx: event.clientX,
                                currenty: event.clientY,
                                endx: 0,
                                endy: 0,
                                offsetx: 0,
                                offsety: 0,
                                skipPicking: false,
                            },
                            { layer }
                        );
                        instrument.emit("dragconfirm", {
                            ...options,
                            self: options.instrument,
                        });
                    },
                ],
            },
            preAttach: (instrument, layer) => {
                // Create default SM on layer
                instrument.services.add("SurfacePointSelectionService", {
                    layer,
                    // sharedVar: { deepClone: instrument.getSharedVar("deepClone") },
                });
            },
        });
        const buildOptions = {
            inherit: "ReorderInstrument",
            layers: [layer],
            insert: [
                {
                    find: "SelectionService",
                    flow: [
                        {
                            comp: "ReorderService",
                        },
                        {
                            comp: "redrawTransformer",
                        }
                    ],
                }, {
                    find: "SelectionService",
                    flow: [
                        {
                            comp: "copyService",
                        },
                        {
                            comp: "copyTransformer",
                        }
                    ],
                }
            ],
            sharedVar: {
                direction: context.direction,
                copyFrom: context.copyFrom,
                names: context.names,
                scaleX: context.scaleX,
                scaleY: context.scaleY,
                redraw: context.redraw,
                layoutOffset: context.offset || { x: 0, y: 0 },
                offset: context.offset || { x: 0, y: 0 }
            },
        };
        if (context.priority !== undefined) buildOptions.priority = context.priority;
        if (context.Priority !== undefined) buildOptions.priority = context.Priority;
        if (context.stopPropagation !== undefined) buildOptions.stopPropagation = context.stopPropagation;

        Libra.Interaction.build(buildOptions);
    }

    static buildPanInstrument(layer, context) {
        if (!this.checkInput(layer, context)) return;
        const trigger = context.Trigger.toLowerCase();
        if (trigger !== 'pan') return;

        const sharedVar = {};
        if (context.ModifierKey) sharedVar.modifierKey = context.ModifierKey;
        if (context.modifierKey) sharedVar.modifierKey = context.modifierKey;
        if (context.fixRange !== undefined) sharedVar.fixRange = context.fixRange;
        if (context.scaleX) sharedVar.scaleX = context.scaleX;
        if (context.scaleY) sharedVar.scaleY = context.scaleY;

        const buildOptions = {
            inherit: "PanInstrument",
            layers: [layer],
            sharedVar: sharedVar,
        };
        if (context.priority !== undefined) buildOptions.priority = context.priority;
        if (context.Priority !== undefined) buildOptions.priority = context.Priority;
        if (context.stopPropagation !== undefined) buildOptions.stopPropagation = context.stopPropagation;

        Libra.Interaction.build(buildOptions);
    }

    static buildGeometricZoomInstrument(layer, context) {
        if (!this.checkInput(layer, context)) return;
        const trigger = context.Trigger.toLowerCase();
        if (trigger !== 'zoom') return;

        const sharedVar = {};
        if (context.ModifierKey) sharedVar.modifierKey = context.ModifierKey;
        if (context.modifierKey) sharedVar.modifierKey = context.modifierKey;
        if (context.fixRange !== undefined) sharedVar.fixRange = context.fixRange;
        if (context.scaleX) sharedVar.scaleX = context.scaleX;
        if (context.scaleY) sharedVar.scaleY = context.scaleY;

        const buildOptions = {
            inherit: "GeometricZoomInstrument",
            layers: [layer],
            sharedVar: sharedVar,
        };
        if (context.priority !== undefined) buildOptions.priority = context.priority;
        if (context.Priority !== undefined) buildOptions.priority = context.Priority;
        if (context.stopPropagation !== undefined) buildOptions.stopPropagation = context.stopPropagation;

        Libra.Interaction.build(buildOptions);
    }

    static __resolveExcentricBindingKey(layer, context = {}) {
        const layerName = layer?._name || "layer";
        const rawBindingKey =
            context.bindingKey ??
            context.BindingKey ??
            context.instrumentName ??
            context.name;
        if (typeof rawBindingKey === "string" && rawBindingKey.trim()) {
            return `${layerName}::${rawBindingKey.trim()}`;
        }
        return `${layerName}::default`;
    }

    static __ensureExcentricLensState(layer, context = {}) {
        if (!LibraManager.__excentricLensStateMap) {
            LibraManager.__excentricLensStateMap = new Map();
        }

        const stateKey = LibraManager.__resolveExcentricBindingKey(layer, context);
        let state = LibraManager.__excentricLensStateMap.get(stateKey);
        if (!state) {
            state = {
                pinned: false,
                layerX: 0,
                layerY: 0,
                clientX: 0,
                clientY: 0,
                pointerDownX: 0,
                pointerDownY: 0,
                hasPointerDown: false,
                r: Number.isFinite(context.r) ? context.r : 20,
                count: 0,
            };
            LibraManager.__excentricLensStateMap.set(stateKey, state);
        } else if (Number.isFinite(context.r) && !state.pinned) {
            state.r = context.r;
        }

        return { stateKey, state };
    }

    static __dispatchExcentricLensRefresh(layer, state) {
        if (!layer || !state || !Number.isFinite(state.clientX) || !Number.isFinite(state.clientY)) {
            return;
        }
        const graphic = layer.getGraphic ? layer.getGraphic() : null;
        if (!graphic || typeof graphic.dispatchEvent !== "function") return;
        graphic.dispatchEvent(
            new MouseEvent("mousemove", {
                bubbles: true,
                clientX: state.clientX,
                clientY: state.clientY,
            })
        );
    }

    static buildExcentricLabelingInstrument(layer, context = {}) {
        if (!layer) return;
        const { stateKey, state } = LibraManager.__ensureExcentricLensState(layer, context);

        if (!LibraManager.__excentricLabelingInstrumentRegistered) {
            Libra.Interaction.build({
                inherit: "HoverInstrument",
                name: "ExcentricLabelingInstrument",
                sharedVar: {
                    renderSelection: false,
                    r: 20,
                    stroke: "green",
                    strokeWidth: 2,
                    countLabelDistance: 20,
                    fontSize: 12,
                    countLabelWidth: 40,
                    maxLabelsNum: 10,
                    labelAccessor: (circleElem) => d3.select(circleElem).datum()?.Name,
                    colorAccessor: () => "black",
                    modifierKey: "Shift",
                },
                override: [
                    {
                        find: "SelectionService",
                        comp: "CircleSelectionService",
                    },
                ],
                insert: [
                    {
                        find: "CircleSelectionService",
                        flow: [
                            {
                                comp: "ExcentricLabelingLayoutService",
                                resultAlias: "result",
                                evaluate({
                                    labelAccessor,
                                    colorAccessor,
                                    r,
                                    maxLabelsNum,
                                    event,
                                    layer,
                                    lensState,
                                    result: circles,
                                }) {
                                    const pinned =
                                        lensState &&
                                        lensState.pinned &&
                                        Number.isFinite(lensState.layerX) &&
                                        Number.isFinite(lensState.layerY);
                                    if (!event && !pinned) {
                                        if (lensState) lensState.count = 0;
                                        return [];
                                    }

                                    let layerX = 0;
                                    let layerY = 0;
                                    if (pinned) {
                                        layerX = lensState.layerX;
                                        layerY = lensState.layerY;
                                    } else {
                                        [layerX, layerY] = d3.pointer(event, layer.getGraphic());
                                    }
                                    const lensRadius =
                                        lensState && Number.isFinite(lensState.r) ? lensState.r : r;
                                    const rootBBox = layer.getContainerGraphic().getBoundingClientRect();
                                    const layerBBox =
                                        layer.getGraphic().transform.baseVal.consolidate()?.matrix ?? {
                                            a: 0,
                                            b: 0,
                                            c: 0,
                                            d: 0,
                                            e: 0,
                                            f: 0,
                                        };

                                    function getRawInfos(
                                        objs,
                                        labelAccessorInner,
                                        colorAccessorInner,
                                        center,
                                        radius
                                    ) {
                                        const radiusSquare = radius * radius;
                                        const rawInfos = [];
                                        objs.forEach((obj) => {
                                            const screenElem = obj?.__libra__screenElement || obj;
                                            if (
                                                !screenElem ||
                                                typeof screenElem.getBoundingClientRect !== "function"
                                            ) {
                                                return;
                                            }
                                            const bbox = screenElem.getBoundingClientRect();
                                            const x =
                                                bbox.x + (bbox.width >> 1) - rootBBox.x - layerBBox.e;
                                            const y =
                                                bbox.y + (bbox.height >> 1) - rootBBox.y - layerBBox.f;
                                            const dx = x - center.x;
                                            const dy = y - center.y;
                                            if (dx * dx + dy * dy > radiusSquare) return;
                                            const labelName = labelAccessorInner(screenElem);
                                            if (labelName === undefined || labelName === null || labelName === "") {
                                                return;
                                            }
                                            const color = colorAccessorInner(screenElem);
                                            rawInfos.push({
                                                x,
                                                y,
                                                labelWidth: 0,
                                                labelHeight: 0,
                                                color,
                                                labelName,
                                            });
                                        });
                                        return rawInfos;
                                    }

                                    function computeSizeOfLabels(rawInfos, root) {
                                        const tempInfoAttr = "labelText";
                                        const tempClass = "temp" + String(new Date().getMilliseconds());
                                        const tempMountPoint = root.append("svg:g").attr("class", tempClass);
                                        rawInfos.forEach(
                                            (rawInfo) =>
                                                (rawInfo[tempInfoAttr] = tempMountPoint
                                                    .append("text")
                                                    .attr("opacity", "0")
                                                    .attr("x", -Number.MAX_SAFE_INTEGER)
                                                    .attr("y", -Number.MAX_SAFE_INTEGER)
                                                    .text(rawInfo.labelName)
                                                    .node())
                                        );
                                        root.node().appendChild(tempMountPoint.node());
                                        rawInfos.forEach((rawInfo) => {
                                            const labelBBox = rawInfo[tempInfoAttr].getBBox();
                                            rawInfo.labelWidth = labelBBox.width;
                                            rawInfo.labelHeight = 21;
                                        });
                                        root.select("." + tempClass).remove();
                                        rawInfos.forEach((rawInfo) => delete rawInfo[tempInfoAttr]);
                                    }

                                    const sourceObjects = pinned
                                        ? layer.getVisualElements()
                                        : Array.isArray(circles)
                                          ? circles
                                          : [];
                                    const rawInfos = getRawInfos(
                                        sourceObjects,
                                        labelAccessor,
                                        colorAccessor,
                                        { x: layerX, y: layerY },
                                        lensRadius
                                    );
                                    if (lensState) lensState.count = rawInfos.length;
                                    if (!rawInfos.length) return [];
                                    computeSizeOfLabels(rawInfos, d3.select(layer.getGraphic()));

                                    const compute = excentricLabeling()
                                        .radius(lensRadius)
                                        .horizontallyCoherent(true)
                                        .maxLabelsNum(maxLabelsNum);
                                    const result = compute(rawInfos, layerX, layerY);
                                    return result;
                                },
                            },
                            (layer) => ({
                                comp: "DrawLabelTransformer",
                                layer: layer.getLayerFromQueue("LabelLayer"),
                                sharedVar: {
                                    result: [],
                                },
                                redraw({ layer, transformer }) {
                                    function renderLines(root, result) {
                                        const lineGroup = root.append("g").attr("class", "exentric-labeling-line");
                                        const lineGenerator = d3
                                            .line()
                                            .x((d) => d.x)
                                            .y((d) => d.y);
                                        lineGroup
                                            .selectAll("path")
                                            .data(result)
                                            .join("path")
                                            .attr("fill", "none")
                                            .attr("stroke", (layoutInfo) => layoutInfo.rawInfo.color)
                                            .attr("d", (layoutInfo) => lineGenerator(layoutInfo.controlPoints));
                                    }

                                    function renderBBoxs(root, result) {
                                        const bboxGroup = root.append("g").attr("class", "exentric-labeling-bbox");
                                        bboxGroup
                                            .selectAll("rect")
                                            .data(result)
                                            .join("rect")
                                            .attr("class", "labelBBox")
                                            .attr("fill", "none")
                                            .attr("stroke", (layoutInfo) => layoutInfo.rawInfo.color)
                                            .attr("x", (layoutInfo) => layoutInfo.labelBBox.x)
                                            .attr("y", (layoutInfo) => layoutInfo.labelBBox.y)
                                            .attr("width", (layoutInfo) => layoutInfo.labelBBox.width)
                                            .attr("height", (layoutInfo) => layoutInfo.labelBBox.height);
                                    }

                                    function renderTexts(root, result) {
                                        const textGroup = root.append("g").attr("class", "exentric-labeling-text");
                                        textGroup
                                            .selectAll("text")
                                            .data(result)
                                            .join("text")
                                            .attr("x", (d) => d.labelBBox.x + d.labelBBox.width / 2)
                                            .attr("y", (d) => d.labelBBox.y + d.labelBBox.height / 2 + 4)
                                            .attr("text-anchor", "middle")
                                            .text((d) => d.rawInfo.labelName)
                                            .attr("fill", "black")
                                            .attr("font-size", "12px");
                                    }

                                    layer.setLayersOrder({ selectionLayer: 1 });

                                    const result = transformer.getSharedVar("result");
                                    const root = d3.select(layer.getGraphic());
                                    root.selectAll("*").remove();
                                    if (result && result.length > 0) {
                                        renderLines(root, result);
                                        renderBBoxs(root, result);
                                        renderTexts(root, result);
                                    }
                                    layer.postUpdate();
                                },
                            }),
                        ],
                    },
                    {
                        find: "CircleSelectionService",
                        flow: [
                            {
                                comp: "AggregateService",
                                resultAlias: "count",
                                sharedVar: {
                                    ops: ["count"],
                                },
                            },
                            (layer) => ({
                                comp: "DrawTextTransformer",
                                layer: layer.getLayerFromQueue("LensLayer"),
                                sharedVar: {
                                    x: 0,
                                    y: 0,
                                    count: 0,
                                },
                                redraw({ layer, transformer }) {
                                    const lensState = transformer.getSharedVar("lensState");
                                    const pinned =
                                        lensState &&
                                        lensState.pinned &&
                                        Number.isFinite(lensState.layerX) &&
                                        Number.isFinite(lensState.layerY);
                                    const cx = pinned
                                        ? lensState.layerX
                                        : transformer.getSharedVar("x") -
                                          layer
                                              .getLayerFromQueue("mainLayer")
                                              .getGraphic()
                                              .getBoundingClientRect().left;
                                    const cy = pinned
                                        ? lensState.layerY
                                        : transformer.getSharedVar("y") -
                                          layer
                                              .getLayerFromQueue("mainLayer")
                                              .getGraphic()
                                              .getBoundingClientRect().top;
                                    const opacity = 1;
                                    const lensRadius =
                                        lensState && Number.isFinite(lensState.r)
                                            ? lensState.r
                                            : transformer.getSharedVar("r");
                                    const stroke = transformer.getSharedVar("stroke");
                                    const strokeWidth = transformer.getSharedVar("strokeWidth");
                                    const count = transformer.getSharedVar("count");
                                    const displayCount =
                                        lensState && Number.isFinite(lensState.count)
                                            ? lensState.count
                                            : count;
                                    const countLabelDistance = transformer.getSharedVar("countLabelDistance");
                                    const fontSize = transformer.getSharedVar("fontSize");
                                    const countLabelWidth = transformer.getSharedVar("countLabelWidth");

                                    const root = d3.select(layer.getGraphic());
                                    root.selectAll("*").remove();

                                    const group = root
                                        .append("g")
                                        .attr("opacity", opacity)
                                        .attr("transform", `translate(${cx}, ${cy})`);

                                    group
                                        .append("circle")
                                        .attr("class", "lensCircle")
                                        .attr("cx", 0)
                                        .attr("r", lensRadius)
                                        .attr("fill", "none")
                                        .attr("stroke", stroke)
                                        .attr("stroke-width", strokeWidth);
                                    const countLabel = group
                                        .append("text")
                                        .attr("y", -(countLabelDistance + lensRadius))
                                        .attr("font-size", fontSize)
                                        .attr("text-anchor", "middle")
                                        .attr("fill", stroke)
                                        .text(displayCount);
                                    const countLabelBBox = countLabel.node().getBBox();
                                    group
                                        .append("rect")
                                        .attr("class", "lensLabelBorder")
                                        .attr("stroke", stroke)
                                        .attr("stroke-width", strokeWidth)
                                        .attr("fill", "none")
                                        .attr("x", (-countLabelWidth) >> 1)
                                        .attr("y", countLabelBBox.y)
                                        .attr("width", countLabelWidth)
                                        .attr("height", countLabelBBox.height);
                                    group
                                        .append("line")
                                        .attr("stroke", stroke)
                                        .attr("stroke-width", strokeWidth)
                                        .attr("y1", -lensRadius)
                                        .attr("y2", countLabelBBox.y + countLabelBBox.height);
                                },
                            }),
                        ],
                    },
                ],
            });
            LibraManager.__excentricLabelingInstrumentRegistered = true;
        }

        const sharedVar = {};
        if (context.labelAccessor) sharedVar.labelAccessor = context.labelAccessor;
        if (context.colorAccessor) sharedVar.colorAccessor = context.colorAccessor;
        if (context.modifierKey !== undefined) sharedVar.modifierKey = context.modifierKey;
        if (context.renderSelection !== undefined) sharedVar.renderSelection = context.renderSelection;
        if (context.r !== undefined) sharedVar.r = context.r;
        if (context.stroke !== undefined) sharedVar.stroke = context.stroke;
        if (context.strokeWidth !== undefined) sharedVar.strokeWidth = context.strokeWidth;
        if (context.countLabelDistance !== undefined)
            sharedVar.countLabelDistance = context.countLabelDistance;
        if (context.fontSize !== undefined) sharedVar.fontSize = context.fontSize;
        if (context.countLabelWidth !== undefined) sharedVar.countLabelWidth = context.countLabelWidth;
        if (context.maxLabelsNum !== undefined) sharedVar.maxLabelsNum = context.maxLabelsNum;
        sharedVar.lensState = state;

        const buildOptions = {
            inherit: "ExcentricLabelingInstrument",
            layers: [layer],
            sharedVar,
        };
        if (context.priority !== undefined) buildOptions.priority = context.priority;
        if (context.stopPropagation !== undefined) buildOptions.stopPropagation = context.stopPropagation;
        Libra.Interaction.build(buildOptions);

        const labelsLayer = layer.getLayerFromQueue("LabelLayer");
        if (labelsLayer) {
            const labelHoverBuildOptions = {
                inherit: "HoverInstrument",
                layers: [{ layer: labelsLayer, options: { pointerEvents: "viewPort" } }],
                sharedVar: {
                    highlightAttrValues:
                        context.labelHoverHighlightAttrValues ||
                        context.labelHoverHighlight ||
                        {
                            stroke: "#ff0000",
                            "stroke-width": 2,
                        },
                },
            };
            Libra.Interaction.build(labelHoverBuildOptions);
        }
        return stateKey;
    }

    static buildExcentricLabelingClickInstrument(layer, context = {}) {
        if (!layer) return;
        const { stateKey, state } = LibraManager.__ensureExcentricLensState(layer, context);
        const pinThreshold = Number.isFinite(context.pinThreshold) ? context.pinThreshold : 2;
        const togglePin = !!context.togglePin;

        const pickPointerEvent = (event) => {
            if (event && event.changedTouches && event.changedTouches[0]) return event.changedTouches[0];
            return event;
        };

        const onPointerDown = ({ event }) => {
            const pointer = pickPointerEvent(event);
            if (!pointer) return;
            state.pointerDownX = pointer.clientX;
            state.pointerDownY = pointer.clientY;
            state.hasPointerDown = true;
        };

        const onPointerUp = ({ event, layer: activeLayer }) => {
            const pointer = pickPointerEvent(event);
            if (!pointer || !state.hasPointerDown) return;
            state.hasPointerDown = false;

            const deltaX = pointer.clientX - state.pointerDownX;
            const deltaY = pointer.clientY - state.pointerDownY;
            if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > pinThreshold) return;

            const [layerX, layerY] = d3.pointer(pointer, activeLayer.getGraphic());
            if (togglePin && state.pinned) {
                const pinnedDx = layerX - state.layerX;
                const pinnedDy = layerY - state.layerY;
                if (Math.sqrt(pinnedDx * pinnedDx + pinnedDy * pinnedDy) <= pinThreshold) {
                    state.pinned = false;
                    LibraManager.__dispatchExcentricLensRefresh(activeLayer, state);
                    return;
                }
            }

            state.pinned = true;
            state.layerX = layerX;
            state.layerY = layerY;
            state.clientX = pointer.clientX;
            state.clientY = pointer.clientY;
            LibraManager.__dispatchExcentricLensRefresh(activeLayer, state);
        };

        const onPointerAbort = ({ event, layer: activeLayer }) => {
            const pointer = pickPointerEvent(event);
            if (event && typeof event.preventDefault === "function") event.preventDefault();
            state.hasPointerDown = false;
            state.pinned = false;
            if (pointer && Number.isFinite(pointer.clientX) && Number.isFinite(pointer.clientY)) {
                state.clientX = pointer.clientX;
                state.clientY = pointer.clientY;
            }
            LibraManager.__dispatchExcentricLensRefresh(activeLayer, state);
        };

        const mouseTraceActions = [
            {
                action: "dragabort",
                events: ["mousedown[event.button==2]", "mouseup[event.button==2]"],
                transition: [["start", "start"], ["drag", "start"]],
                sideEffect: onPointerAbort,
            },
            {
                action: "dragstart",
                events: ["mousedown"],
                transition: [["start", "drag"]],
                sideEffect: onPointerDown,
            },
            {
                action: "drag",
                events: ["mousemove"],
                transition: [["drag", "drag"]],
            },
            {
                action: "dragend",
                events: ["mouseup[event.button==0]"],
                transition: [["drag", "start"]],
                sideEffect: onPointerUp,
            },
        ];

        const touchTraceActions = [
            {
                action: "dragstart",
                events: ["touchstart"],
                transition: [["start", "drag"]],
                sideEffect: onPointerDown,
            },
            {
                action: "drag",
                events: ["touchmove"],
                transition: [["drag", "drag"]],
            },
            {
                action: "dragend",
                events: ["touchend"],
                transition: [["drag", "start"]],
                sideEffect: onPointerUp,
            },
        ];

        const sharedVar = {};
        if (context.modifierKey !== undefined) sharedVar.modifierKey = context.modifierKey;
        const buildOptions = {
            inherit: "ClickInstrument",
            layers: [layer],
            sharedVar,
            override: [
                { find: "MouseTraceInteractor", actions: mouseTraceActions },
                { find: "TouchTraceInteractor", actions: touchTraceActions },
            ],
        };
        if (context.priority !== undefined) buildOptions.priority = context.priority;
        if (context.Priority !== undefined) buildOptions.priority = context.Priority;
        if (context.stopPropagation !== undefined) buildOptions.stopPropagation = context.stopPropagation;
        Libra.Interaction.build(buildOptions);
        return stateKey;
    }

    static buildExcentricLabelingZoomInstrument(layer, context = {}) {
        if (!layer) return;
        const { stateKey, state } = LibraManager.__ensureExcentricLensState(layer, context);
        const minRadius =
            Number.isFinite(context.minR) ? context.minR : Number.isFinite(context.minRadius) ? context.minRadius : 8;
        const maxRadius =
            Number.isFinite(context.maxR) ? context.maxR : Number.isFinite(context.maxRadius) ? context.maxRadius : 120;
        const radiusStep =
            Number.isFinite(context.step)
                ? context.step
                : Number.isFinite(context.radiusStep)
                  ? context.radiusStep
                  : 2;

        const mouseWheelActions = [
            {
                action: "enter",
                events: ["mouseenter"],
                transition: [["start", "running"]],
            },
            {
                action: "wheel",
                events: ["wheel", "mousewheel"],
                transition: [["start", "running"], ["running", "running"]],
                sideEffect: ({ event, layer: activeLayer }) => {
                    if (!state.pinned) return;
                    if (event && typeof event.preventDefault === "function") event.preventDefault();
                    const rawDelta =
                        typeof event.deltaY === "number"
                            ? event.deltaY
                            : typeof event.wheelDelta === "number"
                              ? -event.wheelDelta
                              : 0;
                    if (!rawDelta) return;
                    const direction = rawDelta < 0 ? 1 : -1;
                    const nextRadius = Math.max(
                        minRadius,
                        Math.min(maxRadius, state.r + direction * radiusStep)
                    );
                    if (nextRadius === state.r) return;
                    state.r = nextRadius;
                    LibraManager.__dispatchExcentricLensRefresh(activeLayer, state);
                },
            },
            {
                action: "leave",
                events: ["mouseleave"],
                transition: [["running", "start"], ["start", "start"]],
            },
            {
                action: "abort",
                events: ["mouseup[event.button==2]"],
                transition: [["running", "running"], ["start", "start"]],
            },
        ];

        const sharedVar = {};
        if (context.modifierKey !== undefined) sharedVar.modifierKey = context.modifierKey;
        const buildOptions = {
            inherit: "GeometricZoomInstrument",
            layers: [layer],
            sharedVar,
            override: [{ find: "MouseWheelInteractor", actions: mouseWheelActions }],
        };
        if (context.priority !== undefined) buildOptions.priority = context.priority;
        if (context.Priority !== undefined) buildOptions.priority = context.Priority;
        if (context.stopPropagation !== undefined) buildOptions.stopPropagation = context.stopPropagation;
        Libra.Interaction.build(buildOptions);
        return stateKey;
    }

    static buildGeometricTransformer(layer, context) {
        if (!layer) return;
        if (!context || typeof context.redraw !== 'function') return;

        const name = "GeometricTransformer_" + Math.random().toString(36).substr(2, 9);

        Libra.GraphicalTransformer.register(name, {
            sharedVar: {
                scaleX: context.scaleX,
                scaleY: context.scaleY,
            },
            redraw({ transformer }) {
                const sX = transformer.getSharedVar("scaleX");
                const sY = transformer.getSharedVar("scaleY");
                context.redraw(sX, sY);
            },
        });

        return Libra.GraphicalTransformer.initialize(name, {
            layer: layer,
        });
    }
}
