const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { execFile, spawn } = require('child_process');
const AdmZip = require('adm-zip');
const { Client } = require('minecraft-launcher-core');

// Fix Windows Chromium disk/GPU cache lock errors ("Unable to move the cache: Accès refusé (0x5)")
// Preserve permanent userData path BEFORE redirecting volatile Chromium sessionData cache
const PERMANENT_USER_DATA_DIR = app.getPath('userData');
try {
  const volatileSessionDir = path.join(app.getPath('temp'), 'LuminaMC-Chromium-Session', `pid-${process.pid}`);
  fs.mkdirSync(volatileSessionDir, { recursive: true });
  app.setPath('sessionData', volatileSessionDir);
  app.commandLine.appendSwitch('disk-cache-dir', path.join(volatileSessionDir, 'http-cache'));
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  app.commandLine.appendSwitch('disable-gpu-program-cache');
  app.commandLine.appendSwitch('disable-http-cache');
  app.commandLine.appendSwitch('log-level', '3');
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.luminamc.launcher');
  }
} catch {}

let mainWindow = null;
const runningGames = new Map(); // instanceId -> childProcess

// Paths initialization
const getBaseDataDir = () => path.join(PERMANENT_USER_DATA_DIR, 'LuminaData');
const getConfigPath = () => path.join(getBaseDataDir(), 'config.json');
const getInstancesDir = () => path.join(getBaseDataDir(), 'instances');
const getSharedMcDir = () => path.join(getBaseDataDir(), 'minecraft_shared');
const getRuntimesDir = () => path.join(getBaseDataDir(), 'runtimes');
const getSkinsDir = () => path.join(getBaseDataDir(), 'skins');

// Default classic & slim base64 PNG skins (64x64 valid Minecraft skins generated programmatically if needed)
function createDefaultSkinDataUrl(primaryHex = '#6366f1', accentHex = '#22d3ee') {
  // We also provide official Mojang texture URLs or local PNGs
  return null;
}

const DEFAULT_STEVE_SKIN_URL = 'https://textures.minecraft.net/texture/31f477eb1a7beee631c2ca64d06f8f68fa93a3386d04452ab27f43acdf1b60cb';
const DEFAULT_ALEX_SKIN_URL = 'https://textures.minecraft.net/texture/67e1fd5b614b9b8b79f62f262231b9b1ef1b8197f26fb80401f2d0f6a0b7528c';

// Default CurseForge public launcher API key (user can override in settings)
const DEFAULT_CF_API_KEY = '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm';

function ensureDirectories() {
  [getBaseDataDir(), getInstancesDir(), getSharedMcDir(), getRuntimesDir(), getSkinsDir()].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function generateOfflineUUID(username) {
  const md5Bytes = crypto.createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest();
  md5Bytes[6] = (md5Bytes[6] & 0x0f) | 0x30; // Version 3
  md5Bytes[8] = (md5Bytes[8] & 0x3f) | 0x80; // Variant
  const hex = md5Bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function ensureInstanceFolders(instanceDir) {
  ['mods', 'shaderpacks', 'resourcepacks', 'datapacks', 'saves', 'screenshots', 'config'].forEach((sub) => {
    const p = path.join(instanceDir, sub);
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  });
}

function loadConfig() {
  ensureDirectories();
  const cfgPath = getConfigPath();
  if (!fs.existsSync(cfgPath)) {
    const defaultAccountId = 'offline-default';
    const initialConfig = {
      settings: {
        minRamMb: 2048,
        maxRamMb: 4096,
        width: 1280,
        height: 720,
        fullscreen: false,
        javaPath: '',
        jvmArgs: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC',
        curseforgeApiKey: '',
        closeLauncherOnPlay: false,
        concurrentDownloads: 6,
        themeAccent: 'indigo', // 'indigo' | 'cyan' | 'emerald' | 'rose' | 'violet'
        glassBlur: 24,
        backgroundStyle: 'aurora',
        dataPath: getBaseDataDir(),
      },
      accounts: [
        {
          id: defaultAccountId,
          type: 'offline',
          username: 'AetherPlayer',
          uuid: generateOfflineUUID('AetherPlayer'),
          skinUrl: DEFAULT_STEVE_SKIN_URL,
          skinVariant: 'classic',
          accessToken: '0',
          createdAt: new Date().toISOString(),
        },
      ],
      activeAccountId: defaultAccountId,
      wardrobe: [
        {
          id: 'skin-steve-classic',
          name: 'Explorer Indigo (Classic)',
          variant: 'classic',
          skinUrl: DEFAULT_STEVE_SKIN_URL,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'skin-alex-slim',
          name: 'Alex Slim',
          variant: 'slim',
          skinUrl: DEFAULT_ALEX_SKIN_URL,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    fs.writeFileSync(cfgPath, JSON.stringify(initialConfig, null, 2), 'utf8');
    seedDefaultInstances();
    return initialConfig;
  }
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (err) {
    console.error('Failed to read config.json:', err);
    return { settings: {}, accounts: [], activeAccountId: null, wardrobe: [] };
  }
}

function saveConfig(cfg) {
  ensureDirectories();
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf8');
}

function seedDefaultInstances() {
  const seeds = [
    {
      id: 'fabric-ultra-1-21-1',
      name: 'Sodium & Iris Shaders',
      mcVersion: '1.21.1',
      loader: 'fabric',
      loaderVersion: '0.16.10',
      icon: 'sparkles',
      accentColor: '#38bdf8',
      description: 'Instance optimisée Fabric 1.21.1 prête pour les Shaders, Sodium, Iris et packs de textures HD.',
      minRamMb: 2048,
      maxRamMb: 6144,
      jvmArgs: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
      width: 1280,
      height: 720,
      fullscreen: false,
      javaPath: '',
      playtimeMinutes: 142,
      lastPlayed: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      createdAt: new Date().toISOString(),
      installedMeta: {},
    },
    {
      id: 'neoforge-modded-1-21-1',
      name: 'NeoForge Modpack Survie+',
      mcVersion: '1.21.1',
      loader: 'neoforge',
      loaderVersion: '21.1.122',
      icon: 'flame',
      accentColor: '#f97316',
      description: 'Survie moddée sous NeoForge 1.21.1 pour gros mods techniques, dimensions et génération de monde.',
      minRamMb: 4096,
      maxRamMb: 8192,
      jvmArgs: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
      width: 1280,
      height: 720,
      fullscreen: false,
      javaPath: '',
      playtimeMinutes: 64,
      lastPlayed: new Date(Date.now() - 3600 * 1000 * 28).toISOString(),
      createdAt: new Date().toISOString(),
      installedMeta: {},
    },
    {
      id: 'vanilla-latest-1-21-4',
      name: 'Vanilla Pure 1.21.4',
      mcVersion: '1.21.4',
      loader: 'vanilla',
      loaderVersion: '',
      icon: 'cube',
      accentColor: '#10b981',
      description: 'Minecraft Vanilla officiel dernière version pour multijoueur et survie classique.',
      minRamMb: 2048,
      maxRamMb: 4096,
      jvmArgs: '-XX:+UseG1GC',
      width: 1280,
      height: 720,
      fullscreen: false,
      javaPath: '',
      playtimeMinutes: 18,
      lastPlayed: null,
      createdAt: new Date().toISOString(),
      installedMeta: {},
    },
  ];

  for (const inst of seeds) {
    const instDir = path.join(getInstancesDir(), inst.id);
    if (!fs.existsSync(instDir)) {
      fs.mkdirSync(instDir, { recursive: true });
      ensureInstanceFolders(instDir);
      fs.writeFileSync(path.join(instDir, 'instance.json'), JSON.stringify(inst, null, 2), 'utf8');
    }
  }
}

function getAllInstances() {
  ensureDirectories();
  const base = getInstancesDir();
  const entries = fs.readdirSync(base, { withFileTypes: true });
  const list = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const metaPath = path.join(base, entry.name, 'instance.json');
      if (fs.existsSync(metaPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          const instDir = path.join(base, entry.name);
          ensureInstanceFolders(instDir);
          // Count items in each folder
          const countFiles = (sub, exts) => {
            try {
              const p = path.join(instDir, sub);
              if (!fs.existsSync(p)) return 0;
              return fs.readdirSync(p).filter((f) => exts.some((e) => f.toLowerCase().endsWith(e))).length;
            } catch {
              return 0;
            }
          };
          data.counts = {
            mods: countFiles('mods', ['.jar', '.jar.disabled']),
            shaders: countFiles('shaderpacks', ['.zip', '.zip.disabled']),
            resourcepacks: countFiles('resourcepacks', ['.zip', '.zip.disabled']),
            datapacks: countFiles('datapacks', ['.zip', '.zip.disabled']),
            worlds: (() => {
              try {
                const sp = path.join(instDir, 'saves');
                return fs.existsSync(sp)
                  ? fs.readdirSync(sp, { withFileTypes: true }).filter((d) => d.isDirectory()).length
                  : 0;
              } catch {
                return 0;
              }
            })(),
            screenshots: countFiles('screenshots', ['.png', '.jpg', '.jpeg']),
          };
          data.path = instDir;
          data.isInstalled = checkInstanceReadyOnDisk(data);
          list.push(data);
        } catch (e) {
          console.error('Error reading instance.json in', entry.name, e);
        }
      }
    }
  }
  return list.sort((a, b) => {
    if (a.lastPlayed && b.lastPlayed) return new Date(b.lastPlayed) - new Date(a.lastPlayed);
    if (a.lastPlayed) return -1;
    if (b.lastPlayed) return 1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

function getInstanceSignature(inst) {
  return `${inst.mcVersion || '1.21.1'}:${inst.loader || 'vanilla'}:${inst.loaderVersion || ''}`;
}

function checkInstanceReadyOnDisk(inst) {
  if (!inst || !inst.installed) return false;
  if (inst.installedSignature && inst.installedSignature !== getInstanceSignature(inst)) {
    return false;
  }
  const sharedRoot = getSharedMcDir();
  const verJson = path.join(sharedRoot, 'versions', inst.mcVersion, `${inst.mcVersion}.json`);
  const verJar = path.join(sharedRoot, 'versions', inst.mcVersion, `${inst.mcVersion}.jar`);
  if (!fs.existsSync(verJson) || !fs.existsSync(verJar)) {
    return false;
  }
  if (inst.customVersionId) {
    const customJson = path.join(sharedRoot, 'versions', inst.customVersionId, `${inst.customVersionId}.json`);
    if (!fs.existsSync(customJson)) return false;
  }
  return true;
}

// Helper for HTTP/HTTPS JSON fetch with redirect support
function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const reqUrl = new URL(url);
    const lib = reqUrl.protocol === 'https:' ? https : http;
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'LuminaMC-Launcher/1.0.0 (contact@luminamc.app)',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = lib.request(reqUrl, reqOptions, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const nextUrl = new URL(res.headers.location, url).toString();
        return resolve(fetchJson(nextUrl, options));
      }
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(raw ? JSON.parse(raw) : {});
          } catch (e) {
            reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode} from ${url}: ${raw.slice(0, 250)}`));
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// Helper for downloading a file to disk with redirect & progress support
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const request = (currentUrl) => {
      const parsed = new URL(currentUrl);
      const lib = parsed.protocol === 'https:' ? https : http;
      lib
        .get(
          parsed,
          {
            headers: {
              'User-Agent': 'LuminaMC-Launcher/1.0.0 (contact@luminamc.app)',
            },
          },
          (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
              const redirectUrl = new URL(res.headers.location, currentUrl).toString();
              return request(redirectUrl);
            }
            if (res.statusCode < 200 || res.statusCode >= 300) {
              return reject(new Error(`Download failed with status ${res.statusCode} for ${currentUrl}`));
            }
            const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
            let downloadedBytes = 0;
            const fileStream = fs.createWriteStream(destPath);

            res.on('data', (chunk) => {
              downloadedBytes += chunk.length;
              if (onProgress && totalBytes > 0) {
                onProgress({
                  downloadedBytes,
                  totalBytes,
                  percent: Math.round((downloadedBytes / totalBytes) * 100),
                });
              }
            });

            res.pipe(fileStream);
            fileStream.on('finish', () => {
              fileStream.close(() => resolve(destPath));
            });
            fileStream.on('error', (err) => {
              fs.unlink(destPath, () => {});
              reject(err);
            });
          }
        )
        .on('error', reject);
    };

    request(url);
  });
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

// Create Main Electron Window
function createWindow() {
  ensureDirectories();
  loadConfig();

  const icoPath = path.join(__dirname, '..', 'assets', 'icon.ico');
  const pngPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const resolvedIcon = fs.existsSync(icoPath) ? icoPath : fs.existsSync(pngPath) ? pngPath : undefined;

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1060,
    minHeight: 700,
    frame: false,
    transparent: false,
    backgroundColor: '#07090e',
    titleBarStyle: 'hidden',
    icon: resolvedIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  const devServerUrl = 'http://localhost:5173';
  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');

  mainWindow.webContents.on('did-fail-load', () => {
    if (fs.existsSync(distIndex)) {
      mainWindow.loadFile(distIndex);
    }
  });

  if (process.env.LUMINA_DEV === '1') {
    mainWindow.loadURL(devServerUrl).catch(() => {
      if (fs.existsSync(distIndex)) {
        mainWindow.loadFile(distIndex);
      }
    });
  } else if (fs.existsSync(distIndex)) {
    mainWindow.loadFile(distIndex);
  } else {
    mainWindow.loadURL(devServerUrl);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ============================================================================
// IPC HANDLERS
// ============================================================================

// Window controls
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});
ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

// App initial state & settings
ipcMain.handle('app:getInitialData', async () => {
  const config = loadConfig();
  const instances = getAllInstances();
  return {
    config,
    instances,
    runningInstanceIds: Array.from(runningGames.keys()),
  };
});

ipcMain.handle('app:saveSettings', async (_e, newSettings) => {
  const cfg = loadConfig();
  cfg.settings = { ...cfg.settings, ...newSettings };
  saveConfig(cfg);
  return cfg.settings;
});

ipcMain.handle('app:openExternal', async (_e, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('app:openPath', async (_e, targetPath) => {
  if (fs.existsSync(targetPath)) {
    await shell.openPath(targetPath);
  }
});

ipcMain.handle('app:selectFile', async (_e, options = {}) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'Sélectionner un fichier',
    filters: options.filters || [{ name: 'Tous les fichiers', extensions: ['*'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

ipcMain.handle('app:selectDirectory', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Sélectionner un dossier',
    properties: ['openDirectory'],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

// ============================================================================
// AUTHENTICATION: MICROSOFT OAUTH + OFFLINE
// ============================================================================

ipcMain.handle('auth:loginOffline', async (_e, username) => {
  const cleanName = String(username || '').trim().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || 'Player';
  const uuid = generateOfflineUUID(cleanName);

  // Try to fetch real Mojang skin if premium username exists
  let skinUrl = DEFAULT_STEVE_SKIN_URL;
  let skinVariant = 'classic';
  try {
    const mojangUser = await fetchJson(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(cleanName)}`);
    if (mojangUser && mojangUser.id) {
      const profile = await fetchJson(`https://sessionserver.mojang.com/session/minecraft/profile/${mojangUser.id}`);
      const texProp = (profile.properties || []).find((p) => p.name === 'textures');
      if (texProp) {
        const decoded = JSON.parse(Buffer.from(texProp.value, 'base64').toString('utf8'));
        if (decoded?.textures?.SKIN?.url) {
          skinUrl = decoded.textures.SKIN.url;
          skinVariant = decoded.textures.SKIN?.metadata?.model === 'slim' ? 'slim' : 'classic';
        }
      }
    }
  } catch {
    // Ignore if username is not a registered Mojang account
  }

  const cfg = loadConfig();
  const existingIdx = cfg.accounts.findIndex(
    (a) => a.type === 'offline' && a.username.toLowerCase() === cleanName.toLowerCase()
  );

  const account = {
    id: existingIdx >= 0 ? cfg.accounts[existingIdx].id : `offline-${Date.now()}`,
    type: 'offline',
    username: cleanName,
    uuid,
    skinUrl,
    skinVariant,
    accessToken: '0',
    createdAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    cfg.accounts[existingIdx] = account;
  } else {
    cfg.accounts.push(account);
  }
  cfg.activeAccountId = account.id;
  saveConfig(cfg);
  return { accounts: cfg.accounts, activeAccountId: cfg.activeAccountId, account };
});

ipcMain.handle('auth:loginMicrosoft', async () => {
  return new Promise((resolve, reject) => {
    const clientId = '00000000402b5328'; // Official Minecraft Xbox Live Client ID
    const redirectUri = 'https://login.live.com/oauth20_desktop.srf';
    const authUrl =
      `https://login.live.com/oauth20_authorize.srf` +
      `?client_id=${clientId}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('service::user.auth.xboxlive.com::MBI_SSL')}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&prompt=select_account`;

    const authWin = new BrowserWindow({
      width: 520,
      height: 680,
      parent: mainWindow,
      modal: true,
      title: 'Connexion Compte Microsoft — Minecraft',
      backgroundColor: '#0f172a',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    authWin.setMenuBarVisibility(false);
    let resolved = false;

    const handleRedirect = async (urlStr) => {
      if (resolved) return;
      if (!urlStr.startsWith(redirectUri)) return;

      const parsed = new URL(urlStr);
      const code = parsed.searchParams.get('code');
      const error = parsed.searchParams.get('error');

      if (error || !code) {
        resolved = true;
        authWin.close();
        return reject(new Error(error || 'Connexion Microsoft annulée.'));
      }

      resolved = true;
      authWin.close();

      try {
        // 1. Exchange code for MS Live token
        const tokenBody = new URLSearchParams({
          client_id: clientId,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          scope: 'service::user.auth.xboxlive.com::MBI_SSL',
        }).toString();

        const liveToken = await fetchJson('https://login.live.com/oauth20_token.srf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenBody,
        });

        // 2. Authenticate with Xbox Live
        const xblRes = await fetchJson('https://user.auth.xboxlive.com/user/authenticate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: {
            Properties: {
              AuthMethod: 'RPS',
              SiteName: 'user.auth.xboxlive.com',
              RpsTicket: liveToken.access_token,
            },
            RelyingParty: 'http://auth.xboxlive.com',
            TokenType: 'JWT',
          },
        });

        const xblToken = xblRes.Token;
        const userHash = xblRes.DisplayClaims.xui[0].uhs;

        // 3. Obtain XSTS Token for Minecraft Services
        const xstsRes = await fetchJson('https://xsts.auth.xboxlive.com/xsts/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: {
            Properties: {
              SandboxId: 'RETAIL',
              UserTokens: [xblToken],
            },
            RelyingParty: 'rp://api.minecraftservices.com/',
            TokenType: 'JWT',
          },
        });

        const xstsToken = xstsRes.Token;

        // 4. Authenticate with Minecraft Services
        const mcAuth = await fetchJson('https://api.minecraftservices.com/authentication/login_with_xbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {
            identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
          },
        });

        const mcAccessToken = mcAuth.access_token;

        // 5. Fetch Minecraft Profile (UUID, Username, Skins)
        const mcProfile = await fetchJson('https://api.minecraftservices.com/minecraft/profile', {
          headers: {
            Authorization: `Bearer ${mcAccessToken}`,
          },
        });

        if (!mcProfile || !mcProfile.id) {
          throw new Error('Ce compte Microsoft ne possède pas de profil Minecraft Java Edition actif.');
        }

        const formattedUuid = mcProfile.id.replace(
          /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
          '$1-$2-$3-$4-$5'
        );

        const activeSkin = (mcProfile.skins || []).find((s) => s.state === 'ACTIVE') || mcProfile.skins?.[0];

        const cfg = loadConfig();
        const account = {
          id: `ms-${formattedUuid}`,
          type: 'microsoft',
          username: mcProfile.name,
          uuid: formattedUuid,
          skinUrl: activeSkin?.url || DEFAULT_STEVE_SKIN_URL,
          skinVariant: activeSkin?.variant?.toLowerCase() === 'slim' ? 'slim' : 'classic',
          accessToken: mcAccessToken,
          refreshToken: liveToken.refresh_token,
          createdAt: new Date().toISOString(),
        };

        const existingIdx = cfg.accounts.findIndex((a) => a.id === account.id);
        if (existingIdx >= 0) cfg.accounts[existingIdx] = account;
        else cfg.accounts.push(account);
        cfg.activeAccountId = account.id;
        saveConfig(cfg);

        resolve({ accounts: cfg.accounts, activeAccountId: cfg.activeAccountId, account });
      } catch (err) {
        reject(err);
      }
    };

    authWin.webContents.on('will-redirect', (_e, url) => handleRedirect(url));
    authWin.webContents.on('did-navigate', (_e, url) => handleRedirect(url));
    authWin.on('closed', () => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Fenêtre de connexion Microsoft fermée.'));
      }
    });

    authWin.loadURL(authUrl);
  });
});

