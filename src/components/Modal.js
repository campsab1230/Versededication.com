'use client';

import { useEffect, useRef } from 'react';

// Small accessible modal wrapper.
// - role="dialog" / aria-modal
// - closes on Escape
// - locks body scroll while open
// - moves focus into the dialog on open
export default function Modal({ onClose, labelledBy, children, maxWidth = 560 }) {
  const ref = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    // focus the dialog container so Escape + screen readers work
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        ref={ref}
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>
  );
}
