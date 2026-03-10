# Helper Line DSL（CompilerDemo）

本文描述 `compileInteractionsDSL` 里与 **Helper Line（辅助线 / 对齐线）** 相关的 DSL 语法与实现模式。

## 1. 基本结构

Helper Line 通常用于在鼠标悬停（Hover）时显示辅助线（垂直或水平）以及数据交叉点的 Tooltip。

与其他内置 Instrument 不同，`helperLine` 目前主要通过 **Custom Feedback Flow**（自定义反馈流）来实现，即通过 `Feedback options` 中的 `Insert` 指令注入自定义的 Service 和 Transformer。

```js
const interactions = [
  {
    Instrument: "helperLine", // 标识符，对应 atomic.csv
    Trigger: "hover",         // 触发方式，底层映射为 HoverInstrument
    "Target layer": "mainLayer",
    "Feedback options": {
      // 核心配置：注入自定义服务与渲染器
      Insert: [
        {
          find: "SelectionService", // 在 SelectionService 之后插入
          flow: [
            {
              comp: "IntersectionService", // 自定义服务：计算交叉点数据
              sharedVar: {
                // 传入必要的上下文
                data: dataset,
                scaleX: xScale,
                scaleY: yScale,
                scaleColor: colorScale,
                type: "Hover"
              }
            }
          ]
        },
        {
          find: "IntersectionService", // 在 IntersectionService 之后插入
          flow: [
            {
              comp: "TooltipLineTransformer", // 自定义渲染器：绘制线和 Tooltip
              sharedVar: {
                orientation: ["vertical"], // 垂直线
                showIntersection: true     // 显示交叉点详情
              }
            }
          ]
        }
      ],
      // 可选：移除默认的选区渲染
      Remove: [{ find: "SelectionTransformer" }] 
    }
  }
];
```

---

## 2. 核心组件说明

由于 `helperLine` 依赖自定义组件，使用前通常需要先注册对应的 Service 和 Transformer（如 `IntersectionService` 和 `TooltipLineTransformer`）。

### 2.1 IntersectionService (Service)

负责根据鼠标位置计算与数据的交叉点。

*   **输入 (sharedVar)**:
    *   `data`: 原始数据集。
    *   `scaleX`, `scaleY`: 比例尺，用于坐标转换。
    *   `type`: 交互类型（如 "Hover"）。
    *   `layer`: 目标图层（可选，通常自动获取）。
*   **输出**:
    *   计算出的交叉点数据（`lines` 对象），传递给下游 Transformer。

### 2.2 TooltipLineTransformer (GraphicalTransformer)

负责绘制辅助线和 Tooltip。

*   **输入 (sharedVar)**:
    *   `orientation`: `["vertical"]` (垂直线) 或 `["horizontal"]` (水平线)。
    *   `showIntersection`: `true` | `false`，是否显示数据点的 Tooltip。
    *   `style`: 线条样式配置（可选）。
    *   `scaleX`, `scaleY`: 比例尺（从上游获取）。

---

## 3. Trigger 与底层映射

在 `interactionCompiler.js` 中：
*   `Instrument: "helperLine"` 主要作为语义标识（在 `atomic.csv` 中注册）。
*   实际行为由 `Trigger: "hover"` 决定，它会映射到 `HoverInstrument`。
*   通过 `Feedback options` 的 `Insert` 机制，扩展了 `HoverInstrument` 的默认行为，使其具备辅助线功能。

---

## 4. 完整示例

参考 `src/pages/helper-line/helper-line.js` 中的实现：

```javascript
// 1. 定义反馈流配置函数
const helperLineHoverFeedback = (opts) => ({
  Remove: [{ find: "SelectionTransformer" }],
  Insert: [
    {
      find: "SelectionService",
      flow: [
        {
          comp: "IntersectionService",
          sharedVar: {
            data: data,
            scaleX: xMain,
            scaleY: yMain,
            scaleColor: color,
            layer: layer,
            type: "Hover",
          },
        },
      ],
    },
    {
      find: "IntersectionService",
      flow: [
        {
          comp: "TooltipLineTransformer",
          sharedVar: {
            orientation: ["vertical"],
            showIntersection: opts?.showIntersection ?? true,
          },
        },
      ],
    },
  ],
});

// 2. 编译交互
const interactions = [
  {
    Name: "HelperLineHover",
    Instrument: "helperLine",
    Trigger: "hover",
    "Target layer": "mainLayer",
    "Feedback options": helperLineHoverFeedback({ showIntersection: true }),
  },
];
```
