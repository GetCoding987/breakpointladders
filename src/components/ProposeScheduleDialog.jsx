import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, MapPin } from 'lucide-react';

export default function ProposeScheduleDialog({ open, onOpenChange, onSubmit, mode = 'propose', currentProposal = null }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (open) {
      if (currentProposal) {
        setDate(currentProposal.date || '');
        setTime(currentProposal.time || '');
        setLocation(currentProposal.location || '');
      } else {
        setDate('');
        setTime('');
        setLocation('');
      }
    }
  }, [open, currentProposal]);

  const handleSubmit = () => {
    if (!date || !time) return;
    onSubmit({ date, time, location: location.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'counter' ? 'Propose New Match Time' : 'Propose Match Time'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Date <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                min={today}
                value={date}
                onChange={e => setDate(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Time <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Location / Court</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="e.g. Central Park Tennis Courts"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!date || !time} className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2">
              {mode === 'counter' ? 'Send Counter Proposal' : 'Send Proposal'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}