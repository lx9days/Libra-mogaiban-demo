import * as d3 from "d3";
import Libra from "libra-vis";
import { compileDSL } from "../../scripts/dsl-compiler";
import LibraManager from "../../core/LibraManager";

const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
const WIDTH = 500 - MARGIN.left - MARGIN.right;
const HEIGHT = 380 - MARGIN.top - MARGIN.bottom;

let data = [];
let dataRoot = null;
let data_detail_level1 = [];
let data_detail_level2 = [];
let data_detail_level3 = [];
let x = null;
let y = null;
let color = null;

async function loadData() {
  try {
    data = await d3.json("./public/data/flare-2.json");
  } catch (e) {
    data = await d3.json("./data/flare-2.json");
  }

  dataRoot = d3
    .hierarchy(data)
    .sum(function (d) {
      return d.value;
    })
    .sort((a, b) => b.height - a.height || b.value - a.value);

  dataRoot.children?.forEach((node, index) => {
    node.groupId = index;
    node.each((child) => {
      child.groupId = index;
    });
  });

  d3.treemap().size([WIDTH, HEIGHT]).padding(0.5)(dataRoot);

  data_detail_level1 = [dataRoot].flatMap(
    (node) => node.children || [node]
  );
  data_detail_level2 = data_detail_level1.flatMap(
    (node) => node.children || [node]
  );
  data_detail_level3 = data_detail_level2.flatMap(
    (node) => node.children || [node]
  );

  color = d3
    .scaleOrdinal()
    .domain((dataRoot.children || []).map((node) => node.groupId))
    .range(d3.schemeTableau10);
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

  // Add x axis
  x = d3
    .scaleLinear()
    .domain([0, WIDTH])
    .range([0, WIDTH]);

  // Add y axis
  y = d3
    .scaleLinear()
    .domain([0, HEIGHT])
    .range([0, HEIGHT]);
}

export default async function init() {
  await loadData();
  renderStaticVisualization();
  const [layer, transformer] = renderMainVisualization();
  await mountInteraction(layer, transformer);
}

function renderMainVisualization(
  scaleX = x,
  scaleY = y,
  dataSet = data_detail_level1
) {
  // append the svg object to the body of the page
  const svg = d3.select("#LibraPlayground svg");

  let g = svg.select(".main");
  let returnVal = null;
  if (g.empty()) {
    // create layer if not exists
    const mainLayer = Libra.Layer.initialize("D3Layer", {
      name: "mainLayer",
      width: WIDTH,
      height: HEIGHT,
      offset: { x: MARGIN.left, y: MARGIN.top },
      container: svg.node(),
    });
    g = d3.select(mainLayer.getGraphic());
    g.attr("class", "main");

    Libra.GraphicalTransformer.register("DrawAxesAndMarks", {
      sharedVar: {
        scaleX: x,
        scaleY: y,
        data: data_detail_level1,
      },
      redraw({ transformer }) {
        const scaleX = transformer.getSharedVar("scaleX");
        const scaleY = transformer.getSharedVar("scaleY");
        const data = transformer.getSharedVar("data");
        renderMainVisualization(scaleX, scaleY, data);
      },
    });

    const transformer = Libra.GraphicalTransformer.initialize(
      "DrawAxesAndMarks",
      {
        layer: mainLayer,
      }
    );

    returnVal = [mainLayer, transformer];
  }

  // Clear the layer
  g.selectChildren().remove();

  // Draw the treemap
  g.selectAll(".block")
    .data(dataSet)
    .join("g")
    .attr("class", "block")
    .call((g) =>
      g
        .append("rect")
        .attr("fill", "blue")
        .attr("fill-opacity", 0.2)
        .attr("x", function (d) {
          return scaleX(d.x0);
        })
        .attr("y", function (d) {
          return scaleY(d.y0);
        })
        .attr("width", function (d) {
          return scaleX(d.x1) - scaleX(d.x0);
        })
        .attr("height", function (d) {
          return scaleY(d.y1) - scaleY(d.y0);
        })
    )
    .call((g) =>
      g
        .append("text")
        .attr("x", function (d) {
          return scaleX(d.x0) + 5;
        }) // +10 to adjust position (more right)
        .attr("y", function (d) {
          return scaleY(d.y0) + 20;
        }) // +20 to adjust position (lower)
        .text(function (d) {
          return d.data.name;
        })
        .attr("font-size", "15px")
        .attr("fill", "black")
    );

  return returnVal;
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
        }
      }
    },
    {
      instrument: "semanticZoom",
      trigger: {
        type: "zoom",
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        context: {
          scaleLevels: {
            0: { data: data_detail_level1 },
            3: { data: data_detail_level2 },
            6: { data: data_detail_level3 },
          },
          fixRange: true,
          scaleX: x,
          scaleY: y,
        }
      }
    },
    {
      name: "lensMain",
      instrument: "lens",
      trigger: {
        type: "hover",
        modifierKey:"shift",
        priority: 1,
        stopPropagation: true,
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        service: {
          lens: {
            renderSelection: true,
            r: 60,
            stroke: "#1d8f43",
            strokeWidth: 4,
            fontSize: 20,
            countLabelWidth: 56,
            count: {
              op: "count",
            },
          },
          excentricLabeling: {
            countLabelDistance: 18,
            maxLabelsNum: 12,
            labelAccessor: (elem) => {
              const d = d3.select(elem).datum();
              return d?.data?.name || d?.id || "123";
            },
            colorAccessor: (elem) => {
              const d = d3.select(elem).datum();
              return color(d?.groupId) || "#ffffffff";
            },
          }
        },
      },
    }
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
