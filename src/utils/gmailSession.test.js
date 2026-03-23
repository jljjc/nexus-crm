import {
  readSession, writeSession, clearSession,
  sessionIsValid, sessionNeedsRefresh,
} from './gmailSession';

const MOCK_TOKEN = { accessToken:'tok', refreshToken:'ref', expiresAt: Date.now()+3600000, userEmail:'a@b.com' };

beforeEach(() => sessionStorage.clear());

test('readSession returns null when nothing stored', () => {
  expect(readSession()).toBeNull();
});

test('writeSession stores and readSession returns it', () => {
  const s = writeSession('tok', 'ref', 3600, 'a@b.com');
  expect(s.accessToken).toBe('tok');
  expect(readSession().accessToken).toBe('tok');
  expect(readSession().userEmail).toBe('a@b.com');
});

test('clearSession removes storage', () => {
  writeSession('tok','ref',3600,'');
  clearSession();
  expect(readSession()).toBeNull();
});

test('sessionIsValid returns false when no session', () => {
  expect(sessionIsValid(null)).toBe(false);
});

test('sessionIsValid returns true for fresh session', () => {
  expect(sessionIsValid(MOCK_TOKEN)).toBe(true);
});

test('sessionIsValid returns false for expired session', () => {
  expect(sessionIsValid({ ...MOCK_TOKEN, expiresAt: Date.now() - 1 })).toBe(false);
});

test('sessionNeedsRefresh false when far from expiry', () => {
  expect(sessionNeedsRefresh(MOCK_TOKEN)).toBe(false);
});

test('sessionNeedsRefresh true when within 5 min of expiry', () => {
  const soon = { ...MOCK_TOKEN, expiresAt: Date.now() + 2 * 60 * 1000 };
  expect(sessionNeedsRefresh(soon)).toBe(true);
});
