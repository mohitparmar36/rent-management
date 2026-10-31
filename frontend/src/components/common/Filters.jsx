import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import useDebouncedValue from '../../hooks/useDebouncedValue';

/** Search box that reports its value after the user stops typing. */
export function SearchInput({ value = '', onChange, placeholder = 'Search…', label = 'Search' }) {
  const [text, setText] = useState(value);
  const debounced = useDebouncedValue(text);

  // Follow outside changes (e.g. "Clear filters" or the back button)
  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (debounced.trim() !== value) onChange(debounced.trim());
    // Only react to the user's typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="search-input">
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {text && (
        <button type="button" className="search-clear" onClick={() => setText('')} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** A labelled <select> filter. options: strings or { value, label }. */
export function FilterSelect({ label, value = '', onChange, options, allLabel = 'All' }) {
  return (
    <label className="filter-select">
      <span className="sr-only">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{`${label}: ${allLabel}`}</option>
        {options.map((opt) => {
          const { value: v, label: l } = typeof opt === 'string' ? { value: opt, label: opt } : opt;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </label>
  );
}

/** Segmented tabs used as a quick status filter. tabs: [{ value, label, count? }] */
export function Tabs({ tabs, value = '', onChange, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={`tab${value === tab.value ? ' active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** The row above a table holding search and filters. */
export function Toolbar({ children, onClear, showClear }) {
  return (
    <div className="toolbar">
      {children}
      {showClear && (
        <button type="button" className="btn btn-link btn-sm" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}
