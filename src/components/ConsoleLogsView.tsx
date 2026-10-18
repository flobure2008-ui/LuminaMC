import React, { useEffect, useRef, useState } from 'react';
import { Copy, Search, Terminal, Trash2 } from 'lucide-react';
import { GameLogEntry, MinecraftInstance } from '../types/launcher';

interface ConsoleLogsViewProps {
  logs: GameLogEntry[];
  instances: MinecraftInstance[];
  onClearLogs: () => void;
}

export const ConsoleLogsView: React.FC<ConsoleLogsViewProps> = ({ logs, instances, onClearLogs }) => {
  const [filterInstance, setFilterInstance] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const filteredLogs = logs.filter((l) => {
    if (filterInstance !== 'all' && l.instanceId !== filterInstance) return false;
    if (searchQuery && !l.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs.length, autoScroll]);

  const handleCopy = () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelColor = (level: GameLogEntry['level']) => {
    if (level === 'error') return '#fb7185';
    if (level === 'warn') return '#fbbf24';
    if (level === 'info') return '#38bdf8';
    if (level === 'debug') return '#94a3b8';
    return '#e2e8f0';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Toolbar */}
      <div
        className="glass-card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <Terminal size={18} color="var(--accent-secondary)" />
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              className="glass-input"
              style={{ paddingLeft: 32, paddingBlock: 7 }}
              placeholder="Rechercher dans les logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="glass-select"
            style={{ width: 210, paddingBlock: 7 }}
            value={filterInstance}
            onChange={(e) => setFilterInstance(e.target.value)}
          >
            <option value="all">Toutes les instances</option>
            {instances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className={`btn ${autoScroll ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setAutoScroll(!autoScroll)}
          >
            Auto-scroll
          </button>
          <button className="btn btn-glass" onClick={handleCopy}>
            <Copy size={14} /> {copied ? 'Copié !' : 'Copier'}
          </button>
          <button className="btn btn-danger" onClick={onClearLogs}>
            <Trash2 size={14} /> Vider
          </button>
        </div>
      </div>

      {/* Console Output */}
      <div
        className="glass-card mono selectable"
        style={{
          flex: 1,
          minHeight: 440,
          maxHeight: 'calc(100vh - 230px)',
          overflowY: 'auto',
          padding: 16,
          background: 'rgba(6, 9, 16, 0.85)',
          fontSize: 12,
          lineHeight: 1.65,
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 120 }}>
            [LuminaMC Console] Prêt. Lancez une instance pour afficher les logs JVM et Minecraft en temps réel.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} style={{ display: 'flex', gap: 10, wordBreak: 'break-word', marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>[{log.timestamp}]</span>
              <span style={{ color: getLevelColor(log.level), fontWeight: 600, flexShrink: 0 }}>
                [{log.level.toUpperCase()}]
              </span>
              <span style={{ color: getLevelColor(log.level) }}>{log.text}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
