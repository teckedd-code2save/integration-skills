export function beginOidcSignIn(endpoint = "/api/auth/oidc"): void {
  window.location.assign(endpoint);
}
