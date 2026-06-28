import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { PersistedAppState } from "../src/shared/appState.js";
import {
  normalizeSyncWorkspaceId,
  defaultSyncWorkspaceId,
  type SyncAppStatePayload,
  type SyncManifest,
  type SyncManifestEntry,
} from "../src/shared/sync.js";

const defaultPort = 47831;
const maxBodyBytes = 200 * 1024 * 1024;
const adminSessionDurationMs = 12 * 60 * 60 * 1000;

type SyncServerOptions = {
  adminPassword?: string;
  adminUsername?: string;
  dataDir: string;
  token?: string;
};

type FileRow = {
  deleted: 0 | 1;
  path: string;
  revision: number;
  sha256: string;
  size: number;
  updated_at: string;
};

type AppStateRow = {
  content_json: string;
  revision: number;
  sha256: string;
  updated_at: string;
};

type UserRole = "admin" | "user";

type UserRow = {
  created_at: string;
  id: string;
  password_hash: string;
  role: UserRole;
  updated_at: string;
  username: string;
};

type WorkspaceRow = {
  created_at: string;
  id: string;
  name: string | null;
  owner_user_id: string | null;
  updated_at: string;
};

type SyncTokenRow = {
  created_at: string;
  id: string;
  last_used_at: string | null;
  name: string;
  revoked_at: string | null;
  token_hash: string;
  user_id: string;
  workspace_id: string;
};

type SessionRow = {
  created_at: string;
  expires_at: string;
  id: string;
  last_used_at: string | null;
  revoked_at: string | null;
  token_hash: string;
  user_id: string;
};

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function sha256(buffer: Buffer | string) {
  return createHash("sha256").update(buffer).digest("hex");
}

function createId(prefix: string) {
  return `${prefix}_${randomBytes(16).toString("base64url")}`;
}

function createPublicToken(prefix: string) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

function hashToken(token: string) {
  return sha256(token.trim());
}

function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");

  return `scrypt$${salt}$${hash}`;
}

function verifyPasswordHash(password: string, storedHash: string) {
  const [scheme, salt, hash] = storedHash.split("$");

  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password, salt, expected.length);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function normalizeUsername(value: unknown) {
  const username = typeof value === "string" ? value.trim() : "";

  if (!/^[a-zA-Z0-9._@-]{2,80}$/.test(username)) {
    throw new HttpError(400, "Username must be 2-80 letters, numbers, or ._@-.");
  }

  return username;
}

function normalizePassword(value: unknown) {
  const password = typeof value === "string" ? value : "";
  const minimumPasswordLength =
    process.env.NOTEDOCK_ALLOW_WEAK_SYNC_PASSWORD === "1" ? 3 : 8;

  if (password.length < minimumPasswordLength) {
    throw new HttpError(
      400,
      `Password must be at least ${minimumPasswordLength} characters.`,
    );
  }

  return password;
}

function normalizeWorkspaceName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";

  return name.slice(0, 80) || defaultSyncWorkspaceId;
}

function now() {
  return new Date().toISOString();
}

function json(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function text(response: ServerResponse, statusCode: number, body: string) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(body);
}

function normalizeRelativePath(value: string) {
  const input = value.replace(/\\/g, "/").trim().replace(/^\/+|\/+$/g, "");
  const parts: string[] = [];

  if (!input || isAbsolute(input)) {
    throw new Error("A workspace relative path is required.");
  }

  for (const part of input.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      throw new Error("Sync path cannot leave the workspace.");
    }

    parts.push(part);
  }

  if (!parts.length) {
    throw new Error("A workspace relative path is required.");
  }

  return parts.join("/");
}

function parseUrl(request: IncomingMessage) {
  return new URL(request.url ?? "/", "http://localhost");
}

