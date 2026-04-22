import * as d3 from "d3";
import Libra from "libra-vis";
import { compileDSL } from "../../scripts/dsl-compiler";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";

const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
const WIDTH = 600 - MARGIN.left - MARGIN.right;
const HEIGHT = 450 - MARGIN.top - MARGIN.bottom;

const EDGE_LENS_SEED = 24;
const EXCENTRIC_RADIUS = 52;
const MAX_LABELS = 14;

let nodes = [];
let links = [];
let radius = null;
let color = null;

const edgeLine = d3
  .line()
  .x((d) => d.x)
  .y((d) => d.y)
  .curve(d3.curveBasis);

async function loadData() {
  let graph = null;
  try {
    graph = await d3.json("./public/data/miserables.json");
  } catch (error) {
    graph = await d3.json("/data/miserables.json");
  }

  const degreeById = new Map(graph.nodes.map((node) => [node.id, 0]));
  graph.links.forEach((link) => {
    degreeById.set(link.source, (degreeById.get(link.source) || 0) + 1);
    degreeById.set(link.target, (degreeById.get(link.target) || 0) + 1);
  });

  nodes = graph.nodes.map((node) => ({
    ...node,
    degree: degreeById.get(node.id) || 0,
  }));
  links = graph.links.map((link, index) => ({
    ...link,
    index,
    id: [link.source, link.target] // For LinkSelection matching against node id
  }));

  d3.forceSimulation(nodes)
    .force("charge", d3.forceManyBody().strength(-160))
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(26)
        .strength(0.35),
    )
    .force("x", d3.forceX())
    .force("y", d3.forceY())
    .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2))
    .stop()
    .tick(240);

  radius = d3.scaleLinear().domain(d3.extent(nodes, (d) => d.degree)).range([4, 11]);
  color = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(nodes.map((d) => d.group))))
    .range(d3.schemeTableau10);
}

function renderStaticVisualization() {
  const container = document.getElementById("LibraPlayground");
  if (container) {
    container.innerHTML = "";
  }

  d3.select("#LibraPlayground")
    .append("svg")
    .attr("width", WIDTH + MARGIN.left + MARGIN.right)
    .attr("height", HEIGHT + MARGIN.top + MARGIN.bottom)
    .attr("viewBox", `0 0 ${WIDTH + MARGIN.left + MARGIN.right} ${HEIGHT + MARGIN.top + MARGIN.bottom}`);
}

