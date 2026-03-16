# Lens Instrument DSL（CompilerDemo）

本文描述 `compileInteractionsDSL` 里与 Lens 相关的 DSL 语法与可用配置（以 ExcentricLabeling Lens 为主），包含：
- `Instrument: "Lens"`（ExcentricLabeling lens）
- `Instrument: "Zoom"` + `feedbackOptions: { LensZoom: ... }`（滚轮缩放 lens 半径）
- 与 lens 生成的 `LabelLayer` 协作（例如 label hover 高亮）

相关实现：
- 编译器： [interactionCompiler.js](file:///d:/workspace/libra-%E5%AE%9E%E9%AA%8C%E5%AE%A4%E7%89%88/CompilerDemo/src/scripts/modules/interactionCompiler.js)
- 构建器： [LibraManager.js](file:///d:/workspace/libra-%E5%AE%9E%E9%AA%8C%E5%AE%A4%E7%89%88/CompilerDemo/src/core/LibraManager.js)

---

## 1. 基本结构

DSL 是一个数组，每个元素是一条交互规则：

```js
const interactions = [
  {
    Name: "lensMain",
    Instrument: "Lens",
    Trigger: "hover",
    targetLayer: "mainLayer",
    modifierKey: "Shift",
    feedbackOptions: {
      ExcentricLabeling: { /* ... */ }
    },
    priority: 1,
    stopPropagation: true
  }
];
```

字段含义（Lens 相关常用项）：
- `Instrument`: `"Lens"`（大小写不敏感，编译时会转成小写判断）
- `Trigger`: 必须为 `"hover"`（由编译器映射到 `HoverInstrument` 的 inherit）
- `targetLayer`: Lens 触发的宿主 layer 名称（通常是主图层，例如 `"mainLayer"`）
- `Name`: 可选，用于给该 instrument 注册一个名字；后续可用 `"Target Instrument": "<Name>"` 引用它
- `bindingKey`: 可选，lens 的绑定键；用于让 Zoom 等交互找到要控制的 lens（未提供时会回退用 `Name` 或自动生成）
- `modifierKey`: 可选（`"Shift"` / 数组 / `null`），用于要求按键才激活
- `feedbackOptions.ExcentricLabeling`: 配置 ExcentricLabeling lens 的核心参数
- `priority`, `stopPropagation`: 可选，透传给 Libra 的 Interaction.build

---

## 2. ExcentricLabeling 配置（Lens 的核心）

在 `feedbackOptions` 中配置 `ExcentricLabeling`：

```js
{
  Instrument: "Lens",
  Trigger: "hover",
  targetLayer: "mainLayer",
  feedbackOptions: {
    ExcentricLabeling: {
      r: 20,
      maxLabelsNum: 10,
      renderSelection: false,
      stroke: "green",
      strokeWidth: 2,
      countLabelDistance: 20,
      fontSize: 12,
      countLabelWidth: 40,

      labelAccessor: (elem) => /* 返回 label 文本 */,
      colorAccessor: (elem) => /* 返回颜色 */
    }
  }
}
```

常用参数：
- `r`: lens 半径（可被 LensZoom 动态调整）
- `maxLabelsNum`: 最大 label 数
- `labelAccessor(elem)`: 从命中元素提取 label 文本
- `colorAccessor(elem)`: 从命中元素提取连线/框的颜色
- `stroke`, `strokeWidth`: lens 圆圈与连线样式
- `countLabelDistance`, `countLabelWidth`, `fontSize`: countLabel 的布局/字号

说明：
- `labelAccessor`/`colorAccessor` 的 `elem` 是“屏幕元素”（可能是 `obj.__libra__screenElement` 的解包结果）。

---

## 3. CountLabel（可扩展聚合）

countLabel 默认显示：**lens 半径内命中元素数量**。

你可以通过 `ExcentricLabeling` 的以下配置扩展定义：

### 3.1 统一入口：`count`

#### A) 关键词聚合（推荐）

```js
count: {
  field: "Horsepower",     // 或 accessor: (el)=>...
  op: "sum",               // 聚合关键词
  formatter: (v, ctx) => `${ctx.count} / ${Math.round(v)}` // 或 format: ".0f"
}
```

支持的 `op`：
- `count`
- `sum`
- `min`
- `max`
- `mean` / `avg` / `average`
- `median`
- `q1` / `p25`
- `q3` / `p75`
- `iqr`

`field`：等价于 `accessor: (el) => d3.select(el).datum()?.[field]`。

formatter 两种形式：
- `formatter(value, ctx)`：返回 string/number
- `format: ".2f"`：使用 `d3.format` 的格式化字符串

ctx 结构：
- `count`: 半径内命中元素数量
- `elements`: 半径内命中元素数组
- `event`: pointer 事件
- `layer`: 宿主 layer
- `radius`: 当前半径

#### B) 完全自定义聚合函数

```js
count: (elements, ctx) => {
  const sum = d3.sum(elements, (el) => d3.select(el).datum()?.Horsepower || 0);
  return { value: sum, text: `${ctx.count} / ${Math.round(sum)}` };
}
```

返回值约定：
- `number`：作为数值显示
- `string`：直接作为文本显示
- `{ value, text }`：同时提供数值与文本（优先用 text 显示）

### 3.2 兼容入口：`countAccessor` + `countFormatter`

旧写法仍可用：

```js
countAccessor: (el) => d3.select(el).datum()?.Horsepower,
countFormatter: (sum, { count }) => `${count} / ${Math.round(sum)}`
```

含义：
- `countAccessor`：对半径内元素逐个取值，内部做 sum（忽略 NaN）
- `countFormatter`：自定义展示文本

优先级：
1) `count`（函数或对象）
2) `countAccessor/countFormatter`
3) 默认 `count`（数量）

