import * as d3 from "d3";
import Libra from "libra-vis";
import { compileDSL } from "../../scripts/dsl-compiler";

const MAP_WIDTH = 840;
const MAP_HEIGHT = 608;
const PANEL_WIDTH = 250;
const LOW_ZOOM = 1.35;
const HIGH_ZOOM = 2.55;
const LASSO_MIN_AREA = 180;

let counties = [];
let labels_overview = [];
let labels_county = [];
let labels_detail = [];

let projection = null;
let path = null;
let colorScale = null;
let svg = null;
let mapRoot = null;
let labelsRoot = null;
let panelRoot = null;
let countiesSelection = null;

let x = null;
let y = null;

let clickedIds = new Set();
let lassoIds = new Set();
let hoveredId = null;
let interactions = [];


export default async function init() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;
  container.innerHTML = "";

  clickedIds = new Set();
  lassoIds = new Set();
  hoveredId = null;

  const shell = buildLayout(container);
  svg = shell.svg;
  panelRoot = shell.panel;
  labelsRoot = shell.labels;
  mapRoot = shell.mapRoot;

  counties = await loadCounties();
  setupProjection();

  x = d3.scaleLinear().domain([0, 1]).range([0, 1]);
  y = d3.scaleLinear().domain([0, 1]).range([0, 1]);

  const [layer, transformer] = renderMainVisualization();
  await mountInteraction(layer, transformer);
}

