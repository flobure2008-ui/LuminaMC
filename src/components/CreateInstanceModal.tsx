import React, { useEffect, useState } from 'react';
import {
  Box,
  Cpu,
  Flame,
  Layers,
  Sparkles,
  X,
  Zap,
  Shield,
  Compass,
  Check,
  RefreshCw,
} from 'lucide-react';
import { LoaderVersionItem, McVersionItem, MinecraftInstance, ModLoader } from '../types/launcher';
import { launcherBridge } from '../services/bridge';

interface CreateInstanceModalProps {
  onClose: () => void;
  onCreated: (instances: MinecraftInstance[]) => void;
}

const LOADER_OPTIONS: { id: ModLoader; label: string; badge: string; color: string }[] = [
  { id: 'fabric', label: 'Fabric', badge: 'Léger & Rapide', color: '#38bdf8' },
  { id: 'neoforge', label: 'NeoForge', badge: 'Moderne', color: '#f97316' },
  { id: 'forge', label: 'Forge', badge: 'Classique', color: '#eab308' },
  { id: 'quilt', label: 'Quilt', badge: 'Modulaire', color: '#a855f7' },
  { id: 'vanilla', label: 'Vanilla', badge: 'Officiel', color: '#10b981' },
];

const ACCENT_COLORS = ['#6366f1', '#38bdf8', '#10b981', '#f97316', '#f43f5e', '#a855f7', '#eab308'];

const ICON_OPTIONS = [
  { id: 'sparkles', icon: Sparkles },
  { id: 'flame', icon: Flame },
  { id: 'cube', icon: Box },
  { id: 'layers', icon: Layers },
  { id: 'zap', icon: Zap },
  { id: 'shield', icon: Shield },
  { id: 'compass', icon: Compass },
];

