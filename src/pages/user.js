import * as d3 from 'd3';
import Libra from 'libra-vis';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { compileDSL } from '../scripts/dsl-compiler';

const BASE_WIDTH = 400;
const BASE_HEIGHT = 380;
const MAGNET_SIZE = 42;

const EXAMPLE_LIBRARY = [
  {
    id: 'move-magnet',
    title: 'Move Magnet',
    trigger: 'drag',
    summary: 'Drags an existing magnet and updates the dust layout through custom feedback flow.',
    composition: 'Use together with background click if you want users to create magnets before moving them.',
    lines: [
      '{',
      '  instrument: "move",',
      '  trigger: {',
      '    type: "drag"',
      '  },',
      '  target: {',
      '    layer: "magnetLayer",',
      '    pointerEvents: "visiblePainted"',
      '  },',
      '  feedback: {},',
      '  customFeedbackFlow: {',
      '    insert: commonInsertFlows,',
      '    remove: [{ find: "SelectionTransformer" }]',
      '  }',
      '}',
    ],
  },
  {
    id: 'add-magnet',
    title: 'Add Magnet',
    trigger: 'click',
    summary: 'Clicks the background to create a new magnet and recompute the dust layout.',
    composition: 'Acts as the creation step that supports later drag-based magnet manipulation.',
    lines: [
      '{',
      '  instrument: "pointSelection",',
      '  trigger: {',
      '    type: "click"',
      '  },',
      '  target: {',
      '    layer: "bgLayer"',
      '  },',
      '  feedback: {},',
      '  customFeedbackFlow: {',
      '    insert: commonInsertFlows',
      '  }',
      '}',
    ],
  },
  {
    id: 'select-dust',
    title: 'Select Dust',
    trigger: 'click',
    summary: 'Clicks dust points directly and highlights the selected marks.',
    composition: 'A simple direct-selection rule that can compete with brush or lens behavior.',
    lines: [
      '{',
      '  instrument: "pointSelection",',
      '  trigger: {',
      '    type: "click"',
      '  },',
      '  target: {',
      '    layer: "dustLayer",',
      '    pointerEvents: "visiblePainted"',
      '  },',
      '  feedback: {',
      '    redrawFunc: {',
      '      highlight: "greenyellow"',
      '    }',
      '  }',
      '}',
    ],
  },
  {
    id: 'brush-dust',
    title: 'Brush Dust',
    trigger: 'shift + brush',
    summary: 'Brushes dust points while holding Shift and highlights the selected region.',
    composition: 'Useful for studying multi-point selection and trigger competition with point selection.',
    lines: [
      '{',
      '  instrument: "groupSelection",',
      '  trigger: {',
      '    type: "brush"',
      '  },',
      '  target: {',
      '    layer: "dustLayer"',
      '  },',
      '  feedback: {',
      '    redrawFunc: {',
      '      highlight: {',
      '        color: "red"',
      '      }',
      '    }',
      '  }',
      '}',
    ],
  },
  {
    id: 'dust-lens',
    title: 'Dust Lens',
    trigger: 'hover',
    summary: 'Adds a lens-based local inspection layer over the dust marks.',
    composition: 'Provides local inspection and can be combined with selection or layout manipulation.',
    lines: [
      '{',
      '  name: "dustLens",',
      '  instrument: "lens",',
      '  trigger: {',
      '    type: "hover"',
      '  },',
      '  target: {',
      '    layer: "dustLayer"',
      '  },',
      '  feedback: {',
      '    service: {',
      '      lens: {',
      '        renderSelection: false,',
      '        r: 54,',
      '        stroke: "#1d8f43",',
      '        strokeWidth: 2',
      '      },',
      '      excentricLabeling: {',
      '        countLabelDistance: 18,',
      '        fontSize: 12,',
      '        countLabelWidth: 180,',
      '        maxLabelsNum: 8,',
      '        labelAccessor: (circleElem) => {',
      '          const datum = d3.select(circleElem).datum();',
      '          return datum?.Name || datum?.Origin || "";',
      '        },',
      '        colorAccessor: (circleElem) => {',
      '          const datum = d3.select(circleElem).datum();',
      '          return originColor?.(datum?.Origin) || "#666";',
      '        },',
      '        count: {',
      '          field: "Horsepower",',
      '          op: "mean",',
      '          formatter: (value, { count }) => `count: ${count} / maxHorsepower ${Math.round(value || 0)}`',
      '        }',
      '      }',
      '    }',
      '  }',
      '}',
    ],
  },
  {
    id: 'dust-zoom',
    title: 'Dust Zoom',
    trigger: 'zoom',
    summary: 'Uses wheel zoom on the dust layer and adjusts the lens zoom settings.',
    composition: 'Represents a simple navigation-style extension on top of the base Dust & Magnet view.',
    lines: [
      '{',
      '  instrument: "zoom",',
      '  trigger: {',
      '    type: "zoom"',
      '  },',
      '  target: {',
      '    layer: "dustLayer"',
      '  },',
      '  feedback: {',
      '    lens: {',
      '      zoom: {',
      '        step: 3,',
      '        minR: 12,',
      '        maxR: 96',
      '      }',
      '    }',
      '  }',
      '}',
    ],
  },
];

