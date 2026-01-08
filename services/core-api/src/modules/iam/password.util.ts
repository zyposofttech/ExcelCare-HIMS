import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function validatePassword(pw: string): string[] {
  const errors: string[] = [];
  if (!pw || typeof pw !== "string") return ["Password is required."];
  if (pw.length < 10) errors.push("Minimum length is 10.");
  if (/\s/.test(pw)) errors.push("No spaces allowed.");
  if (!/[0-9]/.test(pw)) errors.push("Must include at least 1 number.");
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pw)) errors.push("Must include at least 1 special character.");
  return errors;
}

export function generateTempPassword(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const specials = "!@#$%^&*";
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];

  let pw = "";
  pw += pick(letters);
  pw += pick(numbers);
  pw += pick(specials);

  const rest = 12; // total will be 15
  const all = letters + numbers + specials;
  for (let i = 0; i < rest; i++) pw += pick(all);

  // shuffle
  const arr = pw.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    
    // FIX: Changed required length from 7 to 6
    if (parts.length !== 6) return false; 
    
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    
    // FIX: Changed indices from 5/6 to 4/5
    const salt = Buffer.from(parts[4], "base64"); 
    const key = Buffer.from(parts[5], "base64");
    
    const derived = scryptSync(pw, salt, key.length, { N, r, p });
    return timingSafeEqual(key, derived);
  } catch {
    return false;
  }
}