/**
 * Test authentication credentials using real database records.
 * Matches existing users in database.
 */

export const TEST_USERS = {
  owner: {
    login_id: 'owner',
    pin: '1234',
    role: 'OWNER',
    name: 'Owner',
    user_id: 1,
  },
  storekeeper: {
    login_id: 'storekeeper',
    pin: '1111',
    role: 'STORE_KEEPER',
    name: 'Store Keeper',
    user_id: 23,
  },
  driverTharun: {
    login_id: 'tharun',
    pin: '0000',
    role: 'DRIVER',
    name: 'Tharun',
    employee_id: 54,
  },
  driverKaviarasan: {
    login_id: 'kaviarasan',
    pin: '0000',
    role: 'DRIVER',
    name: 'Kaviarasan',
    employee_id: 55,
  },
} as const;

export const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
export const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:4000';
