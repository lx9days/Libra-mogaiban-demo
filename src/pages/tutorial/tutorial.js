import * as d3 from 'd3';
import Libra from 'libra-vis';
import LibraManager from '../../core/LibraManager';
import { compileDSL } from '../../scripts/dsl-compiler';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CORE_FIELDS = [
  {
    name: 'instrument',
    title: '交互类型',
    description: '用于声明待实例化的交互类型，例如 point-selection、group-selection、pan、zoom、reorder、lens。',
  },
  {
    name: 'trigger',
    title: '触发方式',
    description: '建议采用对象形式书写，并至少包含 type 字段，例如 { type: "hover" } 或 { type: "brush" }。',
  },
  {
    name: 'target',
    title: '作用目标',
    description: '建议写成 { layer: "mainLayer" }。当前校验与编译流程主要依赖 target.layer 解析目标图层。',
  },
  {
    name: 'feedback',
    title: '反馈配置',
    description: '必须为对象；其第一层子字段仅允许 redrawFunc、service、feedforward、context。',
  },
];

const WRITING_STEPS = [
  '首先定义一个交互数组，其中每一项对应一条独立的交互规则。',
  '建议在每条规则中显式声明 instrument、trigger、target、feedback 四个顶层字段。',
  '若需配置优先级、组合键或事件传播控制，应将 priority、modifierKey、stopPropagation 写入 trigger。',
  '若需提供运行时上下文，优先置于 feedback.context；若需配置专项服务参数，则置于 feedback.service。',
];

const TIPS = [
  '新版 DSL 的顶层字段仅允许 instrument、trigger、target、feedback，以及可选的 name、customFeedbackFlow。',
  'feedback 不应为空；至少应提供 redrawFunc、service、feedforward、context 中的一项。',
  '为保持与当前 normalize/validate 过程的一致性，建议统一采用小写连字符命名，例如 point-selection、group-selection。',
  '若交互依赖图层解析，建议优先采用 target: { layer: "..." }，而非纯字符串写法。',
];

const ADVANCED_FIELDS = [
  {
    label: 'name',
    description: '为规则提供可读标识，以便调试、记录与区分多个实例。',
  },
  {
    label: 'trigger.priority',
    description: '当多个交互竞争同一事件时，数值越大者优先执行。',
  },
  {
    label: 'trigger.modifierKey',
    description: '用于为交互附加组合键约束，例如 ctrl、shift、alt。',
  },
  {
    label: 'trigger.stopPropagation',
    description: '命中后阻止事件继续传播至优先级更低的交互。',
  },
  {
    label: 'customFeedbackFlow',
    description: '用于插入、移除或覆盖系统默认的反馈流程。',
  },
];

const INSTRUMENT_ROWS = [
  {
    id: 'point-selection',
    family: 'Selection',
    triggers: 'hover, click',
    aliases: 'pointselection, point, selection',
  },
  {
    id: 'group-selection',
    family: 'Selection',
    triggers: 'brush',
    aliases: 'groupselection, brush',
  },
  {
    id: 'axis-selection',
    family: 'Selection',
    triggers: 'brushx, brush-x, brushy, brush-y, brush',
    aliases: 'axisselection, axis selection',
  },
  {
    id: 'pan',
    family: 'Transform',
    triggers: 'pan, drag',
    aliases: 'panning',
  },
  {
    id: 'zoom',
    family: 'Transform',
    triggers: 'zoom, wheel',
    aliases: 'zooming',
  },
  {
    id: 'move',
    family: 'Transform',
    triggers: 'drag, move',
    aliases: 'moving, brush-move, brushmove',
  },
  {
    id: 'lens',
    family: 'Lens',
    triggers: 'hover, click',
    aliases: 'excentric-labeling, excentriclabeling',
  },
  {
    id: 'reorder',
    family: 'Reorder',
    triggers: 'drag',
    aliases: 'reordering, reorderinstrument',
  },
  {
    id: 'helper-line',
    family: 'Helper',
    triggers: 'hover, click, drag',
    aliases: 'helperline',
  },
];

const EXAMPLE_LINES = [
  'const interactions = [',
  '  {',
  '    name: "hover-highlight",',
  '    instrument: "point-selection",',
  '    trigger: {',
  '      type: "hover"',
  '    },',
  '    target: {',
  '      layer: "mainLayer"',
  '    },',
  '    feedback: {',
  '      redrawFunc: {',
  '        highlight: {',
  '          fill: "#fcc602",',
  '          stroke: "#10233f"',
  '        }',
  '      },',
  '      context: {',
  '        link: {',
  '          layers: ["detailLayer"],',
  '          field: "id"',
  '        }',
  '      }',
  '    }',
  '  }',
  '];',
  '',
  'await compileDSL(',
  '  interactions,',
  '  { layersByName: { mainLayer: layer } },',
  '  { execute: true }',
  ');',
];

const FEEDBACK_LINES = [
  'feedback: {',
  '  redrawFunc: {',
  '    highlight: { color: "#fcc602" },',
  '    dim: { opacity: 0.15 }',
  '  },',
  '  service: {',
  '    reorderDirection: "x"',
  '  },',
  '  feedforward: {',
  '    sourceLayer: cellLayer,',
  '    offset: { x: 0, y: 0 }',
  '  },',
  '  context: {',
  '    scaleX,',
  '    scaleY,',
  '    fixRange: true,',
  '    link: {',
  '      layers: ["detailLayer"],',
  '      field: "id"',
  '    }',
  '  }',
  '}',
];

const FEEDBACK_TOP_LEVEL_FIELDS = [
  {
    name: 'redrawFunc',
    title: '视觉重绘',
    description: '用于声明高亮、弱化与重绘逻辑。对 selection 类交互而言，highlight 与 dim 最为常见；reorder 亦可直接提供 redraw 函数。',
  },
  {
    name: 'service',
    title: '运行时服务参数',
    description: '用于配置特定 instrument 的运行时服务参数，例如 lens 的半径与样式、reorder 的方向、helper-line 的朝向与交点显示策略。',
  },
  {
    name: 'feedforward',
    title: '预告和拖拽副本',
    description: '常用于 reorder，用于声明拖拽过程中应从哪些图层复制图形，以及副本层的偏移方式。',
  },
  {
    name: 'context',
    title: '比例尺与联动上下文',
    description: '用于提供 scaleX、scaleY、fixRange、semantic、link、dimension、names、scales、data 等运行时上下文信息。',
  },
];

