import * as d3 from "d3";
import Libra from "libra-vis";
import LibraManager from "../../core/LibraManager";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

const MARGIN = { top: 40, right: 120, bottom: 50, left: 140 };
const WIDTH = 700 - MARGIN.left - MARGIN.right;
const HEIGHT = 600 - MARGIN.top - MARGIN.bottom;
const YEARS_TO_SHOW = 8;
const MAX_TOPIC_LABEL_CHARS = 18;
const AXIS_FONT_SIZE_PX = 13;
const LEGEND_FONT_SIZE_PX = 12;

function formatTopicLabel(name) {
    const text = typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
    if (text.length <= MAX_TOPIC_LABEL_CHARS) return text;
    return `${text.slice(0, MAX_TOPIC_LABEL_CHARS - 1)}…`;
}

export default async function init() {
    const container = document.getElementById("LibraPlayground");
    if (!container) return;
    container.innerHTML = "";

    const { data, topics } = await loadData();

    const svg = d3
        .select(container)
        .append("svg")
        .attr("width", WIDTH + MARGIN.left + MARGIN.right)
        .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom);

    const dateExtent = d3.extent(data, (d) => d.date);
    const xScale = d3.scaleTime().domain(dateExtent).range([0, WIDTH]);
    
    const yScale = d3
        .scaleBand()
        .domain(topics)
        .range([MARGIN.top, HEIGHT + MARGIN.top])
        .padding(0.35);
    const reorderScaleX = d3.scaleBand().domain(topics).range([0, topics.length]).padding(0);

    const unempExtent = d3.extent(data, (d) => d.unemployment);
    const maxUnemp = unempExtent[1] ?? 0;
    const rScale = d3.scaleSqrt().domain([0, maxUnemp]).range([2, 25]);
    
    // Add color scale based on unemployment rate
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain(unempExtent);

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

    renderCategoricalPlot(plotLayer, xAxisLayer, yAxisLayer, data, topics, xScale, yScale, rScale, colorScale);
    renderLegend(svg, colorScale, WIDTH + MARGIN.left);
    await mountInteraction(plotLayer, xAxisLayer, yAxisLayer, data, topics, reorderScaleX, yScale, xScale, rScale, colorScale);
}

function renderLegend(svg, colorScale, xPos) {
    const legendWidth = 10;
    const legendHeight = 200;
    const legendMargin = { top: 10, right: 20 };
    
    // Remove existing legend
    svg.selectAll(".legend-group").remove();

    const legendG = svg.append("g")
        .attr("class", "legend-group")
        .attr("transform", `translate(${xPos + 30}, ${legendMargin.top + MARGIN.top})`);

    // Create gradient
    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "linear-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%"); // Vertical gradient

    linearGradient.selectAll("stop")
        .data(d3.range(0, 1.1, 0.1))
        .join("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d => colorScale(d * (colorScale.domain()[1] - colorScale.domain()[0]) + colorScale.domain()[0]));

    // Draw legend rectangle
    legendG.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#linear-gradient)");

    // Add scale
    const legendScale = d3.scaleLinear()
        .domain(colorScale.domain())
        .range([0, legendHeight]);

    const legendAxis = d3.axisRight(legendScale)
        .ticks(5)
        .tickFormat(d => d + "%")
        .tickSize(5);

    legendG.append("g")
        .attr("transform", `translate(${legendWidth}, 0)`)
        .call(legendAxis)
        .call((g) => g.select(".domain").remove())
        .selectAll("text")
        .style("font-size", `${LEGEND_FONT_SIZE_PX}px`);
        
    // Add title
    legendG.append("text")
        .attr("x", -10)
        .attr("y", -10)
        .style("font-size", `${LEGEND_FONT_SIZE_PX}px`)
        .style("fill", "#333")
        .text("Unemployment (%)");
}

