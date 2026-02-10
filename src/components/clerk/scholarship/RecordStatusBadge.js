'use client';

export default function RecordStatusBadge({ state }) {
  const badgeClass = state === 'COMPLETED'
    ? 'bg-green-100 text-green-800'
    : state === 'PENDING'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-gray-100 text-gray-700';
  return (
    <span className={`px-2 py-1 text-xs rounded ${badgeClass}`}>{state}</span>
  );
}
