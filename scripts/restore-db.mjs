import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { resolve } from "node:path";

function run(command, args) {
  const child = spawn(command, args, { stdio: "inherit" });
  return new Promise((resolveExit) => {
    child.on("close", (code) => resolveExit(Number(code ?? 1)));
    child.on("error", () => resolveExit(1));
  });
}

const targetDatabaseUrl = process.env.RESTORE_DATABASE_URL;
if (!targetDatabaseUrl) {
  console.error("RESTORE_DATABASE_URL não configurada.");
  process.exit(1);
}

const backupFileArg = process.argv[2];
if (!backupFileArg) {
  console.error("Informe o caminho do arquivo de backup: npm run db:restore -- backups/arquivo.sql");
  process.exit(1);
}

const backupFilePath = resolve(process.cwd(), backupFileArg);
try {
  await access(backupFilePath, fsConstants.R_OK);
} catch {
  console.error(`Arquivo de backup não encontrado: ${backupFilePath}`);
  process.exit(1);
}

const restoreCode = await run("psql", ["--dbname", targetDatabaseUrl, "--set", "ON_ERROR_STOP=1", "--file", backupFilePath]);
if (restoreCode !== 0) {
  console.error("Falha ao restaurar backup.");
  process.exit(restoreCode);
}

const healthCheckCode = await run("psql", [
  "--dbname",
  targetDatabaseUrl,
  "--tuples-only",
  "--command",
  "SELECT COUNT(*) FROM \"User\";",
]);
if (healthCheckCode !== 0) {
  console.error("Restore executado, mas falhou no teste de consistência.");
  process.exit(healthCheckCode);
}

console.log("Restore concluído e validado com sucesso.");
