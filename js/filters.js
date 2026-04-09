// ============================================================
// filters.js - Filter state management & data lookup
// ============================================================

const filterState = {
  year: 2025,
  dpto: null,
  area: null,
  sex: null,
  age_group: null,
  poverty: null
};

const YEARS = [2022, 2023, 2024, 2025];

function getActiveFilters() {
  return ['dpto', 'area', 'sex', 'age_group', 'poverty']
    .filter(k => filterState[k] !== null)
    .map(k => ({ dim: k, val: filterState[k] }));
}

function updateFilter(dim, val) {
  if (dim === 'year') {
    filterState.year = parseInt(val);
  } else {
    filterState[dim] = (val === '' || val === null) ? null : val;
    // If value is numeric string, keep it numeric-ish for lookup
    if (filterState[dim] !== null && !isNaN(filterState[dim])) {
      filterState[dim] = parseFloat(filterState[dim]);
    }
  }
  enforceMaxFilters(dim);
  updateFilterUI();
  updateDashboard();
}

function enforceMaxFilters(justChanged) {
  const active = getActiveFilters();
  if (active.length > 2) {
    const toRemove = active.find(f => f.dim !== justChanged);
    if (toRemove) {
      filterState[toRemove.dim] = null;
      const el = document.getElementById(`filter-${toRemove.dim}`);
      if (el) el.value = '';
    }
  }
}

function clearFilters() {
  ['dpto', 'area', 'sex', 'age_group', 'poverty'].forEach(k => {
    filterState[k] = null;
    const el = document.getElementById(`filter-${k}`);
    if (el) el.value = '';
  });
  updateFilterUI();
  updateDashboard();
}

function updateFilterUI() {
  const active = getActiveFilters();
  const badge = document.getElementById('filter-badge');
  if (badge) {
    badge.textContent = active.length > 0 ? `${active.length} filtro${active.length > 1 ? 's' : ''} activo${active.length > 1 ? 's' : ''}` : 'Sin filtros';
  }
  // Update year buttons
  document.querySelectorAll('.year-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.year) === filterState.year);
    btn.classList.toggle('btn-primary', parseInt(btn.dataset.year) === filterState.year);
    btn.classList.toggle('btn-outline-primary', parseInt(btn.dataset.year) !== filterState.year);
  });

  // Disable filters not available for housing tab
  const isHousingTab = document.querySelector('#tab-housing.active') !== null ||
    document.querySelector('[data-bs-target="#tab-housing"].active') !== null;
  ['sex', 'age_group'].forEach(dim => {
    const el = document.getElementById(`filter-${dim}`);
    if (el) {
      el.disabled = isHousingTab;
      if (isHousingTab && filterState[dim] !== null) {
        filterState[dim] = null;
        el.value = '';
      }
    }
  });
}

// --- Data Lookup ---

function buildKey(active) {
  if (active.length === 0) return { key: 'year', lookup: String(filterState.year) };
  const sorted = [...active].sort((a, b) => a.dim.localeCompare(b.dim));
  const key = 'year|' + sorted.map(f => f.dim).join('|');
  const lookup = filterState.year + '|' + sorted.map(f => f.val).join('|');
  return { key, lookup };
}

function lookupIndicator(themeData, indicatorId) {
  if (!themeData || !themeData.indicators) return null;
  const indicator = themeData.indicators[indicatorId];
  if (!indicator) return null;

  const active = getActiveFilters();
  const { key, lookup } = buildKey(active);
  return indicator.data[key]?.[lookup] || null;
}

function lookupTimeSeries(themeData, indicatorId) {
  if (!themeData || !themeData.indicators) return [];
  const indicator = themeData.indicators[indicatorId];
  if (!indicator) return [];

  const active = getActiveFilters();
  return YEARS.map(y => {
    const tempState = { ...filterState, year: y };
    const sorted = [...active].sort((a, b) => a.dim.localeCompare(b.dim));
    let key, lookup;
    if (sorted.length === 0) {
      key = 'year'; lookup = String(y);
    } else {
      key = 'year|' + sorted.map(f => f.dim).join('|');
      lookup = y + '|' + sorted.map(f => f.val).join('|');
    }
    const entry = indicator.data[key]?.[lookup];
    return { year: y, value: entry?.v ?? null, n: entry?.n ?? 0 };
  });
}

function lookupByDimension(themeData, indicatorId, dimName) {
  if (!themeData || !themeData.indicators) return [];
  const indicator = themeData.indicators[indicatorId];
  if (!indicator) return [];

  const year = filterState.year;
  const key = `year|${dimName}`;
  const dimData = indicator.data[key] || {};

  return Object.entries(dimData)
    .filter(([k]) => k.startsWith(year + '|'))
    .map(([k, v]) => {
      const parts = k.split('|');
      return { key: parts[1], value: v.v, n: v.n };
    })
    .sort((a, b) => {
      const an = parseFloat(a.key), bn = parseFloat(b.key);
      if (!isNaN(an) && !isNaN(bn)) return an - bn;
      return a.key.localeCompare(b.key);
    });
}

function getDimLabel(dim, val, metadata) {
  if (!metadata) return String(val);
  const map = {
    'dpto': metadata.departments,
    'area': metadata.areas,
    'sex': metadata.sex,
    'poverty': metadata.poverty_levels,
    'age_group': null
  };
  if (dim === 'age_group') return String(val);
  const m = map[dim];
  return m ? (m[String(val)] || String(val)) : String(val);
}
