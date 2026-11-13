import * as d3 from 'd3';
import { DEFAULT_HIDDEN_API_KEY } from '../llm-interaction-guesser/private-config.local';

const DEFAULT_API_BASE_URL = 'https://api.kksj.org/v1';
const DEFAULT_MODEL_NAME = 'gpt-4o-mini';
const STORAGE_KEYS = {
  baseUrl: 'libra.llmInteractionGuesser.baseUrl',
  model: 'libra.llmInteractionGuesser.model',
  temperature: 'libra.llmInteractionGuesser.temperature',
};

const PAGE_VARIANTS = [
  {
    pageId: 'llm-interaction-guesser',
    pageTitle: 'LLM Interaction Guesser Scatter',
    shortTitle: 'Scatter',
    chartType: 'scatter',
    chartLabel: 'scatter plot',
    ariaLabel: 'Static scatter plot for interaction intention demonstration',
    axisXLabel: 'Horsepower',
    axisYLabel: 'Miles per Gallon',
    overlayCaption: 'Static scatter plot: visualizing demonstrated mouse + keyboard behavior only',
  },
  {
    pageId: 'llm-interaction-guesser-bar',
    pageTitle: 'LLM Interaction Guesser Bar',
    shortTitle: 'Bar',
    chartType: 'bar',
    chartLabel: 'bar chart',
    ariaLabel: 'Static bar chart for interaction intention demonstration',
    axisXLabel: 'Category',
    axisYLabel: 'Value',
    overlayCaption: 'Static bar chart: visualizing demonstrated mouse + keyboard behavior only',
  },
  {
    pageId: 'llm-interaction-guesser-line',
    pageTitle: 'LLM Interaction Guesser Line',
    shortTitle: 'Line',
    chartType: 'line',
    chartLabel: 'line chart',
    ariaLabel: 'Static line chart for interaction intention demonstration',
    axisXLabel: 'Index',
    axisYLabel: 'Value',
    overlayCaption: 'Static line chart: visualizing demonstrated mouse + keyboard behavior only',
  },
];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function roundNumber(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeStorageGet(key, fallback = '') {
  try {
    const value = window.localStorage.getItem(key);
    return value == null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, String(value ?? ''));
  } catch (error) {
    // Ignore storage failures in private mode or locked environments.
  }
}

function snapshotKeyState(keyState = {}) {
  return {
    shift: !!keyState.shift,
    space: !!keyState.space,
    ctrl: !!keyState.ctrl,
    alt: !!keyState.alt,
    meta: !!keyState.meta,
  };
}

function getActiveKeys(keyState = {}) {
  return Object.entries(snapshotKeyState(keyState))
    .filter(([, active]) => active)
    .map(([key]) => key);
}

function getDistance(a, b) {
  if (!a || !b) return 0;
  const dx = Number(a.x || 0) - Number(b.x || 0);
  const dy = Number(a.y || 0) - Number(b.y || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToRect(point, rect) {
  const clampedX = clamp(point.x, rect.x, rect.x + rect.width);
  const clampedY = clamp(point.y, rect.y, rect.y + rect.height);
  return getDistance(point, { x: clampedX, y: clampedY });
}

function distanceToSegment(point, segment) {
  const x1 = segment.x1;
  const y1 = segment.y1;
  const x2 = segment.x2;
  const y2 = segment.y2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return getDistance(point, { x: x1, y: y1 });
  const t = clamp(((point.x - x1) * dx + (point.y - y1) * dy) / lengthSquared, 0, 1);
  return getDistance(point, {
    x: x1 + dx * t,
    y: y1 + dy * t,
  });
}

function normalizeApiBaseUrl(value) {
  let next = String(value || '')
    .trim()
    .replace(/^['"`\s]+|['"`\s]+$/g, '')
    .replace(/\s+/g, '');

  if (!next) return '';
  next = next.replace(/\/+$/, '');
  next = next.replace(/\/models$/i, '');
  next = next.replace(/\/chat\/completions$/i, '');
  return next;
}

function normalizeMessageContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part.text === 'string') return part.text;
      return '';
    })
    .join('\n')
    .trim();
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const candidates = [raw];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      // Try the next candidate.
    }
  }

  return null;
}

function formatTargetLabel(target) {
  if (!target) return 'background';
  return target.label || target.targetId || target.targetType || 'mark';
}

function serializeTarget(target) {
  if (!target) return null;
  return {
    targetType: target.targetType,
    targetId: target.targetId,
    label: target.label,
  };
}

function createRectTarget({
  targetType,
  targetId,
  label,
  x,
  y,
  width,
  height,
  hitThreshold = 12,
}) {
  return {
    targetType,
    targetId,
    label,
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    hitThreshold,
  };
}

function createPointTarget({
  targetType,
  targetId,
  label,
  x,
  y,
  hitThreshold = 20,
}) {
  return {
    targetType,
    targetId,
    label,
    x,
    y,
    hitThreshold,
  };
}

function createSegmentTarget({
  targetType,
  targetId,
  label,
  x1,
  y1,
  x2,
  y2,
  hitThreshold = 10,
}) {
  return {
    targetType,
    targetId,
    label,
    x1,
    y1,
    x2,
    y2,
    centerX: (x1 + x2) / 2,
    centerY: (y1 + y2) / 2,
    hitThreshold,
  };
}

function getTargetDistance(cursor, target) {
  if (!cursor?.inside || !target) return Number.POSITIVE_INFINITY;
  if (
    Number.isFinite(target.x1) &&
    Number.isFinite(target.y1) &&
    Number.isFinite(target.x2) &&
    Number.isFinite(target.y2)
  ) {
    return distanceToSegment(cursor, target);
  }
  if (Number.isFinite(target.width) && Number.isFinite(target.height)) {
    return distanceToRect(cursor, target);
  }
  if (Number.isFinite(target.x) && Number.isFinite(target.y)) {
    return getDistance(cursor, target);
  }
  return Number.POSITIVE_INFINITY;
}

function findNearestTarget(cursor, targets) {
  if (!cursor?.inside || !targets.length) return null;
  let best = null;
  targets.forEach((target) => {
    const distance = getTargetDistance(cursor, target);
    if (!best || distance < best.distance) {
      best = { ...target, distance };
    }
  });
  return best && best.distance <= Number(best.hitThreshold ?? 12) ? best : null;
}

function buildAxisXTicksFromPositions(positions, layout, spec, suffix = '') {
  const { margin, innerWidth, innerHeight } = layout;
  if (!positions.length) return [];
  return positions.map((entry, index) => {
    const prevX = positions[index - 1]?.x ?? (index > 0 ? entry.x : margin.left);
    const nextX =
      positions[index + 1]?.x ?? (index < positions.length - 1 ? entry.x : margin.left + innerWidth);
    const width = clamp((nextX - prevX) * 0.78, 28, 88);
    return createRectTarget({
      targetType: 'axis-x-tick',
      targetId: `axis-x-tick-${suffix}${index}`,
      label: `${spec.axisXLabel}: ${entry.label}`,
      x: entry.x - width / 2,
      y: margin.top + innerHeight - 2,
      width,
      height: 34,
      hitThreshold: 10,
    });
  });
}

function buildAxisYTicksFromPositions(positions, layout, spec, suffix = '') {
  const { margin } = layout;
  if (!positions.length) return [];
  return positions.map((entry, index) => {
    const prevY = positions[index - 1]?.y ?? entry.y;
    const nextY = positions[index + 1]?.y ?? entry.y;
    const height = clamp(Math.abs(nextY - prevY) * 0.78 || 24, 20, 42);
    return createRectTarget({
      targetType: 'axis-y-tick',
      targetId: `axis-y-tick-${suffix}${index}`,
      label: `${spec.axisYLabel}: ${entry.label}`,
      x: 6,
      y: entry.y - height / 2,
      width: margin.left + 4,
      height,
      hitThreshold: 10,
    });
  });
}

function buildAxisTitleTargets(layout, spec) {
  const { width, height, margin, innerHeight } = layout;
  return [
    createRectTarget({
      targetType: 'axis-x-title',
      targetId: 'axis-x-title',
      label: spec.axisXLabel,
      x: width / 2 - 84,
      y: height - 28,
      width: 168,
      height: 20,
      hitThreshold: 10,
    }),
    createRectTarget({
      targetType: 'axis-y-title',
      targetId: 'axis-y-title',
      label: spec.axisYLabel,
      x: 0,
      y: margin.top + innerHeight / 2 - 84,
      width: 34,
      height: 168,
      hitThreshold: 10,
    }),
  ];
}

