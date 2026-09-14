import type {
  R2WorkerAuthorization,
  R2WorkerAuthorizationInput,
  R2WorkerCompletionInput,
} from "./contract";
import { validR2WorkerAuthorization } from "./contract";

type AuthorizeOptions = {
  authorize(
    request: Request,
    input: R2WorkerAuthorizationInput,
  ): Promise<R2WorkerAuthorization | null>;
};

type CompleteOptions = {
  complete(request: Request, input: R2WorkerCompletionInput): Promise<void>;
};

function unauthorized() {
  return Response.json({ error: "Storage operation is not authorized" }, { status: 403 });
}

export function createR2WorkerAuthorizeRoute(options: AuthorizeOptions) {
  return async function POST(request: Request) {
    const input = await request.json() as R2WorkerAuthorizationInput;
    if (!input.objectId || !["put", "get", "head"].includes(input.operation)) {
      return Response.json({ error: "Invalid storage authorization request" }, { status: 400 });
    }
    const authorization = await options.authorize(request, input);
    if (!validR2WorkerAuthorization(authorization)) return unauthorized();
    return Response.json(authorization, { headers: { "Cache-Control": "no-store" } });
  };
}

export function createR2WorkerCompleteRoute(options: CompleteOptions) {
  return async function POST(request: Request) {
    const input = await request.json() as R2WorkerCompletionInput;
    if (!input.objectId || input.operation !== "put" || !input.storageKey || !input.etag) {
      return Response.json({ error: "Invalid storage completion request" }, { status: 400 });
    }
    await options.complete(request, input);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  };
}
