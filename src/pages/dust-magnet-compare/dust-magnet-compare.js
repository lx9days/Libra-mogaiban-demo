import * as d3 from "d3";
import Libra from "libra-vis";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import excentricLabeling from "excentric-labeling";
import { compileDSL } from "../../scripts/dsl-compiler";

const PANEL_WIDTH = 500;
const PANEL_HEIGHT = 360;
const PANEL_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
const DATA_URL = "/public/data/cars.json";
const DUST_RADIUS = 8;
const MAGNET_SIZE = 50;
const HOVER_COLOR = "greenyellow";
const BRUSH_COLOR = "red";
const LENS_IDLE_MS = 160;
const BRUSH_MODIFIER_KEY = "Shift";
const NATIVE_EXCENTRIC_INTERACTION_NAME = "DustMagnetNativeExcentricLabelingInstrument";

const DSL_CODE = String.raw`const newDSLinteractions = [
    {
        instrument: "move",
        trigger: {
            type: "drag",
            priority: 4,
            stopPropagation: true,
        },
        target: {
            layer: "magnetLayer",
            pointerEvents: "visiblePainted",
        },
        feedback: {},
        customFeedbackFlow: {
            insert: commonInsertFlows,
            remove: [{ find: "SelectionTransformer" }],
        },
    },
    {
        instrument: "pointSelection",
        trigger: {
            type: "click",
            priority: 2,
            stopPropagation: true,
        },
        target: {
            layer: "bgLayer",
        },
        feedback: {},
        customFeedbackFlow: {
            insert: commonInsertFlows,
        },
    },
    {
        instrument: "pointSelection",
        trigger: {
            type: "click",
            priority: 3,
            stopPropagation: true,
        },
        target: {
            layer: "dustLayer",
            pointerEvents: "visiblePainted",
        },
        feedback: {
            redrawFunc: {
                highlight: "greenyellow",
            },
        },
    },
    {
        instrument: "groupSelection",
        trigger: {
            type: "brush",
            modifierKey: "Shift",
            priority: 5,
            stopPropagation: true,
        },
        target: {
            layer: "dustLayer",
        },
        feedback: {
            redrawFunc: {
                highlight: {
                    color: "red",
                },
            },
        },
    },
    {
        name: "dustLens",
        instrument: "lens",
        trigger: {
            type: "hover",
            priority: 1,
            stopPropagation: true,
            syntheticEvent: "idle",
        },
        target: {
            layer: "dustLayer",
        },
        feedback: {
            service: {
                lens: {
                    renderSelection: false,
                    r: 54,
                    stroke: "#1d8f43",
                    strokeWidth: 2,
                },
                excentricLabeling: {
                    countLabelDistance: 18,
                    fontSize: 12,
                    countLabelWidth: 180,
                    maxLabelsNum: 8,
                    labelAccessor: (circleElem) => {
                        const datum = d3.select(circleElem).datum();
                        return datum?.Name || datum?.Origin || "";
                    },
                    colorAccessor: (circleElem) => {
                        const datum = d3.select(circleElem).datum();
                        return originColor?.(datum?.Origin) || "#666";
                    },
                    count: {
                        field: "Horsepower",
                        op: "mean",
                        formatter: (value, { count }) =>
                            "count: " + count + " / maxHorsepower" + Math.round(value || 0),
                    },
                },
            },
        },
    },
    {
        instrument: "zoom",
        trigger: {
            type: "zoom",
        },
        target: {
            layer: "dustLayer",
        },
        feedback: {
            context: {
                updateLens: "scale",
                zoom: {
                    step: 3,
                    minR: 12,
                    maxR: 96,
                },
            },
        },
    },
];

await compileDSL(newDSLinteractions, {
    layersByName: { bgLayer, dustLayer, magnetLayer },
}, { execute: true });`;

const NATIVE_LIBRA_CODE = String.raw`// Shared interaction state. Static scene creation is omitted on purpose.
let data = [];
let magnet = [];
let properties = [];
let tickUpdate = null;
let originColor = null;

function renderDust(dustData = data) {
    d3.select("#LibraPlayground svg .dust")
        .selectAll("circle")
        .data(dustData)
        .join("circle")
        .attr("class", "mark")
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y)
        .attr("stroke", "#000")
        .attr("fill", "#B9B9B9")
        .attr("r", 10);
}

function renderMagnet(magnetData = magnet) {
    d3.select("#LibraPlayground svg .magnet")
        .call((g) => g.selectChildren().remove())
        .selectAll("g")
        .data(magnetData)
        .enter()
        .append("g")
        .call((g) =>
            g
                .append("rect")
                .attr("x", (d) => d.x)
                .attr("y", (d) => d.y)
                .attr("width", 50)
                .attr("height", 50)
                .attr("fill", "orange")
        )
        .call((g) =>
            g
                .append("text")
                .attr("x", (d) => d.x + 25)
                .attr("y", (d) => d.y + 25)
                .attr("text-anchor", "middle")
                .text((d) => d.property)
        );
}

function ensureNativeExcentricInteractionRegistered() {
    Libra.Interaction.build({
        inherit: "HoverInstrument",
        name: "DustMagnetNativeExcentricLabelingInstrument",
        sharedVar: {
            renderSelection: false,
            r: 54,
            stroke: "#1d8f43",
            strokeWidth: 2,
            countLabelDistance: 18,
            fontSize: 12,
            countLabelWidth: 180,
            maxLabelsNum: 8,
            labelAccessor: (circleElem) => d3.select(circleElem).datum()?.Name || "",
            colorAccessor: () => "#666",
            count: null,
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
                        comp: "NativeExcentricLabelingLayoutService",
                        resultAlias: "result",
                        evaluate({ labelAccessor, colorAccessor, r, maxLabelsNum, event, layer, result: circles }) {
                            if (!event || !layer) return [];
                            const [layerX, layerY] = d3.pointer(event, layer.getGraphic());
                            const rootBBox = layer.getContainerGraphic().getBoundingClientRect();
                            const layerBBox =
                                layer.getGraphic().transform.baseVal.consolidate()?.matrix ?? { e: 0, f: 0 };

                            const rawInfos = (circles || [])
                                .map((obj) => {
                                    const elem = obj?.__libra__screenElement || obj;
                                    if (!elem?.getBoundingClientRect) return null;
                                    const bbox = elem.getBoundingClientRect();
                                    return {
                                        x: bbox.x + (bbox.width >> 1) - rootBBox.x - layerBBox.e,
                                        y: bbox.y + (bbox.height >> 1) - rootBBox.y - layerBBox.f,
                                        labelWidth: 0,
                                        labelHeight: 21,
                                        color: colorAccessor(elem),
                                        labelName: labelAccessor(elem),
                                    };
                                })
                                .filter((info) => info && info.labelName);

                            const tempRoot = d3.select(layer.getGraphic()).append("g");
                            rawInfos.forEach((rawInfo) => {
                                const textNode = tempRoot.append("text").text(rawInfo.labelName).node();
                                rawInfo.labelWidth = textNode.getBBox().width;
                            });
                            tempRoot.remove();

                            const compute = excentricLabeling()
                                .radius(r)
                                .horizontallyCoherent(true)
                                .maxLabelsNum(maxLabelsNum);
                            return compute(rawInfos, layerX, layerY);
                        },
                    },
                    (layer) => ({
                        comp: "NativeDrawLabelTransformer",
                        layer: layer.getLayerFromQueue("LabelLayer"),
                        sharedVar: { result: [] },
                        redraw({ layer: activeLayer, transformer }) {
                            const result = transformer.getSharedVar("result") || [];
                            const root = d3.select(activeLayer.getGraphic());
                            root.selectAll("*").remove();
                            const lineGenerator = d3.line().x((d) => d.x).y((d) => d.y);
                            root.append("g").selectAll("path").data(result).join("path")
                                .attr("fill", "none")
                                .attr("stroke", (layoutInfo) => layoutInfo.rawInfo.color)
                                .attr("d", (layoutInfo) => lineGenerator(layoutInfo.controlPoints));
                            root.append("g").selectAll("rect").data(result).join("rect")
                                .attr("fill", "none")
                                .attr("stroke", (layoutInfo) => layoutInfo.rawInfo.color)
                                .attr("x", (layoutInfo) => layoutInfo.labelBBox.x)
                                .attr("y", (layoutInfo) => layoutInfo.labelBBox.y)
                                .attr("width", (layoutInfo) => layoutInfo.labelBBox.width)
                                .attr("height", (layoutInfo) => layoutInfo.labelBBox.height);
                            root.append("g").selectAll("text").data(result).join("text")
                                .attr("stroke", (layoutInfo) => layoutInfo.rawInfo.color)
                                .attr("x", (layoutInfo) => layoutInfo.labelBBox.x)
                                .attr("y", (layoutInfo) => layoutInfo.labelBBox.y)
                                .attr("dominant-baseline", "hanging")
                                .text((layoutInfo) => layoutInfo.rawInfo.labelName);
                        },
                    }),
                ],
            },
        ],
    });
}

const dustTransformer = Libra.GraphicalTransformer.initialize(
    "DustTransformer",
    {
        layer: dustLayer,
        sharedVar: { result: data },
        redraw({ transformer }) {
            renderDust(transformer.getSharedVar("result"));
        },
    }
);

const magnetTransformer = Libra.GraphicalTransformer.initialize(
    "MagnetTransformer",
    {
        layer: magnetLayer,
        sharedVar: { result: magnet },
        redraw({ transformer }) {
            renderMagnet(transformer.getSharedVar("result"));
        },
    }
);

const commonInsertFlows = [
    {
        find: "SelectionService",
        flow: [
            {
                comp: "MagnetPositionService",
                name: "MagnetPositionService",
                sharedVar: { magnets: magnet },
                evaluate({ magnets, offsetx, offsety, result }) {
                    const datum = result && result.length ? d3.select(result[0]).datum() : null;
                    const isMagnetDatum =
                        datum &&
                        typeof datum === "object" &&
                        typeof datum.x === "number" &&
                        typeof datum.y === "number" &&
                        typeof datum.property === "string";

                    if (isMagnetDatum) {
                        datum.x = offsetx - 25;
                        datum.y = offsety - 25;
                    } else if (Number.isFinite(offsetx) && Number.isFinite(offsety) && properties.length) {
                        magnets.push({
                            x: offsetx - 25,
                            y: offsety - 25,
                            property: properties[magnets.length % properties.length],
                        });
                    }
                    return magnets;
                },
            },
            magnetTransformer,
        ],
    },
    {
        find: "MagnetPositionService",
        flow: [
            {
                comp: "DustLayoutService",
                name: "DustLayoutService",
                sharedVar: { result: magnet, dusts: data },
                evaluate({ result: magnets, dusts, self }) {
                    cancelAnimationFrame(tickUpdate);
                    const nextDusts = dusts.map((datum) => ({ ...datum }));

                    for (const magnet of magnets) {
                        const extent = d3.extent(
                            nextDusts.map((datum) => datum[magnet.property])
                        );
                        const denominator = extent[1] || 1;
                        for (const dust of nextDusts) {
                            dust.x += ((magnet.x - dust.x) * dust[magnet.property]) / 100 / denominator;
                            dust.y += ((magnet.y - dust.y) * dust[magnet.property]) / 100 / denominator;
                        }
                    }

                    tickUpdate = requestAnimationFrame(() =>
                        self.setSharedVar("dusts", nextDusts)
                    );
                    return nextDusts;
                },
            },
            dustTransformer,
        ],
    },
];

ensureNativeExcentricInteractionRegistered();

Libra.Interaction.build({
    inherit: "DragInstrument",
    layers: [
        { layer: magnetLayer, options: { pointerEvents: "visiblePainted" } },
    ],
    remove: [{ find: "SelectionTransformer" }],
    insert: commonInsertFlows,
});

Libra.Interaction.build({
    inherit: "ClickInstrument",
    layers: [bgLayer],
    insert: commonInsertFlows,
});

Libra.Interaction.build({
    inherit: "BrushInstrument",
    layers: [dustLayer],
    sharedVar: {
        highlightColor: (datum) => originColor?.(datum?.Origin) || "red",
    },
});

const nativeLens = Libra.Interaction.build({
    inherit: "DustMagnetNativeExcentricLabelingInstrument",
    layers: [dustLayer],
    sharedVar: {
        renderSelection: false,
        r: 54,
        stroke: "#1d8f43",
        strokeWidth: 2,
        countLabelDistance: 18,
        fontSize: 12,
        countLabelWidth: 180,
        maxLabelsNum: 8,
        labelAccessor: (circleElem) => {
            const datum = d3.select(circleElem).datum();
            return datum?.Name || datum?.Origin || "";
        },
        colorAccessor: (circleElem) => {
            const datum = d3.select(circleElem).datum();
            return originColor?.(datum?.Origin) || "#666";
        },
        count: {
            field: "Horsepower",
            op: "mean",
            formatter: (value, { count }) =>
                "count: " + count + " / maxHorsepower " + Math.round(value || 0),
        },
    },
});

Libra.Interaction.build({
    inherit: "GeometricZoomInstrument",
    layers: [dustLayer],
    override: [{
        find: "MouseWheelInteractor",
        actions: [
            {
                action: "enter",
                events: ["mouseenter"],
                transition: [["start", "running"]],
            },
            {
                action: "wheel",
                events: ["wheel", "mousewheel"],
                transition: [["start", "running"], ["running", "running"]],
                sideEffect: ({ event, layer }) => {
                    if (event && typeof event.preventDefault === "function") {
                        event.preventDefault();
                    }
                    const rawDelta =
                        typeof event.deltaY === "number"
                            ? event.deltaY
                            : typeof event.wheelDelta === "number"
                              ? -event.wheelDelta
                              : 0;
                    if (!rawDelta) return;

                    const currentR = Number(nativeLens.getSharedVar("r")) || 54;
                    const nextR = Math.max(12, Math.min(96, currentR + (rawDelta < 0 ? 3 : -3)));
                    if (nextR === currentR) return;

                    nativeLens.setSharedVar("r", nextR);
                    layer.getGraphic().dispatchEvent(
                        new MouseEvent("mousemove", {
                            bubbles: true,
                            clientX: event.clientX,
                            clientY: event.clientY,
                        })
                    );
                },
            },
        ],
    }],
});

const labelLayer = dustLayer.getLayerFromQueue("LabelLayer");
const lensLayer = dustLayer.getLayerFromQueue("LensLayer");
if (labelLayer?.getGraphic) {
    d3.select(labelLayer.getGraphic()).style("pointer-events", "none");
}
if (lensLayer?.getGraphic) {
    d3.select(lensLayer.getGraphic()).style("pointer-events", "none");
}`;

