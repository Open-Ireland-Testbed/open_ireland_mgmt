import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../config/api';
import Spinner from './Spinner';

const MAX_SUGGESTIONS = 10;

function normalizeUsername(username) {
    return username?.trim() || '';
}

export default function CollaboratorInput({
    value = [],
    onChange,
    currentUser,
    disabled = false,
    label = 'Collaborators',
    placeholder = 'Add collaborator by username',
    onValidatingChange,
}) {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [shakeTargets, setShakeTargets] = useState(new Set());
    const [pendingError, setPendingError] = useState('');

    const containerRef = useRef(null);
    const debounceTimerRef = useRef(null);
    const pendingValidationRef = useRef(null);

    const normalizedCurrentUser = useMemo(
        () => normalizeUsername(currentUser).toLowerCase(),
        [currentUser]
    );

    const normalizedValues = useMemo(
        () => value.map((v) => normalizeUsername(v)).filter(Boolean),
        [value]
    );

    const setValidating = useCallback((state) => {
        setIsValidating(state);
        if (onValidatingChange) {
            onValidatingChange(state);
        }
    }, [onValidatingChange]);

    const triggerShake = useCallback((username) => {
        setShakeTargets(prev => {
            const next = new Set(prev);
            next.add(username.toLowerCase());
            return next;
        });
        setTimeout(() => {
            setShakeTargets(prev => {
                const next = new Set(prev);
                next.delete(username.toLowerCase());
                return next;
            });
        }, 600);
    }, []);

    const addCollaborator = useCallback(
        (username, { skipValidation = false } = {}) => {
            const normalized = normalizeUsername(username);
            if (!normalized) {
                return;
            }

            if (normalized.toLowerCase() === normalizedCurrentUser) {
            setErrorMessage('You are already the owner of this booking.');
            triggerShake(normalized);
                setInputValue('');
                setSuggestions([]);
                return;
            }

            if (normalizedValues.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) {
            setErrorMessage('Collaborator already added.');
            triggerShake(normalized);
                setInputValue('');
                setSuggestions([]);
                return;
            }

        const commitAddition = () => {
            const updated = [...normalizedValues, normalized];
            onChange?.(updated);
            setInputValue('');
            setSuggestions([]);
            setErrorMessage('');
            setPendingError('');
        };

        if (skipValidation) {
            commitAddition();
            return;
        }

        if (pendingValidationRef.current) {
            pendingValidationRef.current.abort();
        }

        const controller = new AbortController();
        pendingValidationRef.current = controller;
        setPendingError('');
        setValidating(true);

        fetch(
            `${API_BASE_URL}/api/users/search?q=${encodeURIComponent(normalized)}&limit=1`,
            {
                credentials: 'include',
                signal: controller.signal,
            }
        )
            .then(res => {
                if (!res.ok) {
                    throw new Error('Lookup failed');
                }
                return res.json();
            })
            .then(data => {
                const match = Array.isArray(data)
                    ? data.find(entry => entry.username?.toLowerCase() === normalized.toLowerCase())
                    : null;
                if (!match) {
                    setPendingError('User not found in testbed system.');
                    setErrorMessage('User not found in testbed system.');
                    triggerShake(normalized);
                    return;
                }
                commitAddition();
            })
            .catch(error => {
                if (error.name === 'AbortError') {
                    return;
                }
                setPendingError('Validation failed, please retry.');
                setErrorMessage('Validation failed, please retry.');
            })
            .finally(() => {
                setValidating(false);
                pendingValidationRef.current = null;
            });
    },
    [normalizedCurrentUser, normalizedValues, onChange, triggerShake, setValidating]
    );

    const removeCollaborator = useCallback(
        (username) => {
            const normalized = normalizeUsername(username);
            const updated = normalizedValues.filter(
                (existing) => existing.toLowerCase() !== normalized.toLowerCase()
            );
            onChange?.(updated);
        },
        [normalizedValues, onChange]
    );

    useEffect(() => {
        if (!isFocused || disabled) {
            setSuggestions([]);
            return;
        }

        const query = inputValue.trim();
        if (!query) {
            setSuggestions([]);
            setErrorMessage('');
            return;
        }

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            if (pendingValidationRef.current) {
                pendingValidationRef.current.abort();
            }
            const controller = new AbortController();
            pendingValidationRef.current = controller;
            setIsLoading(true);
            fetch(
                `${API_BASE_URL}/api/users/search?q=${encodeURIComponent(query)}&limit=${MAX_SUGGESTIONS}`,
                {
                    credentials: 'include',
                    signal: controller.signal,
                }
            )
                .then(res => {
                    if (!res.ok) {
                        throw new Error('Search failed');
                    }
                    return res.json();
                })
                .then(data => {
                    const filtered = data
                        .map((user) => normalizeUsername(user.username))
                        .filter(Boolean)
                        .filter((username) => {
                            if (username.toLowerCase() === normalizedCurrentUser) return false;
                            return !normalizedValues.some(
                                (existing) => existing.toLowerCase() === username.toLowerCase()
                            );
                        });
                    setSuggestions(filtered);
                    setErrorMessage('');
                })
                .catch(error => {
                    if (error.name !== 'AbortError') {
                        setSuggestions([]);
                    }
                })
                .finally(() => {
                    setIsLoading(false);
                    pendingValidationRef.current = null;
                });
        }, 300);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [inputValue, isFocused, normalizedCurrentUser, normalizedValues, disabled]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsFocused(false);
                setSuggestions([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === 'Tab' || event.key === ',') {
            event.preventDefault();
            addCollaborator(inputValue);
        } else if (event.key === 'Backspace' && !inputValue && normalizedValues.length > 0) {
            removeCollaborator(normalizedValues[normalizedValues.length - 1]);
        }
    };

    return (
        <div className="flex flex-col gap-2" ref={containerRef}>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {label}
            </label>
            <div
                className={`flex flex-wrap items-center gap-2 rounded-md border bg-white dark:bg-gray-700 px-3 py-2 transition-colors ${disabled
                    ? 'opacity-60 cursor-not-allowed border-gray-200 dark:border-gray-700'
                    : 'border-gray-200 dark:border-gray-600 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 dark:focus-within:ring-blue-500/40'
                    } ${errorMessage ? 'border-red-400 dark:border-red-500' : ''}`}
                onClick={() => {
                    if (!disabled) {
                        setIsFocused(true);
                    }
                }}
            >
                {normalizedValues.map((username) => (
                    <span
                        key={username}
                        className={`flex items-center gap-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold px-2 py-1 text-xs transition-transform ${shakeTargets.has(username.toLowerCase()) ? 'animate-shake' : ''
                            }`}
                    >
                        @{username}
                        {!disabled && (
                            <button
                                type="button"
                                className="focus:outline-none"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    removeCollaborator(username);
                                }}
                                aria-label={`Remove collaborator ${username}`}
                            >
                                ×
                            </button>
                        )}
                    </span>
                ))}

                {!disabled && (
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(event) => {
                            setInputValue(event.target.value);
                            setErrorMessage('');
                        }}
                        onFocus={() => setIsFocused(true)}
                        onKeyDown={handleKeyDown}
                        placeholder={normalizedValues.length === 0 ? placeholder : 'Add another collaborator'}
                        className="flex-1 min-w-[120px] bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none disabled:opacity-60"
                        disabled={isValidating || disabled}
                        aria-invalid={Boolean(errorMessage)}
                        aria-describedby={errorMessage ? 'collaborator-feedback' : undefined}
                    />
                )}

                {isValidating && !disabled && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
                        <Spinner className="h-3 w-3" />
                        Validating…
                    </div>
                )}
            </div>

            {!disabled && isFocused && (suggestions.length > 0 || isLoading) && (
                <div className="relative">
                    <div className="absolute z-30 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
                        {isLoading && (
                            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                                Searching…
                            </div>
                        )}
                        {!isLoading && suggestions.length === 0 && (
                            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                                No matches found
                            </div>
                        )}
                        {!isLoading &&
                            suggestions.map((username) => (
                                <button
                                    key={username}
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={() => {
                                        addCollaborator(username);
                                        setIsFocused(false);
                                    }}
                                >
                                    @{username}
                                </button>
                            ))}
                    </div>
                </div>
            )}

            {!disabled && (errorMessage || pendingError) && (
                <p
                    id="collaborator-feedback"
                    className="text-xs text-red-600 dark:text-red-400"
                >
                    {errorMessage || pendingError}
                </p>
            )}
        </div>
    );
}