function renderLegendItems(layers, items, layout) {
  const { margin, innerWidth, innerHeight } = layout;
  layers.legendLayer.selectAll('*').remove();
  if (!Array.isArray(items) || !items.length) return [];

  const itemHeight = 22;
  const legendWidth = 132;
  const legendX = margin.left + innerWidth - legendWidth - 10;
  const legendY = margin.top + 10;
  const legendHeight = items.length * itemHeight + 16;

  const legendRoot = layers.legendLayer
    .append('g')
    .attr('class', 'interaction-chart-legend')
    .attr('transform', `translate(${legendX} ${legendY})`);

  legendRoot
    .append('rect')
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .attr('rx', 10)
    .attr('fill', 'rgba(255, 255, 255, 0.92)')
    .attr('stroke', 'rgba(16, 35, 63, 0.14)');

  const rows = legendRoot
    .selectAll('.interaction-chart-legend-row')
    .data(items, (item) => item.id)
    .join('g')
    .attr('class', 'interaction-chart-legend-row')
    .attr('transform', (_, index) => `translate(10 ${10 + index * itemHeight})`);

  rows
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', 14)
    .attr('height', 14)
    .attr('rx', 4)
    .attr('fill', (item) => item.color)
    .attr('stroke', 'rgba(16, 35, 63, 0.18)');

  rows
    .append('text')
    .attr('x', 22)
    .attr('y', 11)
    .attr('fill', '#516074')
    .attr('font-size', 11)
    .text((item) => item.label);

  return items.map((item, index) =>
    createRectTarget({
      targetType: 'legend-item',
      targetId: `legend-item-${item.id}`,
      label: item.label,
      x: legendX + 8,
      y: legendY + 8 + index * itemHeight,
      width: legendWidth - 16,
      height: 18,
      hitThreshold: 8,
    })
  );
}

function renderRectTargetOverlay(layer, target) {
  layer
    .append('rect')
    .attr('x', target.x - 2)
    .attr('y', target.y - 2)
    .attr('width', target.width + 4)
    .attr('height', target.height + 4)
    .attr('rx', 8)
    .attr('fill', 'rgba(228, 87, 46, 0.08)')
    .attr('stroke', 'rgba(228, 87, 46, 0.78)')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4 4');

  layer
    .append('text')
    .attr('x', target.centerX)
    .attr('y', Math.max(18, target.y - 8))
    .attr('text-anchor', 'middle')
    .attr('fill', '#8c240e')
    .attr('font-size', 11)
    .text(target.label);
}

function renderSegmentTargetOverlay(layer, target) {
  layer
    .append('line')
    .attr('x1', target.x1)
    .attr('y1', target.y1)
    .attr('x2', target.x2)
    .attr('y2', target.y2)
    .attr('stroke', 'rgba(228, 87, 46, 0.78)')
    .attr('stroke-width', 6)
    .attr('stroke-linecap', 'round');

  layer
    .append('text')
    .attr('x', target.centerX)
    .attr('y', target.centerY - 10)
    .attr('text-anchor', 'middle')
    .attr('fill', '#8c240e')
    .attr('font-size', 11)
    .text(target.label);
}

function renderUiHoverOverlay(layer, target) {
  if (Number.isFinite(target.width) && Number.isFinite(target.height)) {
    renderRectTargetOverlay(layer, target);
    return true;
  }
  if (
    Number.isFinite(target.x1) &&
    Number.isFinite(target.y1) &&
    Number.isFinite(target.x2) &&
    Number.isFinite(target.y2)
  ) {
    renderSegmentTargetOverlay(layer, target);
    return true;
  }
  return false;
}

function buildDefaultSummary(chartLabel) {
  return {
    recording: 'idle',
    note: `Click "Start Recording", then demonstrate the interaction intent you want using only mouse and keyboard behavior on the static ${chartLabel}.`,
    supportedInteractions: [
      'hover inspect',
      'click select',
      'shift + drag as brush intent',
      'space + drag as pan intent',
      'wheel as zoom intent',
    ],
  };
}

function buildDefaultResult() {
  return {
    status: 'waiting',
    note: 'After recording, click "Ask LLM to Guess" and the system will infer the intended interaction from the behavior trace.',
  };
}

function buildDefaultInputPreview() {
  return {
    status: 'waiting',
    note: 'After you click "Ask LLM to Guess", the actual request sent to the LLM will appear here.',
  };
}

function buildGuessPrompt(payload) {
  return `
    You are an interaction-intent recognition assistant for information visualization.
    The user is looking at a static chart with no built-in interaction.
    The user can only demonstrate their intended interaction through mouse movement, pauses, clicks, drags, wheel actions, and key combinations.
    Based on the raw event trace, infer the primary interaction intent the user is trying to express.
    Do not assume the chart has actually performed selection, zooming, or panning.

    Candidate labels:
    - hover_inspect: the user intends hover inspection or hover highlighting
    - click_select: the user intends click selection
    - brush_select: the user intends brush selection
    - pan_navigate: the user intends pan navigation
    - zoom_navigate: the user intends zoom navigation
    - mixed_or_other: mixed behavior or another intent

    Return JSON only. Do not use Markdown code fences. Use this schema:
    {
      "label": "hover_inspect | click_select | brush_select | pan_navigate | zoom_navigate | mixed_or_other",
      "label_name": "short English label name",
      "confidence": 0.0,
      "reasoning": "one or two concise sentences",
      "evidence": ["up to 4 pieces of evidence"],
      "next_best_label": "backup label"
    }

    Interaction trace:
    ${JSON.stringify(payload, null, 2)}
  `.trim();
}

function buildLlmRequestPreview({ baseUrl, model, temperature, payload }) {
  return {
    endpoint: `${baseUrl}/chat/completions`,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: 'Bearer ***hidden***',
    },
    body: {
      model,
      temperature,
      messages: [
        {
          role: 'system',
          content:
            'You classify visualization interactions from short event traces and must respond with strict JSON only.',
        },
        {
          role: 'user',
          content: buildGuessPrompt(payload),
        },
      ],
    },
  };
}

function createRecorder({ captureSnapshot, onChange, buildDefaultSummaryValue }) {
  const state = {
    active: false,
    events: [],
    startedAt: 0,
    endedAt: 0,
    startSnapshot: null,
    endSnapshot: null,
    sampleGate: new Map(),
  };

  function getSummary() {
    if (!state.startedAt) return buildDefaultSummaryValue();

    const durationMs = (state.active ? Date.now() : state.endedAt || Date.now()) - state.startedAt;
    const eventCounts = {};
    state.events.forEach((event) => {
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
    });

    return {
      recording: state.active ? 'recording' : 'stopped',
      durationMs,
      eventCount: state.events.length,
      startState: state.startSnapshot,
      endState: state.active ? captureSnapshot() : state.endSnapshot,
      eventCounts,
      recentEvents: state.events.slice(-20),
    };
  }

  function notify() {
    if (typeof onChange === 'function') {
      onChange(getSummary());
    }
  }

  function push(type, payload = {}) {
    if (!state.active) return null;
    state.events.push({
      index: state.events.length + 1,
      t: Date.now() - state.startedAt,
      type,
      payload,
    });
    if (state.events.length > 140) {
      state.events.splice(0, state.events.length - 140);
    }
    notify();
    return state.events[state.events.length - 1];
  }

  function sample(type, payload = {}, windowMs = 80, key = type) {
    if (!state.active) return null;
    const now = Date.now();
    const last = state.sampleGate.get(key) || 0;
    if (now - last < windowMs) return null;
    state.sampleGate.set(key, now);
    return push(type, payload);
  }

  return {
    clear() {
      state.active = false;
      state.events = [];
      state.startedAt = 0;
      state.endedAt = 0;
      state.startSnapshot = null;
      state.endSnapshot = null;
      state.sampleGate.clear();
      notify();
    },
    start() {
      state.active = true;
      state.events = [];
      state.startedAt = Date.now();
      state.endedAt = 0;
      state.startSnapshot = captureSnapshot();
      state.endSnapshot = null;
      state.sampleGate.clear();
      notify();
    },
    stop() {
      if (!state.active) {
        notify();
        return;
      }
      state.active = false;
      state.endedAt = Date.now();
      state.endSnapshot = captureSnapshot();
      notify();
    },
    push,
    sample,
    isActive: () => state.active,
    hasEvents: () => state.events.length > 0,
    getEvents: () => state.events.slice(),
    getSummary,
  };
}

async function loadJsonData(paths) {
  for (const path of paths) {
    try {
      const result = await d3.json(path);
      if (Array.isArray(result)) return result;
    } catch (error) {
      // Try the next path.
    }
  }
  return null;
}

async function loadScatterData() {
  const rawData = await loadJsonData(['./public/data/cars.json', '/public/data/cars.json']);
  const prepared = Array.isArray(rawData)
    ? rawData
        .filter(
          (datum) =>
            Number.isFinite(datum?.Horsepower) && Number.isFinite(datum?.Miles_per_Gallon)
        )
        .slice(0, 72)
        .map((datum, index) => ({
          id: `scatter-${index}`,
          label: datum.Name || `Car ${index + 1}`,
          series: datum.Origin || 'Unknown',
          x: Number(datum.Horsepower),
          y: Number(datum.Miles_per_Gallon),
        }))
    : [];
  if (!prepared.length) throw new Error('Unable to load cars.json for the scatter plot lab.');
  return prepared;
}

