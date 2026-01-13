'use client';

export default function Footer() {
  return (
    <footer className="bg-gradient-to-r from-blue-900 to-blue-800 text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          
          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-bold mb-4">Contact Us</h3>
            <p className="text-blue-100 text-sm">
              KU College of Engineering and Technology<br />
              Kakatiya University<br />
              Warangal - 506009, Telangana<br />
              <br />
              Phone: 0870-2970125
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-blue-100 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Home</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Student Portal</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Admissions</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Departments</a></li>
            </ul>
          </div>

          {/* Admission Codes */}
          <div>
            <h3 className="text-lg font-bold mb-4">Admission Codes</h3>
            <div className="text-blue-100 text-sm space-y-1">
              <p><span className="font-semibold">PGECET:</span> KUWL1</p>
              <p><span className="font-semibold">EAPCET:</span> KUWL</p>
              <p><span className="font-semibold">ECET:</span> KUWL</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-blue-700 my-6"></div>

        {/* Bottom Footer */}
        <div className="text-center space-y-2">
          <p className="text-blue-100 text-sm">
            © 2026 All Rights Reserved
          </p>
          <p className="text-blue-200 text-sm font-medium">
            Developed by CSE and Data Science Students
          </p>
        </div>
      </div>
    </footer>
  );
}
