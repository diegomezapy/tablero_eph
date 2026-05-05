// ============================================================
// app.js - Initialization, data loading, routing
// ============================================================

// ---- Multi-select widget ----
function makeMultiSelectWidget(selectEl, dim) {
  selectEl.style.display = 'none';

  const wrap = document.createElement('div');
  wrap.className = 'ms-wrap';
  wrap.dataset.dim = dim;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ms-btn';
  btn.innerHTML = '<span class="ms-display text-muted">Todos</span><i class="bi bi-chevron-down ms-arrow"></i>';

  const panel = document.createElement('div');
  panel.className = 'ms-panel';

  Array.from(selectEl.options).slice(1).forEach(opt => {
    const item = document.createElement('label');
    item.className = 'ms-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = opt.value;
    item.appendChild(cb);
    item.appendChild(document.createTextNode(' ' + opt.text));
    panel.appendChild(item);

    cb.addEventListener('change', () => {
      const selected = Array.from(panel.querySelectorAll('input:checked')).map(c => c.value);
      updateMsDisplay(wrap, selected);
      updateFilter(dim, selected);
    });
  });

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const wasOpen = wrap.classList.contains('open');
    document.querySelectorAll('.ms-wrap.open').forEach(w => w.classList.remove('open'));
    if (!wasOpen) wrap.classList.add('open');
  });

  wrap.appendChild(btn);
  wrap.appendChild(panel);
  selectEl.parentNode.insertBefore(wrap, selectEl);
}

function updateMsDisplay(wrap, selected) {
  const btn = wrap.querySelector('.ms-btn');
  const display = btn?.querySelector('.ms-display');
  if (!display) return;
  if (selected.length === 0) {
    display.className = 'ms-display text-muted';
    display.textContent = 'Todos';
    btn.classList.remove('has-sel');
  } else {
    display.className = 'ms-display';
    btn.classList.add('has-sel');
    if (selected.length <= 2) {
      const labels = selected.map(v => {
        const cb = wrap.querySelector(`input[value="${CSS.escape(v)}"]`);
        return cb?.parentElement?.textContent?.trim() || v;
      });
      display.innerHTML = labels.map(l => `<span class="ms-tag">${l}</span>`).join('');
    } else {
      display.innerHTML = `<span class="ms-sel-count">${selected.length} seleccionados</span>`;
    }
  }
}

document.addEventListener('click', () => {
  document.querySelectorAll('.ms-wrap.open').forEach(w => w.classList.remove('open'));
});

const dashboardData = {};
const loadedThemes = new Set();

async function fetchJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load ${url}: ${resp.status}`);
  return resp.json();
}

async function loadTheme(theme) {
  if (loadedThemes.has(theme)) return;
  try {
    dashboardData[theme] = await fetchJSON(`data/${theme}.json`);
    loadedThemes.add(theme);
  } catch (e) {
    console.warn(`Could not load ${theme}:`, e);
  }
}

function updateDashboard() {
  updateKPIs();
  drawCurrentTab();
}

async function onTabChange(theme) {
  if (theme === 'wages') {
    await loadTheme('income');
  } else {
    await loadTheme(theme);
  }
  updateFilterUI();
  drawCurrentTab();
  if (theme === 'map') {
    setTimeout(() => {
      initMap();
      updateMap();
      if (map) map.invalidateSize();
    }, 100);
  }
}

function buildSelect(id, entries) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '<option value="">Todos</option>';
  entries.forEach(([k, v]) => { sel.innerHTML += `<option value="${k}">${v}</option>`; });
}

function populateFilters(metadata) {
  // Departments
  if (metadata.departments) {
    buildSelect('filter-dpto',
      Object.entries(metadata.departments).sort((a, b) => parseInt(a[0]) - parseInt(b[0])));
  }
  if (metadata.areas)         buildSelect('filter-area', Object.entries(metadata.areas));
  if (metadata.sex)           buildSelect('filter-sex', Object.entries(metadata.sex));
  if (metadata.age_groups)    buildSelect('filter-age_group', metadata.age_groups.map(ag => [ag, ag + ' años']));
  if (metadata.poverty_levels) buildSelect('filter-poverty', Object.entries(metadata.poverty_levels));
  if (metadata.condact)       buildSelect('filter-condact', Object.entries(metadata.condact));
  if (metadata.cate_pea)      buildSelect('filter-cate_pea', Object.entries(metadata.cate_pea));
  if (metadata.rama_pea)      buildSelect('filter-rama_pea', Object.entries(metadata.rama_pea));

  // Convert all filter selects to custom multi-select widgets
  ['dpto', 'area', 'sex', 'age_group', 'poverty', 'condact', 'cate_pea', 'rama_pea'].forEach(dim => {
    const sel = document.getElementById(`filter-${dim}`);
    if (sel) makeMultiSelectWidget(sel, dim);
  });
}

async function init() {
  const loader = document.getElementById('loading');

  try {
    // Load metadata and geo first
    dashboardData.metadata = await fetchJSON('data/metadata.json');
    dashboardData.geo = await fetchJSON('data/geo/departamentos.json');

    populateFilters(dashboardData.metadata);

    // Load all themes in parallel
    await Promise.all([
      loadTheme('poverty'),
      loadTheme('employment'),
      loadTheme('income'),
      loadTheme('education'),
      loadTheme('housing'),
      loadTheme('demographics'),
    ]);

    // Filter events are wired inside makeMultiSelectWidget (called from populateFilters)

    // Year buttons
    document.querySelectorAll('.year-btn').forEach(btn => {
      btn.addEventListener('click', () => updateFilter('year', btn.dataset.year));
    });

    // Clear filters
    const clearBtn = document.getElementById('btn-clear');
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);

    // Tab navigation
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
      tab.addEventListener('shown.bs.tab', () => onTabChange(tab.dataset.theme));
    });

    // Map indicator selector
    const mapInd = document.getElementById('mapIndicator');
    if (mapInd) mapInd.addEventListener('change', updateMap);

    // Wage tab: deflation toggle + export button
    const deflateChk = document.getElementById('wage-deflate');
    if (deflateChk) deflateChk.addEventListener('change', () => drawWageCharts());
    const exportBtn = document.getElementById('btn-export-excel');
    if (exportBtn) exportBtn.addEventListener('click', exportToExcel);

    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('show'));
    }

    // Initial render
    updateFilterUI();
    updateDashboard();

  } catch (e) {
    console.error('Dashboard init error:', e);
    document.body.innerHTML = `<div class="p-5 text-center"><h3>Error al cargar datos</h3><p>${e.message}</p></div>`;
  }

  if (loader) loader.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', init);