function buildLayout(container) {
  const shell = d3
    .select(container)
    .append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "14px");

  shell
    .append("div")
    .html(`
      <div style="font:700 26px/1.1 Iowan Old Style, Palatino Linotype, serif;color:#1f2937;">Semantic Geomap</div>
    `);

  const content = shell
    .append("div")
    .style("display", "grid")
    .style("grid-template-columns", `${MAP_WIDTH}px ${PANEL_WIDTH}px`)
    .style("gap", "16px")
    .style("align-items", "start");

  const svgSelection = content
    .append("svg")
    .attr("width", MAP_WIDTH)
    .attr("height", MAP_HEIGHT)
    .attr("viewBox", `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
    .style("background", "#f8fafc")
    .style("border", "1px solid #d7dde5")
    .style("border-radius", "22px")
    .style("box-shadow", "0 14px 34px rgba(15, 23, 42, 0.08)")
    .style("touch-action", "none");

  svgSelection.append("rect").attr("width", MAP_WIDTH).attr("height", MAP_HEIGHT).attr("fill", "#f8fafc");

  const map = svgSelection.append("g").attr("class", "mainLayer");
  const labels = svgSelection.append("g").style("pointer-events", "none");

  const panel = content.append("div").style("display", "flex").style("flex-direction", "column").style("gap", "10px");
  return { svg: svgSelection, panel, labels, mapRoot: map };
}

async function loadCounties() {
  let topology = null;
  try {
    topology = await d3.json("./public/data/ncmap_pop_density_topojson.json");
  } catch (error) {
    topology = await d3.json("/data/ncmap_pop_density_topojson.json");
  }

  const countyCollection = topologyToFeatureCollection(topology, topology.objects.ncmap);
  const processedCounties = countyCollection.features.map((feature, index) => ({
    ...feature,
    id: String(feature.id ?? feature.properties?.FIPS ?? index),
    properties: {
      ...feature.properties,
      density: Number(feature.properties?.density_land_area_population) || 0,
      population: Number(String(feature.properties?.population || "").replace(/[^\d.]/g, "")) || 0,
      housingUnits: Number(feature.properties?.housing_units) || 0,
    },
  }));

  const densityRanked = processedCounties.slice().sort((a, b) => b.properties.density - a.properties.density);
  labels_overview = densityRanked.slice(0, 8);
  labels_county = densityRanked.slice(0, 18);
  labels_detail = processedCounties;

  return processedCounties;
}

function setupProjection() {
  projection = d3.geoIdentity().fitExtent([[26, 26], [MAP_WIDTH - 26, MAP_HEIGHT - 26]], { type: "FeatureCollection", features: counties });
  path = d3.geoPath(projection);
  counties.forEach((county) => {
    county.centroid = path.centroid(county);
  });
  colorScale = d3.scaleSequential(d3.interpolateYlGnBu).domain(d3.extent(counties, (d) => d.properties.density));
}

function renderMap() {
  countiesSelection = mapRoot
    .selectAll("path.county")
    .data(counties, (d) => d.id)
    .join("path")
    .attr("class", "county mark")
    .attr("d", path)
    .attr("fill", (d) => colorScale(d.properties.density))
    .attr("stroke-linejoin", "round");
}


function renderMainVisualization() {
  const mainLayer = Libra.Layer.initialize("D3Layer", {
    name: "mainLayer",
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    offset: { x: 0, y: 0 },
    container: svg.node(),
  });

  // Re-attach our mapRoot and labelsRoot to the layer's graphic
  const layerGraphic = d3.select(mainLayer.getGraphic());
  
  // We need to move existing elements into the layer
  layerGraphic.node().appendChild(mapRoot.node());
  layerGraphic.node().appendChild(labelsRoot.node());

  Libra.GraphicalTransformer.register("DrawMapAndLabels", {
      sharedVar: {
        scaleX: x,
        scaleY: y,
        labelData: labels_overview,
        detailLevel: "overview",
      },
      redraw({ transformer }) {
        const scaleX = transformer.getSharedVar("scaleX");
        const scaleY = transformer.getSharedVar("scaleY");
        const labelData = transformer.getSharedVar("labelData");
        const detailLevel = transformer.getSharedVar("detailLevel");

        const k = scaleX(1) - scaleX(0);
        mapRoot.attr("transform", `translate(${scaleX(0)}, ${scaleY(0)}) scale(${k})`);

        renderMap();
        applyView(k);
        renderSemanticLabels(labelData, detailLevel, scaleX, scaleY);
      },
    });

  const transformer = Libra.GraphicalTransformer.initialize("DrawMapAndLabels", {
    layer: mainLayer,
  });

  return [mainLayer, transformer];
}

function applyView(k) {
  const selected = new Set([...clickedIds, ...lassoIds]);
  const active = selected.size > 0;
  countiesSelection
    .attr("fill-opacity", (d) => {
      if (hoveredId === d.id) return 1;
      if (active) return selected.has(d.id) ? 0.96 : 0.26;
      return 0.82;
    })
    .attr("stroke", (d) => {
      if (hoveredId === d.id) return "#0f172a";
      if (clickedIds.has(d.id)) return "#be185d";
      if (lassoIds.has(d.id)) return "#0f766e";
      return "#ffffff";
    })
    .attr("stroke-width", (d) => {
      if (hoveredId === d.id) return 2.4 / Math.sqrt(k);
      if (clickedIds.has(d.id)) return 2.1 / Math.sqrt(k);
      if (lassoIds.has(d.id)) return 1.7 / Math.sqrt(k);
      return 0.85 / Math.sqrt(k);
    });
}

function renderSemanticLabels(baseLabelData, detailLevel, scaleX, scaleY) {
  const selected = new Set([...clickedIds, ...lassoIds]);
  const focusIds = new Set([...selected, hoveredId].filter(Boolean));
  
  // Always include focused counties in the label data
  let labelData = mergeById(counties.filter((d) => focusIds.has(d.id)), baseLabelData);
  
  labelData = labelData.filter((county) => {
    const cx = scaleX(county.centroid[0]);
    const cy = scaleY(county.centroid[1]);
    county.screenLabel = [cx, cy];
    return cx > 8 && cx < MAP_WIDTH - 8 && cy > 8 && cy < MAP_HEIGHT - 8;
  });
  
  const labels = labelsRoot.selectAll("g.county-label").data(labelData, (d) => d.id).join((enter) => {
    const g = enter.append("g").attr("class", "county-label");
    g.append("text").attr("class", "county-name");
    g.append("text").attr("class", "county-meta");
    return g;
  });
  
  labels.attr("transform", (d) => `translate(${d.screenLabel[0]}, ${d.screenLabel[1]})`);
  labels.select(".county-name").attr("text-anchor", "middle").attr("dy", detailLevel === "detail" ? "-0.18em" : "0.32em").attr("fill", (d) => (focusIds.has(d.id) ? "#0f172a" : "#334155")).style("font", `600 ${detailLevel === "detail" ? 11 : 10}px system-ui`).style("paint-order", "stroke").style("stroke", "rgba(248,250,252,0.96)").style("stroke-width", 4).text((d) => d.properties.county);
  labels.select(".county-meta").attr("text-anchor", "middle").attr("dy", "1.05em").attr("fill", "#475569").style("font", "500 10px system-ui").style("paint-order", "stroke").style("stroke", "rgba(248,250,252,0.96)").style("stroke-width", 3).text((d) => (detailLevel === "detail" ? `${d.properties.density.toFixed(0)} / sq mi` : "")).attr("display", detailLevel === "detail" ? null : "none");
}

async function mountInteraction(layer, transformer) {
  const interactions = [
    {
      instrument: "pan",
      trigger: {
        type: "pan",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        context: {
          fixRange: true,
          scaleX: x,
          scaleY: y,
        },
      },
    },
    {
      instrument: "zoom",
      trigger: {
        type: "zoom",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        context: {
          semantic: true,
          scaleLevels: {
            0: { labelData: labels_overview, detailLevel: "overview" },
            1.35: { labelData: labels_county, detailLevel: "county" },
            2.55: { labelData: labels_detail, detailLevel: "detail" },
          },
          fixRange: true,
          scaleX: x,
          scaleY: y,
        },
      },
    },
  ];

  await compileDSL(interactions, {
    layersByName: {
      mainLayer: layer,
    },
  }, { execute: true });

  if (Libra.createHistoryTrack) {
    await Libra.createHistoryTrack();
  }
}


function mergeById(...groups) {
  const map = new Map();
  groups.flat().forEach((item) => {
    if (item && !map.has(item.id)) map.set(item.id, item);
  });
  return Array.from(map.values());
}

function formatInteger(value) {
  return Number.isFinite(value) ? d3.format(",")(value) : "0";
}

function topologyToFeatureCollection(topology, object) {
  const geometries = object.type === "GeometryCollection" ? object.geometries : [{ ...object }];
  return { type: "FeatureCollection", features: geometries.flatMap((geometry) => geometryToFeatures(topology, geometry)) };
}

function geometryToFeatures(topology, geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [buildFeature(geometry, polygonCoordinates(topology, geometry.arcs))];
  if (geometry.type === "MultiPolygon") return [buildFeature(geometry, geometry.arcs.map((polygon) => polygonCoordinates(topology, polygon)), "MultiPolygon")];
  return [];
}

function buildFeature(geometry, coordinates, type = "Polygon") {
  return { type: "Feature", id: geometry.id, properties: geometry.properties || {}, geometry: { type, coordinates } };
}

function polygonCoordinates(topology, polygonArcs) {
  return polygonArcs.map((ringArcs) => stitchRing(topology, ringArcs));
}

function stitchRing(topology, ringArcs) {
  const ring = [];
  ringArcs.forEach((arcIndex, index) => {
    const decoded = decodeArc(topology, arcIndex);
    if (index === 0) ring.push(...decoded);
    else ring.push(...decoded.slice(1));
  });
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push([...first]);
  return ring;
}

function decodeArc(topology, arcIndex) {
  const sourceIndex = arcIndex >= 0 ? arcIndex : ~arcIndex;
  const rawArc = topology.arcs[sourceIndex] || [];
  const scale = topology.transform?.scale || [1, 1];
  const translate = topology.transform?.translate || [0, 0];
  let x = 0;
  let y = 0;
  const decoded = rawArc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
  return arcIndex >= 0 ? decoded : decoded.reverse();
}