ipcMain.handle('auth:setActiveAccount', async (_e, accountId) => {
  const cfg = loadConfig();
  if (cfg.accounts.some((a) => a.id === accountId)) {
    cfg.activeAccountId = accountId;
    saveConfig(cfg);
  }
  return { accounts: cfg.accounts, activeAccountId: cfg.activeAccountId };
});

ipcMain.handle('auth:removeAccount', async (_e, accountId) => {
  const cfg = loadConfig();
  cfg.accounts = cfg.accounts.filter((a) => a.id !== accountId);
  if (cfg.activeAccountId === accountId) {
    cfg.activeAccountId = cfg.accounts[0]?.id || null;
  }
  saveConfig(cfg);
  return { accounts: cfg.accounts, activeAccountId: cfg.activeAccountId };
});

// ============================================================================
// SKIN WARDROBE & 3D SKIN MANAGEMENT
// ============================================================================

ipcMain.handle('skin:fetchPlayerSkin', async (_e, username) => {
  const clean = String(username || '').trim();
  if (!clean) throw new Error('Veuillez entrer un pseudo Minecraft.');
  const user = await fetchJson(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(clean)}`);
  if (!user || !user.id) throw new Error(`Joueur "${clean}" introuvable sur Mojang.`);

  const profile = await fetchJson(`https://sessionserver.mojang.com/session/minecraft/profile/${user.id}`);
  const texProp = (profile.properties || []).find((p) => p.name === 'textures');
  if (!texProp) throw new Error('Aucune texture trouvée pour ce joueur.');

  const decoded = JSON.parse(Buffer.from(texProp.value, 'base64').toString('utf8'));
  const skinUrl = decoded?.textures?.SKIN?.url || DEFAULT_STEVE_SKIN_URL;
  const capeUrl = decoded?.textures?.CAPE?.url || null;
  const variant = decoded?.textures?.SKIN?.metadata?.model === 'slim' ? 'slim' : 'classic';

  return {
    username: user.name,
    uuid: user.id,
    skinUrl,
    capeUrl,
    variant,
  };
});

ipcMain.handle('skin:importSkinFile', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Importer un Skin Minecraft (.png)',
    filters: [{ name: 'Skin Minecraft PNG', extensions: ['png'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths.length) return null;
  const filePath = res.filePaths[0];
  const fileName = `skin-${Date.now()}-${path.basename(filePath)}`;
  const destPath = path.join(getSkinsDir(), fileName);
  fs.copyFileSync(filePath, destPath);
  const base64 = fs.readFileSync(destPath).toString('base64');
  return {
    name: path.basename(filePath, '.png'),
    skinUrl: `data:image/png;base64,${base64}`,
    localPath: destPath,
  };
});

ipcMain.handle('skin:saveToWardrobe', async (_e, skinEntry) => {
  const cfg = loadConfig();
  const newItem = {
    id: `skin-${Date.now()}`,
    name: skinEntry.name || 'Skin Personnalisé',
    variant: skinEntry.variant || 'classic',
    skinUrl: skinEntry.skinUrl,
    capeUrl: skinEntry.capeUrl || null,
    createdAt: new Date().toISOString(),
  };
  cfg.wardrobe = [newItem, ...(cfg.wardrobe || [])];
  saveConfig(cfg);
  return cfg.wardrobe;
});

ipcMain.handle('skin:deleteFromWardrobe', async (_e, skinId) => {
  const cfg = loadConfig();
  cfg.wardrobe = (cfg.wardrobe || []).filter((s) => s.id !== skinId);
  saveConfig(cfg);
  return cfg.wardrobe;
});

ipcMain.handle('skin:applySkin', async (_e, { skinUrl, variant }) => {
  const cfg = loadConfig();
  const activeAcc = cfg.accounts.find((a) => a.id === cfg.activeAccountId);
  if (!activeAcc) throw new Error('Aucun compte actif sélectionné.');

  activeAcc.skinUrl = skinUrl;
  activeAcc.skinVariant = variant || 'classic';

  // If Microsoft account and remote URL, try uploading to official Minecraft API
  if (activeAcc.type === 'microsoft' && activeAcc.accessToken && skinUrl.startsWith('http')) {
    try {
      await fetchJson('https://api.minecraftservices.com/minecraft/profile/skins', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeAcc.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: {
          variant: variant === 'slim' ? 'slim' : 'classic',
          url: skinUrl,
        },
      });
    } catch (err) {
      console.warn('Could not sync skin to Mojang API (applied locally):', err.message);
    }
  }

  saveConfig(cfg);
  return { accounts: cfg.accounts, activeAccountId: cfg.activeAccountId };
});

