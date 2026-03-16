# Pan & Zoom DSL（CompilerDemo）

本文描述 `compileInteractionsDSL` 里与 **Pan（平移）** 和 **Zoom（缩放）** 相关的 DSL 语法与可用配置。

## 1. 基本结构

DSL 是一个数组，每个元素是一条交互规则。Pan 和 Zoom 通常配合使用，且常绑定在同一个图层上。

### 1.1 Pan（平移）

```js
{
  Trigger: "pan",
  targetLayer: "mainLayer", 
  feedbackOptions: {
    modifierKey: "shift" // 可选，按住 Shift 键触发
  },
  priority: 2,
  stopPropagation: true
}
```

### 1.2 Zoom（缩放）

```js
{
  Trigger: "zoom",
  targetLayer: "mainLayer",
  feedbackOptions: {
    modifierKey: "ctrl" // 可选，按住 Ctrl 键触发
  },
  priority: 3
}
```

---

## 2. Trigger 与底层映射

在 `compileInteractionsDSL` 中：
- `Trigger: "pan"` 映射到 `PanInstrument`。
- `Trigger: "zoom"` 映射到 `GeometricZoomInstrument`。

这两个 Instrument 主要用于几何变换（Geometric Transformation），即通过修改 Scale 的 Domain 来实现视图的平移和缩放。

---

## 3. 默认行为与上下文注入

编译器会自动为 Pan/Zoom 注入以下配置（无需手动在 DSL 中指定，但依赖 `compileInteractionsDSL` 的上下文 `ctx`）：

1.  **Scales（比例尺）**:
    - 自动查找上下文中的 `scales.x` 和 `scales.y`。
    - 并将其分别赋值给 `sharedVar.scaleX` 和 `sharedVar.scaleY`。
    - **注意**：确保在调用 `compileInteractionsDSL` 时传入了包含 `x` 和 `y` 比例尺的 `scales` 对象。

2.  **fixRange**:
    - 默认为 `true`。
    - 含义：保持 Range（屏幕坐标范围）不变，只修改 Domain（数据范围）。这是最常见的缩放/平移模式。

---

## 4. 可用配置项

以下配置项通常写在 `feedbackOptions` 中，部分也支持写在顶层。

### 4.1 modifierKey（修饰键）

限制交互触发的按键条件。

- **类型**: `String` | `Array<String>` | `null`
- **示例**:
  ```js
  feedbackOptions: {
    modifierKey: "shift" // 仅当按住 Shift 时触发
  }
  ```
  ```js
  feedbackOptions: {
    modifierKey: ["ctrl", "alt"] // 按住 Ctrl 或 Alt 均可（取决于具体实现，通常是“且”或“或”，需参考 Libra 文档，一般为单键限制）
  }
  ```

### 4.2 priority（优先级）

当多个交互绑定在同一图层且事件有重叠（如 click 和 brush，或 pan 和 zoom 的滚轮事件）时，优先级决定处理顺序。

- **类型**: `Number`
- **示例**: `priority: 2`

### 4.3 stopPropagation（阻止冒泡）

是否阻止事件继续传播到其他交互或图层。

- **类型**: `Boolean`
- **示例**: `stopPropagation: true`

### 4.4 gesture（手势识别）

指定触发的手势类型（如果支持）。

- **类型**: `String`
- **示例**: `"pinch"` (捏合缩放)

### 4.5 LinkLayers（多图层联动）

虽然 Pan/Zoom 主要操作 Scale，但如果多个图层共享同一个 Scale 对象，它们会自动联动。
如果需要显式指定联动图层（例如跨视图联动），可以使用 `LinkLayers`。

- **类型**: `Array<String>` (图层名称列表)
- **示例**:
  ```js
  feedbackOptions: {
    LinkLayers: ["layer1", "layer2"]
  }
  ```
  *注：具体联动效果依赖于 `PanInstrument` 对 `sharedVar.linkLayers` 的实现支持。在常见用法中，直接共享 `scale` 对象通常是更直接的联动方式。*

---

## 5. 完整示例（SPLOM 场景）

在散点图矩阵（SPLOM）中，通常需要对所有子图进行联动的平移和缩放。

```javascript
const interactions = [
  {
    Trigger: "pan",
    targetLayer: "cell-sepal_length-sepal_width", // 目标图层
    feedbackOptions: {
      modifierKey: "shift"
    },
    priority: 10
  },
  {
    Trigger: "zoom",
    targetLayer: "cell-sepal_length-sepal_width",
    feedbackOptions: {
      modifierKey: "ctrl" // 避免与页面滚动冲突
    },
    priority: 11
  }
];

// 编译时传入 scales
compileInteractionsDSL(interactions, {
  layersByName: { ... },
  scales: { 
    x: xScale, // D3 Scale 对象
    y: yScale 
  }
});
```
