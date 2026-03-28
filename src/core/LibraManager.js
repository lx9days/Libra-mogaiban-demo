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
    static updateLinkSelection(layer) {
        if (!layer || !Libra.GraphicalTransformer.findTransformerByLayer) return;
        const transformers = Libra.GraphicalTransformer.findTransformerByLayer(layer);
        const hub = transformers.find(t => typeof t?.isInstanceOf === "function" && t.isInstanceOf("LinkSelectionHubTransformer"));
        if (hub && typeof hub.redraw === "function") {
            hub.redraw();
        }
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

        // Extract feedbackOptions
        const feedback = context.feedbackOptions || context["Feedback options"] || {};

        if (context.ModifierKey) sharedVar.modifierKey = context.ModifierKey;
        if (context.modifierKey) sharedVar.modifierKey = context.modifierKey;
        
        // Handle HighlightColor from context or feedbackOptions
        if (feedback.Highlight) sharedVar.highlightColor = feedback.Highlight;
        else if (context.HighlightColor) sharedVar.highlightColor = context.HighlightColor;
        
        if (context.highlightAttrValues) sharedVar.highlightAttrValues = context.highlightAttrValues;
        
        if (context.Tooltip) {
            sharedVar.tooltip = {
                prefix: context.Tooltip.Prefix,
                fields: context.Tooltip.Fields,
            };
        }

        // Handle LinkLayers from context or feedbackOptions
        if (feedback.LinkLayers) sharedVar.linkLayers = feedback.LinkLayers;
        else if (context.LinkLayers) sharedVar.linkLayers = context.LinkLayers;
        else if (context.linkLayers) sharedVar.linkLayers = context.linkLayers;
        
        if (context.linkTo) sharedVar.linkTo = context.linkTo;
        if (context.SelectionMode) sharedVar.selectionMode = context.SelectionMode.toLowerCase();
        
        // Handle axisDirection from context or infer from trigger
        if (context.axisDirection) {
            sharedVar.axisDirection = context.axisDirection.toLowerCase();
        } else if (trigger === 'brushx') {
            sharedVar.axisDirection = 'x';
        } else if (trigger === 'brushy') {
            sharedVar.axisDirection = 'y';
        }

        if (context.dimension) sharedVar.dimension = context.dimension;
        
        // Handle scale from context or feedbackOptions
        if (feedback.Scale) sharedVar.scale = feedback.Scale;
        else if (context.scale) sharedVar.scale = context.scale;
        
        // Handle AttrName/dimension from feedbackOptions if not present
        if (!sharedVar.dimension && feedback.AttrName) {
            sharedVar.dimension = feedback.AttrName;
        }

        // Generate a selectionId for cross-filtering
        if (sharedVar.dimension) {
            sharedVar.selectionId = sharedVar.dimension;
        } else if (sharedVar.axisDirection) {
            sharedVar.selectionId = sharedVar.axisDirection;
        } else {
            sharedVar.selectionId = triggerPascal.replace('Brush', '').toLowerCase();
        }

        if (context.BaseOpacity !== undefined) sharedVar.baseOpacity = context.BaseOpacity;
        if (context.baseOpacity !== undefined) sharedVar.baseOpacity = context.baseOpacity;

        Libra.Service.register("LinkRectSelectionService", {
            sharedVar: sharedVar,
            evaluate({ layer, self }) {
                let linkTo = self.getSharedVar("linkTo");
                const linkLayers = self.getSharedVar("linkLayers");
                if (!linkTo && Array.isArray(linkLayers) && linkLayers.length > 0) {
                    linkTo = linkLayers[0];
                }

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
                
                if (x === undefined) x = 0;
                if (y === undefined) y = 0;
                if (width === undefined) width = linkTo.getBBox().width;
                if (height === undefined) height = linkTo.getBBox().height;

                const dimension = self.getSharedVar("dimension");
                const scale = self.getSharedVar("scale");
                const selectionId = self.getSharedVar("selectionId");

                if (dimension && scale && selectionId && Libra.helpers && typeof Libra.helpers.setLinkSelectionPredicate === "function") {
                    if (width > 0 && height > 0) {
                        let minVal, maxVal;
                        
                        if (typeof scale.invert === "function") {
                            if (axisDirection === 'x') {
                                minVal = scale.invert(x);
                                maxVal = scale.invert(x + width);
                            } else {
                                minVal = scale.invert(y);
                                maxVal = scale.invert(y + height);
                            }

                            if (minVal > maxVal) [minVal, maxVal] = [maxVal, minVal];

                            // Check if values are valid numbers
                            if (!isNaN(minVal) && !isNaN(maxVal)) {
                                const predicate = {
                                    [dimension]: [minVal, maxVal]
                                };
                                Libra.helpers.setLinkSelectionPredicate(selectionId, predicate);
                            }
                        }
                    } else {
                        Libra.helpers.setLinkSelectionPredicate(selectionId, null);
                    }
                }

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
                        const width = Math.abs(currentOffsetX - startoffsetx); 

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

                // Initialize LinkSelectionHubTransformer on the linked layer
                const linkTo = instrument.getSharedVar("linkTo");
                const linkLayers = instrument.getSharedVar("linkLayers");
                const targets = [];
                if (linkTo) targets.push(linkTo);
                if (Array.isArray(linkLayers)) targets.push(...linkLayers);

                targets.forEach(targetLayer => {
                    if (targetLayer && Libra.GraphicalTransformer.findTransformerByLayer) {
                        const existingTransformers = Libra.GraphicalTransformer.findTransformerByLayer(targetLayer);
                        const hasHub = existingTransformers.some(t => typeof t?.isInstanceOf === "function" && t.isInstanceOf("LinkSelectionHubTransformer"));
                        
                        if (!hasHub) {
                            Libra.GraphicalTransformer.initialize("LinkSelectionHubTransformer", {
                                layer: targetLayer,
                                sharedVar: {
                                    highlightColor: instrument.getSharedVar("highlightColor"),
                                    highlightAttrValues: instrument.getSharedVar("highlightAttrValues"),
                                    tooltip: instrument.getSharedVar("tooltip"),
                                }
                            });
                        }
                    }
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
                        // console.log(layer);
                        if (event.changedTouches) event = event.changedTouches[0];

                        const starty = instrument.getSharedVar("starty");
                        const startoffsety = instrument.getSharedVar("startoffsety");
                        const [currentOffsetX, currentOffsetY] = d3.pointer(event, layer.getGraphic());

                        const y = Math.min(starty, event.clientY);
                        const offsety = Math.min(startoffsety, currentOffsetY);
                        const height = Math.abs(currentOffsetY - startoffsety);

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

                // Initialize LinkSelectionHubTransformer on the linked layer
                const linkTo = instrument.getSharedVar("linkTo");
                const linkLayers = instrument.getSharedVar("linkLayers");
                const targets = [];
                if (linkTo) targets.push(linkTo);
                if (Array.isArray(linkLayers)) targets.push(...linkLayers);

                targets.forEach(targetLayer => {
                    if (targetLayer && Libra.GraphicalTransformer.findTransformerByLayer) {
                        const existingTransformers = Libra.GraphicalTransformer.findTransformerByLayer(targetLayer);
                        const hasHub = existingTransformers.some(t => typeof t?.isInstanceOf === "function" && t.isInstanceOf("LinkSelectionHubTransformer"));
                        
                        if (!hasHub) {
                            Libra.GraphicalTransformer.initialize("LinkSelectionHubTransformer", {
                                layer: targetLayer,
                                sharedVar: {
                                    highlightColor: instrument.getSharedVar("highlightColor"),
                                    highlightAttrValues: instrument.getSharedVar("highlightAttrValues"),
                                    tooltip: instrument.getSharedVar("tooltip"),
                                }
                            });
                        }
                    }
                });
            },
        });


        const buildOptions = {
            inherit: `Link${triggerPascal}Instrument`,
            layers: [layer],
            sharedVar: sharedVar,
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
        const syntheticEvent = typeof context?.syntheticEvent === "string" ? String(context.syntheticEvent).toLowerCase() : undefined;
        const gestureMoveDelay = Number.isFinite(context?.gestureMoveDelay) ? Number(context.gestureMoveDelay) : undefined;
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
                offset: context.offset || { x: 0, y: 0 },
                syntheticEvent: syntheticEvent,
                gestureMoveDelay: gestureMoveDelay
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
                clientX: 0,
                clientY: 0,
                shiftKey: false,
                ctrlKey: false,
                altKey: false,
                metaKey: false,
                r: Number.isFinite(context.r) ? context.r : 20,
                count: 0,
                countValue: 0,
                countText: null,
            };
            LibraManager.__excentricLensStateMap.set(stateKey, state);
        } else if (Number.isFinite(context.r)) {
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
                shiftKey: !!state.shiftKey,
                ctrlKey: !!state.ctrlKey,
                altKey: !!state.altKey,
                metaKey: !!state.metaKey,
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
                    count: null,
                    countAccessor: null,
                    countFormatter: null,
                    filter: null,
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
                                    count,
                                    countAccessor,
                                    countFormatter,
                                    filter,
                                    event,
                                    layer,
                                    lensState,
                                    result: circles,
                                }) {
                                    const pointerEvent =
                                        event && event.changedTouches && event.changedTouches[0]
                                            ? event.changedTouches[0]
                                            : event;
                                    if (lensState && pointerEvent) {
                                        if (
                                            Number.isFinite(pointerEvent.clientX) &&
                                            Number.isFinite(pointerEvent.clientY)
                                        ) {
                                            lensState.clientX = pointerEvent.clientX;
                                            lensState.clientY = pointerEvent.clientY;
                                        }
                                        lensState.shiftKey = !!pointerEvent.shiftKey;
                                        lensState.ctrlKey = !!pointerEvent.ctrlKey;
                                        lensState.altKey = !!pointerEvent.altKey;
                                        lensState.metaKey = !!pointerEvent.metaKey;
                                    }
                                    if (!event) {
                                        if (lensState) {
                                            lensState.count = 0;
                                            lensState.countValue = 0;
                                            lensState.countText = null;
                                            if (lensState.previouslyFilteredElements) {
                                                lensState.previouslyFilteredElements.forEach((elem) => {
                                                    d3.select(elem).style("opacity", null);
                                                });
                                                lensState.previouslyFilteredElements = [];
                                            }
                                        }
                                        return [];
                                    }

                                    const [layerX, layerY] = d3.pointer(event, layer.getGraphic());
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

                                    function getElementsInRadius(objs, center, radius) {
                                        const radiusSquare = radius * radius;
                                        const result = [];
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
                                            result.push(screenElem);
                                        });
                                        return result;
                                    }

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

                                    const sourceObjects = (() => {
                                        if (
                                            pointerEvent &&
                                            typeof layer?.picking === "function" &&
                                            Number.isFinite(pointerEvent.clientX) &&
                                            Number.isFinite(pointerEvent.clientY)
                                        ) {
                                            return (
                                                layer.picking({
                                                    baseOn: 0,
                                                    type: 2,
                                                    x: pointerEvent.clientX,
                                                    y: pointerEvent.clientY,
                                                    r: lensRadius,
                                                }) || []
                                            );
                                        }
                                        return Array.isArray(circles) ? circles : [];
                                    })();
                                    const elementsInRadius = getElementsInRadius(
                                        sourceObjects,
                                        { x: layerX, y: layerY },
                                        lensRadius
                                    );
                                    
                                    if (lensState) {
                                        if (lensState.previouslyFilteredElements) {
                                            lensState.previouslyFilteredElements.forEach((elem) => {
                                                d3.select(elem).style("opacity", null);
                                            });
                                        }
                                        lensState.previouslyFilteredElements = [];
                                    }

                                    if (typeof filter === "function") {
                                        elementsInRadius.forEach((obj) => {
                                            const screenElem = obj?.__libra__screenElement || obj;
                                            if (screenElem && !filter(screenElem)) {
                                                d3.select(screenElem).style("opacity", 0.1);
                                                if (lensState) {
                                                    lensState.previouslyFilteredElements.push(screenElem);
                                                }
                                            }
                                        });
                                    }

                                    if (lensState) {
                                        lensState.count = elementsInRadius.length;
                                        const baseCtx = {
                                            count: lensState.count,
                                            elements: elementsInRadius,
                                            event: pointerEvent,
                                            layer,
                                            radius: lensRadius,
                                        };

                                        const getAccessorFromConfig = (cfg) => {
                                            const accessor = cfg?.accessor ?? cfg?.Accessor;
                                            if (typeof accessor === "function") return accessor;
                                            const field = cfg?.field ?? cfg?.Field;
                                            if (typeof field === "string" && field) {
                                                return (elem) => d3.select(elem).datum()?.[field];
                                            }
                                            return null;
                                        };

                                        const computeFromValues = (values, opRaw) => {
                                            const op = typeof opRaw === "string" ? opRaw.trim().toLowerCase() : "";
                                            if (op === "count") return values.length;
                                            if (!values.length) return 0;
                                            if (op === "sum") return d3.sum(values);
                                            if (op === "min") return d3.min(values) ?? 0;
                                            if (op === "max") return d3.max(values) ?? 0;
                                            if (op === "mean" || op === "avg" || op === "average") return d3.mean(values) ?? 0;
                                            if (op === "median") return d3.median(values) ?? 0;
                                            if (op === "q1" || op === "p25") {
                                                const sorted = values.slice().sort((a, b) => a - b);
                                                return d3.quantileSorted(sorted, 0.25) ?? 0;
                                            }
                                            if (op === "q3" || op === "p75") {
                                                const sorted = values.slice().sort((a, b) => a - b);
                                                return d3.quantileSorted(sorted, 0.75) ?? 0;
                                            }
                                            if (op === "iqr") {
                                                const sorted = values.slice().sort((a, b) => a - b);
                                                const q1 = d3.quantileSorted(sorted, 0.25) ?? 0;
                                                const q3 = d3.quantileSorted(sorted, 0.75) ?? 0;
                                                return q3 - q1;
                                            }
                                            return d3.sum(values);
                                        };

                                        const applyFormatter = (value, formatter) => {
                                            if (typeof formatter === "function") {
                                                try {
                                                    const formatted = formatter(value, baseCtx);
                                                    if (formatted !== undefined && formatted !== null) return String(formatted);
                                                } catch (e) {
                                                    return null;
                                                }
                                                return null;
                                            }
                                            if (typeof formatter === "string" && formatter) {
                                                try {
                                                    return d3.format(formatter)(value);
                                                } catch (e) {
                                                    return null;
                                                }
                                            }
                                            return null;
                                        };

                                        let countValue = lensState.count;
                                        let countText = null;

                                        if (typeof count === "function") {
                                            try {
                                                const res = count(elementsInRadius, baseCtx);
                                                if (typeof res === "string") {
                                                    countText = res;
                                                } else if (typeof res === "number" && Number.isFinite(res)) {
                                                    countValue = res;
                                                } else if (res && typeof res === "object") {
                                                    const v = res.value ?? res.Value;
                                                    const t = res.text ?? res.Text;
                                                    if (typeof v === "number" && Number.isFinite(v)) countValue = v;
                                                    if (typeof t === "string") countText = t;
                                                }
                                            } catch (e) {
                                                countText = null;
                                            }
                                        } else if (count && typeof count === "object") {
                                            const cfg = count;
                                            const aggregate = cfg?.aggregate ?? cfg?.Aggregate;
                                            const op = cfg?.op ?? cfg?.Op ?? cfg?.operator ?? cfg?.Operator;
                                            const formatter =
                                                cfg?.formatter ?? cfg?.Formatter ?? cfg?.format ?? cfg?.Format ?? null;
                                            const accessor = getAccessorFromConfig(cfg);
                                            if (typeof aggregate === "function") {
                                                try {
                                                    const v = aggregate(elementsInRadius, baseCtx);
                                                    if (typeof v === "number" && Number.isFinite(v)) countValue = v;
                                                } catch (e) {
                                                    countText = null;
                                                }
                                            } else {
                                                const values =
                                                    typeof accessor === "function"
                                                        ? elementsInRadius
                                                              .map((elem) => Number(accessor(elem)))
                                                              .filter((v) => Number.isFinite(v))
                                                        : [];
                                                if (
                                                    typeof op === "string" &&
                                                    op.trim().toLowerCase() === "count" &&
                                                    !accessor
                                                ) {
                                                    countValue = elementsInRadius.length;
                                                } else if (accessor) {
                                                    countValue = computeFromValues(values, op);
                                                } else {
                                                    countValue = elementsInRadius.length;
                                                }
                                            }
                                            const formatted = applyFormatter(countValue, formatter);
                                            if (formatted !== null) countText = formatted;
                                        } else if (typeof countAccessor === "function") {
                                            let sum = 0;
                                            elementsInRadius.forEach((elem) => {
                                                const v = Number(countAccessor(elem));
                                                if (Number.isFinite(v)) sum += v;
                                            });
                                            countValue = sum;
                                            countText = applyFormatter(countValue, countFormatter);
                                        } else {
                                            countValue = elementsInRadius.length;
                                            countText = applyFormatter(countValue, countFormatter);
                                        }

                                        lensState.countValue = countValue;
                                        lensState.countText = countText;
                                    }
                                    const rawInfos = getRawInfos(
                                        sourceObjects,
                                        labelAccessor,
                                        colorAccessor,
                                        { x: layerX, y: layerY },
                                        lensRadius
                                    );
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
                                    const mainGraphic = layer
                                        .getLayerFromQueue("mainLayer")
                                        .getGraphic()
                                        .getBoundingClientRect();
                                    const evt = transformer.getSharedVar("event");
                                    const hasClient = lensState && Number.isFinite(lensState.clientX) && Number.isFinite(lensState.clientY);
                                    let cx, cy;
                                    if (evt) {
                                        const mainLayerGraphic = layer.getLayerFromQueue("mainLayer").getGraphic();
                                        const p = d3.pointer(evt, mainLayerGraphic);
                                        cx = p[0];
                                        cy = p[1];
                                    } else if (hasClient) {
                                        cx = lensState.clientX - mainGraphic.left;
                                        cy = lensState.clientY - mainGraphic.top;
                                    } else {
                                        cx = transformer.getSharedVar("x");
                                        cy = transformer.getSharedVar("y");
                                    }
                                    const opacity = 1;
                                    const lensRadius =
                                        lensState && Number.isFinite(lensState.r)
                                            ? lensState.r
                                            : transformer.getSharedVar("r");
                                    const stroke = transformer.getSharedVar("stroke");
                                    const strokeWidth = transformer.getSharedVar("strokeWidth");
                                    const count = transformer.getSharedVar("count");
                                    const countAccessor = transformer.getSharedVar("countAccessor");
                                    const countConfig = transformer.getSharedVar("count");
                                    const displayCountRaw =
                                        lensState && typeof lensState.countText === "string"
                                            ? lensState.countText
                                            : (typeof countConfig === "function" ||
                                                  (countConfig && typeof countConfig === "object") ||
                                                  typeof countAccessor === "function") &&
                                                lensState &&
                                                Number.isFinite(lensState.countValue)
                                              ? lensState.countValue
                                              : lensState && Number.isFinite(lensState.count)
                                                ? lensState.count
                                                : count;
                                    const displayCount = String(displayCountRaw);
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
        if (context.count !== undefined) sharedVar.count = context.count;
        if (context.countAccessor) sharedVar.countAccessor = context.countAccessor;
        if (context.countFormatter) sharedVar.countFormatter = context.countFormatter;
        if (context.filter !== undefined) sharedVar.filter = context.filter;
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
        if (context.syntheticEvent !== undefined) sharedVar.syntheticEvent = context.syntheticEvent;
        if (Number.isFinite(context.gestureMoveDelay)) sharedVar.gestureMoveDelay = context.gestureMoveDelay;
        sharedVar.lensState = state;
        if (typeof sharedVar.syntheticEvent === "string") state.syntheticEvent = String(sharedVar.syntheticEvent).toLowerCase();
        if (Number.isFinite(sharedVar.gestureMoveDelay)) state.moveDelay = Number(sharedVar.gestureMoveDelay);

        const buildOptions = {
            inherit: "ExcentricLabelingInstrument",
            layers: [layer],
            sharedVar,
        };
        if (context.priority !== undefined) buildOptions.priority = context.priority;
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
                    if (event && typeof event.preventDefault === "function") event.preventDefault();
                    if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
                        state.clientX = event.clientX;
                        state.clientY = event.clientY;
                    }
                    const nextShiftKey = !!event?.shiftKey;
                    const nextCtrlKey = !!event?.ctrlKey;
                    const nextAltKey = !!event?.altKey;
                    const nextMetaKey = !!event?.metaKey;
                    state.shiftKey = nextShiftKey;
                    state.ctrlKey = nextCtrlKey;
                    state.altKey = nextAltKey;
                    state.metaKey = nextMetaKey;
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

    static __checkModifier(event, modifierKey) {
        if (!modifierKey) return true;
        const keys = Array.isArray(modifierKey) ? modifierKey : [modifierKey];
        if (!keys.length) return true;
        return keys.every((rawKey) => {
            const key = String(rawKey || "").trim().toLowerCase();
            if (!key) return true;
            if (key === "shift") return !!event?.shiftKey;
            if (key === "ctrl" || key === "control") return !!event?.ctrlKey;
            if (key === "alt" || key === "option") return !!event?.altKey;
            if (key === "meta" || key === "cmd" || key === "command") return !!event?.metaKey;
            return true;
        });
    }

    static __resolveBrushContext(context = {}) {
        const brushEntry = context?.brushEntry ?? context?.targetInstrument ?? null;
        const brushInstrument = brushEntry?.instrument ?? context?.brushInstrument ?? null;
        const hostLayer =
            brushEntry?.hostLayer ??
            brushEntry?.layer ??
            brushInstrument?.getSharedVar?.("layer") ??
            brushInstrument?._layerInstances?.[0] ??
            null;
        const service =
            brushInstrument?.services?.find?.("RectSelectionService") ??
            brushInstrument?.services?.find?.("SelectionService") ??
            null;
        return { brushEntry, brushInstrument, hostLayer, service };
    }

    static __getBrushRect(context = {}) {
        const { service } = LibraManager.__resolveBrushContext(context);
        if (!service) return null;

        let x = Number(service.getSharedVar("offsetx"));
        let y = Number(service.getSharedVar("offsety"));
        let width = Number(service.getSharedVar("width"));
        let height = Number(service.getSharedVar("height"));

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) {
            const history = service.getSharedVar("selectionHistory");
            const lastRect = Array.isArray(history) && history.length > 0 ? history[history.length - 1] : null;
            if (lastRect) {
                x = Number(lastRect.offsetx ?? lastRect.x);
                y = Number(lastRect.offsety ?? lastRect.y);
                width = Number(lastRect.width);
                height = Number(lastRect.height);
            }
        }

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) {
            return null;
        }

        return { x, y, width, height };
    }

    static __clampBrushRect(rect, hostLayer) {
        if (!rect || !hostLayer) return rect;
        const layerWidth = Number(hostLayer._width) || 0;
        const layerHeight = Number(hostLayer._height) || 0;
        const width = Math.max(1, Math.min(rect.width, layerWidth || rect.width));
        const height = Math.max(1, Math.min(rect.height, layerHeight || rect.height));
        const maxX = Math.max(0, (layerWidth || width) - width);
        const maxY = Math.max(0, (layerHeight || height) - height);
        return {
            x: Math.max(0, Math.min(rect.x, maxX)),
            y: Math.max(0, Math.min(rect.y, maxY)),
            width,
            height,
        };
    }

    static async __applyBrushRect(context = {}, nextRect) {
        const { service, hostLayer, brushInstrument } = LibraManager.__resolveBrushContext(context);
        if (!service || !hostLayer || !nextRect) return;

        const rect = LibraManager.__clampBrushRect(nextRect, hostLayer);
        const bbox = hostLayer.getGraphic()?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
        const clientX = bbox.left + rect.x;
        const clientY = bbox.top + rect.y;

        await service.setSharedVars(
            {
                x: clientX,
                y: clientY,
                offsetx: rect.x,
                offsety: rect.y,
                width: rect.width,
                height: rect.height,
                currentx: clientX + rect.width,
                currenty: clientY + rect.height,
                endx: clientX + rect.width,
                endy: clientY + rect.height,
                selectionHistory: [],
            },
            { layer: hostLayer }
        );

        if (brushInstrument?.setSharedVar) {
            brushInstrument.setSharedVar("selectionHistory", []);
        }
    }

    static __brushLayerHit(layer, event) {
        const graphic = layer?.getGraphic?.();
        if (!graphic || !event) return false;
        if (event.target && event.target !== graphic && graphic.contains(event.target)) {
            return true;
        }
        if (typeof layer?.picking === "function" && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
            const picked = layer.picking({
                baseOn: 0,
                type: 2,
                x: event.clientX,
                y: event.clientY,
            });
            return Array.isArray(picked) && picked.length > 0;
        }
        return false;
    }

    static buildBrushMoveInstrument(layer, context = {}) {
        if (!layer) return;

        if (!LibraManager.__brushMoveInstrumentRegistered) {
            Libra.Instrument.register("BrushMoveInstrument", {
                constructor: Libra.Instrument,
                interactors: ["MouseTraceInteractor", "TouchTraceInteractor"],
                on: {
                    dragstart: [
                        ({ layer: activeLayer, event, instrument }) => {
                            const inputEvent = event?.changedTouches?.[0] ?? event;
                            if (!LibraManager.__checkModifier(inputEvent, instrument.getSharedVar("modifierKey"))) {
                                instrument.setSharedVar("interactionValid", false);
                                return;
                            }
                            if (!LibraManager.__brushLayerHit(activeLayer, inputEvent)) {
                                instrument.setSharedVar("interactionValid", false);
                                return;
                            }
                            const brushContext = { brushEntry: instrument.getSharedVar("brushEntry") };
                            const rect = LibraManager.__getBrushRect(brushContext);
                            if (!rect) {
                                instrument.setSharedVar("interactionValid", false);
                                return;
                            }
                            instrument.setSharedVar("interactionValid", true);
                            instrument.setSharedVar("lastClientX", inputEvent.clientX);
                            instrument.setSharedVar("lastClientY", inputEvent.clientY);
                        },
                    ],
                    drag: [
                        async ({ event, instrument }) => {
                            if (!instrument.getSharedVar("interactionValid")) return;
                            const inputEvent = event?.changedTouches?.[0] ?? event;
                            const prevX = Number(instrument.getSharedVar("lastClientX"));
                            const prevY = Number(instrument.getSharedVar("lastClientY"));
                            if (!Number.isFinite(prevX) || !Number.isFinite(prevY)) return;

                            const dx = inputEvent.clientX - prevX;
                            const dy = inputEvent.clientY - prevY;
                            instrument.setSharedVar("lastClientX", inputEvent.clientX);
                            instrument.setSharedVar("lastClientY", inputEvent.clientY);

                            if (!dx && !dy) return;
                            const brushContext = { brushEntry: instrument.getSharedVar("brushEntry") };
                            const rect = LibraManager.__getBrushRect(brushContext);
                            if (!rect) return;
                            await LibraManager.__applyBrushRect(brushContext, {
                                ...rect,
                                x: rect.x + dx,
                                y: rect.y + dy,
                            });
                        },
                    ],
                    dragend: [
                        ({ instrument }) => {
                            instrument.setSharedVar("interactionValid", false);
                        },
                    ],
                    dragabort: [
                        ({ instrument }) => {
                            instrument.setSharedVar("interactionValid", false);
                        },
                    ],
                },
            });
            LibraManager.__brushMoveInstrumentRegistered = true;
        }

        const sharedVar = {
            brushEntry: context.brushEntry,
        };
        if (context.modifierKey !== undefined) sharedVar.modifierKey = context.modifierKey;
        if (context.updateBrush !== undefined) sharedVar.updateBrush = context.updateBrush;
        const buildLayers = Array.isArray(context.layers) && context.layers.length ? context.layers : [layer];
        const buildOptions = {
            inherit: "BrushMoveInstrument",
            layers: buildLayers,
            sharedVar,
        };
        if (context.priority !== undefined) buildOptions.priority = context.priority;
        if (context.Priority !== undefined) buildOptions.priority = context.Priority;
        if (context.stopPropagation !== undefined) buildOptions.stopPropagation = context.stopPropagation;
        Libra.Interaction.build(buildOptions);
    }

    static buildBrushZoomInstrument(layer, context = {}) {
        if (!layer) return;

        const minWidth =
            Number.isFinite(context.minWidth) ? context.minWidth : Number.isFinite(context.minW) ? context.minW : 24;
        const minHeight =
            Number.isFinite(context.minHeight) ? context.minHeight : Number.isFinite(context.minH) ? context.minH : 24;
        const scaleStep =
            Number.isFinite(context.step)
                ? context.step
                : Number.isFinite(context.scaleStep)
                  ? context.scaleStep
                  : 0.18;

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
                sideEffect: async ({ event, layer: activeLayer, instrument }) => {
                    const inputEvent = event?.changedTouches?.[0] ?? event;
                    if (!LibraManager.__checkModifier(inputEvent, instrument.getSharedVar("modifierKey"))) {
                        return;
                    }
                    if (inputEvent && typeof inputEvent.preventDefault === "function") {
                        inputEvent.preventDefault();
                    }
                    if (!LibraManager.__brushLayerHit(activeLayer, inputEvent)) return;

                    const brushContext = { brushEntry: instrument.getSharedVar("brushEntry") };
                    const { hostLayer } = LibraManager.__resolveBrushContext(brushContext);
                    const rect = LibraManager.__getBrushRect(brushContext);
                    if (!hostLayer || !rect) return;

                    const rawDelta =
                        typeof inputEvent?.deltaY === "number"
                            ? inputEvent.deltaY
                            : typeof inputEvent?.wheelDelta === "number"
                              ? -inputEvent.wheelDelta
                              : 0;
                    if (!rawDelta) return;

                    const factor = rawDelta < 0 ? 1 + scaleStep : Math.max(0.1, 1 - scaleStep);
                    const maxWidth = Number.isFinite(context.maxWidth) ? context.maxWidth : hostLayer._width ?? rect.width;
                    const maxHeight = Number.isFinite(context.maxHeight) ? context.maxHeight : hostLayer._height ?? rect.height;

                    const nextWidth = Math.max(minWidth, Math.min(maxWidth, rect.width * factor));
                    const nextHeight = Math.max(minHeight, Math.min(maxHeight, rect.height * factor));
                    const cx = rect.x + rect.width / 2;
                    const cy = rect.y + rect.height / 2;

                    await LibraManager.__applyBrushRect(brushContext, {
                        x: cx - nextWidth / 2,
                        y: cy - nextHeight / 2,
                        width: nextWidth,
                        height: nextHeight,
                    });
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

        const sharedVar = {
            brushEntry: context.brushEntry,
        };
        if (context.modifierKey !== undefined) sharedVar.modifierKey = context.modifierKey;
        const buildLayers = Array.isArray(context.layers) && context.layers.length ? context.layers : [layer];
        const buildOptions = {
            inherit: "GeometricZoomInstrument",
            layers: buildLayers,
            sharedVar,
            override: [{ find: "MouseWheelInteractor", actions: mouseWheelActions }],
        };
        if (context.priority !== undefined) buildOptions.priority = context.priority;
        if (context.Priority !== undefined) buildOptions.priority = context.Priority;
        if (context.stopPropagation !== undefined) buildOptions.stopPropagation = context.stopPropagation;
        Libra.Interaction.build(buildOptions);
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
