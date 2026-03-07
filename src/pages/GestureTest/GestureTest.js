import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

// Module-scoped constants
const MARGIN = { top: 30, right: 70, bottom: 40, left: 60 };
const WIDTH = 500 - MARGIN.left - MARGIN.right;
const HEIGHT = 380 - MARGIN.top - MARGIN.bottom;
const FIELD_X = "Horsepower";
const FIELD_Y = "Miles_per_Gallon";
const FIELD_COLOR = "Origin";

// Module-scoped variables
let data = [];
let x = null;
let y = null;
let color = null;

async function loadData() {
    // Ensure the path is correct. Assuming 'public' folder is served at '/public' or root.
    // Based on webpack config, it is likely copied to '/public'.
    try {
        data = (await d3.json("/public/data/cars.json")).filter(
            (d) => !!(d["Horsepower"] && d["Miles_per_Gallon"])
        );
    } catch (e) {
        console.error("Failed to load data from /public/data/cars.json. Trying /data/cars.json...", e);
        try {
            data = (await d3.json("/data/cars.json")).filter(
                (d) => !!(d["Horsepower"] && d["Miles_per_Gallon"])
            );
        } catch (e2) {
            console.error("Failed to load data.", e2);
        }
    }
}

function renderStaticVisualization() {
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
        .attr("viewbox", `0 0 ${WIDTH} ${HEIGHT}`)
        .append("g")
        .attr(
            "transform",
            "translate(" + MARGIN.left + "," + MARGIN.top + ")"
        );

    const extentX = [0, d3.max(data, (d) => d[FIELD_X])];
    const extentY = [0, d3.max(data, (d) => d[FIELD_Y])];

    // Add X axis
    x = d3
        .scaleLinear()
        .domain(extentX)
        .range([0, WIDTH])
        .nice()
        .clamp(true);
    svg
        .append("g")
        .attr("transform", "translate(0," + HEIGHT + ")")
        .call(d3.axisBottom(x))
        .append("text")
        .text(FIELD_X)
        .attr("fill", "black")
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("x", WIDTH / 2)
        .attr("y", 30);

    // Add Y axis
    y = d3
        .scaleLinear()
        .domain(extentY)
        .nice()
        .range([HEIGHT, 0])
        .clamp(true);
    svg
        .append("g")
        .call(d3.axisLeft(y))
        .append("text")
        .text(FIELD_Y)
        .attr("fill", "black")
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("writing-mode", "tb")
        .style(
            "transform",
            `translate(${-MARGIN.left / 2}px,${HEIGHT / 2
            }px) rotate(180deg)`
        );

    // Add Legend
    color = d3
        .scaleOrdinal()
        .domain(
            new Set(data.map((d) => d[FIELD_COLOR])).values()
        )
        .range(d3.schemeTableau10);
    svg
        .append("g")
        .call((g) =>
            g
                .append("text")
                .text(FIELD_COLOR)
                .attr("fill", "black")
                .attr("text-anchor", "middle")
                .attr("font-size", "12px")
                .attr("font-weight", "bold")
                .attr("x", WIDTH + MARGIN.right / 2)
                .attr("y", -MARGIN.top / 2)
        )
        .call((g) =>
            g
                .append("g")
                .selectAll("g")
                .data(
                    new Set(
                        data.map((d) => d[FIELD_COLOR])
                    ).values()
                )
                .join("g")
                .call((g) => {
                    g.append("circle")
                        .attr("fill-opacity", "0")
                        .attr("stroke-width", 2)
                        .attr("stroke", (d) => color(d))
                        .attr("cx", WIDTH + 10)
                        .attr("cy", (_, i) => i * 20)
                        .attr("r", 5);
                })
                .call((g) => {
                    g.append("text")
                        .text((d) => d)
                        .attr("font-size", "12px")
                        .attr("x", WIDTH + 20)
                        .attr("y", (_, i) => i * 20 + 5);
                })
        );
}

function renderMainVisualization() {
    // Find the SVG element on page
    const svg = d3.select("#LibraPlayground svg");

    // Create the main layer
    const mainLayer = Libra.Layer.initialize("D3Layer", {
        name: "mainLayer",
        width: WIDTH,
        height: HEIGHT,
        offset: { x: MARGIN.left, y: MARGIN.top },
        container: svg.node(),
    });
    const g = d3.select(mainLayer.getGraphic());

    // Draw points code from the input static visualization
    g.selectAll("circle")
        .data(data)
        .join("circle")
        .attr("class", "mark")
        .attr("fill", "none")
        .attr("stroke-width", 1)
        .attr("stroke", (d) => color(d[FIELD_COLOR]))
        .attr("cx", (d) => x(d[FIELD_X]))
        .attr("cy", (d) => y(d[FIELD_Y]))
        .attr("r", 5);

    return mainLayer;
}

async function mountInteraction(layer) {
    const interactions = [
        {
            Name: "lensMain",
            Instrument: "Lens",
            Trigger: "hover",
            "Target layer": "mainLayer",
            gesture: "stay",
            "Feedback options": {
                ExcentricLabeling: {
                    renderSelection: false,
                    r: 20,
                    stroke: "green",
                    strokeWidth: 2,
                    countLabelDistance: 20,
                    fontSize: 12,
                    countLabelWidth: 40,
                    maxLabelsNum: 10,
                    labelAccessor: (circleElem) => d3.select(circleElem).datum()["Origin"],
                    colorAccessor: (circleElem) => color(d3.select(circleElem).datum()[FIELD_COLOR]),
                    countAccessor: (circleElem) => d3.select(circleElem).datum()?.Horsepower,
                    countFormatter: (sum, { count }) => `${count} / ${Math.round(sum)}`
                },
            },
            stopPropagation: false,
        },
        {
            Name: "hoverTooltip",
            Trigger: "hover",
            "Target layer": "mainLayer",
            gesture: "motion",
            gestureMoveDelay: 300,
            "Feedback options": {
                Tooltip: {
                    prefix: "Car",
                    fields: ["Name", FIELD_X, FIELD_Y, FIELD_COLOR],
                    offset: { x: 12, y: -12 }
                }
            },
            stopPropagation: false
        }
    ];

    await compileInteractionsDSL(interactions, {
        layersByName: { mainLayer: layer },
    });
    // Check if createHistoryTrack exists in Libra
    if (typeof Libra.createHistoryTrack === 'function') {
        await Libra.createHistoryTrack();
    }
}

export default async function init() {
    await loadData();
    renderStaticVisualization();
    const mainLayer = renderMainVisualization();
    await mountInteraction(mainLayer);
}
