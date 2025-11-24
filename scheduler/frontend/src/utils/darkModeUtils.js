/**
 * Utility functions for dark mode styling
 */

/**
 * Get the base page background color based on current theme
 * In light mode: uses the base lightness
 * In dark mode: reduces lightness by 60% (matching body background)
 */
export function getBaseBackgroundColor() {
  if (typeof document === 'undefined') {
    return `hsl(var(--background-hue), var(--background-saturation), var(--background-lightness))`;
  }
  
  const isDark = document.documentElement.classList.contains('dark');
  
  if (isDark) {
    // In dark mode, base background is reduced by 60%
    return `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) - 60%))`;
  } else {
    // In light mode, use base lightness
    return `hsl(var(--background-hue), var(--background-saturation), var(--background-lightness))`;
  }
}

/**
 * Get the header background color based on current theme
 * In light mode: slightly darker than base (reduces by 2%)
 * In dark mode: slightly lighter than panels (reduces by 52%)
 */
export function getHeaderBackgroundColor() {
  if (typeof document === 'undefined') {
    return `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) - 2%))`;
  }
  
  const isDark = document.documentElement.classList.contains('dark');
  const root = document.documentElement;
  
  // Read CSS variables - prefer inline style (most up-to-date) over computed style
  let bgHue, bgSat, bgLight;
  
  // Try inline style first (set synchronously, always current)
  const inlineHue = root.style.getPropertyValue('--background-hue');
  const inlineSat = root.style.getPropertyValue('--background-saturation');
  const inlineLight = root.style.getPropertyValue('--background-lightness');
  
  if (inlineHue && inlineSat && inlineLight) {
    bgHue = inlineHue.trim();
    bgSat = inlineSat.trim();
    bgLight = inlineLight.trim();
  } else {
    const computedStyle = getComputedStyle(root);
    bgHue = computedStyle.getPropertyValue('--background-hue').trim() || '270';
    bgSat = computedStyle.getPropertyValue('--background-saturation').trim() || '70%';
    bgLight = computedStyle.getPropertyValue('--background-lightness').trim() || '95%';
  }
  
  const lightness = parseFloat(bgLight);
  
  if (isDark) {
    // In dark mode, header is slightly lighter than panels
    const headerLightness = Math.max(5, Math.min(100, lightness - 52));
    return `hsl(${bgHue}, ${bgSat}, ${headerLightness}%)`;
  } else {
    // In light mode, header is slightly darker than base
    const headerLightness = Math.max(10, Math.min(100, lightness - 2));
    return `hsl(${bgHue}, ${bgSat}, ${headerLightness}%)`;
  }
}

/**
 * Get the panel background color based on current theme
 * In light mode: ensure panels are significantly lighter than buttons (min 80% lightness)
 * In dark mode: lighter than base (adds 10% to the already reduced value)
 */
export function getPanelBackgroundColor() {
  if (typeof document === 'undefined') {
    return `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) + 10%))`;
  }
  
  const isDark = document.documentElement.classList.contains('dark');
  
  // Read CSS variables - always read from inline style first (most up-to-date)
  // CSS variables are set via setProperty which updates inline style synchronously
  const root = document.documentElement;
  
  // Read directly from inline style - this is set synchronously in applyDarkMode
  let bgHue = root.style.getPropertyValue('--background-hue');
  let bgSat = root.style.getPropertyValue('--background-saturation');
  let bgLight = root.style.getPropertyValue('--background-lightness');
  
  // If not in inline style, fall back to computed style
  if (!bgHue || !bgSat || !bgLight) {
    const computedStyle = getComputedStyle(root);
    bgHue = computedStyle.getPropertyValue('--background-hue');
    bgSat = computedStyle.getPropertyValue('--background-saturation');
    bgLight = computedStyle.getPropertyValue('--background-lightness');
  }
  
  // Clean and parse values
  bgHue = (bgHue || '270').trim();
  bgSat = (bgSat || '70%').trim();
  bgLight = (bgLight || '95%').trim();
  
  const lightness = parseFloat(bgLight);
  
  if (isDark) {
    // In dark mode, base is lightness - 60%, panels should be lighter (add 10% to the reduced value)
    // This means: (lightness - 60%) + 10% = lightness - 50%
    const panelLightness = Math.max(10, Math.min(100, lightness - 50));
    return `hsl(${bgHue}, ${bgSat}, ${panelLightness}%)`;
  } else {
    // In light mode, ensure panels are significantly lighter than buttons
    // Use max to ensure minimum 80% lightness, preventing it from matching button color (typically 50%)
    const panelLightness = Math.max(80, Math.min(100, lightness + 10));
    return `hsl(${bgHue}, ${bgSat}, ${panelLightness}%)`;
  }
}

