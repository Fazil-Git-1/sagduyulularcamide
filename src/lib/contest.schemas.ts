import { z } from "zod";

export const pinSchema = z.object({
  role: z.enum(["captain", "admin"]),
  pin: z.string().regex(/^\d{4}$/),
});

export const scoreSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
  team_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fajr_count: z.number().int().min(0).max(10000),
  isha_count: z.number().int().min(0).max(10000),
  ishraq_count: z.number().int().min(0).max(10000),
});

export const renameSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
});

export const toggleSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
  id: z.string().uuid(),
  is_active: z.boolean(),
});

export const addTeamSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
  name: z.string().trim().min(1).max(60),
});

export const resetSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