const FEEDBACK_INSTRUMENT_ROWS = [
  {
    instrument: 'point-selection',
    branches: 'redrawFunc + context',
    fields: 'highlight, dim, link.layers, link.field/link.fields, scaleX, scaleY, Tooltip',
    note: '最常见的用法是 hover/click 高亮；若需构造 linked selection，可将联动图层与匹配字段置于 context.link。',
  },
  {
    instrument: 'group-selection',
    branches: 'redrawFunc + context',
    fields: 'highlight, dim, brushStyle, attrName, scaleX, scaleY, link.*, Tooltip',
    note: '通常用于 brush 选区；brushStyle 用于控制选框样式，attrName 可辅助系统按维度解释选区。',
  },
  {
    instrument: 'axis-selection',
    branches: 'redrawFunc + context',
    fields: 'highlight, axisDirection, dimension/attrName, scale, linkLayers/linkTo, Tooltip',
    note: '轴向刷选最依赖 dimension 与 scale；若 trigger 已明确写为 brushx/brushy，axisDirection 通常可以省略。',
  },
  {
    instrument: 'pan',
    branches: 'context',
    fields: 'scaleX, scaleY, fixRange',
    note: '新版 pan 主要消费比例尺与范围约束；若未提供 scaleX/scaleY，通常不会产生可见的视图平移效果。',
  },
  {
    instrument: 'zoom',
    branches: 'context',
    fields: 'scaleX, scaleY, fixRange, semantic, scaleLevels, updateLens, updateBrush, zoom.targetLensName, zoom.targetBrushName',
    note: '常规缩放通常配置 scaleX/scaleY/fixRange；若需语义缩放，则进一步补充 semantic 与 scaleLevels。',
  },
  {
    instrument: 'move',
    branches: 'context 或 service',
    fields: 'updateBrush: "translate"',
    note: '在当前实现中，move 最常见的用途是平移既有 brush；系统会依据 updateBrush 进入 brush-move 模式。',
  },
  {
    instrument: 'lens',
    branches: 'service.lens',
    fields: 'r, stroke, strokeWidth, renderSelection, fontSize, countLabelWidth, countLabelDistance, maxLabelsNum, labelAccessor, colorAccessor, count, countAccessor, countFormatter, filter',
    note: '上述字段将直接传递至 excentric labeling 运行时；若需兼容既有命名，也可写入 service.excentricLabeling。',
  },
  {
    instrument: 'reorder',
    branches: 'redrawFunc + service + feedforward + context',
    fields: 'redrawFunc, reorderDirection, sourceLayer, offset, names, scales.x, scales.y',
    note: 'reorder 对 feedback 的依赖最为完整；方向、副本生成与重绘函数通常需要协同配置。',
  },
  {
    instrument: 'helper-line',
    branches: 'service + context',
    fields: 'orientation, showIntersection, scales.x, scales.y, data',
    note: '基础辅助线主要依赖 orientation；若 showIntersection = true，通常还需同时提供 data 及相关 scales。',
  },
];

const FEEDBACK_EXAMPLES = [
  {
    instrument: 'point-selection',
    trigger: 'hover',
    lines: [
      '{',
      '  instrument: "point-selection",',
      '  trigger: { type: "hover" },',
      '  target: { layer: "mainLayer" },',
      '  feedback: {',
      '    redrawFunc: {',
      '      highlight: { color: "#fcc602" },',
      '      dim: { opacity: 0.15 }',
      '    }',
      '  }',
      '}',
    ],
  },
  {
    instrument: 'group-selection',
    trigger: 'brush',
    lines: [
      '{',
      '  instrument: "group-selection",',
      '  trigger: { type: "brush" },',
      '  target: { layer: "mainLayer" },',
      '  feedback: {',
      '    redrawFunc: {',
      '      highlight: { stroke: "#10233f" }',
      '    }',
      '  }',
      '}',
    ],
  },
  {
    instrument: 'axis-selection',
    trigger: 'brushx',
    lines: [
      '{',
      '  instrument: "axis-selection",',
      '  trigger: { type: "brushx" },',
      '  target: { layer: "xAxisLayer" },',
      '  feedback: {',
      '    context: {',
      '      dimension: "Horsepower",',
      '      scale: xScale,',
      '      linkLayers: ["mainLayer"]',
      '    }',
      '  }',
      '}',
    ],
  },
  {
    instrument: 'pan',
    trigger: 'pan',
    lines: [
      '{',
      '  instrument: "pan",',
      '  trigger: { type: "pan", modifierKey: "ctrl" },',
      '  target: { layer: "mainLayer" },',
      '  feedback: {',
      '    context: {',
      '      scaleX,',
      '      scaleY,',
      '      fixRange: true',
      '    }',
      '  }',
      '}',
    ],
  },
  {
    instrument: 'zoom',
    trigger: 'zoom',
    lines: [
      '{',
      '  instrument: "zoom",',
      '  trigger: { type: "zoom", modifierKey: "ctrl" },',
      '  target: { layer: "mainLayer" },',
      '  feedback: {',
      '    context: {',
      '      scaleX,',
      '      scaleY,',
      '      fixRange: true',
      '    }',
      '  }',
      '}',
    ],
  },
  {
    instrument: 'move',
    trigger: 'drag',
    lines: [
      '{',
      '  instrument: "move",',
      '  trigger: { type: "drag" },',
      '  target: { layer: "mainLayer" },',
      '  feedback: {',
      '    context: {',
      '      updateBrush: "translate"',
      '    }',
      '  }',
      '}',
    ],
  },
  {
    instrument: 'lens',
    trigger: 'hover',
    lines: [
      '{',
      '  instrument: "lens",',
      '  trigger: { type: "hover" },',
      '  target: { layer: "mainLayer" },',
      '  feedback: {',
      '    service: {',
      '      lens: {',
      '        r: 40,',
      '        stroke: "#1d8f43",',
      '        strokeWidth: 3,',
      '        labelAccessor: (elem) => d3.select(elem).datum()?.Name',
      '      }',
      '    }',
      '  }',
      '}',
    ],
  },
  {
    instrument: 'reorder',
    trigger: 'drag',
    lines: [
      '{',
      '  instrument: "reorder",',
      '  trigger: { type: "drag" },',
      '  target: { layer: "xAxisLayer" },',
      '  feedback: {',
      '    redrawFunc: redrawMatrix,',
      '    service: { reorderDirection: "x" },',
      '    feedforward: {',
      '      sourceLayer: cellLayer,',
      '      offset: { x: 0, y: 0 }',
      '    },',
      '    context: {',
      '      names,',
      '      scales: { x: scaleX, y: scaleY }',
      '    }',
      '  }',
      '}',
    ],
  },
  {
    instrument: 'helper-line',
    trigger: 'hover',
    lines: [
      '{',
      '  instrument: "helper-line",',
      '  trigger: { type: "hover" },',
      '  target: { layer: "mainLayer" },',
      '  feedback: {',
      '    service: {',
      '      orientation: ["horizontal"]',
      '    },',
      '    context: {',
      '      scales: { y: scaleY }',
      '    }',
      '  }',
      '}',
    ],
  },
];

