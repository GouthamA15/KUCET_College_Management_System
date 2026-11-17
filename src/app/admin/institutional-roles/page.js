import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Institutional Roles & Staff Management | KUCET CMS',
  description: 'Consolidated into Manage Staff console.',
};

export default function InstitutionalRolesPage() {
  redirect('/admin/manage-staff');
}
