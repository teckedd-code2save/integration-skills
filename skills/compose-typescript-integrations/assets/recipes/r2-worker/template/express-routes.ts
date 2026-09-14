import type { Request, RequestHandler } from "express";
import type {
  R2WorkerAuthorization,
  R2WorkerAuthorizationInput,
  R2WorkerCompletionInput,
} from "./contract.js";
import { validR2WorkerAuthorization } from "./contract.js";

type AuthorizeOptions = {
  authorize(
    request: Request,
    input: R2WorkerAuthorizationInput,
  ): Promise<R2WorkerAuthorization | null>;
};

type CompleteOptions = {
  complete(request: Request, input: R2WorkerCompletionInput): Promise<void>;
};

export function createR2WorkerAuthorizeHandler(options: AuthorizeOptions): RequestHandler {
  return async (request, response, next) => {
    try {
      const input = request.body as R2WorkerAuthorizationInput;
      if (!input?.objectId || !["put", "get", "head"].includes(input.operation)) {
        response.status(400).json({ error: "Invalid storage authorization request" });
        return;
      }
      const authorization = await options.authorize(request, input);
      if (!validR2WorkerAuthorization(authorization)) {
        response.status(403).json({ error: "Storage operation is not authorized" });
        return;
      }
      response.setHeader("Cache-Control", "no-store");
      response.json(authorization);
    } catch (error) {
      next(error);
    }
  };
}

export function createR2WorkerCompleteHandler(options: CompleteOptions): RequestHandler {
  return async (request, response, next) => {
    try {
      const input = request.body as R2WorkerCompletionInput;
      if (!input?.objectId || input.operation !== "put" || !input.storageKey || !input.etag) {
        response.status(400).json({ error: "Invalid storage completion request" });
        return;
      }
      await options.complete(request, input);
      response.setHeader("Cache-Control", "no-store");
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}
