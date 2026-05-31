export function getPasswordRequirements(password) {
  return [
    { label: 'Minimum 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /\d/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function getPasswordStrength(password, requirements) {
  if (!password) return null;
  const metCount = requirements.filter(r => r.met).length;
  if (metCount <= 2) return { label: 'Weak', color: 'bg-red-500', text: 'text-red-500' };
  if (metCount <= 4) return { label: 'Medium', color: 'bg-amber-500', text: 'text-amber-500' };
  if (metCount === 5) return { label: 'Strong', color: 'bg-green-500', text: 'text-green-500' };
  return { label: 'Very Strong', color: 'bg-green-600', text: 'text-green-600' };
}