const PLAYGROUND_EDITOR_ORDER = [
  'point-selection',
  'group-selection',
  'axis-selection',
  'pan',
  'lens',
  'zoom',
  'helper-line',
];

const PLAYGROUND_DEFAULT_ENABLED = new Set(['point-selection']);

const PLAYGROUND_CARD_META = {
  'point-selection': {
    hint: '该示例便于观察 hover / click 所触发的局部高亮机制，适合作为初始参照。',
  },
  'group-selection': {
    hint: '该示例适合考察 brush 选区在散点图中的作用范围与反馈表现。',
  },
  'axis-selection': {
    hint: '该示例默认作用于 x 轴，便于观察 axis brush 如何影响主图中的点选择结果。',
  },
  pan: {
    hint: '按住 Ctrl 并拖动画布，可检验平移交互是否在当前比例尺配置下生效。',
  },
  lens: {
    hint: '将指针移动至点附近，可观察 lens / excentric labeling 的局部聚焦效果。',
  },
  zoom: {
    hint: '按住 Ctrl 并执行缩放操作，可检验当前 runtime 下较稳定的 zoom trigger 配置。',
  },
  'helper-line': {
    hint: '该示例用于观察辅助线与交点的生成过程，并展示 service 与 context 的联合配置方式。',
  },
};

const REORDER_GALLERY_PAGE = 'categorical-beeswarm';
const REORDER_GALLERY_LABEL = 'Categorical Beeswarm';
const MOVE_GALLERY_PAGE = 'Dust&Magnet';
const MOVE_GALLERY_LABEL = 'Dust & Magnet';

let tutorialScatterDataPromise = null;

const TARGET_LAYER_OPTIONS = ['axisLayer', 'circleLayer', 'squareLayer'];

const TARGET_VIS_LINES = [
  'const axisLayer = Libra.Layer.initialize("D3Layer", {',
  '  name: "tutorialAxisLayer",',
  '  width: 560,',
  '  height: 220,',
  '  container: svg.node(),',
  '});',
  '',
  'const circleLayer = Libra.Layer.initialize("D3Layer", {',
  '  name: "tutorialCircleLayer",',
  '  width: 560,',
  '  height: 220,',
  '  container: svg.node(),',
  '});',
  '',
  'const squareLayer = Libra.Layer.initialize("D3Layer", {',
  '  name: "tutorialSquareLayer",',
  '  width: 560,',
  '  height: 220,',
  '  container: svg.node(),',
  '});',
  '',
  'd3.select(axisLayer.getGraphic())',
  '  .append("line")',
  '  .attr("class", "mark")',
  '  .attr("x1", 44)',
  '  .attr("y1", 170)',
  '  .attr("x2", 304)',
  '  .attr("y2", 170);',
  '',
  'd3.select(circleLayer.getGraphic())',
  '  .append("circle")',
  '  .attr("class", "mark")',
  '  .attr("cx", 108)',
  '  .attr("cy", 102)',
  '  .attr("r", 20);',
  '',
  'd3.select(squareLayer.getGraphic())',
  '  .append("rect")',
  '  .attr("class", "mark")',
  '  .attr("x", 220)',
  '  .attr("y", 82)',
  '  .attr("width", 40)',
  '  .attr("height", 40);',
  '',
  'const layersByName = { axisLayer, circleLayer, squareLayer };',
];

function getTargetInteractionLines(targetLayer) {
  return [
    'const interactions = [',
    '  {',
    '    instrument: "point-selection",',
    '    trigger: { type: "hover" },',
    `    target: { layer: "${targetLayer}" },`,
    '    feedback: {',
    '      redrawFunc: {',
    '        highlight: {',
    '          stroke: "#fcc602",',
    '          strokeWidth: 3',
    '        }',
    '      }',
    '    }',
    '  }',
    '];',
  ];
}

function renderFieldCard(field) {
  return `
    <article class="tutorial-card">
      <div class="tutorial-card-head">
        <span class="tutorial-pill">${escapeHtml(field.name)}</span>
        <strong>${escapeHtml(field.title)}</strong>
      </div>
      <p>${escapeHtml(field.description)}</p>
    </article>
  `;
}

function renderSimpleList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderAdvancedList(items) {
  return items
    .map(
      (item) => `
        <li>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.description)}</span>
        </li>
      `
    )
    .join('');
}

function renderInstrumentRows(items) {
  return items
    .map(
      (item) => `
        <tr>
          <td><code>${escapeHtml(item.id)}</code></td>
          <td>${escapeHtml(item.family)}</td>
          <td>${escapeHtml(item.triggers)}</td>
          <td>${escapeHtml(item.aliases)}</td>
        </tr>
      `
    )
    .join('');
}

function renderFeedbackGuideRows(items) {
  return items
    .map(
      (item) => `
        <tr>
          <td><code>${escapeHtml(item.instrument)}</code></td>
          <td>${escapeHtml(item.branches)}</td>
          <td>${escapeHtml(item.fields)}</td>
          <td>${escapeHtml(item.note)}</td>
        </tr>
      `
    )
    .join('');
}

function renderFeedbackExamples(items) {
  return items
    .map(
      (item) => `
        <article class="tutorial-example-card">
          <div class="tutorial-example-head">
            <strong><code>${escapeHtml(item.instrument)}</code></strong>
            <span class="tutorial-target-badge">${escapeHtml(item.trigger)}</span>
          </div>
          <pre class="tutorial-code tutorial-code-compact">${escapeHtml(item.lines.join('\n'))}</pre>
        </article>
      `
    )
    .join('');
}

