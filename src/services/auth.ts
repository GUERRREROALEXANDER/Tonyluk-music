export type AuthField = "name" | "email" | "password" | "form";
export class AuthError extends Error {
  constructor(public readonly field: AuthField, message: string) { super(message); this.name = "AuthError"; }
}
export interface AuthUser { id: string; name: string; email: string; createdAt: number; }
interface StoredUser extends AuthUser { salt: string; hash: string; }
interface Session { userId: string; email: string; expiresAt: number; }
type UserMap = Record<string, StoredUser>;

const USERS_KEY = "tlm.users";
const SESSION_KEY = "tlm.session";
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

/** Academic client-side authentication only. There is no backend database, so users and sessions live in this browser. */
export class AuthService {
  constructor(private readonly storage: Storage = localStorage, private readonly cryptoApi: Crypto = globalThis.crypto) {}

  async register(name: string, email: string, password: string): Promise<AuthUser> {
    const cleanName = name.trim(); const cleanEmail = email.trim().toLowerCase();
    if (cleanName.length < 2 || cleanName.length > 40) throw new AuthError("name", "Name must be 2 to 40 characters");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new AuthError("email", "Enter a valid email address");
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new AuthError("password", "Password must be at least 8 characters and include a letter and a number");
    const users = this.readUsers();
    if (users[cleanEmail]) throw new AuthError("email", "That email is already registered");
    const salt = randomHex(this.cryptoApi, 16);
    const user: StoredUser = { id: randomHex(this.cryptoApi, 16), name: cleanName, email: cleanEmail, salt, hash: await hashPassword(this.cryptoApi, password, salt), createdAt: Date.now() };
    users[cleanEmail] = user; this.storage.setItem(USERS_KEY, JSON.stringify(users));
    this.writeSession(user);
    return publicUser(user);
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const cleanEmail = email.trim().toLowerCase(); const user = this.readUsers()[cleanEmail];
    const hash = user ? await hashPassword(this.cryptoApi, password, user.salt) : "";
    if (!user || !constantTimeEqual(hash, user.hash)) throw new AuthError("form", "Wrong email or password");
    this.writeSession(user); return publicUser(user);
  }

  logout(): void { this.storage.removeItem(SESSION_KEY); }

  currentUser(): AuthUser | null {
    const raw = this.storage.getItem(SESSION_KEY); if (!raw) return null;
    let session: Session;
    try { session = JSON.parse(raw) as Session; } catch { this.logout(); return null; }
    if (!session || typeof session.email !== "string" || typeof session.userId !== "string" || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) { this.logout(); return null; }
    const user = this.readUsers()[session.email];
    if (!user || user.id !== session.userId) { this.logout(); return null; }
    return publicUser(user);
  }

  updateProfile(patch: { name?: string; email?: string }): AuthUser {
    const current = this.currentUser(); if (!current) throw new AuthError("form", "Please sign in again");
    const users = this.readUsers(); const user = users[current.email];
    if (!user) throw new AuthError("form", "Please sign in again");
    const name = patch.name === undefined ? user.name : patch.name.trim();
    const email = patch.email === undefined ? user.email : patch.email.trim().toLowerCase();
    if (name.length < 2 || name.length > 40) throw new AuthError("name", "Name must be 2 to 40 characters");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError("email", "Enter a valid email address");
    if (email !== user.email && users[email]) throw new AuthError("email", "That email is already registered");
    delete users[user.email]; user.name = name; user.email = email; users[email] = user;
    this.storage.setItem(USERS_KEY, JSON.stringify(users)); this.writeSession(user); return publicUser(user);
  }

  private readUsers(): UserMap {
    try { const value: unknown = JSON.parse(this.storage.getItem(USERS_KEY) ?? "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value as UserMap : {}; }
    catch { return {}; }
  }
  private writeSession(user: StoredUser): void {
    const session: Session = { userId: user.id, email: user.email, expiresAt: Date.now() + SESSION_TTL };
    this.storage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

function publicUser(user: StoredUser): AuthUser { return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }; }
function randomHex(cryptoApi: Crypto, bytes: number): string {
  const value = new Uint8Array(bytes); cryptoApi.getRandomValues(value);
  return Array.from(value, (part) => part.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(cryptoApi: Crypto, password: string, saltHex: string): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g) ?? [], (part) => Number.parseInt(part, 16));
  const key = await cryptoApi.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await cryptoApi.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 120_000 }, key, 256);
  return Array.from(new Uint8Array(bits), (part) => part.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(a: string, b: string): boolean {
  let difference = a.length ^ b.length; const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