const EMPTY_SOURCE = ['[', '  // Write Dust & Magnet interaction rules here and compile manually.', ']'].join('\n');

const STATIC_VISUALIZATION_LINES = [
  'const rawData = await d3.json("/public/data/cars.json");',
  'const properties = Object.keys(rawData[0]).filter((key) => typeof rawData[0][key] === "number");',
  'const magnets = properties.slice(0, 3).map((property, index) => ({',
  '  x: BASE_WIDTH / 2 - Math.pow(-1, index) * (BASE_WIDTH / 2 - 100),',
  '  y: BASE_HEIGHT / 2 - Math.pow(-1, Math.floor(index / 2)) * (BASE_HEIGHT / 2 - 100),',
  '  property,',
  '}));',
  '',
  'const dusts = rawData.slice(0, 50).map((datum) => ({',
  '  ...datum,',
  '  x: BASE_WIDTH / 2,',
  '  y: BASE_HEIGHT / 2,',
  '}));',
  '',
  'const svg = d3.select("#UserStudyPreviewMount")',
  '  .append("svg")',
  '  .attr("width", BASE_WIDTH)',
  '  .attr("height", BASE_HEIGHT)',
  '  .attr("viewBox", `0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`);',
  '',
  'const dustLayer = Libra.Layer.initialize("D3Layer", {',
  '  name: "dustLayer",',
  '  width: BASE_WIDTH,',
  '  height: BASE_HEIGHT,',
  '  container: svg.node(),',
  '});',
  '',
  'const magnetLayer = dustLayer.getLayerFromQueue("magnetLayer");',
  'const bgLayer = dustLayer.getLayerFromQueue("backgroundLayer");',
  '',
  'd3.select(bgLayer.getGraphic())',
  '  .select("rect")',
  '  .attr("stroke", "#000")',
  '  .attr("fill", "none");',
  '',
  'd3.select(dustLayer.getGraphic())',
  '  .selectAll("circle")',
  '  .data(dusts)',
  '  .join("circle")',
  '  .attr("cx", (d) => d.x)',
  '  .attr("cy", (d) => d.y)',
  '  .attr("stroke", "#000")',
  '  .attr("fill", "#B9B9B9")',
  '  .attr("r", 10);',
  '',
  'd3.select(magnetLayer.getGraphic())',
  '  .selectAll("g")',
  '  .data(magnets)',
  '  .enter()',
  '  .append("g")',
  '  .call((g) => g.append("rect")',
  '    .attr("x", (d) => d.x)',
  '    .attr("y", (d) => d.y)',
  '    .attr("width", MAGNET_SIZE)',
  '    .attr("height", MAGNET_SIZE)',
  '    .attr("fill", "orange"))',
  '  .call((g) => g.append("text")',
  '    .attr("x", (d) => d.x + MAGNET_SIZE / 2)',
  '    .attr("y", (d) => d.y + MAGNET_SIZE / 2)',
  '    .attr("text-anchor", "middle")',
  '    .text((d) => d.property));',
];

let rawDustDataPromise = null;
let userStudyStaticEditor = null;
let userStudyComposerEditor = null;
let userStudyStaticDecorations = [];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isLayerDeclarationLine(line, index, lines) {
  const current = String(line || '');
  if (current.includes('getLayerFromQueue(')) {
    return true;
  }

  let inLayerInitializeBlock = false;
  for (let cursor = 0; cursor <= index; cursor += 1) {
    const content = String(lines[cursor] || '');
    if (content.includes('Libra.Layer.initialize(')) {
      inLayerInitializeBlock = true;
    }
    if (inLayerInitializeBlock && cursor === index) {
      return true;
    }
    if (inLayerInitializeBlock && content.trim() === '});') {
      inLayerInitializeBlock = false;
    }
  }

  return false;
}

