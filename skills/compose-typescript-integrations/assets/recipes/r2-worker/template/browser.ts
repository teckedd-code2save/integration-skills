export type R2WorkerRequest = {
  workerOrigin: string;
  objectId: string;
  bearerToken: string;
};

function objectUrl(input: R2WorkerRequest) {
  const url = new URL(`/objects/${encodeURIComponent(input.objectId)}`, input.workerOrigin);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("R2 Worker origin must use HTTPS outside local development");
  }
  return url;
}

async function expectSuccess(response: Response) {
  if (response.ok) return response;
  const detail = await response.text().catch(() => "");
  throw new Error(`R2 Worker request failed (${response.status})${detail ? `: ${detail}` : ""}`);
}

export async function uploadToR2Worker(
  input: R2WorkerRequest & { body: Blob },
) {
  return expectSuccess(await fetch(objectUrl(input), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${input.bearerToken}`,
      "Content-Type": input.body.type || "application/octet-stream",
    },
    body: input.body,
  }));
}

export async function downloadFromR2Worker(input: R2WorkerRequest) {
  return expectSuccess(await fetch(objectUrl(input), {
    headers: { Authorization: `Bearer ${input.bearerToken}` },
  }));
}
