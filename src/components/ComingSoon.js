'use client';

export default function ComingSoon({ title, description, icon = "🚀" }) {
  return (
    <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h1 className="text-2xl font-bold mb-2 text-gray-800">{title}</h1>
      <p className="text-gray-600 mb-6">{description || "This feature is currently under development and will be available soon."}</p>
      <div className="flex justify-center">
        <div className="animate-pulse flex space-x-2">
          <div className="h-2 w-2 bg-indigo-400 rounded-full"></div>
          <div className="h-2 w-2 bg-indigo-500 rounded-full"></div>
          <div className="h-2 w-2 bg-indigo-600 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
