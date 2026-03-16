# Group Selection DSL（CompilerDemo）

本文描述 `compileInteractionsDSL` 里与 **Group Selection（框选 / 区域选择）** 相关的 DSL 语法与可用配置，包含：
- `Instrument: "group selection" + Trigger: "brush"`（框选）
- Highlight / Dim / 多选合并（RemnantKey）
- 跨图层联动高亮（LinkLayers / AttrName / ScaleX / ScaleY 等）

相关实现：
- 编译器： [interactionCompiler.js](file:///d:/workspace/libra-%E5%AE%9E%E9%AA%8C%E5%AE%A4%E7%89%88/CompilerDemo/src/scripts/modules/interactionCompiler.js)
- 内置 Instrument（Brush）： [builtin.ts](file:///d:/workspace/libra-%E5%AE%9E%E9%AA%8C%E5%AE%A4%E7%89%88/Libra/src/instrument/builtin.ts)
- Selection 与 Dim 行为： [selectionService.ts](file:///d:/workspace/libra-%E5%AE%9E%E9%AA%8C%E5%AE%A4%E7%89%88/Libra/src/service/selectionService.ts)

---

## 1. 基本结构

DSL 是一个数组，每个元素是一条交互规则：

```js
const interactions = [
  {
    Instrument: "group selection",
    Trigger: "brush",
    targetLayer: "mainLayer",
    feedbackOptions: {
      Highlight: "#00ff1aff",
      Dim: { opacity: 0.1, selector: ".mark" },
      RemnantKey: "shift"
    },
    priority: 1,
    stopPropagation: true
  }
];
```

字段含义（Group Selection 常用项）：
- `Instrument`: `"group selection"`（大小写不敏感；编译时会转小写匹配）
- `Trigger`: `"brush"`（目前 Group Selection 主要支持 brush）
- `targetLayer`: 宿主 layer 名称（字符串）
- `feedbackOptions`: 框选反馈配置（高亮/弱化/联动等）
- `priority`, `stopPropagation`: 可选，透传给 Libra 的 Interaction.build，用于冲突管理

---

## 2. Trigger 与底层映射

在 `compileInteractionsDSL` 中：
- `Trigger: "brush"` 会映射到 `GroupSelectionInstrument` (基于 D3 Brush 实现)

---

## 3. feedbackOptions（框选反馈配置）

Group Selection 的 DSL 入口字段是 `feedbackOptions`，常用键如下。

### 3.1 Highlight（高亮）

设置选中元素的颜色：

```js
feedbackOptions: {
  Highlight: "#00ff1aff"
}
```

说明：
- `Highlight` 的值会写入 `sharedVar.highlightAttrValues` 的 `fill` 或 `stroke`（取决于具体实现和配置，通常是 fill）。

### 3.2 Dim（弱化未选中元素）

控制未被框选元素的样式：

```js
feedbackOptions: {
  Dim: { 
    opacity: 0.1, 
    selector: ".mark" 
  }
}
```

字段含义：
- `opacity`: 未选中元素的透明度（0~1）。
- `selector`: 指定需要变暗的元素选择器（例如 `".mark"`），避免影响背景或其他非数据元素。

### 3.3 RemnantKey（多选合并键）

用于“按住某个键时，保留上一次的选区并叠加新的选区”：

```js
feedbackOptions: {
  RemnantKey: "shift" // 或 "Shift"
}
```

行为要点：
- 未按住键：新的框选会清除旧的选区。
- 按住键：新的框选会与旧的选区共存（Union）。

### 3.4 跨图层联动（Linked Brushing）

用于 SPLOM（散点图矩阵）等场景，实现一个视图框选，其他视图同步高亮。

```js
feedbackOptions: {
  Highlight: "#00ff1aff",
  RemnantKey: "Shift",
  
  // 坐标映射配置
  ScaleX: sx, // D3 Scale 对象
  ScaleY: sy, // D3 Scale 对象
  AttrName: [xiField, yiField], // 数据字段名数组
  
  // 联动目标配置
  LinkLayers: Object.values(cellLayers), // 需要联动的 Layer 实例数组
  
  // 联动样式配置
  LinkDefaultOpacity: 0.7,   // 默认透明度
  LinkBaseOpacity: 0.08,     // 未选中时的基础透明度
  LinkSelectedOpacity: 0.95, // 选中时的透明度
  LinkStrokeWidth: 1         // 选中时的描边宽度
}
```

字段含义：
- `ScaleX` / `ScaleY`: 当前图层的比例尺，用于将像素坐标反算回数据值。
- `AttrName`: 对应的数据字段名，用于在数据层面匹配选中的数据点。
- `LinkLayers`: 需要同步高亮的图层列表。
- `LinkOpacities`: 控制联动时各状态的透明度，确保视觉上的聚焦效果。
