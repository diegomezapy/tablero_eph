// ============================================================
// app.js - Initialization, data loading, routing
// ============================================================

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

function populateFilters(metadata) {
  // Departments
  const dptoSel = document.getElementById('filter-dpto');
  if (dptoSel && metadata.departments) {
    dptoSel.innerHTML = '<option value="">Todos</option>';
    Object.entries(metadata.departments)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([k, v]) => {
        dptoSel.innerHTML += `<option value="${k}">${v}</option>`;
      });
  }

  // Area
  const areaSel = document.getElementById('filter-area');
  if (areaSel && metadata.areas) {
    areaSel.innerHTML = '<option value="">Todas</option>';
    Object.entries(metadata.areas).forEach(([k, v]) => {
      areaSel.innerHTML += `<option value="${k}">${v}</option>`;
    });
  }

  // Sex
  const sexSel = document.getElementById('filter-sex');
  if (sexSel && metadata.sex) {
    sexSel.innerHTML = '<option value="">Todos</option>';
    Object.entries(metadata.sex).forEach(([k, v]) => {
      sexSel.innerHTML += `<option value="${k}">${v}</option>`;
    });
  }

  // Age group
  const ageSel = document.getElementById('filter-age_group');
  if (ageSel && metadata.age_groups) {
    ageSel.innerHTML = '<option value="">Todos</option>';
    metadata.age_groups.forEach(ag => {
      ageSel.innerHTML += `<option value="${ag}">${ag} años</option>`;
    });
  }

  // Poverty
  const povSel = document.getElementById('filter-poverty');
  if (povSel && metadata.poverty_levels) {
    povSel.innerHTML = '<option value="">Todos</option>';
    Object.entries(metadata.poverty_levels).forEach(([k, v]) => {
      povSel.innerHTML += `<option value="${k}">${v}</option>`;
    });
  }
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

    // Bind filter events
    ['dpto', 'area', 'sex', 'age_group', 'poverty'].forEach(dim => {
      const el = document.getElementById(`filter-${dim}`);
      if (el) el.addEventListener('change', () => updateFilter(dim, el.value));
    });

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
