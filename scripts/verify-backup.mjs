import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

function run(command, args) {
  const child = spawn(command, args, { stdio: "inherit" });
  return new Promise((resolveExit) => {
    child.on("close", (code) => resolveExit(Number(code ?? 1)));
    child.on("error", () => resolveExit(1));
  });
}

const backupCode = await run("node", ["scripts/backup-db.mjs"]);
if (backupCode !== 0) process.exit(backupCode);

const backupsDir = resolve(process.cwd(), "backups");
const files = (await readdir(backupsDir))
  .filter((f) => f.startsWith("backup-") && f.endsWith(".sql"))
  .sort();
const latest = files.at(-1);
if (!latest) {
  console.error("Nenhum backup encontrado para validação.");
  process.exit(1);
}

const restoreCode = await run("node", ["scripts/restore-db.mjs", `backups/${latest}`]);
if (restoreCode !== 0) process.exit(restoreCode);

console.log("Verificação de backup/restore concluída com sucesso.");
