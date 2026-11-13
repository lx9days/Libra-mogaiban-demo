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
    title: 'Interaction Type',
    description: 'Declares which interaction type should be instantiated, such as point-selection, group-selection, pan, zoom, reorder, or lens.',
  },
  {
    name: 'trigger',
    title: 'Trigger Specification',
    description: 'The recommended form is an object with at least a type field, such as { type: "hover" } or { type: "brush" }.',
  },
  {
    name: 'target',
    title: 'Target Layer',
    description: 'The recommended form is { layer: "mainLayer" }. In the current validator and compiler flow, target.layer is the primary mechanism for resolving the target layer.',
  },
  {
    name: 'feedback',
    title: 'Feedback Structure',
    description: 'Must be an object. Its first-level fields should be limited to redrawFunc, service, feedforward, and context.',
  },
];

const WRITING_STEPS = [
  'Begin with an interaction array, where each item corresponds to an independent interaction rule.',
  'It is recommended to declare instrument, trigger, target, and feedback explicitly in every rule.',
  'If you need priority, modifier keys, or propagation control, place priority, modifierKey, and stopPropagation inside trigger.',
  'If runtime context is required, place it under feedback.context; instrument-specific service parameters should be placed under feedback.service.',
];

const TIPS = [
  'In the new DSL, the top level should contain only instrument, trigger, target, feedback, and the optional fields name and customFeedbackFlow.',
  'feedback should not be empty; at least one of redrawFunc, service, feedforward, or context should be provided.',
  'To remain consistent with the current normalize/validate process, lower-case kebab-case names such as point-selection and group-selection are recommended.',
  'When an interaction depends on layer resolution, prefer target: { layer: "..." } over plain string shorthand.',
];

