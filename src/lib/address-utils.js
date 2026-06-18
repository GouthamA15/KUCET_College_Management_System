export function parseAddress(addrStr) {
  if (!addrStr || typeof addrStr !== 'string') {
    return {
      house_no: '',
      street: '',
      apartment: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India'
    };
  }

  const parts = addrStr.split(',').map(p => p.trim()).filter(Boolean);
  
  let country = 'India';
  let pincode = '';
  let state = '';
  let city = '';
  let apartment = '';
  let street = '';
  let house_no = '';

  let remaining = [...parts];

  // 1. Country (often the last part)
  if (remaining.length > 0) {
    const last = remaining[remaining.length - 1];
    if (isNaN(last) && (last.toLowerCase() === 'india' || last.toLowerCase().includes('country'))) {
      country = remaining.pop();
    }
  }

  // 2. Pincode (6-digit number, often near the end)
  for (let i = remaining.length - 1; i >= 0; i--) {
    const part = remaining[i];
    const match = part.match(/\b\d{6}\b/);
    if (match) {
      pincode = match[0];
      const cleaned = part.replace(/\b\d{6}\b/, '').trim();
      if (!cleaned) {
        remaining.splice(i, 1);
      } else {
        remaining[i] = cleaned;
      }
      break;
    }
  }

  // 3. State (often the last or second-to-last part now)
  const indianStates = [
    'Telangana', 'Andhra Pradesh', 'Karnataka', 'Tamil Nadu', 'Maharashtra', 
    'Kerala', 'Goa', 'Gujarat', 'Rajasthan', 'Punjab', 'Haryana', 
    'Uttar Pradesh', 'Madhya Pradesh', 'Bihar', 'West Bengal', 'Odisha', 
    'Assam', 'Sikkim', 'Nagaland', 'Manipur', 'Mizoram', 'Tripura', 
    'Meghalaya', 'Arunachal Pradesh', 'Himachal Pradesh', 'Uttarakhand', 
    'Chhattisgarh', 'Jharkhand', 'Delhi', 'Puducherry', 'Chandigarh', 
    'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Andaman and Nicobar Islands'
  ];

  for (let i = remaining.length - 1; i >= 0; i--) {
    const part = remaining[i];
    const matchedState = indianStates.find(s => part.toLowerCase().includes(s.toLowerCase()));
    if (matchedState) {
      state = matchedState;
      remaining.splice(i, 1);
      break;
    }
  }

  // 4. City (often the next part from the end)
  if (remaining.length > 0) {
    city = remaining.pop();
  }

  // 5. Remaining parts are house_no, street, apartment
  if (remaining.length > 0) {
    house_no = remaining[0];
  }
  if (remaining.length > 1) {
    street = remaining.slice(1).join(', ');
  }

  return {
    house_no: house_no || '',
    street: street || '',
    apartment: apartment || '',
    city: city || '',
    state: state || '',
    pincode: pincode || '',
    country: country || 'India'
  };
}

export function formatAddress(structured) {
  if (!structured) return '';
  const { house_no, street, apartment, city, state, pincode, country } = structured;
  const parts = [house_no, apartment, street, city, state, pincode, country]
    .map(p => String(p || '').trim())
    .filter(Boolean);
  return parts.join(', ');
}

export function getPermanentAddressFromDetails(details) {
  if (!details) return '';
  const perm = {
    house_no: details.perm_house_no || '',
    street: details.perm_street || '',
    apartment: details.perm_apartment || '',
    city: details.perm_city || '',
    state: details.perm_state || '',
    pincode: details.perm_pincode || '',
    country: details.perm_country || 'India'
  };
  const hasPerm = Object.values(perm).some(v => v && v !== 'India');
  return hasPerm ? formatAddress(perm) : (details.address || '');
}

export function getContactAddressFromDetails(details) {
  if (!details) return '';
  const curr = {
    house_no: details.curr_house_no || '',
    street: details.curr_street || '',
    apartment: details.curr_apartment || '',
    city: details.curr_city || '',
    state: details.curr_state || '',
    pincode: details.curr_pincode || '',
    country: details.curr_country || 'India'
  };
  const hasCurr = Object.values(curr).some(v => v && v !== 'India');
  return hasCurr ? formatAddress(curr) : (details.address || '');
}

export function mapAddressStringsToFields(contactAddressStr, permanentAddressStr) {
  const perm = parseAddress(permanentAddressStr);
  const curr = parseAddress(contactAddressStr);

  return {
    perm_house_no: perm.house_no || null,
    perm_street: perm.street || null,
    perm_apartment: perm.apartment || null,
    perm_city: perm.city || null,
    perm_state: perm.state || null,
    perm_pincode: perm.pincode || null,
    perm_country: perm.country || 'India',

    curr_house_no: curr.house_no || null,
    curr_street: curr.street || null,
    curr_apartment: curr.apartment || null,
    curr_city: curr.city || null,
    curr_state: curr.state || null,
    curr_pincode: curr.pincode || null,
    curr_country: curr.country || 'India',

    is_current_same_as_permanent: (contactAddressStr && permanentAddressStr && contactAddressStr.trim().toLowerCase() === permanentAddressStr.trim().toLowerCase()) || false
  };
}

export function getProfileDisplayAddress(student) {
  if (!student) return '';
  const details = student.personal_details || student;
  const perm = getPermanentAddressFromDetails(details);
  const contact = getContactAddressFromDetails(details);
  if (contact && perm && contact.trim().toLowerCase() !== perm.trim().toLowerCase()) {
    return contact;
  }
  return perm || details.address || student.address || '';
}
