import { BadRequestException } from "@nestjs/common";
import type { Principal } from "./diagnostics.principal";
import { resolveBranchId as resolveBranchIdCommon } from "../../../common/branch-scope.util";

/**
 * Codes across infrastructure should accept realistic hospital codes:
 * TH01, OT-1, LAB1, XRAY-ROOM, etc.
 */
export const CODE_REGEX = /^[A-Z0-9][A-Z0-9-]{0,63}$/; // 1–64 chars

export function normalizeCode(input: unknown): string {
  return String(input ?? "").trim().toUpperCase();
}

export function assertCode(input: unknown, label: string): string {
  const code = normalizeCode(input);
  if (!code) throw new BadRequestException(`${label} code is required`);
  if (!CODE_REGEX.test(code)) {
    throw new BadRequestException(
      `${label} code must be 1–64 chars, letters/numbers/hyphen (e.g., TH01, OT-1, LAB1)`
    );
  }
  return code;
}

export function assertName(input: unknown, label: string, maxLen = 160): string {
  const v = String(input ?? "").trim();
  if (!v) throw new BadRequestException(`${label} name is required`);
  if (v.length > maxLen) throw new BadRequestException(`${label} name is too long`);
  return v;
}

export function resolveBranchId(principal: Principal, branchId?: string): string {
  return resolveBranchIdCommon(principal as any, branchId ?? null, { requiredForGlobal: true }) as string;
}

export function parseOptionalInt(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.trunc(input) : null;
  const s = String(input).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function parseOptionalFloat(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const s = String(input).trim();
  if (!s) return null;
  const m = s.match(/([0-9]+(\.[0-9]+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
