/* The museum's test harness. One file.
 *
 *   node check.js            run the checks, write screenshots to shots/
 *   node check.js --quick    checks only, no screenshots
 *   node check.js <path>     run against a different index.html
 *
 * It drives a real Chrome. Everything it reports, it did.
 */
const path = require('path');
const fs = require('fs');
const PW = require('C:/Users/Hamza/career-ops/node_modules/playwright');

const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const FILE = (args.find(a => !a.startsWith('--')) || 'C:/Users/Hamza/Downloads/museum-work/index.html').split('\\').join('/');
const OUT = path.join(path.dirname(FILE), 'shots');
const url = d => 'file:///' + FILE + (d ? '?dev' : '');

let pass = 0, fail = 0;
const ok = (name, good, detail) => {
  (good ? pass++ : fail++);
  console.log((good ? '  ok   ' : '  FAIL ') + name + (detail ? '   ' + detail : ''));
};

/* dismiss a dialogue completely: the first press finishes the typewriter, the next closes it */
const clearDialogue = async pg => {
  for (let i = 0; i < 14; i++) {
    const open = await pg.evaluate(() => { if (typeof DL !== 'undefined' && DL) { advanceDL(); return true; } return false; });
    if (!open) return;
    await pg.waitForTimeout(90);
  }
};

