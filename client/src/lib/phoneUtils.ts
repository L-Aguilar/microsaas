// Common country codes for phone numbers - Comprehensive list with focus on Spanish-speaking countries
export const countryCodes = [
  // Spanish-speaking countries first
  { code: "+52", country: "México", flag: "🇲🇽" },
  { code: "+34", country: "España", flag: "🇪🇸" },
  { code: "+57", country: "Colombia", flag: "🇨🇴" },
  { code: "+54", country: "Argentina", flag: "🇦🇷" },
  { code: "+51", country: "Perú", flag: "🇵🇪" },
  { code: "+56", country: "Chile", flag: "🇨🇱" },
  { code: "+58", country: "Venezuela", flag: "🇻🇪" },
  { code: "+593", country: "Ecuador", flag: "🇪🇨" },
  { code: "+502", country: "Guatemala", flag: "🇬🇹" },
  { code: "+504", country: "Honduras", flag: "🇭🇳" },
  { code: "+503", country: "El Salvador", flag: "🇸🇻" },
  { code: "+505", country: "Nicaragua", flag: "🇳🇮" },
  { code: "+506", country: "Costa Rica", flag: "🇨🇷" },
  { code: "+507", country: "Panamá", flag: "🇵🇦" },
  { code: "+591", country: "Bolivia", flag: "🇧🇴" },
  { code: "+598", country: "Uruguay", flag: "🇺🇾" },
  { code: "+595", country: "Paraguay", flag: "🇵🇾" },
  { code: "+1809", country: "República Dominicana", flag: "🇩🇴" },
  { code: "+53", country: "Cuba", flag: "🇨🇺" },
  { code: "+240", country: "Guinea Ecuatorial", flag: "🇬🇶" },
  
  // Other important countries
  { code: "+1", country: "Estados Unidos/Canadá", flag: "🇺🇸" },
  { code: "+55", country: "Brasil", flag: "🇧🇷" },
  { code: "+33", country: "Francia", flag: "🇫🇷" },
  { code: "+44", country: "Reino Unido", flag: "🇬🇧" },
  { code: "+49", country: "Alemania", flag: "🇩🇪" },
  { code: "+39", country: "Italia", flag: "🇮🇹" },
  { code: "+351", country: "Portugal", flag: "🇵🇹" },
  { code: "+31", country: "Países Bajos", flag: "🇳🇱" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+81", country: "Japón", flag: "🇯🇵" },
  { code: "+82", country: "Corea del Sur", flag: "🇰🇷" },
  { code: "+91", country: "India", flag: "🇮🇳" },
];

// Clean phone number by removing special characters
export function cleanPhoneNumber(phone: string): string {
  if (!phone) return "";
  
  // Remove all non-numeric characters except the initial + sign
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Ensure only one + at the beginning
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.substring(1).replace(/\+/g, '');
  }
  
  return cleaned.replace(/\+/g, '');
}

// Format phone number for display (add basic formatting)
export function formatPhoneNumber(phone: string): string {
  const cleaned = cleanPhoneNumber(phone);
  
  if (!cleaned) return "";
  
  // For now, just return the cleaned number without formatting
  // This prevents unwanted spaces and formatting issues
  return cleaned;
}

// Validate phone number format
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = cleanPhoneNumber(phone);
  
  // Must start with + and have at least 8 digits total
  if (!cleaned.startsWith('+') || cleaned.length < 8) {
    return false;
  }
  
  // Must contain only digits after the +
  const digits = cleaned.substring(1);
  return /^\d+$/.test(digits) && digits.length >= 7 && digits.length <= 15;
}