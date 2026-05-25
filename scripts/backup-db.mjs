import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL não configurada.");
  process.exit(1);
}

const backupsDir = resolve(process.cwd(), "backups");
await mkdir(backupsDir, { recursive: true });
const mirrorDir = process.env.BACKUP_MIRROR_DIR?.trim();
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? 14);
const retentionMs = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays * 24 * 60 * 60 * 1000 : 0;

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = resolve(backupsDir, `backup-${stamp}.sql`);

const run = spawn("pg_dump", ["--dbname", databaseUrl, "--format=plain", "--no-owner", "--file", outputPath], {
  stdio: "inherit",
});

const exitCode = await new Promise((resolveExit) => {
  run.on("close", resolveExit);
  run.on("error", () => resolveExit(1));
});

if (exitCode !== 0) {
  console.error("Falha no backup. Verifique se o pg_dump está instalado e no PATH.");
  process.exit(Number(exitCode) || 1);
}

try {
  await access(outputPath, fsConstants.R_OK);
} catch {
  console.error("Backup não encontrado após execução do pg_dump.");
  process.exit(1);
}

if (mirrorDir) {
  const resolvedMirrorDir = resolve(process.cwd(), mirrorDir);
  await mkdir(resolvedMirrorDir, { recursive: true });
  const mirrorPath = resolve(resolvedMirrorDir, basename(outputPath));
  await copyFile(outputPath, mirrorPath);
  console.log(`Backup espelhado em: ${mirrorPath}`);
}

if (retentionMs > 0) {
  const now = Date.now();
  const files = await readdir(backupsDir);
  for (const file of files) {
    if (!file.startsWith("backup-") || !file.endsWith(".sql")) continue;
    const fullPath = resolve(backupsDir, file);
    const details = await stat(fullPath);
    if (now - details.mtimeMs > retentionMs) {
      await rm(fullPath, { force: true });
      console.log(`Backup removido por retenção: ${file}`);
    }
  }
}

console.log(`Backup concluído com sucesso: ${outputPath}`);
