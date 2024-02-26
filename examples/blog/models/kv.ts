export function openKv(): Promise<Deno.Kv> {
  return Deno.openKv(Deno.env.get("KV_URL"));
}
