import "./globals.css";
import AuthGuard from "./components/AuthGuard";

export const metadata = {
  title: "KUCET - KU College of Engineering and Technology",
  description: "KU College of Engineering and Technology - A premier engineering institution affiliated with Kakatiya University, Warangal",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
