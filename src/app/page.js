import Header from '@/components/Header';
import HeaderMobileView from '@/components/Header-MobileView';
import HomeLoginLanding from '@/components/HomeLoginLanding.client';
import Footer from '@/app/components/Footer/Footer';

export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const error = Array.isArray(sp?.error) ? sp.error[0] : sp?.error ?? null;
  const login = sp?.login === 'true' ? 'staff' : 'student';

  const isTesting = process.env.NEXT_PUBLIC_WORKING_ENV === 'testing';

  return (
    <div className="min-h-screen bg-slate-50 relative flex flex-col">
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

      {/* Direct Login Landing (Student / Staff) */}
      <div className="grow">
        <HomeLoginLanding serverError={error} initialPanel={login} />
      </div>

      <Footer />
    </div>
  );
}
