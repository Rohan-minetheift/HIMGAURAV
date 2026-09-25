(() => {
'use strict';

/* HIMGAURAV v8 — map-first scientific interface with Validation + SAR Lab.
   The core rainfall threshold/state logic below is preserved from the audited
   prototype. UI changes do not change the scientific decision rule. */

const CFG = {
  wxRefreshMs: 10 * 60 * 1000,
  sensorPollMs: 30 * 1000,
  fetchTimeoutMs: 12000,
  staleWarnMs: 30 * 60 * 1000,
  staleFailMs: 3 * 60 * 60 * 1000,
  sensorStaleMs: 10 * 60 * 1000,
  sensorDeadMs: 60 * 60 * 1000,
  sensorBaselineN: 30,
  weatherCacheKey: 'himgaurav.v2.weather',
  customSitesKey: 'himgaurav.v2.sites',
  reportKey: 'himgaurav.v2.reports',
  sensorConfigKey: 'himgaurav.v2.sensor',
  rescueKey: 'himgaurav.v2.rescue',
  alertSettingsKey: 'himgaurav.v6.alert-settings',
  alertAuditKey: 'himgaurav.v6.alert-audit',
  alertDraftKey: 'himgaurav.v6.alert-draft'
};

const THRESH = { a:7.20, b:-0.26, durations:[1,2,3,5,7,10], anteDays:30, anteMm:110 };
const SENSOR_RULES = { anomalySigma:3, anomalySustain:3, minAbsDeg:0.05, noisyDeg:0.25 };
const STATES = {
  NODATA:{lv:0,word:'NO DATA',glyph:'?',color:'#647278'},
  CONTEXT:{lv:0,word:'REGIONAL',glyph:'R',color:'#4f7080'},
  NORMAL:{lv:1,word:'NORMAL',glyph:'✓',color:'#1f7a4d'},
  MONITOR:{lv:2,word:'MONITOR',glyph:'!',color:'#9a690b'},
  WATCH:{lv:3,word:'WATCH',glyph:'!!',color:'#c35724'},
  WARNING:{lv:4,word:'WARNING',glyph:'▲',color:'#b42421'}
};

const BASE_SITES = [
  { id:'kotrupi', name:'Kotrupi', area:'Padhar tehsil, Mandi · NH-154', lat:31.9104, lon:76.8906, kind:'slope', inDomain:false,
    basis:'Documented individual failure slope. The rainfall curve used here was not fitted at Kotrupi.', cites:[2,3,4] },
  { id:'shimla', name:'Shimla', area:'Shimla district', lat:31.1048, lon:77.1734, kind:'town', inDomain:true,
    basis:'The published intensity–duration curve used by this prototype was fitted from Shimla landslide dates and daily rainfall.', cites:[1] },
  { id:'mandi', name:'Mandi', area:'Mandi district', lat:31.7084, lon:76.9319, kind:'town', inDomain:false,
    basis:'District-centre screening point. This is not a slope polygon or a district-wide measurement.', cites:[5,9] },
  { id:'kullu', name:'Kullu', area:'Kullu district', lat:31.9578, lon:77.1095, kind:'town', inDomain:false,
    basis:'District-centre screening point. Gridded rainfall at this coordinate must not be generalized to the whole district.', cites:[5] },
  { id:'dharamshala', name:'Dharamshala', area:'Kangra district', lat:32.2190, lon:76.3234, kind:'town', inDomain:false,
    basis:'District-centre screening point for regional context, not a specific instrumented slope.', cites:[6] },
  { id:'solan', name:'Solan', area:'Solan district', lat:30.9045, lon:77.0967, kind:'town', inDomain:false,
    basis:'District-centre screening point. The Shimla curve is an extrapolation here.', cites:[7] }
];

const PRECURSOR_SIGNS = [
  {id:'crack',label:'New ground crack',detail:'New or widening crack in ground, pavement or a foundation.'},
  {id:'tilt',label:'Tilted pole, fence or tree',detail:'A pole, fence line or tree has started leaning.'},
  {id:'spring',label:'New spring or seepage',detail:'New water emerging from the ground or sudden wetness.'},
  {id:'muddy',label:'Muddy water / stream change',detail:'A normally clear stream becomes muddy or changes level suddenly.'},
  {id:'jam',label:'Doors or windows jamming',detail:'New sticking or gaps opening around a frame.'},
  {id:'sound',label:'Faint rumbling / cracking',detail:'A new sound that may grow louder.'},
  {id:'bulge',label:'Bulging ground',detail:'Ground bulging outward at the base of a slope.'}
];


const ACUSEARCH_MODALITIES = {
  wifi:{label:'Wi‑Fi 2.4 GHz',metric:'RSSI',unit:'dBm',color:'#2f77a6'},
  ble:{label:'Bluetooth LE',metric:'RSSI',unit:'dBm',color:'#6a5aa8'},
  audible:{label:'Audible tone',metric:'Mic level',unit:'dBFS',color:'#9a690b'},
  wired:{label:'Wired contact control',metric:'Mic level',unit:'dBFS',color:'#1f7a4d'}
};
const ACUSEARCH_MOISTURE = ['dry','damp','saturated'];
const SOURCES = [
  {t:'Singh, Thakur, Dhiman, Chandel, Kishore & Manocha — Development of rainfall threshold equation and Bayesian probabilistic analysis for landslide prediction: Shimla, Northwestern Himalaya',m:'Natural Hazards Research 5(3), 455–467, 2025',u:'Intensity–duration curve I = 7.20·D^-0.26 and the 110 mm / 30-day antecedent reference used by the screen.',l:'https://www.sciencedirect.com/science/article/pii/S2666592124000969'},
  {t:'Petley — Kotrupi: a landslide in northern India kills at least 46 people',m:'AGU Landslide Blog, 13 Aug 2017',u:'Kotrupi event context, NH-154 location and run-out description.',l:'https://blogs.agu.org/landslideblog/2017/08/13/kotrupi-1/'},
  {t:'Singh, Gupta & Shukla — Analysis of landslide reactivation using satellite data: Kotrupi, Mandi',m:'ISPRS Archives, 2020',u:'Kotrupi reactivation sequence and satellite-based study.',l:'https://isprs-archives.copernicus.org/articles/XLII-3-W11/137/2020/'},
  {t:'Identifying reactivation zones in the Kotrupi landslide through UAV, satellite image and slope stability analysis',m:'2026',u:'Recent UAV / satellite / DEM-based assessment of Kotrupi reactivation zones.',l:'https://pubmed.ncbi.nlm.nih.gov/42365019/'},
  {t:'Himachal Pradesh State Emergency Operations Centre assessment, 30 Jun – 11 Sep 2026 (reported)',m:'Reported 12 Sep 2026',u:'Dated monsoon impacts and blocked-road context retained as reference, not live data.',l:'https://thenewsmill.com/2026/09/himachal-pradesh-monsoon-losses-exceed-rs-1661-crore-with-296-deaths-in-74-days/'},
  {t:'Himachal Pradesh rainfall bulletin, 12 Sep 2026',m:'Reported 12 Sep 2026',u:'Dated station-rainfall reference used by the audited prototype.',l:'https://www.rozanaspokesman.com/news/himachal-pradesh/120926/light-to-moderate-rainfall-forecast-across-state-through-september-17-s.html'},
  {t:'Jallayu, Singh, Onyelowe, Sharma & Tiwary — Rainfall-induced landslides in Himachal Pradesh: a review',m:'Cogent Engineering 12(1), 2025',u:'Himachal landslide research context and real-time rainfall integration gap.',l:'https://doi.org/10.1080/23311916.2025.2530569'},
  {t:'Geological Survey of India — National Landslide Forecasting Centre / Bhusanket activities',m:'Official portal',u:'Official regional landslide-forecasting programme context.',l:'https://bhusanket.gsi.gov.in/Activities_V9.html'},
  {t:'Geological Survey of India — note on landslide hazards and early warning',m:'8 Aug 2024',u:'National susceptibility mapping and slope-specific warning-system context.',l:'https://bhusanket.gsi.gov.in/Public_Portal_News_pdf/Revised%20Note%20on%20Landslide%20Hazards%20&%20Early%20Warning_GSI_08.08.2024.cleaned.pdf'},
  {t:'GSI Bhukosh — national geoscience data repository',m:'Official portal',u:'Authoritative source for Indian geoscience / landslide inventory layers; not silently scraped by this app.',l:'https://bhukosh.gsi.gov.in/'},
  {t:'ISRO Bhuvan — geoplatform',m:'Official portal',u:'Indian satellite/geospatial reference portal.',l:'https://bhuvan.nrsc.gov.in/'},
  {t:'Open-Meteo forecast API',m:'Free / no key for non-commercial use; model data',u:'Live browser retrieval of current, past-days and forecast precipitation at monitored coordinates.',l:'https://open-meteo.com/en/docs'},
  {t:'USGS FDSN Event Web Service',m:'Free / no key',u:'Regional earthquake catalogue shown only as context, never as a slope-state input.',l:'https://earthquake.usgs.gov/fdsnws/event/1/'},
  {t:'Abraham, Satyam, Pradhan & Rosi — field-based monitoring to enhance rainfall thresholds',m:'Water 12(12), 3453, 2020',u:'Evidence behind requiring independent field corroboration rather than a rainfall-only top warning state.',l:'https://doi.org/10.3390/w12123453'},
  {t:'Cook et al. — Detection and potential early warning of catastrophic flow events with regional seismic networks',m:'Science 374, 2021',u:'Why real seismic networks are relevant — and why low-cadence IoT samples are not equivalent.',l:'https://www.science.org/doi/10.1126/science.abj1227'},
  {t:'Wu et al. — P-Alert low-cost MEMS accelerometer network',m:'Scientific Reports, 2025 analysis',u:'Dense MEMS seismic-network context and 100 Hz sampling benchmark.',l:'https://www.nature.com/articles/s41598-025-97748-z'},
  {t:'Lopez-Pastor et al. — Victim detection and localization in emergencies',m:'Sensors 22(21), 8433, 2022',u:'Wi‑Fi FTM and UWB ranging under rubble; informs the AcuSearch evidence gap.',l:'https://doi.org/10.3390/s22218433'},
  {t:'NDMA SACHET — National Disaster Alert Portal',m:'Official NDMA / C-DOT platform · current 2026',u:'Authoritative Indian CAP-based geo-targeted multilingual alerting context. HIMGAURAV does not claim publishing access.',l:'https://sachet.ndma.gov.in/'},
  {t:'C-DOT CAP Integrated Alert System',m:'Department of Telecommunications / C-DOT, 2026',u:'Official architecture reference for multilingual multi-media dissemination including SMS, Cell Broadcast, app, TV/radio, RSS, browser notification and satellite.',l:'https://deveservices.dot.gov.in/sites/default/files/products/cap.pdf'},
  {t:'ITU-T X.1303bis — Common Alerting Protocol (CAP 1.2)',m:'ITU standard',u:'Standards basis for the downloadable multilingual CAP XML alert package.',l:'https://www.itu.int/rec/T-REC-X.1303bis-201403-I/en'},
  {t:'Digital India BHASHINI — Dhruva translation pipeline',m:'Developer documentation',u:'Optional server-side machine translation connector. Output remains operator-review material before public dissemination.',l:'https://bhashini-developer-portal-dev.bhashini.co.in/docs/api/overview'},
  {t:'Ground-penetrating-radar depth guides for soil type',m:'Practitioner references',u:'Physical basis for treating wet clay / saturated soil as a serious RF/radar attenuation problem.',l:'https://www.spengineeringinc.com/site-investigation/geophysical-surveys/ground-penetrating-radar/'},
  {t:'Human Vulnerability to Landslides',m:'Peer-reviewed / PMC',u:'Burial/asphyxiation context used in the rescue rationale.',l:'https://pmc.ncbi.nlm.nih.gov/articles/PMC7096057/'},
  {t:'U.S. Geological Survey — Landslide Preparedness',m:'Official reference',u:'Publicly published visible precursor signs used by local-report checklists.',l:'https://www.usgs.gov/programs/landslide-hazards/landslide-preparedness'},
  {t:'Hariharan & Guntha — Crowdsourced Landslide Tracking',m:'EGU General Assembly, 2021',u:'Data-quality limitations of crowdsourced landslide reporting; reports are therefore kept separate from automated state.',l:'https://ui.adsabs.harvard.edu/abs/2021EGUGA..2312711H/abstract'},
  {t:'Smart Disaster Detection and Alerting System Using IoT-Based Edge Sensing',m:'IEEE DataPort, 2025',u:'Cloud-dependency limitation motivating local on-node alert logic.',l:'https://ieee-dataport.org/documents/smart-disaster-detection-and-alerting-system-using-iot-based-edge-sensing'},
  {t:'NASA Global Imagery Browse Services (GIBS)',m:'Earthdata web services',u:'Actual Earth-observation imagery layer exposed through WMS/WMTS without fabricating satellite graphics.',l:'https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs'},
  {t:'RainViewer Weather Maps API',m:'Public weather-radar tile API',u:'Recent past radar frames where coverage exists. Missing pixels are not treated as no rainfall.',l:'https://www.rainviewer.com/api/weather-maps-api.html'},
  {t:'Copernicus Data Space Ecosystem — Sentinel Hub authentication',m:'OAuth2 documentation',u:'Explains why Sentinel layers are an optional secure proxy integration instead of a client-secret-in-browser shortcut.',l:'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/Authentication.html'},
  {t:'NASA Alaska Satellite Facility — SAR Search API',m:'Official ASF DAAC API documentation',u:'Real Sentinel-1 IW SLC acquisition discovery and ASF baseline-pair search used by the SAR/InSAR lab.',l:'https://docs.asf.alaska.edu/api/keywords/'},
  {t:'ASF HyP3 — Sentinel-1 InSAR Product Guide',m:'Official on-demand processing documentation',u:'Real cloud InSAR processing, coherence/unwrapped phase, optional displacement/look-vector/incidence outputs and their interpretation limits.',l:'https://hyp3-docs.asf.alaska.edu/guides/insar_product_guide/'},
  {t:'ASF HyP3 — API and authentication',m:'Official HyP3 service documentation',u:'Server-side INSAR_GAMMA job submission using NASA Earthdata credentials; credentials never live in browser code.',l:'https://hyp3-docs.asf.alaska.edu/using/api/'},
  {t:'India Meteorological Department — Current Weather API',m:'Official IMD API reference',u:'Official Sundernagar station comparison, including last-24-hour rainfall, temperature and humidity where reported.',l:'https://api.imd.gov.in/public/api_reference.html'},
  {t:'WMO — Guide to Instruments and Methods of Observation (WMO-No. 8)',m:'International measurement/metrology guidance',u:'Reference framework for precipitation measurement, instrument calibration, exposure, quality assurance and traceability.',l:'https://community.wmo.int/site/knowledge-hub/programmes-and-initiatives/instruments-and-methods-of-observation-programme-imop/guide-instruments-and-methods-of-observation-wmo-no-8'},
  {t:'Soil-Specific Calibration and Integration of Low-Cost Capacitive Soil Moisture Sensors',m:'Peer-reviewed open-access study, 2026',u:'Evidence that low-cost capacitive probes require soil-specific calibration against independent water-content reference measurements.',l:'https://pmc.ncbi.nlm.nih.gov/articles/PMC13364378/'},
  {t:'IoT-Based Geotechnical Monitoring of Unstable Slopes for Landslide Early Warning in the Darjeeling Himalayas',m:'Sensors 20(9), 2611, 2020',u:'Himalayan field example combining MEMS tilt and volumetric water-content sensing rather than relying on one trigger alone.',l:'https://www.mdpi.com/1424-8220/20/9/2611'},
  {t:'Kotrupi landslide deformation study using DInSAR and MTInSAR on Sentinel-1 SAR',m:'Advances in Space Research, 2022',u:'Historical research benchmark for retrospective Sentinel-1 deformation analysis at the documented 13 Aug 2017 Kotrupi event.',l:'https://www.sciencedirect.com/science/article/pii/S0273117721008917'}
];


const SAT_PRODUCTS = {
  'hls-s2': {
    label:'Sentinel‑2 / HLS surface reflectance', short:'Sentinel‑2 · 30 m',
    layer:'HLS_S30_Nadir_BRDF_Adjusted_Reflectance', provider:'NASA EOSDIS GIBS · HLS Sentinel‑2',
    resolution:'30 m', lagDays:3, temporal:'Daily product · dated imagery',
    note:'High-resolution Sentinel‑2 surface reflectance for visible scar, vegetation and road-cut context. Cloud and acquisition gaps remain real gaps; they are never filled with synthetic imagery.'
  },
  'viirs-true': {
    label:'VIIRS Suomi NPP corrected reflectance · true colour', short:'VIIRS true colour',
    layer:'VIIRS_SNPP_CorrectedReflectance_TrueColor', provider:'NASA EOSDIS GIBS · Suomi NPP / VIIRS',
    resolution:'375–750 m source bands', lagDays:1, temporal:'Daily near-real-time product · dated imagery',
    note:'Near-real-time regional true-colour context. Useful for cloud, snow and broad surface context; it is too coarse to measure a small landslide scar by itself.'
  },
  'viirs-false': {
    label:'VIIRS Suomi NPP corrected reflectance · M11/I2/I1', short:'VIIRS false colour',
    layer:'VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1', provider:'NASA EOSDIS GIBS · Suomi NPP / VIIRS',
    resolution:'375–750 m source bands', lagDays:1, temporal:'Daily near-real-time product · dated imagery',
    note:'False-colour combination emphasizes land-surface contrasts more strongly than natural colour. It is contextual evidence, not an automatic landslide detector.'
  },
  'modis-terra': {
    label:'MODIS Terra corrected reflectance · true colour', short:'MODIS Terra',
    layer:'MODIS_Terra_CorrectedReflectance_TrueColor', provider:'NASA EOSDIS GIBS · Terra / MODIS',
    resolution:'250–500 m source bands', lagDays:1, temporal:'Daily product · dated imagery',
    note:'Long-running daily true-colour context from Terra. Resolution is regional; use it for cloud/snow/land-surface context rather than slope displacement.'
  }
 };

const INDIAN_LANGUAGES = [
  {code:'en',bcp:'en-IN',name:'English',native:'English'},
  {code:'hi',bcp:'hi-IN',name:'Hindi',native:'हिन्दी'},
  {code:'as',bcp:'as-IN',name:'Assamese',native:'অসমীয়া'},
  {code:'bn',bcp:'bn-IN',name:'Bengali',native:'বাংলা'},
  {code:'brx',bcp:'brx-IN',name:'Bodo',native:'बड़ो'},
  {code:'doi',bcp:'doi-IN',name:'Dogri',native:'डोगरी'},
  {code:'gu',bcp:'gu-IN',name:'Gujarati',native:'ગુજરાતી'},
  {code:'kn',bcp:'kn-IN',name:'Kannada',native:'ಕನ್ನಡ'},
  {code:'ks',bcp:'ks-IN',name:'Kashmiri',native:'کٲشُر'},
  {code:'gom',bcp:'kok-IN',name:'Konkani',native:'कोंकणी'},
  {code:'mai',bcp:'mai-IN',name:'Maithili',native:'मैथिली'},
  {code:'ml',bcp:'ml-IN',name:'Malayalam',native:'മലയാളം'},
  {code:'mni',bcp:'mni-IN',name:'Manipuri',native:'মৈতৈলোন্'},
  {code:'mr',bcp:'mr-IN',name:'Marathi',native:'मराठी'},
  {code:'ne',bcp:'ne-IN',name:'Nepali',native:'नेपाली'},
  {code:'or',bcp:'or-IN',name:'Odia',native:'ଓଡ଼ିଆ'},
  {code:'pa',bcp:'pa-IN',name:'Punjabi',native:'ਪੰਜਾਬੀ'},
  {code:'sa',bcp:'sa-IN',name:'Sanskrit',native:'संस्कृतम्'},
  {code:'sat',bcp:'sat-IN',name:'Santali',native:'ᱥᱟᱱᱛᱟᱲᱤ'},
  {code:'sd',bcp:'sd-IN',name:'Sindhi',native:'سنڌي'},
  {code:'ta',bcp:'ta-IN',name:'Tamil',native:'தமிழ்'},
  {code:'te',bcp:'te-IN',name:'Telugu',native:'తెలుగు'},
  {code:'ur',bcp:'ur-IN',name:'Urdu',native:'اردو'}
];
const DEFAULT_ALERT_SETTINGS={language:'hi',radius:3,voiceRate:0.95,autoDraft:'watch',browserNotify:false,autoSpeak:false,highContrast:false};
function languageMeta(code){return INDIAN_LANGUAGES.find(x=>x.code===code)||INDIAN_LANGUAGES[0];}
const ALERT_LOCALES = window.HIMGAURAV_ALERT_LOCALES || {};
const RTL_ALERT_LANGS=new Set(['ur','ks','sd']);
function applyAlertDirection(code){const dir=RTL_ALERT_LANGS.has(code)?'rtl':'ltr';for(const id of ['alertHeadline','alertDescription','alertInstruction']){const el=$('#'+id);if(el){el.dir=dir;el.lang=languageMeta(code).bcp;}}const card=$('#citizenAlertCard');if(card){card.dir=dir;card.lang=languageMeta(code).bcp;}}
function fmtAlertTemplate(text,vars={}){return String(text||'').replace(/\{([a-zA-Z]+)\}/g,(m,k)=>vars[k]??m);}
function localAlertLocale(code){return ALERT_LOCALES[code]||ALERT_LOCALES.en||null;}
function buildLocalizedAlert(code,s=site(),r=computeStateFor(s)){
  const loc=localAlertLocale(code)||localAlertLocale('en');
  const state=loc?.state?.[r.state]||r.state;
  const ev=r.ev;
  const ratio=Number.isFinite(ev?.maxRatio)?nfmt(ev.maxRatio,2):'—';
  const days=Number.isFinite(ev?.maxD)?ev.maxD:'—';
  const vars={site:s.name,state,ratio,days};
  const headline=fmtAlertTemplate(loc?.title?.[r.state]||loc?.title?.NORMAL||'{site}',vars);
  let description='';
  if(ev&&Number.isFinite(ev.maxRatio)) description=fmtAlertTemplate(loc.rain,vars);
  else description=`${s.name} · ${state}.`;
  if(r.state==='WARNING') description+=` ${loc.groundYes||''}`;
  else if(r.state==='WATCH') description+=` ${loc.groundNo||''}`;
  description+=` ${loc.disclaimer||''}`;
  const instruction=loc?.instruction?.[r.state]||loc?.instruction?.NORMAL||'';
  return {headline:headline.trim(),description:description.replace(/\s+/g,' ').trim(),instruction:instruction.trim(),severity:alertSeverityFor(r.state),language:code,source:'HIMGAURAV built-in operational template',reviewed:code==='en',template:true};
}
function languageTemplateAvailable(code){return !!localAlertLocale(code);}
function localizeCurrentLanguage({force=false}={}){
  const code=$('#alertLanguage')?.value||APP.alertSettings.language||'en';
  if(!languageTemplateAvailable(code)) return false;
  APP.alertDraft.translations=APP.alertDraft.translations||{};
  const existing=APP.alertDraft.translations[code];
  if(existing?.reviewed&&!force){setAlertInputs(existing);return true;}
  const block=buildLocalizedAlert(code,site(),computeStateFor(site()));
  APP.alertDraft.translations[code]=block;
  setAlertInputs(block);
  saveAlertDraft();
  return true;
}
function generateAllLanguagePack(){
  const s=site(),r=computeStateFor(s);APP.alertDraft.translations={};
  for(const l of INDIAN_LANGUAGES){if(languageTemplateAvailable(l.code))APP.alertDraft.translations[l.code]=buildLocalizedAlert(l.code,s,r);}
  APP.alertDraft.translations.en.reviewed=true;
  saveAlertDraft();renderSavedLanguages();renderLanguageCoverage();renderAlertPreview();
  auditAlert('LANGUAGE PACK',`${Object.keys(APP.alertDraft.translations).length} local language blocks regenerated from current ${r.state} evidence.`);
  toast(`${Object.keys(APP.alertDraft.translations).length}-language alert pack generated locally.`);
}
function browserVoices(){try{return 'speechSynthesis' in window?window.speechSynthesis.getVoices():[];}catch(e){return[];}}
function matchingVoiceFor(code){
  const m=languageMeta(code),voices=browserVoices();if(!voices.length)return null;
  const exact=voices.find(v=>(v.lang||'').toLowerCase()===m.bcp.toLowerCase());if(exact)return exact;
  const prefix=m.bcp.split('-')[0].toLowerCase();return voices.find(v=>(v.lang||'').toLowerCase().split('-')[0]===prefix)||null;
}
function voiceCapability(code){
  if(APP.alertConnectors.bhashiniTts)return {ok:true,kind:'remote',label:'BHASHINI TTS configured'};
  const v=matchingVoiceFor(code);return v?{ok:true,kind:'browser',voice:v,label:`Browser voice: ${v.name}`}:{ok:false,kind:'none',label:`No installed ${languageMeta(code).name} voice on this browser`};
}

function isoDaysAgo(days){const d=new Date(Date.now()-days*864e5);return d.toISOString().slice(0,10);}
function shiftISODate(iso,days){const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function satMeta(){return SAT_PRODUCTS[APP.satProduct]||SAT_PRODUCTS['hls-s2'];}

const $ = (s,r=document) => r.querySelector(s);
const $$ = (s,r=document) => Array.from(r.querySelectorAll(s));
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const nfmt = (v,d=1) => Number.isFinite(v) ? Number(v).toFixed(d).replace(/\.0$/,'') : '—';
const todayISO = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const istTime = t => new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t));
const istDateTime = t => new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(t));
const ageStr = ms => { if(!Number.isFinite(ms)||ms<0)return '—'; const m=Math.floor(ms/60000); if(m<1)return 'just now'; if(m<60)return `${m} min ago`; const h=Math.floor(m/60); if(h<48)return `${h} h ago`; return `${Math.floor(h/24)} d ago`; };
const storeGet = (k,fallback) => { try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fallback; }catch{return fallback;} };
const storeSet = (k,v) => { try{localStorage.setItem(k,JSON.stringify(v));}catch{} };
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const median = a => { const b=a.filter(Number.isFinite).slice().sort((x,y)=>x-y); if(!b.length)return NaN; const m=Math.floor(b.length/2); return b.length%2?b[m]:(b[m-1]+b[m])/2; };
const mad = (a,m) => median(a.map(x=>Math.abs(x-m)));
const localTs = s => { if(!s)return NaN; const z=/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s); return Date.parse(z?s:`${s}+05:30`); };
function idThreshold(D){ return THRESH.a*Math.pow(D,THRESH.b); }

