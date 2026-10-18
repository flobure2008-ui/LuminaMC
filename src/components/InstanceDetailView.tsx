import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Box,
  Check,
  Compass,
  Copy,
  Cpu,
  Download,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  Layers,
  Package,
  Palette,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ContentCategory,
  ContentFileItem,
  InstanceContentData,
  LoaderVersionItem,
  McVersionItem,
  MinecraftInstance,
  ModLoader,
} from '../types/launcher';
import { launcherBridge } from '../services/bridge';

interface InstanceDetailViewProps {
  instance: MinecraftInstance;
  isRunning: boolean;
  isInstalling: boolean;
  onBack: () => void;
  onInstall: (instanceId: string) => void;
  onLaunch: (instanceId: string) => void;
  onStop: (instanceId: string) => void;
  onInstancesUpdated: (list: MinecraftInstance[]) => void;
  onOpenExplorerFor: (instanceId: string, category: ContentCategory) => void;
}

type DetailTab = 'mods' | 'shaderpacks' | 'resourcepacks' | 'datapacks' | 'worlds' | 'screenshots' | 'settings';

export const InstanceDetailView: React.FC<InstanceDetailViewProps> = ({
  instance,
  isRunning,
  isInstalling,
  onBack,
  onInstall,
  onLaunch,
  onStop,
  onInstancesUpdated,
  onOpenExplorerFor,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('mods');
  const [content, setContent] = useState<InstanceContentData>({
    mods: [],
    shaderpacks: [],
    resourcepacks: [],
    datapacks: [],
    worlds: [],
    screenshots: [],
  });
  const [loadingContent, setLoadingContent] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  // Settings form state
  const [editName, setEditName] = useState(instance.name);
  const [editDesc, setEditDesc] = useState(instance.description || '');
  const [editMcVersion, setEditMcVersion] = useState(instance.mcVersion);
  const [editLoader, setEditLoader] = useState<ModLoader>(instance.loader);
  const [editLoaderVersion, setEditLoaderVersion] = useState(instance.loaderVersion || '');
  const [editMinRam, setEditMinRam] = useState(instance.minRamMb || 2048);
  const [editMaxRam, setEditMaxRam] = useState(instance.maxRamMb || 4096);
  const [editJvmArgs, setEditJvmArgs] = useState(instance.jvmArgs || '');
  const [editWidth, setEditWidth] = useState(instance.width || 1280);
  const [editHeight, setEditHeight] = useState(instance.height || 720);
  const [editFullscreen, setEditFullscreen] = useState(Boolean(instance.fullscreen));
  const [editJavaPath, setEditJavaPath] = useState(instance.javaPath || '');
  const [editAccent, setEditAccent] = useState(instance.accentColor || '#6366f1');
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const [mcVersions, setMcVersions] = useState<McVersionItem[]>([]);
  const [loaderVersions, setLoaderVersions] = useState<LoaderVersionItem[]>([]);

  const refreshContent = async () => {
    setLoadingContent(true);
    try {
      const res = await launcherBridge.getInstanceContent(instance.id);
      setContent(res);
    } finally {
      setLoadingContent(false);
    }
  };

  useEffect(() => {
    refreshContent();
    setEditName(instance.name);
    setEditDesc(instance.description || '');
    setEditMcVersion(instance.mcVersion);
    setEditLoader(instance.loader);
    setEditLoaderVersion(instance.loaderVersion || '');
    setEditMinRam(instance.minRamMb || 2048);
    setEditMaxRam(instance.maxRamMb || 4096);
    setEditJvmArgs(instance.jvmArgs || '');
    setEditWidth(instance.width || 1280);
    setEditHeight(instance.height || 720);
    setEditFullscreen(Boolean(instance.fullscreen));
    setEditJavaPath(instance.javaPath || '');
    setEditAccent(instance.accentColor || '#6366f1');
  }, [instance.id]);

  useEffect(() => {
    if (activeTab === 'settings') {
      launcherBridge.getMinecraftVersions().then((res) => setMcVersions(res.versions || []));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'settings' && editLoader !== 'vanilla') {
      launcherBridge.getLoaderVersions(editMcVersion, editLoader).then((vers) => {
        setLoaderVersions(vers || []);
      });
    }
  }, [activeTab, editMcVersion, editLoader]);

  const handleToggleItem = async (folderType: string, fileName: string) => {
    await launcherBridge.toggleContentItem(instance.id, folderType, fileName);
    await refreshContent();
  };

  const handleDeleteItem = async (folderType: string, fileName: string) => {
    await launcherBridge.deleteContentItem(instance.id, folderType, fileName);
    await refreshContent();
    const updatedList = await launcherBridge.updateInstance(instance.id, {});
    onInstancesUpdated(updatedList);
  };

  const handleImportLocal = async (folderType: string) => {
    const imported = await launcherBridge.importLocalContent(instance.id, folderType);
    if (imported) {
      await refreshContent();
      const updatedList = await launcherBridge.updateInstance(instance.id, {});
      onInstancesUpdated(updatedList);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const updated = await launcherBridge.updateInstance(instance.id, {
        name: editName.trim() || instance.name,
        description: editDesc,
        mcVersion: editMcVersion,
        loader: editLoader,
        loaderVersion: editLoader === 'vanilla' ? '' : editLoaderVersion,
        minRamMb: editMinRam,
        maxRamMb: Math.max(editMinRam, editMaxRam),
        jvmArgs: editJvmArgs,
        width: Number(editWidth) || 1280,
        height: Number(editHeight) || 720,
        fullscreen: editFullscreen,
        javaPath: editJavaPath,
        accentColor: editAccent,
      });
      onInstancesUpdated(updated);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDuplicate = async () => {
    const updated = await launcherBridge.duplicateInstance(instance.id);
    onInstancesUpdated(updated);
    onBack();
  };

  const handleDeleteInstance = async () => {
    if (window.confirm(`Supprimer définitivement l’instance "${instance.name}" et tous ses fichiers ?`)) {
      const updated = await launcherBridge.deleteInstance(instance.id);
      onInstancesUpdated(updated);
      onBack();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  };

  const renderContentList = (
    folderType: 'mods' | 'shaderpacks' | 'resourcepacks' | 'datapacks',
    items: ContentFileItem[],
    categoryForExplorer: ContentCategory,
    emptyLabel: string
  ) => {
    const filtered = items.filter(
      (i) =>
        i.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
        i.cleanFileName.toLowerCase().includes(filterQuery.toLowerCase())
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              className="glass-input"
              style={{ paddingLeft: 36 }}
              placeholder={`Filtrer dans ${folderType} (${items.length})...`}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={() => onOpenExplorerFor(instance.id, categoryForExplorer)}
            >
              <Compass size={15} /> Ajouter depuis Modrinth / CurseForge
            </button>
            <button className="btn btn-glass" onClick={() => handleImportLocal(folderType)}>
              <Upload size={15} /> Importer fichier local
            </button>
            <button
              className="btn btn-glass"
              onClick={() => launcherBridge.openInstanceFolder(instance.id, folderType)}
              title="Ouvrir le dossier dans l'Explorateur Windows"
            >
              <FolderOpen size={15} />
            </button>
            <button className="btn btn-glass" onClick={refreshContent} title="Actualiser">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div
            className="glass-card"
            style={{
              padding: '44px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Package size={36} color="var(--text-muted)" />
            <div style={{ fontWeight: 600, fontSize: 15 }}>{emptyLabel}</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 420 }}>
              Vous pouvez télécharger du contenu en 1 clic depuis Modrinth ou CurseForge, ou importer vos propres fichiers{' '}
              <code className="mono">{folderType === 'mods' ? '.jar' : '.zip'}</code>.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                className="btn btn-primary"
                onClick={() => onOpenExplorerFor(instance.id, categoryForExplorer)}
              >
                <Compass size={15} /> Parcourir Modrinth & CurseForge
              </button>
              <button className="btn btn-glass" onClick={() => handleImportLocal(folderType)}>
                <Upload size={15} /> Importer depuis le PC
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((item) => (
              <div
                key={item.fileName}
                className="glass-card"
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                  opacity: item.enabled ? 1 : 0.55,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  {item.iconUrl ? (
                    <img
                      src={item.iconUrl}
                      alt={item.title}
                      style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9,
                        background: 'rgba(255,255,255,0.07)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Box size={18} color="var(--accent-secondary)" />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </span>
                      {item.source !== 'local' && (
                        <span
                          className="glass-pill"
                          style={{
                            fontSize: 10,
                            padding: '1px 7px',
                            color: item.source === 'modrinth' ? 'var(--modrinth)' : 'var(--curseforge)',
                          }}
                        >
                          {item.source === 'modrinth' ? 'Modrinth' : 'CurseForge'}
                        </span>
                      )}
                      {!item.enabled && (
                        <span className="glass-pill" style={{ fontSize: 10, color: 'var(--warning)' }}>
                          Désactivé
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 10, marginTop: 2 }}>
                      <span>Par {item.author}</span>
                      <span>•</span>
                      <span className="mono">{item.cleanFileName}</span>
                      <span>•</span>
                      <span>{formatSize(item.sizeBytes)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div
                    className={`glass-switch ${item.enabled ? 'checked' : ''}`}
                    onClick={() => handleToggleItem(folderType, item.fileName)}
                    title={item.enabled ? 'Désactiver' : 'Activer'}
                  >
                    <div className="glass-switch-thumb" />
                  </div>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '7px 10px' }}
                    onClick={() => handleDeleteItem(folderType, item.fileName)}
                    title="Supprimer ce fichier"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Instance Header Banner */}
      <div
        className="glass-card"
        style={{
          padding: 20,
          background: `linear-gradient(135deg, ${instance.accentColor || '#6366f1'}22 0%, rgba(15, 20, 34, 0.72) 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn btn-glass" style={{ padding: '9px 11px' }} onClick={onBack}>
            <ArrowLeft size={16} />
          </button>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: `${instance.accentColor || '#6366f1'}33`,
              border: `1px solid ${instance.accentColor || '#6366f1'}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={24} color={instance.accentColor || '#6366f1'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 className="heading-font" style={{ fontSize: 21, fontWeight: 800 }}>
                {instance.name}
              </h2>
              <span className="glass-pill mono" style={{ color: 'var(--accent-secondary)' }}>
                MC {instance.mcVersion}
              </span>
              <span className="glass-pill" style={{ textTransform: 'uppercase' }}>
                {instance.loader} {instance.loaderVersion}
              </span>
              {instance.isInstalled ? (
                <span
                  className="glass-pill"
                  style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                >
                  <Check size={11} /> Prête à jouer
                </span>
              ) : (
                <span
                  className="glass-pill"
                  style={{ background: 'rgba(245, 158, 11, 0.18)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                >
                  <Download size={11} /> À télécharger
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: 3 }}>
              {instance.description || 'Instance personnalisée LuminaMC'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-glass"
            onClick={() => launcherBridge.openInstanceFolder(instance.id)}
            title="Ouvrir le dossier de l'instance"
          >
            <FolderOpen size={15} /> Dossier
          </button>

          {isRunning ? (
            <button className="btn btn-danger" style={{ padding: '11px 22px' }} onClick={() => onStop(instance.id)}>
              <Square size={15} fill="currentColor" /> Arrêter
            </button>
          ) : isInstalling ? (
            <button className="btn btn-primary" style={{ padding: '11px 22px' }} disabled>
              <RefreshCw size={15} /> Téléchargement...
            </button>
          ) : !instance.isInstalled ? (
            <button
              className="btn btn-primary"
              style={{ padding: '11px 22px', fontSize: 14 }}
              onClick={() => onInstall(instance.id)}
            >
              <Download size={16} /> Télécharger l’instance
            </button>
          ) : (
            <>
              <button
                className="btn btn-glass"
                onClick={() => onInstall(instance.id)}
                title="Vérifier ou re-télécharger les fichiers de l'instance"
              >
                <Download size={14} /> Vérifier fichiers
              </button>
              <button
                className="btn-launch"
                style={{ padding: '10px 22px', fontSize: 14 }}
                onClick={() => onLaunch(instance.id)}
              >
                <Play size={16} fill="currentColor" /> Lancer le jeu
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div className="segmented-tabs">
          <button
            className={`segmented-tab ${activeTab === 'mods' ? 'active' : ''}`}
            onClick={() => setActiveTab('mods')}
          >
            <Box size={14} /> Mods ({content.mods.length})
          </button>
          <button
            className={`segmented-tab ${activeTab === 'shaderpacks' ? 'active' : ''}`}
            onClick={() => setActiveTab('shaderpacks')}
          >
            <Sparkles size={14} /> Shaders ({content.shaderpacks.length})
          </button>
          <button
            className={`segmented-tab ${activeTab === 'resourcepacks' ? 'active' : ''}`}
            onClick={() => setActiveTab('resourcepacks')}
          >
            <Palette size={14} /> Resource Packs ({content.resourcepacks.length})
          </button>
          <button
            className={`segmented-tab ${activeTab === 'datapacks' ? 'active' : ''}`}
            onClick={() => setActiveTab('datapacks')}
          >
            <Layers size={14} /> Datapacks ({content.datapacks.length})
          </button>
          <button
            className={`segmented-tab ${activeTab === 'worlds' ? 'active' : ''}`}
            onClick={() => setActiveTab('worlds')}
          >
            <Globe size={14} /> Mondes ({content.worlds.length})
          </button>
          <button
            className={`segmented-tab ${activeTab === 'screenshots' ? 'active' : ''}`}
            onClick={() => setActiveTab('screenshots')}
          >
            <ImageIcon size={14} /> Captures ({content.screenshots.length})
          </button>
          <button
            className={`segmented-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={14} /> Réglages Instance
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'mods' &&
        renderContentList('mods', content.mods, 'mod', 'Aucun mod installé dans cette instance')}

      {activeTab === 'shaderpacks' &&
        renderContentList('shaderpacks', content.shaderpacks, 'shader', 'Aucun pack de shaders installé')}

      {activeTab === 'resourcepacks' &&
        renderContentList(
          'resourcepacks',
          content.resourcepacks,
          'resourcepack',
          'Aucun pack de textures (Resource Pack) installé'
        )}

      {activeTab === 'datapacks' &&
        renderContentList('datapacks', content.datapacks, 'datapack', 'Aucun Datapack installé')}

      {activeTab === 'worlds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Mondes sauvegardés dans <code className="mono">saves/</code>
            </span>
            <button
              className="btn btn-glass"
              onClick={() => launcherBridge.openInstanceFolder(instance.id, 'saves')}
            >
              <FolderOpen size={14} /> Ouvrir le dossier saves
            </button>
          </div>
          {content.worlds.length === 0 ? (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              Aucun monde solo trouvé pour le moment. Lancez l’instance pour créer votre premier monde !
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {content.worlds.map((w) => (
                <div key={w.name} className="glass-card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {w.iconDataUrl ? (
                      <img src={w.iconDataUrl} alt={w.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Globe size={22} color="var(--accent-secondary)" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{w.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {w.datapacksCount} datapack(s) • {new Date(w.modifiedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'screenshots' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Captures d’écran prises en jeu (F2)
            </span>
            <button
              className="btn btn-glass"
              onClick={() => launcherBridge.openInstanceFolder(instance.id, 'screenshots')}
            >
              <FolderOpen size={14} /> Ouvrir le dossier screenshots
            </button>
          </div>
          {content.screenshots.length === 0 ? (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              Aucune capture d’écran enregistrée dans cette instance (appuyez sur F2 en jeu).
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {content.screenshots.map((shot) => (
                <div key={shot.fileName} className="glass-card" style={{ overflow: 'hidden' }}>
                  <img
                    src={shot.dataUrl}
                    alt={shot.fileName}
                    style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ padding: '8px 12px', fontSize: 11.5, color: 'var(--text-secondary)' }} className="mono">
                    {shot.fileName}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="glass-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 className="heading-font" style={{ fontSize: 16.5, fontWeight: 700 }}>
                Configuration dédiée de l’instance
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Personnalisez la version Minecraft, le Modloader, la RAM, Java et les arguments JVM de cette instance.
              </p>
            </div>
            {savedToast && (
              <span className="glass-pill" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                ✓ Réglages sauvegardés
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Nom de l’instance
              </label>
              <input className="glass-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Description
              </label>
              <input className="glass-input" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
          </div>

          {/* Version & Loader */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Version Minecraft
              </label>
              <select
                className="glass-select mono"
                value={editMcVersion}
                onChange={(e) => setEditMcVersion(e.target.value)}
              >
                {mcVersions.length === 0 && <option value={editMcVersion}>{editMcVersion}</option>}
                {mcVersions.slice(0, 100).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} ({v.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Modloader
              </label>
              <select
                className="glass-select"
                value={editLoader}
                onChange={(e) => setEditLoader(e.target.value as ModLoader)}
              >
                <option value="vanilla">Vanilla (Officiel)</option>
                <option value="fabric">Fabric</option>
                <option value="neoforge">NeoForge</option>
                <option value="forge">Forge</option>
                <option value="quilt">Quilt</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Version du Loader
              </label>
              <select
                className="glass-select mono"
                value={editLoaderVersion}
                onChange={(e) => setEditLoaderVersion(e.target.value)}
                disabled={editLoader === 'vanilla'}
              >
                {editLoader === 'vanilla' ? (
                  <option value="">Aucune (Vanilla)</option>
                ) : (
                  loaderVersions.map((lv) => (
                    <option key={lv.version} value={lv.version}>
                      {lv.version}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* RAM Allocation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="glass-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>RAM Minimale (-Xms)</span>
                <span className="mono" style={{ color: 'var(--accent-secondary)', fontSize: 12.5 }}>
                  {editMinRam} Mo
                </span>
              </div>
              <input
                type="range"
                min={1024}
                max={8192}
                step={512}
                value={editMinRam}
                onChange={(e) => setEditMinRam(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
              />
            </div>

            <div className="glass-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>RAM Maximale (-Xmx)</span>
                <span className="mono" style={{ color: 'var(--accent-secondary)', fontSize: 12.5 }}>
                  {editMaxRam} Mo ({(editMaxRam / 1024).toFixed(1)} Go)
                </span>
              </div>
              <input
                type="range"
                min={2048}
                max={16384}
                step={512}
                value={editMaxRam}
                onChange={(e) => setEditMaxRam(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
              />
            </div>
          </div>

          {/* Resolution & Fullscreen */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Largeur fenêtre (px)
              </label>
              <input
                type="number"
                className="glass-input mono"
                value={editWidth}
                onChange={(e) => setEditWidth(Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Hauteur fenêtre (px)
              </label>
              <input
                type="number"
                className="glass-input mono"
                value={editHeight}
                onChange={(e) => setEditHeight(Number(e.target.value))}
              />
            </div>
            <div className="glass-card" style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Plein écran au lancement</span>
              <div
                className={`glass-switch ${editFullscreen ? 'checked' : ''}`}
                onClick={() => setEditFullscreen(!editFullscreen)}
              >
                <div className="glass-switch-thumb" />
              </div>
            </div>
          </div>

          {/* Java Path & JVM Args */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Exécutable Java personnalisé (laisser vide = détection auto)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="glass-input mono"
                  placeholder="Auto (Java 8 / 17 / 21 selon version MC)"
                  value={editJavaPath}
                  onChange={(e) => setEditJavaPath(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={async () => {
                    const p = await launcherBridge.selectFile({
                      title: 'Choisir java.exe ou javaw.exe',
                      filters: [{ name: 'Java Executable', extensions: ['exe'] }],
                    });
                    if (p) setEditJavaPath(p);
                  }}
                >
                  Parcourir
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Arguments JVM additionnels
              </label>
              <input
                className="glass-input mono"
                value={editJvmArgs}
                onChange={(e) => setEditJvmArgs(e.target.value)}
              />
            </div>
          </div>

          {/* Footer actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-glass" onClick={handleDuplicate}>
                <Copy size={14} /> Dupliquer l’instance
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteInstance}>
                <Trash2 size={14} /> Supprimer l’instance
              </button>
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingSettings}>
              <Save size={15} /> {savingSettings ? 'Enregistrement...' : 'Enregistrer les réglages'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
