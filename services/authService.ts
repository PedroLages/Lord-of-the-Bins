/**
 * Local Authentication Service
 *
 * Handles user authentication for the demo/prototype.
 * Uses IndexedDB for user storage and localStorage for session persistence.
 *
 * Future: Replace with Supabase Auth for production.
 */

import { db } from './storage/database';
import type { DemoUser, LocalSession, UserRole } from '../types';

// Session storage key
const SESSION_KEY = 'lotb_session';

// Session duration (24 hours in milliseconds)
const SESSION_DURATION = 24 * 60 * 60 * 1000;

/**
 * Hash a password using SHA-256
 * Note: For production, use bcrypt or argon2 via backend
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a password against a hash
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Check if any users exist (first-run detection)
 */
export async function hasUsers(): Promise<boolean> {
  const count = await db.users.count();
  return count > 0;
}

/**
 * Get all users (for admin purposes)
 */
export async function getAllUsers(): Promise<DemoUser[]> {
  return db.users.toArray();
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<DemoUser | undefined> {
  return db.users.get(id);
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string): Promise<DemoUser | undefined> {
  return db.users.where('username').equals(username.toLowerCase()).first();
}

/**
 * Create a new user
 */
export async function createUser(
  username: string,
  displayName: string,
  password: string,
  role: UserRole,
  profilePicture?: string
): Promise<DemoUser> {
  // Normalize username to lowercase
  const normalizedUsername = username.toLowerCase().trim();

  // Check if username already exists
  const existing = await getUserByUsername(normalizedUsername);
  if (existing) {
    throw new Error('Username already exists');
  }

  // Hash the password
  const passwordHash = await hashPassword(password);

  // Create user object
  const user: DemoUser = {
    id: crypto.randomUUID(),
    username: normalizedUsername,
    displayName: displayName.trim(),
    role,
    profilePicture,
    passwordHash,
    createdAt: new Date().toISOString(),
    preferences: {
      theme: 'Modern',
    },
  };

  // Save to database
  await db.users.add(user);

  return user;
}

/**
 * Update user profile
 */
export async function updateUser(
  userId: string,
  updates: Partial<Pick<DemoUser, 'displayName' | 'profilePicture' | 'preferences'>>
): Promise<DemoUser | undefined> {
  await db.users.update(userId, updates);
  return getUserById(userId);
}

/**
 * Change user password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password and update
  const newHash = await hashPassword(newPassword);
  await db.users.update(userId, { passwordHash: newHash });

  return true;
}

/**
 * Login with username and password
 */
export async function login(username: string, password: string): Promise<DemoUser> {
  // Find user by batch number
  const user = await getUserByUsername(username);
  if (!user) {
    throw new Error('Invalid batch number or password');
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid batch number or password');
  }

  // Update last login
  const now = new Date().toISOString();
  await db.users.update(user.id, { lastLogin: now });

  // Create session
  const session: LocalSession = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    profilePicture: user.profilePicture,
    loginAt: now,
    expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString(),
  };

  // Store session in localStorage
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return { ...user, lastLogin: now };
}

/**
 * Logout current user
 */
export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Get current session (if valid)
 */
export function getSession(): LocalSession | null {
  const sessionData = localStorage.getItem(SESSION_KEY);
  if (!sessionData) {
    return null;
  }

  try {
    const session: LocalSession = JSON.parse(sessionData);

    // Check if session expired
    if (new Date(session.expiresAt) < new Date()) {
      logout();
      return null;
    }

    return session;
  } catch {
    // Invalid session data
    logout();
    return null;
  }
}

/**
 * Get current authenticated user (from session + fresh DB data)
 */
export async function getCurrentUser(): Promise<DemoUser | null> {
  const session = getSession();
  if (!session) {
    return null;
  }

  // Get fresh user data from DB
  const user = await getUserById(session.userId);
  if (!user) {
    // User deleted, clear session
    logout();
    return null;
  }

  return user;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getSession() !== null;
}

/**
 * Refresh session (extend expiry)
 */
export function refreshSession(): void {
  const session = getSession();
  if (session) {
    session.expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

/**
 * Update session with new user data (e.g., after profile update)
 */
export function updateSessionData(updates: Partial<Pick<LocalSession, 'displayName' | 'profilePicture'>>): void {
  const session = getSession();
  if (session) {
    Object.assign(session, updates);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

/**
 * Delete a user (for admin purposes)
 */
export async function deleteUser(userId: string): Promise<void> {
  // Check if user exists
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Delete from database
  await db.users.delete(userId);

  // If deleting current user, logout
  const session = getSession();
  if (session?.userId === userId) {
    logout();
  }
}

/**
 * Resize and compress an image for profile picture
 * Returns base64 string with max dimensions of 200x200
 */
export function processProfilePicture(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Create canvas with max 200x200 dimensions
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not create canvas context'));
          return;
        }

        // Calculate new dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        const maxSize = 200;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 (JPEG for smaller size)
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve(base64);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}
