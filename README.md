# SRA Control Center

The race director's operational cockpit for the Sim Racing Alliance ACC league, built over the SimGrid GridOS API.

SRA Control Center aggregates read-only SimGrid data, applies league-owned business logic (points, penalties, eligibility), snapshots results for audit, and publishes to the race director's cockpit and Discord. SimGrid is the racing platform; this app is the cockpit. We never write to SimGrid.

## Quick start

```bash
pnpm install
cp .env.example .env   # fill in your credentials
pnpm test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full development workflow and [docs/PROJECT_BRIEF.md](./docs/PROJECT_BRIEF.md) for the architecture spec.
