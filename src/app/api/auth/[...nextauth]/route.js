import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google";
import { getDb } from "@/lib/db";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account.provider === "google") {
        if (!profile.email_verified) {
          return false; // Do not allow login if email is not verified
        }

        const db = getDb();
        // Check if a clerk with this email exists
        const [clerks] = await db.execute(
          'SELECT id, name, email, role, is_active FROM clerks WHERE email = ?',
          [profile.email]
        );
        console.log('Google Sign-in: Profile Email:', profile.email);

        if (clerks.length > 0) {
          const clerk = clerks[0];
          console.log('Google Sign-in: Clerk Found:', clerk.email, 'Role:', clerk.role, 'Active:', clerk.is_active);
          // If the clerk exists and is active, allow sign-in
          return clerk.is_active ? true : '/api/auth/error?error=ClerkInactive'; // Return redirect URL with error
        } else {
          // If the clerk does not exist, do not allow sign-in
          return '/api/auth/error?error=ClerkNotFound'; // Return redirect URL with error
        }
      }
      return '/api/auth/error?error=GoogleAuthError'; // General error for other providers or unexpected issues
    },
    async jwt({ token, user, account, profile }) {
      // This is called after a successful sign-in
      if (account?.provider === "google" && profile) {
        const db = getDb();
        const [clerks] = await db.execute('SELECT id, name, role FROM clerks WHERE email = ?', [profile.email]);
        if (clerks.length > 0) {
          const clerk = clerks[0];
          token.id = clerk.id;
          token.name = clerk.name;
          token.role = clerk.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Add custom properties to the session object
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
    async redirect({ url, baseUrl, token }) {
      return url;
    }
  },
  secret: process.env.JWT_SECRET,
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
