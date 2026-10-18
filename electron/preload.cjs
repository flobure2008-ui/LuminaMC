const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('luminaAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // App state & Config
  getInitialData: () => ipcRenderer.invoke('app:getInitialData'),
  saveSettings: (settings) => ipcRenderer.invoke('app:saveSettings', settings),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  openPath: (targetPath) => ipcRenderer.invoke('app:openPath', targetPath),
  selectFile: (options) => ipcRenderer.invoke('app:selectFile', options),
  selectDirectory: () => ipcRenderer.invoke('app:selectDirectory'),

  // Accounts (Microsoft OAuth & Offline)
  loginMicrosoft: () => ipcRenderer.invoke('auth:loginMicrosoft'),
  loginOffline: (username) => ipcRenderer.invoke('auth:loginOffline', username),
  setActiveAccount: (accountId) => ipcRenderer.invoke('auth:setActiveAccount', accountId),
  removeAccount: (accountId) => ipcRenderer.invoke('auth:removeAccount', accountId),

  // Skin Wardrobe & Management
  fetchPlayerSkin: (username) => ipcRenderer.invoke('skin:fetchPlayerSkin', username),
  importSkinFile: () => ipcRenderer.invoke('skin:importSkinFile'),
  saveSkinToWardrobe: (skinEntry) => ipcRenderer.invoke('skin:saveToWardrobe', skinEntry),
  deleteSkinFromWardrobe: (skinId) => ipcRenderer.invoke('skin:deleteFromWardrobe', skinId),
  applySkin: (skinData) => ipcRenderer.invoke('skin:applySkin', skinData),

  // Instances
  createInstance: (instanceData) => ipcRenderer.invoke('instance:create', instanceData),
  updateInstance: (instanceId, updates) => ipcRenderer.invoke('instance:update', instanceId, updates),
  deleteInstance: (instanceId) => ipcRenderer.invoke('instance:delete', instanceId),
  duplicateInstance: (instanceId) => ipcRenderer.invoke('instance:duplicate', instanceId),
  openInstanceFolder: (instanceId, subFolder) => ipcRenderer.invoke('instance:openFolder', instanceId, subFolder),
  getInstanceContent: (instanceId) => ipcRenderer.invoke('instance:getContent', instanceId),
  toggleContentItem: (instanceId, folderType, fileName) =>
    ipcRenderer.invoke('instance:toggleContent', instanceId, folderType, fileName),
  deleteContentItem: (instanceId, folderType, fileName) =>
    ipcRenderer.invoke('instance:deleteContent', instanceId, folderType, fileName),
  importLocalContent: (instanceId, folderType) =>
    ipcRenderer.invoke('instance:importLocalContent', instanceId, folderType),
  importModpackFile: () => ipcRenderer.invoke('instance:importModpackFile'),

  // Minecraft & Loader Versions
  getMinecraftVersions: () => ipcRenderer.invoke('mc:getVersions'),
  getLoaderVersions: (mcVersion, loader) => ipcRenderer.invoke('mc:getLoaderVersions', mcVersion, loader),

  // Modrinth & CurseForge Catalog
  searchCatalog: (params) => ipcRenderer.invoke('catalog:search', params),
  getProjectVersions: (params) => ipcRenderer.invoke('catalog:getVersions', params),
  installCatalogItem: (params) => ipcRenderer.invoke('catalog:install', params),

  // Java Runtime Management
  detectJava: () => ipcRenderer.invoke('java:detect'),
  installJava: (majorVersion) => ipcRenderer.invoke('java:install', majorVersion),

  // Separate Instance Installation/Download vs Game Launch & Stop
  installInstance: (instanceId) => ipcRenderer.invoke('game:install', instanceId),
  launchInstance: (instanceId) => ipcRenderer.invoke('game:launch', instanceId),
  stopInstance: (instanceId) => ipcRenderer.invoke('game:stop', instanceId),

  // Real-time Event Listeners
  onGameLog: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('game:log', handler);
    return () => ipcRenderer.removeListener('game:log', handler);
  },
  onGameProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('game:progress', handler);
    return () => ipcRenderer.removeListener('game:progress', handler);
  },
  onGameState: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('game:state', handler);
    return () => ipcRenderer.removeListener('game:state', handler);
  },
  onJavaProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('java:progress', handler);
    return () => ipcRenderer.removeListener('java:progress', handler);
  },
  onCatalogProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('catalog:progress', handler);
    return () => ipcRenderer.removeListener('catalog:progress', handler);
  },
});
