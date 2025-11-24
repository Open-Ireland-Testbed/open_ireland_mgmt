# Frontend Tests

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run tests once and exit
npm test -- --watchAll=false
```

## Test Structure

- `mocks/` - Mock Service Worker handlers for API mocking
  - `handlers.js` - API request handlers
  - `server.js` - MSW server setup
- `components/` - Component tests
- `services/` - Service/utility tests
- `config/` - Configuration tests

## Writing Tests

Tests use:
- **Jest** - Test runner
- **React Testing Library** - Component testing
- **MSW** - API mocking

## Example Test

```javascript
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent';

test('renders component', () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

