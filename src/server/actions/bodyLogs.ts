"use server";
// Blood pressure, labs and strength sessions: session-checked here, validated and written in ../bodyLogs.ts.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser, SIGNED_OUT } from "../auth";
import { addBp, addLabs, addStrength, deleteBodyLog, type BpInput, type LabInput, type StrengthInput } from "../bodyLogs";
import { getDb } from "../db";
import { userTimeZone } from "../profile";
import type { ActionResult } from "./journal";
import { t as tr } from "@/lib/i18n"

const now = () => Math.floor(Date.now() / 1000);

async function ctx() {
  const user = await currentUser();
  if (!user) return null;
  return { userId: user.userId, tz: (await userTimeZone(getDb(), user.userId)) ?? "UTC" };
}

export async function logBloodPressure(input: BpInput): Promise<ActionResult<{ id: string }>> {
  const c = await ctx();
  if (!c) return SIGNED_OUT;
  const r = await addBp(getDb(), c.userId, input, c.tz, now());
  if (r.ok) revalidatePath("/health", "layout");
  return r;
}

export async function logLabResults(input: LabInput): Promise<ActionResult<{ count: number }>> {
  const c = await ctx();
  if (!c) return SIGNED_OUT;
  const r = await addLabs(getDb(), c.userId, input, c.tz, now());
  if (r.ok) revalidatePath("/health", "layout");
  return r;
}

export async function logStrengthSession(input: StrengthInput): Promise<ActionResult<{ id: string }>> {
  const c = await ctx();
  if (!c) return SIGNED_OUT;
  const r = await addStrength(getDb(), c.userId, input, c.tz, now());
  if (r.ok) {
    revalidatePath("/strength");
    revalidatePath("/strain");
  }
  return r;
}

const Delete = z.object({ kind: z.enum(["bp", "lab", "strength"]), id: z.uuid() });

export async function deleteBodyLogEntry(input: z.input<typeof Delete>): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return SIGNED_OUT;
  const r = Delete.safeParse(input);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const gone = await deleteBodyLog(getDb(), c.userId, r.data.kind, r.data.id);
  if (!gone) return { ok: false, error: tr("Already deleted") };
  revalidatePath(r.data.kind === "strength" ? "/strength" : "/health", "layout");
  return { ok: true, data: undefined };
}
