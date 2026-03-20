import "./globals.css";
import { Toaster } from 'react-hot-toast';
import AuthProvider from "./components/AuthProvider";
import { AssetProvider } from "@/context/AssetContext";
import CapacitorHandler from "@/components/CapacitorHandler.client";
import RealtimeListener from "@/components/RealtimeListener";

export const metadata = {
  title: "Login | KUCET",
  description: "KU College of Engineering and Technology - A premier engineering institution affiliated with Kakatiya University, Warangal",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KUCET CMS",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b3578",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        <CapacitorHandler />
        <RealtimeListener />
        <AssetProvider>
          <AuthProvider>
            <Toaster position="top-center" reverseOrder={false} />
            {children}
          </AuthProvider>
        </AssetProvider>
      </body>
    </html>
  );
}
