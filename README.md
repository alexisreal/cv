# CV y portafolio — Alexis Real Santillán

Una sola página (`index.html`) que contiene cuatro documentos —CV y portafolio, en español e inglés—,
se pagina sola en hojas tamaño carta y exporta a PDF legible por los parsers de reclutamiento.

Publicado en https://alexisreal.github.io/cv/

## Cómo se pagina

El contenido no se maqueta por hojas: se reparte. Cada documento es una lista plana de `.block`.
`renderCV()` crea una hoja, va metiendo bloques y después de cada uno mide `scrollHeight > clientHeight`;
cuando un bloque desborda lo saca **completo** y abre hoja nueva. Por eso nunca se parte un puesto,
una tarjeta o una viñeta a la mitad.

Dos reglas más:

- `force-page-break` abre hoja nueva a propósito (lo usa el anexo JSON).
- Si el bloque que entra es un `section-heading`, se comprueba que el siguiente también quepa;
  si no, los dos se van juntos a la hoja siguiente. Así ningún título queda solo al pie.

**La hoja mide 816 × 1056 px, que a 96 DPI son 8.5 × 11 pulgadas exactas.** Ese tamaño está en
`.physical-page` y `.page-content` (`styles.css`) y lo asume el algoritmo de `renderCV()`:
si cambias uno, cambia el otro, o la pantalla y el PDF dejan de coincidir.

Cuando un texto crece y empuja una hoja de más, lo que se ajusta es el largo del texto, nunca el
tamaño de la hoja. El CV son 8 hojas y el portafolio 3, en los dos idiomas.

## Legibilidad para los parsers de reclutamiento

- Las fuentes que no se están mostrando viven en `<script type="text/html">`, no en `div` ocultos:
  un parser que solo quita etiquetas lee **un** documento (~24 mil caracteres), no los cuatro pegados
  (~59 mil) con los mismos empleos repetidos en dos idiomas.
- El PDF lleva texto real y seleccionable en una sola columna, con los encabezados de sección
  canónicos (`DATOS DE CONTACTO`, `RESUMEN`, `EXPERIENCIA PROFESIONAL`…; los corchetes son CSS,
  no caracteres) y cada puesto en tres líneas: puesto / empresa — lugar / fechas.
- Los enlaces se exportan como anotaciones clicables, no como texto plano.
- `<script type="application/ld+json">` con un `Person` de schema.org para los rastreadores de perfiles.
- El anexo JSON de la última hoja es la ficha estructurada para los filtros automáticos con LLM.

## Uso

```bash
npm install          # puppeteer y pdf-parse
npm run pdf          # genera pdf/Alexis-Real-Santillan-{CV,Portafolio}-{ES,EN}.pdf
npm run check        # verifica HTML y PDFs: hojas, texto extraíble, encabezados, contacto, enlaces
npm run build        # las dos cosas
```

`npm run pdf` falla si alguna variante se sale de su paginación esperada o deja una hoja en blanco.
El botón **PDF** de la página también sirve (`window.print()` con el CSS de impresión), pero el
archivo sale con el nombre del `<title>`; el script lo nombra de forma canónica, sin rayas largas
ni barras verticales, que algunos portales de carga rechazan.

Los PDFs generados no se versionan (`pdf/` está en `.gitignore`).
