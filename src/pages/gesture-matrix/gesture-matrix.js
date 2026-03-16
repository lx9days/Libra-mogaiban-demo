import * as d3 from "d3";
import Libra from "libra-vis";
import LibraManager from "../../core/LibraManager";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

const MARGIN = { top: 80, right: 20, bottom: 20, left: 80 };
const WIDTH = 500 - MARGIN.left - MARGIN.right;
const HEIGHT = 500 - MARGIN.top - MARGIN.bottom;

export default async function init() {
    const container = document.getElementById("LibraPlayground");
    if (!container) return;
    container.innerHTML = "";

    const { matrixData, names } = loadData();

    const svg = d3
        .select(container)
        .append("svg")
        .attr("width", WIDTH + MARGIN.left + MARGIN.right)
        .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom);

    const x = d3.scaleBand().domain(names).range([MARGIN.left, WIDTH + MARGIN.left]).padding(0.01);
    const y = d3.scaleBand().domain(names).range([MARGIN.top, HEIGHT + MARGIN.top]).padding(0.01);
    const color = d3
        .scaleLinear()
        .domain([0, 1])
        .range(["white", "steelblue"])
        .clamp(true);

    const cellLayer = LibraManager.getOrCreateLayer(svg, "cellLayer", WIDTH + MARGIN.left + MARGIN.right, HEIGHT + MARGIN.top + MARGIN.bottom);
    const xAxisLayer = LibraManager.getOrCreateLayer(svg, "xAxisLayer", WIDTH + MARGIN.left + MARGIN.right, MARGIN.top);
    const yAxisLayer = LibraManager.getOrCreateLayer(svg, "yAxisLayer", MARGIN.left, HEIGHT + MARGIN.top + MARGIN.bottom);

    renderMatrix(cellLayer, xAxisLayer, yAxisLayer, matrixData, names, x, y, color);

    await mountInteraction(cellLayer, names, x, y);
}

function renderMatrix(cellLayer, xAxisLayer, yAxisLayer, matrixData, names, x, y, color) {
    const cellG = d3.select(cellLayer.getGraphic());
    cellG.selectAll(".cell")
        .data(matrixData)
        .join("rect")
        .attr("class", "cell")
        .attr("x", (d) => x(d.col))
        .attr("y", (d) => y(d.row))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("fill", (d) => color(d.value));

    const xAxisG = d3.select(xAxisLayer.getGraphic());
    xAxisG.selectAll(".col-label")
        .data(names)
        .join("text")
        .attr("class", "col-label")
        .attr("x", (d) => x(d) + x.bandwidth() / 2)
        .attr("y", MARGIN.top - 5)
        .attr("text-anchor", "start")
        .attr("alignment-baseline", "baseline")
        .attr("transform", (d) => `rotate(-90, ${x(d) + x.bandwidth() / 2}, ${MARGIN.top - 5})`)
        .text((d) => d);

    const yAxisG = d3.select(yAxisLayer.getGraphic());
    yAxisG.selectAll(".row-label")
        .data(names)
        .join("text")
        .attr("class", "row-label")
        .attr("x", MARGIN.left - 5)
        .attr("y", (d) => y(d) + y.bandwidth() / 2)
        .attr("text-anchor", "end")
        .attr("alignment-baseline", "middle")
        .text((d) => d);
}

