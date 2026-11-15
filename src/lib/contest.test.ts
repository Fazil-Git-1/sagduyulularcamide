import { describe, it, expect } from "vitest";
import { cycleInfo, earliestEditable, hijriLabel } from "./contest";

describe("aylık döngü", () => {
  it("30. günden sonra 1. güne geçer", () => {
    expect(cycleInfo("2026-11-15", "2026-12-14").day).toBe(30);
    const c = cycleInfo("2026-11-15", "2026-12-15");
    expect(c.day).toBe(1);
    expect(c.cycle).toBe(2);
  });
  it("önceki ay 5. güne kadar açık, 6. gün kapanır", () => {
    expect(earliestEditable("2026-11-15", "2026-12-19")).toBe("2026-11-15");
    expect(earliestEditable("2026-11-15", "2026-12-20")).toBe("2026-12-15");
  });
  it("15 Kasım 2026 = 6 Cemaziyelahir", () => {
    expect(hijriLabel("2026-11-15")).toBe("6 Cemaziyelahir");
  });
});
