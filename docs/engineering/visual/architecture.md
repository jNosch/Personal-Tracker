# Architecture overview

Current state — single-user, no-auth, retrospective data entry (not live in-gym). One app (`apps/web`), no `apps/docs` despite what the stock Turborepo `README.md` still says.

```mermaid
flowchart TB
    User["Browser<br/>single user, retrospective entry"]

    subgraph WebApp["apps/web — Next.js 16 / React 19"]
        Routes["app/ routes<br/>thin: fetch + render"]
        Lib["lib/ — pure domain logic<br/>scheme engine, 1RM calc<br/>(planned, not yet populated)"]
        DbClient["db/client.ts<br/>Drizzle ORM client"]
        Schema["db/schema.ts<br/>table definitions"]
    end

    subgraph UIPkg["packages/ui — @repo/ui"]
        Comp["Shared React components<br/>Button, Card, Code"]
    end

    subgraph Tooling["Shared tooling, via Turborepo pipeline"]
        ESLint["@repo/eslint-config"]
        TSConfig["@repo/typescript-config"]
    end

    subgraph Postgres["docker-compose: postgres:17-alpine"]
        DevDb[("lifting_tracker<br/>dev DB")]
        TestDb[("lifting_tracker_test<br/>integration-test DB")]
    end

    subgraph MigrationFlow["Schema lifecycle"]
        Generate["pnpm db:generate<br/>drizzle-kit"]
        MigFiles["db/migrations/*.sql"]
        Migrate["pnpm db:migrate"]
    end

    subgraph TestFlow["apps/web tests — Vitest"]
        Unit["pnpm test<br/>*.test.ts, no DB"]
        Integration["pnpm test:integration<br/>*.integration.test.ts"]
        TestHelper["db/test-db.ts<br/>migrate + truncate helpers"]
    end

    User --> Routes
    Routes --> Lib
    Routes -.->|"until lib/ is populated"| DbClient
    Lib --> DbClient
    DbClient --> DevDb
    Schema --> Generate --> MigFiles --> Migrate --> DevDb
    MigFiles -.-> TestHelper

    WebApp --> Comp
    WebApp --> ESLint
    WebApp --> TSConfig
    UIPkg --> ESLint
    UIPkg --> TSConfig

    Unit -.->|"mandatory once lib/ has functions"| Lib
    Integration --> TestHelper --> TestDb
```

## Reading this

- **`lib/` is drawn dashed because it's empty** — `code-conventions.md` documents it as the intended home for pure domain logic (scheme engine, 1RM calc), but nothing has landed there yet. Routes currently have nowhere to delegate to but `db/client.ts` directly.
- **Two databases, one Postgres container.** `lifting_tracker` (dev) and `lifting_tracker_test` (integration tests) are separate databases on the same `docker-compose` instance — never the same DB, per [testing.md](../testing.md)'s isolation strategy (truncate-between-tests, no transaction rollback).
- **`packages/ui` and `apps/web` share tooling, not runtime code** — `@repo/eslint-config` and `@repo/typescript-config` are dev-time only; the only runtime dependency from `apps/web` on a workspace package is the `@repo/ui` component set itself.
- **No CI yet** — lint/check-types/test are honor-system, run locally before opening a PR (see [git-workflow.md](../git-workflow.md)).
