import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  clearLoginFailures,
  getLoginBlockStatus,
  registerLoginFailure,
} from "@/lib/login-attempt-guard";

const isProduction = process.env.NODE_ENV === "production";
const DUMMY_PASSWORD_HASH = "$2b$10$.H3jYz4LdaKso/0Igiw6wes2UJYax63fZx4BCeM8p9NsMBUfOtRh6";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fallback em desenvolvimento quando .env não tem NEXTAUTH_SECRET
if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV !== "production") {
  process.env.NEXTAUTH_SECRET = "dev-secret-sistema-rv";
}
if (!process.env.NEXTAUTH_URL && process.env.NODE_ENV !== "production") {
  process.env.NEXTAUTH_URL = "http://localhost:3000";
}
if (isProduction && !process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET ausente em produção.");
}
if (isProduction && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL ausente em produção.");
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const normalizedEmail = normalizeEmail(credentials.email);

        const blocked = getLoginBlockStatus(normalizedEmail);
        if (blocked.blocked) {
          await wait(400);
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user) {
          await bcrypt.compare(credentials.password, DUMMY_PASSWORD_HASH);
          registerLoginFailure(normalizedEmail);
          await wait(250);
          return null;
        }
        const ok = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );
        if (!ok) {
          registerLoginFailure(normalizedEmail);
          await wait(250);
          return null;
        }

        clearLoginFailures(normalizedEmail);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60,
    updateAge: 60 * 60,
  },
  debug: false,
  secret: process.env.NEXTAUTH_SECRET,
};
