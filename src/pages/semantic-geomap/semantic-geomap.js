import * as d3 from "d3";

const MAP_WIDTH = 840;
const MAP_HEIGHT = 608;
const PANEL_WIDTH = 250;
const LOW_ZOOM = 1.35;
const HIGH_ZOOM = 2.55;
const BRUSH_MIN_AREA = 180;

let counties = [];
let projection = null;
let path = null;
let colorScale = null;
let svg = null;
let mapRoot = null;
let labelsRoot = null;
let brushRoot = null;
let panelRoot = null;
let countiesSelection = null;

let viewState = { transform: d3.zoomIdentity };
let clickedIds = new Set();
let lassoIds = new Set();
let hoveredId = null;
let interactions = [];
let lassoState = null;
let suppressClick = false;

function buildGeomapDSL() {
  return [
    {
      instrument: "panning",
      trigger: {
        type: "pan",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        ViewTransform: {
          stateRef: viewState,
          translateExtent: [[0, 0], [MAP_WIDTH, MAP_HEIGHT]],
        },
      },
    },
    {
      instrument: "zooming",
      trigger: {
        type: "zoom",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        SemanticZoom: {
          stateRef: viewState,
          scaleExtent: [1, 8],
          step: 0.14,
        },
      },
    },
    {
      instrument: "group selection",
      trigger: {
        type: "lasso",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        selection: {
          brushStyle: {
            fill: "#d97706",
            opacity: 0.12,
            stroke: "#d97706",
            "stroke-width": 1.6,
            "stroke-dasharray": "5 5",
          },
        },
      },
      modifierKey: "Shift",
    },
    {
      instrument: "point selection",
      trigger: {
        type: "click",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {},
    },
    {
      instrument: "point selection",
      trigger: {
        type: "hover",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {},
    },
  ];
}

export default async function init() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;
  container.innerHTML = "";

  clickedIds = new Set();
  brushIds = new Set();
  hoveredId = null;
  lassoState = null;
  suppressClick = false;
  viewState = { transform: d3.zoomIdentity };
  interactions = buildGeomapDSL();

  const shell = buildLayout(container);
  svg = shell.svg;
  panelRoot = shell.panel;
  labelsRoot = shell.labels;
  lassoRoot = shell.lasso;
  mapRoot = shell.mapRoot;

  counties = await loadCounties();
  setupProjection();
  renderMap();
  installInteractions();
  redrawView();
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
  const lasso = svgSelection.append("g").style("pointer-events", "none");

  const panel = content.append("div").style("display", "flex").style("flex-direction", "column").style("gap", "10px");
  return { svg: svgSelection, panel, labels, lasso, mapRoot: map };
}

async function loadCounties() {
  let topology = null;
  try {
    topology = await d3.json("/public/data/ncmap_pop_density_topojson.json");
  } catch (error) {
    topology = await d3.json("/data/ncmap_pop_density_topojson.json");
  }

  const countyCollection = topologyToFeatureCollection(topology, topology.objects.ncmap);
  return countyCollection.features.map((feature, index) => ({
    ...feature,
    id: String(feature.id ?? feature.properties?.FIPS ?? index),
    properties: {
      ...feature.properties,
      density: Number(feature.properties?.density_land_area_population) || 0,
      population: Number(String(feature.properties?.population || "").replace(/[^\d.]/g, "")) || 0,
      housingUnits: Number(feature.properties?.housing_units) || 0,
    },
  }));
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
    .attr("stroke-linejoin", "round")
    .on("mousemove", (_, d) => {
      hoveredId = d.id;
      applyView();
      updatePanel();
    })
    .on("mouseleave", () => {
      hoveredId = null;
      applyView();
      updatePanel();
    })
    .on("click", (event, d) => {
      if (suppressClick) return;
      const clickRule = interactions.find((rule) => rule.instrument === "point selection" && rule.trigger.type === "click");
      if (!clickRule) return;
      if (clickedIds.has(d.id)) clickedIds.delete(d.id);
      else clickedIds.add(d.id);
      applyView();
      updatePanel();
    });
}

function installInteractions() {
  const panRule = interactions.find((rule) => rule.instrument === "panning");
  const zoomRule = interactions.find((rule) => rule.instrument === "zooming");
  const lassoRule = interactions.find((rule) => rule.trigger.type === "lasso");

  const zoomBehavior = d3
    .zoom()
    .filter((event) => !event.shiftKey)
    .scaleExtent(zoomRule.feedback.SemanticZoom.scaleExtent)
    .on("start", () => {
      suppressClick = false;
    })
    .on("zoom", (event) => {
      const prev = viewState.transform;
      viewState.transform = event.transform;
      if (Math.abs(prev.x - event.transform.x) > 2 || Math.abs(prev.y - event.transform.y) > 2) {
        suppressClick = true;
      }
      redrawView();
    })
    .on("end", () => {
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    });

  svg.call(zoomBehavior).on("dblclick.zoom", null);

  const drag = d3
    .drag()
    .filter((event) => event.shiftKey)
    .on("start", (event) => {
      if (lassoRule.modifierKey !== "Shift") return;
      const [x, y] = d3.pointer(event, svg.node());
      lassoState = { points: [[x, y]] };
      drawLasso(lassoRule.feedback.selection.brushStyle);
    })
    .on("drag", (event) => {
      if (!lassoState) return;
      const [x, y] = d3.pointer(event, svg.node());
      const last = lassoState.points.at(-1);
      if (!last || Math.hypot(last[0] - x, last[1] - y) > 3) {
        lassoState.points.push([x, y]);
        drawLasso(lassoRule.feedback.selection.brushStyle);
      }
    })
    .on("end", () => {
      if (!lassoState) return;
      const area = Math.abs(d3.polygonArea(lassoState.points));
      if (lassoState.points.length >= 3 && area >= LASSO_MIN_AREA) {
        lassoIds = new Set(
          counties
            .filter((county) => d3.polygonContains(lassoState.points, viewState.transform.apply(county.centroid)))
            .map((county) => county.id),
        );
      } else {
        lassoIds = new Set();
      }
      lassoState = null;
      drawLasso(lassoRule.feedback.selection.brushStyle);
      applyView();
      updatePanel();
    });

  svg.call(drag);
}

function drawLasso(style) {
  lassoRoot.selectAll("*").remove();
  const points = lassoState?.points || [];
  if (points.length < 2) return;
  lassoRoot
    .append("path")
    .attr("d", d3.line().curve(d3.curveLinearClosed)(points))
    .attr("fill", style.fill)
    .attr("opacity", style.opacity)
    .attr("stroke", style.stroke)
    .attr("stroke-width", style["stroke-width"])
    .attr("stroke-dasharray", style["stroke-dasharray"]);
}

function redrawView() {
  mapRoot.attr("transform", viewState.transform.toString());
  applyView();
  updatePanel();
}

function applyView() {
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
      if (brushIds.has(d.id)) return "#0f766e";
      return "#ffffff";
    })
    .attr("stroke-width", (d) => {
      if (hoveredId === d.id) return 2.4 / Math.sqrt(viewState.transform.k);
      if (clickedIds.has(d.id)) return 2.1 / Math.sqrt(viewState.transform.k);
      if (lassoIds.has(d.id)) return 1.7 / Math.sqrt(viewState.transform.k);
      return 0.85 / Math.sqrt(viewState.transform.k);
    });
  renderSemanticLabels();
}

