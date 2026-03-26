import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

const MAP_WIDTH = 840;
const MAP_HEIGHT = 608;
const PANEL_WIDTH = 250;
const LOW_ZOOM = 1.35;
const HIGH_ZOOM = 2.55;

let counties = [];
let projection = null;
let path = null;
let colorScale = null;
let svg = null;
let mainLayer = null;
let labelsRoot = null;
let panelRoot = null;
let countiesSelection = null;

let viewState = { transform: d3.zoomIdentity };
let clickedIds = new Set();
let lassoIds = new Set();
let hoveredId = null;
let interactions = [];

function buildGeomapDSL() {
  return [
    {
      Name: "mapPan",
      Instrument: "panning",
      trigger: {
        type: "pan",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        ViewTransform: {
          stateRef: viewState,
          redrawRef: redrawView,
          translateExtent: [[0, 0], [MAP_WIDTH, MAP_HEIGHT]],
        },
      },
      modifierKey: "None",
      priority: 6,
      stopPropagation: true,
    },
    {
      Name: "mapZoom",
      Instrument: "zooming",
      trigger: {
        type: "zoom",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        SemanticZoom: {
          stateRef: viewState,
          redrawRef: redrawView,
          translateExtent: [[0, 0], [MAP_WIDTH, MAP_HEIGHT]],
          scaleExtent: [1, 8],
          step: 0.14,
        },
      },
      priority: 7,
      stopPropagation: true,
    },
    {
      Name: "mapLasso",
      Instrument: "group selection",
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
        flow: {
          remove: [{ find: "SelectionTransformer" }],
          insert: [
            {
              find: "SelectionService",
              Operator: ({ result = [] }) => {
                lassoIds = new Set(
                  result
                    .map((node) => d3.select(node).datum()?.id)
                    .filter(Boolean),
                );
                return Array.from(lassoIds);
              },
              Renderer: () => {
                applyView();
                updatePanel();
              },
            },
          ],
        },
      },
      modifierKey: "Shift",
      priority: 8,
      stopPropagation: true,
    },
    {
      Name: "mapClick",
      Instrument: "point selection",
      trigger: {
        type: "click",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        flow: {
          remove: [{ find: "SelectionTransformer" }],
          insert: [
            {
              find: "SelectionService",
              Operator: ({ result = [] }) => {
                const id = result.map((node) => d3.select(node).datum()?.id).find(Boolean);
                if (id) {
                  if (clickedIds.has(id)) clickedIds.delete(id);
                  else clickedIds.add(id);
                }
                return Array.from(clickedIds);
              },
              Renderer: () => {
                applyView();
                updatePanel();
              },
            },
          ],
        },
      },
      modifierKey: "None",
      priority: 3,
      stopPropagation: true,
    },
    {
      Name: "mapHover",
      Instrument: "point selection",
      trigger: {
        type: "hover",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        flow: {
          remove: [{ find: "SelectionTransformer" }],
          insert: [
            {
              find: "SelectionService",
              Operator: ({ result = [] }) => {
                hoveredId = result.map((node) => d3.select(node).datum()?.id).find(Boolean) || null;
                return hoveredId;
              },
              Renderer: () => {
                applyView();
                updatePanel();
              },
            },
          ],
        },
      },
      priority: 2,
      stopPropagation: false,
    },
  ];
}

