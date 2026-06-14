import * as d3 from "d3";
import Libra from "libra-vis";

const MAP_WIDTH = 840;
const MAP_HEIGHT = 608;
const PANEL_WIDTH = 250;
const LOW_ZOOM = 1.35;
const HIGH_ZOOM = 2.55;
const LASSO_MIN_AREA = 180;
const CHINA_PROVINCES_URL = "https://raw.githubusercontent.com/xyanmi/MapData/main/provinces.cn.geojson";

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

  renderMainVisualization();
  renderTrajectories();
}

function renderTrajectories() {
  // 中国的几个主要城市的经纬度坐标（经度, 纬度）
  const trajectory1 = [
    { coords: [116.4074, 39.9042], time: "08:00", opacity: 0.5, city: "北京" }, // 北京
    { coords: [121.4737, 31.2304], time: "09:00", opacity: 1, marker: "住所重合", city: "上海" }, // 上海 - 交点1
    { coords: [113.2644, 23.1291], time: "10:00", opacity: 1, city: "广州" }, // 广州 - 同行路段起点
    { coords: [114.0579, 22.5431], time: "11:00", opacity: 1, city: "深圳" }, // 深圳 - 同行路段终点
    { coords: [104.0668, 30.5728], time: "12:00", opacity: 0.5, city: "成都" }, // 成都
    { coords: [120.1551, 30.2741], time: "13:00", opacity: 1, marker: "住所重合", city: "杭州" }, // 杭州 - 交点2
    { coords: [118.7969, 32.0603], time: "14:00", opacity: 0.5, city: "南京" }, // 南京
  ];

  const trajectory2 = [
    { coords: [117.0009, 36.6758], time: "08:30", opacity: 0.5, city: "济南" }, // 济南
    { coords: [121.4737, 31.2304], time: "09:30", opacity: 1, city: "上海" }, // 上海 - 交点1
    { coords: [113.2644, 23.1291], time: "10:00", opacity: 1, city: "广州" }, // 广州 - 同行路段起点
    { coords: [114.0579, 22.5431], time: "11:00", opacity: 1, city: "深圳" }, // 深圳 - 同行路段终点
    { coords: [106.5516, 29.5630], time: "11:30", opacity: 0.5, city: "重庆" }, // 重庆
    { coords: [120.1551, 30.2741], time: "12:30", opacity: 1, city: "杭州" }, // 杭州 - 交点2
    { coords: [115.8922, 28.6765], time: "13:30", opacity: 0.5, city: "南昌" }, // 南昌
  ];

  // Layer 1 (Person A)
  const layer1 = Libra.Layer.initialize("D3Layer", {
    name: "trajectoryLayer1",
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    offset: { x: 0, y: 0 },
    container: svg.node(),
  });
  const g1 = d3.select(layer1.getGraphic());

  // Layer 2 (Person B)
  const layer2 = Libra.Layer.initialize("D3Layer", {
    name: "trajectoryLayer2",
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    offset: { x: 0, y: 0 },
    container: svg.node(),
  });
  const g2 = d3.select(layer2.getGraphic());

  const lineGen = d3.line()
    .x((d) => projection(d.coords)[0])
    .y((d) => projection(d.coords)[1])
    .curve(d3.curveMonotoneX);
  const overlapMidpoint = projection([
    (trajectory1[2].coords[0] + trajectory1[3].coords[0]) / 2,
    (trajectory1[2].coords[1] + trajectory1[3].coords[1]) / 2,
  ]);

  // Draw Base Path 1 (Faded)
  g1.append("path")
    .datum(trajectory1)
    .attr("fill", "none")
    .attr("stroke", "#e11d48")
    .attr("stroke-width", 4)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("opacity", 0.5)
    .attr("d", lineGen);

  // Draw Base Path 2 (Faded)
  g2.append("path")
    .datum(trajectory2)
    .attr("fill", "none")
    .attr("stroke", "#2563eb")
    .attr("stroke-width", 4)
    .attr("stroke-dasharray", "6 6")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("opacity", 0.5)
    .attr("d", lineGen);

  // Draw Overlap Segment 1 (Highlighted)
  g1.append("path")
    .datum(trajectory1.slice(2, 4))
    .attr("fill", "none")
    .attr("stroke", "#e11d48")
    .attr("stroke-width", 4)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("opacity", 1)
    .attr("d", lineGen);

  // Draw Overlap Segment 2 (Highlighted)
  g2.append("path")
    .datum(trajectory2.slice(2, 4))
    .attr("fill", "none")
    .attr("stroke", "#2563eb")
    .attr("stroke-width", 4)
    .attr("stroke-dasharray", "6 6")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("opacity", 1)
    .attr("d", lineGen);

  // Draw Overlap Label
  g1.append("text")
    .attr("x", overlapMidpoint[0])
    .attr("y", overlapMidpoint[1] - 12)
    .text("轨迹重合")
    .attr("text-anchor", "middle")
    .attr("font-size", "15px")
    .attr("fill", "#6d28d9")
    .attr("font-weight", "700")
    .style("paint-order", "stroke")
    .style("stroke", "#fff")
    .style("stroke-width", 4);

  // Draw points and times for 1
  const nodes1 = g1.selectAll("g.node").data(trajectory1).join("g")
    .attr("transform", (d) => {
      const projected = projection(d.coords);
      return `translate(${projected[0]},${projected[1]})`;
    })
    .attr("opacity", (d) => d.opacity);
  
  nodes1.append("circle").attr("r", 6).attr("fill", "#fff").attr("stroke", "#e11d48").attr("stroke-width", 2);
  nodes1.append("text")
    .text((d) => d.time)
    .attr("dx", 10)
    .attr("dy", -10)
    .attr("font-size", "13px")
    .attr("fill", "#be123c")
    .attr("font-weight", "600")
    .style("paint-order", "stroke")
    .style("stroke", "#fff")
    .style("stroke-width", 3);

  // Add "住所重合" markers
  nodes1.filter((d) => d.marker)
    .append("text")
    .text((d) => d.marker)
    .attr("dx", 0)
    .attr("dy", -30)
    .attr("text-anchor", "middle")
    .attr("font-size", "15px")
    .attr("fill", "#6d28d9") // purple-700
    .attr("font-weight", "700")
    .style("paint-order", "stroke")
    .style("stroke", "#fff")
    .style("stroke-width", 4);

  // Draw points and times for 2
  const nodes2 = g2.selectAll("g.node").data(trajectory2).join("g")
    .attr("transform", (d) => {
      const projected = projection(d.coords);
      return `translate(${projected[0]},${projected[1]})`;
    })
    .attr("opacity", (d) => d.opacity);

  nodes2.append("circle").attr("r", 6).attr("fill", "#fff").attr("stroke", "#2563eb").attr("stroke-width", 2);
  nodes2.append("text")
    .text((d) => d.time)
    .attr("dx", 10)
    .attr("dy", 20)
    .attr("font-size", "13px")
    .attr("fill", "#1d4ed8")
    .attr("font-weight", "600")
    .style("paint-order", "stroke")
    .style("stroke", "#fff")
    .style("stroke-width", 3);
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
  let data = null;
  try {
    data = await d3.json("./public/data/china-provinces.geojson");
  } catch (localRelativeError) {
    try {
      data = await d3.json("/data/china-provinces.geojson");
    } catch (localAbsoluteError) {
      data = await d3.json(CHINA_PROVINCES_URL);
    }
  }

  const featureCollection = data?.type === "FeatureCollection"
    ? data
    : topologyToFeatureCollection(data, data.objects?.countries || data.objects?.china || data.objects?.provinces);

  const processedCounties = featureCollection.features.map((feature, index) => ({
    ...normalizeFeatureRings(feature),
    id: String(feature.id ?? feature.properties?.adcode ?? index),
    properties: {
      ...feature.properties,
      density: 20 + (index * 11) % 80,
      county: feature.properties?.name || feature.properties?.NAME || `省份 ${index + 1}`,
    },
  }));

  const densityRanked = processedCounties.slice().sort((a, b) => b.properties.density - a.properties.density);
  labels_overview = densityRanked.slice(0, 8);
  labels_county = densityRanked.slice(0, 18);
  labels_detail = processedCounties;

  return processedCounties;
}

