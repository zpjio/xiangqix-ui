import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface ThemeSelectOption<T extends string> {
  value: T;
  label: string;
  subLabel?: string;
}

interface ThemeSelectProps<T extends string> {
  value: T;
  options: ThemeSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  triggerClassName?: string;
  menuAlign?: 'left' | 'right';
  menuMinWidthClass?: string;
  disabled?: boolean;
}

export function ThemeSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  triggerClassName = '',
  menuAlign = 'left',
  menuMinWidthClass = 'min-w-full',
  disabled = false,
}: ThemeSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : options[0];

  useEffect(() => {
    if (!open) return;
    setHighlightedIdx(selectedIndex >= 0 ? selectedIndex : 0);

    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIdx((prev) => (prev + 1) % Math.max(1, options.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIdx(
          (prev) => (prev - 1 + Math.max(1, options.length)) % Math.max(1, options.length)
        );
      } else if (e.key === 'Enter' && highlightedIdx >= 0 && options[highlightedIdx]) {
        e.preventDefault();
        onChange(options[highlightedIdx].value);
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, selectedIndex, options, highlightedIdx, onChange]);

  return (
    <div ref={containerRef} className="relative inline-flex min-w-0">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`w-full flex items-center justify-between gap-1.5 rounded-md border xq-border bg-[var(--xq-bg-canvas)] xq-text-primary text-[0.8125rem] transition-colors focus:outline-none focus:border-[var(--xq-accent-gold)] ${
          disabled
            ? 'opacity-45 cursor-not-allowed'
            : 'hover:bg-[var(--xq-bg-hover)] cursor-pointer'
        } ${open ? 'border-[var(--xq-accent-gold)]' : ''} ${triggerClassName}`}
      >
        <span className="truncate text-left">{selectedOption?.label ?? ''}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 xq-text-muted shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180 text-[var(--xq-accent-gold)]' : ''
          }`}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute top-full mt-1 ${
            menuAlign === 'right' ? 'right-0' : 'left-0'
          } ${menuMinWidthClass} w-max max-w-[18rem] max-h-60 overflow-y-auto no-scrollbar rounded-lg border xq-border-strong bg-[var(--xq-bg-surface)] shadow-2xl py-1 z-50`}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlightedIdx;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlightedIdx(idx)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-[0.8125rem] flex items-center justify-between gap-3 whitespace-nowrap cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[var(--xq-btn-option-active-bg)] text-[var(--xq-accent-gold)] font-semibold'
                    : isHighlighted
                    ? 'bg-[var(--xq-bg-hover)] xq-text-primary'
                    : 'xq-text-secondary hover:bg-[var(--xq-bg-hover)] hover:text-[var(--xq-text-primary)]'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--xq-accent-gold)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
