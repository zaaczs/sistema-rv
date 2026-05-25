/**
 * Backup do Supabase via Docker (pg_dump) — operação SOMENTE LEITURA no banco de origem.
 * Uso: node scripts/migrate-backup-docker.mjs
 * Requer: DATABASE_URL ou DIRECT_URL no ambiente (DIRECT_URL preferível para dump).
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const sourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!sourceUrl) {
  console.error("Defina DIRECT_URL ou DATABASE_URL antes de executar.");
  process.exit(1);
}

const backupsDir = resolve(process.cwd(), "backups");
await mkdir(backupsDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dumpCustom = resolve(backupsDir, `backup_prod_${stamp}.dump`);
const dumpSql = resolve(backupsDir, `backup_prod_${stamp}.sql`);

function dockerPgDump(args, outputHostPath) {
  return new Promise((resolveExit) => {
    const containerOut = "/backup/out";
    const cmd = [
      "run",
      "--rm",
      "-e",
      `SOURCE_URL=${sourceUrl}`,
      "-v",
      `${backupsDir}:/backup`,
      "postgres:16-alpine",
      "sh",
      "-c",
      `pg_dump --no-owner --no-acl ${args.join(" ")} "$SOURCE_URL"`,
    ];
    const child = spawn("docker", cmd, { stdio: "inherit" });
    child.on("close", (code) => resolveExit(Number(code ?? 1)));
    child.on("error", () => resolveExit(1));
  });
}

console.log("Iniciando backup (somente leitura) do Supabase via Docker...");
console.log(`Destino: ${backupsDir}`);

// Custom format
const customArgs = ["--format=custom", `--file=/backup/${dumpCustom.split(/[/\\]/).pop()}`];
let code = await dockerPgDump(customArgs);
if (code !== 0) {
  console.error("Falha no pg_dump (formato custom).");
  process.exit(code);
}
console.log(`Backup custom: ${dumpCustom}`);

// Plain SQL
const sqlArgs = ["--format=plain", `--file=/backup/${dumpSql.split(/[/\\]/).pop()}`];
code = await dockerPgDump(sqlArgs);
if (code !== 0) {
  console.error("Falha no pg_dump (formato SQL).");
  process.exit(code);
}
console.log(`Backup SQL: ${dumpSql}`);
console.log("Backup concluído. Nenhuma alteração foi feita no banco de origem.");