const D3_CODE = String.raw`// Shared interaction state. Static scene creation is omitted on purpose.
// Assume the stage already contains an svg root and the layer groups below.
const svg = d3.select("#LibraPlayground svg");
const plotRoot = svg.select("g");
const bgLayer = plotRoot.select(".d3-bg-layer");
const dustLayer = plotRoot.select(".d3-dust-layer");
const brushLayer = plotRoot.select(".d3-brush-layer");
const lensLayer = plotRoot.select(".d3-lens-layer").style("pointer-events", "none");
const labelLayer = plotRoot.select(".d3-label-layer").style("pointer-events", "none");
const magnetLayer = plotRoot.select(".d3-magnet-layer");

let data = [];
let magnet = [];
let properties = [];
let originColor = null;
const lensState = { visible: false, x: 0, y: 0, r: 54 };
const selectionState = { pointNodes: [], brushNodes: [], brushMode: false };

function renderDust(dustData = data) {
    const circles = dustLayer
        .selectAll("circle")
        .data(dustData)
        .join("circle")
        .attr("class", "mark")
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y)
        .attr("r", 8)
        .attr("stroke", "#000")
        .attr("fill", "#b9b9b9")
        .on("click", function(event) {
            event.stopPropagation();
            selectionState.pointNodes =
                selectionState.pointNodes.length === 1 && selectionState.pointNodes[0] === this
                    ? []
                    : [this];
            applyDustStyles();
        });

    return circles;
}

function renderMagnet(magnetData = magnet) {
    magnetLayer
        .selectAll("g")
        .data(magnetData)
        .join((enter) => {
            const group = enter.append("g");
            group.append("rect").attr("width", 50).attr("height", 50).attr("fill", "orange");
            group.append("text").attr("text-anchor", "middle").attr("dominant-baseline", "middle");
            return group;
        })
        .attr("transform", (d) => "translate(" + d.x + "," + d.y + ")")
        .call(
            d3.drag().on("start", (event) => event.sourceEvent?.stopPropagation()).on("drag", (event, datum) => {
                datum.x = event.x - 25;
                datum.y = event.y - 25;
                renderMagnet();
                recomputeDustLayout();
            })
        )
        .call((group) => {
            group.select("text").attr("x", 25).attr("y", 25).text((d) => d.property);
        });
}

function recomputeDustLayout() {
    const nextDusts = data.map((datum) => ({ ...datum }));
    for (const currentMagnet of magnet) {
        const extent = d3.extent(nextDusts.map((datum) => datum[currentMagnet.property]));
        const denominator = extent[1] || 1;
        for (const dust of nextDusts) {
            dust.x += ((currentMagnet.x - dust.x) * dust[currentMagnet.property]) / 100 / denominator;
            dust.y += ((currentMagnet.y - dust.y) * dust[currentMagnet.property]) / 100 / denominator;
        }
    }
    data = nextDusts;
    renderDust();
    applyDustStyles();
    if (lensState.visible) renderLens();
}

function applyDustStyles() {
    const activeBrushNodes = selectionState.brushNodes.length ? selectionState.brushNodes : null;
    const activePointNodes = activeBrushNodes ? [] : selectionState.pointNodes;

    dustLayer.selectAll("circle")
        .attr("fill", "#b9b9b9")
        .attr("stroke", "#000")
        .attr("stroke-width", 1)
        .attr("opacity", activeBrushNodes || activePointNodes.length ? 0.28 : 1);

    if (activePointNodes.length) {
        d3.selectAll(activePointNodes)
            .attr("fill", "greenyellow")
            .attr("stroke-width", 1.5)
            .attr("opacity", 1);
    }

    if (activeBrushNodes) {
        d3.selectAll(activeBrushNodes)
            .attr("fill", "red")
            .attr("stroke-width", 1.5)
            .attr("opacity", 1);
    }
}

function renderLens() {
    if (!lensState.visible || selectionState.brushMode) return clearLens();
    const selectedData = data.filter((datum) => {
        const dx = datum.x - lensState.x;
        const dy = datum.y - lensState.y;
        return Math.sqrt(dx * dx + dy * dy) <= lensState.r;
    });

    lensLayer.selectAll("*").remove();
    labelLayer.selectAll("*").remove();

    lensLayer.append("circle")
        .attr("cx", lensState.x)
        .attr("cy", lensState.y)
        .attr("r", lensState.r)
        .attr("fill", "none")
        .attr("stroke", "#1d8f43")
        .attr("stroke-width", 2);

    const meanHorsepower = d3.mean(selectedData, (d) => d.Horsepower) || 0;
    lensLayer.append("text")
        .attr("x", lensState.x)
        .attr("y", lensState.y - lensState.r - 18)
        .attr("text-anchor", "middle")
        .attr("fill", "#1d8f43")
        .text("count: " + selectedData.length + " / maxHorsepower " + Math.round(meanHorsepower));

    const rawInfos = selectedData.map((datum) => ({
        x: datum.x,
        y: datum.y,
        labelWidth: 0,
        labelHeight: 21,
        color: originColor?.(datum.Origin) || "#666",
        labelName: datum.Name || datum.Origin || "",
    }));

    const temp = labelLayer.append("g");
    rawInfos.forEach((info) => {
        info.labelWidth = temp.append("text").text(info.labelName).node().getBBox().width;
    });
    temp.remove();

    const layout = excentricLabeling()
        .radius(lensState.r)
        .horizontallyCoherent(true)
        .maxLabelsNum(8)(rawInfos, lensState.x, lensState.y);

    const lineGenerator = d3.line().x((d) => d.x).y((d) => d.y);
    labelLayer.append("g").selectAll("path").data(layout).join("path")
        .attr("fill", "none")
        .attr("stroke", (d) => d.rawInfo.color)
        .attr("d", (d) => lineGenerator(d.controlPoints));
    labelLayer.append("g").selectAll("rect").data(layout).join("rect")
        .attr("fill", "none")
        .attr("stroke", (d) => d.rawInfo.color)
        .attr("x", (d) => d.labelBBox.x)
        .attr("y", (d) => d.labelBBox.y)
        .attr("width", (d) => d.labelBBox.width)
        .attr("height", (d) => d.labelBBox.height);
    labelLayer.append("g").selectAll("text").data(layout).join("text")
        .attr("x", (d) => d.labelBBox.x)
        .attr("y", (d) => d.labelBBox.y)
        .attr("dominant-baseline", "hanging")
        .attr("stroke", (d) => d.rawInfo.color)
        .text((d) => d.rawInfo.labelName);
}

function clearLens() {
    lensState.visible = false;
    lensLayer.selectAll("*").remove();
    labelLayer.selectAll("*").remove();
}

function installInteractions() {
    bgLayer.select("rect").on("click", (event) => {
        if (selectionState.brushMode || !properties.length) return;
        const [x, y] = d3.pointer(event, svg.node());
        magnet.push({
            x: x - 25,
            y: y - 25,
            property: properties[magnet.length % properties.length],
        });
        renderMagnet();
        recomputeDustLayout();
    });

    dustLayer
        .on("mousemove", (event) => {
            if (selectionState.brushMode) return clearLens();
            const [x, y] = d3.pointer(event, svg.node());
            lensState.visible = true;
            lensState.x = x;
            lensState.y = y;
            renderLens();
        })
        .on("mouseleave", clearLens)
        .on("wheel", (event) => {
            event.preventDefault();
            const rawDelta = typeof event.deltaY === "number" ? event.deltaY : 0;
            if (!rawDelta) return;
            lensState.r = Math.max(12, Math.min(96, lensState.r + (rawDelta < 0 ? 3 : -3)));
            if (lensState.visible) renderLens();
        });

    const brushBehavior = d3.brush()
        .extent([[0, 0], [500, 360]])
        .on("start brush end", (event) => {
            if (!selectionState.brushMode) return;
            const selection = event.selection;
            selectionState.brushNodes = selection
                ? dustLayer.selectAll("circle").nodes().filter((node) => {
                    const datum = d3.select(node).datum();
                    return (
                        datum.x >= selection[0][0] &&
                        datum.x <= selection[1][0] &&
                        datum.y >= selection[0][1] &&
                        datum.y <= selection[1][1]
                    );
                })
                : [];
            applyDustStyles();
        });

    brushLayer.call(brushBehavior).style("pointer-events", "none");

    d3.select(window)
        .on("keydown.d3-dust-magnet", (event) => {
            if (event.key === "Shift") {
                selectionState.brushMode = true;
                brushLayer.style("pointer-events", "all");
                clearLens();
            }
        })
        .on("keyup.d3-dust-magnet", (event) => {
            if (event.key === "Shift") {
                selectionState.brushMode = false;
                selectionState.brushNodes = [];
                brushLayer.style("pointer-events", "none");
                brushLayer.call(brushBehavior.move, null);
                applyDustStyles();
            }
        });
}

renderDust();
renderMagnet();
installInteractions();`;

