import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconMinus, IconSquare, IconSquareDot, IconX } from '@tabler/icons-react';

export default function TitleBar() {
  const { t } = useTranslation();
  // Only render inside Electron — web build has no window controls to expose.
  if (typeof window === 'undefined' || !window.electronAPI) return null;

  const [isMaximized, setIsMaximized] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    let cancelled = false;
    window.electronAPI!.windowControls.isMaximized().then((v) => {
      if (!cancelled) setIsMaximized(v);
    });
    const off = window.electronAPI!.windowControls.onMaximizeChange((v) => setIsMaximized(v));
    // Pull the app version exposed via electronAPI so the brand label can
    // show the running build next to the platform name.
    window.electronAPI!.app.getVersion()
      .then((v) => { if (!cancelled) setVersion(v); })
      .catch(() => {});
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return (
    <div className="titlebar">
      {/* Brand section on the left. `no-drag` so it doesn't compete with
         the window-drag region in the middle; users can still select the
         text or right-click for the system menu. */}
      <div className="titlebar-brand" title={t('app.desktopBrandTitle', 'DeerClaw Desktop')}>
        <img src="./logo.svg" alt="" className="titlebar-brand-logo" />
        <span className="titlebar-brand-name">DeerClaw</span>
        {version && <span className="titlebar-brand-version">v{version}</span>}
      </div>
      <div className="titlebar-drag-region" />
      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-btn titlebar-btn--min"
          aria-label="Minimize"
          onClick={() => window.electronAPI!.windowControls.minimize()}
        >
          <IconMinus size={14} stroke={1.5} />
        </button>
        <button
          type="button"
          className="titlebar-btn titlebar-btn--max"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          aria-pressed={isMaximized}
          onClick={() => window.electronAPI!.windowControls.maximizeToggle()}
        >
          {isMaximized ? <IconSquareDot size={12} stroke={1.5} /> : <IconSquare size={12} stroke={1.5} />}
        </button>
        <button
          type="button"
          className="titlebar-btn titlebar-btn--close"
          aria-label="Close"
          onClick={() => window.electronAPI!.windowControls.close()}
        >
          <IconX size={14} stroke={1.5} />
        </button>
      </div>
    </div>
  );
}
