import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";
import { setupIrisScatter } from "../_shared/irisScatter";

/*
图层追踪机制（Brush Move-Drag，更新版）
- 覆盖层命中：Move 的拖拽命中与矩形读写发生在 selectionLayer/transientLayer 等覆盖层上，需保证这些队列层可接收指针事件（如 pointerEvents: "visiblePainted"）。
- 反向查找：当 target 仅写队列图层（如 transientLayer）而不写 instrument 时，编译器会按该队列图层在同宿主层上反向查找唯一的 GroupSelection（Brush）instrument 并自动绑定；若存在多个候选或需显式指定，则保留 target.instrument。
- 推荐：目标指向队列覆盖层（transientLayer/selectionLayer），以确保拖拽命中与交互行为稳定。
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
      instrument: "move",
      trigger: { type: "drag" },
      target: { layer: "transientLayer" },
      feedback: {
        service: {
          updateBrush: "translate",
        },
      },
    },
  ];

  await compileInteractionsDSL(interactions, { layersByName });
  await Libra.createHistoryTrack?.();
}
