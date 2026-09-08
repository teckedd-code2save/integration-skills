# Setup execution modes

For account login, expired-code recovery, same-runtime verification and direct credential delivery, read [authentication orchestration](authentication-orchestration.md).

Use one execution mode for the whole target application. The mode governs every integration in the composition, including authentication and SSO, payments, storage, maps, and routing.

Execution mode and secret sink are separate. The mode decides who performs an
action; the sink decides where credentials live and how they reach the runtime.
See [secret-sinks.md](secret-sinks.md).

## First-run choice

Read `integrations.config.json`. If it has a valid `executionMode`, use it without asking again. Otherwise ask exactly one short question before setup:

> How should I handle integration setup?
>
> - **Auto (recommended):** I perform safe setup, connector, configuration, and verification work and pause only when you must grant access or approve something.
> - **Interactive:** I walk through account and external configuration step by step and ask before each external mutation or consequential choice.

Do not infer the answer from conversational style. Record it by passing `--mode auto` or `--mode interactive` to `compose`. A later explicit user request may change the persisted mode.

## Auto

Continue through repository inspection, code changes, package installation, supported connector or CLI actions, configuration, local tests, and provider verification without asking the user to perform agent-capable work.

Pause with one exact request only when blocked by:

- connector or account access, login, or MFA;
- permission escalation or an external mutation requiring explicit approval;
- a secret that must be entered by the user into a provider's secure field or the project's secret store;
- billing, a paid commitment, legal terms, production promotion, quota policy, or a destructive action;
- a consequential product choice that cannot be derived safely from the request or repository.

After access or approval is supplied, resume from the blocked step and complete the remaining work. Do not replace the workflow with a dashboard checklist.

## Interactive

Perform repository inspection and reversible local diagnostics first. Explain the next external or account configuration action, its purpose, and what will change, then wait for confirmation before doing it. Use the connected provider tool or CLI after approval; ask the user to act only for login, MFA, secure secret entry, or a provider screen the agent cannot operate.

Group closely related safe actions so the walkthrough is useful rather than noisy. Local read-only inspection does not need confirmation. Existing user authorization still governs local code edits and dependency installation.

## Boundaries in both modes

The mode is an orchestration preference, not expanded authority. Never paste or request secrets in chat, invent credentials, bypass access controls, accept paid or legal terms, promote to production, or perform destructive actions without the required human action or approval. Prefer an authenticated connector, then an official provider CLI, then an exact dashboard path.

When a connector reports that access is missing, request that specific connection or scope and resume after it is granted. Report an integration as complete only after its recipe's completion criteria and live verification gate pass.

## Commands

Choose and persist the mode on the first composition:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs compose r2 --target . --mode auto --install
```

For a GroundControl deployment, persist its write-only environment as the sink:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs compose r2 --target . --mode auto --secret-sink groundcontrol --install
```

Future agents reuse it automatically:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs setup r2 --target .
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs doctor r2 --target . --live
```

Change it deliberately when requested:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs setup r2 --target . --mode interactive
```
