'use strict';
(function () {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const fmt = (n, d = 1) => Number.isFinite(n) ? n.toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: d }) : '—';
  const money = (n, currency = 'HNL') => new Intl.NumberFormat('es-HN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  const escapeHtml = (v) => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const makeLoad = (id, name, quantity, averageW, peakW, dayHours, nightHours, backed) => ({ id, name, quantity, averageW, peakW, dayHours, nightHours, backed });
  const common = () => ({ config: {panelCount:24,panelW:580,hsp:5,performance:80,inverterKW:16,batteryKwh:16,batteryUnits:1,dod:90,inverterEfficiency:92,chargeEfficiency:90,margin:10,batteryVoltage:51.2,batteryMaxCurrent:200,exchangeRate:27.02,panelUnitUSD:0,inverterUSD:0,batteryUnitUSD:0,freightUSD:0,localHNL:0,tariff:0}, strings:{series:8,stringsCount:3,mpptCount:0,voc:0,coldMultiplier:1.10,maxPVVoltage:0,maxMpptW:0} });
  function scenario(name) {
    const st = common(); st.preset = name;
    if (name === 'proyecto') {
      st.loads = [makeLoad('ac1','Aire inverter 12,000 BTU',2,650,1200,0,9,true),makeLoad('fr1','Refrigeradora',1,120,350,12,12,false),makeLoad('l1','Iluminación LED',8,12,12,0,5,false),makeLoad('tv1','Televisor',1,130,160,3,2,false),makeLoad('r1','Router + ONU',1,22,30,12,12,false)];
      st.note = 'Proyecto de ejemplo: dos aires inverter durante 9 h nocturnas; nevera y otros equipos conectados a ENEE. Potencias ilustrativas, editables según mediciones.';
    } else if (name === 'basico') {
      Object.assign(st.config,{panelCount:6,panelW:580,inverterKW:5,batteryKwh:5,batteryUnits:1,batteryVoltage:51.2,batteryMaxCurrent:100});
      Object.assign(st.strings,{series:3,stringsCount:2});
      st.loads=[makeLoad('b1','Bombillos LED',8,12,12,0,5,true),makeLoad('b2','TV LED',1,100,140,2,3,true),makeLoad('b3','Router / fibra',1,20,30,12,12,true),makeLoad('b4','Ventilador',2,60,75,3,8,true)];
      st.note = 'Ejemplo de respaldo básico: luces, televisor, internet y ventiladores. Ajusta la potencia de cada aparato.';
    } else if (name === 'casa') {
      Object.assign(st.config,{panelCount:20,panelW:580,inverterKW:12,batteryKwh:16,batteryUnits:2,batteryVoltage:51.2,batteryMaxCurrent:200});
      Object.assign(st.strings,{series:5,stringsCount:4});
      st.loads=[makeLoad('c1','Aire inverter 12,000 BTU',2,700,1250,4,9,true),makeLoad('c2','Refrigerador',1,120,350,12,12,true),makeLoad('c3','Iluminación',10,12,12,0,5,true),makeLoad('c4','Televisor',2,110,150,4,3,true),makeLoad('c5','Router',1,20,25,12,12,true),makeLoad('c6','Lavadora',1,600,900,1,0,true),makeLoad('c7','Microondas',1,1200,1450,0.3,0,true)];
      st.note = 'Ejemplo de casa completa. Se asume que todas las cargas podrían estar encendidas simultáneamente; desmarca las que uses exclusivamente con ENEE.';
    } else {
      Object.assign(st.config,{panelCount:0,inverterKW:0,batteryUnits:0});
      Object.assign(st.strings,{series:0,stringsCount:0});
      st.loads=[]; st.note='Inicia un diseño vacío. Agrega tus equipos y luego introduce el sistema que quieres evaluar.';
    }
    return st;
  }
  const storageKey = 'solarplan-pro-v2';
  function readStorage() { try { const raw = localStorage.getItem(storageKey); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function validState(v) {
    if (!v || typeof v !== 'object' || !v.config || typeof v.config !== 'object' || !Array.isArray(v.loads) || !v.strings || typeof v.strings !== 'object') return false;
    if (v.loads.length > 250) return false;
    return v.loads.every(x => x && typeof x === 'object' && typeof x.name === 'string' && x.name.length <= 100 && String(x.id||'').length < 100);
  }
  let state = validState(readStorage()) ? readStorage() : scenario('proyecto');
  const configFields = ['panelCount','panelW','hsp','performance','inverterKW','batteryKwh','batteryUnits','dod','inverterEfficiency','chargeEfficiency','margin','batteryVoltage','batteryMaxCurrent','exchangeRate','panelUnitUSD','inverterUSD','batteryUnitUSD','freightUSD','localHNL','tariff'];
  const stringFields = ['series','stringsCount','mpptCount','voc','coldMultiplier','maxPVVoltage','maxMpptW'];
  const numericFields = ['quantity','averageW','peakW','dayHours','nightHours'];
  function persist() { try { localStorage.setItem(storageKey,JSON.stringify(state)); } catch (e) {} }
  function showToast(message) {
    const el=$('#toast'); el.textContent=message;el.classList.remove('hidden');
    clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.classList.add('hidden'),2800);
  }
  function populate() {
    configFields.forEach(k=>{ const el=$('#'+k); if(el)el.value=state.config[k] ?? 0; });
    stringFields.forEach(k=>{ const el=$('#'+k); if(el)el.value=state.strings[k] ?? 0; });
    $('#scenarioNote').textContent = state.note || 'Proyecto personalizado. Los valores se actualizan al modificarlos.';
    $$('#presets [data-preset]').forEach(el=>el.classList.toggle('active',el.dataset.preset===state.preset));
    renderLoads();refresh();
  }
  function renderLoads() {
    const body = $('#loadsBody');
    if (!state.loads.length) {body.innerHTML='<tr><td colspan="8" style="text-align:center;padding:28px;color:#789">Todavía no has agregado equipos. Usa el botón «Agregar equipo».</td></tr>';return;}
    body.innerHTML = state.loads.map(l => {
      const id=escapeHtml(l.id); const txt=escapeHtml(l.name);
      const field=(k,min,max,step) => `<td><input type="number" inputmode="decimal" data-id="${id}" data-field="${k}" aria-label="${escapeHtml(k)} de ${txt}" value="${escapeHtml(l[k])}" min="${min}" max="${max}" step="${step}"></td>`;
      return `<tr class="${l.backed ? '' : 'gridOnly'}"><td><input class="nameInput" maxlength="100" data-id="${id}" data-field="name" aria-label="Nombre de equipo" value="${txt}"><div class="miniTag">${l.backed ? 'CIRCUITO SOLAR' : 'SOLO ENEE'}</div></td>${field('quantity',0,1000,1)}${field('averageW',0,100000,1)}${field('peakW',0,100000,1)}${field('dayHours',0,12,0.5)}${field('nightHours',0,12,0.5)}<td><input class="customCheck" type="checkbox" data-id="${id}" data-field="backed" aria-label="Incluir ${txt} en el solar" ${l.backed ? 'checked' : ''}></td><td><button class="delete" type="button" data-delete="${id}" title="Eliminar ${txt}" aria-label="Eliminar ${txt}">×</button></td></tr>`;
    }).join('');
  }
  function setText(id, text) { $(id).textContent=text; }
  function notice(type, title, detail) {
    return `<div class="notice ${type==='bad'?'bad':type==='neutral'?'neutral':''}"><span class="mark">${type==='bad'?'!':type==='neutral'?'i':'✓'}</span><div><strong>${escapeHtml(title)}</strong>${escapeHtml(detail)}</div></div>`;
  }
  function compare(value,need,id,ratioId,barId) {
    const frac = need > 0 ? value/need : (value>0?1:0);
    const elem=$(barId); elem.style.width=`${Math.max(0,Math.min(100,frac*100))}%`;
    elem.parentElement.parentElement.classList.toggle('warn', frac < 1-1e-9);
    setText(ratioId, need>0 ? `${fmt(frac*100,0)} %` : 'Sin carga');
    return frac;
  }
  function refresh() {
    $$('#presets [data-preset]').forEach(el=>el.classList.toggle('active',el.dataset.preset===state.preset));
    if(state.preset==='personalizado') $('#scenarioNote').textContent='Configuración personalizada: modifica los parámetros, guarda el proyecto como JSON o genera un informe PDF.';
    const r = SolarLogic.compute(state);
    setText('#statDemand',fmt(r.demand,2));setText('#statSolar',fmt(r.solarPotentialKwh));setText('#statBattery',fmt(r.batteryUsableAC,2));setText('#statRuntime',r.runtimeHours===null?'—':fmt(r.runtimeHours));
    setText('#dayEnergy',fmt(r.day,2)+' kWh');setText('#nightEnergy',fmt(r.night,2)+' kWh');setText('#gridEnergy',fmt(r.grid,2)+' kWh');setText('#peakLoad',fmt(r.loadPeakKW,2)+' kW');
    setText('#pvSize',fmt(r.pvNomKW,2)+' kWp');setText('#pvRecommend',fmt(r.recommendedPanels,0)+' paneles');setText('#pvTarget',fmt(r.solarTargetKwh,1)+' kWh/día');
    setText('#invRecommend',fmt(r.recommendedInverterKW,1)+' kW');setText('#batRecommend',fmt(r.batteryRecommendedKwh,2)+' kWh');
    setText('#dischargeLimit',r.batteryDischargeKW === null?'No definido':fmt(r.batteryDischargeKW,2)+' kW CA');
    setText('#pvDistributed',fmt(r.stringPanels,0)+' paneles');setText('#pvVoc',state.strings.voc>0?fmt(r.coldVoc,1)+' V':'Pendiente');setText('#pvStringW',fmt(r.wattsPerString,0)+' W');
    setText('#priceHNL',r.investmentUSD>0?money(r.investmentHNL):'Sin cotizar');setText('#priceUSD',r.investmentUSD>0?money(r.investmentUSD,'USD'):'Ingresa los precios cotizados');
    setText('#savingsHNL',state.config.tariff > 0 ? money(r.maxMonthlySavingsHNL) : 'Sin tarifa');
    setText('#payback',state.config.tariff>0 && r.investmentUSD>0 && r.paybackYears!==null ? 'Retorno matemático simple: '+fmt(r.paybackYears,1)+' años' : 'Retorno: faltan datos');
    setText('#overviewTitle',`${r.panelCount} paneles · ${fmt(r.inverterKW,1)} kW`);
    compare(r.solarPotentialKwh,r.solarTargetKwh,'','#pvCompare','#pvBar');
    compare(r.batteryUsableAC,r.night*(1+r.reserveMargin),'','#batteryCompare','#batteryBar');
    compare(r.inverterKW,r.designLoadKW,'','#inverterCompare','#inverterBar');
    setText('#summaryNight',fmt(r.night,2)+' kWh');setText('#summaryExcess',fmt(r.unusedSolarPotential,1)+' kWh/día');
    setText('#recText',`${r.recommendedPanels} paneles · ${fmt(r.recommendedInverterKW,1)} kW · ${fmt(r.batteryRecommendedKwh,1)} kWh`);
    setText('#recDetail','Cantidades mínimas matemáticas estimadas; no equivalen a una recomendación comercial ni validan el fabricante.');
    const warnings = [];
    if (r.demand === 0) warnings.push(['neutral','Sin cargas solares','Activa al menos un equipo en la columna «Solar».']);
    else {
      warnings.push(r.solarOK?['ok','Producción estimada suficiente','La energía FV diaria teórica cubre la meta, pero puede haber horas sin sol y excedente no aprovechado.']:['bad','Faltan paneles para la demanda','El arreglo FV calculado no cubre la meta energética; revisa las HSP, las pérdidas y la cantidad de paneles.']);
      if (r.night>0)warnings.push(r.batteryOK?['ok','Capacidad nocturna estimada suficiente','La energía útil calculada cubre el uso nocturno configurado más el margen.']:['bad','Capacidad de batería insuficiente',`Necesitas aproximadamente ${fmt(r.batteryRecommendedKwh,2)} kWh nominales, con los supuestos elegidos.`]);
      warnings.push(r.inverterOK?['ok','Potencia nominal del inversor suficiente','La potencia CA nominal cubre la suma de máximos introducidos y el margen de diseño.']:['bad','Inversor insuficiente',`Carga de diseño: ${fmt(r.designLoadKW,2)} kW CA; el inversor ingresado tiene ${fmt(r.inverterKW,2)} kW.`]);
      if (r.batteryPowerOK===false)warnings.push(['bad','Límite de descarga de batería',`La potencia de carga ${fmt(r.loadPeakKW,2)} kW puede superar los ${fmt(r.batteryDischargeKW,2)} kW CA estimados por el límite DC de las baterías.`]);
      if (r.batteryPowerOK===null && r.batteryUnits>0)warnings.push(['neutral','Descarga pendiente','Ingresa voltaje y corriente máxima real del BMS para verificar el límite de potencia.']);
      if (r.unusedSolarPotential > r.solarTargetKwh * .6 && r.solarTargetKwh>0)warnings.push(['neutral','Arreglo FV sobredimensionado para estas cargas',`Hasta ${fmt(r.unusedSolarPotential,1)} kWh/día de potencial no se aprovecharían en este escenario sin otras cargas, almacenamiento o exportación.`]);
      if (r.pvRatio !== null && r.pvRatio>1.25)warnings.push(['neutral','Relación FV/CA elevada',`Relación DC/AC ≈ ${fmt(r.pvRatio,2)}. Verifica potencia fotovoltaica máxima, MPPT y clipping en el inversor específico.`]);
    }
    warnings.push(['neutral','Compatibilidad y protecciones sin verificar','Una cifra de kW no confirma compatibilidad CAN/BMS, operación aislada, balance 120/240 V ni requisitos de protecciones.']);
    $('#notices').innerHTML=warnings.map(x=>notice(x[0],x[1],x[2])).join('');
    setText('#alertCount',warnings.filter(x=>x[0]==='bad').length+' alertas');
    const stringWarnings = [...r.stringsWarnings];
    const stringNotes = stringWarnings.map(s=>notice('bad','Revisar distribución',s));
    stringNotes.push(notice(r.stringsVerified?'ok':'neutral',r.stringsVerified?'Comprobaciones parciales realizadas':'Faltan fichas técnicas',r.stringsVerified?'Voltaje y potencia están dentro de los valores ingresados solo si no hay otras advertencias; falta verificar corrientes y Vmp.':'Completa Voc, tensión DC máxima, MPPT y potencia por MPPT, usando los datos de fabricante.'));
    $('#stringNotices').innerHTML=stringNotes.join('');
    persist();
  }
  let nextId = 0;
  function updateLoad(el) {
    const l=state.loads.find(v=>v.id===el.dataset.id);if(!l)return;
    const field=el.dataset.field;
    if(field==='name'){l.name=el.value.slice(0,100);state.preset='personalizado';persist();return;}
    else if(field==='backed')l.backed=el.checked;
    else if(numericFields.includes(field)){
      if(el.value===''||!Number.isFinite(Number(el.value)))return;
      const hi=field==='quantity'?1000:field.endsWith('Hours')?12:100000;
      const lo=0;const val=SolarLogic.clamp(el.value,lo,hi);
      l[field]=field==='quantity'?Math.round(val):val;
      if(l.peakW<l.averageW)l.peakW=l.averageW;
    }
    state.preset='personalizado';
    refresh();
    // Keep input focus, but synchronize labels and max value on blur only.
    if(field==='backed'){renderLoads();}
  }
  $('#loadsBody').addEventListener('input',e=>{const t=e.target;if(t.dataset.field && t.dataset.field!=='backed')updateLoad(t);});
  $('#loadsBody').addEventListener('change',e=>{const t=e.target;if(t.dataset.field)updateLoad(t);if(t.dataset.field!=='name')renderLoads();});
  $('#loadsBody').addEventListener('click',e=>{const t=e.target.closest('[data-delete]');if(!t)return;state.loads=state.loads.filter(l=>l.id!==t.dataset.delete);state.preset='personalizado';renderLoads();refresh();showToast('Equipo eliminado');});
  $('#addLoad').addEventListener('click',()=>{const id='custom'+Date.now()+'_'+(++nextId);state.loads.push(makeLoad(id,'Equipo nuevo',1,100,150,2,0,true));state.preset='personalizado';renderLoads();refresh();const target=$(`input[data-id="${id}"][data-field="name"]`);if(target){target.focus();target.select();}});
  $$('[data-config],[data-string]').forEach(el=>{
    el.addEventListener('input',()=>{
      if(el.value===''||!Number.isFinite(Number(el.value)))return;
      const group=el.dataset.config?'config':'strings'; const key=el.dataset.config||el.dataset.string;
      const min=Number(el.min||0),max=Number(el.max||100000);let value=SolarLogic.clamp(el.value,min,max);
      if(['panelCount','batteryUnits','series','stringsCount','mpptCount'].includes(key)) value=Math.round(value);
      state[group][key]=value;state.preset='personalizado';refresh();
    });
    el.addEventListener('change',()=>{const group=el.dataset.config?'config':'strings';const key=el.dataset.config||el.dataset.string;el.value=state[group][key];});
  });
  $('#presets').addEventListener('click',e=>{const t=e.target.closest('[data-preset]');if(!t)return; if(state.preset!=='personalizado' || confirm('¿Cambiar el escenario y reemplazar tus datos actuales?')){state=scenario(t.dataset.preset);populate();showToast('Escenario cargado');}});
  $('#resetBtn').addEventListener('click',()=>{if(confirm('¿Restablecer el escenario de tu proyecto y reemplazar todos los cambios?')){state=scenario('proyecto');populate();showToast('Proyecto restablecido');}});
  $$('[data-toggle]').forEach(btn=>btn.addEventListener('click',()=>{const pane=$('#'+btn.dataset.toggle);const expanded=pane.classList.toggle('open');btn.setAttribute('aria-expanded',String(expanded));btn.textContent=expanded?'Ocultar parámetros ▴':'Mostrar parámetros ▾';}));
  function downloadJson(){const data=new Blob([JSON.stringify({app:'SolarPlan Pro',version:2,exportedAt:new Date().toISOString(),...state},null,2)],{type:'application/json'});const u=URL.createObjectURL(data);const a=document.createElement('a');a.href=u;a.download='solarplan-pro-proyecto.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);showToast('Proyecto exportado como JSON');}
  $('#exportBtn').addEventListener('click',downloadJson);$('#exportBtn2').addEventListener('click',downloadJson);
  $('#importBtn').addEventListener('click',()=>$('#fileInput').click());
  $('#fileInput').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>500000)throw new Error('Archivo demasiado grande');const obj=JSON.parse(await file.text());if(!validState(obj))throw new Error('Estructura inválida');state=obj;populate();showToast('Proyecto importado correctamente');}catch(err){alert('No se pudo importar el archivo JSON: '+err.message);}e.target.value='';});
  $('#printBtn').addEventListener('click',()=>window.print());$('#printBtn2').addEventListener('click',()=>window.print());
  window.SolarPlanApp = { getState:()=>JSON.parse(JSON.stringify(state)), getResults:()=>SolarLogic.compute(state), scenario };
  populate();
})();