const VEGALITE_CODE = String.raw`// TODO: Vega-Lite version placeholder`;

const CODE_EDITOR_ITEMS = [
  {
    hostId: "DustMagnetDslCode",
    fallbackId: "DustMagnetDslCodeFallback",
    value: DSL_CODE,
  },
  {
    hostId: "DustMagnetNativeCode",
    fallbackId: "DustMagnetNativeCodeFallback",
    value: NATIVE_LIBRA_CODE,
  },
  {
    hostId: "DustMagnetD3Code",
    fallbackId: "DustMagnetD3CodeFallback",
    value: D3_CODE,
  },
  {
    hostId: "DustMagnetVegaliteCode",
    fallbackId: "DustMagnetVegaliteCodeFallback",
    value: VEGALITE_CODE,
  },
];

let codeEditors = [];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function panelMarkup({ title, mountId, statusId, codeId, fallbackId, code }) {
  return `
    <article class="compare-panel">
      <div class="compare-panel-head">
        <h2 class="compare-panel-title">${escapeHtml(title)}</h2>
      </div>
      <div class="compare-panel-section compare-panel-section--stage">
        <div id="${escapeHtml(mountId)}" class="compare-panel-stage"></div>
        <p id="${escapeHtml(statusId)}" class="compare-panel-status"></p>
      </div>
      <div class="compare-panel-section compare-panel-section--code">
        <div id="${escapeHtml(codeId)}" class="editor-pane compare-code-editor"></div>
        <pre id="${escapeHtml(fallbackId)}" class="editor-fallback compare-code-fallback">${escapeHtml(code)}</pre>
      </div>
    </article>
  `;
}

function renderPage() {
  return `
    <div class="showcase-page showcase-page--compare">
      <header class="showcase-topbar">
        <a class="showcase-brand" href="?page=home">
          <strong>Libra+</strong>
          <span>Dust & Magnet Compare</span>
        </a>
        <nav class="showcase-nav" aria-label="Primary">
          <a href="?page=home">Home</a>
          <a href="?page=gallery">Gallery</a>
          <a href="?page=Dust%26Magnet">Raw Demo</a>
          <a href="?page=dust-magnet-compare" aria-current="page">Compare</a>
        </nav>
      </header>

      <section class="compare-grid">
        ${panelMarkup({
          title: "Libra+",
          mountId: "DustMagnetDslMount",
          statusId: "DustMagnetDslStatus",
          codeId: "DustMagnetDslCode",
          fallbackId: "DustMagnetDslCodeFallback",
          code: DSL_CODE,
        })}
        ${panelMarkup({
          title: "Libra.js",
          mountId: "DustMagnetNativeMount",
          statusId: "DustMagnetNativeStatus",
          codeId: "DustMagnetNativeCode",
          fallbackId: "DustMagnetNativeCodeFallback",
          code: NATIVE_LIBRA_CODE,
        })}
        ${panelMarkup({
          title: "D3",
          mountId: "DustMagnetD3Mount",
          statusId: "DustMagnetD3Status",
          codeId: "DustMagnetD3Code",
          fallbackId: "DustMagnetD3CodeFallback",
          code: D3_CODE,
        })}
        ${panelMarkup({
          title: "Vega-Lite",
          mountId: "DustMagnetVegaliteMount",
          statusId: "DustMagnetVegaliteStatus",
          codeId: "DustMagnetVegaliteCode",
          fallbackId: "DustMagnetVegaliteCodeFallback",
          code: VEGALITE_CODE,
        })}
      </section>
    </div>
  `;
}

function setStatus(container, id, message, isError = false) {
  const node = container.querySelector(`#${id}`);
  if (!node) return;
  node.textContent = message || "";
  node.classList.toggle("is-error", isError);
  node.hidden = !message;
}

function disposeCodeEditors() {
  codeEditors.forEach((editor) => {
    try {
      editor.dispose();
    } catch (error) {
      console.warn("Failed to dispose compare code editor", error);
    }
  });
  codeEditors = [];
}

function initCodeEditors(container) {
  disposeCodeEditors();

  CODE_EDITOR_ITEMS.forEach(({ hostId, fallbackId, value }) => {
    const host = container.querySelector(`#${hostId}`);
    const fallback = container.querySelector(`#${fallbackId}`);
    if (!host) return;

    try {
      const editor = monaco.editor.create(host, {
        value,
        language: "javascript",
        readOnly: true,
        automaticLayout: true,
        minimap: { enabled: false },
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        theme: "vs",
      });
      codeEditors.push(editor);
      if (fallback) fallback.style.display = "none";
    } catch (error) {
      host.style.display = "none";
      if (fallback) fallback.style.display = "block";
    }
  });
}

function cloneDustMagnetData(source) {
  return {
    dusts: source.dusts.map((datum) => ({ ...datum })),
    magnets: source.magnets.map((datum) => ({ ...datum })),
    properties: [...source.properties],
    origins: [...source.origins],
  };
}

async function loadDustMagnetData() {
  const rawData = await d3.json(DATA_URL);
  const data = Array.isArray(rawData) ? rawData : [];
  const properties = [];
  const magnets = [];
  const firstDatum = data[0] || {};

  Object.entries(firstDatum).forEach(([property, value]) => {
    if (typeof value !== "number") return;
    properties.push(property);
    if (magnets.length >= 3) return;

    magnets.push({
      x: PANEL_WIDTH / 2 - Math.pow(-1, magnets.length) * (PANEL_WIDTH / 2 - 100),
      y: PANEL_HEIGHT / 2 - Math.pow(-1, Math.floor(magnets.length / 2)) * (PANEL_HEIGHT / 2 - 100),
      property,
    });
  });

  return {
    dusts: data.slice(0, 50).map((datum) => ({
      ...datum,
      x: PANEL_WIDTH / 2,
      y: PANEL_HEIGHT / 2,
    })),
    magnets,
    properties,
    origins: Array.from(new Set(data.map((datum) => datum?.Origin).filter(Boolean))),
  };
}

