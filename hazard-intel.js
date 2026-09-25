(() => {
'use strict';

/* ============================================================
   HIMGAURAV v8 — Location Hazard Intelligence Module
   All data from real upstream APIs. Nothing fabricated.
   Sources:
     - OpenStreetMap Nominatim (geocoding)
     - USGS Earthquake Hazards Program (seismic catalogue)
     - NASA EONET (natural events: landslides, floods, storms)
     - ReliefWeb / UN OCHA (disaster situation reports)
     - Open-Meteo ERA5 archive (90-day rainfall reanalysis)
   ============================================================ */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = (v, d = 1) => Number.isFinite(+v) ? Number(v).toFixed(d) : '—';

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  const d = await r.json();
  if (!r.ok || d?.ok === false) throw new Error(d?.error || `HTTP ${r.status}`);
  return d;
}

/* ---- Geocode ---- */
async function geocode(query) {
  const d = await getJSON(`/api/geocode?q=${encodeURIComponent(query)}`);
  const results = d.results || [];
  if (!results.length) throw new Error(`No location found for: "${query}"`);
  const r = results[0];
  return {
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    label: r.display_name,
    shortLabel: (r.address?.city || r.address?.town || r.address?.county || r.address?.state || query),
  };
}

/* ---- Risk scoring ---- */
function computeRisk(quakes, events, rain) {
  let score = 0;
  // Seismic contribution (0-40 pts)
  if (quakes.count > 0) {
    score += Math.min(20, quakes.count * 0.5);
    if (quakes.max_magnitude >= 6) score += 20;
    else if (quakes.max_magnitude >= 5) score += 12;
    else if (quakes.max_magnitude >= 4) score += 6;
  }
  // Event contribution (0-30 pts)
  const landslides = (events.events || []).filter(e => /landslide/i.test(e.category || ''));
  const floods = (events.events || []).filter(e => /flood/i.test(e.category || ''));
  score += Math.min(20, landslides.length * 4);
  score += Math.min(10, floods.length * 2);
  // Rainfall contribution (0-30 pts)
  if (rain.peak_day_mm > 100) score += 20;
  else if (rain.peak_day_mm > 60) score += 12;
  else if (rain.peak_day_mm > 30) score += 6;
  if (rain.total_90day_mm > 1000) score += 10;
  else if (rain.total_90day_mm > 500) score += 5;

  if (score >= 60) return 'VERY-HIGH';
  if (score >= 35) return 'HIGH';
  if (score >= 15) return 'MODERATE';
  return 'LOW';
}

/* ---- Rainfall mini sparkline (SVG) ---- */
function drawRainSpark(dates, values, containerId) {
  const box = $(containerId);
  if (!box || !values.length) { if (box) box.innerHTML = '<p style="color:#9aaa9e;font-size:12px;padding:4px 0">No daily data available.</p>'; return; }
  const ns = 'http://www.w3.org/2000/svg';
  const W = 440, H = 80, pad = { l: 6, r: 6, t: 8, b: 20 };
  const maxV = Math.max(...values, 1);
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('style', 'width:100%;height:auto');

  const barW = Math.max(2, ((W - pad.l - pad.r) / values.length) - 1);
  values.forEach((v, i) => {
    const x = pad.l + i * ((W - pad.l - pad.r) / values.length);
    const bh = Math.max(2, ((v || 0) / maxV) * (H - pad.t - pad.b));
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', H - pad.b - bh);
    rect.setAttribute('width', barW);
    rect.setAttribute('height', bh);
    const col = v > 60 ? '#f87171' : v > 30 ? '#fb923c' : v > 10 ? '#38bdf8' : '#86efac';
    rect.setAttribute('fill', col);
    rect.setAttribute('rx', '1');
    const title = document.createElementNS(ns, 'title');
    title.textContent = `${dates[i] || ''}: ${n(v, 1)} mm`;
    rect.appendChild(title);
    svg.appendChild(rect);
  });

  // X-axis date labels (every 7 days)
  for (let i = 0; i < dates.length; i += 7) {
    const x = pad.l + i * ((W - pad.l - pad.r) / values.length);
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', x);
    lbl.setAttribute('y', H - 4);
    lbl.setAttribute('fill', '#9aaa9e');
    lbl.setAttribute('font-size', '8');
    lbl.textContent = (dates[i] || '').slice(5); // MM-DD
    svg.appendChild(lbl);
  }

  // Peak marker
  const peakIdx = values.indexOf(Math.max(...values));
  const peakX = pad.l + peakIdx * ((W - pad.l - pad.r) / values.length) + barW / 2;
  const peakBh = ((values[peakIdx] || 0) / maxV) * (H - pad.t - pad.b);
  const ptxt = document.createElementNS(ns, 'text');
  ptxt.setAttribute('x', Math.min(peakX, W - 40));
  ptxt.setAttribute('y', H - pad.b - peakBh - 4);
  ptxt.setAttribute('fill', '#f87171');
  ptxt.setAttribute('font-size', '9');
  ptxt.setAttribute('font-weight', '700');
  ptxt.textContent = `${n(values[peakIdx], 0)} mm`;
  svg.appendChild(ptxt);

  box.innerHTML = '';
  box.appendChild(svg);
}

/* ---- Magnitude colour ---- */
function magColor(m) {
  if (m >= 6) return '#f87171';
  if (m >= 5) return '#fb923c';
  if (m >= 4) return '#facc15';
  return '#86efac';
}

/* ---- Render seismic ---- */
function renderSeismic(quakes) {
  const badge = $('#hSeismicBadge');
  const stats = $('#hSeismicStats');
  const list = $('#hSeismicList');
  if (!badge || !stats || !list) return;
  badge.textContent = `${quakes.count} events`;
  stats.innerHTML = `
    <div class="stat"><span>Total events</span><b>${quakes.count}</b></div>
    <div class="stat"><span>Largest (M)</span><b style="color:${magColor(quakes.max_magnitude)}">${n(quakes.max_magnitude, 1)}</b></div>
    <div class="stat"><span>Avg (M)</span><b>${n(quakes.mean_magnitude, 1)}</b></div>
    <div class="stat"><span>Radius</span><b>${quakes.query?.radius_km} km</b></div>
  `;
  if (!quakes.events.length) {
    list.innerHTML = '<div style="padding:12px 16px;color:#9aaa9e;font-size:12px">No significant earthquakes recorded in this search radius and period.</div>';
    return;
  }
  list.innerHTML = quakes.events.slice(0, 15).map(e => {
    const dt = e.time ? new Date(e.time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const m = e.mag;
    return `<div class="hazard-event-item">
      <span class="h-ev-icon" style="color:${magColor(m)}">⚡</span>
      <div class="h-ev-body">
        <b>M ${n(m, 1)} · ${esc(e.place || 'Unknown location')}</b>
        <span>Depth: ${n(e.depth_km, 1)} km · ${dt}</span>
      </div>
      <div class="h-ev-meta">${e.url ? `<a class="h-ev-link" href="${esc(e.url)}" target="_blank" rel="noopener">USGS ↗</a>` : ''}</div>
    </div>`;
  }).join('');
}

/* ---- Render rainfall ---- */
function renderRain(rain) {
  const badge = $('#hRainBadge');
  const stats = $('#hRainStats');
  if (!badge || !stats) return;
  badge.textContent = `${rain.total_90day_mm} mm / 90d`;
  stats.innerHTML = `
    <div class="stat"><span>90-day total</span><b>${n(rain.total_90day_mm, 0)} mm</b></div>
    <div class="stat"><span>Last 30 days</span><b>${n(rain.recent_30day_mm, 0)} mm</b></div>
    <div class="stat"><span>Peak single day</span><b style="color:${rain.peak_day_mm > 60 ? '#f87171' : '#1d3040'}">${n(rain.peak_day_mm, 1)} mm</b></div>
    <div class="stat"><span>Rainy days</span><b>${rain.days_with_rain}</b></div>
  `;
  drawRainSpark(rain.daily?.dates || [], rain.daily?.rain_mm || [], '#hRainChart');
}

/* ---- Render EONET events ---- */
function renderEvents(events) {
  const badge = $('#hEventsBadge');
  const list = $('#hEventsList');
  if (!badge || !list) return;
  badge.textContent = `${events.count} nearby`;
  if (!events.events.length) {
    list.innerHTML = '<div style="padding:12px 16px;color:#9aaa9e;font-size:12px">No NASA EONET natural events found in this radius / time window. This is a data-coverage limitation, not necessarily absence of events.</div>';
    return;
  }
  const iconMap = { Landslides: '⛰', Floods: '🌊', 'Severe Storms': '🌪', Volcanoes: '🌋' };
  list.innerHTML = events.events.map(e => {
    const dt = e.date ? new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const icon = iconMap[e.category] || '⚠';
    const closed = e.closed ? ` · Closed ${new Date(e.closed).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ' · OPEN';
    return `<div class="hazard-event-item">
      <span class="h-ev-icon">${icon}</span>
      <div class="h-ev-body">
        <b>${esc(e.title)}</b>
        <span>${esc(e.category)} · ${n(e.distance_km, 0)} km away · ${dt}${closed}</span>
      </div>
      <div class="h-ev-meta">${e.link ? `<a class="h-ev-link" href="${esc(e.link)}" target="_blank" rel="noopener">Source ↗</a>` : ''}</div>
    </div>`;
  }).join('');
}

/* ---- Render ReliefWeb reports ---- */
function renderReports(reports) {
  const badge = $('#hReportsBadge');
  const list = $('#hReportsList');
  if (!badge || !list) return;
  badge.textContent = `${reports.count} reports`;
  if (!reports.reports.length) {
    list.innerHTML = '<div style="padding:12px 16px;color:#9aaa9e;font-size:12px">No matching disaster reports found in ReliefWeb for this location. Try broader search terms.</div>';
    return;
  }
  list.innerHTML = reports.reports.map(r => {
    const dt = r.date ? new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const src = (r.source || []).join(', ') || 'UN OCHA';
    const types = (r.type || []).join(', ');
    return `<div class="hazard-event-item">
      <span class="h-ev-icon">📋</span>
      <div class="h-ev-body">
        <b>${esc(r.title)}</b>
        <span>${esc(src)} · ${dt}${types ? ' · ' + esc(types) : ''}</span>
      </div>
      <div class="h-ev-meta">${r.url ? `<a class="h-ev-link" href="${esc(r.url)}" target="_blank" rel="noopener">Read ↗</a>` : ''}</div>
    </div>`;
  }).join('');
}

/* ---- Main analysis function ---- */
let _currentAnalysis = null;

async function analyseLocation(query) {
  // Cancel any pending analysis
  _currentAnalysis = Symbol();
  const token = _currentAnalysis;

  // Show status bar
  const statusEl = $('#hazardStatus');
  const resultsEl = $('#hazardResults');
  const emptyEl = $('#hazardEmpty');
  const riskBadge = $('#hazardRiskBadge');
  const locLabel = $('#hazardLocationLabel');
  const coordsEl = $('#hazardCoords');

  statusEl.removeAttribute('hidden');
  resultsEl.setAttribute('hidden', '');
  emptyEl.setAttribute('hidden', '');
  riskBadge.className = 'hazard-risk-badge COMPUTING';
  riskBadge.textContent = 'LOCATING…';
  locLabel.textContent = query;
  coordsEl.textContent = '';

  // Mark active preset
  document.querySelectorAll('.hazard-preset').forEach(b => {
    b.classList.toggle('active', b.dataset.place === query || b.textContent.includes(query));
  });

  let geo;
  try {
    riskBadge.textContent = 'GEOCODING…';
    geo = await geocode(query);
    if (token !== _currentAnalysis) return; // superseded
    locLabel.textContent = geo.shortLabel;
    coordsEl.textContent = `${geo.lat.toFixed(4)}° N, ${geo.lon.toFixed(4)}° E`;
    riskBadge.textContent = 'FETCHING DATA…';
  } catch (e) {
    riskBadge.className = 'hazard-risk-badge COMPUTING';
    riskBadge.textContent = 'LOCATION NOT FOUND';
    locLabel.textContent = e.message;
    emptyEl.removeAttribute('hidden');
    return;
  }

  const radius = $('#hazardRadius')?.value || 200;
  const days = $('#hazardDays')?.value || 365;
  const minMag = $('#hazardMinMag')?.value || 2.5;

  // Fire all 4 requests in parallel
  const [quakesRes, eventsRes, reportsRes, rainRes] = await Promise.allSettled([
    getJSON(`/api/hazard/quakes?lat=${geo.lat}&lon=${geo.lon}&radius=${radius}&days=${days}&minmag=${minMag}`),
    getJSON(`/api/hazard/events?lat=${geo.lat}&lon=${geo.lon}&radius=${radius}&days=730`),
    getJSON(`/api/hazard/reports?lat=${geo.lat}&lon=${geo.lon}&label=${encodeURIComponent(geo.shortLabel)}`),
    getJSON(`/api/hazard/rain?lat=${geo.lat}&lon=${geo.lon}`),
  ]);

  if (token !== _currentAnalysis) return; // superseded

  const quakes = quakesRes.status === 'fulfilled' ? quakesRes.value : { count: 0, max_magnitude: 0, mean_magnitude: 0, events: [], query: { radius_km: radius }, error: quakesRes.reason?.message };
  const events = eventsRes.status === 'fulfilled' ? eventsRes.value : { count: 0, events: [], error: eventsRes.reason?.message };
  const reports = reportsRes.status === 'fulfilled' ? reportsRes.value : { count: 0, reports: [], error: reportsRes.reason?.message };
  const rain = rainRes.status === 'fulfilled' ? rainRes.value : { total_90day_mm: 0, recent_30day_mm: 0, peak_day_mm: 0, days_with_rain: 0, daily: {}, error: rainRes.reason?.message };

  // Compute overall risk
  const risk = computeRisk(quakes, events, rain);
  const riskLabels = { 'VERY-HIGH': '⚠ VERY HIGH RISK', HIGH: '⚠ HIGH RISK', MODERATE: '⚡ MODERATE RISK', LOW: '✓ LOW ACTIVITY' };
  riskBadge.className = `hazard-risk-badge ${risk}`;
  riskBadge.textContent = riskLabels[risk] || risk;

  // Render all cards
  renderSeismic(quakes);
  renderRain(rain);
  renderEvents(events);
  renderReports(reports);

  resultsEl.removeAttribute('hidden');
}

/* ---- Bind UI ---- */
function bind() {
  const searchBtn = $('#hazardSearchBtn');
  const input = $('#hazardLocationInput');
  if (!searchBtn || !input) return;

  searchBtn.addEventListener('click', () => {
    const q = input.value.trim();
    if (q) analyseLocation(q);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) analyseLocation(q);
    }
  });

  // Preset buttons
  document.querySelectorAll('.hazard-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const place = btn.dataset.place;
      if (input) input.value = place;
      analyseLocation(place);
    });
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
else bind();

})();
