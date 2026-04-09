// ============================================================
// charts.js - Chart.js creation/update per tab
// ============================================================

const charts = {};

function updateKPIs() {
  const d = dashboardData;
  const kpis = [
    { id: 'kpi-poverty', theme: 'poverty', ind: 'poverty_rate', label: 'Pobreza Total', unit: '%', invertTrend: true },
    { id: 'kpi-extreme', theme: 'poverty', ind: 'extreme_poverty_rate', label: 'Pobreza Extrema', unit: '%', invertTrend: true },
    { id: 'kpi-employment', theme: 'employment', ind: 'employment_rate', label: 'Tasa de Empleo', unit: '%' },
    { id: 'kpi-informality', theme: 'employment', ind: 'informality_rate', label: 'Informalidad', unit: '%', invertTrend: true },
    { id: 'kpi-income', theme: 'income', ind: 'median_income', label: 'Ingreso Mediano', unit: 'Gs.' },
    { id: 'kpi-schooling', theme: 'education', ind: 'mean_schooling', label: 'Años Escolaridad', unit: 'años' },
  ];

  kpis.forEach(k => {
    const el = document.getElementById(k.id);
    if (!el || !d[k.theme]) return;

    const current = lookupIndicator(d[k.theme], k.ind);
    const prevYear = filterState.year - 1;
    const prevActive = getActiveFilters();
    let prev = null;
    if (prevYear >= 2022) {
      const savedYear = filterState.year;
      filterState.year = prevYear;
      prev = lookupIndicator(d[k.theme], k.ind);
      filterState.year = savedYear;
    }

    const valEl = el.querySelector('.kpi-value');
    const trendEl = el.querySelector('.kpi-trend-container');
    if (valEl) valEl.textContent = formatValue(current?.v, k.unit);
    if (trendEl && prev && current?.v != null && prev.v != null) {
      const diff = current.v - prev.v;
      const arrow = diff > 0 ? 'bi-arrow-up-short' : diff < 0 ? 'bi-arrow-down-short' : 'bi-dash';
      // For inverted indicators (poverty, informality), decrease is good
      let cls;
      if (k.invertTrend) {
        cls = diff < 0 ? 'up' : diff > 0 ? 'down' : '';
      } else {
        cls = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
      }
      let suffix = 'pp', diffText = Math.abs(diff).toFixed(1);
      if (k.unit === 'Gs.') { suffix = ''; diffText = 'Gs. ' + Math.round(Math.abs(diff)).toLocaleString('es-PY'); }
      else if (k.unit === 'años') { suffix = ''; diffText = Math.abs(diff).toFixed(1) + ' años'; }
      trendEl.innerHTML = `<span class="kpi-trend ${cls}"><i class="bi ${arrow}"></i>${diffText}${suffix}</span>`;
    } else if (trendEl) {
      trendEl.innerHTML = '';
    }
  });
}

