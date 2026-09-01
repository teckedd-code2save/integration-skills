import {
  beginOidcAuthorization,
  finishOidcAuthorization,
  type OidcIdentity,
  type OidcTransaction,
} from "./flow";

type MutableResponse = { headers: Headers };

export function createOidcBeginRoute(options: {
  saveTransaction(
    request: Request,
    response: MutableResponse,
    transaction: OidcTransaction,
  ): Promise<void>;
}) {
  return async function GET(request: Request): Promise<Response> {
    const { url, transaction } = await beginOidcAuthorization();
    const response = { headers: new Headers() };
    await options.saveTransaction(request, response, transaction);
    response.headers.set("location", url.toString());
    return new Response(null, { status: 302, headers: response.headers });
  };
}

export function createOidcCallbackRoute(options: {
  takeTransaction(
    request: Request,
    response: MutableResponse,
  ): Promise<OidcTransaction | null>;
  establishSession(
    request: Request,
    response: MutableResponse,
    identity: OidcIdentity,
  ): Promise<void>;
  successRedirect: string;
}) {
  return async function GET(request: Request): Promise<Response> {
    const response = { headers: new Headers() };
    const transaction = await options.takeTransaction(request, response);
    if (!transaction) return new Response("OIDC transaction is missing or expired", { status: 400 });

    const identity = await finishOidcAuthorization(request, transaction);
    await options.establishSession(request, response, identity);
    response.headers.set("location", options.successRedirect);
    return new Response(null, { status: 302, headers: response.headers });
  };
}