function disposeUserStudyEditors() {
  if (userStudyStaticEditor) {
    userStudyStaticEditor.dispose();
    userStudyStaticEditor = null;
  }
  if (userStudyComposerEditor) {
    userStudyComposerEditor.dispose();
    userStudyComposerEditor = null;
  }
  userStudyStaticDecorations = [];
}

function createUserStudyCodeEditor(container, value, options = {}) {
  if (!container) return null;
  return monaco.editor.create(container, {
    value,
    language: 'javascript',
    theme: 'vs',
    readOnly: Boolean(options.readOnly),
    automaticLayout: true,
    minimap: { enabled: false },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: options.wordWrap || 'off',
    fontSize: 13,
    tabSize: 2,
    insertSpaces: true,
    renderLineHighlight: 'all',
    roundedSelection: false,
    glyphMargin: false,
    overviewRulerBorder: false,
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
  });
}

function decorateStaticLayerLines(editor, lines) {
  if (!editor) return;
  const decorations = lines
    .map((line, index) => (isLayerDeclarationLine(line, index, lines) ? index + 1 : null))
    .filter(Boolean)
    .map((lineNumber) => ({
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true,
        className: 'user-study-monaco-highlight',
        glyphMarginClassName: 'user-study-monaco-glyph',
      },
    }));

  userStudyStaticDecorations = editor.deltaDecorations(userStudyStaticDecorations, decorations);
}

function ensureUserStudyEditors(container) {
  const staticContainer = container.querySelector('#UserStudyStaticCodeEditor');
  const composerContainer = container.querySelector('#UserStudyComposerEditor');
  if (!staticContainer || !composerContainer) return {};

  if (!userStudyStaticEditor) {
    userStudyStaticEditor = createUserStudyCodeEditor(
      staticContainer,
      STATIC_VISUALIZATION_LINES.join('\n'),
      { readOnly: true, wordWrap: 'on' }
    );
    decorateStaticLayerLines(userStudyStaticEditor, STATIC_VISUALIZATION_LINES);
  }

  if (!userStudyComposerEditor) {
    userStudyComposerEditor = createUserStudyCodeEditor(
      composerContainer,
      EMPTY_SOURCE,
      { readOnly: false, wordWrap: 'off' }
    );
  }

  return {
    staticEditor: userStudyStaticEditor,
    composerEditor: userStudyComposerEditor,
  };
}