function createScene(container, runtimeName, initialData) {
  container.innerHTML = "";

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", PANEL_WIDTH + PANEL_MARGIN.left + PANEL_MARGIN.right)
    .attr("height", PANEL_HEIGHT + PANEL_MARGIN.top + PANEL_MARGIN.bottom)
    .attr("viewBox", `0 0 ${PANEL_WIDTH} ${PANEL_HEIGHT}`);

  const root = svg
    .append("g")
    .attr("transform", `translate(${PANEL_MARGIN.left},${PANEL_MARGIN.top})`);

  const dustLayer = Libra.Layer.initialize("D3Layer", {
    name: `${runtimeName}DustLayer`,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    offset: { x: PANEL_MARGIN.left, y: PANEL_MARGIN.top },
    container: svg.node(),
  });
  const brushHitLayer = Libra.Layer.initialize("D3Layer", {
    name: `${runtimeName}BrushHitLayer`,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    offset: { x: PANEL_MARGIN.left, y: PANEL_MARGIN.top },
    container: svg.node(),
  });
  const magnetLayer = dustLayer.getLayerFromQueue("magnetLayer");
  const bgLayer = dustLayer.getLayerFromQueue("backgroundLayer");

  dustLayer.setLayersOrder({
    backgroundLayer: 0,
    dustLayer: 1,
    magnetLayer: 2,
  });

  d3.select(root.node()).style("pointer-events", "none");
  d3.select(dustLayer.getGraphic()).attr("class", `${runtimeName}-dust-layer`);
  d3.select(brushHitLayer.getGraphic())
    .attr("class", `${runtimeName}-brush-hit-layer`)
    .style("pointer-events", "none");
  d3.select(magnetLayer.getGraphic()).attr("class", `${runtimeName}-magnet-layer`);

  d3.select(bgLayer.getGraphic())
    .select("rect")
    .attr("stroke", "#000")
    .attr("fill", "none")
    .attr("opacity", 1);

  d3.select(brushHitLayer.getGraphic())
    .select("rect")
    .attr("stroke", "none")
    .attr("fill", "rgba(0,0,0,0.001)")
    .style("pointer-events", "none");

  const runtime = {
    name: runtimeName,
    container,
    svg,
    dustLayer,
    brushHitLayer,
    magnetLayer,
    bgLayer,
    dusts: initialData.dusts,
    magnets: initialData.magnets,
    properties: initialData.properties,
    originColor: d3.scaleOrdinal().domain(initialData.origins).range(d3.schemeTableau10),
    tickUpdate: null,
    visibleDustByDatum: new Map(),
    brushHitByDatum: new Map(),
    coordination: {
      pointNodes: [],
      brushNodes: [],
      brushMode: false,
      lensLayers: [],
      lensTimer: null,
      lensVisible: false,
    },
  };

  renderDust(runtime);
  renderBrushHitLayer(runtime);
  renderMagnet(runtime);
  return runtime;
}

function renderDust(runtime, dustData = runtime.dusts) {
  runtime.dusts = dustData;

  d3.select(runtime.dustLayer.getGraphic())
    .selectAll("circle")
    .data(dustData)
    .join("circle")
    .attr("class", "mark")
    .attr("cx", (datum) => datum.x)
    .attr("cy", (datum) => datum.y)
    .attr("stroke", "#000")
    .attr("fill", "#b9b9b9")
    .attr("r", DUST_RADIUS);

  runtime.visibleDustByDatum = new Map(
    d3.select(runtime.dustLayer.getGraphic())
      .selectAll("circle")
      .nodes()
      .map((node) => [d3.select(node).datum(), node])
  );
}

function renderBrushHitLayer(runtime, dustData = runtime.dusts) {
  d3.select(runtime.brushHitLayer.getGraphic())
    .selectAll("circle")
    .data(dustData)
    .join("circle")
    .attr("cx", (datum) => datum.x)
    .attr("cy", (datum) => datum.y)
    .attr("r", DUST_RADIUS + 4)
    .attr("fill", "rgba(255,255,255,0.001)")
    .attr("stroke", "none");

  runtime.brushHitByDatum = new Map(
    d3.select(runtime.brushHitLayer.getGraphic())
      .selectAll("circle")
      .nodes()
      .map((node) => [d3.select(node).datum(), node])
  );
}

function renderMagnet(runtime, magnetData = runtime.magnets) {
  const group = d3
    .select(runtime.magnetLayer.getGraphic())
    .call((selection) => selection.selectChildren().remove())
    .selectAll("g")
    .data(magnetData)
    .enter()
    .append("g");

  group
    .append("rect")
    .attr("x", (datum) => datum.x)
    .attr("y", (datum) => datum.y)
    .attr("width", MAGNET_SIZE)
    .attr("height", MAGNET_SIZE)
    .attr("fill", "orange");

  group
    .append("text")
    .attr("x", (datum) => datum.x + MAGNET_SIZE / 2)
    .attr("y", (datum) => datum.y + MAGNET_SIZE / 2)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("font-size", "11px")
    .text((datum) => datum.property);
}

let nativeExcentricInteractionRegistered = false;