async function loadBarData() {
  const rawData = await loadJsonData(['./public/data/testBar.json', '/public/data/testBar.json']);
  const prepared = Array.isArray(rawData)
    ? rawData.map((datum, index) => ({
        id: `bar-${index}`,
        label: String(datum?.x ?? index + 1),
        value: Number(datum?.y ?? 0),
      }))
    : [];
  if (!prepared.length) throw new Error('Unable to load testBar.json for the bar chart lab.');
  return prepared;
}

async function loadLineData() {
  const rawData = await loadJsonData(['./public/data/testLine.json', '/public/data/testLine.json']);
  const prepared = Array.isArray(rawData)
    ? rawData.map((datum, index) => ({
        id: `line-${index}`,
        label: String(datum?.x ?? index + 1),
        value: Number(datum?.y ?? 0),
      }))
    : [];
  if (!prepared.length) throw new Error('Unable to load testLine.json for the line chart lab.');
  return prepared;
}

function createScatterChartModel(layout, layers, data, spec) {
  const { margin, innerWidth, innerHeight } = layout;
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(data, (datum) => datum.x))
    .nice()
    .range([margin.left, margin.left + innerWidth]);
  const yScale = d3
    .scaleLinear()
    .domain(d3.extent(data, (datum) => datum.y))
    .nice()
    .range([margin.top + innerHeight, margin.top]);

  layers.gridLayer
    .selectAll('.grid-x')
    .data(xScale.ticks(6), (datum) => datum)
    .join(
      (enter) =>
        enter
          .append('line')
          .attr('class', 'grid-x')
          .attr('y1', margin.top)
          .attr('y2', margin.top + innerHeight)
          .attr('stroke', 'rgba(16, 35, 63, 0.06)')
          .attr('stroke-dasharray', '4 6'),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('x1', (datum) => xScale(datum))
    .attr('x2', (datum) => xScale(datum));

  layers.gridLayer
    .selectAll('.grid-y')
    .data(yScale.ticks(6), (datum) => datum)
    .join(
      (enter) =>
        enter
          .append('line')
          .attr('class', 'grid-y')
          .attr('x1', margin.left)
          .attr('x2', margin.left + innerWidth)
          .attr('stroke', 'rgba(16, 35, 63, 0.06)')
          .attr('stroke-dasharray', '4 6'),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('y1', (datum) => yScale(datum))
    .attr('y2', (datum) => yScale(datum));

  layers.axisLayer.selectAll('*').remove();
  layers.axisLayer
    .append('g')
    .attr('class', 'interaction-axis-x')
    .attr('transform', `translate(0 ${margin.top + innerHeight})`)
    .call(d3.axisBottom(xScale).ticks(6));
  layers.axisLayer
    .append('g')
    .attr('class', 'interaction-axis-y')
    .attr('transform', `translate(${margin.left} 0)`)
    .call(d3.axisLeft(yScale).ticks(6));
  layers.axisLayer.selectAll('.domain, .tick line').attr('stroke', 'rgba(16, 35, 63, 0.18)');
  layers.axisLayer.selectAll('.tick text').attr('fill', '#516074').attr('font-size', 11);

  const color = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(data.map((datum) => datum.series))))
    .range(['#315d8d', '#e4572e', '#f3b400', '#61738b']);
  const legendItems = color.domain().map((series) => ({
    id: String(series).toLowerCase().replace(/\s+/g, '-'),
    label: String(series),
    color: color(series),
  }));

  layers.markLayer
    .selectAll('.interaction-mark')
    .data(data, (datum) => datum.id)
    .join(
      (enter) =>
        enter
          .append('circle')
          .attr('class', 'interaction-mark')
          .attr('r', 5.5)
          .attr('stroke-width', 1.25),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('cx', (datum) => xScale(datum.x))
    .attr('cy', (datum) => yScale(datum.y))
    .attr('fill', (datum) => color(datum.series))
    .attr('stroke', 'rgba(16, 35, 63, 0.2)')
    .attr('opacity', 0.82);

  const markTargets = data.map((datum) =>
    createPointTarget({
      targetType: 'point',
      targetId: datum.id,
      label: datum.label,
      x: xScale(datum.x),
      y: yScale(datum.y),
      hitThreshold: 20,
    })
  );

  const xTicks = xScale.ticks(6).map((tick) => ({
    x: xScale(tick),
    label: roundNumber(tick),
  }));
  const yTicks = yScale.ticks(6).map((tick) => ({
    y: yScale(tick),
    label: roundNumber(tick),
  }));

  return markTargets
    .concat(buildAxisXTicksFromPositions(xTicks, layout, spec, 'scatter-'))
    .concat(buildAxisYTicksFromPositions(yTicks, layout, spec, 'scatter-'))
    .concat(buildAxisTitleTargets(layout, spec))
    .concat(renderLegendItems(layers, legendItems, layout));
}

function createBarChartModel(layout, layers, data, spec) {
  const { margin, innerWidth, innerHeight } = layout;
  const xScale = d3
    .scaleBand()
    .domain(data.map((datum) => datum.label))
    .range([margin.left, margin.left + innerWidth])
    .padding(0.18);
  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (datum) => datum.value) || 0])
    .nice()
    .range([margin.top + innerHeight, margin.top]);

  layers.gridLayer
    .selectAll('.grid-y')
    .data(yScale.ticks(6), (datum) => datum)
    .join(
      (enter) =>
        enter
          .append('line')
          .attr('class', 'grid-y')
          .attr('x1', margin.left)
          .attr('x2', margin.left + innerWidth)
          .attr('stroke', 'rgba(16, 35, 63, 0.06)')
          .attr('stroke-dasharray', '4 6'),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('y1', (datum) => yScale(datum))
    .attr('y2', (datum) => yScale(datum));

  layers.axisLayer.selectAll('*').remove();
  layers.axisLayer
    .append('g')
    .attr('class', 'interaction-axis-x')
    .attr('transform', `translate(0 ${margin.top + innerHeight})`)
    .call(d3.axisBottom(xScale));
  layers.axisLayer
    .append('g')
    .attr('class', 'interaction-axis-y')
    .attr('transform', `translate(${margin.left} 0)`)
    .call(d3.axisLeft(yScale).ticks(6));
  layers.axisLayer.selectAll('.domain, .tick line').attr('stroke', 'rgba(16, 35, 63, 0.18)');
  layers.axisLayer.selectAll('.tick text').attr('fill', '#516074').attr('font-size', 11);

  layers.markLayer
    .selectAll('.interaction-mark')
    .data(data, (datum) => datum.id)
    .join(
      (enter) => enter.append('rect').attr('class', 'interaction-mark'),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('x', (datum) => xScale(datum.label))
    .attr('y', (datum) => yScale(datum.value))
    .attr('width', xScale.bandwidth())
    .attr('height', (datum) => margin.top + innerHeight - yScale(datum.value))
    .attr('rx', 6)
    .attr('fill', '#315d8d')
    .attr('opacity', 0.88);
  const markTargets = data.map((datum) => {
    const x = xScale(datum.label);
    const y = yScale(datum.value);
    const width = xScale.bandwidth();
    const height = margin.top + innerHeight - y;
    return createRectTarget({
      targetType: 'bar',
      targetId: datum.id,
      label: datum.label,
      x,
      y,
      width,
      height,
      hitThreshold: 10,
    });
  });

  const xTicks = data.map((datum) => ({
    x: xScale(datum.label) + xScale.bandwidth() / 2,
    label: datum.label,
  }));
  const yTicks = yScale.ticks(6).map((tick) => ({
    y: yScale(tick),
    label: roundNumber(tick),
  }));
  const legendItems = [
    {
      id: 'bars',
      label: 'Bars',
      color: '#315d8d',
    },
  ];

  return markTargets
    .concat(buildAxisXTicksFromPositions(xTicks, layout, spec, 'bar-'))
    .concat(buildAxisYTicksFromPositions(yTicks, layout, spec, 'bar-'))
    .concat(buildAxisTitleTargets(layout, spec))
    .concat(renderLegendItems(layers, legendItems, layout));
}

function createLineChartModel(layout, layers, data, spec) {
  const { margin, innerWidth, innerHeight } = layout;
  const xScale = d3
    .scalePoint()
    .domain(data.map((datum) => datum.label))
    .range([margin.left, margin.left + innerWidth])
    .padding(0.15);
  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (datum) => datum.value) || 0])
    .nice()
    .range([margin.top + innerHeight, margin.top]);

  layers.gridLayer
    .selectAll('.grid-y')
    .data(yScale.ticks(6), (datum) => datum)
    .join(
      (enter) =>
        enter
          .append('line')
          .attr('class', 'grid-y')
          .attr('x1', margin.left)
          .attr('x2', margin.left + innerWidth)
          .attr('stroke', 'rgba(16, 35, 63, 0.06)')
          .attr('stroke-dasharray', '4 6'),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('y1', (datum) => yScale(datum))
    .attr('y2', (datum) => yScale(datum));

  layers.axisLayer.selectAll('*').remove();
  layers.axisLayer
    .append('g')
    .attr('class', 'interaction-axis-x')
    .attr('transform', `translate(0 ${margin.top + innerHeight})`)
    .call(d3.axisBottom(xScale));
  layers.axisLayer
    .append('g')
    .attr('class', 'interaction-axis-y')
    .attr('transform', `translate(${margin.left} 0)`)
    .call(d3.axisLeft(yScale).ticks(6));
  layers.axisLayer.selectAll('.domain, .tick line').attr('stroke', 'rgba(16, 35, 63, 0.18)');
  layers.axisLayer.selectAll('.tick text').attr('fill', '#516074').attr('font-size', 11);

  const points = data.map((datum) =>
    createPointTarget({
      targetType: 'line-point',
      targetId: datum.id,
      label: datum.label,
      x: xScale(datum.label),
      y: yScale(datum.value),
      hitThreshold: 16,
    })
  );

  layers.markLayer
    .selectAll('.interaction-line')
    .data([points])
    .join('path')
    .attr('class', 'interaction-line')
    .attr(
      'd',
      d3
        .line()
        .x((datum) => datum.x)
        .y((datum) => datum.y)
    )
    .attr('fill', 'none')
    .attr('stroke', '#315d8d')
    .attr('stroke-width', 3)
    .attr('stroke-linejoin', 'round')
    .attr('stroke-linecap', 'round');

  layers.markLayer
    .selectAll('.interaction-mark')
    .data(points, (datum) => datum.targetId)
    .join(
      (enter) =>
        enter
          .append('circle')
          .attr('class', 'interaction-mark')
          .attr('r', 5.5),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('cx', (datum) => datum.x)
    .attr('cy', (datum) => datum.y)
    .attr('fill', '#fff')
    .attr('stroke', '#315d8d')
    .attr('stroke-width', 2);

  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
      segments.push(
        createSegmentTarget({
          targetType: 'line-segment',
          targetId: `${start.targetId}__${end.targetId}`,
          label: `${start.label} -> ${end.label}`,
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
          hitThreshold: 10,
        })
      );
  }
  const xTicks = data.map((datum) => ({
    x: xScale(datum.label),
    label: datum.label,
  }));
  const yTicks = yScale.ticks(6).map((tick) => ({
    y: yScale(tick),
    label: roundNumber(tick),
  }));
  const legendItems = [
    {
      id: 'line',
      label: 'Line Series',
      color: '#315d8d',
    },
    {
      id: 'points',
      label: 'Data Points',
      color: '#ffffff',
    },
  ];

  return points
    .concat(segments)
    .concat(buildAxisXTicksFromPositions(xTicks, layout, spec, 'line-'))
    .concat(buildAxisYTicksFromPositions(yTicks, layout, spec, 'line-'))
    .concat(buildAxisTitleTargets(layout, spec))
    .concat(renderLegendItems(layers, legendItems, layout));
}

