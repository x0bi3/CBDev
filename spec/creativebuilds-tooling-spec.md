# CreativeBuilds Tooling & Environment Spec (Milestone M0)

> **This is spec 4 of 4. Read `CREATIVEBUILDS_README.md` first for the full
> document set and read order. This spec defines the local development
> environment, MCP integrations, and tooling that Cursor IDE must set up
> BEFORE any code is written for the project.**

> **Cursor Agent: This is milestone M0 — the prerequisite phase before M1
> (infra audit) and everything else. Execute the checks in Section 1
> first. Report results to the owner. Then execute installs and MCP
> registration only for what is missing and only after owner approval.
> Do NOT skip Section 4 (Postgres MCP migration) — the current Pi setup
> must be replaced cleanly, not left to rot alongside the new one.**

---

## 1. Host Detection & Prerequisites Audit

Cursor MUST run a system check on first execution and print a table showing
detected/missing tools. Suggested detection commands per OS:

### Windows (PowerShell)

```powershell
$tools = @(
  @{ Name = 'git';         Cmd = 'git --version' },
  @{ Name = 'gh';          Cmd = 'gh --version' },
  @{ Name = 'node';        Cmd = 'node --version' },
  @{ Name = 'pnpm';        Cmd = 'pnpm --version' },
  @{ Name = 'blender';     Cmd = 'blender --version' },
  @{ Name = 'ffmpeg';      Cmd = 'ffmpeg -version' },
  @{ Name = 'psql';        Cmd = 'psql --version' },
  @{ Name = 'ssh';         Cmd = 'ssh -V' }
)
foreach ($t in $tools) {
  $found = Get-Command $t.Name -ErrorAction SilentlyContinue
  Write-Output ("{0,-10} {1}" -f $t.Name, $(if ($found) { 'OK' } else { 'MISSING' }))
}
```

### macOS / Linux (bash)

```bash
for tool in git gh node pnpm blender ffmpeg psql ssh; do
  if command -v "$tool" >/dev/null 2>&1; then
    printf "%-10s OK\n" "$tool"
  else
    printf "%-10s MISSING\n" "$tool"
  fi
done
```

### Required tools and why

| Tool          | Purpose                                                    | Required at |
| ------------- | ---------------------------------------------------------- | ----------- |
| Git           | Source control                                             | M0          |
| GitHub CLI    | Repo creation, auth, GitHub MCP dependency                 | M0          |
| Node.js LTS   | Next.js / React Three Fiber runtime                        | M1          |
| pnpm          | Package manager (chosen over npm for monorepo perf)        | M1          |
| Blender 4.x   | Hero 3D asset authoring                                    | M2          |
| ffmpeg        | Media processing (case-study clips, screencasts)           | M4          |
| psql          | Postgres CLI, sanity checks against the Pi and cloud DBs   | M0          |
| ssh           | SSH tunnel to Pi Postgres                                  | M0          |

### Install commands (Windows-first, macOS/Linux noted)

**Git** — `winget install --id Git.Git -e` | `brew install git` | `sudo apt install git`

**GitHub CLI** — `winget install --id GitHub.cli -e` | `brew install gh` | `sudo apt install gh`

**Node LTS** — Use `fnm` or `nvm-windows` for version management, not the raw installer.
- Windows: `winget install --id Schniz.fnm -e` then `fnm install --lts && fnm use lts-latest`
- macOS/Linux: `curl -fsSL https://fnm.vercel.app/install | bash`

**pnpm** — `npm install -g pnpm` (after Node is installed)

**Blender 4.x** — see Section 6

**ffmpeg** — `winget install --id Gyan.FFmpeg -e` | `brew install ffmpeg` | `sudo apt install ffmpeg`

