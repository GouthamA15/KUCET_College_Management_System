'use client';
import ClassList from '@/components/staff/faculty/ClassList';

export default function FacultyClassListPage() {
  return (
    <div className="max-w-7xl mx-auto w-full">
      <h1 className="text-2xl md:text-3xl font-bold mb-4">Class List</h1>
      <ClassList />
    </div>
  );
}