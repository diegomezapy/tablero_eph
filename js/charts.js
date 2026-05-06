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
const WAGE_AGE_LABELS = ['15-24', '25-34', '35-44', '45-54', '55-64', '65+'];

// ============================================================
// --- Wage Trajectories Tab ---
// ============================================================

function getIpcDeflator(year) {
  const ipc = dashboardData.metadata?.ipc;
  if (!ipc) return 1;
  return (ipc[String(ipc.base_year)] || 100) / (ipc[String(year)] || 100);
}

function deflateLabel() {
  const chk = document.getElementById('wage-deflate');
  return chk && chk.checked;
}

function applyDeflation(value, year) {
  if (!deflateLabel() || value == null) return value;
  return value * getIpcDeflator(year);
}

function drawWageCharts() {
  const d = dashboardData.income;
  if (!d) return;

  const year = filterState.year;
  const deflate = deflateLabel();
  const baseYear = dashboardData.metadata?.ipc?.base_year || 2022;
  const yLabel = deflate ? `Gs. constantes ${baseYear}` : 'Gs. corrientes';

  // Sync year labels in headings
  const yl = document.getElementById('wage-year-label');
  const yl2 = document.getElementById('wage-gap-year');
  if (yl) yl.textContent = year;
  if (yl2) yl2.textContent = year;

  // --- 1. Wage trajectory by age group (multi-year lines) ---
  const trajDatasets = YEARS.map((y, i) => {
    const vals = WAGE_AGE_LABELS.map(ag => {
      // look up year|age_group
      const entry = d.indicators?.mean_wage_age?.data?.['year|age_group']?.[`${y}|${ag}`];
      return entry?.v != null ? applyDeflation(entry.v, y) : null;
    });
    return {
      label: String(y),
      data: vals,
      borderColor: COLORS.palette[i],
      backgroundColor: COLORS.paletteLight[i],
      tension: 0.35,
      fill: false,
      pointRadius: 5,
      pointHoverRadius: 7
    };
  });

  charts.wageTraj = destroyChart(charts.wageTraj);
  const ctx1 = document.getElementById('chart-wage-trajectory');
  if (ctx1) {
    const title = deflate ? `Trayectoria salarial — Gs. constantes ${baseYear}` : 'Trayectoria salarial por grupo de edad';
    const titleEl = document.getElementById('wage-traj-title');
    if (titleEl) titleEl.textContent = title;

    charts.wageTraj = new Chart(ctx1, {
      type: 'line',
      data: { labels: WAGE_AGE_LABELS, datasets: trajDatasets },
      options: deepMerge(getChartDefaults(), {
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatGs(ctx.raw)}` } }
        },
        scales: {
          y: { ticks: { callback: v => formatNumber(v) }, title: { display: true, text: yLabel, font: { size: 10 } } }
        }
      })
    });
  }

  // --- 2. Income by sex x age group (grouped bar, current year) ---
  const maleVals = WAGE_AGE_LABELS.map(ag => {
    const entry = d.indicators?.mean_wage_age?.data?.['year|age_group|sex']?.[`${year}|${ag}|1`];
    return entry?.v != null ? applyDeflation(entry.v, year) : null;
  });
  const femaleVals = WAGE_AGE_LABELS.map(ag => {
    const entry = d.indicators?.mean_wage_age?.data?.['year|age_group|sex']?.[`${year}|${ag}|6`];
    return entry?.v != null ? applyDeflation(entry.v, year) : null;
  });

  charts.wageSexAge = destroyChart(charts.wageSexAge);
  const ctx2 = document.getElementById('chart-wage-sex-age');
  if (ctx2) {
    charts.wageSexAge = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: WAGE_AGE_LABELS,
        datasets: [
          { label: 'Hombre', data: maleVals, backgroundColor: COLORS.primary + 'cc' },
          { label: 'Mujer',  data: femaleVals, backgroundColor: COLORS.danger + 'cc' }
        ]
      },
      options: deepMerge(getChartDefaults(), {
        plugins: { tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatGs(ctx.raw)}` } } },
        scales: { y: { ticks: { callback: v => formatNumber(v) } } }
      })
    });
  }

  // --- 3. Evolution line (mean + median wages, respects all active filters) ---
  const tsMeanW = YEARS.map(y => {
    const entry = _aggregateLookup(d.indicators?.mean_wage_age?.data, getActiveFilters(), y);
    return { year: y, value: entry?.v != null ? applyDeflation(entry.v, y) : null };
  });
  const tsMedianW = YEARS.map(y => {
    const entry = _aggregateLookup(d.indicators?.median_wage_age?.data, getActiveFilters(), y);
    return { year: y, value: entry?.v != null ? applyDeflation(entry.v, y) : null };
  });

  charts.wageEvol = destroyChart(charts.wageEvol);
  const ctx3 = document.getElementById('chart-wage-evolution');
  if (ctx3) {
    charts.wageEvol = new Chart(ctx3, {
      type: 'line',
      data: {
        labels: YEARS,
        datasets: [
          { label: `Ingreso medio (${yLabel})`, data: tsMeanW.map(t => t.value), borderColor: COLORS.primary, tension: 0.3 },
          { label: `Ingreso mediano (${yLabel})`, data: tsMedianW.map(t => t.value), borderColor: COLORS.success, tension: 0.3, borderDash: [5,3] }
        ]
      },
      options: deepMerge(getChartDefaults(), {
        plugins: { tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatGs(ctx.raw)}` } } },
        scales: { y: { ticks: { callback: v => formatNumber(v) } } }
      })
    });
  }

  // --- 4. Gender gap by age group (ratio H/M) ---
  const gapVals = WAGE_AGE_LABELS.map((ag, i) => {
    const m = maleVals[i], f = femaleVals[i];
    if (m == null || f == null || f === 0) return null;
    return parseFloat((m / f).toFixed(3));
  });
  const gapColors = gapVals.map(v => v == null ? COLORS.gray : v > 1 ? COLORS.primary + 'cc' : COLORS.danger + 'cc');

  charts.wageGap = destroyChart(charts.wageGap);
  const ctx4 = document.getElementById('chart-wage-gap');
  if (ctx4) {
    charts.wageGap = new Chart(ctx4, {
      type: 'bar',
      data: {
        labels: WAGE_AGE_LABELS,
        datasets: [{
          label: 'Ratio Hombre/Mujer',
          data: gapVals,
          backgroundColor: gapColors
        }]
      },
      options: deepMerge(getChartDefaults(), {
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ctx.raw != null ? `Ratio: ${ctx.raw.toFixed(2)}x` : 'N/D' } },
          annotation: {}
        },
        scales: {
          y: {
            min: 0.7,
            ticks: { callback: v => v.toFixed(2) + 'x' },
            title: { display: true, text: 'H / M', font: { size: 10 } }
          }
        }
      })
    });
    // Draw reference line at 1.0 via annotation plugin fallback (CSS approach)
  }
}

// ============================================================
// --- Excel Export ---
// ============================================================

function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    alert('La librería de Excel no está disponible. Verifique la conexión a internet.');
    return;
  }

  const d = dashboardData.income;
  const meta = dashboardData.metadata;
  if (!d) { alert('Los datos de ingresos aún no están cargados.'); return; }

  const wb = XLSX.utils.book_new();
  const deflate = deflateLabel();
  const baseYear = meta?.ipc?.base_year || 2022;
  const ipcNote = deflate ? `Gs. const. ${baseYear}` : 'Gs. corrientes';

  // Helper: apply deflation
  const defl = (v, y) => (v != null && deflate) ? Math.round(v * getIpcDeflator(y)) : (v != null ? Math.round(v) : '');

  // Helper: get wage entry from cross-tab
  const getW = (ind, crossKey, lookupKey) =>
    d.indicators?.[ind]?.data?.[crossKey]?.[lookupKey];

  // Helper: build a sheet for a single dimension breakdown
  function sheetByDim(dimKey, dimLabels, crossTab) {
    const header = ['Año', 'Categoría', `Ingreso Medio (${ipcNote})`, `Ingreso Mediano (${ipcNote})`, 'N obs.'];
    const rows = [header];
    YEARS.forEach(y => {
      dimLabels.forEach(([k, label]) => {
        const lookup = `${y}|${k}`;
        const em = getW('mean_wage_age', crossTab, lookup);
        const emed = getW('median_wage_age', crossTab, lookup);
        rows.push([y, label, defl(em?.v, y), defl(emed?.v, y), em?.n ?? '']);
      });
    });
    return rows;
  }

  // Helper: build a sheet for two-dimension cross-tab
  function sheetBy2Dims(dim1Labels, dim2Labels, crossTab, d1name, d2name) {
    const header = ['Año', d1name, d2name, `Ingreso Medio (${ipcNote})`, `Ingreso Mediano (${ipcNote})`, 'N obs.'];
    const rows = [header];
    YEARS.forEach(y => {
      dim1Labels.forEach(([k1, l1]) => {
        dim2Labels.forEach(([k2, l2]) => {
          // cross-tab key is alphabetically sorted in data
          const lookup = `${y}|${k1}|${k2}`;
          const em = getW('mean_wage_age', crossTab, lookup);
          const emed = getW('median_wage_age', crossTab, lookup);
          if (em || emed) {
            rows.push([y, l1, l2, defl(em?.v, y), defl(emed?.v, y), em?.n ?? '']);
          }
        });
      });
    });
    return rows;
  }

  // Label maps
  const ageLbls  = WAGE_AGE_LABELS.map(ag => [ag, ag + ' años']);
  const sexLbls  = [[1, 'Hombre'], [6, 'Mujer']];
  const areaLbls = [[1, 'Urbana'], [6, 'Rural']];
  const condLbls = [[1, 'Ocupado/a'], [2, 'Desocupado/a'], [3, 'Inactivo/a']];
  const cateLbls = Object.entries(meta?.cate_pea || {}).map(([k, v]) => [parseInt(k), v]);
  const ramaLbls = Object.entries(meta?.rama_pea || {}).map(([k, v]) => [parseInt(k), v]);
  const dptoLbls = Object.entries(meta?.departments || {}).map(([k, v]) => [parseInt(k), v]).sort((a,b)=>a[0]-b[0]);

  // ---- Sheet: Serie_Anual (with active filters) ----
  const active = getActiveFilters();
  const filterDesc = active.length > 0
    ? active.map(f => `${getDimLabel(f.dim, f.val, meta)}`).join(' / ')
    : 'Sin filtros';
  const rowsAnual = [
    [`Filtros: ${filterDesc}`, '', '', ''],
    ['Año', `Ingreso Medio (${ipcNote})`, `Ingreso Mediano (${ipcNote})`, 'N obs.']
  ];
  YEARS.forEach(y => {
    const sorted = [...active].sort((a, b) => a.dim.localeCompare(b.dim));
    let key, lookup;
    if (sorted.length === 0) { key = 'year'; lookup = String(y); }
    else { key = 'year|' + sorted.map(f => f.dim).join('|'); lookup = y + '|' + sorted.map(f => f.val).join('|'); }
    const em = getW('mean_wage_age', key, lookup);
    const emed = getW('median_wage_age', key, lookup);
    rowsAnual.push([y, defl(em?.v, y), defl(emed?.v, y), em?.n ?? '']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsAnual), 'Serie_Anual');

  // ---- Sheet: Por_Edad ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetByDim('age_group', ageLbls, 'year|age_group')), 'Por_Edad');

  // ---- Sheet: Por_Sexo ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetByDim('sex', sexLbls, 'year|sex')), 'Por_Sexo');

  // ---- Sheet: Por_Area ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetByDim('area', areaLbls, 'year|area')), 'Por_Area');

  // ---- Sheet: Por_Departamento ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetByDim('dpto', dptoLbls, 'year|dpto')), 'Por_Departamento');

  // ---- Sheet: Por_Condicion ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetByDim('condact', condLbls, 'year|condact')), 'Por_Condicion');

  // ---- Sheet: Por_Categoria ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetByDim('cate_pea', cateLbls, 'year|cate_pea')), 'Por_Categoria');

  // ---- Sheet: Por_Rama ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetByDim('rama_pea', ramaLbls, 'year|rama_pea')), 'Por_Rama');

  // ---- Sheet: Edad_x_Sexo (age_group < sex alphabetically) ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetBy2Dims(ageLbls, sexLbls, 'year|age_group|sex', 'Grupo Edad', 'Sexo')), 'Edad_x_Sexo');

  // ---- Sheet: Edad_x_Area ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetBy2Dims(ageLbls, areaLbls, 'year|age_group|area', 'Grupo Edad', 'Area')), 'Edad_x_Area');

  // ---- Sheet: Edad_x_Condicion ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetBy2Dims(ageLbls, condLbls, 'year|age_group|condact', 'Grupo Edad', 'Condición')), 'Edad_x_Condicion');

  // ---- Sheet: Edad_x_Categoria ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetBy2Dims(ageLbls, cateLbls, 'year|age_group|cate_pea', 'Grupo Edad', 'Categoría')), 'Edad_x_Categoria');

  // ---- Sheet: Edad_x_Rama ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetBy2Dims(ageLbls, ramaLbls, 'year|age_group|rama_pea', 'Grupo Edad', 'Rama')), 'Edad_x_Rama');

  // ---- Sheet: Area_x_Sexo ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetBy2Dims(areaLbls, sexLbls, 'year|area|sex', 'Área', 'Sexo')), 'Area_x_Sexo');

  // ---- Sheet: Area_x_Categoria ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetBy2Dims(areaLbls, cateLbls, 'year|area|cate_pea', 'Área', 'Categoría')), 'Area_x_Categoria');

  // ---- Sheet: Area_x_Rama ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetBy2Dims(areaLbls, ramaLbls, 'year|area|rama_pea', 'Área', 'Rama')), 'Area_x_Rama');

  // ---- Sheet: Categoria_x_Sexo ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetBy2Dims(cateLbls, sexLbls, 'year|cate_pea|sex', 'Categoría', 'Sexo')), 'Categoria_x_Sexo');

  // ---- Sheet: Rama_x_Sexo ----
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    sheetBy2Dims(ramaLbls, sexLbls, 'year|rama_pea|sex', 'Rama', 'Sexo')), 'Rama_x_Sexo');

  // ---- Sheet: Brecha_Salarial (ratio H/M by year × age_group) ----
  const rowsBrecha = [['Año', 'Grupo Edad', 'Ratio H/M', `Ingreso Hombre (${ipcNote})`, `Ingreso Mujer (${ipcNote})`]];
  YEARS.forEach(y => {
    WAGE_AGE_LABELS.forEach(ag => {
      const em = getW('mean_wage_age', 'year|age_group|sex', `${y}|${ag}|1`);
      const ef = getW('mean_wage_age', 'year|age_group|sex', `${y}|${ag}|6`);
      const vm = em?.v != null ? (deflate ? em.v * getIpcDeflator(y) : em.v) : null;
      const vf = ef?.v != null ? (deflate ? ef.v * getIpcDeflator(y) : ef.v) : null;
      const ratio = vm != null && vf != null && vf > 0 ? parseFloat((vm / vf).toFixed(3)) : '';
      rowsBrecha.push([y, ag, ratio, vm != null ? Math.round(vm) : '', vf != null ? Math.round(vf) : '']);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsBrecha), 'Brecha_Salarial');

  // ---- Sheet: Masa_Edad_Simple (wage mass + workers by individual age, sex, year, cate_pea) ----
  const detailData = d.indicators?.wage_simple_age?.data;
  if (detailData) {
    const cateNames = { '0': 'Total ocupados', ...Object.fromEntries(Object.entries(meta?.cate_pea || {})) };
    const rowsDet = [[
      'Año', 'Edad simple', 'Sexo', 'Categoría ocupacional',
      `Masa Salarial (${ipcNote})`, 'Trabajadores (ponderados)', 'N obs.',
      `Ingreso Medio implícito (${ipcNote})`
    ]];
    Object.entries(detailData).sort((a, b) => {
      const [ay, aa, as_, ac] = a[0].split('|').map(Number);
      const [by, ba, bs, bc] = b[0].split('|').map(Number);
      return ay - by || aa - ba || as_ - bs || ac - bc;
    }).forEach(([k, v]) => {
      const [yr, age, sex, cate] = k.split('|');
      const sexLbl = sex === '1' ? 'Hombre' : 'Mujer';
      const cateLbl = cateNames[cate] || `Cat ${cate}`;
      const deflFac = deflate ? getIpcDeflator(parseInt(yr)) : 1;
      const masa    = Math.round(v.masa * deflFac);
      const workers = Math.round(v.w);
      const mean    = workers > 0 ? Math.round(masa / workers) : '';
      rowsDet.push([parseInt(yr), parseInt(age), sexLbl, cateLbl, masa, workers, v.n, mean]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsDet), 'Masa_Edad_Simple');
  }

  // ---- Sheet: IPC_Deflactor ----
  const ipc = meta?.ipc || {};
  const rowsIpc = [
    ['Fuente:', ipc.note || 'BCP Paraguay'],
    ['Año base:', String(ipc.base_year || 2022)],
    [],
    ['Año', 'IPC (promedio anual)', 'Factor deflactor (base=2022)']
  ];
  YEARS.forEach(y => {
    const iv = ipc[String(y)] || '';
    const fac = iv ? parseFloat((100 / iv).toFixed(4)) : '';
    rowsIpc.push([y, iv, fac]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsIpc), 'IPC_Deflactor');

  const fname = `trayectorias_salariales_EPHC_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}

// ============================================================
// --- Formality Tab ---
// ============================================================

function updateFormalityKPIs() {
  const d = dashboardData.formality;
  if (!d) return;

  const fkpis = [
    { id: 'fkpi-formality',  ind: 'formality_rate',  label: 'Formalidad',           unit: '%' },
    { id: 'fkpi-ips',        ind: 'ips_rate',         label: 'Cobertura IPS',        unit: '%' },
    { id: 'fkpi-ruc',        ind: 'ruc_has_rate',     label: 'Establec. con RUC',    unit: '%' },
    { id: 'fkpi-nocotiza',   ind: 'no_cotiza_rate',   label: 'Sin cobertura prev.',  unit: '%', invertTrend: true },
  ];

  fkpis.forEach(k => {
    const el = document.getElementById(k.id);
    if (!el) return;
    const current = lookupIndicator(d, k.ind);
    const savedYear = filterState.year;
    let prev = null;
    if (savedYear - 1 >= 2022) {
      filterState.year = savedYear - 1;
      prev = lookupIndicator(d, k.ind);
      filterState.year = savedYear;
    }
    const valEl = el.querySelector('.kpi-value');
    const trendEl = el.querySelector('.kpi-trend-container');
    if (valEl) valEl.textContent = formatValue(current?.v, k.unit);
    if (trendEl && prev && current?.v != null && prev.v != null) {
      const diff = current.v - prev.v;
      const arrow = diff > 0 ? 'bi-arrow-up-short' : diff < 0 ? 'bi-arrow-down-short' : 'bi-dash';
      const cls = k.invertTrend ? (diff < 0 ? 'up' : diff > 0 ? 'down' : '') : (diff > 0 ? 'up' : diff < 0 ? 'down' : '');
      const diffText = Math.abs(diff).toFixed(1);
      trendEl.innerHTML = `<span class="kpi-trend ${cls}"><i class="bi ${arrow}"></i>${diffText}pp</span>`;
    } else if (trendEl) {
      trendEl.innerHTML = '';
    }
  });
}

function drawFormalityCharts() {
  const d = dashboardData.formality;
  if (!d) return;

  updateFormalityKPIs();

  // 1. Evolution: formality + informality over years
  const tsFormal   = lookupTimeSeries(d, 'formality_rate');
  const tsInformal = lookupTimeSeries(d, 'informality_rate');
  charts.formalityEvolution = destroyChart(charts.formalityEvolution);
  const ctx1 = document.getElementById('chart-formality-evolution');
  if (ctx1) {
    charts.formalityEvolution = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: YEARS,
        datasets: [
          { label: 'Formal',   data: tsFormal.map(t => t.value),   borderColor: COLORS.success, backgroundColor: 'rgba(42,157,143,0.1)', fill: true, tension: 0.3 },
          { label: 'Informal', data: tsInformal.map(t => t.value), borderColor: COLORS.warning, backgroundColor: 'rgba(233,196,106,0.1)', fill: true, tension: 0.3 }
        ]
      },
      options: deepMerge(getChartDefaults(), { plugins: { legend: { position: 'top' } } })
    });
  }

  // 2. IPS coverage donut
  const ipsYes   = lookupIndicator(d, 'ips_rate');
  const ipsOtra  = lookupIndicator(d, 'otra_caja_rate');
  const ipsNo    = lookupIndicator(d, 'no_cotiza_rate');
  charts.ipsDonut = destroyChart(charts.ipsDonut);
  const ctx2 = document.getElementById('chart-ips-donut');
  if (ctx2) {
    charts.ipsDonut = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Cotiza IPS', 'Otra caja', 'No cotiza'],
        datasets: [{ data: [ipsYes?.v, ipsOtra?.v, ipsNo?.v], backgroundColor: [COLORS.primary, COLORS.success, COLORS.danger] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  // 3. Formality by empresa size
  const byTama = lookupByDimension(d, 'formality_rate', 'tama_emp');
  charts.formalityTama = destroyChart(charts.formalityTama);
  const ctx3 = document.getElementById('chart-formality-tama');
  if (ctx3 && byTama.length > 0) {
    charts.formalityTama = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: byTama.map(x => getDimLabel('tama_emp', x.key, dashboardData.metadata)),
        datasets: [{ label: 'Formalidad %', data: byTama.map(x => x.value), backgroundColor: COLORS.success + '99' }]
      },
      options: deepMerge(getChartDefaults(), { indexAxis: 'y', plugins: { legend: { display: false } } })
    });
  }

  // 4. RUC donut
  const rucYes     = lookupIndicator(d, 'ruc_has_rate');
  const rucNo      = lookupIndicator(d, 'ruc_no_rate');
  const rucUnknown = lookupIndicator(d, 'ruc_unknown_rate');
  charts.rucDonut = destroyChart(charts.rucDonut);
  const ctx4 = document.getElementById('chart-ruc-donut');
  if (ctx4) {
    charts.rucDonut = new Chart(ctx4, {
      type: 'doughnut',
      data: {
        labels: ['Tiene RUC', 'Sin RUC', 'No sabe'],
        datasets: [{ data: [rucYes?.v, rucNo?.v, rucUnknown?.v], backgroundColor: [COLORS.success, COLORS.danger, COLORS.warning] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  // 5. Formality by rama_pea
  const byRama = lookupByDimension(d, 'formality_rate', 'rama_pea');
  charts.formalityRama = destroyChart(charts.formalityRama);
  const ctx5 = document.getElementById('chart-formality-rama');
  if (ctx5 && byRama.length > 0) {
    charts.formalityRama = new Chart(ctx5, {
      type: 'bar',
      data: {
        labels: byRama.map(x => getDimLabel('rama_pea', x.key, dashboardData.metadata)),
        datasets: [{ label: 'Formalidad %', data: byRama.map(x => x.value), backgroundColor: COLORS.primary + '99' }]
      },
      options: deepMerge(getChartDefaults(), { indexAxis: 'y', plugins: { legend: { display: false } } })
    });
  }

  // 6. Formality + IPS by cate_pea (grouped bar)
  const byCate    = lookupByDimension(d, 'formality_rate', 'cate_pea');
  const byIpsCate = lookupByDimension(d, 'ips_rate',       'cate_pea');
  charts.formalityCate = destroyChart(charts.formalityCate);
  const ctx6 = document.getElementById('chart-formality-cate');
  if (ctx6 && byCate.length > 0) {
    const cateLabels = byCate.map(x => getDimLabel('cate_pea', x.key, dashboardData.metadata));
    const ipsByKey = Object.fromEntries(byIpsCate.map(x => [x.key, x.value]));
    charts.formalityCate = new Chart(ctx6, {
      type: 'bar',
      data: {
        labels: cateLabels,
        datasets: [
          { label: 'Formalidad %',  data: byCate.map(x => x.value),           backgroundColor: COLORS.success + '99' },
          { label: 'Cotiza IPS %',  data: byCate.map(x => ipsByKey[x.key] ?? null), backgroundColor: COLORS.primary + '99' }
        ]
      },
      options: deepMerge(getChartDefaults(), { plugins: { legend: { position: 'top' } } })
    });
  }
}

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
    case 'wages':     drawWageCharts(); break;
    case 'formality': drawFormalityCharts(); break;
    case 'map': if (typeof updateMap === 'function') updateMap(); break;
  }
}
