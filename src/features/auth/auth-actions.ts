import { z } from "zod";

import { siteUrl } from "@/lib/site";
import { supabase } from "@/lib/supabase";

export type AuthResult = {
  error?: string;
  message?: string;
};

const emailSchema = z.string().trim().email("Enter a valid email address.");

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

const signUpSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be 72 characters or fewer."),
});

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const parsed = signInSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  return error ? { error: error.message } : {};
}

export async function signUp(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName ?? "" },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return {
      message: "Check your email to confirm your account, then log in.",
    };
  }

  return {};
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}
