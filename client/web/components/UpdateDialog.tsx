import { useTranslation } from 'react-i18next';
import { useAutoUpdater } from '../hooks/useAutoUpdater';

export default function UpdateDialog() {
  const { i18n } = useTranslation();
  const { status, updateInfo, downloadUpdate, installUpdate, checkUpdate, dismiss } = useAutoUpdater();
  const isZh = i18n.language.startsWith('zh');

  // Common close-X rendered in the top-right of every state card.
  const closeButton = (
    <button
      onClick={dismiss}
      aria-label={isZh ? '关闭' : 'Close'}
      style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        background: 'transparent',
        border: 'none',
        color: '#999',
        fontSize: '18px',
        lineHeight: 1,
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: '4px',
      }}
    >×</button>
  );

  // Only render when there's something to act on. 'idle' (no check yet or
  // "no update available") and 'checking' (transient) render nothing — the
  // user doesn't see a persistent card in the bottom-right.
  if (status === 'idle' || status === 'checking') return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999,
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      border: '1px solid rgba(0,0,0,0.08)',
      padding: '20px',
      maxWidth: '340px',
      width: '100%',
    }}>
      {closeButton}
      {status === 'available' && (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
            {isZh ? '发现新版本' : 'Update Available'}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
            v{updateInfo.version} {isZh ? '可以下载' : 'is ready to download'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={downloadUpdate}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {isZh ? '下载' : 'Download'}
            </button>
            <button
              onClick={dismiss}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.1)',
                background: '#fff',
                color: '#666',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {isZh ? '忽略' : 'Ignore'}
            </button>
          </div>
        </div>
      )}

      {status === 'downloading' && (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
            {isZh ? '下载更新中...' : 'Downloading update...'}
          </div>
          <div style={{
            height: '6px',
            borderRadius: '3px',
            background: '#f0f0f0',
            overflow: 'hidden',
            marginBottom: '8px',
          }}>
            <div style={{
              height: '100%',
              width: `${updateInfo.progress || 0}%`,
              background: '#2563eb',
              transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
            {Math.round(updateInfo.progress || 0)}%
          </div>
        </div>
      )}

      {status === 'downloaded' && (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
            {isZh ? '更新已就绪' : 'Update Ready'}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
            {isZh ? '点击下方按钮重启并更新' : 'Restart to apply the update'}
          </div>
          <button
            onClick={installUpdate}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {isZh ? '重启并更新' : 'Restart & Update'}
          </button>
        </div>
      )}

      {status === 'error' && (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: '#dc2626' }}>
            {isZh ? '更新失败' : 'Update Error'}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
            {updateInfo.error}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={checkUpdate}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.1)',
                background: '#fff',
                color: '#666',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {isZh ? '重试' : 'Retry'}
            </button>
            <button
              onClick={dismiss}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {isZh ? '忽略' : 'Ignore'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}