function getBearerToken(request: IncomingMessage) {
  const header = request.headers.authorization ?? "";
  const match = Array.isArray(header)
    ? header[0]?.match(/^Bearer\s+(.+)$/i)
    : header.match(/^Bearer\s+(.+)$/i);

  return match?.[1] ?? "";
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;

    if (size > maxBodyBytes) {
      throw new Error("Request body is too large.");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function readJsonBody<T extends Record<string, unknown>>(
  request: IncomingMessage,
) {
  const content = await readBody(request);

  if (!content.byteLength) {
    return {} as T;
  }

  return JSON.parse(content.toString("utf-8")) as T;
}

async function exists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function toFileEntry(row: FileRow): SyncManifestEntry {
  return {
    deleted: Boolean(row.deleted),
    path: row.path,
    revision: row.revision,
    sha256: row.sha256,
    size: row.size,
    updatedAt: row.updated_at,
  };
}

function toUserSummary(row: UserRow) {
  return {
    id: row.id,
    role: row.role,
    username: row.username,
  };
}

function toWorkspaceSummary(row: WorkspaceRow) {
  return {
    id: row.id,
    name: row.name || defaultSyncWorkspaceId,
  };
}

function toSyncTokenSummary(row: SyncTokenRow) {
  return {
    createdAt: row.created_at,
    id: row.id,
    lastUsedAt: row.last_used_at,
    name: row.name,
    revokedAt: row.revoked_at,
    workspaceId: row.workspace_id,
  };
}

export class SyncServerStore {
  private readonly database: DatabaseSync;

  constructor(
    private readonly dataDir: string,
    options: Pick<
      SyncServerOptions,
      "adminPassword" | "adminUsername" | "token"
    > = {},
  ) {
    this.database = new DatabaseSync(join(dataDir, "sync.sqlite"));
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;

      CREATE TABLE IF NOT EXISTS revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT,
        name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        revoked_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_used_at TEXT,
        revoked_at TEXT
      );

      CREATE TABLE IF NOT EXISTS files (
        workspace_id TEXT NOT NULL,
        path TEXT NOT NULL,
        revision INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        size INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (workspace_id, path)
      );

      CREATE TABLE IF NOT EXISTS app_state (
        workspace_id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        content_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    this.ensureLegacyColumns();
    this.bootstrapAdminUser(options);
  }

  private ensureLegacyColumns() {
    const ensureColumn = (table: string, name: string, definition: string) => {
      const columns = this.database
        .prepare(`PRAGMA table_info(${table})`)
        .all() as Array<{ name: string }>;

      if (!columns.some((column) => column.name === name)) {
        this.database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      }
    };

    ensureColumn("workspaces", "owner_user_id", "TEXT");
    ensureColumn("workspaces", "name", "TEXT");
  }

  private bootstrapAdminUser({
    adminPassword,
    adminUsername,
    token,
  }: Pick<SyncServerOptions, "adminPassword" | "adminUsername" | "token">) {
    const hasUsers = Boolean(
      this.database.prepare("SELECT id FROM users LIMIT 1").get(),
    );

    if (adminUsername && adminPassword) {
      const username = normalizeUsername(adminUsername);
      const password = normalizePassword(adminPassword);
      const existing = this.findUserByUsername(username);

      if (!existing) {
        this.createUser({
          password,
          role: "admin",
          username,
        });
      } else {
        const timestamp = now();

        if (!verifyPasswordHash(password, existing.password_hash)) {
          this.database
            .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
            .run(createPasswordHash(password), timestamp, existing.id);
        }

        if (existing.role !== "admin") {
          this.database
            .prepare("UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?")
            .run(timestamp, existing.id);
        }
      }
      return;
    }

    if (!hasUsers && !token) {
      throw new Error(
        "Fresh sync server setup requires NOTEDOCK_ADMIN_USERNAME and NOTEDOCK_ADMIN_PASSWORD.",
      );
    }
  }

  close() {
    this.database.close();
  }

  nextRevision() {
    const result = this.database
      .prepare("INSERT INTO revisions (created_at) VALUES (?)")
      .run(now());

    return Number(result.lastInsertRowid);
  }

  findUserByUsername(username: string) {
    return this.database
      .prepare(
        `SELECT id, username, password_hash, role, created_at, updated_at
         FROM users
         WHERE username = ?`,
      )
      .get(username) as UserRow | undefined;
  }

  createUser({
    password,
    role = "user",
    username,
  }: {
    password: string;
    role?: UserRole;
    username: string;
  }) {
    const cleanUsername = normalizeUsername(username);

    if (this.findUserByUsername(cleanUsername)) {
      throw new HttpError(409, "User already exists.");
    }

    const timestamp = now();
    const userId = createId("usr");

    this.database
      .prepare(
        `INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        cleanUsername,
        createPasswordHash(normalizePassword(password)),
        role,
        timestamp,
        timestamp,
      );

    const user = this.findUserByUsername(cleanUsername);

    if (!user) {
      throw new Error("Failed to create user.");
    }

    return {
      user,
      workspace: this.createWorkspace(user.id, defaultSyncWorkspaceId),
    };
  }

  verifyUserPassword(username: string, password: string) {
    const user = this.findUserByUsername(normalizeUsername(username));

    if (!user || !verifyPasswordHash(password, user.password_hash)) {
      return null;
    }

    return user;
  }

  listUsers() {
    return this.database
      .prepare(
        `SELECT id, username, password_hash, role, created_at, updated_at
         FROM users
         ORDER BY created_at ASC`,
      )
      .all() as UserRow[];
  }

  createSession(userId: string) {
    const token = createPublicToken("ndsession");
    const timestamp = now();
    const expiresAt = new Date(Date.now() + adminSessionDurationMs).toISOString();
    const sessionId = createId("ses");

    this.database
      .prepare(
        `INSERT INTO sessions
           (id, user_id, token_hash, created_at, expires_at, last_used_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
      )
      .run(sessionId, userId, hashToken(token), timestamp, expiresAt);

    return {
      expiresAt,
      token,
    };
  }

  authenticateSession(token: string) {
    if (!token.trim()) {
      return null;
    }

    const row = this.database
      .prepare(
        `SELECT
           users.id,
           users.username,
           users.password_hash,
           users.role,
           users.created_at,
           users.updated_at
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ?
           AND sessions.revoked_at IS NULL
           AND sessions.expires_at > ?`,
      )
      .get(hashToken(token), now()) as UserRow | undefined;

    if (row) {
      this.database
        .prepare("UPDATE sessions SET last_used_at = ? WHERE token_hash = ?")
        .run(now(), hashToken(token));
    }

    return row ?? null;
  }

  createWorkspace(ownerUserId: string, name: unknown) {
    const timestamp = now();
    const workspace = {
      created_at: timestamp,
      id: createId("w"),
      name: normalizeWorkspaceName(name),
      owner_user_id: ownerUserId,
      updated_at: timestamp,
    } satisfies WorkspaceRow;

    this.database
      .prepare(
        `INSERT INTO workspaces (id, owner_user_id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        workspace.id,
        workspace.owner_user_id,
        workspace.name,
        workspace.created_at,
        workspace.updated_at,
      );

    return workspace;
  }

  getPrimaryWorkspaceForUser(userId: string) {
    const workspace = this.database
      .prepare(
        `SELECT id, owner_user_id, name, created_at, updated_at
         FROM workspaces
         WHERE owner_user_id = ?
         ORDER BY created_at ASC
         LIMIT 1`,
      )
      .get(userId) as WorkspaceRow | undefined;

    return workspace ?? this.createWorkspace(userId, defaultSyncWorkspaceId);
  }

  createSyncToken(userId: string) {
    const workspace = this.getPrimaryWorkspaceForUser(userId);

    const token = createPublicToken("ndsync");
    const timestamp = now();
    const row = {
      created_at: timestamp,
      id: createId("tok"),
      last_used_at: null,
      name: "Desktop",
      revoked_at: null,
      token_hash: hashToken(token),
      user_id: userId,
      workspace_id: workspace.id,
    } satisfies SyncTokenRow;

    this.database
      .prepare(
        `INSERT INTO sync_tokens
           (id, user_id, workspace_id, name, token_hash, created_at, last_used_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`,
      )
      .run(
        row.id,
        row.user_id,
        row.workspace_id,
        row.name,
        row.token_hash,
        row.created_at,
      );

    return {
      row,
      token,
      workspace,
    };
  }

  authenticateSyncToken(token: string) {
    if (!token.trim()) {
      return null;
    }

    const row = this.database
      .prepare(
        `SELECT id, user_id, workspace_id, name, token_hash, created_at, last_used_at, revoked_at
         FROM sync_tokens
         WHERE token_hash = ? AND revoked_at IS NULL`,
      )
      .get(hashToken(token)) as SyncTokenRow | undefined;

    if (row) {
      this.database
        .prepare("UPDATE sync_tokens SET last_used_at = ? WHERE id = ?")
        .run(now(), row.id);
    }

    return row ?? null;
  }

  listSyncTokensForUser(userId: string) {
    const workspace = this.getPrimaryWorkspaceForUser(userId);

    return this.database
      .prepare(
        `SELECT id, user_id, workspace_id, name, token_hash, created_at, last_used_at, revoked_at
         FROM sync_tokens
         WHERE user_id = ? AND workspace_id = ?
         ORDER BY created_at DESC`,
      )
      .all(userId, workspace.id) as SyncTokenRow[];
  }

  revokeSyncToken(userId: string, tokenId: string) {
    const result = this.database
      .prepare(
        `UPDATE sync_tokens
         SET revoked_at = COALESCE(revoked_at, ?)
         WHERE id = ? AND user_id = ?`,
      )
      .run(now(), tokenId, userId);

    if (!result.changes) {
      throw new HttpError(404, "Sync token not found.");
    }
  }

  ensureWorkspace(workspaceId: string, ownerUserId?: string | null, name?: string) {
    const timestamp = now();

    this.database
      .prepare(
        `INSERT INTO workspaces (id, owner_user_id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           updated_at = excluded.updated_at,
           owner_user_id = COALESCE(workspaces.owner_user_id, excluded.owner_user_id),
           name = COALESCE(workspaces.name, excluded.name)`,
      )
      .run(workspaceId, ownerUserId ?? null, name ?? workspaceId, timestamp, timestamp);
  }

  getManifest(workspaceId: string, since = 0): SyncManifest {
    this.ensureWorkspace(workspaceId);
    const files = this.database
      .prepare(
        `SELECT path, revision, sha256, size, updated_at, deleted
         FROM files
         WHERE workspace_id = ? AND revision > ?
         ORDER BY path ASC`,
      )
      .all(workspaceId, since) as FileRow[];
    const revisionRow = this.database
      .prepare("SELECT COALESCE(MAX(revision), 0) AS revision FROM files WHERE workspace_id = ?")
      .get(workspaceId) as { revision: number };

    return {
      files: files.map(toFileEntry),
      revision: Number(revisionRow.revision ?? 0),
      workspaceId,
    };
  }

  getFileEntry(workspaceId: string, path: string) {
    return this.database
      .prepare(
        `SELECT path, revision, sha256, size, updated_at, deleted
         FROM files
         WHERE workspace_id = ? AND path = ?`,
      )
      .get(workspaceId, path) as FileRow | undefined;
  }

  upsertFile(workspaceId: string, path: string, content: Buffer) {
    this.ensureWorkspace(workspaceId);
    const revision = this.nextRevision();
    const timestamp = now();
    const entry = {
      deleted: 0,
      path,
      revision,
      sha256: sha256(content),
      size: content.byteLength,
      updated_at: timestamp,
    } satisfies FileRow;

    this.database
      .prepare(
        `INSERT INTO files (workspace_id, path, revision, sha256, size, updated_at, deleted)
         VALUES (?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(workspace_id, path) DO UPDATE SET
           revision = excluded.revision,
           sha256 = excluded.sha256,
           size = excluded.size,
           updated_at = excluded.updated_at,
           deleted = 0`,
      )
      .run(workspaceId, path, revision, entry.sha256, entry.size, timestamp);

    return toFileEntry(entry);
  }

  deleteFile(workspaceId: string, path: string) {
    this.ensureWorkspace(workspaceId);
    const revision = this.nextRevision();
    const timestamp = now();
    const entry = {
      deleted: 1,
      path,
      revision,
      sha256: "",
      size: 0,
      updated_at: timestamp,
    } satisfies FileRow;

    this.database
      .prepare(
        `INSERT INTO files (workspace_id, path, revision, sha256, size, updated_at, deleted)
         VALUES (?, ?, ?, '', 0, ?, 1)
         ON CONFLICT(workspace_id, path) DO UPDATE SET
           revision = excluded.revision,
           sha256 = '',
           size = 0,
           updated_at = excluded.updated_at,
           deleted = 1`,
      )
      .run(workspaceId, path, revision, timestamp);

    return toFileEntry(entry);
  }

  getAppState(workspaceId: string): SyncAppStatePayload {
    this.ensureWorkspace(workspaceId);
    const row = this.database
      .prepare(
        `SELECT revision, sha256, content_json, updated_at
         FROM app_state
         WHERE workspace_id = ?`,
      )
      .get(workspaceId) as AppStateRow | undefined;

    if (!row) {
      return {
        revision: 0,
        state: null,
      };
    }

    return {
      revision: row.revision,
      sha256: row.sha256,
      state: JSON.parse(row.content_json) as PersistedAppState,
      updatedAt: row.updated_at,
    };
  }

  putAppState(workspaceId: string, state: PersistedAppState): SyncAppStatePayload {
    this.ensureWorkspace(workspaceId);
    const revision = this.nextRevision();
    const timestamp = now();
    const content = JSON.stringify(state);
    const digest = sha256(content);

    this.database
      .prepare(
        `INSERT INTO app_state (workspace_id, revision, sha256, content_json, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id) DO UPDATE SET
           revision = excluded.revision,
           sha256 = excluded.sha256,
           content_json = excluded.content_json,
           updated_at = excluded.updated_at`,
      )
      .run(workspaceId, revision, digest, content, timestamp);

    return {
      revision,
      sha256: digest,
      state,
      updatedAt: timestamp,
    };
  }
}

function getWorkspaceId(url: URL, fallback?: string) {
  const value = url.searchParams.get("workspaceId");

  return value
    ? normalizeSyncWorkspaceId(value)
    : normalizeSyncWorkspaceId(fallback);
}

function getRequestPath(url: URL) {
  const value = url.searchParams.get("path");

  if (!value) {
    throw new Error("Missing file path.");
  }

  return normalizeRelativePath(value);
}

function getStoredFilePath(dataDir: string, workspaceId: string, path: string) {
  const cleanPath = normalizeRelativePath(path);
  const filePath = resolve(dataDir, "files", workspaceId, ...cleanPath.split("/"));
  const root = resolve(dataDir, "files", workspaceId);
  const relativeBack = filePath.startsWith(root) ? filePath.slice(root.length) : "";

  if (!relativeBack) {
    throw new Error("Invalid stored file path.");
  }

  return filePath;
}

async function handleAuthRequest({
  request,
  response,
  store,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  store: SyncServerStore;
}) {
  const url = parseUrl(request);

  if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
    const body = await readJsonBody<{
      password?: string;
      username?: string;
    }>(request);
    const user = store.verifyUserPassword(
      body.username ?? "",
      body.password ?? "",
    );

    if (!user) {
      throw new HttpError(401, "Invalid username or password.");
    }

    const session = store.createSession(user.id);

    json(response, 200, {
      accessToken: session.token,
      expiresAt: session.expiresAt,
      user: toUserSummary(user),
    });
    return true;
  }

  return false;
}

function requireSessionUser(store: SyncServerStore, request: IncomingMessage) {
  const user = store.authenticateSession(getBearerToken(request));

  if (!user) {
    throw new HttpError(401, "Unauthorized.");
  }

  return user;
}

async function handleUserRequest({
  request,
  response,
  store,
  user,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  store: SyncServerStore;
  user: UserRow;
}) {
  const url = parseUrl(request);

  if (url.pathname === "/api/v1/sync-tokens") {
    if (request.method === "GET") {
      json(response, 200, {
        tokens: store.listSyncTokensForUser(user.id).map(toSyncTokenSummary),
      });
      return true;
    }

    if (request.method === "POST") {
      const result = store.createSyncToken(user.id);

      json(response, 200, {
        token: result.token,
        tokenId: result.row.id,
        workspace: toWorkspaceSummary(result.workspace),
      });
      return true;
    }
  }

  const tokenMatch = url.pathname.match(/^\/api\/v1\/sync-tokens\/([^/]+)$/);

  if (tokenMatch && request.method === "DELETE") {
    store.revokeSyncToken(user.id, tokenMatch[1]);
    json(response, 200, {
      revoked: true,
    });
    return true;
  }

  return false;
}

async function handleAdminRequest({
  request,
  response,
  store,
  user,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  store: SyncServerStore;
  user: UserRow;
}) {
  if (user.role !== "admin") {
    throw new HttpError(403, "Admin permissions are required.");
  }

  const url = parseUrl(request);

  if (url.pathname === "/api/v1/admin/users") {
    if (request.method === "GET") {
      json(response, 200, {
        users: store.listUsers().map(toUserSummary),
      });
      return true;
    }

    if (request.method === "POST") {
      const body = await readJsonBody<{
        password?: string;
        role?: UserRole;
        username?: string;
      }>(request);
      const result = store.createUser({
        password: body.password ?? "",
        role: body.role === "admin" ? "admin" : "user",
        username: body.username ?? "",
      });

      json(response, 200, {
        user: toUserSummary(result.user),
        workspace: toWorkspaceSummary(result.workspace),
      });
      return true;
    }
  }

  return false;
}

function authorizeSyncRequest({
  legacyToken,
  request,
  store,
}: {
  legacyToken?: string;
  request: IncomingMessage;
  store: SyncServerStore;
}) {
  const url = parseUrl(request);
  const requestedWorkspaceId = url.searchParams.has("workspaceId")
    ? getWorkspaceId(url)
    : undefined;
  const bearerToken = getBearerToken(request);

  if (legacyToken && bearerToken === legacyToken) {
    return {
      workspaceId: requestedWorkspaceId ?? defaultSyncWorkspaceId,
    };
  }

  const token = store.authenticateSyncToken(bearerToken);

  if (!token) {
    throw new HttpError(401, "Unauthorized.");
  }

  if (requestedWorkspaceId && requestedWorkspaceId !== token.workspace_id) {
    throw new HttpError(403, "Sync token cannot access this workspace.");
  }

  return {
    workspaceId: token.workspace_id,
  };
}

async function handleSyncRequest({
  dataDir,
  request,
  response,
  store,
  workspaceId,
}: {
  dataDir: string;
  request: IncomingMessage;
  response: ServerResponse;
  store: SyncServerStore;
  workspaceId: string;
}) {
  const url = parseUrl(request);

  if (request.method === "GET" && url.pathname === "/api/v1/sync/manifest") {
    const since = Number(url.searchParams.get("since") ?? 0);
    json(response, 200, store.getManifest(workspaceId, Number.isFinite(since) ? since : 0));
    return;
  }

  if (url.pathname === "/api/v1/sync/file") {
    const path = getRequestPath(url);
    const storedFilePath = getStoredFilePath(dataDir, workspaceId, path);

    if (request.method === "GET") {
      const entry = store.getFileEntry(workspaceId, path);

      if (!entry || entry.deleted || !(await exists(storedFilePath))) {
        text(response, 404, "File not found.");
        return;
      }

      response.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "X-Notedock-Revision": String(entry.revision),
        "X-Notedock-Sha256": entry.sha256,
      });
      response.end(await readFile(storedFilePath));
      return;
    }

    if (request.method === "PUT") {
      const content = await readBody(request);
      await mkdir(dirname(storedFilePath), { recursive: true });
      await writeFile(storedFilePath, content);
      json(response, 200, store.upsertFile(workspaceId, path, content));
      return;
    }

    if (request.method === "DELETE") {
      await rm(storedFilePath, { force: true });
      json(response, 200, store.deleteFile(workspaceId, path));
      return;
    }
  }

  if (url.pathname === "/api/v1/sync/app-state") {
    if (request.method === "GET") {
      json(response, 200, store.getAppState(workspaceId));
      return;
    }

    if (request.method === "PUT") {
      const body = JSON.parse((await readBody(request)).toString("utf-8")) as {
        state?: PersistedAppState;
      };

      if (!body.state) {
        text(response, 400, "Missing app state.");
        return;
      }

      json(response, 200, store.putAppState(workspaceId, body.state));
      return;
    }
  }

  text(response, 404, "Not found.");
}

export function createSyncServer(options: SyncServerOptions) {
  const dataDir = resolve(options.dataDir);
  const store = new SyncServerStore(dataDir, options);
  const server = createServer((request, response) => {
    const url = parseUrl(request);

    if (request.method === "GET" && url.pathname === "/api/v1/sync/health") {
      json(response, 200, {
        ok: true,
        service: "notedock-sync",
      });
      return;
    }

    void (async () => {
      if (await handleAuthRequest({ request, response, store })) {
        return;
      }

      if (url.pathname.startsWith("/api/v1/admin/")) {
        const user = requireSessionUser(store, request);

        if (await handleAdminRequest({ request, response, store, user })) {
          return;
        }
      }

      if (
        url.pathname === "/api/v1/sync-tokens" ||
        url.pathname.startsWith("/api/v1/sync-tokens/")
      ) {
        const user = requireSessionUser(store, request);

        if (await handleUserRequest({ request, response, store, user })) {
          return;
        }
      }

      if (url.pathname.startsWith("/api/v1/sync/")) {
        const authorization = authorizeSyncRequest({
          legacyToken: options.token,
          request,
          store,
        });

        await handleSyncRequest({
          dataDir,
          request,
          response,
          store,
          workspaceId: authorization.workspaceId,
        });
        return;
      }

      text(response, 404, "Not found.");
    })().catch((error) => {
      text(
        response,
        error instanceof HttpError
          ? error.statusCode
          : error instanceof SyntaxError
            ? 400
            : 500,
        error instanceof Error ? error.message : "Sync server error.",
      );
    });
  });

  server.on("close", () => store.close());

  return server;
}

async function main() {
  const dataDir =
    process.env.NOTEDOCK_SYNC_DATA_DIR ??
    join(process.cwd(), ".notedock-sync-data");
  const token = process.env.NOTEDOCK_SYNC_TOKEN ?? "";
  const adminUsername = process.env.NOTEDOCK_ADMIN_USERNAME ?? "";
  const adminPassword = process.env.NOTEDOCK_ADMIN_PASSWORD ?? "";
  const port = Number(process.env.NOTEDOCK_SYNC_PORT ?? defaultPort);

  await mkdir(dataDir, { recursive: true });
  const server = createSyncServer({
    adminPassword,
    adminUsername,
    dataDir,
    token,
  });
  server.listen(Number.isFinite(port) ? port : defaultPort, () => {
    const address = server.address();
    const resolvedPort =
      typeof address === "object" && address ? address.port : port;
    console.log(`noteDock sync server listening on http://localhost:${resolvedPort}`);
  });
}

const entryPointUrl = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";

if (import.meta.url === entryPointUrl) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