function findScatterTarget(cursor, targets) {
  return findNearestTarget(cursor, targets);
}

function findBarTarget(cursor, targets) {
  return findNearestTarget(cursor, targets);
}

function findLineTarget(cursor, targets) {
  return findNearestTarget(cursor, targets);
}

function renderScatterHoverOverlay(layer, target) {
  if (renderUiHoverOverlay(layer, target)) return;
  layer
    .append('circle')
    .attr('cx', target.x)
    .attr('cy', target.y)
    .attr('r', 12)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(228, 87, 46, 0.7)')
    .attr('stroke-dasharray', '3 4');

  layer
    .append('text')
    .attr('x', target.x + 12)
    .attr('y', target.y - 10)
    .attr('fill', '#8c240e')
    .attr('font-size', 11)
    .text(target.label);
}

function renderBarHoverOverlay(layer, target) {
  if (renderUiHoverOverlay(layer, target)) return;
  layer
    .append('rect')
    .attr('x', target.x - 2)
    .attr('y', target.y - 2)
    .attr('width', target.width + 4)
    .attr('height', target.height + 4)
    .attr('rx', 8)
    .attr('fill', 'rgba(228, 87, 46, 0.08)')
    .attr('stroke', 'rgba(228, 87, 46, 0.78)')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4 4');

  layer
    .append('text')
    .attr('x', target.centerX)
    .attr('y', Math.max(18, target.y - 8))
    .attr('text-anchor', 'middle')
    .attr('fill', '#8c240e')
    .attr('font-size', 11)
    .text(target.label);
}

