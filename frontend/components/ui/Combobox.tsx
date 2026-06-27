"use client";

import { useId, useState, useRef, useEffect, useMemo } from "react";

export interface ComboboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "list"> {
  options: string[];
  label?: string;
  inputClassName?: string;
  labelClassName?: string;
  wrapperClassName?: string;
  onValueChange?: (value: string) => void;
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
  ...props
}: ComboboxProps) {
  const [internalValue, setInternalValue] = useState<string>(
    (value as string) || (defaultValue as string) || ""
  );
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal value if controlled
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value as string);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalValue(val);
    setIsOpen(true);
    if (onChange) onChange(e);
    if (onValueChange) onValueChange(val);
  };

  const handleSelect = (option: string) => {
    setInternalValue(option);
    setIsOpen(false);
    
    // Simulate change event if needed by parent
    const syntheticEvent = {
      target: { value: option, name: props.name }
    } as React.ChangeEvent<HTMLInputElement>;
    
    if (onChange) onChange(syntheticEvent);
    if (onValueChange) onValueChange(option);
  };

  const filteredOptions = useMemo(() => {
    const search = internalValue.toLowerCase();
    if (!search) return options;
    return options.filter((opt) => opt.toLowerCase().includes(search));
  }, [internalValue, options]);

  return (
    <div className={`block space-y-1 relative ${wrapperClassName}`} ref={containerRef}>
      {label && (
        <span className={`block font-medium text-brand-text ${labelClassName}`}>
          {label}
        </span>
      )}
      <div className="relative">
        <input
          {...props}
          value={internalValue}
          onChange={handleChange}
          onFocus={() => setIsOpen(true)}
          className={`w-full rounded-md border border-brand-border focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15 pe-10 ${inputClassName}`}
        />
        <div className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-brand-border rounded-md shadow-lg max-h-60 overflow-auto">
          <ul className="py-1 text-sm text-brand-text divide-y divide-brand-border/50">
            {filteredOptions.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  className="w-full text-right px-4 py-2 hover:bg-brand-soft hover:text-brand-primary transition-colors focus:bg-brand-soft focus:outline-none"
                  onClick={() => handleSelect(option)}
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
