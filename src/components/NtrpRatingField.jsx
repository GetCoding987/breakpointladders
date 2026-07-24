import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const NTRP_VALUES = ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5'];

const NTRP_DEFINITIONS = [
  {
    heading: 'Beginner Levels (1.0 to 2.5)',
    items: [
      { value: '1.0 – 1.5', text: 'Brand new to the game; learning basic ball-contact and trying to get the ball into play.' },
      { value: '2.0', text: 'Needs on-court experience; struggles with consistent contact points and basic court positioning.' },
      { value: '2.5', text: 'Learning to judge ball speed and swing length; can sustain a slow-paced backcourt rally.' },
    ],
  },
  {
    heading: 'Intermediate Levels (3.0 to 4.0)',
    items: [
      { value: '3.0', text: 'Can hit medium-paced shots reasonably well, but lacks overall control, depth, and consistency across all strokes.' },
      { value: '3.5', text: 'Has improved stroke dependability and directional control on moderate shots; is comfortable with basic doubles teamwork.' },
      { value: '4.0', text: 'Features dependable strokes, directional control, and depth on both sides; forces errors and handles net play well.' },
    ],
  },
  {
    heading: 'Advanced Levels (4.5 to 5.5)',
    items: [
      { value: '4.5', text: 'Can master power and consistency, vary strategy under pressure, and execute smart tactics during tight matches.' },
      { value: '5.0', text: 'Has good shot anticipation, frequently hits winners, and adapts styles easily against tough opponents.' },
      { value: '5.5', text: 'Extremely high-level player with heavily developed athletic skills and mastered strategy for sectional or national competition.' },
    ],
  },
];

export function NtrpDefinitionsDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>NTRP Rating Definitions</DialogTitle>
        </DialogHeader>
        <div className="max-h-[80vh] space-y-5 overflow-y-auto pr-1">
          {NTRP_DEFINITIONS.map((group) => (
            <div key={group.heading}>
              <h4 className="mb-2 text-sm font-bold text-foreground">{group.heading}</h4>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item.value} className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{item.value}:</span> {item.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NtrpDefinitionsLink({ children = 'NTRP Self-Rating', className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-primary underline-offset-2 hover:underline ${className}`}
      >
        {children}
      </button>
      <NtrpDefinitionsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function NtrpRatingSelect({ value, onValueChange, id = 'ntrp-rating', required = true }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        <NtrpDefinitionsLink>NTRP Self-Rating</NtrpDefinitionsLink>
        {required && <span className="text-red-500"> *</span>}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="h-12" required={required}>
          <SelectValue placeholder="Select your NTRP rating" />
        </SelectTrigger>
        <SelectContent>
          {NTRP_VALUES.map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
