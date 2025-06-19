
"use client";
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DOB_DAYS, DOB_MONTHS, ENROLLMENT_YEARS } from '@/lib/constants'; // Use ENROLLMENT_YEARS
import { Label } from '@/components/ui/label';

interface EnrollmentDateDropdownPickerProps {
  value: { day: string; month: string; year: string };
  onChange: (date: { day: string; month: string; year: string }) => void;
  id?: string;
}

export function EnrollmentDateDropdownPicker({ value, onChange, id = "enrollmentDate" }: EnrollmentDateDropdownPickerProps) {
  const handleDayChange = (day: string) => onChange({ ...value, day });
  const handleMonthChange = (month: string) => onChange({ ...value, month });
  const handleYearChange = (year: string) => onChange({ ...value, year });

  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <Label htmlFor={`${id}-day`} className="sr-only">Day</Label>
        <Select value={value.day} onValueChange={handleDayChange}>
          <SelectTrigger id={`${id}-day`} aria-label="Day of enrollment">
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent>
            {DOB_DAYS.map((day) => (
              <SelectItem key={day} value={day}>{day}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${id}-month`} className="sr-only">Month</Label>
        <Select value={value.month} onValueChange={handleMonthChange}>
          <SelectTrigger id={`${id}-month`} aria-label="Month of enrollment">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {DOB_MONTHS.map((month) => (
              <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${id}-year`} className="sr-only">Year</Label>
        <Select value={value.year} onValueChange={handleYearChange}>
          <SelectTrigger id={`${id}-year`} aria-label="Year of enrollment">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {ENROLLMENT_YEARS.map((year) => ( // Use ENROLLMENT_YEARS
              <SelectItem key={year} value={year}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
