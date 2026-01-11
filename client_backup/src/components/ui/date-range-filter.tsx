import React, { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Calendar as CalendarComponent } from './calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DateRangeFilterProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onDateChange: (startDate: Date | undefined, endDate: Date | undefined) => void;
  placeholder?: string;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onDateChange,
  placeholder = "Filtrar por fecha"
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleDateSelect = (date: Date | undefined) => {
    if (!startDate || (startDate && endDate)) {
      onDateChange(date, undefined);
    } else {
      if (date && date < startDate) {
        onDateChange(date, startDate);
      } else {
        onDateChange(startDate, date);
      }
    }
  };

  const clearDates = () => {
    onDateChange(undefined, undefined);
  };

  const formatDateRange = () => {
    if (startDate && endDate) {
      return `${format(startDate, 'dd/MM/yyyy', { locale: es })} - ${format(endDate, 'dd/MM/yyyy', { locale: es })}`;
    } else if (startDate) {
      return `Desde ${format(startDate, 'dd/MM/yyyy', { locale: es })}`;
    }
    return placeholder;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="justify-start text-left font-normal"
        >
          <Calendar className="mr-2 h-4 w-4" />
          {formatDateRange()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Seleccionar rango de fechas</h4>
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDates}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <CalendarComponent
          mode="range"
          selected={{
            from: startDate,
            to: endDate,
          }}
          onSelect={(range) => {
            onDateChange(range?.from, range?.to);
            if (range?.from && range?.to) {
              setIsOpen(false);
            }
          }}
          numberOfMonths={2}
          locale={es}
        />
      </PopoverContent>
    </Popover>
  );
}

