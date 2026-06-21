import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { createSyncServer } from "./syncServer.js";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "notedock-sync-server-test-"));
  tempDirs.push(dir);
  return dir;
}

async function startServer(
  token = "test-token",
  options: {
    adminPassword?: string;
    adminUsername?: string;
  } = {},
) {
  const dataDir = await makeTempDir();
  const server = createSyncServer({ dataDir, token, ...options });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    token,
  };
}

async function request(
  baseUrl: string,
  path: string,
  {
    body,
    method = "GET",
    token = "test-token",
  }: {
    body?: BodyInit;
    method?: string;
    token?: string;
  } = {},
) {
  return fetch(`${baseUrl}${path}`, {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method,
  });
}

async function jsonRequest(
  baseUrl: string,
  path: string,
  {
    body,
    method = "GET",
    token,
  }: {
    body?: unknown;
    method?: string;
    token?: string;
  } = {},
) {
  return fetch(`${baseUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    method,
  });
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("sync server", () => {
  it("exposes an unauthenticated health endpoint", async () => {
    const server = await startServer();

    try {
      const response = await fetch(`${server.baseUrl}/api/v1/sync/health`);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toEqual({
        ok: true,
        service: "notedock-sync",
      });
    } finally {
      await server.close();
    }
  });

  it("requires a valid bearer token", async () => {
    const server = await startServer();

    try {
      const response = await request(
        server.baseUrl,
        "/api/v1/sync/manifest?workspaceId=default",
        { token: "bad-token" },
      );

      expect(response.status).toBe(401);
    } finally {
      await server.close();
    }
  });

  it("logs in and creates a scoped device sync token", async () => {
    const server = await startServer("", {
      adminPassword: "correct horse battery staple",
      adminUsername: "admin",
    });

    try {
      const loginResponse = await jsonRequest(server.baseUrl, "/api/v1/auth/login", {
        body: {
          password: "correct horse battery staple",
          username: "admin",
        },
        method: "POST",
      });
      const login = await loginResponse.json();

      expect(loginResponse.status).toBe(200);
      expect(login.user.username).toBe("admin");

      const tokenResponse = await jsonRequest(
        server.baseUrl,
        "/api/v1/sync-tokens",
        {
          method: "POST",
          token: login.accessToken,
        },
      );
      const tokenPayload = await tokenResponse.json();
      const workspaceId = tokenPayload.workspace.id as string;

      expect(tokenResponse.status).toBe(200);
      expect(tokenPayload.token).toMatch(/^ndsync_/);
      expect(workspaceId).toMatch(/^w_/);

      const putResponse = await request(
        server.baseUrl,
        "/api/v1/sync/file?path=A.md",
        {
          body: "hello",
          method: "PUT",
          token: tokenPayload.token,
        },
      );
      expect(putResponse.status).toBe(200);

      const manifestResponse = await request(
        server.baseUrl,
        "/api/v1/sync/manifest",
        { token: tokenPayload.token },
      );
      const manifest = await manifestResponse.json();

      expect(manifestResponse.status).toBe(200);
      expect(manifest.workspaceId).toBe(workspaceId);

      const forbiddenResponse = await request(
        server.baseUrl,
        "/api/v1/sync/manifest?workspaceId=default",
        { token: tokenPayload.token },
      );
      expect(forbiddenResponse.status).toBe(403);
    } finally {
      await server.close();
    }
  });

  it("lets an admin create independent users", async () => {
    const server = await startServer("", {
      adminPassword: "correct horse battery staple",
      adminUsername: "admin",
    });

    try {
      const adminLogin = await (
        await jsonRequest(server.baseUrl, "/api/v1/auth/login", {
          body: {
            password: "correct horse battery staple",
            username: "admin",
          },
          method: "POST",
        })
      ).json();
      const createdUser = await (
        await jsonRequest(server.baseUrl, "/api/v1/admin/users", {
          body: {
            password: "alice-password",
            username: "alice",
          },
          method: "POST",
          token: adminLogin.accessToken,
        })
      ).json();
      const adminToken = await (
        await jsonRequest(server.baseUrl, "/api/v1/sync-tokens", {
          method: "POST",
          token: adminLogin.accessToken,
        })
      ).json();
      const aliceLogin = await (
        await jsonRequest(server.baseUrl, "/api/v1/auth/login", {
          body: {
            password: "alice-password",
            username: "alice",
          },
          method: "POST",
        })
      ).json();
      const aliceToken = await (
        await jsonRequest(server.baseUrl, "/api/v1/sync-tokens", {
          method: "POST",
          token: aliceLogin.accessToken,
        })
      ).json();

      expect(createdUser.user.username).toBe("alice");
      expect(aliceToken.workspace.id).toBe(createdUser.workspace.id);
      expect(aliceToken.workspace.id).not.toBe(adminToken.workspace.id);
    } finally {
      await server.close();
    }
  });

  it("stores file revisions and exposes delete tombstones", async () => {
    const server = await startServer();

    try {
      const putResponse = await request(
        server.baseUrl,
        "/api/v1/sync/file?workspaceId=default&path=A.md",
        {
          body: "hello",
          method: "PUT",
        },
      );
      const putEntry = await putResponse.json();

      expect(putResponse.status).toBe(200);
      expect(putEntry.revision).toBeGreaterThan(0);
      expect(putEntry.deleted).toBe(false);

      const fileResponse = await request(
        server.baseUrl,
        "/api/v1/sync/file?workspaceId=default&path=A.md",
      );
      expect(await fileResponse.text()).toBe("hello");

      const deleteResponse = await request(
        server.baseUrl,
        "/api/v1/sync/file?workspaceId=default&path=A.md",
        { method: "DELETE" },
      );
      const deleteEntry = await deleteResponse.json();
      expect(deleteEntry.deleted).toBe(true);

      const manifestResponse = await request(
        server.baseUrl,
        "/api/v1/sync/manifest?workspaceId=default",
      );
      const manifest = await manifestResponse.json();
      expect(manifest.files).toEqual([
        expect.objectContaining({
          deleted: true,
          path: "A.md",
        }),
      ]);
    } finally {
      await server.close();
    }
  });

  it("stores app state revisions", async () => {
    const server = await startServer();
    const state = {
      theme: "github",
      version: 1,
      workspace: {
        activeDocumentId: "",
        documents: [],
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: 1,
      },
    };

    try {
      const putResponse = await request(
        server.baseUrl,
        "/api/v1/sync/app-state?workspaceId=default",
        {
          body: JSON.stringify({ state }),
          method: "PUT",
        },
      );
      const putPayload = await putResponse.json();
      expect(putPayload.revision).toBeGreaterThan(0);

      const getResponse = await request(
        server.baseUrl,
        "/api/v1/sync/app-state?workspaceId=default",
      );
      const getPayload = await getResponse.json();

      expect(getPayload.state).toEqual(state);
      expect(getPayload.revision).toBe(putPayload.revision);
    } finally {
      await server.close();
    }
  });
});
