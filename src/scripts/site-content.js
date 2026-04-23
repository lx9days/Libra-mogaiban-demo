const pagesContext = require.context('../pages', true, /\.js$/);

const EXCLUDED_PAGES = new Set(['home', 'gallery', 'gallery2', 'user']);

export const NEW_DSL_PAGES = new Set([
  'DimpVis',
  'Dust&Magnet',
  'pan&zoom',
  'group-selection-lens',
  'group-selection',
  'edge-lens',
  'lens-treemap',
  'lens-zoom',
  'semantic-geomap',
  'point-selection',
  'point-selection-link',
  'teaser-Matrix',
  'gesture-matrix',
  'SimpleParallelCoordinate',
  'ParallelCoordinate',
  'teaser-SimpleSPLOM',
  'SPLOM',
  'categorical-beeswarm',
  'SimpleCategoricalPlots',
  'helper-line',
  'helper-line-intersection',
  'axis-selection',
  'brush-zoom',
  'brush-zoom1',
  'brush-move'
]);

const FEATURED_ORDER = [
  'edge-lens',
  'DimpVis',
  'Dust&Magnet',
  'group-selection',
  'semantic-geomap',
  'treemap-semantic',
  'categorical-axis',
  'helper-line',
];

export const CATEGORY_ORDER = [
  'Selection',
  'Rearrangement',
  'Navigation',
  'Visual Aid',
  'Composite',
  'Prototype',
];

export const TRIGGER_ORDER = ['Hover', 'Click', 'Brush', 'Drag', 'Pan', 'Zoom'];
export const THEME_ORDER = [
  'Compose',
  'Reuse',
  'Conflict',
  'Linked Views',
  'Semantic Zoom',
  'Lens',
  'Reorder',
  'Guidance',
  'Graph',
  'Map',
];

