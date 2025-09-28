import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countryCodes, cleanPhoneNumber, formatPhoneNumber } from "@/lib/phoneUtils";

interface PhoneInputProps {
  label: string;
  countryCode: string;
  phoneNumber: string;
  onCountryCodeChange: (code: string) => void;
  onPhoneNumberChange: (number: string) => void;
  placeholder?: string;
  testId?: string;
  error?: string;
}

export default function PhoneInput({
  label,
  countryCode,
  phoneNumber,
  onCountryCodeChange,
  onPhoneNumberChange,
  placeholder = "123 456 7890",
  testId = "phone-input",
  error
}: PhoneInputProps) {
  const [displayNumber, setDisplayNumber] = useState("");

  // Update display number when phoneNumber or countryCode changes
  useEffect(() => {
    if (phoneNumber) {
      // Extract just the number part (without country code)
      let numberPart = phoneNumber;
      if (phoneNumber.startsWith(countryCode)) {
        numberPart = phoneNumber.substring(countryCode.length);
      }
      // Remove any formatting/spaces
      numberPart = numberPart.replace(/\s/g, '');
      setDisplayNumber(numberPart);
    } else {
      setDisplayNumber("");
    }
  }, [phoneNumber, countryCode]);

  const handlePhoneChange = (value: string) => {
    // Remove all non-numeric characters from input
    const numericOnly = value.replace(/\D/g, '');
    setDisplayNumber(numericOnly);
    
    // Combine country code with number
    const fullNumber = countryCode + numericOnly;
    onPhoneNumberChange(fullNumber);
  };

  const handleCountryCodeChange = (newCode: string) => {
    onCountryCodeChange(newCode);
    // Reconstruct the full number with new country code
    const fullNumber = newCode + displayNumber;
    onPhoneNumberChange(fullNumber);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={testId}>{label}</Label>
      <div className="flex gap-2">
        <Select value={countryCode} onValueChange={handleCountryCodeChange}>
          <SelectTrigger className="w-32" data-testid={`${testId}-country`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {countryCodes.map((country, index) => (
              <SelectItem key={`${country.code}-${country.country}-${index}`} value={country.code}>
                <span className="flex items-center gap-2">
                  <span>{country.flag}</span>
                  <span>{country.code}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={testId}
          type="tel"
          placeholder={placeholder}
          value={displayNumber}
          onChange={(e) => handlePhoneChange(e.target.value)}
          className="flex-1"
          data-testid={`${testId}-number`}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}