function freshSensor(){ return {channel:null,siteId:'kotrupi',status:'none',health:'NONE',healthWhy:'No public channel connected.',samples:[],latest:{},fetchedAt:0,lastTs:0,cadenceMs:0,baseline:NaN,noise:NaN,dev:NaN,rate:NaN,fields:{tilt:1,moisture:0,rain:0,battery:0,rssi:0}}; }
function freshCtx(){ return {weather:Object.create(null),quakes:{status:'idle',features:[],fetchedAt:0,error:''},radar:{status:'idle',frame:null,fetchedAt:0,error:''},sensor:freshSensor(),log:[],lastStates:Object.create(null)}; }

const customSites = storeGet(CFG.customSitesKey,[]).filter(s=>Number.isFinite(+s.lat)&&Number.isFinite(+s.lon));
const APP = {
  mode:'live',view:'command',siteId:'kotrupi',sites:BASE_SITES.concat(customSites),
  live:freshCtx(),demo:null,demoStage:0,forecastHour:0,
  reports:storeGet(CFG.reportKey,{}),measurements:storeGet(CFG.rescueKey,[]),
  map:null,layers:{},markers:new Map(),forecastLayer:null,quakeLayer:null,sensorMarker:null,
  satMap:null,satLayer:null,satBase:null,satMarker:null,satProduct:'viirs-true',satDate:isoDaysAgo(1),satTileState:'idle',satTileErrors:0,
  alertSettings:{...DEFAULT_ALERT_SETTINGS,...storeGet(CFG.alertSettingsKey,{})},
  alertDraft:storeGet(CFG.alertDraftKey,{translations:{}})||{translations:{}},
  alertAudit:storeGet(CFG.alertAuditKey,[]),
  alertZone:null,officialAlerts:[],officialAlertsFetchedAt:0,alertConnectors:{bhashini:false,bhashiniTts:false,agencyWebhook:false,localGateway:false,sachetFeed:false,server:false},lastAutoAlert:Object.create(null),
  timers:{weather:0,sensor:0,clock:0},toast:0
};

let acuAudioCtx=null, acuOsc=null, acuGain=null;
let acuMicStream=null, acuMicCtx=null, acuMicAnalyser=null, acuMicSource=null, acuMicRAF=0;
let acuMicCurrent=NaN, acuMicPeak=-Infinity;

function ctx(){return APP.mode==='demo'?APP.demo:APP.live;}
function site(){return APP.sites.find(s=>s.id===APP.siteId)||APP.sites[0];}

async function getJSON(url){
  const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),CFG.fetchTimeoutMs);
  try{ const r=await fetch(url,{signal:ctrl.signal,cache:'no-store'}); if(!r.ok)throw new Error(`HTTP ${r.status}`); return {ok:true,data:await r.json()}; }
  catch(e){ return {ok:false,error:e?.name==='AbortError'?'timeout':(e?.message||'network error')}; }
  finally{clearTimeout(timer);}
}

async function postJSON(url,payload){
  const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),CFG.fetchTimeoutMs);
  try{
    const r=await fetch(url,{method:'POST',signal:ctrl.signal,cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    let data={};try{data=await r.json();}catch{}
    if(!r.ok||data?.ok===false)throw new Error(data?.error||`HTTP ${r.status}`);
    return {ok:true,data};
  }catch(e){return {ok:false,error:e?.name==='AbortError'?'timeout':(e?.message||'network error')};}
  finally{clearTimeout(timer);}
}

/* LIVE services prefer the same-origin Python gateway because it avoids browser
   CORS/network-policy surprises. Static hosting still works: if /api/* is not
   available, the app falls back to the official public endpoint directly. */
async function getLiveJSON(proxyPath,directUrl){
  const canUseGateway=/^https?:$/.test(location.protocol);
  if(canUseGateway){
    const p=await getJSON(proxyPath);
    if(p.ok&&p.data?.ok===true&&Object.prototype.hasOwnProperty.call(p.data,'data')){
      return {ok:true,data:p.data.data,via:'gateway',gatewayCached:!!p.data.cached_by_gateway,source:p.data.source||''};
    }
  }
  const d=await getJSON(directUrl);
  return d.ok?{...d,via:'direct',gatewayCached:false}:{...d,via:'unavailable',gatewayCached:false};
}

function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(APP.toast); APP.toast=setTimeout(()=>t.classList.remove('show'),2800); }
function setFeed(id,status,label){ const e=$(id); if(!e)return; e.className=`feed-chip ${status||''}`; const em=e.querySelector('em'); if(em)em.textContent=label; }
function logEvent(kind,title,detail='',source=''){
  const c=ctx(); c.log.unshift({t:Date.now(),kind,title,detail,source,mode:APP.mode}); if(c.log.length>240)c.log.length=240; renderEvents();
}

function buildSeries(payload){
  if(!payload?.daily||!Array.isArray(payload.daily.time)||!Array.isArray(payload.daily.precipitation_sum))return null;
  const time=payload.daily.time,mm=payload.daily.precipitation_sum; if(time.length!==mm.length||time.length<8)return null;
  const today=todayISO(); let idx=time.indexOf(today);
  if(idx<0){ for(let i=time.length-1;i>=0;i--){if(time[i]<=today){idx=i;break;}} }
  if(idx<0)return null;
  const vals=mm.map(v=>(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<2000)?v:null);
  /* Do not let today's full-day forecast masquerade as rainfall already received.
     When hourly model data is available, replace today's daily total with only
     modelled precipitation up to the current clock time. Future days remain forecast. */
  if(Array.isArray(payload.hourly?.time)&&Array.isArray(payload.hourly?.precipitation)){
    const now=Date.now();let sum=0,n=0;
    for(let i=0;i<payload.hourly.time.length;i++){
      const t=localTs(payload.hourly.time[i]),v=payload.hourly.precipitation[i];
      if(!Number.isFinite(t)||t>now)continue;
      const d=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
      if(d!==today)continue;
      if(Number.isFinite(v)&&v>=0){sum+=v;n++;}
    }
    if(n)vals[idx]=sum;
  }
  return {dates:time.slice(),mm:vals,todayIdx:idx};
}
function sumWindow(series,endIdx,days){ let sum=0,n=0,missing=0; for(let i=endIdx-days+1;i<=endIdx;i++){ if(i<0){missing++;continue;} const v=series.mm[i]; if(v==null)missing++; else{sum+=v;n++;} } return {sum,n,missing}; }
function evaluateThreshold(series){
  if(!series)return null; const i=series.todayIdx,rows=[]; let maxRatio=0,maxD=null,anyExceed=false;
  for(const D of THRESH.durations){ const w=sumWindow(series,i,D),thr=idThreshold(D); if(w.n<D){rows.push({D,cum:null,I:null,thr,ratio:null,missing:w.missing});continue;} const I=w.sum/D,ratio=I/thr; if(ratio>maxRatio){maxRatio=ratio;maxD=D;} if(ratio>=1)anyExceed=true; rows.push({D,cum:w.sum,I,thr,ratio,missing:0}); }
  const ante=sumWindow(series,i-1,THRESH.anteDays),r72=sumWindow(series,i,3),r24=series.mm[i];
  return {rows,maxRatio,maxD,anyExceed,ante30:ante.n>=THRESH.anteDays-3?ante.sum:null,anteMissing:ante.missing,r24:r24==null?null:r24,r72:r72.n>=3?r72.sum:null,coverage:rows.filter(r=>r.ratio!=null).length/THRESH.durations.length};
}
function computeStateFor(s,c=ctx()){
  const w=c.weather[s.id],out={state:'NODATA',why:'',reasons:[],stale:false,cached:false,ev:null,series:null,sensorUsed:false};
  if(!w?.ok||!w.series){out.why=w?.error?`Rainfall could not be read (${w.error}). Unknown is not the same as safe.`:'No rainfall data has been received yet.';return out;}
  const age=Date.now()-w.fetchedAt; out.cached=!!w.cached;
  if(age>CFG.staleFailMs){out.stale=true;out.why=`The last successful rainfall read is ${ageStr(age)} and is too old for current screening.`;return out;}
  if(age>CFG.staleWarnMs)out.stale=true;
  const ev=evaluateThreshold(w.series); out.ev=ev;out.series=w.series;
  if(ev){const r24=rollingPrecip(w.hourly,24),r72=rollingPrecip(w.hourly,72);if(r24!=null)ev.r24=r24;if(r72!=null)ev.r72=r72;}
  if(!ev||ev.coverage<.5){out.why='Too many rainfall gaps to evaluate enough threshold durations.';return out;}
  /* Town/district-centre points are regional context, not instrumented slopes.
     They keep rainfall metrics visible but never receive slope-warning labels. */
  if(s.kind==='town'){
    out.state='CONTEXT';
    out.why='Regional rainfall context only. This coordinate is not a monitored slope, so HIMGAURAV does not issue MONITOR/WATCH/WARNING labels here.';
    out.reasons.push({ok:false,text:`Regional screen only · peak Shimla-threshold ratio ${nfmt(ev.maxRatio,2)}×. No slope-specific warning state is generated.`});
    return out;
  }
  const sensorAnom=c.sensor.status==='ok'&&c.sensor.health==='ANOMALY'&&c.sensor.siteId===s.id;
  out.sensorUsed=c.sensor.status==='ok'; let st;
  if(!ev.anyExceed){st='NORMAL';out.reasons.push({ok:false,text:`No 1–10 day duration reaches the curve. Highest ratio ${nfmt(ev.maxRatio,2)}× at ${ev.maxD||'—'} day${ev.maxD===1?'':'s'}.`});}
  else if(ev.maxRatio>=2||(ev.ante30!=null&&ev.ante30>=THRESH.anteMm)){st='WATCH';out.reasons.push({ok:true,text:`Threshold exceeded; peak ${nfmt(ev.maxRatio,2)}× at ${ev.maxD}-day duration.`}); if(ev.ante30!=null&&ev.ante30>=THRESH.anteMm)out.reasons.push({ok:true,text:`30-day antecedent rainfall ${nfmt(ev.ante30,0)} mm ≥ ${THRESH.anteMm} mm reference.`});}
  else{st='MONITOR';out.reasons.push({ok:true,text:`Threshold exceeded at ${ev.maxD}-day duration (${nfmt(ev.maxRatio,2)}×), but not strongly.`});}
  if(st==='WATCH'&&sensorAnom){st='WARNING';out.reasons.push({ok:true,text:'A sustained inclination anomaly is present on the same slope. Two independent signals agree.'});}
  else if(st==='WATCH'){out.reasons.push({ok:false,text:c.sensor.status==='ok'?'No same-slope inclination anomaly; state stops at WATCH.':'No reporting ground instrument on this slope; WARNING is unreachable by design.'});}
  out.state=st; out.why=st==='NORMAL'?'Rainfall remains below the published intensity–duration curve at all tested durations.':st==='MONITOR'?'Rainfall has entered the historical threshold band; inspect trend and local evidence.':st==='WATCH'?'Rainfall screening is strongly elevated, but no independent same-slope instrument confirms movement.':'Rainfall WATCH and a sustained same-slope inclination anomaly agree.';
  return out;
}

function analyseSensor(s){
  const n=s.samples.length; s.dev=NaN;s.rate=NaN;
  if(!n){s.health='NO SAMPLES';s.healthWhy=`The channel responded, but field ${s.fields.tilt} has no numeric tilt values.`;return;}
  const ts=s.samples.map(p=>p.t),diffs=[]; for(let i=1;i<ts.length;i++)diffs.push(ts[i]-ts[i-1]); s.cadenceMs=diffs.length?median(diffs):0;s.lastTs=ts[n-1]; const age=Date.now()-s.lastTs;
  const half=s.samples.slice(0,Math.max(SENSOR_RULES.anomalySustain,Math.floor(n/2))),vals=half.map(p=>p.v); s.baseline=median(vals); const m=mad(vals,s.baseline); s.noise=Number.isFinite(m)&&m>0?m:.02; s.dev=s.samples[n-1].v-s.baseline;
  const recent=s.samples.slice(-6); if(recent.length>=2){const dt=(recent.at(-1).t-recent[0].t)/3600000;s.rate=dt>0?(recent.at(-1).v-recent[0].v)/dt:0;}
  if(age>CFG.sensorDeadMs){s.health='DISCONNECTED';s.healthWhy=`Newest sample is ${ageStr(age)}. Treat the site as uninstrumented until telemetry returns.`;return;}
  if(age>CFG.sensorStaleMs||(s.cadenceMs&&age>s.cadenceMs*5)){s.health='STALE';s.healthWhy=`Newest sample is ${ageStr(age)} against a normal cadence of about ${Math.round((s.cadenceMs||0)/1000)} s.`;return;}
  if(n<CFG.sensorBaselineN){s.health='BASELINING';s.healthWhy=`Collecting baseline: ${n} of ${CFG.sensorBaselineN} numeric tilt samples.`;return;}
  if(s.noise>SENSOR_RULES.noisyDeg){s.health='NOISY';s.healthWhy=`Measured scatter ${nfmt(s.noise,3)}° exceeds the ${SENSOR_RULES.noisyDeg}° quality limit.`;return;}
  const lim=Math.max(SENSOR_RULES.anomalySigma*s.noise,SENSOR_RULES.minAbsDeg),sustained=s.samples.slice(-SENSOR_RULES.anomalySustain).every(p=>Math.abs(p.v-s.baseline)>lim);
  if(sustained&&Math.abs(s.dev)>lim){s.health='ANOMALY';s.healthWhy=`Inclination is ${nfmt(Math.abs(s.dev),3)}° from baseline, beyond ${nfmt(lim,3)}° (3× measured noise), sustained for ${SENSOR_RULES.anomalySustain} samples.`;return;}
  s.health='HEALTHY';s.healthWhy=`Reporting on time; scatter ${nfmt(s.noise,3)}°, deviation ${nfmt(Math.abs(s.dev),3)}° against a ${nfmt(lim,3)}° limit.`;
}

