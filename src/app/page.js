import Hero from '@/components/Hero';
import AboutSection from '@/components/AboutSection';
import Header from '@/components/Header';
import HeaderMobileView from '@/components/Header-MobileView';
import Footer from '@/app/components/Footer/Footer';
import ClientShell from '@/components/ClientShell.client';

export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const error = Array.isArray(sp?.error) ? sp.error[0] : sp?.error ?? null;
  const login = sp?.login === 'true' ? 'clerk' : null;

  const isTesting = process.env.NEXT_PUBLIC_WORKING_ENV === 'testing';

  return (
    <div className="min-h-screen bg-white relative">
      {isTesting && (
        <a
          href="/dev/time-machine"
          className="fixed top-0 left-0 z-[9999] bg-red-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-br-lg shadow-lg uppercase tracking-widest animate-pulse hover:bg-red-700 hover:scale-105 transition-all flex items-center gap-2 group"
          title="Open Time Machine"
        >
          <span>Testing Mode</span>
          <span className="bg-white/20 px-1.5 rounded text-[8px] group-hover:bg-white/40">Travel 🕒</span>
        </a>
      )}

      {/* Institutional Header */}
      <Header fixed={false} />
      <HeaderMobileView />

      {/* Client-side shell: navbar (sticky), login panels and toasts */}
      <ClientShell serverError={error} stickyNavbar={false} initialPanel={login} />

      {/* Main server-rendered content. */}
      <div id="main-content" className="transition-all duration-500 ease-out opacity-100 flex flex-col min-h-screen">
        <div className="grow">
          <Hero />
          <AboutSection />
        </div>
        <Footer />
      </div>
    </div>
  );
}
