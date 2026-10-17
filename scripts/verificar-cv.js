#!/usr/bin/env node
/**
 * Verifica que el CV se deje leer bien por los parsers de reclutamiento (ATS),
 * en HTML y en PDF. Falla con código 1 si algo se rompe.
 *
 *   npm run check          → revisa index.html y los PDFs de pdf/
 *
 * Qué se comprueba y por qué:
 *  - HTML: un parser que solo quita etiquetas debe ver UN documento, no cuatro.
 *    Por eso las fuentes que no se muestran viven en <script type="text/html">.
 *  - PDF: texto extraíble de verdad (no imágenes), orden de lectura de arriba
 *    abajo, encabezados de sección canónicos, contacto y enlaces como anotaciones.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const { PDFParse } = require(resolver('pdf-parse'));

function resolver(mod) {
  for (const ruta of [mod, path.join(RAIZ, 'scratch', 'node_modules', mod)]) {
    try { require.resolve(ruta); return ruta; } catch (_) {}
  }
  console.error(`Falta ${mod}. Instálalo con: npm install`);
  process.exit(1);
}

let fallas = 0;
const comprobar = (ok, etiqueta, detalle = '') => {
  if (!ok) fallas++;
  console.log(`  ${ok ? 'ok   ' : 'FALLA'} ${etiqueta}${detalle ? ' — ' + detalle : ''}`);
};

const PDFS = [
  { archivo: 'Alexis-Real-Santillan-CV-ES.pdf',         paginas: 8, minimo: 15000,
    encabezados: ['DATOS DE CONTACTO', 'RESUMEN', 'EXPERIENCIA PROFESIONAL', 'HABILIDADES TÉCNICAS Y HERRAMIENTAS', 'FORMACIÓN ACADÉMICA'],
    ausentes: ['CONTACT DETAILS', 'PORTAFOLIO DE SERVICIOS'] },
  { archivo: 'Alexis-Real-Santillan-CV-EN.pdf',         paginas: 8, minimo: 15000,
    encabezados: ['CONTACT INFORMATION', 'EXECUTIVE SUMMARY', 'PROFESSIONAL EXPERIENCE', 'TECHNICAL SKILLS & TOOLS', 'EDUCATION AND CERTIFICATIONS'],
    ausentes: ['DATOS DE CONTACTO', 'SERVICES PORTFOLIO'] },
  { archivo: 'Alexis-Real-Santillan-Portafolio-ES.pdf', paginas: 3, minimo: 4000,
    encabezados: ['CATÁLOGO DE SERVICIOS', 'VALOR ESTRATÉGICO'], ausentes: ['EXPERIENCIA PROFESIONAL'] },
  { archivo: 'Alexis-Real-Santillan-Portfolio-EN.pdf',  paginas: 3, minimo: 4000,
    encabezados: ['SERVICES CATALOG', 'STRATEGIC VALUE'], ausentes: ['PROFESSIONAL EXPERIENCE'] },
];

(async () => {
  // ---------- HTML ----------
  console.log('HTML (index.html)');
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const texto = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')   // lo que hace cualquier extractor serio
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  comprobar(texto.length < 30000, 'un solo documento para un parser sin JavaScript', `${texto.length} caracteres`);
  comprobar(!texto.includes('Principal Cloud & Software Architect with over'), 'no se cuela el CV en inglés');
  comprobar(!texto.includes('CATÁLOGO DE SERVICIOS') && !texto.includes('SERVICE CATALOG'), 'no se cuela el portafolio');
  comprobar(/<html lang="es"/.test(html), 'atributo lang declarado');
  comprobar(/<meta name="description"/.test(html), 'meta description presente');

  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  let persona = null;
  try { persona = ld && JSON.parse(ld[1]); } catch (e) { /* queda en null */ }
  comprobar(!!persona && persona['@type'] === 'Person', 'JSON-LD Person válido');
  comprobar(!!persona && !!persona.email && Array.isArray(persona.sameAs) && persona.sameAs.length >= 2,
            'JSON-LD con correo y perfiles');

  // ---------- PDF ----------
  for (const def of PDFS) {
    const ruta = path.join(RAIZ, 'pdf', def.archivo);
    console.log('\nPDF (' + def.archivo + ')');
    if (!fs.existsSync(ruta)) { comprobar(false, 'existe', 'corre primero: npm run pdf'); continue; }

    const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(ruta)) });
    const r = await parser.getText();
    const t = r.text;

    comprobar(r.pages.length === def.paginas, 'número de hojas', `${r.pages.length} (esperadas ${def.paginas})`);
    comprobar(t.length >= def.minimo, 'texto extraíble, no imagen', `${t.length} caracteres`);
    comprobar(r.pages.every(p => (p.text || '').trim().length > 40), 'ninguna hoja en blanco');
    for (const h of def.encabezados) comprobar(t.includes(h), `encabezado "${h}"`);
    for (const a of def.ausentes) comprobar(!t.includes(a), `sin mezcla: "${a}" no aparece`);
    comprobar(t.includes('alexisreal@gmail.com'), 'correo de contacto');
    comprobar(/alexis real santill[áa]n/i.test(t.slice(0, 400)), 'nombre en el primer bloque de lectura');

    const crudo = fs.readFileSync(ruta, 'latin1');
    const urls = new Set(crudo.match(/\/URI\s*\(([^)]*)\)/g) || []);
    comprobar(urls.size >= 1, 'enlaces como anotaciones clicables', `${urls.size} distintos`);
    await parser.destroy();
  }

  console.log(fallas ? `\n${fallas} comprobación(es) fallida(s).` : '\nTodo en orden.');
  process.exit(fallas ? 1 : 0);
})();
