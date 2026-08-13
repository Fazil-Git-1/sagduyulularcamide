import { createServerFn } from "@tanstack/react-start";
import {
  pinSchema,
  scoreSchema,
  renameSchema,
  toggleSchema,
  addTeamSchema,
  resetSchema,
} from "./contest.schemas";

export const verifyPin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pinSchema.parse(d))
  .handler(async ({ data }) => {
    const { isValidPin } = await import("./pins.server");
    return { ok: isValidPin(data.role, data.pin) };
  });

export const saveScore = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => scoreSchema.parse(d))
  .handler(async ({ data }) => {
    const { assertPin } = await import("./pins.server");
    assertPin("captain", data.pin);
    const { PRAYERS } = await import("./contest");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const counts = {
      fajr_count: data.fajr_count,
      isha_count: data.isha_count,
      ishraq_count: data.ishraq_count,
    };
    const score = PRAYERS.reduce((sum, p) => sum + counts[p.key] * p.points, 0);
    const { error } = await supabaseAdmin
      .from("scores")
      .upsert({ team_id: data.team_id, date: data.date, ...counts, score }, {
        onConflict: "team_id,date",
      });
    if (error) throw new Error(error.message);
    return { score };
  });

export const renameTeam = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => renameSchema.parse(d))
  .handler(async ({ data }) => {
    const { assertPin } = await import("./pins.server");
    assertPin("admin", data.pin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("teams")
      .update({ name: data.name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTeamActive = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => toggleSchema.parse(d))
  .handler(async ({ data }) => {
    const { assertPin } = await import("./pins.server");
    assertPin("admin", data.pin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("teams")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addTeam = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => addTeamSchema.parse(d))
  .handler(async ({ data }) => {
    const { assertPin } = await import("./pins.server");
    assertPin("admin", data.pin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("teams").insert({ name: data.name });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetSystem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => resetSchema.parse(d))
  .handler(async ({ data }) => {
    const { assertPin } = await import("./pins.server");
    assertPin("admin", data.pin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const del = await supabaseAdmin.from("scores").delete().not("id", "is", null);
    if (del.error) throw new Error(del.error.message);
    await supabaseAdmin.from("teams").update({ total_score: 0 }).not("id", "is", null);
    const upd = await supabaseAdmin
      .from("contest_settings")
      .update({ start_date: data.start_date })
      .eq("id", 1);
    if (upd.error) throw new Error(upd.error.message);
    return { ok: true };
  });
