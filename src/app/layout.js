import "./globals.css";
import { Toaster } from 'react-hot-toast';
import AuthProvider from "./components/AuthProvider";
import { AssetProvider } from "@/context/AssetContext";
import { SystemConfigProvider } from "@/context/SystemConfigContext";
import MaintenanceGuard from "@/components/MaintenanceGuard";

export const metadata = {
  title: "Login | KUCET",
  description: "KU College of Engineering and Technology - A premier engineering institution affiliated with Kakatiya University, Warangal",
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
      <body className="antialiased bg-institutional min-h-screen">
        <SystemConfigProvider>
          <MaintenanceGuard>
            <AssetProvider>
              <AuthProvider>
                <Toaster position="top-center" reverseOrder={false} />
                {children}
              </AuthProvider>
            </AssetProvider>
          </MaintenanceGuard>
        </SystemConfigProvider>
      </body>
    </html>
  );
}
