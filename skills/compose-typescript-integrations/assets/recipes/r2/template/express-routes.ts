import type { Request, RequestHandler } from "express";
import { createObjectKey, createR2DownloadUrl, createR2UploadUrl } from "./objects";

export type AuthorizedUpload = {
  ownerId: string;
  contentType: string;
  extension?: string;
};

export function createR2UploadHandler(options: {
  authorize(request: Request): Promise<AuthorizedUpload>;
  allowedContentTypes: ReadonlySet<string>;
}): RequestHandler {
  return async (request, response) => {
    try {
      const upload = await options.authorize(request);
      if (!options.allowedContentTypes.has(upload.contentType)) {
        response.status(415).json({ error: "Unsupported content type" });
        return;
      }
      const key = createObjectKey(upload);
      const url = await createR2UploadUrl({ key, contentType: upload.contentType });
      response.json({ key, url, method: "PUT", contentType: upload.contentType });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload authorization failed";
      response.status(401).json({ error: message });
    }
  };
}

export function createR2DownloadHandler(options: {
  authorize(request: Request): Promise<{ key: string }>;
}): RequestHandler {
  return async (request, response) => {
    try {
      const { key } = await options.authorize(request);
      response.json({ url: await createR2DownloadUrl(key) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Download authorization failed";
      response.status(401).json({ error: message });
    }
  };
}