function indentBlock(source, prefix = '  ') {
  return String(source || '')
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

function wrapAsArraySource(snippet) {
  return `[\n${indentBlock(snippet)}\n]`;
}

function parseComposerSource(source, scope = {}) {
  const argNames = Object.keys(scope);
  const argValues = Object.values(scope);
  const evaluator = new Function(
    ...argNames,
    `"use strict"; return (${source});`
  );
  return evaluator(...argValues);
}

function formatDiagnostics(diagnostics = []) {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
    return 'No compileDSL diagnostics are currently reported.';
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

function findPotentialConflicts(interactions = []) {
  const bucket = new Map();

  interactions.forEach((interaction, index) => {
    const triggerType = interaction?.trigger?.type || 'unknown';
    const targetLayer = interaction?.target?.layer || 'unknown';
    const key = `${triggerType}::${targetLayer}`;
    const group = bucket.get(key) || [];
    group.push({
      index,
      instrument: interaction?.name || interaction?.instrument || `rule-${index + 1}`,
    });
    bucket.set(key, group);
  });

  return Array.from(bucket.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => {
      const [triggerType, targetLayer] = key.split('::');
      const names = group.map((item) => item.instrument).join(', ');
      return `${group.length} ${triggerType} rules currently target ${targetLayer}: ${names}. Try trigger.priority, modifierKey, or stopPropagation to resolve the conflict.`;
    });
}

function renderLibraryTabs(items) {
  return items
    .map(
      (item, index) => `
        <button
          class="user-study-template-tab${index === 0 ? ' is-active' : ''}"
          type="button"
          data-template-tab="${escapeHtml(item.id)}"
          aria-pressed="${index === 0 ? 'true' : 'false'}"
        >
          ${escapeHtml(item.title)}
        </button>
      `
    )
    .join('');
}

function renderLibraryPanels(items) {
  return items
    .map(
      (item, index) => `
        <article
          class="tutorial-editor-card user-study-library-card${index === 0 ? ' is-active' : ''}"
          data-template-panel="${escapeHtml(item.id)}"
          ${index === 0 ? '' : 'hidden'}
        >
          <div class="tutorial-editor-head">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="tutorial-target-badge">${escapeHtml(item.trigger)}</span>
          </div>
          <p class="tutorial-editor-hint">${escapeHtml(item.summary)}</p>
          <div class="user-study-template-stage">
            <div class="tutorial-target-stage user-study-template-mount" data-template-mount="${escapeHtml(item.id)}"></div>
          </div>
          <pre class="tutorial-code tutorial-code-compact user-study-template-code">${escapeHtml(item.lines.join('\n'))}</pre>
          <p class="tutorial-editor-hint">${escapeHtml(item.composition)}</p>
        </article>
      `
    )
    .join('');
}

async function loadDustMagnetRawData() {
  if (!rawDustDataPromise) {
    rawDustDataPromise = d3
      .json('./public/data/cars.json')
      .catch(() => d3.json('/data/cars.json'))
      .then((rawData = []) => rawData.filter(Boolean));
  }

  return rawDustDataPromise;
}

function createDustMagnetModel(rawData = [], width, height) {
  const originColor = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(rawData.map((d) => d?.Origin).filter(Boolean))))
    .range(d3.schemeTableau10);

  const datum = rawData[0] || {};
  const properties = [];
  const magnets = [];

  Object.keys(datum).forEach((property) => {
    const value = datum[property];
    if (typeof value !== 'number') return;

    properties.push(property);
    if (magnets.length < 3) {
      magnets.push({
        x: width / 2 - Math.pow(-1, magnets.length) * (width / 2 - 100),
        y: height / 2 - Math.pow(-1, Math.floor(magnets.length / 2)) * (height / 2 - 100),
        property,
      });
    }
  });

  const dusts = rawData.slice(0, 50).map((item) => ({
    ...item,
    x: width / 2,
    y: height / 2,
  }));

  return {
    dusts,
    magnets,
    properties,
    originColor,
    tickUpdate: null,
  };
}

function renderDust(scene, dustData = scene.dusts) {
  d3.select(scene.dustLayer.getGraphic())
    .selectAll('circle')
    .data(dustData)
    .join('circle')
    .attr('cx', (d) => d.x)
    .attr('cy', (d) => d.y)
    .attr('stroke', '#000')
    .attr('fill', '#B9B9B9')
    .attr('r', 10);
}

