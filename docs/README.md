# Career Forge Documentation

Index of everything under `docs/`. If a doc here contradicts the code,
the code wins — fix the doc.

## Getting started
- [Root README](../README.md) — install, run locally, acceptance test steps
- [CLAUDE.md](../CLAUDE.md) — architecture map for AI coding sessions

## Development
- [API Reference](api.md) — every endpoint, request/response shapes, error codes
- [Tech Debt Log](tech-debt.md) — what's been fixed, deferred, blocked, or accepted as a risk
- [QA & Testing Process](qa-process.md) — automated test coverage + manual checklist

## Operations
- [Deployment Runbook](deployment-runbook.md) — deploy, rollback, incident response
- [Troubleshooting Guide](troubleshooting.md) — common production issues and fixes
- [UI/UX Checklist](ui-ux-checklist.md) — manual responsive-design validation (unverified this session)

## Product & strategy
- [Roadmap](roadmap.md) — phases, what's shipped vs. planned
- [Idea Validation](idea-validation.md) — core thesis, stress tests, pivot options
- [Retention Roadmap](retention-roadmap.md) — post-launch features to reduce churn
- [Analytics Plan](analytics-plan.md) — event schema, metrics, tooling (not yet implemented)
- [Business Metrics](business-metrics.md) — revenue model status, PMF validation metrics
- [Acquisition Strategy](acquisition-strategy.md) — channel plan, kill criteria

## A note on how these docs are labeled

The product/strategy docs above (roadmap, idea validation, retention,
analytics, business metrics, acquisition) mark claims as **Fact**
(verifiable in this repo), **Assumption** (plausible, unvalidated), or
**Recommendation** (a judgment call, not a decision already made). This
isn't a style quirk — treating an unvalidated assumption as a fact is how
a team burns months building the wrong thing. Keep the labels when editing
these docs.