function weatherURL(sites){
  const lat=sites.map(s=>s.lat).join(','),lon=sites.map(s=>s.lon).join(',');
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&hourly=precipitation,soil_moisture_0_to_7cm,soil_moisture_7_to_28cm&current=temperature_2m,relative_humidity_2m,precipitation&past_days=31&forecast_days=7&timezone=Asia%2FKolkata`;
}
function weatherProxyURL(sites){
  const lat=encodeURIComponent(sites.map(s=>s.lat).join(',')),lon=encodeURIComponent(sites.map(s=>s.lon).join(','));
  return `/api/weather?latitude=${lat}&longitude=${lon}`;
}
function hourlyFrom(payload){
  if(!payload?.hourly||!Array.isArray(payload.hourly.time)||!Array.isArray(payload.hourly.precipitation))return [];
  const sm0=payload.hourly.soil_moisture_0_to_7cm||[],sm1=payload.hourly.soil_moisture_7_to_28cm||[];
  return payload.hourly.time.map((t,i)=>({
    t:localTs(t),
    p:Number.isFinite(payload.hourly.precipitation[i])?payload.hourly.precipitation[i]:null,
    soil0:Number.isFinite(sm0[i])?sm0[i]:null,
    soil1:Number.isFinite(sm1[i])?sm1[i]:null
  })).filter(x=>Number.isFinite(x.t));
}
function rollingPrecip(hourly,hours){
  if(!Array.isArray(hourly)||!hourly.length)return null;
  const end=Date.now(),start=end-hours*3600e3;let sum=0,n=0;
  for(const h of hourly){if(h.t>start&&h.t<=end&&Number.isFinite(h.p)){sum+=h.p;n++;}}
  return n>=Math.floor(hours*.75)?sum:null;
}

function cacheWeather(){
  const out={}; for(const id in APP.live.weather){const w=APP.live.weather[id];if(w?.ok)out[id]={series:w.series,hourly:w.hourly,current:w.current,fetchedAt:w.fetchedAt,obsTime:w.obsTime};}
  storeSet(CFG.weatherCacheKey,{savedAt:Date.now(),weather:out});
}
function restoreWeather(){
  const c=storeGet(CFG.weatherCacheKey,null); if(!c?.weather)return 0; let n=0;
  for(const id in c.weather){const w=c.weather[id];if(!w?.series)continue; const idx=w.series.todayIdx;if(w.series.dates?.[idx]!==todayISO())continue;APP.live.weather[id]={...w,ok:true,error:'',cached:true};n++;}
  return n;
}
async function fetchWeather(userTriggered=false){
  if(APP.mode==='demo')return;
  setFeed('#feedWeather','', 'fetching'); const sites=APP.sites.slice(); let payloads=null,mode='batch';
  const batch=await getLiveJSON(weatherProxyURL(sites),weatherURL(sites));
  if(batch.ok){const arr=Array.isArray(batch.data)?batch.data:[batch.data];if(arr.length===sites.length)payloads=arr;}
  if(!payloads){mode='per-site'; const all=await Promise.all(sites.map(s=>getLiveJSON(weatherProxyURL([s]),weatherURL([s]))));payloads=all.map(r=>r.ok?(Array.isArray(r.data)?r.data[0]:r.data):({__err:r.error}));}
  const now=Date.now();let ok=0,fail=0;
  sites.forEach((s,i)=>{const p=payloads[i],prev=APP.live.weather[s.id];if(!p||p.__err){fail++;APP.live.weather[s.id]=prev?.ok?{...prev,error:p?.__err||'unreachable'}:{ok:false,error:p?.__err||batch.error||'unreachable',fetchedAt:0};return;} const series=buildSeries(p);if(!series){fail++;APP.live.weather[s.id]={ok:false,error:'payload shape not recognised',fetchedAt:0};return;}ok++;APP.live.weather[s.id]={ok:true,series,hourly:hourlyFrom(p),current:p.current||null,fetchedAt:now,obsTime:p.current?.time?localTs(p.current.time):0,error:'',cached:false};});
  if(ok){cacheWeather();setFeed('#feedWeather','ok',`${ok}/${sites.length} live model`);logEvent('feed','Rainfall model refreshed',`${ok}/${sites.length} coordinates read${fail?`; ${fail} failed`:''}.`,`Open‑Meteo · ${batch.via||mode}`);if(userTriggered)toast(`Live rainfall model refreshed for ${ok}/${sites.length} sites.`);}else{setFeed('#feedWeather','bad','unreachable');logEvent('feed','Rainfall model unavailable',batch.error||'All site requests failed.','Open‑Meteo');if(userTriggered)toast('Rainfall feed is unreachable.');}
  detectStateChanges(APP.live); renderAll();
}
async function fetchQuakes(){
  if(APP.mode==='demo')return; const c=APP.live;c.quakes.status='loading';
  const start=new Date(Date.now()-90*864e5).toISOString().slice(0,10),url=`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&minlatitude=29.8&maxlatitude=33.6&minlongitude=75.0&maxlongitude=79.6&minmagnitude=2.5&orderby=time&limit=60`;
  const r=await getLiveJSON('/api/quakes',url);if(r.ok&&Array.isArray(r.data?.features)){c.quakes={status:'ok',features:r.data.features,fetchedAt:Date.now(),error:''};logEvent('feed','USGS seismic catalogue refreshed',`${r.data.features.length} M2.5+ events in the 90-day regional window.`,'USGS FDSN');}else{c.quakes={status:'error',features:[],fetchedAt:Date.now(),error:r.error||'bad payload'};logEvent('feed','USGS seismic catalogue unavailable',c.quakes.error,'USGS FDSN');}
  drawQuakes();
}
async function fetchRadar(){
  if(APP.mode==='demo'){setFeed('#feedRadar','sim','simulated');return false;} setFeed('#feedRadar','','fetching');
  const r=await getLiveJSON('/api/radar','https://api.rainviewer.com/public/weather-maps.json'); if(r.ok&&r.data?.host&&Array.isArray(r.data?.radar?.past)&&r.data.radar.past.length){const frame=r.data.radar.past.at(-1);APP.live.radar={status:'ok',host:r.data.host,frame,fetchedAt:Date.now(),error:''};setFeed('#feedRadar','ok',`frame ${istTime(frame.time*1000)}`);return true;}
  APP.live.radar={status:'error',frame:null,fetchedAt:Date.now(),error:r.error||'no radar frame'};setFeed('#feedRadar','warn','unavailable');return false;
}
async function pollSensor(){
  if(APP.mode==='demo')return; const s=APP.live.sensor;if(!s.channel)return;
  const direct=`https://api.thingspeak.com/channels/${encodeURIComponent(s.channel)}/feeds.json?results=200`;
  const r=await getLiveJSON(`/api/thingspeak?channel=${encodeURIComponent(s.channel)}&results=200`,direct),prev=s.health;
  if(!r.ok){s.status='error';s.health='FEED ERROR';s.healthWhy=`ThingSpeak did not answer (${r.error}).`;setFeed('#feedSensor','bad','feed error');}
  else{
    const feeds=Array.isArray(r.data?.feeds)?r.data.feeds:[],tiltKey=`field${s.fields.tilt}`,samples=[];
    for(const f of feeds){const v=parseFloat(f?.[tiltKey]),t=Date.parse(f?.created_at);if(Number.isFinite(v)&&Number.isFinite(t))samples.push({t,v});}
    samples.sort((a,b)=>a.t-b.t);s.samples=samples;s.fetchedAt=Date.now();s.status=samples.length?'ok':'empty';s.latest={};
    const last=feeds.at(-1)||{};for(const [k,f] of Object.entries(s.fields)){if(f>0){const v=parseFloat(last[`field${f}`]);s.latest[k]=Number.isFinite(v)?v:null;}}
    analyseSensor(s); const cls=s.health==='HEALTHY'?'ok':['ANOMALY','DISCONNECTED','FEED ERROR'].includes(s.health)?'bad':'warn';setFeed('#feedSensor',cls,s.health.toLowerCase());
  }
  if(prev!==s.health)logEvent(s.health==='ANOMALY'?'state':'sensor',`Field node ${prev||'NONE'} → ${s.health}`,s.healthWhy,'ThingSpeak'); detectStateChanges(APP.live);renderAll();
}
function detectStateChanges(c){
  for(const s of APP.sites){const r=computeStateFor(s,c),prev=c.lastStates[s.id];if(prev&&prev!==r.state){logEvent('state',`${s.name}: ${prev} → ${r.state}`,r.why,'HIMGAURAV state engine');maybeAutoAlert(s,prev,r);}c.lastStates[s.id]=r.state;}
}

function demoWeather(stage,s,idx){
  const dates=[],mm=[],now=new Date();const start=new Date(now.getTime()-31*864e5);for(let i=0;i<39;i++){const d=new Date(start.getTime()+i*864e5);dates.push(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d));mm.push(Math.max(0,1.2+((i*13+idx*7)%7)*.35));}
  const today=31; const target=[3.2,8.3,16.6,16.6][stage]||3.2;mm[today]=target*(1+(idx%3)*.03);mm[today-1]=stage>=2?11.5:3.1;mm[today-2]=stage>=2?9.8:2.6;for(let j=1;j<=7;j++)mm[today+j]=Math.max(0,((idx+1)*j*3)%9)+stage*1.1;
  const hourly=[];const base=Date.now()-2*3600e3;for(let i=0;i<34;i++)hourly.push({t:base+i*3600e3,p:Math.max(0,((i+idx*2)%7)-3)*.55+stage*.28});
  return {ok:true,series:{dates,mm,todayIdx:today},hourly,current:{temperature_2m:21-stage,relative_humidity_2m:72+stage*5,precipitation:stage*.8},fetchedAt:Date.now(),obsTime:Date.now(),cached:false,error:''};
}
function buildDemo(){
  const c=freshCtx();APP.sites.forEach((s,i)=>c.weather[s.id]=demoWeather(APP.demoStage,s,i));
  c.sensor={...freshSensor(),channel:'DEMO',siteId:APP.siteId,status:'ok',health:APP.demoStage===3?'ANOMALY':'HEALTHY',healthWhy:APP.demoStage===3?'Scripted sustained inclination anomaly for demonstration.':'Scripted healthy instrument.',samples:Array.from({length:48},(_,i)=>({t:Date.now()-(47-i)*60000,v:2.1+(APP.demoStage===3&&i>43?.12:0)+Math.sin(i)*.006})),latest:{tilt:APP.demoStage===3?2.22:2.10,moisture:APP.demoStage*80+310,rain:APP.demoStage>0?1:0,battery:4.08,rssi:-78}};analyseSensor(c.sensor);if(APP.demoStage===3){c.sensor.health='ANOMALY';c.sensor.healthWhy='DEMO: sustained same-slope inclination anomaly accompanies rainfall WATCH.';}
  c.quakes={status:'ok',features:[],fetchedAt:Date.now(),error:''};c.radar={status:'demo',frame:null,fetchedAt:Date.now(),error:''};return c;
}
function setMode(mode){
  if(mode===APP.mode)return;APP.mode=mode;
  if(mode==='demo'){
    if(APP.map&&APP.layers.radar&&APP.map.hasLayer(APP.layers.radar))APP.map.removeLayer(APP.layers.radar);
    if(APP.map&&APP.quakeLayer&&APP.map.hasLayer(APP.quakeLayer))APP.map.removeLayer(APP.quakeLayer);
    $('#toggleRadar').setAttribute('aria-pressed','false');$('#toggleQuakes').setAttribute('aria-pressed','false');
    APP.demoStage=0;APP.demo=buildDemo();$('#simulationBanner').hidden=false;setFeed('#feedWeather','sim','scripted');setFeed('#feedRadar','sim','disabled in demo');setFeed('#feedSensor','sim','scripted');logEvent('mode','Demo mode entered','All demonstration data is isolated from live state. Real basemaps remain geographic context only.','HIMGAURAV');
  }
  else{$('#simulationBanner').hidden=true;APP.demo=null;const s=APP.live.sensor;if(s.channel)setFeed('#feedSensor',s.health==='HEALTHY'?'ok':'warn',s.health.toLowerCase());else setFeed('#feedSensor','','not connected');const any=Object.values(APP.live.weather).some(w=>w?.ok);setFeed('#feedWeather',any?'ok':'',any?'cached/live':'starting');setFeed('#feedRadar',APP.live.radar.status==='ok'?'ok':'',APP.live.radar.status==='ok'?'recent frame':'standby');}
  $('#modeLive').setAttribute('aria-pressed',String(mode==='live'));$('#modeDemo').setAttribute('aria-pressed',String(mode==='demo'));renderAll();
}
function stepDemo(dir){if(APP.mode!=='demo')return;APP.demoStage=clamp(APP.demoStage+dir,0,3);APP.demo=buildDemo();logEvent('demo','Demo scenario changed',['Normal rainfall','Threshold entered','Rainfall WATCH','Corroborated WARNING'][APP.demoStage],`stage ${APP.demoStage+1}/4`);renderAll();}

function fallbackMapURL(s=site()){
  const d=.24,bbox=[s.lon-d,s.lat-d,s.lon+d,s.lat+d].map(v=>v.toFixed(5)).join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${s.lat.toFixed(6)}%2C${s.lon.toFixed(6)}`;
}
function showMapFallback(reason='The full GIS engine could not load.'){
  const box=$('#mapFallback'),s=site();if(!box)return;
  box.hidden=false;
  box.innerHTML=`<iframe title="Live OpenStreetMap fallback for ${esc(s.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${fallbackMapURL(s)}"></iframe><div class="fallback-card"><strong>Basic live map fallback</strong><span>${esc(reason)} The map below is real OpenStreetMap data. Advanced Earth, radar, seismic and forecast overlays become available when the GIS engine connects.</span><div class="button-row"><a href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=12/${s.lat}/${s.lon}" target="_blank" rel="noopener noreferrer">Open this site in OpenStreetMap ↗</a></div></div>`;
  setFeed('#feedMap','warn','basic fallback');
  $$('[data-base],#toggleRadar,#toggleQuakes').forEach(b=>{b.disabled=true;b.title='Available when the full GIS engine connects';});
}
function hideMapFallback(){const box=$('#mapFallback');if(box){box.hidden=true;box.innerHTML='';}$$('[data-base],#toggleRadar,#toggleQuakes').forEach(b=>{b.disabled=false;});}
function updateFallbackMap(){if(!APP.map&&!$('#mapFallback').hidden)showMapFallback('The full GIS engine is unavailable in this browser session.');}
function initMap(){
  if(APP.map)return;
  if(!window.L){showMapFallback('The full GIS engine could not be loaded from any of the configured map-library mirrors.');return;}
  hideMapFallback();
  const cfg=window.HIMGAURAV_CONFIG||{},baseUrl=cfg.basemap?.tileUrl;
  APP.map=L.map('map',{zoomControl:true,preferCanvas:true,minZoom:6,maxZoom:17}).setView([31.72,77.05],8);
  const street=L.tileLayer(baseUrl||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:cfg.basemap?.attribution||'&copy; OpenStreetMap contributors'});
  const terrain=L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'Map data &copy; OpenStreetMap contributors · SRTM | OpenTopoMap'});
  const eoDate=isoDaysAgo(1);
  const satellite=L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',{layers:'VIIRS_SNPP_CorrectedReflectance_TrueColor',format:'image/jpeg',transparent:false,version:'1.1.1',time:eoDate,attribution:`NASA EOSDIS GIBS · VIIRS Suomi NPP · ${eoDate}`,maxZoom:10});
  APP.layers={street,terrain,satellite,activeBase:'street',radar:null};street.addTo(APP.map);setFeed('#feedMap','ok','interactive');
  street.on('tileerror',()=>setFeed('#feedMap','warn','tile issue'));terrain.on('tileerror',()=>{if(APP.layers.activeBase==='terrain')setFeed('#feedMap','warn','terrain tile issue');});satellite.on('tileerror',()=>{ if(APP.layers.activeBase==='satellite'){setFeed('#feedMap','warn','Earth tile issue');toast('Some NASA imagery tiles are unavailable for this date/zoom.');} });
  APP.forecastLayer=L.layerGroup().addTo(APP.map);APP.quakeLayer=L.layerGroup();
  L.control.scale({imperial:false,position:'bottomright'}).addTo(APP.map);
  renderMapMarkers();
}
function markerHTML(state,selected=false){const st=STATES[state]||STATES.NODATA;return `<div class="site-marker ${selected?'selected':''}" style="--state-color:${st.color}"></div>`;}
function renderMapMarkers(){
  if(!APP.map)return; const c=ctx();
  for(const s of APP.sites){const r=computeStateFor(s,c),old=APP.markers.get(s.id);if(old)APP.map.removeLayer(old);const icon=L.divIcon({className:'',html:markerHTML(r.state,s.id===APP.siteId),iconSize:[28,28],iconAnchor:[14,14]});const m=L.marker([s.lat,s.lon],{icon,title:s.name}).addTo(APP.map);m.bindPopup(`<b>${esc(s.name)}</b><br>${esc(s.area)}<br><span class="state-badge ${r.state}">${r.state}</span>`);m.on('click',()=>selectSite(s.id,true));APP.markers.set(s.id,m);}
  renderSensorMapMarker();renderForecastLayer();
}
function renderSensorMapMarker(){if(!APP.map)return;if(APP.sensorMarker){APP.map.removeLayer(APP.sensorMarker);APP.sensorMarker=null;}const s=ctx().sensor;if(s.status!=='ok'||!s.siteId)return;const p=APP.sites.find(x=>x.id===s.siteId);if(!p)return;APP.sensorMarker=L.marker([p.lat,p.lon],{icon:L.divIcon({className:'',html:'<div class="sensor-map-marker"></div>',iconSize:[16,16],iconAnchor:[8,8]}),interactive:false}).addTo(APP.map);}
function renderForecastLayer(){
  if(!APP.map||!APP.forecastLayer)return;APP.forecastLayer.clearLayers();const now=Date.now(),target=now+APP.forecastHour*3600e3;
  for(const s of APP.sites){const w=ctx().weather[s.id];if(!w?.hourly?.length)continue;let best=null,delta=Infinity;for(const h of w.hourly){const d=Math.abs(h.t-target);if(d<delta){delta=d;best=h;}}if(!best||best.p==null)continue;const p=Math.max(0,best.p),radius=300+Math.min(4500,p*1200);L.circle([s.lat,s.lon],{radius,color:'#2f77a6',weight:1,opacity:.38,fillColor:'#2f77a6',fillOpacity:Math.min(.32,.07+p*.055),interactive:false}).addTo(APP.forecastLayer);}
  const d=new Date(target);$('#forecastLabel').textContent=APP.forecastHour===0?'Now':`+${APP.forecastHour}h · ${new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}).format(d)}`;
}
async function toggleRadar(){
  if(!APP.map)return;const btn=$('#toggleRadar'),on=btn.getAttribute('aria-pressed')==='true';if(on){if(APP.layers.radar)APP.map.removeLayer(APP.layers.radar);btn.setAttribute('aria-pressed','false');return;}
  if(APP.mode==='demo'){toast('Radar imagery is not simulated. Switch to LIVE to request recent radar frames.');return;}
  if(APP.live.radar.status!=='ok'){const ok=await fetchRadar();if(!ok){toast('RainViewer radar frame unavailable.');return;}}
  const r=APP.live.radar,template=`${r.host}${r.frame.path}/256/{z}/{x}/{y}/2/1_1.png`;APP.layers.radar=L.tileLayer(template,{opacity:.55,maxNativeZoom:7,maxZoom:12,attribution:'RainViewer recent radar'}).addTo(APP.map);btn.setAttribute('aria-pressed','true');logEvent('layer','Recent radar layer shown',`Frame generated around ${istDateTime(r.frame.time*1000)}. Coverage varies by location.`,'RainViewer');
}
function drawQuakes(){
  if(!APP.map||!APP.quakeLayer)return;APP.quakeLayer.clearLayers();const q=ctx().quakes;if(q.status!=='ok')return;for(const f of q.features){const [lon,lat,depth]=f.geometry?.coordinates||[];if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;const mag=+f.properties?.mag||0;L.circleMarker([lat,lon],{radius:3+mag*1.2,color:'#6c5977',weight:1,fillColor:'#8b7697',fillOpacity:.35}).bindTooltip(`M ${nfmt(mag,1)} · ${esc(f.properties?.place||'regional event')} · depth ${nfmt(depth,0)} km`).addTo(APP.quakeLayer);}}
