import type { Request, RequestHandler, Response } from "express";
import {
  beginOidcAuthorization,
  finishOidcAuthorization,
  type OidcIdentity,
  type OidcTransaction,
} from "./flow.js";

export function createOidcBeginHandler(options: {
  saveTransaction(request: Request, response: Response, transaction: OidcTransaction): Promise<void>;
}): RequestHandler {
  return async (request, response, next) => {
    try {
      const { url, transaction } = await beginOidcAuthorization();
      await options.saveTransaction(request, response, transaction);
      response.redirect(302, url.toString());
    } catch (cause) {
      next(cause);
    }
  };
}

export function createOidcCallbackHandler(options: {
  takeTransaction(request: Request, response: Response): Promise<OidcTransaction | null>;
  establishSession(request: Request, response: Response, identity: OidcIdentity): Promise<void>;
  successRedirect: string;
  currentUrl(request: Request): URL;
}): RequestHandler {
  return async (request, response, next) => {
    try {
      const transaction = await options.takeTransaction(request, response);
      if (!transaction) {
        response.status(400).send("OIDC transaction is missing or expired");
        return;
      }
      const identity = await finishOidcAuthorization(options.currentUrl(request), transaction);
      await options.establishSession(request, response, identity);
      response.redirect(302, options.successRedirect);
    } catch (cause) {
      next(cause);
    }
  };
}