// ============================================================================
// MINECRAFT & LOADER VERSIONS CATALOG
// ============================================================================

let cachedMcVersions = null;

ipcMain.handle('mc:getVersions', async () => {
  if (cachedMcVersions) return cachedMcVersions;
  try {
    const manifest = await fetchJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
    cachedMcVersions = {
      latest: manifest.latest,
      versions: (manifest.versions || []).map((v) => ({
        id: v.id,
        type: v.type, // 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
        releaseTime: v.releaseTime,
        url: v.url,
      })),
    };
    return cachedMcVersions;
  } catch (err) {
    console.error('Fallback versions list due to network error:', err.message);
    return {
      latest: { release: '1.21.4', snapshot: '25w06a' },
      versions: [
        { id: '1.21.4', type: 'release' },
        { id: '1.21.3', type: 'release' },
        { id: '1.21.1', type: 'release' },
        { id: '1.21', type: 'release' },
        { id: '1.20.6', type: 'release' },
        { id: '1.20.4', type: 'release' },
        { id: '1.20.1', type: 'release' },
        { id: '1.19.4', type: 'release' },
        { id: '1.19.2', type: 'release' },
        { id: '1.18.2', type: 'release' },
        { id: '1.16.5', type: 'release' },
        { id: '1.12.2', type: 'release' },
        { id: '1.8.9', type: 'release' },
      ],
    };
  }
});

ipcMain.handle('mc:getLoaderVersions', async (_e, mcVersion, loader) => {
  if (!loader || loader === 'vanilla') return [];
  try {
    if (loader === 'fabric') {
      const data = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(mcVersion)}`);
      return (data || []).map((entry) => ({
        version: entry.loader.version,
        stable: entry.loader.stable,
      }));
    }
    if (loader === 'quilt') {
      const data = await fetchJson(`https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(mcVersion)}`);
      return (data || []).map((entry) => ({
        version: entry.loader.version,
        stable: !entry.loader.version.includes('beta'),
      }));
    }
    if (loader === 'neoforge') {
      const data = await fetchJson(
        'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'
      );
      // NeoForge versioning: e.g. MC 1.21.1 -> prefix "21.1.", MC 1.20.4 -> "20.4."
      const parts = mcVersion.split('.');
      const prefix = parts.length >= 2 ? `${parts[1]}.${parts[2] || '0'}.` : '';
      const allVers = (data.versions || []).reverse();
      const filtered = prefix ? allVers.filter((v) => v.startsWith(prefix)) : allVers.slice(0, 25);
      return (filtered.length ? filtered : allVers.slice(0, 15)).map((v) => ({
        version: v,
        stable: !v.includes('beta'),
      }));
    }
    if (loader === 'forge') {
      const promos = await fetchJson(
        'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
      );
      const p = promos.promos || {};
      const rec = p[`${mcVersion}-recommended`];
      const lat = p[`${mcVersion}-latest`];
      const list = [];
      if (rec) list.push({ version: rec, stable: true });
      if (lat && lat !== rec) list.push({ version: lat, stable: false });
      if (!list.length) list.push({ version: 'latest', stable: true });
      return list;
    }
  } catch (err) {
    console.warn(`Failed to fetch loader versions for ${loader} ${mcVersion}:`, err.message);
  }
  return [{ version: 'latest', stable: true }];
});

// ============================================================================
// INSTANCES CRUD & CONTENT MANAGEMENT
// ============================================================================

ipcMain.handle('instance:create', async (_e, data) => {
  const slug =
    (data.name || 'instance')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    Date.now().toString().slice(-4);

  const instDir = path.join(getInstancesDir(), slug);
  fs.mkdirSync(instDir, { recursive: true });
  ensureInstanceFolders(instDir);

  const cfg = loadConfig();
  const instance = {
    id: slug,
    name: data.name || 'Nouvelle Instance',
    mcVersion: data.mcVersion || '1.21.1',
    loader: data.loader || 'fabric',
    loaderVersion: data.loaderVersion || '',
    icon: data.icon || 'sparkles',
    accentColor: data.accentColor || '#6366f1',
    description: data.description || `Instance ${data.loader || 'Vanilla'} ${data.mcVersion || '1.21.1'}`,
    minRamMb: data.minRamMb || cfg.settings.minRamMb || 2048,
    maxRamMb: data.maxRamMb || cfg.settings.maxRamMb || 4096,
    jvmArgs: data.jvmArgs ?? cfg.settings.jvmArgs ?? '-XX:+UseG1GC',
    width: data.width || cfg.settings.width || 1280,
    height: data.height || cfg.settings.height || 720,
    fullscreen: Boolean(data.fullscreen),
    javaPath: data.javaPath || '',
    playtimeMinutes: 0,
    lastPlayed: null,
    createdAt: new Date().toISOString(),
    installedMeta: {},
  };

  fs.writeFileSync(path.join(instDir, 'instance.json'), JSON.stringify(instance, null, 2), 'utf8');
  return getAllInstances();
});

ipcMain.handle('instance:update', async (_e, instanceId, updates) => {
  const instDir = path.join(getInstancesDir(), instanceId);
  const metaPath = path.join(instDir, 'instance.json');
  if (!fs.existsSync(metaPath)) throw new Error('Instance introuvable.');
  const current = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const updated = { ...current, ...updates, id: instanceId };
  fs.writeFileSync(metaPath, JSON.stringify(updated, null, 2), 'utf8');
  return getAllInstances();
});

ipcMain.handle('instance:delete', async (_e, instanceId) => {
  const instDir = path.join(getInstancesDir(), instanceId);
  if (fs.existsSync(instDir)) {
    fs.rmSync(instDir, { recursive: true, force: true });
  }
  return getAllInstances();
});

ipcMain.handle('instance:duplicate', async (_e, instanceId) => {
  const srcDir = path.join(getInstancesDir(), instanceId);
  const metaPath = path.join(srcDir, 'instance.json');
  if (!fs.existsSync(metaPath)) throw new Error('Instance source introuvable.');

  const srcMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const newId = `${instanceId}-copy-${Date.now().toString().slice(-4)}`;
  const destDir = path.join(getInstancesDir(), newId);

  fs.cpSync(srcDir, destDir, { recursive: true });
  const newMeta = {
    ...srcMeta,
    id: newId,
    name: `${srcMeta.name} (Copie)`,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(destDir, 'instance.json'), JSON.stringify(newMeta, null, 2), 'utf8');
  return getAllInstances();
});

ipcMain.handle('instance:openFolder', async (_e, instanceId, subFolder) => {
  const base = path.join(getInstancesDir(), instanceId);
  const target = subFolder ? path.join(base, subFolder) : base;
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  await shell.openPath(target);
});

ipcMain.handle('instance:getContent', async (_e, instanceId) => {
  const instDir = path.join(getInstancesDir(), instanceId);
  const metaPath = path.join(instDir, 'instance.json');
  if (!fs.existsSync(metaPath)) throw new Error('Instance introuvable.');
  ensureInstanceFolders(instDir);

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const installedMeta = meta.installedMeta || {};

  const readFolderItems = (folderName, allowedExts) => {
    const dirPath = path.join(instDir, folderName);
    if (!fs.existsSync(dirPath)) return [];
    const files = fs.readdirSync(dirPath);
    return files
      .filter((f) => allowedExts.some((ext) => f.toLowerCase().endsWith(ext)))
      .map((fileName) => {
        const fullPath = path.join(dirPath, fileName);
        const stat = fs.statSync(fullPath);
        const isDisabled = fileName.endsWith('.disabled');
        const cleanFileName = isDisabled ? fileName.replace(/\.disabled$/, '') : fileName;
        const itemMeta = installedMeta[cleanFileName] || {};
        return {
          fileName,
          cleanFileName,
          enabled: !isDisabled,
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          title: itemMeta.title || cleanFileName.replace(/\.(jar|zip)$/i, ''),
          author: itemMeta.author || 'Fichier local',
          version: itemMeta.version || '',
          iconUrl: itemMeta.iconUrl || null,
          source: itemMeta.source || 'local',
          projectId: itemMeta.projectId || null,
        };
      });
  };

  // Worlds (saves)
  const savesDir = path.join(instDir, 'saves');
  const worlds = [];
  if (fs.existsSync(savesDir)) {
    for (const d of fs.readdirSync(savesDir, { withFileTypes: true })) {
      if (d.isDirectory()) {
        const wPath = path.join(savesDir, d.name);
        const stat = fs.statSync(wPath);
        const dpDir = path.join(wPath, 'datapacks');
        const dpCount = fs.existsSync(dpDir) ? fs.readdirSync(dpDir).length : 0;
        let iconDataUrl = null;
        const iconPath = path.join(wPath, 'icon.png');
        if (fs.existsSync(iconPath)) {
          try {
            iconDataUrl = `data:image/png;base64,${fs.readFileSync(iconPath).toString('base64')}`;
          } catch {}
        }
        worlds.push({
          name: d.name,
          path: wPath,
          modifiedAt: stat.mtime.toISOString(),
          datapacksCount: dpCount,
          iconDataUrl,
        });
      }
    }
  }

  // Screenshots
  const shotsDir = path.join(instDir, 'screenshots');
  const screenshots = [];
  if (fs.existsSync(shotsDir)) {
    const files = fs
      .readdirSync(shotsDir)
      .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
      .slice(0, 30);
    for (const f of files) {
      const p = path.join(shotsDir, f);
      try {
        const stat = fs.statSync(p);
        const base64 = fs.readFileSync(p).toString('base64');
        screenshots.push({
          fileName: f,
          path: p,
          createdAt: stat.mtime.toISOString(),
          dataUrl: `data:image/png;base64,${base64}`,
        });
      } catch {}
    }
  }

  return {
    mods: readFolderItems('mods', ['.jar', '.jar.disabled']),
    shaderpacks: readFolderItems('shaderpacks', ['.zip', '.zip.disabled']),
    resourcepacks: readFolderItems('resourcepacks', ['.zip', '.zip.disabled']),
    datapacks: readFolderItems('datapacks', ['.zip', '.zip.disabled']),
    worlds,
    screenshots,
  };
});

ipcMain.handle('instance:toggleContent', async (_e, instanceId, folderType, fileName) => {
  const dirPath = path.join(getInstancesDir(), instanceId, folderType);
  const oldPath = path.join(dirPath, fileName);
  if (!fs.existsSync(oldPath)) throw new Error('Fichier introuvable.');

  const isDisabled = fileName.endsWith('.disabled');
  const newFileName = isDisabled ? fileName.replace(/\.disabled$/, '') : `${fileName}.disabled`;
  const newPath = path.join(dirPath, newFileName);
  fs.renameSync(oldPath, newPath);
  return true;
});

ipcMain.handle('instance:deleteContent', async (_e, instanceId, folderType, fileName) => {
  const targetPath = path.join(getInstancesDir(), instanceId, folderType, fileName);
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
  return true;
});

ipcMain.handle('instance:importLocalContent', async (_e, instanceId, folderType) => {
  const isMod = folderType === 'mods';
  const res = await dialog.showOpenDialog(mainWindow, {
    title: `Importer dans ${folderType}`,
    filters: [
      {
        name: isMod ? 'Mods Minecraft (.jar)' : 'Packs Minecraft (.zip)',
        extensions: isMod ? ['jar'] : ['zip'],
      },
    ],
    properties: ['openFile', 'multiSelections'],
  });
  if (res.canceled || !res.filePaths.length) return false;

  const targetDir = path.join(getInstancesDir(), instanceId, folderType);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  for (const src of res.filePaths) {
    const dest = path.join(targetDir, path.basename(src));
    fs.copyFileSync(src, dest);
  }
  return true;
});

// ============================================================================
// MODRINTH & CURSEFORGE SEARCH & 1-CLICK INSTALLER
// ============================================================================

// Map projectType ('mod' | 'shader' | 'resourcepack' | 'datapack' | 'modpack') to CurseForge classId
const CF_CLASS_IDS = {
  mod: 6,
  shader: 6552,
  resourcepack: 12,
  datapack: 6945,
  modpack: 4471,
};

const CF_MODLOADER_TYPE = {
  forge: 1,
  fabric: 4,
  quilt: 5,
  neoforge: 6,
};

ipcMain.handle('catalog:search', async (_e, params) => {
  const {
    provider = 'modrinth', // 'modrinth' | 'curseforge'
    projectType = 'mod', // 'mod' | 'shader' | 'resourcepack' | 'datapack' | 'modpack'
    query = '',
    mcVersion = '',
    loader = '',
    sort = 'downloads', // 'relevance' | 'downloads' | 'updated' | 'newest'
    offset = 0,
    limit = 24,
  } = params;

  if (provider === 'curseforge') {
    const cfg = loadConfig();
    const apiKey = (cfg.settings.curseforgeApiKey || '').trim() || DEFAULT_CF_API_KEY;
    const classId = CF_CLASS_IDS[projectType] || 6;

    const sortMap = {
      relevance: 1, // Featured
      downloads: 6, // TotalDownloads
      updated: 3, // LastUpdated
      newest: 11, // ReleasedDate
    };

    const qParams = new URLSearchParams({
      gameId: '432',
      classId: String(classId),
      searchFilter: query,
      sortField: String(sortMap[sort] || 6),
      sortOrder: 'desc',
      index: String(offset),
      pageSize: String(limit),
    });

    if (mcVersion) qParams.set('gameVersion', mcVersion);
    if (projectType === 'mod' || projectType === 'modpack') {
      if (loader && CF_MODLOADER_TYPE[loader]) {
        qParams.set('modLoaderType', String(CF_MODLOADER_TYPE[loader]));
      }
    }

    try {
      const cfRes = await fetchJson(`https://api.curseforge.com/v1/mods/search?${qParams.toString()}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      const hits = (cfRes.data || []).map((item) => ({
        id: String(item.id),
        slug: item.slug,
        provider: 'curseforge',
        projectType,
        title: item.name,
        description: item.summary,
        author: item.authors?.[0]?.name || 'CurseForge Creator',
        downloads: item.downloadCount || 0,
        follows: item.thumbsUpCount || 0,
        iconUrl: item.logo?.thumbnailUrl || item.logo?.url || null,
        categories: (item.categories || []).map((c) => c.name).slice(0, 4),
        updatedAt: item.dateModified,
        websiteUrl: item.links?.websiteUrl || `https://www.curseforge.com/minecraft`,
        latestFiles: item.latestFiles || [],
      }));

      return {
        provider: 'curseforge',
        hits,
        totalHits: cfRes.pagination?.totalCount || hits.length,
      };
    } catch (cfErr) {
      console.warn('CurseForge API direct call failed, falling back to Modrinth mirror with CF badge:', cfErr.message);
      // Fallback so the user never gets stuck if CF rate-limits or rejects the key
      const mrFallback = await searchModrinth({ projectType, query, mcVersion, loader, sort, offset, limit });
      return {
        provider: 'curseforge',
        fallbackNotice:
          'Mode miroir CurseForge actif (vous pouvez renseigner votre clé API CurseForge personnelle dans Paramètres).',
        hits: mrFallback.hits.map((h) => ({ ...h, provider: 'modrinth' })),
        totalHits: mrFallback.totalHits,
      };
    }
  }

  return await searchModrinth({ projectType, query, mcVersion, loader, sort, offset, limit });
});