async function toggleQuakes(){if(!APP.map)return;const b=$('#toggleQuakes'),on=b.getAttribute('aria-pressed')==='true';if(on){APP.map.removeLayer(APP.quakeLayer);b.setAttribute('aria-pressed','false');return;}if(APP.mode==='demo'){toast('The USGS seismic catalogue is not simulated. Switch to LIVE to request real events.');return;}if(APP.live.quakes.status!=='ok')await fetchQuakes();drawQuakes();APP.quakeLayer.addTo(APP.map);b.setAttribute('aria-pressed','true');}

function renderCommand(){
  const s=site(),c=ctx(),r=computeStateFor(s,c),st=STATES[r.state]||STATES.NODATA,w=c.weather[s.id];
  $('#mapSiteTitle').textContent=`${s.name} · ${s.area}`;$('#stateHero').className=`state-hero state-${r.state}`;$('#stateGlyph').textContent=st.glyph;$('#stateWord').textContent=st.word;$('#stateWhy').textContent=r.why;
  $('#stateAge').textContent=w?.fetchedAt?`${r.cached?'cached · ':''}${ageStr(Date.now()-w.fetchedAt)}`:'—';
  $('#m24').textContent=r.ev?.r24!=null?`${nfmt(r.ev.r24,1)} mm`:'—';$('#m72').textContent=r.ev?.r72!=null?`${nfmt(r.ev.r72,1)} mm`:'—';$('#mRatio').textContent=r.ev?`${nfmt(r.ev.maxRatio,2)}×`:'—';$('#mRatioSub').textContent=r.ev?.maxD?`at ${r.ev.maxD} d · ${APP.mode==='demo'?'sim-derived':'derived'}`:(APP.mode==='demo'?'sim-derived':'derived');
  const srcText=APP.mode==='demo'?'simulated':(r.cached?'cached model':'modelled');
  $('#m24Src').textContent=srcText;$('#m72Src').textContent=srcText;
  const rainTag=$('#rainSourceTag');rainTag.className=`provenance ${APP.mode==='demo'?'demo':r.cached?'reference':'live'}`;rainTag.textContent=APP.mode==='demo'?'DEMO / SIMULATED':r.cached?'CACHED MODEL':'LIVE MODEL';
  $('#forecastSourceText').textContent=APP.mode==='demo'?'Blue halos use deterministic scripted precipitation for presentation only — not observation or forecast.':'Blue halos are Open‑Meteo precipitation sampled only at monitored coordinates — not a hazard surface.';
  const cur=w?.current||{},near=(w?.hourly||[]).reduce((best,h)=>Math.abs(h.t-Date.now())<Math.abs((best?.t??Infinity)-Date.now())?h:best,null);
  $('#wxTemp').textContent=Number.isFinite(cur.temperature_2m)?`${nfmt(cur.temperature_2m,1)} °C`:'—';
  $('#wxRh').textContent=Number.isFinite(cur.relative_humidity_2m)?`${nfmt(cur.relative_humidity_2m,0)}%`:'—';
  $('#wxSoil').textContent=Number.isFinite(near?.soil0)?`${nfmt(near.soil0,3)} m³/m³`:'—';
  $('#wxContextTag').textContent=APP.mode==='demo'?'DEMO':r.cached?'CACHED':'MODEL';
  const box=$('#evidenceCompact');box.innerHTML='';
  const rows=[];
  if(!r.ev)rows.push({cls:'muted',mark:'?',name:'Rainfall threshold',detail:'No usable rainfall series.',tag:'NO DATA'});
  else rows.push({cls:r.ev.anyExceed?'warn':'good',mark:r.ev.anyExceed?'!':'✓',name:'Rainfall threshold',detail:r.ev.anyExceed?`Peak ${nfmt(r.ev.maxRatio,2)}× at ${r.ev.maxD} day${r.ev.maxD===1?'':'s'}.`:`All tested durations below curve; peak ${nfmt(r.ev.maxRatio,2)}×.`,tag:APP.mode==='demo'?'SIM·DERIVED':'DERIVED'});
  rows.push({cls:r.ev?.ante30!=null&&r.ev.ante30>=THRESH.anteMm?'warn':'muted',mark:r.ev?.ante30!=null&&r.ev.ante30>=THRESH.anteMm?'!':'·',name:'Antecedent rainfall',detail:r.ev?.ante30!=null?`${nfmt(r.ev.ante30,0)} mm over preceding 30 days · reference ${THRESH.anteMm} mm.`:'Insufficient 30-day coverage.',tag:APP.mode==='demo'?'SIM·DERIVED':'DERIVED'});
  const sen=c.sensor,senHere=sen.siteId===s.id&&sen.status==='ok';rows.push({cls:senHere&&sen.health==='ANOMALY'?'warn':senHere?'good':'muted',mark:senHere?(sen.health==='ANOMALY'?'!':'✓'):'○',name:'Ground inclination',detail:senHere?`${sen.health} · ${sen.healthWhy}`:'No reporting instrument bound to this site.',tag:APP.mode==='demo'&&senHere?'SIMULATED':senHere?'SENSOR':'NONE'});
  const reps=(APP.reports[s.id]||[]);rows.push({cls:reps.length?'warn':'muted',mark:reps.length?'!':'○',name:'Local reports',detail:reps.length?`${reps.length} unverified observation${reps.length===1?'':'s'}; newest ${ageStr(Date.now()-reps[0].t)}.`:'No observer report logged in this browser.',tag:'REPORT'});
  for(const x of rows){const e=document.createElement('div');e.className=`evidence-row ${x.cls}`;e.innerHTML=`<span class="mark">${x.mark}</span><span class="copy"><b>${esc(x.name)}</b><small>${esc(x.detail)}</small></span><small>${esc(x.tag)}</small>`;box.appendChild(e);}
  drawRainSpark(r.series);renderReportSummary();renderMapMarkers();
}
function drawRainSpark(series){
  const svg=$('#rainSpark');svg.innerHTML='';if(!series){svg.innerHTML='<text x="180" y="60" text-anchor="middle" fill="#718086" font-size="11">No rainfall series</text>';$('#rainChartCaption').textContent='No usable rainfall data.';return;}
  const W=360,H=118,pad={l:8,r:8,t:8,b:22},from=Math.max(0,series.todayIdx-6),to=Math.min(series.mm.length-1,series.todayIdx+6),vals=series.mm.slice(from,to+1).map(v=>v??0),max=Math.max(10,...vals)*1.12,bw=(W-pad.l-pad.r)/(to-from+1);
  const ns='http://www.w3.org/2000/svg',line=document.createElementNS(ns,'line');line.setAttribute('x1',pad.l);line.setAttribute('x2',W-pad.r);line.setAttribute('y1',H-pad.b);line.setAttribute('y2',H-pad.b);line.setAttribute('stroke','#d8e1de');svg.appendChild(line);
  for(let i=from;i<=to;i++){const v=series.mm[i]??0,h=(v/max)*(H-pad.t-pad.b),rect=document.createElementNS(ns,'rect');rect.setAttribute('x',pad.l+(i-from)*bw+2);rect.setAttribute('y',H-pad.b-h);rect.setAttribute('width',Math.max(2,bw-4));rect.setAttribute('height',Math.max(.5,h));rect.setAttribute('rx','2');rect.setAttribute('fill',i<=series.todayIdx?'#426f78':'#9bb8c1');rect.setAttribute('opacity',i===series.todayIdx?'1':'.74');svg.appendChild(rect);if(i===series.todayIdx){const mk=document.createElementNS(ns,'line');mk.setAttribute('x1',pad.l+(i-from+.5)*bw);mk.setAttribute('x2',pad.l+(i-from+.5)*bw);mk.setAttribute('y1',pad.t);mk.setAttribute('y2',H-pad.b+4);mk.setAttribute('stroke','#d85a2a');mk.setAttribute('stroke-width','1.5');svg.appendChild(mk);}}
  const label=document.createElementNS(ns,'text');label.setAttribute('x',pad.l+(series.todayIdx-from+.5)*bw);label.setAttribute('y',H-6);label.setAttribute('text-anchor','middle');label.setAttribute('fill','#66777c');label.setAttribute('font-size','9');label.textContent='today';svg.appendChild(label);
  $('#rainChartCaption').textContent='Daily precipitation total: darker bars are past/current model values; pale bars are forecast.';
}
function renderReportSummary(){const list=APP.reports[APP.siteId]||[],e=$('#reportSummary');if(!list.length){e.textContent='No local report for this site.';return;}const r=list[0],sign=PRECURSOR_SIGNS.find(x=>x.id===r.sign);e.innerHTML=`<b>${esc(sign?.label||r.sign)}</b> · ${ageStr(Date.now()-r.t)}${r.note?`<br><span>${esc(r.note)}</span>`:''}`;}
function openEvidenceDetail(){
  const s=site(),r=computeStateFor(s),ev=r.ev;$('#detailTitle').textContent=`${s.name} · evidence detail`;const body=$('#detailBody');
  const domain=s.inDomain?'This site is inside the area where the Shimla threshold was fitted.':'This is an extrapolation outside the Shimla fitting area.';
  let html=`<div class="detail-grid"><div class="detail-card"><h3>State logic</h3><p>${esc(r.why)}</p></div><div class="detail-card"><h3>Threshold provenance</h3><p>I = 7.20 · D<sup>−0.26</sup>, with intensity in mm/day and duration in days. ${esc(domain)}</p></div></div>`;
  if(ev){html+='<table class="threshold-table"><thead><tr><th>Duration</th><th>Cumulative</th><th>Mean intensity</th><th>Threshold</th><th>Ratio</th></tr></thead><tbody>'+ev.rows.map(x=>`<tr><td>${x.D} d</td><td>${x.cum==null?'—':nfmt(x.cum,1)+' mm'}</td><td>${x.I==null?'—':nfmt(x.I,2)}</td><td>${nfmt(x.thr,2)}</td><td>${x.ratio==null?'—':nfmt(x.ratio,2)+'×'}</td></tr>`).join('')+'</tbody></table>';}
  html+=`<div class="detail-card" style="margin-top:12px"><h3>Interpretation limit</h3><p>A threshold exceedance is a screening condition, not a probability that this slope will fail. Open‑Meteo is a numerical weather model, not an IMD rain gauge.</p></div>`;body.innerHTML=html;$('#detailDialog').showModal();
}


function satelliteFallback(message){
  const box=$('#satelliteFallback');
  if(!box)return;
  box.hidden=false;
  box.innerHTML=`<strong>Satellite viewer unavailable</strong><span>${esc(message)} No substitute or generated image is shown.</span>`;
  setFeed('#feedSatellite','bad','viewer unavailable');
}
function hideSatelliteFallback(){const box=$('#satelliteFallback');if(box)box.hidden=true;}
function initSatelliteMap(){
  if(APP.satMap)return true;
  if(!window.L){satelliteFallback('The GIS library is not available in this browser session.');return false;}
  hideSatelliteFallback();
  const s=site();
  APP.satMap=L.map('satelliteMap',{zoomControl:true,preferCanvas:true,minZoom:6,maxZoom:16}).setView([s.lat,s.lon],s.kind==='town'?10:13);
  APP.satBase=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,opacity:.34,attribution:'&copy; OpenStreetMap contributors'}).addTo(APP.satMap);
  L.control.scale({imperial:false,position:'bottomleft'}).addTo(APP.satMap);
  APP.satMap.on('click',e=>{const a=e.latlng;toast(`Map point · ${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}`);});
  updateSatelliteMarker();
  updateSatelliteLayer(true);
  return true;
}
function updateSatelliteMarker(){
  if(!APP.satMap)return;
  if(APP.satMarker)APP.satMap.removeLayer(APP.satMarker);
  const s=site();
  APP.satMarker=L.circleMarker([s.lat,s.lon],{radius:8,color:'#ffffff',weight:3,fillColor:'#d85a2a',fillOpacity:1}).addTo(APP.satMap);
  APP.satMarker.bindTooltip(`${esc(s.name)} · ${esc(s.area)}`,{direction:'top'});
}
function satelliteLayerOptions(meta){
  const isHls=meta.layer.startsWith('HLS_');
  return {
    layers:meta.layer,format:isHls?'image/png':'image/jpeg',transparent:isHls,version:'1.1.1',time:APP.satDate,
    attribution:`${meta.provider} · ${APP.satDate}`,maxZoom:isHls?14:10,opacity:(+($('#satOpacity')?.value||92))/100
  };
}
function updateSatelliteLayer(force=false){
  renderSatelliteMeta();
  if(!APP.satMap)return;
  if(APP.satLayer){APP.satMap.removeLayer(APP.satLayer);APP.satLayer=null;}
  const meta=satMeta();
  APP.satTileState='loading';APP.satTileErrors=0;
  const layer=L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',satelliteLayerOptions(meta));
  let loaded=false;
  layer.on('loading',()=>{APP.satTileState='loading';setFeed('#feedSatellite','','requesting');renderSatelliteMeta();});
  layer.on('tileload',()=>{if(!loaded){loaded=true;APP.satTileState='ok';setFeed('#feedSatellite','ok',`${meta.short} · ${APP.satDate}`);renderSatelliteMeta();}});
  layer.on('tileerror',()=>{APP.satTileErrors++;if(APP.satTileErrors>=2&&!loaded){APP.satTileState='error';setFeed('#feedSatellite','warn','imagery gap');renderSatelliteMeta();}});
  APP.satLayer=layer.addTo(APP.satMap);
  if(force)APP.satMap.setView([site().lat,site().lon],site().kind==='town'?10:13,{animate:false});
  logEvent('satellite','Earth-observation imagery requested',`${meta.label} · ${APP.satDate} · ${site().name}.`,'NASA EOSDIS GIBS');
}
function setSatelliteProduct(key){
  if(!SAT_PRODUCTS[key])return;
  APP.satProduct=key;
  $$('[data-sat-product]').forEach(b=>b.classList.toggle('active',b.dataset.satProduct===key));
  const meta=satMeta();
  if(!$('#satDate').value)APP.satDate=isoDaysAgo(meta.lagDays);
  updateSatelliteLayer();
  renderSatelliteTimeline();
}
function setSatelliteDate(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||''))return;
  const today=todayISO();
  APP.satDate=iso>today?today:iso;
  if($('#satDate'))$('#satDate').value=APP.satDate;
  updateSatelliteLayer();
  renderSatelliteTimeline();
}
function renderSatelliteTimeline(){
  const box=$('#satTimeline');if(!box)return;
  box.innerHTML='';
  const meta=satMeta(),latest=isoDaysAgo(meta.lagDays);
  for(let i=8;i>=0;i--){
    const d=shiftISODate(latest,-i),b=document.createElement('button');
    b.type='button';b.dataset.satDate=d;b.className=d===APP.satDate?'active':'';
    b.innerHTML=`<b>${new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short'}).format(new Date(d+'T12:00:00Z'))}</b><small>${i===0?'recent request':i===1?'−1 day':`−${i} days`}</small>`;
    b.addEventListener('click',()=>setSatelliteDate(d));box.appendChild(b);
  }
}
function renderSatelliteMeta(){
  const meta=satMeta(),s=site(),r=computeStateFor(s),sen=ctx().sensor,senHere=sen.status==='ok'&&sen.siteId===s.id;
  $$('[data-sat-product]').forEach(b=>b.classList.toggle('active',b.dataset.satProduct===APP.satProduct));
  if($('#satSiteSelect'))$('#satSiteSelect').value=s.id;
  if($('#satDate')){$('#satDate').value=APP.satDate;$('#satDate').max=todayISO();}
  $('#satHudProduct').textContent=meta.short;$('#satHudDate').textContent=APP.satDate;$('#satHudSite').textContent=s.name;
  $('#satPanelTitle').textContent=meta.short;$('#satProvider').textContent=meta.provider;$('#satProductMeta').textContent=meta.label;$('#satResolution').textContent=meta.resolution;$('#satTemporal').textContent=meta.temporal;$('#satDateMeta').textContent=APP.satDate;$('#satInterpretation').textContent=meta.note;
  const load=$('#satLoadState');
  if(APP.satTileState==='ok'){load.className='provenance recent';load.textContent='REAL · DATED';}
  else if(APP.satTileState==='error'){load.className='provenance none';load.textContent='NO IMAGE / GAP';}
  else{load.className='provenance recent';load.textContent='REQUESTING';}
  const top=$('#satSourceTag');top.className='provenance recent';top.textContent=APP.mode==='demo'?'REAL EO · OUTSIDE DEMO':'RECENT EO';
  $('#satFusionEO').textContent=APP.satTileState==='ok'?`${meta.short}, ${APP.satDate}. Visual evidence only; not an automatic state input.`:APP.satTileState==='error'?'No usable image tile has loaded for this request yet.':'Requesting dated imagery from NASA GIBS.';
  $('#satFusionEOTag').textContent=APP.satTileState==='ok'?'RECENT':'NO DATA';
  $('#satFusionRain').textContent=r.ev?`${r.state==='CONTEXT'?'Regional context':'Slope screen'} · ${nfmt(r.ev.r24,1)} mm / 24 h · threshold peak ${nfmt(r.ev.maxRatio,2)}×.`:'No usable rainfall screening series.';
  $('#satFusionRainTag').textContent=APP.mode==='demo'?'SIMULATED':r.cached?'CACHED':'MODEL';
  $('#satFusionNode').textContent=senHere?`${sen.health} · ${sen.healthWhy}`:'No reporting node is bound to this selected site.';
  $('#satFusionNodeTag').textContent=APP.mode==='demo'&&senHere?'SIMULATED':senHere?'SENSOR':'NONE';
  const delta=.35,url=`https://worldview.earthdata.nasa.gov/?p=geographic&t=${encodeURIComponent(APP.satDate)}&v=${(s.lon-delta).toFixed(4)},${(s.lat-delta/2).toFixed(4)},${(s.lon+delta).toFixed(4)},${(s.lat+delta/2).toFixed(4)}&l=${encodeURIComponent(meta.layer)}`;
  $('#openWorldview').href=url;
}
function renderSatellite(){
  if(!$('#view-satellite'))return;
  renderSatelliteMeta();renderSatelliteTimeline();
  if(APP.view==='satellite'){
    if(!APP.satMap){
      if(window.L)initSatelliteMap();
      else if(window.HIMGAURAV_MAP_READY)window.HIMGAURAV_MAP_READY.then(ok=>{if(ok&&APP.view==='satellite'){initSatelliteMap();setTimeout(()=>APP.satMap?.invalidateSize(),20);}else if(!ok)satelliteFallback('The map library could not be loaded.');});
    }else{updateSatelliteMarker();setTimeout(()=>APP.satMap.invalidateSize(),20);}
  }
}