// --- Poverty Tab ---
function drawPovertyCharts() {
  const d = dashboardData.poverty;
  if (!d) return;

  // 1. Evolution line chart
  const ts1 = lookupTimeSeries(d, 'poverty_rate');
  const ts2 = lookupTimeSeries(d, 'extreme_poverty_rate');
  charts.povertyEvolution = destroyChart(charts.povertyEvolution);
  const ctx1 = document.getElementById('chart-poverty-evolution');
  if (ctx1) {
    charts.povertyEvolution = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: YEARS,
        datasets: [
          { label: 'Pobreza total', data: ts1.map(t => t.value), borderColor: COLORS.danger, backgroundColor: 'rgba(230,57,70,0.1)', fill: true, tension: 0.3 },
          { label: 'Pobreza extrema', data: ts2.map(t => t.value), borderColor: COLORS.warning, backgroundColor: 'rgba(233,196,106,0.1)', fill: true, tension: 0.3 }
        ]
      },
      options: deepMerge(getChartDefaults(), { plugins: { legend: { position: 'top' } } })
    });
  }

  // 2. By department bar chart
  const byDpto = lookupByDimension(d, 'poverty_rate', 'dpto');
  charts.povertyByDpto = destroyChart(charts.povertyByDpto);
  const ctx2 = document.getElementById('chart-poverty-dpto');
  if (ctx2 && byDpto.length > 0) {
    const labels = byDpto.map(x => getDimLabel('dpto', x.key, dashboardData.metadata));
    charts.povertyByDpto = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Pobreza %', data: byDpto.map(x => x.value), backgroundColor: COLORS.danger + '99' }]
      },
      options: deepMerge(getChartDefaults(), { indexAxis: 'y', plugins: { legend: { display: false } } })
    });
  }

  // 3. Doughnut extreme vs non-extreme
  const ext = lookupIndicator(d, 'extreme_poverty_rate');
  const next = lookupIndicator(d, 'non_extreme_poverty_rate');
  const notPoor = (ext?.v != null && next?.v != null) ? Math.max(0, 100 - ext.v - next.v) : null;
  charts.povertyDonut = destroyChart(charts.povertyDonut);
  const ctx3 = document.getElementById('chart-poverty-donut');
  if (ctx3 && ext?.v != null) {
    charts.povertyDonut = new Chart(ctx3, {
      type: 'doughnut',
      data: {
        labels: ['Pobreza extrema', 'Pobreza no extrema', 'No pobre'],
        datasets: [{ data: [ext.v, next?.v, notPoor], backgroundColor: [COLORS.danger, COLORS.warning, COLORS.success] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  // 4. By area grouped bar
  const byArea = lookupByDimension(d, 'poverty_rate', 'area');
  const byAreaExt = lookupByDimension(d, 'extreme_poverty_rate', 'area');
  charts.povertyByArea = destroyChart(charts.povertyByArea);
  const ctx4 = document.getElementById('chart-poverty-area');
  if (ctx4 && byArea.length > 0) {
    const labels = byArea.map(x => getDimLabel('area', x.key, dashboardData.metadata));
    charts.povertyByArea = new Chart(ctx4, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Pobreza total', data: byArea.map(x => x.value), backgroundColor: COLORS.danger + '99' },
          { label: 'Pobreza extrema', data: byAreaExt.map(x => x.value), backgroundColor: COLORS.warning + '99' }
        ]
      },
      options: getChartDefaults()
    });
  }
}

// --- Employment Tab ---
function drawEmploymentCharts() {
  const d = dashboardData.employment;
  if (!d) return;

  // 1. Evolution
  const tsEmp = lookupTimeSeries(d, 'employment_rate');
  const tsInf = lookupTimeSeries(d, 'informality_rate');
  const tsUne = lookupTimeSeries(d, 'unemployment_rate');
  charts.empEvolution = destroyChart(charts.empEvolution);
  const ctx1 = document.getElementById('chart-emp-evolution');
  if (ctx1) {
    charts.empEvolution = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: YEARS,
        datasets: [
          { label: 'Empleo', data: tsEmp.map(t => t.value), borderColor: COLORS.success, tension: 0.3 },
          { label: 'Informalidad', data: tsInf.map(t => t.value), borderColor: COLORS.warning, tension: 0.3 },
          { label: 'Desempleo', data: tsUne.map(t => t.value), borderColor: COLORS.danger, tension: 0.3 }
        ]
      },
      options: getChartDefaults()
    });
  }

  // 2. CATE_PEA doughnut
  const cateKeys = [1, 2, 3, 4, 5, 6];
  const cateData = cateKeys.map(k => lookupIndicator(d, `cate_pea_${k}`)?.v ?? 0);
  const cateLabels = cateKeys.map(k => dashboardData.metadata?.cate_pea?.[k] || `Cat ${k}`);
  charts.catePea = destroyChart(charts.catePea);
  const ctx2 = document.getElementById('chart-cate-pea');
  if (ctx2) {
    charts.catePea = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: cateLabels,
        datasets: [{ data: cateData, backgroundColor: COLORS.palette.slice(0, 6) }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } } }
    });
  }

  // 3. RAMA_PEA bar
  const ramaKeys = [1, 2, 3, 4, 5, 6, 7, 8];
  const ramaData = ramaKeys.map(k => lookupIndicator(d, `rama_pea_${k}`)?.v ?? 0);
  const ramaLabels = ramaKeys.map(k => dashboardData.metadata?.rama_pea?.[k] || `Rama ${k}`);
  charts.ramaPea = destroyChart(charts.ramaPea);
  const ctx3 = document.getElementById('chart-rama-pea');
  if (ctx3) {
    charts.ramaPea = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: ramaLabels,
        datasets: [{ label: '%', data: ramaData, backgroundColor: COLORS.palette.slice(0, 8) }]
      },
      options: deepMerge(getChartDefaults(), { indexAxis: 'y', plugins: { legend: { display: false } } })
    });
  }

  // 4. Informality by dept
  const infByDpto = lookupByDimension(d, 'informality_rate', 'dpto');
  charts.infByDpto = destroyChart(charts.infByDpto);
  const ctx4 = document.getElementById('chart-inf-dpto');
  if (ctx4 && infByDpto.length > 0) {
    charts.infByDpto = new Chart(ctx4, {
      type: 'bar',
      data: {
        labels: infByDpto.map(x => getDimLabel('dpto', x.key, dashboardData.metadata)),
        datasets: [{ label: 'Informalidad %', data: infByDpto.map(x => x.value), backgroundColor: COLORS.warning + '99' }]
      },
      options: deepMerge(getChartDefaults(), { indexAxis: 'y', plugins: { legend: { display: false } } })
    });
  }
}