function renderLineHoverOverlay(layer, target) {
  if (renderUiHoverOverlay(layer, target)) return;
  if (target.targetType === 'line-segment') {
    layer
      .append('line')
      .attr('x1', target.x1)
      .attr('y1', target.y1)
      .attr('x2', target.x2)
      .attr('y2', target.y2)
      .attr('stroke', 'rgba(228, 87, 46, 0.78)')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round');

    layer
      .append('text')
      .attr('x', target.centerX)
      .attr('y', target.centerY - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#8c240e')
      .attr('font-size', 11)
      .text(target.label);
    return;
  }

  layer
    .append('circle')
    .attr('cx', target.x)
    .attr('cy', target.y)
    .attr('r', 12)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(228, 87, 46, 0.7)')
    .attr('stroke-dasharray', '3 4');

  layer
    .append('text')
    .attr('x', target.x + 12)
    .attr('y', target.y - 10)
    .attr('fill', '#8c240e')
    .attr('font-size', 11)
    .text(target.label);
}

const CHART_IMPLEMENTATIONS = {
  scatter: {
    loadData: loadScatterData,
    renderBase: createScatterChartModel,
    findTarget: findScatterTarget,
    renderHover: renderScatterHoverOverlay,
  },
  bar: {
    loadData: loadBarData,
    renderBase: createBarChartModel,
    findTarget: findBarTarget,
    renderHover: renderBarHoverOverlay,
  },
  line: {
    loadData: loadLineData,
    renderBase: createLineChartModel,
    findTarget: findLineTarget,
    renderHover: renderLineHoverOverlay,
  },
};

function createStaticChartWorkbench(mountNode, { onHintChange, onSummaryChange, onKeyModeChange, spec }) {
  const chartImpl = CHART_IMPLEMENTATIONS[spec.chartType];
  const width = 760;
  const height = 520;
  const margin = { top: 28, right: 24, bottom: 50, left: 62 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const clipId = `interaction-lab-${spec.chartType}-${Date.now().toString(36)}`;
  const layout = { width, height, margin, innerWidth, innerHeight };

  const svg = d3
    .create('svg')
    .attr('class', 'interaction-guesser-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', spec.ariaLabel)
    .attr('tabindex', 0);

  const defs = svg.append('defs');
  defs
    .append('clipPath')
    .attr('id', clipId)
    .append('rect')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', innerWidth)
    .attr('height', innerHeight);

  const root = svg.append('g');
  root
    .append('rect')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', innerWidth)
    .attr('height', innerHeight)
    .attr('fill', '#fbfbf8')
    .attr('stroke', 'rgba(16, 35, 63, 0.12)');

  const layers = {
    gridLayer: root.append('g'),
    axisLayer: root.append('g'),
    markLayer: root.append('g').attr('clip-path', `url(#${clipId})`),
    legendLayer: root.append('g'),
    overlayLayer: root.append('g'),
    labelLayer: root.append('g'),
  };

  const frameRect = layers.overlayLayer
    .append('rect')
    .attr('class', 'interaction-guesser-frame')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height)
    .attr('fill', 'transparent')
    .attr('pointer-events', 'all')
    .style('cursor', 'none');

  layers.labelLayer
    .append('text')
    .attr('x', width / 2)
    .attr('y', height - 10)
    .attr('text-anchor', 'middle')
    .attr('fill', '#516074')
    .attr('font-size', 12)
    .text(spec.axisXLabel);

  layers.labelLayer
    .append('text')
    .attr('transform', `translate(16 ${height / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('fill', '#516074')
    .attr('font-size', 12)
    .text(spec.axisYLabel);

  mountNode.innerHTML = '';
  mountNode.appendChild(svg.node());

  const state = {
    data: [],
    targets: [],
    cursor: null,
    hoverTarget: null,
    pointerDown: false,
    suppressClick: false,
    dragGesture: null,
    clickBursts: [],
    wheelBursts: [],
    trail: [],
    keyState: {
      shift: false,
      space: false,
      ctrl: false,
      alt: false,
      meta: false,
    },
    lastHint: `This is a static ${spec.chartLabel}. Use only mouse and keyboard behavior to demonstrate the interaction you want to add, and the system will visualize your behavior trace.`,
  };

  function emitHint(text) {
    state.lastHint = text;
    if (typeof onHintChange === 'function') onHintChange(text);
  }

  function emitKeyMode() {
    if (typeof onKeyModeChange === 'function') {
      onKeyModeChange(snapshotKeyState(state.keyState));
    }
  }

  function captureSnapshot() {
    return {
      cursor: state.cursor
        ? {
            inside: !!state.cursor.inside,
                insidePlot: !!state.cursor.insidePlot,
            plotX: roundNumber(state.cursor.plotX),
            plotY: roundNumber(state.cursor.plotY),
          }
        : null,
      pointerDown: state.pointerDown,
      activeKeys: getActiveKeys(state.keyState),
      hoverTarget: serializeTarget(state.hoverTarget),
    };
  }

  const recorder = createRecorder({
    captureSnapshot,
    onChange: (summary) => {
      if (typeof onSummaryChange === 'function') onSummaryChange(summary);
    },
    buildDefaultSummaryValue: () => buildDefaultSummary(spec.chartLabel),
  });

  function localPoint(event) {
    const [x, y] = d3.pointer(event, svg.node());
        const inside =
          x >= 0 &&
          x <= width &&
          y >= 0 &&
          y <= height;
        const insidePlot =
      x >= margin.left &&
      x <= margin.left + innerWidth &&
      y >= margin.top &&
      y <= margin.top + innerHeight;
    return {
      x,
      y,
      plotX: x - margin.left,
      plotY: y - margin.top,
      clampedPlotX: clamp(x - margin.left, 0, innerWidth),
      clampedPlotY: clamp(y - margin.top, 0, innerHeight),
      inside,
          insidePlot,
    };
  }

  function recordCursorEvent(type, cursor, extra = {}) {
    return recorder.push(type, {
      inside: !!cursor?.inside,
          insidePlot: !!cursor?.insidePlot,
      plotX: roundNumber(cursor?.clampedPlotX),
      plotY: roundNumber(cursor?.clampedPlotY),
      keys: snapshotKeyState(state.keyState),
      ...extra,
    });
  }

  function sampleCursorMove(cursor) {
    recorder.sample(
      'cursor-move',
      {
        inside: !!cursor?.inside,
            insidePlot: !!cursor?.insidePlot,
        plotX: roundNumber(cursor?.clampedPlotX),
        plotY: roundNumber(cursor?.clampedPlotY),
        pointerDown: state.pointerDown,
        keys: snapshotKeyState(state.keyState),
        hoverTarget: serializeTarget(state.hoverTarget),
      },
      48,
      'cursor-move'
    );
  }

  function updateTrail(cursor) {
    if (!cursor?.inside && !state.pointerDown) return;
    state.trail.push({
      x: cursor?.inside ? cursor.x : margin.left + cursor.clampedPlotX,
      y: cursor?.inside ? cursor.y : margin.top + cursor.clampedPlotY,
      pointerDown: state.pointerDown,
    });
    if (state.trail.length > 56) {
      state.trail.splice(0, state.trail.length - 56);
    }
  }

  function clearBehaviorOverlay() {
    state.cursor = null;
    state.hoverTarget = null;
    state.pointerDown = false;
    state.suppressClick = false;
    state.dragGesture = null;
    state.clickBursts = [];
    state.wheelBursts = [];
    state.trail = [];
  }

  function render() {
    state.targets = chartImpl.renderBase(layout, layers, state.data, spec);

    layers.overlayLayer.selectAll('.interaction-overlay').remove();
    const behaviorLayer = layers.overlayLayer
      .append('g')
      .attr('class', 'interaction-overlay')
      .attr('pointer-events', 'none');

    behaviorLayer
      .append('text')
      .attr('x', margin.left + 12)
      .attr('y', margin.top + 20)
      .attr('fill', '#61738b')
      .attr('font-size', 11)
      .text(spec.overlayCaption);

    if (state.trail.length > 1) {
      behaviorLayer
        .append('path')
        .attr(
          'd',
          d3
            .line()
            .x((datum) => datum.x)
            .y((datum) => datum.y)(state.trail)
        )
        .attr('fill', 'none')
        .attr('stroke', 'rgba(49, 93, 141, 0.42)')
        .attr('stroke-width', 2.25)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round');
    }

    if (state.dragGesture?.active) {
      const startX = margin.left + state.dragGesture.start[0];
      const startY = margin.top + state.dragGesture.start[1];
      const currentX = margin.left + state.dragGesture.current[0];
      const currentY = margin.top + state.dragGesture.current[1];
      const dragColor = state.dragGesture.keys.shift
        ? '#c18a00'
        : state.dragGesture.keys.space
          ? '#315d8d'
          : '#e4572e';

      behaviorLayer
        .append('path')
        .attr(
          'd',
          d3
            .line()
            .x((datum) => margin.left + datum[0])
            .y((datum) => margin.top + datum[1])(state.dragGesture.path)
        )
        .attr('fill', 'none')
        .attr('stroke', dragColor)
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-dasharray', '8 6');

      behaviorLayer
        .append('rect')
        .attr('x', Math.min(startX, currentX))
        .attr('y', Math.min(startY, currentY))
        .attr('width', Math.abs(startX - currentX))
        .attr('height', Math.abs(startY - currentY))
        .attr('fill', `${dragColor}22`)
        .attr('stroke', dragColor)
        .attr('stroke-dasharray', '6 4');
    }

    state.clickBursts.forEach((burst, index) => {
      behaviorLayer
        .append('circle')
        .attr('cx', burst.x)
        .attr('cy', burst.y)
        .attr('r', 10 + index * 4)
        .attr('fill', 'rgba(252, 198, 2, 0.12)')
        .attr('stroke', 'rgba(193, 138, 0, 0.72)');
    });

    state.wheelBursts.forEach((wheel, index) => {
      behaviorLayer
        .append('g')
        .attr('transform', `translate(${wheel.x} ${wheel.y - index * 14})`)
        .call((selection) => {
          selection
            .append('rect')
            .attr('x', -18)
            .attr('y', -13)
            .attr('width', 36)
            .attr('height', 20)
            .attr('rx', 10)
            .attr('fill', 'rgba(49, 93, 141, 0.9)');
          selection
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', 2)
            .attr('fill', '#fff')
            .attr('font-size', 11)
            .text(wheel.deltaY < 0 ? 'Zoom +' : 'Zoom -');
        });
    });

    if (state.hoverTarget) {
      chartImpl.renderHover(behaviorLayer, state.hoverTarget, layout);
    }

    if (state.cursor?.inside) {
      const cursorX = state.cursor.x;
      const cursorY = state.cursor.y;
      behaviorLayer
        .append('line')
        .attr('x1', margin.left)
        .attr('x2', margin.left + innerWidth)
        .attr('y1', cursorY)
        .attr('y2', cursorY)
        .attr('stroke', 'rgba(16, 35, 63, 0.12)')
        .attr('stroke-dasharray', '4 6');

      behaviorLayer
        .append('line')
        .attr('x1', cursorX)
        .attr('x2', cursorX)
        .attr('y1', margin.top)
        .attr('y2', margin.top + innerHeight)
        .attr('stroke', 'rgba(16, 35, 63, 0.12)')
        .attr('stroke-dasharray', '4 6');

      behaviorLayer
        .append('circle')
        .attr('cx', cursorX)
        .attr('cy', cursorY)
        .attr('r', state.pointerDown ? 8 : 6)
        .attr('fill', state.pointerDown ? '#fcc602' : '#315d8d')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
    }
  }

  function updateCursor(event) {
    const cursor = localPoint(event);
    state.cursor = cursor;
    state.hoverTarget = chartImpl.findTarget(cursor, state.targets);
    updateTrail(cursor);
    sampleCursorMove(cursor);

    if (state.hoverTarget) {
      recorder.sample(
        'target-nearby',
        {
          target: serializeTarget(state.hoverTarget),
          distancePx: roundNumber(state.hoverTarget.distance),
          keys: snapshotKeyState(state.keyState),
        },
        180,
        `target-nearby-${state.hoverTarget.targetId}`
      );
    }

    if (state.dragGesture?.active) {
      state.dragGesture.current = [cursor.clampedPlotX, cursor.clampedPlotY];
      state.dragGesture.path.push([cursor.clampedPlotX, cursor.clampedPlotY]);
      if (state.dragGesture.path.length > 48) {
        state.dragGesture.path.splice(0, state.dragGesture.path.length - 48);
      }
      recorder.sample(
        'drag-move',
        {
          plotX: roundNumber(cursor.clampedPlotX),
          plotY: roundNumber(cursor.clampedPlotY),
          keys: snapshotKeyState(state.keyState),
        },
        48,
        'drag-move'
      );
    }

    render();
  }

  function handlePointerDown(event) {
    const cursor = localPoint(event);
    if (!cursor.inside) return;
    state.cursor = cursor;
    state.hoverTarget = chartImpl.findTarget(cursor, state.targets);
    state.pointerDown = true;
    state.suppressClick = false;
    state.dragGesture = {
      active: true,
      start: [cursor.clampedPlotX, cursor.clampedPlotY],
      current: [cursor.clampedPlotX, cursor.clampedPlotY],
      path: [[cursor.clampedPlotX, cursor.clampedPlotY]],
      keys: snapshotKeyState(state.keyState),
    };

    recordCursorEvent('mouse-down', cursor, {
      button: event.button,
      hoverTarget: serializeTarget(state.hoverTarget),
    });

    emitHint('Mouse press recorded. The chart itself stays static; only your behavior trace is visualized.');
    event.preventDefault();
    render();
  }

  function handlePointerMove(event) {
    updateCursor(event);

    if (state.dragGesture?.active) {
      if (state.keyState.shift) {
        emitHint('Shift + drag is being visualized. The LLM may interpret it as a brush selection intent.');
      } else if (state.keyState.space) {
        emitHint('Space + drag is being visualized. The LLM may interpret it as a pan navigation intent.');
      } else if (state.hoverTarget) {
        emitHint(`You are moving near ${formatTargetLabel(state.hoverTarget)}. The chart stays static and only the behavior is shown.`);
      } else {
        emitHint('Drag motion is being recorded. You can use key combinations to signal the intended interaction semantics.');
      }
      return;
    }

    if (state.hoverTarget) {
      emitHint(`The cursor is near ${formatTargetLabel(state.hoverTarget)}. This is recorded as evidence that a specific target is being inspected.`);
    } else if (state.cursor?.inside) {
      emitHint('The static chart will not respond, but your mouse path, key states, and wheel actions will be shown.');
    }
  }

  function handlePointerUp(event) {
    if (!state.pointerDown) return;
    const cursor = localPoint(event);
    state.cursor = cursor;
    state.hoverTarget = chartImpl.findTarget(cursor, state.targets);
    const dragGesture = state.dragGesture;
    const travelDistance = dragGesture
      ? getDistance(
          { x: dragGesture.start[0], y: dragGesture.start[1] },
          { x: cursor.clampedPlotX, y: cursor.clampedPlotY }
        )
      : 0;

    recordCursorEvent('mouse-up', cursor, {
      button: event.button,
      travelDistance: roundNumber(travelDistance),
    });

    if (dragGesture && travelDistance >= 6) {
      state.suppressClick = true;
      recorder.push('drag-end', {
        start: {
          plotX: roundNumber(dragGesture.start[0]),
          plotY: roundNumber(dragGesture.start[1]),
        },
        end: {
          plotX: roundNumber(cursor.clampedPlotX),
          plotY: roundNumber(cursor.clampedPlotY),
        },
        travelDistance: roundNumber(travelDistance),
        keys: dragGesture.keys,
        hoverTarget: serializeTarget(state.hoverTarget),
      });
    }

    state.pointerDown = false;
    state.dragGesture = null;
    render();
  }

  function handleClick(event) {
    if (state.suppressClick) {
      state.suppressClick = false;
      return;
    }
    if (!state.cursor?.inside) return;

    const cursor = localPoint(event);
    state.cursor = cursor;
    state.hoverTarget = chartImpl.findTarget(cursor, state.targets);
    state.clickBursts.push({ x: cursor.x, y: cursor.y });
    if (state.clickBursts.length > 4) {
      state.clickBursts.splice(0, state.clickBursts.length - 4);
    }

    recordCursorEvent('click', cursor, {
      target: serializeTarget(state.hoverTarget),
    });

    if (state.hoverTarget) {
      emitHint(`The click happened near ${formatTargetLabel(state.hoverTarget)}. This may be treated as a candidate signal for selection or focus.`);
    } else {
      emitHint('A background click was recorded. It may indicate cancel, confirm, or simple positioning behavior.');
    }
    render();
  }

  function handleWheel(event) {
    const cursor = localPoint(event);
    if (!cursor.inside) return;
    state.cursor = cursor;
    state.hoverTarget = chartImpl.findTarget(cursor, state.targets);
    event.preventDefault();

    state.wheelBursts.push({
      x: cursor.x,
      y: cursor.y,
      deltaY: Number(event.deltaY || 0),
    });
    if (state.wheelBursts.length > 4) {
      state.wheelBursts.splice(0, state.wheelBursts.length - 4);
    }

    recorder.sample(
      'wheel',
      {
        plotX: roundNumber(cursor.clampedPlotX),
        plotY: roundNumber(cursor.clampedPlotY),
        deltaY: roundNumber(event.deltaY || 0),
        keys: snapshotKeyState(state.keyState),
      },
      80,
      'wheel'
    );

    emitHint(
      Number(event.deltaY || 0) < 0
        ? 'An upward wheel action was recorded. It is often interpreted as a zoom-in intent.'
        : 'A downward wheel action was recorded. It is often interpreted as a zoom-out intent.'
    );
    render();
  }

  function updateKeyState(event, active) {
    let changed = false;
    const nextState = snapshotKeyState(state.keyState);

    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      nextState.shift = active;
      changed = nextState.shift !== state.keyState.shift;
    } else if (event.code === 'Space') {
      nextState.space = active;
      changed = nextState.space !== state.keyState.space;
    } else if (event.code === 'ControlLeft' || event.code === 'ControlRight') {
      nextState.ctrl = active;
      changed = nextState.ctrl !== state.keyState.ctrl;
    } else if (event.code === 'AltLeft' || event.code === 'AltRight') {
      nextState.alt = active;
      changed = nextState.alt !== state.keyState.alt;
    } else if (event.code === 'MetaLeft' || event.code === 'MetaRight') {
      nextState.meta = active;
      changed = nextState.meta !== state.keyState.meta;
    }

    if (!changed) return;
    state.keyState = nextState;
    recorder.push(active ? 'key-down' : 'key-up', {
      key: event.code,
      keys: snapshotKeyState(state.keyState),
    });
    emitKeyMode();
    render();
  }

  frameRect.on('pointerenter', (event) => {
    updateCursor(event);
  });
  frameRect.on('pointermove', (event) => {
    handlePointerMove(event);
  });
  frameRect.on('pointerleave', () => {
    if (state.pointerDown) return;
    state.cursor = null;
    state.hoverTarget = null;
    render();
  });
  frameRect.on('pointerdown', (event) => {
    handlePointerDown(event);
  });
  frameRect.on('click', (event) => {
    handleClick(event);
  });
  frameRect.on('wheel', (event) => {
    handleWheel(event);
  });

  function handleWindowPointerMove(event) {
    if (!state.pointerDown) return;
    handlePointerMove(event);
  }

  function handleWindowPointerUp(event) {
    handlePointerUp(event);
  }

  function handleWindowKeyDown(event) {
    updateKeyState(event, true);
  }

  function handleWindowKeyUp(event) {
    updateKeyState(event, false);
  }

  window.addEventListener('pointermove', handleWindowPointerMove);
  window.addEventListener('pointerup', handleWindowPointerUp);
  window.addEventListener('keydown', handleWindowKeyDown);
  window.addEventListener('keyup', handleWindowKeyUp);

  emitHint(state.lastHint);
  emitKeyMode();

  return {
    async init() {
      state.data = await chartImpl.loadData();
      render();
      if (typeof onSummaryChange === 'function') onSummaryChange(recorder.getSummary());
    },
    recorder,
    resetScene() {
      clearBehaviorOverlay();
      render();
      emitHint(
        `The scene has been reset. Demonstrate your intent directly on the static ${spec.chartLabel}: move, pause, click, drag, key combinations, and wheel actions will only be recorded and visualized.`
      );
    },
    destroy() {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('keydown', handleWindowKeyDown);
      window.removeEventListener('keyup', handleWindowKeyUp);
      mountNode.innerHTML = '';
    },
  };
}

function setStatus(node, text, { error = false } = {}) {
  if (!node) return;
  node.textContent = text;
  node.classList.toggle('is-error', error);
}

async function requestModelList({ baseUrl, apiKey }) {
  const headers = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(`${baseUrl}/models`, {
    method: 'GET',
    headers,
    redirect: 'follow',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Load models failed (${response.status}): ${message.slice(0, 240)}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload?.data)) {
    return payload.data.map((item) => item?.id).filter(Boolean);
  }
  if (Array.isArray(payload?.models)) {
    return payload.models.map((item) => item?.id || item?.name || item).filter(Boolean);
  }
  return [];
}

async function requestGuess({ baseUrl, apiKey, model, temperature, payload }) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    redirect: 'follow',
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        {
          role: 'system',
          content:
            'You classify visualization interactions from short event traces and must respond with strict JSON only.',
        },
        {
          role: 'user',
          content: buildGuessPrompt(payload),
        },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Chat completion failed (${response.status}): ${message.slice(0, 400)}`);
  }

  const result = await response.json();
  const content = normalizeMessageContent(result?.choices?.[0]?.message?.content);
  return {
    raw: result,
    content,
    parsed: extractJsonObject(content),
  };
}