function renderSensor(){
  const s=ctx().sensor,connected=s.status!=='none'&&!!s.channel;$('#sensorHealth').textContent=connected?s.health:'NOT CONNECTED';$('#sensorHealthWhy').textContent=connected?s.healthWhy:'Connect a public ThingSpeak channel to evaluate freshness, baseline, noise and sustained inclination anomaly.';
  const block=$('#sensorHealthBlock');block.className='health-block '+(s.health==='HEALTHY'?'ok':['ANOMALY','DISCONNECTED','FEED ERROR'].includes(s.health)?'bad':connected?'warn':'');
  const pill=$('#nodeStatusPill');pill.textContent=connected?s.health:'NOT CONNECTED';pill.className='node-status '+(s.health==='HEALTHY'?'ok':['ANOMALY','DISCONNECTED','FEED ERROR'].includes(s.health)?'bad':connected?'warn':'');
  $('#nodePulse').className=s.health==='HEALTHY'?'ok':['ANOMALY','DISCONNECTED','FEED ERROR'].includes(s.health)?'bad':'';$('#sensorSourceTag').className='provenance '+(APP.mode==='demo'?'demo':connected?'sensor':'none');$('#sensorSourceTag').textContent=APP.mode==='demo'?'DEMO':connected?'SENSOR':'NO DATA';
  const tilt=s.samples.at(-1)?.v??s.latest.tilt;$('#sTilt').textContent=Number.isFinite(tilt)?`${nfmt(tilt,3)}°`:'—';$('#sTiltSub').textContent=s.lastTs?ageStr(Date.now()-s.lastTs):'latest';$('#sDev').textContent=Number.isFinite(s.dev)?`${nfmt(s.dev,3)}°`:'—';$('#sMoist').textContent=Number.isFinite(s.latest.moisture)?nfmt(s.latest.moisture,1):'—';$('#sRain').textContent=Number.isFinite(s.latest.rain)?nfmt(s.latest.rain,1):'—';$('#sBattery').textContent=Number.isFinite(s.latest.battery)?nfmt(s.latest.battery,2):'—';$('#sRssi').textContent=Number.isFinite(s.latest.rssi)?nfmt(s.latest.rssi,0):'—';
  $('#loraStatus').textContent=Number.isFinite(s.latest.rssi)?`LoRa / radio metric mapped · ${nfmt(s.latest.rssi,0)}`:'LoRa path · PROPOSED / unmapped';drawTiltChart(s);
}
function drawTiltChart(s){
  const svg=$('#tiltChart');svg.innerHTML='';const arr=s.samples||[];if(arr.length<2){svg.innerHTML='<text x="480" y="130" text-anchor="middle" fill="#718086" font-size="12">No inclination history</text>';return;}
  const ns='http://www.w3.org/2000/svg',W=960,H=260,p={l:42,r:18,t:18,b:28},vals=arr.map(x=>x.v),min=Math.min(...vals,s.baseline||Infinity),max=Math.max(...vals,s.baseline||-Infinity),spread=Math.max(.08,(max-min)*1.4),lo=(Number.isFinite(s.baseline)?s.baseline:(min+max)/2)-spread/2,hi=lo+spread,x=i=>p.l+i*(W-p.l-p.r)/(arr.length-1),y=v=>p.t+(hi-v)*(H-p.t-p.b)/(hi-lo);
  if(Number.isFinite(s.baseline)&&Number.isFinite(s.noise)){const lim=Math.max(3*s.noise,SENSOR_RULES.minAbsDeg),rect=document.createElementNS(ns,'rect');rect.setAttribute('x',p.l);rect.setAttribute('width',W-p.l-p.r);rect.setAttribute('y',y(s.baseline+lim));rect.setAttribute('height',Math.abs(y(s.baseline-lim)-y(s.baseline+lim)));rect.setAttribute('fill','#e4f0f1');svg.appendChild(rect);}
  let d='';arr.forEach((q,i)=>d+=(i?'L':'M')+x(i)+' '+y(q.v)+' ');const path=document.createElementNS(ns,'path');path.setAttribute('d',d);path.setAttribute('fill','none');path.setAttribute('stroke','#2b6f78');path.setAttribute('stroke-width','2');svg.appendChild(path);
  if(Number.isFinite(s.baseline)){const bl=document.createElementNS(ns,'line');bl.setAttribute('x1',p.l);bl.setAttribute('x2',W-p.r);bl.setAttribute('y1',y(s.baseline));bl.setAttribute('y2',y(s.baseline));bl.setAttribute('stroke','#0d4f59');bl.setAttribute('stroke-dasharray','5 5');svg.appendChild(bl);}
  const labels=[[p.l,H-8,istTime(arr[0].t),'start'],[W-p.r,H-8,istTime(arr.at(-1).t),'end']];for(const [xx,yy,txt,pos] of labels){const t=document.createElementNS(ns,'text');t.setAttribute('x',xx);t.setAttribute('y',yy);t.setAttribute('fill','#718086');t.setAttribute('font-size','10');t.setAttribute('text-anchor',pos==='end'?'end':'start');t.textContent=txt;svg.appendChild(t);}
}
function renderEvents(){
  const c=ctx(),table=$('#siteStatusTable');if(!table)return;table.innerHTML='';for(const s of APP.sites){const r=computeStateFor(s,c),e=document.createElement('div');e.className='site-status-row';e.innerHTML=`<span><b>${esc(s.name)}</b><small>${esc(s.area)}</small></span><span class="state-badge ${r.state}">${r.state}</span><span class="num">${r.ev?`${nfmt(r.ev.maxRatio,2)}× peak`:'—'}</span><button class="text-btn" data-site-jump="${esc(s.id)}">inspect</button>`;table.appendChild(e);}$('#siteCountMeta').textContent=`${APP.sites.length} points`;
  const log=$('#eventLog');log.innerHTML='';if(!c.log.length)log.innerHTML='<li class="empty-state">No session events yet.</li>';else for(const ev of c.log){const li=document.createElement('li');li.innerHTML=`<time>${istTime(ev.t)}</time><div><b>${esc(ev.title)}</b>${ev.detail?`<p>${esc(ev.detail)}</p>`:''}${ev.source?`<small>${esc(ev.source)} · ${ev.mode==='demo'?'SIMULATED':'LIVE SESSION'}</small>`:''}</div>`;log.appendChild(li);}$('#logCount').textContent=`${c.log.length} entries`;
}

