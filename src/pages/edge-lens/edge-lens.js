import * as d3 from "d3";
import Libra from "libra-vis";

// constants
const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
const WIDTH = 500 - MARGIN.left - MARGIN.right;
const HEIGHT = 450 - MARGIN.top - MARGIN.bottom;
const FIELD_COLOR = "degree";
const FIELD_RADIUS = "degree";
const FISHEYE_LENS = 100;

// module variables
let data = [];
let nodes = [];
let links = [];
let radius = null;
let color = null;

async function loadData() {
  try {
    data = await d3.json("/public/data/miserables.json");
  } catch (e) {
    data = await d3.json("/data/miserables.json");
  }
  data.nodes.forEach(
    (node) =>
      (node.degree = data.links.filter(
        (link) => link.target === node.id || link.source === node.id
      ).length)
  );

  nodes = data.nodes;
  links = data.links.map((d, i) => ({ ...d, index: i }));

  d3.forceSimulation(nodes)
    .force("charge", d3.forceManyBody().strength(-100))
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(0)
        .strength(0.3)
    )
    .force("x", d3.forceX())
    .force("y", d3.forceY())
    .force(
      "center",
      d3.forceCenter(
        (WIDTH - MARGIN.left - MARGIN.right) / 2 + MARGIN.left,
        (HEIGHT - MARGIN.top - MARGIN.bottom) / 2 + MARGIN.top
      )
    )
    .stop()
    .tick(200);
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
    .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);

  // Add color scale
  const extentColor = [
    0,
    d3.max(nodes, (d) => d[FIELD_COLOR]),
  ];
  color = d3
    .scaleDiverging()
    .domain([
      extentColor[1],
      (extentColor[1] - extentColor[0]) / 2 + extentColor[0],
      extentColor[0],
    ])
    .interpolator(d3.interpolateRdYlGn);

  // Add radius scale
  const extentRadius = d3.extent(nodes, (d) => d[FIELD_RADIUS]);
  radius = d3.scaleLinear().domain(extentRadius).range([3, 10]);
}

function renderMainVisualization(
  inputNodes = nodes,
  inputLinks = links
) {
  // append the svg object to the body of the page
  const svg = d3.select("#LibraPlayground svg");

  let g = svg.select(".node");
  let returnVal = null;
  if (g.empty()) {
    // create layer if not exists
    const linkLayer = Libra.Layer.initialize("D3Layer", {
      name: "linkLayer",
      width: WIDTH,
      height: HEIGHT,
      offset: { x: MARGIN.left, y: MARGIN.top },
      container: svg.node(),
    });
    g = d3.select(linkLayer.getGraphic());
    g.attr("class", "link");

    const nodeLayer = linkLayer.getLayerFromQueue("nodeLayer");
    d3.select(nodeLayer.getGraphic()).attr("class", "node");

    const bgLayer = linkLayer.getLayerFromQueue("backgroundLayer");

    returnVal = [bgLayer, linkLayer, nodeLayer];
  }

  renderNodeVisualization(inputNodes);
  // renderLinkVisualization(inputLinks);

  return returnVal;
}

function renderNodeVisualization(inputNodes = nodes) {
  // find node layer
  const root = d3.select("#LibraPlayground").select(".node");

  // clear graphical elements
  root.selectChildren().remove();

  // draw nodes
  root
    .append("g")
    .attr("fill", "#fff")
    .attr("stroke", "#000")
    .selectAll("circle")
    .data(inputNodes)
    .join("circle")
    .attr("fill", (d) => (d.children ? null : "steelblue"))
    .attr("r", (d) => {
      const a = d.children
        ? null
        : radius(d[FIELD_RADIUS]);
      return a;
    })
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y);
}

function renderLinkVisualization(inputLinks = links) {
  // find link layer
  const root = d3.select("#LibraPlayground").select(".link");

  // clear graphical elements
  root.selectChildren().remove();

  // draw links
  root
    .append("g")
    .attr("fill", "none")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("path")
    .data(inputLinks)
    .join("path")
    .attr("d", (d) => d);
}

