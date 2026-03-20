import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/db";
import { clerks } from "@/db/schema";
import { eq } from "drizzle-orm";

const publicBaseUrlRaw = process.env.NEXT_PUBLIC_BASE_URL;
if (process.env.NODE_ENV === 'production' && publicBaseUrlRaw) {
  const publicBaseUrl = /^https?:\/\//i.test(publicBaseUrlRaw)
    ? publicBaseUrlRaw
    : `https://${publicBaseUrlRaw}`;
  process.env.NEXTAUTH_URL = publicBaseUrl;
  process.env.NEXTAUTH_URL_INTERNAL = publicBaseUrl;
}

export const authOptions = {
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      try {
        if (account.provider === "google") {
          if (!profile.email_verified) {
            return false; // Do not allow login if email is not verified
          }

          // Check if a clerk with this email exists
          const clerk = await db.query.clerks.findFirst({
            where: eq(clerks.email, profile.email),
            columns: {
                id: true,
                name: true,
                email: true,
                role: true,
                is_active: true
            }
          });
          console.log('Google Sign-in: Profile Email:', profile.email);

          if (clerk) {
            console.log('Google Sign-in: Clerk Found:', clerk.email, 'Role:', clerk.role, 'Active:', clerk.is_active);
            // If the clerk exists and is active, allow sign-in
            return clerk.is_active ? true : '/api/auth/error?error=ClerkInactive'; // Return redirect URL with error
          } else {
            // If the clerk does not exist, do not allow sign-in
            return '/api/auth/error?error=ClerkNotFound'; // Return redirect URL with error
          }
        }
        return '/api/auth/error?error=GoogleAuthError'; // General error for other providers or unexpected issues
      } catch (error) {
        console.error('SignIn Callback Error:', error);
        return '/api/auth/error?error=SignInError';
      }
    },
    async jwt({ token, user, account, profile }) {
      // This is called after a successful sign-in
      try {
        if (account?.provider === "google" && profile) {
          const clerk = await db.query.clerks.findFirst({
            where: eq(clerks.email, profile.email),
            columns: {
                id: true,
                name: true,
                role: true
            }
          });
          if (clerk) {
            token.id = clerk.id;
            token.name = clerk.name;
            token.role = clerk.role;
          }
        }
      } catch (error) {
        console.error('JWT Callback Error:', error);
      }
      return token;
    },
    async session({ session, token }) {
      // Add custom properties to the session object
      try {
        if (token?.id) {
          session.user.id = token.id;
        }
        if (token?.role) {
          session.user.role = token.role;
        }
      } catch (error) {
        console.error('Session Callback Error:', error);
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (!globalThis.__nextauth_redirect_logged) {
        globalThis.__nextauth_redirect_logged = true;
        console.log('[NEXTAUTH_REDIRECT]', {
          url,
          baseUrl,
          NEXTAUTH_URL: process.env.NEXTAUTH_URL,
          NEXTAUTH_URL_INTERNAL: process.env.NEXTAUTH_URL_INTERNAL,
          NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
          NODE_ENV: process.env.NODE_ENV,
        });
      }
      const preferredBase = process.env.NEXT_PUBLIC_BASE_URL || baseUrl;
      const normalizedBase = preferredBase.replace(/\/$/, '');
      if (url.startsWith('/')) {
        return `${normalizedBase}${url}`;
      }
      if (url.startsWith(normalizedBase)) {
        return url;
      }
      return normalizedBase;
    }
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.JWT_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: '/', // Redirect users to homepage for error
    error: '/', // Redirect users to homepage on error
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
