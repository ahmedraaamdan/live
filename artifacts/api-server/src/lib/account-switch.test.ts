import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Real Express/auth/DB behavior in an isolated embedded database, never customer data.
test("super-admin account switching preserves authority and target isolation", async () => {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    if (url.hostname !== "gahez-audit-db-20261030" || url.pathname !== "/audit_switching" || url.username !== "audit" || process.env.ACCOUNT_SWITCH_TEST_DATABASE !== "isolated") throw new Error("Refusing switching tests outside isolated audit database");
  }
  Object.assign(process.env, { NODE_ENV: "test", PAYMENT_PROVIDER: "mock", SUPER_ADMIN_EMAILS: "switch-owner@audit.gahez", ADMIN_EMAILS: "", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "", LIVEKIT_URL: "", LOG_LEVEL: "silent" });
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../tmp");
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(path.join(root, "account-switch-test-"));
  const database = await import("@workspace/db");
  const { initDb, usersTable, sessionsTable, accountSwitchesTable } = database;
  const { eq } = await import("drizzle-orm");
  await initDb({ migrationsFolder: path.resolve(root, "../lib/db/drizzle"), pgliteDir: dir });
  const { db } = database;
  const { createSession, hashPassword, sha256 } = await import("./auth");
  const { newTotpSecret, sealSecret } = await import("./two-factor");
  const { default: app } = await import("../app");
  const passwordHash = await hashPassword("audit-password-only");
  const [owner, admin, teacher, student, parent, suspended] = await db.insert(usersTable).values([
    { role: "admin" as const, name: "Owner", email: "switch-owner@audit.gahez", passwordHash },
    { role: "admin" as const, name: "Other Admin", email: "other-admin@audit.gahez", passwordHash },
    { role: "teacher" as const, name: "Audit Teacher", email: "teacher@audit.gahez", phone: "01012345678", passwordHash },
    { role: "student" as const, name: "Audit Student", email: "student@audit.gahez", passwordHash },
    { role: "parent" as const, name: "Audit Parent", email: "parent@audit.gahez", passwordHash },
    { role: "teacher" as const, name: "Suspended Teacher", email: "suspended@audit.gahez", suspended: true, passwordHash },
  ]).returning();
  await db.insert(database.userSecurityTable).values([owner!, admin!].map(u => ({ userId: u.id, totpSecretEnc: sealSecret(newTotpSecret()), totpEnabledAt: new Date() })));
  const tokens = await Promise.all([owner!, admin!, teacher!, student!].map(u => createSession(u.id)));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api`;
  const call = async (url: string, token?: string, body?: unknown, method?: string) => {
    const r = await fetch(base + url, { method: method ?? (body !== undefined ? "POST" : "GET"), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json() as any };
  };
  let checks = 0;
  const check = (label: string, value: unknown) => { assert.ok(value, label); checks++; };
  const start = (id: string, token = tokens[0]) => call(`/auth/switch/${id}/start`, token, {});
  try {
    check("anonymous search denied", (await call("/auth/switch/users")).status === 401);
    for (const token of tokens.slice(1)) {
      check("non-owner search denied", (await call("/auth/switch/users", token)).status === 403);
      check("non-owner direct switch denied", (await start(student!.id, token)).status === 403);
    }
    check("owner capability is server derived", (await call("/me", tokens[0])).data.isSuperAdmin === true);
    check("ordinary admin has no super capability", (await call("/me", tokens[1])).data.isSuperAdmin === false);
    const list = await call("/auth/switch/users", tokens[0]);
    check("all roles searchable", list.data.length === 5 && list.data.some((u: any) => u.role === "parent"));
    check("search never discloses password hash", list.data.every((u: any) => !('passwordHash' in u)));
    check("phone search works", (await call("/auth/switch/users?q=01012345678", tokens[0])).data[0].id === teacher!.id);
    check("email search works", (await call("/auth/switch/users?q=parent%40audit.gahez", tokens[0])).data[0].id === parent!.id);
    check("wildcards are literal", (await call("/auth/switch/users?q=%25", tokens[0])).data.length === 0);
    check("self switch rejected", (await start(owner!.id)).status === 400);
    check("invalid UUID rejected", (await start("not-a-uuid")).status === 404);
    const result = await start(student!.id);
    const child = result.data.token;
    check("switch requires no target password", result.status === 200 && result.data.me.user.id === student!.id);
    check("target gets real role, not owner privileges", result.data.me.user.role === "student" && result.data.me.isSuperAdmin === false && result.data.me.impersonation.actorId === owner!.id);
    check("original session remains original", (await call("/me", tokens[0])).data.user.id === owner!.id);
    check("child cannot access admin endpoints", (await call("/admin/users", child)).status === 403);
    check("child cannot nest switches", (await start(teacher!.id, child)).status === 403);
    check("profile updates apply only to target", (await call("/me", child, { name: "Updated Student" }, "PATCH")).data.impersonation.actorId === owner!.id && (await call("/me", tokens[0])).data.user.name === "Owner");
    const audit = await db.query.accountSwitchesTable.findFirst();
    check("durable start audit", audit?.actorId === owner!.id && audit?.targetId === student!.id && !audit?.endedAt);
    const stop = await call("/auth/switch/stop", child, {});
    check("stop never returns owner token", stop.status === 200 && JSON.stringify(stop.data) === '{"ok":true}');
    check("stopped child revoked", (await call("/me", child)).status === 401);
    check("parent still usable for return", (await call("/me", tokens[0])).data.isSuperAdmin === true);
    check("durable end audit", (await db.query.accountSwitchesTable.findFirst())?.endedAt != null);
    check("normal account cannot stop a switch", (await call("/auth/switch/stop", tokens[3], {})).status === 400);
    const t = await start(teacher!.id);
    check("teacher switch has teacher role", t.data.me.user.role === "teacher");
    await db.update(sessionsTable).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessionsTable.tokenHash, sha256(t.data.token)));
    check("expired child denied but parent preserved", (await call("/me", t.data.token)).status === 401 && (await call("/me", tokens[0])).status === 200);
    const su = await start(suspended!.id);
    check("owner may inspect suspended account with audit", (await call("/me", su.data.token)).status === 200);
    await db.update(usersTable).set({ suspended: true }).where(eq(usersTable.id, owner!.id));
    check("owner suspension immediately revokes delegation", (await call("/me", su.data.token)).status === 401);
    await db.update(usersTable).set({ suspended: false }).where(eq(usersTable.id, owner!.id));
    await db.update(usersTable).set({ role: "teacher" }).where(eq(usersTable.id, owner!.id));
    check("owner role removal revokes delegation", (await call("/me", su.data.token)).status === 401);
    await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, owner!.id));
    const final = await start(parent!.id);
    check("parent switch supported", final.data.me.user.role === "parent");
    await call("/auth/logout", tokens[0], {});
    check("owner logout invalidates all children", (await call("/me", final.data.token)).status === 401 && (await call("/me", su.data.token)).status === 401);
    tokens[0] = await createSession(owner!.id);
    const separateRoot = await createSession(owner!.id);
    const c1 = await start(student!.id); const c2 = await start(teacher!.id);
    await call("/auth/logout", c1.data.token, {});
    check("logout while switching revokes its parent and siblings", (await call("/me", tokens[0])).status === 401 && (await call("/me", c2.data.token)).status === 401);
    check("other original owner sessions remain valid", (await call("/me", separateRoot)).status === 200);
    check("target password never changed", (await db.query.usersTable.findFirst({ where: eq(usersTable.id, student!.id) }))?.passwordHash === passwordHash);
    console.log(`${checks} account-switch security checks passed`);
  } finally {
    server.closeAllConnections(); await new Promise<void>(r => server.close(() => r()));
    if (database.pool) await database.pool.end(); else await (db as any).$client.close();
    await rm(dir, { recursive: true, force: true });
  }
});