export const CreateInstanceModal: React.FC<CreateInstanceModalProps> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mcVersion, setMcVersion] = useState('1.21.1');
  const [versionFilter, setVersionFilter] = useState<'release' | 'snapshot' | 'old'>('release');
  const [loader, setLoader] = useState<ModLoader>('fabric');
  const [loaderVersion, setLoaderVersion] = useState('');
  const [icon, setIcon] = useState('sparkles');
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [maxRamMb, setMaxRamMb] = useState(4096);

  const [mcVersions, setMcVersions] = useState<McVersionItem[]>([]);
  const [loaderVersions, setLoaderVersions] = useState<LoaderVersionItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingLoaders, setLoadingLoaders] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoadingVersions(true);
    launcherBridge
      .getMinecraftVersions()
      .then((res) => {
        setMcVersions(res.versions || []);
      })
      .finally(() => setLoadingVersions(false));
  }, []);

  useEffect(() => {
    if (loader === 'vanilla') {
      setLoaderVersions([]);
      setLoaderVersion('');
      return;
    }
    let cancelled = false;
    setLoadingLoaders(true);
    launcherBridge
      .getLoaderVersions(mcVersion, loader)
      .then((vers) => {
        if (cancelled) return;
        const list = vers || [];
        setLoaderVersions(list);
        if (list.length > 0) {
          setLoaderVersion(list[0].version || '');
        } else {
          // Automatically switch to Vanilla when a version (like MC 1.0 or an early snapshot) has no loader support
          setLoader('vanilla');
          setLoaderVersion('');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLoaders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mcVersion, loader]);

  const filteredMcVersions = mcVersions.filter((v) => {
    if (versionFilter === 'release') return v.type === 'release';
    if (versionFilter === 'snapshot') return v.type === 'snapshot';
    return v.type === 'old_beta' || v.type === 'old_alpha';
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const finalName =
        name.trim() || `${loader.charAt(0).toUpperCase() + loader.slice(1)} ${mcVersion}`;
      const list = await launcherBridge.createInstance({
        name: finalName,
        description:
          description.trim() ||
          `Instance Minecraft ${mcVersion} sous ${loader.toUpperCase()}${loaderVersion ? ` (${loaderVersion})` : ''}.`,
        mcVersion,
        loader,
        loaderVersion,
        icon,
        accentColor,
        minRamMb: Math.min(2048, maxRamMb),
        maxRamMb,
      });
      onCreated(list);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-glass" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 className="heading-font" style={{ fontSize: 19, fontWeight: 700 }}>
              Nouvelle Instance Multiversion
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>
              Configurez la version Minecraft, le Modloader et la mémoire dédiée
            </p>
          </div>
          <button className="btn btn-glass" style={{ padding: 8 }} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Name & Icon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Nom de l’instance
              </label>
              <input
                className="glass-input"
                placeholder={`Ex: Survie Moddée ${mcVersion}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Couleur
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 39 }}>
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAccentColor(c)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: c,
                      border: accentColor === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {accentColor === c && <Check size={12} color="#fff" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Icon selector */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Icône de l’instance
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {ICON_OPTIONS.map((opt) => {
                const IconComp = opt.icon;
                const active = icon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIcon(opt.id)}
                    className="btn btn-glass"
                    style={{
                      padding: '9px 13px',
                      borderColor: active ? accentColor : undefined,
                      background: active ? `${accentColor}28` : undefined,
                    }}
                  >
                    <IconComp size={16} color={active ? accentColor : 'currentColor'} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modloader Selection */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Modloader
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {LOADER_OPTIONS.map((item) => {
                const active = loader === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLoader(item.id)}
                    className="glass-card"
                    style={{
                      padding: '10px 8px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      borderColor: active ? item.color : undefined,
                      background: active ? `${item.color}1f` : undefined,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13, color: active ? '#fff' : 'var(--text-primary)' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 10.5, color: active ? item.color : 'var(--text-muted)', marginTop: 2 }}>
                      {item.badge}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minecraft Version + Loader Version */}
          <div style={{ display: 'grid', gridTemplateColumns: loader === 'vanilla' ? '1fr' : '1.2fr 1fr', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Version de Minecraft {loadingVersions && <RefreshCw size={11} style={{ display: 'inline' }} />}
                </label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(
                    [
                      ['release', 'Releases'],
                      ['snapshot', 'Snapshots'],
                      ['old', 'Beta/Alpha'],
                    ] as const
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setVersionFilter(k)}
                      style={{
                        fontSize: 10.5,
                        padding: '2px 7px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        background: versionFilter === k ? 'var(--accent-primary)' : 'rgba(255,255,255,0.07)',
                        color: versionFilter === k ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <select
                className="glass-select mono"
                value={mcVersion}
                onChange={(e) => setMcVersion(e.target.value)}
              >
                {filteredMcVersions.slice(0, 120).map((v) => (
                  <option key={v.id} value={v.id}>
                    Minecraft {v.id} ({v.type})
                  </option>
                ))}
              </select>
            </div>

            {loader !== 'vanilla' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Version {loader.toUpperCase()}
                </label>
                <select
                  className="glass-select mono"
                  value={loaderVersion}
                  onChange={(e) => setLoaderVersion(e.target.value)}
                  disabled={loadingLoaders}
                >
                  {loaderVersions.map((lv) => (
                    <option key={lv.version} value={lv.version}>
                      {lv.version} {lv.stable ? '(Stable)' : '(Beta)'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* RAM Allocation Slider */}
          <div className="glass-card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600 }}>
                <Cpu size={15} color="var(--accent-secondary)" /> Mémoire RAM Allouée (Max)
              </span>
              <span className="glass-pill mono" style={{ color: 'var(--accent-secondary)' }}>
                {maxRamMb} Mo ({(maxRamMb / 1024).toFixed(1)} Go)
              </span>
            </div>
            <input
              type="range"
              min={2048}
              max={16384}
              step={512}
              value={maxRamMb}
              onChange={(e) => setMaxRamMb(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>2 Go (Léger)</span>
              <span>4 Go (Recommandé)</span>
              <span>8 Go (Gros Modpacks)</span>
              <span>16 Go (Extrême)</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Description (optionnel)
            </label>
            <input
              className="glass-input"
              placeholder="Notes sur vos mods, serveurs ou shaders..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn btn-glass" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Création...' : 'Créer l’instance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