async function searchModrinth({ projectType, query, mcVersion, loader, sort, offset, limit }) {
  const facets = [[`project_type:${projectType}`]];
  if (mcVersion) {
    facets.push([`versions:${mcVersion}`]);
  }
  if ((projectType === 'mod' || projectType === 'modpack') && loader && loader !== 'vanilla') {
    facets.push([`categories:${loader}`]);
  }

  const qParams = new URLSearchParams({
    query: query || '',
    facets: JSON.stringify(facets),
    index: sort || 'downloads',
    offset: String(offset || 0),
    limit: String(limit || 24),
  });

  const data = await fetchJson(`https://api.modrinth.com/v2/search?${qParams.toString()}`);
  const hits = (data.hits || []).map((h) => ({
    id: h.project_id,
    slug: h.slug,
    provider: 'modrinth',
    projectType: h.project_type || projectType,
    title: h.title,
    description: h.description,
    author: h.author || 'Modrinth Creator',
    downloads: h.downloads || 0,
    follows: h.follows || 0,
    iconUrl: h.icon_url || null,
    categories: (h.display_categories || h.categories || []).slice(0, 4),
    updatedAt: h.date_modified,
    websiteUrl: `https://modrinth.com/${h.project_type || projectType}/${h.slug}`,
  }));

  return {
    provider: 'modrinth',
    hits,
    totalHits: data.total_hits || hits.length,
  };
}

// Install an item (Mod, Shader, ResourcePack, DataPack, or full Modpack!) into an instance
ipcMain.handle('catalog:install', async (_e, params) => {
  const { item, instanceId } = params;
  const projectType = item.projectType || 'mod';

  // Special case: Modpack creates a new Instance and downloads all files in modrinth.index.json!
  if (projectType === 'modpack') {
    return await installCatalogModpack(item);
  }

  if (!instanceId) {
    throw new Error('Veuillez sélectionner une instance cible pour installer ce contenu.');
  }

  const instDir = path.join(getInstancesDir(), instanceId);
  const metaPath = path.join(instDir, 'instance.json');
  if (!fs.existsSync(metaPath)) throw new Error('Instance introuvable.');
  const instance = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  const folderMap = {
    mod: 'mods',
    shader: 'shaderpacks',
    resourcepack: 'resourcepacks',
    datapack: 'datapacks',
  };
  const targetFolder = folderMap[projectType] || 'mods';
  const destDir = path.join(instDir, targetFolder);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  let downloadUrl = null;
  let fileName = null;
  let versionNumber = '';

  if (item.provider === 'curseforge') {
    const cfg = loadConfig();
    const apiKey = (cfg.settings.curseforgeApiKey || '').trim() || DEFAULT_CF_API_KEY;
    const filesRes = await fetchJson(
      `https://api.curseforge.com/v1/mods/${item.id}/files?gameVersion=${encodeURIComponent(instance.mcVersion)}`,
      { headers: { 'x-api-key': apiKey } }
    );
    let chosen = (filesRes.data || [])[0];
    if (!chosen && item.latestFiles?.length) {
      chosen = item.latestFiles[0];
    }
    if (!chosen) throw new Error(' aucun fichier compatible trouvé sur CurseForge pour cette version.');
    fileName = chosen.fileName;
    versionNumber = chosen.displayName || chosen.fileName;
    downloadUrl =
      chosen.downloadUrl ||
      `https://edge.forgecdn.net/files/${String(chosen.id).slice(0, 4)}/${Number(String(chosen.id).slice(4))}/${encodeURIComponent(chosen.fileName)}`;
  } else {
    // Modrinth version resolution
    const vUrl = new URL(`https://api.modrinth.com/v2/project/${encodeURIComponent(item.id)}/version`);
    if (instance.mcVersion) {
      vUrl.searchParams.set('game_versions', JSON.stringify([instance.mcVersion]));
    }
    if (projectType === 'mod' && instance.loader && instance.loader !== 'vanilla') {
      vUrl.searchParams.set('loaders', JSON.stringify([instance.loader]));
    }

    let versions = await fetchJson(vUrl.toString());
    if (!versions || !versions.length) {
      // Fallback without strict loader/version filter if shader/resourcepack or multi-version compatible
      versions = await fetchJson(`https://api.modrinth.com/v2/project/${encodeURIComponent(item.id)}/version`);
    }
    if (!versions || !versions.length) {
      throw new Error(`Aucune version téléchargeable trouvée pour ${item.title}.`);
    }

    const chosenVer = versions[0];
    const primaryFile = (chosenVer.files || []).find((f) => f.primary) || chosenVer.files?.[0];
    if (!primaryFile) throw new Error('Fichier introuvable dans la version Modrinth.');
    downloadUrl = primaryFile.url;
    fileName = primaryFile.filename;
    versionNumber = chosenVer.version_number || chosenVer.name || '';
  }

  const destFilePath = path.join(destDir, fileName);

  sendToRenderer('catalog:progress', {
    projectId: item.id,
    title: item.title,
    status: 'downloading',
    percent: 0,
  });

  await downloadFile(downloadUrl, destFilePath, (prog) => {
    sendToRenderer('catalog:progress', {
      projectId: item.id,
      title: item.title,
      status: 'downloading',
      percent: prog.percent,
    });
  });

  // If it's a datapack and the instance has worlds in saves/, also copy to worlds' datapacks folders
  if (projectType === 'datapack') {
    const savesDir = path.join(instDir, 'saves');
    if (fs.existsSync(savesDir)) {
      for (const d of fs.readdirSync(savesDir, { withFileTypes: true })) {
        if (d.isDirectory()) {
          const wDp = path.join(savesDir, d.name, 'datapacks');
          fs.mkdirSync(wDp, { recursive: true });
          fs.copyFileSync(destFilePath, path.join(wDp, fileName));
        }
      }
    }
  }

  // Record rich metadata in instance.json
  instance.installedMeta = instance.installedMeta || {};
  instance.installedMeta[fileName] = {
    title: item.title,
    author: item.author,
    version: versionNumber,
    iconUrl: item.iconUrl,
    source: item.provider,
    projectId: item.id,
    installedAt: new Date().toISOString(),
  };
  fs.writeFileSync(metaPath, JSON.stringify(instance, null, 2), 'utf8');

  sendToRenderer('catalog:progress', {
    projectId: item.id,
    title: item.title,
    status: 'completed',
    percent: 100,
  });

  return {
    fileName,
    targetFolder,
    instances: getAllInstances(),
  };
});

async function installCatalogModpack(item) {
  sendToRenderer('catalog:progress', {
    projectId: item.id,
    title: item.title,
    status: 'downloading',
    percent: 5,
    message: 'Récupération du Modpack...',
  });

  const versions = await fetchJson(`https://api.modrinth.com/v2/project/${encodeURIComponent(item.id)}/version`);
  if (!versions || !versions.length) throw new Error('Aucune version trouvée pour ce modpack.');

  const latest = versions[0];
  const primaryFile = (latest.files || []).find((f) => f.primary) || latest.files?.[0];
  if (!primaryFile) throw new Error('Archive .mrpack introuvable.');

  const tempPackPath = path.join(getBaseDataDir(), `temp-${Date.now()}.mrpack`);
  await downloadFile(primaryFile.url, tempPackPath, (prog) => {
    sendToRenderer('catalog:progress', {
      projectId: item.id,
      title: item.title,
      status: 'downloading',
      percent: Math.min(30, Math.round(prog.percent * 0.3)),
      message: 'Téléchargement de l’archive .mrpack...',
    });
  });

  const result = await extractAndCreateModpackInstance(tempPackPath, item);
  try {
    fs.unlinkSync(tempPackPath);
  } catch {}

  sendToRenderer('catalog:progress', {
    projectId: item.id,
    title: item.title,
    status: 'completed',
    percent: 100,
    message: 'Modpack installé avec succès !',
  });

  return result;
}

