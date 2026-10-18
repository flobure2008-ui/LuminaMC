import React, { useState } from 'react';
import { Check, KeyRound, Plus, ShieldCheck, Trash2, UserCheck, UserPlus } from 'lucide-react';
import { Account } from '../types/launcher';
import { launcherBridge } from '../services/bridge';

interface AccountsViewProps {
  accounts: Account[];
  activeAccountId: string | null;
  onAccountsUpdated: (accounts: Account[], activeId: string | null) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  activeAccountId,
  onAccountsUpdated,
}) => {
  const [offlineUsername, setOfflineUsername] = useState('');
  const [loadingMs, setLoadingMs] = useState(false);
  const [loadingOffline, setLoadingOffline] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleMicrosoftLogin = async () => {
    setLoadingMs(true);
    setErrorMsg(null);
    try {
      const res = await launcherBridge.loginMicrosoft();
      onAccountsUpdated(res.accounts, res.activeAccountId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la connexion Microsoft.');
    } finally {
      setLoadingMs(false);
    }
  };

  const handleOfflineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offlineUsername.trim()) return;
    setLoadingOffline(true);
    setErrorMsg(null);
    try {
      const res = await launcherBridge.loginOffline(offlineUsername.trim());
      onAccountsUpdated(res.accounts, res.activeAccountId);
      setOfflineUsername('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Impossible de créer le profil hors-ligne.');
    } finally {
      setLoadingOffline(false);
    }
  };

  const handleSetActive = async (id: string) => {
    const res = await launcherBridge.setActiveAccount(id);
    onAccountsUpdated(res.accounts, res.activeAccountId);
  };

  const handleRemove = async (id: string) => {
    const res = await launcherBridge.removeAccount(id);
    onAccountsUpdated(res.accounts, res.activeAccountId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Cards: Microsoft OAuth + Offline Account */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Microsoft OAuth Card */}
        <div
          className="glass-card"
          style={{
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 16,
            background:
              'linear-gradient(135deg, rgba(56, 189, 248, 0.14) 0%, rgba(16, 22, 37, 0.65) 100%)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(56, 189, 248, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={20} color="#38bdf8" />
              </div>
              <div>
                <h3 className="heading-font" style={{ fontSize: 16.5, fontWeight: 700 }}>
                  Compte Microsoft Officiel
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Xbox Live • serveurs officiels • synchronisation Skin
                </span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Connectez votre compte Microsoft via la fenêtre sécurisée OAuth2 officielle pour jouer sur tous les serveurs
              premium et synchroniser votre profil Minecraft Java Edition.
            </p>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '11px 16px' }}
            disabled={loadingMs}
            onClick={handleMicrosoftLogin}
          >
            <KeyRound size={15} />
            {loadingMs ? 'Ouverture de Microsoft OAuth...' : 'Se connecter avec Microsoft'}
          </button>
        </div>

        {/* Offline Account Card */}
        <div
          className="glass-card"
          style={{
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserPlus size={20} color="var(--accent-primary)" />
              </div>
              <div>
                <h3 className="heading-font" style={{ fontSize: 16.5, fontWeight: 700 }}>
                  Compte Hors-Ligne (Pseudo libre)
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Solo, LAN & serveurs acceptant le mode hors-ligne
                </span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Créez instantanément un profil local avec le pseudo de votre choix. Si le pseudo existe sur Mojang, son
              skin est récupéré automatiquement.
            </p>
          </div>

          <form onSubmit={handleOfflineLogin} style={{ display: 'flex', gap: 10 }}>
            <input
              className="glass-input"
              placeholder="Pseudo (ex: AetherPlayer)"
              maxLength={16}
              value={offlineUsername}
              onChange={(e) => setOfflineUsername(e.target.value)}
            />
            <button type="submit" className="btn btn-glass" disabled={loadingOffline || !offlineUsername.trim()}>
              <Plus size={15} /> Ajouter
            </button>
          </form>
        </div>
      </div>

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

      {/* Accounts List */}
      <div className="glass-card" style={{ padding: 22 }}>
        <h3 className="heading-font" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 14 }}>
          Comptes Enregistrés ({accounts.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {accounts.map((acc) => {
            const isActive = acc.id === activeAccountId;
            return (
              <div
                key={acc.id}
                className="glass-card"
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderColor: isActive ? 'var(--accent-primary)' : undefined,
                  background: isActive ? 'rgba(99, 102, 241, 0.12)' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <img
                    src={`https://minotar.net/helm/${encodeURIComponent(acc.username)}/48.png`}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://minotar.net/helm/MHF_Steve/48.png';
                    }}
                    alt={acc.username}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      border: '1px solid var(--glass-border-strong)',
                      imageRendering: 'pixelated',
                    }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{acc.username}</span>
                      <span
                        className="glass-pill"
                        style={{
                          fontSize: 10.5,
                          color: acc.type === 'microsoft' ? '#38bdf8' : 'var(--text-secondary)',
                        }}
                      >
                        {acc.type === 'microsoft' ? 'Microsoft Officiel' : 'Hors-Ligne'}
                      </span>
                      {isActive && (
                        <span
                          className="glass-pill"
                          style={{
                            fontSize: 10.5,
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#34d399',
                          }}
                        >
                          <Check size={11} /> Compte Actif
                        </span>
                      )}
                    </div>
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                      UUID : {acc.uuid}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {!isActive && (
                    <button className="btn btn-primary" onClick={() => handleSetActive(acc.id)}>
                      <UserCheck size={14} /> Utiliser ce compte
                    </button>
                  )}
                  {accounts.length > 1 && (
                    <button
                      className="btn btn-danger"
                      style={{ padding: '8px 10px' }}
                      onClick={() => handleRemove(acc.id)}
                      title="Supprimer ce compte"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