function renderSemanticLabels() {
  const detail = semanticDetailLevel();
  const selected = new Set([...clickedIds, ...lassoIds]);
  const focusIds = new Set([...selected, hoveredId].filter(Boolean));
  const densityRanked = counties.slice().sort((a, b) => b.properties.density - a.properties.density);
  let labelData = detail === "overview" ? mergeById(counties.filter((d) => focusIds.has(d.id)), densityRanked.slice(0, 8)) : detail === "county" ? mergeById(counties.filter((d) => focusIds.has(d.id)), densityRanked.slice(0, 18)) : counties;
  labelData = labelData.filter((county) => {
    const [x, y] = viewState.transform.apply(county.centroid);
    county.screenLabel = [x, y];
    return x > 8 && x < MAP_WIDTH - 8 && y > 8 && y < MAP_HEIGHT - 8;
  });
  const labels = labelsRoot.selectAll("g.county-label").data(labelData, (d) => d.id).join((enter) => {
    const g = enter.append("g").attr("class", "county-label");
    g.append("text").attr("class", "county-name");
    g.append("text").attr("class", "county-meta");
    return g;
  });
  labels.attr("transform", (d) => `translate(${d.screenLabel[0]}, ${d.screenLabel[1]})`);
  labels.select(".county-name").attr("text-anchor", "middle").attr("dy", detail === "detail" ? "-0.18em" : "0.32em").attr("fill", (d) => (focusIds.has(d.id) ? "#0f172a" : "#334155")).style("font", `600 ${detail === "detail" ? 11 : 10}px system-ui`).style("paint-order", "stroke").style("stroke", "rgba(248,250,252,0.96)").style("stroke-width", 4).text((d) => d.properties.county);
  labels.select(".county-meta").attr("text-anchor", "middle").attr("dy", "1.05em").attr("fill", "#475569").style("font", "500 10px system-ui").style("paint-order", "stroke").style("stroke", "rgba(248,250,252,0.96)").style("stroke-width", 3).text((d) => (detail === "detail" ? `${d.properties.density.toFixed(0)} / sq mi` : "")).attr("display", detail === "detail" ? null : "none");
}

