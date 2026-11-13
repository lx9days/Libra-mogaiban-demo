import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";
import { compileDSL } from "../../scripts/dsl-compiler";

// global constants
const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
const WIDTH = 500 - MARGIN.left - MARGIN.right;
const HEIGHT = 450 - MARGIN.top - MARGIN.bottom;

// module variables
let data = [];
let magnet = [];
let properties = [];
let tickUpdate = null;
let originColor = null;
let lassoSelectionIds = [];
let lassoPoints = [];

async function loadData() {
    data = await d3.json("/public/data/cars.json");
    magnet = [];
    originColor = d3
        .scaleOrdinal()
        .domain(Array.from(new Set(data.map((d) => d.Origin).filter(Boolean))))
        .range(d3.schemeTableau10);

    const datum = data[0];
    properties = [];
    for (const property in datum) {
        const value = datum[property];
        if (typeof value === "number") {
            properties.push(property);
            // initialize 3 magnets
            if (magnet.length < 3) {
                magnet.push({
                    x:
                        WIDTH / 2 -
                        Math.pow(-1, magnet.length) *
                        (WIDTH / 2 - 100),
                    y:
                        HEIGHT / 2 -
                        Math.pow(-1, Math.floor(magnet.length / 2)) *
                        (HEIGHT / 2 - 100),
                    property,
                });
            }
        }
    }

    data = data.slice(0, 50).map((d, index) => ({
        ...d,
        __dustId: index,
        x: WIDTH / 2,
        y: HEIGHT / 2,
    }));
}

function renderStaticVisualization() {
    const container = document.getElementById("LibraPlayground");
    if (container) {
        container.innerHTML = "";
    }

    // append the svg object to the body of the page
    const svg = d3
        .select("#LibraPlayground")
        .append("svg")
        .attr(
            "width",
            WIDTH + MARGIN.left + MARGIN.right
        )
        .attr(
            "height",
            HEIGHT + MARGIN.top + MARGIN.bottom
        )
        .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
        .append("g")
        .attr(
            "transform",
            "translate(" + MARGIN.left + "," + MARGIN.top + ")"
        );
}

function renderMainVisualization() {
    // append the svg object to the body of the page
    const svg = d3.select("#LibraPlayground svg");

    // create layer
    const dustLayer = Libra.Layer.initialize("D3Layer", {
        name: "dustLayer",
        width: WIDTH,
        height: HEIGHT,
        offset: { x: MARGIN.left, y: MARGIN.top },
        container: svg.node(),
    });

    // Assuming getLayerFromQueue is a valid method on the initialized layer
    // If not, this might need adjustment, but preserving original logic for now.
    const magnetLayer = dustLayer.getLayerFromQueue("magnetLayer");
    const backgroundLayer = dustLayer.getLayerFromQueue("backgroundLayer");

    d3.select(dustLayer.getGraphic()).attr("class", "dust");
    d3.select(magnetLayer.getGraphic()).attr("class", "magnet");

    dustLayer.setLayersOrder({
        backgroundLayer: 0,
        dustLayer: 1,
        magnetLayer: 2,
    });

    d3.select(backgroundLayer.getGraphic())
        .select("rect")
        .attr("stroke", "#000")
        .attr("fill", "none")
        .attr("opacity", 1);

    renderDust();
    renderMagnet();

    return [backgroundLayer, dustLayer, magnetLayer];
}

function renderDust(dustData = data, selectedIds = lassoSelectionIds) {
    const selectedSet = new Set(selectedIds);
    d3.select("#LibraPlayground svg .dust")
        .selectAll("circle")
        .data(dustData, (d) => d.__dustId)
        .join("circle")
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y)
        .attr("stroke", (d) => (selectedSet.has(d.__dustId) ? "#c62828" : "#000"))
        .attr("stroke-width", (d) => (selectedSet.has(d.__dustId) ? 2 : 1))
        .attr("fill", (d) => (selectedSet.has(d.__dustId) ? "#ff8a80" : "#B9B9B9"))
        .attr("opacity", (d) => (selectedSet.has(d.__dustId) ? 1 : 0.9))
        .attr("r", (d) => (selectedSet.has(d.__dustId) ? 11 : 10));
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
                .attr("x", (d) => d.x + 50 / 2)
                .attr("y", (d) => d.y + 50 / 2)
                .attr("text-anchor", "middle")
                .text((d) => d.property)
        );
}

function getLayerLocalPoint(layer, clientX, clientY) {
    if (!layer || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
        return null;
    }

    const graphic = layer.getGraphic?.();
    if (!graphic) return null;

    const rect = graphic.getBoundingClientRect();
    return [clientX - rect.left, clientY - rect.top];
}

