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

export function generateStrongPassword() {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*()";
  const all = upper + lower + numbers + special;
  
  // Cryptographically secure random selection
  const getRandomChar = (charset) => {
    const randomValues = new Uint32Array(1);
    crypto.getRandomValues(randomValues);
    return charset[randomValues[0] % charset.length];
  };
  
  // Fisher-Yates shuffle with crypto randomness
  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const randomValues = new Uint32Array(1);
      crypto.getRandomValues(randomValues);
      const j = randomValues[0] % (i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };
  
  const chars = [
    getRandomChar(upper),
    getRandomChar(lower),
    getRandomChar(numbers),
    getRandomChar(special)
  ];
  
  for (let i = 0; i < 8; i++) {
    chars.push(getRandomChar(all));
  }
  
  return shuffleArray(chars).join('');
}
