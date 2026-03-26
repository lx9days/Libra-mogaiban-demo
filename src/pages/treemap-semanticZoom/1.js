// // global constants
// globalThis.MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
// globalThis.WIDTH = 500 - globalThis.MARGIN.left - globalThis.MARGIN.right;
// globalThis.HEIGHT = 380 - globalThis.MARGIN.top - globalThis.MARGIN.bottom;

// // global variables
// globalThis.data = [];

// // shared scales
// globalThis.x = null;
// globalThis.y = null;

// async function loadData() {
//   globalThis.data = await d3.json("./data/flare-2.json");

//   globalThis.dataRoot = d3
//     .hierarchy(globalThis.data)
//     .sum(function (d) {
//       return d.value;
//     })
//     .sort((a, b) => b.height - a.height || b.value - a.value);

//   globalThis.dataRoot.children.map((node, index) => (node.groupId = index));

//   d3.treemap().size([globalThis.WIDTH, globalThis.HEIGHT]).padding(0.5)(
//     globalThis.dataRoot
//   );

//   globalThis.data_detail_level1 = [globalThis.dataRoot].flatMap(
//     (node) => node.children || [node]
//   );
//   globalThis.data_detail_level2 = globalThis.data_detail_level1.flatMap(
//     (node) => node.children || [node]
//   );
//   globalThis.data_detail_level3 = globalThis.data_detail_level2.flatMap(
//     (node) => node.children || [node]
//   );
// }

// function renderStaticVisualization() {
//   // append the svg object to the body of the page
//   const svg = d3
//     .select("#LibraPlayground")
//     .append("svg")
//     .attr(
//       "width",
//       globalThis.WIDTH + globalThis.MARGIN.left + globalThis.MARGIN.right
//     )
//     .attr(
//       "height",
//       globalThis.HEIGHT + globalThis.MARGIN.top + globalThis.MARGIN.bottom
//     )
//     .attr("viewbox", `0 0 ${globalThis.WIDTH} ${globalThis.HEIGHT}`)
//     .append("g")
//     .attr(
//       "transform",
//       "translate(" + globalThis.MARGIN.left + "," + globalThis.MARGIN.top + ")"
//     );

//   // Add x axis
//   globalThis.x = d3.scaleLinear().domain([0, 1]).range([0, 1]);

//   // Add y axis
//   globalThis.y = d3.scaleLinear().domain([0, 1]).range([0, 1]);
// }

// module.exports = {
//   loadData,
//   renderStaticVisualization,
// };
// // import static visualization and global variables
// const VIS = require("./staticVisualization");

// async function main() {
//   await VIS.loadData();
//   VIS.renderStaticVisualization();
//   const [layer, transformer] = renderMainVisualization();
//   mountInteraction(layer, transformer);
// }

// function renderMainVisualization(
//   scaleX = globalThis.x,
//   scaleY = globalThis.y,
//   data = globalThis.data_detail_level1
// ) {
//   // append the svg object to the body of the page
//   const svg = d3.select("#LibraPlayground svg");

//   let g = svg.select(".main");
//   let returnVal = null;
//   if (g.empty()) {
//     // create layer if not exists
//     const mainLayer = Libra.Layer.initialize("D3Layer", {
//       name: "mainLayer",
//       width: globalThis.WIDTH,
//       height: globalThis.HEIGHT,
//       offset: { x: globalThis.MARGIN.left, y: globalThis.MARGIN.top },
//       container: svg.node(),
//     });
//     g = d3.select(mainLayer.getGraphic());
//     g.attr("class", "main");

//     Libra.GraphicalTransformer.register("DrawAxesAndMarks", {
//       sharedVar: {
//         scaleX: globalThis.x,
//         scaleY: globalThis.y,
//         data: globalThis.data_detail_level1,
//       },
//       redraw({ transformer }) {
//         const scaleX = transformer.getSharedVar("scaleX");
//         const scaleY = transformer.getSharedVar("scaleY");
//         const data = transformer.getSharedVar("data");
//         renderMainVisualization(scaleX, scaleY, data);
//       },
//     });

//     const transformer = Libra.GraphicalTransformer.initialize(
//       "DrawAxesAndMarks",
//       {
//         layer: mainLayer,
//       }
//     );

//     returnVal = [mainLayer, transformer];
//   }

//   // Clear the layer
//   g.selectChildren().remove();

//   // Draw the treemap
//   g.selectAll(".block")
//     .data(data)
//     .join("g")
//     .attr("class", "block")
//     .call((g) =>
//       g
//         .append("rect")
//         .attr("fill", "blue")
//         .attr("x", function (d) {
//           return scaleX(d.x0);
//         })
//         .attr("y", function (d) {
//           return scaleY(d.y0);
//         })
//         .attr("width", function (d) {
//           return scaleX(d.x1) - scaleX(d.x0);
//         })
//         .attr("height", function (d) {
//           return scaleY(d.y1) - scaleY(d.y0);
//         })
//     )
//     .call((g) =>
//       g
//         .append("text")
//         .attr("x", function (d) {
//           return scaleX(d.x0) + 5;
//         }) // +10 to adjust position (more right)
//         .attr("y", function (d) {
//           return scaleY(d.y0) + 20;
//         }) // +20 to adjust position (lower)
//         .text(function (d) {
//           return d.data.name;
//         })
//         .attr("font-size", "15px")
//         .attr("fill", "white")
//     );

//   return returnVal;
// }

// async function mountInteraction(layer, transformer) {
//   Libra.Interaction.build({
//     inherit: "PanInstrument",
//     layers: [layer],
//     sharedVar: {
//       fixRange: true,
//       scaleX: globalThis.x,
//       scaleY: globalThis.y,
//     },
//   });

//   Libra.Interaction.build({
//     inherit: "SemanticZoomInstrument",
//     layers: [layer],
//     sharedVar: {
//       scaleLevels: {
//         0: { data: globalThis.data_detail_level1 },
//         3: { data: globalThis.data_detail_level2 },
//         6: { data: globalThis.data_detail_level3 },
//       },
//       fixRange: true,
//       scaleX: globalThis.x,
//       scaleY: globalThis.y,
//     },
//   });
//   await Libra.createHistoryTrrack();
// }

// main();
