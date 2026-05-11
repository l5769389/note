import type { UploadResult } from "../types";

const endpoint = import.meta.env.VITE_IMAGE_UPLOAD_ENDPOINT as string | undefined;

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file: File): Promise<UploadResult> {
  if (!endpoint) {
    return {
      url: await fileToDataUrl(file),
      storage: "embedded",
    };
  }

  const form = new FormData();
  form.set("file", file);

  const response = await fetch(endpoint, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`图片上传失败：${response.status}`);
  }

  const payload = (await response.json()) as { url?: string };

  if (!payload.url) {
    throw new Error("图片上传接口需要返回 { url }");
  }

  return {
    url: payload.url,
    storage: "remote",
  };
}
