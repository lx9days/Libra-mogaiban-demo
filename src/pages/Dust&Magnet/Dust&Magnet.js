import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

// global constants
const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
const WIDTH = 600 - MARGIN.left - MARGIN.right;
const HEIGHT = 450 - MARGIN.top - MARGIN.bottom;

// module variables
let data = [];
let magnet = [];
let properties = [];
let tickUpdate = null;

async function loadData() {
    data = await d3.json("/public/data/cars.json");
    magnet = [];

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

    data = data.slice(0, 50).map((d) => ({
        ...d,
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

function renderDust(dustData = data) {
    d3.select("#LibraPlayground svg .dust")
        .selectAll("circle")
        .data(dustData)
        .join("circle")
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
                .attr("x", (d) => d.x + 50 / 2)
                .attr("y", (d) => d.y + 50 / 2)
                .attr("text-anchor", "middle")
                .text((d) => d.property)
        );
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
                        if (result && result.length) {
                            const datum = d3.select(result[0]).datum();
                            datum.x = offsetx - 25;
                            datum.y = offsety - 25;
                        } else if (offsetx && offsety) {
                            currentMagnets.push({
                                x: offsetx - 25,
                                y: offsety - 25,
                                property:
                                    properties[
                                    currentMagnets.length % properties.length
                                    ],
                            });
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

    const interactions = [
        {
            Trigger: "drag",
            targetLayer: "magnetLayer",
            customFeedbackFlow: {
                insert: commonInsertFlows,
                remove: [{ find: "SelectionTransformer" }],
            },
            layerOptions: { pointerEvents: "visiblePainted" },
            priority: 3,
            stopPropagation: true,
        },
        {
            Trigger: "click",
            targetLayer: "bgLayer",
            customFeedbackFlow: { insert: commonInsertFlows },
            priority: 1,
            stopPropagation: true,
        },
        {
            Trigger: "click",
            targetLayer: "dustLayer",
            layerOptions: { pointerEvents: "visiblePainted" },
            feedbackOptions: { Highlight: "greenyellow" },
            priority: 2,
            stopPropagation: true,
        },
        {
            Trigger: "brush",
            targetLayer: "dustLayer",
            ModifierKey: "Shift",
            feedbackOptions: { Highlight: "red" },
            priority: 4,
            stopPropagation: true,
        },
        {
                    Name: "lensMain",
                    Instrument: "Lens",
                    Trigger: "hover",
                    targetLayer: "dustLayer",
                    syntheticEvent:"idle",
                    feedbackOptions: {
                        ExcentricLabeling: {
                            renderSelection: false,
                            r: 20,
                            stroke: "green",
                            strokeWidth: 2,
                            countLabelDistance: 20,
                            fontSize: 12,
                            countLabelWidth: 40,
                            maxLabelsNum: 10,
                            labelAccessor: (circleElem) => d3.select(circleElem).datum()["Name"],
                            colorAccessor: (circleElem) => "black",
                            count: {
                                field: "Horsepower",
                                op: "sum",
                                formatter: (sum, { count }) => `${count}`,
                            },
                        },
                    },
                    stopPropagation: true,
                }
    ];

    compileInteractionsDSL(interactions, {
        layersByName: { bgLayer, dustLayer, magnetLayer },
    });

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