// --- Income Tab ---
function drawIncomeCharts() {
  const d = dashboardData.income;
  if (!d) return;

  // 1. Evolution
  const tsMean = lookupTimeSeries(d, 'mean_income');
  const tsMed = lookupTimeSeries(d, 'median_income');
  charts.incEvolution = destroyChart(charts.incEvolution);
  const ctx1 = document.getElementById('chart-inc-evolution');
  if (ctx1) {
    charts.incEvolution = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: YEARS,
        datasets: [
          { label: 'Ingreso medio', data: tsMean.map(t => t.value), borderColor: COLORS.primary, tension: 0.3 },
          { label: 'Ingreso mediano', data: tsMed.map(t => t.value), borderColor: COLORS.success, tension: 0.3 }
        ]
      },
      options: getChartDefaults()
    });
  }

  // 2. Income by quintile
  const qData = [1, 2, 3, 4, 5].map(q => lookupIndicator(d, `mean_income_q${q}`)?.v ?? 0);
  charts.incQuintile = destroyChart(charts.incQuintile);
  const ctx2 = document.getElementById('chart-inc-quintile');
  if (ctx2) {
    charts.incQuintile = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: ['Q1 (más pobre)', 'Q2', 'Q3', 'Q4', 'Q5 (más rico)'],
        datasets: [{ label: 'Ingreso medio (Gs.)', data: qData, backgroundColor: COLORS.palette.slice(0, 5) }]
      },
      options: deepMerge(getChartDefaults(), { plugins: { legend: { display: false } } })
    });
  }

  // 3. Income by dept
  const incByDpto = lookupByDimension(d, 'mean_income', 'dpto');
  charts.incByDpto = destroyChart(charts.incByDpto);
  const ctx3 = document.getElementById('chart-inc-dpto');
  if (ctx3 && incByDpto.length > 0) {
    charts.incByDpto = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: incByDpto.map(x => getDimLabel('dpto', x.key, dashboardData.metadata)),
        datasets: [{ label: 'Ingreso medio (Gs.)', data: incByDpto.map(x => x.value), backgroundColor: COLORS.primary + '99' }]
      },
      options: deepMerge(getChartDefaults(), { indexAxis: 'y', plugins: { legend: { display: false } } })
    });
  }

  // 4. Quintile distribution
  const qdist = [1, 2, 3, 4, 5].map(q => lookupIndicator(d, `quintile_${q}_pct`)?.v ?? 20);
  charts.incDist = destroyChart(charts.incDist);
  const ctx4 = document.getElementById('chart-inc-dist');
  if (ctx4) {
    charts.incDist = new Chart(ctx4, {
      type: 'doughnut',
      data: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
        datasets: [{ data: qdist, backgroundColor: COLORS.palette.slice(0, 5) }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }
}

// --- Education Tab ---
function drawEducationCharts() {
  const d = dashboardData.education;
  if (!d) return;

  // 1. Evolution
  const tsLit = lookupTimeSeries(d, 'literacy_rate');
  const tsAtt = lookupTimeSeries(d, 'school_attendance');
  const tsNini = lookupTimeSeries(d, 'nini_rate');
  charts.eduEvolution = destroyChart(charts.eduEvolution);
  const ctx1 = document.getElementById('chart-edu-evolution');
  if (ctx1) {
    charts.eduEvolution = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: YEARS,
        datasets: [
          { label: 'Alfabetización 15+', data: tsLit.map(t => t.value), borderColor: COLORS.primary, tension: 0.3 },
          { label: 'Asistencia escolar 6-17', data: tsAtt.map(t => t.value), borderColor: COLORS.success, tension: 0.3 },
          { label: 'NiNi 15-24', data: tsNini.map(t => t.value), borderColor: COLORS.danger, tension: 0.3 }
        ]
      },
      options: getChartDefaults()
    });
  }

  // 2. Mean schooling by sex
  const bySex = lookupByDimension(d, 'mean_schooling', 'sex');
  charts.eduBySex = destroyChart(charts.eduBySex);
  const ctx2 = document.getElementById('chart-edu-sex');
  if (ctx2 && bySex.length > 0) {
    charts.eduBySex = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: bySex.map(x => getDimLabel('sex', x.key, dashboardData.metadata)),
        datasets: [{ label: 'Años promedio', data: bySex.map(x => x.value), backgroundColor: [COLORS.primary, COLORS.danger] }]
      },
      options: deepMerge(getChartDefaults(), { plugins: { legend: { display: false } } })
    });
  }

  // 3. Education by dept
  const eduByDpto = lookupByDimension(d, 'mean_schooling', 'dpto');
  charts.eduByDpto = destroyChart(charts.eduByDpto);
  const ctx3 = document.getElementById('chart-edu-dpto');
  if (ctx3 && eduByDpto.length > 0) {
    charts.eduByDpto = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: eduByDpto.map(x => getDimLabel('dpto', x.key, dashboardData.metadata)),
        datasets: [{ label: 'Años escolaridad', data: eduByDpto.map(x => x.value), backgroundColor: COLORS.success + '99' }]
      },
      options: deepMerge(getChartDefaults(), { indexAxis: 'y', plugins: { legend: { display: false } } })
    });
  }

  // 4. NiNi by area
  const niniByArea = lookupByDimension(d, 'nini_rate', 'area');
  charts.niniByArea = destroyChart(charts.niniByArea);
  const ctx4 = document.getElementById('chart-nini-area');
  if (ctx4 && niniByArea.length > 0) {
    charts.niniByArea = new Chart(ctx4, {
      type: 'bar',
      data: {
        labels: niniByArea.map(x => getDimLabel('area', x.key, dashboardData.metadata)),
        datasets: [{ label: 'NiNi %', data: niniByArea.map(x => x.value), backgroundColor: [COLORS.primary, COLORS.success] }]
      },
      options: deepMerge(getChartDefaults(), { plugins: { legend: { display: false } } })
    });
  }
}

