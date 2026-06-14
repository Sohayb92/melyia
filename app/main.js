const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, desktopCapturer, screen, shell, nativeImage, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');

// Fix Windows : champs de formulaire parfois "grisés"/non éditables au clavier tant qu'on
// n'a pas changé de fenêtre (bug de repaint/focus GPU Chromium). Désactiver l'accélération
// matérielle règle ce cas (app de formulaires, aucun besoin GPU). Doit être appelé avant ready.
app.disableHardwareAcceleration();

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow(); // centralise restore/show/focus + webContents.focus (sinon champs non editables)
  });
}

let mainWindow = null;
let tray = null;
let isQuitting = false;
const startHidden = process.argv.includes('--hidden');
const IS_DEV = !app.isPackaged;
const APP_TITLE = IS_DEV ? 'Melyia — TEST (DEV) — ne pas utiliser pour de vrais patients' : 'Melyia';
const TRAY_TOOLTIP = IS_DEV ? 'Melyia TEST (mode dev)' : 'Melyia — Suivi devis';

// Whitelist des domaines vers lesquels shell.openExternal est autorisé.
// Tout autre URL (typiquement injectée via du contenu user dans un mail/lien) sera bloquée.
const SAFE_EXTERNAL_HOSTS = [
  'accounts.google.com',
  'oauth2.googleapis.com',
  'gmail.googleapis.com',
  'drive.googleapis.com',
  'www.googleapis.com',
  'console.cloud.google.com',
  'github.com',
  'github.io',
  'objects.githubusercontent.com',
  'doctolib.fr',
  'www.doctolib.fr',
  'drkebieche.fr',
  'drkebieche.com',
  'm.drkebieche.fr'
];
function isSafeExternalUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:' && u.protocol !== 'mailto:' && u.protocol !== 'tel:') return false;
    if (u.protocol === 'mailto:' || u.protocol === 'tel:') return true;
    const host = u.hostname.toLowerCase();
    return SAFE_EXTERNAL_HOSTS.some(safe => host === safe || host.endsWith('.' + safe));
  } catch (e) {
    return false;
  }
}

const HTML_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'melyia.html')
  : path.join(__dirname, '..', 'melyia.html');

const ICON_PATH = path.join(__dirname, 'icon.png');
const ICON_ICO = path.join(__dirname, 'icon.ico');

function getIcon() {
  if (fs.existsSync(ICON_PATH)) return ICON_PATH;
  if (fs.existsSync(ICON_ICO)) return ICON_ICO;
  return undefined;
}

function createWindow() {
  const icon = getIcon();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 360,
    minHeight: 600,
    title: APP_TITLE,
    icon: icon,
    autoHideMenuBar: true,
    backgroundColor: '#FAFAFA',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });

  // Hidden menu bar but keep keyboard shortcuts (Ctrl+R, Ctrl+= zoom, F12 devtools, etc.)
  const appMenu = Menu.buildFromTemplate([
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout sélectionner' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', label: 'Recharger (vider le cache)', accelerator: 'CmdOrCtrl+Shift+R' },
        { role: 'toggleDevTools', label: 'Outils développeur', accelerator: 'F12' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom 100%', accelerator: 'CmdOrCtrl+0' },
        { role: 'zoomIn', label: 'Agrandir', accelerator: 'CmdOrCtrl+=' },
        { role: 'zoomOut', label: 'Réduire', accelerator: 'CmdOrCtrl+-' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran', accelerator: 'F11' }
      ]
    }
  ]);
  Menu.setApplicationMenu(appMenu);

  mainWindow.loadFile(HTML_PATH);

  // Context menu (clic droit) — copier/coller + inspecter
  mainWindow.webContents.on('context-menu', (e, params) => {
    const items = [];
    if (params.editFlags.canCut) items.push({ role: 'cut', label: 'Couper' });
    if (params.editFlags.canCopy) items.push({ role: 'copy', label: 'Copier' });
    if (params.editFlags.canPaste) items.push({ role: 'paste', label: 'Coller' });
    if (items.length) items.push({ type: 'separator' });
    items.push({ role: 'selectAll', label: 'Tout sélectionner' });
    items.push({ type: 'separator' });
    items.push({ role: 'reload', label: 'Recharger', accelerator: 'Ctrl+R' });
    items.push({
      label: 'Inspecter l\'élément',
      click: () => mainWindow.webContents.inspectElement(params.x, params.y)
    });
    Menu.buildFromTemplate(items).popup();
  });

  mainWindow.once('ready-to-show', () => {
    if (!startHidden) {
      mainWindow.show();
      mainWindow.webContents.focus(); // garantit que le clavier cible bien la page (champs éditables)
    }
  });

  // Close button = hide to tray (don't quit)
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Open external links in default browser — whitelist domaines de confiance uniquement
  // (anti-hijack : si un jour un mail / contenu user injecte un lien malveillant, on bloque)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url);
    } else {
      console.warn('[Melyia] Blocked external URL not in whitelist:', url);
    }
    return { action: 'deny' };
  });
}

