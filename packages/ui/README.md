# @tcdona/ui - Shared UI Package

Shared UI components and design system for TCDONA3 Scheduler and Inventory Management applications.

## Status

🚧 **Skeleton/Placeholder** - This package is currently a placeholder structure. Components are not yet implemented.

## Structure

- `src/components/` - React components (layout, primitives, feedback)
- `src/theme/` - Theme configuration (colors, typography, spacing)
- `src/providers/` - React context providers (ThemeProvider)
- `src/styles/` - Global CSS styles and Tailwind configuration

## Usage (Future)

Once implemented, apps can import components:

```javascript
import { Button, AppShell, Card, useTheme } from '@tcdona/ui';
import '@tcdona/ui/src/styles/index.css';
```

## Development

This package uses:
- React 19
- Tailwind CSS 3.4
- clsx for className utilities