function buildEdgeLensPath(edge, controlPoint) {
  if (!controlPoint) return edgeLine([edge.source, edge.target]);

  const tangentVec = [edge.target.x - edge.source.x, edge.target.y - edge.source.y];
  const tangentLength = Math.sqrt(tangentVec[0] * tangentVec[0] + tangentVec[1] * tangentVec[1]);
  if (!Number.isFinite(tangentLength) || tangentLength === 0) {
    return edgeLine([edge.source, edge.target]);
  }

  const pointVec = [controlPoint.x - edge.source.x, controlPoint.y - edge.source.y];
  const pointLength = Math.sqrt(pointVec[0] * pointVec[0] + pointVec[1] * pointVec[1]);
  if (!Number.isFinite(pointLength) || pointLength === 0) {
    return edgeLine([edge.source, edge.target]);
  }

  const normTangentVec = tangentVec.map((value) => value / tangentLength);
  const projection =
    (normTangentVec[0] * pointVec[0] + normTangentVec[1] * pointVec[1]) / tangentLength;
  const cosine =
    (tangentVec[0] * pointVec[0] + tangentVec[1] * pointVec[1]) / tangentLength / pointLength;

  if (!(projection > 0 && projection < 1) || !(cosine < 1)) {
    return edgeLine([edge.source, edge.target]);
  }

  let normNormalVec = [-normTangentVec[1], normTangentVec[0]];
  const normalCosine =
    (normNormalVec[0] * pointVec[0] + normNormalVec[1] * pointVec[1]) / pointLength;
  if (normalCosine > 0) {
    normNormalVec = [-normNormalVec[0], -normNormalVec[1]];
  }

  const distanceToLine = -(
    normNormalVec[0] * pointVec[0] + normNormalVec[1] * pointVec[1]
  );
  if (distanceToLine >= EDGE_LENS_SEED) {
    return edgeLine([edge.source, edge.target]);
  }

  const mirrorPoint = {
    x: controlPoint.x + normNormalVec[0] * EDGE_LENS_SEED,
    y: controlPoint.y + normNormalVec[1] * EDGE_LENS_SEED,
  };
  const offsetDistance = EDGE_LENS_SEED - distanceToLine;
  const mirrorSource = {
    x: edge.source.x + normNormalVec[0] * offsetDistance,
    y: edge.source.y + normNormalVec[1] * offsetDistance,
  };
  const mirrorTarget = {
    x: edge.target.x + normNormalVec[0] * offsetDistance,
    y: edge.target.y + normNormalVec[1] * offsetDistance,
  };

  return edgeLine([
    edge.source,
    {
      x: (mirrorSource.x + mirrorPoint.x) / 2,
      y: (mirrorSource.y + mirrorPoint.y) / 2,
    },
    {
      x: (mirrorTarget.x + mirrorPoint.x) / 2,
      y: (mirrorTarget.y + mirrorPoint.y) / 2,
    },
    edge.target,
  ]);
}

function ensureMarksGroup(layer, className) {
  const root = d3.select(layer.getGraphic());
  let group = root.select(`g.${className}`);
  if (group.empty()) {
    group = root.append("g").attr("class", className);
  }
  return group;
}

function renderLinkVisualization(layer, currentLinks = links, controlPoint = null) {
  const root = ensureMarksGroup(layer, "edge-lens-links-marks");
  root.selectAll("*").remove();

  root
    .append("g")
    .attr("fill", "none")
    .attr("stroke", "#7f8794")
    .attr("stroke-opacity", 0.5)
    .attr("stroke-linecap", "round")
    .selectAll("path")
    .data(currentLinks)
    .join("path")
    .attr("d", (d) => buildEdgeLensPath(d, controlPoint))
    .attr("stroke-width", 1.35);
}

function renderNodeVisualization(layer, currentNodes = nodes) {
  const root = ensureMarksGroup(layer, "edge-lens-node-marks");
  root.selectAll("*").remove();

  const nodeGroups = root
    .append("g")
    .selectAll("g.node")
    .data(currentNodes, (d) => d.id)
    .join("g")
    .attr("class", "node")
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  nodeGroups
    .append("circle")
    .attr("r", (d) => radius(d.degree))
    .attr("fill", (d) => color(d.group))
    .attr("fill-opacity", 0.92)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.1);

  nodeGroups
    .append("text")
    .text((d, i) => i + 1)
    .attr("text-anchor", "middle")
    .attr("dy", "0.3em")
    .attr("font-size", "10px")
    .attr("fill", "#000")
    .style("pointer-events", "none");
}

function renderMainVisualization() {
  const svg = d3.select("#LibraPlayground svg");

  const linkLayer = Libra.Layer.initialize("D3Layer", {
    name: "linkLayer",
    width: WIDTH,
    height: HEIGHT,
    offset: { x: MARGIN.left, y: MARGIN.top },
    container: svg.node(),
  });
  const mainLayer = linkLayer.getLayerFromQueue("nodeLayer");
  const backgroundLayer = linkLayer.getLayerFromQueue("backgroundLayer");

  d3.select(linkLayer.getGraphic()).attr("class", "edge-lens-links").style("pointer-events", "none");
  d3.select(mainLayer.getGraphic()).attr("class", "edge-lens-nodes");
  d3.select(backgroundLayer.getGraphic()).attr("class", "edge-lens-background");
  d3.select(backgroundLayer.getGraphic())
    .select("rect")
    .attr("fill", "#ffffff")
    .attr("stroke", "#d7dde5")
    .attr("stroke-width", 1);

  linkLayer.setLayersOrder({
    backgroundLayer: 0,
    linkLayer: 1,
    nodeLayer: 3,
    linkSelectionLayer: 2,
    selectionLayer: 4
  });

  renderLinkVisualization(linkLayer);
  renderNodeVisualization(mainLayer);

  return {
    linkLayer,
    mainLayer,
  };
}