**psql** — comes with Postgres install. On Windows: `winget install --id PostgreSQL.PostgreSQL.16 -e` (client only mode if you don't want a local server).

---

## 2. Recommended VS Code / Cursor Extensions

Beyond MCPs, these extensions dramatically improve the DX for this stack:

- **ESLint** (`dbaeumer.vscode-eslint`)
- **Prettier** (`esbenp.prettier-vscode`)
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
- **Prisma** (`Prisma.prisma`) — if the DB layer uses Prisma
- **PostgreSQL** (`cweijan.vscode-postgresql-client2`) — GUI browsing separate from MCP
- **Error Lens** (`usernamehw.errorlens`)
- **GitLens** (`eamodio.gitlens`)
- **glTF Viewer** (`cesium.gltf-vscode`) — preview 3D assets without opening Blender
- **Shader languages support for VS Code** (`slevesque.shader`) — for GLSL in R3F

Cursor is a VS Code fork; all of these install identically.

---

## 3. MCP Registry — `.cursor/mcp.json`

Cursor should write this file (or merge into an existing user-level
`~/.cursor/mcp.json`) at the repo root. Values in `${VAR}` come from
environment variables — never commit secrets.

```jsonc
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {}
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": {}
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres",
               "postgresql://cbdev:${PG_PASSWORD}@127.0.0.1:${PG_LOCAL_PORT}/creativebuilds"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PAT}" }
    },
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp", "--tools=all"],
      "env": { "STRIPE_SECRET_KEY": "${STRIPE_SECRET_KEY}" }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem",
               "${WORKSPACE_ROOT}"],
      "env": {}
    }
  }
}
```

### Environment variables required for MCP

Add to a machine-level `.env` (never committed) or the OS keychain:

```
PG_PASSWORD=<pi postgres password>
PG_LOCAL_PORT=55432
GITHUB_PAT=<fine-grained PAT with repo + workflow scopes>
STRIPE_SECRET_KEY=<test-mode key during dev>
WORKSPACE_ROOT=<absolute path to the pro_cbdev repo>
```

### MCP install verification

After registering, restart Cursor and confirm each server appears green in
the MCP status panel. If any server fails to start, the tool likely isn't
installed globally — install with `npx -y <package> --help` to trigger cache.

---

## 4. Postgres MCP Migration (Pi SSH → Official Server)

The current setup uses a custom SSH MCP to reach the Pi's Postgres. Migrate
to the **official `@modelcontextprotocol/server-postgres`** for the reasons
below, then retire the custom MCP.

### Why migrate

- Official MCP is maintained, supports the full MCP tool spec (list_tables,
  read_query, describe_table, etc.), and has significantly better latency
  than round-tripping SQL through an SSH command channel.
- Structured schema introspection instead of raw output parsing.
- Predictable connection semantics; no shell-quoting hazards.
- Read-only mode is a first-class option — matches the platform spec §2
  "read-only during planning" requirement.

### Prerequisites

- Pi Postgres accepts TCP connections from the main PC's LAN OR is reachable
  through an SSH tunnel established at the OS level (not inside the MCP).
- SSH tunnel approach is strongly preferred — do NOT expose the Pi's
  Postgres port on your network directly, even inside your LAN, without
  TLS and a strong `pg_hba.conf`.

### Migration steps

**Step 1 — Verify current Pi Postgres connectivity**

```bash
ssh pi@<pi-host> "psql -U cbdev -d creativebuilds -c '\l'"
```

**Step 2 — Establish a persistent SSH tunnel outside the MCP**

Windows: create a Scheduled Task or a Startup shortcut with:

```
ssh -N -L 55432:127.0.0.1:5432 -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes pi@<pi-host>
```

macOS/Linux: use `autossh` as a launchd/systemd service:

```
autossh -M 0 -N -L 55432:127.0.0.1:5432 -o ServerAliveInterval=30 pi@<pi-host>
```

Local port `55432` is arbitrary — pick something outside the ephemeral
range. Store as `PG_LOCAL_PORT` env var.

**Step 3 — Test the tunnel with psql**

```bash
psql "postgresql://cbdev:${PG_PASSWORD}@127.0.0.1:55432/creativebuilds" -c "SELECT current_database(), current_user, version();"
```

If this succeeds, the MCP will work.

**Step 4 — Register the official Postgres MCP** (see Section 3 config)

**Step 5 — Test in Cursor**

Prompt: "List all tables in the public schema of the creativebuilds
database." Cursor should call the postgres MCP's `list_tables` tool
and return actual results.

**Step 6 — Retire the custom SSH MCP**

- Remove its entry from `~/.cursor/mcp.json` or wherever it's registered.
- Keep the SSH command reference in a `docs/legacy-postgres-mcp.md` note in
  case rollback is needed.
- Do not delete the custom MCP code from disk until 30 days of clean
  operation on the official server.

### Read-only vs read-write policy

- During planning (M1 database audit): connect with a **read-only** DB role.
  Create if it doesn't exist:

  ```sql
  CREATE ROLE cbdev_ro NOLOGIN;
  GRANT CONNECT ON DATABASE creativebuilds TO cbdev_ro;
  GRANT USAGE ON SCHEMA public TO cbdev_ro;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO cbdev_ro;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO cbdev_ro;
  CREATE USER cbdev_ro_login WITH PASSWORD '<strong pw>' IN ROLE cbdev_ro;
  ```

- Switch to read-write role only after PLAN.md is approved and migration
  execution begins.

---

## 5. GitHub Setup — New Repo `pro_cbdev`

### Authenticate `gh`

```bash
gh auth login
# Choose GitHub.com, HTTPS, authenticate via browser
```

### Create the repo

```bash
gh repo create pro_cbdev --private --description "CreativeBuilds professional site + platform" --confirm
```

Recommended: private during build, flip to public post-launch only if you
want the marketing site's code to be open source. The platform code should
stay private regardless (client data schemas, feature-gate logic).

### Initial commit contents

The initial commit should include the four spec files from this repo:

```
CREATIVEBUILDS_README.md
creativebuilds-pro-spec.md
creativebuilds-platform-spec.md
creativebuilds-pricing-spec.md
creativebuilds-tooling-spec.md
```

Move them into a `/spec` subdirectory before commit to keep the repo root
clean for actual code.

### Branch protection

Once the repo has content, enable branch protection on `main`:

- Require PR before merging
- Require conversation resolution
- Require linear history
- Include administrators (yes, apply the rules to yourself — this is a
  guardrail against sleep-deprived `git push --force`)

Cursor should propose this in `PLAN.md` and execute after owner approval.

### GitHub MCP verification

After registering the GitHub MCP (Section 3), prompt Cursor: "List issues
in the pro_cbdev repo." Should return an empty list (new repo) via a
proper MCP call, not a shell command.

---

## 6. Blender Install & Integration

### Install

Windows options (prefer winget for reproducibility):

```
winget install --id BlenderFoundation.Blender -e
```

If winget isn't available or fails, download from https://www.blender.org
(direct install, not the Windows Store version — the store version has
sandboxing quirks that break some addons).

macOS: `brew install --cask blender`

Linux: `sudo snap install blender --classic` OR download from blender.org

### Post-install checklist

- Add Blender to PATH so `blender --version` works from any shell (helps
  Cursor detect it in future audits).
- Launch once and set:
  - Preferences → Interface → Display → Resolution Scale to comfortable
  - Preferences → Save & Load → Auto Save every 5 minutes
  - Preferences → Add-ons: enable `Node Wrangler`, `LoopTools`, `Import
    Images as Planes`, `Auto Mirror`

### Recommended addons (free)

- **Blender-MCP** (unofficial community addon) — installs a WebSocket
  server inside Blender that lets external tools drive the app. If you
  want Cursor to iterate on the hero geometry interactively, install
  this. Otherwise skip.
- **glTF-Blender-IO** — bundled since 2.80, ensure enabled.
- **BlenderKit** — free asset library integration for quick material and
  model starts.
- **Extra Objects** — bundled, adds procedural primitives useful for the
  abstract technical hero geometry.

### Cursor ↔ Blender integration modes

**Mode A: Cursor drives Blender live** (via blender-mcp addon)
- Pros: Real iteration loop; Cursor can propose scene changes and see them
  render.
- Cons: Requires Blender to be running; the community MCP is not first-party.
- Verdict: Enable if you plan to spend real time iterating on the hero
  scene inside Blender. Skip if you'll model once and hand off.

**Mode B: Cursor manipulates .blend files as build artifacts** (recommended default)
- Cursor invokes `blender --background --python <script.py>` to run
  headless operations: baking, exports, LOD generation.
- Every hero-scene edit is a Python script under `tools/blender/` in the repo.
- Reproducible, version-controllable, no live-app coupling.
- Pros: Fits the "boring, proven patterns" guardrail from the specs.
- Cons: Slower feedback loop for creative iteration.

**Recommendation for this project**: **Mode B by default, Mode A optional.**
The hero scene is one-time creative work; automation matters more than
live iteration. Ship the Mode A path only if you find yourself opening
Blender daily.

### Asset optimization pipeline

Cursor should install these as project devDependencies (Section 7 covers
package.json) so the pipeline is reproducible:

```
pnpm add -D @gltf-transform/cli @gltf-transform/core @gltf-transform/functions
pnpm add -D sharp gltf-pipeline
```

Standard hero-model preprocessing:

```bash
# 1. Simplify + weld
gltf-transform weld hero.glb hero-welded.glb
gltf-transform simplify hero-welded.glb hero-simplified.glb --ratio 0.7

# 2. Compress meshes
gltf-transform meshopt hero-simplified.glb hero-meshopt.glb

# 3. Compress textures to KTX2
gltf-transform uastc hero-meshopt.glb hero.glb --slots "baseColorTexture"
gltf-transform etc1s hero.glb hero.glb --slots "normalTexture,metallicRoughnessTexture"

# 4. Inspect final size
gltf-transform inspect hero.glb
```

Target: <500KB total for the hero scene payload, LCP under 2.5s on mid-tier
laptop per the marketing spec §12.

---

## 7. Figma — Deferred Decision

**Recommendation: skip Figma for v1.** Rationale:

- Solo builder, no design partner or design handoff needed.
- Learning curve on Figma (real proficiency, not surface-level) costs
  meaningful time that competes with actual build velocity.
- The dark-technical aesthetic in the specs is reference-implementable
  directly in code without a design file intermediate.
- Alternatives that require zero new tool learning:
  - **v0.dev** — generate initial component layouts from prompts, refine
    in code. Perfect for "give me a first pass at the pricing card."
  - **Excalidraw** (excalidraw.com or the Cursor extension) — in-browser
    architecture sketching for anything you'd whiteboard.
  - **Screenshot + Cursor "match this design"** — take a screenshot of any
    reference site (Supabase, Railway, Vercel), drop it in Cursor, ask
    for a same-vibe component.

**Revisit Figma if:**
- A designer joins the project.
- You want to build a formal design system doc site distinct from Storybook.
- Client-site theming becomes a real product feature and clients need
  visual editors.

**If you do adopt Figma later:** the Figma Dev Mode MCP integrates cleanly
into this same `mcp.json` and would replace the "match this screenshot"
workflow with structured token/component extraction. Cost is ~$15/mo per
editor.

---

## 8. Handoff to Cursor

Cursor: after completing this M0 spec, produce a `BOOTSTRAP_REPORT.md` at
the repo root containing:

1. **Detected environment**: OS, versions of every tool from Section 1's
   table. Distinguish OK / MISSING / OUTDATED.
2. **Missing tools installed during M0**: what was installed, with commands.
3. **Missing tools NOT installed**: why deferred, when they'll be needed.
4. **MCP status**: each MCP registered, verified green, or failed with
   reason.
5. **Postgres migration status**: SSH tunnel established, official MCP
   responding, read-only role created, legacy custom MCP retired (or
   scheduled for retirement).
6. **GitHub setup status**: `pro_cbdev` repo created, initial commit with
   specs pushed, branch protection configured (or awaiting approval),
   GitHub MCP verified.
7. **Blender status**: version installed, mode chosen (A or B), asset
   pipeline devDeps installed.
8. **Open questions blocking M1**: anything the owner needs to answer
   before database audit begins.

Only after `BOOTSTRAP_REPORT.md` is reviewed and approved may Cursor
proceed to M1 (infrastructure audit) as defined in the platform spec §2.

---

_End of tooling spec. Return to `CREATIVEBUILDS_README.md` for the read
order and `/PLAN.md` requirements._
