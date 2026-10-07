import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AuthError, AuthService } from "../dist/services/auth.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

describe("AuthService", () => {
  it("validates fields, hashes passwords, and rejects duplicate emails", async () => {
    const storage = new MemoryStorage(); const auth = new AuthService(storage, globalThis.crypto);
    await assert.rejects(auth.register("A", "bad", "password1"), (e) => e instanceof AuthError && e.field === "name");
    await assert.rejects(auth.register("Ada", "bad", "password1"), (e) => e instanceof AuthError && e.field === "email");
    await assert.rejects(auth.register("Ada", "ada@example.com", "password"), (e) => e instanceof AuthError && e.field === "password");
    const user = await auth.register("Ada Lovelace", "Ada@Example.com", "password1");
    assert.equal(user.email, "ada@example.com");
    const stored = JSON.parse(storage.getItem("tlm.users"));
    assert.notEqual(stored["ada@example.com"].hash, "password1");
    assert.equal(stored["ada@example.com"].salt.length, 32);
    await assert.rejects(auth.register("Ada Lovelace", "ada@example.com", "password1"), /already registered/);
  });
  it("uses the same login error for unknown email and wrong password; session persists until logout", async () => {
    const storage = new MemoryStorage(); const auth = new AuthService(storage, globalThis.crypto);
    await auth.register("Test User", "test@example.com", "secure123");
    const wrong = await auth.login("test@example.com", "invalid123").catch((error) => error.message);
    const missing = await auth.login("absent@example.com", "invalid123").catch((error) => error.message);
    assert.equal(wrong, missing); assert.equal(wrong, "Wrong email or password");
    const another = new AuthService(storage, globalThis.crypto);
    assert.equal(another.currentUser()?.email, "test@example.com");
    auth.logout(); assert.equal(another.currentUser(), null); assert.equal(storage.getItem("tlm.session"), null);
  });
});