async function loadData() {
    const rawData = await d3.csv("/public/data/bls-metro-unemployment.csv");
    const parseDate = d3.timeParse("%Y-%m-%d");
    
    // Process raw data
    const allData = rawData.map(d => ({
        division: (() => {
            const cityPart = d.division.split(",")[0];
            const words = cityPart.split(/[- ]+/);
            return words.length > 1 ? words[1] : words[0];
        })(), // Keep only the second word of the city name
        date: parseDate(d.date),
        year: parseDate(d.date).getFullYear(),
        unemployment: +d.unemployment
    })).filter(d => d.date && d.division);

    // Filter for last 5 years
    const maxYear = d3.max(allData, d => d.year);
    const processedData = allData.filter(d => d.year > maxYear - 5);

    // Calculate average unemployment per division to find the most interesting ones
    const divisionStats = d3.rollups(
        processedData,
        v => d3.mean(v, d => d.unemployment),
        d => d.division
    ).sort((a, b) => b[1] - a[1]); // Sort by avg unemployment desc

    // Select top 5 divisions with highest unemployment (Simplified from 15)
    const topDivisions = new Set(divisionStats.slice(0, 5).map(d => d[0]));
    const topics = Array.from(topDivisions).sort();

    // Aggregate by year for selected divisions
    const data = d3.rollups(
        processedData.filter(d => topDivisions.has(d.division)),
        v => d3.mean(v, d => d.unemployment),
        d => d.division,
        d => d.year
    ).flatMap(([division, years]) => 
        years.map(([year, avgUnemployment]) => ({
            division,
            year,
            date: new Date(year, 0, 1),
            unemployment: avgUnemployment
        }))
    );

    const dataMaxYear = d3.max(data, d => d.year) ?? 0;
    const minYear = dataMaxYear - (YEARS_TO_SHOW - 1);
    const filteredData = data.filter(d => d.year >= minYear);

    return { data: filteredData, topics };
}

function renderCategoricalPlot(plotLayer, xAxisLayer, yAxisLayer, data, topics, xScale, yScale, rScale, colorScale) {
    const plotG = d3.select(plotLayer.getGraphic());
    plotG.selectAll("*").remove();
    
    // Main plot group with margin translation
    const g = plotG.append("g")
        .attr("class", "main-group")
        .attr("transform", `translate(${MARGIN.left}, 0)`);

    g.selectAll("line.grid-line")
        .data(topics)
        .join("line")
        .attr("class", "grid-line")
        .attr("x1", 0)
        .attr("x2", WIDTH)
        .attr("y1", (d) => yScale(d) + yScale.bandwidth() / 2)
        .attr("y2", (d) => yScale(d) + yScale.bandwidth() / 2)
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");

    g.selectAll("circle.dot")
        .data(data)
        .join("circle")
        .attr("class", "dot")
        .attr("cx", (d) => xScale(d.date))
        .attr("cy", (d) => yScale(d.division) + yScale.bandwidth() / 2)
        .attr("r", (d) => rScale(d.unemployment))
        .attr("fill", (d) => colorScale(d.unemployment))
        .attr("fill-opacity", 0.8)
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .selectAll("title")
        .data((d) => [d])
        .join("title")
        .text((d) => `${d.division} · ${d.year}\n${d.unemployment.toFixed(1)}%`);

    const yAxisG = d3.select(yAxisLayer.getGraphic());
    yAxisG.selectAll("*").remove();
    yAxisG
        .append("g")
        .attr("transform", `translate(${MARGIN.left - 50}, 0)`)
        .call(d3.axisLeft(yScale).tickSize(0))
        .call((g) => g.select(".domain").remove())
        .selectAll("text")
        .style("font-size", "14px"); // Increased font size

    const xAxisG = d3.select(xAxisLayer.getGraphic());
    xAxisG.selectAll("*").remove();
    xAxisG
        .append("g")
        .attr("transform", `translate(${MARGIN.left}, 0)`) // xAxisLayer is already positioned at bottom
        .call(d3.axisBottom(xScale).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("'%y")))
        .selectAll("text")
        .style("font-size", `${AXIS_FONT_SIZE_PX}px`);
}

async function mountInteraction(plotLayer, xAxisLayer, yAxisLayer, data, topics, reorderScaleX, yScale, xScale, rScale, colorScale) {
    const redraw = (newTopics, _newX, newY) => {
        renderCategoricalPlot(plotLayer, xAxisLayer, yAxisLayer, data, newTopics, xScale, newY || yScale, rScale, colorScale);
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

    await Libra.createHistoryTrack();
}