function renderLassoOverlay(layer, points = lassoPoints) {
    const graphic = layer?.getGraphic?.();
    if (!graphic) return;

    const overlay = d3
        .select(graphic)
        .selectAll(".lasso-overlay")
        .data([null])
        .join("g")
        .attr("class", "lasso-overlay")
        .style("pointer-events", "none");

    overlay.selectAll("*").remove();
    if (!Array.isArray(points) || points.length < 2) return;

    overlay
        .append("path")
        .attr("d", d3.line().curve(d3.curveLinearClosed)(points))
        .attr("fill", "#64b5f6")
        .attr("fill-opacity", 0.18)
        .attr("stroke", "#1976d2")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,3");
}

async function mountInteraction(bgLayer, dustLayer, magnetLayer) {
    Libra.helpers.globalHubManager.createHub("magnet-hub", "generic");

    const dustTransformer = Libra.GraphicalTransformer.initialize(
        "DustTransformer",
        {
            layer: dustLayer,
            sharedVar: { result: data },
            redraw({ transformer }) {
                const dusts = transformer.getSharedVar("result");
                data = dusts;
                renderDust(dusts);
                dustLayer.postUpdate();
            },
        }
    );

    const magnetTransformer = Libra.GraphicalTransformer.initialize(
        "MagnetTransformer",
        {
            layer: magnetLayer,
            sharedVar: { result: magnet },
            redraw({ transformer }) {
                const magnets = transformer.getSharedVar("result");
                renderMagnet(magnets);
            },
        }
    );

    const lassoTransformer = Libra.GraphicalTransformer.initialize(
        "DustLassoTransformer",
        {
            layer: dustLayer,
            sharedVar: {
                result: {
                    points: [],
                    selectedIds: [],
                },
            },
            redraw({ transformer }) {
                const result = transformer.getSharedVar("result") || {};
                lassoPoints = Array.isArray(result.points) ? result.points : [];
                lassoSelectionIds = Array.isArray(result.selectedIds)
                    ? result.selectedIds
                    : [];

                renderDust(data, lassoSelectionIds);
                renderLassoOverlay(bgLayer, lassoPoints);
                dustLayer.postUpdate();
            },
        }
    );

    // Get the hub and subscribe to changes to actively push data to DustLayoutService
    const hub = Libra.helpers.globalHubManager.getHub("magnet-hub");
    if (hub) {
        hub.subscribe(() => {
            const hubData = hub.get();
            const magnetData = hubData["magnet-position"];
            if (magnetData && magnetData.magnets) {
                const dustLayoutService = Libra.Service.getService("DustLayoutService");
                if (dustLayoutService) {
                    // Push data using setSharedVar
                    dustLayoutService.setSharedVar("magnets", magnetData.magnets);
                    // Actively trigger evaluation
                    const result = dustLayoutService.evaluate();

                    // Since we trigger it manually, we need to push the result to the transformer
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
                    name: "MagnetPositionService",
                    sharedVar: {
                        magnets: magnet,
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
                            datum.x = offsetx - 25;
                            datum.y = offsety - 25;
                        }

                        const hub = Libra.helpers.globalHubManager.getHub("magnet-hub");
                        if (hub) hub.set("magnet-position", { magnets: currentMagnets });

                        return currentMagnets;
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
                    sharedVar: { dusts: data, result: data, magnets: magnet },
                    evaluate({ dusts, magnets: serviceMagnets, self }) {
                        let magnets = serviceMagnets || magnet;

                        if (!magnets || !magnets.length) return dusts;

                        cancelAnimationFrame(tickUpdate);

                        const copyDusts = JSON.parse(JSON.stringify(dusts));

                        for (const magnet of magnets) {
                            const extent = d3.extent(
                                copyDusts.map((datum) => datum[magnet.property])
                            );
                            for (const dust of copyDusts) {
                                let x = dust.x;
                                let y = dust.y;
                                let dx = magnet.x;
                                let dy = magnet.y;
                                x += ((dx - x) * dust[magnet.property]) / 100 / extent[1];
                                y += ((dy - y) * dust[magnet.property]) / 100 / extent[1];

                                dust.x = x;
                                dust.y = y;
                            }
                        }

                        tickUpdate = requestAnimationFrame(() =>
                            self.setSharedVar("dusts", copyDusts)
                        );
                        return copyDusts;
                    },
                },
                dustTransformer,
            ],
        },
    ];

    const lassoInsertFlows = [
        {
            find: "SelectionService",
            flow: [
                {
                    comp: "DustLassoService",
                    name: "DustLassoService",
                    sharedVar: {
                        points: [],
                        dragging: false,
                        layer: bgLayer,
                    },
                    evaluate({
                        layer,
                        self,
                        x,
                        y,
                        startx,
                        starty,
                        currentx,
                        currenty,
                        endx,
                        endy,
                        skipPicking,
                    }) {
                        const isDragStart =
                            !skipPicking &&
                            Number.isFinite(x) &&
                            Number.isFinite(y) &&
                            Number.isFinite(startx) &&
                            Number.isFinite(starty) &&
                            currentx === startx &&
                            currenty === starty;
                        const isDragEnd =
                            !skipPicking &&
                            (!Number.isFinite(x) || x === 0) &&
                            (!Number.isFinite(y) || y === 0) &&
                            Number.isFinite(endx) &&
                            Number.isFinite(endy);

                        const point = getLayerLocalPoint(layer, currentx, currenty);
                        let points = Array.isArray(self.getSharedVar("points"))
                            ? [...self.getSharedVar("points")]
                            : [];
                        let dragging = self.getSharedVar("dragging") === true;

                        if (isDragStart) {
                            points = point ? [point] : [];
                            dragging = true;
                        } else if (dragging && point) {
                            const lastPoint = points[points.length - 1];
                            if (
                                !lastPoint ||
                                Math.hypot(
                                    lastPoint[0] - point[0],
                                    lastPoint[1] - point[1]
                                ) > 3
                            ) {
                                points.push(point);
                            }
                        }

                        if (isDragEnd) {
                            const endPoint = getLayerLocalPoint(layer, endx, endy);
                            const lastPoint = points[points.length - 1];
                            if (
                                endPoint &&
                                (!lastPoint ||
                                    Math.hypot(
                                        lastPoint[0] - endPoint[0],
                                        lastPoint[1] - endPoint[1]
                                    ) > 3)
                            ) {
                                points.push(endPoint);
                            }
                            dragging = false;
                        }

                        const selectedIds =
                            points.length >= 3
                                ? data
                                    .filter((dust) =>
                                        d3.polygonContains(points, [dust.x, dust.y])
                                    )
                                    .map((dust) => dust.__dustId)
                                : [];

                        self.setSharedVar("points", points);
                        self.setSharedVar("dragging", dragging);

                        return {
                            points,
                            selectedIds,
                            dragging,
                        };
                    },
                },
                lassoTransformer,
            ],
        },
    ];

    const interactions = [
        // {
        //     Name: "lensMain",
    ];
    
    const newDSLinteractions = [
        {
            instrument: "move",
            trigger: {
                type: "drag",
                priority: 7,
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
            name: "createMagnet",
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
                remove: [{ find: "SelectionTransformer" }],
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
                priority: 8,
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
        // Unfinished lasso interaction: keep its configuration for future work.
        /* {
            name: "dustLassoByMove",
            instrument: "move",
            trigger: {
                type: "drag",
                priority: 6,
                // Let a stationary mouseup reach the click interactions.
                stopPropagation: false,
            },
            target: {
                layer: "bgLayer",
            },
            feedback: {},
            customFeedbackFlow: {
                insert: lassoInsertFlows,
                remove: [{ find: "SelectionTransformer" }],
            },
        }, */
        {
            name: "dustLens",
            instrument: "lens",
            trigger: {
                type: "hover",
                priority: 1,
                stopPropagation: true,
                syntheticEvent:"idle"
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
                            formatter: (value, { count }) => `count: ${count} / maxHorsepower${Math.round(value || 0)}`,
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

    // await compileInteractionsDSL(interactions, {
    //     layersByName: { bgLayer, dustLayer, magnetLayer },
    // });

    const compiled = await compileDSL(newDSLinteractions, {
        layersByName: { bgLayer, dustLayer, magnetLayer },
    }, { execute: true });

    // Commit only a confirmed click, not the SelectionService's press/release
    // evaluations: the same background press may become a lasso drag.
    const createMagnetIndex = compiled.compilePlans.findIndex((plan) => plan.name === "createMagnet");
    const [createMagnetInstrument] = compiled.executions[createMagnetIndex];
    createMagnetInstrument.on("click", ({ event }) => {
        const [x, y] = d3.pointer(event, bgLayer.getGraphic());
        magnet.push({ x: x - 25, y: y - 25, property: properties[magnet.length % properties.length] });
        renderMagnet();
    });

    const labelLayer = dustLayer.getLayerFromQueue("LabelLayer");
    const lensLayer = dustLayer.getLayerFromQueue("LensLayer");
    if (labelLayer?.getGraphic) {
        d3.select(labelLayer.getGraphic()).style("pointer-events", "none");
    }
    if (lensLayer?.getGraphic) {
        d3.select(lensLayer.getGraphic()).style("pointer-events", "none");
    }

    if (Libra.createHistoryTrack) {
        await Libra.createHistoryTrack();
    }
}

export default async function init() {
    await loadData();
    renderStaticVisualization();
    const [bgLayer, dustLayer, magnetLayer] = renderMainVisualization();
    await mountInteraction(bgLayer, dustLayer, magnetLayer);
}
