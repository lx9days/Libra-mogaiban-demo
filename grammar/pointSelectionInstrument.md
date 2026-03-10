# Point Selection DSL（CompilerDemo）

本文描述 `compileInteractionsDSL` 里与 **Point Selection（点选 / 点悬停选）** 相关的 DSL 语法与可用配置，包含：
- `Instrument: "point selection" + Trigger: "hover"`（悬停点选）
- `Instrument: "point selection" + Trigger: "click"`（点击点选）
- Highlight / Tooltip / Dim / 多选合并（RemnantKey）
- 跨图层联动高亮（LinkLayers / LinkMatchMode 等）

相关实现：
- 编译器： [interactionCompiler.js](file:///d:/workspace/libra-%E5%AE%9E%E9%AA%8C%E5%AE%A4%E7%89%88/CompilerDemo/src/scripts/modules/interactionCompiler.js)
- 内置 Instrument（Hover/Click）： [builtin.ts](file:///d:/workspace/libra-%E5%AE%9E%E9%AA%8C%E5%AE%A4%E7%89%88/Libra/src/instrument/builtin.ts)
- Selection 与 Dim 行为： [selectionService.ts](file:///d:/workspace/libra-%E5%AE%9E%E9%AA%8C%E5%AE%A4%E7%89%88/Libra/src/service/selectionService.ts)
- 原子能力表（限制哪些 Instrument 支持哪些 Trigger）： [atomic.csv](file:///d:/workspace/libra-%E5%AE%9E%E9%AA%8C%E5%AE%A4%E7%89%88/CompilerDemo/atomic.csv)

---

## 1. 基本结构

DSL 是一个数组，每个元素是一条交互规则：

```js
const interactions = [
  {
    Instrument: "point selection",
    Trigger: "click",
    "Target layer": "mainLayer",
    "Feedback options": {
      Highlight: "#ff0000",
      Dim: { opacity: 0.1, selector: ".mark" }
    },
    priority: 1,
    stopPropagation: true
  }
];
```

字段含义（Point Selection 常用项）：
- `Instrument`: `"point selection"`（大小写不敏感；编译时会转小写匹配）
- `Trigger`: `"hover"` 或 `"click"`（否则会被跳过，见 `atomic.csv`）
- `"Target layer"`: 宿主 layer 名称（字符串）或 layer 名称数组
- `"Feedback options"`: 点选反馈配置（高亮/提示/弱化/联动等）
- `priority`, `stopPropagation`: 可选，透传给 Libra 的 Interaction.build，用于冲突管理

说明：
- 编译器支持在字符串里写 `//` 行内注释，注释右侧会被忽略。
- 编译器会读取 `atomic.csv` 做过滤：如果 `Instrument` 不在表内，或者该 `Trigger` 不在允许列表中，该规则会直接跳过。

---

## 2. Trigger 与底层映射

在 `compileInteractionsDSL` 中（以字符串比较为准）：
- `Trigger: "hover"` 会映射到 `HoverInstrument`
- `Trigger: "click"` 会映射到 `ClickInstrument`

`Trigger` 也会参与 `atomic.csv` 的校验：

```csv
selection,point selection,Hover Click,Highlighting/Tooltip/Dim
```

---

## 3. Target layer（目标图层）

`"Target layer"` 支持：
- 字符串：例如 `"mainLayer"`
- 数组：例如 `["layerA", "layerB"]`，会解析并对每个 layer 生效

解析规则要点：
- 会先从 `compileInteractionsDSL(specs, { layersByName })` 传入的 `layersByName` 里找
- 找不到时会 fallback 到 `Libra.Layer.findLayer(name)`
- 解析不到任何 layer 的规则会被跳过

---

## 4. Feedback options（点选反馈配置）

Point Selection 的 DSL 入口字段是 `"Feedback options"`（也兼容 `Feedback`），常用键如下。

### 4.1 Highlight（高亮）

用法 A：直接给颜色（最常用）

```js
"Feedback options": {
  Highlight: "#ff0000"
}
```

用法 B：对象写法（支持颜色 + attrValues）

```js
"Feedback options": {
  Highlight: {
    color: "#ff0000",
    attrValues: { "stroke-width": 2 }
  }
}
```

说明：
- `Highlight: "#..."` 会写入 `sharedVar.highlightColor`
- `Highlight.color/Color` 会写入 `sharedVar.highlightColor`
- `Highlight.attrValues/AttrValues`（或除 `color/Color` 外的其余键）会写入 `sharedVar.highlightAttrValues`

### 4.2 Tooltip（提示框）

```js
"Feedback options": {
  Tooltip: {
    fields: ["class", "sepal_length"],
    prefix: "iris: ",
    offset: { x: -20, y: -10 }
  }
}
```

字段含义：
- `fields`: 读取 datum 上的字段列表
- `prefix`: 可选，前缀文本
- `offset`: 可选，tooltip 偏移

### 4.3 Dim（弱化未选中元素）

Dim 的允许写法：

```js
// 1) 开启，使用默认 opacity
Dim: true

// 2) 指定 opacity（0~1）
Dim: 0.1

// 3) 指定 opacity + selector（只 dim 某些元素）
Dim: { opacity: 0.1, selector: ".mark" }

// 4) 关闭
Dim: false
```

行为要点：
- 只有存在“命中”时才会 dim；如果没有命中，会恢复原透明度
- Dim 会记录并恢复元素的原始 opacity（避免永久污染）

### 4.4 ModifierKey（按键修饰触发）

写在顶层或 Feedback options 中均可：

```js
modifierKey: "ctrl"
```

也支持数组：

```js
modifierKey: ["ctrl", "shift"]
```

说明：
- modifierKey 会在 Hover/Click 处理入口处做判定，不满足按键条件时不会触发点选逻辑。

### 4.5 RemnantKey（多选合并键）

用于“按住某个键时，把本次命中与上次结果做 union 去重”，典型用于多选叠加：

```js
"Feedback options": {
  RemnantKey: "shift"
}
```

行为要点：
- 未按住 remnantKey：本次结果会替换上次结果
- 按住 remnantKey：本次结果会与上次结果合并并去重

### 4.6 LinkLayers（跨图层联动高亮）

用于 SPLOM 等多视图联动点选/高亮。示例（来自 point-selection-link 页面）：

```js
"Feedback options": {
  Highlight: "#00ff1aff",
  LinkLayers: Object.values(cellLayers),
  LinkMatchMode: "datum",
  LinkDefaultOpacity: 0.7,
  LinkBaseOpacity: 0.08,
  LinkSelectedOpacity: 0.95,
  LinkStrokeWidth: 1
}
```

字段含义：
- `LinkLayers`: 需要联动的 layer 实例数组
- `LinkMatchMode`:
  - `"datum"`：按 datum 对象身份匹配（命中元素的 datum 与其他 layer 的 datum 相同才高亮）
  - `"field"`：按字段值匹配（需要配合 `LinkFields`）
- `LinkFields`: string 或 string[]，用于 `"field"` 模式
- `LinkDefaultOpacity` / `LinkBaseOpacity` / `LinkSelectedOpacity`: 非选中 / 底层 / 选中透明度
- `LinkStrokeColor` / `LinkStrokeWidth`: 联动渲染描边样式

---

## 5. 组合与冲突管理（priority / stopPropagation）

当多个交互绑定到相同事件时：
- `priority`: 数值越大越先处理
- `stopPropagation: true`: 当前交互成功触发后阻止事件继续传播到更低优先级交互

---

## 6. 示例

### 6.1 点击点选 + 高亮 + 弱化（单视图）

```js
{
  Instrument: "point selection",
  Trigger: "click",
  "Target layer": "mainLayer",
  "Feedback options": {
    Highlight: "#ff0000",
    Dim: { opacity: 0.1, selector: ".mark" }
  },
  priority: 1,
  stopPropagation: true
}
```

### 6.2 悬停点选 + Tooltip（带 modifierKey）

```js
{
  Instrument: "point selection",
  Trigger: "hover",
  "Target layer": "mainLayer",
  modifierKey: "shift",
  "Feedback options": {
    Highlight: { color: "#00ff1a", attrValues: { "stroke-width": 2 } },
    Tooltip: { fields: ["class"], prefix: "class: " }
  }
}
```

### 6.3 多选合并（RemnantKey）

```js
{
  Instrument: "point selection",
  Trigger: "click",
  "Target layer": "mainLayer",
  "Feedback options": {
    Highlight: "#ff0000",
    RemnantKey: "shift"
  }
}
```

