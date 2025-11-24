// Shared UI Package - Main Export File

// Theme exports
export * from './theme/index.jsx';

// Layout components
export { default as AppShell } from './components/layout/AppShell.jsx';
export { default as Sidebar } from './components/layout/Sidebar.jsx';
export { default as Header } from './components/layout/Header.jsx';
export { default as PageHeader } from './components/layout/PageHeader.jsx';

// Primitive components
export { default as Button } from './components/primitives/Button.jsx';
export { default as Input } from './components/primitives/Input.jsx';
export { default as Select } from './components/primitives/Select.jsx';
export { default as Tabs } from './components/primitives/Tabs.jsx';
export { default as Table } from './components/primitives/Table.jsx';
export { default as Card } from './components/primitives/Card.jsx';
export { default as Tag } from './components/primitives/Tag.jsx';
export { default as Modal } from './components/primitives/Modal.jsx';

// Feedback components
export { default as Toast } from './components/feedback/Toast.jsx';
export { default as Spinner } from './components/feedback/Spinner.jsx';
export { default as Alert } from './components/feedback/Alert.jsx';

// Providers
export { ThemeProvider, useTheme } from './providers/ThemeProvider.jsx';

// Styles (should be imported separately in consuming apps)
// import '@tcdona/ui/src/styles/index.css'

