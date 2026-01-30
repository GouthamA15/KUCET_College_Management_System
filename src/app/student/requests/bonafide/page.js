'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function BonafideRequestPage() {
  const router = useRouter();

  // Mock data - Replace with API fetch
  const [requests, setRequests] = useState([
    {
      id: 1,
      requestDate: '2024-01-15',
      purpose: 'Scholarship Application',
      status: 'Approved', // Options: 'Pending', 'Approved', 'Rejected'
      downloadUrl: '#'
    },
    {
      id: 2,
      requestDate: '2024-02-10',
      purpose: 'Bus Pass',
      status: 'Pending',
      downloadUrl: null
    }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [purpose, setPurpose] = useState('');

  const handleRequest = (e) => {
    e.preventDefault();
    // API Call to create request goes here
    const newRequest = {
      id: requests.length + 1,
      requestDate: new Date().toISOString().split('T')[0],
      purpose: purpose,
      status: 'Pending',
      downloadUrl: null
    };
    
    setRequests([newRequest, ...requests]);
    setIsModalOpen(false);
    setPurpose('');
    toast.success('Bonafide certificate requested successfully!');
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Navbar 
        studentProfileMode={true} 
        isSubPage={true}
        activeTab="requests"
        onLogout={async () => {
          await fetch('/api/student/logout', { method: 'POST' });
          router.replace('/');
        }}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bonafide Certificate</h1>
            <p className="mt-2 text-sm text-gray-600">Request and manage your bonafide certificates</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#0b3578] hover:bg-[#082452] text-white px-6 py-2.5 rounded-lg shadow-md transition-all duration-200 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Request
          </button>
        </div>

        {/* Requests List */}
        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Purpose</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.requestDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{request.purpose}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {request.status === 'Approved' ? (
                        <a
                          href={request.downloadUrl}
                          className="text-[#0b3578] hover:text-blue-800 font-semibold flex items-center justify-end"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </a>
                      ) : (
                        <span className="text-gray-400 cursor-not-allowed flex items-center justify-end">
                           <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Processing
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {requests.length === 0 && (
              <div className="text-center py-10 text-gray-500">
                No requests found. Start by creating a new request.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Request Bonafide Certificate</h3>
            <form onSubmit={handleRequest}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Purpose of Certificate</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scholarship, Bus Pass, Visa"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b3578] focus:border-transparent outline-none transition-all"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0b3578] hover:bg-[#082452] text-white rounded-lg shadow-md transition-colors"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}