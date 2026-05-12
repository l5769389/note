import type { WorkspaceSnapshot } from "../types";

export type BackupResult = {
  ok: boolean;
  remote?: boolean;
  message: string;
};

export interface CloudBackupProvider {
  backup(snapshot: WorkspaceSnapshot): Promise<BackupResult>;
  restore(): Promise<WorkspaceSnapshot | null>;
}

export type CloudBackupSettings = {
  endpoint?: string;
  token?: string;
};

class DisabledCloudBackupProvider implements CloudBackupProvider {
  async backup(): Promise<BackupResult> {
    return {
      ok: true,
      remote: false,
      message: "云备份接口未配置，当前仅保存到浏览器本地存储。",
    };
  }

  async restore() {
    return null;
  }
}

class HttpCloudBackupProvider implements CloudBackupProvider {
  constructor(
    private readonly endpoint: string,
    private readonly token?: string,
  ) {}

  async backup(snapshot: WorkspaceSnapshot): Promise<BackupResult> {
    const response = await fetch(this.endpoint, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(snapshot),
    });

    if (!response.ok) {
      throw new Error(`云备份失败：${response.status}`);
    }

    return {
      ok: true,
      remote: true,
      message: "已备份到云端。",
    };
  }

  async restore(): Promise<WorkspaceSnapshot | null> {
    const response = await fetch(this.endpoint, {
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`云端恢复失败：${response.status}`);
    }

    return (await response.json()) as WorkspaceSnapshot;
  }
}

export function createCloudBackupProvider(
  settings: CloudBackupSettings = {},
): CloudBackupProvider {
  const backupEndpoint =
    settings.endpoint ||
    (import.meta.env.VITE_CLOUD_BACKUP_ENDPOINT as string | undefined);
  const token =
    settings.token || (import.meta.env.VITE_CLOUD_BACKUP_TOKEN as string | undefined);

  if (!backupEndpoint) {
    return new DisabledCloudBackupProvider();
  }

  return new HttpCloudBackupProvider(backupEndpoint, token);
}
