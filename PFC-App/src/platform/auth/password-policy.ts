import { z } from "zod";

/** Mockup 5 / 99 password rules: ≥ 8 chars, a number, a letter. */
export const PASSWORD_RULES = [
  { id: "len", label: "Ít nhất 8 ký tự", test: (p: string) => p.length >= 8 },
  { id: "num", label: "Có ít nhất một chữ số", test: (p: string) => /\d/.test(p) },
  { id: "letter", label: "Có ít nhất một chữ cái", test: (p: string) => /\p{L}/u.test(p) },
] as const;

export const passwordSchema = z
  .string()
  .max(200, "Mật khẩu quá dài.")
  .refine((p) => PASSWORD_RULES.every((r) => r.test(p)), {
    message: "Mật khẩu cần ít nhất 8 ký tự, gồm chữ và số.",
  });
