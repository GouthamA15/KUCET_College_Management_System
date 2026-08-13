import "./globals.css";
import { Toaster } from 'react-hot-toast';
import { AssetProvider } from "@/context/AssetContext";
import { SystemConfigProvider } from "@/context/SystemConfigContext";
import MaintenanceGuard from "@/components/MaintenanceGuard";
import CookieBanner from "@/components/CookieBanner";
import PwaRegister from "@/components/PwaRegister";
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: "KUCET Management System",
  description: "KU College of Engineering and Technology - Comprehensive Academic & Management Portal",
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
      <body className={`${inter.className} antialiased bg-institutional min-h-screen`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:font-medium focus:rounded-lg focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>
        <PwaRegister />
        <SystemConfigProvider>
          <MaintenanceGuard>
            <AssetProvider>
              <Toaster position="top-center" reverseOrder={false} />
              <div id="main-content" tabIndex={-1}>
                {children}
              </div>
              <CookieBanner />
            </AssetProvider>
          </MaintenanceGuard>
        </SystemConfigProvider>
      </body>
    </html>
  );
}
