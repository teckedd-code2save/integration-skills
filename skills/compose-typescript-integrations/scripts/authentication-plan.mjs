// Guidance only: setup cannot infer account, remote runtime or browser-session access
// from the presence of environment variables. This module never reads credentials.
export function authenticationPlan(provider, sink) {
  const authority = ["clerk", "google-auth", "linkedin-auth", "telegram-auth"].includes(provider)
    ? "clerk" : provider === "r2" ? "cloudflare" : provider;
  const plan = {
    status: "not-verified",
    authority,
    reference: "references/authentication-orchestration.md",
    credentialSink: sink,
    boundaries: ["provider-account", "agent-runtime", "deployment-runtime", "application-user"],
    sessionPolicy: "Reuse matching access; keep one live login attempt; resume and verify in the initiating runtime after user confirmation.",
    expiredCode: "End the stale attempt, initiate one fresh official flow, and give its current URL/code; inspect repeated failure before retrying again.",
    secretTransport: "Use a supported direct provider-to-sink or trusted non-disclosing transfer; ask for secure destination entry only when no such transport exists.",
    nextAction: "Inspect existing account access and the intended resource before initiating login; follow the referenced provider flow.",
  };
  if (authority === "cloudflare") {
    plan.accessChoices = ["worker-r2-binding", "direct-s3-credentials"];
    plan.starterAccess = "direct-s3-credentials";
    plan.bindingProbe = "Use a deployed binding-aware application upload/readback/rejection/cleanup test; the bundled S3 doctor does not verify this route.";
    plan.nextAction = "Choose or preserve the R2 access architecture first. For a Worker binding, reuse Cloudflare OAuth and do not request S3 keys; for direct S3, use the selected secret sink.";
  } else if (authority === "clerk") {
    plan.nextAction = "Reuse or initiate Clerk management login, link the intended instance, deliver keys directly to the selected sink, then verify a real browser session and protected application action.";
  }
  if (sink === "groundcontrol") {
    plan.runtimeVerification = "Verify within the intended GroundControl component; absent local variables do not establish missing Vault configuration. Reuse saved GitHub installation and registry access.";
  } else {
    plan.runtimeVerification = "Verify within the environment that receives the credentials; a successful management login alone is insufficient.";
  }
  return plan;
}
