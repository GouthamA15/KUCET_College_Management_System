/**
 * Common status styles for badges and text
 */
export function getStatusStyles(status) {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'APPROVED':
      return 'bg-[#ecfdf3] text-[#166534] border-[#166534]';
    case 'PENDING':
      return 'bg-[#fff7ed] text-[#b45309] border-[#b45309]';
    case 'REJECTED':
      return 'bg-[#fef2f2] text-[#991b1b] border-[#991b1b]';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * Standard loading spinner component (to be used in client components)
 * Note: Since this is a utility file, we only export the class names or a functional component if needed.
 */
export const SPINNER_CLASSES = "animate-spin h-6 w-6 text-indigo-600 mr-3";
