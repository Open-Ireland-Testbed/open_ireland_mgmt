import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDocumentObserver } from '../hooks/useDocumentObserver';

// Helper function to convert HSL to RGB
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const DEFAULT_BACKGROUND = { h: 270, s: 70, l: 95 }; // Light purple
const DEFAULT_ACCENT = { h: 270, s: 70, l: 50 }; // Purple

// Helper to get storage key based on mode
const getStorageKey = (baseKey, isDark) => {
    return `${baseKey}-${isDark ? 'dark' : 'light'}`;
};

// Load color from localStorage - moved outside component to avoid recreation on every render
const loadColor = (baseKey, defaultValue) => {
    if (typeof document === 'undefined') return defaultValue;
    const isDark = document.documentElement.classList.contains('dark');
    const storageKey = getStorageKey(baseKey, isDark);
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : defaultValue;
};

// 3 preset positions on the color grid
const PRESET_POSITIONS = [
    { h: 270, s: 70, label: 'Purple' },
    { h: 220, s: 70, label: 'Blue' },
    { h: 180, s: 70, label: 'Teal' },
];

export default function ColorPicker({ embedded = false, inline = false, onBack = null }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof document === 'undefined') return false;
        return document.documentElement.classList.contains('dark');
    });

    const [backgroundColor, setBackgroundColor] = useState(() => loadColor('backgroundColor', DEFAULT_BACKGROUND));
    const [accentColor, setAccentColor] = useState(() => loadColor('accentColor', DEFAULT_ACCENT));
    const [activePicker, setActivePicker] = useState('accent'); // 'background' or 'accent'
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const embeddedButtonRef = useRef(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

    // Watch for dark mode changes and reload colors using centralized observer
    useDocumentObserver(() => {
        if (typeof document === 'undefined') return;
        const newIsDark = document.documentElement.classList.contains('dark');
        if (newIsDark !== isDarkMode) {
            setIsDarkMode(newIsDark);
            // Reload colors for the new mode
            const bgStorageKey = getStorageKey('backgroundColor', newIsDark);
            const accentStorageKey = getStorageKey('accentColor', newIsDark);
            const savedBg = localStorage.getItem(bgStorageKey);
            const savedAccent = localStorage.getItem(accentStorageKey);
            const newBg = savedBg ? JSON.parse(savedBg) : DEFAULT_BACKGROUND;
            const newAccent = savedAccent ? JSON.parse(savedAccent) : DEFAULT_ACCENT;
            setBackgroundColor(newBg);
            setAccentColor(newAccent);
        }
    }, ['class']);

    // Calculate dropdown position when opening
    useEffect(() => {
        if (isOpen) {
            const buttonElement = embedded ? embeddedButtonRef.current : buttonRef.current;
            if (buttonElement) {
                const rect = buttonElement.getBoundingClientRect();
                setDropdownPosition({
                    top: rect.bottom + 8,
                    right: window.innerWidth - rect.right,
                });
            }
        }
    }, [isOpen, embedded]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!isOpen) return;

            const buttonElement = embedded ? embeddedButtonRef.current : buttonRef.current;
            // Check if click is inside the dropdown
            const clickedInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);
            // Check if click is on the button that opens the dropdown
            const clickedOnButton = buttonElement && buttonElement.contains(event.target);
            // Check for clicks on any element inside the color picker (canvas, inputs, buttons, etc.)
            const clickedOnColorPicker = event.target.closest('[data-color-picker-dropdown]') !== null;

            // Only close if click is completely outside the color picker and its button
            if (!clickedInsideDropdown && !clickedOnButton && !clickedOnColorPicker) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            // Use a small delay to avoid closing immediately when opening
            const timeoutId = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside, true);
            }, 100);

            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('mousedown', handleClickOutside, true);
            };
        }
    }, [isOpen, embedded]);

    // Apply colors to CSS variables
    useEffect(() => {
        document.documentElement.style.setProperty('--background-hue', backgroundColor.h.toString());
        document.documentElement.style.setProperty('--background-saturation', `${backgroundColor.s}%`);
        document.documentElement.style.setProperty('--background-lightness', `${backgroundColor.l}%`);
    }, [backgroundColor]);

    useEffect(() => {
        document.documentElement.style.setProperty('--accent-hue', accentColor.h.toString());
        document.documentElement.style.setProperty('--accent-saturation', `${accentColor.s}%`);
        document.documentElement.style.setProperty('--accent-lightness', `${accentColor.l}%`);
    }, [accentColor]);

    const handleColorSelect = useCallback((h, s, pickerType) => {
        if (pickerType === 'background') {
            const newColor = { ...backgroundColor, h, s };
            setBackgroundColor(newColor);
            // Save immediately
            const storageKey = getStorageKey('backgroundColor', isDarkMode);
            localStorage.setItem(storageKey, JSON.stringify(newColor));
        } else {
            const newColor = { ...accentColor, h, s };
            setAccentColor(newColor);
            // Save immediately
            const storageKey = getStorageKey('accentColor', isDarkMode);
            localStorage.setItem(storageKey, JSON.stringify(newColor));
        }
    }, [backgroundColor, accentColor, isDarkMode]);

    // Shared color picker content component to reduce duplication
    const ColorPickerContent = () => (
        <div className="space-y-4" onMouseDown={(e) => e.stopPropagation()}>
            {/* Picker type selector */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActivePicker('background')}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activePicker === 'background'
                        ? 'text-white'
                        : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800'
                        }`}
                    style={activePicker === 'background' ? {
                        backgroundColor: `hsl(var(--background-hue), var(--background-saturation), var(--background-lightness))`,
                        color: (() => {
                            const bg = backgroundColor;
                            const lightness = bg.l;
                            return lightness > 50 ? '#000000' : '#ffffff';
                        })()
                    } : {}}
                >
                    Background
                </button>
                <button
                    onClick={() => setActivePicker('accent')}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activePicker === 'accent'
                        ? 'text-white'
                        : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800'
                        }`}
                    style={activePicker === 'accent' ? {
                        backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
                    } : {}}
                >
                    Buttons
                </button>
            </div>

            {/* Color grid */}
            <CircularColorGrid
                hue={activePicker === 'background' ? backgroundColor.h : accentColor.h}
                saturation={activePicker === 'background' ? backgroundColor.s : accentColor.s}
                onColorSelect={(h, s) => handleColorSelect(h, s, activePicker)}
                presetPositions={PRESET_POSITIONS}
                activePicker={activePicker}
                onWhiteSelect={activePicker === 'background' ? () => {
                    const newColor = { h: 0, s: 0, l: 100 };
                    setBackgroundColor(newColor);
                    const storageKey = getStorageKey('backgroundColor', isDarkMode);
                    localStorage.setItem(storageKey, JSON.stringify(newColor));
                } : undefined}
            />

            {/* Lightness slider */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Brightness
                    </label>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {activePicker === 'background' ? backgroundColor.l : accentColor.l}%
                    </span>
                </div>
                <div className="relative">
                    <input
                        type="range"
                        min={activePicker === 'background' && !isDarkMode ? '50' : '10'}
                        max="90"
                        value={activePicker === 'background' ? backgroundColor.l : accentColor.l}
                        onChange={(e) => {
                            const newL = parseInt(e.target.value, 10);
                            if (activePicker === 'background') {
                                const clampedL = isDarkMode ? newL : Math.max(50, Math.min(90, newL));
                                const newColor = { ...backgroundColor, l: clampedL };
                                setBackgroundColor(newColor);
                                const storageKey = getStorageKey('backgroundColor', isDarkMode);
                                localStorage.setItem(storageKey, JSON.stringify(newColor));
                            } else {
                                const newColor = { ...accentColor, l: newL };
                                setAccentColor(newColor);
                                const storageKey = getStorageKey('accentColor', isDarkMode);
                                localStorage.setItem(storageKey, JSON.stringify(newColor));
                            }
                        }}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                        style={{
                            background: `linear-gradient(to right, 
                                    hsl(${activePicker === 'background' ? backgroundColor.h : accentColor.h}, ${activePicker === 'background' ? backgroundColor.s : accentColor.s}%, ${activePicker === 'background' && !isDarkMode ? '50' : '10'}%),
                                    hsl(${activePicker === 'background' ? backgroundColor.h : accentColor.h}, ${activePicker === 'background' ? backgroundColor.s : accentColor.s}%, 90%))`
                        }}
                    />
                </div>
            </div>

            {/* Current color display */}
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <div
                    className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                    style={{
                        backgroundColor: activePicker === 'background'
                            ? `hsl(${backgroundColor.h}, ${backgroundColor.s}%, ${backgroundColor.l}%)`
                            : `hsl(${accentColor.h}, ${accentColor.s}%, ${accentColor.l}%)`
                    }}
                />
                <span>
                    {activePicker === 'background' ? 'Background' : 'Button'} color
                </span>
            </div>
        </div>
    );

    // If inline, render just the content without any wrapper
    if (inline) {
        return (
            <div className="space-y-4" data-color-picker-content onMouseDown={(e) => e.stopPropagation()}>
                {/* Header with back button */}
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                aria-label="Back"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Color Customization</h3>
                    </div>
                </div>
                <ColorPickerContent />
            </div>
        );
    }

    // If embedded, render with a button to open the picker
    if (embedded) {
        return (
            <>
                <button
                    ref={embeddedButtonRef}
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        <span className="text-sm text-gray-700 dark:text-gray-300">Customize Colors</span>
                    </div>
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
                {isOpen && createPortal(
                    <div
                        ref={dropdownRef}
                        data-color-picker-dropdown
                        className="fixed z-[100] w-80 glass-panel border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4"
                        style={{
                            top: `${dropdownPosition.top}px`,
                            right: `${dropdownPosition.right}px`,
                        }}
                        onMouseDown={(e) => {
                            // Prevent clicks inside from closing the dropdown
                            e.stopPropagation();
                        }}
                    >
                        <ColorPickerContent />
                    </div>,
                    document.body
                )}
            </>
        );
    }

    return (
        <>
            <div className="relative">
                <button
                    ref={buttonRef}
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
                    aria-label="Customize colors"
                    title="Customize colors"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                </button>
            </div>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    data-color-picker-dropdown
                    className="fixed z-[100] w-80 glass-panel border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4"
                    style={{
                        top: `${dropdownPosition.top}px`,
                        right: `${dropdownPosition.right}px`,
                    }}
                >
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Color Customization</h3>

                        {/* Picker Type Selector */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActivePicker('background')}
                                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${activePicker === 'background'
                                    ? ''
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                style={activePicker === 'background' ? {
                                    backgroundColor: `hsl(${backgroundColor.h}, ${backgroundColor.s}%, ${backgroundColor.l}%)`,
                                    color: backgroundColor.l > 60 ? '#000000' : '#ffffff'
                                } : {}}
                            >
                                Background
                            </button>
                            <button
                                onClick={() => setActivePicker('accent')}
                                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${activePicker === 'accent'
                                    ? 'text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                style={activePicker === 'accent' ? {
                                    backgroundColor: `hsl(${accentColor.h}, ${accentColor.s}%, ${accentColor.l}%)`
                                } : {}}
                            >
                                Buttons
                            </button>
                        </div>

                        {/* Color Grid */}
                        <CircularColorGrid
                            hue={activePicker === 'background' ? backgroundColor.h : accentColor.h}
                            saturation={activePicker === 'background' ? backgroundColor.s : accentColor.s}
                            onColorSelect={(h, s) => handleColorSelect(h, s, activePicker)}
                            presetPositions={PRESET_POSITIONS}
                            activePicker={activePicker}
                            onWhiteSelect={activePicker === 'background' ? () => {
                                const newColor = { h: 0, s: 0, l: 100 };
                                setBackgroundColor(newColor);
                                const storageKey = getStorageKey('backgroundColor', isDarkMode);
                                localStorage.setItem(storageKey, JSON.stringify(newColor));
                            } : undefined}
                        />

                        {/* Lightness Slider */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Brightness
                                </label>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {activePicker === 'background' ? backgroundColor.l : accentColor.l}%
                                </span>
                            </div>
                            <div className="relative">
                                <input
                                    type="range"
                                    min={activePicker === 'background' && !isDarkMode ? '50' : '10'}
                                    max="90"
                                    value={activePicker === 'background' ? backgroundColor.l : accentColor.l}
                                    onChange={(e) => {
                                        const l = parseInt(e.target.value, 10);
                                        if (activePicker === 'background') {
                                            // Ensure value is within bounds for light mode
                                            const minL = !isDarkMode ? 50 : 10;
                                            const clampedL = Math.max(minL, Math.min(90, l));
                                            const newColor = { ...backgroundColor, l: clampedL };
                                            setBackgroundColor(newColor);
                                            // Save immediately
                                            const storageKey = getStorageKey('backgroundColor', isDarkMode);
                                            localStorage.setItem(storageKey, JSON.stringify(newColor));
                                        } else {
                                            const newColor = { ...accentColor, l };
                                            setAccentColor(newColor);
                                            // Save immediately
                                            const storageKey = getStorageKey('accentColor', isDarkMode);
                                            localStorage.setItem(storageKey, JSON.stringify(newColor));
                                        }
                                    }}
                                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, 
                    hsl(${activePicker === 'background' ? backgroundColor.h : accentColor.h}, ${activePicker === 'background' ? backgroundColor.s : accentColor.s}%, ${activePicker === 'background' && !isDarkMode ? '50' : '10'}%),
                    hsl(${activePicker === 'background' ? backgroundColor.h : accentColor.h}, ${activePicker === 'background' ? backgroundColor.s : accentColor.s}%, 90%))`
                                    }}
                                />
                            </div>
                        </div>

                        {/* Current Color Display */}
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex-1">
                                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Current {activePicker === 'background' ? 'Background' : 'Button'} Color</div>
                                <div
                                    className="w-full h-8 rounded border-2 border-gray-300 dark:border-gray-600"
                                    style={{
                                        backgroundColor: `hsl(${activePicker === 'background' ? backgroundColor.h : accentColor.h}, ${activePicker === 'background' ? backgroundColor.s : accentColor.s}%, ${activePicker === 'background' ? backgroundColor.l : accentColor.l}%)`
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                , document.body
            )}
        </>
    );
}

function CircularColorGrid({ hue, saturation, onColorSelect, presetPositions, activePicker, onWhiteSelect }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const isDraggingRef = useRef(false);
    const moveHandlerRef = useRef(null);
    const upHandlerRef = useRef(null);
    const size = 200;
    const center = size / 2;
    const radius = size / 2 - 10;

    const getColorFromPoint = useCallback((x, y) => {
        if (!containerRef.current) return { h: 0, s: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const relativeX = x - rect.left - center;
        const relativeY = y - rect.top - center;
        const distance = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
        const angle = (Math.atan2(relativeY, relativeX) * 180) / Math.PI;
        const normalizedAngle = angle < 0 ? angle + 360 : angle;
        const normalizedDistance = Math.min(distance, radius);
        const s = (normalizedDistance / radius) * 100;
        return { h: Math.round(normalizedAngle), s: Math.round(s) };
    }, [center, radius]);

    // Memoize the color wheel image data - only recalculate when size/radius changes
    const colorWheelImageData = useMemo(() => {
        const imageData = new ImageData(size, size);
        const data = imageData.data;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - center;
                const dy = y - center;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                const normalizedAngle = angle < 0 ? angle + 360 : angle;

                if (distance <= radius) {
                    const h = normalizedAngle;
                    const s = (distance / radius) * 100;
                    const l = 50;

                    const rgb = hslToRgb(h / 360, s / 100, l / 100);
                    const index = (y * size + x) * 4;
                    data[index] = rgb[0];
                    data[index + 1] = rgb[1];
                    data[index + 2] = rgb[2];
                    data[index + 3] = 255;
                }
            }
        }
        return imageData;
    }, [size, center, radius]);

    // Draw color wheel once, then only update indicator
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = size;
        canvas.height = size;

        // Draw the color wheel from memoized data
        ctx.putImageData(colorWheelImageData, 0, 0);

        // Draw current selection indicator
        const angle = (hue * Math.PI) / 180;
        const r = (saturation / 100) * radius;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
    }, [hue, saturation, colorWheelImageData, center, radius]);

    // Store callbacks in refs to avoid recreating listeners
    const getColorFromPointRef = useRef(getColorFromPoint);
    const onColorSelectRef = useRef(onColorSelect);

    // Update refs when callbacks change
    useEffect(() => {
        getColorFromPointRef.current = getColorFromPoint;
        onColorSelectRef.current = onColorSelect;
    }, [getColorFromPoint, onColorSelect]);

    // Set up native event listeners directly on canvas element
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleMouseDown = (e) => {
            // Only handle left mouse button
            if (e.button !== 0) return;

            console.log('Canvas mousedown event fired');
            // Don't prevent default - we need the browser to track mouse movement
            e.stopPropagation();

            // Clean up any existing listeners first
            if (moveHandlerRef.current) {
                console.log('Cleaning up old mousemove listener');
                window.removeEventListener('mousemove', moveHandlerRef.current);
            }
            if (upHandlerRef.current) {
                console.log('Cleaning up old mouseup/mouseleave listeners');
                window.removeEventListener('mouseup', upHandlerRef.current);
                window.removeEventListener('mouseleave', upHandlerRef.current);
            }

            isDraggingRef.current = true;
            setIsDragging(true);
            console.log('Dragging started, isDraggingRef:', isDraggingRef.current);

            // Initial color selection using ref
            const { h, s } = getColorFromPointRef.current(e.clientX, e.clientY);
            onColorSelectRef.current(h, s);

            // Create move handler - use window instead of document
            const moveHandler = (moveEvent) => {
                if (!isDraggingRef.current || !containerRef.current) {
                    return;
                }
                moveEvent.preventDefault();
                moveEvent.stopPropagation();
                const { h: moveH, s: moveS } = getColorFromPointRef.current(moveEvent.clientX, moveEvent.clientY);
                console.log('Mousemove - updating color to:', moveH, moveS);
                onColorSelectRef.current(moveH, moveS);
            };

            // Create up handler
            const upHandler = (upEvent) => {
                if (!isDraggingRef.current) {
                    return;
                }
                upEvent.preventDefault();
                upEvent.stopPropagation();
                isDraggingRef.current = false;
                setIsDragging(false);
                console.log('Dragging stopped');

                // Remove listeners
                if (moveHandlerRef.current) {
                    window.removeEventListener('mousemove', moveHandlerRef.current);
                    moveHandlerRef.current = null;
                }
                if (upHandlerRef.current) {
                    window.removeEventListener('mouseup', upHandlerRef.current);
                    window.removeEventListener('mouseleave', upHandlerRef.current);
                    upHandlerRef.current = null;
                }
            };

            // Store handlers in refs
            moveHandlerRef.current = moveHandler;
            upHandlerRef.current = upHandler;

            // Attach listeners to window (not document) without capture phase
            console.log('Attaching mousemove, mouseup, mouseleave listeners to window');
            window.addEventListener('mousemove', moveHandler, { passive: false });
            window.addEventListener('mouseup', upHandler, { passive: false });
            window.addEventListener('mouseleave', upHandler, { passive: false });
            console.log('Listeners attached to window, waiting for mousemove events...');
        };

        // Attach native mousedown listener directly to canvas (only once)
        // Use bubble phase instead of capture to avoid conflicts
        console.log('Setting up canvas mousedown listener');
        canvas.addEventListener('mousedown', handleMouseDown, { passive: false });

        return () => {
            console.log('Cleaning up canvas mousedown listener');
            canvas.removeEventListener('mousedown', handleMouseDown, { passive: false });
            // Clean up any remaining listeners
            if (moveHandlerRef.current) {
                window.removeEventListener('mousemove', moveHandlerRef.current);
                moveHandlerRef.current = null;
            }
            if (upHandlerRef.current) {
                window.removeEventListener('mouseup', upHandlerRef.current);
                window.removeEventListener('mouseleave', upHandlerRef.current);
                upHandlerRef.current = null;
            }
        };
    }, []); // Empty dependency array - only run once on mount

    return (
        <div className="flex flex-col items-center gap-3" onMouseDown={(e) => e.stopPropagation()}>
            <div
                ref={containerRef}
                className="relative"
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                onMouseDown={(e) => {
                    // Prevent any parent handlers from interfering
                    e.stopPropagation();
                }}
            >
                <canvas
                    ref={canvasRef}
                    className="cursor-crosshair rounded-full border-2 border-gray-300 dark:border-gray-600"
                    style={{
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        touchAction: 'none',
                        pointerEvents: 'auto',
                        cursor: 'crosshair',
                        display: 'block'
                    }}
                />
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
                {activePicker === 'background' && onWhiteSelect && (
                    <button
                        onClick={onWhiteSelect}
                        className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                        style={{ backgroundColor: '#ffffff' }}
                        title="White"
                        aria-label="Select white preset"
                    />
                )}
                {presetPositions.map((preset, idx) => (
                    <button
                        key={idx}
                        onClick={() => onColorSelect(preset.h, preset.s)}
                        className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                        style={{ backgroundColor: `hsl(${preset.h}, ${preset.s}%, 50%)` }}
                        title={preset.label}
                        aria-label={`Select ${preset.label} preset`}
                    />
                ))}
            </div>
        </div>
    );
}

