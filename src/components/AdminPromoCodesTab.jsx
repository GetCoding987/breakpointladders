import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Tag, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatEasternDateTime } from '@/utils/easternTime';

export default function AdminPromoCodesTab() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [codeInput, setCodeInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_date', { ascending: false });
    if (loadError) setError(loadError.message);
    else setCodes(data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingCode(null);
    setCodeInput('');
    setDiscountInput('');
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (promo) => {
    setEditingCode(promo);
    setCodeInput(promo.code);
    setDiscountInput(String(promo.discount_percent));
    setFormError('');
    setShowForm(true);
  };

  const savePromoCode = async () => {
    const trimmedCode = codeInput.trim().toUpperCase();
    const discount = parseInt(discountInput, 10);

    if (!trimmedCode) {
      setFormError('Please enter a code');
      return;
    }
    if (!discount || discount < 1 || discount > 100) {
      setFormError('Discount must be between 1 and 100');
      return;
    }

    setSaving(true);
    setFormError('');

    const payload = { code: trimmedCode, discount_percent: discount };
    const { error: saveError } = editingCode
      ? await supabase.from('promo_codes').update(payload).eq('id', editingCode.id)
      : await supabase.from('promo_codes').insert(payload);

    if (saveError) {
      setFormError(saveError.message.includes('promo_codes_code_key') ? 'That code already exists' : saveError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowForm(false);
    load();
  };

  const toggleActive = async (promo) => {
    await supabase.from('promo_codes').update({ active: !promo.active }).eq('id', promo.id);
    load();
  };

  const deletePromoCode = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('promo_codes').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Tag className="w-5 h-5 text-[hsl(217,72%,40%)]" />
            Promo Codes
          </h2>
          <Button onClick={openCreate} className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2">
            <Plus className="w-4 h-4" />
            New Promo Code
          </Button>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="space-y-3">
          {codes.map(promo => (
            <div key={promo.id} className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{promo.code}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${promo.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {promo.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {promo.discount_percent}% off · Created {promo.created_date ? formatEasternDateTime(promo.created_date) : ''}
                </p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => toggleActive(promo)} className="h-8 text-xs">
                  {promo.active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(promo)} className="h-8 w-8">
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(promo)} className="h-8 w-8 text-red-600 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {codes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No promo codes yet</p>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCode ? 'Edit Promo Code' : 'New Promo Code'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Code</label>
              <Input
                placeholder="SAVE20"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                className="uppercase"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Discount (%)</label>
              <Input
                type="number"
                min={1}
                max={100}
                placeholder="20"
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={savePromoCode} disabled={saving} className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)]">
                {saving ? 'Saving...' : editingCode ? 'Save Changes' : 'Create Code'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Promo Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{deleteTarget?.code}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button onClick={deletePromoCode} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white gap-2">
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
