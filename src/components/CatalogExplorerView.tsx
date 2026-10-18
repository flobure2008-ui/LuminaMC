import React, { useEffect, useState } from 'react';
import {
  Box,
  Check,
  Download,
  ExternalLink,
  Filter,
  Heart,
  Layers,
  Package,
  Palette,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  CatalogItem,
  CatalogProgressEvent,
  CatalogProvider,
  ContentCategory,
  MinecraftInstance,
} from '../types/launcher';
import { launcherBridge } from '../services/bridge';

interface CatalogExplorerViewProps {
  instances: MinecraftInstance[];
  selectedInstanceId: string;
  onSelectInstance: (id: string) => void;
  initialCategory?: ContentCategory;
  catalogProgress: Record<string, CatalogProgressEvent>;
  onInstancesUpdated: (list: MinecraftInstance[]) => void;
}

const CATEGORIES: { id: ContentCategory; label: string; icon: any; desc: string }[] = [
  { id: 'mod', label: 'Mods', icon: Box, desc: 'Mods Gameplay, Optimisation, Tech & Magie (.jar)' },
  { id: 'shader', label: 'Shaders', icon: Sparkles, desc: 'Packs de Shaders Iris & OptiFine (.zip)' },
  { id: 'resourcepack', label: 'Packs de Textures', icon: Palette, desc: 'Resource Packs HD, PBR, GUI & Sons (.zip)' },
  { id: 'datapack', label: 'Datapacks', icon: Layers, desc: 'Génération de monde, structures & mécaniques (.zip)' },
  { id: 'modpack', label: 'Modpacks', icon: Package, desc: 'Modpacks complets prêts à jouer (crée une instance)' },
];

