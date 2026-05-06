// ============================================================
// filters.js - Filter state management & data lookup
// ============================================================

const filterState = {
  year: 2025,
  dpto: null,        // null | [values...]
  area: null,
  sex: null,
  age_group: null,
  poverty: null,
  condact: null,
  cate_pea: null,
  rama_pea: null,
  ruc: null,
  tama_emp: null,
  cotiza_ips: null,
};

const YEARS = [2022, 2023, 2024, 2025];
const ALL_FILTER_DIMS = ['dpto', 'area', 'sex', 'age_group', 'poverty', 'condact', 'cate_pea', 'rama_pea', 'ruc', 'tama_emp', 'cotiza_ips'];
const FORMALITY_ONLY_DIMS = ['ruc', 'tama_emp', 'cotiza_ips'];

// Returns [{dim, val: [array of selected values]}] for active (non-null) filters
function getActiveFilters() {
  return ALL_FILTER_DIMS
    .filter(k => filterState[k] != null && filterState[k].length > 0)
    .map(k => ({ dim: k, val: filterState[k] }));
}

function updateFilter(dim, val) {
  if (dim === 'year') {
    filterState.year = parseInt(val);
  } else {
    const arr = Array.isArray(val) ? val : (val === '' || val == null ? [] : [val]);
    filterState[dim] = arr.length === 0 ? null
      : arr.map(v => (v !== '' && !isNaN(v)) ? parseFloat(v) : v);
  }
  updateFilterUI();
  updateDashboard();
}

function clearMsWidget(dim) {
  const wrap = document.querySelector(`.ms-wrap[data-dim="${dim}"]`);
  if (wrap) {
    wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    wrap.classList.remove('open');
    updateMsDisplay(wrap, []);
  }
}

function clearFilters() {
  ALL_FILTER_DIMS.forEach(k => {
    filterState[k] = null;
    clearMsWidget(k);
  });
  updateFilterUI();
  updateDashboard();
}

function updateFilterUI() {
  const active = getActiveFilters();
  const badge = document.getElementById('filter-badge');
  if (badge) {
    badge.textContent = active.length > 0
      ? `${active.length} filtro${active.length > 1 ? 's' : ''} activo${active.length > 1 ? 's' : ''}`
      : 'Sin filtros';
  }
  document.querySelectorAll('.year-btn').forEach(btn => {
    const isActive = parseInt(btn.dataset.year) === filterState.year;
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('btn-primary', isActive);
    btn.classList.toggle('btn-outline-light', !isActive);
    btn.classList.remove('btn-outline-primary');
  });

  // Disable person-level filters for housing tab
  const isHousingTab = document.querySelector('#tab-housing.active') !== null ||
    document.querySelector('[data-bs-target="#tab-housing"].active') !== null;
  ['sex', 'age_group', 'condact', 'cate_pea', 'rama_pea'].forEach(dim => {
    const wrap = document.querySelector(`.ms-wrap[data-dim="${dim}"]`);
    if (!wrap) return;
    const btn = wrap.querySelector('.ms-btn');
    if (btn) btn.disabled = isHousingTab;
    wrap.querySelectorAll('input[type="checkbox"]').forEach(inp => inp.disabled = isHousingTab);
    if (isHousingTab && filterState[dim] != null) {
      filterState[dim] = null;
      wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      updateMsDisplay(wrap, []);
    }
  });

  // Formality-specific filters: only visible on the Formalidad tab
  const isFormalityTab = document.querySelector('#tab-formality.active') !== null ||
    document.querySelector('[data-bs-target="#tab-formality"].active') !== null ||
    currentActiveTheme === 'formality';
  const fSection = document.getElementById('formality-filter-section');
  if (fSection) fSection.style.display = isFormalityTab ? '' : 'none';
  if (!isFormalityTab) {
    FORMALITY_ONLY_DIMS.forEach(dim => {
      if (filterState[dim] != null) {
        filterState[dim] = null;
        const wrap = document.querySelector(`.ms-wrap[data-dim="${dim}"]`);
        if (wrap) {
          wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
          updateMsDisplay(wrap, []);
        }
      }
    });
  }
}

