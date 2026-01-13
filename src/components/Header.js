'use client';

export default function Header() {
  const handlePhoneClick = () => {
    navigator.clipboard.writeText('0870-2970125');
    alert('Phone number copied to clipboard!');
  };

  return (
    <header className="bg-gradient-to-r from-blue-50 to-white py-2.5 px-4 md:px-8 shadow-md rounded-lg mx-2 mt-2">
      {/* Desktop View */}
      <div className="hidden md:flex items-center justify-between">
        
        {/* Left Section with Logos */}
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 p-1.5 rounded-lg">
            <img 
              src="/assets/Naac_A+.png" 
              alt="NAAC Logo" 
              className="h-14 w-auto object-contain"
            />
          </div>
          
          <div className="bg-blue-100 p-1.5 rounded-lg">
            <img 
              src="/assets/ku-logo.png" 
              alt="KU Logo" 
              className="h-14 w-auto object-contain"
            />
          </div>
          
          <div className="bg-blue-100 p-1.5 rounded-lg">
            <img 
              src="/assets/kakatiya-kala-thoranam.png" 
              alt="Kakatiya Kala Thoranam" 
              className="h-14 w-auto object-contain"
            />
          </div>
        </div>

        {/* Center Title Block */}
        <div className="text-center flex-1 px-4">
          <h2 className="text-lg md:text-2xl lg:text-[30px] font-bold text-[#0d47a1] m-0 leading-tight">
            KU COLLEGE OF ENGINEERING AND TECHNOLOGY
          </h2>
          <h3 className="text-base md:text-xl lg:text-2xl font-semibold text-[#1565c0] mt-1 mb-0">
            KAKATIYA UNIVERSITY
          </h3>
          <p className="text-sm md:text-lg text-[#444] mt-0.5 mb-0">
            Warangal - 506009
          </p>
        </div>
        
        {/* Right Side Block */}
        <div className="flex items-start gap-2">
          <div className="bg-blue-100 p-1.5 rounded-lg">
            <img 
              src="/assets/rudramadevi_statue.jpg" 
              alt="Rudramadevi Statue" 
              className="h-14 w-auto object-contain"
            />
          </div>
          
          <div className="bg-blue-100 p-1.5 rounded-lg">
            <img 
              src="/assets/ku-college-logo.png" 
              alt="College Logo" 
              className="h-14 w-auto object-contain"
            />
          </div>
          
          <div className="flex flex-col justify-between h-full">
            <div className="text-[13px] text-[#333]">
              <p className="m-0"><b>PGECET:</b> KUWL1</p>
              <p className="m-0"><b>EAPCET:</b> KUWL</p>
              <p className="m-0"><b>ECET:</b> KUWL</p>
            </div>
            
            {/* Contact Number */}
            <p 
              onClick={handlePhoneClick}
              className="text-[13px] text-[#e91e63] font-bold cursor-pointer hover:text-pink-700 transition-colors whitespace-nowrap mt-2"
              title="Click to copy phone number"
            >
              ☎️ Contact: 0870-2970125
            </p>
          </div>
        </div>
      </div>

      {/* Mobile View */}
      <div className="md:hidden">
        {/* Top Row - Logos */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="bg-blue-100 p-1 rounded-lg">
            <img 
              src="/assets/Naac_A+.png" 
              alt="NAAC Logo" 
              className="h-10 w-auto object-contain"
            />
          </div>
          <div className="bg-blue-100 p-1 rounded-lg">
            <img 
              src="/assets/ku-logo.png" 
              alt="KU Logo" 
              className="h-10 w-auto object-contain"
            />
          </div>
          <div className="bg-blue-100 p-1 rounded-lg">
            <img 
              src="/assets/ku-college-logo.png" 
              alt="College Logo" 
              className="h-10 w-auto object-contain"
            />
          </div>
        </div>

        {/* Title Block */}
        <div className="text-center mb-2">
          <h2 className="text-base font-bold text-[#0d47a1] m-0 leading-tight">
            KU COLLEGE OF ENGINEERING AND TECHNOLOGY
          </h2>
          <h3 className="text-sm font-semibold text-[#1565c0] mt-1 mb-0">
            KAKATIYA UNIVERSITY
          </h3>
          <p className="text-xs text-[#444] mt-0.5 mb-0">
            Warangal - 506009
          </p>
        </div>

        {/* Contact & Codes Row */}
        <div className="flex items-center justify-between text-[11px] border-t border-blue-100 pt-2 mt-2">
          <div className="text-[#333]">
            <span><b>PGECET:</b> KUWL1</span>
            <span className="mx-2">|</span>
            <span><b>EAPCET:</b> KUWL</span>
            <span className="mx-2">|</span>
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
