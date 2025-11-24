import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';

const getCurrentTheme = () => {
  if (typeof document === 'undefined') {
    return 'light';
  }
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

// Get accent color from CSS variables
const getAccentColor = () => {
  if (typeof document === 'undefined') {
    return { h: 270, s: 70, l: 50 };
  }
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  const hue = computedStyle.getPropertyValue('--accent-hue') || '270';
  const saturation = computedStyle.getPropertyValue('--accent-saturation') || '70%';
  const lightness = computedStyle.getPropertyValue('--accent-lightness') || '50%';
  return {
    h: parseInt(hue, 10),
    s: parseFloat(saturation),
    l: parseFloat(lightness),
  };
};

// Get background color from CSS variables
const getBackgroundColor = () => {
  if (typeof document === 'undefined') {
    return { h: 270, s: 70, l: 95 };
  }
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  const hue = computedStyle.getPropertyValue('--background-hue') || '270';
  const saturation = computedStyle.getPropertyValue('--background-saturation') || '70%';
  const lightness = computedStyle.getPropertyValue('--background-lightness') || '95%';
  return {
    h: parseInt(hue, 10),
    s: parseFloat(saturation),
    l: parseFloat(lightness),
  };
};

const hslToHex = (h, s, l) => {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export default function ParticleBackground({ className = '', opacity = 0.6 }) {
  const [theme, setTheme] = useState(getCurrentTheme);
  const [accentColor, setAccentColor] = useState(() => {
    const color = getAccentColor();
    return hslToHex(color.h, color.s, color.l);
  });
  const [backgroundColor, setBackgroundColor] = useState(() => {
    const color = getBackgroundColor();
    return `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
  });

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    setTheme(getCurrentTheme());

    const updateColors = () => {
      const accent = getAccentColor();
      const bg = getBackgroundColor();
      setAccentColor(hslToHex(accent.h, accent.s, accent.l));
      setBackgroundColor(`hsl(${bg.h}, ${bg.s}%, ${bg.l}%)`);
    };

    // Debounce updateColors to prevent excessive re-renders
    let debounceTimeout;
    const debouncedUpdateColors = () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(updateColors, 100);
    };

    const observer = new MutationObserver(() => {
      setTheme(getCurrentTheme());
      debouncedUpdateColors();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    return () => {
      clearTimeout(debounceTimeout);
      observer.disconnect();
    };
  }, []);

  const particlesInit = useCallback(async (engine) => {
    await loadFull(engine);
  }, []);

  const layerOpacity = Math.min(1, Math.max(0.2, opacity));

  const options = useMemo(() => {
    // In dark mode, use darker background and lighter particles
    const bgColor = theme === 'dark' 
      ? (() => {
          const bg = getBackgroundColor();
          // Make it darker for dark mode
          return `hsl(${bg.h}, ${bg.s}%, ${Math.max(10, bg.l - 60)}%)`;
        })()
      : backgroundColor;
    
    // In dark mode, make particles lighter (lighter version of accent color)
    const particleColor = theme === 'dark'
      ? (() => {
          const accent = getAccentColor();
          // Make particles lighter in dark mode
          return hslToHex(accent.h, accent.s, Math.min(85, accent.l + 30));
        })()
      : accentColor;
    
    const particleOpacityValue = theme === 'dark' ? Math.min(1, layerOpacity + 0.2) : layerOpacity;
    const linkOpacityValue = theme === 'dark' ? Math.min(1, layerOpacity + 0.1) : Math.max(0.15, layerOpacity * 0.8);
    return {
      fullScreen: false,
      background: {
        color: {
          value: 'transparent', // Particles should be transparent to blend with wrapper background
        },
      },
      particles: {
        number: {
          value: 80,
          density: {
            enable: true,
            area: 800,
          },
        },
        color: {
          value: particleColor,
        },
        shape: {
          type: 'circle',
          stroke: {
            width: 0,
            color: '#000000',
          },
        },
        opacity: {
          value: particleOpacityValue,
          random: false,
          animation: {
            enable: false,
            speed: 1,
            minimumValue: 0.1,
            sync: false,
          },
        },
        size: {
          value: 3,
          random: true,
          animation: {
            enable: false,
            speed: 40,
            minimumValue: 0.1,
            sync: false,
          },
        },
        links: {
          enable: true,
          distance: 150,
          color: particleColor,
          opacity: linkOpacityValue,
          width: 1,
        },
        move: {
          enable: true,
          speed: 6,
          direction: 'none',
          random: false,
          straight: false,
          outModes: {
            default: 'out',
          },
          bounce: false,
          attract: {
            enable: false,
            rotateX: 600,
            rotateY: 1200,
          },
        },
      },
      interactivity: {
        detect_on: 'window',
        detectsOn: 'window',
        events: {
          onHover: {
            enable: true,
            mode: 'repulse',
          },
          onClick: {
            enable: true,
            mode: 'push',
          },
          resize: true,
        },
        modes: {
          grab: {
            distance: 400,
            links: {
              opacity: 1,
            },
          },
          bubble: {
            distance: 400,
            size: 40,
            duration: 2,
            opacity: 8,
            speed: 3,
          },
          repulse: {
            distance: 200,
            duration: 0.4,
          },
          push: {
            quantity: 4,
          },
          remove: {
            quantity: 2,
          },
        },
      },
      detectRetina: true,
    };
  }, [theme, accentColor, backgroundColor, layerOpacity, opacity]);

  if (typeof window === 'undefined') {
    return null;
  }

  const bgColor = theme === 'dark' 
    ? (() => {
        const bg = getBackgroundColor();
        return `hsl(${bg.h}, ${bg.s}%, ${Math.max(10, bg.l - 60)}%)`;
      })()
    : backgroundColor;

  return (
    <div 
      className="fixed inset-0 pointer-events-none" 
      style={{ 
        zIndex: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        backgroundColor: bgColor,
      }}
    >
    <Particles
      id="particle-background"
      init={particlesInit}
      options={options}
        className={`w-full h-full ${className}`}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    />
    </div>
  );
}


