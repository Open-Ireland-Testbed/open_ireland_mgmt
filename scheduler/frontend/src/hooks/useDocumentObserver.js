import { useEffect, useRef } from 'react';

/**
 * Centralized hook for observing document.documentElement attribute changes.
 * Reduces the number of MutationObservers by sharing a single observer instance.
 * 
 * @param {Function} callback - Function to call when attributes change
 * @param {Array<string>} attributeFilter - Array of attribute names to observe (default: ['class', 'style'])
 * @param {Object} options - Additional MutationObserver options
 */
export function useDocumentObserver(callback, attributeFilter = ['class', 'style'], options = {}) {
    const callbackRef = useRef(callback);
    
    // Keep callback ref up to date
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return undefined;
        }

        // Create a single observer instance shared across all subscribers
        if (!window.__documentObserver) {
            let updateTimeout = null;
            window.__documentObserver = {
                // Function to manually trigger updates (useful after synchronous CSS variable updates)
                triggerUpdate: () => {
                    if (updateTimeout) {
                        clearTimeout(updateTimeout);
                    }
                    // Use a single requestAnimationFrame to ensure all updates happen in the same frame
                    // This ensures all panels transition together
                    requestAnimationFrame(() => {
                        // Notify all subscribers synchronously in the same frame
                        window.__documentObserver.subscribers.forEach(sub => {
                            try {
                                sub.current();
                            } catch (error) {
                                console.error('Error in document observer subscriber:', error);
                            }
                        });
                    });
                },
                observer: new MutationObserver((mutations) => {
                    // Check if class or style attribute changed
                    const classChanged = mutations.some(mutation => 
                        mutation.type === 'attributes' && 
                        mutation.attributeName === 'class'
                    );
                    const styleChanged = mutations.some(mutation => 
                        mutation.type === 'attributes' && 
                        mutation.attributeName === 'style'
                    );
                    
                    if (classChanged || styleChanged) {
                        // Clear any pending updates
                        if (updateTimeout) {
                            clearTimeout(updateTimeout);
                        }
                        
                        // When class changes, CSS variables are updated synchronously right after in applyDarkMode
                        // We need to wait for BOTH the class change AND the CSS variable updates to complete
                        // Use a longer delay for class changes to ensure CSS variables are set before reading
                        const delay = classChanged ? 300 : 50;
                        updateTimeout = setTimeout(() => {
                            // Force a synchronous check to ensure CSS variables are actually set
                            // Then use requestAnimationFrame to ensure DOM is updated
                            const checkAndUpdate = () => {
                                // Verify CSS variables are set (they should be by now)
                                const root = document.documentElement;
                                const hasVars = root.style.getPropertyValue('--background-hue') || 
                                               getComputedStyle(root).getPropertyValue('--background-hue');
                                
                                if (hasVars || !classChanged) {
                                    // CSS variables are set, safe to read
                                    requestAnimationFrame(() => {
                                        // Notify all subscribers
                                        window.__documentObserver.subscribers.forEach(sub => {
                                            try {
                                                sub.current();
                                            } catch (error) {
                                                console.error('Error in document observer subscriber:', error);
                                            }
                                        });
                                    });
                                } else {
                                    // CSS variables not set yet, wait a bit more
                                    setTimeout(checkAndUpdate, 50);
                                }
                            };
                            
                            checkAndUpdate();
                            updateTimeout = null;
                        }, delay);
                    }
                }),
                subscribers: new Set(),
            };

            // Start observing
            window.__documentObserver.observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter,
                ...options,
            });
        }

        // Add this callback ref to subscribers
        window.__documentObserver.subscribers.add(callbackRef);

        // Cleanup: remove callback and disconnect observer if no subscribers remain
        return () => {
            if (window.__documentObserver) {
                window.__documentObserver.subscribers.delete(callbackRef);
                
                // If no more subscribers, disconnect and clean up
                if (window.__documentObserver.subscribers.size === 0) {
                    window.__documentObserver.observer.disconnect();
                    delete window.__documentObserver;
                }
            }
        };
    }, [attributeFilter, options]);
}