function createTray() {
  const icon = getIcon();
  if (!icon) {
    console.warn('No icon found for tray, skipping tray creation');
    return;
  }
  try {
    tray = new Tray(icon);
  } catch (e) {
    console.error('Tray creation failed:', e);
    return;
  }
  tray.setToolTip(TRAY_TOOLTIP);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '＋  Ajouter patient (capture auto)',
      accelerator: 'Ctrl+Shift+M',
      click: () => triggerAutoCapture('patient')
    },
    {
      label: '＋  Nouveau devis',
      accelerator: 'Ctrl+Shift+D',
      click: () => {
        showWindow();
        if (mainWindow) mainWindow.webContents.send('open-modal', 'devis');
      }
    },
    {
      label: '✨  Vulgariser un devis',
      accelerator: 'Ctrl+Shift+V',
      click: () => {
        showWindow();
        if (mainWindow) mainWindow.webContents.send('open-modal', 'vulgarize');
      }
    },
    { type: 'separator' },
    {
      label: 'Ouvrir Melyia',
      click: showWindow
    },
    {
      label: 'Vérifier les mises à jour',
      click: async () => {
        if (!app.isPackaged) {
          if (Notification.isSupported()) {
            new Notification({ title: 'Melyia', body: 'Auto-update désactivé en mode dev.', silent: true }).show();
          }
          return;
        }
        try {
          await autoUpdater.checkForUpdates();
        } catch (e) {
          console.warn('Manual update check failed:', e && e.message);
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', showWindow);
  tray.on('double-click', () => triggerAutoCapture('patient'));
}

function showWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.focus(); // bug Windows : sans ça, les champs restent non éditables au clavier
}

async function triggerAutoCapture(type = 'patient') {
  try {
    // 1. Hide Melyia window so it's not in the screenshot
    const wasVisible = mainWindow && mainWindow.isVisible();
    if (wasVisible) {
      mainWindow.hide();
    }

    // 2. Wait for the previously focused app (Logos) to come back
    await new Promise(r => setTimeout(r, 450));

    // 3. Grab the primary screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor || 1;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * scaleFactor),
        height: Math.round(height * scaleFactor)
      }
    });

    if (!sources || sources.length === 0) {
      throw new Error('Aucun écran détecté');
    }

    const primary = sources.find(s => s.display_id === String(primaryDisplay.id)) || sources[0];
    const dataURL = primary.thumbnail.toDataURL();

    // 4. Re-show window and send capture to renderer
    showWindow();
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auto-capture', { type, dataURL });
      }
    }, 250);
  } catch (err) {
    console.error('triggerAutoCapture failed:', err);
    showWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('capture-error', err.message);
    }
  }
}

// IPC handlers
ipcMain.handle('app-info', () => ({
  version: app.getVersion(),
  isElectron: true,
  isDev: IS_DEV,
  platform: process.platform
}));

ipcMain.handle('trigger-capture', (e, type) => triggerAutoCapture(type));
ipcMain.handle('show-window', () => showWindow());
ipcMain.handle('hide-to-tray', () => { if (mainWindow) mainWindow.hide(); });

