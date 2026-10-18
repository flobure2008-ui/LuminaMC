import {
  Account,
  CatalogItem,
  CatalogProgressEvent,
  GameLogEntry,
  GameProgressEvent,
  GameStateEvent,
  InstanceContentData,
  JavaProgressEvent,
  JavaRuntimeInfo,
  LauncherSettings,
  LoaderVersionItem,
  McVersionItem,
  MinecraftInstance,
  WardrobeSkin,
} from '../types/launcher';

declare global {
  interface Window {
    luminaAPI?: any;
  }
}

const DEFAULT_STEVE_SKIN =
  'https://textures.minecraft.net/texture/31f477eb1a7beee631c2ca64d06f8f68fa93a3386d04452ab27f43acdf1b60cb';
const DEFAULT_ALEX_SKIN =
  'https://textures.minecraft.net/texture/67e1fd5b614b9b8b79f62f262231b9b1ef1b8197f26fb80401f2d0f6a0b7528c';

export const isElectron = () => Boolean(window.luminaAPI);

// Browser fallback state when previewed outside Electron
const browserState = {
  settings: {
    minRamMb: 2048,
    maxRamMb: 4096,
    width: 1280,
    height: 720,
    fullscreen: false,
    javaPath: '',
    jvmArgs:
      '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions',
    curseforgeApiKey: '',
    closeLauncherOnPlay: false,
    concurrentDownloads: 6,
    themeAccent: 'indigo' as const,
    glassBlur: 24,
    backgroundStyle: 'aurora' as const,
    dataPath: 'C:/Users/AppData/Roaming/LuminaMC/LuminaData',
  },
  accounts: [
    {
      id: 'offline-default',
      type: 'offline' as const,
      username: 'AetherPlayer',
      uuid: '8667ba71-b85a-4004-af54-457a9734eed7',
      skinUrl: DEFAULT_STEVE_SKIN,
      skinVariant: 'classic' as const,
      createdAt: new Date().toISOString(),
    },
  ],
  activeAccountId: 'offline-default',
  wardrobe: [
    {
      id: 'skin-1',
      name: 'Steve Original (Classic)',
      variant: 'classic' as const,
      skinUrl: DEFAULT_STEVE_SKIN,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'skin-2',
      name: 'Alex (Slim)',
      variant: 'slim' as const,
      skinUrl: DEFAULT_ALEX_SKIN,
      createdAt: new Date().toISOString(),
    },
  ],
  instances: [
    {
      id: 'fabric-ultra-1-21-1',
      name: 'Sodium & Iris Shaders',
      mcVersion: '1.21.1',
      loader: 'fabric' as const,
      loaderVersion: '0.16.10',
      icon: 'sparkles',
      accentColor: '#38bdf8',
      description:
        'Instance optimisée Fabric 1.21.1 prête pour les Shaders, Sodium, Iris et packs de textures HD.',
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
      counts: { mods: 2, shaders: 1, resourcepacks: 1, datapacks: 0, worlds: 1, screenshots: 0 },
    },
    {
      id: 'neoforge-modded-1-21-1',
      name: 'NeoForge Modpack Survie+',
      mcVersion: '1.21.1',
      loader: 'neoforge' as const,
      loaderVersion: '21.1.122',
      icon: 'flame',
      accentColor: '#f97316',
      description: 'Survie moddée sous NeoForge 1.21.1 pour gros mods techniques, dimensions et génération.',
      minRamMb: 4096,
      maxRamMb: 8192,
      jvmArgs: '-XX:+UseG1GC',
      width: 1280,
      height: 720,
      fullscreen: false,
      javaPath: '',
      playtimeMinutes: 64,
      lastPlayed: new Date(Date.now() - 3600 * 1000 * 28).toISOString(),
      createdAt: new Date().toISOString(),
      counts: { mods: 0, shaders: 0, resourcepacks: 0, datapacks: 0, worlds: 0, screenshots: 0 },
    },
    {
      id: 'vanilla-latest-1-21-4',
      name: 'Vanilla Pure 1.21.4',
      mcVersion: '1.21.4',
      loader: 'vanilla' as const,
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
      counts: { mods: 0, shaders: 0, resourcepacks: 0, datapacks: 0, worlds: 0, screenshots: 0 },
    },
  ] as MinecraftInstance[],
};

