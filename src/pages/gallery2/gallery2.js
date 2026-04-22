import {
  CATEGORY_ORDER,
  THEME_ORDER,
  TRIGGER_ORDER,
  getShowcaseCatalog,
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

function renderPreviewMarkup(demo) {
  if (demo.preview) {
    return `<img src="${escapeHtml(demo.preview)}" alt="${escapeHtml(demo.title)} preview">`;
  }

  return `
    <div class="demo-preview-fallback">
      <div>
        <strong>${escapeHtml(demo.title)}</strong>
        <span>${escapeHtml(demo.category)}</span>
      </div>
    </div>
  `;
}

function renderFilterChips(filterName, options) {
  return options
    .map(
      (option) => `
        <button class="filter-chip" type="button" data-filter="${escapeHtml(filterName)}" data-value="${escapeHtml(option)}">
          ${escapeHtml(option)}
        </button>
      `
    )
    .join('');
}

function renderDemoCard(demo) {
  const tags = [demo.category, ...demo.triggers, ...demo.themes.slice(0, 2)]
    .slice(0, 5)
    .map(
      (tag, index) =>
        `<span class="demo-tag${index === 0 ? ' demo-tag-accent' : ''}">${escapeHtml(tag)}</span>`
    )
    .join('');

  return `
    <article class="demo-card">
      <div class="demo-preview" data-tone="${escapeHtml(demo.tone)}">
        ${renderPreviewMarkup(demo)}
      </div>
      <div class="demo-card-body">
        <div class="demo-card-heading">
          <div>
            <h3 class="demo-card-title">${escapeHtml(demo.title)}</h3>
            <p class="demo-card-meta">${escapeHtml(demo.id)}</p>
          </div>
        </div>
        <p class="demo-card-description">${escapeHtml(demo.description)}</p>
        <div class="demo-tags">${tags}</div>
        <div class="demo-card-footer">
          <a class="demo-link" href="${demoHref(demo)}">Open demo</a>
        </div>
      </div>
    </article>
  `;
}

function filterDemos(demos, state) {
  const query = state.query.trim().toLowerCase();

  return demos.filter((demo) => {
    if (state.category !== 'All' && demo.category !== state.category) return false;
    if (state.trigger !== 'All' && !demo.triggers.includes(state.trigger)) return false;
    if (state.theme !== 'All' && !demo.themes.includes(state.theme)) return false;

    if (!query) return true;

    const haystack = [
      demo.id,
      demo.title,
      demo.category,
      demo.description,
      demo.triggers.join(' '),
      demo.themes.join(' '),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}

function uniqueOptions(demos, field, preferredOrder) {
  const used = new Set(demos.flatMap((demo) => (Array.isArray(demo[field]) ? demo[field] : [demo[field]])));
  return preferredOrder.filter((option) => used.has(option));
}

export default function initGalleryPage() {
  const container = document.getElementById('LibraPlayground');
  if (!container) return;

  const demos = getShowcaseCatalog().filter(demo => !demo.isNewDsl);
  const categoryOptions = ['All', ...uniqueOptions(demos, 'category', CATEGORY_ORDER)];
  const triggerOptions = ['All', ...uniqueOptions(demos, 'triggers', TRIGGER_ORDER)];
  const themeOptions = ['All', ...uniqueOptions(demos, 'themes', THEME_ORDER)];
  const state = {
    category: 'All',
    trigger: 'All',
    theme: 'All',
    query: '',
  };

  container.innerHTML = `
    <div class="showcase-page showcase-page--gallery">
      <header class="showcase-topbar">
        <a class="showcase-brand" href="?page=home">
          <strong>Libra+</strong>
          <span>Legacy Gallery</span>
        </a>
        <nav class="showcase-nav" aria-label="Primary">
          <a href="?page=home">Home</a>
          <a href="?page=gallery">Gallery</a>
        </nav>
      </header>

      <section class="gallery-toolbar">
        <div class="toolbar-head">
          <input
            id="GallerySearch"
            class="gallery-search"
            type="search"
            placeholder="Search demos, triggers, themes, or page ids"
            aria-label="Search demos"
          >
          <span id="GalleryCount" class="gallery-count"></span>
        </div>

        <div class="filter-block">
          <span class="filter-label">Filter by family</span>
          <div class="filter-row" data-filter-group="category">
            ${renderFilterChips('category', categoryOptions)}
          </div>
        </div>

        <div class="filter-block">
          <span class="filter-label">Filter by trigger</span>
          <div class="filter-row" data-filter-group="trigger">
            ${renderFilterChips('trigger', triggerOptions)}
          </div>
        </div>

        <div class="filter-block">
          <span class="filter-label">Filter by theme</span>
          <div class="filter-row" data-filter-group="theme">
            ${renderFilterChips('theme', themeOptions)}
          </div>
        </div>
      </section>

      <section id="GalleryResults" class="gallery-grid" aria-live="polite"></section>
    </div>
  `;

  const searchInput = container.querySelector('#GallerySearch');
  const countNode = container.querySelector('#GalleryCount');
  const resultsNode = container.querySelector('#GalleryResults');
  const chips = Array.from(container.querySelectorAll('.filter-chip'));

  function syncChipState() {
    chips.forEach((chip) => {
      const isActive = state[chip.dataset.filter] === chip.dataset.value;
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-pressed', String(isActive));
    });
  }

  function renderResults() {
    const visibleDemos = filterDemos(demos, state);
    countNode.textContent = `${visibleDemos.length} of ${demos.length} demos`;
    syncChipState();

    if (!visibleDemos.length) {
      resultsNode.innerHTML = `
        <div class="empty-state">
          No demos match the current filters. Try clearing one of the chips or broadening the search query.
        </div>
      `;
      return;
    }

    resultsNode.innerHTML = visibleDemos.map((demo) => renderDemoCard(demo)).join('');
  }

  container.addEventListener('click', (event) => {
    const chip = event.target.closest('.filter-chip');
    if (!chip) return;

    const { filter, value } = chip.dataset;
    if (!filter) return;
    state[filter] = value;
    renderResults();
  });

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      state.query = event.target.value;
      renderResults();
    });
  }

  renderResults();
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}
