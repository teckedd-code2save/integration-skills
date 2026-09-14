export type R2WorkerOperation = "put" | "get" | "head";

export type R2WorkerAuthorizationInput = {
  objectId: string;
  operation: R2WorkerOperation;
  contentType?: string;
  contentLength?: number;
};

export type R2WorkerAuthorization = {
  storageKey: string;
  contentType?: string;
  contentLength?: number;
  completionToken?: string;
};

export type R2WorkerCompletionInput = {
  objectId: string;
  operation: "put";
  storageKey: string;
  etag: string;
  size: number;
};

export function validR2WorkerAuthorization(
  value: R2WorkerAuthorization | null | undefined,
): value is R2WorkerAuthorization {
  return Boolean(
    value &&
      value.storageKey &&
      value.storageKey.length <= 1024 &&
      !value.storageKey.startsWith("/"),
  );
}
