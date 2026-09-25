(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='himgaurav.v8.validation';
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
const save=v=>{try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}};
const V=Object.assign({tilt:[],soil:[],lora:[],comparisons:[],rain:{mode:'binary',mmTip:null},session:{},lastSnapshot:null},load());
V.session=V.session||{};
V.rain=V.rain||{mode:'binary',mmTip:null};V.rain.trials=V.rain.trials||[];
const n=(v,d=2)=>Number.isFinite(+v)?Number(v).toFixed(d):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nowISO=()=>new Date().toISOString();
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const rmse=(a,b)=>{if(a.length!==b.length||!a.length)return NaN;return Math.sqrt(mean(a.map((x,i)=>(x-b[i])**2)))};
const mae=(a,b)=>{if(a.length!==b.length||!a.length)return NaN;return mean(a.map((x,i)=>Math.abs(x-b[i])))};
const bias=(a,b)=>{if(a.length!==b.length||!a.length)return NaN;return mean(a.map((x,i)=>x-b[i]))};
const r2=(x,y)=>{if(x.length<2||x.length!==y.length)return NaN;const xm=mean(x),ym=mean(y);let ssxy=0,ssx=0,ssy=0;for(let i=0;i<x.length;i++){ssxy+=(x[i]-xm)*(y[i]-ym);ssx+=(x[i]-xm)**2;ssy+=(y[i]-ym)**2}return ssx&&ssy?(ssxy**2)/(ssx*ssy):NaN};
const linfit=(x,y)=>{if(x.length<2||x.length!==y.length)return null;const xm=mean(x),ym=mean(y);let num=0,den=0;for(let i=0;i<x.length;i++){num+=(x[i]-xm)*(y[i]-ym);den+=(x[i]-xm)**2}if(!den)return null;const b=num/den,a=ym-b*xm;return {a,b,predict:v=>a+b*v}};
function toast(t){const e=$('#toast');if(e){e.textContent=t;e.classList.add('on');setTimeout(()=>e.classList.remove('on'),3200)}}
async function getJSON(url){try{const r=await fetch(url,{cache:'no-store'}),d=await r.json();if(!r.ok||d?.ok===false)throw new Error(d?.error||`HTTP ${r.status}`);return d}catch(e){throw new Error(e?.message||'request failed')}}
async function postJSON(url,payload){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});let d={};try{d=await r.json()}catch{}if(!r.ok||d?.ok===false)throw new Error(d?.error||`HTTP ${r.status}`);return d}
function statsHTML(items){return items.map(([k,v])=>`<div class="stat"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
function parseImd(raw){const d=raw?.data??raw;const arr=Array.isArray(d)?d:Array.isArray(d?.data)?d.data:[d];const x=arr.find(Boolean)||{};const pick=(...keys)=>{for(const k of keys){if(x[k]!=null&&x[k]!=='')return x[k]}return null};return {station:pick('Station','STATION','station','Station_Name')||'SUNDERNAGAR',rain:+pick('Last 24 hrs Rainfall','Last_24_hrs_Rainfall','RAINFALL','rainfall','Rainfall','Past_24_hrs_Rainfall'),temp:+pick('Temperature','TEMP','temperature','Temp'),humidity:+pick('Humidity','HUMIDITY','humidity'),observed:pick('Date of Observation','DATE','Date','date')||'',time:pick('Time of Observation','TIME','Time','time')||''};}
function openMeteo24(payload){const d=payload?.data??payload;const h=d?.hourly;if(!h?.time||!h?.precipitation)return NaN;const cutoff=Date.now()-24*3600e3;let s=0,c=0;h.time.forEach((t,i)=>{const ms=Date.parse(/Z|[+-]\d\d:?\d\d$/.test(t)?t:`${t}+05:30`);const v=+h.precipitation[i];if(ms>=cutoff&&ms<=Date.now()&&Number.isFinite(v)){s+=v;c++}});return c?s:NaN}
function sensorSnapshot(){const r=window.HIMGAURAV_RUNTIME;return r?.getSensor?.()||{};}
function cfgSensor(){try{return JSON.parse(localStorage.getItem('himgaurav.v2.sensor')||'{}')}catch{return {}}}
async function nodeRain24(){const c=cfgSensor(),field=+(c.rainField||0),channel=String(c.channelId||'');if(!field||!/^[0-9]+$/.test(channel))return {value:NaN,kind:'none',note:'Rain field not mapped'};const d=await getJSON(`/api/thingspeak?channel=${encodeURIComponent(channel)}&results=8000`);const feeds=d?.data?.feeds||d?.feeds||[];const cutoff=Date.now()-24*3600e3;const vals=[];for(const f of feeds){const t=Date.parse(f.created_at),v=parseFloat(f[`field${field}`]);if(t>=cutoff&&t<=Date.now()&&Number.isFinite(v))vals.push({t,v})}if(V.rain.mode==='binary')return {value:NaN,kind:'binary',note:`${vals.filter(x=>x.v>0).length} wet detections / ${vals.length} samples`};const mmTip=+V.rain.mmTip;if(!(mmTip>0))return {value:NaN,kind:V.rain.mode,note:'Calibrated mm/tip is required'};let tips=0;if(V.rain.mode==='pulse')tips=vals.filter(x=>x.v>0).reduce((a,x)=>a+x.v,0);else{for(let i=1;i<vals.length;i++){const d=vals[i].v-vals[i-1].v;if(d>=0)tips+=d;else if(vals[i].v>0)tips+=vals[i].v}}return {value:tips*mmTip,kind:V.rain.mode,note:`${n(tips,0)} tips × ${n(mmTip,3)} mm/tip`};}
function renderNode(){const s=sensorSnapshot();$('#valNodeState').textContent=s.status==='ok'?(s.health||'CONNECTED'):'Not connected';$('#valNodeDetail').textContent=s.healthWhy||'Connect the ThingSpeak node from Nodes.';const latest=s.latest||{};$('#valNodeMetrics').innerHTML=[['Tilt',Number.isFinite(+latest.tilt)?`${n(latest.tilt,3)}°`:'—'],['Moisture',Number.isFinite(+latest.moisture)?n(latest.moisture,1):'—'],['Battery',Number.isFinite(+latest.battery)?n(latest.battery,2):'—'],['RSSI',Number.isFinite(+latest.rssi)?`${n(latest.rssi,0)} dBm`:'—']].map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('')}
function setCardState(id,state,heading,detail){const el=$(id);if(!el)return;el.className=`live-test-card ${state}`;const h2=el.querySelector('h2');const p=el.querySelector('p');if(h2){if(state==='requesting'){h2.innerHTML=`<span class="live-pulse"></span>${esc(heading)}`;}else{h2.textContent=heading;}}if(p)p.textContent=detail;}
function renderSession(){const q=V.session||{},map={valSessionId:q.sessionId||'',valNodeId:q.nodeId||'',valFirmware:q.firmware||'',valOperator:q.operator||'',valReference:q.reference||'',valReferenceSpec:q.referenceSpec||'',valAmbientTemp:q.ambientTemp??'',valSessionNotes:q.notes||''};for(const [id,v] of Object.entries(map)){const e=$('#'+id);if(e&&document.activeElement!==e)e.value=v}const ready=!!(q.sessionId&&q.nodeId&&q.reference);const st=$('#valSessionState');if(st){st.textContent=ready?'DOCUMENTED':'NOT DOCUMENTED';st.className='provenance '+(ready?'live':'experimental')}}
function saveSession(){V.session={sessionId:$('#valSessionId')?.value.trim()||'',nodeId:$('#valNodeId')?.value.trim()||'',firmware:$('#valFirmware')?.value.trim()||'',operator:$('#valOperator')?.value.trim()||'',reference:$('#valReference')?.value.trim()||'',referenceSpec:$('#valReferenceSpec')?.value.trim()||'',ambientTemp:Number.isFinite(+$('#valAmbientTemp')?.value)?+$('#valAmbientTemp').value:null,notes:$('#valSessionNotes')?.value.trim()||'',savedAt:nowISO()};save(V);renderSession();renderProtocols();toast('Validation session metadata saved locally.');}

async function runSnapshot(){
  const lat=+$('#valLat').value,lon=+$('#valLon').value;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return toast('Enter valid test coordinates.');
  renderNode();
  setCardState('#valImdCard','requesting','Requesting…','IMD SUNDERNAGAR 42079');
  setCardState('#valModelCard','requesting','Requesting…','Open-Meteo at coordinate');
  setCardState('#valSarCard','requesting','Requesting…','ASF Sentinel-1 archive');
  const snap={t:nowISO(),lat,lon,node:sensorSnapshot()};const tasks=[];
  tasks.push(getJSON('/api/quakes').then(d=>{const imd=parseImd(d);snap.imd=imd;
    setCardState('#valImdCard','live','LIVE OFFICIAL',`${imd.station} · ${imd.observed} ${imd.time}`);
    $('#valImdState').textContent='LIVE OFFICIAL';$('#valImdDetail').textContent=`${imd.station} · ${imd.observed} ${imd.time}`;
    $('#valImdMetrics').innerHTML=[['24 h rain',Number.isFinite(imd.rain)?`${n(imd.rain,1)} mm`:'—'],['Temp',Number.isFinite(imd.temp)?`${n(imd.temp,1)} °C`:'—'],['RH',Number.isFinite(imd.humidity)?`${n(imd.humidity,0)}%`:'—']].map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('')
  }).catch(e=>{setCardState('#valImdCard','error','UNAVAILABLE',e.message);$('#valImdState').textContent='UNAVAILABLE';$('#valImdDetail').textContent=e.message;snap.imdError=e.message}));
  tasks.push(getJSON(`/api/weather?latitude=${lat}&longitude=${lon}`).then(d=>{const mm=openMeteo24(d);snap.model={rain24:mm,raw:d};
    setCardState('#valModelCard','live','LIVE MODEL','Open-Meteo model · comparison only');
    $('#valModelState').textContent='LIVE MODEL';$('#valModelDetail').textContent='Open-Meteo at the exact test coordinate';
    $('#valModelMetrics').innerHTML=`<div><span>24 h rain</span><b>${Number.isFinite(mm)?n(mm,1)+' mm':'—'}</b></div><div><span>Role</span><b>comparison only</b></div>`
  }).catch(e=>{setCardState('#valModelCard','error','UNAVAILABLE',e.message);$('#valModelState').textContent='UNAVAILABLE';$('#valModelDetail').textContent=e.message;snap.modelError=e.message}));
  tasks.push(getJSON(`/api/asf/search?lat=${lat}&lon=${lon}&days=120&max=8`).then(d=>{const f=d?.data?.features||d?.features||[];snap.asfCount=f.length;snap.asf=f.slice(0,3);
    const state=f.length?'live':'error';const label=f.length?`${f.length} REAL SCENES`:'NO SCENE';const detail=f.length?`${f.length} real Sentinel-1 IW SLC scenes returned`:'ASF returned no SLC scene for this search';
    setCardState('#valSarCard',state,label,detail);
    $('#valSarState').textContent=label;$('#valSarDetail').textContent=detail;
    const p=f[0]?.properties||{};$('#valSarMetrics').innerHTML=`<div><span>latest</span><b>${esc((p.startTime||p.start||p.sceneDate||p.stopTime||'—').toString().slice(0,10))}</b></div><div><span>platform</span><b>${esc(p.platform||p.platformName||p.sensor||'Sentinel-1')}</b></div>`
  }).catch(e=>{setCardState('#valSarCard','error','UNAVAILABLE',e.message);$('#valSarState').textContent='UNAVAILABLE';$('#valSarDetail').textContent=e.message;snap.asfError=e.message}));
  try{snap.nodeRain=await nodeRain24()}catch(e){snap.nodeRain={value:NaN,note:e.message}}
  await Promise.all(tasks);V.lastSnapshot=snap;save(V);renderProtocols();toast('Live comparison snapshot completed with real source statuses.');}

/* =====================================================================
   CALIBRATION CHART: Tilt scatter (reference vs node, identity line)
   ===================================================================== */
function drawTiltScatter(){
  const box=$('#tiltScatterChart');if(!box)return;
  const pts=V.tilt.map(x=>({ref:+x.ref,node:+x.node})).filter(p=>Number.isFinite(p.ref)&&Number.isFinite(p.node));
  if(pts.length<2){box.innerHTML='<svg viewBox="0 0 480 220"><text x="240" y="114" text-anchor="middle" fill="#9aaa9e" font-size="12">Add ≥2 calibration points to see scatter plot</text></svg>';return;}
  const ns='http://www.w3.org/2000/svg';
  const W=480,H=220,p={l:44,r:16,t:16,b:36};
  const refs=pts.map(x=>x.ref),nodes=pts.map(x=>x.node);
  const allVals=[...refs,...nodes];const lo=Math.min(...allVals),hi=Math.max(...allVals);
  const pad=(hi-lo)*.12||0.1;const dlo=lo-pad,dhi=hi+pad;
  const px=v=>p.l+(v-dlo)*(W-p.l-p.r)/(dhi-dlo);
  const py=v=>p.t+(dhi-v)*(H-p.t-p.b)/(dhi-dlo);
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  // grid
  const gridN=4;for(let i=0;i<=gridN;i++){const v=dlo+i*(dhi-dlo)/gridN;const gx=document.createElementNS(ns,'line');gx.setAttribute('x1',px(v));gx.setAttribute('x2',px(v));gx.setAttribute('y1',p.t);gx.setAttribute('y2',H-p.b);gx.setAttribute('stroke','#eef2f0');svg.appendChild(gx);const gy=document.createElementNS(ns,'line');gy.setAttribute('x1',p.l);gy.setAttribute('x2',W-p.r);gy.setAttribute('y1',py(v));gy.setAttribute('y2',py(v));gy.setAttribute('stroke','#eef2f0');svg.appendChild(gy);const tx=document.createElementNS(ns,'text');tx.setAttribute('x',px(v));tx.setAttribute('y',H-p.b+13);tx.setAttribute('text-anchor','middle');tx.setAttribute('fill','#9aaa9e');tx.setAttribute('font-size','9');tx.textContent=n(v,2);svg.appendChild(tx);const ty=document.createElementNS(ns,'text');ty.setAttribute('x',p.l-5);ty.setAttribute('y',py(v)+3);ty.setAttribute('text-anchor','end');ty.setAttribute('fill','#9aaa9e');ty.setAttribute('font-size','9');ty.textContent=n(v,2);svg.appendChild(ty);}
  // identity line y=x
  const idl=document.createElementNS(ns,'line');idl.setAttribute('x1',px(dlo));idl.setAttribute('x2',px(dhi));idl.setAttribute('y1',py(dlo));idl.setAttribute('y2',py(dhi));idl.setAttribute('stroke','#c8d4d2');idl.setAttribute('stroke-dasharray','5 4');idl.setAttribute('stroke-width','1.5');svg.appendChild(idl);
  // bias line (if fit available)
  const fit=linfit(refs,nodes);
  if(fit){const fl=document.createElementNS(ns,'line');fl.setAttribute('x1',px(dlo));fl.setAttribute('x2',px(dhi));fl.setAttribute('y1',py(fit.predict(dlo)));fl.setAttribute('y2',py(fit.predict(dhi)));fl.setAttribute('stroke','#2b6f78');fl.setAttribute('stroke-width','2');svg.appendChild(fl);}
  // points
  pts.forEach(q=>{const c=document.createElementNS(ns,'circle');c.setAttribute('cx',px(q.ref));c.setAttribute('cy',py(q.node));c.setAttribute('r','5');c.setAttribute('fill','#2b6f78');c.setAttribute('fill-opacity','.7');c.setAttribute('stroke','#0d4f59');c.setAttribute('stroke-width','1');const t=document.createElementNS(ns,'title');t.textContent=`Ref: ${n(q.ref,3)}° | Node: ${n(q.node,3)}° | Err: ${n(q.node-q.ref,3)}°`;c.appendChild(t);svg.appendChild(c);});
  // axis labels
  const axX=document.createElementNS(ns,'text');axX.setAttribute('x',W/2);axX.setAttribute('y',H-4);axX.setAttribute('text-anchor','middle');axX.setAttribute('fill','#718086');axX.setAttribute('font-size','10');axX.textContent='Reference angle (°)';svg.appendChild(axX);
  const axY=document.createElementNS(ns,'text');axY.setAttribute('transform',`rotate(-90)`);axY.setAttribute('x',-(H/2));axY.setAttribute('y',13);axY.setAttribute('text-anchor','middle');axY.setAttribute('fill','#718086');axY.setAttribute('font-size','10');axY.textContent='Node angle (°)';svg.appendChild(axY);
  box.innerHTML='';box.appendChild(svg);
  // caption
  const cap=$('#tiltScatterCaption');if(cap){const biasV=bias(nodes,refs);cap.textContent=`${pts.length} points · identity line (dashed) = perfect agreement · blue line = observed fit · bias ${Number.isFinite(biasV)?n(biasV,3)+'°':'—'}`;}
}

/* =====================================================================
   CALIBRATION CHART: Soil moisture calibration curve (raw vs VWC)
   ===================================================================== */
function drawSoilCurve(){
  const box=$('#soilCurveChart');if(!box)return;
  const all=V.soil||[];const cal=all.filter(x=>(x.set||'cal')==='cal');const val=all.filter(x=>x.set==='val');
  if(all.length<2){box.innerHTML='<svg viewBox="0 0 480 220"><text x="240" y="114" text-anchor="middle" fill="#9aaa9e" font-size="12">Add ≥2 samples to see calibration curve</text></svg>';return;}
  const ns='http://www.w3.org/2000/svg';
  const W=480,H=220,p={l:48,r:16,t:16,b:36};
  const allRaw=all.map(x=>+x.raw),allVwc=all.map(x=>+x.vwc*100);
  const rawLo=Math.min(...allRaw),rawHi=Math.max(...allRaw),vwcLo=Math.min(0,...allVwc),vwcHi=Math.max(...allVwc);
  const rawPad=(rawHi-rawLo)*.1||1;const vwcPad=(vwcHi-vwcLo)*.1||1;
  const rlo=rawLo-rawPad,rhi=rawHi+rawPad,vlo=vwcLo-vwcPad,vhi=vwcHi+vwcPad;
  const px=v=>p.l+(v-rlo)*(W-p.l-p.r)/(rhi-rlo);
  const py=v=>p.t+(vhi-v)*(H-p.t-p.b)/(vhi-vlo);
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  // grid lines
  const gridN=4;for(let i=0;i<=gridN;i++){const rv=rlo+i*(rhi-rlo)/gridN;const gx=document.createElementNS(ns,'line');gx.setAttribute('x1',px(rv));gx.setAttribute('x2',px(rv));gx.setAttribute('y1',p.t);gx.setAttribute('y2',H-p.b);gx.setAttribute('stroke','#eef2f0');svg.appendChild(gx);const tx=document.createElementNS(ns,'text');tx.setAttribute('x',px(rv));tx.setAttribute('y',H-p.b+13);tx.setAttribute('text-anchor','middle');tx.setAttribute('fill','#9aaa9e');tx.setAttribute('font-size','9');tx.textContent=n(rv,0);svg.appendChild(tx);}
  for(let i=0;i<=gridN;i++){const vv=vlo+i*(vhi-vlo)/gridN;const gy=document.createElementNS(ns,'line');gy.setAttribute('x1',p.l);gy.setAttribute('x2',W-p.r);gy.setAttribute('y1',py(vv));gy.setAttribute('y2',py(vv));gy.setAttribute('stroke','#eef2f0');svg.appendChild(gy);const ty=document.createElementNS(ns,'text');ty.setAttribute('x',p.l-5);ty.setAttribute('y',py(vv)+3);ty.setAttribute('text-anchor','end');ty.setAttribute('fill','#9aaa9e');ty.setAttribute('font-size','9');ty.textContent=n(vv,1)+'%';svg.appendChild(ty);}
  // fitted line (from cal set)
  const fit=linfit(cal.map(x=>+x.raw),cal.map(x=>+x.vwc*100));
  if(fit){const fl=document.createElementNS(ns,'line');fl.setAttribute('x1',px(rlo));fl.setAttribute('x2',px(rhi));fl.setAttribute('y1',py(fit.predict(rlo)));fl.setAttribute('y2',py(fit.predict(rhi)));fl.setAttribute('stroke','#2b6f78');fl.setAttribute('stroke-width','2');svg.appendChild(fl);}
  // calibration points (teal filled)
  cal.forEach(q=>{const c=document.createElementNS(ns,'circle');c.setAttribute('cx',px(+q.raw));c.setAttribute('cy',py(+q.vwc*100));c.setAttribute('r','5');c.setAttribute('fill','#2b6f78');c.setAttribute('fill-opacity','.75');c.setAttribute('stroke','#0d4f59');c.setAttribute('stroke-width','1');const t=document.createElementNS(ns,'title');t.textContent=`CAL · raw ${n(q.raw,1)} → ${n(q.vwc*100,1)}% VWC`;c.appendChild(t);svg.appendChild(c);});
  // held-out validation points (orange outline, no fill)
  val.forEach(q=>{const c=document.createElementNS(ns,'circle');c.setAttribute('cx',px(+q.raw));c.setAttribute('cy',py(+q.vwc*100));c.setAttribute('r','6');c.setAttribute('fill','none');c.setAttribute('stroke','#c35724');c.setAttribute('stroke-width','2');const t=document.createElementNS(ns,'title');t.textContent=`VALIDATION · raw ${n(q.raw,1)} → ${n(q.vwc*100,1)}% VWC`;c.appendChild(t);svg.appendChild(c);});
  // legend
  const legY=p.t+10;const legItems=[['#2b6f78',true,'Calibration'],['#c35724',false,'Held-out validation']];legItems.forEach(([col,filled,label],i)=>{const lx=W-p.r-130+i*68;const lc=document.createElementNS(ns,'circle');lc.setAttribute('cx',lx);lc.setAttribute('cy',legY);lc.setAttribute('r','4');lc.setAttribute('fill',filled?col:'none');lc.setAttribute('stroke',col);lc.setAttribute('stroke-width','1.5');svg.appendChild(lc);const lt=document.createElementNS(ns,'text');lt.setAttribute('x',lx+7);lt.setAttribute('y',legY+4);lt.setAttribute('fill','#718086');lt.setAttribute('font-size','9');lt.textContent=label;svg.appendChild(lt);});
  // axis labels
  const axX=document.createElementNS(ns,'text');axX.setAttribute('x',W/2);axX.setAttribute('y',H-4);axX.setAttribute('text-anchor','middle');axX.setAttribute('fill','#718086');axX.setAttribute('font-size','10');axX.textContent='Sensor raw ADC value';svg.appendChild(axX);
  const axY=document.createElementNS(ns,'text');axY.setAttribute('transform',`rotate(-90)`);axY.setAttribute('x',-(H/2));axY.setAttribute('y',13);axY.setAttribute('text-anchor','middle');axY.setAttribute('fill','#718086');axY.setAttribute('font-size','10');axY.textContent='VWC (%)';svg.appendChild(axY);
  box.innerHTML='';box.appendChild(svg);
  const cap=$('#soilCurveCaption');if(cap){cap.textContent=`Teal = calibration set (${cal.length} pts) · orange ring = held-out validation (${val.length} pts) · line = fitted linear model`;}
}

function renderTilt(){
  const a=V.tilt.map(x=>+x.ref),b=V.tilt.map(x=>+x.node);
  $('#tiltCalStats').innerHTML=statsHTML([['Points',V.tilt.length],['Bias',Number.isFinite(bias(b,a))?`${n(bias(b,a),3)}°`:'—'],['MAE',Number.isFinite(mae(b,a))?`${n(mae(b,a),3)}°`:'—'],['RMSE',Number.isFinite(rmse(b,a))?`${n(rmse(b,a),3)}°`:'—'],['R²',Number.isFinite(r2(a,b))?n(r2(a,b),3):'—']]);
  $('#tiltCalTable').innerHTML=V.tilt.length?`<table><thead><tr><th>Reference °</th><th>Node °</th><th>Error °</th><th></th></tr></thead><tbody>${V.tilt.map((x,i)=>`<tr><td>${n(x.ref,3)}</td><td>${n(x.node,3)}</td><td>${n(x.node-x.ref,3)}</td><td><button data-del-tilt="${i}">remove</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">No tilt calibration points yet.</div>';
  drawTiltScatter();
}
function renderSoil(){
  const all=V.soil||[], raw=all.map(x=>+x.raw), vwc=all.map(x=>+x.vwc);
  const cal=all.filter(x=>(x.set||'cal')==='cal'), val=all.filter(x=>x.set==='val');
  const fit=linfit(cal.map(x=>+x.raw),cal.map(x=>+x.vwc));
  const vp=fit?val.map(x=>fit.predict(+x.raw)):[], va=val.map(x=>+x.vwc);
  const items=[['Samples',all.length],['Calibration / held-out',`${cal.length} / ${val.length}`],['VWC range',all.length?`${n(Math.min(...vwc)*100,1)}–${n(Math.max(...vwc)*100,1)}%`:'—'],['Cal R²',fit&&cal.length>1?n(r2(cal.map(x=>+x.raw),cal.map(x=>+x.vwc)),3):'—'],['Held-out MAE',val.length&&fit?`${n(mae(vp,va)*100,2)} %VWC`:'—'],['Held-out RMSE',val.length&&fit?`${n(rmse(vp,va)*100,2)} %VWC`:'—']];
  $('#soilCalStats').innerHTML=statsHTML(items);
  const equation=fit?`VWC = ${n(fit.a,5)} + ${n(fit.b,7)} × raw`:'Need ≥2 calibration samples';
  $('#soilCalTable').innerHTML=all.length?`<div class="lab-equation"><b>Linear calibration:</b> ${esc(equation)} <small>Use another model only if residuals justify it.</small></div><table><thead><tr><th>Set</th><th>Raw</th><th>Wet g</th><th>Dry g</th><th>Vol cm³</th><th>GWC</th><th>VWC</th><th>Predicted</th><th></th></tr></thead><tbody>${all.map((x,i)=>{const pred=fit?fit.predict(+x.raw):NaN;return `<tr><td>${x.set==='val'?'VALIDATION':'CAL'}</td><td>${n(x.raw,1)}</td><td>${n(x.wet,2)}</td><td>${n(x.dry,2)}</td><td>${n(x.vol,1)}</td><td>${n(x.gwc*100,1)}%</td><td>${n(x.vwc*100,1)}%</td><td>${Number.isFinite(pred)?n(pred*100,1)+'%':'—'}</td><td><button data-del-soil="${i}">remove</button></td></tr>`}).join('')}</tbody></table>`:'<div class="empty-state">No gravimetric calibration samples yet.</div>';
  drawSoilCurve();
}
function renderLora(){
  const p=V.lora.map(x=>x.sent?100*x.recv/x.sent:NaN).filter(Number.isFinite),lat=V.lora.map(x=>+x.latency).filter(Number.isFinite);
  $('#loraStats').innerHTML=statsHTML([['Trials',V.lora.length],['Mean PDR',p.length?`${n(mean(p),1)}%`:'—'],['Worst PDR',p.length?`${n(Math.min(...p),1)}%`:'—'],['Mean latency',lat.length?`${n(mean(lat),0)} ms`:'—']]);
  $('#loraTable').innerHTML=V.lora.length?`<table><thead><tr><th>Context</th><th>Distance m</th><th>Sent</th><th>Received</th><th>PDR</th><th>RSSI</th><th>SNR</th><th>Latency</th><th></th></tr></thead><tbody>${V.lora.map((x,i)=>`<tr><td>${esc(x.context||'—')}</td><td>${n(x.dist,0)}</td><td>${x.sent}</td><td>${x.recv}</td><td>${n(100*x.recv/x.sent,1)}%</td><td>${n(x.rssi,1)}</td><td>${n(x.snr,1)}</td><td>${Number.isFinite(+x.latency)?n(x.latency,0)+' ms':'—'}</td><td><button data-del-lora="${i}">remove</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">No LoRa reliability trials yet.</div>';
}
function renderComparisons(){
  const rows=V.comparisons, aligned=rows.filter(x=>x.aligned===true), paired=aligned.filter(x=>Number.isFinite(+x.nodeRain)&&Number.isFinite(+x.imdRain)),imd=paired.map(x=>+x.imdRain),pairedNode=paired.map(x=>+x.nodeRain);
  $('#comparisonStats').innerHTML=statsHTML([['Records',rows.length],['Aligned records',aligned.length],['Node↔IMD MAE',pairedNode.length?`${n(mae(pairedNode,imd),2)} mm`:'—'],['Node↔IMD bias',pairedNode.length?`${n(bias(pairedNode,imd),2)} mm`:'—'],['R²',pairedNode.length>1?n(r2(pairedNode,imd),3):'—']]);
  $('#comparisonTable').innerHTML=rows.length?`<table><thead><tr><th>Time</th><th>Window</th><th>Node rain</th><th>IMD 42079</th><th>Open-Meteo</th><th>Notes</th><th></th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td>${esc(new Date(x.t).toLocaleString())}</td><td>${x.aligned?'<b class="ok-text">ALIGNED</b>':'NOT VERIFIED'}</td><td>${Number.isFinite(+x.nodeRain)?n(x.nodeRain,2)+' mm':esc(x.nodeNote||'occurrence only')}</td><td>${Number.isFinite(+x.imdRain)?n(x.imdRain,2)+' mm':'—'}</td><td>${Number.isFinite(+x.modelRain)?n(x.modelRain,2)+' mm':'—'}</td><td>${esc(x.alignmentNote||x.note||'')}</td><td><button data-del-comp="${i}">remove</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">No saved comparison records yet.</div>';
}
function renderRain(){
  V.rain.mode=V.rain.mode||'binary';V.rain.trials=V.rain.trials||[];
  $('#rainMode').value=V.rain.mode;$('#rainMmTip').value=V.rain.mmTip??'';
  const mm=V.rain.trials.map(x=>+x.mmTip).filter(Number.isFinite),mu=mean(mm),sd=mm.length>1?Math.sqrt(mean(mm.map(x=>(x-mu)**2))):NaN,cv=Number.isFinite(sd)&&mu?100*sd/mu:NaN;
  $('#rainCalResult').innerHTML=statsHTML([['Mode',V.rain.mode],['Calibration trials',V.rain.trials.length],['Mean mm / tip',Number.isFinite(mu)?n(mu,4):(V.rain.mmTip?n(V.rain.mmTip,4):'not calibrated')],['Trial CV',Number.isFinite(cv)?`${n(cv,1)}%`:'—']]);
  $('#rainCalTable').innerHTML=V.rain.trials.length?`<table><thead><tr><th>Area cm²</th><th>Water mL</th><th>Tips</th><th>Duration min</th><th>Applied intensity</th><th>mm/tip</th><th></th></tr></thead><tbody>${V.rain.trials.map((x,i)=>`<tr><td>${n(x.area,1)}</td><td>${n(x.volume,1)}</td><td>${n(x.tips,0)}</td><td>${Number.isFinite(+x.duration)?n(x.duration,1):'—'}</td><td>${Number.isFinite(+x.intensity)?n(x.intensity,1)+' mm/h':'—'}</td><td>${n(x.mmTip,4)}</td><td><button data-del-rain="${i}">remove</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">No tipping-bucket calibration trials yet.</div>';
}

function renderProtocols(){
  const s=sensorSnapshot(),sess=V.session||{},sessionDone=!!(sess.sessionId&&sess.nodeId&&sess.reference);
  const p=[
    ['Traceable test session',sessionDone,'Record campaign ID, node/firmware and the reference instrument before calibration.'],
    ['Timestamp & uptime',s.status==='ok'&&s.lastTs,'Collect ≥30 samples; verify cadence, clock, stale/offline behaviour.'],
    ['Tilt calibration',V.tilt.length>=5,'Use ≥5 known reference angles; report bias, MAE, RMSE and repeatability.'],
    ['Soil calibration',V.soil.length>=5,'Use site soil across dry→wet range; gravimetric/volumetric reference, not raw ADC %.'],
    ['Rain measurement',V.rain.mode==='binary'?false:!!V.rain.mmTip,'Wet/dry board validates occurrence only. Millimetres require a calibrated gauge.'],
    ['LoRa reliability',V.lora.length>=3,'Record PDR, RSSI, SNR and distance in repeatable packet trials.'],
    ['Cross-source record',V.comparisons.length>=3,'Save repeated node↔IMD↔model comparisons; compare like-for-like accumulation windows.']
  ];
  const evidenced=p.filter(x=>x[1]).length;
  $('#validationProtocols').innerHTML=p.map(([title,done,txt],i)=>{
    const icon=done?'✓':'○';const iClass=done?'evidenced':'open';
    return `<article class="protocol-card ${done?'complete':''}"><header><div class="protocol-icon ${iClass}">${icon}</div><h3>${String(i+1).padStart(2,'0')} · ${title}</h3><span class="protocol-state">${done?'EVIDENCED':'OPEN'}</span></header><p>${txt}</p></article>`;
  }).join('');
  $('#valProtocolProgress').textContent=`${evidenced} / ${p.length} protocols evidenced`;
}

function renderAll(){renderNode();renderTilt();renderSoil();renderLora();renderRain();renderComparisons();renderProtocols()}

/* =====================================================================
   SAR / ASF — Scene timeline chart (date axis with satellite colouring)
   ===================================================================== */
const SAR={features:[],baseline:[],reference:null,secondary:null};
function prop(f,...keys){const p=f?.properties||{};for(const k of keys)if(p[k]!=null&&p[k]!=='')return p[k];return ''}
function granule(f){return prop(f,'sceneName','granuleName','fileID','fileName','productName','name')||f?.id||''}
function sceneDate(f){return prop(f,'startTime','start','sceneDate','acquisitionDate','stopTime')||''}

function platformColor(f){
  const plat=(prop(f,'platform','platformName','satellite')||granule(f)).toUpperCase();
  if(plat.includes('1C'))return '#2f77a6';
  if(plat.includes('1D'))return '#9a690b';
  return '#526b70';
}

/* SAR scene timeline SVG */
function drawSarTimeline(features){
  const box=$('#sarTimelineChart');if(!box)return;
  if(!features||!features.length){box.innerHTML='<div class="empty-state">Run an ASF search to see the acquisition timeline.</div>';return;}
  const dates=features.map(f=>{const d=sceneDate(f);return d?Date.parse(d.replace('T',' ').replace('Z','')):NaN}).filter(Number.isFinite);
  if(dates.length<1){box.innerHTML='<div class="empty-state">Could not parse scene dates.</div>';return;}
  const ns='http://www.w3.org/2000/svg';
  const W=760,H=90,pl=60,pr=20,pt=18,pb=28;
  const lo=Math.min(...dates),hi=Math.max(...dates);
  const pad=(hi-lo)*.04||86400000;const dlo=lo-pad,dhi=hi+pad;
  const px=v=>pl+(v-dlo)*(W-pl-pr)/(dhi-dlo);
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  // axis line
  const ax=document.createElementNS(ns,'line');ax.setAttribute('x1',pl);ax.setAttribute('x2',W-pr);ax.setAttribute('y1',pt+30);ax.setAttribute('y2',pt+30);ax.setAttribute('stroke','#d8e3e1');ax.setAttribute('stroke-width','1');svg.appendChild(ax);
  // date ticks (up to 6)
  const tickN=Math.min(6,features.length);for(let i=0;i<=tickN;i++){const t=dlo+i*(dhi-dlo)/tickN;const tx=document.createElementNS(ns,'text');tx.setAttribute('x',px(t));tx.setAttribute('y',H-8);tx.setAttribute('text-anchor','middle');tx.setAttribute('fill','#9aaa9e');tx.setAttribute('font-size','8');tx.textContent=new Date(t).toISOString().slice(0,7);svg.appendChild(tx);}
  // scene ticks — group overlapping dates onto 2 rows
  features.forEach((f,i)=>{
    const d=sceneDate(f);const ms=Date.parse(d.replace('T',' ').replace('Z',''));if(!Number.isFinite(ms))return;
    const col=platformColor(f);const isRef=granule(f)===granule(SAR.reference),isSec=granule(f)===granule(SAR.secondary);
    const row=i%2;const cy=pt+10+row*22;
    const c=document.createElementNS(ns,'circle');c.setAttribute('cx',px(ms));c.setAttribute('cy',cy);c.setAttribute('r',isRef||isSec?7:5);c.setAttribute('fill',isRef?'#1a7a5e':isSec?'#9a690b':col);c.setAttribute('fill-opacity','.85');c.setAttribute('stroke',isRef||isSec?'#fff':'none');c.setAttribute('stroke-width','2');
    const t=document.createElementNS(ns,'title');t.textContent=`${d.slice(0,10)} · ${prop(f,'platform','platformName','satellite')||'Sentinel-1'}${isRef?' [REFERENCE]':isSec?' [SECONDARY]':''}`;c.appendChild(t);svg.appendChild(c);
    // label for selected scenes
    if(isRef||isSec){const lbl=document.createElementNS(ns,'text');lbl.setAttribute('x',px(ms));lbl.setAttribute('y',cy-10);lbl.setAttribute('text-anchor','middle');lbl.setAttribute('fill',isRef?'#1a7a5e':'#9a690b');lbl.setAttribute('font-size','8');lbl.setAttribute('font-weight','700');lbl.textContent=isRef?'REF':'SEC';svg.appendChild(lbl);}
  });
  box.innerHTML='';const wrap=document.createElement('div');wrap.className='sar-timeline-chart';wrap.appendChild(svg);
  const leg=document.createElement('div');leg.className='sar-timeline-legend';leg.innerHTML=`<span><i class="s1c-dot"></i>Sentinel-1C</span><span><i class="s1d-dot"></i>Sentinel-1D</span><span><i class="s1-dot"></i>Other/unknown</span><span style="margin-left:auto;color:#1a7a5e;font-weight:700">● Reference</span><span style="color:#9a690b;font-weight:700">● Secondary</span>`;
  wrap.appendChild(leg);box.innerHTML='';box.appendChild(wrap);
}

/* Baseline scatter (temporal vs perpendicular baseline) */
function drawBaselineScatter(features){
  const box=$('#sarBaselineScatter');if(!box)return;
  const pts=features.filter(f=>prop(f,'temporalBaseline','temporal_baseline','temporalBaselineDays')||prop(f,'perpendicularBaseline','perpBaseline','perpendicular_baseline'));
  if(pts.length<2){box.innerHTML='<div class="empty-state">Request ASF baseline to see pair scatter.</div>';return;}
  const ns='http://www.w3.org/2000/svg';
  const W=480,H=220,p={l:52,r:20,t:18,b:36};
  const tb=pts.map(f=>+(prop(f,'temporalBaseline','temporal_baseline','temporalBaselineDays')||0));
  const pb2=pts.map(f=>+(prop(f,'perpendicularBaseline','perpBaseline','perpendicular_baseline')||0));
  const tblo=Math.min(0,...tb),tbhi=Math.max(...tb),pblo=Math.min(...pb2),pbhi=Math.max(...pb2);
  const xpad=(tbhi-tblo)*.08||5,ypad=(pbhi-pblo)*.1||10;
  const xl=tblo-xpad,xr=tbhi+xpad,yl=pblo-ypad,yr=pbhi+ypad;
  const px2=v=>p.l+(v-xl)*(W-p.l-p.r)/(xr-xl);
  const py2=v=>p.t+(yr-v)*(H-p.t-p.b)/(yr-yl);
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  // ideal zone (temporal <60 days, perp < 200m) — soft rectangle
  if(px2(60)<W-p.r&&py2(-200)>p.t){const rz=document.createElementNS(ns,'rect');rz.setAttribute('x',p.l);rz.setAttribute('y',py2(200));rz.setAttribute('width',Math.min(px2(60),W-p.r)-p.l);rz.setAttribute('height',py2(-200)-py2(200));rz.setAttribute('fill','#eaf8f0');rz.setAttribute('rx','3');svg.appendChild(rz);const zlbl=document.createElementNS(ns,'text');zlbl.setAttribute('x',p.l+4);zlbl.setAttribute('y',py2(200)+13);zlbl.setAttribute('fill','#3b9b7e');zlbl.setAttribute('font-size','8');zlbl.textContent='preferred zone';svg.appendChild(zlbl);}
  // zero axes
  if(xl<0&&xr>0){const vl=document.createElementNS(ns,'line');vl.setAttribute('x1',px2(0));vl.setAttribute('x2',px2(0));vl.setAttribute('y1',p.t);vl.setAttribute('y2',H-p.b);vl.setAttribute('stroke','#dce3e1');svg.appendChild(vl);}
  if(yl<0&&yr>0){const hl=document.createElementNS(ns,'line');hl.setAttribute('x1',p.l);hl.setAttribute('x2',W-p.r);hl.setAttribute('y1',py2(0));hl.setAttribute('y2',py2(0));hl.setAttribute('stroke','#dce3e1');svg.appendChild(hl);}
  // points
  pts.forEach((f,i)=>{const isSec=granule(f)===granule(SAR.secondary);const c=document.createElementNS(ns,'circle');c.setAttribute('cx',px2(tb[i]));c.setAttribute('cy',py2(pb2[i]));c.setAttribute('r',isSec?7:5);c.setAttribute('fill',isSec?'#9a690b':'#2f77a6');c.setAttribute('fill-opacity','.75');c.setAttribute('stroke',isSec?'#6a3d00':'#0d4f59');c.setAttribute('stroke-width','1');const t=document.createElementNS(ns,'title');t.textContent=`Temp baseline: ${tb[i]} d · Perp: ${pb2[i]} m${isSec?' [SELECTED SECONDARY]':''}`;c.appendChild(t);svg.appendChild(c);});
  // axis labels
  const axX=document.createElementNS(ns,'text');axX.setAttribute('x',W/2);axX.setAttribute('y',H-4);axX.setAttribute('text-anchor','middle');axX.setAttribute('fill','#718086');axX.setAttribute('font-size','10');axX.textContent='Temporal baseline (days)';svg.appendChild(axX);
  const axY=document.createElementNS(ns,'text');axY.setAttribute('transform','rotate(-90)');axY.setAttribute('x',-(H/2));axY.setAttribute('y',13);axY.setAttribute('text-anchor','middle');axY.setAttribute('fill','#718086');axY.setAttribute('font-size','10');axY.textContent='Perpendicular baseline (m)';svg.appendChild(axY);
  // tick labels
  for(let i=0;i<=4;i++){const tv=xl+i*(xr-xl)/4;const lx=document.createElementNS(ns,'text');lx.setAttribute('x',px2(tv));lx.setAttribute('y',H-p.b+12);lx.setAttribute('text-anchor','middle');lx.setAttribute('fill','#9aaa9e');lx.setAttribute('font-size','8');lx.textContent=Math.round(tv);svg.appendChild(lx);}
  for(let i=0;i<=4;i++){const pv=yl+i*(yr-yl)/4;const ly=document.createElementNS(ns,'text');ly.setAttribute('x',p.l-4);ly.setAttribute('y',py2(pv)+3);ly.setAttribute('text-anchor','end');ly.setAttribute('fill','#9aaa9e');ly.setAttribute('font-size','8');ly.textContent=Math.round(pv);svg.appendChild(ly);}
  const wrap=document.createElement('div');wrap.className='baseline-scatter-wrap';wrap.appendChild(svg);
  const cap=document.createElement('div');cap.className='baseline-scatter-caption';cap.textContent=`${pts.length} pair candidates · green zone = preferred temporal (<60 d) and perpendicular (<200 m) baseline region · orange = selected secondary`;
  wrap.appendChild(cap);box.innerHTML='';box.appendChild(wrap);
}

/* HyP3 job cards (replacing table) */
function renderJobCards(jobs){
  const box=$('#hyp3Jobs');if(!box)return;
  if(!jobs.length){box.innerHTML='<div class="empty-state">No HyP3 jobs returned for this Earthdata account.</div>';return;}
  const cards=jobs.map(j=>{
    const status=j.status_code||'UNKNOWN';const badgeCls=status;
    const file=j.files?.[0]?.url||'';const browse=j.browse_images?.[0]||'';
    const gran=((j.job_parameters?.granules||[]).join(' + ')).slice(0,80)||'—';
    const ts=String(j.request_time||'').replace('T',' ').slice(0,19);
    const extentData = j.extent ? JSON.stringify(j.extent).replace(/"/g, '&quot;') : '';
    return `<div class="hyp3-job-card ${esc(status)}">
      <div class="hyp3-job-card-head">
        <span class="hyp3-job-card-name" title="${esc(j.name||'')}">${esc(j.name||'—')}</span>
        <span class="hyp3-job-badge ${esc(badgeCls)}">${esc(status)}</span>
      </div>
      <small>Type: ${esc(j.job_type||'—')} · Requested: ${esc(ts)}</small>
      <small title="${esc(gran)}">Granules: ${esc(gran.slice(0,70))}${gran.length>70?'…':''}</small>
      <div style="display:flex; gap:10px; margin-top:8px;">
        ${file?`<a class="secondary-btn" href="${esc(file)}" target="_blank" rel="noopener" style="text-decoration:none;font-size:11px;padding:4px 8px">⬇ Download Zip</a>`:''}
        ${browse?`<button type="button" class="primary-btn" style="font-size:11px;padding:4px 8px" data-browse="${esc(browse)}" data-granules="${esc((j.job_parameters?.granules||[]).join(','))}">👁 Overlay Result on Map</button>`:''}
      </div>
    </div>`;
  }).join('');
  box.innerHTML=`<div class="hyp3-job-cards">${cards}</div>`;
}

function renderSarRows(features,baseline=false){
  drawSarTimeline(features.length?features:SAR.features);
  if(baseline)drawBaselineScatter(features);
  if(!features.length){$('#sarResults').innerHTML='<div class="empty-state">No matching Sentinel-1 IW SLC acquisitions returned.</div>';return}
  $('#sarResults').innerHTML=`<table><thead><tr><th>Date</th><th>Satellite</th><th>Direction</th><th>Path</th><th>Polarization</th>${baseline?'<th>Temp baseline</th><th>Perp baseline</th>':''}<th>Granule</th><th>Use</th></tr></thead><tbody>${features.map((f,i)=>{const g=granule(f);return `<tr><td>${esc(String(sceneDate(f)).replace('T',' ').slice(0,19))}</td><td>${esc(prop(f,'platform','platformName','satellite')||g.slice(0,3))}</td><td>${esc(prop(f,'flightDirection','flight_direction','direction')||'—')}</td><td>${esc(prop(f,'pathNumber','relativeOrbit','relativeOrbitNumber','path')||'—')}</td><td>${esc(prop(f,'polarization','polarizationMode')||'—')}</td>${baseline?`<td>${esc(prop(f,'temporalBaseline','temporal_baseline','temporalBaselineDays')||'—')}</td><td>${esc(prop(f,'perpendicularBaseline','perpBaseline','perpendicular_baseline')||'—')}</td>`:''}<td title="${esc(g)}">${esc(g.slice(0,34))}${g.length>34?'…':''}</td><td>${baseline?`<button data-sar-sec="${i}">secondary</button>`:`<button data-sar-ref="${i}">reference</button>`}</td></tr>`}).join('')}</tbody></table>`
}

/* InSAR workflow stepper state */
function updateInsarStepper(){
  const steps=[
    {id:'istep-search',done:SAR.features.length>0,label:SAR.features.length?`${SAR.features.length} scenes`:'not run'},
    {id:'istep-select',done:!!SAR.reference,label:SAR.reference?'scene selected':'not selected'},
    {id:'istep-pair',done:SAR.baseline.length>0&&!!SAR.reference,label:SAR.baseline.length?`${SAR.baseline.length} candidates`:'not requested'},
    {id:'istep-submit',done:!!SAR.secondary,label:SAR.secondary?'pair ready':'awaiting pair'},
    {id:'istep-interpret',done:false,label:'view HyP3 jobs below'},
  ];
  steps.forEach((st,i)=>{
    const el=$('#'+st.id);if(!el)return;
    const isActive=!st.done&&(i===0||steps[i-1].done);
    el.className='insar-step'+(st.done?' done':isActive?' active':'');
    const statusEl=el.querySelector('.step-status');if(statusEl)statusEl.textContent=st.done?'COMPLETE':isActive?'CURRENT':'WAITING';
  });
}

function updatePairUI(){
  const rg=SAR.reference?granule(SAR.reference):'',sg=SAR.secondary?granule(SAR.secondary):'';
  $('#sarReference').textContent=rg||'None selected';$('#sarSecondary').textContent=sg||'None selected';
  $('#sarBaseline').disabled=!rg;$('#sarSubmit').disabled=!(rg&&sg&&$('#sarSubmit').dataset.auth==='1');
  $('#sarPairState').textContent=rg&&sg?'Pair selected from real ASF metadata. HyP3 will still validate it at submission.':rg?'Reference selected · request ASF baseline neighbours':'Select a scene, then ask ASF for baseline neighbours';
  updateInsarStepper();
  drawSarTimeline(SAR.features);
}

function sarTargetCoords(){const t=$('#sarTarget').value;if(t==='jngec')return {lat:31.5333,lon:76.8833,label:'JNGEC Sundernagar'};if(t==='kotrupi2017')return {lat:31.9104,lon:76.8906,label:'Kotrupi 2017'};const s=window.HIMGAURAV_RUNTIME?.getSite?.()||{lat:31.9104,lon:76.8906,name:'current site'};return {lat:+s.lat,lon:+s.lon,label:s.name}}

/* Live Terminal Logger */
function logTerminal(msg, type='info') {
  const b = $('#termBody');
  if(!b) return;
  const d = document.createElement('div');
  d.className = 'term-line ' + type;
  d.textContent = msg;
  b.appendChild(d);
  b.scrollTop = b.scrollHeight;
}

async function initSarMap() {
  if (V.sarMap) return;
  if (!window.L) {
    if (window.HIMGAURAV_MAP_READY) await window.HIMGAURAV_MAP_READY;
    if (!window.L) return;
  }
  const mapEl = $('#sarMap');
  if (!mapEl) return;
  
  const c = sarTargetCoords();
  V.sarMap = L.map('sarMap', { zoomControl: true, minZoom: 4, maxZoom: 15 }).setView([c.lat, c.lon], 9);
  
  // ASF Vertex Style Topographic map
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri, HEREm Garmin, FAO, NOAA, USGS', maxZoom: 17, opacity: 1.0
  }).addTo(V.sarMap);
  
  V.sarFootprints = L.layerGroup().addTo(V.sarMap);

  // Fix Leaflet sizing bug when the tab is switched or panel is revealed
  new ResizeObserver(() => {
    if (V.sarMap) V.sarMap.invalidateSize();
  }).observe(mapEl);
}

function drawSarMap(features, isBaseline = false) {
  if (!V.sarMap || !V.sarFootprints) return;
  V.sarFootprints.clearLayers();
  
  if (!features || !features.length) {
    $('#sarMapFootprintCount').textContent = '0 scenes';
    return;
  }
  
  let bounds = L.latLngBounds([]);
  const countSpan = $('#sarMapFootprintCount');
  if (countSpan) countSpan.textContent = `${features.length} ${isBaseline ? 'candidates' : 'scenes'}`;

  // Find reference if we are showing baseline
  const refId = SAR.reference ? granule(SAR.reference) : null;

  features.forEach(f => {
    if (!f.geometry) return;
    const isRef = granule(f) === refId;
    // Red for reference, distinct blue/green for others
    const color = isRef ? '#d85a2a' : isBaseline ? '#1d70b8' : '#1a7a5e';
    
    // Create GeoJSON polygon
    const layer = L.geoJSON(f, {
      style: { color: color, weight: isRef ? 3 : 1.5, fillOpacity: isRef ? 0.15 : 0.05, opacity: 0.8 }
    });
    
    // Add tooltip/popup with actual quicklook image
    let popupHtml = `<div style="font-family:sans-serif;font-size:12px;color:#1d3040">
      <b style="font-size:13px">${granule(f)}</b><br>
      Path: ${f.properties?.pathNumber} · Frame: ${f.properties?.frameNumber}<br>
      Time: ${new Date(f.properties?.startTime).toLocaleString()}
    `;
    const browseUrl = (Array.isArray(f.properties?.browse) ? f.properties.browse[0] : f.properties?.browse);
    if (browseUrl) popupHtml += `<img src="${esc(browseUrl)}" alt="SAR Quicklook" loading="lazy">`;
    popupHtml += `</div>`;
    
    layer.bindPopup(popupHtml, { maxWidth: 280 });
    layer.bindTooltip(isRef ? 'REFERENCE SCENE' : granule(f), { direction: 'top' });
    
    layer.addTo(V.sarFootprints);
    bounds.extend(layer.getBounds());
  });
  
  if (bounds.isValid()) {
    setTimeout(() => {
      V.sarMap.invalidateSize();
      V.sarMap.fitBounds(bounds, { padding: [30, 30] });
    }, 150);
  }
}

async function overlayHyP3OnMap(url, granules) {
  if (!V.sarMap || !url) return;
  if (V.hyp3Overlay) {
    V.sarMap.removeLayer(V.hyp3Overlay);
    V.hyp3Overlay = null;
  }
  toast('Fetching geographic bounds from ASF...');
  let coords = null;
  if (granules && granules.length > 0) {
    try {
      const g = granules[0].trim();
      const res = await fetch(`https://api.daac.asf.alaska.edu/services/search/param?granule_list=${g}&output=geojson`);
      const geo = await res.json();
      if (geo.features && geo.features[0] && geo.features[0].geometry) {
        coords = geo.features[0].geometry.coordinates[0];
      }
    } catch(e) {
      console.warn('Failed to fetch bounds:', e);
    }
  }
  if (!coords) {
    toast('No geographic extent found for this job.');
    return;
  }
  let bounds = L.latLngBounds([]);
  coords.forEach(c => {
    bounds.extend([c[1], c[0]]);
  });
  V.hyp3Overlay = L.imageOverlay(url, bounds, { opacity: 0.85 }).addTo(V.sarMap);
  V.sarMap.fitBounds(bounds, { padding: [20, 20] });
  const countSpan = $('#sarMapFootprintCount');
  if (countSpan) countSpan.innerHTML = `<span style="color:#facc15">Processing Result Overlay Active</span>`;
  $('#sarMap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  toast('HyP3 Result mapped over terrain.');
  logTerminal('Automated InSAR overlay applied to map.', 'success');
}

async function sarSearch(silent=false){
  if (!V.sarMap) await initSarMap();
  const c=sarTargetCoords(),w=$('#sarWindow').value;
  // Fallback to 24 scenes if max select was removed
  const max = $('#sarMax') ? +$('#sarMax').value : 24;
  let url=`/api/asf/search?lat=${c.lat}&lon=${c.lon}&max=${max}`;
  if(w==='historical'||$('#sarTarget').value==='kotrupi2017')url+='&start=2017-05-01&end=2018-02-28';
  else url+=`&days=${+w||90}`;
  
  if(!silent) logTerminal(`Requesting Sentinel-1 IW SLC scenes at ${c.lat}, ${c.lon}...`, 'action');
  $('#sarServiceState').textContent='SEARCHING';
  $('#sarResults').classList.add('sar-busy');
  updateInsarStepper();
  try{
    const d=await getJSON(url);
    SAR.features=d?.data?.features||d?.features||[];
    SAR.reference=null;SAR.secondary=null;
    renderSarRows(SAR.features,false);updatePairUI();
    $('#sarServiceState').textContent=`${SAR.features.length} REAL SCENES`;
    drawSarTimeline(SAR.features);
    drawSarMap(SAR.features, false);
    if(!silent) logTerminal(`Received ${SAR.features.length} actual Sentinel-1 scenes.`, 'success');
  }catch(e){
    $('#sarServiceState').textContent='ASF UNAVAILABLE';
    $('#sarResults').innerHTML=`<div class="empty-state">${esc(e.message)}</div>`;
    logTerminal(`Error: ${e.message}`, 'error');
  }finally{
    $('#sarResults').classList.remove('sar-busy');
  }
}

async function baselineSearch(silent=false){
  if(!SAR.reference) {
    logTerminal('Cannot find baselines without a reference scene.', 'error');
    return;
  }
  const g=granule(SAR.reference);
  if(!silent) logTerminal(`Querying ASF baseline service for neighbors of ${g.slice(0,18)}...`, 'action');
  $('#sarServiceState').textContent='BASELINE SEARCH';
  $('#sarBaselineScatter').classList.add('sar-busy');
  updateInsarStepper();
  try{
    const d=await getJSON(`/api/asf/baseline?reference=${encodeURIComponent(g)}&max=60`);
    SAR.baseline=(d?.data?.features||d?.features||[]).filter(f=>granule(f)!==g);
    // Include reference in the map so we see what it's compared against
    const mapFeatures = [...SAR.baseline];
    if (SAR.reference) mapFeatures.push(SAR.reference);
    
    renderSarRows(SAR.baseline,true);
    drawBaselineScatter(SAR.baseline);
    drawSarMap(mapFeatures, true);
    
    $('#sarServiceState').textContent=`${SAR.baseline.length} PAIR CANDIDATES`;
    if(!silent) logTerminal(`Baseline calculated: found ${SAR.baseline.length} compatible candidates.`, 'success');
  }catch(e){
    $('#sarServiceState').textContent='BASELINE FAILED';
    logTerminal(`Baseline error: ${e.message}`, 'error');
  }finally{
    $('#sarBaselineScatter').classList.remove('sar-busy');
  }
}

async function autoDiscoverPair() {
  $('#termBody').innerHTML = ''; // clear terminal
  $('#sarAutoPair').disabled = true;
  $('#sarAutoPair').classList.remove('auto-pulse');
  logTerminal('Initializing autonomous ASF discovery sequence...', 'action');
  
  // 1. Search Scenes
  await new Promise(r => setTimeout(r, 600)); // artificially slow to let user read
  await sarSearch(true);
  if(!SAR.features.length) {
    logTerminal('Auto-discovery aborted: No scenes found.', 'error');
    $('#sarAutoPair').disabled = false; return;
  }
  logTerminal(`✓ Retrieved ${SAR.features.length} SLC scenes from archive.`, 'success');

  // 2. Select Reference
  await new Promise(r => setTimeout(r, 800));
  SAR.reference = SAR.features[0];
  logTerminal(`✓ Selected most recent scene as Reference: ${granule(SAR.reference).slice(0,30)}...`, 'success');
  updatePairUI();
  
  // 3. Baseline Search
  await new Promise(r => setTimeout(r, 800));
  await baselineSearch(true);
  if(!SAR.baseline.length) {
    logTerminal('Auto-discovery aborted: No baselines available.', 'error');
    $('#sarAutoPair').disabled = false; return;
  }
  logTerminal(`✓ Found ${SAR.baseline.length} interferometric baseline neighbors.`, 'success');

  // 4. Select Optimal Secondary
  logTerminal('Analyzing pairs for optimal coherence window (<60d, <200m)...', 'action');
  await new Promise(r => setTimeout(r, 800));
  
  let best = null; let bestScore = Infinity;
  SAR.baseline.forEach((f, i) => {
     const tb = Math.abs(prop(f,'temporalBaseline','temporal_baseline')||999);
     const pb = Math.abs(prop(f,'perpendicularBaseline','perpBaseline')||999);
     if (tb > 0 && tb <= 60 && pb < 200) {
         const score = (tb / 60) + (pb / 200); // simple cost function
         if(score < bestScore) { bestScore = score; best = i; }
     }
  });

  if(best !== null) {
      SAR.secondary = SAR.baseline[best];
      logTerminal(`✨ Optimal pair selected! (Temp: ${prop(SAR.secondary,'temporalBaseline','temporal_baseline')}d, Perp: ${Math.round(prop(SAR.secondary,'perpendicularBaseline','perpBaseline'))}m)`, 'success');
  } else {
      SAR.secondary = SAR.baseline[0]; // fallback to chronologically closest
      logTerminal('Warning: No ideal pair < 60d/<200m found. Selected closest possible match.', 'yellow');
  }
  
  updatePairUI();
  logTerminal('Ready for real InSAR processing. Click "Submit to HyP3" below.', 'info');
  
  // Scroll to submit
  setTimeout(() => $('#sarSubmit').scrollIntoView({behavior: 'smooth', block: 'center'}), 500);
  $('#sarAutoPair').disabled = false;
  $('#sarAutoPair').classList.add('auto-pulse');
}


async function hyp3Status(){
  try{const d=await getJSON('/api/hyp3/status');const ok=!!d.configured;$('#sarSubmit').dataset.auth=ok?'1':'0';$('#hyp3AuthText').textContent=ok?(d.user?.user_id?`Earthdata ${d.user.user_id} · HyP3 ready`:'Earthdata token configured · HyP3 ready'):'Earthdata token not configured';updatePairUI()}catch(e){$('#hyp3AuthText').textContent='HyP3 status unavailable';$('#sarSubmit').dataset.auth='0';updatePairUI()}
}

async function submitHyp3(){
  if(!SAR.reference||!SAR.secondary)return;const r=granule(SAR.reference),s=granule(SAR.secondary);
  if(!confirm(`Submit a real ASF HyP3 InSAR job?\n\nReference: ${r}\nSecondary: ${s}\n\nThis consumes HyP3 processing credits.`))return;
  $('#sarSubmit').disabled=true;
  try{const d=await postJSON('/api/hyp3/submit',{reference:r,secondary:s,looks:$('#sarLooks').value,include_displacement_maps:$('#sarDisp').checked,include_look_vectors:$('#sarLookVec').checked,name:`HIMGAURAV-${Date.now()}`});toast('Real HyP3 job submitted.');await refreshJobs()}catch(e){toast(`HyP3: ${e.message}`)}finally{updatePairUI()}
}

async function refreshJobs(){
  try{const d=await getJSON('/api/hyp3/jobs?limit=40');const jobs=d.jobs||d.data?.jobs||[];renderJobCards(jobs)}catch(e){$('#hyp3Jobs').innerHTML=`<div class="empty-state">${esc(e.message)}</div>`}
}

async function automationCycle(){
  const c=sarTargetCoords();$('#sarAutomationState').textContent='running real ASF discovery…';
  try{const d=await postJSON('/api/asf/automation',{lat:c.lat,lon:c.lon,lookback_days:120,confirm_submit:false});$('#sarAutomationState').textContent=d.pair?`discovered pair · ${d.submitted?'submitted':'not submitted'}`:'no compatible pair found';if(d.pair){SAR.reference={id:d.pair.reference,properties:{sceneName:d.pair.reference,startTime:d.pair.reference_time||''}};SAR.secondary={id:d.pair.secondary,properties:{sceneName:d.pair.secondary,startTime:d.pair.secondary_time||''}};updatePairUI()}toast(d.message||'Automation discovery complete.')}catch(e){$('#sarAutomationState').textContent=e.message}
}

/* =====================================================================
   Kotrupi interactive stepper
   ===================================================================== */
const KOTRUPI_STEPS=[
  {title:'Known event',short:'13 Aug 2017',icon:'📍',detail:`<h4>Kotrupi · Mandi · 13 August 2017</h4><p>A massive landslide on NH-154 at Kotrupi, Padhar tehsil, Mandi district killed at least 46 people. It has since been extensively studied using Sentinel-1 DInSAR and MTInSAR to retrospectively characterize pre-failure deformation.</p><div class="k-meta"><span class="k-tag ref">NH-154 road cut</span><span class="k-tag ref">Lat 31.91° N, Lon 76.89° E</span><span class="k-tag warn">46+ fatalities</span></div>`},
  {title:'ASF archive search',short:'Real Sentinel-1 SLC',icon:'🛰',detail:`<h4>Step 2 — Search the real ASF Sentinel-1 archive</h4><p>Click "Open Kotrupi in SAR Lab" above and run a search with the historical window (2017–2018). The app calls the real NASA ASF search API for IW SLC acquisitions intersecting Kotrupi. No synthetic data is fabricated.</p><div class="k-meta"><span class="k-tag">Platform: Sentinel-1A/1B (2017)</span><span class="k-tag">Beam: IW · Level: SLC</span><span class="k-tag ref">Real archive metadata</span></div>`},
  {title:'HyP3 InSAR processing',short:'Real interferogram',icon:'⚙️',detail:`<h4>Step 3 — Submit a pair to ASF HyP3</h4><p>Select a reference and secondary scene from the baseline search results. With a NASA Earthdata token configured in .env, HIMGAURAV submits an INSAR_GAMMA job. HyP3 processes the actual SLC pair and returns coherence, unwrapped phase, and optionally displacement maps.</p><div class="k-meta"><span class="k-tag">Job type: INSAR_GAMMA</span><span class="k-tag">Looks: 20×4 or 10×2</span><span class="k-tag warn">Consumes HyP3 credits</span></div>`},
  {title:'Published comparison',short:'DInSAR/MTInSAR literature',icon:'📄',detail:`<h4>Step 4 — Compare with published Kotrupi DInSAR study</h4><p>Published work (Advances in Space Research, 2022) used Sentinel-1 DInSAR and MTInSAR to map deformation before and after the Kotrupi failure. Compare spatial patterns and deformation trends from your HyP3 output against these results. This validates the workflow method — not the real-time warning.</p><div class="k-meta"><span class="k-tag ref">Compare trend / location only</span><span class="k-tag warn">Not pixel-perfect without identical method</span></div>`}
];
let kotrupiActiveStep=0;
function renderKotrupiStepper(){
  const grid=$('#kotrupiStepperGrid');const detail=$('#kotrupiStepDetail');
  if(!grid||!detail)return;
  grid.innerHTML=KOTRUPI_STEPS.map((s,i)=>`<div class="kotrupi-step${i===kotrupiActiveStep?' active':''}" data-kotrupi-step="${i}"><div class="k-num">${s.icon}</div><h4>${s.title}</h4><p>${s.short}</p></div>`).join('');
  detail.innerHTML=KOTRUPI_STEPS[kotrupiActiveStep].detail;
}

/* =====================================================================
   CSV / JSON export
   ===================================================================== */
function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}\"`:s}
function exportLabCSV(){
  const rows=[['record_type','timestamp','session_id','node_id','field_1','value_1','field_2','value_2','field_3','value_3','field_4','value_4','notes']];
  const sid=V.session?.sessionId||'',nid=V.session?.nodeId||'';
  V.tilt.forEach(x=>rows.push(['tilt',x.t,sid,nid,'reference_deg',x.ref,'node_deg',x.node,'error_deg',x.node-x.ref,'','','']));
  V.soil.forEach(x=>rows.push(['soil',x.t,sid,nid,'set',x.set||'cal','raw',x.raw,'vwc',x.vwc,'gwc',x.gwc,'']));
  (V.rain.trials||[]).forEach(x=>rows.push(['rain_cal',x.t,sid,nid,'area_cm2',x.area,'volume_ml',x.volume,'tips',x.tips,'mm_per_tip',x.mmTip,Number.isFinite(+x.intensity)?`intensity_mm_h=${x.intensity}`:'']));
  V.lora.forEach(x=>rows.push(['lora',x.t,sid,nid,'distance_m',x.dist,'pdr_pct',x.sent?100*x.recv/x.sent:'','rssi_dbm',x.rssi,'snr_db',x.snr,`context=${x.context||''};latency_ms=${x.latency??''}`]));
  V.comparisons.forEach(x=>rows.push(['rain_compare',x.t,x.sessionId||sid,x.nodeId||nid,'node_mm',x.nodeRain??'','imd_mm',x.imdRain??'','model_mm',x.modelRain??'','aligned',x.aligned===true?'yes':'no',`${x.alignmentNote||x.note||''}`]));
  const text=rows.map(r=>r.map(csvEscape).join(',')).join('\n');const blob=new Blob([text],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`HIMGAURAV-validation-lab-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function bind(){
  $('#saveValidationSession')?.addEventListener('click',saveSession);
  $('#validationCsvExport')?.addEventListener('click',exportLabCSV);
  $('#validationSnapshot')?.addEventListener('click',runSnapshot);
  $('#validationExport')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify({exported_at:nowISO(),build:'8.0-validation-sar',site:{lat:+$('#valLat').value,lon:+$('#valLon').value},records:V},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`HIMGAURAV-validation-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});
  $('#addTiltCal')?.addEventListener('click',()=>{const ref=+$('#tiltRef').value,node=+$('#tiltNode').value;if(!Number.isFinite(ref)||!Number.isFinite(node))return toast('Enter both reference and node angles.');V.tilt.push({t:nowISO(),ref,node});save(V);renderTilt();renderProtocols()});
  $('#addSoilCal')?.addEventListener('click',()=>{const raw=+$('#soilRaw').value,wet=+$('#soilWet').value,dry=+$('#soilDry').value,vol=+$('#soilVol').value,set=$('#soilSet').value;if(![raw,wet,dry,vol].every(Number.isFinite)||wet<dry||dry<=0||vol<=0)return toast('Check raw, wet/dry mass and sample volume.');const gwc=(wet-dry)/dry,vwc=(wet-dry)/vol;V.soil.push({t:nowISO(),raw,wet,dry,vol,gwc,vwc,set});save(V);renderSoil();renderProtocols()});
  $('#calcRainCal')?.addEventListener('click',()=>{const a=+$('#rainArea').value,v=+$('#rainVolume').value,t=+$('#rainTips').value,d=+$('#rainDuration').value;if(!(a>0&&v>0&&t>0))return toast('Enter positive collector area, volume and tip count.');const mmTip=10*v/(a*t),depth=10*v/a,intensity=d>0?60*depth/d:NaN;V.rain.trials.push({t:nowISO(),area:a,volume:v,tips:t,duration:d>0?d:null,mmTip,intensity:Number.isFinite(intensity)?intensity:null});V.rain.mmTip=mean(V.rain.trials.map(x=>+x.mmTip));V.rain.mode='cumulative';save(V);renderRain();renderProtocols();toast(`Trial recorded: ${n(mmTip,4)} mm/tip. Mean ${n(V.rain.mmTip,4)} mm/tip.`)});
  $('#rainMode')?.addEventListener('change',e=>{V.rain.mode=e.target.value;save(V);renderProtocols()});$('#rainMmTip')?.addEventListener('change',e=>{V.rain.mmTip=+e.target.value||null;save(V);renderProtocols()});
  $('#addLoraTrial')?.addEventListener('click',()=>{const sent=+$('#loraSent').value,recv=+$('#loraRecv').value,rssi=+$('#loraRssi').value,snr=+$('#loraSnr').value,dist=+$('#loraDist').value,latency=+$('#loraLatency').value,context=$('#loraContext').value;if(!(sent>0&&recv>=0&&recv<=sent&&Number.isFinite(dist)))return toast('Check packet counts and distance.');V.lora.push({t:nowISO(),sent,recv,rssi,snr,dist,latency:Number.isFinite(latency)?latency:null,context});save(V);renderLora();renderProtocols()});
  document.addEventListener('click',e=>{
    let b=e.target.closest('[data-del-tilt],[data-del-soil],[data-del-lora],[data-del-rain],[data-del-comp]');
    if(!b)return;
    if(b.dataset.delTilt!=null)V.tilt.splice(+b.dataset.delTilt,1);
    if(b.dataset.delSoil!=null)V.soil.splice(+b.dataset.delSoil,1);
    if(b.dataset.delLora!=null)V.lora.splice(+b.dataset.delLora,1);
    if(b.dataset.delRain!=null){V.rain.trials.splice(+b.dataset.delRain,1);V.rain.mmTip=V.rain.trials.length?mean(V.rain.trials.map(x=>+x.mmTip)):null;}
    if(b.dataset.delComp!=null)V.comparisons.splice(+b.dataset.delComp,1);
    save(V);renderAll();
  });
  $('#saveComparison')?.addEventListener('click',async()=>{if(!V.lastSnapshot)return toast('Run a live comparison first.');let nr=V.lastSnapshot.nodeRain||{};if(!Object.prototype.hasOwnProperty.call(nr,'value'))try{nr=await nodeRain24()}catch{}const aligned=$('#comparisonAligned')?.value==='yes',alignmentNote=$('#comparisonAlignmentNote')?.value.trim()||'';const r={t:V.lastSnapshot.t,nodeRain:Number.isFinite(+nr.value)?+nr.value:null,nodeNote:nr.note||'',imdRain:Number.isFinite(+V.lastSnapshot.imd?.rain)?+V.lastSnapshot.imd.rain:null,modelRain:Number.isFinite(+V.lastSnapshot.model?.rain24)?+V.lastSnapshot.model.rain24:null,sessionId:V.session?.sessionId||'',nodeId:V.session?.nodeId||'',aligned,alignmentNote,note:aligned?'Operator marked the accumulation windows as matched; verify in exported raw/source timestamps.':'IMD uses its official 24 h observation window; error metrics are suppressed until the operator verifies exact window alignment.'};V.comparisons.push(r);save(V);renderComparisons();renderProtocols();toast('Comparison record saved locally.');});
  $('#clearValidation')?.addEventListener('click',()=>{if(!confirm('Clear local validation/calibration records?'))return;V.tilt=[];V.soil=[];V.lora=[];V.comparisons=[];V.rain={mode:'binary',mmTip:null,trials:[]};V.lastSnapshot=null;save(V);renderAll()});
  $('#openKotrupiSar')?.addEventListener('click',()=>{window.HIMGAURAV_RUNTIME?.go?.('satellite');$('#sarTarget').value='kotrupi2017';$('#sarWindow').value='historical';setTimeout(sarSearch,120)});
  $('#jumpSarLab')?.addEventListener('click',()=>$('#sarLabPanel')?.scrollIntoView({behavior:'smooth',block:'start'}));
  $('#sarAutoPair')?.addEventListener('click',autoDiscoverPair);
  $('#sarSearch')?.addEventListener('click',()=>sarSearch(false));
  $('#sarBaseline')?.addEventListener('click',()=>baselineSearch(false));
  $('#sarSubmit')?.addEventListener('click',submitHyp3);
  $('#sarRefreshJobs')?.addEventListener('click',refreshJobs);
  $('#sarAutomation')?.addEventListener('click',automationCycle);
  $('#sarResults')?.addEventListener('click',e=>{const r=e.target.closest('[data-sar-ref]'),s=e.target.closest('[data-sar-sec]');if(r){SAR.reference=SAR.features[+r.dataset.sarRef];SAR.secondary=null;updatePairUI()}if(s){SAR.secondary=SAR.baseline[+s.dataset.sarSec];updatePairUI()}});
  window.addEventListener('himgaurav:sitechange',()=>{if($('#sarTarget')?.value==='current'){SAR.reference=null;SAR.secondary=null;updatePairUI()}});
  // Kotrupi stepper
  document.addEventListener('click',e=>{const step=e.target.closest('[data-kotrupi-step]');if(!step)return;kotrupiActiveStep=+step.dataset.kotrupiStep;renderKotrupiStepper();});
  // SAR baseline scatter placeholder
  const sarBaselineBox=$('#sarBaselineScatter');if(sarBaselineBox)sarBaselineBox.innerHTML='<div class="empty-state">Request ASF baseline to see temporal vs perpendicular scatter.</div>';
  const sarTimelineBox=$('#sarTimelineChart');if(sarTimelineBox)sarTimelineBox.innerHTML='<div class="empty-state">Search ASF acquisitions to see scene timeline.</div>';
  $('#hyp3Jobs')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-browse]');
    if (!btn) return;
    const url = btn.dataset.browse;
    const granules = btn.dataset.granules ? btn.dataset.granules.split(',') : [];
    overlayHyP3OnMap(url, granules);
  });
}

function init(){bind();renderSession();renderAll();hyp3Status();renderKotrupiStepper();updateInsarStepper();initSarMap();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();