function setupProjection() {
  projection = d3.geoMercator()
    .center([104.0, 35.8])
    .fitExtent([[26, 26], [MAP_WIDTH - 26, MAP_HEIGHT - 26]], {
      type: "FeatureCollection",
      features: counties,
    });

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
  labels.select(".county-meta").attr("text-anchor", "middle").attr("dy", "1.05em").attr("fill", "#475569").style("font", "500 10px system-ui").style("paint-order", "stroke").style("stroke", "rgba(248,250,252,0.96)").style("stroke-width", 3).text((d) => (detailLevel === "detail" ? `示例值 ${d.properties.density.toFixed(0)}` : "")).attr("display", detailLevel === "detail" ? null : "none");
}

function mergeById(...groups) {
  const map = new Map();
  groups.flat().forEach((item) => {
    if (item && !map.has(item.id)) map.set(item.id, item);
  });
  return Array.from(map.values());
}

function normalizeFeatureRings(feature) {
  if (!feature?.geometry) return feature;
  const geometry = feature.geometry;

  if (geometry.type === "Polygon") {
    return {
      ...feature,
      geometry: {
        ...geometry,
        coordinates: normalizePolygonRings(geometry.coordinates),
      },
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      ...feature,
      geometry: {
        ...geometry,
        coordinates: geometry.coordinates.map((polygon) => normalizePolygonRings(polygon)),
      },
    };
  }

  return feature;
}

function normalizePolygonRings(polygon) {
  return polygon.map((ring, index) => {
    const shouldBeClockwise = index === 0;
    const isClockwise = planarRingArea(ring) < 0;
    return isClockwise === shouldBeClockwise ? ring : [...ring].reverse();
  });
}

function planarRingArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const p1 = ring[j];
    const p2 = ring[i];
    sum += p1[0] * p2[1] - p2[0] * p1[1];
  }
  return sum / 2;
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