async function mountInteraction({ linkLayer, mainLayer }) {
  const linkTransformer = Libra.GraphicalTransformer.initialize("EdgeLensLinkTransformer", {
    layer: linkLayer,
    sharedVar: {
      result: { edges: links, controlPoint: null },
    },
    redraw({ transformer }) {
      const result = transformer.getSharedVar("result");
      const currentLinks = result?.edges || links;
      const controlPoint = result?.controlPoint || null;
      renderLinkVisualization(linkLayer, currentLinks, controlPoint);
      linkLayer.postUpdate?.();
    },
  });



  const interactions2 = [
{
      instrument: "pointSelection",
      trigger: {
        type: "hover",
        priority: 1,
        stopPropagation: false
      },
      target: {
        layer: "nodeLayer"
      },
      feedback: {
        redrawFunc: {
          Highlight: {
            stroke: "#ff0000",
            "stroke-width": 2,
            fill: "none"
          },
        },
        context: {
          LinkLayers: ["linkLayer"],
          LinkMatchMode: "field",
          LinkFields: ["id"],
          LinkDefaultOpacity: 0.6,
          LinkBaseOpacity: 0.08,
          LinkSelectedOpacity: 0.95,
        }
      },

    },
    {
      name: "edgeLensHover",
      instrument: "pointSelection",
      trigger: {
        type: "hover",
        modifierKey: "shift",
        priority: 1,
        stopPropagation: false,
      },
      target: {
        layer: "mainLayer",
        pointerEvents: "viewport",
      },
      feedback: {

      },
      customFeedbackFlow: {
        // remove: [{ find: "SelectionTransformer" }],
        insert: [
          {
            find: "SelectionService",
            flow: [
              {
                comp: "EdgeLensLayoutService",
                sharedVar: {
                  edges: links,
                },
                evaluate({ edges: currentEdges = [], offsetx, offsety, x, y, layer }) {
                  const pointerX = Number.isFinite(offsetx) ? offsetx : x;
                  const pointerY = Number.isFinite(offsety) ? offsety : y;
                  if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
                    return { edges: currentEdges, controlPoint: null };
                  }

                  const controlPoint = {
                    x: pointerX - (layer?._offset?.x || 0),
                    y: pointerY - (layer?._offset?.y || 0),
                  };
                  return { edges: currentEdges, controlPoint };
                },
              },
              linkTransformer,
            ],
          },
        ],
      },
    },
    

  ];

  const layersByName = {
    mainLayer,
    nodeLayer: mainLayer,
    linkLayer,
  };

  await compileDSL(interactions2, { layersByName }, { execute: true });

  // await compileInteractionsDSL([interactions[1]], {
  //   layersByName,
  // });

  const labelLayer = mainLayer.getLayerFromQueue("LabelLayer");
  const lensLayer = mainLayer.getLayerFromQueue("LensLayer");
  if (labelLayer?.getGraphic) {
    d3.select(labelLayer.getGraphic()).style("pointer-events", "none");
  }
  if (lensLayer?.getGraphic) {
    d3.select(lensLayer.getGraphic()).style("pointer-events", "none");
  }

  await Libra.createHistoryTrack?.();
}

export default async function init() {
  await loadData();
  renderStaticVisualization();
  const layers = renderMainVisualization();
  await mountInteraction(layers);
}
