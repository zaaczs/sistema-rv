/**
 * Restaura backup no Heroku Postgres via Docker — ALTERA APENAS o banco de destino.
 * Uso: node scripts/migrate-restore-docker.mjs backups/backup_prod_XXXX.dump
 * Requer: RESTORE_DATABASE_URL (URL do Heroku Postgres).
 */
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, resolve } from "node:path";

const targetUrl = process.env.RESTORE_DATABASE_URL;
if (!targetUrl) {
  console.error("Defina RESTORE_DATABASE_URL (Heroku DATABASE_URL) antes de executar.");
  process.exit(1);
}

const backupArg = process.argv[2];
if (!backupArg) {
  console.error("Informe o arquivo .dump: node scripts/migrate-restore-docker.mjs backups/arquivo.dump");
  process.exit(1);
}

const backupPath = resolve(process.cwd(), backupArg);
const backupName = basename(backupPath);
const backupsDir = resolve(backupPath, "..");

try {
  await access(backupPath, fsConstants.R_OK);
} catch {
  console.error(`Arquivo não encontrado: ${backupPath}`);
  process.exit(1);
}

console.log("ATENÇÃO: isto apaga e recria tabelas no banco de DESTINO (Heroku).");
console.log(`Destino: ${targetUrl.replace(/:[^:@]+@/, ":***@")}`);

function runDocker(cmd) {
  return new Promise((resolveExit) => {
    const child = spawn("docker", cmd, { stdio: "inherit" });
    child.on("close", (code) => resolveExit(Number(code ?? 1)));
    child.on("error", () => resolveExit(1));
  });
}

const restoreCode = await runDocker([
  "run",
  "--rm",
  "-e",
  `TARGET_URL=${targetUrl}`,
  "-v",
  `${backupsDir}:/backup`,
  "postgres:16-alpine",
  "sh",
  "-c",
  `pg_restore --clean --if-exists --no-owner --no-acl --dbname "$TARGET_URL" /backup/${backupName}`,
]);

if (restoreCode !== 0) {
  console.error("Falha no pg_restore.");
  process.exit(restoreCode);
}

const healthCode = await runDocker([
  "run",
  "--rm",
  "-e",
  `TARGET_URL=${targetUrl}`,
  "postgres:16-alpine",
  "sh",
  "-c",
  `psql "$TARGET_URL" -t -c "SELECT 'User=' || COUNT(*) FROM \\"User\\"; SELECT 'Product=' || COUNT(*) FROM \\"Product\\"; SELECT 'Sale=' || COUNT(*) FROM \\"Sale\\"; SELECT 'Customer=' || COUNT(*) FROM \\"Customer\\";"`,
]);

if (healthCode !== 0) {
  console.error("Restore feito, mas smoke test falhou.");
  process.exit(healthCode);
}

console.log("Restore concluído e smoke test executado.");
