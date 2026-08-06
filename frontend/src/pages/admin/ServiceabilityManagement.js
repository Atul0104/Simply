import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, MapPin, Plus, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
const EMPTY_RULE = { pincode: '', city: '', state: '', delivery_days: 3, delivery_charge: 0, cod_available: true, is_active: true };

export default function ServiceabilityManagement() {
  const [rules, setRules] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/admin/pincode-rules`, { params: { q: query || undefined, page, page_size: 30 } });
      setRules(response.data.items || []);
      setTotal(response.data.total || 0);
      setPages(response.data.pages || 1);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to load delivery areas');
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => { const timer = setTimeout(fetchRules, 250); return () => clearTimeout(timer); }, [fetchRules]);

  function openRule(rule = EMPTY_RULE) { setEditing({ ...rule }); }

  async function saveRule(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(editing.pincode)) { toast.error('Pincode must contain exactly six digits'); return; }
    setSaving(true);
    try {
      const { pincode, id, updated_at, ...payload } = editing;
      await axios.put(`${API_URL}/admin/pincode-rules/${pincode}`, payload);
      toast.success(id ? 'Delivery rule updated' : 'Delivery area added');
      setEditing(null);
      fetchRules();
    } catch (requestError) {
      toast.error(requestError.response?.data?.detail || 'Delivery rule could not be saved');
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule, is_active) {
    try {
      const { pincode, id, updated_at, ...payload } = rule;
      await axios.put(`${API_URL}/admin/pincode-rules/${pincode}`, { ...payload, is_active });
      toast.success(is_active ? 'Delivery area enabled' : 'Delivery area disabled');
      fetchRules();
    } catch (requestError) { toast.error(requestError.response?.data?.detail || 'Status could not be changed'); }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs uppercase tracking-[0.2em] text-[#7d4956]">Shipping operations</p><h1 className="display-serif mt-1 text-3xl font-semibold">Delivery areas</h1><p className="mt-1 text-sm text-stone-500">{total} configured pincodes; unconfigured areas fail closed.</p></div>
          <div className="flex gap-2"><Button variant="outline" onClick={fetchRules}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button onClick={() => openRule()}><Plus className="mr-2 h-4 w-4" />Add area</Button></div>
        </div>
        <Card className="mb-5"><CardContent className="p-3 sm:p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><Input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search pincode, city or state" className="pl-9" /></div></CardContent></Card>

        {error ? <Card><CardContent className="p-10 text-center"><p className="text-red-700" role="alert">{error}</p><Button variant="outline" className="mt-4" onClick={fetchRules}>Try again</Button></CardContent></Card> : loading ? <div className="grid gap-3 md:grid-cols-2">{[1,2,3,4].map(item => <div key={item} className="h-36 animate-pulse rounded-xl bg-stone-200" />)}</div> : rules.length === 0 ? <Card><CardContent className="p-12 text-center"><MapPin className="mx-auto mb-3 h-12 w-12 text-stone-400" /><p>No matching delivery areas</p></CardContent></Card> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rules.map(rule => <Card key={rule.pincode}><CardContent className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">{rule.pincode}</h2><Badge variant={rule.is_active ? 'default' : 'secondary'}>{rule.is_active ? 'Active' : 'Disabled'}</Badge></div><p className="mt-1 text-sm text-stone-500">{rule.city}, {rule.state}</p></div><MapPin className="h-5 w-5 text-[#7d4956]" /></div><div className="mt-4 grid grid-cols-3 gap-2 text-sm"><div><p className="text-stone-500">Delivery</p><p>{rule.delivery_days} days</p></div><div><p className="text-stone-500">Charge</p><p>₹{Number(rule.delivery_charge || 0).toFixed(0)}</p></div><div><p className="text-stone-500">COD</p><p>{rule.cod_available ? 'Allowed' : 'No'}</p></div></div><div className="mt-5 flex items-center justify-between border-t pt-4"><div className="flex items-center gap-2"><Switch checked={rule.is_active} onCheckedChange={value => toggleRule(rule, value)} /><span className="text-sm">Enabled</span></div><Button variant="outline" size="sm" onClick={() => openRule(rule)}>Edit</Button></div></CardContent></Card>)}</div>
        )}
        {pages > 1 && <div className="mt-6 flex items-center justify-center gap-3"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(value => value - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">Page {page} of {pages}</span><Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage(value => value + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button></div>}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{editing?.id ? 'Edit delivery rule' : 'Add delivery area'}</DialogTitle></DialogHeader>{editing && <form className="space-y-4" onSubmit={saveRule}><div><Label htmlFor="rule-pincode">Pincode</Label><Input id="rule-pincode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={editing.pincode} disabled={Boolean(editing.id)} onChange={event => setEditing({ ...editing, pincode: event.target.value.replace(/\D/g, '') })} required /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="rule-city">City</Label><Input id="rule-city" value={editing.city} onChange={event => setEditing({ ...editing, city: event.target.value })} required /></div><div><Label htmlFor="rule-state">State</Label><Input id="rule-state" value={editing.state} onChange={event => setEditing({ ...editing, state: event.target.value })} required /></div></div><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="rule-days">Delivery days</Label><Input id="rule-days" type="number" min="1" max="30" value={editing.delivery_days} onChange={event => setEditing({ ...editing, delivery_days: Number(event.target.value) })} required /></div><div><Label htmlFor="rule-charge">Delivery charge (₹)</Label><Input id="rule-charge" type="number" min="0" step="0.01" value={editing.delivery_charge} onChange={event => setEditing({ ...editing, delivery_charge: Number(event.target.value) })} required /></div></div><div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="rule-cod">Cash on delivery</Label><Switch id="rule-cod" checked={editing.cod_available} onCheckedChange={cod_available => setEditing({ ...editing, cod_available })} /></div><div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="rule-active">Area enabled</Label><Switch id="rule-active" checked={editing.is_active} onCheckedChange={is_active => setEditing({ ...editing, is_active })} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save rule'}</Button></DialogFooter></form>}</DialogContent></Dialog>
    </main>
  );
}
