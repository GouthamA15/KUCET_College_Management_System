'use client';
import React from 'react';
import { formatDate } from '@/lib/date';
import ProfileInfoList from '@/components/profile/ProfileInfoList';

const formatAddressBlock = (addr) => {
  if (!addr) return null;
  const lines = [
    addr.house_no ? `H.No. ${addr.house_no}` : null,
    addr.apartment ? addr.apartment : null,
    addr.street ? addr.street : null,
    addr.city || addr.state ? `${[addr.city, addr.state].filter(Boolean).join(', ')}` : null,
    addr.pincode ? addr.pincode : null,
    addr.country ? addr.country : null,
  ].filter(Boolean);
  
  if (lines.length === 0) return null;
  
  return (
    <div className="text-sm text-slate-700 leading-relaxed space-y-0.5 font-medium">
      {lines.map((line, idx) => (
        <div key={idx}>{line}</div>
      ))}
    </div>
  );
};

const checkAddressesDifferent = (student) => {
  const details = student?.personal_details || student;
  if (!details) return false;
  
  if (details.is_current_same_as_permanent) return false;
  
  const hasCurrent = !!(details.curr_house_no || details.curr_street || details.curr_city || details.curr_pincode);
  const hasPerm = !!(details.perm_house_no || details.perm_street || details.perm_city || details.perm_pincode);
  
  if (hasCurrent && hasPerm) {
    const fields = ['house_no', 'street', 'apartment', 'city', 'state', 'pincode', 'country'];
    return fields.some(field => {
      const permVal = String(details[`perm_${field}`] || '').trim().toLowerCase();
      const currVal = String(details[`curr_${field}`] || '').trim().toLowerCase();
      return permVal !== currVal;
    });
  }
  
  const contactLegacy = String(details.contact_address || '').trim().toLowerCase();
  const permLegacy = String(details.permanent_address || '').trim().toLowerCase();
  return contactLegacy !== permLegacy && contactLegacy !== '' && permLegacy !== '';
};

export default function PersonalInfoTab({ student }) {
  const items = [
    { key: 'father_name', label: 'Father Name', value: student.personal_details?.father_name ?? '-' },
    { key: 'mother_name', label: 'Mother Name', value: student.personal_details?.mother_name ?? '-' },
    {
      key: 'dob',
      label: 'Date of Birth',
      value: student.date_of_birth ? formatDate(student.date_of_birth).replaceAll('-', '/') : '-',
    },
    { key: 'phone', label: 'Phone', value: student.mobile ?? '-' },
    { key: 'email', label: 'Email', value: student.email || '-' },
  ];

  const hasCurrent = student.personal_details?.curr_house_no || student.personal_details?.curr_street;
  const currentAddress = hasCurrent ? formatAddressBlock({
    house_no: student.personal_details?.curr_house_no,
    street: student.personal_details?.curr_street,
    apartment: student.personal_details?.curr_apartment,
    city: student.personal_details?.curr_city,
    state: student.personal_details?.curr_state,
    pincode: student.personal_details?.curr_pincode,
    country: student.personal_details?.curr_country,
  }) : (student.personal_details?.contact_address || student.contact_address ? (
    <div className="text-sm text-slate-700 font-medium whitespace-pre-line leading-relaxed">
      {student.personal_details?.contact_address || student.contact_address}
    </div>
  ) : null);

  const hasPerm = student.personal_details?.perm_house_no || student.personal_details?.perm_street;
  const permanentAddress = hasPerm ? formatAddressBlock({
    house_no: student.personal_details?.perm_house_no,
    street: student.personal_details?.perm_street,
    apartment: student.personal_details?.perm_apartment,
    city: student.personal_details?.perm_city,
    state: student.personal_details?.perm_state,
    pincode: student.personal_details?.perm_pincode,
    country: student.personal_details?.perm_country,
  }) : (student.personal_details?.permanent_address || student.permanent_address ? (
    <div className="text-sm text-slate-700 font-medium whitespace-pre-line leading-relaxed">
      {student.personal_details?.permanent_address || student.permanent_address}
    </div>
  ) : null);

  const showContact = checkAddressesDifferent(student);
  const addressToDisplay = showContact ? currentAddress : permanentAddress;

  return (
    <div className="space-y-6">
      <ProfileInfoList items={items} />
      
      <div className="pt-4 border-t border-slate-100">
        <div className="bg-slate-50 border border-slate-150 p-4 rounded-lg shadow-sm">
          <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <span>Permanent Address</span>
            {showContact && (
              <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Showing Current Address
              </span>
            )}
          </div>
          {addressToDisplay || <div className="text-xs text-slate-400 font-semibold uppercase">No Record Found</div>}
        </div>
      </div>
    </div>
  );
}
