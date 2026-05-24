import { describe, expect, it } from "vitest";
import { loadRecentFileAvailability } from "../recentFileAvailability";

describe("recent file availability helpers", () => {
  it("returns an empty map without paths or path checker", async () => {
    await expect(loadRecentFileAvailability([], async () => true)).resolves.toEqual(
      {},
    );
    await expect(loadRecentFileAvailability(["D:/A.md"])).resolves.toEqual({});
  });

  it("checks availability for every recent file path", async () => {
    await expect(
      loadRecentFileAvailability(["D:/A.md", "D:/Missing.md"], async (filePath) =>
        !filePath.includes("Missing"),
      ),
    ).resolves.toEqual({
      "D:/A.md": true,
      "D:/Missing.md": false,
    });
  });
});