function syncModelList(node, models) {
  if (!node) return;
  node.innerHTML = models.map((model) => `<option value="${escapeHtml(model)}"></option>`).join('');
}

function createPayloadFromRecorder(recorder, spec) {
  return {
    task: 'Infer the intended interaction that a user is demonstrating on a static visualization.',
    scenario: `The chart is a static ${spec.chartLabel}. Behavior overlays visualize cursor, drag, wheel, and key activity so the user can perceive their own demonstration.`,
    chart: {
      type: spec.chartType,
    },
    events: recorder.getEvents(),
  };
}

function bindPersistence(nodes) {
  nodes.baseUrlInput?.addEventListener('change', () => {
    nodes.baseUrlInput.value = normalizeApiBaseUrl(nodes.baseUrlInput.value) || DEFAULT_API_BASE_URL;
    safeStorageSet(STORAGE_KEYS.baseUrl, nodes.baseUrlInput.value);
  });
  nodes.modelInput?.addEventListener('change', () => {
    safeStorageSet(STORAGE_KEYS.model, nodes.modelInput.value.trim());
  });
  nodes.temperatureInput?.addEventListener('change', () => {
    safeStorageSet(STORAGE_KEYS.temperature, nodes.temperatureInput.value.trim());
  });
}

function syncControls(nodes, { recorder, busy }) {
  const recording = recorder.isActive();
  if (nodes.startButton) nodes.startButton.disabled = busy || recording;
  if (nodes.stopButton) nodes.stopButton.disabled = busy || !recording;
  if (nodes.loadModelsButton) nodes.loadModelsButton.disabled = busy;
  if (nodes.guessButton) nodes.guessButton.disabled = busy || (!recorder.hasEvents() && !recording);

  if (nodes.recordingChipNode) {
    nodes.recordingChipNode.textContent = recording ? 'Recording Live' : 'Recording Idle';
    nodes.recordingChipNode.classList.toggle('is-active', recording);
  }
}