// ============================================================
// Data Lookup (supports multi-value filter dims)
// ============================================================

function _singleLookup(data, singleDims, year) {
  if (!data) return null;
  const sorted = [...singleDims].sort((a, b) => a.dim.localeCompare(b.dim));
  let key, lookup;
  if (sorted.length === 0) {
    key = 'year'; lookup = String(year);
  } else {
    key = 'year|' + sorted.map(f => f.dim).join('|');
    lookup = year + '|' + sorted.map(f => f.val).join('|');
  }
  return data[key]?.[lookup] || null;
}

// Recursively handles multi-value dims by aggregating with n-weighted average
function _aggregateLookup(data, active, year) {
  if (!data) return null;
  const multiIdx = active.findIndex(f => Array.isArray(f.val) && f.val.length > 1);
  if (multiIdx === -1) {
    const singles = active.map(f => ({ dim: f.dim, val: Array.isArray(f.val) ? f.val[0] : f.val }));
    return _singleLookup(data, singles, year);
  }
  const multiDim = active[multiIdx];
  const otherDims = active.filter((_, i) => i !== multiIdx);
  const results = multiDim.val
    .map(v => _aggregateLookup(data, [...otherDims, { dim: multiDim.dim, val: [v] }], year))
    .filter(r => r?.v != null);
  if (results.length === 0) return null;
  const totalN = results.reduce((s, r) => s + (r.n || 0), 0);
  if (totalN === 0) return { v: results.reduce((s, r) => s + r.v, 0) / results.length, n: 0 };
  const wSum = results.reduce((s, r) => s + r.v * (r.n || 0), 0);
  return { v: parseFloat((wSum / totalN).toFixed(2)), n: totalN };
}

function lookupIndicator(themeData, indicatorId) {
  if (!themeData?.indicators) return null;
  const indicator = themeData.indicators[indicatorId];
  if (!indicator) return null;
  return _aggregateLookup(indicator.data, getActiveFilters(), filterState.year);
}

function lookupTimeSeries(themeData, indicatorId) {
  if (!themeData?.indicators) return [];
  const indicator = themeData.indicators[indicatorId];
  if (!indicator) return [];
  const active = getActiveFilters();
  return YEARS.map(y => {
    const entry = _aggregateLookup(indicator.data, active, y);
    return { year: y, value: entry?.v ?? null, n: entry?.n ?? 0 };
  });
}

function lookupByDimension(themeData, indicatorId, dimName) {
  if (!themeData?.indicators) return [];
  const indicator = themeData.indicators[indicatorId];
  if (!indicator) return [];
  const year = filterState.year;
  // Active filters excluding the target dim (we're breaking down by it)
  const otherActive = getActiveFilters().filter(f => f.dim !== dimName);
  const dimData = indicator.data[`year|${dimName}`] || {};
  const dimVals = Object.keys(dimData)
    .filter(k => k.startsWith(year + '|'))
    .map(k => k.split('|')[1]);
  return dimVals
    .map(dv => {
      const dims = [...otherActive, { dim: dimName, val: [dv] }];
      const entry = _aggregateLookup(indicator.data, dims, year);
      return { key: dv, value: entry?.v ?? null, n: entry?.n ?? 0 };
    })
    .filter(x => x.value != null)
    .sort((a, b) => {
      const an = parseFloat(a.key), bn = parseFloat(b.key);
      if (!isNaN(an) && !isNaN(bn)) return an - bn;
      return a.key.localeCompare(b.key);
    });
}

function getDimLabel(dim, val, metadata) {
  if (!metadata) return String(val);
  const map = {
    'dpto':       metadata.departments,
    'area':       metadata.areas,
    'sex':        metadata.sex,
    'poverty':    metadata.poverty_levels,
    'condact':    metadata.condact,
    'cate_pea':   metadata.cate_pea,
    'rama_pea':   metadata.rama_pea,
    'ruc':        metadata.ruc,
    'tama_emp':   metadata.tama_emp,
    'cotiza_ips': metadata.cotiza_ips,
    'age_group':  null,
  };
  if (dim === 'age_group') return String(val);
  const m = map[dim];
  return m ? (m[String(Math.round(val))] || String(val)) : String(val);
}
