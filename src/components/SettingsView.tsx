import React, { useEffect, useState } from 'react';
import {
  Check,
  Coffee,
  Cpu,
  Download,
  FolderOpen,
  Key,
  Palette,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import { JavaProgressEvent, JavaRuntimeInfo, LauncherSettings } from '../types/launcher';
import { launcherBridge } from '../services/bridge';

interface SettingsViewProps {
  settings: LauncherSettings;
  javaProgress: JavaProgressEvent | null;
  onSettingsUpdated: (s: LauncherSettings) => void;
}

const ACCENT_THEMES: { id: LauncherSettings['themeAccent']; label: string; color: string }[] = [
  { id: 'indigo', label: 'Indigo Aether', color: '#6366f1' },
  { id: 'cyan', label: 'Cyan Glacial', color: '#06b6d4' },
  { id: 'emerald', label: 'Émeraude Pur', color: '#10b981' },
  { id: 'violet', label: 'Violet Cristal', color: '#8b5cf6' },
  { id: 'rose', label: 'Rose Néon', color: '#f43f5e' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  javaProgress,
  onSettingsUpdated,
}) => {
  const [form, setForm] = useState<LauncherSettings>(settings);
  const [javaRuntimes, setJavaRuntimes] = useState<JavaRuntimeInfo[]>([]);
  const [detectingJava, setDetectingJava] = useState(false);
  const [installingMajor, setInstallingMajor] = useState<number | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleDetectJava = async () => {
    setDetectingJava(true);
    try {
      const list = await launcherBridge.detectJava();
      setJavaRuntimes(list || []);
    } finally {
      setDetectingJava(false);
    }
  };

  useEffect(() => {
    handleDetectJava();
  }, []);

  const handleInstallJava = async (major: number) => {
    setInstallingMajor(major);
    try {
      const list = await launcherBridge.installJava(major);
      setJavaRuntimes(list || []);
    } finally {
      setInstallingMajor(null);
    }
  };

  const handleSave = async (e?: React.FormEvent, override?: Partial<LauncherSettings>) => {
    if (e) e.preventDefault();
    const next = { ...form, ...(override || {}) };
    setForm(next);
    const saved = await launcherBridge.saveSettings(next);
    onSettingsUpdated(saved);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2200);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Glassmorphism & Minimalist Design Customizer */}
      <div className="glass-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Palette size={20} color="var(--accent-secondary)" />
            <div>
              <h3 className="heading-font" style={{ fontSize: 17, fontWeight: 700 }}>
                Design Minimaliste & Glassmorphisme
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Personnalisez la teinte lumineuse et l’intensité du flou acrylique en temps réel
              </p>
            </div>
          </div>
          {savedToast && (
            <span className="glass-pill" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
              <Check size={12} /> Enregistré
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18, alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Couleur d’accentuation (Orbes & Lumières)
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {ACCENT_THEMES.map((t) => {
                const active = form.themeAccent === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSave(undefined, { themeAccent: t.id })}
                    className="btn btn-glass"
                    style={{
                      borderColor: active ? t.color : undefined,
                      background: active ? `${t.color}25` : undefined,
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: t.color,
                      }}
                    />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass-card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Intensité du flou (Backdrop Blur)</span>
              <span className="mono" style={{ color: 'var(--accent-secondary)', fontSize: 12 }}>
                {form.glassBlur || 24}px
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={42}
              step={2}
              value={form.glassBlur || 24}
              onChange={(e) => handleSave(undefined, { glassBlur: Number(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
          </div>
        </div>
      </div>

      {/* Automatic Java Runtime Manager (JRE 8 / 17 / 21 / 25) */}
      <div className="glass-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Coffee size={20} color="#f59e0b" />
            <div>
              <h3 className="heading-font" style={{ fontSize: 17, fontWeight: 700 }}>
                Gestionnaire Automatique Java (Adoptium Temurin)
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Téléchargez ou détectez automatiquement Java 25 (MC 26.x+), Java 21 (MC 1.20.5+), Java 17 (MC 1.17+) et Java 8 (MC 1.0 - 1.16.5)
              </p>
            </div>
          </div>

          <button className="btn btn-glass" onClick={handleDetectJava} disabled={detectingJava}>
            <RefreshCw size={14} /> {detectingJava ? 'Analyse...' : 'Analyser le PC'}
          </button>
        </div>

        {/* 1-Click Auto-Install Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { major: 25, title: 'Java 25 (2026+)', desc: 'Requis pour Minecraft 26.1, 26.3 et snapshots 26w+' },
            { major: 21, title: 'Java 21 LTS', desc: 'Requis pour Minecraft 1.20.5 à 1.21.4' },
            { major: 17, title: 'Java 17 LTS', desc: 'Requis pour Minecraft 1.17 à 1.20.4' },
            { major: 8, title: 'Java 8 Legacy', desc: 'Requis pour Minecraft 1.0 à 1.16.5' },
          ].map((item) => {
            const installed = javaRuntimes.find((r) => r.major === item.major);
            const isInstalling = installingMajor === item.major;
            return (
              <div
                key={item.major}
                className="glass-card"
                style={{
                  padding: 15,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                  borderColor: installed ? 'rgba(16, 185, 129, 0.35)' : undefined,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{item.title}</span>
                    {installed ? (
                      <span
                        className="glass-pill"
                        style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: 10.5 }}
                      >
                        <Check size={11} /> Détecté ({installed.version})
                      </span>
                    ) : (
                      <span className="glass-pill" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                        Non installé
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{item.desc}</p>
                </div>

                <button
                  type="button"
                  className={`btn ${installed ? 'btn-glass' : 'btn-primary'}`}
                  style={{ width: '100%' }}
                  disabled={installingMajor !== null}
                  onClick={() => handleInstallJava(item.major)}
                >
                  <Download size={14} />
                  {isInstalling
                    ? javaProgress?.message || 'Installation...'
                    : installed
                    ? 'Réinstaller Temurin'
                    : `Télécharger Java ${item.major}`}
                </button>
              </div>
            );
          })}
        </div>

        {javaProgress && installingMajor !== null && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span>{javaProgress.message}</span>
              <span className="mono">{javaProgress.percent}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${javaProgress.percent}%` }} />
            </div>
          </div>
        )}

        {/* Detected Java paths list */}
        {javaRuntimes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Runtimes Java détectés sur cette machine :
            </span>
            {javaRuntimes.map((j, idx) => (
              <div
                key={idx}
                className="glass-card"
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                }}
              >
                <span className="mono">{j.path}</span>
                <span className="glass-pill mono" style={{ color: 'var(--accent-secondary)' }}>
                  Java {j.major} ({j.version})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Default Launch Settings & CurseForge Key */}
      <form
        onSubmit={(e) => handleSave(e)}
        className="glass-card"
        style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Cpu size={20} color="var(--accent-primary)" />
          <div>
            <h3 className="heading-font" style={{ fontSize: 17, fontWeight: 700 }}>
              Paramètres Globaux & API CurseForge
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Valeurs par défaut pour les nouvelles instances et clé API CurseForge optionnelle
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="glass-card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>RAM Maximale par défaut</span>
              <span className="mono" style={{ color: 'var(--accent-secondary)' }}>
                {form.maxRamMb} Mo ({(form.maxRamMb / 1024).toFixed(1)} Go)
              </span>
            </div>
            <input
              type="range"
              min={2048}
              max={16384}
              step={512}
              value={form.maxRamMb}
              onChange={(e) => setForm({ ...form, maxRamMb: Number(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Arguments JVM globaux par défaut
            </label>
            <input
              className="glass-input mono"
              value={form.jvmArgs}
              onChange={(e) => setForm({ ...form, jvmArgs: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'end' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <Key size={13} color="var(--curseforge)" /> Clé API CurseForge Studio (Optionnel — une clé intégrée est déjà active)
            </label>
            <input
              type="password"
              className="glass-input mono"
              placeholder="Laisser vide pour utiliser la clé intégrée ou coller $2a$10$..."
              value={form.curseforgeApiKey || ''}
              onChange={(e) => setForm({ ...form, curseforgeApiKey: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ height: 40 }}>
            <Save size={15} /> Enregistrer tout
          </button>
        </div>
      </form>
    </div>
  );
};