(async () => {
  if (!fs.existsSync(FILE)) { console.error('no such file: ' + FILE); process.exit(1); }

  /* ---- static: does it even parse? ---- */
  console.log('\nFILE  ' + FILE);
  const src = fs.readFileSync(FILE, 'utf8');
  ok('ends with </html>', /<\/html>\s*$/.test(src));
  let parsed = true;
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m; while ((m = re.exec(src))) { try { new Function(m[1]); } catch (e) { parsed = false; ok('script parses', false, e.message); } }
  if (parsed) ok('scripts parse', true, Math.round(src.length / 1024) + ' KB');

  const browser = await PW.chromium.launch();
  const errs = [];
  const newPage = async dev => {
    const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
    pg.on('console', c => { if (c.type() === 'error') errs.push('console: ' + c.text()); });
    await pg.goto(url(dev), { waitUntil: 'load' });
    await pg.waitForTimeout(2200);
    return pg;
  };

  /* ---- the gate: everything is behind this, so test it hard ---- */
  console.log('\nPASSWORD');
  {
    const pg = await newPage(false);
    ok('watchdog silent on a good load', !(await pg.evaluate(() => !!document.querySelector('[role=alert]'))));
    ok('boot flag set', await pg.evaluate(() => !!window.__museumBooted));
    for (const w of ['sushi', 'machi', 'hibachi', 'Sushi', ' sushi ']) {
      await pg.evaluate(() => { location.reload(); });
      await pg.waitForTimeout(1900);
      const entered = await pg.evaluate(word => {
        document.querySelector('#pw').value = word;
        document.querySelector('#start').click();
        return !document.querySelector('#intro').classList.contains('on');
      }, w);
      ok('accepts ' + JSON.stringify(w), entered);
    }
    // a correct password is remembered, so forget it before testing rejection
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} location.reload(); });
    await pg.waitForTimeout(1900);
    const blocked = await pg.evaluate(() => {
      document.querySelector('#pw').value = 'wrongword';
      document.querySelector('#start').click();
      return document.querySelector('#intro').classList.contains('on') && !!document.querySelector('#pwerr').textContent;
    });
    ok('rejects a wrong word with a message', blocked);
    await pg.close();
  }

  /* ---- the world ---- */
  console.log('\nWORLD');
  const pg = await newPage(true);
  await pg.evaluate(() => document.querySelector('#start').click());
  await pg.waitForTimeout(2300);
  await clearDialogue(pg);

  const SCENES = ['world', 'hall', 'concert', 'green', 'screen', 'lab', 'ward', 'plush', 'turk', 'cafe', 'us'];
  const bad = await pg.evaluate(ids => {
    const out = [];
    for (const id of ids) { try { const sc = getScene(id); if (!sc || !sc.solid) out.push(id); } catch (e) { out.push(id + ':' + e.message); } }
    return out;
  }, SCENES);
  ok('all ' + SCENES.length + ' scenes build', bad.length === 0, bad.join(', '));

  const moods = await pg.evaluate(() => {
    const out = {};
    for (const id of ['hall', 'concert', 'green', 'screen', 'lab', 'ward', 'plush', 'turk', 'cafe', 'us']) {
      const sc = getScene(id), m = moodOf(id);
      out[id] = { look: m.look, lights: sc.lights.length, spots: sc.lights.filter(l => l.spot).length };
    }
    return out;
  });
  const noLights = Object.entries(moods).filter(([, v]) => v.lights === 0).map(([k]) => k);
  ok('every wing is lit', noLights.length === 0, noLights.join(', '));
  const noSpots = Object.entries(moods).filter(([, v]) => v.spots === 0).map(([k]) => k);
  ok('every wing spotlights its exhibits', noSpots.length === 0, noSpots.join(', '));
  const looks = [...new Set(Object.values(moods).map(v => v.look))].sort();
  ok('all three looks in use', looks.length === 3, looks.join('/'));

  /* wanderers */
  const p0 = await pg.evaluate(() => cur.filter(e => e.wander).map(e => e.tx + ',' + e.ty).join('|'));
  await pg.waitForTimeout(4000);
  const p1 = await pg.evaluate(() => cur.filter(e => e.wander).map(e => e.tx + ',' + e.ty).join('|'));
  ok('NPCs wander', p0 !== p1);

  /* a petted cat follows */
  const petted = await pg.evaluate(() => {
    const c = cur.find(e => e.kind === 'cat' && !e.gate); if (!c) return false;
    P.tx = c.tx; P.ty = c.ty + 1; P.px = P.tx * 16; P.py = P.ty * 16; P.mv = null; P.dir = 'up'; act();
    return !!c.follow;
  });
  ok('petting recruits a cat', petted);
  await clearDialogue(pg);
  const d0 = await pg.evaluate(() => { const c = cur.find(e => e.follow); if (!c) return null; P.tx = c.tx + 7; P.ty = c.ty; P.px = P.tx * 16; P.py = P.ty * 16; P.mv = null; return 7; });
  await pg.waitForTimeout(3500);
  const d1 = await pg.evaluate(() => { const c = cur.find(e => e.follow); return c ? Math.abs(c.tx - P.tx) + Math.abs(c.ty - P.ty) : null; });
  ok('the cat follows you', d1 !== null && d0 !== null && d1 < d0, d0 + ' -> ' + d1 + ' tiles');

  /* ---- the butterfly has to flee AND still be catchable ---- */
  console.log('\nBUTTERFLY');
  await pg.evaluate(() => { const s = document.querySelector('#devs'); s.value = 'concert'; document.querySelector('#devgo').click(); });
  await pg.waitForTimeout(1500);
  await clearDialogue(pg);
  const bfState = () => pg.evaluate(() => {
    const it = SCN.inter.find(i => i.kind === 'keep' && !st.found[i.ref]);
    return it ? { x: it.fx, y: it.fy, rest: it.rest, found: !!st.found[it.ref] } : null;
  });
  const b0 = await bfState();
  ok('a keepsake exists here', !!b0);
  if (b0) {
    await pg.waitForTimeout(1800);
    const b1 = await bfState();
    const drift = Math.hypot(b1.x - b0.x, b1.y - b0.y);
    ok('it drifts on its own', drift > 0.05, drift.toFixed(2) + ' tiles / 1.8s');

    await pg.evaluate(() => {
      const it = SCN.inter.find(i => i.kind === 'keep' && !st.found[i.ref]);
      P.tx = Math.round(it.fx); P.ty = Math.round(it.fy) + 2; P.px = P.tx * 16; P.py = P.ty * 16; P.mv = null;
    });
    await pg.waitForTimeout(900);
    const b2 = await pg.evaluate(() => {
      const it = SCN.inter.find(i => i.kind === 'keep' && !st.found[i.ref]);
      return { d: Math.hypot(it.fx - P.px / 16, it.fy - P.py / 16), tired: it.tired };
    });
    ok('it shies away when you approach', b2.d > 1.6, b2.d.toFixed(2) + ' tiles away');

    let caught = false;
    for (let i = 0; i < 80 && !caught; i++) {
      const r = await pg.evaluate(() => {
        const it = SCN.inter.find(i => i.kind === 'keep' && !st.found[i.ref]);
        if (!it) return { found: true };
        const dx = Math.round(it.fx) - P.tx, dy = Math.round(it.fy) - P.ty;
        if (!P.mv && (dx || dy)) beginMove(P, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        if (Math.abs(dx) + Math.abs(dy) <= 1) { P.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); act(); }
        return { found: !!st.found[it.ref] };
      });
      if (r.found) caught = true; else await pg.waitForTimeout(100);
    }
    ok('it can still be caught', caught);
  }

  /* ---- UI that used to silently do nothing ---- */
  console.log('\nUI');
  await pg.evaluate(() => { closeModal(); say('Docent', ['Testing the dialogue box.']); });
  await pg.waitForTimeout(400);
  ok('dialogue shows a portrait', await pg.evaluate(() => !document.querySelector('#dport').classList.contains('none')));
  ok('journal opens during dialogue', await pg.evaluate(() => {
    document.querySelector('#jbtn').click();
    return document.querySelector('#modal').classList.contains('on');
  }));
  await pg.evaluate(() => closeModal());
  ok('menu opens', await pg.evaluate(() => { document.querySelector('#menubtn').click(); return document.querySelector('#menu').classList.contains('on'); }));
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  ok('Escape closes the menu', await pg.evaluate(() => !document.querySelector('#menu').classList.contains('on')));

  /* ---- screenshots ---- */
  if (!QUICK) {
    fs.mkdirSync(OUT, { recursive: true });
    console.log('\nSHOTS -> ' + OUT);
    const shot = async n => { await pg.screenshot({ path: path.join(OUT, n + '.png') }); process.stdout.write('  ' + n); };
    await pg.evaluate(() => { closeModal(); closeMenu(); if (typeof DL !== 'undefined' && DL) { DL = null; document.querySelector('#dlg').classList.remove('on'); } });
    for (const id of SCENES) {
      await pg.evaluate(i => { const s = document.querySelector('#devs'); s.value = i; document.querySelector('#devgo').click(); }, id);
      await pg.waitForTimeout(1300);
      await shot(id);
    }
    await pg.evaluate(() => document.querySelector('#menubtn').click());
    await pg.waitForTimeout(500); await shot('_menu');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
    await pg.evaluate(() => say('Docent', ['Welcome to the museum. I am the docent. I work for treats.']));
    await pg.waitForTimeout(1500); await shot('_dialogue');
    console.log();
  }

  console.log('\n' + (errs.length ? 'PAGE ERRORS:\n  ' + errs.join('\n  ') : 'no page errors'));
  console.log(pass + ' passed, ' + fail + ' failed' + (errs.length ? ', ' + errs.length + ' errors' : ''));
  await browser.close();
  process.exit(fail || errs.length ? 1 : 0);
})().catch(e => { console.error('HARNESS CRASH', e); process.exit(1); });
