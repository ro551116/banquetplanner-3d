import React, { useEffect, useId, useState } from 'react';

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Shown inside the field, e.g. "m" or "°". */
  unit?: string;
  /** Decimal places shown while not editing. */
  precision?: number;
  disabled?: boolean;
  className?: string;
}

const format = (value: number, precision: number) =>
  Number.isFinite(value) ? String(Math.round(value * 10 ** precision) / 10 ** precision) : '';

/**
 * Draft-and-commit number input: typing never writes partial values (empty, "-", "1.") into scene data.
 * Commits on blur or Enter, clamps to [min, max], restores the previous value on invalid input and
 * skips no-op commits so focusing and leaving a field never creates an edit.
 */
export const NumberField: React.FC<NumberFieldProps> = ({
  label, value, onChange, min, max, step = 0.1, unit, precision = 2, disabled, className = '',
}) => {
  const id = useId();
  const [draft, setDraft] = useState(() => format(value, precision));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(format(value, precision));
  }, [value, precision, focused]);

  const commit = () => {
    const trimmed = draft.trim();
    const parsed = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(parsed)) {
      setDraft(format(value, precision));
      return;
    }
    let next = parsed;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    setDraft(format(next, precision));
    if (next !== value) onChange(next);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="ui-label">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          value={focused ? draft : format(value, precision)}
          onFocus={() => { setFocused(true); setDraft(format(value, precision)); }}
          onChange={event => setDraft(event.target.value)}
          onBlur={() => { setFocused(false); commit(); }}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setDraft(format(value, precision));
              event.currentTarget.blur();
            }
          }}
          className={`ui-input coarse:h-11 coarse:text-base ${unit ? 'pr-7' : ''}`}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-slate-400">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

/** Text input that commits once on blur/Enter instead of on every keystroke (IME-safe). */
export const TextField: React.FC<TextFieldProps> = ({ label, value, onChange, placeholder, maxLength, className = '' }) => {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const commit = () => {
    if (draft !== value) onChange(draft);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="ui-label">{label}</label>
      <input
        id={id}
        type="text"
        value={focused ? draft : value}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => { setFocused(true); setDraft(value); }}
        onChange={event => setDraft(event.target.value)}
        onBlur={() => { setFocused(false); commit(); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
        className="ui-input coarse:h-11 coarse:text-base"
      />
    </div>
  );
};