function renderShell(spec) {
  const root = document.getElementById('LibraPlayground');
  if (!root) return null;

  const tabsHtml = PAGE_VARIANTS.map((variant) => {
    const active = variant.pageId === spec.pageId ? ' is-active' : '';
    const ariaCurrent = variant.pageId === spec.pageId ? ' aria-current="page"' : '';
    return `<a class="interaction-guesser-switcher-link${active}" href="?page=${escapeHtml(
      variant.pageId
    )}"${ariaCurrent}>${escapeHtml(variant.shortTitle)}</a>`;
  }).join('');

  root.innerHTML = `
    <div class="showcase-page showcase-page--compare llm-interaction-guesser-page">
      <header class="showcase-topbar">
        <a class="showcase-brand" href="?page=home">
          <strong>Libra+</strong>
          <span>${escapeHtml(spec.pageTitle)}</span>
        </a>
        <nav class="showcase-nav" aria-label="Primary">
          <a href="?page=home">Home</a>
          <a href="?page=gallery">Gallery</a>
          <a href="?page=${escapeHtml(spec.pageId)}" aria-current="page">${escapeHtml(
            spec.pageTitle
          )}</a>
        </nav>
      </header>

      <div class="interaction-guesser-switcher" aria-label="Chart variants">
        ${tabsHtml}
      </div>

      <section class="compare-grid">
        <article class="compare-panel llm-interaction-guesser-panel llm-interaction-guesser-panel-main">
          <div class="compare-panel-head">
            <h2 class="compare-panel-title">Interaction Lab</h2>
          </div>

          <div class="compare-panel-section compare-panel-section--stage">
            <div id="LlmInteractionGuesserMount" class="compare-panel-stage interaction-guesser-stage"></div>
            <p id="LlmInteractionGuesserHint" class="compare-panel-status">
              This is a static ${escapeHtml(spec.chartLabel)}. Demonstrate your interaction intent with mouse and keyboard behavior, and the system will visualize the trace.
            </p>
          </div>

          <div class="compare-panel-section interaction-guesser-section">
            <div class="interaction-guesser-mode-row">
              <span id="LlmInteractionGuesserShiftChip" class="interaction-guesser-chip">Shift</span>
              <span id="LlmInteractionGuesserSpaceChip" class="interaction-guesser-chip">Space</span>
              <span id="LlmInteractionGuesserCtrlChip" class="interaction-guesser-chip">Ctrl</span>
              <span id="LlmInteractionGuesserAltChip" class="interaction-guesser-chip">Alt</span>
              <span id="LlmInteractionGuesserMetaChip" class="interaction-guesser-chip">Meta</span>
              <span id="LlmInteractionGuesserRecordingChip" class="interaction-guesser-chip interaction-guesser-chip-live">Recording Idle</span>
            </div>

            <div class="interaction-guesser-form-grid">
              <label class="interaction-guesser-field">
                <span>API Base URL</span>
                <input id="LlmInteractionGuesserBaseUrl" class="interaction-guesser-input" type="text" value="${escapeHtml(
                  safeStorageGet(STORAGE_KEYS.baseUrl, DEFAULT_API_BASE_URL)
                )}" placeholder="https://api.kksj.org/v1">
              </label>

              <label class="interaction-guesser-field">
                <span>Model</span>
                <input id="LlmInteractionGuesserModel" class="interaction-guesser-input" type="text" list="LlmInteractionGuesserModelList" value="${escapeHtml(
                  safeStorageGet(STORAGE_KEYS.model, DEFAULT_MODEL_NAME)
                )}" placeholder="gpt-4o-mini">
                <datalist id="LlmInteractionGuesserModelList"></datalist>
              </label>

              <label class="interaction-guesser-field">
                <span>Temperature</span>
                <input id="LlmInteractionGuesserTemperature" class="interaction-guesser-input" type="number" min="0" max="1" step="0.1" value="${escapeHtml(
                  safeStorageGet(STORAGE_KEYS.temperature, '0.2')
                )}">
              </label>
            </div>

            <div class="interaction-guesser-actions">
              <button id="LlmInteractionGuesserLoadModels" class="tutorial-action-button tutorial-action-button-ghost" type="button">Load Models</button>
              <button id="LlmInteractionGuesserStart" class="tutorial-action-button" type="button">Start Recording</button>
              <button id="LlmInteractionGuesserStop" class="tutorial-action-button tutorial-action-button-ghost" type="button">Stop</button>
              <button id="LlmInteractionGuesserClear" class="tutorial-action-button tutorial-action-button-ghost" type="button">Clear</button>
              <button id="LlmInteractionGuesserGuess" class="tutorial-action-button" type="button">Ask LLM to Guess</button>
            </div>

            <p id="LlmInteractionGuesserApiStatus" class="compare-panel-status">
              This page sends mouse and keyboard demonstrations from a static ${escapeHtml(
                spec.chartLabel
              )} to the LLM to infer the interaction you want to add, using a locally hidden key by default.
            </p>
          </div>

          <div class="compare-panel-section interaction-guesser-section">
            <section class="interaction-guesser-card">
              <div class="interaction-guesser-card-head">
                <strong>Recorded Summary</strong>
                <span>Local only, not sent to LLM</span>
              </div>
              <pre id="LlmInteractionGuesserSummary" class="interaction-guesser-pre">${escapeHtml(
                JSON.stringify(buildDefaultSummary(spec.chartLabel), null, 2)
              )}</pre>
            </section>
          </div>
        </article>

        <article class="compare-panel llm-interaction-guesser-panel">
          <div class="compare-panel-head">
            <h2 class="compare-panel-title">LLM I/O</h2>
          </div>

            <div class="compare-panel-section interaction-guesser-section interaction-guesser-io-section">
              <section class="interaction-guesser-card interaction-guesser-card-input">
              <div class="interaction-guesser-card-head">
                <strong>Input to LLM</strong>
                <span>Request body preview</span>
              </div>
                <pre id="LlmInteractionGuesserInput" class="interaction-guesser-pre interaction-guesser-pre-input">${escapeHtml(
                JSON.stringify(buildDefaultInputPreview(), null, 2)
              )}</pre>
            </section>

              <section class="interaction-guesser-card interaction-guesser-card-result">
              <div class="interaction-guesser-card-head">
                <strong>LLM Result</strong>
                <span>Parsed JSON if available</span>
              </div>
                <pre id="LlmInteractionGuesserResult" class="interaction-guesser-pre interaction-guesser-pre-result">${escapeHtml(
                JSON.stringify(buildDefaultResult(), null, 2)
              )}</pre>
            </section>
          </div>
        </article>
      </section>
    </div>
  `;

  return {
    mountNode: document.getElementById('LlmInteractionGuesserMount'),
    hintNode: document.getElementById('LlmInteractionGuesserHint'),
    baseUrlInput: document.getElementById('LlmInteractionGuesserBaseUrl'),
    modelInput: document.getElementById('LlmInteractionGuesserModel'),
    temperatureInput: document.getElementById('LlmInteractionGuesserTemperature'),
    modelListNode: document.getElementById('LlmInteractionGuesserModelList'),
    loadModelsButton: document.getElementById('LlmInteractionGuesserLoadModels'),
    startButton: document.getElementById('LlmInteractionGuesserStart'),
    stopButton: document.getElementById('LlmInteractionGuesserStop'),
    clearButton: document.getElementById('LlmInteractionGuesserClear'),
    guessButton: document.getElementById('LlmInteractionGuesserGuess'),
    apiStatusNode: document.getElementById('LlmInteractionGuesserApiStatus'),
    summaryNode: document.getElementById('LlmInteractionGuesserSummary'),
    inputNode: document.getElementById('LlmInteractionGuesserInput'),
    resultNode: document.getElementById('LlmInteractionGuesserResult'),
    shiftChipNode: document.getElementById('LlmInteractionGuesserShiftChip'),
    spaceChipNode: document.getElementById('LlmInteractionGuesserSpaceChip'),
    ctrlChipNode: document.getElementById('LlmInteractionGuesserCtrlChip'),
    altChipNode: document.getElementById('LlmInteractionGuesserAltChip'),
    metaChipNode: document.getElementById('LlmInteractionGuesserMetaChip'),
    recordingChipNode: document.getElementById('LlmInteractionGuesserRecordingChip'),
  };
}