export const CatalogExplorerView: React.FC<CatalogExplorerViewProps> = ({
  instances,
  selectedInstanceId,
  onSelectInstance,
  initialCategory = 'mod',
  catalogProgress,
  onInstancesUpdated,
}) => {
  const [provider, setProvider] = useState<CatalogProvider>('modrinth');
  const [category, setCategory] = useState<ContentCategory>(initialCategory);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'downloads' | 'relevance' | 'updated' | 'newest'>('downloads');
  const [filterByInstanceVersion, setFilterByInstanceVersion] = useState(true);

  const [results, setResults] = useState<CatalogItem[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const targetInstance = instances.find((i) => i.id === selectedInstanceId) || instances[0];

  const performSearch = async () => {
    setLoading(true);
    setErrorMsg(null);
    setFallbackNotice(null);
    try {
      const useFilter = filterByInstanceVersion && targetInstance && category !== 'modpack';
      const res = await launcherBridge.searchCatalog({
        provider,
        projectType: category,
        query,
        mcVersion: useFilter ? targetInstance.mcVersion : '',
        loader:
          useFilter && category === 'mod' && targetInstance.loader !== 'vanilla'
            ? targetInstance.loader
            : '',
        sort,
        limit: 24,
      });
      setResults(res.hits || []);
      setTotalHits(res.totalHits || 0);
      if (res.fallbackNotice) setFallbackNotice(res.fallbackNotice);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la recherche.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 220);
    return () => clearTimeout(timer);
  }, [provider, category, query, sort, filterByInstanceVersion, selectedInstanceId]);

  const handleInstall = async (item: CatalogItem) => {
    setErrorMsg(null);
    try {
      const res = await launcherBridge.installCatalogItem({
        item,
        instanceId: targetInstance?.id || '',
      });
      if (res?.instances) {
        onInstancesUpdated(res.instances);
      }
      setInstalledIds((prev) => ({ ...prev, [item.id]: true }));
    } catch (err: any) {
      setErrorMsg(err.message || `Échec de l'installation de ${item.title}`);
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Top Bar: Provider Switcher + Instance Target Selector */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {/* Modrinth vs CurseForge Switch */}
          <div className="segmented-tabs" style={{ padding: 4 }}>
            <button
              className={`segmented-tab ${provider === 'modrinth' ? 'active' : ''}`}
              onClick={() => setProvider('modrinth')}
              style={{
                color: provider === 'modrinth' ? '#1bd96a' : undefined,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#1bd96a',
                  boxShadow: provider === 'modrinth' ? '0 0 8px #1bd96a' : 'none',
                }}
              />
              Modrinth
            </button>
            <button
              className={`segmented-tab ${provider === 'curseforge' ? 'active' : ''}`}
              onClick={() => setProvider('curseforge')}
              style={{
                color: provider === 'curseforge' ? '#f16436' : undefined,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#f16436',
                  boxShadow: provider === 'curseforge' ? '0 0 8px #f16436' : 'none',
                }}
              />
              CurseForge
            </button>
          </div>

          {/* Category Tabs: Mods / Shaders / ResourcePacks / Datapacks / Modpacks */}
          <div className="segmented-tabs">
            {CATEGORIES.map((cat) => {
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.id}
                  className={`segmented-tab ${category === cat.id ? 'active' : ''}`}
                  onClick={() => setCategory(cat.id)}
                >
                  <IconComp size={14} />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Instance Selector */}
        {category !== 'modpack' && instances.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
              Installer dans :
            </span>
            <select
              className="glass-select"
              style={{ width: 'auto', minWidth: 220, padding: '7px 12px', fontSize: 13 }}
              value={targetInstance?.id || ''}
              onChange={(e) => onSelectInstance(e.target.value)}
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.mcVersion} • {inst.loader.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Search & Filter Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            className="glass-input"
            style={{ paddingLeft: 40, height: 42 }}
            placeholder={`Rechercher des ${CATEGORIES.find((c) => c.id === category)?.label.toLowerCase()} sur ${
              provider === 'modrinth' ? 'Modrinth' : 'CurseForge'
            }...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {category !== 'modpack' && targetInstance && (
          <button
            type="button"
            className={`btn ${filterByInstanceVersion ? 'btn-primary' : 'btn-glass'}`}
            style={{ height: 42 }}
            onClick={() => setFilterByInstanceVersion(!filterByInstanceVersion)}
            title="Filtrer automatiquement selon la version Minecraft et le Modloader de l'instance cible"
          >
            <Filter size={14} />
            Compatible {targetInstance.mcVersion}{' '}
            {category === 'mod' && targetInstance.loader !== 'vanilla'
              ? `(${targetInstance.loader.toUpperCase()})`
              : ''}
          </button>
        )}

        <select
          className="glass-select"
          style={{ width: 190, height: 42 }}
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
        >
          <option value="downloads">Trier : Téléchargements</option>
          <option value="relevance">Trier : Pertinence</option>
          <option value="updated">Trier : Mis à jour</option>
          <option value="newest">Trier : Plus récents</option>
        </select>

        <button className="btn btn-glass" style={{ height: 42, padding: '0 14px' }} onClick={performSearch}>
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Warning / Fallback / Error Banners */}
      {fallbackNotice && (
        <div
          className="glass-card"
          style={{
            padding: '10px 16px',
            borderColor: 'rgba(245, 158, 11, 0.35)',
            background: 'rgba(245, 158, 11, 0.1)',
            fontSize: 12.5,
            color: '#fcd34d',
          }}
        >
          {fallbackNotice}
        </div>
      )}

      {errorMsg && (
        <div
          className="glass-card"
          style={{
            padding: '12px 16px',
            borderColor: 'rgba(244, 63, 94, 0.4)',
            background: 'rgba(244, 63, 94, 0.12)',
            color: '#fda4af',
            fontSize: 13,
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Results Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: 'var(--text-secondary)' }}>
        <span>
          {loading
            ? 'Recherche en cours...'
            : `${totalHits.toLocaleString()} résultats disponibles pour ${
                CATEGORIES.find((c) => c.id === category)?.label
              }`}
        </span>
        {category === 'modpack' && (
          <span style={{ color: 'var(--accent-secondary)' }}>
            Astuce : Installer un Modpack crée automatiquement une nouvelle instance dédiée.
          </span>
        )}
      </div>

      {/* Results Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 14 }}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="glass-card" style={{ height: 155, padding: 18, opacity: 0.5 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '60%', height: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 6, marginBottom: 8 }} />
                  <div style={{ width: '40%', height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 6 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {results.map((item) => {
            const prog = catalogProgress[item.id];
            const isDownloading = prog && prog.status === 'downloading';
            const isInstalled = installedIds[item.id] || (prog && prog.status === 'completed');

            return (
              <div
                key={`${item.provider}-${item.id}`}
                className="glass-card glass-card-interactive"
                style={{
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', gap: 13 }}>
                  {item.iconUrl ? (
                    <img
                      src={item.iconUrl}
                      alt={item.title}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        objectFit: 'cover',
                        flexShrink: 0,
                        background: 'rgba(255,255,255,0.05)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.07)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Box size={24} color="var(--accent-secondary)" />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <h3
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={item.title}
                      >
                        {item.title}
                      </h3>
                      <button
                        className="btn btn-glass"
                        style={{ padding: 5, borderRadius: 7 }}
                        onClick={() => launcherBridge.openExternal(item.websiteUrl)}
                        title="Voir la page officielle"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                      par <span style={{ color: 'var(--text-secondary)' }}>{item.author}</span>
                    </div>
                    <p
                      style={{
                        fontSize: 12.5,
                        color: 'var(--text-secondary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.4,
                      }}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Progress bar if downloading */}
                {isDownloading && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--accent-secondary)', marginBottom: 4 }}>
                      <span>{prog.message || 'Téléchargement...'}</span>
                      <span className="mono">{prog.percent}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${prog.percent}%` }} />
                    </div>
                  </div>
                )}

                {/* Footer: Categories + Stats + Install button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    paddingTop: 10,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Download size={12} color="var(--accent-secondary)" /> {formatNumber(item.downloads)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Heart size={12} color="#f43f5e" /> {formatNumber(item.follows)}
                    </span>
                    {item.categories.slice(0, 2).map((c) => (
                      <span
                        key={c}
                        className="glass-pill"
                        style={{ fontSize: 10, padding: '2px 7px', textTransform: 'capitalize' }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>

                  <button
                    className={`btn ${isInstalled ? 'btn-glass' : 'btn-primary'}`}
                    style={{
                      padding: '7px 14px',
                      fontSize: 12,
                      borderColor: isInstalled ? 'rgba(16, 185, 129, 0.4)' : undefined,
                      color: isInstalled ? '#34d399' : undefined,
                    }}
                    disabled={isDownloading}
                    onClick={() => handleInstall(item)}
                  >
                    {isDownloading ? (
                      `${prog.percent}%`
                    ) : isInstalled ? (
                      <>
                        <Check size={14} /> Installé
                      </>
                    ) : category === 'modpack' ? (
                      <>
                        <Download size={14} /> Créer Instance
                      </>
                    ) : (
                      <>
                        <Download size={14} /> Installer
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