export default async function init() {
  const container = document.getElementById("LibraPlayground");
  if (!container) return;
  container.innerHTML = "";

  clickedIds = new Set();
  lassoIds = new Set();
  hoveredId = null;
  viewState = { transform: d3.zoomIdentity };

  const shell = buildLayout(container);
  svg = shell.svg;
  panelRoot = shell.panel;
  labelsRoot = shell.labels;

  counties = await loadCounties();
  setupProjection();
  mainLayer = Libra.Layer.initialize("D3Layer", {
    name: "mainLayer",
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    offset: { x: 0, y: 0 },
    container: svg.node(),
  });

  renderMap();
  interactions = buildGeomapDSL();
  await compileInteractionsDSL(interactions, {
    layersByName: { mainLayer },
  });

  mainLayer.setLayersOrder?.({
    selectionLayer: 2,
    transientLayer: 3,
  });
  mainLayer.onUpdate?.(() => {
    mainLayer.setLayersOrder?.({
      selectionLayer: 2,
      transientLayer: 3,
    });
  });

  const selectionLayer = mainLayer.getLayerFromQueue("selectionLayer");
  const transientLayer = mainLayer.getLayerFromQueue("transientLayer");
  if (selectionLayer?.getGraphic) d3.select(selectionLayer.getGraphic()).style("pointer-events", "none");
  if (transientLayer?.getGraphic) d3.select(transientLayer.getGraphic()).style("pointer-events", "none");

  await Libra.createHistoryTrack?.();
  redrawView(viewState.transform);
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
      <div style="margin-top:6px;font:14px/1.45 system-ui;color:#556070;">
        Interaction is declared through Libra DSL rules: pan, semantic zoom, lasso selection, click pinning, and hover inspection all target the same map layer.
      </div>
    `);

  const chips = shell
    .append("div")
    .style("display", "flex")
    .style("gap", "8px")
    .style("flex-wrap", "wrap");

  [
    ["DSL pan", "#eff6ff", "#2563eb"],
    ["DSL zoom", "#eefaf5", "#047857"],
    ["DSL lasso", "#fef3c7", "#b45309"],
    ["DSL click + hover", "#fce7f3", "#be185d"],
  ].forEach(([label, bg, fg]) => {
    chips
      .append("span")
      .style("padding", "6px 10px")
      .style("border-radius", "999px")
      .style("background", bg)
      .style("color", fg)
      .style("font", "600 12px/1 system-ui")
      .text(label);
  });

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

  svgSelection
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", MAP_WIDTH)
    .attr("height", MAP_HEIGHT)
    .attr("fill", "#f8fafc");

  const labels = svgSelection
    .append("g")
    .attr("class", "semantic-geomap-labels")
    .style("pointer-events", "none");

  const panel = content
    .append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "10px");

  return {
    svg: svgSelection,
    panel,
    labels,
  };
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
      landArea: Number(feature.properties?.land_area) || 0,
      housingUnits: Number(feature.properties?.housing_units) || 0,
    },
  }));
}

function setupProjection() {
  const collection = {
    type: "FeatureCollection",
    features: counties,
  };

  projection = d3.geoIdentity().fitExtent(
    [
      [26, 26],
      [MAP_WIDTH - 26, MAP_HEIGHT - 26],
    ],
    collection,
  );
  path = d3.geoPath(projection);

  counties.forEach((county) => {
    county.centroid = path.centroid(county);
  });

  colorScale = d3
    .scaleSequential(d3.interpolateYlGnBu)
    .domain(d3.extent(counties, (d) => d.properties.density));
}

function renderMap() {
  const root = d3.select(mainLayer.getGraphic());
  root.selectAll("*").remove();

  countiesSelection = root
    .selectAll("path.county")
    .data(counties, (d) => d.id)
    .join("path")
    .attr("class", "county mark")
    .attr("d", path)
    .attr("fill", (d) => colorScale(d.properties.density))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.85)
    .attr("stroke-linejoin", "round");
}

function redrawView(transform) {
  viewState.transform = transform || d3.zoomIdentity;
  d3.select(mainLayer.getGraphic()).attr("transform", viewState.transform.toString());
  applyView();
  updatePanel();
}

function applyView() {
  const selected = new Set([...clickedIds, ...lassoIds]);
  const selectionActive = selected.size > 0;

  countiesSelection
    .attr("fill-opacity", (d) => {
      if (hoveredId === d.id) return 1;
      if (selectionActive) return selected.has(d.id) ? 0.96 : 0.26;
      return 0.82;
    })
    .attr("stroke", (d) => {
      if (hoveredId === d.id) return "#0f172a";
      if (clickedIds.has(d.id)) return "#be185d";
      if (lassoIds.has(d.id)) return "#0f766e";
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
  const densityRanked = counties
    .slice()
    .sort((a, b) => b.properties.density - a.properties.density);

  let labelData = [];
  if (detail === "overview") {
    labelData = mergeById(
      counties.filter((county) => focusIds.has(county.id)),
      densityRanked.slice(0, 8),
    );
  } else if (detail === "county") {
    labelData = mergeById(
      counties.filter((county) => focusIds.has(county.id)),
      densityRanked.slice(0, 18),
    );
  } else {
    labelData = counties;
  }

  labelData = labelData.filter((county) => {
    const [x, y] = viewState.transform.apply(county.centroid);
    county.screenLabel = [x, y];
    return Number.isFinite(x) && Number.isFinite(y) && x > 8 && x < MAP_WIDTH - 8 && y > 8 && y < MAP_HEIGHT - 8;
  });

  const labels = labelsRoot
    .selectAll("g.county-label")
    .data(labelData, (d) => d.id)
    .join((enter) => {
      const label = enter.append("g").attr("class", "county-label");
      label.append("text").attr("class", "county-name");
      label.append("text").attr("class", "county-meta");
      return label;
    });

  labels
    .attr("transform", (d) => `translate(${d.screenLabel[0]}, ${d.screenLabel[1]})`)
    .attr("opacity", detail === "detail" ? 0.96 : 0.88);

  labels
    .select(".county-name")
    .attr("text-anchor", "middle")
    .attr("dy", detail === "detail" ? "-0.18em" : "0.32em")
    .attr("fill", (d) => (focusIds.has(d.id) ? "#0f172a" : "#334155"))
    .style("font", `600 ${detail === "detail" ? 11 : 10}px system-ui`)
    .style("paint-order", "stroke")
    .style("stroke", "rgba(248, 250, 252, 0.96)")
    .style("stroke-width", 4)
    .text((d) => d.properties.county);

  labels
    .select(".county-meta")
    .attr("text-anchor", "middle")
    .attr("dy", "1.05em")
    .attr("fill", "#475569")
    .style("font", "500 10px system-ui")
    .style("paint-order", "stroke")
    .style("stroke", "rgba(248, 250, 252, 0.96)")
    .style("stroke-width", 3)
    .text((d) => (detail === "detail" ? `${d.properties.density.toFixed(0)} / sq mi` : ""))
    .attr("display", detail === "detail" ? null : "none");
}

function updatePanel() {
  const detail = semanticDetailLevel();
  const hovered = counties.find((county) => county.id === hoveredId) || null;
  const selected = new Set([...clickedIds, ...lassoIds]);
  const selectedCounties = counties
    .filter((county) => selected.has(county.id))
    .sort((a, b) => b.properties.density - a.properties.density);

  panelRoot.html("");

  const card = panelRoot
    .append("div")
    .style("padding", "16px")
    .style("border", "1px solid #d7dde5")
    .style("border-radius", "18px")
    .style("background", "#ffffff")
    .style("box-shadow", "0 14px 34px rgba(15, 23, 42, 0.05)");

  card
    .append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "center")
    .html(`
      <div style="font:700 15px/1.2 system-ui;color:#111827;">Semantic state</div>
      <span style="padding:5px 9px;border-radius:999px;background:#eef6ff;color:#2563eb;font:700 11px/1 system-ui;">${detail}</span>
    `);

  card
    .append("div")
    .style("margin-top", "12px")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 1fr")
    .style("gap", "8px")
    .html(`
      <div style="padding:10px;border-radius:14px;background:#f8fafc;">
        <div style="font:600 11px/1 system-ui;color:#64748b;">Zoom</div>
        <div style="margin-top:6px;font:700 18px/1 system-ui;color:#111827;">${viewState.transform.k.toFixed(2)}x</div>
      </div>
      <div style="padding:10px;border-radius:14px;background:#f8fafc;">
        <div style="font:600 11px/1 system-ui;color:#64748b;">Selected</div>
        <div style="margin-top:6px;font:700 18px/1 system-ui;color:#111827;">${selectedCounties.length}</div>
      </div>
    `);

  card
    .append("button")
    .style("margin-top", "14px")
    .style("padding", "9px 12px")
    .style("border", "none")
    .style("border-radius", "12px")
    .style("background", "#0f172a")
    .style("color", "#ffffff")
    .style("font", "600 12px/1 system-ui")
    .style("cursor", "pointer")
    .text("Clear pinned + lasso selection")
    .on("click", () => {
      clickedIds = new Set();
      lassoIds = new Set();
      applyView();
      updatePanel();
    });

  const detailCard = panelRoot
    .append("div")
    .style("padding", "16px")
    .style("border", "1px solid #d7dde5")
    .style("border-radius", "18px")
    .style("background", "#ffffff");

  detailCard
    .append("div")
    .style("font", "700 15px/1.2 system-ui")
    .style("color", "#111827")
    .text(hovered?.properties.county || "Hovered county");

  detailCard
    .append("div")
    .style("margin-top", "10px")
    .style("font", "13px/1.5 system-ui")
    .style("color", "#556070")
    .html(
      hovered
        ? `
          <div>Density: <strong>${hovered.properties.density.toFixed(1)}</strong> / sq mi</div>
          <div>Population: <strong>${formatInteger(hovered.properties.population)}</strong></div>
          <div>Housing units: <strong>${formatInteger(hovered.properties.housingUnits)}</strong></div>
        `
        : "Hover a county to inspect local attributes while keeping the current selection state intact.",
    );

  const listCard = panelRoot
    .append("div")
    .style("padding", "16px")
    .style("border", "1px solid #d7dde5")
    .style("border-radius", "18px")
    .style("background", "#ffffff");

  listCard
    .append("div")
    .style("font", "700 15px/1.2 system-ui")
    .style("color", "#111827")
    .text("Pinned / brushed counties");

  if (!selectedCounties.length) {
    listCard
      .append("div")
      .style("margin-top", "10px")
      .style("font", "13px/1.5 system-ui")
      .style("color", "#64748b")
      .text("Use click or lasso to accumulate counties of interest.");
    return;
  }

  listCard
    .append("div")
    .style("margin-top", "10px")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "8px")
    .selectAll("div.row")
    .data(selectedCounties.slice(0, 8), (d) => d.id)
    .join("div")
    .attr("class", "row")
    .style("padding", "10px 12px")
    .style("border-radius", "14px")
    .style("background", "#f8fafc")
    .html(
      (d) => `
        <div style="font:700 12px/1.2 system-ui;color:#111827;">${d.properties.county}</div>
        <div style="margin-top:4px;font:12px/1.4 system-ui;color:#556070;">
          Density ${d.properties.density.toFixed(1)} · Population ${formatInteger(d.properties.population)}
        </div>
      `,
    );
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
  const geometries =
    object.type === "GeometryCollection"
      ? object.geometries
      : [{ ...object }];

  return {
    type: "FeatureCollection",
    features: geometries.flatMap((geometry) => geometryToFeatures(topology, geometry)),
  };
}

function geometryToFeatures(topology, geometry) {
  if (!geometry) return [];

  if (geometry.type === "Polygon") {
    return [buildFeature(geometry, polygonCoordinates(topology, geometry.arcs))];
  }

  if (geometry.type === "MultiPolygon") {
    return [buildFeature(geometry, geometry.arcs.map((polygon) => polygonCoordinates(topology, polygon)), "MultiPolygon")];
  }

  return [];
}

function buildFeature(geometry, coordinates, type = "Polygon") {
  return {
    type: "Feature",
    id: geometry.id,
    properties: geometry.properties || {},
    geometry: {
      type,
      coordinates,
    },
  };
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
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([...first]);
  }
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
    return [
      x * scale[0] + translate[0],
      y * scale[1] + translate[1],
    ];
  });

  return arcIndex >= 0 ? decoded : decoded.reverse();
}
