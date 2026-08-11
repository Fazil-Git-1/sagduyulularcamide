/** Server-only PIN verification. PINs never reach the client bundle. */
export type PinRole = "captain" | "admin";

function expected(role: PinRole): string {
  return role === "admin"
    ? (process.env["ADMIN_PIN"] ?? "3737")
    : (process.env["CAPTAIN_PIN"] ?? "5929");
}

export function isValidPin(role: PinRole, pin: string): boolean {
  return typeof pin === "string" && pin === expected(role);
}

export function assertPin(role: PinRole, pin: string): void {
  if (!isValidPin(role, pin)) {
    throw new Error("Geçersiz PIN.");
  }
}