async function extractAndCreateModpackInstance(archivePath, catalogItem = null) {
  const zip = new AdmZip(archivePath);
  const indexEntry = zip.getEntry('modrinth.index.json');

  if (!indexEntry) {
    throw new Error('Archive Modpack non reconnue (modrinth.index.json manquant).');
  }

  const indexData = JSON.parse(indexEntry.getData().toString('utf8'));
  const deps = indexData.dependencies || {};
  const mcVersion = deps.minecraft || '1.21.1';
  let loader = 'vanilla';
  let loaderVersion = '';

  if (deps['fabric-loader']) {
    loader = 'fabric';
    loaderVersion = deps['fabric-loader'];
  } else if (deps['quilt-loader']) {
    loader = 'quilt';
    loaderVersion = deps['quilt-loader'];
  } else if (deps.neoforge) {
    loader = 'neoforge';
    loaderVersion = deps.neoforge;
  } else if (deps.forge) {
    loader = 'forge';
    loaderVersion = deps.forge;
  }

  const packName = catalogItem?.title || indexData.name || 'Modpack Importé';
  const slug =
    packName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    Date.now().toString().slice(-4);

  const instDir = path.join(getInstancesDir(), slug);
  fs.mkdirSync(instDir, { recursive: true });
  ensureInstanceFolders(instDir);

  // Extract overrides/ or client-overrides/
  for (const entry of zip.getEntries()) {
    const entryName = entry.entryName;
    let relPath = null;
    if (entryName.startsWith('overrides/')) {
      relPath = entryName.slice('overrides/'.length);
    } else if (entryName.startsWith('client-overrides/')) {
      relPath = entryName.slice('client-overrides/'.length);
    }
    if (relPath) {
      const targetPath = path.join(instDir, relPath);
      if (entry.isDirectory) {
        fs.mkdirSync(targetPath, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, entry.getData());
      }
    }
  }

  // Download modpack files (up to first 45 mods concurrently in batches so installation is fast & reliable)
  const files = (indexData.files || []).filter((f) => !f.env || f.env.client !== 'unsupported');
  const total = files.length;
  let completed = 0;

  const batchSize = 6;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (f) => {
        const url = f.downloads?.[0];
        if (!url) return;
        const target = path.join(instDir, f.path);
        try {
          await downloadFile(url, target);
        } catch (err) {
          console.warn('Modpack file skip:', f.path, err.message);
        } finally {
          completed++;
          if (catalogItem) {
            const pct = 30 + Math.round((completed / Math.max(1, total)) * 68);
            sendToRenderer('catalog:progress', {
              projectId: catalogItem.id,
              title: packName,
              status: 'downloading',
              percent: pct,
              message: `Installation des fichiers (${completed}/${total})...`,
            });
          }
        }
      })
    );
  }

  const instance = {
    id: slug,
    name: packName,
    mcVersion,
    loader,
    loaderVersion,
    icon: 'layers',
    accentColor: '#a855f7',
    description: catalogItem?.description || indexData.summary || `Modpack ${packName} (${mcVersion})`,
    minRamMb: 4096,
    maxRamMb: 6144,
    jvmArgs: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
    width: 1280,
    height: 720,
    fullscreen: false,
    javaPath: '',
    playtimeMinutes: 0,
    lastPlayed: null,
    createdAt: new Date().toISOString(),
    installedMeta: {},
  };

  fs.writeFileSync(path.join(instDir, 'instance.json'), JSON.stringify(instance, null, 2), 'utf8');
  return {
    instanceId: slug,
    instances: getAllInstances(),
  };
}

ipcMain.handle('instance:importModpackFile', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Importer un Modpack (.mrpack)',
    filters: [{ name: 'Modpack Modrinth (.mrpack)', extensions: ['mrpack', 'zip'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return await extractAndCreateModpackInstance(res.filePaths[0], {
    id: `local-${Date.now()}`,
    title: path.basename(res.filePaths[0], path.extname(res.filePaths[0])),
  });
});

// ============================================================================
// JAVA DETECTION & ADOPTIUM AUTO-INSTALLER
// ============================================================================

function checkJavaExecutable(javaExePath) {
  return new Promise((resolve) => {
    if (!javaExePath || (javaExePath !== 'java' && !fs.existsSync(javaExePath))) {
      return resolve(null);
    }
    execFile(javaExePath, ['-version'], { timeout: 4000 }, (err, stdout, stderr) => {
      const output = `${stderr || ''}\n${stdout || ''}`;
      const match = output.match(/version "([^"]+)"/i) || output.match(/openjdk (\d+[\d.]*)/i);
      if (err && !match) return resolve(null);
      const versionStr = match ? match[1] : 'Unknown';
      let major = 8;
      if (versionStr.startsWith('1.8')) major = 8;
      else {
        const m = parseInt(versionStr.split('.')[0], 10);
        if (!isNaN(m)) major = m;
      }
      resolve({
        path: javaExePath,
        version: versionStr,
        major,
        raw: output.split('\n')[0]?.trim() || versionStr,
      });
    });
  });
}

async function detectAllJavaRuntimes() {
  const candidates = new Set(['java']);

  // Check LuminaMC managed runtimes
  const runtimesDir = getRuntimesDir();
  if (fs.existsSync(runtimesDir)) {
    const walkJava = (dir, depth = 0) => {
      if (depth > 3) return;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walkJava(full, depth + 1);
          else if (entry.name.toLowerCase() === 'java.exe') candidates.add(full);
        }
      } catch {}
    };
    walkJava(runtimesDir);
  }

  // Common Windows Java directories
  const programFiles = [
    process.env['ProgramFiles'],
    process.env['ProgramFiles(x86)'],
    process.env['LOCALAPPDATA'] ? path.join(process.env['LOCALAPPDATA'], 'Programs') : null,
  ].filter(Boolean);

  const vendorDirs = ['Eclipse Adoptium', 'Java', 'Microsoft', 'Zulu', 'BellSoft'];
  for (const pf of programFiles) {
    for (const vendor of vendorDirs) {
      const vPath = path.join(pf, vendor);
      if (fs.existsSync(vPath)) {
        try {
          for (const sub of fs.readdirSync(vPath)) {
            const exe = path.join(vPath, sub, 'bin', 'java.exe');
            if (fs.existsSync(exe)) candidates.add(exe);
          }
        } catch {}
      }
    }
  }

  if (process.env.JAVA_HOME) {
    candidates.add(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'));
  }

  const results = [];
  for (const c of candidates) {
    const info = await checkJavaExecutable(c);
    if (info) results.push(info);
  }
  return results;
}

ipcMain.handle('java:detect', async () => {
  return await detectAllJavaRuntimes();
});

ipcMain.handle('java:install', async (_e, majorVersion = 21) => {
  const major = Number(majorVersion) || 21;
  const apiUrl = `https://api.adoptium.net/v3/binary/latest/${major}/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk`;
  const zipPath = path.join(getRuntimesDir(), `temurin-jre-${major}.zip`);
  const extractDir = path.join(getRuntimesDir(), `jre-${major}`);

  sendToRenderer('java:progress', {
    major,
    status: 'downloading',
    percent: 0,
    message: `Téléchargement de Eclipse Temurin JRE ${major}...`,
  });

  await downloadFile(apiUrl, zipPath, (prog) => {
    sendToRenderer('java:progress', {
      major,
      status: 'downloading',
      percent: prog.percent,
      message: `Téléchargement JRE ${major} (${prog.percent}%)...`,
    });
  });

  sendToRenderer('java:progress', {
    major,
    status: 'extracting',
    percent: 95,
    message: `Extraction de Java ${major}...`,
  });

  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDir, { recursive: true });

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(extractDir, true);
  try {
    fs.unlinkSync(zipPath);
  } catch {}

  sendToRenderer('java:progress', {
    major,
    status: 'completed',
    percent: 100,
    message: `Java ${major} installé et prêt !`,
  });

  return await detectAllJavaRuntimes();
});

// ============================================================================
// SEPARATE INSTANCE INSTALLER (game:install) & FAST LAUNCHER ENGINE (game:launch)
// ============================================================================

const installingInstances = new Set();
const keepAliveHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 24 });

function getRequiredJavaMajor(mcVersion, versionJson = null) {
  if (versionJson && versionJson.javaVersion && Number(versionJson.javaVersion.majorVersion) > 0) {
    return Number(versionJson.javaVersion.majorVersion);
  }
  // Check cached versionJson on disk if available
  try {
    const cachedJsonPath = path.join(getSharedMcDir(), 'versions', String(mcVersion), `${mcVersion}.json`);
    if (fs.existsSync(cachedJsonPath)) {
      const parsed = JSON.parse(fs.readFileSync(cachedJsonPath, 'utf8'));
      if (parsed?.javaVersion?.majorVersion) {
        return Number(parsed.javaVersion.majorVersion);
      }
    }
  } catch {}

  const verStr = String(mcVersion || '1.21.4').trim();
  // Legacy Alpha / Beta / Classic / Indev
  if (/^(rd-|c0\.|inf-|a1\.|b1\.)/i.test(verStr)) {
    return 8;
  }
  // Snapshots 25w+ / 26w+
  const snapMatch = verStr.match(/^(\d{2})w(\d{2})/i);
  if (snapMatch) {
    const yr = parseInt(snapMatch[1], 10);
    if (yr >= 25) return 25;
    if (yr >= 24) return 21;
    if (yr >= 21) return 17;
    return 8;
  }

  const parts = verStr.split('.').map((n) => parseInt(n.replace(/\D.*$/, ''), 10));
  const first = parts[0] || 1;
  const second = parts[1] || 0;
  const third = parts[2] || 0;

  // Mojang 2025/2026+ versioning scheme (e.g. 26.1, 26.2, 26.3)
  if (first >= 25) {
    return 25;
  }
  if (first === 1) {
    if (second >= 21 || (second === 20 && third >= 5)) return 21;
    if (second >= 17) return 17;
    return 8;
  }
  return 21;
}

function isRuleListAllowedOnWindows(rules, features = {}) {
  if (!rules || !Array.isArray(rules) || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) {
    const actionAllow = rule.action === 'allow';
    let matches = true;
    if (rule.os) {
      if (rule.os.name && rule.os.name !== 'windows') {
        matches = false;
      }
      if (rule.os.arch && rule.os.arch !== 'x64' && rule.os.arch !== 'amd64') {
        matches = false;
      }
    }
    if (rule.features) {
      for (const [featKey, featVal] of Object.entries(rule.features)) {
        if (Boolean(features[featKey]) !== Boolean(featVal)) {
          matches = false;
        }
      }
    }
    if (matches) {
      allowed = actionAllow;
    }
  }
  return allowed;
}

function isLibAllowedOnWindows(lib) {
  return isRuleListAllowedOnWindows(lib.rules);
}

function mavenCoordinateToPath(coord) {
  // Format: group:artifact:version[:classifier][@ext]
  let ext = 'jar';
  let clean = coord;
  if (clean.includes('@')) {
    const sp = clean.split('@');
    clean = sp[0];
    ext = sp[1] || 'jar';
  }
  const parts = clean.split(':');
  const group = (parts[0] || '').replace(/\./g, '/');
  const artifact = parts[1] || '';
  const version = parts[2] || '';
  const classifier = parts[3] ? `-${parts[3]}` : '';
  const fileName = `${artifact}-${version}${classifier}.${ext}`;
  return {
    groupKey: `${parts[0]}:${parts[1]}:${parts[3] || ''}`,
    relPath: `${group}/${artifact}/${version}/${fileName}`,
    fileName,
  };
}

function resolveLibraryArtifacts(lib, defaultRepo = 'https://libraries.minecraft.net/') {
  const results = [];
  if (!lib || !isLibAllowedOnWindows(lib)) return results;

  const coordInfo = lib.name ? mavenCoordinateToPath(lib.name) : null;

  // 1. Standard artifact (Note: if lib.downloads exists without .artifact, e.g. classifier-only LWJGL 2.9.0 in 1.0, do NOT fabricate a main jar!)
  if (lib.downloads && lib.downloads.artifact && lib.downloads.artifact.path) {
    const relPath = lib.downloads.artifact.path;
    const url =
      lib.downloads.artifact.url ||
      (lib.url ? `${lib.url.replace(/\/?$/, '/')}${relPath}` : `${defaultRepo}${relPath}`);
    results.push({
      groupKey: coordInfo ? coordInfo.groupKey : relPath,
      relPath,
      url,
      isNative: relPath.includes('natives-windows') || (lib.name && lib.name.includes(':natives-windows')),
    });
  } else if (!lib.downloads && coordInfo) {
    const baseUrl = (lib.url || defaultRepo).replace(/\/?$/, '/');
    results.push({
      groupKey: coordInfo.groupKey,
      relPath: coordInfo.relPath,
      url: `${baseUrl}${coordInfo.relPath}`,
      isNative: coordInfo.relPath.includes('natives-windows'),
    });
  }

  // 2. Legacy classifiers (natives-windows)
  const classifiers = lib.downloads && lib.downloads.classifiers;
  if (classifiers) {
    const winNative =
      classifiers['natives-windows'] ||
      classifiers['natives-windows-64'] ||
      (lib.natives && lib.natives.windows && classifiers[lib.natives.windows.replace('${arch}', '64')]);
    if (winNative && winNative.path && winNative.url) {
      results.push({
        groupKey: `${lib.name || 'native'}:classifier-windows`,
        relPath: winNative.path,
        url: winNative.url,
        isNative: true,
      });
    }
  }

  return results;
}

