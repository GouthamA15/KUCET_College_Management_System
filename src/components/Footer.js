'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gradient-to-r from-blue-900 to-blue-800 text-white py-2">
      <div className="max-w-6xl mx-auto px-4 sm:px-3 lg:px-5">
        

        {/* Divider */}
        {/* <div className="border-t border-blue-700 my-6"></div> */}

        {/* Bottom Footer */}
        <div className="text-center ">
          <p className="text-blue-50 text-sm">
            © 2026. All rights reserved. Developed by the Department of Computer Science & Engineering.
            <Link href="/developers" className="ml-2 underline hover:text-white transition-colors duration-200 text-blue-200">
              View more details
            </Link>
          </p>

        </div>
      </div>
    </footer>
  );
}
