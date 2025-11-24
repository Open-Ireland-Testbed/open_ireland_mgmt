/**
 * Mock Service Worker handlers for API mocking (MSW v1)
 */
import { rest } from 'msw';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:20001';

export const handlers = [
  // User authentication
  rest.post(`${API_BASE_URL}/users/register`, (req, res, ctx) => {
    return res(ctx.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      is_admin: false
    }));
  }),

  rest.post(`${API_BASE_URL}/login`, (req, res, ctx) => {
    return res(ctx.json({
      message: 'Sign in successful',
      user_id: 1
    }));
  }),

  rest.get(`${API_BASE_URL}/session`, (req, res, ctx) => {
    return res(ctx.json({
      logged_in: true,
      user_id: 1,
      username: 'testuser'
    }));
  }),

  // Bookings
  rest.post(`${API_BASE_URL}/bookings`, (req, res, ctx) => {
    return res(ctx.json({
      message: 'Created 1 booking(s) successfully.',
      count: 1
    }));
  }),

  rest.get(`${API_BASE_URL}/bookings/user/:userId`, (req, res, ctx) => {
    const { userId } = req.params;
    return res(ctx.json([
      {
        booking_id: 1,
        device_type: 'Router',
        device_name: 'Router1',
        ip_address: '192.168.1.1',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        status: 'PENDING'
      }
    ]));
  }),

  rest.get(`${API_BASE_URL}/bookings/for-week`, (req, res, ctx) => {
    return res(ctx.json([]));
  }),

  rest.put(`${API_BASE_URL}/bookings/:bookingId/cancel`, (req, res, ctx) => {
    const { bookingId } = req.params;
    return res(ctx.json({
      message: `Booking ${bookingId} has been cancelled`
    }));
  }),

  // Admin endpoints
  rest.get(`${API_BASE_URL}/admin/devices`, (req, res, ctx) => {
    return res(ctx.json([
      {
        id: 1,
        deviceType: 'Router',
        deviceName: 'Router1',
        ip_address: '192.168.1.1',
        status: 'Available',
        Out_Port: 1,
        In_Port: 2
      }
    ]));
  }),

  rest.get(`${API_BASE_URL}/admin/checkAdminSession`, (req, res, ctx) => {
    return res(ctx.json({
      logged_in: true,
      user_id: 1,
      username: 'admin',
      is_admin: true
    }));
  }),

  rest.get(`${API_BASE_URL}/admin/bookings/pending`, (req, res, ctx) => {
    return res(ctx.json([]));
  }),

  // Conflict check
  rest.post(`${API_BASE_URL}/check-conflicts`, (req, res, ctx) => {
    return res(ctx.json([]));
  })
];