const ADVANCED_FIELDS = [
  {
    label: 'name',
    description: 'Provides a readable identifier for debugging, logging, and distinguishing multiple interaction instances.',
  },
  {
    label: 'trigger.priority',
    description: 'When multiple interactions compete for the same event, larger values receive higher priority.',
  },
  {
    label: 'trigger.modifierKey',
    description: 'Adds a modifier-key constraint such as ctrl, shift, or alt.',
  },
  {
    label: 'trigger.stopPropagation',
    description: 'Stops the event from propagating to lower-priority interactions after a match.',
  },
  {
    label: 'customFeedbackFlow',
    description: 'Inserts, removes, or overrides the system default feedback flow.',
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

const TTF_VIDEO_SRC = encodeURI('./public/showcase/video/无配音.mp4');

const TTF_MODEL_POINTS = [
  'Trigger defines when the interaction starts, such as hover, brush, drag, or zoom.',
  'Target narrows the interaction to the intended Libra layer so the system knows which marks can be hit.',
  'Feedback describes what changes after the trigger fires, including highlight, linked updates, service parameters, and runtime context.',
];

const FEEDBACK_TOP_LEVEL_FIELDS = [
  {
    name: 'redrawFunc',
    title: 'Visual Redraw',
    description: 'Declares highlight, dimming, and redraw logic. For selection-oriented interactions, highlight and dim are the most common fields; reorder may also provide a redraw function directly.',
  },
  {
    name: 'service',
    title: 'Runtime Service Parameters',
    description: 'Configures instrument-specific runtime service parameters, such as lens radius and styling, reorder direction, or helper-line orientation and intersection strategy.',
  },
  {
    name: 'feedforward',
    title: 'Feedforward and Drag Copies',
    description: 'Commonly used by reorder to declare which layer should be copied during dragging and how the copied layer should be offset.',
  },
  {
    name: 'context',
    title: 'Scales and Linking Context',
    description: 'Provides runtime context such as scaleX, scaleY, fixRange, semantic, link, dimension, names, scales, and data.',
  },
];

const FEEDBACK_INSTRUMENT_ROWS = [
  {
    instrument: 'point-selection',
    branches: 'redrawFunc + context',
    fields: 'highlight, dim, link.layers, link.field/link.fields, scaleX, scaleY, Tooltip',
    note: 'The most common use is hover/click highlighting. For linked selection, place the linked layers and matching field configuration inside context.link.',
  },
  {
    instrument: 'group-selection',
    branches: 'redrawFunc + context',
    fields: 'highlight, dim, brushStyle, attrName, scaleX, scaleY, link.*, Tooltip',
    note: 'Commonly used for brush selection. brushStyle controls the selection rectangle style, and attrName can help the system interpret the selection by dimension.',
  },
  {
    instrument: 'axis-selection',
    branches: 'redrawFunc + context',
    fields: 'highlight, axisDirection, dimension/attrName, scale, linkLayers/linkTo, Tooltip',
    note: 'Axis-oriented brushing depends most strongly on dimension and scale. If the trigger is already explicit as brushx/brushy, axisDirection can usually be omitted.',
  },
  {
    instrument: 'pan',
    branches: 'context',
    fields: 'scaleX, scaleY, fixRange',
    note: 'In the new DSL, pan mainly consumes scales and range constraints. Without scaleX/scaleY, visible view translation usually will not occur.',
  },
  {
    instrument: 'zoom',
    branches: 'context',
    fields: 'scaleX, scaleY, fixRange, semantic, scaleLevels, updateLens, updateBrush, zoom.targetLensName, zoom.targetBrushName',
    note: 'Conventional zoom usually configures scaleX, scaleY, and fixRange. For semantic zoom, add semantic and scaleLevels.',
  },
  {
    instrument: 'move',
    branches: 'context or service',
    fields: 'updateBrush: "translate"',
    note: 'In the current implementation, the most common use of move is to translate an existing brush; the system enters brush-move mode according to updateBrush.',
  },
  {
    instrument: 'lens',
    branches: 'service.lens',
    fields: 'r, stroke, strokeWidth, renderSelection, fontSize, countLabelWidth, countLabelDistance, maxLabelsNum, labelAccessor, colorAccessor, count, countAccessor, countFormatter, filter',
    note: 'These fields are forwarded directly to the excentric-labeling runtime. To remain compatible with older naming, they may also be written under service.excentricLabeling.',
  },
  {
    instrument: 'reorder',
    branches: 'redrawFunc + service + feedforward + context',
    fields: 'redrawFunc, reorderDirection, sourceLayer, offset, names, scales.x, scales.y',
    note: 'reorder has the most comprehensive dependence on feedback. Direction, copy generation, and redraw functions usually need to be coordinated.',
  },
  {
    instrument: 'helper-line',
    branches: 'service + context',
    fields: 'orientation, showIntersection, scales.x, scales.y, data',
    note: 'Basic helper lines primarily rely on orientation. When showIntersection = true, data and the relevant scales are usually also required.',
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
      '      orientation: ["horizontal", "vertical"]',
      '    },',
      '    context: {',
      '      scales: { x: scaleX, y: scaleY }',
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
    hint: 'This example helps observe local highlight behavior triggered by hover / click and works well as an initial reference.',
  },
  'group-selection': {
    hint: 'This example is suitable for studying the scope and feedback behavior of brush selection in a scatter plot.',
  },
  'axis-selection': {
    hint: 'This example targets the x-axis by default, making it easier to observe how axis brushing affects point selection in the main view.',
  },
  pan: {
    hint: 'Hold Ctrl and drag on the canvas to verify whether pan works under the current scale configuration.',
  },
  lens: {
    hint: 'Move the pointer near points to observe the local focus effect of lens / excentric labeling.',
  },
  zoom: {
    hint: 'Hold Ctrl while zooming to verify the more stable zoom trigger configuration in the current runtime.',
  },
  'helper-line': {
    hint: 'This example is used to observe how helper lines and intersections are generated, while illustrating how service and context are configured together.',
  },
};

const REORDER_GALLERY_PAGE = 'categorical-beeswarm';
const REORDER_GALLERY_LABEL = 'Categorical Beeswarm';
const MOVE_GALLERY_PAGE = 'Dust&Magnet';
const MOVE_GALLERY_LABEL = 'Dust & Magnet';

let tutorialScatterDataPromise = null;

const TARGET_LAYER_OPTIONS = ['axisLayer', 'circleLayer', 'squareLayer'];
const TARGET_SCENE = {
  width: 560,
  height: 300,
  axis: {
    left: 52,
    baseline: 222,
    right: 316,
    top: 52,
    tickXs: [104, 156, 208, 260],
    tickYs: [170, 126, 82],
  },
  circle: {
    cx: 124,
    cy: 132,
    r: 20,
  },
  square: {
    x: 236,
    y: 112,
    size: 40,
    rx: 6,
  },
};

// #region debug-point A:scatter-brush-debug
const DEBUG_SCATTER_BRUSH_URL = 'http://127.0.0.1:7777/event';
const DEBUG_SCATTER_BRUSH_SESSION = 'scatter-brush-offset';

function reportScatterBrushDebug(hypothesisId, location, msg, data = {}) {
  fetch(DEBUG_SCATTER_BRUSH_URL, {
    method: 'POST',
    body: JSON.stringify({
      sessionId: DEBUG_SCATTER_BRUSH_SESSION,
      runId: 'pre-fix',
      hypothesisId,
      location,
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
}

function getLayerDebugSnapshot(layer) {
  if (!layer || typeof layer.getGraphic !== 'function') return null;
  const graphic = layer.getGraphic();
  if (!graphic || typeof graphic.getBoundingClientRect !== 'function') return null;
  const rect = graphic.getBoundingClientRect();
  return {
    name: layer._name || layer.name || null,
    transform: graphic.getAttribute?.('transform') || null,
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
  };
}

function getBrushDomSnapshot(layer) {
  if (!layer || typeof layer.getGraphic !== 'function') return null;
  const graphic = layer.getGraphic();
  if (!graphic || typeof graphic.querySelector !== 'function') return null;
  const element = graphic.querySelector('rect, path');
  if (!element) return null;
  const rect = typeof element.getBoundingClientRect === 'function' ? element.getBoundingClientRect() : null;
  return {
    tagName: element.tagName,
    transform: element.getAttribute('transform'),
    x: element.getAttribute('x'),
    y: element.getAttribute('y'),
    width: element.getAttribute('width'),
    height: element.getAttribute('height'),
    d: element.getAttribute('d'),
    rect: rect
      ? {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }
      : null,
  };
}

function logTutorialBrushLayers(scene, stage) {
  const { svg, layersByName } = scene;
  const { mainLayer } = layersByName;
  const selectionLayer =
    typeof mainLayer?.getLayerFromQueue === 'function'
      ? mainLayer.getLayerFromQueue('selectionLayer')
      : null;
  const transientLayer =
    typeof mainLayer?.getLayerFromQueue === 'function'
      ? mainLayer.getLayerFromQueue('transientLayer')
      : null;
  const svgRect = svg?.node?.()?.getBoundingClientRect?.();
  reportScatterBrushDebug('A', 'tutorial.js:logTutorialBrushLayers', `layer snapshot ${stage}`, {
    stage,
    svgRect: svgRect
      ? {
          left: svgRect.left,
          top: svgRect.top,
          width: svgRect.width,
          height: svgRect.height,
        }
      : null,
    mainLayer: getLayerDebugSnapshot(mainLayer),
    selectionLayer: getLayerDebugSnapshot(selectionLayer),
    transientLayer: getLayerDebugSnapshot(transientLayer),
    selectionBrush: getBrushDomSnapshot(selectionLayer),
    transientBrush: getBrushDomSnapshot(transientLayer),
  });
}

function installTutorialBrushDebug(scene) {
  if (!scene || scene.__brushDebugInstalled) return;
  scene.__brushDebugInstalled = true;
  scene.__brushDebugMoveCount = 0;

  const { svg, layersByName } = scene;
  const { mainLayer } = layersByName;
  const target = mainLayer?.getGraphic?.();
  if (!target) return;

  const emitPointerSnapshot = (event, stage) => {
    const selectionLayer =
      typeof mainLayer?.getLayerFromQueue === 'function'
        ? mainLayer.getLayerFromQueue('selectionLayer')
        : null;
    const transientLayer =
      typeof mainLayer?.getLayerFromQueue === 'function'
        ? mainLayer.getLayerFromQueue('transientLayer')
        : null;
    reportScatterBrushDebug('B', 'tutorial.js:installTutorialBrushDebug', `pointer snapshot ${stage}`, {
      stage,
      client: { x: event.clientX, y: event.clientY },
      pointerInMain: d3.pointer(event, mainLayer.getGraphic()),
      pointerInSelection: selectionLayer ? d3.pointer(event, selectionLayer.getGraphic()) : null,
      pointerInTransient: transientLayer ? d3.pointer(event, transientLayer.getGraphic()) : null,
      svgRect: svg.node()?.getBoundingClientRect
        ? (() => {
            const rect = svg.node().getBoundingClientRect();
            return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
          })()
        : null,
      mainLayer: getLayerDebugSnapshot(mainLayer),
      selectionLayer: getLayerDebugSnapshot(selectionLayer),
      transientLayer: getLayerDebugSnapshot(transientLayer),
      selectionBrush: getBrushDomSnapshot(selectionLayer),
      transientBrush: getBrushDomSnapshot(transientLayer),
    });
  };

  target.addEventListener('pointerdown', (event) => {
    scene.__brushDebugMoveCount = 0;
    emitPointerSnapshot(event, 'pointerdown');
  });

  target.addEventListener('pointermove', (event) => {
    if ((event.buttons || 0) === 0) return;
    if (scene.__brushDebugMoveCount >= 6) return;
    scene.__brushDebugMoveCount += 1;
    emitPointerSnapshot(event, `pointermove-${scene.__brushDebugMoveCount}`);
  });

  target.addEventListener('pointerup', (event) => {
    emitPointerSnapshot(event, 'pointerup');
  });
}
// #endregion

const TARGET_VIS_LINES = [
  'const axisLayer = Libra.Layer.initialize("D3Layer", {',
  '  name: "tutorialAxisLayer",',
  `  width: ${TARGET_SCENE.width},`,
  `  height: ${TARGET_SCENE.height},`,
  '  container: svg.node(),',
  '});',
  '',
  'const circleLayer = Libra.Layer.initialize("D3Layer", {',
  '  name: "tutorialCircleLayer",',
  `  width: ${TARGET_SCENE.width},`,
  `  height: ${TARGET_SCENE.height},`,
  '  container: svg.node(),',
  '});',
  '',
  'const squareLayer = Libra.Layer.initialize("D3Layer", {',
  '  name: "tutorialSquareLayer",',
  `  width: ${TARGET_SCENE.width},`,
  `  height: ${TARGET_SCENE.height},`,
  '  container: svg.node(),',
  '});',
  '',
  'd3.select(axisLayer.getGraphic())',
  '  .append("line")',
  '  .attr("class", "mark")',
  `  .attr("x1", ${TARGET_SCENE.axis.left})`,
  `  .attr("y1", ${TARGET_SCENE.axis.baseline})`,
  `  .attr("x2", ${TARGET_SCENE.axis.right})`,
  `  .attr("y2", ${TARGET_SCENE.axis.baseline});`,
  '',
  'd3.select(circleLayer.getGraphic())',
  '  .append("circle")',
  '  .attr("class", "mark")',
  `  .attr("cx", ${TARGET_SCENE.circle.cx})`,
  `  .attr("cy", ${TARGET_SCENE.circle.cy})`,
  `  .attr("r", ${TARGET_SCENE.circle.r});`,
  '',
  'd3.select(squareLayer.getGraphic())',
  '  .append("rect")',
  '  .attr("class", "mark")',
  `  .attr("x", ${TARGET_SCENE.square.x})`,
  `  .attr("y", ${TARGET_SCENE.square.y})`,
  `  .attr("width", ${TARGET_SCENE.square.size})`,
  `  .attr("height", ${TARGET_SCENE.square.size});`,
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
    return 'No compile-time or runtime diagnostics are currently reported.';
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

  xGraphic.selectAll(':not(.ig-layer-background)').remove();
  yGraphic.selectAll(':not(.ig-layer-background)').remove();
  mainGraphic.selectAll(':not(.ig-layer-background)').remove();

  const xAxisGroup = xGraphic
    .append('g')
    .attr('transform', `translate(0,${margin.top + height})`)
    .call(d3.axisBottom(currentXScale));
  xAxisGroup
    .append('text')
    .attr('x', margin.left + width / 2)
    .attr('y', margin.bottom - 8)
    .attr('fill', '#10233f')
    .attr('text-anchor', 'middle')
    .attr('font-size', 11)
    .attr('font-weight', 700)
    .text('Horsepower');

  const yAxisGroup = yGraphic
    .append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(currentYScale));
  yAxisGroup
    .append('text')
    .attr('x', -(margin.top + height / 2))
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
  const fullHeight = 360;
  const margin = { top: 24, right: 168, bottom: 52, left: 48 };
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
    .range([margin.left, margin.left + width])
    .nice();

  const scaleY = d3
    .scaleLinear()
    .domain(extentY)
    .range([margin.top + height, margin.top])
    .nice();

  const colorScale = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(data.map((d) => d.Origin))))
    .range(d3.schemeTableau10);

  const xAxisLayer = Libra.Layer.initialize('D3Layer', {
    name: `${unique}-x-axis`,
    width: fullWidth,
    height: fullHeight,
    container: svg.node(),
  });

  const yAxisLayer = Libra.Layer.initialize('D3Layer', {
    name: `${unique}-y-axis`,
    width: fullWidth,
    height: fullHeight,
    container: svg.node(),
  });

  const mainLayer = Libra.Layer.initialize('D3Layer', {
    name: `${unique}-main`,
    width: fullWidth,
    height: fullHeight,
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
  logTutorialBrushLayers(scene, 'scene-created');
  installTutorialBrushDebug(scene);

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
        parseErrors.push(`[ERROR] ${id} parse failed: ${error.message}`);
      }
    });

    if (parseErrors.length > 0) {
      if (summaryNode) {
        summaryNode.textContent = 'Code parsing failed. The scatter plot has been reset, and compileDSL was not executed this time.';
      }
      if (diagnosticsNode) {
        diagnosticsNode.textContent = parseErrors.join('\n');
      }
      return;
    }

    if (interactions.length === 0) {
      if (summaryNode) {
        summaryNode.textContent = 'No instrument is currently enabled, so only the base scatter plot is retained.';
      }
      if (diagnosticsNode) {
        diagnosticsNode.textContent = 'No compile-time or runtime diagnostics are currently reported.';
      }
      return;
    }

    const result = compileDSL(
      interactions,
      { layersByName: scene.layersByName },
      { execute: true }
    );
    logTutorialBrushLayers(scene, 'after-compile');

    if (summaryNode) {
      summaryNode.textContent = `Recompiled ${interactions.length} instrument(s): ${enabledIds.join(', ')}.`;
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

  const { width, height, axis, circle, square } = TARGET_SCENE;
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
    .attr('x1', axis.left)
    .attr('y1', axis.baseline)
    .attr('x2', axis.right)
    .attr('y2', axis.baseline)
    .attr('stroke', '#66758a')
    .attr('stroke-width', 2.5);

  axisGraphic
    .append('line')
    .attr('class', 'mark')
    .attr('x1', axis.left)
    .attr('y1', axis.baseline)
    .attr('x2', axis.left)
    .attr('y2', axis.top)
    .attr('stroke', '#66758a')
    .attr('stroke-width', 2.5);

  axis.tickXs.forEach((x) => {
    axisGraphic
      .append('line')
      .attr('class', 'mark')
      .attr('x1', x)
      .attr('y1', axis.baseline)
      .attr('x2', x)
      .attr('y2', axis.baseline + 8)
      .attr('stroke', '#8b98aa')
      .attr('stroke-width', 2);
  });

  axis.tickYs.forEach((y) => {
    axisGraphic
      .append('line')
      .attr('class', 'mark')
      .attr('x1', axis.left - 8)
      .attr('y1', y)
      .attr('x2', axis.left)
      .attr('y2', y)
      .attr('stroke', '#8b98aa')
      .attr('stroke-width', 2);
  });

  axisGraphic
    .append('text')
    .attr('x', axis.right - 2)
    .attr('y', axis.baseline + 24)
    .attr('fill', '#516074')
    .attr('font-size', 12)
    .attr('font-weight', 600)
    .text('x');

  axisGraphic
    .append('text')
    .attr('x', axis.left - 24)
    .attr('y', axis.top + 10)
    .attr('fill', '#516074')
    .attr('font-size', 12)
    .attr('font-weight', 600)
    .text('y');

  circleGraphic
    .append('circle')
    .attr('class', 'mark')
    .datum({ layer: 'circleLayer', shape: 'circle' })
    .attr('cx', circle.cx)
    .attr('cy', circle.cy)
    .attr('r', circle.r)
    .attr('fill', '#315d8d')
    .attr('stroke', '#1d3557')
    .attr('stroke-width', 2);

  squareGraphic
    .append('rect')
    .attr('class', 'mark')
    .datum({ layer: 'squareLayer', shape: 'square' })
    .attr('x', square.x)
    .attr('y', square.y)
    .attr('width', square.size)
    .attr('height', square.size)
    .attr('rx', square.rx)
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

  function renderScene() {
    const result = createTargetTutorialScene(container, state.targetLayer);
    if (!statusNode) return;

    const unresolved = (result?.diagnostics || []).find(
      (item) => item.code === 'compiler/unresolved-layer'
    );

    if (unresolved) {
      statusNode.textContent = 'The current target.layer does not resolve to any Libra layer, so the hover interaction will not hit any target object.';
      return;
    }

    statusNode.textContent = `point-selection has been recompiled against real Libra layers. The current target layer is ${state.targetLayer}. Move the pointer into the figure to verify hit testing.`;
  }

  function updateTargetLayer(nextLayer) {
    state.targetLayer = String(nextLayer || '').trim();
    if (input && input.value !== state.targetLayer) input.value = state.targetLayer;
    syncButtons();
    syncCode();
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
          <h1 class="hero-title">Understanding the Libra+ DSL Through instrument, trigger, target, feedback, and context</h1>
          <p>
            This tutorial is organized around the actual constraints enforced by the current compiler and validator, and is intended to provide
            a concise and consistent reference framework for authoring the new DSL. A useful starting point is to focus on the four top-level fields: <code>instrument</code>, 
            <code>trigger</code>, <code>target</code>, and <code>feedback</code>.
          </p>
          <div class="hero-actions">
            <a class="showcase-button" href="?page=gallery">Open Gallery</a>
            <a class="showcase-button showcase-button-ghost" href="?page=home">Back to Home</a>
          </div>
        </div>

        <aside class="tutorial-code-shell">
          <div class="spec-card-header">
            <strong>Minimal Structural Example</strong>
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
        <h2 class="section-title">instrument, trigger, target, feedback: responsibilities of the four top-level fields</h2>
        <div class="tutorial-grid">
          ${CORE_FIELDS.map((field) => renderFieldCard(field)).join('')}
        </div>
      </section>

      <section class="story-section tutorial-story">
        <div class="story-copy tutorial-copy">
          <span class="eyebrow">TTF Model</span>
          <h2 class="section-title">TTF model: see how trigger, target, and feedback work together</h2>
          <p class="section-text">
            The clip below walks through the TTF model in sequence and can be used as a quick bridge between the field definitions above and the interactive examples below.
            It is most useful when read together with the DSL examples on this page: first identify the trigger, then verify the target layer, and finally inspect how feedback is rendered.
          </p>
          <ul class="tutorial-list">
            ${renderSimpleList(TTF_MODEL_POINTS)}
          </ul>
        </div>
        <div class="story-media">
          <video class="tutorial-story-video" controls preload="metadata" playsinline src="${escapeHtml(TTF_VIDEO_SRC)}">
            Your browser does not support the video tag.
          </video>
        </div>
      </section>

      <section class="featured-panel">
        <span class="eyebrow">Target Field</span>
        <h2 class="section-title">target: observe layer resolution by modifying target.layer</h2>
        <p class="gallery-subtitle">
          The diagram below is deliberately decomposed into three independent layers: the axes correspond to <code>axisLayer</code>, the circle corresponds to
          <code>circleLayer</code>, and the square corresponds to <code>squareLayer</code>. After modifying
          <code>target.layer</code> in the configuration area, move the pointer to observe that the hover interaction only hits the specified target layer.
        </p>

        <div class="tutorial-target-layout">
          <div class="tutorial-target-visual">
            <div id="TutorialTargetMount" class="tutorial-target-stage" aria-label="Target layer tutorial visualization"></div>

            <div class="tutorial-target-editor">
              <div class="tutorial-target-head">
                <strong>Interaction Configuration</strong>
                <span class="tutorial-target-badge">point-selection · hover</span>
              </div>

              <label class="tutorial-target-label" for="TutorialTargetInput">Edit target.layer</label>
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
                Current target layer:
                <code id="TutorialTargetActive">circleLayer</code>
              </p>
              <p id="TutorialTargetStatus" class="tutorial-target-status"></p>
            </div>
          </div>

          <div class="tutorial-code-panel">
            <pre id="TutorialTargetDsl" class="tutorial-code tutorial-code-compact"></pre>
          </div>
        </div>

        <div class="tutorial-target-code">
          <div class="spec-card-header">
            <strong>Libra Layer Construction Code</strong>
            <span class="spec-chip">Libra</span>
          </div>
          <pre class="tutorial-code tutorial-code-compact">${escapeHtml(TARGET_VIS_LINES.join('\n'))}</pre>
        </div>
      </section>

      <section class="featured-panel">
        <span class="eyebrow">Instrument Field</span>
        <h2 class="section-title">instrument: the nine recommended forms covered by this tutorial</h2>
        <p class="gallery-subtitle">
          The table below retains only the forms that are currently supported by concrete new-DSL examples in this tutorial. The canonical names in the first column are recommended;
          subsequent aliases are primarily maintained for compatibility with existing examples or historical spellings.
        </p>
        <div class="tutorial-table-shell">
          <table class="tutorial-table">
            <thead>
              <tr>
                <th>Canonical Form</th>
                <th>Family</th>
                <th>Available Trigger</th>
                <th>Compatible Alias</th>
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
          <h2 class="section-title">feedback: how feedback structure and context are organized</h2>
          <p class="section-text">
            The current validator explicitly checks the first-level fields under <code>feedback</code>, so it is recommended to organize them strictly according to the following structure.
            This section first introduces the four top-level branches, then summarizes the subordinate fields commonly used by each instrument in the current compiler and runtime.
            The fields listed here are frequent and actually consumed by the system; they do not imply that every configuration must provide all of them.
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
        <h2 class="section-title">feedback: the four first-level branches</h2>
        <div class="tutorial-grid">
          ${FEEDBACK_TOP_LEVEL_FIELDS.map((field) => renderFieldCard(field)).join('')}
        </div>
      </section>

      <section class="featured-panel">
        <span class="eyebrow">Context Field</span>
        <h2 class="section-title">context: common runtime fields and configuration locations for different instruments</h2>
        <p class="gallery-subtitle">
          Field paths in the table follow the recommended style. In particular:
          visual fields such as <code>highlight</code> and <code>dim</code> are usually placed under <code>redrawFunc</code>,
          while scales, linking metadata, and dimension information are usually placed under <code>context</code>. Instrument-specific parameters for lens / reorder / helper-line
          are more often placed under <code>service</code> or <code>feedforward</code>.
        </p>
        <div class="tutorial-table-shell">
          <table class="tutorial-table">
            <thead>
              <tr>
                <th>instrument</th>
                <th>Common Top-Level Branches</th>
                <th>Common Subordinate Fields</th>
                <th>When It Is Typically Written</th>
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
        <h2 class="section-title">trigger / context: validate trigger behavior and context configuration in a real scatter plot</h2>
        <p class="gallery-subtitle">
          The playground below compiles seven instruments suitable for scatter plots directly onto the same real Libra scatter plot.
          Users may choose whether to enable each example, edit the corresponding DSL object directly, and then execute “Recompile Configuration”.
          Because <code>reorder</code> and <code>move</code> are not well explained through this non-data-driven scatter plot, more suitable gallery examples are linked separately.
        </p>

        <div class="tutorial-playground-shell">
          <div class="tutorial-playground-stage">
            <div class="tutorial-playground-toolbar">
              <div class="tutorial-target-head">
                <strong>Scatter Plot Playground</strong>
                <span class="tutorial-target-badge">Libra + compileDSL</span>
              </div>
              <div class="tutorial-playground-actions">
                <button id="TutorialPlaygroundApply" class="tutorial-action-button" type="button">Recompile Configuration</button>
                <button id="TutorialPlaygroundReset" class="tutorial-action-button tutorial-action-button-ghost" type="button">Restore Defaults</button>
              </div>
            </div>

            <div id="TutorialInstrumentMount" class="tutorial-target-stage tutorial-playground-canvas" aria-label="Instrument playground scatter plot"></div>

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
                  <code>reorder</code> is better suited to categorical axes or matrix scenarios and is not ideal for explanation through the current scatter plot. Refer instead to
                  <strong>${REORDER_GALLERY_LABEL}</strong> in the gallery for a more appropriate example.
                </p>
                <a class="showcase-button showcase-button-ghost" href="?page=${REORDER_GALLERY_PAGE}">
                  Open ${REORDER_GALLERY_LABEL}
                </a>
              </article>

              <article class="tutorial-editor-card tutorial-editor-card--link">
                <div class="tutorial-editor-head">
                  <strong><code>move</code></strong>
                  <span class="tutorial-target-badge">gallery</span>
                </div>
                <p class="tutorial-editor-hint">
                  In the current non-data-driven scatter plot, <code>move</code> offers limited explanatory value. Refer instead to
                  <strong>${MOVE_GALLERY_LABEL}</strong> in the gallery for a more suitable real example.
                </p>
                <a class="showcase-button showcase-button-ghost" href="?page=${encodeURIComponent(MOVE_GALLERY_PAGE)}">
                  Open ${MOVE_GALLERY_LABEL}
                </a>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section class="featured-panel">
        <span class="eyebrow">Trigger Extensions</span>
        <h2 class="section-title">trigger and top-level extensions: finer-grained control parameters</h2>
        <ul class="tutorial-detail-list">
          ${renderAdvancedList(ADVANCED_FIELDS)}
        </ul>
      </section>

      <section class="tutorial-callout">
        <span class="eyebrow">Field-Level Notes</span>
        <h2 class="section-title">common writing issues viewed from field-level constraints</h2>
        <div class="tutorial-note-grid">
          <article class="tutorial-note">
            <strong>1. Keep top-level fields restrained</strong>
            <p>The new DSL imposes relatively strong constraints on top-level fields, so additional fields are often judged as errors by the validator.</p>
          </article>
          <article class="tutorial-note">
            <strong>2. Place priority inside trigger</strong>
            <p>To control interaction precedence, place <code>priority</code>, <code>modifierKey</code>, and <code>stopPropagation</code> together inside <code>trigger</code>.</p>
          </article>
          <article class="tutorial-note">
            <strong>3. Prefer the layer form for target</strong>
            <p>Most interactions depend on layer resolution, so <code>target: { layer: "..." }</code> is the recommended uniform form.</p>
          </article>
        </div>
      </section>
    </div>
  `;

  bindTargetPlayground(container);
  bindInstrumentPlayground(container);
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}
