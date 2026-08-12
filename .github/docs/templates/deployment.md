# Deployment

> Documentation governance template. Replace each `TODO: Add details` with concrete,
> codebase-grounded information. Do not remove section headings.

## Target Azure Services
TODO: Add details — list each Azure service this system deploys to.

## Infrastructure Dependencies
TODO: Add details — required resources, networking, and prerequisites (see `infra/`).

## Deployment Sequence
1. TODO: Add details — exact ordered deployment steps and commands.

## Environment Configuration
| Variable | Purpose | Where it lives |
| --- | --- | --- |
| `TODO_VAR` | TODO: Add details | TODO: Add details (e.g., Key Vault reference) |

> Never commit secret values. Document only variable names and where secrets are stored.

## Service Identities / Auth Model
TODO: Add details — managed identity, RBAC roles, and auth pattern.

## Post-Deployment Validation
1. TODO: Add details — smoke tests and health checks with expected results.

## Rollback / Recovery
TODO: Add details — how to roll back or recover a failed deployment.