/**
 * Get the booked cell background color (for cells booked by others)
 * In dark mode: should be darker/grayed out
 */
export function getBookedCellBackgroundColor() {
  if (typeof document === 'undefined') {
    return `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) - 10%))`;
  }
  
  const isDark = document.documentElement.classList.contains('dark');
  
  // Read CSS variables - always read from inline style first (most up-to-date)
  // CSS variables are set via setProperty which updates inline style synchronously
  const root = document.documentElement;
  
  // Read directly from inline style - this is set synchronously in applyDarkMode
  let bgHue = root.style.getPropertyValue('--background-hue');
  let bgSat = root.style.getPropertyValue('--background-saturation');
  let bgLight = root.style.getPropertyValue('--background-lightness');
  
  // If not in inline style, fall back to computed style
  if (!bgHue || !bgSat || !bgLight) {
    const computedStyle = getComputedStyle(root);
    bgHue = computedStyle.getPropertyValue('--background-hue');
    bgSat = computedStyle.getPropertyValue('--background-saturation');
    bgLight = computedStyle.getPropertyValue('--background-lightness');
  }
  
  // Clean and parse values
  bgHue = (bgHue || '270').trim();
  bgSat = (bgSat || '70%').trim();
  bgLight = (bgLight || '95%').trim();
  
  const lightness = parseFloat(bgLight);
  
  if (isDark) {
    // In dark mode, make it darker than the base background
    const bookedLightness = Math.max(5, Math.min(100, lightness - 65));
    return `hsl(${bgHue}, ${bgSat}, ${bookedLightness}%)`;
  } else {
    // In light mode, make it slightly darker
    const bookedLightness = Math.max(10, Math.min(100, lightness - 10));
    return `hsl(${bgHue}, ${bgSat}, ${bookedLightness}%)`;
  }
}

/**
 * Get the booked cell border color
 */
export function getBookedCellBorderColor() {
  if (typeof document === 'undefined') {
    return `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) - 15%))`;
  }
  
  const isDark = document.documentElement.classList.contains('dark');
  
  // Read CSS variables - always read from inline style first (most up-to-date)
  // CSS variables are set via setProperty which updates inline style synchronously
  const root = document.documentElement;
  
  // Read directly from inline style - this is set synchronously in applyDarkMode
  let bgHue = root.style.getPropertyValue('--background-hue');
  let bgSat = root.style.getPropertyValue('--background-saturation');
  let bgLight = root.style.getPropertyValue('--background-lightness');
  
  // If not in inline style, fall back to computed style
  if (!bgHue || !bgSat || !bgLight) {
    const computedStyle = getComputedStyle(root);
    bgHue = computedStyle.getPropertyValue('--background-hue');
    bgSat = computedStyle.getPropertyValue('--background-saturation');
    bgLight = computedStyle.getPropertyValue('--background-lightness');
  }
  
  // Clean and parse values
  bgHue = (bgHue || '270').trim();
  bgSat = (bgSat || '70%').trim();
  bgLight = (bgLight || '95%').trim();
  
  const lightness = parseFloat(bgLight);
  
  if (isDark) {
    const borderLightness = Math.max(5, Math.min(100, lightness - 70));
    return `hsl(${bgHue}, ${bgSat}, ${borderLightness}%)`;
  } else {
    const borderLightness = Math.max(10, Math.min(100, lightness - 15));
    return `hsl(${bgHue}, ${bgSat}, ${borderLightness}%)`;
  }
}