function ensureNativesLayoutAndExtract(nativesDir, nativeJarPaths = []) {
  const subDirs = ['java', 'jna', 'lwjgl', 'netty'];
  fs.mkdirSync(nativesDir, { recursive: true });
  for (const sub of subDirs) {
    fs.mkdirSync(path.join(nativesDir, sub), { recursive: true });
  }

  // Extract any provided native JARs into both nativesDir and nativesDir/java (needed for MC 26.3+)
  for (const jarPath of nativeJarPaths) {
    if (!fs.existsSync(jarPath)) continue;
    try {
      const zip = new AdmZip(jarPath);
      for (const entry of zip.getEntries()) {
        if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.dll')) {
          const dllName = path.basename(entry.entryName);
          const data = entry.getData();
          const outRoot = path.join(nativesDir, dllName);
          const outJava = path.join(nativesDir, 'java', dllName);
          if (!fs.existsSync(outRoot)) fs.writeFileSync(outRoot, data);
          if (!fs.existsSync(outJava)) fs.writeFileSync(outJava, data);
        }
      }
    } catch {}
  }

  // Also sync any existing .dll files in nativesDir into nativesDir/java for already-installed instances
  try {
    const rootFiles = fs.readdirSync(nativesDir, { withFileTypes: true });
    for (const f of rootFiles) {
      if (f.isFile() && f.name.toLowerCase().endsWith('.dll')) {
        const src = path.join(nativesDir, f.name);
        const dst = path.join(nativesDir, 'java', f.name);
        if (!fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
        }
      }
    }
  } catch {}
}

function reconstructLegacyVirtualAssets(assetIndexId, assetIndexData, assetsDir, instDir) {
  if (!assetIndexData || !assetIndexData.objects) return assetsDir;
  const isLegacyVirtual =
    Boolean(assetIndexData.virtual) ||
    Boolean(assetIndexData.map_to_resources) ||
    assetIndexId === 'pre-1.6' ||
    assetIndexId === 'legacy';

  if (!isLegacyVirtual) {
    return assetsDir;
  }

  const objectsDir = path.join(assetsDir, 'objects');
  const virtualRoot = path.join(assetsDir, 'virtual', assetIndexId);
  const resourcesRoot = path.join(instDir, 'resources');
  fs.mkdirSync(virtualRoot, { recursive: true });
  if (assetIndexData.map_to_resources || assetIndexId === 'pre-1.6') {
    fs.mkdirSync(resourcesRoot, { recursive: true });
  }

  for (const [relPath, obj] of Object.entries(assetIndexData.objects)) {
    if (!obj || !obj.hash) continue;
    const srcObj = path.join(objectsDir, obj.hash.slice(0, 2), obj.hash);
    if (!fs.existsSync(srcObj)) continue;

    const cleanRel = relPath.replace(/\//g, path.sep);
    const vDest = path.join(virtualRoot, cleanRel);
    if (!fs.existsSync(vDest)) {
      try {
        fs.mkdirSync(path.dirname(vDest), { recursive: true });
        fs.copyFileSync(srcObj, vDest);
      } catch {}
    }

    if (assetIndexData.map_to_resources || assetIndexId === 'pre-1.6') {
      const rDest = path.join(resourcesRoot, cleanRel);
      if (!fs.existsSync(rDest)) {
        try {
          fs.mkdirSync(path.dirname(rDest), { recursive: true });
          fs.copyFileSync(srcObj, rDest);
        } catch {}
      }
    }
  }

  return virtualRoot;
}

async function downloadWithAgent(url, destPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const requestUrl = (currentUrl, redirects = 0) => {
      if (redirects > 5) return reject(new Error(`Too many redirects for ${url}`));
      const parsed = new URL(currentUrl);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get(
        parsed,
        {
          agent: parsed.protocol === 'https:' ? keepAliveHttpsAgent : undefined,
          headers: { 'User-Agent': 'LuminaMC-Launcher/1.0.0' },
          timeout: 30000,
        },
        (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            res.resume();
            const nextUrl = new URL(res.headers.location, currentUrl).toString();
            return requestUrl(nextUrl, redirects + 1);
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            res.resume();
            return reject(new Error(`HTTP ${res.statusCode} for ${currentUrl}`));
          }
          const tempPath = `${destPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
          const fileStream = fs.createWriteStream(tempPath);
          res.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close(() => {
              try {
                fs.renameSync(tempPath, destPath);
                resolve(destPath);
              } catch (err) {
                reject(err);
              }
            });
          });
          fileStream.on('error', (err) => {
            fs.unlink(tempPath, () => {});
            reject(err);
          });
        }
      );
      req.on('timeout', () => {
        req.destroy(new Error(`Timeout downloading ${currentUrl}`));
      });
      req.on('error', reject);
    };

    requestUrl(url);
  });
}

async function runParallelPool(items, concurrency, workerFn) {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const currentIdx = index++;
      await workerFn(items[currentIdx], currentIdx);
    }
  });
  await Promise.all(workers);
}

async function resolveOrInstallJavaForInstance(instance, instanceId, cfg, versionJson = null) {
  const requiredMajor = getRequiredJavaMajor(instance.mcVersion, versionJson);

  // Only use custom javaPath if explicitly set on the instance itself
  if (instance.javaPath && fs.existsSync(instance.javaPath)) {
    return instance.javaPath;
  }

  const detected = await detectAllJavaRuntimes();
  // Require exact major version match because:
  // - MC 1.0 - 1.16.5 (Java 8) uses LaunchWrapper which crashes on Java 9+ (ClassCastException URLClassLoader)
  // - MC 26.3+ (Java 25) uses class file version 69.0 which crashes on Java 21/17
  const exactMatch = detected.find((j) => j.major === requiredMajor);

  if (exactMatch) {
    sendToRenderer('game:log', {
      instanceId,
      level: 'info',
      text: `[LuminaMC] Runtime Java ${requiredMajor} détecté : ${exactMatch.path} (Java ${exactMatch.version})`,
    });
    return exactMatch.path;
  }

  // Auto-download required Java from Eclipse Adoptium
  sendToRenderer('game:log', {
    instanceId,
    level: 'warn',
    text: `[LuminaMC] Téléchargement automatique de Eclipse Temurin Java ${requiredMajor} requis pour MC ${instance.mcVersion}...`,
  });
  sendToRenderer('game:state', {
    instanceId,
    status: 'downloading-java',
    message: `Téléchargement de Java ${requiredMajor} (Adoptium)...`,
  });

  const major = requiredMajor;
  const apiUrl = `https://api.adoptium.net/v3/binary/latest/${major}/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk`;
  const zipPath = path.join(getRuntimesDir(), `temurin-jre-${major}.zip`);
  const extractDir = path.join(getRuntimesDir(), `jre-${major}`);

  await downloadFile(apiUrl, zipPath, (prog) => {
    sendToRenderer('game:progress', {
      instanceId,
      type: `Java ${major} (Adoptium)`,
      task: prog.downloadedBytes,
      total: prog.totalBytes,
      percent: prog.percent,
    });
  });

  if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });
  new AdmZip(zipPath).extractAllTo(extractDir, true);
  try {
    fs.unlinkSync(zipPath);
  } catch {}

  const refreshed = await detectAllJavaRuntimes();
  const found =
    refreshed.find((j) => j.major === major) ||
    refreshed.find((j) => j.major >= major) ||
    refreshed[0];
  if (!found) throw new Error(`Impossible de localiser Java ${major} après extraction.`);
  return found.path;
}

async function prepareModloaderProfile(instance, sharedMcRoot, javaPath, instanceId) {
  if (!instance.loader || instance.loader === 'vanilla') return null;

  try {
    // Fabric & Quilt
    if (instance.loader === 'fabric' || instance.loader === 'quilt') {
      let loaderVer = instance.loaderVersion;
      if (!loaderVer || loaderVer === 'latest') {
        const endpoint =
          instance.loader === 'fabric'
            ? `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(instance.mcVersion)}`
            : `https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(instance.mcVersion)}`;
        const list = await fetchJson(endpoint);
        if (!list || !Array.isArray(list) || !list.length) {
          throw new Error(`Aucun loader ${instance.loader} disponible pour Minecraft ${instance.mcVersion}.`);
        }
        loaderVer = list[0].loader.version;
      }

      const customId = `${instance.loader}-loader-${loaderVer}-${instance.mcVersion}`;
      const customDir = path.join(sharedMcRoot, 'versions', customId);
      const customJsonPath = path.join(customDir, `${customId}.json`);

      fs.mkdirSync(customDir, { recursive: true });
      const profileUrl =
        instance.loader === 'fabric'
          ? `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(instance.mcVersion)}/${encodeURIComponent(loaderVer)}/profile/json`
          : `https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(instance.mcVersion)}/${encodeURIComponent(loaderVer)}/profile/json`;
      const profileJson = await fetchJson(profileUrl);
      profileJson.id = customId;
      fs.writeFileSync(customJsonPath, JSON.stringify(profileJson, null, 2), 'utf8');
      return customId;
    }

    // NeoForge & Forge via official headless installer (--installClient)
    if (instance.loader === 'neoforge' || instance.loader === 'forge') {
      const profilesPath = path.join(sharedMcRoot, 'launcher_profiles.json');
      if (!fs.existsSync(profilesPath)) {
        fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }, null, 2), 'utf8');
      }

      let loaderVer = instance.loaderVersion;
      let installerUrl = '';
      let expectedCustomId = '';

      if (instance.loader === 'neoforge') {
        if (!loaderVer || loaderVer === 'latest') {
          const nfData = await fetchJson(
            'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'
          );
          const parts = instance.mcVersion.split('.');
          const prefix =
            parts[0] === '1' && parts.length >= 2
              ? `${parts[1]}.${parts[2] || '0'}.`
              : `${instance.mcVersion}.`;
          const allVers = (nfData.versions || []).reverse();
          loaderVer = prefix ? allVers.find((v) => v.startsWith(prefix)) : null;
        }
        if (!loaderVer) {
          throw new Error(`Aucune version NeoForge disponible pour Minecraft ${instance.mcVersion}.`);
        }
        expectedCustomId = `neoforge-${loaderVer}`;
        installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${loaderVer}/neoforge-${loaderVer}-installer.jar`;
      } else {
        if (!loaderVer || loaderVer === 'latest') {
          const promos = await fetchJson(
            'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
          );
          const p = promos.promos || {};
          loaderVer = p[`${instance.mcVersion}-recommended`] || p[`${instance.mcVersion}-latest`];
        }
        if (!loaderVer) {
          throw new Error(`Aucune version Forge disponible pour Minecraft ${instance.mcVersion}.`);
        }
        const fullForgeVer = `${instance.mcVersion}-${loaderVer}`;
        expectedCustomId = `${instance.mcVersion}-forge-${loaderVer}`;
        installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullForgeVer}/forge-${fullForgeVer}-installer.jar`;
      }

      const existingJson = path.join(sharedMcRoot, 'versions', expectedCustomId, `${expectedCustomId}.json`);
      if (fs.existsSync(existingJson)) {
        return expectedCustomId;
      }

      const installerJar = path.join(getBaseDataDir(), `installer-${expectedCustomId}.jar`);
      sendToRenderer('game:log', {
        instanceId,
        level: 'info',
        text: `[LuminaMC] Téléchargement de l’installateur ${instance.loader.toUpperCase()} (${loaderVer})...`,
      });
      await downloadFile(installerUrl, installerJar);

      sendToRenderer('game:state', {
        instanceId,
        status: 'installing',
        message: `Étape 3/5 : Installation du profil ${instance.loader.toUpperCase()} (${loaderVer})...`,
      });

      await new Promise((resolve, reject) => {
        const proc = spawn(javaPath || 'java', ['-jar', installerJar, '--installClient', sharedMcRoot], {
          cwd: sharedMcRoot,
        });
        proc.stdout.on('data', (d) =>
          sendToRenderer('game:log', { instanceId, level: 'debug', text: d.toString().trim() })
        );
        proc.stderr.on('data', (d) =>
          sendToRenderer('game:log', { instanceId, level: 'warn', text: d.toString().trim() })
        );
        proc.on('close', (code) => {
          try {
            fs.unlinkSync(installerJar);
          } catch {}
          if (code === 0) resolve();
          else reject(new Error(`L’installateur ${instance.loader} s’est terminé avec le code ${code}`));
        });
        proc.on('error', reject);
      });

      return expectedCustomId;
    }
  } catch (loaderErr) {
    // Graceful fallback to Vanilla if user picked a loader on a version that doesn't support it (e.g. MC 1.0 or brand new snapshot)
    sendToRenderer('game:log', {
      instanceId,
      level: 'warn',
      text: `[LuminaMC] ${loaderErr.message} -> Basculement automatique de l'instance en mode Vanilla pour Minecraft ${instance.mcVersion}.`,
    });
    instance.loader = 'vanilla';
    instance.loaderVersion = '';
    const instMetaPath = path.join(getInstancesDir(), instanceId, 'instance.json');
    if (fs.existsSync(instMetaPath)) {
      try {
        const cur = JSON.parse(fs.readFileSync(instMetaPath, 'utf8'));
        cur.loader = 'vanilla';
        cur.loaderVersion = '';
        fs.writeFileSync(instMetaPath, JSON.stringify(cur, null, 2), 'utf8');
      } catch {}
    }
    return null;
  }

  return null;
}

