import * as oidc from "openid-client";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

let discovered: Promise<oidc.Configuration> | undefined;

function configuration(): Promise<oidc.Configuration> {
  discovered ??= oidc.discovery(
    new URL(required("OIDC_ISSUER_URL")),
    required("OIDC_CLIENT_ID"),
    required("OIDC_CLIENT_SECRET"),
  );
  return discovered;
}

export type OidcTransaction = {
  state: string;
  nonce: string;
  codeVerifier: string;
};

export type OidcIdentity = {
  subject: string;
  issuer: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  claims: Readonly<Record<string, unknown>>;
};

export async function beginOidcAuthorization(): Promise<{
  url: URL;
  transaction: OidcTransaction;
}> {
  const config = await configuration();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: required("OIDC_REDIRECT_URI"),
    response_type: "code",
    scope: process.env.OIDC_SCOPES || "openid profile email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });

  return { url, transaction: { state, nonce, codeVerifier } };
}

export async function finishOidcAuthorization(
  currentUrl: URL | Request,
  transaction: OidcTransaction,
): Promise<OidcIdentity> {
  const config = await configuration();
  const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: transaction.codeVerifier,
    expectedState: transaction.state,
    expectedNonce: transaction.nonce,
    idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!claims?.sub || !claims.iss) throw new Error("OIDC response did not contain a verified subject and issuer");

  return {
    subject: claims.sub,
    issuer: claims.iss,
    email: typeof claims.email === "string" ? claims.email : undefined,
    emailVerified: typeof claims.email_verified === "boolean" ? claims.email_verified : undefined,
    name: typeof claims.name === "string" ? claims.name : undefined,
    picture: typeof claims.picture === "string" ? claims.picture : undefined,
    claims: claims as Readonly<Record<string, unknown>>,
  };
}
