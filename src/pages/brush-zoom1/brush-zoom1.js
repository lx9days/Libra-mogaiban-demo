import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";
import { setupIrisScatter } from "../_shared/irisScatter";

/*
图层追踪机制（Brush Zoom，更新版）
- 覆盖层命中：Zoom 的滚轮缩放需首先命中 selectionLayer/transientLayer 等覆盖层，随后读取并更新选框尺寸；这些队列层需开启指针事件（如 pointerEvents: "visiblePainted"）。
- 反向查找：当 target 仅写队列图层而不写 instrument 时，编译器会按该队列图层在同宿主层上反向查找唯一的 GroupSelection（Brush）instrument 并自动绑定；如候选不唯一，则保留 target.instrument 以消除歧义。
- 推荐：目标指向队列覆盖层（transientLayer/selectionLayer），保证滚轮命中与缩放行为稳定。
*/

export default async function init() {
  const { layersByName } = await setupIrisScatter();
    // const interactionsNewDSL = [
    //   {
    //     name: "lensMain",
    //     instrument: "lens",
    //     trigger: {
    //       type: "hover",
    //       priority: 1,
    //       stopPropagation: true,
    //     },
    //     target: {
    //       layer: "mainLayer",
    //     },
    //     feedback: {
    //       service: {
    //         lens: {
    //           renderSelection: false,
    //           r: 36,
    //           stroke: "#1d8f43",
    //           strokeWidth: 2,
    //           fontSize: 12,
    //           countLabelWidth: 56,
    //         },
    //         excentricLabeling: {
    //           countLabelDistance: 18,
    //           maxLabelsNum: 12,
    //           labelAccessor: (elem) => {
    //             const datum = d3.select(elem).datum();
    //             return `${datum.Name} (${datum.Horsepower}, ${datum.Miles_per_Gallon})`;
    //           },
    //           colorAccessor: (elem) => colorScale(d3.select(elem).datum()[CONFIG.FIELD_COLOR]),
    //           filter: (elem) => {
    //             return d3.select(elem).datum().Origin === "Europe";
    //             // return false;
    //           },
    //         },
    //       },
    //     },
    //   },
    //   {
    //     instrument: "zoom",
    //     trigger: {
    //       type: "zoom",
    //       priority: 2,
    //       stopPropagation: true,
    //     },
    //     target: {
    //       layer: "mainLayer",
    //     },
    //     feedback: {
    //       context:{
    //         updateLens: "scale",
    //         zoom: {
    //           step: 3,
    //           minR: 12,
    //           maxR: 96,
    //         }
    //       },
    //     },
    //   },
    // ];
  const interactions = [
    {
      instrument: "GroupSelection",
      trigger: {
        type: "brush",
        priority: 1,
        stopPropagation: true,
      },
      target: {
        layer: "mainLayer",
        name: "brushMain",
      },
      feedback: {
        selection: {
          highlight: "#14c94a",
          dim: { opacity: 0.08, selector: ".mark" },
          brushStyle: {
            fill: "#9d9d9d",
            opacity: 0.55,
            stroke: "none",
          },
        },
      },
    },
    {
      instrument: "Zoom",
      trigger: {
        type: "zoom",
        priority: 2,
        stopPropagation: true,
      },
      target: {
        instrument: "brushMain",
        layer: "transientLayer",
        pointerEvents: "visiblePainted",
      },
      feedback: {
        brush: {
          updateBrush: "scale",
          step: 0.18,
          minWidth: 36,
          minHeight: 36,
        },
      },
    },
  ];

  await compileInteractionsDSL(interactions, { layersByName });
  await Libra.createHistoryTrack?.();
}
