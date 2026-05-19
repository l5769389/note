export async function fileToDataUrl(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.addEventListener("progress", (event) => {
      if (!event.lengthComputable || !onProgress) {
        return;
      }

      onProgress(Math.min(0.98, event.loaded / event.total));
    });
    reader.readAsDataURL(file);
  });
}
