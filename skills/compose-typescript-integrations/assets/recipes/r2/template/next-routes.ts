import { createObjectKey, createR2DownloadUrl, createR2UploadUrl } from "./objects";

export type AuthorizedUpload = {
  ownerId: string;
  contentType: string;
  extension?: string;
};

export function createR2UploadRoute(options: {
  authorize(request: Request): Promise<AuthorizedUpload>;
  allowedContentTypes: ReadonlySet<string>;
}) {
  return async function POST(request: Request) {
    try {
      const upload = await options.authorize(request);
      if (!options.allowedContentTypes.has(upload.contentType)) {
        return Response.json({ error: "Unsupported content type" }, { status: 415 });
      }
      const key = createObjectKey(upload);
      const url = await createR2UploadUrl({ key, contentType: upload.contentType });
      return Response.json({ key, url, method: "PUT", contentType: upload.contentType });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload authorization failed";
      return Response.json({ error: message }, { status: 401 });
    }
  };
}

export function createR2DownloadRoute(options: {
  authorize(request: Request): Promise<{ key: string }>;
}) {
  return async function POST(request: Request) {
    try {
      const { key } = await options.authorize(request);
      return Response.json({ url: await createR2DownloadUrl(key) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Download authorization failed";
      return Response.json({ error: message }, { status: 401 });
    }
  };
}
