import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Search, RefreshCw, Package, CreditCard, Download, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const statuses = ['all', 'pending', 'payment_pending', 'confirmed', 'processing', 'packed', 'ready_for_shipment', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'return_requested', 'returned', 'refund_initiated', 'refunded'];
const nextActions = {
  confirmed: ['processing', 'Accept & process'], processing: ['packed', 'Mark packed'],
  packed: ['ready_for_shipment', 'Ready for shipment'], ready_for_shipment: ['shipped', 'Confirm shipped'],
  shipped: ['out_for_delivery', 'Out for delivery'], out_for_delivery: ['delivered', 'Confirm delivered'],
};

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));
}

function statusStyle(status) {
  if (['paid', 'delivered', 'confirmed', 'refunded'].includes(status)) return 'bg-emerald-100 text-emerald-800';
  if (['failed', 'cancelled', 'payment_failed'].includes(status)) return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

export default function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refundOrder, setRefundOrder] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState('');
  const [labelLoading, setLabelLoading] = useState('');
  const [statusLoading, setStatusLoading] = useState('');
  const refundIdempotencyKey = useRef('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/admin/orders`, { params: {
        q: query || undefined, order_status: status === 'all' ? undefined : status,
        page, page_size: 30,
      }});
      setOrders(response.data.items || []);
      setTotal(response.data.total || 0);
      setPages(response.data.pages || 1);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to load orders');
    } finally {
      setLoading(false);
    }
  }, [query, status, page]);

  useEffect(() => {
    const timer = setTimeout(fetchOrders, 250);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  function openRefund(order) {
    setRefundOrder(order);
    setRefundAmount(String(order.total_amount));
    setRefundReason('');
    refundIdempotencyKey.current = `admin-refund-${order.id}-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
  }

  async function submitRefund() {
    if (!refundOrder || Number(refundAmount) <= 0 || refundReason.trim().length < 3) {
      toast.error('Enter a valid amount and refund reason');
      return;
    }
    setRefunding(true);
    try {
      await axios.post(`${API_URL}/admin/orders/${refundOrder.id}/refund`, {
        amount: Number(refundAmount), reason: refundReason.trim(),
      }, { headers: { 'Idempotency-Key': refundIdempotencyKey.current } });
      toast.success('Refund submitted to the payment provider');
      setRefundOrder(null);
      fetchOrders();
    } catch (requestError) {
      toast.error(requestError.response?.data?.detail || 'Refund could not be created');
    } finally {
      setRefunding(false);
    }
  }

  async function downloadInvoice(order) {
    setInvoiceLoading(order.id);
    try {
      await axios.post(`${API_URL}/orders/${order.id}/invoices`);
      const response = await axios.get(`${API_URL}/orders/${order.id}/invoice-download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `perfurm-invoice-${order.id}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Invoice downloaded');
    } catch (requestError) {
      toast.error(requestError.response?.data?.detail || 'Invoice is not available yet');
    } finally {
      setInvoiceLoading('');
    }
  }

  async function downloadLabel(order) {
    setLabelLoading(order.id);
    try {
      await axios.post(`${API_URL}/shipping-labels`, { order_id: order.id, warehouse_id: 'PERFURM-MAIN', weight: 0.5 });
      const response = await axios.get(`${API_URL}/shipping-labels/${order.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `perfurm-label-${order.id}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Printable 4×6 shipping label downloaded');
      fetchOrders();
    } catch (requestError) {
      toast.error(requestError.response?.data?.detail || 'Shipping label could not be generated');
    } finally {
      setLabelLoading('');
    }
  }

  async function advanceOrder(order, nextStatus) {
    setStatusLoading(order.id);
    try {
      await axios.put(`${API_URL}/orders/${order.id}/status`, null, { params: { status: nextStatus } });
      toast.success(`Order updated to ${nextStatus.replaceAll('_', ' ')}`);
      fetchOrders();
    } catch (requestError) { toast.error(requestError.response?.data?.detail || 'Order status could not be updated'); }
    finally { setStatusLoading(''); }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-3 py-5 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#7d4956]">Commerce operations</p>
            <h1 className="display-serif text-3xl font-semibold mt-1">Orders</h1>
            <p className="text-sm text-stone-500 mt-1">{total} orders across the platform</p>
          </div>
          <Button variant="outline" onClick={fetchOrders}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
        </div>

        <Card className="mb-5">
          <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Order, tracking or payment ID" className="pl-9" />
            </div>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map(item => <SelectItem key={item} value={item}>{item.replaceAll('_', ' ')}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>

        {error ? (
          <Card><CardContent className="p-10 text-center"><p className="text-red-700" role="alert">{error}</p><Button variant="outline" className="mt-4" onClick={fetchOrders}>Try again</Button></CardContent></Card>
        ) : loading ? (
          <div className="grid gap-3">{[1,2,3].map(item => <div key={item} className="h-36 rounded-lg bg-stone-200 animate-pulse" />)}</div>
        ) : orders.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><Package className="w-12 h-12 mx-auto text-stone-400 mb-3" /><p>No matching orders</p></CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {orders.map(order => (
              <Card key={order.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold truncate">#{order.id}</p>
                        <Badge className={statusStyle(order.status)}>{order.status?.replaceAll('_', ' ')}</Badge>
                        <Badge className={statusStyle(order.payment_status)}>{order.payment_status?.replaceAll('_', ' ')}</Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
                        <div><p className="text-stone-500">Placed</p><p>{new Date(order.created_at).toLocaleDateString()}</p></div>
                        <div><p className="text-stone-500">Items</p><p>{order.items?.reduce((sum, item) => sum + item.quantity, 0)}</p></div>
                        <div><p className="text-stone-500">Payment</p><p className="capitalize">{order.payment_method || '—'}</p></div>
                        <div><p className="text-stone-500">Total</p><p className="font-semibold">{money(order.total_amount)}</p></div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {nextActions[order.status] && (
                        <Button onClick={() => advanceOrder(order, nextActions[order.status][0])} disabled={statusLoading === order.id}>
                          <Package className="mr-2 h-4 w-4" />{statusLoading === order.id ? 'Updating…' : nextActions[order.status][1]}
                        </Button>
                      )}
                      {['confirmed', 'processing'].includes(order.status) && (
                        <Button variant="outline" className="text-red-700" onClick={() => window.confirm('Cancel this order and restore its stock?') && advanceOrder(order, 'cancelled')} disabled={statusLoading === order.id}>Cancel order</Button>
                      )}
                      {!['pending', 'payment_pending', 'payment_failed', 'cancelled'].includes(order.status) && (
                        <Button variant="outline" onClick={() => downloadInvoice(order)} disabled={invoiceLoading === order.id}>
                          <Download className="w-4 h-4 mr-2" /> {invoiceLoading === order.id ? 'Preparing…' : 'Invoice'}
                        </Button>
                      )}
                      {!['pending', 'payment_pending', 'payment_failed', 'cancelled'].includes(order.status) && (
                        <Button variant="outline" onClick={() => downloadLabel(order)} disabled={labelLoading === order.id}>
                          <Tag className="w-4 h-4 mr-2" /> {labelLoading === order.id ? 'Preparing…' : 'Shipping label'}
                        </Button>
                      )}
                      {['paid', 'partially_refunded'].includes(order.payment_status) && (
                        <Button variant="outline" onClick={() => openRefund(order)}><CreditCard className="w-4 h-4 mr-2" /> Refund</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 mt-6">
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm">Page {page} of {pages}</span>
          <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage(value => value + 1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      <Dialog open={Boolean(refundOrder)} onOpenChange={(open) => !open && setRefundOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create refund</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="refund-amount">Amount</Label><Input id="refund-amount" type="number" min="0.01" step="0.01" max={refundOrder?.total_amount} value={refundAmount} onChange={event => setRefundAmount(event.target.value)} /></div>
            <div><Label htmlFor="refund-reason">Reason</Label><Textarea id="refund-reason" value={refundReason} onChange={event => setRefundReason(event.target.value)} placeholder="Reason recorded in the audit history" /></div>
            <p className="text-xs text-stone-500">The provider webhook confirms the final refund status. This action does not store card details.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRefundOrder(null)}>Cancel</Button><Button onClick={submitRefund} disabled={refunding}>{refunding ? 'Submitting…' : 'Confirm refund'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
