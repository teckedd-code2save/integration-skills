# Agent-safe secret sinks

For account login, expired-code recovery, same-runtime verification and direct credential delivery, read [authentication orchestration](authentication-orchestration.md).

Integration setup may discover, create, rotate, and verify credentials, but a
credential value must never pass through the model transcript, a CLI argument,
source control, or ordinary command output. The scaffolder therefore separates
the integration plan from secret transport.

## Contract

`--secret-sink` selects where runtime credentials are owned:

- `runtime-env` — the deployment platform's existing write-only secret store.
- `groundcontrol` — GroundControl Vault or the Infisical provider selected for
  that GroundControl environment. Values are component scoped and injected at
  runtime.
- `infisical` — an Infisical project/environment/path reached through an
  authenticated machine identity.
- `dotenv-local` — an ignored `.env.local` file for local development only.

The selected sink is persisted in `integrations.config.json`. Composition also
generates `integrations.secrets.json`, a value-free manifest containing the
required variable names, integration ownership, component, sensitivity class,
delivery scope, and whether each field is required. Both files are safe to
commit because neither contains values, fingerprints, lengths, or reversible
metadata.

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs \
  compose r2 --target apps/web --mode auto --secret-sink groundcontrol --install
```

`setup --json` returns a `secretHandoff` for each provider. An orchestrator
should render missing secret fields in its own write-only secure input and
return only a success receipt. It must not ask the user to send the value to the
agent. The setup report exposes names and status only; even a configured value
is never echoed, fingerprinted, or measured.

## GroundControl flow

1. Compose with `--secret-sink groundcontrol`.
2. Keep provider variables explicit on the intended Compose service so
   GroundControl can assign them to that component.
3. Open the deployment's named environment and use **Add value** or its audited
   import flow. The input is write-only.
4. Deploy normally. GroundControl resolves the selected provider, prepares its
   ephemeral runtime environment, validates the effective Compose model, and
   recreates only the requested scope.
5. Run `doctor <provider> --live` inside a runtime that received the environment.

Do not create a second secret database in the integration kit. GroundControl
Vault or the environment's selected Infisical provider remains authoritative.

## Human boundary

Account login, MFA, billing or legal acceptance, and a provider secret that is
shown only once remain human checkpoints unless an authenticated connector, official CLI, or trusted non-disclosing
provider-to-sink transport can send the value directly to the selected sink without returning it to the
model. Auto mode resumes after that checkpoint; it does not turn the remaining
agent work into a dashboard checklist.

Never accept secret values through `--secret-sink`, another argument, JSON
output, a prompt response, or committed configuration.

## Temporary credentials

Where a provider supports temporary credentials, prefer them for bounded setup
or diagnostics. Cloudflare R2 can use the optional `R2_SESSION_TOKEN` together
with its temporary access key and secret. It remains optional because the
long-lived application runtime may use a bucket-scoped parent token instead.
Temporary credentials still belong in the selected sink and must never be
printed.

- https://developers.cloudflare.com/r2/api/s3/temporary-credentials/