function updatePanel() {
  const detail = semanticDetailLevel();
  const hovered = counties.find((d) => d.id === hoveredId) || null;
  const selectedCounties = counties.filter((d) => clickedIds.has(d.id) || lassoIds.has(d.id)).sort((a, b) => b.properties.density - a.properties.density);
  panelRoot.html("");
  const card = panelRoot.append("div").style("padding", "16px").style("border", "1px solid #d7dde5").style("border-radius", "18px").style("background", "#ffffff");
  card.append("div").style("display", "flex").style("justify-content", "space-between").style("align-items", "center").html(`<div style="font:700 15px/1.2 system-ui;color:#111827;">Semantic state</div><span style="padding:5px 9px;border-radius:999px;background:#eef6ff;color:#2563eb;font:700 11px/1 system-ui;">${detail}</span>`);
  card.append("div").style("margin-top", "12px").style("display", "grid").style("grid-template-columns", "1fr 1fr").style("gap", "8px").html(`<div style="padding:10px;border-radius:14px;background:#f8fafc;"><div style="font:600 11px/1 system-ui;color:#64748b;">Zoom</div><div style="margin-top:6px;font:700 18px/1 system-ui;color:#111827;">${viewState.transform.k.toFixed(2)}x</div></div><div style="padding:10px;border-radius:14px;background:#f8fafc;"><div style="font:600 11px/1 system-ui;color:#64748b;">Selected</div><div style="margin-top:6px;font:700 18px/1 system-ui;color:#111827;">${selectedCounties.length}</div></div>`);
  card.append("button").style("margin-top", "14px").style("padding", "9px 12px").style("border", "none").style("border-radius", "12px").style("background", "#0f172a").style("color", "#ffffff").style("font", "600 12px/1 system-ui").style("cursor", "pointer").text("Clear pinned + lasso selection").on("click", () => { clickedIds = new Set(); lassoIds = new Set(); applyView(); updatePanel(); });
  const detailCard = panelRoot.append("div").style("padding", "16px").style("border", "1px solid #d7dde5").style("border-radius", "18px").style("background", "#ffffff");
  detailCard.append("div").style("font", "700 15px/1.2 system-ui").style("color", "#111827").text(hovered?.properties.county || "Hovered county");
  detailCard.append("div").style("margin-top", "10px").style("font", "13px/1.5 system-ui").style("color", "#556070").html(hovered ? `<div>Density: <strong>${hovered.properties.density.toFixed(1)}</strong> / sq mi</div><div>Population: <strong>${formatInteger(hovered.properties.population)}</strong></div><div>Housing units: <strong>${formatInteger(hovered.properties.housingUnits)}</strong></div>` : "Hover a county to inspect local attributes while keeping the current selection state intact.");
}

function semanticDetailLevel() {
  if (viewState.transform.k < LOW_ZOOM) return "overview";
  if (viewState.transform.k < HIGH_ZOOM) return "county";
  return "detail";
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