function renderPlaygroundEditorCards(items) {
  return items
    .map((item) => {
      const meta = PLAYGROUND_CARD_META[item.instrument] || {};
      return `
        <article class="tutorial-editor-card" data-playground-card="${escapeHtml(item.instrument)}">
          <div class="tutorial-editor-head">
            <strong><code>${escapeHtml(item.instrument)}</code></strong>
            <span class="tutorial-target-badge">${escapeHtml(item.trigger)}</span>
          </div>
          <p class="tutorial-editor-hint">${escapeHtml(meta.hint || '')}</p>
          <textarea
            class="tutorial-editor-textarea"
            data-playground-editor="${escapeHtml(item.instrument)}"
            spellcheck="false"
          >${escapeHtml(item.lines.join('\n'))}</textarea>
        </article>
      `;
    })
    .join('');
}

function renderPlaygroundToggleStrip(items) {
  return items
    .map((item) => {
      const checked = PLAYGROUND_DEFAULT_ENABLED.has(item.instrument) ? 'checked' : '';
      return `
        <label class="tutorial-toggle-chip">
          <input
            type="checkbox"
            data-playground-toggle="${escapeHtml(item.instrument)}"
            ${checked}
          >
          <span>${escapeHtml(item.instrument)}</span>
        </label>
      `;
    })
    .join('');
}

function renderTargetButtons(items) {
  return items
    .map(
      (item) => `
        <button class="tutorial-target-button" type="button" data-target-value="${escapeHtml(item)}">
          ${escapeHtml(item)}
        </button>
      `
    )
    .join('');
}

async function loadTutorialScatterData() {
  if (!tutorialScatterDataPromise) {
    tutorialScatterDataPromise = d3
      .json('https://raw.githubusercontent.com/vega/vega/main/docs/data/cars.json')
      .then((rawData = []) =>
        rawData.filter((d) => Number.isFinite(d?.Horsepower) && Number.isFinite(d?.Miles_per_Gallon))
      );
  }
  return tutorialScatterDataPromise;
}

function getPlaygroundExamples() {
  return PLAYGROUND_EDITOR_ORDER.map((instrument) =>
    FEEDBACK_EXAMPLES.find((item) => item.instrument === instrument)
  ).filter(Boolean);
}

function createPlaygroundExampleMap() {
  return getPlaygroundExamples().reduce((acc, item) => {
    acc[item.instrument] = {
      enabled: PLAYGROUND_DEFAULT_ENABLED.has(item.instrument),
      source: item.lines.join('\n'),
    };
    return acc;
  }, {});
}

function parsePlaygroundSpec(source, scope = {}) {
  const argNames = Object.keys(scope);
  const argValues = Object.values(scope);
  const evaluator = new Function(
    ...argNames,
    `"use strict"; return (${source});`
  );
  return evaluator(...argValues);
}

function formatPlaygroundDiagnostics(diagnostics = []) {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
    return '当前未产生编译期或运行期诊断信息。';
  }

  return diagnostics
    .map((item) => {
      const level = String(item.level || 'info').toUpperCase();
      const instrument = item.instrument ? ` ${item.instrument}` : '';
      const code = item.code ? ` (${item.code})` : '';
      return `[${level}]${instrument}${code} ${item.message}`;
    })
    .join('\n');
}

function renderTutorialScatterGraphics(scene, currentXScale = scene.scaleX, currentYScale = scene.scaleY) {
  const { width, height, margin, data, colorScale, layersByName } = scene;
  const { mainLayer, xAxisLayer, yAxisLayer } = layersByName;

  const xGraphic = d3.select(xAxisLayer.getGraphic());
  const yGraphic = d3.select(yAxisLayer.getGraphic());
  const mainGraphic = d3.select(mainLayer.getGraphic());

  xGraphic.selectAll('*').remove();
  yGraphic.selectAll('*').remove();
  mainGraphic.selectAll('*').remove();

  xGraphic.call(d3.axisBottom(currentXScale));
  xGraphic
    .append('text')
    .attr('x', width / 2)
    .attr('y', margin.bottom - 8)
    .attr('fill', '#10233f')
    .attr('text-anchor', 'middle')
    .attr('font-size', 11)
    .attr('font-weight', 700)
    .text('Horsepower');

  yGraphic
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(currentYScale));
  yGraphic
    .append('text')
    .attr('x', -height / 2)
    .attr('y', -36)
    .attr('fill', '#10233f')
    .attr('text-anchor', 'middle')
    .attr('font-size', 11)
    .attr('font-weight', 700)
    .attr('transform', 'rotate(-90)')
    .text('Miles_per_Gallon');

  mainGraphic
    .selectAll('circle.mark')
    .data(data)
    .join('circle')
    .attr('class', 'mark')
    .attr('cx', (d) => currentXScale(d.Horsepower))
    .attr('cy', (d) => currentYScale(d.Miles_per_Gallon))
    .attr('r', 4)
    .attr('fill', 'white')
    .attr('stroke-width', 1.5)
    .attr('stroke', (d) => colorScale(d.Origin));

  if (typeof mainLayer.postUpdate === 'function') {
    mainLayer.postUpdate();
  }
}

