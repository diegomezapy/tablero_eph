// ============================================================
// map.js - Leaflet choropleth map
// ============================================================

let map = null;
let geoLayer = null;
let mapLegend = null;
let mapInitialized = false;

function initMap() {
  if (mapInitialized) return;
  const container = document.getElementById('mapContainer');
  if (!container) return;

  map = L.map('mapContainer', { zoomControl: true }).setView([-23.5, -58.5], 6);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 12
  }).addTo(map);

  mapLegend = L.control({ position: 'bottomright' });
  mapLegend.onAdd = function () {
    return L.DomUtil.create('div', 'map-legend');
  };
  mapLegend.addTo(map);

  mapInitialized = true;
}

function getMapIndicator() {
  const sel = document.getElementById('mapIndicator');
  if (!sel) return { theme: 'poverty', ind: 'poverty_rate', label: 'Pobreza total' };
  const val = sel.value;
  const [ind, theme] = val.split('|');
  const opt = sel.options[sel.selectedIndex];
  return { theme, ind, label: opt?.text || ind };
}

function updateMap() {
  if (!mapInitialized) initMap();
  if (!map) return;

  const { theme, ind, label } = getMapIndicator();
  const themeData = dashboardData[theme];
  if (!themeData) return;

  const geo = dashboardData.geo;
  if (!geo) return;

  // Get data by department
  const year = filterState.year;
  const dimKey = `year|dpto`;
  const indicator = themeData.indicators?.[ind];
  if (!indicator) return;

  const deptValues = {};
  const dimData = indicator.data[dimKey] || {};
  Object.entries(dimData).forEach(([k, v]) => {
    if (k.startsWith(year + '|')) {
      const dpto = k.split('|')[1];
      deptValues[dpto] = v.v;
    }
  });

  const values = Object.values(deptValues).filter(v => v != null);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  function getColor(val) {
    if (val == null) return '#ccc';
    const range = maxVal - minVal;
    if (range === 0) return '#4a90d9';
    const t = (val - minVal) / range;
    // Color scale: green -> yellow -> red
    if (t < 0.25) return '#2a9d8f';
    if (t < 0.5) return '#e9c46a';
    if (t < 0.75) return '#f4a261';
    return '#e63946';
  }

  if (geoLayer) map.removeLayer(geoLayer);

  geoLayer = L.geoJSON(geo, {
    style: function (feature) {
      const dpto = feature.properties.dpto ?? feature.properties.DPTO ?? feature.properties.cod_dpto;
      const val = deptValues[String(dpto)];
      return {
        fillColor: getColor(val),
        weight: 1.5,
        opacity: 1,
        color: '#fff',
        fillOpacity: 0.7
      };
    },
    onEachFeature: function (feature, layer) {
      const dpto = feature.properties.dpto ?? feature.properties.DPTO ?? feature.properties.cod_dpto;
      const name = feature.properties.dpto_desc ?? feature.properties.DPTO_DESC ??
                    getDimLabel('dpto', dpto, dashboardData.metadata);
      const val = deptValues[String(dpto)];
      const unit = indicator.unit || '';

      layer.bindTooltip(
        `<strong>${name}</strong><br>${label}: ${val != null ? formatValue(val, unit) : 'Sin datos'}`,
        { sticky: true }
      );

      layer.on('click', function () {
        updateFilter('dpto', parseInt(dpto));
      });

      layer.on('mouseover', function () {
        layer.setStyle({ weight: 3, color: '#0056b3' });
      });
      layer.on('mouseout', function () {
        geoLayer.resetStyle(layer);
      });
    }
  }).addTo(map);

  // Update legend
  const legendDiv = document.querySelector('.map-legend');
  if (legendDiv) {
    const steps = [minVal, minVal + (maxVal - minVal) * 0.25, minVal + (maxVal - minVal) * 0.5,
                   minVal + (maxVal - minVal) * 0.75, maxVal];
    const colors = ['#2a9d8f', '#e9c46a', '#f4a261', '#e63946'];
    legendDiv.innerHTML = `<strong style="font-size:11px">${label}</strong><br>` +
      colors.map((c, i) => `<i style="background:${c};width:18px;height:12px;display:inline-block;margin-right:4px;border-radius:2px"></i><span style="font-size:10px">${formatValue(steps[i], indicator.unit)}</span>`).join('<br>');
  }

  // Fit bounds
  if (geoLayer.getBounds().isValid()) {
    map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
  }
}
