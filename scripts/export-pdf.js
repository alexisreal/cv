#!/usr/bin/env node
/**
 * Exporta el CV y el portafolio a PDF, en español e inglés, con nombre de archivo
 * canónico (sin rayas largas ni barras verticales, que algunos portales de carga rechazan).
 *
 *   npm run pdf            → pdf/Alexis-Real-Santillan-CV-ES.pdf y los otros tres
 *
 * La paginación no la hace este script: la hace renderCV() dentro de index.html,
 * que reparte bloques enteros en hojas de 816x1056 px (carta exacta a 96 DPI).
 * Aquí solo se imprime con margen cero para no reescalar esas hojas.
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(resolverPuppeteer());

function resolverPuppeteer() {
  for (const ruta of ['puppeteer', path.join(__dirname, '..', 'scratch', 'node_modules', 'puppeteer')]) {
    try { require.resolve(ruta); return ruta; } catch (_) {}
  }
  console.error('Falta puppeteer. Instálalo con: npm install');
  process.exit(1);
}

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'pdf');

const VARIANTES = [
  { vista: 'cv',        idioma: 'es', archivo: 'Alexis-Real-Santillan-CV-ES.pdf',          paginas: 8 },
  { vista: 'cv',        idioma: 'en', archivo: 'Alexis-Real-Santillan-CV-EN.pdf',          paginas: 8 },
  { vista: 'portfolio', idioma: 'es', archivo: 'Alexis-Real-Santillan-Portafolio-ES.pdf',  paginas: 3 },
  { vista: 'portfolio', idioma: 'en', archivo: 'Alexis-Real-Santillan-Portfolio-EN.pdf',   paginas: 3 },
];

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const navegador = await puppeteer.launch();
  let fallas = 0;

  for (const v of VARIANTES) {
    const pagina = await navegador.newPage();
    await pagina.goto('file://' + path.join(RAIZ, 'index.html'), { waitUntil: 'networkidle0' });
    await pagina.evaluate((vista, idioma) => { switchLang(idioma); switchView(vista); }, v.vista, v.idioma);
    await pagina.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 600));

    const hojas = await pagina.evaluate(() => {
      const paginas = [...document.querySelectorAll('#viewer .physical-page .page-content')];
      return { total: paginas.length, vacias: paginas.filter(p => p.innerText.trim().length < 40).length };
    });

    const destino = path.join(SALIDA, v.archivo);
    await pagina.pdf({
      path: destino,
      width: '816px', height: '1056px',   // carta exacta: debe coincidir con .physical-page
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    await pagina.close();

    const ok = hojas.total === v.paginas && hojas.vacias === 0;
    if (!ok) fallas++;
    const kb = Math.round(fs.statSync(destino).size / 1024);
    console.log(`${ok ? 'ok  ' : 'FALLA'} ${v.archivo.padEnd(42)} ${hojas.total} hojas (esperadas ${v.paginas})` +
                `${hojas.vacias ? ', ' + hojas.vacias + ' vacías' : ''} · ${kb} KB`);
  }

  await navegador.close();
  if (fallas) {
    console.error(`\n${fallas} variante(s) fuera de la paginación esperada. Ajusta el largo del texto, no el tamaño de la hoja.`);
    process.exit(1);
  }
  console.log('\nPDFs en ' + SALIDA);
})();
