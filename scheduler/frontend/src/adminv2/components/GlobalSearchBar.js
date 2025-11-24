import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAdminSearchStore, { SEARCH_SCOPES } from '../state/useAdminSearchStore';
import { globalSearch } from '../api';

const DEBOUNCE_MS = 350;

function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debouncedValue;
}

function parseSearch(raw, currentScope) {
  const tokens = raw.trim().split(/\s+/);
  let scope = currentScope;
  const remaining = [];

  tokens.forEach((token) => {
    const [key, ...rest] = token.split(':');
    if (!rest.length) {
      remaining.push(token);
      return;
    }
    const value = rest.join(':');
    if (key === 'type') {
      scope = value.toLowerCase();
      return;
    }
    remaining.push(token);
  });

  return {
    scope,
    text: remaining.join(' ').trim(),
  };
}

function GlobalSearchBar() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const { query, scope, suggestions, setQuery, setScope, setSuggestions, setOpen } = useAdminSearchStore();
  const [isFocused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  useEffect(() => {
    let active = true;
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSuggestions({});
      return () => {
        active = false;
      };
    }
    setLoading(true);
    const { scope: derivedScope, text } = parseSearch(debouncedQuery, scope);
    if (derivedScope !== scope) {
      setScope(derivedScope);
    }
    const effectiveQuery = text || debouncedQuery;

    globalSearch({ q: effectiveQuery, scope: derivedScope }).then(
      (result) => {
        if (!active) return;
        setSuggestions(result || {});
        setLoading(false);
      },
      () => {
        if (!active) return;
        setSuggestions({});
        setLoading(false);
      }
    );
    return () => {
      active = false;
    };
  }, [debouncedQuery, scope, setScope, setSuggestions]);

  useEffect(() => {
    setOpen(isFocused);
  }, [isFocused, setOpen]);

  const suggestionEntries = useMemo(() => {
    return Object.entries(suggestions || {}).filter(([_, rows]) => rows && rows.length > 0);
  }, [suggestions]);

  const handleNavigate = (targetScope, item) => {
    setQuery('');
    setSuggestions({});
    setOpen(false);
    if (targetScope === 'bookings') {
      navigate(`/admin/approvals?focus=${item.id}`);
    } else if (targetScope === 'devices') {
      navigate(`/admin/devices?device=${item.id}`);
    } else if (targetScope === 'users') {
      navigate(`/admin/users?user=${item.id}`);
    } else if (targetScope === 'topologies') {
      navigate(`/admin/topologies?topology=${item.id}`);
    } else if (targetScope === 'logs') {
      navigate(`/admin/logs?filter=${item.id}`);
    }
  };

  return (
    <div className="relative max-w-xl w-full">
      <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:bg-white dark:focus-within:bg-gray-900 transition-colors">
        <svg className="h-4 w-4 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.5 16.5 4 4" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              const { scope: derivedScope, text } = parseSearch(query || '', scope);
              const params = new URLSearchParams();
              if (text) params.set('q', text);
              if (derivedScope === 'bookings') {
                navigate(`/admin/approvals${params.toString() ? `?${params.toString()}` : ''}`);
              } else if (derivedScope === 'devices') {
                navigate(`/admin/devices${params.toString() ? `?${params.toString()}` : ''}`);
              } else if (derivedScope === 'users') {
                navigate(`/admin/users${params.toString() ? `?${params.toString()}` : ''}`);
              } else if (derivedScope === 'topologies') {
                navigate(`/admin/topologies${params.toString() ? `?${params.toString()}` : ''}`);
              } else if (derivedScope === 'logs') {
                navigate(`/admin/logs${params.toString() ? `?${params.toString()}` : ''}`);
              }
              setOpen(false);
            }
          }}
          className="flex-1 bg-transparent border-none focus:outline-none text-sm text-gray-900 dark:text-gray-50 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          placeholder="Search bookings, devices, users, topologies, logs…"
          aria-label="Global admin search"
          data-admin-search
        />
        <kbd className="hidden sm:inline-flex text-[10px] uppercase tracking-wide font-semibold text-gray-400 border border-gray-300 dark:border-gray-700 rounded px-1 py-0.5">
          /
        </kbd>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {SEARCH_SCOPES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setScope(item)}
            className={[
              'px-2.5 py-1 text-xs rounded-full border',
              scope === item
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-500'
                : 'border-transparent bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700',
            ].join(' ')}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {isFocused && query && (
        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md shadow-lg max-h-80 overflow-y-auto z-40">
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Searching…</div>
          ) : suggestionEntries.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No matching results</div>
          ) : (
            suggestionEntries.map(([group, rows]) => (
              <div key={group}>
                <div className="px-4 py-2 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {group}
                </div>
                <ul>
                  {rows.map((item) => (
                    <li key={`${group}-${item.id}`}>
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors"
                        onClick={() => handleNavigate(group, item)}
                      >
                        <div className="font-medium">{item.label}</div>
                        {item.email && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{item.email}</div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default GlobalSearchBar;

