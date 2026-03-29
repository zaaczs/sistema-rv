/**
 * Ajusta a URL do Postgres para Prisma em serverless (Vercel + Supabase pooler):
 * menos conexões simultâneas, timeouts mais tolerantes.
 */
export function augmentDatabaseUrlForPooler(url: string | undefined): string {
  if (!url?.trim() || url.startsWith("file:")) return url ?? "";
  try {
    const u = new URL(url);
    const set = (k: string, v: string) => {
      if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    };
    set("connection_limit", "3");
    set("pool_timeout", "30");
    set("connect_timeout", "15");
    return u.toString();
  } catch {
    return url;
  }
}