// --- Housing Tab ---
function drawHousingCharts() {
  const d = dashboardData.housing;
  if (!d) return;

  // 1. Radar multi-indicator
  const indIds = ['improved_water', 'has_bathroom', 'improved_sanitation', 'waste_collection',
                  'adequate_floor', 'adequate_walls', 'adequate_roof', 'has_electricity', 'has_internet'];
  const indLabels = ['Agua', 'Baño', 'Saneamiento', 'Basura', 'Piso', 'Paredes', 'Techo', 'Electricidad', 'Internet'];
  const radarData = indIds.map(id => lookupIndicator(d, id)?.v ?? 0);
  charts.housingRadar = destroyChart(charts.housingRadar);
  const ctx1 = document.getElementById('chart-housing-radar');
  if (ctx1) {
    charts.housingRadar = new Chart(ctx1, {
      type: 'radar',
      data: {
        labels: indLabels,
        datasets: [{
          label: filterState.year,
          data: radarData,
          borderColor: COLORS.primary,
          backgroundColor: 'rgba(0,86,179,0.15)',
          pointBackgroundColor: COLORS.primary
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { min: 0, max: 100, ticks: { stepSize: 20 } } },
        plugins: { legend: { position: 'top' } }
      }
    });
  }

  // 2. Urban vs Rural
  const urbanData = indIds.map(id => {
    const byArea = lookupByDimension(d, id, 'area');
    const urban = byArea.find(x => parseInt(x.key) === 1);
    return urban?.value ?? null;
  });
  const ruralData = indIds.map(id => {
    const byArea = lookupByDimension(d, id, 'area');
    const rural = byArea.find(x => parseInt(x.key) === 6);
    return rural?.value ?? null;
  });
  charts.housingUrbanRural = destroyChart(charts.housingUrbanRural);
  const ctx2 = document.getElementById('chart-housing-area');
  if (ctx2) {
    charts.housingUrbanRural = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: indLabels,
        datasets: [
          { label: 'Urbana', data: urbanData, backgroundColor: COLORS.primary + '99' },
          { label: 'Rural', data: ruralData, backgroundColor: COLORS.success + '99' }
        ]
      },
      options: getChartDefaults()
    });
  }

  // 3. Overcrowding evolution
  const tsOver = lookupTimeSeries(d, 'overcrowding');
  charts.housingOvercrowding = destroyChart(charts.housingOvercrowding);
  const ctx3 = document.getElementById('chart-housing-overcrowding');
  if (ctx3) {
    charts.housingOvercrowding = new Chart(ctx3, {
      type: 'line',
      data: {
        labels: YEARS,
        datasets: [{
          label: 'Hacinamiento %', data: tsOver.map(t => t.value),
          borderColor: COLORS.danger, backgroundColor: 'rgba(230,57,70,0.1)', fill: true, tension: 0.3
        }]
      },
      options: deepMerge(getChartDefaults(), { plugins: { legend: { display: false } } })
    });
  }
}