export function createLlmInteractionGuesserPage({ pageId, pageTitle, chartType }) {
  const spec = PAGE_VARIANTS.find((variant) => variant.pageId === pageId) || {
    pageId,
    pageTitle,
    shortTitle: pageTitle,
    chartType,
    chartLabel: chartType,
    ariaLabel: `Static ${chartType} chart for interaction intention demonstration`,
    axisXLabel: 'X',
    axisYLabel: 'Y',
    overlayCaption: `Static ${chartType} chart: visualizing demonstrated mouse + keyboard behavior only`,
  };

  let pageRuntime = null;

  return async function initLlmInteractionGuesserPage() {
    if (pageRuntime?.destroy) {
      pageRuntime.destroy();
    }

    const nodes = renderShell(spec);
    if (!nodes) return;

    let runtimeState = null;
    const scene = createStaticChartWorkbench(nodes.mountNode, {
      spec,
      onHintChange: (text) => setStatus(nodes.hintNode, text),
      onSummaryChange: (summary) => {
        if (nodes.summaryNode) {
          nodes.summaryNode.textContent = JSON.stringify(summary, null, 2);
        }
        if (runtimeState) {
          syncControls(nodes, { recorder: scene.recorder, busy: runtimeState.busy });
        }
      },
      onKeyModeChange: (keyState) => {
        if (nodes.shiftChipNode) nodes.shiftChipNode.classList.toggle('is-active', !!keyState.shift);
        if (nodes.spaceChipNode) nodes.spaceChipNode.classList.toggle('is-active', !!keyState.space);
        if (nodes.ctrlChipNode) nodes.ctrlChipNode.classList.toggle('is-active', !!keyState.ctrl);
        if (nodes.altChipNode) nodes.altChipNode.classList.toggle('is-active', !!keyState.alt);
        if (nodes.metaChipNode) nodes.metaChipNode.classList.toggle('is-active', !!keyState.meta);
      },
    });

    runtimeState = {
      busy: false,
      destroy() {
        scene.destroy();
      },
    };
    pageRuntime = runtimeState;

    await scene.init();
    bindPersistence(nodes);
    syncControls(nodes, { recorder: scene.recorder, busy: runtimeState.busy });

    function readApiConfig() {
      return {
        baseUrl: normalizeApiBaseUrl(nodes.baseUrlInput?.value) || DEFAULT_API_BASE_URL,
        apiKey: String(DEFAULT_HIDDEN_API_KEY || '').trim(),
        model: String(nodes.modelInput?.value || '').trim(),
        temperature: clamp(Number(nodes.temperatureInput?.value || 0.2), 0, 1),
      };
    }

    async function withBusyStatus(task) {
      runtimeState.busy = true;
      syncControls(nodes, { recorder: scene.recorder, busy: runtimeState.busy });
      try {
        await task();
      } finally {
        runtimeState.busy = false;
        syncControls(nodes, { recorder: scene.recorder, busy: runtimeState.busy });
      }
    }

    nodes.loadModelsButton?.addEventListener('click', async () => {
      await withBusyStatus(async () => {
        const config = readApiConfig();
        nodes.baseUrlInput.value = config.baseUrl;
        safeStorageSet(STORAGE_KEYS.baseUrl, config.baseUrl);

        if (!config.apiKey) {
          setStatus(nodes.apiStatusNode, 'No locally hidden API key is configured.', { error: true });
          return;
        }

        setStatus(nodes.apiStatusNode, 'Loading model list...');
        const models = await requestModelList(config);
        syncModelList(nodes.modelListNode, models);

        if (models.length && !config.model) {
          nodes.modelInput.value = models[0];
          safeStorageSet(STORAGE_KEYS.model, models[0]);
        }

        setStatus(
          nodes.apiStatusNode,
          models.length
            ? `Loaded ${models.length} models.`
            : 'The API responded, but no model list was recognized. You can still enter a model name manually.'
        );
      }).catch((error) => {
        setStatus(
          nodes.apiStatusNode,
          `${error.message}. If this site does not allow CORS, you can still keep a manual model name and try chat/completions directly.`,
          { error: true }
        );
      });
    });

    nodes.startButton?.addEventListener('click', () => {
      scene.resetScene();
      scene.recorder.start();
      if (nodes.inputNode) {
        nodes.inputNode.textContent = JSON.stringify(buildDefaultInputPreview(), null, 2);
      }
      if (nodes.resultNode) {
        nodes.resultNode.textContent = JSON.stringify(buildDefaultResult(), null, 2);
      }
      setStatus(
        nodes.apiStatusNode,
        `Recording started. Demonstrate the interaction intent you want the system to understand on the static ${spec.chartLabel}.`
      );
      syncControls(nodes, { recorder: scene.recorder, busy: runtimeState.busy });
    });

    nodes.stopButton?.addEventListener('click', () => {
      scene.recorder.stop();
      setStatus(nodes.apiStatusNode, 'Recording stopped. You can now ask the LLM to guess the demonstrated intent.');
      syncControls(nodes, { recorder: scene.recorder, busy: runtimeState.busy });
    });

    nodes.clearButton?.addEventListener('click', () => {
      scene.recorder.clear();
      scene.resetScene();
      if (nodes.summaryNode) {
        nodes.summaryNode.textContent = JSON.stringify(buildDefaultSummary(spec.chartLabel), null, 2);
      }
      if (nodes.inputNode) {
        nodes.inputNode.textContent = JSON.stringify(buildDefaultInputPreview(), null, 2);
      }
      if (nodes.resultNode) {
        nodes.resultNode.textContent = JSON.stringify(buildDefaultResult(), null, 2);
      }
      setStatus(nodes.apiStatusNode, 'The recording and view state have been cleared.');
      syncControls(nodes, { recorder: scene.recorder, busy: runtimeState.busy });
    });

    nodes.guessButton?.addEventListener('click', async () => {
      await withBusyStatus(async () => {
        const config = readApiConfig();
        nodes.baseUrlInput.value = config.baseUrl;
        safeStorageSet(STORAGE_KEYS.baseUrl, config.baseUrl);
        safeStorageSet(STORAGE_KEYS.model, config.model);
        safeStorageSet(STORAGE_KEYS.temperature, config.temperature);

        if (!config.apiKey) {
          setStatus(nodes.apiStatusNode, 'No locally hidden API key is configured.', { error: true });
          return;
        }
        if (!config.model) {
          setStatus(nodes.apiStatusNode, 'Please enter a model name first, or click Load Models.', { error: true });
          return;
        }
        if (scene.recorder.isActive()) {
          scene.recorder.stop();
        }
        if (!scene.recorder.hasEvents()) {
          setStatus(
            nodes.apiStatusNode,
            `No events have been recorded yet. Click Start Recording first, then demonstrate your behavior on the static ${spec.chartLabel}.`,
            { error: true }
          );
          return;
        }

        const payload = createPayloadFromRecorder(scene.recorder, spec);
        if (nodes.inputNode) {
          nodes.inputNode.textContent = JSON.stringify(
            buildLlmRequestPreview({
              baseUrl: config.baseUrl,
              model: config.model,
              temperature: config.temperature,
              payload,
            }),
            null,
            2
          );
        }
        if (nodes.resultNode) {
          nodes.resultNode.textContent = JSON.stringify(
            {
              status: 'requesting',
              model: config.model,
              note: 'Requesting the model. Please wait...',
            },
            null,
            2
          );
        }

        setStatus(nodes.apiStatusNode, `Sending request to ${config.baseUrl}/chat/completions...`);
        const result = await requestGuess({
          ...config,
          payload,
        });

        if (nodes.resultNode) {
          nodes.resultNode.textContent = JSON.stringify(
            result.parsed || { rawContent: result.content || '(empty response)' },
            null,
            2
          );
        }

        setStatus(
          nodes.apiStatusNode,
          result.parsed
            ? `The model returned a structured result. Primary label: ${result.parsed.label || 'unknown'}.`
            : 'The model returned a response, but it could not be parsed as JSON. Raw text is shown instead.'
        );
      }).catch((error) => {
        if (nodes.resultNode) {
          nodes.resultNode.textContent = JSON.stringify(
            {
              status: 'error',
              message: error.message,
            },
            null,
            2
          );
        }
        setStatus(nodes.apiStatusNode, error.message, { error: true });
      });
    });

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };
}
