import { describe, expect, it } from "vitest";
import {
  getMigratedStorageItem,
  legacyNoteDockStorageKeys,
  noteDockStorageKeys,
} from "../storageKeys";

function createMemoryStorage(initialEntries: Array<[string, string]> = []) {
  const entries = new Map(initialEntries);

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  } as unknown as Storage;
}

describe("storage key migration", () => {
  it("moves legacy workspace state into the noteDock storage key", () => {
    const storage = createMemoryStorage([
      [legacyNoteDockStorageKeys.workspace, '{"version":1}'],
    ]);

    expect(
      getMigratedStorageItem(
        storage,
        noteDockStorageKeys.workspace,
        legacyNoteDockStorageKeys.workspace,
      ),
    ).toBe('{"version":1}');
    expect(storage.getItem(noteDockStorageKeys.workspace)).toBe('{"version":1}');
    expect(storage.getItem(legacyNoteDockStorageKeys.workspace)).toBeNull();
  });
});