// ============================================================================
// IPC: game:install (Téléchargement & Installation dédiée de l'instance)
// ============================================================================

ipcMain.handle('game:install', async (_e, instanceId) => {
  if (installingInstances.has(instanceId)) {
    throw new Error('Le téléchargement de cette instance est déjà en cours.');
  }

  const instDir = path.join(getInstancesDir(), instanceId);
  const metaPath = path.join(instDir, 'instance.json');
  if (!fs.existsSync(metaPath)) throw new Error('Instance introuvable.');

  const instance = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const cfg = loadConfig();
  const sharedMcRoot = getSharedMcDir();
  ensureInstanceFolders(instDir);

  installingInstances.add(instanceId);

  try {
    sendToRenderer('game:log', {
      instanceId,
      level: 'info',
      text: `[LuminaMC] Début du téléchargement/installation de l’instance "${instance.name}" (MC ${instance.mcVersion} • ${instance.loader.toUpperCase()})`,
    });

    // 1. Download Mojang Version JSON first so we know exact javaVersion (e.g. Java 25 for 26.3, Java 8 for 1.0)
    sendToRenderer('game:state', {
      instanceId,
      status: 'installing',
      message: `Étape 1/5 : Récupération des métadonnées Minecraft ${instance.mcVersion}...`,
    });

    const manifest = await fetchJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
    const verEntry = (manifest.versions || []).find((v) => v.id === instance.mcVersion);
    if (!verEntry) {
      throw new Error(`Version Minecraft "${instance.mcVersion}" introuvable dans le catalogue Mojang.`);
    }

    const versionDir = path.join(sharedMcRoot, 'versions', instance.mcVersion);
    fs.mkdirSync(versionDir, { recursive: true });
    const versionJsonPath = path.join(versionDir, `${instance.mcVersion}.json`);
    const versionJarPath = path.join(versionDir, `${instance.mcVersion}.jar`);

    const versionJson = await fetchJson(verEntry.url);
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2), 'utf8');

    // 2. Check / Install required exact Java Runtime (8, 17, 21, or 25)
    sendToRenderer('game:state', {
      instanceId,
      status: 'installing',
      message: 'Étape 2/5 : Vérification du runtime Java requis...',
    });
    const javaPath = await resolveOrInstallJavaForInstance(instance, instanceId, cfg, versionJson);

    if (!fs.existsSync(versionJarPath) || fs.statSync(versionJarPath).size < 50000) {
      sendToRenderer('game:log', {
        instanceId,
        level: 'info',
        text: `[LuminaMC] Téléchargement du client officiel ${instance.mcVersion}.jar...`,
      });
      await downloadFile(versionJson.downloads.client.url, versionJarPath, (prog) => {
        sendToRenderer('game:progress', {
          instanceId,
          type: `Client Minecraft ${instance.mcVersion}`,
          task: prog.downloadedBytes,
          total: prog.totalBytes,
          percent: prog.percent,
        });
      });
    }

    // 3. Prepare Modloader Profile (Fabric / Quilt / NeoForge / Forge)
    let customVersionId = null;
    let loaderJson = null;
    if (instance.loader && instance.loader !== 'vanilla') {
      sendToRenderer('game:state', {
        instanceId,
        status: 'installing',
        message: `Étape 3/5 : Configuration du loader ${instance.loader.toUpperCase()}...`,
      });
      customVersionId = await prepareModloaderProfile(instance, sharedMcRoot, javaPath, instanceId);
      if (customVersionId) {
        const customJsonPath = path.join(sharedMcRoot, 'versions', customVersionId, `${customVersionId}.json`);
        if (fs.existsSync(customJsonPath)) {
          loaderJson = JSON.parse(fs.readFileSync(customJsonPath, 'utf8'));
        }
      }
    }

    // 4. Download Libraries & Extract Windows Natives (.dll)
    sendToRenderer('game:state', {
      instanceId,
      status: 'installing',
      message: 'Étape 4/5 : Téléchargement des bibliothèques et natives...',
    });

    const librariesDir = path.join(sharedMcRoot, 'libraries');
    const nativesDir = path.join(sharedMcRoot, 'natives', instance.mcVersion);
    fs.mkdirSync(librariesDir, { recursive: true });
    ensureNativesLayoutAndExtract(nativesDir, []);

    const allArtifacts = [];
    if (loaderJson && Array.isArray(loaderJson.libraries)) {
      const defaultLoaderRepo =
        instance.loader === 'fabric'
          ? 'https://maven.fabricmc.net/'
          : instance.loader === 'quilt'
          ? 'https://maven.quiltmc.org/repository/release/'
          : 'https://libraries.minecraft.net/';
      for (const lib of loaderJson.libraries) {
        allArtifacts.push(...resolveLibraryArtifacts(lib, defaultLoaderRepo));
      }
    }
    for (const lib of versionJson.libraries || []) {
      allArtifacts.push(...resolveLibraryArtifacts(lib, 'https://libraries.minecraft.net/'));
    }

    let completedLibs = 0;
    const totalLibs = allArtifacts.length;
    const nativeJarPaths = [];

    await runParallelPool(allArtifacts, 12, async (art) => {
      const targetJar = path.join(librariesDir, art.relPath);
      if (!fs.existsSync(targetJar) || fs.statSync(targetJar).size === 0) {
        try {
          await downloadWithAgent(art.url, targetJar);
        } catch (err) {
          console.warn('Library download warning:', art.url, err.message);
        }
      }
      if (art.isNative && fs.existsSync(targetJar)) {
        nativeJarPaths.push(targetJar);
      }
      completedLibs++;
      if (completedLibs % 4 === 0 || completedLibs === totalLibs) {
        sendToRenderer('game:progress', {
          instanceId,
          type: 'Bibliothèques & Natives',
          task: completedLibs,
          total: totalLibs,
          percent: Math.round((completedLibs / Math.max(1, totalLibs)) * 100),
        });
      }
    });

    ensureNativesLayoutAndExtract(nativesDir, nativeJarPaths);

    // 5. Download Asset Index & Missing Game Assets
    sendToRenderer('game:state', {
      instanceId,
      status: 'installing',
      message: 'Étape 5/5 : Téléchargement des ressources (Assets Minecraft)...',
    });

    const assetsDir = path.join(sharedMcRoot, 'assets');
    const indexesDir = path.join(assetsDir, 'indexes');
    const objectsDir = path.join(assetsDir, 'objects');
    fs.mkdirSync(indexesDir, { recursive: true });
    fs.mkdirSync(objectsDir, { recursive: true });

    const assetIndexId = versionJson.assetIndex.id;
    const assetIndexPath = path.join(indexesDir, `${assetIndexId}.json`);
    if (!fs.existsSync(assetIndexPath)) {
      await downloadWithAgent(versionJson.assetIndex.url, assetIndexPath);
    }

    const assetIndexData = JSON.parse(fs.readFileSync(assetIndexPath, 'utf8'));
    const assetObjects = Object.values(assetIndexData.objects || {});
    const uniqueHashes = Array.from(new Set(assetObjects.map((o) => o.hash)));

    const missingHashes = uniqueHashes.filter((hash) => {
      const p = path.join(objectsDir, hash.slice(0, 2), hash);
      return !fs.existsSync(p);
    });

    const totalAssets = uniqueHashes.length;
    let doneAssets = totalAssets - missingHashes.length;

    sendToRenderer('game:progress', {
      instanceId,
      type: 'Assets Minecraft',
      task: doneAssets,
      total: totalAssets,
      percent: Math.round((doneAssets / Math.max(1, totalAssets)) * 100),
    });

    if (missingHashes.length > 0) {
      await runParallelPool(missingHashes, 20, async (hash) => {
        const sub = hash.slice(0, 2);
        const dest = path.join(objectsDir, sub, hash);
        const url = `https://resources.download.minecraft.net/${sub}/${hash}`;
        try {
          await downloadWithAgent(url, dest);
        } catch (err) {
          // Retry once
          try {
            await downloadWithAgent(url, dest);
          } catch {}
        }
        doneAssets++;
        if (doneAssets % 25 === 0 || doneAssets === totalAssets) {
          sendToRenderer('game:progress', {
            instanceId,
            type: 'Assets Minecraft',
            task: doneAssets,
            total: totalAssets,
            percent: Math.round((doneAssets / Math.max(1, totalAssets)) * 100),
          });
        }
      });
    }

    // Reconstruct virtual/mapped assets for legacy versions (e.g. MC 1.0 - 1.7.2 pre-1.6 / legacy)
    reconstructLegacyVirtualAssets(assetIndexId, assetIndexData, assetsDir, instDir);

    // 6. Mark instance as installed & ready to launch!
    const freshMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    freshMeta.loader = instance.loader;
    freshMeta.loaderVersion = instance.loaderVersion;
    freshMeta.installed = true;
    freshMeta.installedSignature = getInstanceSignature(freshMeta);
    freshMeta.customVersionId = customVersionId;
    freshMeta.installedAt = new Date().toISOString();
    fs.writeFileSync(metaPath, JSON.stringify(freshMeta, null, 2), 'utf8');

    sendToRenderer('game:log', {
      instanceId,
      level: 'info',
      text: `[LuminaMC] ✓ Instance "${freshMeta.name}" entièrement téléchargée et prête à être lancée !`,
    });
    sendToRenderer('game:state', {
      instanceId,
      status: 'installed',
      message: 'Instance téléchargée et prête à jouer !',
    });

    return {
      instanceId,
      instances: getAllInstances(),
    };
  } catch (err) {
    sendToRenderer('game:log', {
      instanceId,
      level: 'error',
      text: `[Erreur Installation] ${err.message}`,
    });
    sendToRenderer('game:state', {
      instanceId,
      status: 'error',
      message: err.message,
    });
    throw err;
  } finally {
    installingInstances.delete(instanceId);
  }
});

// ============================================================================
// IPC: game:launch (Lancement d'une instance déjà téléchargée)
// ============================================================================