function createTutorialScatterScene(container, data = []) {
  const mountNode = container.querySelector('#TutorialInstrumentMount');
  if (!mountNode) return null;

  mountNode.innerHTML = '';

  const fullWidth = 560;
  const fullHeight = 220;
  const margin = { top: 18, right: 168, bottom: 42, left: 48 };
  const width = fullWidth - margin.left - margin.right;
  const height = fullHeight - margin.top - margin.bottom;
  const unique = `tutorial-scatter-${Date.now()}-${Math.round(Math.random() * 100000)}`;

  const svg = d3
    .select(mountNode)
    .append('svg')
    .attr('class', 'tutorial-target-svg')
    .attr('width', fullWidth)
    .attr('height', fullHeight)
    .attr('viewBox', `0 0 ${fullWidth} ${fullHeight}`)
    .style('width', `${fullWidth}px`)
    .style('height', `${fullHeight}px`);

  svg
    .append('rect')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', width)
    .attr('height', height)
    .attr('rx', 18)
    .attr('fill', 'rgb(16 35 63 / 2%)')
    .attr('stroke', 'rgb(16 35 63 / 7%)');

  const extentX = [0, d3.max(data, (d) => d.Horsepower)];
  const extentY = [0, d3.max(data, (d) => d.Miles_per_Gallon)];

  const scaleX = d3
    .scaleLinear()
    .domain(extentX)
    .range([0, width])
    .nice();

  const scaleY = d3
    .scaleLinear()
    .domain(extentY)
    .range([height, 0])
    .nice();

  const colorScale = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(data.map((d) => d.Origin))))
    .range(d3.schemeTableau10);

  const xAxisLayer = Libra.Layer.initialize('D3Layer', {
    name: `${unique}-x-axis`,
    width,
    height: margin.bottom,
    offset: { x: margin.left, y: margin.top + height },
    container: svg.node(),
  });

  const yAxisLayer = Libra.Layer.initialize('D3Layer', {
    name: `${unique}-y-axis`,
    width: margin.left,
    height,
    offset: { x: 0, y: margin.top },
    container: svg.node(),
  });

  const mainLayer = Libra.Layer.initialize('D3Layer', {
    name: `${unique}-main`,
    width,
    height,
    offset: { x: margin.left, y: margin.top },
    container: svg.node(),
  });

  const legend = svg
    .append('g')
    .attr('transform', `translate(${margin.left + width + 28}, ${margin.top + 16})`);

  legend
    .append('text')
    .attr('fill', '#10233f')
    .attr('font-size', 11)
    .attr('font-weight', 700)
    .text('Origin');

  const legendItem = legend
    .selectAll('g')
    .data(colorScale.domain())
    .join('g')
    .attr('transform', (_, index) => `translate(0, ${22 + index * 22})`);

  legendItem
    .append('circle')
    .attr('r', 5)
    .attr('fill', 'white')
    .attr('stroke-width', 2)
    .attr('stroke', (d) => colorScale(d));

  legendItem
    .append('text')
    .attr('x', 12)
    .attr('y', 4)
    .attr('fill', '#516074')
    .attr('font-size', 11)
    .text((d) => d);

  const scene = {
    data,
    svg,
    width,
    height,
    margin,
    scaleX,
    scaleY,
    xScale: scaleX,
    yScale: scaleY,
    colorScale,
    fieldColor: 'Origin',
    layersByName: {
      mainLayer,
      xAxisLayer,
      yAxisLayer,
    },
  };

  renderTutorialScatterGraphics(scene, scaleX, scaleY);
  scene.transformer = LibraManager.buildGeometricTransformer(mainLayer, {
    scaleX,
    scaleY,
    redraw: (nextScaleX, nextScaleY) => {
      renderTutorialScatterGraphics(scene, nextScaleX, nextScaleY);
    },
  });

  return scene;
}

function bindInstrumentPlayground(container) {
  const mountNode = container.querySelector('#TutorialInstrumentMount');
  const applyButton = container.querySelector('#TutorialPlaygroundApply');
  const resetButton = container.querySelector('#TutorialPlaygroundReset');
  const summaryNode = container.querySelector('#TutorialPlaygroundSummary');
  const diagnosticsNode = container.querySelector('#TutorialPlaygroundDiagnostics');
  const editors = Array.from(container.querySelectorAll('[data-playground-editor]'));
  const toggles = Array.from(container.querySelectorAll('[data-playground-toggle]'));

  if (!mountNode || !applyButton || !resetButton || editors.length === 0) return;

  const state = {
    examples: createPlaygroundExampleMap(),
  };

  function syncEditorsFromState() {
    editors.forEach((node) => {
      const id = node.dataset.playgroundEditor;
      if (!id || !state.examples[id]) return;
      if (node.value !== state.examples[id].source) {
        node.value = state.examples[id].source;
      }
    });

    toggles.forEach((node) => {
      const id = node.dataset.playgroundToggle;
      if (!id || !state.examples[id]) return;
      node.checked = !!state.examples[id].enabled;
    });
  }

  function collectStateFromEditors() {
    editors.forEach((node) => {
      const id = node.dataset.playgroundEditor;
      if (!id || !state.examples[id]) return;
      state.examples[id].source = node.value;
    });

    toggles.forEach((node) => {
      const id = node.dataset.playgroundToggle;
      if (!id || !state.examples[id]) return;
      state.examples[id].enabled = !!node.checked;
    });
  }

  async function render() {
    collectStateFromEditors();

    const data = await loadTutorialScatterData();
    const scene = createTutorialScatterScene(container, data);
    if (!scene) return;

    const scope = {
      d3,
      data: scene.data,
      scaleX: scene.scaleX,
      scaleY: scene.scaleY,
      xScale: scene.xScale,
      yScale: scene.yScale,
      colorScale: scene.colorScale,
      mainLayer: scene.layersByName.mainLayer,
      xAxisLayer: scene.layersByName.xAxisLayer,
      yAxisLayer: scene.layersByName.yAxisLayer,
    };

    const enabledIds = PLAYGROUND_EDITOR_ORDER.filter((id) => state.examples[id]?.enabled);
    const parseErrors = [];
    const interactions = [];

    enabledIds.forEach((id) => {
      try {
        const parsed = parsePlaygroundSpec(state.examples[id].source, scope);
        interactions.push(parsed);
      } catch (error) {
        parseErrors.push(`[ERROR] ${id} 解析失败: ${error.message}`);
      }
    });

    if (parseErrors.length > 0) {
      if (summaryNode) {
        summaryNode.textContent = '代码解析未通过，散点图已重置，本次未执行 compileDSL。';
      }
      if (diagnosticsNode) {
        diagnosticsNode.textContent = parseErrors.join('\n');
      }
      return;
    }

    if (interactions.length === 0) {
      if (summaryNode) {
        summaryNode.textContent = '当前未启用任何 instrument，因此仅保留基础散点图。';
      }
      if (diagnosticsNode) {
        diagnosticsNode.textContent = '当前未产生编译期或运行期诊断信息。';
      }
      return;
    }

    const result = compileDSL(
      interactions,
      { layersByName: scene.layersByName },
      { execute: true }
    );

    if (summaryNode) {
      summaryNode.textContent = `已重新编译 ${interactions.length} 个 instrument：${enabledIds.join(', ')}。`;
    }
    if (diagnosticsNode) {
      diagnosticsNode.textContent = formatPlaygroundDiagnostics(result?.diagnostics || []);
    }
  }

  applyButton.addEventListener('click', () => {
    render();
  });

  resetButton.addEventListener('click', () => {
    state.examples = createPlaygroundExampleMap();
    syncEditorsFromState();
    render();
  });

  toggles.forEach((node) => {
    node.addEventListener('change', () => {
      collectStateFromEditors();
    });
  });

  editors.forEach((node) => {
    node.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        render();
      }
    });
  });

  syncEditorsFromState();
  render();
}

