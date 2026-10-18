export type ModLoader = 'vanilla' | 'fabric' | 'neoforge' | 'forge' | 'quilt';

export type ContentCategory = 'mod' | 'shader' | 'resourcepack' | 'datapack' | 'modpack';

export type CatalogProvider = 'modrinth' | 'curseforge';

export interface InstalledItemMeta {
  title: string;
  author: string;
  version: string;
  iconUrl: string | null;
  source: string;
  projectId: string | null;
  installedAt: string;
}

export interface InstanceCounts {
  mods: number;
  shaders: number;
  resourcepacks: number;
  datapacks: number;
  worlds: number;
  screenshots: number;
}

export interface MinecraftInstance {
  id: string;
  name: string;
  mcVersion: string;
  loader: ModLoader;
  loaderVersion: string;
  icon: string;
  accentColor: string;
  description: string;
  minRamMb: number;
  maxRamMb: number;
  jvmArgs: string;
  width: number;
  height: number;
  fullscreen: boolean;
  javaPath: string;
  playtimeMinutes: number;
  lastPlayed: string | null;
  createdAt: string;
  path?: string;
  isInstalled?: boolean;
  installed?: boolean;
  installedAt?: string;
  counts?: InstanceCounts;
  installedMeta?: Record<string, InstalledItemMeta>;
}

export interface Account {
  id: string;
  type: 'microsoft' | 'offline';
  username: string;
  uuid: string;
  skinUrl: string;
  skinVariant: 'classic' | 'slim';
  accessToken?: string;
  createdAt: string;
}

export interface WardrobeSkin {
  id: string;
  name: string;
  variant: 'classic' | 'slim';
  skinUrl: string;
  capeUrl?: string | null;
  createdAt: string;
}

export interface LauncherSettings {
  minRamMb: number;
  maxRamMb: number;
  width: number;
  height: number;
  fullscreen: boolean;
  javaPath: string;
  jvmArgs: string;
  curseforgeApiKey: string;
  closeLauncherOnPlay: boolean;
  concurrentDownloads: number;
  themeAccent: 'indigo' | 'cyan' | 'emerald' | 'rose' | 'violet';
  glassBlur: number;
  backgroundStyle: 'aurora' | 'midnight' | 'nebula';
  dataPath?: string;
}

export interface ContentFileItem {
  fileName: string;
  cleanFileName: string;
  enabled: boolean;
  sizeBytes: number;
  modifiedAt: string;
  title: string;
  author: string;
  version: string;
  iconUrl: string | null;
  source: string;
  projectId: string | null;
}

export interface WorldItem {
  name: string;
  path: string;
  modifiedAt: string;
  datapacksCount: number;
  iconDataUrl: string | null;
}

export interface ScreenshotItem {
  fileName: string;
  path: string;
  createdAt: string;
  dataUrl: string;
}

export interface InstanceContentData {
  mods: ContentFileItem[];
  shaderpacks: ContentFileItem[];
  resourcepacks: ContentFileItem[];
  datapacks: ContentFileItem[];
  worlds: WorldItem[];
  screenshots: ScreenshotItem[];
}

export interface CatalogItem {
  id: string;
  slug: string;
  provider: CatalogProvider;
  projectType: ContentCategory;
  title: string;
  description: string;
  author: string;
  downloads: number;
  follows: number;
  iconUrl: string | null;
  categories: string[];
  updatedAt: string;
  websiteUrl: string;
}

export interface JavaRuntimeInfo {
  path: string;
  version: string;
  major: number;
  raw: string;
}

export interface McVersionItem {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  releaseTime?: string;
}

export interface LoaderVersionItem {
  version: string;
  stable: boolean;
}

export interface GameLogEntry {
  id: string;
  timestamp: string;
  instanceId: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'stdout';
  text: string;
}

export interface GameProgressEvent {
  instanceId: string;
  type: string;
  task: number;
  total: number;
  percent: number;
}

export interface GameStateEvent {
  instanceId: string;
  status:
    | 'preparing'
    | 'downloading-java'
    | 'downloading'
    | 'installing'
    | 'installed'
    | 'running'
    | 'stopped'
    | 'error';
  message?: string;
  code?: number;
}

export interface CatalogProgressEvent {
  projectId: string;
  title: string;
  status: 'downloading' | 'completed' | 'error';
  percent: number;
  message?: string;
}

export interface JavaProgressEvent {
  major: number;
  status: 'downloading' | 'extracting' | 'completed' | 'error';
  percent: number;
  message: string;
}
