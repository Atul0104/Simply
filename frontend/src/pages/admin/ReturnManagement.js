import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, ChevronLeft, ChevronRight, PackageCheck, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
const statuses = ['all', 'pending', 'approved', 'rejected', 'pickup_scheduled', 'received', 'completed', 'cancelled'];

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));
}

function nextActions(item) {
  if (item.status === 'pending') return ['approved', 'rejected', 'cancelled'];
  if (item.status === 'approved') return ['pickup_scheduled', 'received', 'cancelled'];
  if (item.status === 'pickup_scheduled') return ['received', 'cancelled'];
  if (item.status === 'received') return ['completed'];
  return [];
}

export default function ReturnManagement() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [disposition, setDisposition] = useState('restock');
  const [saving, setSaving] = useState(false);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/admin/return-requests`, { params: {
        status: status === 'all' ? undefined : status, page, page_size: 25,
      }});
      setItems(response.data.items || []);
      setPages(response.data.pages || 1);
      setTotal(response.data.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to load return requests');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  function openAction(item, nextStatus) {
    setAction({ item, nextStatus });
    setRemarks('');
    setDisposition('restock');
  }

  async function submitAction() {
    if (!action) return;
    setSaving(true);
    try {
      await axios.put(`${API_URL}/return-requests/${action.item.id}/status`, {
        status: action.nextStatus,
        admin_remarks: remarks.trim() || null,
        inventory_disposition: action.nextStatus === 'received' ? disposition : null,
      });
      toast.success(`Request moved to ${action.nextStatus.replaceAll('_', ' ')}`);
      setAction(null);
      fetchReturns();
    } catch (requestError) {
      toast.error(requestError.response?.data?.detail || 'The request could not be updated');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Button variant="ghost" className="-ml-3 mb-2" onClick={() => navigate('/admin')}><ArrowLeft className="mr-2 h-4 w-4" />Admin dashboard</Button>
            <p className="text-xs uppercase tracking-[0.2em] text-[#7d4956]">Reverse logistics</p>
            <h1 className="display-serif mt-1 text-3xl font-semibold">Returns and cancellations</h1>
            <p className="mt-1 text-sm text-stone-500">{total} matching requests</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map(value => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchReturns}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          </div>
        </div>

        {error ? (
          <Card><CardContent className="p-10 text-center"><p role="alert" className="text-red-700">{error}</p><Button className="mt-4" variant="outline" onClick={fetchReturns}>Try again</Button></CardContent></Card>
        ) : loading ? (
          <div className="grid gap-3">{[1, 2, 3].map(value => <div key={value} className="h-44 animate-pulse rounded-xl bg-stone-200" />)}</div>
        ) : items.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><PackageCheck className="mx-auto mb-3 h-12 w-12 text-stone-400" /><p>No matching requests</p></CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {items.map(item => (
              <Card key={item.id}><CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">Order #{item.order_id}</p>
                      <Badge variant="outline" className="capitalize">{item.request_type}</Badge>
                      <Badge className="capitalize">{item.status.replaceAll('_', ' ')}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-stone-700">{item.reason}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div><p className="text-stone-500">Requested</p><p>{new Date(item.created_at).toLocaleDateString()}</p></div>
                      <div><p className="text-stone-500">Items</p><p>{item.item_snapshot?.reduce((sum, row) => sum + row.quantity, 0) || 0}</p></div>
                      <div><p className="text-stone-500">Eligible value</p><p className="font-semibold">{money(item.eligible_refund_amount)}</p></div>
                      <div><p className="text-stone-500">Disposition</p><p className="capitalize">{item.inventory_disposition || 'Pending'}</p></div>
                    </div>
                    {item.admin_remarks && <p className="mt-3 rounded-md bg-stone-100 p-3 text-sm"><strong>Operations note:</strong> {item.admin_remarks}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
                    {nextActions(item).map(nextStatus => (
                      <Button key={nextStatus} variant={nextStatus === 'approved' || nextStatus === 'completed' ? 'default' : 'outline'} onClick={() => openAction(item, nextStatus)} className="capitalize">
                        {nextStatus.replaceAll('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent></Card>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button aria-label="Previous page" variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm">Page {page} of {pages}</span>
          <Button aria-label="Next page" variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage(value => value + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Dialog open={Boolean(action)} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="capitalize">{action?.nextStatus.replaceAll('_', ' ')} request</DialogTitle></DialogHeader>
          {action?.nextStatus === 'received' && <div><Label>Inventory disposition</Label><Select value={disposition} onValueChange={setDisposition}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="restock">Return to sellable stock</SelectItem><SelectItem value="damaged">Move to damaged stock</SelectItem></SelectContent></Select></div>}
          <div><Label htmlFor="return-remarks">Operations note</Label><Textarea id="return-remarks" value={remarks} onChange={event => setRemarks(event.target.value)} maxLength={1000} placeholder="Reason, inspection result, or next step" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setAction(null)}>Cancel</Button><Button disabled={saving} onClick={submitAction}>{saving ? 'Saving…' : 'Confirm transition'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
