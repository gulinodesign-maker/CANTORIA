const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync('score-ocr.js', 'utf8'), context);
const parse = context.window.CantoriaOCR.parse;

const result = parse([
  'INTRO',
  'SOL   DO   LA-   RE',
  'STROFA',
  'SOL        RE',
  'Benedetto sei Signore',
  'RITORNELLO',
  'DO       SOL',
  'A te cantiamo Cristo Re'
].join('\n'));
assert.equal(result.length, 3);
assert.equal(result[0].kind, 'intro');
assert.equal(result[0].chordsOnly.length, 4);
assert.equal(result[1].lines[0].marked, 'Benedetto sei Signore');
assert.equal(result[1].lines[0].anchors.length, 2);
assert.equal(result[2].kind, 'chorus');
assert.equal(result[2].lines[0].anchors[0].chord, 'DO');

assert.equal(parse(' \n\n').length, 0);
assert.equal(parse('Testo semplice senza accordi')[0].lines[0].anchors.length, 0);

// Validate the embedded app script and the progressive enhancement scripts.
const html = fs.readFileSync('index.html', 'utf8');
const inline = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(inline, 'Missing main application script');
new vm.Script(inline[1], { filename: 'index.html inline script' });
new vm.Script(fs.readFileSync('score-capture-patch.js', 'utf8'));
assert.ok(html.includes('src="./score-ocr.js"'));
assert.ok(html.includes('src="./score-capture-patch.js"'));
console.log('Cantoria photo OCR parser and JavaScript syntax: OK');
