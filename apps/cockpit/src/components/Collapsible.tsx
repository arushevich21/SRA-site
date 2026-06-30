'use client';

import { useState } from 'react';

export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-line mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 bg-panel hover:bg-panel-2 transition-colors cursor-pointer"
      >
        {typeof title === 'string' ? (
          <span className="font-display font-bold text-[20px] uppercase text-txt">
            {title}
          </span>
        ) : (
          title
        )}
        <span
          className={[
            'text-[12px] text-txt-3 transition-transform duration-200',
            open ? 'rotate-90' : '',
          ].join(' ')}
        >
          ▶
        </span>
      </button>
      <div
        className={[
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        ].join(' ')}
      >
        <div className="overflow-hidden">
          <div className="px-6 py-6 border-t border-line">{children}</div>
        </div>
      </div>
    </div>
  );
}
