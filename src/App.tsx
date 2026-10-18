import React, { useEffect, useState } from 'react';
import {
  Box,
  Check,
  Clock,
  Compass,
  Cpu,
  Download,
  FolderOpen,
  Home,
  Layers,
  Minus,
  Package,
  Palette,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Square,
  Terminal,
  Upload,
  User,
  Users,
  X,
  Maximize2,
} from 'lucide-react';
import {
  Account,
  CatalogProgressEvent,
  ContentCategory,
  GameLogEntry,
  GameProgressEvent,
  GameStateEvent,
  JavaProgressEvent,
  LauncherSettings,
  MinecraftInstance,
  WardrobeSkin,
} from './types/launcher';
import { launcherBridge } from './services/bridge';
import { CreateInstanceModal } from './components/CreateInstanceModal';
import { InstanceDetailView } from './components/InstanceDetailView';
import { CatalogExplorerView } from './components/CatalogExplorerView';
import { SkinManagerView } from './components/SkinManagerView';
import { AccountsView } from './components/AccountsView';
import { ConsoleLogsView } from './components/ConsoleLogsView';
import { SettingsView } from './components/SettingsView';

type NavTab = 'home' | 'instances' | 'explore' | 'skins' | 'accounts' | 'console' | 'settings';

export const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState<NavTab>('home');
  const [instances, setInstances] = useState<MinecraftInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [inspectingInstanceId, setInspectingInstanceId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [wardrobe, setWardrobe] = useState<WardrobeSkin[]>([]);
  const [settings, setSettings] = useState<LauncherSettings>({
    minRamMb: 2048,
    maxRamMb: 4096,
    width: 1280,
    height: 720,
    fullscreen: false,
    javaPath: '',
    jvmArgs: '-XX:+UseG1GC',
    curseforgeApiKey: '',
    closeLauncherOnPlay: false,
    concurrentDownloads: 6,
    themeAccent: 'indigo',
    glassBlur: 24,
    backgroundStyle: 'aurora',
  });

  const [explorerCategory, setExplorerCategory] = useState<ContentCategory>('mod');

  // Real-time game state, installation state, progress & logs
  const [runningIds, setRunningIds] = useState<string[]>([]);
  const [installingIds, setInstallingIds] = useState<string[]>([]);
  const [gameStateMap, setGameStateMap] = useState<Record<string, GameStateEvent>>({});
  const [gameProgressMap, setGameProgressMap] = useState<Record<string, GameProgressEvent>>({});
  const [catalogProgressMap, setCatalogProgressMap] = useState<Record<string, CatalogProgressEvent>>({});
  const [javaProgress, setJavaProgress] = useState<JavaProgressEvent | null>(null);
  const [logs, setLogs] = useState<GameLogEntry[]>([]);

  useEffect(() => {
    launcherBridge.getInitialData().then((data) => {
      if (data.config?.settings) setSettings(data.config.settings);
      if (data.config?.accounts) setAccounts(data.config.accounts);
      if (data.config?.activeAccountId) setActiveAccountId(data.config.activeAccountId);
      if (data.config?.wardrobe) setWardrobe(data.config.wardrobe);
      if (data.instances?.length) {
        setInstances(data.instances);
        setSelectedInstanceId(data.instances[0].id);
      }
      if (data.runningInstanceIds) setRunningIds(data.runningInstanceIds);
    });

    const unsubLog = launcherBridge.onGameLog((entry) => {
      const now = new Date().toLocaleTimeString();
      setLogs((prev) => [
        ...prev.slice(-400),
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: now,
          ...entry,
        },
      ]);
    });

    const unsubProg = launcherBridge.onGameProgress((prog) => {
      setGameProgressMap((prev) => ({ ...prev, [prog.instanceId]: prog }));
    });

    const unsubState = launcherBridge.onGameState((st) => {
      setGameStateMap((prev) => ({ ...prev, [st.instanceId]: st }));
      if (st.status === 'running') {
        setRunningIds((prev) => (prev.includes(st.instanceId) ? prev : [...prev, st.instanceId]));
        setInstallingIds((prev) => prev.filter((id) => id !== st.instanceId));
      } else if (st.status === 'installing' || st.status === 'downloading' || st.status === 'downloading-java') {
        setInstallingIds((prev) => (prev.includes(st.instanceId) ? prev : [...prev, st.instanceId]));
      } else if (st.status === 'installed') {
        setInstallingIds((prev) => prev.filter((id) => id !== st.instanceId));
        launcherBridge.getInitialData().then((d) => {
          if (d.instances) setInstances(d.instances);
        });
      } else if (st.status === 'stopped' || st.status === 'error') {
        setRunningIds((prev) => prev.filter((id) => id !== st.instanceId));
        setInstallingIds((prev) => prev.filter((id) => id !== st.instanceId));
      }
    });

    const unsubJava = launcherBridge.onJavaProgress((jp) => {
      setJavaProgress(jp);
    });

    const unsubCatalog = launcherBridge.onCatalogProgress((cp) => {
      setCatalogProgressMap((prev) => ({ ...prev, [cp.projectId]: cp }));
    });

    return () => {
      unsubLog();
      unsubProg();
      unsubState();
      unsubJava();
      unsubCatalog();
    };
  }, []);

  // Apply dynamic glass blur CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--glass-blur', `${settings.glassBlur || 24}px`);
  }, [settings.glassBlur]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0] || null;
  const activeInstance =
    instances.find((i) => i.id === selectedInstanceId) || instances[0] || null;
  const inspectingInstance =
    instances.find((i) => i.id === inspectingInstanceId) || null;

  const handleInstall = async (instanceId: string) => {
    try {
      setInstallingIds((prev) => (prev.includes(instanceId) ? prev : [...prev, instanceId]));
      const res = await launcherBridge.installInstance(instanceId);
      if (res?.instances) {
        setInstances(res.instances);
      }
    } catch (err: any) {
      alert(`Erreur lors du téléchargement de l’instance : ${err.message}`);
    } finally {
      setInstallingIds((prev) => prev.filter((id) => id !== instanceId));
    }
  };

  const handleLaunch = async (instanceId: string) => {
    try {
      await launcherBridge.launchInstance(instanceId);
    } catch (err: any) {
      alert(`Erreur au lancement : ${err.message}`);
    }
  };

  const handleStop = async (instanceId: string) => {
    await launcherBridge.stopInstance(instanceId);
  };

  const handleImportModpack = async () => {
    try {
      const res = await launcherBridge.importModpackFile();
      if (res?.instances) {
        setInstances(res.instances);
        if (res.instanceId) setSelectedInstanceId(res.instanceId);
      }
    } catch (err: any) {
      alert(`Erreur lors de l'import du Modpack : ${err.message}`);
    }
  };

  const openExplorerFor = (instanceId: string, category: ContentCategory) => {
    setSelectedInstanceId(instanceId);
    setExplorerCategory(category);
    setActiveNav('explore');
  };

  const isInstanceRunning = (id: string) => {
    const st = gameStateMap[id]?.status;
    return runningIds.includes(id) || st === 'running' || st === 'preparing';
  };

  const isInstanceInstalling = (id: string) => {
    const st = gameStateMap[id]?.status;
    return (
      installingIds.includes(id) ||
      st === 'installing' ||
      st === 'downloading' ||
      st === 'downloading-java'
    );
  };

  return (
    <div className="app-shell" data-accent={settings.themeAccent || 'indigo'}>
      {/* Ambient Glassmorphism Aurora Background */}
      <div className="ambient-canvas">
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />
        <div className="ambient-orb orb-3" />
        <div className="ambient-grid" />
      </div>

      {/* Custom Frameless Glass TitleBar */}
      <header className="titlebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="./icon.svg"
            alt="LuminaMC"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 10px var(--accent-glow))',
            }}
          />
          <span className="heading-font" style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.02em' }}>
            LUMINA<span style={{ color: 'var(--accent-secondary)' }}>MC</span>
          </span>
          <span className="glass-pill mono" style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
            MULTIVERSION • MODRINTH & CURSEFORGE
          </span>
        </div>

        <div className="titlebar-no-drag" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Active Account Pill */}
          {activeAccount && (
            <button
              className="btn btn-glass"
              style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12 }}
              onClick={() => setActiveNav('accounts')}
            >
              <img
                src={`https://minotar.net/helm/${encodeURIComponent(activeAccount.username)}/24.png`}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://minotar.net/helm/MHF_Steve/24.png';
                }}
                alt=""
                style={{ width: 18, height: 18, borderRadius: 4, imageRendering: 'pixelated' }}
              />
              <span>{activeAccount.username}</span>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: activeAccount.type === 'microsoft' ? '#38bdf8' : '#10b981',
                }}
              />
            </button>
          )}

          {/* Window Controls */}
          <button
            className="btn btn-glass"
            style={{ padding: 6, borderRadius: 7 }}
            onClick={() => launcherBridge.minimizeWindow()}
            title="Réduire"
          >
            <Minus size={13} />
          </button>
          <button
            className="btn btn-glass"
            style={{ padding: 6, borderRadius: 7 }}
            onClick={() => launcherBridge.maximizeWindow()}
            title="Agrandir"
          >
            <Maximize2 size={13} />
          </button>
          <button
            className="btn btn-danger"
            style={{ padding: 6, borderRadius: 7 }}
            onClick={() => launcherBridge.closeWindow()}
            title="Fermer"
          >
            <X size={13} />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="workspace">
        {/* Left Minimalist Glass Dock */}
        <aside className="sidebar-dock">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                padding: '4px 12px 6px',
                textTransform: 'uppercase',
              }}
            >
              Navigation
            </div>

            <button
              className={`nav-item ${activeNav === 'home' ? 'active' : ''}`}
              onClick={() => {
                setInspectingInstanceId(null);
                setActiveNav('home');
              }}
            >
              <Home size={17} className="nav-icon" />
              <span>Accueil & Jeu</span>
            </button>

            <button
              className={`nav-item ${activeNav === 'instances' ? 'active' : ''}`}
              onClick={() => setActiveNav('instances')}
            >
              <Layers size={17} className="nav-icon" />
              <span style={{ flex: 1 }}>Instances</span>
              <span className="glass-pill mono" style={{ padding: '1px 7px', fontSize: 10.5 }}>
                {instances.length}
              </span>
            </button>

            <button
              className={`nav-item ${activeNav === 'explore' ? 'active' : ''}`}
              onClick={() => setActiveNav('explore')}
            >
              <Compass size={17} className="nav-icon" />
              <span>Modrinth & CurseForge</span>
            </button>

            <button
              className={`nav-item ${activeNav === 'skins' ? 'active' : ''}`}
              onClick={() => setActiveNav('skins')}
            >
              <User size={17} className="nav-icon" />
              <span>Skins 3D & Garde-Robe</span>
            </button>

            <button
              className={`nav-item ${activeNav === 'accounts' ? 'active' : ''}`}
              onClick={() => setActiveNav('accounts')}
            >
              <Users size={17} className="nav-icon" />
              <span>Comptes MS & Offline</span>
            </button>

            <button
              className={`nav-item ${activeNav === 'console' ? 'active' : ''}`}
              onClick={() => setActiveNav('console')}
            >
              <Terminal size={17} className="nav-icon" />
              <span style={{ flex: 1 }}>Console Live</span>
              {(runningIds.length > 0 || installingIds.length > 0) && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: runningIds.length > 0 ? '#10b981' : '#38bdf8',
                    boxShadow: `0 0 8px ${runningIds.length > 0 ? '#10b981' : '#38bdf8'}`,
                  }}
                />
              )}
            </button>

            <button
              className={`nav-item ${activeNav === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveNav('settings')}
            >
              <Settings size={17} className="nav-icon" />
              <span>Paramètres & Java</span>
            </button>
          </div>

          {/* Bottom Quick Launch / Install Card inside Sidebar */}
          {activeInstance && (
            <div
              className="glass-card"
              style={{
                padding: 13,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                background: 'rgba(12, 17, 30, 0.72)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  INSTANCE SÉLECTIONNÉE
                </span>
                <span
                  className="glass-pill mono"
                  style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    color: activeInstance.isInstalled ? '#34d399' : '#fbbf24',
                  }}
                >
                  {activeInstance.isInstalled ? '✓ Prête' : 'À télécharger'}
                </span>
              </div>

              <select
                className="glass-select"
                style={{ padding: '7px 10px', fontSize: 12.5, fontWeight: 600 }}
                value={activeInstance.id}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
              >
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} ({inst.mcVersion})
                  </option>
                ))}
              </select>

              {isInstanceRunning(activeInstance.id) ? (
                <button
                  className="btn btn-danger"
                  style={{ width: '100%', padding: '10px' }}
                  onClick={() => handleStop(activeInstance.id)}
                >
                  <Square size={14} fill="currentColor" /> Arrêter le jeu
                </button>
              ) : isInstanceInstalling(activeInstance.id) ? (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px' }}
                  disabled
                >
                  <RefreshCw size={14} /> Installation...
                </button>
              ) : !activeInstance.isInstalled ? (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px 14px', fontSize: 13 }}
                  onClick={() => handleInstall(activeInstance.id)}
                >
                  <Download size={15} /> TÉLÉCHARGER
                </button>
              ) : (
                <button
                  className="btn-launch"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontSize: 13.5 }}
                  onClick={() => handleLaunch(activeInstance.id)}
                >
                  <Play size={15} fill="currentColor" /> LANCER LE JEU
                </button>
              )}
            </div>
          )}
        </aside>

        {/* Main Glass Stage */}
        <main className="main-stage">
          <div className="stage-scroll">
            {/* ============================================================== */}
            {/* TAB: HOME */}
            {/* ============================================================== */}
            {activeNav === 'home' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {/* Hero Banner for Active Instance */}
                {activeInstance && (
                  <div
                    className="glass-card"
                    style={{
                      padding: 28,
                      position: 'relative',
                      overflow: 'hidden',
                      background: `radial-gradient(circle at 85% 20%, ${
                        activeInstance.accentColor || '#6366f1'
                      }35 0%, rgba(16, 22, 38, 0.78) 70%)`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 20,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ maxWidth: 620 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                          <span
                            className="glass-pill mono"
                            style={{
                              background: `${activeInstance.accentColor || '#6366f1'}30`,
                              borderColor: `${activeInstance.accentColor || '#6366f1'}66`,
                              color: '#fff',
                            }}
                          >
                            MINECRAFT {activeInstance.mcVersion}
                          </span>
                          <span className="glass-pill" style={{ textTransform: 'uppercase' }}>
                            {activeInstance.loader} {activeInstance.loaderVersion}
                          </span>
                          {activeInstance.isInstalled ? (
                            <span
                              className="glass-pill"
                              style={{
                                background: 'rgba(16, 185, 129, 0.2)',
                                borderColor: 'rgba(16, 185, 129, 0.4)',
                                color: '#34d399',
                              }}
                            >
                              <Check size={11} /> Instance téléchargée & prête
                            </span>
                          ) : (
                            <span
                              className="glass-pill"
                              style={{
                                background: 'rgba(245, 158, 11, 0.18)',
                                borderColor: 'rgba(245, 158, 11, 0.4)',
                                color: '#fbbf24',
                              }}
                            >
                              <Download size={11} /> Téléchargement requis
                            </span>
                          )}
                          <span className="glass-pill mono" style={{ color: 'var(--text-secondary)' }}>
                            <Cpu size={11} /> {(activeInstance.maxRamMb / 1024).toFixed(1)} Go RAM
                          </span>
                          <span className="glass-pill" style={{ color: 'var(--text-secondary)' }}>
                            <Clock size={11} /> {activeInstance.playtimeMinutes || 0} min jouées
                          </span>
                        </div>

                        <h1 className="heading-font" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15 }}>
                          {activeInstance.name}
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8, lineHeight: 1.55 }}>
                          {activeInstance.description}
                        </p>

                        {/* Quick Content Counters */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-glass"
                            onClick={() => {
                              setInspectingInstanceId(activeInstance.id);
                              setActiveNav('instances');
                            }}
                          >
                            <Box size={14} color="var(--accent-secondary)" />
                            {activeInstance.counts?.mods ?? 0} Mods
                          </button>
                          <button
                            className="btn btn-glass"
                            onClick={() => openExplorerFor(activeInstance.id, 'shader')}
                          >
                            <Sparkles size={14} color="#f59e0b" />
                            {activeInstance.counts?.shaders ?? 0} Shaders
                          </button>
                          <button
                            className="btn btn-glass"
                            onClick={() => openExplorerFor(activeInstance.id, 'resourcepack')}
                          >
                            <Palette size={14} color="#ec4899" />
                            {activeInstance.counts?.resourcepacks ?? 0} Packs de Textures
                          </button>
                          <button
                            className="btn btn-glass"
                            onClick={() => openExplorerFor(activeInstance.id, 'datapack')}
                          >
                            <Layers size={14} color="#a855f7" />
                            {activeInstance.counts?.datapacks ?? 0} Datapacks
                          </button>
                          <button
                            className="btn btn-glass"
                            onClick={() => {
                              setInspectingInstanceId(activeInstance.id);
                              setActiveNav('instances');
                            }}
                          >
                            <Settings size={14} /> Réglages & Contenu
                          </button>
                        </div>
                      </div>

                      {/* Right Action Box: Separate Download vs Launch */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        {isInstanceRunning(activeInstance.id) ? (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '14px 30px', fontSize: 15 }}
                            onClick={() => handleStop(activeInstance.id)}
                          >
                            <Square size={17} fill="currentColor" /> ARRÊTER MINECRAFT
                          </button>
                        ) : isInstanceInstalling(activeInstance.id) ? (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '14px 28px', fontSize: 15 }}
                            disabled
                          >
                            <RefreshCw size={17} /> TÉLÉCHARGEMENT EN COURS...
                          </button>
                        ) : !activeInstance.isInstalled ? (
                          <button
                            className="btn-launch"
                            style={{
                              background: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
                            }}
                            onClick={() => handleInstall(activeInstance.id)}
                          >
                            <Download size={18} /> TÉLÉCHARGER L’INSTANCE
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                              className="btn btn-glass"
                              style={{ padding: '13px 16px' }}
                              onClick={() => handleInstall(activeInstance.id)}
                              title="Vérifier ou re-télécharger les fichiers de l'instance"
                            >
                              <Download size={16} /> Vérifier fichiers
                            </button>
                            <button
                              className="btn-launch"
                              onClick={() => handleLaunch(activeInstance.id)}
                            >
                              <Play size={18} fill="currentColor" /> LANCER LE JEU
                            </button>
                          </div>
                        )}

                        <button
                          className="btn btn-glass"
                          onClick={() => launcherBridge.openInstanceFolder(activeInstance.id)}
                        >
                          <FolderOpen size={14} /> Ouvrir le dossier .minecraft de l’instance
                        </button>
                      </div>
                    </div>

                    {/* Live Installation / Launch Progress Bar */}
                    {gameStateMap[activeInstance.id] &&
                      gameStateMap[activeInstance.id].status !== 'stopped' && (
                        <div
                          style={{
                            marginTop: 20,
                            paddingTop: 16,
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                            <span
                              style={{
                                color:
                                  gameStateMap[activeInstance.id].status === 'error'
                                    ? '#fb7185'
                                    : gameStateMap[activeInstance.id].status === 'installed'
                                    ? '#34d399'
                                    : 'var(--accent-secondary)',
                                fontWeight: 600,
                              }}
                            >
                              {gameStateMap[activeInstance.id].message || 'Opération en cours...'}
                            </span>
                            {gameProgressMap[activeInstance.id] && (
                              <span className="mono">
                                {gameProgressMap[activeInstance.id].type} ({gameProgressMap[activeInstance.id].task}/
                                {gameProgressMap[activeInstance.id].total}) •{' '}
                                {gameProgressMap[activeInstance.id].percent}%
                              </span>
                            )}
                          </div>
                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${
                                  gameStateMap[activeInstance.id].status === 'running' ||
                                  gameStateMap[activeInstance.id].status === 'installed'
                                    ? 100
                                    : gameProgressMap[activeInstance.id]?.percent || 15
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {/* Quick Ecosystem Hub (Mods, Shaders, Texture Packs, Datapacks, Modpacks) */}
                <div>
                  <h2 className="heading-font" style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>
                    Catalogue Rapide — Modrinth & CurseForge
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                    {(
                      [
                        { id: 'mod', title: 'Mods', sub: 'Fabric, NeoForge, Forge, Quilt', icon: Box, color: '#38bdf8' },
                        { id: 'shader', title: 'Shaders', sub: 'Iris, Complementary, BSL...', icon: Sparkles, color: '#f59e0b' },
                        { id: 'resourcepack', title: 'Textures', sub: 'Packs HD, PBR, Faithless...', icon: Palette, color: '#ec4899' },
                        { id: 'datapack', title: 'Datapacks', sub: 'Terralith, Donjons, Structures', icon: Layers, color: '#a855f7' },
                        { id: 'modpack', title: 'Modpacks', sub: 'Packs complets 1-clic', icon: Package, color: '#10b981' },
                      ] as const
                    ).map((card) => {
                      const IconComp = card.icon;
                      return (
                        <div
                          key={card.id}
                          className="glass-card glass-card-interactive"
                          style={{ padding: 16, cursor: 'pointer' }}
                          onClick={() =>
                            openExplorerFor(activeInstance?.id || '', card.id as ContentCategory)
                          }
                        >
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 10,
                              background: `${card.color}22`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: 10,
                            }}
                          >
                            <IconComp size={19} color={card.color} />
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{card.title}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {card.sub}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* All Instances Grid */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h2 className="heading-font" style={{ fontSize: 17, fontWeight: 700 }}>
                      Vos Instances ({instances.length})
                    </h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-glass" onClick={handleImportModpack}>
                        <Upload size={14} /> Importer Modpack (.mrpack)
                      </button>
                      <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <Plus size={15} /> Nouvelle Instance
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 14 }}>
                    {instances.map((inst) => {
                      const isSel = inst.id === activeInstance?.id;
                      const running = isInstanceRunning(inst.id);
                      const installing = isInstanceInstalling(inst.id);
                      return (
                        <div
                          key={inst.id}
                          className="glass-card glass-card-interactive"
                          style={{
                            padding: 18,
                            cursor: 'pointer',
                            borderColor: isSel ? inst.accentColor || 'var(--accent-primary)' : undefined,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 14,
                          }}
                          onClick={() => setSelectedInstanceId(inst.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ display: 'flex', gap: 12 }}>
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 12,
                                  background: `${inst.accentColor || '#6366f1'}28`,
                                  border: `1px solid ${inst.accentColor || '#6366f1'}66`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <Sparkles size={20} color={inst.accentColor || '#6366f1'} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 15 }}>{inst.name}</div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                  <span className="glass-pill mono" style={{ fontSize: 10.5, padding: '1px 7px' }}>
                                    {inst.mcVersion}
                                  </span>
                                  <span
                                    className="glass-pill"
                                    style={{ fontSize: 10.5, padding: '1px 7px', textTransform: 'uppercase' }}
                                  >
                                    {inst.loader}
                                  </span>
                                  <span
                                    className="glass-pill"
                                    style={{
                                      fontSize: 10,
                                      padding: '1px 7px',
                                      color: inst.isInstalled ? '#34d399' : '#fbbf24',
                                    }}
                                  >
                                    {inst.isInstalled ? '✓ Prête' : 'À télécharger'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              className="btn btn-glass"
                              style={{ padding: '6px 9px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectingInstanceId(inst.id);
                                setActiveNav('instances');
                              }}
                              title="Gérer les mods, shaders et réglages de cette instance"
                            >
                              <Settings size={14} />
                            </button>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingTop: 10,
                              borderTop: '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                              <span>{inst.counts?.mods ?? 0} mods</span>
                              <span>•</span>
                              <span>{inst.counts?.shaders ?? 0} shaders</span>
                              <span>•</span>
                              <span>{(inst.maxRamMb / 1024).toFixed(1)}G</span>
                            </div>

                            {running ? (
                              <button
                                className="btn btn-danger"
                                style={{ padding: '6px 12px', fontSize: 12 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStop(inst.id);
                                }}
                              >
                                <Square size={12} fill="currentColor" /> Stop
                              </button>
                            ) : installing ? (
                              <button
                                className="btn btn-glass"
                                style={{ padding: '6px 12px', fontSize: 12 }}
                                disabled
                              >
                                <RefreshCw size={12} /> {gameProgressMap[inst.id]?.percent ?? 0}%
                              </button>
                            ) : !inst.isInstalled ? (
                              <button
                                className="btn btn-glass"
                                style={{
                                  padding: '6px 13px',
                                  fontSize: 12,
                                  borderColor: 'rgba(56, 189, 248, 0.45)',
                                  color: '#38bdf8',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedInstanceId(inst.id);
                                  handleInstall(inst.id);
                                }}
                              >
                                <Download size={12} /> Télécharger
                              </button>
                            ) : (
                              <button
                                className="btn btn-primary"
                                style={{ padding: '6px 14px', fontSize: 12 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedInstanceId(inst.id);
                                  handleLaunch(inst.id);
                                }}
                              >
                                <Play size={12} fill="currentColor" /> Lancer
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB: INSTANCES & DETAIL INSPECTOR */}
            {/* ============================================================== */}
            {activeNav === 'instances' && (
              <>
                {inspectingInstance ? (
                  <InstanceDetailView
                    instance={inspectingInstance}
                    isRunning={isInstanceRunning(inspectingInstance.id)}
                    isInstalling={isInstanceInstalling(inspectingInstance.id)}
                    onBack={() => setInspectingInstanceId(null)}
                    onInstall={handleInstall}
                    onLaunch={handleLaunch}
                    onStop={handleStop}
                    onInstancesUpdated={setInstances}
                    onOpenExplorerFor={openExplorerFor}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <h2 className="heading-font" style={{ fontSize: 22, fontWeight: 800 }}>
                          Gestionnaire d’Instances Multiversion
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                          Téléchargez d’abord une instance en 1 clic, puis lancez-la instantanément ou gérez ses Mods, Shaders, Textures et Réglages.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-glass" onClick={handleImportModpack}>
                          <Upload size={15} /> Importer un Modpack (.mrpack)
                        </button>
                        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                          <Plus size={16} /> Créer une Instance
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 16 }}>
                      {instances.map((inst) => {
                        const running = isInstanceRunning(inst.id);
                        const installing = isInstanceInstalling(inst.id);
                        return (
                          <div
                            key={inst.id}
                            className="glass-card glass-card-interactive"
                            style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}
                          >
                            <div style={{ display: 'flex', gap: 14 }}>
                              <div
                                style={{
                                  width: 50,
                                  height: 50,
                                  borderRadius: 14,
                                  background: `${inst.accentColor || '#6366f1'}28`,
                                  border: `1px solid ${inst.accentColor || '#6366f1'}66`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <Sparkles size={22} color={inst.accentColor || '#6366f1'} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{inst.name}</h3>
                                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                  <span className="glass-pill mono" style={{ fontSize: 10.5 }}>
                                    MC {inst.mcVersion}
                                  </span>
                                  <span className="glass-pill" style={{ fontSize: 10.5, textTransform: 'uppercase' }}>
                                    {inst.loader} {inst.loaderVersion}
                                  </span>
                                  <span
                                    className="glass-pill"
                                    style={{
                                      fontSize: 10.5,
                                      color: inst.isInstalled ? '#34d399' : '#fbbf24',
                                    }}
                                  >
                                    {inst.isInstalled ? '✓ Installée' : 'À télécharger'}
                                  </span>
                                </div>
                                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8 }}>
                                  {inst.description}
                                </p>
                              </div>
                            </div>

                            {installing && (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--accent-secondary)', marginBottom: 4 }}>
                                  <span>{gameStateMap[inst.id]?.message || 'Téléchargement...'}</span>
                                  <span className="mono">{gameProgressMap[inst.id]?.percent ?? 0}%</span>
                                </div>
                                <div className="progress-track">
                                  <div
                                    className="progress-fill"
                                    style={{ width: `${gameProgressMap[inst.id]?.percent ?? 15}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 6,
                                padding: 10,
                                borderRadius: 10,
                                background: 'rgba(0,0,0,0.22)',
                                textAlign: 'center',
                                fontSize: 11.5,
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, color: '#fff' }}>{inst.counts?.mods ?? 0}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Mods</div>
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#fff' }}>{inst.counts?.shaders ?? 0}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Shaders</div>
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#fff' }}>{inst.counts?.resourcepacks ?? 0}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Textures</div>
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#fff' }}>{inst.counts?.datapacks ?? 0}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Datapacks</div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                className="btn btn-glass"
                                style={{ flex: 1 }}
                                onClick={() => setInspectingInstanceId(inst.id)}
                              >
                                <Settings size={14} /> Contenu & Réglages
                              </button>

                              {running ? (
                                <button
                                  className="btn btn-danger"
                                  onClick={() => handleStop(inst.id)}
                                >
                                  <Square size={14} fill="currentColor" /> Arrêter
                                </button>
                              ) : installing ? (
                                <button className="btn btn-glass" disabled>
                                  <RefreshCw size={14} /> Installation...
                                </button>
                              ) : !inst.isInstalled ? (
                                <button
                                  className="btn btn-primary"
                                  onClick={() => {
                                    setSelectedInstanceId(inst.id);
                                    handleInstall(inst.id);
                                  }}
                                >
                                  <Download size={14} /> Télécharger
                                </button>
                              ) : (
                                <button
                                  className="btn btn-primary"
                                  onClick={() => {
                                    setSelectedInstanceId(inst.id);
                                    handleLaunch(inst.id);
                                  }}
                                >
                                  <Play size={14} fill="currentColor" /> Lancer
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ============================================================== */}
            {/* TAB: EXPLORE MODRINTH & CURSEFORGE */}
            {/* ============================================================== */}
            {activeNav === 'explore' && (
              <CatalogExplorerView
                instances={instances}
                selectedInstanceId={selectedInstanceId}
                onSelectInstance={setSelectedInstanceId}
                initialCategory={explorerCategory}
                catalogProgress={catalogProgressMap}
                onInstancesUpdated={setInstances}
              />
            )}

            {/* ============================================================== */}
            {/* TAB: 3D SKIN STUDIO & WARDROBE */}
            {/* ============================================================== */}
            {activeNav === 'skins' && (
              <SkinManagerView
                activeAccount={activeAccount}
                wardrobe={wardrobe}
                onWardrobeUpdated={setWardrobe}
                onAccountSkinUpdated={(accs, activeId) => {
                  setAccounts(accs);
                  setActiveAccountId(activeId);
                }}
              />
            )}

            {/* ============================================================== */}
            {/* TAB: ACCOUNTS (MICROSOFT OAUTH & OFFLINE) */}
            {/* ============================================================== */}
            {activeNav === 'accounts' && (
              <AccountsView
                accounts={accounts}
                activeAccountId={activeAccountId}
                onAccountsUpdated={(accs, activeId) => {
                  setAccounts(accs);
                  setActiveAccountId(activeId);
                }}
              />
            )}

            {/* ============================================================== */}
            {/* TAB: LIVE CONSOLE LOGS */}
            {/* ============================================================== */}
            {activeNav === 'console' && (
              <ConsoleLogsView
                logs={logs}
                instances={instances}
                onClearLogs={() => setLogs([])}
              />
            )}

            {/* ============================================================== */}
            {/* TAB: SETTINGS & JAVA MANAGER */}
            {/* ============================================================== */}
            {activeNav === 'settings' && (
              <SettingsView
                settings={settings}
                javaProgress={javaProgress}
                onSettingsUpdated={setSettings}
              />
            )}
          </div>
        </main>
      </div>

      {/* Create Instance Modal */}
      {showCreateModal && (
        <CreateInstanceModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(newList) => {
            setInstances(newList);
            if (newList.length > 0) setSelectedInstanceId(newList[0].id);
          }}
        />
      )}
    </div>
  );
};