function rescueFilteredMeasurements(){
  const mod=$('#rescueFilterMod')?.value||'all',moist=$('#rescueFilterMoist')?.value||'all',depth=$('#rescueFilterDepth')?.value||'all';
  return APP.measurements.filter(m=>(mod==='all'||m.mod===mod)&&(moist==='all'||m.moist===moist)&&(depth==='all'||Math.abs((+m.depth)-(+depth))<1e-6));
}
function rescueMetricMeta(mod){return ACUSEARCH_MODALITIES[mod]||ACUSEARCH_MODALITIES.wifi;}
function updateRescueMetricLabel(){
  const meta=rescueMetricMeta($('#mlMod')?.value||'wifi'),lab=$('#mlMetricLabel'),inp=$('#mlMetric');
  if(lab)lab.textContent=`${meta.metric} (${meta.unit}, optional)`;
  if(inp){inp.placeholder=meta.unit==='dBm'?'-72':'-38';inp.setAttribute('aria-label',`${meta.metric} in ${meta.unit}`);}
}
function drawRescueChart(){
  const svg=$('#rescueChart');if(!svg)return;svg.innerHTML='';const arr=rescueFilteredMeasurements();
  if(!arr.length){svg.innerHTML='<text x="480" y="160" text-anchor="middle" fill="#718086" font-size="12">No measurements match the current filters</text>';return;}
  const ns='http://www.w3.org/2000/svg',W=960,H=320,p={l:64,r:24,t:22,b:44},maxX=Math.max(5,...arr.map(x=>+x.dist||0))*1.08,x=v=>p.l+v*(W-p.l-p.r)/maxX;
  const baseY={dry:72,damp:151,saturated:230};
  for(const [label,yy] of [['dry',72],['damp',151],['saturated',230]]){
    const line=document.createElementNS(ns,'line');line.setAttribute('x1',p.l);line.setAttribute('x2',W-p.r);line.setAttribute('y1',yy);line.setAttribute('y2',yy);line.setAttribute('stroke','#d8e1de');line.setAttribute('stroke-dasharray','4 4');svg.appendChild(line);
    const t=document.createElementNS(ns,'text');t.setAttribute('x',10);t.setAttribute('y',yy+4);t.setAttribute('fill','#718086');t.setAttribute('font-size','10');t.textContent=label;svg.appendChild(t);
  }
  const xTicks=5;for(let i=0;i<=xTicks;i++){const val=maxX*i/xTicks,xx=x(val),ln=document.createElementNS(ns,'line');ln.setAttribute('x1',xx);ln.setAttribute('x2',xx);ln.setAttribute('y1',p.t);ln.setAttribute('y2',H-p.b);ln.setAttribute('stroke','#eef2f0');svg.appendChild(ln);const tx=document.createElementNS(ns,'text');tx.setAttribute('x',xx);tx.setAttribute('y',H-19);tx.setAttribute('text-anchor','middle');tx.setAttribute('fill','#718086');tx.setAttribute('font-size','9');tx.textContent=nfmt(val,1);svg.appendChild(tx);}
  for(const m of arr){const meta=rescueMetricMeta(m.mod),c=document.createElementNS(ns,'circle'),depth=Math.max(0,+m.depth||0),yy=(baseY[m.moist]||151)-Math.min(depth,2.5)*12;c.setAttribute('cx',x(+m.dist||0));c.setAttribute('cy',yy);c.setAttribute('r','6');c.setAttribute('fill',m.detected?'#fff':meta.color);c.setAttribute('fill-opacity',m.detected?'1':'.2');c.setAttribute('stroke',meta.color);c.setAttribute('stroke-width',m.detected?'3':'2');c.setAttribute('data-mod',m.mod);const title=document.createElementNS(ns,'title');title.textContent=`${meta.label} · ${m.moist} · ${nfmt(+m.depth,1)} m burial · ${nfmt(+m.dist,1)} m lateral · ${m.detected?'detected':'not detected'}${m.metric!==null&&m.metric!==undefined&&m.metric!==''&&Number.isFinite(+m.metric)?` · ${nfmt(+m.metric,1)} ${m.metricUnit||meta.unit}`:''}`;c.appendChild(title);svg.appendChild(c);}
  const ax=document.createElementNS(ns,'text');ax.setAttribute('x',W/2);ax.setAttribute('y',H-5);ax.setAttribute('text-anchor','middle');ax.setAttribute('fill','#718086');ax.setAttribute('font-size','10');ax.textContent='lateral distance (m)';svg.appendChild(ax);
}
function renderRescueSummary(arr){
  const box=$('#rescueSummary');if(!box)return;const yes=arr.filter(m=>m.detected),sat=arr.filter(m=>m.moist==='saturated'),mods=new Set(arr.map(m=>m.mod)),depths=new Set(arr.map(m=>String(m.depth)));
  const furthest=yes.length?Math.max(...yes.map(m=>+m.dist||0)):NaN;const satYes=sat.filter(m=>m.detected),satFar=satYes.length?Math.max(...satYes.map(m=>+m.dist||0)):NaN;
  box.innerHTML=`<div><small>Filtered trials</small><b>${arr.length}</b><span>${yes.length} detected · ${arr.length-yes.length} no-signal</span></div><div><small>Furthest observed detection</small><b>${Number.isFinite(furthest)?nfmt(furthest,1)+' m':'—'}</b><span>not a validated range</span></div><div><small>Saturated-soil observation</small><b>${Number.isFinite(satFar)?nfmt(satFar,1)+' m':'—'}</b><span>${sat.length} saturated trials in filter</span></div><div><small>Coverage</small><b>${mods.size} × ${depths.size}</b><span>modalities × tested depths</span></div>`;
}
function renderRescueCoverage(){
  const box=$('#rescueCoverage');if(!box)return;box.innerHTML='';for(const mod of Object.keys(ACUSEARCH_MODALITIES)){for(const moist of ACUSEARCH_MOISTURE){const rows=APP.measurements.filter(m=>m.mod===mod&&m.moist===moist),depths=new Set(rows.map(m=>String(m.depth))),dists=new Set(rows.map(m=>String(m.dist))),cell=document.createElement('div');cell.className=`acu-coverage-cell ${rows.length?'ready':''}`;cell.innerHTML=`<b>${esc(ACUSEARCH_MODALITIES[mod].label)}</b><small>${esc(moist)} soil · ${depths.size} depth${depths.size===1?'':'s'} · ${dists.size} distance${dists.size===1?'':'s'}</small><em>${rows.length?`${rows.length} TRIAL${rows.length===1?'':'S'}`:'NOT TESTED'}</em>`;box.appendChild(cell);}}
}
function renderMeasurements(){
  if(!$('#measCount'))return;$('#measCount').textContent=`${APP.measurements.length} measurement${APP.measurements.length===1?'':'s'}`;const arr=rescueFilteredMeasurements();drawRescueChart();renderRescueSummary(arr);renderRescueCoverage();const box=$('#measurementTable');if(!APP.measurements.length){box.innerHTML='<div class="empty-state">No AcuSearch measurements are stored in this browser yet.</div>';return;}if(!arr.length){box.innerHTML='<div class="empty-state">No rows match the current filters.</div>';return;}
  box.innerHTML='<table><thead><tr><th>Time</th><th>Modality</th><th>Depth</th><th>Soil</th><th>Distance</th><th>Detected</th><th>Metric</th><th>Rep</th><th>Note</th></tr></thead><tbody>'+arr.map(m=>{const meta=rescueMetricMeta(m.mod);return `<tr><td>${esc(istDateTime(m.t))}</td><td>${esc(meta.label)}</td><td>${nfmt(+m.depth,1)} m</td><td>${esc(m.moist)}</td><td>${nfmt(+m.dist,1)} m</td><td>${m.detected?'yes':'no'}</td><td>${m.metric!==null&&m.metric!==undefined&&m.metric!==''&&Number.isFinite(+m.metric)?`${nfmt(+m.metric,1)} ${esc(m.metricUnit||meta.unit)}`:'—'}</td><td>${esc(m.rep||1)}</td><td>${esc(m.note||'')}</td></tr>`;}).join('')+'</tbody></table>';
}
function setAcuAudioStatus(text,cls='none'){const el=$('#acuAudioStatus');if(!el)return;el.textContent=text;el.className=`provenance ${cls}`;}
function updateToneGainLabel(){const el=$('#acuToneGainValue'),gain=+($('#acuToneGain')?.value||.05);if(el)el.textContent=`${Math.round(gain*100)}%`;if(acuGain)acuGain.gain.value=gain;}
async function startAcuTone(){
  try{if(acuOsc)stopAcuTone();acuAudioCtx=acuAudioCtx||new (window.AudioContext||window.webkitAudioContext)();if(acuAudioCtx.state==='suspended')await acuAudioCtx.resume();acuOsc=acuAudioCtx.createOscillator();acuGain=acuAudioCtx.createGain();acuOsc.type='sine';acuOsc.frequency.value=+($('#acuToneFreq')?.value||2000);acuGain.gain.value=+($('#acuToneGain')?.value||.05);acuOsc.connect(acuGain).connect(acuAudioCtx.destination);acuOsc.start();$('#acuToneStart').disabled=true;$('#acuToneStop').disabled=false;setAcuAudioStatus('TONE ON','experimental');toast('Acoustic test tone started. Keep output low and use only for controlled experiments.');}
  catch(e){setAcuAudioStatus('AUDIO BLOCKED','none');toast('The browser could not start the test tone.');}
}
function stopAcuTone(){try{acuOsc?.stop();}catch{}try{acuOsc?.disconnect();acuGain?.disconnect();}catch{}acuOsc=null;acuGain=null;if($('#acuToneStart'))$('#acuToneStart').disabled=false;if($('#acuToneStop'))$('#acuToneStop').disabled=true;if(!acuMicStream)setAcuAudioStatus('IDLE','none');}
function acuMicFrame(){
  if(!acuMicAnalyser)return;const buf=new Float32Array(acuMicAnalyser.fftSize);acuMicAnalyser.getFloatTimeDomainData(buf);let sum=0;for(const v of buf)sum+=v*v;const rms=Math.sqrt(sum/buf.length),db=rms>0?20*Math.log10(rms):-100;acuMicCurrent=Math.max(-100,Math.min(0,db));acuMicPeak=Math.max(acuMicPeak,acuMicCurrent);if($('#acuMicDb'))$('#acuMicDb').textContent=nfmt(acuMicCurrent,1);if($('#acuMicPeak'))$('#acuMicPeak').textContent=Number.isFinite(acuMicPeak)?`${nfmt(acuMicPeak,1)} dBFS`:'—';if($('#acuMicBar'))$('#acuMicBar').style.width=`${clamp((acuMicCurrent+100),0,100)}%`;acuMicRAF=requestAnimationFrame(acuMicFrame);
}
async function startAcuMic(){
  if(!navigator.mediaDevices?.getUserMedia){toast('Microphone capture is not supported in this browser.');return;}
  try{acuMicStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});acuMicCtx=new (window.AudioContext||window.webkitAudioContext)();acuMicSource=acuMicCtx.createMediaStreamSource(acuMicStream);acuMicAnalyser=acuMicCtx.createAnalyser();acuMicAnalyser.fftSize=2048;acuMicSource.connect(acuMicAnalyser);acuMicPeak=-Infinity;$('#acuMicStart').disabled=true;$('#acuMicStop').disabled=false;$('#acuUseMic').disabled=false;$('#acuMicPermission').textContent='microphone measuring';setAcuAudioStatus(acuOsc?'TONE + MIC':'MIC ON','experimental');acuMicFrame();}
  catch(e){$('#acuMicPermission').textContent='permission denied / unavailable';setAcuAudioStatus('MIC BLOCKED','none');toast('Microphone permission was not granted.');}
}
function stopAcuMic(){if(acuMicRAF)cancelAnimationFrame(acuMicRAF);acuMicRAF=0;try{acuMicSource?.disconnect();acuMicAnalyser?.disconnect();}catch{}acuMicStream?.getTracks().forEach(t=>t.stop());try{acuMicCtx?.close();}catch{}acuMicStream=null;acuMicCtx=null;acuMicAnalyser=null;acuMicSource=null;if($('#acuMicStart'))$('#acuMicStart').disabled=false;if($('#acuMicStop'))$('#acuMicStop').disabled=true;if($('#acuUseMic'))$('#acuUseMic').disabled=true;if($('#acuMicPermission'))$('#acuMicPermission').textContent='microphone off';if(!acuOsc)setAcuAudioStatus('IDLE','none');}
function useAcuMicMetric(){if(!Number.isFinite(acuMicCurrent)){toast('Start the microphone meter first.');return;}if($('#mlMod')?.value!=='audible'&&$('#mlMod')?.value!=='wired'){$('#mlMod').value='audible';updateRescueMetricLabel();}$('#mlMetric').value=nfmt(acuMicCurrent,1);toast('Current browser dBFS value copied into the experiment log.');}
function parseCSVLine(line){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(q){if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(ch==='"')q=false;else cur+=ch;}else if(ch==='"')q=true;else if(ch===','){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out;}
async function importMeasurementsFile(file){
  if(!file)return;try{const text=await file.text(),lines=text.split(/\r?\n/).filter(Boolean);if(lines.length<2)throw new Error('empty CSV');const head=parseCSVLine(lines[0]).map(x=>x.trim()),ix=k=>head.indexOf(k),rows=[];for(const line of lines.slice(1)){const c=parseCSVLine(line),mod=c[ix('signal')]||c[ix('modality')],depth=parseFloat(c[ix('burial_depth_m')]),moist=c[ix('soil_condition')],dist=parseFloat(c[ix('lateral_distance_m')]);if(!ACUSEARCH_MODALITIES[mod]||!Number.isFinite(depth)||!ACUSEARCH_MOISTURE.includes(moist)||!Number.isFinite(dist))continue;const metric=parseFloat(c[ix('metric_value')]);rows.push({t:Date.now(),mod,depth,moist,dist,detected:(c[ix('detected')]||'').toLowerCase()==='yes',metric:Number.isFinite(metric)?metric:null,metricUnit:c[ix('metric_unit')]||rescueMetricMeta(mod).unit,rep:parseInt(c[ix('replicate')])||1,note:c[ix('note')]||''});}if(!rows.length)throw new Error('no compatible rows');APP.measurements=rows.concat(APP.measurements);storeSet(CFG.rescueKey,APP.measurements);renderMeasurements();toast(`${rows.length} AcuSearch measurement${rows.length===1?'':'s'} imported.`);logEvent('experiment','AcuSearch CSV imported',`${rows.length} compatible rows added to the local research log.`,'Operator file import');}
  catch(e){toast('Could not import this CSV. Use a HIMGAURAV AcuSearch export or matching column names.');}
}
function renderSources(){const list=$('#sourceList');if(list.dataset.done)return;list.dataset.done='1';SOURCES.forEach(s=>{const li=document.createElement('li');li.innerHTML=`<a href="${esc(s.l)}" target="_blank" rel="noopener noreferrer">${esc(s.t)}</a><small>${esc(s.m)}</small><p>${esc(s.u)}</p>`;list.appendChild(li);});$('#sourceCount').textContent=`${SOURCES.length} sources`;
}

function alertSeverityFor(state){return state==='WARNING'?'Severe':state==='WATCH'?'Moderate':state==='MONITOR'?'Minor':'Unknown';}
function alertUrgencyFor(state){return state==='WARNING'?'Immediate':state==='WATCH'?'Expected':'Future';}
function alertCertaintyFor(state){return state==='WARNING'?'Likely':state==='WATCH'?'Possible':'Unknown';}
function alertResponseFor(state){return state==='WARNING'?'Avoid':state==='WATCH'?'Prepare':'Monitor';}
function alertBasis(s=site(),c=ctx()){
  const r=computeStateFor(s,c),w=c.weather[s.id],age=w?.fetchedAt?Date.now()-w.fetchedAt:Infinity;
  const slope=s.kind!=='town',fresh=!!(w?.ok&&age<=CFG.staleWarnMs),screening=['WATCH','WARNING'].includes(r.state),sensor=c.sensor,status=c.sensor?.status;
  const corroborated=status==='ok'&&sensor.siteId===s.id&&sensor.health==='ANOMALY';
  return {s,r,w,age,slope,fresh,screening,corroborated,live:APP.mode==='live'};
}
function buildEnglishAlert(s=site(),r=computeStateFor(s)){return buildLocalizedAlert('en',s,r);}
function alertInputBlock(){return {headline:$('#alertHeadline')?.value.trim()||'',description:$('#alertDescription')?.value.trim()||'',instruction:$('#alertInstruction')?.value.trim()||''};}
function setAlertInputs(block){if(!block)return;$('#alertHeadline').value=block.headline||'';$('#alertDescription').value=block.description||'';$('#alertInstruction').value=block.instruction||'';renderAlertPreview();}
function saveAlertDraft(){APP.alertDraft={...(APP.alertDraft||{}),siteId:APP.siteId,workflow:$('#alertWorkflow')?.value||'internal',severity:$('#alertSeverity')?.value||'auto',expiry:+($('#alertExpiry')?.value||60),radius:+($('#alertRadius')?.value||APP.alertSettings.radius||3),language:$('#alertLanguage')?.value||APP.alertSettings.language||'en',translations:APP.alertDraft?.translations||{}};storeSet(CFG.alertDraftKey,APP.alertDraft);}
function generateAlertDraft({silent=false}={}){
  const s=site(),r=computeStateFor(s),chosen=$('#alertLanguage')?.value||APP.alertSettings.language||'en';
  APP.alertDraft={...APP.alertDraft,siteId:s.id,translations:{}};
  APP.alertDraft.translations.en=buildLocalizedAlert('en',s,r);APP.alertDraft.translations.en.reviewed=true;
  if(chosen!=='en'&&languageTemplateAvailable(chosen))APP.alertDraft.translations[chosen]=buildLocalizedAlert(chosen,s,r);
  $('#alertSeverity').value='auto';$('#alertLanguage').value=chosen;
  setAlertInputs(APP.alertDraft.translations[chosen]||APP.alertDraft.translations.en);saveAlertDraft();renderSavedLanguages();renderLanguageCoverage();
  if(!silent){auditAlert('DRAFT',`${s.name}: ${languageMeta(chosen).name} alert regenerated locally from ${r.state} evidence.`);toast(`${languageMeta(chosen).name} alert generated from current evidence.`);}
}
function saveCurrentLanguageBlock(source='Operator reviewed edit'){
  const lang=$('#alertLanguage').value,block=alertInputBlock();if(!block.headline||!block.description||!block.instruction){toast('Complete headline, situation and protective action first.');return false;}
  APP.alertDraft.translations=APP.alertDraft.translations||{};APP.alertDraft.translations[lang]={...block,source,reviewed:true,template:false};saveAlertDraft();renderSavedLanguages();renderLanguageCoverage();renderAlertPreview();auditAlert('LANGUAGE',`${languageMeta(lang).name} alert block saved as operator-reviewed.`);toast(`${languageMeta(lang).name} edits saved.`);return true;
}
function loadAlertLanguage(code){
  APP.alertDraft.translations=APP.alertDraft.translations||{};
  let saved=APP.alertDraft.translations[code];
  if(!saved&&languageTemplateAvailable(code)){saved=buildLocalizedAlert(code,site(),computeStateFor(site()));APP.alertDraft.translations[code]=saved;saveAlertDraft();}
  if(saved)setAlertInputs(saved);else setAlertInputs({headline:'',description:'',instruction:''});
  const meta=languageMeta(code),status=$('#translationStatus'),lm=$('#alertLanguageMeta');applyAlertDirection(code);
  if(lm)lm.textContent=saved?.reviewed?`${meta.native} · operator reviewed`:`${meta.native} · local template`;
  if(status)status.textContent=saved?.reviewed?'Operator-reviewed wording is loaded. Rebuild only if you want to replace it with the current evidence template.':saved?`Generated locally from the current evidence. No network translation service is required. Review wording before external handoff.`:'No built-in template is available for this language.';
  renderSavedLanguages();renderLanguageCoverage();renderAlertPreview();renderAlertConnectors();
}
async function translateAlert(){
  const code=$('#alertLanguage').value;if(!languageTemplateAvailable(code)){toast('No local template is available for this language.');return;}
  const block=buildLocalizedAlert(code,site(),computeStateFor(site()));APP.alertDraft.translations=APP.alertDraft.translations||{};APP.alertDraft.translations[code]=block;setAlertInputs(block);saveAlertDraft();renderSavedLanguages();renderLanguageCoverage();
  const status=$('#translationStatus');if(status)status.textContent=`${languageMeta(code).name} rebuilt locally from the current evidence. No API call was used.`;
  auditAlert('LOCALIZE',`${languageMeta(code).name} template rebuilt locally from current evidence.`);toast(`${languageMeta(code).name} alert rebuilt.`);
}
function renderSavedLanguages(){
  const box=$('#savedLanguages');if(!box)return;const active=$('#alertLanguage')?.value;box.innerHTML='';
  for(const l of INDIAN_LANGUAGES){const b=APP.alertDraft?.translations?.[l.code];if(!b)continue;const btn=document.createElement('button');btn.type='button';btn.className=`language-chip ${l.code===active?'active':''} ${b.reviewed?'reviewed':'template'}`;btn.dataset.alertLang=l.code;btn.textContent=`${l.native} ${b.reviewed?'✓':'T'}`;btn.title=b.reviewed?'Operator-reviewed wording':'Built-in local template · review before external handoff';box.appendChild(btn);}
  const count=Object.keys(APP.alertDraft?.translations||{}).length;if($('#alertCoverageCount'))$('#alertCoverageCount').textContent=`${count} language${count===1?'':'s'} ready`;
}
function renderLanguageCoverage(){
  const grid=$('#languageCoverageGrid');if(!grid)return;const saved=APP.alertDraft?.translations||{};
  grid.innerHTML=INDIAN_LANGUAGES.map(l=>{const b=saved[l.code],voice=voiceCapability(l.code);return `<button type="button" class="language-coverage-card ${b?'ready':''} ${b?.reviewed?'reviewed':''}" data-alert-lang="${esc(l.code)}"><span><b>${esc(l.native)}</b><small>${esc(l.name)}</small></span><em>${b?.reviewed?'REVIEWED':b?'TEMPLATE':'BUILD'}</em><i title="${esc(voice.label)}">${voice.ok?'🔊':'—'}</i></button>`;}).join('');
  const ready=Object.keys(saved).length,reviewed=Object.values(saved).filter(x=>x.reviewed).length;if($('#languagePackSummary'))$('#languagePackSummary').textContent=`${ready}/23 generated · ${reviewed} operator-reviewed · CAP includes generated blocks only.`;
}
function renderAlertPreview(){
  if(!$('#alertPreviewHeadline'))return;const b=alertInputBlock(),r=computeStateFor(site()),m=languageMeta($('#alertLanguage')?.value||'en');
  $('#alertPreviewLanguage').textContent=m.native;$('#alertPreviewState').textContent=r.state;$('#alertPreviewState').className=`preview-state ${r.state}`;$('#alertPreviewTime').textContent=istTime(Date.now());
  $('#alertPreviewHeadline').textContent=b.headline||'Generate an alert from current evidence';$('#alertPreviewDescription').textContent=b.description||'The preview updates as you select a language or edit the message.';$('#alertPreviewInstruction').textContent=b.instruction||'Protective action will appear here.';
  $('#alertPreviewSite').textContent=`${site().name} · ${site().area}`;$('#alertPreviewRadius').textContent=`${+($('#alertRadius')?.value||3)} km target`;
  const card=$('#citizenAlertCard');if(card)card.dataset.state=r.state;
}
function copyAlertText(){
  const b=alertInputBlock(),m=languageMeta($('#alertLanguage').value),text=`${b.headline}\n\n${b.description}\n\n${b.instruction}\n\nHIMGAURAV · ${site().name} · ${m.name}`.trim();
  const fallback=()=>{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();return ok;};
  Promise.resolve(navigator.clipboard?.writeText?navigator.clipboard.writeText(text):fallback()).then(()=>{auditAlert('COPY',`${m.name} alert copied to clipboard.`);toast('Alert text copied.');}).catch(()=>{if(fallback())toast('Alert text copied.');else toast('Clipboard access is blocked by this browser.');});
}
function downloadAlertJSON(){
  syncCurrentAlertBlockForExport();const data=alertPayload('local-json-export');delete data.cap_xml;const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`HIMGAURAV-alert-${site().id}-${todayISO()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);auditAlert('JSON',`${languageMeta($('#alertLanguage').value).name} structured alert JSON exported.`);
}
async function speakAlert(){
  const block=alertInputBlock();if(!block.headline){toast('Create or load an alert message first.');return;}
  const code=$('#alertLanguage').value,m=languageMeta(code),spoken=`${block.headline}. ${block.instruction}`.trim(),cap=voiceCapability(code);
  if(cap.kind==='remote'){
    const r=await postJSON('/api/tts',{language:code,text:spoken,gender:'female'});
    if(r.ok&&r.data?.audio_content){try{const src=String(r.data.audio_content).startsWith('data:')?r.data.audio_content:`data:${r.data.mime||'audio/wav'};base64,${r.data.audio_content}`;const audio=new Audio(src);audio.playbackRate=clamp(+APP.alertSettings.voiceRate||.95,.7,1.25);await audio.play();auditAlert('VOICE',`${m.name} alert read aloud with configured remote TTS.`);return;}catch(e){/* try local voice next */}}
  }
  const voice=matchingVoiceFor(code);if(!voice){toast(`No ${m.name} speech voice is installed in this browser. Text alerts and CAP export still work.`);renderAlertConnectors();return;}
  const u=new SpeechSynthesisUtterance(spoken);u.lang=m.bcp;u.voice=voice;u.rate=+APP.alertSettings.voiceRate||.95;window.speechSynthesis.cancel();window.speechSynthesis.speak(u);auditAlert('VOICE',`${m.name} alert read aloud with installed browser voice “${voice.name}”.`);
}
function playDrillSiren(){
  try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('Web Audio unavailable');const ac=new AC();const now=ac.currentTime;[0,.42,.84].forEach((off,i)=>{const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=i%2?660:880;g.gain.setValueAtTime(.0001,now+off);g.gain.exponentialRampToValueAtTime(.12,now+off+.03);g.gain.exponentialRampToValueAtTime(.0001,now+off+.32);o.connect(g).connect(ac.destination);o.start(now+off);o.stop(now+off+.34);});setTimeout(()=>ac.close(),1800);}catch(e){toast(`Siren test unavailable: ${e.message}`);}
}
async function enableBrowserNotification(){
  if(!('Notification'in window)){toast('Browser notifications are not supported here.');renderAlerts();return;}
  let perm=Notification.permission;if(perm==='default')perm=await Notification.requestPermission();if(perm==='granted'){new Notification('HIMGAURAV · DRILL',{body:'Browser notification channel is working on this device. This is not an official public alert.'});auditAlert('TEST','Browser notification permission granted and a local drill notification was shown.');}else toast(`Notification permission: ${perm}.`);renderAlerts();
}
function localAlertTest(){playDrillSiren();if('Notification'in window&&Notification.permission==='granted'){const b=alertInputBlock();new Notification(`[DRILL] ${b.headline||'HIMGAURAV local alert test'}`,{body:b.instruction||'Local alert channel test.'});}auditAlert('TEST','Local drill siren triggered on operator device.');toast('Local drill siren played.');}
function auditAlert(kind,detail){APP.alertAudit.unshift({t:Date.now(),kind,detail,mode:APP.mode,siteId:APP.siteId});if(APP.alertAudit.length>80)APP.alertAudit.length=80;storeSet(CFG.alertAuditKey,APP.alertAudit);renderAlertAudit();}
function renderAlertAudit(){const list=$('#alertAuditLog');if(!list)return;if(!APP.alertAudit.length){list.innerHTML='<li class="alert-empty">No alert draft, translation, test or delivery action has occurred yet.</li>';return;}list.innerHTML=APP.alertAudit.map(a=>`<li><time>${esc(istDateTime(a.t))}</time><b>${esc(a.kind)}</b><span>${esc(a.detail)} · ${a.mode==='demo'?'DEMO/EXERCISE':'LIVE SESSION'}</span></li>`).join('');}
function clearAlertAudit(){APP.alertAudit=[];storeSet(CFG.alertAuditKey,APP.alertAudit);renderAlertAudit();toast('Alert audit cleared from this browser.');}
function renderReadiness(){
  const b=alertBasis(),s=b.s,r=b.r,tag=$('#alertReadinessTag');if(!tag)return;
  $('#alertSiteMeta').textContent=`${s.name} · ${s.kind==='town'?'regional context':'monitored slope'} · ${s.area}`;const stateTitle=r.state==='NODATA'?'NO DATA · evidence unavailable':r.state==='CONTEXT'?'REGIONAL · context only':(STATES[r.state]?.word||r.state);$('#alertStateTitle').textContent=stateTitle;$('#alertStateReason').textContent=r.why;
  if($('#alertTargetLabel'))$('#alertTargetLabel').textContent=s.kind==='town'?`${s.name} · context point`:`${s.name} · monitored slope`;
  const disc=$('#alertStateDisc');disc.className=`alert-state-disc ${r.state}`;$('#alertStateGlyph').textContent=STATES[r.state]?.glyph||'?';
  const checks=[
    {ok:b.live,label:'Evidence mode',why:b.live?'LIVE evidence object; not scripted demo.':'DEMO mode can create exercise messages only.'},
    {ok:b.slope,label:'Slope target',why:b.slope?'Operational slope coordinate selected.':'Regional context points cannot become slope warnings.'},
    {ok:b.fresh,label:'Rainfall freshness',why:b.fresh?`Latest successful rainfall read: ${ageStr(b.age)}.`:'Rainfall input is absent or outside the freshness window.'},
    {ok:b.screening,label:'Trigger level',why:b.screening?`${r.state} permits a screening alert draft.`:`${r.state} does not justify WATCH/WARNING wording.`},
    {ok:b.corroborated,label:'Ground confirmation',why:b.corroborated?'Sustained same-slope inclination anomaly is present.':'No independent same-slope movement confirmation.'},
    {ok:true,label:'Language engine',why:'23 built-in alert templates work locally without an API key.'}
  ];
  $('#alertReadinessChecks').innerHTML=checks.map(x=>`<div class="readiness-check ${x.ok?'ok':'warn'}"><i>${x.ok?'✓':'!'}</i><div><b>${esc(x.label)}</b><span>${esc(x.why)}</span></div></div>`).join('');
  const ready=b.live&&b.slope&&b.fresh&&b.screening;if(ready){tag.className=`provenance ${r.state==='WARNING'?'sensor':'derived'}`;tag.textContent=r.state==='WARNING'?'CORROBORATED DRAFT':'SCREENING DRAFT';}else{tag.className='provenance proposed';tag.textContent=APP.mode==='demo'?'EXERCISE ONLY':'INTERNAL / NOT READY';}
  const q=$('#alertQuickDot');if(q)q.className=r.state==='WARNING'?'warning':r.state==='WATCH'?'watch':'';
}
function renderAlertConnectors(){
  const n=$('#browserNotifyStatus');if(n){const st=!('Notification'in window)?'UNSUPPORTED':Notification.permission==='granted'?'READY':Notification.permission==='denied'?'BLOCKED':'PERMISSION';n.textContent=st;n.className=`channel-status ${st==='READY'?'ok':st==='BLOCKED'?'bad':'warn'}`;}
  const code=$('#alertLanguage')?.value||APP.alertSettings.language||'en',m=languageMeta(code),cap=voiceCapability(code),a=$('#audioAlertStatus');if(a){a.textContent=cap.ok?'READY':'NO VOICE';a.className=`channel-status ${cap.ok?'ok':'warn'}`;}
  if($('#deviceVoiceStatus'))$('#deviceVoiceStatus').textContent=cap.ok?cap.label:`No installed ${m.name} voice. Text/CAP features remain fully available.`;
  if($('#speakAlert'))$('#speakAlert').disabled=!cap.ok;
  const wh=$('#agencyWebhookStatus'),whCard=$('#agencyWebhookCard');if(wh){wh.textContent=APP.alertConnectors.agencyWebhook?'CONFIGURED':'NOT CONFIGURED';wh.className=`channel-status ${APP.alertConnectors.agencyWebhook?'ok':''}`;}if(whCard)whCard.hidden=!APP.alertConnectors.agencyWebhook;if($('#sendAgencyWebhook'))$('#sendAgencyWebhook').disabled=!APP.alertConnectors.agencyWebhook;
  const gw=$('#localGatewayStatus'),gwCard=$('#localGatewayCard');if(gw){gw.textContent=APP.alertConnectors.localGateway?'CONFIGURED':'NOT CONFIGURED';gw.className=`channel-status ${APP.alertConnectors.localGateway?'ok':''}`;}if(gwCard)gwCard.hidden=!APP.alertConnectors.localGateway;if($('#sendLocalGateway'))$('#sendLocalGateway').disabled=!APP.alertConnectors.localGateway;
  const official=$('#officialFeedSection');if(official)official.hidden=!APP.alertConnectors.sachetFeed;
  const any=APP.alertConnectors.agencyWebhook||APP.alertConnectors.localGateway||APP.alertConnectors.sachetFeed;if($('#optionalConnectorSummary'))$('#optionalConnectorSummary').textContent=any?'Configured connectors are available below':'No external connector configured · core alert features still work';
}
function pickOfficialInfo(alert){
  const infos=alert?.infos||[];if(!infos.length)return null;
  const preferred=APP.alertSettings.language||'hi',meta=languageMeta(preferred);
  return infos.find(x=>x.language===meta.bcp||x.language===preferred)||infos.find(x=>/^en(?:-|$)/i.test(x.language||''))||infos[0];
}
function renderOfficialAlerts(){
  const box=$('#officialAlertFeed'),tag=$('#officialFeedStatus'),btn=$('#refreshOfficialFeed');if(!box||!tag)return;
  if(btn)btn.disabled=!APP.alertConnectors.sachetFeed;
  if(!APP.alertConnectors.sachetFeed){tag.className='provenance proposed';tag.textContent='NOT CONFIGURED';box.innerHTML='<div class="official-feed-empty">No authorised/read-only SACHET feed identifier is configured. Open the official SACHET portal for public alerts.</div>';return;}
  if(!APP.officialAlerts.length){tag.className='provenance reference';tag.textContent='READ-ONLY';box.innerHTML='<div class="official-feed-empty">Configured, but no CAP alert has been loaded yet. Refresh to request the official document.</div>';return;}
  tag.className='provenance live';tag.textContent='OFFICIAL · READ-ONLY';
  box.innerHTML=APP.officialAlerts.slice(0,12).map(a=>{const i=pickOfficialInfo(a)||{},areas=(i.areas||[]).map(x=>x.areaDesc).filter(Boolean).join(' · '),sent=a.sent&&Number.isFinite(Date.parse(a.sent))?istDateTime(Date.parse(a.sent)):'—';return `<article><div class="official-alert-top"><span class="official-agency">NDMA SACHET</span><span>${esc(a.status||'—')} · ${esc(i.severity||'Unknown')}</span></div><h3>${esc(i.headline||i.event||'Official CAP alert')}</h3><p>${esc(i.description||'No description in selected language block.')}</p>${i.instruction?`<div class="official-instruction"><b>Action</b>${esc(i.instruction)}</div>`:''}<footer><span>${esc(areas||'Area not specified')}</span><time>${esc(sent)}</time></footer></article>`;}).join('');
}
async function refreshOfficialAlerts({silent=false}={}){
  if(!APP.alertConnectors.sachetFeed){if(!silent)toast('No authorised SACHET CAP feed is configured in .env.');renderOfficialAlerts();return;}
  const tag=$('#officialFeedStatus');if(tag){tag.className='provenance reference';tag.textContent='FETCHING';}
  const r=await getJSON('/api/official-alerts');
  if(r.ok&&r.data?.ok){APP.officialAlerts=Array.isArray(r.data.alerts)?r.data.alerts:[];APP.officialAlertsFetchedAt=Date.now();auditAlert('OFFICIAL FEED',`Read-only SACHET CAP reference refreshed: ${APP.officialAlerts.length} alert record(s).`);if(!silent)toast(`Official SACHET feed refreshed · ${APP.officialAlerts.length} record(s).`);}else{if(!silent)toast(`Official feed unavailable: ${r.error}`);auditAlert('OFFICIAL FEED ERROR',r.error||'request failed');}
  renderOfficialAlerts();
}

function renderAlerts(){
  if(!$('#view-alerts'))return;
  if(APP.alertDraft?.siteId&&APP.alertDraft.siteId!==APP.siteId){const keep={workflow:APP.alertDraft.workflow,expiry:APP.alertDraft.expiry,radius:APP.alertDraft.radius,language:APP.alertDraft.language};APP.alertDraft={...keep,siteId:APP.siteId,translations:{}};generateAlertDraft({silent:true});}
  renderReadiness();renderAlertConnectors();renderAlertAudit();
  const tag=$('#alertModeTag');tag.className=`provenance ${APP.mode==='demo'?'demo':'proposed'}`;tag.textContent=APP.mode==='demo'?'EXERCISE / SIMULATED':'DRAFT · NOT OFFICIAL';
  if($('#alertRadius'))$('#alertRadius').value=String(APP.alertDraft?.radius||APP.alertSettings.radius||3);
  if($('#alertWorkflow')&&APP.alertDraft?.workflow)$('#alertWorkflow').value=APP.alertDraft.workflow;
  if($('#alertExpiry')&&APP.alertDraft?.expiry)$('#alertExpiry').value=String(APP.alertDraft.expiry);
  const code=APP.alertDraft?.language||APP.alertSettings.language||'en';if($('#alertLanguage')&&[...$('#alertLanguage').options].some(o=>o.value===code))$('#alertLanguage').value=code;
  if(!APP.alertDraft?.translations?.[code])localizeCurrentLanguage();else setAlertInputs(APP.alertDraft.translations[code]);
  renderSavedLanguages();renderLanguageCoverage();renderAlertPreview();renderOfficialAlerts();renderAlertConnectors();
}
function xmlEsc(v){return String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));}
function syncCurrentAlertBlockForExport(){const lang=$('#alertLanguage').value,block=alertInputBlock();if(!block.headline||!block.description||!block.instruction)return;APP.alertDraft.translations=APP.alertDraft.translations||{};const prev=APP.alertDraft.translations[lang]||{};APP.alertDraft.translations[lang]={...block,source:prev.source||(lang==='en'?'HIMGAURAV evidence template':'Unsaved operator text · review required'),reviewed:prev.reviewed===true||lang==='en'};saveAlertDraft();}
function capXML(){
  syncCurrentAlertBlockForExport();const b=alertBasis(),workflow=$('#alertWorkflow').value,radius=+$('#alertRadius').value||3,expiry=+$('#alertExpiry').value||60,severity=$('#alertSeverity').value==='auto'?alertSeverityFor(b.r.state):$('#alertSeverity').value,status=APP.mode==='demo'||workflow==='drill'?'Exercise':'Draft',scope=workflow==='internal'?'Restricted':'Public',identifier=`HIMGAURAV-${Date.now()}-${b.s.id}`;const sent=new Date().toISOString(),expires=new Date(Date.now()+expiry*60000).toISOString();
  const translations=APP.alertDraft?.translations||{};const blocks=Object.entries(translations).map(([code,t])=>{const m=languageMeta(code);return `<info><language>${xmlEsc(m.bcp)}</language><category>Geo</category><event>Landslide screening</event><responseType>${alertResponseFor(b.r.state)}</responseType><urgency>${alertUrgencyFor(b.r.state)}</urgency><severity>${xmlEsc(severity)}</severity><certainty>${alertCertaintyFor(b.r.state)}</certainty><effective>${sent}</effective><expires>${expires}</expires><senderName>HIMGAURAV research prototype</senderName><headline>${xmlEsc(t.headline)}</headline><description>${xmlEsc(t.description)}</description><instruction>${xmlEsc(t.instruction)}</instruction><parameter><valueName>HIMGAURAV-STATE</valueName><value>${xmlEsc(b.r.state)}</value></parameter><parameter><valueName>TRANSLATION-PROVENANCE</valueName><value>${xmlEsc(t.source||'operator')}</value></parameter><parameter><valueName>HIMGAURAV-EVIDENCE</valueName><value>${xmlEsc(b.r.why||'')}</value></parameter><parameter><valueName>RAINFALL-PEAK-RATIO</valueName><value>${xmlEsc(Number.isFinite(b.r.ev?.maxRatio)?nfmt(b.r.ev.maxRatio,2):'NA')}</value></parameter><parameter><valueName>SENSOR-CORROBORATION</valueName><value>${b.corroborated?'SUSTAINED-INCLINATION-ANOMALY':'NONE'}</value></parameter><parameter><valueName>DATA-AGE-MIN</valueName><value>${Number.isFinite(b.age)?Math.round(b.age/60000):'NA'}</value></parameter><area><areaDesc>${xmlEsc(`${b.s.name} · ${b.s.area} · operator-selected ${radius} km alert circle`)}</areaDesc><circle>${b.s.lat.toFixed(6)},${b.s.lon.toFixed(6)} ${radius.toFixed(1)}</circle></area></info>`;}).join('');
  const restriction=scope==='Restricted'?'<restriction>HIMGAURAV operators / research workflow</restriction>':'';return `<?xml version="1.0" encoding="UTF-8"?>\n<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2"><identifier>${xmlEsc(identifier)}</identifier><sender>himgaurav@research.local</sender><sent>${sent}</sent><status>${status}</status><msgType>Alert</msgType><scope>${scope}</scope>${restriction}<note>Research-prototype CAP package. Public dissemination requires authorised authority review and downstream system acceptance.</note>${blocks}</alert>`;
}
function downloadCAP(){const xml=capXML(),blob=new Blob([xml],{type:'application/cap+xml;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`HIMGAURAV-CAP-${site().id}-${todayISO()}.xml`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);auditAlert('CAP',`CAP 1.2 XML exported for ${site().name}; workflow ${$('#alertWorkflow').value}.`);}
function alertPayload(kind='draft'){const b=alertBasis(),block=alertInputBlock();return {kind,prototype:'HIMGAURAV',mode:APP.mode,workflow:$('#alertWorkflow').value,state:b.r.state,site:{id:b.s.id,name:b.s.name,area:b.s.area,lat:b.s.lat,lon:b.s.lon},radius_km:+$('#alertRadius').value||3,language:$('#alertLanguage').value,message:block,cap_xml:capXML(),created_at:new Date().toISOString(),public_authority:false};}
async function sendAgencyWebhook(){if(!APP.alertConnectors.agencyWebhook){toast('Agency webhook is not configured in .env.');return;}if(!confirm('Send this DRAFT alert package to the configured agency/test webhook? This is not NDMA/SACHET publication.'))return;const r=await postJSON('/api/alert/webhook',alertPayload('agency-draft'));if(r.ok){auditAlert('WEBHOOK','Draft delivered to configured agency/test webhook.');toast('Draft webhook delivered.');}else{auditAlert('WEBHOOK ERROR',r.error);toast(`Webhook failed: ${r.error}`);}}
async function sendLocalGateway(){if(!APP.alertConnectors.localGateway){toast('Local gateway webhook is not configured in .env.');return;}const p=alertPayload('local-gateway-test');p.test=true;const r=await postJSON('/api/alert/local-gateway',p);if(r.ok){auditAlert('GATEWAY','Test alert packet delivered to configured local gateway.');toast('Local gateway test packet delivered.');}else{auditAlert('GATEWAY ERROR',r.error);toast(`Gateway failed: ${r.error}`);}}
function previewAlertZone(){
  const s=site(),radius=+$('#alertRadius').value||3;APP.alertSettings.radius=radius;saveAlertDraft();if(!APP.map||!window.L){toast('Full GIS map is unavailable; radius is still saved in the CAP draft.');go('command');return;}if(APP.alertZone)APP.map.removeLayer(APP.alertZone);const state=computeStateFor(s).state,color=STATES[state]?.color||'#c35724';APP.alertZone=L.circle([s.lat,s.lon],{radius:radius*1000,color,weight:2,fillColor:color,fillOpacity:.08,dashArray:'6 5',interactive:false}).addTo(APP.map);APP.map.fitBounds(APP.alertZone.getBounds(),{padding:[34,34],maxZoom:13});go('command');toast(`${radius} km operator-selected alert zone previewed. It is not a run-out model.`);
}
function openAlertSettings(){
  const st=APP.alertSettings;$('#settingsLanguage').value=st.language;$('#settingsRadius').value=String(st.radius);$('#settingsVoiceRate').value=String(st.voiceRate);$('#settingsAutoDraft').value=st.autoDraft;$('#settingsBrowserNotify').checked=!!st.browserNotify;$('#settingsAutoSpeak').checked=!!st.autoSpeak;$('#settingsHighContrastAlert').checked=!!st.highContrast;renderAlertSettingsStatus();$('#alertSettingsDialog').showModal();
}
function renderAlertSettingsStatus(){
  const code=$('#settingsLanguage')?.value||APP.alertSettings.language||'en',cap=voiceCapability(code);if($('#settingsVoiceStatus'))$('#settingsVoiceStatus').textContent=cap.label;
  if($('#settingsNotificationStatus'))$('#settingsNotificationStatus').textContent=!('Notification'in window)?'Unsupported':Notification.permission==='granted'?'Ready':Notification.permission==='denied'?'Blocked by browser':'Permission not yet granted';
  if($('#settingsWebhookStatus'))$('#settingsWebhookStatus').textContent=APP.alertConnectors.agencyWebhook?'Configured server-side':'Not configured';if($('#settingsGatewayStatus'))$('#settingsGatewayStatus').textContent=APP.alertConnectors.localGateway?'Configured server-side':'Not configured';if($('#settingsSachetStatus'))$('#settingsSachetStatus').textContent=APP.alertConnectors.sachetFeed?'Configured · read-only':'Not configured';
}
function saveAlertSettings(){
  APP.alertSettings={language:$('#settingsLanguage').value,radius:+$('#settingsRadius').value||3,voiceRate:+$('#settingsVoiceRate').value||.95,autoDraft:$('#settingsAutoDraft').value,browserNotify:$('#settingsBrowserNotify').checked,autoSpeak:$('#settingsAutoSpeak').checked,highContrast:$('#settingsHighContrastAlert').checked};storeSet(CFG.alertSettingsKey,APP.alertSettings);document.body.classList.toggle('high-contrast-alert',APP.alertSettings.highContrast);if($('#alertRadius'))$('#alertRadius').value=String(APP.alertSettings.radius);if($('#alertLanguage')){$('#alertLanguage').value=APP.alertSettings.language;APP.alertDraft.language=APP.alertSettings.language;loadAlertLanguage(APP.alertSettings.language);}toast('Alert settings saved locally.');auditAlert('SETTINGS','Alert configuration updated on this operator device.');renderAlertConnectors();
}
async function probeGateway(){const r=await getJSON('/api/health');if(r.ok&&r.data?.ok){APP.alertConnectors.server=true;APP.alertConnectors.bhashini=false;APP.alertConnectors.bhashiniTts=false;APP.alertConnectors.agencyWebhook=!!r.data.alert_webhook_configured;APP.alertConnectors.localGateway=!!r.data.local_gateway_configured;APP.alertConnectors.sachetFeed=!!r.data.sachet_feed_configured;}renderAlertConnectors();renderAlertSettingsStatus();renderOfficialAlerts();if(APP.alertConnectors.sachetFeed&&!APP.officialAlertsFetchedAt)refreshOfficialAlerts({silent:true});}
function maybeAutoAlert(s,prev,r){
  if(APP.mode!=='live')return;const setting=APP.alertSettings.autoDraft;if(setting==='off')return;const qualifies=setting==='warning'?r.state==='WARNING':['WATCH','WARNING'].includes(r.state);if(!qualifies)return;const key=`${s.id}:${r.state}`;if(APP.lastAutoAlert[s.id]===key)return;APP.lastAutoAlert[s.id]=key;auditAlert('INTERNAL',`${s.name} changed ${prev} → ${r.state}; internal alert draft created. Nothing was sent to a public channel.`);
  const code=APP.alertSettings.language||'en',template=buildLocalizedAlert(code,s,r);APP.alertDraft.translations=APP.alertDraft.translations||{};APP.alertDraft.translations[code]=template;if(code!=='en'&&!APP.alertDraft.translations.en){APP.alertDraft.translations.en=buildLocalizedAlert('en',s,r);APP.alertDraft.translations.en.reviewed=true;}storeSet(CFG.alertDraftKey,APP.alertDraft);
  if(APP.alertSettings.browserNotify&&'Notification'in window&&Notification.permission==='granted')new Notification(`HIMGAURAV · ${r.state} · ${s.name}`,{body:template.instruction});
  if(APP.alertSettings.autoSpeak&&r.state==='WARNING'&&s.id===APP.siteId&&voiceCapability(code).ok){$('#alertLanguage').value=code;setAlertInputs(template);speakAlert();}
}


function renderAll(){renderCommand();renderSatellite();renderSensor();renderEvents();renderAlerts();renderMeasurements();renderSources();}

function selectSite(id,fly=false){if(!APP.sites.some(s=>s.id===id))return;if(APP.alertZone&&APP.map){APP.map.removeLayer(APP.alertZone);APP.alertZone=null;}APP.siteId=id;$('#siteSelect').value=id;$('#tsSite').value=id;if($('#satSiteSelect'))$('#satSiteSelect').value=id;const s=site();if(fly&&APP.map)APP.map.flyTo([s.lat,s.lon],Math.max(APP.map.getZoom(),10),{duration:.7});if(APP.satMap){APP.satMap.flyTo([s.lat,s.lon],s.kind==='town'?10:13,{duration:.7});updateSatelliteMarker();}updateFallbackMap();renderCommand();renderSatelliteMeta();renderAlerts();window.dispatchEvent(new CustomEvent('himgaurav:sitechange',{detail:{site:{...s}}}));}
function go(view){APP.view=view;$$('.view').forEach(v=>v.classList.toggle('is-active',v.id===`view-${view}`));$$('.rail button[data-view], .mobile-nav button[data-view]').forEach(b=>b.setAttribute('aria-current',b.dataset.view===view?'page':'false'));if(location.hash!==`#${view}`)history.replaceState(null,'',`#${view}`);if(view==='command'&&APP.map)setTimeout(()=>APP.map.invalidateSize(),30);if(view==='satellite'){renderSatellite();if(APP.satMap)setTimeout(()=>APP.satMap.invalidateSize(),30);}if(view==='alerts')renderAlerts();if(view==='rescue'){updateRescueMetricLabel();renderMeasurements();}}
function fillSelects(){
  const ssel=$('#siteSelect'),tss=$('#tsSite'),satSel=$('#satSiteSelect');ssel.innerHTML='';tss.innerHTML='';if(satSel)satSel.innerHTML='';for(const s of APP.sites){for(const target of [ssel,tss,satSel].filter(Boolean)){const o=document.createElement('option');o.value=s.id;o.textContent=`${s.kind==='town'?'Context':'Slope'} · ${s.name} · ${s.area}`;target.appendChild(o);}}ssel.value=APP.siteId;tss.value=ctx().sensor.siteId||APP.siteId;if(satSel)satSel.value=APP.siteId;
  const sign=$('#reportSign');sign.innerHTML=PRECURSOR_SIGNS.map(x=>`<option value="${x.id}">${esc(x.label)}</option>`).join('');
  for(const id of ['tsTilt','tsMoist','tsRain','tsBattery','tsRssi']){const e=$('#'+id);e.innerHTML=id==='tsTilt'?'':'<option value="0">Not mapped</option>';for(let i=1;i<=8;i++)e.insertAdjacentHTML('beforeend',`<option value="${i}">Field ${i}</option>`);}
  const cfg=storeGet(CFG.sensorConfigKey,null)||window.HIMGAURAV_CONFIG?.thingSpeak||{};if(cfg.channelId)$('#tsChannel').value=cfg.channelId;$('#tsTilt').value=String(cfg.tiltField||1);$('#tsMoist').value=String(cfg.moistureField||0);$('#tsRain').value=String(cfg.rainField||0);$('#tsBattery').value=String(cfg.batteryField||0);$('#tsRssi').value=String(cfg.rssiField||0);
  const langOptions=INDIAN_LANGUAGES.map(l=>`<option value="${l.code}">${esc(l.native)} · ${esc(l.name)}</option>`).join('');for(const id of ['alertLanguage','settingsLanguage']){const e=$('#'+id);if(e)e.innerHTML=langOptions;}if($('#alertLanguage'))$('#alertLanguage').value=APP.alertDraft?.language||APP.alertSettings.language||'en';if($('#settingsLanguage'))$('#settingsLanguage').value=APP.alertSettings.language||'hi';
  document.body.classList.toggle('high-contrast-alert',!!APP.alertSettings.highContrast);
}


function autoConnectConfiguredSensor(){
  if(APP.mode!=='live')return;
  const cfg=storeGet(CFG.sensorConfigKey,null)||window.HIMGAURAV_CONFIG?.thingSpeak||{};
  const ch=String(cfg.channelId||'').trim();
  if(!/^\d+$/.test(ch))return;
  const s=APP.live.sensor;
  s.channel=ch;
  s.siteId=cfg.siteId&&APP.sites.some(x=>x.id===cfg.siteId)?cfg.siteId:APP.siteId;
  s.fields={tilt:+(cfg.tiltField||1),moisture:+(cfg.moistureField||0),rain:+(cfg.rainField||0),battery:+(cfg.batteryField||0),rssi:+(cfg.rssiField||0)};
  s.status='loading';
  setFeed('#feedSensor','','connecting');
  pollSensor();
  clearInterval(APP.timers.sensor);
  APP.timers.sensor=setInterval(pollSensor,CFG.sensorPollMs);
}

function connectSensor(){
  if(APP.mode==='demo'){toast('Switch to LIVE before connecting a real ThingSpeak channel.');return;}const ch=$('#tsChannel').value.trim();if(!/^\d+$/.test(ch)){toast('Enter a numeric public ThingSpeak channel ID.');return;}const s=APP.live.sensor;s.channel=ch;s.siteId=$('#tsSite').value;s.fields={tilt:+$('#tsTilt').value,moisture:+$('#tsMoist').value,rain:+$('#tsRain').value,battery:+$('#tsBattery').value,rssi:+$('#tsRssi').value};s.status='loading';storeSet(CFG.sensorConfigKey,{channelId:ch,tiltField:s.fields.tilt,moistureField:s.fields.moisture,rainField:s.fields.rain,batteryField:s.fields.battery,rssiField:s.fields.rssi,siteId:s.siteId});setFeed('#feedSensor','','connecting');logEvent('sensor','Field node connection requested',`Public ThingSpeak channel ${ch}, tilt field ${s.fields.tilt}, bound to ${APP.sites.find(x=>x.id===s.siteId)?.name||s.siteId}.`,'ThingSpeak');pollSensor();clearInterval(APP.timers.sensor);APP.timers.sensor=setInterval(pollSensor,CFG.sensorPollMs);
}
function disconnectSensor(){if(APP.mode==='demo'){toast('Demo sensor belongs to the scripted scenario.');return;}APP.live.sensor=freshSensor();clearInterval(APP.timers.sensor);setFeed('#feedSensor','','not connected');localStorage.removeItem(CFG.sensorConfigKey);logEvent('sensor','Field node disconnected','No instrument is currently used by the state engine.','HIMGAURAV');renderAll();}
function addReport(){const sign=$('#reportSign').value,note=$('#reportNote').value.trim(),arr=APP.reports[APP.siteId]||(APP.reports[APP.siteId]=[]);arr.unshift({t:Date.now(),sign,note});if(arr.length>30)arr.length=30;storeSet(CFG.reportKey,APP.reports);$('#reportNote').value='';logEvent('report',`${site().name}: local observation added`,PRECURSOR_SIGNS.find(x=>x.id===sign)?.label||sign,'Operator-entered / unverified');renderCommand();toast('Report saved locally. It does not change the automated state.');}
function addMeasurement(){
  const depth=parseFloat($('#mlDepth').value),dist=parseFloat($('#mlDist').value),mod=$('#mlMod').value,moist=$('#mlMoist').value,rep=Math.max(1,parseInt($('#mlRep').value)||1),rawMetric=$('#mlMetric').value.trim(),metric=rawMetric===''?null:parseFloat(rawMetric),meta=rescueMetricMeta(mod);
  if(!ACUSEARCH_MODALITIES[mod]||!Number.isFinite(depth)||depth<0||!Number.isFinite(dist)||dist<0||!ACUSEARCH_MOISTURE.includes(moist)){toast('Enter a valid modality, burial depth, soil condition and lateral distance.');return;}
  if(rawMetric!==''&&!Number.isFinite(metric)){toast(`Enter a numeric ${meta.metric} value or leave it blank.`);return;}
  APP.measurements.unshift({t:Date.now(),mod,depth,moist,dist,detected:$('#mlDet').value==='yes',metric,metricUnit:meta.unit,rep,note:$('#mlNote').value.trim()});
  storeSet(CFG.rescueKey,APP.measurements);$('#mlDist').value='';$('#mlMetric').value='';$('#mlNote').value='';renderMeasurements();logEvent('experiment','AcuSearch field measurement logged',`${meta.label}, ${depth} m burial, ${dist} m lateral, ${moist}, ${$('#mlDet').value}.`,'Operator-entered research data');toast('Measurement stored locally. No rescue range is inferred from one trial.');
}
function exportMeasurements(){
  if(!APP.measurements.length){toast('No measurements to export.');return;}const rows=[['time_ist','signal','burial_depth_m','soil_condition','lateral_distance_m','detected','metric_value','metric_unit','replicate','note'],...APP.measurements.map(m=>[istDateTime(m.t),m.mod,m.depth,m.moist,m.dist,m.detected?'yes':'no',m.metric??'',m.metricUnit||rescueMetricMeta(m.mod).unit,m.rep||1,m.note])];const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n'),blob=new Blob([csv],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='HIMGAURAV-AcuSearch-link-budget.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('AcuSearch CSV exported.');
}
function addCustomSite(){const name=$('#customName').value.trim(),lat=parseFloat($('#customLat').value),lon=parseFloat($('#customLon').value);if(!name||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<28||lat>35||lon<73||lon>82){toast('Enter a name and plausible Himalayan coordinates.');return false;}const id=`custom-${Date.now().toString(36)}`,s={id,name,area:'Custom browser point',lat,lon,kind:'custom',inDomain:false,basis:'Operator-added coordinate. The Shimla threshold is an extrapolation here.',cites:[1]};APP.sites.push(s);storeSet(CFG.customSitesKey,APP.sites.filter(x=>x.kind==='custom'));fillSelects();selectSite(id,true);$('#siteDialog').close();renderMapMarkers();if(APP.mode==='live')fetchWeather(true);return true;}
function haversine(a,b){const R=6371,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,d1=(b.lat-a.lat)*Math.PI/180,d2=(b.lon-a.lon)*Math.PI/180,x=Math.sin(d1/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function nearestSite(){if(!navigator.geolocation){toast('Geolocation is not available in this browser.');return;}navigator.geolocation.getCurrentPosition(pos=>{const p={lat:pos.coords.latitude,lon:pos.coords.longitude};let best=null,d=Infinity;for(const s of APP.sites){const x=haversine(p,s);if(x<d){d=x;best=s;}}if(best){selectSite(best.id,true);toast(`Nearest site/context point: ${best.name} · ${nfmt(d,1)} km`);}},()=>toast('Location permission was not available.'),{enableHighAccuracy:false,timeout:8000,maximumAge:300000});}
function useBrowserLocation(){navigator.geolocation?.getCurrentPosition(pos=>{$('#customLat').value=pos.coords.latitude.toFixed(6);$('#customLon').value=pos.coords.longitude.toFixed(6);},()=>toast('Location permission was not available.'),{timeout:8000});}

function openDetail(title,html){
  $('#detailTitle').textContent=title;
  $('#detailBody').innerHTML=html;
  const d=$('#detailDialog'); if(typeof d.showModal==='function')d.showModal(); else d.setAttribute('open','');
}
function thresholdDetail(){
  const s=site(),r=computeStateFor(s),ev=r.ev;
  let html=`<p><b>${esc(s.name)}</b> uses the published Shimla intensity–duration curve <code>I = 7.20 × D<sup>−0.26</sup></code>, where I is mean daily rainfall intensity (mm/day) over duration D (days).</p>`;
  if(!s.inDomain)html+=`<div class="truth-note"><b>Extrapolation:</b> this curve was fitted for Shimla, not ${esc(s.name)}. Treat this as screening evidence, not a calibrated local forecast.</div>`;
  if(!ev){html+='<p>No complete rainfall series is available for this site.</p>';openDetail('Rainfall threshold detail',html);return;}
  html+='<div class="table-wrap"><table><thead><tr><th>Duration</th><th>Cumulative</th><th>Mean intensity</th><th>Threshold</th><th>Ratio</th></tr></thead><tbody>'+
    ev.rows.map(x=>`<tr><td>${x.D} d</td><td>${x.cum==null?'—':nfmt(x.cum,1)+' mm'}</td><td>${x.I==null?'—':nfmt(x.I,2)+' mm/d'}</td><td>${nfmt(x.thr,2)} mm/d</td><td>${x.ratio==null?'—':nfmt(x.ratio,2)+'×'}</td></tr>`).join('')+
    '</tbody></table></div>';
  html+=`<p><b>Interpretation:</b> ratio ≥ 1 means rainfall has entered the empirical band associated with historical landslide occurrence. It is a necessary screening condition, not a probability of failure. This app never converts it into a fabricated “AI confidence” percentage.</p>`;
  openDetail('Rainfall threshold detail',html);
}
function evidenceDetail(){
  const s=site(),r=computeStateFor(s),c=ctx(),sen=c.sensor,reps=APP.reports[s.id]||[];
  const truth=r.cached?'REFERENCE/CACHED':'LIVE INPUT + DERIVED';
  const html=`
    <div class="detail-grid">
      <section><span class="prov derived">DERIVED</span><h4>Automated state</h4><p><b>${esc(r.state)}</b> — ${esc(r.why)}</p>${r.reasons.map(x=>`<p>${x.ok?'●':'○'} ${esc(x.text)}</p>`).join('')}</section>
      <section><span class="prov live">${truth}</span><h4>Rainfall input</h4><p>${r.ev?`24 h ${nfmt(r.ev.r24,1)} mm · 72 h ${nfmt(r.ev.r72,1)} mm · peak threshold ratio ${nfmt(r.ev.maxRatio,2)}×.`:'No usable rainfall input.'}</p><p>${r.cached?'The visible series came from browser cache and retains its original fetch age.':'Open‑Meteo numerical-model values are gridded estimates, not an IMD rain gauge.'}</p></section>
      <section><span class="prov sensor">${sen.status==='ok'&&sen.siteId===s.id?'SENSOR':'NONE'}</span><h4>Ground corroboration</h4><p>${sen.status==='ok'&&sen.siteId===s.id?`${esc(sen.health)} — ${esc(sen.healthWhy)}`:'No live field instrument is bound to this slope. The engine cannot escalate a rainfall WATCH to WARNING.'}</p></section>
      <section><span class="prov report">REPORT</span><h4>Human observations</h4><p>${reps.length?`${reps.length} unverified local observation(s) are stored in this browser. They remain visible evidence but never modify the automated state.`:'No local observation logged.'}</p></section>
    </div>`;
  openDetail(`${s.name} · evidence inspector`,html);
}
function dataTruthDetail(){
  openDetail('Data-truth contract',`<p>Every visible value has a provenance. The interface deliberately keeps categories separate so simulated, experimental or static material cannot masquerade as a live measurement.</p><dl class="truth-list"><dt>LIVE</dt><dd>Fetched from a named external source during this session.</dd><dt>DERIVED</dt><dd>Computed locally from a live/reference input; formula or rule is inspectable.</dd><dt>REFERENCE</dt><dd>Dated static information, never described as current.</dd><dt>SENSOR</dt><dd>Received from a connected field instrument / public ThingSpeak channel.</dd><dt>SIMULATED</dt><dd>Generated only by the deterministic demonstration and discarded when LIVE is restored.</dd><dt>EXPERIMENTAL</dt><dd>A real method that is not validated as a warning method at this deployment.</dd><dt>PROPOSED</dt><dd>Architecture or integration that does not yet exist in the prototype.</dd></dl>`);
}
function switchBase(name){
  if(!APP.map||!APP.layers[name]||APP.layers.activeBase===name)return;
  const old=APP.layers[APP.layers.activeBase]; if(old)APP.map.removeLayer(old);
  APP.layers[name].addTo(APP.map); APP.layers.activeBase=name;
  $$('[data-base]').forEach(b=>b.classList.toggle('active',b.dataset.base===name));
  if(name==='satellite')toast('NASA GIBS true-colour Earth observation · dated imagery, not a live camera feed.');
}
function copyLog(){
  const c=ctx(); if(!c.log.length){toast('No session events to copy.');return;}
  const text=c.log.map(e=>`${istDateTime(e.t)}\t${e.title}\t${e.detail||''}\t${e.source||''}\t${e.mode==='demo'?'SIMULATED':'LIVE SESSION'}`).join('\n');
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>toast('Event log copied.')).catch(()=>fallbackCopy(text)); else fallbackCopy(text);
}
function fallbackCopy(text){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('Event log copied.');}catch{toast('Copy was not available.');}ta.remove();}
function clearLog(){ctx().log.length=0;renderEvents();toast(APP.mode==='demo'?'Demo session log cleared.':'Live-session log cleared.');}
function clearMeasurements(){if(!APP.measurements.length)return;if(!confirm('Clear the locally stored AcuSearch experiment measurements?'))return;APP.measurements=[];storeSet(CFG.rescueKey,APP.measurements);renderMeasurements();toast('Local experiment measurements cleared.');}
function refreshAll(){
  if(APP.mode==='demo'){APP.demo=buildDemo();renderAll();toast('Demo scene regenerated deterministically.');return;}
  fetchWeather(true); if(APP.live.sensor.channel)pollSensor();
  if($('#toggleQuakes').getAttribute('aria-pressed')==='true')fetchQuakes();
  if($('#toggleRadar').getAttribute('aria-pressed')==='true')fetchRadar().then(ok=>{if(ok){if(APP.layers.radar)APP.map.removeLayer(APP.layers.radar);$('#toggleRadar').setAttribute('aria-pressed','false');toggleRadar();}});
}
function wireUI(){
  $$('.rail button[data-view], .mobile-nav button[data-view]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));
  $('#openSatelliteQuick')?.addEventListener('click',()=>go('satellite'));
  $('#openValidationQuick')?.addEventListener('click',()=>go('validation'));
  $('#openRescueQuick')?.addEventListener('click',()=>go('rescue'));
  $('#openAlertQuick')?.addEventListener('click',()=>go('alerts'));
  $('#alertOpenCommand')?.addEventListener('click',()=>go('command'));
  $('#openAlertSettings')?.addEventListener('click',openAlertSettings);
  $('#alertLanguage')?.addEventListener('change',e=>{APP.alertDraft.language=e.target.value;saveAlertDraft();loadAlertLanguage(e.target.value);});
  $('#alertRadius')?.addEventListener('change',()=>{saveAlertDraft();renderAlertPreview();renderReadiness();});
  $('#alertWorkflow')?.addEventListener('change',saveAlertDraft);$('#alertExpiry')?.addEventListener('change',saveAlertDraft);$('#alertSeverity')?.addEventListener('change',saveAlertDraft);
  $('#generateAlertDraft')?.addEventListener('click',()=>generateAlertDraft());$('#translateAlert')?.addEventListener('click',translateAlert);$('#generateAllLanguages')?.addEventListener('click',generateAllLanguagePack);$('#generateAllLanguages2')?.addEventListener('click',generateAllLanguagePack);$('#saveAlertLanguage')?.addEventListener('click',()=>saveCurrentLanguageBlock());$('#speakAlert')?.addEventListener('click',speakAlert);
  $('#copyAlertText')?.addEventListener('click',copyAlertText);$('#downloadAlertJSON')?.addEventListener('click',downloadAlertJSON);
  for(const id of ['alertHeadline','alertDescription','alertInstruction'])$('#'+id)?.addEventListener('input',renderAlertPreview);
  const pickLang=e=>{const b=e.target.closest('[data-alert-lang]');if(!b)return;const code=b.dataset.alertLang;if($('#alertLanguage')){$('#alertLanguage').value=code;APP.alertDraft.language=code;saveAlertDraft();loadAlertLanguage(code);}};
  $('#savedLanguages')?.addEventListener('click',pickLang);$('#languageCoverageGrid')?.addEventListener('click',pickLang);
  $('#enableBrowserNotify')?.addEventListener('click',enableBrowserNotification);$('#testLocalAlert')?.addEventListener('click',localAlertTest);$('#downloadCAP')?.addEventListener('click',downloadCAP);$('#sendAgencyWebhook')?.addEventListener('click',sendAgencyWebhook);$('#sendLocalGateway')?.addEventListener('click',sendLocalGateway);$('#previewAlertZone')?.addEventListener('click',previewAlertZone);$('#clearAlertAudit')?.addEventListener('click',clearAlertAudit);$('#refreshOfficialFeed')?.addEventListener('click',()=>refreshOfficialAlerts());
  $('#settingsLanguage')?.addEventListener('change',renderAlertSettingsStatus);
  $('#alertSettingsForm')?.addEventListener('submit',e=>{e.preventDefault();saveAlertSettings();$('#alertSettingsDialog').close();});
  if('speechSynthesis'in window)window.speechSynthesis.addEventListener?.('voiceschanged',()=>{renderAlertConnectors();renderLanguageCoverage();renderAlertSettingsStatus();});
  $('#siteSelect').addEventListener('change',e=>selectSite(e.target.value,true));
  $('#satSiteSelect')?.addEventListener('change',e=>selectSite(e.target.value,true));
  $$('[data-sat-product]').forEach(b=>b.addEventListener('click',()=>setSatelliteProduct(b.dataset.satProduct)));
  $('#satDate')?.addEventListener('change',e=>setSatelliteDate(e.target.value));
  $('#satPrevDay')?.addEventListener('click',()=>setSatelliteDate(shiftISODate(APP.satDate,-1)));
  $('#satNextDay')?.addEventListener('click',()=>setSatelliteDate(shiftISODate(APP.satDate,1)));
  $('#satLatest')?.addEventListener('click',()=>setSatelliteDate(isoDaysAgo(satMeta().lagDays)));
  $('#satOpacity')?.addEventListener('input',e=>APP.satLayer?.setOpacity((+e.target.value)/100));
  $('#nearestSite').addEventListener('click',nearestSite); $('#openSiteDialog').addEventListener('click',()=>$('#siteDialog').showModal());
  $('#useBrowserLocation').addEventListener('click',useBrowserLocation);
  $('#siteForm').addEventListener('submit',e=>{e.preventDefault();addCustomSite();});
  $('#toggleRadar').addEventListener('click',toggleRadar); $('#toggleQuakes').addEventListener('click',toggleQuakes);
  $$('[data-base]').forEach(b=>b.addEventListener('click',()=>switchBase(b.dataset.base)));
  $$('[data-hour]').forEach(b=>b.addEventListener('click',()=>{APP.forecastHour=+b.dataset.hour;$$('[data-hour]').forEach(x=>x.classList.toggle('active',x===b));renderForecastLayer();}));
  $('#legendMore').addEventListener('click',dataTruthDetail); $('#evidenceExpand').addEventListener('click',evidenceDetail); $('#openRainDetail').addEventListener('click',thresholdDetail);
  $('#addReport').addEventListener('click',addReport); $('#connectSensor').addEventListener('click',connectSensor); $('#disconnectSensor').addEventListener('click',disconnectSensor);
  $('#copyLog').addEventListener('click',copyLog); $('#clearLog').addEventListener('click',clearLog);
  $('#addMeasurement').addEventListener('click',addMeasurement); $('#exportMeasurements').addEventListener('click',exportMeasurements); $('#clearMeasurements').addEventListener('click',clearMeasurements);
  $('#mlMod')?.addEventListener('change',updateRescueMetricLabel);
  $('#importMeasurementsBtn')?.addEventListener('click',()=>$('#importMeasurements')?.click());
  $('#importMeasurements')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importMeasurementsFile(f);e.target.value='';});
  for(const id of ['rescueFilterMod','rescueFilterMoist','rescueFilterDepth'])$('#'+id)?.addEventListener('change',renderMeasurements);
  $('#acuToneGain')?.addEventListener('input',updateToneGainLabel);$('#acuToneFreq')?.addEventListener('change',()=>{if(acuOsc)acuOsc.frequency.value=+$('#acuToneFreq').value;});
  $('#acuToneStart')?.addEventListener('click',startAcuTone);$('#acuToneStop')?.addEventListener('click',stopAcuTone);$('#acuMicStart')?.addEventListener('click',startAcuMic);$('#acuMicStop')?.addEventListener('click',stopAcuMic);$('#acuUseMic')?.addEventListener('click',useAcuMicMetric);
  $('#modeLive').addEventListener('click',()=>setMode('live')); $('#modeDemo').addEventListener('click',()=>setMode('demo')); $('#demoPrev').addEventListener('click',()=>stepDemo(-1)); $('#demoNext').addEventListener('click',()=>stepDemo(1));
  $('#refreshAll').addEventListener('click',refreshAll); $('#closeDetail').addEventListener('click',()=>$('#detailDialog').close());
  $('#detailDialog').addEventListener('click',e=>{if(e.target===$('#detailDialog'))$('#detailDialog').close();});
  $('#siteDialog').addEventListener('click',e=>{if(e.target===$('#siteDialog'))$('#siteDialog').close();});
  $('#siteStatusTable').addEventListener('click',e=>{const b=e.target.closest('[data-site]');if(b){selectSite(b.dataset.site,true);go('command');}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#detailDialog').open)$('#detailDialog').close();if($('#siteDialog').open)$('#siteDialog').close();if($('#alertSettingsDialog')?.open)$('#alertSettingsDialog').close();}});
}
async function boot(){
  fillSelects(); wireUI(); setFeed('#feedMap','','loading');
  const cached=restoreWeather(); if(cached){setFeed('#feedWeather','warn',`${cached} cached`);logEvent('feed','Cached rainfall restored',`${cached} site series restored while a fresh request starts.`,'Browser cache');}
  else setFeed('#feedWeather','','starting');
  setFeed('#feedRadar','','standby'); setFeed('#feedSatellite','','standby'); setFeed('#feedSensor','','not connected');
  if(!APP.alertDraft?.translations?.en)generateAlertDraft({silent:true});else loadAlertLanguage(APP.alertDraft.language||APP.alertSettings.language||'en');
  renderAll();updateRescueMetricLabel();updateToneGainLabel();probeGateway();
  const requestedView=location.hash.slice(1);
  if(['command','satellite','sensor','events','validation','alerts','rescue','research'].includes(requestedView))go(requestedView);
  detectStateChanges(APP.live); fetchWeather(false); autoConnectConfiguredSensor();

  /* Map loading must never block the live data panels. */
  const mapPromise=window.HIMGAURAV_MAP_READY||Promise.resolve(!!window.L);
  let settled=false;
  mapPromise.then(ok=>{settled=true;if(ok&&!APP.map){initMap();renderAll();}else if(!ok&&!APP.map){showMapFallback('The full GIS engine could not be loaded from the configured mirrors.');}});
  setTimeout(()=>{if(!settled&&!APP.map)showMapFallback('The GIS engine is taking too long to load. A real OpenStreetMap fallback is shown while retries continue.');},6500);

  APP.timers.weather=setInterval(()=>{if(APP.mode==='live')fetchWeather(false);},CFG.wxRefreshMs);
  APP.timers.clock=setInterval(()=>{if(APP.view==='command')renderCommand();},60000);
  window.addEventListener('online',()=>{toast('Network restored. Refreshing live sources.');if(APP.mode==='live'){fetchWeather(false);if(APP.live.sensor.channel)pollSensor();}});
  window.addEventListener('offline',()=>toast('Network offline. Dated cached values may remain visible; unknown is never shown as safe.'));
  window.addEventListener('beforeunload',()=>{stopAcuTone();stopAcuMic();});
}
window.HIMGAURAV_RUNTIME={
  getSite:()=>({...site()}),
  getSites:()=>APP.sites.map(s=>({...s})),
  getMode:()=>APP.mode,
  getSensor:()=>JSON.parse(JSON.stringify(ctx().sensor||{})),
  getSiteState:()=>{const r=computeStateFor(site());return JSON.parse(JSON.stringify(r));},
  getWeatherForSite:()=>{const w=ctx().weather?.[site().id];return w?JSON.parse(JSON.stringify(w)):null;},
  refreshSensor:()=>pollSensor(),
  go:(view)=>go(view)
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot());else boot();

})();
