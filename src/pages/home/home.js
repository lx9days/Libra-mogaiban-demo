import {
  HOME_STORY_SECTIONS,
  HOME_TEMPLATE_LINES,
  HOME_TTF_PANELS,
  getFeaturedDemos,
  getShowcaseCatalog,
  getShowcaseStats,
} from '../../scripts/site-content';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function demoHref(demo) {
  return `?page=${encodeURIComponent(demo.id)}`;
}

function renderPreviewMarkup(demo, { compact = false } = {}) {
  if (demo.preview) {
    return `<img src="${escapeHtml(demo.preview)}" alt="${escapeHtml(demo.title)} preview">`;
  }

  const title = compact ? demo.title.split(' ').slice(0, 2).join(' ') : demo.title;
  const badge = compact ? demo.category : demo.category;

  return `
    <div class="demo-preview-fallback">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(badge)}</span>
      </div>
    </div>
  `;
}

function renderMiniDemoCard(demo) {
  return `
    <a class="mini-demo-card" href="${demoHref(demo)}">
      <div class="mini-demo-preview" data-tone="${escapeHtml(demo.tone)}">
        ${renderPreviewMarkup(demo, { compact: true })}
      </div>
      <div class="mini-demo-caption">
        <strong>${escapeHtml(demo.title)}</strong>
        <span>${escapeHtml(demo.category)}</span>
      </div>
    </a>
  `;
}

function renderFeaturedCard(demo) {
  const tags = [demo.category, ...demo.triggers.slice(0, 2)].map(
    (tag, index) =>
      `<span class="demo-tag${index === 0 ? ' demo-tag-accent' : ''}">${escapeHtml(tag)}</span>`
  );

  return `
    <article class="demo-card">
      <div class="demo-preview" data-tone="${escapeHtml(demo.tone)}">
        ${renderPreviewMarkup(demo)}
      </div>
      <div class="demo-card-body">
        <div class="demo-card-heading">
          <div>
            <h3 class="demo-card-title">${escapeHtml(demo.title)}</h3>
            <p class="demo-card-meta">${escapeHtml(demo.themes.join(' · '))}</p>
          </div>
        </div>
        <p class="demo-card-description">${escapeHtml(demo.description)}</p>
        <div class="demo-tags">${tags.join('')}</div>
        <div class="demo-card-footer">
          <a class="demo-link" href="${demoHref(demo)}">Open demo</a>
        </div>
      </div>
    </article>
  `;
}

export default function initHomePage() {
  const container = document.getElementById('LibraPlayground');
  if (!container) return;

  const catalog = getShowcaseCatalog();
  const featuredDemos = getFeaturedDemos(6);
  const heroDemos = getFeaturedDemos(3);
  const stats = getShowcaseStats();

  container.innerHTML = `
    <div class="showcase-page showcase-page--home">
      <header class="showcase-topbar">
        <a class="showcase-brand" href="?page=home">
          <strong>Libra+</strong>
          <span>Compositional Interaction for Data Visualization</span>
        </a>
        <nav class="showcase-nav" aria-label="Primary">
          <a href="?page=home">Home</a>
          <a href="?page=gallery">Gallery</a>
        </nav>
      </header>

      <section class="hero-shell">
        <div class="hero-copy">
          <span class="eyebrow">Trigger · Target · Feedback</span>
          <h1 class="hero-title">Compositional interaction design for data visualization.</h1>
          <p>
            Libra+ turns advanced interaction into reusable instruments. Instead of
            hard-wiring brush, pan, reorder, or lens behavior into a single chart,
            it frames each technique through a stable semantic structure that travels
            across views.
          </p>
          <div class="hero-actions">
            <a class="showcase-button" href="?page=gallery">View the Gallery</a>
          </div>
        </div>

        <aside class="hero-aside">
          <div class="spec-card">
            <div class="spec-card-header">
              <strong>Reorder Template</strong>
              <span class="spec-chip">Parameterized Instrument</span>
            </div>
            <pre class="spec-code">${escapeHtml(HOME_TEMPLATE_LINES.join('\n'))}</pre>
            <p class="spec-caption">
              One interaction template can be specialized across matrix reordering,
              SPLOM axes, and parallel coordinates by changing only its context and
              redraw behavior.
            </p>
          </div>
          <div class="hero-preview-grid">
            ${heroDemos.map((demo) => renderMiniDemoCard(demo)).join('')}
          </div>
        </aside>
      </section>

      <section class="ttf-grid" aria-label="TTF overview">
        ${HOME_TTF_PANELS.map(
          (panel) => `
            <article class="ttf-panel">
              <h3>${escapeHtml(panel.title)}</h3>
              <p>${escapeHtml(panel.text)}</p>
            </article>
          `
        ).join('')}
      </section>

      ${HOME_STORY_SECTIONS.map(
        (section, index) => `
          <section class="story-section${index % 2 === 1 ? ' story-section-reverse' : ''}">
            <div class="story-media">
              <img src="${escapeHtml(section.image)}" alt="${escapeHtml(section.title)}">
            </div>
            <div class="story-copy">
              <span class="eyebrow">${escapeHtml(section.eyebrow)}</span>
              <h2 class="section-title">${escapeHtml(section.title)}</h2>
              <p class="section-text">${escapeHtml(section.text)}</p>
            </div>
          </section>
        `
      ).join('')}

      <section class="featured-panel">
        <span class="eyebrow">Featured Demos</span>
        <h2 class="section-title">From linked brushing to graph lenses.</h2>
        <p class="gallery-subtitle">
          The gallery keeps the reference project’s card-based browsing model,
          but the content here is grounded in the Libra+ paper: reusable
          instruments, layered feedback, and coordinated behaviors across views.
        </p>
        <div class="featured-grid">
          ${featuredDemos.map((demo) => renderFeaturedCard(demo)).join('')}
        </div>
        <div class="section-actions">
          <a class="showcase-button" href="?page=gallery">Browse all demos</a>
        </div>
      </section>
    </div>
  `;

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}
