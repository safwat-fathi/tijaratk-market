"use client";

import { useState, useRef, useEffect, useMemo } from "react";

const normalizeArabic = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[أإآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
};

export type ComboboxOption = string | { label: string; value: string | number };

export interface ComboboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "list" | "onChange" | "options" | "value" | "defaultValue"> {
  options: ComboboxOption[];
  label?: string;
  inputClassName?: string;
  labelClassName?: string;
  wrapperClassName?: string;
  onValueChange?: (value: string) => void;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disableFiltering?: boolean;
}

export function Combobox({
  options,
  label,
  inputClassName = "",
  labelClassName = "",
  wrapperClassName = "",
  onValueChange,
  value,
  defaultValue,
  onChange,
  name,
  disableFiltering,
  ...props
}: ComboboxProps) {
  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'string') return { label: opt, value: opt };
      return { label: String(opt.label), value: String(opt.value) };
    });
  }, [options]);

  // Try to find the initial label based on defaultValue or value
  const initialValue = value !== undefined ? value : defaultValue;
  const initialOption = initialValue !== undefined 
    ? normalizedOptions.find(opt => opt.value === String(initialValue))
    : undefined;

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(initialOption ? initialOption.label : "");
  const [selectedValue, setSelectedValue] = useState(initialValue !== undefined ? String(initialValue) : "");
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // Sync internal state if controlled value changes
  useEffect(() => {
    if (value !== undefined) {
      const nextValue = String(value);
      const option = normalizedOptions.find(opt => opt.value === String(value));
      if (option) {
        setInputValue(option.label);
        setSelectedValue(option.value);
      } else {
        setInputValue(nextValue);
        setSelectedValue(nextValue);
      }
    }
  }, [value, normalizedOptions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // On blur, if the input value doesn't match any option, revert to selected option's label
        const currentOption = normalizedOptions.find(opt => opt.value === selectedValue);
        if (currentOption && inputValue !== currentOption.label) {
          setInputValue(currentOption.label);
        } else if (!currentOption) {
          // If no option selected, clear input
          setInputValue("");
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue, selectedValue, normalizedOptions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);
    
    const matchingOption = normalizedOptions.find(opt => opt.label.toLowerCase() === val.toLowerCase());
    const newVal = matchingOption ? matchingOption.value : val;
    setSelectedValue(newVal);
    
    if (onValueChange) onValueChange(newVal);
  };

  const handleSelect = (option: { label: string; value: string }) => {
    setInputValue(option.label);
    setSelectedValue(option.value);
    setIsOpen(false);
    
    if (onChange) {
      const syntheticEvent = {
        target: { value: option.value, name: name }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
    if (onValueChange) onValueChange(option.value);
  };

  const filteredOptions = useMemo(() => {
    if (disableFiltering) return normalizedOptions;
    const search = normalizeArabic(inputValue);
    if (!search) return normalizedOptions;
    return normalizedOptions.filter((opt) => normalizeArabic(opt.label).includes(search));
  }, [inputValue, normalizedOptions, disableFiltering]);

  return (
    <div className={`block space-y-1 relative ${wrapperClassName}`} ref={containerRef}>
      {label && (
        <span className={`block font-medium text-brand-text ${labelClassName}`}>
          {label}
        </span>
      )}
      <div className="relative">
        {name && (
          <input
            type="hidden"
            name={name}
            value={selectedValue}
            ref={hiddenInputRef}
          />
        )}
        <input
          {...props}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          className={`w-full rounded-md border border-brand-border focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15 pe-10 ${inputClassName}`}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-brand-border rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredOptions.length > 0 ? (
            <ul className="py-1 text-sm text-brand-text divide-y divide-brand-border/50">
              {filteredOptions.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    className="w-full text-right px-4 py-2 hover:bg-brand-soft hover:text-brand-primary transition-colors focus:bg-brand-soft focus:outline-none"
                    onClick={() => handleSelect(option)}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-brand-muted text-center">
              لا توجد نتائج
            </div>
          )}
        </div>
      )}
    </div>
  );
}