// --- Demographics Tab ---
function drawDemographicsCharts() {
  const d = dashboardData.demographics;
  if (!d) return;

  // 1. Population pyramid
  const pyramidData = d.indicators?.population_pyramid?.data?.['year|age_group|sex'] || {};
  const year = filterState.year;
  const maleData = AGE_LABELS.map(ag => -(pyramidData[`${year}|${ag}|1`]?.v || 0));
  const femaleData = AGE_LABELS.map(ag => pyramidData[`${year}|${ag}|6`]?.v || 0);
  charts.pyramid = destroyChart(charts.pyramid);
  const ctx1 = document.getElementById('chart-pyramid');
  if (ctx1) {
    charts.pyramid = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: AGE_LABELS,
        datasets: [
          { label: 'Hombres', data: maleData, backgroundColor: COLORS.primary + '99' },
          { label: 'Mujeres', data: femaleData, backgroundColor: COLORS.danger + '99' }
        ]
      },
      options: deepMerge(getChartDefaults(), {
        indexAxis: 'y',
        scales: {
          x: {
            ticks: { callback: v => formatNumber(Math.abs(v)) }
          }
        }
      })
    });
  }

  // 2. Urban/Rural doughnut
  const urban = lookupIndicator(d, 'urban_rate');
  charts.urbanDonut = destroyChart(charts.urbanDonut);
  const ctx2 = document.getElementById('chart-urban');
  if (ctx2 && urban?.v != null) {
    charts.urbanDonut = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Urbana', 'Rural'],
        datasets: [{ data: [urban.v, 100 - urban.v], backgroundColor: [COLORS.primary, COLORS.success] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  // 3. Dependency ratio evolution
  const tsDep = lookupTimeSeries(d, 'dependency_ratio');
  charts.depRatio = destroyChart(charts.depRatio);
  const ctx3 = document.getElementById('chart-dependency');
  if (ctx3) {
    charts.depRatio = new Chart(ctx3, {
      type: 'line',
      data: {
        labels: YEARS,
        datasets: [{
          label: 'Razón de dependencia %',
          data: tsDep.map(t => t.value),
          borderColor: COLORS.primary,
          backgroundColor: 'rgba(0,86,179,0.1)',
          fill: true, tension: 0.3
        }]
      },
      options: deepMerge(getChartDefaults(), { plugins: { legend: { display: false } } })
    });
  }

  // 4. Avg household size by dept
  const hhByDpto = lookupByDimension(d, 'avg_hh_size', 'dpto');
  charts.hhSize = destroyChart(charts.hhSize);
  const ctx4 = document.getElementById('chart-hh-size');
  if (ctx4 && hhByDpto.length > 0) {
    charts.hhSize = new Chart(ctx4, {
      type: 'bar',
      data: {
        labels: hhByDpto.map(x => getDimLabel('dpto', x.key, dashboardData.metadata)),
        datasets: [{ label: 'Personas/hogar', data: hhByDpto.map(x => x.value), backgroundColor: COLORS.palette.slice(0, hhByDpto.length) }]
      },
      options: deepMerge(getChartDefaults(), { indexAxis: 'y', plugins: { legend: { display: false } } })
    });
  }
}

const AGE_LABELS = ['0-14', '15-24', '25-34', '35-44', '45-54', '55-64', '65+'];

// --- Tab draw dispatcher ---
function drawCurrentTab() {
  const activeTab = document.querySelector('.nav-tabs .nav-link.active');
  if (!activeTab) return;
  const tab = activeTab.dataset.theme;
  switch (tab) {
    case 'poverty': drawPovertyCharts(); break;
    case 'employment': drawEmploymentCharts(); break;
    case 'income': drawIncomeCharts(); break;
    case 'education': drawEducationCharts(); break;
    case 'housing': drawHousingCharts(); break;
    case 'demographics': drawDemographicsCharts(); break;
    case 'map': if (typeof updateMap === 'function') updateMap(); break;
  }
}