ipcMain.handle('game:launch', async (_e, instanceId) => {
  if (runningGames.has(instanceId)) {
    throw new Error('Cette instance est déjà en cours d’exécution.');
  }
  if (installingInstances.has(instanceId)) {
    throw new Error('Veuillez attendre la fin du téléchargement de l’instance.');
  }

  const instDir = path.join(getInstancesDir(), instanceId);
  const metaPath = path.join(instDir, 'instance.json');
  if (!fs.existsSync(metaPath)) throw new Error('Instance introuvable.');
  const instance = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  if (!checkInstanceReadyOnDisk(instance)) {
    throw new Error(
      'Cette instance n’est pas encore téléchargée. Cliquez d’abord sur "Télécharger l’instance".'
    );
  }

  const cfg = loadConfig();
  const sharedMcRoot = getSharedMcDir();
  ensureInstanceFolders(instDir);

  const activeAccount =
    cfg.accounts.find((a) => a.id === cfg.activeAccountId) ||
    cfg.accounts[0] || {
      username: 'Player',
      uuid: generateOfflineUUID('Player'),
      accessToken: '0',
      type: 'offline',
    };

  sendToRenderer('game:state', {
    instanceId,
    status: 'preparing',
    message: 'Démarrage de Minecraft...',
  });
  sendToRenderer('game:log', {
    instanceId,
    level: 'info',
    text: `[LuminaMC] Lancement de "${instance.name}" (${instance.mcVersion} • ${instance.loader.toUpperCase()}) avec le compte ${activeAccount.username}...`,
  });

  const versionDir = path.join(sharedMcRoot, 'versions', instance.mcVersion);
  const versionJsonPath = path.join(versionDir, `${instance.mcVersion}.json`);
  const versionJarPath = path.join(versionDir, `${instance.mcVersion}.jar`);
  const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));

  // Resolve or auto-install the exact required Java version (e.g. Java 25 for 26.3, Java 8 for 1.0)
  const requiredMajor = getRequiredJavaMajor(instance.mcVersion, versionJson);
  const javaPath = await resolveOrInstallJavaForInstance(instance, instanceId, cfg, versionJson);

  let loaderJson = null;
  if (instance.customVersionId) {
    const customJsonPath = path.join(
      sharedMcRoot,
      'versions',
      instance.customVersionId,
      `${instance.customVersionId}.json`
    );
    if (fs.existsSync(customJsonPath)) {
      loaderJson = JSON.parse(fs.readFileSync(customJsonPath, 'utf8'));
    }
  }

  const librariesDir = path.join(sharedMcRoot, 'libraries');
  const nativesDir = path.join(sharedMcRoot, 'natives', instance.mcVersion);
  const assetsDir = path.join(sharedMcRoot, 'assets');

  // Collect native jars and ensure natives layout (including natives/java for 26.3)
  const nativeJarsForSync = [];
  for (const lib of versionJson.libraries || []) {
    for (const art of resolveLibraryArtifacts(lib, 'https://libraries.minecraft.net/')) {
      if (art.isNative) {
        const p = path.join(librariesDir, art.relPath);
        if (fs.existsSync(p)) nativeJarsForSync.push(p);
      }
    }
  }
  ensureNativesLayoutAndExtract(nativesDir, nativeJarsForSync);

  // Build deduplicated classpath (Modloader libraries override older Vanilla libraries of same group:artifact)
  const seenGroupKeys = new Set();
  const classpathJars = [];

  const addLibsToClasspath = (libs, defaultRepo) => {
    for (const lib of libs || []) {
      const arts = resolveLibraryArtifacts(lib, defaultRepo);
      for (const art of arts) {
        const fullJarPath = path.join(librariesDir, art.relPath);
        if (!fs.existsSync(fullJarPath)) continue;
        if (art.groupKey && !art.isNative) {
          if (seenGroupKeys.has(art.groupKey)) continue;
          seenGroupKeys.add(art.groupKey);
        }
        if (!classpathJars.includes(fullJarPath)) {
          classpathJars.push(fullJarPath);
        }
      }
    }
  };

  if (loaderJson && Array.isArray(loaderJson.libraries)) {
    addLibsToClasspath(loaderJson.libraries, 'https://maven.fabricmc.net/');
  }
  addLibsToClasspath(versionJson.libraries, 'https://libraries.minecraft.net/');
  classpathJars.push(versionJarPath);

  const cpSeparator = ';';
  const classpathString = classpathJars.join(cpSeparator);

  const minRam = instance.minRamMb || 2048;
  const maxRam = Math.max(minRam, instance.maxRamMb || 4096);

  const customUserJvmArgs = (instance.jvmArgs || '')
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean);

  const jvmRepMap = {
    '${natives_directory}': nativesDir,
    '${library_directory}': librariesDir,
    '${classpath_separator}': cpSeparator,
    '${version_name}': instance.customVersionId || instance.mcVersion,
    '${launcher_name}': 'LuminaMC',
    '${launcher_version}': '1.0.0',
    '${classpath}': classpathString,
  };

  const expandJvmArgList = (rawList) => {
    const out = [];
    for (const item of rawList || []) {
      if (typeof item === 'string') {
        out.push(item);
      } else if (item && typeof item === 'object') {
        if (!isRuleListAllowedOnWindows(item.rules)) continue;
        const vals = Array.isArray(item.value) ? item.value : [item.value];
        for (const v of vals) {
          if (typeof v === 'string') out.push(v);
        }
      }
    }
    const resolved = [];
    for (let i = 0; i < out.length; i++) {
      let token = out[i];
      // Skip -cp ${classpath} from versionJson/loaderJson since we add -cp at the end
      if ((token === '-cp' || token === '-classpath') && out[i + 1] === '${classpath}') {
        i++;
        continue;
      }
      if (token === '${classpath}') continue;
      for (const [k, v] of Object.entries(jvmRepMap)) {
        token = token.split(k).join(v);
      }
      resolved.push(token);
    }
    return resolved;
  };

  const versionJvmArgs = expandJvmArgList(versionJson.arguments?.jvm);
  const loaderJvmArgs = expandJvmArgList(loaderJson?.arguments?.jvm);

  // Fallback native properties if versionJson didn't have arguments.jvm (e.g. 1.0 - 1.12.2)
  const baseNativeArgs =
    versionJvmArgs.length > 0
      ? versionJvmArgs
      : [
          `-Djava.library.path=${nativesDir}`,
          `-Djna.tmpdir=${nativesDir}`,
          `-Dorg.lwjgl.system.SharedLibraryExtractPath=${nativesDir}`,
          `-Dio.netty.native.workdir=${nativesDir}`,
          '-Dminecraft.launcher.brand=LuminaMC',
          '-Dminecraft.launcher.version=1.0.0',
        ];

  const legacyJava8Fixes =
    requiredMajor === 8
      ? ['-Djava.util.Arrays.useLegacyMergeSort=true', '-Dfml.ignoreInvalidMinecraftCertificates=true']
      : [];

  const jvmArgs = [
    `-Xms${minRam}M`,
    `-Xmx${maxRam}M`,
    ...legacyJava8Fixes,
    ...customUserJvmArgs,
    ...baseNativeArgs,
    ...loaderJvmArgs,
    '-cp',
    classpathString,
  ];

  const mainClass =
    loaderJson?.mainClass || versionJson.mainClass || 'net.minecraft.client.main.Main';

  const assetIndexId = versionJson.assetIndex?.id || instance.mcVersion;
  const assetIndexPath = path.join(assetsDir, 'indexes', `${assetIndexId}.json`);
  let assetIndexData = null;
  if (fs.existsSync(assetIndexPath)) {
    try {
      assetIndexData = JSON.parse(fs.readFileSync(assetIndexPath, 'utf8'));
    } catch {}
  }

  // Ensure virtual/mapped assets exist for pre-1.6 / legacy versions (fixes MC 1.0VanillaTweakInjector icon NPE & sounds)
  const resolvedGameAssetsDir = reconstructLegacyVirtualAssets(
    assetIndexId,
    assetIndexData,
    assetsDir,
    instDir
  );

  const cleanUuid = (activeAccount.uuid || '').replace(/-/g, '');
  const authSession = `token:${activeAccount.accessToken || '0'}:${cleanUuid || '0'}`;

  const gameRepMap = {
    '${auth_player_name}': activeAccount.username,
    '${auth_session}': authSession,
    '${version_name}': instance.customVersionId || instance.mcVersion,
    '${game_directory}': instDir,
    '${assets_root}': assetsDir,
    '${game_assets}': resolvedGameAssetsDir,
    '${assets_index_name}': assetIndexId,
    '${auth_uuid}': activeAccount.uuid,
    '${auth_access_token}': activeAccount.accessToken || '0',
    '${clientid}': '0',
    '${auth_xuid}': '0',
    '${user_type}': activeAccount.type === 'microsoft' ? 'msa' : 'mojang',
    '${version_type}': versionJson.type || 'release',
    '${user_properties}': '{}',
  };

  // Game arguments
  const gameArgs = [];
  if (versionJson.minecraftArguments) {
    // Legacy Minecraft (1.0 - 1.12.2)
    for (const token of versionJson.minecraftArguments.split(' ')) {
      let resolved = token;
      for (const [k, v] of Object.entries(gameRepMap)) {
        resolved = resolved.split(k).join(v);
      }
      gameArgs.push(resolved);
    }
  } else if (versionJson.arguments?.game && Array.isArray(versionJson.arguments.game)) {
    // Modern & 2026+ Minecraft (1.13 - 1.21.4 - 26.3+)
    // Evaluating versionJson.arguments.game avoids passing removed flags like --userType on 26.3
    for (const item of versionJson.arguments.game) {
      if (typeof item === 'string') {
        let resolved = item;
        for (const [k, v] of Object.entries(gameRepMap)) {
          resolved = resolved.split(k).join(v);
        }
        gameArgs.push(resolved);
      }
      // Conditional feature blocks (is_demo_user, has_custom_resolution, is_quick_play_*) are handled below
    }
  } else {
    gameArgs.push(
      '--username',
      activeAccount.username,
      '--version',
      instance.customVersionId || instance.mcVersion,
      '--gameDir',
      instDir,
      '--assetsDir',
      assetsDir,
      '--assetIndex',
      assetIndexId,
      '--uuid',
      activeAccount.uuid,
      '--accessToken',
      activeAccount.accessToken || '0',
      '--versionType',
      'release'
    );
  }

  // Append loader-specific game arguments (e.g. NeoForge / Forge --launchTarget)
  if (loaderJson?.arguments?.game && Array.isArray(loaderJson.arguments.game)) {
    for (const gArg of loaderJson.arguments.game) {
      if (typeof gArg === 'string') {
        let resolved = gArg;
        for (const [k, v] of Object.entries(gameRepMap)) {
          resolved = resolved.split(k).join(v);
        }
        gameArgs.push(resolved);
      }
    }
  }

  // Only append --width / --height / --fullscreen for versions >= 1.6 (pre-1.6 uses positional args in Minecraft.main!)
  const supportsResolutionFlags =
    !versionJson.minecraftArguments || versionJson.minecraftArguments.includes('--version');
  if (supportsResolutionFlags) {
    if (instance.fullscreen) {
      gameArgs.push('--fullscreen');
    } else {
      gameArgs.push(
        '--width',
        String(Number(instance.width) || 1280),
        '--height',
        String(Number(instance.height) || 720)
      );
    }
  }

  const finalSpawnArgs = [...jvmArgs, mainClass, ...gameArgs];

  // Update lastPlayed
  instance.lastPlayed = new Date().toISOString();
  fs.writeFileSync(metaPath, JSON.stringify(instance, null, 2), 'utf8');

  const startTime = Date.now();

  try {
    const childProc = spawn(javaPath, finalSpawnArgs, {
      cwd: instDir,
      detached: false,
    });

    runningGames.set(instanceId, childProc);
    sendToRenderer('game:state', {
      instanceId,
      status: 'running',
      message: 'Minecraft est en cours d’exécution',
    });

    childProc.stdout.on('data', (data) => {
      const lines = data.toString('utf8').split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        sendToRenderer('game:log', { instanceId, level: 'stdout', text: line });
      }
    });

    childProc.stderr.on('data', (data) => {
      const lines = data.toString('utf8').split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        sendToRenderer('game:log', { instanceId, level: 'warn', text: line });
      }
    });

    childProc.on('error', (err) => {
      runningGames.delete(instanceId);
      sendToRenderer('game:log', {
        instanceId,
        level: 'error',
        text: `[Erreur Processus Java] ${err.message}`,
      });
      sendToRenderer('game:state', {
        instanceId,
        status: 'error',
        message: err.message,
      });
    });

    childProc.on('close', (code) => {
      runningGames.delete(instanceId);
      const elapsedMins = Math.max(1, Math.round((Date.now() - startTime) / 60000));
      try {
        const cur = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        cur.playtimeMinutes = (cur.playtimeMinutes || 0) + elapsedMins;
        fs.writeFileSync(metaPath, JSON.stringify(cur, null, 2), 'utf8');
      } catch {}

      sendToRenderer('game:log', {
        instanceId,
        level: code === 0 ? 'info' : 'warn',
        text: `[LuminaMC] Processus Minecraft terminé (code: ${code}).`,
      });
      sendToRenderer('game:state', { instanceId, status: 'stopped', code });
    });

    return { status: 'launched', instanceId };
  } catch (err) {
    runningGames.delete(instanceId);
    sendToRenderer('game:log', {
      instanceId,
      level: 'error',
      text: `[Erreur Lancement] ${err.message}`,
    });
    sendToRenderer('game:state', {
      instanceId,
      status: 'error',
      message: err.message,
    });
    throw err;
  }
});

ipcMain.handle('game:stop', async (_e, instanceId) => {
  const proc = runningGames.get(instanceId);
  if (proc) {
    try {
      proc.kill();
    } catch {}
    runningGames.delete(instanceId);
  }
  sendToRenderer('game:state', { instanceId, status: 'stopped', code: -1 });
  return true;
});