---

## 4. LensZoom：滚轮缩放 lens 半径

使用 `Instrument: "Zoom"`，并在 `feedbackOptions` 里写 `LensZoom`：

```js
{
  Instrument: "Zoom",
  Trigger: "zoom",
  targetLayer: "mainLayer",
  bindingKey: "lensMain",
  feedbackOptions: {
    LensZoom: { step: 2, minR: 8, maxR: 120 }
  },
  stopPropagation: true
}
```

字段含义：
- `bindingKey`: 要控制哪个 lens（与 Lens 的 `bindingKey` 对应）
- `LensZoom.step`: 半径每次增减的步长
- `LensZoom.minR/maxR`: 半径范围
- `modifierKey`: 可选（同 Lens），限制缩放需要按键

也可以通过 `"Target Instrument"` 自动找到要控制的 lens：

```js
{
  Instrument: "Zoom",
  Trigger: "zoom",
  "Target Instrument": "lensMain",
  targetLayer: "mainLayer",
  feedbackOptions: { LensZoom: { step: 2, minR: 8, maxR: 120 } }
}
```

---

## 5. 与 LabelLayer 协作（例如 label hover 高亮）

ExcentricLabeling 会在宿主 layer 的队列里生成 `LabelLayer`（以及 `LensLayer` 等）。
如果你要对 label 图层挂交互（例如 hover 高亮），推荐写一条独立 DSL 规则：

```js
{
  Instrument: "point selection",
  Trigger: "hover",
  "Target Instrument": "lensMain",
  targetLayer: "LabelLayer",
  feedbackOptions: {
    Highlight: { stroke: "#ff0000", "stroke-width": 2 }
  },
  priority: 1,
  stopPropagation: true
}
```

要点：
- `"Target Instrument": "lensMain"` 指向 lens 的宿主 layer，然后 `targetLayer: "LabelLayer"` 会自动解析到该宿主 layer 的 queue layer。
- 编译器会为 `LabelLayer` 自动加 `pointerEvents: "viewPort"`（避免命中不到 label）。