export const launcherBridge = {
  minimizeWindow: () => window.luminaAPI?.minimizeWindow?.(),
  maximizeWindow: () => window.luminaAPI?.maximizeWindow?.(),
  closeWindow: () => window.luminaAPI?.closeWindow?.(),

  getInitialData: async (): Promise<{
    config: {
      settings: LauncherSettings;
      accounts: Account[];
      activeAccountId: string | null;
      wardrobe: WardrobeSkin[];
    };
    instances: MinecraftInstance[];
    runningInstanceIds: string[];
  }> => {
    if (window.luminaAPI) {
      return await window.luminaAPI.getInitialData();
    }
    return {
      config: {
        settings: browserState.settings,
        accounts: browserState.accounts,
        activeAccountId: browserState.activeAccountId,
        wardrobe: browserState.wardrobe,
      },
      instances: browserState.instances,
      runningInstanceIds: [],
    };
  },

  saveSettings: async (settings: Partial<LauncherSettings>): Promise<LauncherSettings> => {
    if (window.luminaAPI) return await window.luminaAPI.saveSettings(settings);
    browserState.settings = { ...browserState.settings, ...settings };
    return browserState.settings;
  },

  openExternal: async (url: string) => {
    if (window.luminaAPI) return await window.luminaAPI.openExternal(url);
    window.open(url, '_blank');
  },

  selectFile: async (options?: any): Promise<string | null> => {
    if (window.luminaAPI) return await window.luminaAPI.selectFile(options);
    return null;
  },

  // Accounts
  loginMicrosoft: async () => {
    if (window.luminaAPI) return await window.luminaAPI.loginMicrosoft();
    throw new Error('Connexion OAuth Microsoft disponible uniquement dans la fenêtre Electron.');
  },

  loginOffline: async (username: string) => {
    if (window.luminaAPI) return await window.luminaAPI.loginOffline(username);
    const acc: Account = {
      id: `offline-${Date.now()}`,
      type: 'offline',
      username,
      uuid: '00000000-0000-0000-0000-000000000000',
      skinUrl: DEFAULT_STEVE_SKIN,
      skinVariant: 'classic',
      createdAt: new Date().toISOString(),
    };
    browserState.accounts.push(acc);
    browserState.activeAccountId = acc.id;
    return { accounts: [...browserState.accounts], activeAccountId: acc.id, account: acc };
  },

  setActiveAccount: async (accountId: string) => {
    if (window.luminaAPI) return await window.luminaAPI.setActiveAccount(accountId);
    browserState.activeAccountId = accountId;
    return { accounts: [...browserState.accounts], activeAccountId: accountId };
  },

  removeAccount: async (accountId: string) => {
    if (window.luminaAPI) return await window.luminaAPI.removeAccount(accountId);
    browserState.accounts = browserState.accounts.filter((a) => a.id !== accountId);
    browserState.activeAccountId = browserState.accounts[0]?.id || '';
    return { accounts: [...browserState.accounts], activeAccountId: browserState.activeAccountId };
  },

  // Skins
  fetchPlayerSkin: async (username: string) => {
    if (window.luminaAPI) return await window.luminaAPI.fetchPlayerSkin(username);
    return {
      username,
      uuid: '069a79f444e94726a5befca90e38aaf5',
      skinUrl: DEFAULT_STEVE_SKIN,
      capeUrl: null,
      variant: 'classic' as const,
    };
  },

  importSkinFile: async () => {
    if (window.luminaAPI) return await window.luminaAPI.importSkinFile();
    return null;
  },

  saveSkinToWardrobe: async (skinEntry: Partial<WardrobeSkin>): Promise<WardrobeSkin[]> => {
    if (window.luminaAPI) return await window.luminaAPI.saveSkinToWardrobe(skinEntry);
    const item: WardrobeSkin = {
      id: `skin-${Date.now()}`,
      name: skinEntry.name || 'Custom Skin',
      variant: skinEntry.variant || 'classic',
      skinUrl: skinEntry.skinUrl || DEFAULT_STEVE_SKIN,
      createdAt: new Date().toISOString(),
    };
    browserState.wardrobe = [item, ...browserState.wardrobe];
    return browserState.wardrobe;
  },

  deleteSkinFromWardrobe: async (skinId: string): Promise<WardrobeSkin[]> => {
    if (window.luminaAPI) return await window.luminaAPI.deleteSkinFromWardrobe(skinId);
    browserState.wardrobe = browserState.wardrobe.filter((s) => s.id !== skinId);
    return browserState.wardrobe;
  },

  applySkin: async (data: { skinUrl: string; variant: 'classic' | 'slim' }) => {
    if (window.luminaAPI) return await window.luminaAPI.applySkin(data);
    const acc = browserState.accounts.find((a) => a.id === browserState.activeAccountId);
    if (acc) {
      acc.skinUrl = data.skinUrl;
      acc.skinVariant = data.variant;
    }
    return { accounts: [...browserState.accounts], activeAccountId: browserState.activeAccountId };
  },

  // Instances
  createInstance: async (data: Partial<MinecraftInstance>): Promise<MinecraftInstance[]> => {
    if (window.luminaAPI) return await window.luminaAPI.createInstance(data);
    const inst: MinecraftInstance = {
      id: `inst-${Date.now()}`,
      name: data.name || 'Nouvelle Instance',
      mcVersion: data.mcVersion || '1.21.1',
      loader: data.loader || 'fabric',
      loaderVersion: data.loaderVersion || '',
      icon: data.icon || 'sparkles',
      accentColor: data.accentColor || '#6366f1',
      description: data.description || '',
      minRamMb: data.minRamMb || 2048,
      maxRamMb: data.maxRamMb || 4096,
      jvmArgs: data.jvmArgs || '-XX:+UseG1GC',
      width: 1280,
      height: 720,
      fullscreen: false,
      javaPath: '',
      playtimeMinutes: 0,
      lastPlayed: null,
      createdAt: new Date().toISOString(),
      counts: { mods: 0, shaders: 0, resourcepacks: 0, datapacks: 0, worlds: 0, screenshots: 0 },
    };
    browserState.instances = [inst, ...browserState.instances];
    return browserState.instances;
  },

  updateInstance: async (instanceId: string, updates: Partial<MinecraftInstance>): Promise<MinecraftInstance[]> => {
    if (window.luminaAPI) return await window.luminaAPI.updateInstance(instanceId, updates);
    browserState.instances = browserState.instances.map((i) => (i.id === instanceId ? { ...i, ...updates } : i));
    return browserState.instances;
  },

  deleteInstance: async (instanceId: string): Promise<MinecraftInstance[]> => {
    if (window.luminaAPI) return await window.luminaAPI.deleteInstance(instanceId);
    browserState.instances = browserState.instances.filter((i) => i.id !== instanceId);
    return browserState.instances;
  },

  duplicateInstance: async (instanceId: string): Promise<MinecraftInstance[]> => {
    if (window.luminaAPI) return await window.luminaAPI.duplicateInstance(instanceId);
    const found = browserState.instances.find((i) => i.id === instanceId);
    if (found) {
      browserState.instances = [
        { ...found, id: `${found.id}-copy`, name: `${found.name} (Copie)` },
        ...browserState.instances,
      ];
    }
    return browserState.instances;
  },

  openInstanceFolder: async (instanceId: string, subFolder?: string) => {
    if (window.luminaAPI) return await window.luminaAPI.openInstanceFolder(instanceId, subFolder);
  },

  getInstanceContent: async (instanceId: string): Promise<InstanceContentData> => {
    if (window.luminaAPI) return await window.luminaAPI.getInstanceContent(instanceId);
    return {
      mods: [],
      shaderpacks: [],
      resourcepacks: [],
      datapacks: [],
      worlds: [],
      screenshots: [],
    };
  },

  toggleContentItem: async (instanceId: string, folderType: string, fileName: string) => {
    if (window.luminaAPI) return await window.luminaAPI.toggleContentItem(instanceId, folderType, fileName);
    return true;
  },

  deleteContentItem: async (instanceId: string, folderType: string, fileName: string) => {
    if (window.luminaAPI) return await window.luminaAPI.deleteContentItem(instanceId, folderType, fileName);
    return true;
  },

  importLocalContent: async (instanceId: string, folderType: string) => {
    if (window.luminaAPI) return await window.luminaAPI.importLocalContent(instanceId, folderType);
    return false;
  },

  importModpackFile: async () => {
    if (window.luminaAPI) return await window.luminaAPI.importModpackFile();
    return null;
  },

  // Versions
  getMinecraftVersions: async (): Promise<{
    latest: { release: string; snapshot: string };
    versions: McVersionItem[];
  }> => {
    if (window.luminaAPI) return await window.luminaAPI.getMinecraftVersions();
    const res = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
    const data = await res.json();
    return {
      latest: data.latest,
      versions: (data.versions || []).map((v: any) => ({
        id: v.id,
        type: v.type,
        releaseTime: v.releaseTime,
      })),
    };
  },

  getLoaderVersions: async (mcVersion: string, loader: string): Promise<LoaderVersionItem[]> => {
    if (window.luminaAPI) return await window.luminaAPI.getLoaderVersions(mcVersion, loader);
    return [{ version: '0.16.10', stable: true }];
  },

  // Modrinth & CurseForge Catalog
  searchCatalog: async (params: {
    provider: 'modrinth' | 'curseforge';
    projectType: string;
    query: string;
    mcVersion?: string;
    loader?: string;
    sort?: string;
    offset?: number;
    limit?: number;
  }): Promise<{
    provider: string;
    hits: CatalogItem[];
    totalHits: number;
    fallbackNotice?: string;
  }> => {
    if (window.luminaAPI) return await window.luminaAPI.searchCatalog(params);
    // Direct Modrinth API fallback in browser
    const facets: string[][] = [[`project_type:${params.projectType || 'mod'}`]];
    if (params.mcVersion) facets.push([`versions:${params.mcVersion}`]);
    if (
      (params.projectType === 'mod' || params.projectType === 'modpack') &&
      params.loader &&
      params.loader !== 'vanilla'
    ) {
      facets.push([`categories:${params.loader}`]);
    }
    const q = new URLSearchParams({
      query: params.query || '',
      facets: JSON.stringify(facets),
      index: params.sort || 'downloads',
      limit: String(params.limit || 24),
    });
    const res = await fetch(`https://api.modrinth.com/v2/search?${q.toString()}`);
    const data = await res.json();
    return {
      provider: params.provider,
      hits: (data.hits || []).map((h: any) => ({
        id: h.project_id,
        slug: h.slug,
        provider: params.provider,
        projectType: h.project_type || params.projectType,
        title: h.title,
        description: h.description,
        author: h.author || 'Modrinth',
        downloads: h.downloads || 0,
        follows: h.follows || 0,
        iconUrl: h.icon_url || null,
        categories: (h.display_categories || []).slice(0, 4),
        updatedAt: h.date_modified,
        websiteUrl: `https://modrinth.com/${h.project_type}/${h.slug}`,
      })),
      totalHits: data.total_hits || 0,
    };
  },

  installCatalogItem: async (params: { item: CatalogItem; instanceId: string }) => {
    if (window.luminaAPI) return await window.luminaAPI.installCatalogItem(params);
    return { fileName: `${params.item.slug}.jar`, targetFolder: 'mods', instances: browserState.instances };
  },

  // Java
  detectJava: async (): Promise<JavaRuntimeInfo[]> => {
    if (window.luminaAPI) return await window.luminaAPI.detectJava();
    return [];
  },

  installJava: async (majorVersion: number): Promise<JavaRuntimeInfo[]> => {
    if (window.luminaAPI) return await window.luminaAPI.installJava(majorVersion);
    return [];
  },

  // Separate Instance Installation vs Launch
  installInstance: async (
    instanceId: string
  ): Promise<{ instanceId: string; instances: MinecraftInstance[] }> => {
    if (window.luminaAPI) return await window.luminaAPI.installInstance(instanceId);
    browserState.instances = browserState.instances.map((i) =>
      i.id === instanceId ? { ...i, isInstalled: true, installed: true } : i
    );
    return { instanceId, instances: [...browserState.instances] };
  },

  launchInstance: async (instanceId: string) => {
    if (window.luminaAPI) return await window.luminaAPI.launchInstance(instanceId);
    return { status: 'launched', instanceId };
  },

  stopInstance: async (instanceId: string) => {
    if (window.luminaAPI) return await window.luminaAPI.stopInstance(instanceId);
    return true;
  },

  // Event Subscriptions
  onGameLog: (cb: (data: Omit<GameLogEntry, 'id' | 'timestamp'>) => void) => {
    if (window.luminaAPI) return window.luminaAPI.onGameLog(cb);
    return () => {};
  },
  onGameProgress: (cb: (data: GameProgressEvent) => void) => {
    if (window.luminaAPI) return window.luminaAPI.onGameProgress(cb);
    return () => {};
  },
  onGameState: (cb: (data: GameStateEvent) => void) => {
    if (window.luminaAPI) return window.luminaAPI.onGameState(cb);
    return () => {};
  },
  onJavaProgress: (cb: (data: JavaProgressEvent) => void) => {
    if (window.luminaAPI) return window.luminaAPI.onJavaProgress(cb);
    return () => {};
  },
  onCatalogProgress: (cb: (data: CatalogProgressEvent) => void) => {
    if (window.luminaAPI) return window.luminaAPI.onCatalogProgress(cb);
    return () => {};
  },
};
