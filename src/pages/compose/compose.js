function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const COMPOSE_EXAMPLES = [
  {
    id: 'user',
    title: 'Dust & Magnet Composition',
    category: 'Conflict Resolution Study',
    tone: 'navy',
    meta: 'Compose atomic interactions into a coordinated system',
    description:
      'Start from single Dust & Magnet interaction templates, then use conflict-resolution properties to build a coherent multi-interaction workflow.',
    tags: ['priority', 'modifierKey', 'stopPropagation', 'syntheticEvent'],
  },
];

function renderComposeCard(example) {
  const tags = example.tags.map((tag) => `<span class="demo-tag">${escapeHtml(tag)}</span>`);

  return `
    <article class="demo-card">
      <div class="demo-preview" data-tone="${escapeHtml(example.tone)}">
        <div class="demo-preview-fallback">
          <div>
            <strong>${escapeHtml(example.title)}</strong>
            <span>${escapeHtml(example.category)}</span>
          </div>
        </div>
      </div>
      <div class="demo-card-body">
        <div class="demo-card-heading">
          <div>
            <h3 class="demo-card-title">${escapeHtml(example.title)}</h3>
            <p class="demo-card-meta">${escapeHtml(example.meta)}</p>
          </div>
        </div>
        <p class="demo-card-description">${escapeHtml(example.description)}</p>
        <div class="demo-tags">${tags.join('')}</div>
        <div class="demo-card-footer">
          <a class="demo-link" href="?page=${encodeURIComponent(example.id)}">Open example</a>
        </div>
      </div>
    </article>
  `;
}

export default function initComposePage() {
  const container = document.getElementById('LibraPlayground');
  if (!container) return;

  container.innerHTML = `
    <div class="showcase-page showcase-page--compose">
      <header class="showcase-topbar">
        <a class="showcase-brand" href="?page=home">
          <strong>Libra+</strong>
          <span>Compositional Interaction for Data Visualization</span>
        </a>
        <nav class="showcase-nav" aria-label="Primary">
          <a href="?page=home">Home</a>
          <a href="?page=gallery">Gallery</a>
          <a href="?page=tutorial">DSL Tutorial</a>
          <a href="?page=compose">Compose Examples</a>
          <a href="https://github.com/lx9days/Libra-mogaiban.git" target="_blank" rel="noopener noreferrer">Libra+ Core Repo</a>
        </nav>
      </header>

      <section class="gallery-hero compose-hero">
        <span class="eyebrow">Compose Interaction</span>
        <h1 class="gallery-title">Try to compose interaction.</h1>
        <p class="gallery-subtitle">
          Try to use <code>priority</code>, <code>modifierKey</code>, <code>stopPropagation</code>
          (whether to stop event propagation), and <code>syntheticEvent</code> to compose a
          conflict-free multi-interaction system.
        </p>
      </section>

      <section class="featured-panel compose-panel">
        <span class="eyebrow">Examples</span>
        <h2 class="section-title">Start with Dust &amp; Magnet.</h2>
        <p class="gallery-caption">
          Each example provides reusable single-interaction templates and a workbench for
          manual composition.
        </p>
        <div class="featured-grid compose-grid">
          ${COMPOSE_EXAMPLES.map((example) => renderComposeCard(example)).join('')}
        </div>
      </section>
    </div>
  `;

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}