const PAGE_META = {
  'edge-lens': {
    title: 'Edge Lens',
    category: 'Visual Aid',
    triggers: ['Hover'],
    themes: ['Lens', 'Graph', 'Compose'],
    description:
      'A neighboring-edge highlighting lens that locally separates dense graph connections without abandoning the original layout.',
    preview: './public/showcase/previews/edge-lens.gif',
    tone: 'gold',
    featured: true,
  },
  DimpVis: {
    title: 'DimpVis',
    category: 'Composite',
    triggers: ['Hover', 'Drag'],
    themes: ['Compose', 'Linked Views'],
    description:
      'A coordinated direct-manipulation view in which dragging one trajectory propagates interpolated updates across the full scatterplot state.',
    preview: './public/showcase/previews/dimpvis.gif',
    tone: 'navy',
    featured: true,
  },
  'Dust&Magnet': {
    title: 'Dust & Magnet',
    category: 'Composite',
    triggers: ['Click', 'Drag'],
    themes: ['Compose', 'Reuse'],
    description:
      'An extended dust-and-magnet interaction that turns layout forces into reusable interaction building blocks.',
    preview: './public/showcase/previews/dust-magnet.gif',
    tone: 'ink',
    featured: true,
  },
  'group-selection': {
    title: 'Group Selection',
    category: 'Selection',
    triggers: ['Brush'],
    themes: ['Compose', 'Linked Views'],
    description:
      'A brush-driven selection demo that foregrounds declarative highlighting and shared predicates across layers.',
    preview: './public/showcase/previews/brush-link.gif',
    tone: 'gold',
    featured: true,
  },
  'group-selection-lens': {
    title: 'Group Selection + Lens',
    category: 'Composite',
    triggers: ['Brush', 'Hover'],
    themes: ['Compose', 'Lens'],
    description:
      'Combines region selection with transient visual aid feedback so selection and local inspection can coexist in one view.',
    preview: './public/showcase/previews/excentric-labeling.gif',
    tone: 'navy',
  },
  'semantic-geomap': {
    title: 'Semantic GeoMap',
    category: 'Navigation',
    triggers: ['Pan', 'Zoom'],
    themes: ['Semantic Zoom', 'Map', 'Compose'],
    description:
      'A map navigation demo that pairs panning with semantic zoom so additional structure appears as scale changes.',
    preview: './public/showcase/previews/geomap-semantic.gif',
    tone: 'navy',
    featured: true,
  },
  'treemap-semantic': {
    title: 'Treemap Semantic Zoom',
    category: 'Navigation',
    triggers: ['Pan', 'Zoom'],
    themes: ['Semantic Zoom', 'Compose'],
    description:
      'A semantic zoom treemap that changes detail level with scale rather than relying on a single static rendering.',
    preview: './public/showcase/previews/treemap-semantic.gif',
    tone: 'ink',
    featured: true,
  },
  'treemap-semanticZoom': {
    title: 'Treemap Semantic Zoom Draft',
    category: 'Navigation',
    triggers: ['Zoom'],
    themes: ['Semantic Zoom', 'Reuse'],
    description:
      'An alternate treemap semantic zoom prototype exploring progressive disclosure and scale-dependent detail.',
    preview: './public/showcase/previews/treemap-semantic.gif',
    tone: 'ink',
  },
  'helper-line': {
    title: 'Helper Line',
    category: 'Visual Aid',
    triggers: ['Hover'],
    themes: ['Guidance', 'Reuse'],
    description:
      'A precision-reading aid that overlays a helper line to reveal values under the cursor without disturbing the base chart.',
    preview: './public/showcase/previews/helper-line.gif',
    tone: 'gold',
    featured: true,
  },
  'helper-line-intersection': {
    title: 'Helper Line Intersection',
    category: 'Visual Aid',
    triggers: ['Hover'],
    themes: ['Guidance', 'Compose'],
    description:
      'An advanced helper line that displays intersections and values across multiple stacked areas during hover.',
    preview: './public/showcase/previews/helper-line.gif',
    tone: 'navy',
    featured: false,
  },
  'lens-hover': {
    title: 'Lens Hover',
    category: 'Visual Aid',
    triggers: ['Hover'],
    themes: ['Lens', 'Guidance'],
    description:
      'A hover-activated inspection lens for revealing local structure and labels around dense clusters.',
    preview: './public/showcase/previews/excentric-labeling.gif',
    tone: 'navy',
  },
  'lens-zoom': {
    title: 'Lens Zoom',
    category: 'Composite',
    triggers: ['Hover', 'Zoom'],
    themes: ['Lens', 'Compose'],
    description:
      'Pairs local lens feedback with zoom to compare transient magnification against global navigation.',
    preview: './public/showcase/previews/regression-lens.gif',
    tone: 'navy',
  },
  'lens-treemap': {
    title: 'Treemap Lens',
    category: 'Visual Aid',
    triggers: ['Hover'],
    themes: ['Lens', 'Guidance'],
    description:
      'An excentric-style lens adapted to treemaps for reading labels and local aggregates inside dense rectangular layouts.',
    preview: './public/showcase/previews/treemap-lens.gif',
    tone: 'ink',
  },
  lens: {
    title: 'Lens',
    category: 'Visual Aid',
    triggers: ['Hover'],
    themes: ['Lens', 'Reuse'],
    description:
      'A base lens prototype that isolates the visual-aid instrument from any one chart type.',
    preview: './public/showcase/previews/excentric-labeling.gif',
    tone: 'gold',
  },
  'brush-move': {
    title: 'Brush Move',
    category: 'Composite',
    triggers: ['Brush', 'Drag'],
    themes: ['Compose', 'Conflict'],
    description:
      'A movable brushing interaction built by composing a base selection instrument with drag-based rearrangement.',
    preview: './public/showcase/previews/brush-link.gif',
    tone: 'gold',
  },
  'brush-zoom': {
    title: 'Brush Zoom',
    category: 'Composite',
    triggers: ['Brush', 'Zoom'],
    themes: ['Compose', 'Conflict'],
    description:
      'Extends brushing with zoom-aware feedback so transient regions can be resized and reused during analysis.',
    preview: './public/showcase/previews/brush-link.gif',
    tone: 'gold',
  },
  'brush-zoom1': {
    title: 'Brush Zoom 1',
    category: 'Composite',
    triggers: ['Brush', 'Zoom'],
    themes: ['Compose', 'Conflict'],
    description:
      'Extends brushing with zoom-aware feedback (updated interaction queue handling for transient layers).',
    preview: './public/showcase/previews/brush-link.gif',
    tone: 'navy',
  },
  'categorical-axis': {
    title: 'Categorical Axis Reorder',
    category: 'Rearrangement',
    triggers: ['Drag'],
    themes: ['Reorder', 'Reuse'],
    description:
      'A reordering template adapted to categorical axes, emphasizing how one instrument can transfer across visual forms.',
    preview: './public/showcase/previews/matrix-reorder.gif',
    tone: 'ink',
    featured: true,
  },
  'categorical-beeswarm': {
    title: 'Categorical Beeswarm',
    category: 'Composite',
    triggers: ['Brush', 'Drag'],
    themes: ['Reorder', 'Compose'],
    description:
      'A beeswarm experiment that combines categorical reordering with brush-based selection in the same view.',
    preview: './public/showcase/previews/matrix-reorder.gif',
    tone: 'gold',
  },
  'gesture-matrix': {
    title: 'Gesture Matrix',
    category: 'Rearrangement',
    triggers: ['Drag'],
    themes: ['Reorder', 'Conflict'],
    description:
      'Explores directional gesture disambiguation for matrix reordering, including trigger interpretation along different axes.',
    preview: './public/showcase/previews/matrix-reorder.gif',
    tone: 'ink',
  },
  'gesture-scatter': {
    title: 'Gesture Scatter',
    category: 'Composite',
    triggers: ['Drag'],
    themes: ['Conflict', 'Compose'],
    description:
      'A scatterplot playground for testing gesture-driven trigger routing and competition between overlapping instruments.',
    tone: 'navy',
  },
  SPLOM: {
    title: 'Scatterplot Matrix',
    category: 'Composite',
    triggers: ['Brush', 'Drag'],
    themes: ['Compose', 'Linked Views', 'Reorder'],
    description:
      'A SPLOM that demonstrates coordinated selection and axis-level rearrangement across many small multiples.',
    tone: 'ink',
  },
  'teaser-SimpleSPLOM': {
    title: 'Simple SPLOM',
    category: 'Composite',
    triggers: ['Brush'],
    themes: ['Linked Views', 'Reuse'],
    description:
      'A lighter SPLOM prototype used to validate linked brushing across repeated views.',
    tone: 'navy',
  },
  'teaser-Matrix': {
    title: 'Matrix Teaser',
    category: 'Rearrangement',
    triggers: ['Drag'],
    themes: ['Reorder', 'Reuse'],
    description:
      'A compact matrix reordering teaser that focuses on the reusable instrument template itself.',
    preview: './public/showcase/previews/matrix-reorder.gif',
    tone: 'ink',
  },
  ParallelCoordinate: {
    title: 'Parallel Coordinates',
    category: 'Rearrangement',
    triggers: ['Drag'],
    themes: ['Reorder', 'Reuse'],
    description:
      'A parallel coordinates view using the same reorder semantics that also appear in matrices and SPLOMs.',
    preview: './public/showcase/previews/parallel-reorder.gif',
    tone: 'navy',
  },
  SimpleParallelCoordinate: {
    title: 'Simple Parallel Coordinates',
    category: 'Rearrangement',
    triggers: ['Drag'],
    themes: ['Reorder', 'Reuse'],
    description:
      'A simplified parallel coordinates prototype for isolating axis rearrangement behavior.',
    preview: './public/showcase/previews/parallel-reorder.gif',
    tone: 'navy',
  },
  'point-selection': {
    title: 'Point Selection',
    category: 'Selection',
    triggers: ['Click', 'Hover'],
    themes: ['Reuse'],
    description:
      'A compact point selection demo that isolates low-level picking from chart-specific feedback.',
    tone: 'gold',
  },
  'point-selection-link': {
    title: 'Linked Point Selection',
    category: 'Selection',
    triggers: ['Click'],
    themes: ['Linked Views', 'Compose'],
    description:
      'Publishes selected entities across linked layers so multiple views can subscribe to one interaction state.',
    tone: 'navy',
  },
  'axis-selection': {
    title: 'Axis Selection',
    category: 'Selection',
    triggers: ['Brush'],
    themes: ['Compose', 'Linked Views'],
    description:
      'A brushing selection interaction along axes that highlights points corresponding to the selected range.',
    preview: './public/showcase/previews/brush-link.gif',
    tone: 'gold',
    featured: false,
  },
  'pan&zoom': {
    title: 'Pan & Zoom',
    category: 'Navigation',
    triggers: ['Pan', 'Zoom'],
    themes: ['Reuse'],
    description:
      'A navigation baseline for testing continuous viewport updates and scale transformations.',
    tone: 'navy',
  },
  graph: {
    title: 'Graph Playground',
    category: 'Prototype',
    triggers: ['Hover', 'Drag'],
    themes: ['Graph', 'Compose'],
    description:
      'A node-link playground for iterating on graph-oriented interaction and layered rendering.',
    tone: 'ink',
  },
  'bar-chart': {
    title: 'Bar Chart',
    category: 'Prototype',
    triggers: ['Hover'],
    themes: ['Reuse'],
    description:
      'A compact chart sandbox used to test interaction logic against a simpler visual baseline.',
    tone: 'gold',
  },
  'SimpleCategoricalPlots': {
    title: 'Simple Categorical Plots',
    category: 'Prototype',
    triggers: ['Hover'],
    themes: ['Reuse'],
    description:
      'A categorical prototype used for validating interaction semantics on simpler mark structures.',
    tone: 'gold',
  },
  'categorical plots': {
    title: 'Categorical Plots',
    category: 'Prototype',
    triggers: ['Hover'],
    themes: ['Reuse'],
    description:
      'An exploratory categorical plotting playground for rapid interaction experiments.',
    tone: 'ink',
  },
};