function createTargetTutorialScene(container, targetLayer) {
  const mountNode = container.querySelector('#TutorialTargetMount');
  if (!mountNode) {
    return { diagnostics: [] };
  }

  mountNode.innerHTML = '';

  const width = 560;
  const height = 220;
  const unique = `tutorial-${Date.now()}-${Math.round(Math.random() * 100000)}`;

  const svg = d3
    .select(mountNode)
    .append('svg')
    .attr('class', 'tutorial-target-svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  const axisLayer = Libra.Layer.initialize('D3Layer', {
    name: `${unique}-axis`,
    width,
    height,
    container: svg.node(),
  });

  const circleLayer = Libra.Layer.initialize('D3Layer', {
    name: `${unique}-circle`,
    width,
    height,
    container: svg.node(),
  });

  const squareLayer = Libra.Layer.initialize('D3Layer', {
    name: `${unique}-square`,
    width,
    height,
    container: svg.node(),
  });

  const axisGraphic = d3.select(axisLayer.getGraphic());
  const circleGraphic = d3.select(circleLayer.getGraphic());
  const squareGraphic = d3.select(squareLayer.getGraphic());

  axisGraphic
    .append('line')
    .attr('class', 'mark')
    .attr('x1', 44)
    .attr('y1', 170)
    .attr('x2', 304)
    .attr('y2', 170)
    .attr('stroke', '#66758a')
    .attr('stroke-width', 2.5);

  axisGraphic
    .append('line')
    .attr('class', 'mark')
    .attr('x1', 44)
    .attr('y1', 170)
    .attr('x2', 44)
    .attr('y2', 38)
    .attr('stroke', '#66758a')
    .attr('stroke-width', 2.5);

  [96, 148, 200, 252].forEach((x) => {
    axisGraphic
      .append('line')
      .attr('class', 'mark')
      .attr('x1', x)
      .attr('y1', 170)
      .attr('x2', x)
      .attr('y2', 178)
      .attr('stroke', '#8b98aa')
      .attr('stroke-width', 2);
  });

  [126, 82, 38].forEach((y) => {
    axisGraphic
      .append('line')
      .attr('class', 'mark')
      .attr('x1', 36)
      .attr('y1', y)
      .attr('x2', 44)
      .attr('y2', y)
      .attr('stroke', '#8b98aa')
      .attr('stroke-width', 2);
  });

  axisGraphic
    .append('text')
    .attr('x', 302)
    .attr('y', 192)
    .attr('fill', '#516074')
    .attr('font-size', 12)
    .attr('font-weight', 600)
    .text('x');

  axisGraphic
    .append('text')
    .attr('x', 28)
    .attr('y', 48)
    .attr('fill', '#516074')
    .attr('font-size', 12)
    .attr('font-weight', 600)
    .text('y');

  circleGraphic
    .append('circle')
    .attr('class', 'mark')
    .datum({ layer: 'circleLayer', shape: 'circle' })
    .attr('cx', 108)
    .attr('cy', 102)
    .attr('r', 20)
    .attr('fill', '#315d8d')
    .attr('stroke', '#1d3557')
    .attr('stroke-width', 2);

  squareGraphic
    .append('rect')
    .attr('class', 'mark')
    .datum({ layer: 'squareLayer', shape: 'square' })
    .attr('x', 220)
    .attr('y', 82)
    .attr('width', 40)
    .attr('height', 40)
    .attr('rx', 6)
    .attr('fill', '#d9881f')
    .attr('stroke', '#8f5404')
    .attr('stroke-width', 2);

  const layersByName = { axisLayer, circleLayer, squareLayer };

  Object.entries(layersByName).forEach(([layerName, layer]) => {
    d3.select(layer.getGraphic())
      .attr('data-tutorial-layer', layerName)
      .style('opacity', layerName === targetLayer ? 1 : 0.46);
  });

  return compileDSL(
    [
      {
        instrument: 'point-selection',
        trigger: {
          type: 'hover',
          priority: 1,
          stopPropagation: true,
        },
        target: { layer: targetLayer },
        feedback: {
          redrawFunc: {
            highlight: {
              color: '#fcc602',
              stroke: '#fcc602',
              strokeWidth: 3,
            },
          },
        },
      },
    ],
    { layersByName },
    { execute: true }
  );
}

