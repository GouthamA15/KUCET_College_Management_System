export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-center">
        <div className="w-full bg-white shadow-xl rounded-lg p-6 overflow-hidden border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
            {/* Header Card Skeleton */}
            <div className="flex flex-col items-center border border-slate-100 rounded-lg p-6 bg-slate-50/50">
              <div className="w-32 h-32 rounded-full skeleton-shimmer mb-4"></div>
              <div className="h-6 w-3/4 skeleton-shimmer rounded mb-2"></div>
              <div className="h-4 w-1/2 skeleton-shimmer rounded mb-4"></div>
              <div className="w-full space-y-2 mt-4">
                 <div className="h-4 w-full skeleton-shimmer rounded"></div>
                 <div className="h-4 w-full skeleton-shimmer rounded"></div>
              </div>
            </div>
            
            {/* Right Side Skeleton */}
            <div className="flex flex-col justify-start">
              {/* Status Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 skeleton-shimmer rounded-lg"></div>
                ))}
              </div>
              
              {/* Tabs */}
              <div className="flex gap-4 border-b border-slate-200 mb-6 pb-2">
                <div className="h-8 w-24 skeleton-shimmer rounded"></div>
                <div className="h-8 w-24 skeleton-shimmer rounded"></div>
              </div>
              
              {/* Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                 {[...Array(6)].map((_, i) => (
                   <div key={i} className="space-y-2">
                     <div className="h-3 w-20 skeleton-shimmer rounded"></div>
                     <div className="h-5 w-48 skeleton-shimmer rounded"></div>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