function mountInteraction(bgLayer, linkLayer, nodeLayer) {
  // register edge lens layout service
  Libra.Service.register("EdgeLensLayoutService", {
    constructor: Libra.Service.LayoutService,
    params: { edges: [], vertices: [], controlPoints: [] },
    evaluate({ edges, vertices, controlPoints }) {
      const line = d3
        .line()
        .x((d) => d.x)
        .y((d) => d.y)
        .curve(d3.curveBasis);
      if (controlPoints.length <= 0) {
        return {
          vertices,
          edges: edges
            .map((edge) => [edge.source, edge.target])
            .map((x) => line(x)),
        };
      }
      const controlPoint = controlPoints[0];
      return {
        vertices,
        edges: edges
          .map((edge) => {
            const tangentVec = [
              edge.target.x - edge.source.x,
              edge.target.y - edge.source.y,
            ];
            const pointVec = [
              controlPoint.x - edge.source.x,
              controlPoint.y - edge.source.y,
            ];
            const normTangentVec = tangentVec.map(
              (x) =>
                x /
                Math.sqrt(
                  tangentVec[0] * tangentVec[0] + tangentVec[1] * tangentVec[1]
                )
            );
            const project =
              (normTangentVec[0] * pointVec[0] +
                normTangentVec[1] * pointVec[1]) /
              Math.sqrt(
                tangentVec[0] * tangentVec[0] + tangentVec[1] * tangentVec[1]
              );
            const cos =
              (tangentVec[0] * pointVec[0] + tangentVec[1] * pointVec[1]) /
              Math.sqrt(
                tangentVec[0] * tangentVec[0] + tangentVec[1] * tangentVec[1]
              ) /
              Math.sqrt(pointVec[0] * pointVec[0] + pointVec[1] * pointVec[1]);
            if (project > 0 && project < 1 && cos < 1) {
              const normNormalVec = [-normTangentVec[1], normTangentVec[0]];
              const normCos =
                (normNormalVec[0] * pointVec[0] +
                  normNormalVec[1] * pointVec[1]) /
                Math.sqrt(
                  normNormalVec[0] * normNormalVec[0] +
                    normNormalVec[1] * normNormalVec[1]
                ) /
                Math.sqrt(
                  pointVec[0] * pointVec[0] + pointVec[1] * pointVec[1]
                );
              if (normCos > 0) {
                normNormalVec[0] = -normNormalVec[0];
                normNormalVec[1] = -normNormalVec[1];
              }
              const dist = -(
                normNormalVec[0] * pointVec[0] +
                normNormalVec[1] * pointVec[1]
              );
              const mirrorSeed = 20;
              if (dist >= mirrorSeed) {
                return [edge.source, edge.target];
              } else {
                const mirrorPoint = [
                  controlPoint.x + normNormalVec[0] * mirrorSeed,
                  controlPoint.y + normNormalVec[1] * mirrorSeed,
                ];
                const moveDist = mirrorSeed - dist;
                const mirrorSource = [
                  edge.source.x + normNormalVec[0] * moveDist,
                  edge.source.y + normNormalVec[1] * moveDist,
                ];
                const mirrorTarget = [
                  edge.target.x + normNormalVec[0] * moveDist,
                  edge.target.y + normNormalVec[1] * moveDist,
                ];
                return [
                  edge.source,
                  {
                    x: (mirrorSource[0] + mirrorPoint[0]) / 2,
                    y: (mirrorSource[1] + mirrorPoint[1]) / 2,
                  },
                  {
                    x: (mirrorTarget[0] + mirrorPoint[0]) / 2,
                    y: (mirrorTarget[1] + mirrorPoint[1]) / 2,
                  },
                  edge.target,
                ];
              }
            } else {
              return [edge.source, edge.target];
            }
          })
          .map((x) => line(x)),
      };
    },
  });

  // register node & link transformers
  Libra.GraphicalTransformer.register("NodeTransformer", {
    redraw({ transformer }) {
      const nodes = transformer.getSharedVar("result")?.vertices ?? [];
      renderNodeVisualization(nodes);
    },
  });

  Libra.GraphicalTransformer.register("LinkTransformer", {
    redraw({ transformer }) {
      const links = transformer.getSharedVar("result")?.edges ?? [];
      renderLinkVisualization(links);
    },
  });

  const nodeTransformer = Libra.GraphicalTransformer.initialize(
    "NodeTransformer",
    {
      layer: nodeLayer,
    }
  );

  const linkTransformer = Libra.GraphicalTransformer.initialize(
    "LinkTransformer",
    {
      layer: linkLayer,
    }
  );

  // compose hover instrument with customized service
  const edgeLensService = Libra.Service.initialize("EdgeLensLayoutService", {
    sharedVar: {
      vertices: nodes,
      edges: links,
    },
    transformers: [nodeTransformer, linkTransformer],
  });
  edgeLensService.setSharedVar("controlPoints", []);
  Libra.Instrument.initialize("HoverInstrument", {
    layers: [bgLayer],
    services: [edgeLensService],
    on: {
      hover: [
        ({ event, instrument }) => {
          instrument.services.setSharedVar("controlPoints", [
            { x: event.offsetX, y: event.offsetY },
          ]);
        },
      ],
    },
  });
}

export default async function init() {
  await loadData();
  renderStaticVisualization();
  const [bgLayer, linkLayer, nodeLayer] = renderMainVisualization();
  mountInteraction(bgLayer, linkLayer, nodeLayer);
  if (Libra.createHistoryTrack) {
    await Libra.createHistoryTrack();
  }
}
