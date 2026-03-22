import * as d3 from "d3";
import Libra from "libra-vis";
import { compileInteractionsDSL } from "../../scripts/modules/interactionCompiler";
import { setupCarsScatter } from "../_shared/carsScatter";

/*
图层追踪机制（Lens Zoom，更新版）
- Lens（悬停）：在宿主 mainLayer 上注册 HoverInstrument，并将覆盖元素绘制到队列层 LensLayer。
- Zoom（滚轮缩放半径）：应绑定宿主 mainLayer。滚轮事件在绑定图层处理，更新绑定键(bindingKey)对应的镜头状态，并向宿主层派发刷新事件；绑定到 LensLayer 不会驱动宿主层的 HoverInstrument。
- 反向查找：当未显式提供 bindingKey 时，编译器会在同宿主层上反查唯一的 Lens 实例并自动绑定；多 Lens 场景下可显式提供 bindingKey 以消除歧义。
*/

export default async function init() {
  const { color, layersByName } = await setupCarsScatter({
    pointFill: () => "none",
    pointStrokeWidth: 1.5,
  });

  const interactions = [
    {
      instrument: "Lens",
      trigger: {
        type: "hover",
        priority: 1,
        stopPropagation: true,
      },
      target: {
        layer: "mainLayer",
      },
      feedback: {
        lens: {
          excentricLabeling: {
            renderSelection: false,
            r: 36,
            stroke: "#1d8f43",
            strokeWidth: 2,
            countLabelDistance: 18,
            fontSize: 12,
            countLabelWidth: 56,
            maxLabelsNum: 12,
            labelAccessor: (circleElem) => {
              const datum = d3.select(circleElem).datum();
              return `${datum.Name} (${datum.Horsepower}, ${datum.Miles_per_Gallon})`;
            },
            colorAccessor: (circleElem) => color(d3.select(circleElem).datum().Origin),
            filter: (circleElem) => d3.select(circleElem).datum().Origin === "Europe",
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
        layer: "mainLayer",
      },
      feedback: {
        service: {
          updateLens: {
            step: 3,
            minR: 12,
            maxR: 96,
          },
        },
      },
    },
  ];

  await compileInteractionsDSL(interactions, { layersByName });
  await Libra.createHistoryTrack?.();
}
