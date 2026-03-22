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
          transform: "scale",
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
