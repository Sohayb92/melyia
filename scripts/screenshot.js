/**
 * Script de capture d'écran pour Mélyia.
 *
 * Usage :
 *   node scripts/screenshot.js                       # par défaut : ouvre melyia.html et capture le dashboard
 *   node scripts/screenshot.js patient-detail        # ouvre la fiche patient (avec patient mock)
 *   node scripts/screenshot.js stats                 # ouvre la Vue Stats
 *   node scripts/screenshot.js --mobile patient-detail  # capture mobile (375x812)
 *
 * Les captures sont sauvegardées dans `screenshots/v{version}-{view}-{timestamp}.png`.
 *
 * Pour Mélyia (qui utilise IndexedDB Dexie), le script injecte des données de test
 * au boot pour pouvoir capturer des vues avec contenu (patients, devis, etc.).
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'melyia.html');
const SCREENSHOTS_DIR = path.join(ROOT, 'screenshots');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

// Données mock injectées dans IndexedDB pour avoir des vues remplies
const MOCK_PATIENTS = [
  { id: 1, nom: 'MARTIN', prenom: 'Sophie', email: 'sophie.martin@example.com', telephone: '06 12 34 56 78', civilite: 'F', noContact: false, notes: '', created_at: '2026-03-15T10:00:00.000Z' },
  { id: 2, nom: 'DUPONT', prenom: 'Marc', email: 'marc.dupont@example.com', telephone: '06 98 76 54 32', civilite: 'M', noContact: false, notes: '', created_at: '2026-04-20T14:00:00.000Z' },
];
const MOCK_DEVIS = [
  { id: 1, patient_id: 1, soins: 'Implant 35 + couronne céramique', montant: 1850, status: 'Accepté', date_envoi: '2026-04-28T10:00:00.000Z', dateAcceptation: '2026-05-15T11:30:00.000Z', soinTermine: false, googleReviewMailSent: false, notes: '' },
  { id: 2, patient_id: 2, soins: 'Greffe gingivale 13', montant: 950, status: 'En attente', date_envoi: '2026-05-18T10:00:00.000Z', date_relance_prevue: '2026-06-08T10:00:00.000Z', soinTermine: false, googleReviewMailSent: false, notes: '' },
];

async function takeScreenshot(view = 'dashboard', isMobile = false) {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  if (isMobile) {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  } else {
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  }

  // Console log relay pour debug
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('favicon')) console.log('[browser ERROR]', text);
  });

  // Charger melyia.html en file://
  const fileUrl = 'file:///' + HTML_PATH.replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });

  // Injecter les données mock via une instance Dexie isolée (le scope local de melyia.html
  // ne expose pas window.db). Dexie pointe vers la même DB "MelyiaDB" ouverte par l'app.
  await page.evaluate(async (mockPatients, mockDevis) => {
    const Dexie = window.Dexie;
    if (!Dexie) throw new Error('Dexie pas chargé sur la page');
    const seedDb = new Dexie('MelyiaDB');
    seedDb.version(5).stores({
      patients: '++id, nom, prenom, email, telephone, created_at',
      devis: '++id, patient_id, status, date_envoi, dateAcceptation, dateRefus, dateSansReponse, soinTermine, dateSoinTermine, googleReviewMailSent, date_relance_prevue, montant',
      relances: '++id, devis_id, date',
      maintenances: '++id, patient_id, type, intervalle_mois, prochain_rappel, actif',
      rappels_maintenance: '++id, maintenance_id, date'
    });
    await seedDb.open();
    await seedDb.patients.clear();
    await seedDb.devis.clear();
    await seedDb.patients.bulkAdd(mockPatients);
    await seedDb.devis.bulkAdd(mockDevis);
    seedDb.close();
    localStorage.setItem('melyia_googleReviewEnabled', '1');
    localStorage.setItem('melyia_googleReviewUrl', 'https://g.page/r/CSAhN9X9DtepEBM/review');
    localStorage.setItem('melyia_doctorName', 'Dr Sohaïb Kebieche');
  }, MOCK_PATIENTS, MOCK_DEVIS);

  // Recharge la page pour que l'app prenne en compte les nouvelles données + settings
  await page.reload({ waitUntil: 'networkidle0' });

  await new Promise(r => setTimeout(r, 500));

  // Naviguer vers la vue demandée via clics DOM (pas besoin d'exposer le scope JS)
  async function clickNav(viewName) {
    await page.evaluate((v) => {
      const els = document.querySelectorAll(`[data-view="${v}"]`);
      if (els.length === 0) throw new Error(`Nav element data-view="${v}" introuvable`);
      // Clic sur le 1er (premier élément visible)
      els[0].click();
    }, viewName);
    await new Promise(r => setTimeout(r, 600));
  }

  if (view === 'stats') {
    await clickNav('stats');
  } else if (view === 'patient-detail') {
    await clickNav('patients');
    // Ouvrir le 1er patient via clic sur sa carte
    await new Promise(r => setTimeout(r, 400));
    const opened = await page.evaluate(() => {
      const patientCards = document.querySelectorAll('.patient-card, [data-patient-id], .open-patient-btn');
      if (patientCards.length > 0) {
        patientCards[0].click();
        return true;
      }
      // Fallback : essayer un selector plus large
      const firstClickable = document.querySelector('#patients-list > div, #patients-list a');
      if (firstClickable) { firstClickable.click(); return true; }
      return false;
    });
    if (!opened) console.warn('⚠ Impossible d\'ouvrir la fiche patient (selector pas trouvé)');
    await new Promise(r => setTimeout(r, 800));
  } else if (view === 'settings') {
    await clickNav('settings');
  }

  // Capture
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const suffix = isMobile ? '-mobile' : '';
  const filename = `v${VERSION}-${view}${suffix}-${timestamp}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });

  await browser.close();
  console.log(`✓ Screenshot saved → screenshots/${filename}`);
  return filepath;
}

// CLI
(async () => {
  const args = process.argv.slice(2);
  const isMobile = args.includes('--mobile');
  const view = args.find(a => !a.startsWith('--')) || 'dashboard';
  try {
    await takeScreenshot(view, isMobile);
  } catch (e) {
    console.error('Screenshot failed:', e.message);
    process.exit(1);
  }
})();