function ensureNativeExcentricInteractionRegistered() {
  if (nativeExcentricInteractionRegistered) return;

  Libra.Interaction.build({
    inherit: "HoverInstrument",
    name: NATIVE_EXCENTRIC_INTERACTION_NAME,
    sharedVar: {
      renderSelection: false,
      r: 54,
      stroke: "#1d8f43",
      strokeWidth: 2,
      countLabelDistance: 18,
      fontSize: 12,
      countLabelWidth: 180,
      maxLabelsNum: 8,
      labelAccessor: (circleElem) => d3.select(circleElem).datum()?.Name || "",
      colorAccessor: () => "#666",
      count: null,
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
            comp: "NativeExcentricLabelingLayoutService",
            resultAlias: "result",
            evaluate({
              labelAccessor,
              colorAccessor,
              r,
              maxLabelsNum,
              event,
              layer,
              result: circles,
            }) {
              if (!event || !layer) return [];
              const [layerX, layerY] = d3.pointer(event, layer.getGraphic());
              const rootBBox = layer.getContainerGraphic().getBoundingClientRect();
              const layerBBox =
                layer.getGraphic().transform.baseVal.consolidate()?.matrix ?? {
                  e: 0,
                  f: 0,
                };

              function getRawInfos(objs, labelAccessorInner, colorAccessorInner) {
                return objs
                  .map((obj) => {
                    const elem = obj?.__libra__screenElement || obj;
                    if (!elem?.getBoundingClientRect) return null;
                    const bbox = elem.getBoundingClientRect();
                    return {
                      x: bbox.x + (bbox.width >> 1) - rootBBox.x - layerBBox.e,
                      y: bbox.y + (bbox.height >> 1) - rootBBox.y - layerBBox.f,
                      labelWidth: 0,
                      labelHeight: 0,
                      color: colorAccessorInner(elem),
                      labelName: labelAccessorInner(elem),
                    };
                  })
                  .filter((info) => info && info.labelName);
              }

              function computeSizeOfLabels(rawInfos, root) {
                const tempClass = "temp-excentric-label-" + String(Date.now());
                const tempMountPoint = root.append("svg:g").attr("class", tempClass);
                rawInfos.forEach((rawInfo) => {
                  rawInfo.__labelText = tempMountPoint
                    .append("text")
                    .attr("opacity", "0")
                    .attr("x", -Number.MAX_SAFE_INTEGER)
                    .attr("y", -Number.MAX_SAFE_INTEGER)
                    .text(rawInfo.labelName)
                    .node();
                });
                rawInfos.forEach((rawInfo) => {
                  const labelBBox = rawInfo.__labelText.getBBox();
                  rawInfo.labelWidth = labelBBox.width;
                  rawInfo.labelHeight = 21;
                  delete rawInfo.__labelText;
                });
                root.select("." + tempClass).remove();
              }

              const rawInfos = getRawInfos(circles || [], labelAccessor, colorAccessor);
              computeSizeOfLabels(rawInfos, d3.select(layer.getGraphic()));
              const compute = excentricLabeling()
                .radius(r)
                .horizontallyCoherent(true)
                .maxLabelsNum(maxLabelsNum);
              return compute(rawInfos, layerX, layerY);
            },
          },
          (layer) => ({
            comp: "NativeDrawLabelTransformer",
            layer: layer.getLayerFromQueue("LabelLayer"),
            sharedVar: {
              result: [],
            },
            redraw({ layer: activeLayer, transformer }) {
              const result = transformer.getSharedVar("result") || [];
              const root = d3.select(activeLayer.getGraphic());
              root.selectAll("*").remove();

              const lineGenerator = d3.line().x((d) => d.x).y((d) => d.y);

              root
                .append("g")
                .selectAll("path")
                .data(result)
                .join("path")
                .attr("fill", "none")
                .attr("stroke", (layoutInfo) => layoutInfo.rawInfo.color)
                .attr("d", (layoutInfo) => lineGenerator(layoutInfo.controlPoints));

              root
                .append("g")
                .selectAll("rect")
                .data(result)
                .join("rect")
                .attr("fill", "none")
                .attr("stroke", (layoutInfo) => layoutInfo.rawInfo.color)
                .attr("x", (layoutInfo) => layoutInfo.labelBBox.x)
                .attr("y", (layoutInfo) => layoutInfo.labelBBox.y)
                .attr("width", (layoutInfo) => layoutInfo.labelBBox.width)
                .attr("height", (layoutInfo) => layoutInfo.labelBBox.height);

              root
                .append("g")
                .selectAll("text")
                .data(result)
                .join("text")
                .attr("stroke", (layoutInfo) => layoutInfo.rawInfo.color)
                .attr("x", (layoutInfo) => layoutInfo.labelBBox.x)
                .attr("y", (layoutInfo) => layoutInfo.labelBBox.y)
                .attr("dominant-baseline", "hanging")
                .text((layoutInfo) => layoutInfo.rawInfo.labelName);
            },
          }),
        ],
      },
      {
        find: "CircleSelectionService",
        flow: [
          {
            comp: "NativeLensStatsService",
            resultAlias: "lensStats",
            evaluate({ result: circles = [], count }) {
              const data = (Array.isArray(circles) ? circles : [])
                .map((circleElem) => d3.select(circleElem).datum())
                .filter(Boolean);
              const countValue = data.length;
              if (!count || !count.field) {
                return { count: countValue, value: countValue };
              }

              const values = data
                .map((datum) => Number(datum[count.field]))
                .filter((value) => Number.isFinite(value));
              let aggregateValue = 0;
              switch (count.op) {
                case "mean":
                  aggregateValue = values.length ? d3.mean(values) : 0;
                  break;
                case "sum":
                  aggregateValue = d3.sum(values);
                  break;
                case "max":
                  aggregateValue = values.length ? d3.max(values) : 0;
                  break;
                case "min":
                  aggregateValue = values.length ? d3.min(values) : 0;
                  break;
                default:
                  aggregateValue = countValue;
                  break;
              }
              return { count: countValue, value: aggregateValue };
            },
          },
          (layer) => ({
            comp: "NativeDrawLensTransformer",
            layer: layer.getLayerFromQueue("LensLayer"),
            sharedVar: {
              x: 0,
              y: 0,
              lensStats: { count: 0, value: 0 },
            },
            redraw({ layer: activeLayer, transformer }) {
              const hostLayer = activeLayer?._parent || activeLayer;
              const hostBBox = hostLayer.getGraphic().getBoundingClientRect();
              const cx = (transformer.getSharedVar("x") || 0) - hostBBox.left;
              const cy = (transformer.getSharedVar("y") || 0) - hostBBox.top;
              const lensRadius = transformer.getSharedVar("r");
              const stroke = transformer.getSharedVar("stroke");
              const strokeWidth = transformer.getSharedVar("strokeWidth");
              const countCfg = transformer.getSharedVar("count");
              const lensStats = transformer.getSharedVar("lensStats") || { count: 0, value: 0 };
              const countLabelDistance = transformer.getSharedVar("countLabelDistance");
              const fontSize = transformer.getSharedVar("fontSize");
              const countLabelWidth = transformer.getSharedVar("countLabelWidth");
              const labelText =
                countCfg && typeof countCfg.formatter === "function"
                  ? countCfg.formatter(lensStats.value, { count: lensStats.count })
                  : String(lensStats.count);

              const root = d3.select(activeLayer.getGraphic());
              root.selectAll("*").remove();

              const group = root.append("g").attr("transform", `translate(${cx}, ${cy})`);
              group
                .append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
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
                .text(labelText);

              const countLabelBBox = countLabel.node().getBBox();
              group
                .append("rect")
                .attr("stroke", stroke)
                .attr("stroke-width", strokeWidth)
                .attr("fill", "none")
                .attr("x", (-countLabelWidth) / 2)
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

  nativeExcentricInteractionRegistered = true;
}

function createInteractionFlow(runtime, runtimeName) {
  const dustTransformer = Libra.GraphicalTransformer.initialize(
    `${runtimeName}DustTransformer`,
    {
      layer: runtime.dustLayer,
      sharedVar: { result: runtime.dusts },
      redraw({ transformer }) {
        const dusts = transformer.getSharedVar("result");
        renderDust(runtime, dusts);
        renderBrushHitLayer(runtime, dusts);
        applyDustStyles(runtime);
      },
    }
  );

  const magnetTransformer = Libra.GraphicalTransformer.initialize(
    `${runtimeName}MagnetTransformer`,
    {
      layer: runtime.magnetLayer,
      sharedVar: { result: runtime.magnets },
      redraw({ transformer }) {
        const magnets = transformer.getSharedVar("result");
        renderMagnet(runtime, magnets);
      },
    }
  );

  const magnetPositionServiceName = `${runtimeName}MagnetPositionService`;
  const dustLayoutServiceName = `${runtimeName}DustLayoutService`;

  return [
    {
      find: "SelectionService",
      flow: [
        {
          comp: "MagnetPositionService",
          name: magnetPositionServiceName,
          sharedVar: {
            magnets: runtime.magnets,
          },
          evaluate({ magnets, offsetx, offsety, result }) {
            if (result && result.length) {
              const datum = d3.select(result[0]).datum();
              datum.x = offsetx - MAGNET_SIZE / 2;
              datum.y = offsety - MAGNET_SIZE / 2;
            } else if (Number.isFinite(offsetx) && Number.isFinite(offsety) && runtime.properties.length) {
              magnets.push({
                x: offsetx - MAGNET_SIZE / 2,
                y: offsety - MAGNET_SIZE / 2,
                property: runtime.properties[magnets.length % runtime.properties.length],
              });
            }
            return magnets;
          },
        },
        magnetTransformer,
      ],
    },
    {
      find: magnetPositionServiceName,
      flow: [
        {
          comp: "DustLayoutService",
          name: dustLayoutServiceName,
          sharedVar: { result: runtime.magnets, dusts: runtime.dusts },
          evaluate({ result: magnets, dusts, self }) {
            cancelAnimationFrame(runtime.tickUpdate);

            const nextDusts = dusts.map((datum) => ({ ...datum }));
            for (const magnet of magnets) {
              const extent = d3.extent(nextDusts.map((datum) => datum[magnet.property]));
              const denominator = extent[1] || 1;

              for (const dust of nextDusts) {
                let x = dust.x;
                let y = dust.y;
                x += ((magnet.x - x) * dust[magnet.property]) / 100 / denominator;
                y += ((magnet.y - y) * dust[magnet.property]) / 100 / denominator;
                dust.x = x;
                dust.y = y;
              }
            }

            runtime.tickUpdate = requestAnimationFrame(() => {
              self.setSharedVar("dusts", nextDusts);
            });
            return nextDusts;
          },
        },
        dustTransformer,
      ],
    },
  ];
}

function applyDustStyles(runtime) {
  const pointNodes = Array.isArray(runtime.coordination.pointNodes)
    ? runtime.coordination.pointNodes
    : [];
  const brushNodes = Array.isArray(runtime.coordination.brushNodes)
    ? runtime.coordination.brushNodes
    : [];
  const activeBrushNodes = brushNodes.length ? brushNodes : null;
  const activePointNodes = activeBrushNodes ? [] : pointNodes;

  d3.select(runtime.dustLayer.getGraphic())
    .selectAll("circle")
    .attr("fill", "#b9b9b9")
    .attr("stroke", "#000")
    .attr("stroke-width", 1)
    .attr("opacity", activeBrushNodes || activePointNodes.length ? 0.28 : 1);

  if (activePointNodes.length) {
    d3.selectAll(activePointNodes)
      .attr("fill", HOVER_COLOR)
      .attr("stroke", "#000")
      .attr("stroke-width", 1.5)
      .attr("opacity", 1);
  }

  if (activeBrushNodes) {
    d3.selectAll(activeBrushNodes)
      .attr("fill", BRUSH_COLOR)
      .attr("stroke", "#000")
      .attr("stroke-width", 1.5)
      .attr("opacity", 1);
  }
}

function matchesManualModifierKey(event, expectedKey = BRUSH_MODIFIER_KEY) {
  return String(event?.key || "").toLowerCase() === String(expectedKey).toLowerCase();
}

function isBrushModifierPressed(event) {
  return Boolean(event?.shiftKey);
}

function setBrushMode(runtime, enabled) {
  runtime.coordination.brushMode = Boolean(enabled);
  d3.select(runtime.brushHitLayer.getGraphic()).style(
    "pointer-events",
    runtime.coordination.brushMode ? "all" : "none"
  );
}

function setLensVisibility(runtime, visible) {
  runtime.coordination.lensVisible = Boolean(visible);
  runtime.coordination.lensLayers.forEach((layer) => {
    if (!layer?.getGraphic) return;
    d3.select(layer.getGraphic())
      .style("pointer-events", "none")
      .style("opacity", runtime.coordination.lensVisible ? 1 : 0)
      .style("visibility", runtime.coordination.lensVisible ? "visible" : "hidden");
  });
}

function installShiftBrushMode(runtime) {
  d3.select(window)
    .on(`keydown.${runtime.name}-shift-brush`, (event) => {
      if (matchesManualModifierKey(event)) setBrushMode(runtime, true);
    })
    .on(`keyup.${runtime.name}-shift-brush`, (event) => {
      if (matchesManualModifierKey(event)) setBrushMode(runtime, false);
    })
    .on(`blur.${runtime.name}-shift-brush`, () => {
      setBrushMode(runtime, false);
    });

  setBrushMode(runtime, false);
}

function installManualIdleLens(runtime) {
  const graphic = runtime.dustLayer.getGraphic();
  if (!graphic) return;

  const scheduleLens = () => {
    clearTimeout(runtime.coordination.lensTimer);
    setLensVisibility(runtime, false);
    runtime.coordination.lensTimer = window.setTimeout(() => {
      if (!runtime.coordination.brushMode) {
        setLensVisibility(runtime, true);
      }
    }, LENS_IDLE_MS);
  };

  d3.select(graphic)
    .style("pointer-events", "all")
    .on(`mousemove.${runtime.name}.idle-lens`, () => {
      if (runtime.coordination.brushMode) {
        setLensVisibility(runtime, false);
        return;
      }
      scheduleLens();
    })
    .on(`mouseleave.${runtime.name}.idle-lens`, () => {
      clearTimeout(runtime.coordination.lensTimer);
      setLensVisibility(runtime, false);
    })
    .on(`wheel.${runtime.name}.idle-lens`, () => {
      if (runtime.coordination.brushMode) {
        setLensVisibility(runtime, false);
        return;
      }
      scheduleLens();
    });

  setLensVisibility(runtime, false);
}

function createPointSelectionFlow(runtime) {
  return {
    find: "SelectionService",
    Operator: ({ result = [] }) => {
      const clickedNodes = Array.isArray(result) ? result : [];
      const currentSelection = runtime.coordination.pointNodes;
      const nextSelection =
        clickedNodes.length === 1 && currentSelection.length === 1 && clickedNodes[0] === currentSelection[0]
          ? []
          : clickedNodes;
      return { nodes: nextSelection };
    },
    Renderer: ({ nodes = [] } = {}) => {
      runtime.coordination.pointNodes = Array.isArray(nodes) ? nodes : [];
      applyDustStyles(runtime);
    },
  };
}

function createManualModifierBrushFlow(runtime) {
  return {
    find: "SelectionService",
    Operator: ({ result = [], event }) => {
      const brushAllowed = Boolean(isBrushModifierPressed(event) || runtime.coordination.brushMode);
      const hitNodes = brushAllowed && Array.isArray(result) ? result : [];
      const visibleNodes = hitNodes
        .map((node) => runtime.visibleDustByDatum.get(d3.select(node).datum()))
        .filter(Boolean);
      return { nodes: visibleNodes, brushAllowed };
    },
    Renderer: ({ nodes = [], brushAllowed = false } = {}) => {
      runtime.coordination.brushNodes = brushAllowed ? nodes : [];
      applyDustStyles(runtime);
    },
  };
}

async function renderDslPanel(mountNode, sourceData) {
  const runtime = createScene(
    mountNode,
    "dustMagnetDslCompare",
    cloneDustMagnetData(sourceData)
  );
  const hubName = `${runtime.name}-magnet-hub`;
  const magnetPositionServiceName = `${runtime.name}MagnetPositionService`;
  const dustLayoutServiceName = `${runtime.name}DustLayoutService`;

  Libra.helpers.globalHubManager.createHub(hubName, "generic");

  const dustTransformer = Libra.GraphicalTransformer.initialize(
    `${runtime.name}DustTransformer`,
    {
      layer: runtime.dustLayer,
      sharedVar: { result: runtime.dusts },
      redraw({ transformer }) {
        const dusts = transformer.getSharedVar("result");
        renderDust(runtime, dusts);
        runtime.dustLayer.postUpdate();
      },
    }
  );

  const magnetTransformer = Libra.GraphicalTransformer.initialize(
    `${runtime.name}MagnetTransformer`,
    {
      layer: runtime.magnetLayer,
      sharedVar: { result: runtime.magnets },
      redraw({ transformer }) {
        const magnets = transformer.getSharedVar("result");
        renderMagnet(runtime, magnets);
      },
    }
  );

  const hub = Libra.helpers.globalHubManager.getHub(hubName);
  if (hub) {
    hub.subscribe(() => {
      const hubData = hub.get();
      const magnetData = hubData["magnet-position"];
      if (magnetData && magnetData.magnets) {
        const dustLayoutService = Libra.Service.getService(dustLayoutServiceName);
        if (dustLayoutService) {
          dustLayoutService.setSharedVar("magnets", magnetData.magnets);
          const result = dustLayoutService.evaluate();
          if (result) {
            dustTransformer.setSharedVar("result", result);
            dustTransformer.redraw({ transformer: dustTransformer });
          }
        }
      }
    });
  }

  const commonInsertFlows = [
    {
      find: "SelectionService",
      flow: [
        {
          comp: "MagnetPositionService",
          name: magnetPositionServiceName,
          sharedVar: {
            magnets: runtime.magnets,
          },
          evaluate({ magnets: currentMagnets, offsetx, offsety, result }) {
            const datum = result && result.length ? d3.select(result[0]).datum() : null;
            const isMagnetDatum =
              datum &&
              typeof datum === "object" &&
              typeof datum.x === "number" &&
              typeof datum.y === "number" &&
              typeof datum.property === "string";

            if (isMagnetDatum) {
              datum.x = offsetx - MAGNET_SIZE / 2;
              datum.y = offsety - MAGNET_SIZE / 2;
            } else if (
              Number.isFinite(offsetx) &&
              Number.isFinite(offsety) &&
              runtime.properties.length
            ) {
              currentMagnets.push({
                x: offsetx - MAGNET_SIZE / 2,
                y: offsety - MAGNET_SIZE / 2,
                property:
                  runtime.properties[
                    currentMagnets.length % runtime.properties.length
                  ],
              });
            }

            if (hub) hub.set("magnet-position", { magnets: currentMagnets });
            return currentMagnets;
          },
        },
        magnetTransformer,
      ],
    },
    {
      find: magnetPositionServiceName,
      flow: [
        {
          comp: "DustLayoutService",
          name: dustLayoutServiceName,
          sharedVar: {
            dusts: runtime.dusts,
            result: runtime.dusts,
            magnets: runtime.magnets,
          },
          evaluate({ dusts, magnets: serviceMagnets, self }) {
            const magnets = serviceMagnets || runtime.magnets;
            if (!magnets || !magnets.length) return dusts;

            cancelAnimationFrame(runtime.tickUpdate);
            const copyDusts = JSON.parse(JSON.stringify(dusts));

            for (const magnet of magnets) {
              const extent = d3.extent(
                copyDusts.map((datum) => datum[magnet.property])
              );
              for (const dust of copyDusts) {
                let x = dust.x;
                let y = dust.y;
                const dx = magnet.x;
                const dy = magnet.y;
                x += ((dx - x) * dust[magnet.property]) / 100 / extent[1];
                y += ((dy - y) * dust[magnet.property]) / 100 / extent[1];
                dust.x = x;
                dust.y = y;
              }
            }

            runtime.tickUpdate = requestAnimationFrame(() =>
              self.setSharedVar("dusts", copyDusts)
            );
            return copyDusts;
          },
        },
        dustTransformer,
      ],
    },
  ];

  const newDSLinteractions = [
    {
      instrument: "move",
      trigger: {
        type: "drag",
        priority: 4,
        stopPropagation: true,
      },
      target: {
        layer: "magnetLayer",
        pointerEvents: "visiblePainted",
      },
      feedback: {},
      customFeedbackFlow: {
        insert: commonInsertFlows,
        remove: [{ find: "SelectionTransformer" }],
      },
    },
    {
      instrument: "pointSelection",
      trigger: {
        type: "click",
        priority: 2,
        stopPropagation: true,
      },
      target: {
        layer: "bgLayer",
      },
      feedback: {},
      customFeedbackFlow: {
        insert: commonInsertFlows,
      },
    },
    {
      instrument: "pointSelection",
      trigger: {
        type: "click",
        priority: 3,
        stopPropagation: true,
      },
      target: {
        layer: "dustLayer",
        pointerEvents: "visiblePainted",
      },
      feedback: {
        redrawFunc: {
          highlight: HOVER_COLOR,
        },
      },
    },
    {
      instrument: "groupSelection",
      trigger: {
        type: "brush",
        modifierKey: "Shift",
        priority: 5,
        stopPropagation: true,
      },
      target: {
        layer: "dustLayer",
      },
      feedback: {
        redrawFunc: {
          highlight: {
            color: BRUSH_COLOR,
          },
        },
      },
    },
    {
      name: "dustLens",
      instrument: "lens",
      trigger: {
        type: "hover",
        priority: 1,
        stopPropagation: true,
        syntheticEvent: "idle",
      },
      target: {
        layer: "dustLayer",
      },
      feedback: {
        service: {
          lens: {
            renderSelection: false,
            r: 54,
            stroke: "#1d8f43",
            strokeWidth: 2,
          },
          excentricLabeling: {
            countLabelDistance: 18,
            fontSize: 12,
            countLabelWidth: 180,
            maxLabelsNum: 8,
            labelAccessor: (circleElem) => {
              const datum = d3.select(circleElem).datum();
              return datum?.Name || datum?.Origin || "";
            },
            colorAccessor: (circleElem) => {
              const datum = d3.select(circleElem).datum();
              return runtime.originColor?.(datum?.Origin) || "#666";
            },
            count: {
              field: "Horsepower",
              op: "mean",
              formatter: (value, { count }) =>
                `count: ${count} / maxHorsepower${Math.round(value || 0)}`,
            },
          },
        },
      },
    },
    {
      instrument: "zoom",
      trigger: {
        type: "zoom",
      },
      target: {
        layer: "dustLayer",
      },
      feedback: {
        context: {
          updateLens: "scale",
          zoom: {
            step: 3,
            minR: 12,
            maxR: 96,
          },
        },
      },
    },
  ];

  await compileDSL(
    newDSLinteractions,
    {
      layersByName: {
        bgLayer: runtime.bgLayer,
        dustLayer: runtime.dustLayer,
        magnetLayer: runtime.magnetLayer,
      },
    },
    { execute: true }
  );

  const labelLayer = runtime.dustLayer.getLayerFromQueue("LabelLayer");
  const lensLayer = runtime.dustLayer.getLayerFromQueue("LensLayer");
  if (labelLayer?.getGraphic) {
    d3.select(labelLayer.getGraphic()).style("pointer-events", "none");
  }
  if (lensLayer?.getGraphic) {
    d3.select(lensLayer.getGraphic()).style("pointer-events", "none");
  }
}

function renderNativeLibraPanel(mountNode, sourceData) {
  const runtime = createScene(
    mountNode,
    "dustMagnetNativeCompare",
    cloneDustMagnetData(sourceData)
  );
  ensureNativeExcentricInteractionRegistered();
  const commonInsertFlows = createInteractionFlow(runtime, "dustMagnetNativeCompare");

  Libra.Interaction.build({
    inherit: "DragInstrument",
    layers: [
      {
        layer: runtime.magnetLayer,
        options: { pointerEvents: "visiblePainted" },
      },
    ],
    remove: [
      {
        find: "SelectionTransformer",
      },
    ],
    insert: commonInsertFlows,
  });

  Libra.Interaction.build({
    inherit: "ClickInstrument",
    layers: [runtime.bgLayer],
    insert: commonInsertFlows,
  });

  Libra.Interaction.build({
    inherit: "BrushInstrument",
    layers: [runtime.dustLayer],
    sharedVar: {
      highlightColor: (datum) => runtime.originColor?.(datum?.Origin) || BRUSH_COLOR,
    },
  });

  const nativeLens = Libra.Interaction.build({
    inherit: NATIVE_EXCENTRIC_INTERACTION_NAME,
    layers: [runtime.dustLayer],
    sharedVar: {
      renderSelection: false,
      r: 54,
      stroke: "#1d8f43",
      strokeWidth: 2,
      countLabelDistance: 18,
      fontSize: 12,
      countLabelWidth: 180,
      maxLabelsNum: 8,
      labelAccessor: (circleElem) => {
        const datum = d3.select(circleElem).datum();
        return datum?.Name || datum?.Origin || "";
      },
      colorAccessor: (circleElem) => {
        const datum = d3.select(circleElem).datum();
        return runtime.originColor?.(datum?.Origin) || "#666";
      },
      count: {
        field: "Horsepower",
        op: "mean",
        formatter: (value, { count }) =>
          `count: ${count} / maxHorsepower ${Math.round(value || 0)}`,
      },
    },
  });

  Libra.Interaction.build({
    inherit: "GeometricZoomInstrument",
    layers: [runtime.dustLayer],
    override: [
      {
        find: "MouseWheelInteractor",
        actions: [
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
              if (event && typeof event.preventDefault === "function") {
                event.preventDefault();
              }
              const rawDelta =
                typeof event.deltaY === "number"
                  ? event.deltaY
                  : typeof event.wheelDelta === "number"
                    ? -event.wheelDelta
                    : 0;
              if (!rawDelta) return;

              const currentR = Number(nativeLens.getSharedVar("r")) || 54;
              const nextR = Math.max(12, Math.min(96, currentR + (rawDelta < 0 ? 3 : -3)));
              if (nextR === currentR) return;

              nativeLens.setSharedVar("r", nextR);
              activeLayer.getGraphic().dispatchEvent(
                new MouseEvent("mousemove", {
                  bubbles: true,
                  clientX: event.clientX,
                  clientY: event.clientY,
                  shiftKey: !!event.shiftKey,
                  ctrlKey: !!event.ctrlKey,
                  altKey: !!event.altKey,
                  metaKey: !!event.metaKey,
                })
              );
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
        ],
      },
    ],
  });

  const labelLayer = runtime.dustLayer.getLayerFromQueue("LabelLayer");
  const lensLayer = runtime.dustLayer.getLayerFromQueue("LensLayer");
  if (labelLayer?.getGraphic) {
    d3.select(labelLayer.getGraphic()).style("pointer-events", "none");
  }
  if (lensLayer?.getGraphic) {
    d3.select(lensLayer.getGraphic()).style("pointer-events", "none");
  }
}

function createD3Runtime(container, runtimeName, initialData) {
  container.innerHTML = "";

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", PANEL_WIDTH + PANEL_MARGIN.left + PANEL_MARGIN.right)
    .attr("height", PANEL_HEIGHT + PANEL_MARGIN.top + PANEL_MARGIN.bottom)
    .attr("viewBox", `0 0 ${PANEL_WIDTH} ${PANEL_HEIGHT}`);

  const plotRoot = svg
    .append("g")
    .attr("transform", `translate(${PANEL_MARGIN.left},${PANEL_MARGIN.top})`);

  const bgLayer = plotRoot.append("g").attr("class", `${runtimeName}-bg-layer`);
  const dustLayer = plotRoot.append("g").attr("class", `${runtimeName}-dust-layer`);
  const brushLayer = plotRoot
    .append("g")
    .attr("class", `${runtimeName}-brush-layer`)
    .style("pointer-events", "none");
  const lensLayer = plotRoot
    .append("g")
    .attr("class", `${runtimeName}-lens-layer`)
    .style("pointer-events", "none");
  const labelLayer = plotRoot
    .append("g")
    .attr("class", `${runtimeName}-label-layer`)
    .style("pointer-events", "none");
  const magnetLayer = plotRoot.append("g").attr("class", `${runtimeName}-magnet-layer`);

  bgLayer
    .append("rect")
    .attr("width", PANEL_WIDTH)
    .attr("height", PANEL_HEIGHT)
    .attr("stroke", "#000")
    .attr("fill", "none")
    .attr("opacity", 1);

  return {
    name: runtimeName,
    container,
    svg,
    plotRoot,
    bgLayer,
    dustLayer,
    brushLayer,
    lensLayer,
    labelLayer,
    magnetLayer,
    dusts: initialData.dusts,
    magnets: initialData.magnets,
    properties: initialData.properties,
    originColor: d3.scaleOrdinal().domain(initialData.origins).range(d3.schemeTableau10),
    tickUpdate: null,
    selection: {
      pointNodes: [],
      brushNodes: [],
      brushMode: false,
    },
    lens: {
      visible: false,
      x: PANEL_WIDTH / 2,
      y: PANEL_HEIGHT / 2,
      r: 54,
    },
    brushBehavior: null,
  };
}

function applyD3DustStyles(runtime) {
  const activeBrushNodes = runtime.selection.brushNodes.length
    ? runtime.selection.brushNodes
    : null;
  const activePointNodes = activeBrushNodes ? [] : runtime.selection.pointNodes;

  runtime.dustLayer
    .selectAll("circle")
    .attr("fill", "#b9b9b9")
    .attr("stroke", "#000")
    .attr("stroke-width", 1)
    .attr("opacity", activeBrushNodes || activePointNodes.length ? 0.28 : 1);

  if (activePointNodes.length) {
    d3.selectAll(activePointNodes)
      .attr("fill", HOVER_COLOR)
      .attr("stroke", "#000")
      .attr("stroke-width", 1.5)
      .attr("opacity", 1);
  }

  if (activeBrushNodes) {
    d3.selectAll(activeBrushNodes)
      .attr("fill", BRUSH_COLOR)
      .attr("stroke", "#000")
      .attr("stroke-width", 1.5)
      .attr("opacity", 1);
  }
}

function renderD3Dust(runtime, dustData = runtime.dusts) {
  runtime.dusts = dustData;

  runtime.dustLayer
    .selectAll("circle")
    .data(dustData)
    .join("circle")
    .attr("class", "mark")
    .attr("cx", (datum) => datum.x)
    .attr("cy", (datum) => datum.y)
    .attr("r", DUST_RADIUS)
    .attr("stroke", "#000")
    .attr("fill", "#b9b9b9")
    .on("click", function(event) {
      event.stopPropagation();
      runtime.selection.pointNodes =
        runtime.selection.pointNodes.length === 1 && runtime.selection.pointNodes[0] === this
          ? []
          : [this];
      applyD3DustStyles(runtime);
    });

  applyD3DustStyles(runtime);
}

function recomputeD3DustLayout(runtime) {
  cancelAnimationFrame(runtime.tickUpdate);
  const nextDusts = runtime.dusts.map((datum) => ({ ...datum }));

  for (const magnet of runtime.magnets) {
    const extent = d3.extent(nextDusts.map((datum) => datum[magnet.property]));
    const denominator = extent[1] || 1;

    for (const dust of nextDusts) {
      dust.x += ((magnet.x - dust.x) * dust[magnet.property]) / 100 / denominator;
      dust.y += ((magnet.y - dust.y) * dust[magnet.property]) / 100 / denominator;
    }
  }

  runtime.tickUpdate = requestAnimationFrame(() => {
    runtime.selection.pointNodes = [];
    runtime.selection.brushNodes = [];
    renderD3Dust(runtime, nextDusts);
    if (runtime.lens.visible) {
      renderD3Lens(runtime);
    }
  });
}

function renderD3Magnets(runtime) {
  runtime.magnetLayer
    .selectAll("g")
    .data(runtime.magnets)
    .join((enter) => {
      const group = enter.append("g");
      group
        .append("rect")
        .attr("width", MAGNET_SIZE)
        .attr("height", MAGNET_SIZE)
        .attr("fill", "orange");
      group
        .append("text")
        .attr("x", MAGNET_SIZE / 2)
        .attr("y", MAGNET_SIZE / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-size", "11px");
      return group;
    })
    .attr("transform", (datum) => `translate(${datum.x},${datum.y})`)
    .call(
      d3
        .drag()
        .on("start", (event) => {
          event.sourceEvent?.stopPropagation?.();
        })
        .on("drag", (event, datum) => {
          datum.x = event.x - MAGNET_SIZE / 2;
          datum.y = event.y - MAGNET_SIZE / 2;
          renderD3Magnets(runtime);
          recomputeD3DustLayout(runtime);
        })
    )
    .call((group) => {
      group.select("text").text((datum) => datum.property);
    });
}

function clearD3Lens(runtime) {
  runtime.lens.visible = false;
  runtime.lensLayer.selectAll("*").remove();
  runtime.labelLayer.selectAll("*").remove();
}

function renderD3Lens(runtime) {
  if (!runtime.lens.visible || runtime.selection.brushMode) {
    clearD3Lens(runtime);
    return;
  }

  const selectedDusts = runtime.dusts.filter((datum) => {
    const dx = datum.x - runtime.lens.x;
    const dy = datum.y - runtime.lens.y;
    return Math.sqrt(dx * dx + dy * dy) <= runtime.lens.r;
  });

  runtime.lensLayer.selectAll("*").remove();
  runtime.labelLayer.selectAll("*").remove();

  runtime.lensLayer
    .append("circle")
    .attr("cx", runtime.lens.x)
    .attr("cy", runtime.lens.y)
    .attr("r", runtime.lens.r)
    .attr("fill", "none")
    .attr("stroke", "#1d8f43")
    .attr("stroke-width", 2);

  const meanHorsepower = d3.mean(selectedDusts, (datum) => datum.Horsepower) || 0;
  const countLabel = runtime.lensLayer
    .append("text")
    .attr("x", runtime.lens.x)
    .attr("y", runtime.lens.y - runtime.lens.r - 18)
    .attr("text-anchor", "middle")
    .attr("fill", "#1d8f43")
    .style("font-size", "12px")
    .text(`count: ${selectedDusts.length} / maxHorsepower ${Math.round(meanHorsepower)}`);
  const countBBox = countLabel.node().getBBox();
  runtime.lensLayer
    .append("rect")
    .attr("x", runtime.lens.x - 90)
    .attr("y", countBBox.y)
    .attr("width", 180)
    .attr("height", countBBox.height)
    .attr("fill", "none")
    .attr("stroke", "#1d8f43")
    .attr("stroke-width", 2);
  runtime.lensLayer
    .append("line")
    .attr("x1", runtime.lens.x)
    .attr("x2", runtime.lens.x)
    .attr("y1", runtime.lens.y - runtime.lens.r)
    .attr("y2", countBBox.y + countBBox.height)
    .attr("stroke", "#1d8f43")
    .attr("stroke-width", 2);

  const rawInfos = selectedDusts
    .map((datum) => ({
      x: datum.x,
      y: datum.y,
      labelWidth: 0,
      labelHeight: 21,
      color: runtime.originColor?.(datum.Origin) || "#666",
      labelName: datum.Name || datum.Origin || "",
    }))
    .filter((info) => info.labelName);

  const tempRoot = runtime.labelLayer.append("g");
  rawInfos.forEach((rawInfo) => {
    rawInfo.labelWidth = tempRoot.append("text").text(rawInfo.labelName).node().getBBox().width;
  });
  tempRoot.remove();

  const layout = excentricLabeling()
    .radius(runtime.lens.r)
    .horizontallyCoherent(true)
    .maxLabelsNum(8)(rawInfos, runtime.lens.x, runtime.lens.y);

  const lineGenerator = d3.line().x((datum) => datum.x).y((datum) => datum.y);
  runtime.labelLayer
    .append("g")
    .selectAll("path")
    .data(layout)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (layoutInfo) => layoutInfo.rawInfo.color)
    .attr("d", (layoutInfo) => lineGenerator(layoutInfo.controlPoints));
  runtime.labelLayer
    .append("g")
    .selectAll("rect")
    .data(layout)
    .join("rect")
    .attr("fill", "none")
    .attr("stroke", (layoutInfo) => layoutInfo.rawInfo.color)
    .attr("x", (layoutInfo) => layoutInfo.labelBBox.x)
    .attr("y", (layoutInfo) => layoutInfo.labelBBox.y)
    .attr("width", (layoutInfo) => layoutInfo.labelBBox.width)
    .attr("height", (layoutInfo) => layoutInfo.labelBBox.height);
  runtime.labelLayer
    .append("g")
    .selectAll("text")
    .data(layout)
    .join("text")
    .attr("x", (layoutInfo) => layoutInfo.labelBBox.x)
    .attr("y", (layoutInfo) => layoutInfo.labelBBox.y)
    .attr("dominant-baseline", "hanging")
    .attr("stroke", (layoutInfo) => layoutInfo.rawInfo.color)
    .text((layoutInfo) => layoutInfo.rawInfo.labelName);
}

function setD3BrushMode(runtime, enabled) {
  runtime.selection.brushMode = Boolean(enabled);
  runtime.brushLayer.style("pointer-events", runtime.selection.brushMode ? "all" : "none");
  if (!runtime.selection.brushMode && runtime.brushBehavior) {
    runtime.brushLayer.call(runtime.brushBehavior.move, null);
    runtime.selection.brushNodes = [];
    applyD3DustStyles(runtime);
  }
  if (runtime.selection.brushMode) {
    clearD3Lens(runtime);
  }
}

function installD3Interactions(runtime) {
  runtime.bgLayer.select("rect").on("click", (event) => {
    if (runtime.selection.brushMode || !runtime.properties.length) return;
    const [x, y] = d3.pointer(event, runtime.plotRoot.node());
    runtime.magnets.push({
      x: x - MAGNET_SIZE / 2,
      y: y - MAGNET_SIZE / 2,
      property: runtime.properties[runtime.magnets.length % runtime.properties.length],
    });
    renderD3Magnets(runtime);
    recomputeD3DustLayout(runtime);
  });

  const updateLensFromEvent = (event) => {
    if (runtime.selection.brushMode) {
      clearD3Lens(runtime);
      return;
    }
    const [x, y] = d3.pointer(event, runtime.plotRoot.node());
    runtime.lens.visible = true;
    runtime.lens.x = x;
    runtime.lens.y = y;
    renderD3Lens(runtime);
  };

  runtime.plotRoot
    .on(`mousemove.${runtime.name}-lens`, updateLensFromEvent)
    .on(`mouseleave.${runtime.name}-lens`, () => clearD3Lens(runtime))
    .on(`wheel.${runtime.name}-lens`, (event) => {
      if (runtime.selection.brushMode) return;
      event.preventDefault();
      const rawDelta = typeof event.deltaY === "number" ? event.deltaY : 0;
      if (!rawDelta) return;
      runtime.lens.r = Math.max(12, Math.min(96, runtime.lens.r + (rawDelta < 0 ? 3 : -3)));
      updateLensFromEvent(event);
    });

  runtime.brushBehavior = d3
    .brush()
    .extent([
      [0, 0],
      [PANEL_WIDTH, PANEL_HEIGHT],
    ])
    .on("start brush end", (event) => {
      if (!runtime.selection.brushMode) return;
      const selection = event.selection;
      runtime.selection.brushNodes = selection
        ? runtime.dustLayer.selectAll("circle").nodes().filter((node) => {
            const datum = d3.select(node).datum();
            return (
              datum.x >= selection[0][0] &&
              datum.x <= selection[1][0] &&
              datum.y >= selection[0][1] &&
              datum.y <= selection[1][1]
            );
          })
        : [];
      applyD3DustStyles(runtime);
    });

  runtime.brushLayer.call(runtime.brushBehavior);
  setD3BrushMode(runtime, false);

  d3.select(window)
    .on(`keydown.${runtime.name}-brush`, (event) => {
      if (matchesManualModifierKey(event)) {
        setD3BrushMode(runtime, true);
      }
    })
    .on(`keyup.${runtime.name}-brush`, (event) => {
      if (matchesManualModifierKey(event)) {
        setD3BrushMode(runtime, false);
      }
    })
    .on(`blur.${runtime.name}-brush`, () => {
      setD3BrushMode(runtime, false);
    });
}

function renderD3Panel(mountNode, sourceData) {
  const runtime = createD3Runtime(
    mountNode,
    "dustMagnetD3Compare",
    cloneDustMagnetData(sourceData)
  );
  renderD3Dust(runtime);
  renderD3Magnets(runtime);
  installD3Interactions(runtime);
}

async function renderPanels(container) {
  const sourceData = await loadDustMagnetData();
  const panels = [
    {
      mountId: "DustMagnetDslMount",
      statusId: "DustMagnetDslStatus",
      render: renderDslPanel,
      note: "DSL panel now matches the standalone Dust&Magnet example and mounts independently.",
    },
    {
      mountId: "DustMagnetNativeMount",
      statusId: "DustMagnetNativeStatus",
      render: async (mountNode, data) => renderNativeLibraPanel(mountNode, data),
      note: "Native LIBRA panel now includes BrushInstrument, ExcentricLabelingInstrument, and lens zoom.",
    },
    {
      mountId: "DustMagnetD3Mount",
      statusId: "DustMagnetD3Status",
      render: async (mountNode, data) => renderD3Panel(mountNode, data),
      note: "D3 panel now reimplements drag, click, brush, lens, and lens zoom without Libra interactions.",
    },
    {
      mountId: "DustMagnetVegaliteMount",
      statusId: "DustMagnetVegaliteStatus",
      render: async () => {},
      note: "Vega-Lite panel is currently an empty placeholder.",
    },
  ];

  for (const panel of panels) {
    const mountNode = container.querySelector(`#${panel.mountId}`);
    if (!mountNode) continue;

    try {
      // eslint-disable-next-line no-await-in-loop
      await panel.render(mountNode, sourceData);
      setStatus(container, panel.statusId, panel.note);
    } catch (error) {
      setStatus(container, panel.statusId, `Failed to mount: ${error.message}`, true);
    }
  }

  await Libra.createHistoryTrack?.();
}

export default async function initDustMagnetComparePage() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;

  disposeCodeEditors();
  container.innerHTML = renderPage();
  initCodeEditors(container);
  await renderPanels(container);
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}
