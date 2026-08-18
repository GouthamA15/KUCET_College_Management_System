"use client";
import { useState } from 'react';
import { Upload, FileText, Trash2, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FacultyAcademicMaterials() {
  const [materials, setMaterials] = useState([
    { id: 1, title: 'Data Structures Reference', type: 'PDF', date: '2026-05-18', size: '2.4 MB' },
    { id: 2, title: 'Algorithms Introduction Notes', type: 'Link', date: '2026-05-15', link: 'https://example.com/notes1' }
  ]);

  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      toast.success('Mock upload successful. Real Cloudinary integration required for production.');
      setMaterials([
        { id: Date.now(), title: 'New Reference Material', type: 'PDF', date: new Date().toISOString().split('T')[0], size: '1.1 MB' },
        ...materials
      ]);
    }, 1500);
  };

  const handleDelete = (id) => {
    setMaterials(materials.filter(m => m.id !== id));
    toast.success('Material removed');
  };

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Academic Materials</h1>
          <p className="text-slate-500 mt-1">Manage course materials, notes, and references for your subjects.</p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
          <button 
            onClick={handleUpload}
            disabled={isUploading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow-sm transition-colors disabled:opacity-70"
          >
            {isUploading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload Material
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
          <h2 className="font-semibold text-slate-700">Uploaded Resources</h2>
          <span className="text-sm bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{materials.length} Items</span>
        </div>
        
        {materials.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
            <FileText className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-lg font-medium">No materials uploaded yet.</p>
            <p className="text-sm">Click the upload button to share resources with your students.</p>
          </div>
        ) : (
          <div className="divide-y">
            {materials.map((item) => (
              <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="bg-slate-100 p-3 rounded text-indigo-600">
                    {item.type === 'Link' ? <LinkIcon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-800">{item.title || item.unit}</h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                      <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs">{item.type}</span>
                      <span>{item.date}</span>
                      {item.size && <span>{item.size}</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-4 md:mt-0 flex gap-2 self-end md:self-auto">
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-3 py-1.5 rounded hover:bg-indigo-50 transition-colors">
                      Open Link
                    </a>
                  )}
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors"
                    title="Delete Material"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
