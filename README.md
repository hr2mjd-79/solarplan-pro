# SolarPlan Pro — Calculadora solar residencial

Sitio web propio, en español y sin dependencias externas, compatible con PC, móvil y GitHub Pages.

## Inicio
1. Abre `index.html` en Chrome, Edge, Firefox o Samsung Internet.
2. Selecciona un escenario o modifica el escenario inicial de dos aires inverter.
3. Introduce potencia media, potencia máxima, cantidad y horas de uso diurnas/nocturnas de cada carga. Marca **Solar** solo para los circuitos alimentados por el inversor.
4. Ajusta paneles, horas solares pico, rendimiento, inversor, baterías y precio.
5. Exporta el proyecto con **Guardar JSON** o imprime mediante **Imprimir/PDF**.

## Publicar en GitHub Pages
Crea un repositorio, sube `index.html`, `styles.css`, `logic.js`, `app.js` a la raíz y activa GitHub Pages desde Settings → Pages, desplegando la rama principal. No hay backend ni cuenta requerida. Otra opción es usar el archivo `SolarPlan_Pro_Standalone.html` generado junto con el ZIP y renombrarlo `index.html`.

## Fórmulas y limitaciones
- Consumo: Σ (cantidad × potencia promedio W × horas) / 1000, sumando solo cargas solares para dimensionar el sistema. Consumos con ENEE se muestran aparte.
- Producción FV potencial/día: número de paneles × W/1000 × HSP × rendimiento FV. El rendimiento es global aproximado, no clima horario ni garantía de generación.
- Meta fotovoltaica: consumo solar de día + consumo solar nocturno / factor de recarga configurable. Para una proyección más detallada usar PVWatts e irradiación local.
- Batería disponible a cargas CA: kWh nominales × profundidad de descarga × eficiencia de conversión DC→AC.
- Batería nominal mínima: demanda nocturna × (1+margen) / (DoD × eficiencia).
- Potencia de diseño del inversor: Σ (cantidad × potencia máxima de carga) × (1+margen). No se modelan picos de arranque del motor ni límites por fase de 120/240 V.
- Límite de descarga CA indicativo: número de baterías × voltaje DC × amperios máximos de descarga × eficiencia / 1000. Requiere corroboración con BMS y documentación del fabricante.
- No equiparar el valor de kWh (energía) de una batería con la potencia de kW. Los parámetros de Voc, corriente, ventana MPPT, protecciones, strings, compatibilidad CAN y topología de tableros deben validarse profesionalmente.
- Un excedente FV potencial **no equivale a exportación a ENEE**, ni a ahorro garantizado. El cálculo económico de ahorro es solo un límite simplificado por autoconsumo.
- Precios en cero significa **no cotizados**; el tipo de cambio inicial es un dato editable del escenario (27.02 HNL/USD), no una cotización en tiempo real.

## Privacidad
No usa rastreadores, cookies de publicidad ni formularios de envío. Los proyectos se guardan localmente en el navegador con `localStorage`. La información solo sale del equipo cuando el usuario exporta el archivo JSON.

## Créditos de referencia técnica
- https://pvwatts.nlr.gov/ (referencia sobre generación FV y pérdidas; el motor local es independiente, no reproduce el algoritmo de PVWatts)
- https://www.solisinverters.com/us/energy_storage_inverters42/S6-EH2P%289%2C6-16%29K03-SV-YD-L-US.html (consultar fichas y compatibilidad, no constituye certificación del sistema propuesto)
