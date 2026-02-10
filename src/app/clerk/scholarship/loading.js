export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <img src="/assets/ku-logo.png" alt="KUCET logo" style={{ width: 160, height: 'auto' }} />
        <div className="mt-4 flex items-center justify-center" aria-hidden>
          <svg width="40" height="40" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="25" cy="25" r="20" stroke="#cbd5e1" strokeWidth="5" />
            <g>
              <path d="M45 25a20 20 0 0 1-20 20" stroke="#0b3578" strokeWidth="5" strokeLinecap="round" />
              <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
            </g>
          </svg>
        </div>
        <p className="text-gray-700 mt-4">Loading profile…</p>
      </div>
    </div>
  );
}
