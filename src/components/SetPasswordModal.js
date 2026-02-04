// src/components/SetPasswordModal.js
// Placeholder for SetPasswordModal component
import React from 'react';

const SetPasswordModal = ({ rollno, email, onPasswordSet }) => {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-xl">
        <h2 className="text-xl font-bold mb-4">Set Your Password</h2>
        <p>This is a placeholder for the SetPasswordModal component.</p>
        <p>Roll No: {rollno}</p>
        <p>Email: {email}</p>
        <button
          onClick={onPasswordSet}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Close (Placeholder)
        </button>
      </div>
    </div>
  );
};

export default SetPasswordModal;