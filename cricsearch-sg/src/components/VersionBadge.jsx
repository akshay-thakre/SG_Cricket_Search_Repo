import React from 'react';
import pkg from '../../package.json';
const APP_VERSION = pkg.version;

export function VersionBadge() {
  return (
    <div
      aria-label={`Application version ${APP_VERSION}`}
      style={{
        position: 'fixed',
        bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
        right: '12px',
        fontSize: '10px',
        color: '#94a3b8',
        opacity: 0.55,
        zIndex: 50,
        pointerEvents: 'none',
        userSelect: 'none',
        letterSpacing: '0.04em',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      v{APP_VERSION}
    </div>
  );
}
