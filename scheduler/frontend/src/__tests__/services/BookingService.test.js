/**
 * Tests for BookingService
 * Uses MSW for API mocking
 */
import { gatherAllIntervals, submitAllBookings } from '../../client/BookingService';
import { server } from '../mocks/server';
import { rest } from 'msw';
import { API_BASE_URL } from '../../config/api';

describe('BookingService', () => {
  describe('gatherAllIntervals', () => {
    test('processes normal slots correctly', () => {
      const globalSelections = {
        'Router': {
          'Router1': [
            {
              dateKey: '2025-01-15',
              segIndex: 0,
              conflict: false
            },
            {
              dateKey: '2025-01-15',
              segIndex: 1,
              conflict: false
            }
          ]
        }
      };

      const result = gatherAllIntervals(globalSelections);
      expect(result).toHaveLength(1);
      expect(result[0].device_type).toBe('Router');
      expect(result[0].device_name).toBe('Router1');
      expect(result[0].status).toBe('PENDING');
    });

    test('handles conflicting slots', () => {
      const globalSelections = {
        'Router': {
          'Router1': [
            {
              dateKey: '2025-01-15',
              segIndex: 0,
              conflict: true
            }
          ]
        }
      };

      const result = gatherAllIntervals(globalSelections);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('CONFLICTING');
    });

    test('handles empty selections', () => {
      const result = gatherAllIntervals({});
      expect(result).toHaveLength(0);
    });
  });

  describe('submitAllBookings', () => {
    test('successfully submits booking', async () => {
      const mockPayload = {
        user_id: 1,
        message: 'Test booking',
        bookings: [
          {
            device_type: 'Router',
            device_name: 'Router1',
            start_time: '2025-01-15T07:00:00',
            end_time: '2025-01-15T12:00:00',
            status: 'PENDING'
          }
        ]
      };

      // MSW handler is already set up in handlers.js, so this should work
      const result = await submitAllBookings(mockPayload);
      expect(result.count).toBe(1);
      expect(result.message).toContain('Created');
    });

    test('handles API errors', async () => {
      // Override the handler for this test to return an error
      server.use(
        rest.post(`${API_BASE_URL}/bookings`, (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              detail: 'Booking failed'
            })
          );
        })
      );

      const mockPayload = {
        user_id: 1,
        message: 'Test booking',
        bookings: []
      };

      await expect(submitAllBookings(mockPayload)).rejects.toThrow();
    });
  });
});