function bindTargetPlayground(container) {
  const input = container.querySelector('#TutorialTargetInput');
  const codeNode = container.querySelector('#TutorialTargetDsl');
  const activeNode = container.querySelector('#TutorialTargetActive');
  const statusNode = container.querySelector('#TutorialTargetStatus');
  const layerButtons = Array.from(container.querySelectorAll('.tutorial-target-button'));
  const layerNotes = Array.from(container.querySelectorAll('.tutorial-layer-item'));

  const state = {
    targetLayer: 'circleLayer',
  };

  function syncButtons() {
    layerButtons.forEach((button) => {
      const isActive = button.dataset.targetValue === state.targetLayer;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function syncCode() {
    if (codeNode) {
      codeNode.textContent = getTargetInteractionLines(state.targetLayer).join('\n');
    }
    if (activeNode) {
      activeNode.textContent = state.targetLayer;
    }
  }

  function syncNotes() {
    layerNotes.forEach((node) => {
      const layerName = node.dataset.layerItem;
      node.classList.toggle('is-target', layerName === state.targetLayer);
    });
  }

  function renderScene() {
    const result = createTargetTutorialScene(container, state.targetLayer);
    if (!statusNode) return;

    const unresolved = (result?.diagnostics || []).find(
      (item) => item.code === 'compiler/unresolved-layer'
    );

    if (unresolved) {
      statusNode.textContent = '当前 target.layer 未解析到任何 Libra 图层，因此 hover 交互不会命中目标对象。';
      return;
    }

    statusNode.textContent = `已基于真实 Libra 图层重新编译 point-selection；当前目标图层为 ${state.targetLayer}。可将指针移入图中以验证命中结果。`;
  }

  function updateTargetLayer(nextLayer) {
    state.targetLayer = String(nextLayer || '').trim();
    if (input && input.value !== state.targetLayer) input.value = state.targetLayer;
    syncButtons();
    syncCode();
    syncNotes();
    renderScene();
  }

  layerButtons.forEach((button) => {
    button.addEventListener('click', () => {
      updateTargetLayer(button.dataset.targetValue || '');
    });
  });

  if (input) {
    input.addEventListener('input', (event) => {
      updateTargetLayer(event.target.value);
    });
  }

  updateTargetLayer(state.targetLayer);
}

export default function initTutorialPage() {
  const container = document.getElementById('LibraPlayground');
  if (!container) return;

  container.innerHTML = `
    <div class="showcase-page showcase-page--tutorial">
      <header class="showcase-topbar">
        <a class="showcase-brand" href="?page=home">
          <strong>Libra+</strong>
          <span>DSL Tutorial</span>
        </a>
        <nav class="showcase-nav" aria-label="Primary">
          <a href="?page=home">Home</a>
          <a href="?page=gallery">Gallery</a>
          <a href="?page=tutorial" aria-current="page">DSL Tutorial</a>
        </nav>
      </header>

      <section class="tutorial-hero">
        <div class="tutorial-hero-copy">
          <span class="eyebrow">Field-Oriented View</span>
          <h1 class="hero-title">围绕 instrument、trigger、target、feedback、context 理解新版 DSL</h1>
          <p>
            本教程依据当前编译器与校验器的实际约束进行整理，旨在为新版 DSL 的书写提供一份
            简明而一致的参考框架。理解时可优先关注四个顶层字段：<code>instrument</code>、
            <code>trigger</code>、<code>target</code>、<code>feedback</code>。
          </p>
          <div class="hero-actions">
            <a class="showcase-button" href="?page=gallery">查看示例页面</a>
            <a class="showcase-button showcase-button-ghost" href="?page=home">返回首页</a>
          </div>
        </div>

        <aside class="tutorial-code-shell">
          <div class="spec-card-header">
            <strong>最小结构示例</strong>
            <span class="spec-chip">Recommended</span>
          </div>
          <pre class="tutorial-code">${escapeHtml(EXAMPLE_LINES.join('\n'))}</pre>
        </aside>
      </section>

      <section class="tutorial-step-grid" aria-label="DSL writing steps">
        ${WRITING_STEPS.map(
          (step, index) => `
            <article class="tutorial-step">
              <span class="tutorial-step-index">0${index + 1}</span>
              <p>${escapeHtml(step)}</p>
            </article>
          `
        ).join('')}
      </section>

      <section class="featured-panel">
        <span class="eyebrow">Core Fields</span>
        <h2 class="section-title">instrument、trigger、target、feedback：四个顶层字段的职责划分</h2>
        <div class="tutorial-grid">
          ${CORE_FIELDS.map((field) => renderFieldCard(field)).join('')}
        </div>
      </section>

      <section class="featured-panel">
        <span class="eyebrow">Target Field</span>
        <h2 class="section-title">target：通过修改 target.layer 观察目标图层的解析结果</h2>
        <p class="gallery-subtitle">
          下方示意图被刻意拆分为三个独立 layer：坐标轴对应 <code>axisLayer</code>，圆形对应
          <code>circleLayer</code>，方形对应 <code>squareLayer</code>。修改右下方的
          <code>target.layer</code> 后，可通过指针移动观察 hover 交互仅命中被指定的目标 layer。
        </p>

        <div class="tutorial-target-layout">
          <div class="tutorial-target-visual">
            <div id="TutorialTargetMount" class="tutorial-target-stage" aria-label="Target layer tutorial visualization"></div>

            <div class="tutorial-layer-list">
              <div class="tutorial-layer-item" data-layer-item="axisLayer">
                <strong>axisLayer</strong>
                <span>轴线与刻度</span>
              </div>
              <div class="tutorial-layer-item" data-layer-item="circleLayer">
                <strong>circleLayer</strong>
                <span>圆形标记</span>
              </div>
              <div class="tutorial-layer-item" data-layer-item="squareLayer">
                <strong>squareLayer</strong>
                <span>方形标记</span>
              </div>
            </div>
          </div>
        </div>

        <div class="tutorial-target-config">
          <div class="tutorial-target-editor">
            <div class="tutorial-target-head">
              <strong>交互配置区</strong>
              <span class="tutorial-target-badge">point-selection · hover</span>
            </div>

            <label class="tutorial-target-label" for="TutorialTargetInput">修改 target.layer</label>
            <input
              id="TutorialTargetInput"
              class="tutorial-target-input"
              type="text"
              value="circleLayer"
              spellcheck="false"
            >

            <div class="tutorial-target-buttons">
              ${renderTargetButtons(TARGET_LAYER_OPTIONS)}
            </div>

            <p class="tutorial-target-help">
              当前目标图层：
              <code id="TutorialTargetActive">circleLayer</code>
            </p>
            <p id="TutorialTargetStatus" class="tutorial-target-status"></p>
          </div>

          <div class="tutorial-code-panel">
            <pre id="TutorialTargetDsl" class="tutorial-code tutorial-code-compact"></pre>
          </div>
        </div>

        <div class="tutorial-target-code">
          <div class="spec-card-header">
            <strong>Libra 建层代码</strong>
            <span class="spec-chip">Libra</span>
          </div>
          <pre class="tutorial-code tutorial-code-compact">${escapeHtml(TARGET_VIS_LINES.join('\n'))}</pre>
        </div>
      </section>

      <section class="featured-panel">
        <span class="eyebrow">Instrument Field</span>
        <h2 class="section-title">instrument：当前教程所覆盖的 9 类推荐写法</h2>
        <p class="gallery-subtitle">
          下表仅保留当前教程中已有新版 DSL 示例支撑的写法。建议优先采用第一列中的规范名称；
          后续 alias 主要用于兼容既有示例或历史拼写。
        </p>
        <div class="tutorial-table-shell">
          <table class="tutorial-table">
            <thead>
              <tr>
                <th>规范写法</th>
                <th>分类</th>
                <th>可用 trigger</th>
                <th>兼容 alias</th>
              </tr>
            </thead>
            <tbody>
              ${renderInstrumentRows(INSTRUMENT_ROWS)}
            </tbody>
          </table>
        </div>
      </section>

      <section class="story-section tutorial-story">
        <div class="story-copy tutorial-copy">
          <span class="eyebrow">Feedback Field</span>
          <h2 class="section-title">feedback：反馈结构与 context 上下文的组织方式</h2>
          <p class="section-text">
            当前校验器会显式检查 <code>feedback</code> 的第一层子字段，因此建议严格按照下述结构组织。
            本节先给出四个顶层分支，再概述各类 instrument 在当前编译器与运行时中常见的下属字段。
            表中所列为高频且被实际读取的写法，并不意味着每次配置都需要全部给出。
          </p>
          <ul class="tutorial-list">
            ${renderSimpleList(TIPS)}
          </ul>
        </div>
        <div class="tutorial-code-panel">
          <pre class="tutorial-code tutorial-code-compact">${escapeHtml(FEEDBACK_LINES.join('\n'))}</pre>
        </div>
      </section>

      <section class="featured-panel">
        <span class="eyebrow">Feedback Branches</span>
        <h2 class="section-title">feedback：四个第一层分支字段</h2>
        <div class="tutorial-grid">
          ${FEEDBACK_TOP_LEVEL_FIELDS.map((field) => renderFieldCard(field)).join('')}
        </div>
      </section>

      <section class="featured-panel">
        <span class="eyebrow">Context Field</span>
        <h2 class="section-title">context：不同 instrument 常见的上下文字段与配置位置</h2>
        <p class="gallery-subtitle">
          表中的字段路径均按推荐写法描述。需特别注意：
          <code>highlight</code>、<code>dim</code> 一类视觉字段通常放在 <code>redrawFunc</code>，
          比例尺、联动与维度信息通常放在 <code>context</code>，而 lens / reorder / helper-line
          一类 instrument 的专属参数则多置于 <code>service</code> 或 <code>feedforward</code>。
        </p>
        <div class="tutorial-table-shell">
          <table class="tutorial-table">
            <thead>
              <tr>
                <th>instrument</th>
                <th>常用顶层分支</th>
                <th>常见下属字段</th>
                <th>什么时候会写</th>
              </tr>
            </thead>
            <tbody>
              ${renderFeedbackGuideRows(FEEDBACK_INSTRUMENT_ROWS)}
            </tbody>
          </table>
        </div>
      </section>

      <section class="featured-panel">
        <span class="eyebrow">Trigger And Context</span>
        <h2 class="section-title">trigger / context：在真实散点图中验证交互触发与上下文配置</h2>
        <p class="gallery-subtitle">
          下方 playground 会将 7 类适用于散点图的 instrument 直接编译到同一张真实 Libra 散点图上。
          使用者可选择是否启用某一示例，并直接修改相应 DSL 对象代码，随后执行“重新编译配置”。
          由于 <code>reorder</code> 与 <code>move</code> 并不适合通过该非数据驱动散点图进行说明，因此另附更契合的 gallery 示例链接。
        </p>

        <div class="tutorial-playground-shell">
          <div class="tutorial-playground-stage">
            <div class="tutorial-playground-toolbar">
              <div class="tutorial-target-head">
                <strong>Scatter Plot Playground</strong>
                <span class="tutorial-target-badge">Libra + compileDSL</span>
              </div>
              <div class="tutorial-playground-actions">
                <button id="TutorialPlaygroundApply" class="tutorial-action-button" type="button">重新编译配置</button>
                <button id="TutorialPlaygroundReset" class="tutorial-action-button tutorial-action-button-ghost" type="button">恢复初始配置</button>
              </div>
            </div>

            <div id="TutorialInstrumentMount" class="tutorial-target-stage" aria-label="Instrument playground scatter plot"></div>

            <div class="tutorial-playground-toggles">
              ${renderPlaygroundToggleStrip(getPlaygroundExamples())}
            </div>

            <div class="tutorial-playground-status">
              <p id="TutorialPlaygroundSummary" class="tutorial-target-status"></p>
              <pre id="TutorialPlaygroundDiagnostics" class="tutorial-code tutorial-code-compact"></pre>
            </div>
          </div>

          <div class="tutorial-playground-editors">
            <div class="tutorial-editor-grid">
              ${renderPlaygroundEditorCards(getPlaygroundExamples())}
            </div>

            <div class="tutorial-playground-links">
              <article class="tutorial-editor-card tutorial-editor-card--link">
                <div class="tutorial-editor-head">
                  <strong><code>reorder</code></strong>
                  <span class="tutorial-target-badge">gallery</span>
                </div>
                <p class="tutorial-editor-hint">
                  <code>reorder</code> 更适用于类别轴或矩阵情形，不宜通过当前散点图示例展开说明。可前往 gallery 中的
                  <strong>${REORDER_GALLERY_LABEL}</strong> 参照相应实例。
                </p>
                <a class="showcase-button showcase-button-ghost" href="?page=${REORDER_GALLERY_PAGE}">
                  查看 ${REORDER_GALLERY_LABEL}
                </a>
              </article>

              <article class="tutorial-editor-card tutorial-editor-card--link">
                <div class="tutorial-editor-head">
                  <strong><code>move</code></strong>
                  <span class="tutorial-target-badge">gallery</span>
                </div>
                <p class="tutorial-editor-hint">
                  在当前非数据驱动散点图中，<code>move</code> 的说明价值有限。可前往 gallery 中的
                  <strong>${MOVE_GALLERY_LABEL}</strong> 参照更契合的真实示例。
                </p>
                <a class="showcase-button showcase-button-ghost" href="?page=${encodeURIComponent(MOVE_GALLERY_PAGE)}">
                  查看 ${MOVE_GALLERY_LABEL}
                </a>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section class="featured-panel">
        <span class="eyebrow">Trigger Extensions</span>
        <h2 class="section-title">trigger 与顶层扩展字段：更细粒度的控制参数</h2>
        <ul class="tutorial-detail-list">
          ${renderAdvancedList(ADVANCED_FIELDS)}
        </ul>
      </section>

      <section class="tutorial-callout">
        <span class="eyebrow">Field-Level Notes</span>
        <h2 class="section-title">从字段约束角度理解 DSL 书写中的常见问题</h2>
        <div class="tutorial-note-grid">
          <article class="tutorial-note">
            <strong>1. 顶层字段应保持克制</strong>
            <p>新版 DSL 对顶层字段约束较强，额外字段通常会被校验器直接判定为错误。</p>
          </article>
          <article class="tutorial-note">
            <strong>2. priority 应写入 trigger</strong>
            <p>若需控制交互竞争顺序，应将 <code>priority</code>、<code>modifierKey</code>、<code>stopPropagation</code> 统一写入 <code>trigger</code>。</p>
          </article>
          <article class="tutorial-note">
            <strong>3. target 优先采用 layer 写法</strong>
            <p>多数交互依赖图层解析，因此建议统一采用 <code>target: { layer: "..." }</code> 的形式。</p>
          </article>
        </div>
      </section>
    </div>
  `;

  bindTargetPlayground(container);
  bindInstrumentPlayground(container);
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}
