// Apple Health from the iOS app: POST { samples, deleted } (src/server/appleHealth.ts). The app sends the session
// cookie its WebView signed in with, so this is the same user and the same check as every other route.
import { revalidatePath } from "next/cache";
import { AppleBatch, ingestAppleHealth } from "@/server/appleHealth";
import { DEMO_EMAIL, requestUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { ctxOf } from "@/server/queries/common";

const fail = (status: number, error: string) =>
  Response.json({ error }, { status });

export async function POST(req: Request) {
  const user = await requestUser(req);
  if (!user) return fail(401, "signed_out");
  // The shared demo account is public: nobody's own health data goes into it.
  if (user.email === DEMO_EMAIL) return fail(403, "demo");
  const body = AppleBatch.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(400, "bad_request");
  const db = getDb();
  const ctx = await ctxOf(db, user.userId).catch(() => null);
  if (!ctx) return fail(409, "profile");
  const r = await ingestAppleHealth(
    db,
    user.userId,
    body.data,
    ctx.timeZone,
    Math.floor(Date.now() / 1000),
  );
  if (r.written || r.deleted) {
    revalidatePath("/health", "layout");
    revalidatePath("/journal", "layout");
  }
  return Response.json(r);
}