function loadData() {
    const names = [
        "Enjolras",
        "Eponine",
        "Fantine",
        "Gavroche",
        "Javert",
        "Marius",
        "Mme. Thenardier",
        "Myriel",
        "Thenardier",
        "Valjean",
    ];

    const miserables = {
        nodes: [
            { nodeName: "Myriel", group: 1 },
            { nodeName: "Napoleon", group: 1 },
            { nodeName: "Mlle. Baptistine", group: 1 },
            { nodeName: "Mme. Magloire", group: 1 },
            { nodeName: "Countess de Lo", group: 1 },
            { nodeName: "Geborand", group: 1 },
            { nodeName: "Champtercier", group: 1 },
            { nodeName: "Cravatte", group: 1 },
            { nodeName: "Count", group: 1 },
            { nodeName: "Old Man", group: 1 },
            { nodeName: "Labarre", group: 2 },
            { nodeName: "Valjean", group: 2 },
            { nodeName: "Marguerite", group: 3 },
            { nodeName: "Mme. de R", group: 2 },
            { nodeName: "Isabeau", group: 2 },
            { nodeName: "Gervais", group: 2 },
            { nodeName: "Tholomyes", group: 3 },
            { nodeName: "Listolier", group: 3 },
            { nodeName: "Fameuil", group: 3 },
            { nodeName: "Blacheville", group: 3 },
            { nodeName: "Favourite", group: 3 },
            { nodeName: "Dahlia", group: 3 },
            { nodeName: "Zephine", group: 3 },
            { nodeName: "Fantine", group: 3 },
            { nodeName: "Mme. Thenardier", group: 4 },
            { nodeName: "Thenardier", group: 4 },
            { nodeName: "Cosette", group: 5 },
            { nodeName: "Javert", group: 4 },
            { nodeName: "Fauchelevent", group: 0 },
            { nodeName: "Bamatabois", group: 2 },
            { nodeName: "Perpetue", group: 3 },
            { nodeName: "Simplice", group: 2 },
            { nodeName: "Scaufflaire", group: 2 },
            { nodeName: "Woman 1", group: 2 },
            { nodeName: "Judge", group: 2 },
            { nodeName: "Champmathieu", group: 2 },
            { nodeName: "Brevet", group: 2 },
            { nodeName: "Chenildieu", group: 2 },
            { nodeName: "Cochepaille", group: 2 },
            { nodeName: "Pontmercy", group: 4 },
            { nodeName: "Boulatruelle", group: 6 },
            { nodeName: "Eponine", group: 4 },
            { nodeName: "Anzelma", group: 4 },
            { nodeName: "Woman 2", group: 5 },
            { nodeName: "Mother Innocent", group: 0 },
            { nodeName: "Gribier", group: 0 },
            { nodeName: "Jondrette", group: 7 },
            { nodeName: "Mme. Burgon", group: 7 },
            { nodeName: "Gavroche", group: 8 },
            { nodeName: "Gillenormand", group: 5 },
            { nodeName: "Magnon", group: 5 },
            { nodeName: "Mlle. Gillenormand", group: 5 },
            { nodeName: "Mme. Pontmercy", group: 5 },
            { nodeName: "Mlle. Vaubois", group: 5 },
            { nodeName: "Lt. Gillenormand", group: 5 },
            { nodeName: "Marius", group: 8 },
            { nodeName: "Baroness T", group: 5 },
            { nodeName: "Mabeuf", group: 8 },
            { nodeName: "Enjolras", group: 8 },
            { nodeName: "Combeferre", group: 8 },
            { nodeName: "Prouvaire", group: 8 },
            { nodeName: "Feuilly", group: 8 },
            { nodeName: "Courfeyrac", group: 8 },
            { nodeName: "Bahorel", group: 8 },
            { nodeName: "Bossuet", group: 8 },
            { nodeName: "Joly", group: 8 },
            { nodeName: "Grantaire", group: 8 },
            { nodeName: "Mother Plutarch", group: 9 },
            { nodeName: "Gueulemer", group: 4 },
            { nodeName: "Babet", group: 4 },
            { nodeName: "Claquesous", group: 4 },
            { nodeName: "Montparnasse", group: 4 },
            { nodeName: "Toussaint", group: 5 },
            { nodeName: "Child 1", group: 10 },
            { nodeName: "Child 2", group: 10 },
            { nodeName: "Brujon", group: 4 },
            { nodeName: "Mme. Hucheloup", group: 8 },
        ],
        links: [
            { source: 1, target: 0, value: 1 },
            { source: 2, target: 0, value: 8 },
            { source: 3, target: 0, value: 10 },
            { source: 3, target: 2, value: 6 },
            { source: 4, target: 0, value: 1 },
            { source: 5, target: 0, value: 1 },
            { source: 6, target: 0, value: 1 },
            { source: 7, target: 0, value: 1 },
            { source: 8, target: 0, value: 2 },
            { source: 9, target: 0, value: 1 },
            { source: 11, target: 10, value: 1 },
            { source: 11, target: 3, value: 3 },
            { source: 11, target: 2, value: 3 },
            { source: 11, target: 0, value: 5 },
            { source: 12, target: 11, value: 1 },
            { source: 13, target: 11, value: 1 },
            { source: 14, target: 11, value: 1 },
            { source: 15, target: 11, value: 1 },
            { source: 17, target: 16, value: 4 },
            { source: 18, target: 16, value: 4 },
            { source: 18, target: 17, value: 4 },
            { source: 19, target: 16, value: 4 },
            { source: 19, target: 17, value: 4 },
            { source: 19, target: 18, value: 4 },
            { source: 20, target: 16, value: 3 },
            { source: 20, target: 17, value: 3 },
            { source: 20, target: 18, value: 3 },
            { source: 20, target: 19, value: 4 },
            { source: 21, target: 16, value: 3 },
            { source: 21, target: 17, value: 3 },
            { source: 21, target: 18, value: 3 },
            { source: 21, target: 19, value: 3 },
            { source: 21, target: 20, value: 5 },
            { source: 22, target: 16, value: 3 },
            { source: 22, target: 17, value: 3 },
            { source: 22, target: 18, value: 3 },
            { source: 22, target: 19, value: 3 },
            { source: 22, target: 20, value: 4 },
            { source: 22, target: 21, value: 4 },
            { source: 23, target: 16, value: 3 },
            { source: 23, target: 17, value: 3 },
            { source: 23, target: 18, value: 3 },
            { source: 23, target: 19, value: 3 },
            { source: 23, target: 20, value: 4 },
            { source: 23, target: 21, value: 4 },
            { source: 23, target: 22, value: 4 },
            { source: 23, target: 12, value: 2 },
            { source: 23, target: 11, value: 9 },
            { source: 24, target: 23, value: 2 },
            { source: 24, target: 11, value: 7 },
            { source: 25, target: 24, value: 13 },
            { source: 25, target: 23, value: 1 },
            { source: 25, target: 11, value: 12 },
            { source: 26, target: 24, value: 4 },
            { source: 26, target: 11, value: 31 },
            { source: 26, target: 16, value: 1 },
            { source: 26, target: 25, value: 1 },
            { source: 27, target: 11, value: 17 },
            { source: 27, target: 23, value: 5 },
            { source: 27, target: 25, value: 5 },
            { source: 27, target: 24, value: 1 },
            { source: 27, target: 26, value: 1 },
            { source: 28, target: 11, value: 8 },
            { source: 28, target: 27, value: 1 },
            { source: 29, target: 23, value: 1 },
            { source: 29, target: 27, value: 1 },
            { source: 29, target: 11, value: 2 },
            { source: 30, target: 23, value: 1 },
            { source: 31, target: 30, value: 2 },
            { source: 31, target: 11, value: 3 },
            { source: 31, target: 23, value: 2 },
            { source: 31, target: 27, value: 1 },
            { source: 32, target: 11, value: 1 },
            { source: 33, target: 11, value: 2 },
            { source: 33, target: 27, value: 1 },
            { source: 34, target: 11, value: 3 },
            { source: 34, target: 29, value: 2 },
            { source: 35, target: 11, value: 3 },
            { source: 35, target: 34, value: 3 },
            { source: 35, target: 29, value: 2 },
            { source: 36, target: 34, value: 2 },
            { source: 36, target: 35, value: 2 },
            { source: 36, target: 11, value: 2 },
            { source: 36, target: 29, value: 1 },
            { source: 37, target: 34, value: 2 },
            { source: 37, target: 35, value: 2 },
            { source: 37, target: 36, value: 2 },
            { source: 37, target: 11, value: 2 },
            { source: 37, target: 29, value: 1 },
            { source: 38, target: 34, value: 2 },
            { source: 38, target: 35, value: 2 },
            { source: 38, target: 36, value: 2 },
            { source: 38, target: 37, value: 2 },
            { source: 38, target: 11, value: 2 },
            { source: 38, target: 29, value: 1 },
            { source: 39, target: 25, value: 1 },
            { source: 40, target: 25, value: 1 },
            { source: 41, target: 24, value: 2 },
            { source: 41, target: 25, value: 3 },
            { source: 42, target: 41, value: 2 },
            { source: 42, target: 25, value: 2 },
            { source: 42, target: 24, value: 1 },
            { source: 43, target: 11, value: 3 },
            { source: 43, target: 26, value: 1 },
            { source: 43, target: 27, value: 1 },
            { source: 44, target: 28, value: 3 },
            { source: 44, target: 11, value: 1 },
            { source: 45, target: 28, value: 2 },
            { source: 47, target: 46, value: 1 },
            { source: 48, target: 47, value: 2 },
            { source: 48, target: 25, value: 1 },
            { source: 48, target: 27, value: 1 },
            { source: 48, target: 11, value: 1 },
            { source: 49, target: 26, value: 3 },
            { source: 49, target: 11, value: 2 },
            { source: 50, target: 49, value: 1 },
            { source: 50, target: 24, value: 1 },
            { source: 51, target: 49, value: 9 },
            { source: 51, target: 26, value: 2 },
            { source: 51, target: 11, value: 2 },
            { source: 52, target: 51, value: 1 },
            { source: 52, target: 39, value: 1 },
            { source: 53, target: 51, value: 1 },
            { source: 54, target: 51, value: 2 },
            { source: 54, target: 49, value: 1 },
            { source: 54, target: 26, value: 1 },
            { source: 55, target: 51, value: 6 },
            { source: 55, target: 49, value: 12 },
            { source: 55, target: 39, value: 1 },
            { source: 55, target: 54, value: 1 },
            { source: 55, target: 26, value: 21 },
            { source: 55, target: 11, value: 19 },
            { source: 55, target: 16, value: 1 },
            { source: 55, target: 25, value: 2 },
            { source: 55, target: 41, value: 5 },
            { source: 55, target: 48, value: 4 },
        ],
    };

    const nodeIndices = {};
    miserables.nodes.forEach((node, index) => {
        if (names.includes(node.nodeName)) {
            nodeIndices[node.nodeName] = index;
        }
    });

    const linkData = miserables.links.filter(
        (link) =>
            names.includes(miserables.nodes[link.source].nodeName) &&
            names.includes(miserables.nodes[link.target].nodeName)
    );

    const matrix = Array(names.length)
        .fill()
        .map(() => Array(names.length).fill(0));

    linkData.forEach((link) => {
        const sourceName = miserables.nodes[link.source].nodeName;
        const targetName = miserables.nodes[link.target].nodeName;
        const sourceIndex = names.indexOf(sourceName);
        const targetIndex = names.indexOf(targetName);
        matrix[sourceIndex][targetIndex] = link.value;
        matrix[targetIndex][sourceIndex] = link.value;
    });

    const matrixData = names.flatMap((rowName, i) =>
        names.map((colName, j) => ({
            row: rowName,
            col: colName,
            value: i === j ? 1 : matrix[i][j] / 3,
        }))
    );

    return { matrixData, names };
}

async function mountInteraction(cellLayer, names, scaleX, scaleY) {
    const reorderContext = {
        names,
        scales: { x: scaleX, y: scaleY },
        copyFrom: cellLayer,
        offset: { x: 0, y: 0 },
        autoRedraw: true,
    };
    const interactions = [
        {
            Instrument: "reordering",
            Trigger: "drag",
            targetLayer: "cellLayer",
            syntheticEvent: "start-horizontally",
            Direction: "x",
            feedbackOptions: {
                contextRef: {
                    ...reorderContext,
                },
            },
        },
        {
            Instrument: "reordering",
            Trigger: "drag",
            targetLayer: "cellLayer",
            syntheticEvent: "start-vertically",
            Direction: "y",
            feedbackOptions: {
                contextRef: {
                    ...reorderContext,
                },
            },
        },
    ];

    await compileInteractionsDSL(interactions, {
        layersByName: { cellLayer },
    });
    if (typeof Libra.createHistoryTrack === "function") {
        await Libra.createHistoryTrack();
    }
}