function renderMagnet(scene, magnetData = scene.magnets) {
  d3.select(scene.magnetLayer.getGraphic())
    .call((g) => g.selectChildren().remove())
    .selectAll('g')
    .data(magnetData)
    .enter()
    .append('g')
    .call((g) =>
      g
        .append('rect')
        .attr('x', (d) => d.x)
        .attr('y', (d) => d.y)
        .attr('width', MAGNET_SIZE)
        .attr('height', MAGNET_SIZE)
        .attr('fill', 'orange')
    )
    .call((g) =>
      g
        .append('text')
        .attr('x', (d) => d.x + MAGNET_SIZE / 2)
        .attr('y', (d) => d.y + MAGNET_SIZE / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text((d) => d.property)
    );
}

function createDustMagnetScene(mountNode, rawData = [], options = {}) {
  if (!mountNode) return null;

  mountNode.innerHTML = '';

  const fullWidth = options.fullWidth || BASE_WIDTH;
  const fullHeight = options.fullHeight || BASE_HEIGHT;
  const unique = `dust-user-study-${Date.now()}-${Math.round(Math.random() * 100000)}`;
  const model = createDustMagnetModel(rawData, fullWidth, fullHeight);

  const svg = d3
    .select(mountNode)
    .append('svg')
    .attr('class', 'tutorial-target-svg')
    .attr('width', fullWidth)
    .attr('height', fullHeight)
    .attr('viewBox', `0 0 ${fullWidth} ${fullHeight}`);

  const dustLayer = Libra.Layer.initialize('D3Layer', {
    name: `${unique}-dust`,
    width: fullWidth,
    height: fullHeight,
    offset: { x: 0, y: 0 },
    container: svg.node(),
  });

  const magnetLayer = dustLayer.getLayerFromQueue('magnetLayer');
  const bgLayer = dustLayer.getLayerFromQueue('backgroundLayer');

  d3.select(dustLayer.getGraphic()).attr('class', 'dust');
  d3.select(magnetLayer.getGraphic()).attr('class', 'magnet');

  dustLayer.setLayersOrder({
    backgroundLayer: 0,
    dustLayer: 1,
    magnetLayer: 2,
  });

  d3.select(bgLayer.getGraphic())
    .select('rect')
    .attr('stroke', '#000')
    .attr('fill', 'none')
    .attr('opacity', 1);

  const scene = {
    id: unique,
    svg,
    width: fullWidth,
    height: fullHeight,
    bgLayer,
    dustLayer,
    magnetLayer,
    ...model,
  };

  renderDust(scene);
  renderMagnet(scene);

  return scene;
}

function createCommonInsertFlows(scene) {
  const dustTransformerName = `${scene.id}-DustTransformer`;
  const magnetTransformerName = `${scene.id}-MagnetTransformer`;
  const magnetPositionServiceName = `${scene.id}-MagnetPositionService`;
  const dustLayoutServiceName = `${scene.id}-DustLayoutService`;

  const dustTransformer = Libra.GraphicalTransformer.initialize(dustTransformerName, {
    layer: scene.dustLayer,
    sharedVar: { result: scene.dusts },
    redraw({ transformer }) {
      const dusts = transformer.getSharedVar('result');
      scene.dusts = dusts;
      renderDust(scene, dusts);
      scene.dustLayer.postUpdate();
    },
  });

  const magnetTransformer = Libra.GraphicalTransformer.initialize(magnetTransformerName, {
    layer: scene.magnetLayer,
    sharedVar: { result: scene.magnets },
    redraw({ transformer }) {
      const magnets = transformer.getSharedVar('result');
      scene.magnets = magnets;
      renderMagnet(scene, magnets);
    },
  });

  return [
    {
      find: 'SelectionService',
      flow: [
        {
          comp: magnetPositionServiceName,
          name: magnetPositionServiceName,
          sharedVar: {
            magnets: scene.magnets,
          },
          evaluate({ magnets: currentMagnets, offsetx, offsety, result }) {
            if (result && result.length) {
              const datum = d3.select(result[0]).datum();
              datum.x = offsetx - MAGNET_SIZE / 2;
              datum.y = offsety - MAGNET_SIZE / 2;
            } else if (offsetx && offsety) {
              currentMagnets.push({
                x: offsetx - MAGNET_SIZE / 2,
                y: offsety - MAGNET_SIZE / 2,
                property: scene.properties[currentMagnets.length % scene.properties.length],
              });
            }
            return currentMagnets;
          },
        },
        magnetTransformer,
      ],
    },
    {
      find: magnetPositionServiceName,
      flow: [
        {
          comp: dustLayoutServiceName,
          name: dustLayoutServiceName,
          sharedVar: {
            dusts: scene.dusts,
            result: scene.dusts,
            magnets: scene.magnets,
          },
          evaluate({ dusts, magnets: serviceMagnets, self }) {
            const magnets = serviceMagnets || scene.magnets;
            if (!magnets || !magnets.length) return dusts;

            if (scene.tickUpdate) {
              cancelAnimationFrame(scene.tickUpdate);
            }

            const copyDusts = JSON.parse(JSON.stringify(dusts));
            magnets.forEach((magnet) => {
              const extent = d3.extent(copyDusts.map((datum) => datum[magnet.property]));
              copyDusts.forEach((dust) => {
                let x = dust.x;
                let y = dust.y;
                const dx = magnet.x;
                const dy = magnet.y;
                x += ((dx - x) * dust[magnet.property]) / 100 / extent[1];
                y += ((dy - y) * dust[magnet.property]) / 100 / extent[1];
                dust.x = x;
                dust.y = y;
              });
            });

            scene.tickUpdate = requestAnimationFrame(() => self.setSharedVar('dusts', copyDusts));
            return copyDusts;
          },
        },
        dustTransformer,
      ],
    },
  ];
}

function disableLensPointerEvents(scene) {
  const labelLayer = scene.dustLayer.getLayerFromQueue('LabelLayer');
  const lensLayer = scene.dustLayer.getLayerFromQueue('LensLayer');

  if (labelLayer?.getGraphic) {
    d3.select(labelLayer.getGraphic()).style('pointer-events', 'none');
  }
  if (lensLayer?.getGraphic) {
    d3.select(lensLayer.getGraphic()).style('pointer-events', 'none');
  }
}

function bindTemplateTabs(container) {
  const tabButtons = Array.from(container.querySelectorAll('[data-template-tab]'));
  const panels = Array.from(container.querySelectorAll('[data-template-panel]'));
  if (tabButtons.length === 0 || panels.length === 0) return;

  const activateTab = (templateId) => {
    tabButtons.forEach((button) => {
      const active = button.dataset.templateTab === templateId;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    panels.forEach((panel) => {
      const active = panel.dataset.templatePanel === templateId;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
  };

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activateTab(button.dataset.templateTab);
    });
  });
}

function bindUserStudyPage(container) {
  const summaryNode = container.querySelector('#UserStudySummary');
  const diagnosticsNode = container.querySelector('#UserStudyDiagnostics');
  const conflictNode = container.querySelector('#UserStudyConflictHints');
  const applyButton = container.querySelector('#UserStudyApply');
  const restoreButton = container.querySelector('#UserStudyRestore');
  const { composerEditor } = ensureUserStudyEditors(container);

  if (!composerEditor || !applyButton || !restoreButton) return;

  function setEditorValue(nextSource) {
    composerEditor.setValue(nextSource);
  }

  async function renderSourceToScene(source, config = {}) {
    const rawData = await loadDustMagnetRawData();
    const scene = createDustMagnetScene(config.mountNode, rawData, config.sceneOptions);
    if (!scene) return null;

    const scope = {
      d3,
      originColor: scene.originColor,
      commonInsertFlows: createCommonInsertFlows(scene),
      bgLayer: scene.bgLayer,
      dustLayer: scene.dustLayer,
      magnetLayer: scene.magnetLayer,
      properties: scene.properties,
      magnets: scene.magnets,
      dusts: scene.dusts,
    };

    let parsed;
    try {
      parsed = parseComposerSource(source, scope);
    } catch (error) {
      return {
        status: 'parse-error',
        summary: config.parseErrorSummary || 'Code parsing failed. The base Dust & Magnet view has been retained.',
        diagnostics: `[PARSE ERROR] ${error.message}`,
        conflicts: config.parseErrorConflict || 'Conflicts cannot be analyzed until the code is parsed into an interaction array.',
      };
    }

    const interactions = Array.isArray(parsed) ? parsed : [parsed];
    if (interactions.length === 0) {
      return {
        status: 'empty',
        summary: config.emptySummary || 'The code is currently empty, so only the base Dust & Magnet view is shown.',
        diagnostics: 'No compileDSL diagnostics are currently reported.',
        conflicts: config.emptyConflict || 'No conflicts are currently available for analysis.',
      };
    }

    try {
      const result = compileDSL(
        interactions,
        {
          layersByName: {
            bgLayer: scene.bgLayer,
            dustLayer: scene.dustLayer,
            magnetLayer: scene.magnetLayer,
          },
        },
        { execute: true }
      );

      disableLensPointerEvents(scene);

      const names = interactions.map((item) => item?.name || item?.instrument || 'unnamed');
      const conflictHints = findPotentialConflicts(interactions);
      return {
        status: 'ok',
        summary: `Compiled ${interactions.length} rule(s): ${names.join(', ')}.`,
        diagnostics: formatDiagnostics(result?.diagnostics || []),
        conflicts: conflictHints.length > 0
          ? conflictHints.join('\n')
          : 'No explicit competition on the same trigger + target.layer is currently detected.',
      };
    } catch (error) {
      return {
        status: 'runtime-error',
        summary: config.runtimeErrorSummary || 'compileDSL failed. The base Dust & Magnet view has been retained.',
        diagnostics: `[RUNTIME ERROR] ${error.message}`,
        conflicts: config.runtimeErrorConflict || 'Runtime analysis could not be completed. Fix the error first and then inspect conflicts again.',
      };
    }
  }

  async function renderComposition() {
    const result = await renderSourceToScene(composerEditor.getValue(), {
      mountNode: container.querySelector('#UserStudyPreviewMount'),
      sceneOptions: {
        fullWidth: BASE_WIDTH,
        fullHeight: BASE_HEIGHT,
      },
      parseErrorSummary: 'The composition code failed to parse. The base Dust & Magnet view has been retained.',
      emptySummary: 'The editor is currently empty, so only the base Dust & Magnet view is shown.',
    });

    if (summaryNode) {
      summaryNode.textContent = result?.summary || '';
    }
    if (diagnosticsNode) {
      diagnosticsNode.textContent = result?.diagnostics || '';
    }
    if (conflictNode) {
      conflictNode.textContent = result?.conflicts || '';
    }
  }

  async function renderTemplateCard(templateId) {
    const mountNode = container.querySelector(`[data-template-mount="${templateId}"]`);
    const template = EXAMPLE_LIBRARY.find((item) => item.id === templateId);
    if (!mountNode || !template) return;

    await renderSourceToScene(wrapAsArraySource(template.lines.join('\n')), {
      mountNode,
      sceneOptions: {
        fullWidth: 240,
        fullHeight: 250,
      },
      parseErrorSummary: 'This example cannot be parsed. The base Dust & Magnet view has been retained.',
      emptySummary: 'This example is currently empty, so only the base Dust & Magnet view is shown.',
      runtimeErrorSummary: 'This example failed at runtime, so the preview remains at the base Dust & Magnet view.',
    });
  }

  async function renderAllTemplateCards() {
    for (const item of EXAMPLE_LIBRARY) {
      // Sequential rendering avoids creating too many layered scenes at once.
      // eslint-disable-next-line no-await-in-loop
      await renderTemplateCard(item.id);
    }
  }

  applyButton.addEventListener('click', () => {
    renderComposition();
  });

  restoreButton.addEventListener('click', () => {
    setEditorValue(EMPTY_SOURCE);
    renderComposition();
  });

  composerEditor.addAction({
    id: 'user-study-compile',
    label: 'Compile Composition',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    run: () => renderComposition(),
  });

  setEditorValue(EMPTY_SOURCE);
  renderAllTemplateCards();
  bindTemplateTabs(container);
  renderComposition();
}

export default function initUserStudyPage() {
  const container = document.getElementById('LibraPlayground');
  if (!container) return;
  disposeUserStudyEditors();

  container.innerHTML = `
    <div class="showcase-page showcase-page--user-study">
      <section class="user-study-workbench">
        <div class="user-study-workbench-grid">
          <div class="user-study-template-column">
            <div class="user-study-template-column-head">
              <strong>Dust & Magnet Templates</strong>
              <span>Single interactions</span>
            </div>
            <div class="user-study-template-tabs" role="tablist" aria-label="Dust and Magnet templates">
              ${renderLibraryTabs(EXAMPLE_LIBRARY)}
            </div>
            <div class="user-study-template-list">
              ${renderLibraryPanels(EXAMPLE_LIBRARY)}
            </div>
          </div>

          <div class="user-study-preview-column">
            <div class="tutorial-playground-stage user-study-preview-panel">
              <div class="tutorial-playground-toolbar">
                <div class="tutorial-target-head">
                  <strong>Composition Preview</strong>
                  <span class="tutorial-target-badge">Dust & Magnet</span>
                </div>
              </div>

              <div id="UserStudyPreviewMount" class="tutorial-target-stage" aria-label="Dust and Magnet composition preview"></div>

              <div class="tutorial-playground-status user-study-preview-status">
                <p id="UserStudySummary" class="tutorial-target-status"></p>
                <pre id="UserStudyDiagnostics" class="tutorial-code tutorial-code-compact"></pre>
                <pre id="UserStudyConflictHints" class="tutorial-code tutorial-code-compact"></pre>
              </div>
            </div>
          </div>

          <div class="user-study-side-column">
            <article class="tutorial-editor-card user-study-static-panel">
              <div class="tutorial-editor-head">
                <strong>Static Visualization Code</strong>
                <span class="tutorial-target-badge">Base View</span>
              </div>
              <div id="UserStudyStaticCodeEditor" class="user-study-monaco user-study-static-code"></div>
            </article>

            <article class="tutorial-editor-card user-study-composer-card user-study-editor-panel">
              <div class="tutorial-editor-head">
                <strong>Composition Editor</strong>
                <div class="tutorial-playground-actions">
                  <button id="UserStudyApply" class="tutorial-action-button" type="button">Compile</button>
                  <button id="UserStudyRestore" class="tutorial-action-button tutorial-action-button-ghost" type="button">Restore</button>
                </div>
              </div>
              <div id="UserStudyComposerEditor" class="user-study-monaco user-study-editor"></div>
            </article>
          </div>
        </div>
      </section>
    </div>
  `;

  bindUserStudyPage(container);
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}
