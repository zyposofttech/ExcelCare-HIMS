import { BadRequestException } from "@nestjs/common";

/**
 * Room Code Rules (Hospital reality):
 * - Allow alphanumeric room codes with sane constraints
 * - Normalize to UPPERCASE
 * - Allow hyphen (-) and underscore (_)
 * - Length: 2..32
 *
 * Valid examples: TH01, OT-1, LAB1, TR1, 101, R101
 * Invalid examples: "", "A", "OT@1", "  ", "--", "_A"
 */

export function normalizeRoomCode(input: unknown): string {
  return String(input ?? "")
    .trim()
    .toUpperCase();
}

export function assertValidRoomCode(input: unknown): string {
  const code = normalizeRoomCode(input);

  if (!code) throw new BadRequestException("Room code is required.");

  if (code.length < 2 || code.length > 32) {
    throw new BadRequestException(`Invalid Room code "${code}". Use 2–32 characters.`);
  }

  // Must start with A-Z or 0-9, then allow A-Z 0-9 _ -
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
    throw new BadRequestException(
      `Invalid Room code "${code}". Allowed: A–Z, 0–9, underscore (_) and hyphen (-).`,
    );
  }

  return code;
}