// Extraction du texte d'un PDF (devis Logos) — lib pure JS, requise à la demande.
// On require le fichier lib directement pour éviter le code debug de l'index pdf-parse.
ipcMain.handle('extract-pdf-text', async (e, base64) => {
  try {
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const buf = Buffer.from(String(base64 || ''), 'base64');
    const data = await pdfParse(buf);
    return { ok: true, text: (data && data.text) || '' };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

// Auto-launch Windows
ipcMain.handle('get-auto-launch', () => {
  return app.getLoginItemSettings().openAtLogin;
});
ipcMain.handle('set-auto-launch', (e, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: !!enabled,
    openAsHidden: true,
    args: ['--hidden']
  });
  return app.getLoginItemSettings().openAtLogin;
});

// Notification système + tray tooltip dynamique
ipcMain.handle('notify-relances', (e, { count, names }) => {
  // Update tray tooltip
  if (tray) {
    const prefix = IS_DEV ? 'Melyia TEST' : 'Melyia';
    if (count > 0) {
      tray.setToolTip(`${prefix} · ${count} relance${count > 1 ? 's' : ''} à faire aujourd'hui`);
    } else {
      tray.setToolTip(TRAY_TOOLTIP);
    }
  }
  // Send Windows notification only if count > 0
  if (count > 0 && Notification.isSupported()) {
    const body = count === 1
      ? `1 patient à vérifier sur Doctolib${names && names[0] ? ' : ' + names[0] : ''}`
      : `${count} patients à vérifier sur Doctolib${names && names.length ? ' : ' + names.slice(0, 3).join(', ') + (names.length > 3 ? '...' : '') : ''}`;
    const notif = new Notification({
      title: 'Melyia — Relances à faire',
      body: body,
      silent: false,
      icon: getIcon()
    });
    notif.on('click', () => showWindow());
    notif.show();
  }
  return true;
});

// ============================================================
// AUTO-UPDATER (electron-updater + GitHub Releases)
// ============================================================
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
// Allow updates even if running on the same minor version (safe default off):
autoUpdater.allowPrerelease = false;

function sendUpdateStatus(status, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', Object.assign({ status }, data));
  }
}

autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'));
autoUpdater.on('update-available', (info) => sendUpdateStatus('available', { version: info && info.version }));
autoUpdater.on('update-not-available', (info) => sendUpdateStatus('not-available', { version: info && info.version }));
autoUpdater.on('error', (err) => sendUpdateStatus('error', { message: err && err.message ? err.message : String(err) }));
autoUpdater.on('download-progress', (p) => sendUpdateStatus('downloading', { percent: Math.round(p.percent || 0) }));
autoUpdater.on('update-downloaded', (info) => sendUpdateStatus('downloaded', { version: info && info.version }));

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { ok: false, reason: 'dev-mode', message: 'Auto-update désactivé en mode dev (lance la version installée)' };
  }
  try {
    const r = await autoUpdater.checkForUpdates();
    return { ok: true, version: r && r.updateInfo ? r.updateInfo.version : null };
  } catch (e) {
    return { ok: false, reason: 'error', message: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('install-update-now', () => {
  isQuitting = true;
  autoUpdater.quitAndInstall();
});

function scheduleUpdateCheck() {
  if (!app.isPackaged) return;
  // Initial check 8s after boot (let app settle, network ready)
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.warn('Update check failed:', err && err.message);
    });
  }, 8000);
  // Re-check every 4h
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);
}

// ============================================================
// GOOGLE OAUTH 2.0 (PKCE flow with loopback server)
// ============================================================
const OAUTH_PORT = 53682;
const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_PORT}/oauth-callback`;
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

async function googleSignIn({ clientId, clientSecret }) {
  return new Promise((resolve, reject) => {
    if (!clientId || !clientSecret) {
      return reject(new Error('Client ID et Client Secret requis (configure dans Réglages)'));
    }
    const { verifier, challenge } = generatePKCE();
    const state = crypto.randomBytes(16).toString('hex');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', OAUTH_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', OAUTH_SCOPES.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);

    let server = null;
    let authWindow = null;
    let cancelled = false;
    let timeoutHandle = null;

    const cleanup = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (server && server.listening) {
        try { server.close(); } catch (e) {}
      }
      if (authWindow && !authWindow.isDestroyed()) {
        try { authWindow.close(); } catch (e) {}
      }
    };

    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://localhost:${OAUTH_PORT}`);
        if (url.pathname !== '/oauth-callback') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        const returnedState = url.searchParams.get('state');

        const okHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Melyia</title>
