/**
 * _verify_promo_real.js — parsea el PROMOTIONS.md REAL (no un fixture) y
 * corre controles sobre lo que el dashboard va a mostrar de verdad.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE
 *
 * _test_promo.js lee `_fixture_promotions.md`. Eso prueba que el PARSER
 * funciona, pero no prueba que el dato de producción sea legible: las dos
 * cosas pueden romperse por separado y el test sigue en verde.
 *
 * El fixture tiene la forma del archivo real; el archivo real cambia. Un
 * cambio de PROMOTIONS.md que no entre en un bucket es invisible para la
 * suite. Esto lo cubre.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'js', 'parser.js'), 'utf8');
(0, eval)(src + '\n;globalThis.__P = DashboardParser;');
const P = globalThis.__P;

const MD = process.argv[2] || 'C:/Mis Archivos/GW2 online/gw2-dev/PROMOTIONS.md';
const md = fs.readFileSync(MD, 'utf8');
const promo = P.parsePromotions(md);

console.log('=== PROMOTIONS.md REAL ===');
console.log('parseable:', promo.parseable, '| actualizado:', promo.updatedAt);
console.log('');

const buckets = [
  ['ESPERANDO TU DECISION', promo.esperando],
  ['EN PROD SIN VERIFICAR', promo.prodSinVerificar],
  ['CONGELADO', promo.congelado],
  ['NO CANDIDATO', promo.noCandidato],
  ['DECIDIDO', promo.decidido],
  ['INDETERMINADO', promo.indeterminado],
];

for (const [name, arr] of buckets) {
  console.log(`--- ${name} (${arr.length}) ---`);
  arr.forEach(i => {
    console.log('   ', String(i.commit || '-').padEnd(9), '|',
      String(i.texto || '').replace(/\s+/g, ' ').slice(0, 72));
  });
}

const all = [].concat(...buckets.map(b => b[1]));
const hit = s => all.find(i => JSON.stringify(i).includes(s));

const fails = [];

// 1. La promocion recien hecha tiene que estar en "decidido".
if (!hit('c0471e0')) {
  fails.push('la promocion c0471e0 no aparece en ningun bucket');
} else if (!promo.decidido.find(i => JSON.stringify(i).includes('c0471e0'))) {
  fails.push('c0471e0 no cayo en "decidido"');
}

// 2. HB#141 ya no puede decir que no hay decision.
if (hit('Sin decision de Pablo') || hit('Sin decisi')) {
  fails.push('HB#141 todavia dice que no hay decision tomada');
}

// 3. Los feats que eran invisibles tienen que aparecer ahora.
['d32e054', '4413c34', 'd12ab8b'].forEach(sha => {
  if (!hit(sha)) fails.push(sha + ' sigue invisible para el parser');
});

// 4. 392c3b9 no puede aparecer pidiendo una decision.
if (promo.esperando.find(i => JSON.stringify(i).includes('392c3b9'))) {
  fails.push('392c3b9 aparece pidiendo una decision');
}

// 5. Nada con estado ilegible.
if (promo.indeterminado.length) {
  fails.push('hay ' + promo.indeterminado.length + ' items con estado ilegible');
}

// 6. Ningun item duplicado (una fila repetida se cuenta dos veces en la tab).
const counts = {};
all.forEach(i => { const k = i.commit; counts[k] = (counts[k] || 0) + 1; });
Object.keys(counts).forEach(k => {
  if (counts[k] > 1) fails.push(k + ' aparece ' + counts[k] + ' veces (duplicado)');
});

// 7. La tabla de "Como se usa" no puede llevar filas de datos:
//    una fila de 4 celdas dentro de una tabla de 2 rompe el markdown y
//    ademas hacia que el parser leyera basura de la seccion de leyenda.
if (/\|\s*\*\*Feat\*\*/.test(md.split('## Cómo se usa')[1].split('##')[0].slice(0, 0) || '')) { /* no-op */ }
const comoSeUsa = (md.split('## Cómo se usa')[1] || '').split('\n## ')[0];
if (/`d32e054`/.test(comoSeUsa)) {
  fails.push('la tabla de "Como se usa" todavia tiene una fila de datos pegada');
}

// 8. Cada tarjeta tiene que tener un titulo corto. Una tabla de decisiones
//    sin columna "Feat" hace que el parser use la celda entera como nombre,
//    y la tarjeta sale titulada "2026-10-04 - `c0471e0` (Armería Legendaria
//    - 12 módulos nuevos, 36 archivos, 1994 KB; incluye...". El dato estaba
//    bien y la tarjeta ilegible: el mismo patrón que el de ALERT-49.
all.forEach(i => {
  const n = String(i.nombre || '');
  if (n.length > 110) {
    fails.push('titulo ilegible (' + n.length + ' chars, la tarjeta lo corta): ' +
      n.slice(0, 60) + '...');
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(n)) {
    fails.push('el titulo arranca con la fecha: falta columna "Feat" en la tabla');
  }
});

console.log('\n=== CONTROLES ===');
if (!fails.length) {
  console.log('  OK   8/8 controles contra el PROMOTIONS.md REAL');
} else {
  fails.forEach(f => console.log('  FAIL', f));
  console.log('  ' + fails.length + ' FALLA(S)');
}
