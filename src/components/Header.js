'use client';
import Image from 'next/image';

export default function Header() {
  const handlePhoneClick = () => {
    navigator.clipboard.writeText('0870-2970125');
    alert('Phone number copied to clipboard!');
  };

  return (
    <header className="bg-gradient-to-r from-blue-50 to-white py-5 px-4 md:px-6 shadow-md rounded-lg mx-2 mt-1">
      {/* Desktop View */}
      <div className="hidden md:flex items-center justify-between h-full">
        
        {/* Left Section with Logos */}
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 p-1 rounded-lg">
            <Image 
              src="/assets/Naac_A+.png" 
              alt="NAAC Logo" 
              width={56} height={56}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>
          
          <div className="bg-blue-100 p-1 rounded-lg">
            <Image 
              src="/assets/ku-logo.png" 
              alt="KU Logo" 
              width={56} height={56}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>
          
          <div className="bg-blue-100 p-1 rounded-lg">
            <Image 
              src="/assets/kakatiya-kala-thoranam.png" 
              alt="Kakatiya Kala Thoranam" 
              width={56} height={56}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>
        </div>

        {/* Center Title Block */}
        <div className="text-center flex-1 px-2">
          <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-[#0d47a1] m-0 leading-none">
            KU COLLEGE OF ENGINEERING AND TECHNOLOGY
          </h2>
          <h3 className="text-base md:text-lg lg:text-xl font-semibold text-[#1565c0] mt-0.5 mb-0 leading-tight">
            KAKATIYA UNIVERSITY
          </h3>
          <p className="text-xs md:text-sm text-[#444] mt-0 mb-0">
            Warangal - 506009
          </p>
        </div>
        
        {/* Right Side Block */}
        <div className="flex items-start gap-2 h-full">
          <div className="bg-blue-100 p-1 rounded-lg">
            <Image 
              src="/assets/rudramadevi_statue.jpg" 
              alt="Rudramadevi Statue" 
              width={56} height={56}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>
          
          <div className="bg-blue-100 p-1 rounded-lg">
            <Image 
              src="/assets/ku-college-logo.png" 
              alt="College Logo" 
              width={56} height={56}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>
          
          <div className="flex flex-col justify-center h-full py-0.5">
            <div className="text-[11px] lg:text-[12px] text-[#333] leading-tight">
              <p className="m-0"><b>PGECET:</b> KUWL1</p>
              <p className="m-0"><b>EAPCET:</b> KUWL</p>
              <p className="m-0"><b>ECET:</b> KUWL</p>
            </div>
            
            {/* Contact Number */}
            <p 
              onClick={handlePhoneClick}
              className="text-[12px] text-[#e91e63] font-bold cursor-pointer hover:text-pink-700 transition-colors whitespace-nowrap mt-1 leading-none"
              title="Click to copy phone number"
            >
              ☎️ 0870-2970125
            </p>
          </div>
        </div>
      </div>

      {/* Mobile View */}
      <div className="md:hidden">
        {/* Top Row - Logos */}
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <div className="bg-blue-100 p-1 rounded-lg">
            <Image 
              src="/assets/Naac_A+.png" 
              alt="NAAC Logo" 
              width={40} height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>
          <div className="bg-blue-100 p-1 rounded-lg">
            <Image 
              src="/assets/ku-logo.png" 
              alt="KU Logo" 
              width={40} height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>
          <div className="bg-blue-100 p-1 rounded-lg">
            <Image 
              src="/assets/ku-college-logo.png" 
              alt="College Logo" 
              width={40} height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>
        </div>

        {/* Title Block */}
        <div className="text-center mb-1.5">
          <h2 className="text-sm font-bold text-[#0d47a1] m-0 leading-tight">
            KU COLLEGE OF ENGINEERING AND TECHNOLOGY
          </h2>
          <h3 className="text-xs font-semibold text-[#1565c0] mt-0.5 mb-0">
            KAKATIYA UNIVERSITY
          </h3>
          <p className="text-[10px] text-[#444] mt-0 mb-0">
            Warangal - 506009
          </p>
        </div>

        {/* Contact & Codes Row */}
        <div className="flex items-center justify-between text-[10px] border-t border-blue-100 pt-1 mt-1">
          <div className="text-[#333]">
            <span><b>PGECET:</b> KUWL1</span>
            <span className="mx-1">|</span>
            <span><b>EAPCET:</b> KUWL</span>
            <span className="mx-1">|</span>
            <span><b>ECET:</b> KUWL</span>
          </div>
          <p 
            onClick={handlePhoneClick}
            className="text-[#e91e63] font-bold cursor-pointer m-0"
            title="Click to copy phone number"
          >
            ☎️ 0870-2970125
          </p>
        </div>
      </div>
    </header>
  );
}