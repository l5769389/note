import { useEffect, useState } from "react";

export type RecentFileAvailability = Record<string, boolean>;
export type PathExists = (filePath: string) => Promise<boolean>;

export async function loadRecentFileAvailability(
  filePaths: string[],
  pathExists?: PathExists,
): Promise<RecentFileAvailability> {
  if (!filePaths.length || !pathExists) {
    return {};
  }

  const entries = await Promise.all(
    filePaths.map(async (filePath) => [
      filePath,
      await pathExists(filePath),
    ] as const),
  );

  return Object.fromEntries(entries);
}

export function useRecentFileAvailability(
  filePaths: string[],
  pathExists?: PathExists,
) {
  const [availability, setAvailability] = useState<RecentFileAvailability>({});

  useEffect(() => {
    let isStale = false;

    void loadRecentFileAvailability(filePaths, pathExists).then((nextAvailability) => {
      if (!isStale) {
        setAvailability(nextAvailability);
      }
    });

    return () => {
      isStale = true;
    };
  }, [filePaths, pathExists]);

  return [availability, setAvailability] as const;
}
