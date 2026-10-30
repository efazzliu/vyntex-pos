#!/usr/bin/env node
/**
 * Apply remaining production Supabase SQL + deploy optional edge functions.
 *
 * Requires one of:
 *   SUPABASE_ACCESS_TOKEN  — Supabase CLI / Management API (recommended)
 *   SUPABASE_DB_URL        — direct Postgres connection string
 *
 * Optional:
 *   SUPABASE_PROJECT_REF   — defaults to zaborkzrstifvzvzamef
 *   DEPLOY_EDGE_FUNCTIONS=1 — also deploy paddle-webhook + send-client-email
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "zaborkzrstifvzvzamef";
const SQL_PATH = path.join(ROOT, "supabase/apply_missing_production.sql");

function fail(msg) {
  console.error(`\n[apply-missing-supabase] ${msg}\n`);
  process.exit(1);
}

async function applyViaManagementApi(token, sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(
      `Management API ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`,
    );
  }
  return body;
}

async function applyViaPg(dbUrl, sql) {
  const tmp = path.join(ROOT, ".tmp-apply-missing.sql");
  const { writeFileSync, unlinkSync } = await import("node:fs");
  writeFileSync(tmp, sql, "utf8");
  try {
    const r = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", tmp], {
      cwd: ROOT,
      stdio: "inherit",
      encoding: "utf8",
    });
    if (r.status !== 0) throw new Error("psql exited with non-zero status");
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function deployEdgeFunctions(token) {
  const env = { ...process.env, SUPABASE_ACCESS_TOKEN: token };
  for (const fn of ["paddle-webhook", "send-client-email"]) {
    console.log(`Deploying edge function: ${fn}`);
    const args = ["supabase", "functions", "deploy", fn];
    if (fn === "paddle-webhook") args.push("--no-verify-jwt");
    const r = spawnSync("npx", args, { cwd: ROOT, env, stdio: "inherit", shell: true });
    if (r.status !== 0) fail(`Edge function deploy failed: ${fn}`);
  }
}

async function main() {
  const sql = readFileSync(SQL_PATH, "utf8");
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const dbUrl = process.env.SUPABASE_DB_URL?.trim();

  if (!token && !dbUrl) {
    fail(
      "Missing credentials. Add SUPABASE_ACCESS_TOKEN or SUPABASE_DB_URL to Cloud Agent secrets, then re-run:\n  npm run apply:supabase-missing",
    );
  }

  console.log(`Applying ${SQL_PATH} to project ${PROJECT_REF} ...`);
  if (token) {
    await applyViaManagementApi(token, sql);
  } else {
    await applyViaPg(dbUrl, sql);
  }
  console.log("SQL applied successfully.");

  if (process.env.DEPLOY_EDGE_FUNCTIONS === "1") {
    if (!token) fail("DEPLOY_EDGE_FUNCTIONS requires SUPABASE_ACCESS_TOKEN.");
    deployEdgeFunctions(token);
    console.log("Edge functions deployed.");
  } else {
    console.log(
      "Skipped edge functions (set DEPLOY_EDGE_FUNCTIONS=1 to deploy paddle-webhook + send-client-email).",
    );
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
