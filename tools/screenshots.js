// Take the three checkpoint screenshots (list, detail, overview) from the local static page.
// Usage: node tools/screenshots.js   (Playwright with a Chromium build must be available)
const {chromium} = require('playwright');
const path = require('path');
const WEB = path.resolve(__dirname, '..');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 2});
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const url = h => 'file://' + path.join(WEB, 'index.html') + h;
  await p.goto(url('#list')); await p.waitForTimeout(8500);
  await p.screenshot({path: path.join(WEB, 'screenshots/list.png')});
  await p.goto(url('#case/' + encodeURIComponent('holdout:01:0070:matched'))); await p.waitForTimeout(1500);
  await p.click('#tAns'); await p.waitForTimeout(2500);
  await p.screenshot({path: path.join(WEB, 'screenshots/detail.png')});
  // a real-floor case (S2) and a direction instruction (S4 F6), first ones that carry trajectories
  for (const [name, pick] of [['detail_S2', e => e.d === 'S2' && e.t], ['detail_S4F6', e => e.d === 'S4' && e.f === 'F6' && e.t]]) {
    const id = await p.evaluate(src => window.SL_INDEX.find(new Function('return ' + src)()).id, pick.toString());
    await p.goto(url('#case/' + encodeURIComponent(id))); await p.waitForTimeout(1500);
    await p.click('#tAns'); await p.waitForTimeout(2500);
    await p.screenshot({path: path.join(WEB, `screenshots/${name}.png`)});
  }
  await p.goto(url('#overview')); await p.waitForTimeout(3000);
  await p.screenshot({path: path.join(WEB, 'screenshots/overview.png'), fullPage: true});
  const m = await b.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
  await m.goto(url('#list')); await m.waitForTimeout(8500);
  await m.screenshot({path: path.join(WEB, 'screenshots/mobile_list.png')});
  console.log('errors:', errs.length ? errs : 'none', '| mobile scrollWidth', await m.evaluate(() => document.documentElement.scrollWidth));
  await b.close();
})();
