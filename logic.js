'use strict';
/* SOLARPLAN PRO — motor matemático independiente del navegador.
   Simulador preliminar: no sustituye medición de cargas ni estudio eléctrico. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SolarLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const toNumber = (v, fallback = 0) => {
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const clamp = (v, min, max) => Math.min(max, Math.max(min, toNumber(v, min)));
  const standardInverter = (need) => [1, 1.5, 2, 3, 5, 6, 8, 10, 12, 15, 16, 18, 20, 25, 30].find(x => x >= need - 1e-9) || Math.ceil(need);
  function compute(state) {
    const c = state.config || {};
    const loads = Array.isArray(state.loads) ? state.loads : [];
    const valid = loads.map((l) => {
      const quantity = clamp(l.quantity, 0, 1000);
      const averageW = clamp(l.averageW, 0, 100000);
      const peakW = Math.max(averageW, clamp(l.peakW, 0, 100000));
      const dayHours = clamp(l.dayHours, 0, 12);
      const nightHours = clamp(l.nightHours, 0, 12);
      const backed = l.backed === true;
      return { name: String(l.name || 'Equipo'), quantity, averageW, peakW, dayHours, nightHours, backed,
        dayKwh: quantity * averageW * dayHours / 1000,
        nightKwh: quantity * averageW * nightHours / 1000,
        simultaneousKW: quantity * peakW / 1000 };
    });
    const sum = (fn) => valid.reduce((t, l) => t + fn(l), 0);
    const day = sum(l => l.backed ? l.dayKwh : 0);
    const night = sum(l => l.backed ? l.nightKwh : 0);
    const grid = sum(l => l.backed ? 0 : l.dayKwh + l.nightKwh);
    const demand = day + night;
    const loadPeakKW = sum(l => l.backed ? l.simultaneousKW : 0);
    const hsp = clamp(c.hsp, 0.1, 12);
    const performance = clamp(c.performance, 1, 100) / 100;
    const chargeEfficiency = clamp(c.chargeEfficiency, 50, 100) / 100;
    const inverterEfficiency = clamp(c.inverterEfficiency, 50, 100) / 100;
    const dod = clamp(c.dod, 1, 100) / 100;
    const reserveMargin = clamp(c.margin, 0, 100) / 100;
    const panelW = clamp(c.panelW, 1, 2000);
    const panelCount = Math.floor(clamp(c.panelCount, 0, 10000));
    const pvNomKW = panelCount * panelW / 1000;
    const solarPotentialKwh = pvNomKW * hsp * performance;
    // Rendimiento FV PR expresa la generación de un panel a salida AC día.
    // La fracción nocturna requiere además paso de carga-descarga (factor parametrizable).
    const solarTargetKwh = day + night / chargeEfficiency;
    const recommendedPanels = demand > 0 ? Math.ceil(solarTargetKwh / (panelW / 1000 * hsp * performance)) : 0;
    const batteryKwh = clamp(c.batteryKwh, 0, 1000);
    const batteryUnits = Math.floor(clamp(c.batteryUnits, 0, 100));
    const batteryNominal = batteryKwh * batteryUnits;
    const batteryUsableAC = batteryNominal * dod * inverterEfficiency;
    // Dimensionamiento nocturno sobre energía AC medida y margen explícito.
    const batteryRecommendedKwh = night * (1 + reserveMargin) / (dod * inverterEfficiency);
    const recommendedBatteryUnits = night > 0 && batteryKwh > 0 ? Math.ceil(batteryRecommendedKwh / batteryKwh) : 0;
    const maxNightHours = Math.max(0, ...valid.filter(l => l.backed && l.quantity > 0).map(l => l.nightHours));
    const nightAverageKW = maxNightHours > 0 ? night / maxNightHours : 0;
    const runtimeHours = nightAverageKW > 0 ? batteryUsableAC / nightAverageKW : null;
    const inverterKW = clamp(c.inverterKW, 0, 10000);
    const designLoadKW = loadPeakKW * (1 + reserveMargin);
    const recommendedInverterKW = demand > 0 ? standardInverter(designLoadKW) : 0;
    const batteryVoltage = clamp(c.batteryVoltage, 0, 1000);
    const batteryMaxCurrent = clamp(c.batteryMaxCurrent, 0, 10000);
    const batteryDischargeKW = batteryUnits > 0 && batteryVoltage > 0 && batteryMaxCurrent > 0
      ? batteryUnits * batteryVoltage * batteryMaxCurrent * inverterEfficiency / 1000 : null;
    const effectiveInverterKW = batteryDischargeKW === null ? inverterKW : Math.min(inverterKW, batteryDischargeKW);
    const pvRatio = inverterKW > 0 ? pvNomKW / inverterKW : null;
    const potentialSelfUse = Math.min(demand, solarPotentialKwh);
    const unusedSolarPotential = Math.max(0, solarPotentialKwh - solarTargetKwh);
    const currency = clamp(c.exchangeRate, 1, 1000);
    const inverterUSD = clamp(c.inverterUSD, 0, 1000000);
    const batteryUnitUSD = clamp(c.batteryUnitUSD, 0, 1000000);
    const panelUnitUSD = clamp(c.panelUnitUSD, 0, 1000000);
    const freightUSD = clamp(c.freightUSD, 0, 1000000);
    const localHNL = clamp(c.localHNL, 0, 100000000);
    const investmentUSD = inverterUSD + batteryUnitUSD * batteryUnits + panelUnitUSD * panelCount + freightUSD + localHNL / currency;
    const tariff = clamp(c.tariff, 0, 1000);
    // Ahorro máximo indicativo, no ingreso garantizado ni simulación tarifaria ENEE.
    const maxMonthlySavingsHNL = potentialSelfUse * 30 * tariff;
    const paybackYears = maxMonthlySavingsHNL > 0 ? (investmentUSD * currency) / (maxMonthlySavingsHNL * 12) : null;
    // Strings: nunca inferir límites del inversor; solo evaluar si el usuario los proporciona.
    const s = state.strings || {};
    const series = Math.floor(clamp(s.series, 0, 100));
    const stringsCount = Math.floor(clamp(s.stringsCount, 0, 100));
    const mpptCount = Math.floor(clamp(s.mpptCount, 0, 100));
    const voc = clamp(s.voc, 0, 200);
    const coldMultiplier = clamp(s.coldMultiplier, 1, 2);
    const maxPVVoltage = clamp(s.maxPVVoltage, 0, 2000);
    const maxMpptW = clamp(s.maxMpptW, 0, 100000);
    const stringPanels = series * stringsCount;
    const coldVoc = series * voc * coldMultiplier;
    const wattsPerString = series * panelW;
    const stringWarnings = [];
    if (stringPanels !== panelCount) stringWarnings.push(`La distribución suma ${stringPanels} paneles, pero el sistema tiene ${panelCount}.`);
    if (stringsCount > mpptCount && mpptCount > 0) stringWarnings.push('Hay más cadenas que MPPT. Verifica si el equipo permite entradas paralelas y su corriente máxima.');
    if (maxPVVoltage > 0 && voc > 0 && coldVoc > maxPVVoltage) stringWarnings.push(`Voc en frío estimado ${coldVoc.toFixed(0)} V supera el límite ingresado de ${maxPVVoltage} V.`);
    if (maxMpptW > 0 && wattsPerString > maxMpptW) stringWarnings.push(`Una cadena tiene ${wattsPerString.toFixed(0)} W, mayor que el máximo introducido por MPPT (${maxMpptW} W).`);
    const stringsVerified = voc > 0 && maxPVVoltage > 0 && maxMpptW > 0 && mpptCount > 0;
    return { valid, day, night, grid, demand, loadPeakKW, hsp, performance, chargeEfficiency,
      inverterEfficiency, dod, reserveMargin, panelW, panelCount, pvNomKW, solarPotentialKwh,
      solarTargetKwh, recommendedPanels, batteryKwh, batteryUnits, batteryNominal,
      batteryUsableAC, batteryRecommendedKwh, recommendedBatteryUnits, maxNightHours,
      nightAverageKW, runtimeHours, inverterKW, designLoadKW, recommendedInverterKW,
      batteryDischargeKW, effectiveInverterKW, pvRatio, unusedSolarPotential,
      investmentUSD, investmentHNL: investmentUSD * currency, maxMonthlySavingsHNL,
      paybackYears, potentialSelfUse, stringPanels, coldVoc, wattsPerString,
      stringsWarnings: stringWarnings, stringsVerified,
      solarOK: solarPotentialKwh >= solarTargetKwh - 1e-9,
      batteryOK: batteryUsableAC >= night * (1 + reserveMargin) - 1e-9,
      inverterOK: inverterKW >= designLoadKW - 1e-9,
      batteryPowerOK: batteryDischargeKW === null ? null : batteryDischargeKW >= loadPeakKW - 1e-9 };
  }
  return { compute, toNumber, clamp };
});
