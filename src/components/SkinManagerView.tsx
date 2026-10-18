import React, { useState } from 'react';
import {
  Check,
  Eye,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { Account, WardrobeSkin } from '../types/launcher';
import { SkinAnimationType, SkinViewer3D } from './SkinViewer3D';
import { launcherBridge } from '../services/bridge';

interface SkinManagerViewProps {
  activeAccount: Account | null;
  wardrobe: WardrobeSkin[];
  onWardrobeUpdated: (list: WardrobeSkin[]) => void;
  onAccountSkinUpdated: (accounts: Account[], activeId: string) => void;
}

export const SkinManagerView: React.FC<SkinManagerViewProps> = ({
  activeAccount,
  wardrobe,
  onWardrobeUpdated,
  onAccountSkinUpdated,
}) => {
  const [previewSkinUrl, setPreviewSkinUrl] = useState<string>(
    activeAccount?.skinUrl ||
      'https://textures.minecraft.net/texture/31f477eb1a7beee631c2ca64d06f8f68fa93a3386d04452ab27f43acdf1b60cb'
  );
  const [previewCapeUrl, setPreviewCapeUrl] = useState<string | null>(null);
  const [variant, setVariant] = useState<'classic' | 'slim'>(activeAccount?.skinVariant || 'classic');
  const [skinName, setSkinName] = useState<string>(activeAccount?.username || 'Skin Actif');

  const [animation, setAnimation] = useState<SkinAnimationType>('idle');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showOuterLayer, setShowOuterLayer] = useState<boolean>(true);

  const [playerQuery, setPlayerQuery] = useState('');
  const [fetchingPlayer, setFetchingPlayer] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [applying, setApplying] = useState(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleFetchPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerQuery.trim()) return;
    setFetchingPlayer(true);
    try {
      const res = await launcherBridge.fetchPlayerSkin(playerQuery.trim());
      setPreviewSkinUrl(res.skinUrl);
      setPreviewCapeUrl(res.capeUrl || null);
      setVariant(res.variant || 'classic');
      setSkinName(`Skin de ${res.username}`);
      showToast('success', `Skin de ${res.username} chargé en 3D !`);
    } catch (err: any) {
      showToast('error', err.message || 'Impossible de récupérer ce joueur.');
    } finally {
      setFetchingPlayer(false);
    }
  };

  const handleImportPng = async () => {
    const res = await launcherBridge.importSkinFile();
    if (res) {
      setPreviewSkinUrl(res.skinUrl);
      setPreviewCapeUrl(null);
      setSkinName(res.name || 'Skin Importé');
      showToast('success', `Fichier "${res.name}.png" chargé !`);
    }
  };

  const handleSaveWardrobe = async () => {
    const list = await launcherBridge.saveSkinToWardrobe({
      name: skinName || 'Skin Personnalisé',
      variant,
      skinUrl: previewSkinUrl,
      capeUrl: previewCapeUrl,
    });
    onWardrobeUpdated(list);
    showToast('success', 'Ajouté à votre Garde-Robe !');
  };

  const handleApplyToAccount = async () => {
    if (!activeAccount) {
      showToast('error', 'Veuillez sélectionner un compte actif.');
      return;
    }
    setApplying(true);
    try {
      const res = await launcherBridge.applySkin({
        skinUrl: previewSkinUrl,
        variant,
      });
      onAccountSkinUpdated(res.accounts, res.activeAccountId);
      showToast(
        'success',
        activeAccount.type === 'microsoft'
          ? `Skin appliqué et synchronisé sur le profil Microsoft "${activeAccount.username}" !`
          : `Skin appliqué au profil "${activeAccount.username}" !`
      );
    } catch (err: any) {
      showToast('error', err.message || 'Erreur lors de l’application du skin.');
    } finally {
      setApplying(false);
    }
  };

  const handleDeleteWardrobe = async (id: string) => {
    const list = await launcherBridge.deleteSkinFromWardrobe(id);
    onWardrobeUpdated(list);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 22, alignItems: 'start' }}>
      {/* Left Column: 3D Interactive Stage */}
      <div
        className="glass-card"
        style={{
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          position: 'relative',
          background:
            'radial-gradient(circle at 50% 35%, rgba(99, 102, 241, 0.2) 0%, rgba(14, 19, 32, 0.72) 75%)',
        }}
      >
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{skinName}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              Modèle : {variant === 'slim' ? 'Slim (Alex 3px)' : 'Classic (Steve 4px)'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`btn ${autoRotate ? 'btn-primary' : 'btn-glass'}`}
              style={{ padding: 7 }}
              onClick={() => setAutoRotate(!autoRotate)}
              title="Rotation automatique"
            >
              <RotateCw size={14} />
            </button>
            <button
              className={`btn ${showOuterLayer ? 'btn-primary' : 'btn-glass'}`}
              style={{ padding: 7 }}
              onClick={() => setShowOuterLayer(!showOuterLayer)}
              title="Afficher/Masquer la seconde couche (Chapeau / Veste)"
            >
              <Eye size={14} />
            </button>
          </div>
        </div>

        {/* 3D WebGL Viewer */}
        <SkinViewer3D
          skinUrl={previewSkinUrl}
          capeUrl={previewCapeUrl}
          variant={variant}
          animation={animation}
          showOuterLayer={showOuterLayer}
          autoRotate={autoRotate}
          width={310}
          height={375}
        />

        {/* Animation Selector */}
        <div className="segmented-tabs" style={{ width: '100%', justifyContent: 'center' }}>
          {(
            [
              ['idle', 'Repos'],
              ['walk', 'Marche'],
              ['run', 'Course'],
              ['fly', 'Vol'],
              ['none', 'Statique'],
            ] as const
          ).map(([animKey, label]) => (
            <button
              key={animKey}
              className={`segmented-tab ${animation === animKey ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', padding: '6px 8px' }}
              onClick={() => setAnimation(animKey)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Model Variant Toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
          <button
            type="button"
            className={`btn ${variant === 'classic' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setVariant('classic')}
          >
            Bras Classiques (4px)
          </button>
          <button
            type="button"
            className={`btn ${variant === 'slim' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setVariant('slim')}
          >
            Bras Fins / Slim (3px)
          </button>
        </div>

        {/* Apply & Save Buttons */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1, padding: '11px 16px' }}
            disabled={applying}
            onClick={handleApplyToAccount}
          >
            <Check size={15} /> {applying ? 'Application...' : 'Équiper sur mon compte'}
          </button>
          <button
            className="btn btn-glass"
            style={{ padding: '11px 14px' }}
            onClick={handleSaveWardrobe}
            title="Sauvegarder dans la Garde-Robe"
          >
            <Plus size={16} /> Garde-Robe
          </button>
        </div>
      </div>

      {/* Right Column: Import, Lookup & Wardrobe Collection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {statusMessage && (
          <div
            className="glass-card"
            style={{
              padding: '12px 16px',
              borderColor:
                statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
              background:
                statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.14)',
              color: statusMessage.type === 'success' ? '#34d399' : '#fda4af',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Import / Lookup Card */}
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 className="heading-font" style={{ fontSize: 17, fontWeight: 700 }}>
                Importer un Skin ou Récupérer via Pseudo Mojang
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Chargez une texture <code className="mono">.png</code> (64x64) ou entrez le pseudo d’un joueur Minecraft.
              </p>
            </div>
            <button className="btn btn-primary" onClick={handleImportPng}>
              <Upload size={15} /> Importer un fichier .PNG
            </button>
          </div>

          <form onSubmit={handleFetchPlayer} style={{ display: 'flex', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: 13,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                className="glass-input"
                style={{ paddingLeft: 38 }}
                placeholder="Entrer un pseudo Minecraft (ex: Notch, Philza, Grian...)"
                value={playerQuery}
                onChange={(e) => setPlayerQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-glass" disabled={fetchingPlayer}>
              <User size={15} /> {fetchingPlayer ? 'Recherche...' : 'Charger le Skin'}
            </button>
          </form>
        </div>

        {/* Wardrobe Collection */}
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 className="heading-font" style={{ fontSize: 17, fontWeight: 700 }}>
                Ma Garde-Robe ({wardrobe.length})
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Vos skins favoris enregistrés localement pour changer d’apparence en 1 clic.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {wardrobe.map((item) => {
              const isSelected = previewSkinUrl === item.skinUrl;
              return (
                <div
                  key={item.id}
                  className="glass-card glass-card-interactive"
                  style={{
                    padding: 14,
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--accent-primary)' : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                  onClick={() => {
                    setPreviewSkinUrl(item.skinUrl);
                    setPreviewCapeUrl(item.capeUrl || null);
                    setVariant(item.variant);
                    setSkinName(item.name);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.07)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        border: '1px solid var(--glass-border)',
                      }}
                    >
                      <Sparkles size={18} color="var(--accent-secondary)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13.5,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.name}
                      </div>
                      <span className="glass-pill" style={{ fontSize: 10, marginTop: 3 }}>
                        {item.variant === 'slim' ? 'Slim (3px)' : 'Classic (4px)'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-glass"
                      style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewSkinUrl(item.skinUrl);
                        setVariant(item.variant);
                        setSkinName(item.name);
                      }}
                    >
                      Prévisualiser 3D
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '6px 8px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWardrobe(item.id);
                      }}
                      title="Supprimer de la garde-robe"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