export const HOME_TTF_PANELS = [
  {
    title: 'Trigger',
    text:
      'Map low-level event sequences like hover, brush, drag, pan, or zoom to the semantic intent behind an interaction.',
  },
  {
    title: 'Target',
    text:
      'Constrain the scope of an interaction to the right graphical layer so views stay modular and conflicts stay explicit.',
  },
  {
    title: 'Feedback',
    text:
      'Bind redraw functions, context, feedforward, and services into a controlled response instead of hard-wired callbacks.',
  },
  {
    title: 'Composition',
    text:
      'Combine atomic instruments with priorities, modifiers, and brokered coordination to author richer behaviors incrementally.',
  },
];

export const HOME_STORY_SECTIONS = [
  {
    eyebrow: 'Architecture',
    title: 'A complete interaction model instead of ad hoc event code.',
    text:
      'Libra+ extends the layered interaction architecture of Libra with a more explicit semantic structure. Rather than naming behavior after raw input alone, it treats each interactive technique as a composition of trigger, target, and feedback.',
    image: './public/showcase/figures/arch.png',
  },
  {
    eyebrow: 'Separation',
    title: 'Feedback lives in its own layers, not inside the marks it manipulates.',
    text:
      'Selection overlays, transient guides, and semantic hints remain structurally separate from the base visualization. That separation makes it easier to swap feedback strategies, coordinate linked views, and keep interactions reusable.',
    image: './public/showcase/figures/separation.png',
  },
  {
    eyebrow: 'Reuse',
    title: 'One instrument template can travel across matrices, SPLOMs, maps, and graphs.',
    text:
      'Parameterized instruments turn repeated interaction logic into reusable assets. Reordering, brushing, panning, zooming, and lens behaviors can be specialized through context and redraw functions rather than rewritten from scratch.',
    image: './public/showcase/figures/reuse.png',
  },
];

