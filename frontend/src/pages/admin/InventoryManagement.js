import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, ChevronLeft, ChevronRight, Package, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function InventoryManagement() {
  const [items, setItems] = useState([]); const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1); const [pages, setPages] = useState(1);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); const [quantity, setQuantity] = useState('');
  const [threshold, setThreshold] = useState(''); const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await axios.get(`${API_URL}/admin/inventory/variants`, { params: { q: query || undefined, low_stock: filter === 'all' ? undefined : filter === 'low', page, page_size: 30 } });
      setItems(response.data.items || []); setTotal(response.data.total || 0); setPages(response.data.pages || 1);
    } catch (requestError) { setError(requestError.response?.data?.detail || 'Unable to load inventory'); }
    finally { setLoading(false); }
  }, [filter, page, query]);
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);

  function open(item) { setEditing(item); setQuantity(String(item.stock_quantity)); setThreshold(String(item.low_stock_threshold)); }
  async function save(event) {
    event.preventDefault(); setSaving(true);
    try {
      await axios.put(`${API_URL}/admin/inventory/variants/${editing.variant_id}`, { stock_quantity: Number(quantity), low_stock_threshold: Number(threshold) });
      toast.success('Bottle-size inventory updated'); setEditing(null); load();
    } catch (requestError) { toast.error(requestError.response?.data?.detail || 'Inventory could not be updated'); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-stone-50 px-3 py-5 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-[#7d4956]">Stock control</p><h1 className="display-serif mt-1 text-3xl font-semibold">Inventory by bottle size</h1><p className="mt-1 text-sm text-stone-500">{total} variants · reserved stock cannot be manually removed</p></div><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>
    <Card className="mb-5"><CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:p-4"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"/><Input className="pl-9" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Search product, SKU or brand"/></div><Select value={filter} onValueChange={value=>{setFilter(value);setPage(1);}}><SelectTrigger className="w-full sm:w-48"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All stock</SelectItem><SelectItem value="low">Low stock</SelectItem><SelectItem value="healthy">Healthy stock</SelectItem></SelectContent></Select></CardContent></Card>
    {error ? <Card><CardContent className="p-10 text-center text-red-700">{error}</CardContent></Card> : loading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1,2,3].map(i=><div key={i} className="h-48 animate-pulse rounded-xl bg-stone-200"/>)}</div> : items.length === 0 ? <Card><CardContent className="p-12 text-center"><Package className="mx-auto mb-3 h-12 w-12 text-stone-400"/>No matching bottle sizes</CardContent></Card> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map(item => { const low=item.available_quantity<=item.low_stock_threshold; return <Card key={item.variant_id}><CardContent className="p-4"><div className="flex gap-3"><img src={item.product_image || '/placeholder-perfume.svg'} alt="" className="h-20 w-16 rounded-lg bg-stone-100 object-contain p-1"/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h2 className="truncate font-semibold">{item.product_name}</h2>{low&&<Badge className="bg-red-100 text-red-800"><AlertTriangle className="mr-1 h-3 w-3"/>Low</Badge>}</div><p className="text-sm text-stone-500">{item.size_label} · {item.sku}</p></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-lg bg-stone-50 p-2"><b>{item.stock_quantity}</b><p className="text-xs text-stone-500">Current</p></div><div className="rounded-lg bg-stone-50 p-2"><b>{item.reserved_quantity}</b><p className="text-xs text-stone-500">Reserved</p></div><div className="rounded-lg bg-stone-50 p-2"><b>{item.available_quantity}</b><p className="text-xs text-stone-500">Available</p></div></div><Button className="mt-4 w-full" variant="outline" onClick={()=>open(item)}>Adjust quantity</Button></CardContent></Card>;})}</div>}
    {pages>1&&<div className="mt-6 flex items-center justify-center gap-3"><Button size="icon" variant="outline" disabled={page<=1} onClick={()=>setPage(v=>v-1)}><ChevronLeft className="h-4 w-4"/></Button><span className="text-sm">Page {page} of {pages}</span><Button size="icon" variant="outline" disabled={page>=pages} onClick={()=>setPage(v=>v+1)}><ChevronRight className="h-4 w-4"/></Button></div>}
    <Dialog open={Boolean(editing)} onOpenChange={openState=>!openState&&setEditing(null)}><DialogContent><DialogHeader><DialogTitle>Adjust {editing?.product_name} · {editing?.size_label}</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-4"><div><Label htmlFor="stock-quantity">Total physical quantity</Label><Input id="stock-quantity" type="number" min={editing?.reserved_quantity || 0} step="1" required value={quantity} onChange={e=>setQuantity(e.target.value)}/><p className="mt-1 text-xs text-stone-500">Minimum {editing?.reserved_quantity || 0}, because reserved units belong to pending orders.</p></div><div><Label htmlFor="stock-threshold">Low-stock alert</Label><Input id="stock-threshold" type="number" min="0" step="1" required value={threshold} onChange={e=>setThreshold(e.target.value)}/></div><DialogFooter><Button type="button" variant="outline" onClick={()=>setEditing(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving?'Saving…':'Save quantity'}</Button></DialogFooter></form></DialogContent></Dialog>
  </div></main>;
}
