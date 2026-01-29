import React from 'react';
import DuesSection from './DuesSection';

const TuitionFeeStatus = ({ fees, academicYear, totalExpectedFee }) => {
  const totalClearedFee = fees.reduce((acc, fee) => acc + fee.amount, 0);
  const pendingFee = totalExpectedFee - totalClearedFee;

  const hasPendingFees = pendingFee > 0;
  const feeStatus = hasPendingFees ? 'pending' : 'paid';

  return (
    <DuesSection title="Tuition & Other Fees" status={feeStatus}>
      <div className="mb-4 p-4 bg-gray-50 rounded-md border border-gray-200">
        <div className="flex justify-between items-center text-lg font-semibold text-gray-800 mb-2">
          <span>Total Expected Fee:</span>
          <span>₹ {totalExpectedFee.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between items-center text-lg font-semibold text-green-700 mb-2">
          <span>Total Cleared Fee:</span>
          <span>₹ {totalClearedFee.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between items-center text-lg font-semibold text-red-600">
          <span>Pending Fee:</span>
          <span>₹ {pendingFee.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {fees.length > 0 ? (
        <ul className="divide-y divide-gray-200">
          {fees.map((fee) => (
            <li key={fee.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-semibold">{`Year ${fee.year} - Challan No: ${fee.challan_no}`}</p>
                <p className="text-sm text-gray-500">{`Date: ${new Date(fee.date).toLocaleDateString()}`}</p>
              </div>
              <p className="font-semibold text-gray-800">{`₹ ${fee.amount.toLocaleString('en-IN')}`}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">No fee transactions found for the current academic year ({academicYear}).</p>
      )}
    </DuesSection>
  );
};

export default TuitionFeeStatus;
