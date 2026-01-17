import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { countryCodes } from "@/lib/phoneUtils";

interface PhoneInputProps {
  label?: string;
  countryCode?: string;
  phoneNumber?: string;
  onCountryCodeChange?: (code: string) => void;
  onPhoneNumberChange?: (number: string) => void;
  onChange?: (fullNumber: string) => void; // For simplified usage
  placeholder?: string;
  testId?: string;
  error?: string;
  id?: string;
  required?: boolean;
  icon?: React.ReactNode;
  value?: string; // For simplified usage
}

export default function PhoneInput({
  label,
  countryCode: externalCountryCode,
  phoneNumber: externalPhoneNumber,
  onCountryCodeChange,
  onPhoneNumberChange,
  onChange,
  placeholder = "123 456 7890",
  testId = "phone-input",
  error,
  id,
  required = false,
  icon,
  value // For simplified usage where full phone number is passed as single value
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState(() => {
    return countryCodes.find(c => c.code === externalCountryCode) || countryCodes[0]; // Default to Mexico (first in list)
  });
  const [phoneNumber, setPhoneNumber] = useState("");
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Parse existing value if provided as single value
  useEffect(() => {
    if (value && value.startsWith("+")) {
      // Find matching country by dial code
      const foundCountry = countryCodes.find(country => 
        value.startsWith(country.code)
      );
      if (foundCountry) {
        setSelectedCountry(foundCountry);
        setPhoneNumber(value.substring(foundCountry.code.length).replace(/\s/g, ''));
      }
    } else if (externalPhoneNumber && externalCountryCode) {
      // Legacy support for separate countryCode and phoneNumber
      setSelectedCountry(countryCodes.find(c => c.code === externalCountryCode) || countryCodes[1]);
      let numberPart = externalPhoneNumber;
      if (externalPhoneNumber.startsWith(externalCountryCode)) {
        numberPart = externalPhoneNumber.substring(externalCountryCode.length);
      }
      setPhoneNumber(numberPart.replace(/\s/g, ''));
    }
  }, [value, externalPhoneNumber, externalCountryCode]);

  const handleCountrySelect = (country: typeof countryCodes[0]) => {
    setSelectedCountry(country);
    setOpen(false);
    const fullNumber = `${country.code}${phoneNumber}`.replace(/\s/g, '');
    
    // Call both new and legacy callbacks
    if (onChange) onChange(fullNumber);
    if (onCountryCodeChange) onCountryCodeChange(country.code);
    if (onPhoneNumberChange) onPhoneNumberChange(fullNumber);
  };

  const handlePhoneChange = (newPhone: string) => {
    // Remove non-numeric characters except spaces and dashes for better UX
    const cleanPhone = newPhone.replace(/[^\d\s-]/g, '');
    setPhoneNumber(cleanPhone);
    const fullNumber = `${selectedCountry.code}${cleanPhone.replace(/\s/g, '')}`;
    
    // Call both new and legacy callbacks
    if (onChange) onChange(fullNumber);
    if (onPhoneNumberChange) onPhoneNumberChange(fullNumber);
  };

  const filteredCountries = countryCodes.filter(country =>
    country.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.code.includes(searchQuery)
  );

  const displayValue = phoneNumber ? phoneNumber : "";

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={id || testId} className="text-sm font-medium flex items-center">
          {icon && <span className="inline-flex items-center mr-1">{icon}</span>}
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <div className="flex">
        {/* Country Selector */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[140px] justify-between rounded-r-none border-r-0 px-3 hover:bg-gray-50 transition-colors"
              data-testid={`${testId}-country`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-lg flex-shrink-0">{selectedCountry.flag}</span>
                <span className="text-sm font-medium truncate text-foreground">{selectedCountry.code}</span>
              </div>
              <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar país..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div className="max-h-[250px] overflow-auto p-1">
              {filteredCountries.map((country, index) => (
                <Button
                  key={`${country.code}-${country.country}-${index}`}
                  variant="ghost"
                  onClick={() => handleCountrySelect(country)}
                  className={cn(
                    "w-full justify-start text-left font-normal h-9 px-2 py-1.5",
                    selectedCountry.code === country.code && "bg-accent"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <span className="text-lg flex-shrink-0">{country.flag}</span>
                      <div className="flex items-center justify-between min-w-0 flex-1">
                        <span className="font-medium text-sm truncate pr-2">{country.country}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0 font-mono">{country.code}</span>
                      </div>
                    </div>
                    {selectedCountry.code === country.code && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                </Button>
              ))}
              {filteredCountries.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No se encontraron países.
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Phone Number Input */}
        <Input
          id={id || testId}
          type="tel"
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => handlePhoneChange(e.target.value)}
          required={required}
          className="rounded-l-none flex-1"
          data-testid={`${testId}-number`}
        />
      </div>
      
      {/* Helper text */}
      <div className="text-xs text-muted-foreground">
        Ejemplo: {selectedCountry.code} 123 456 7890
      </div>
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}