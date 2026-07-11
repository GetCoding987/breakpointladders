import { useState, useRef, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const WESTCHESTER_TOWNS = [
  'Ardsley', 'Bedford', 'Briarcliff Manor', 'Bronxville', 'Buchanan',
  'Cortlandt', 'Croton-on-Hudson', 'Dobbs Ferry', 'Eastchester', 'Elmsford',
  'Greenburgh', 'Harrison', 'Hastings-on-Hudson', 'Irvington', 'Larchmont',
  'Lewisboro', 'Mamaroneck', 'Mount Kisco', 'Mount Pleasant', 'Mount Vernon',
  'New Castle', 'New Rochelle', 'North Castle', 'North Salem', 'Ossining',
  'Pelham', 'Peekskill', 'Pleasantville', 'Port Chester', 'Rye',
  'Rye Brook', 'Scarsdale', 'Sleepy Hollow', 'Somers', 'South Salem',
  'Tarrytown', 'Tuckahoe', 'White Plains', 'Yonkers', 'Yorktown',
  'Yorktown Heights', 'Chappaqua', 'Pound Ridge', 'Hartsdale',
  'Hawthorne', 'Thornwood', 'Valhalla', 'Rye City',
];

export default function CityAutocomplete({ value, onChange, required }) {
  const [query, setQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        // Reset to the validated value if the current query doesn't match
        if (!WESTCHESTER_TOWNS.some(t => t.toLowerCase() === query.toLowerCase())) {
          setQuery(value || '');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query, value]);

  const filtered = query.trim()
    ? WESTCHESTER_TOWNS.filter(t =>
        t.toLowerCase().includes(query.toLowerCase())
      ).sort()
    : [...WESTCHESTER_TOWNS].sort();

  const selectTown = (town) => {
    setQuery(town);
    onChange(town);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    setHighlightedIndex(-1);
    // Only propagate to parent if it matches a town exactly (case-insensitive)
    const match = WESTCHESTER_TOWNS.find(t => t.toLowerCase() === val.toLowerCase());
    onChange(match ? match : '');
  };

  const handleKeyDown = (e) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        e.preventDefault();
        selectTown(filtered[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const isValid = WESTCHESTER_TOWNS.some(t => t.toLowerCase() === query.toLowerCase());

  return (
    <div className="space-y-2">
      <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
      <div className="relative" ref={containerRef}>
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
        <Input
          id="city"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-10 h-12"
          placeholder="Start typing your city..."
          required={required}
          autoComplete="off"
        />
        {isOpen && filtered.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filtered.map((town, idx) => (
              <button
                key={town}
                type="button"
                onClick={() => selectTown(town)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  idx === highlightedIndex ? 'bg-blue-50 text-[hsl(217,72%,40%)]' : 'hover:bg-muted'
                }`}
              >
                {town}
              </button>
            ))}
          </div>
        )}
        {query.trim().length > 0 && !isValid && (
          <p className="text-xs text-red-500 mt-1">
            Please select a valid Westchester municipality from the list.
          </p>
        )}
      </div>
    </div>
  );
}