export const HOME_TEMPLATE_LINES = [
  'Instrument: reorder',
  'Trigger: Drag',
  'Target: xHeaderLayer / yHeaderLayer',
  'Feedback.redrawFunc: drawMatrix | drawSPLOM',
  'Feedback.context: names | fields',
  'Feedback.service: reorderDirection = x | y',
];

function humanizePageId(pageId) {
  return String(pageId || '')
    .replace(/&/g, ' & ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pageIdFromKey(key) {
  const cleaned = key.replace(/^\.\//, '').replace(/\.js$/, '');
  const parts = cleaned.split('/');
  if (!parts.length || parts[0] === '_shared') return null;
  if (parts.length === 1) return parts[0];

  const [folder, file] = parts;
  if (file === folder || file === 'index' || file === '1') return folder;
  return null;
}

function inferCategory(pageId) {
  const id = String(pageId || '').toLowerCase();
  if (id.includes('lens') || id.includes('helper')) return 'Visual Aid';
  if (id.includes('brush') || id.includes('selection')) return 'Selection';
  if (id.includes('pan') || id.includes('zoom') || id.includes('semantic')) return 'Navigation';
  if (
    id.includes('reorder') ||
    id.includes('parallel') ||
    id.includes('matrix') ||
    id.includes('categorical-axis')
  ) {
    return 'Rearrangement';
  }
  return 'Prototype';
}

function inferTriggers(pageId, category) {
  const id = String(pageId || '').toLowerCase();
  if (category === 'Navigation') {
    return id.includes('zoom') && !id.includes('pan') ? ['Zoom'] : ['Pan', 'Zoom'];
  }
  if (category === 'Selection') {
    if (id.includes('point') || id.includes('click')) return ['Click'];
    return ['Brush'];
  }
  if (category === 'Rearrangement') return ['Drag'];
  if (category === 'Visual Aid') return ['Hover'];
  if (id.includes('drag')) return ['Drag'];
  return ['Hover'];
}

function inferThemes(pageId, category) {
  const id = String(pageId || '').toLowerCase();
  const themes = [];

  if (category === 'Navigation' || id.includes('semantic')) themes.push('Semantic Zoom');
  if (category === 'Visual Aid' || id.includes('lens')) themes.push('Lens');
  if (category === 'Rearrangement' || id.includes('matrix') || id.includes('parallel')) {
    themes.push('Reorder');
  }
  if (id.includes('link') || id.includes('splom')) themes.push('Linked Views');
  if (id.includes('graph') || id.includes('edge')) themes.push('Graph');
  if (id.includes('map')) themes.push('Map');
  if (themes.length === 0) themes.push('Reuse');
  return themes;
}

function fallbackDescription(pageId, category, triggers) {
  const title = humanizePageId(pageId);
  const triggerText = triggers.join(' / ').toLowerCase();

  if (category === 'Selection') {
    return `${title} focuses on how ${triggerText} events publish selection state and targeted highlighting.`;
  }
  if (category === 'Rearrangement') {
    return `${title} explores structural updates driven by ${triggerText} interaction and reusable redraw logic.`;
  }
  if (category === 'Navigation') {
    return `${title} studies view navigation through ${triggerText} operations and scale-aware feedback.`;
  }
  if (category === 'Visual Aid') {
    return `${title} adds transient guidance around ${triggerText} input without rewriting the underlying chart.`;
  }
  return `${title} is an exploratory interaction prototype for testing compositional behavior in Libra+.`;
}

let catalogCache = null;

export function getShowcaseCatalog() {
  if (catalogCache) return catalogCache;

  const ids = Array.from(
    new Set(
      pagesContext
        .keys()
        .map((key) => pageIdFromKey(key))
        .filter(Boolean)
        .filter((pageId) => !EXCLUDED_PAGES.has(pageId))
    )
  );

  catalogCache = ids
    .map((id) => {
      const meta = PAGE_META[id] || {};
      const category = meta.category || inferCategory(id);
      const triggers = meta.triggers || inferTriggers(id, category);
      const themes = meta.themes || inferThemes(id, category);

      return {
        id,
        title: meta.title || humanizePageId(id),
        category,
        triggers,
        themes,
        description: meta.description || fallbackDescription(id, category, triggers),
        preview: meta.preview || '',
        tone: meta.tone || 'gold',
        featured: meta.featured || FEATURED_ORDER.includes(id),
        isNewDsl: NEW_DSL_PAGES.has(id),
      };
    })
    .sort((left, right) => {
      const leftRank = FEATURED_ORDER.indexOf(left.id);
      const rightRank = FEATURED_ORDER.indexOf(right.id);

      if (leftRank !== -1 && rightRank !== -1) return leftRank - rightRank;
      if (leftRank !== -1) return -1;
      if (rightRank !== -1) return 1;
      return left.title.localeCompare(right.title);
    });

  return catalogCache;
}

export function getFeaturedDemos(limit = FEATURED_ORDER.length) {
  const byId = new Map(getShowcaseCatalog().map((demo) => [demo.id, demo]));
  return FEATURED_ORDER.map((id) => byId.get(id)).filter(Boolean).slice(0, limit);
}

export function getShowcaseStats() {
  return [
    {
      value: '3',
      label: 'TTF Axes',
      detail: 'Trigger, target, feedback',
    },
    {
      value: '4',
      label: 'Atomic Families',
      detail: 'Selection, rearrangement, navigation, visual aids',
    },
    {
      value: '3',
      label: 'Conflict Strategies',
      detail: 'Modifiers, priorities, pattern analysis',
    },
    {
      value: String(getShowcaseCatalog().length),
      label: 'Runnable Demos',
      detail: 'Live pages wired into the current webpack playground',
    },
  ];
}
