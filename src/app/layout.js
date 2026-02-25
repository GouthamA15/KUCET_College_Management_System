import "./globals.css";
import { Toaster } from 'react-hot-toast';
import AuthProvider from "./components/AuthProvider";

export const metadata = {
  title: "Login | KUCET",
  description: "KU College of Engineering and Technology - A premier engineering institution affiliated with Kakatiya University, Warangal",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <Toaster position="top-center" reverseOrder={false} />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