<style>body{font-family:-apple-system,Segoe UI,sans-serif;text-align:center;padding:60px 20px;color:#0A0A0B;background:#FAFAFA}h1{color:#30D158;margin-bottom:8px}p{color:#8E8E93;font-size:15px}</style>
</head><body><h1>✓ Connexion réussie</h1><p>Tu peux fermer cette fenêtre et retourner sur Melyia.</p></body></html>`;
        const errHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Melyia</title>
<style>body{font-family:-apple-system,Segoe UI,sans-serif;text-align:center;padding:60px 20px;color:#0A0A0B;background:#FAFAFA}h1{color:#FF3B30;margin-bottom:8px}p{color:#8E8E93;font-size:15px}</style>
</head><body><h1>✗ Erreur</h1><p>${error || 'Erreur inconnue'}</p></body></html>`;

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(errHtml);
          cleanup();
          return reject(new Error(error));
        }
        if (returnedState !== state) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(errHtml);
          cleanup();
          return reject(new Error('State mismatch (CSRF protection)'));
        }
        if (!code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(errHtml);
          cleanup();
          return reject(new Error('Pas de code retourné'));
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(okHtml);

        // Exchange code for tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: OAUTH_REDIRECT_URI,
            grant_type: 'authorization_code',
            code_verifier: verifier
          }).toString()
        });
        const tokens = await tokenRes.json();
        if (tokens.error) {
          cleanup();
          return reject(new Error(tokens.error_description || tokens.error));
        }

        // Fetch user info
        try {
          const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': 'Bearer ' + tokens.access_token }
          });
          tokens.userinfo = await infoRes.json();
        } catch (e) { /* not critical */ }

        cleanup();
        resolve(tokens);
      } catch (e) {
        cleanup();
        reject(e);
      }
    });

    server.on('error', (e) => {
      cleanup();
      reject(e);
    });

    server.listen(OAUTH_PORT, '127.0.0.1', () => {
      authWindow = new BrowserWindow({
        width: 520,
        height: 720,
        title: 'Connexion Google — Melyia',
        autoHideMenuBar: true,
        backgroundColor: '#FAFAFA',
        parent: mainWindow,
        modal: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: 'persist:google-oauth-' + Date.now()
        }
      });
      authWindow.loadURL(authUrl.toString());
      authWindow.on('closed', () => {
        if (!cancelled && server && server.listening) {
          cancelled = true;
          cleanup();
          reject(new Error('Connexion annulée par l\'utilisateur'));
        }
      });
    });

    // 5 min timeout
    timeoutHandle = setTimeout(() => {
      cleanup();
      reject(new Error('Délai d\'authentification dépassé'));
    }, 300000);
  });
}

async function googleRefreshToken({ refreshToken, clientId, clientSecret }) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    }).toString()
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data;
}

ipcMain.handle('google-sign-in', (e, params) => googleSignIn(params));
ipcMain.handle('google-refresh-token', (e, params) => googleRefreshToken(params));

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();
  scheduleUpdateCheck();

  // Global hotkeys
  try {
    globalShortcut.register('Control+Shift+M', () => triggerAutoCapture('patient'));
    globalShortcut.register('Control+Shift+D', () => {
      showWindow();
      if (mainWindow) mainWindow.webContents.send('open-modal', 'devis');
    });
    globalShortcut.register('Control+Shift+V', () => {
      showWindow();
      if (mainWindow) mainWindow.webContents.send('open-modal', 'vulgarize');
    });
  } catch (e) {
    console.warn('Failed to register global shortcuts:', e);
  }
});

app.on('window-all-closed', () => {
  // Don't quit on Windows — keep running in tray
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
