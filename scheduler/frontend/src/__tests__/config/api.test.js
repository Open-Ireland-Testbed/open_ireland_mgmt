/**
 * Tests for API configuration
 */
import { API_BASE_URL } from '../../config/api';

describe('API Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('uses REACT_APP_API_URL when set', () => {
    process.env.REACT_APP_API_URL = 'http://test-api:3000';
    jest.resetModules();
    const { API_BASE_URL: testUrl } = require('../../config/api');
    expect(testUrl).toBe('http://test-api:3000');
  });

  test('falls back to hostname with default port when REACT_APP_API_URL not set', () => {
    delete process.env.REACT_APP_API_URL;
    Object.defineProperty(window, 'location', {
      value: {
        hostname: 'localhost'
      },
      writable: true
    });
    jest.resetModules();
    const { API_BASE_URL: testUrl } = require('../../config/api');
    expect(testUrl).toContain('localhost');
    expect(testUrl).toContain('20001');
  });
});

