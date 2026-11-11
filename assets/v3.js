/* v3 skin — loaded by index_v3.html only, after v2.js. Draws the headline numbers (method tiles, hero facts) as a dot matrix.
   The text of every number is unchanged and kept as the accessible label. */
(function () {
'use strict';
const root = document.documentElement; if (!root.classList.contains('v3')) return;
const G = {'0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'], '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'], '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'], '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'], '.': ['0', '0', '0', '0', '0', '0', '1'], ',': ['0', '0', '0', '0', '0', '1', '1'], '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'], ' ': ['00', '00', '00', '00', '00', '00', '00'], '—': ['00000', '00000', '00000', '11111', '00000', '00000', '00000']};
function matrix(text) {
  let x = 0, on = '', off = '';
  for (const ch of text) { const g = G[ch]; if (!g) return null; const w = g[0].length;
    for (let r = 0; r < 7; r++) for (let c = 0; c < w; c++) { const d = `<rect x="${x + c + .09}" y="${r + .09}" width=".82" height=".82" rx=".2"/>`; if (g[r][c] === '1') on += d; else if (w === 5) off += d; }
    x += w + 1.5; }
  return `<svg viewBox="0 0 ${x - 1.5} 7" role="img" aria-label="${text}"><g class="off">${off}</g><g class="on">${on}</g></svg>`;
}
function apply() {
  document.querySelectorAll('.v2t .v2num b:not(.v3mx)').forEach(b => { const t = (b.dataset.to != null ? b.dataset.to + '%' : b.textContent).trim(), svg = matrix(t); if (!svg) return;
    const n = document.createElement('b'); n.className = 'v3mx'; n.innerHTML = svg; b.replaceWith(n); });
  document.querySelectorAll('.v2facts dt').forEach(dt => { const t = dt.textContent.trim(); if (!t || dt.querySelector('svg')) return; const svg = matrix(t); if (svg) dt.innerHTML = `<span class="v3mx">${svg}</span>`; });
}
let q = false; const kick = () => { if (!q) { q = true; requestAnimationFrame(() => requestAnimationFrame(() => { q = false; apply(); })); } };
new MutationObserver(kick).observe(document.getElementById('app'), {childList: true, subtree: true, characterData: true});
kick();
})();
