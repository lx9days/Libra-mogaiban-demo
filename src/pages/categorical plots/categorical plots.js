import * as d3 from "d3";
import Libra from "libra-vis";
import LibraManager from "../../core/LibraManager";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

const MARGIN = { top: 40, right: 40, bottom: 50, left: 180 };
const WIDTH = 850 - MARGIN.left - MARGIN.right;
const HEIGHT = 500 - MARGIN.top - MARGIN.bottom;

export default async function init() {
    const container = document.getElementById("LibraPlayground");
    if (!container) return;
    container.innerHTML = "";

    const { data, topics } = loadData();

    const svg = d3
        .select(container)
        .append("svg")
        .attr("width", WIDTH + MARGIN.left + MARGIN.right)
        .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom);

    const xScale = d3.scaleLinear().domain([2015, 2024]).range([MARGIN.left, WIDTH + MARGIN.left]);
    const yScale = d3
        .scaleBand()
        .domain(topics)
        .range([MARGIN.top, HEIGHT + MARGIN.top])
        .padding(0.35);
    const reorderScaleX = d3.scaleBand().domain(topics).range([0, topics.length]).padding(0);

    const maxCount = d3.max(data, (d) => d.count) ?? 0;
    const rScale = d3.scaleSqrt().domain([0, maxCount]).range([2, 12]);

    const plotLayer = LibraManager.getOrCreateLayer(
        svg,
        "plotLayer",
        WIDTH + MARGIN.left + MARGIN.right,
        HEIGHT + MARGIN.top + MARGIN.bottom
    );
    const xAxisLayer = LibraManager.getOrCreateLayer(
        svg,
        "xAxisLayer",
        WIDTH + MARGIN.left + MARGIN.right,
        MARGIN.bottom,
        0,
        HEIGHT + MARGIN.top
    );
    const yAxisLayer = LibraManager.getOrCreateLayer(svg, "yAxisLayer", MARGIN.left, HEIGHT + MARGIN.top + MARGIN.bottom);

    renderCategoricalPlot(plotLayer, xAxisLayer, yAxisLayer, data, topics, xScale, yScale, rScale);
    await mountInteraction(plotLayer, xAxisLayer, yAxisLayer, data, topics, reorderScaleX, yScale, xScale, rScale);
}

function loadData() {
    const topics = [
        "Artificial Intelligence",
        "Human-Computer Interaction",
        "Data Visualization",
        "Virtual Reality",
        "Machine Learning",
        "Natural Language Processing",
        "Robotics",
    ];

    const random = d3.randomLcg(0.42);
    const data = [];
    topics.forEach((topic) => {
        for (let year = 2015; year <= 2024; year += 1) {
            if (random() > 0.25) {
                data.push({
                    topic,
                    year,
                    count: Math.floor(random() * 20) + 1,
                });
            }
        }
    });

    return { data, topics };
}

function renderCategoricalPlot(plotLayer, xAxisLayer, yAxisLayer, data, topics, xScale, yScale, rScale) {
    const plotG = d3.select(plotLayer.getGraphic());
    plotG.selectAll("*").remove();

    plotG
        .selectAll("rect.row-hit")
        .data(topics, (d) => d)
        .join("rect")
        .attr("class", "row-hit")
        .attr("x", MARGIN.left)
        .attr("y", (d) => yScale(d))
        .attr("width", WIDTH)
        .attr("height", yScale.bandwidth())
        .attr("fill", "transparent")
        .attr("stroke", "none");

    plotG
        .selectAll("line.grid-line")
        .data(topics, (d) => d)
        .join("line")
        .attr("class", "grid-line")
        .attr("x1", MARGIN.left)
        .attr("x2", WIDTH + MARGIN.left)
        .attr("y1", (d) => yScale(d) + yScale.bandwidth() / 2)
        .attr("y2", (d) => yScale(d) + yScale.bandwidth() / 2)
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");

    plotG
        .selectAll("circle.dot")
        .data(data)
        .join("circle")
        .attr("class", "dot")
        .attr("cx", (d) => xScale(d.year))
        .attr("cy", (d) => yScale(d.topic) + yScale.bandwidth() / 2)
        .attr("r", (d) => rScale(d.count))
        .attr("fill", "teal")
        .attr("fill-opacity", 0.7)
        .attr("stroke", "#005a5a")
        .attr("stroke-width", 1.5);

    const yAxisG = d3.select(yAxisLayer.getGraphic());
    yAxisG.selectAll("*").remove();
    yAxisG
        .append("g")
        .attr("transform", `translate(${MARGIN.left},0)`)
        .call(d3.axisLeft(yScale).tickSize(0))
        .call((g) => g.select(".domain").remove());

    const xAxisG = d3.select(xAxisLayer.getGraphic());
    xAxisG.selectAll("*").remove();
    xAxisG
        .append("g")
        .call(d3.axisBottom(xScale).tickValues(d3.range(2015, 2025)).tickFormat(d3.format("d")));
}

async function mountInteraction(plotLayer, xAxisLayer, yAxisLayer, data, topics, reorderScaleX, yScale, xScale, rScale) {
    const redraw = (newTopics, _newX, newY) => {
        renderCategoricalPlot(plotLayer, xAxisLayer, yAxisLayer, data, newTopics, xScale, newY || yScale, rScale);
    };

    const interactions = [
        {
            Instrument: "reordering",
            Trigger: "Drag",
            "Target layer": "yAxisLayer",
            Direction: "y",
            "Feedback options": {
                redrawRef: redraw,
                contextRef: {
                    names: topics,
                    scales: { x: reorderScaleX, y: yScale },
                    copyFrom: plotLayer,
                    offset: { x: 0, y: 0 },
                },
            },
        },
    ];

    await compileInteractionsDSL(interactions, {
        layersByName: { yAxisLayer },
    });

    await Libra.createHistoryTrrack();
}
