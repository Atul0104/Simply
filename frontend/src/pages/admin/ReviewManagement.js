import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle, Flag, Search, Star, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function ReviewManagement() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('pending');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/admin/reviews`, { params: { status: status === 'all' ? undefined : status, q: query || undefined, page, page_size: 20 } });
      setItems(response.data.items); setPages(response.data.pages);
    } catch (error) { toast.error(error.response?.data?.detail || 'Unable to load reviews'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const moderate = async (review, nextStatus) => {
    const reason = window.prompt(`Reason for ${nextStatus}:`, nextStatus === 'approved' ? 'Verified review meets community guidelines' : 'Does not meet community guidelines');
    if (!reason || reason.trim().length < 3) return;
    try {
      await axios.patch(`${API_URL}/admin/reviews/${review.id}`, { status: nextStatus, reason: reason.trim() });
      toast.success(`Review ${nextStatus}`); load();
    } catch (error) { toast.error(error.response?.data?.detail || 'Moderation failed'); }
  };

  return <div className="min-h-screen bg-stone-50 p-3 sm:p-6">
    <div className="mx-auto max-w-6xl">
      <Button variant="ghost" onClick={() => navigate('/admin')}><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Button>
      <div className="my-5"><p className="text-xs uppercase tracking-[.2em] text-[#7d4956]">Trust & safety</p><h1 className="display-serif text-3xl font-semibold">Review moderation</h1><p className="text-sm text-stone-500">Only approved, verified-purchase reviews appear publicly.</p></div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger><SelectContent>{['pending','approved','flagged','rejected','all'].map(value => <SelectItem key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</SelectItem>)}</SelectContent></Select>
        <form className="flex flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); load(); }}><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Customer, product or review text" /><Button type="submit" variant="outline"><Search className="h-4 w-4" /></Button></form>
      </div>
      {loading ? <div className="py-20 text-center">Loading moderation queue…</div> : items.length === 0 ? <Card><CardContent className="py-16 text-center text-stone-500">No reviews in this queue.</CardContent></Card> : <div className="space-y-3">{items.map(review => <Card key={review.id}><CardContent className="p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge>{review.moderation_status || 'legacy'}</Badge>{review.verified_purchase && <Badge variant="outline" className="text-green-700">Verified purchase</Badge>}<span className="flex text-amber-500">{Array.from({length:5},(_,i)=><Star key={i} className={`h-4 w-4 ${i < review.rating ? 'fill-current' : 'text-stone-300'}`} />)}</span></div><p className="mt-3 text-sm font-semibold">{review.customer_name}</p><p className="mt-1 whitespace-pre-wrap text-stone-700">{review.comment || 'Rating only'}</p><p className="mt-3 break-all text-xs text-stone-400">Product {review.product_id} · Order {review.order_id}</p></div><div className="grid grid-cols-3 gap-2 lg:w-72"><Button size="sm" onClick={() => moderate(review,'approved')}><CheckCircle className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" onClick={() => moderate(review,'flagged')}><Flag className="mr-1 h-4 w-4" />Flag</Button><Button size="sm" variant="destructive" onClick={() => moderate(review,'rejected')}><XCircle className="mr-1 h-4 w-4" />Reject</Button></div></div></CardContent></Card>)}</div>}
      {pages > 1 && <div className="mt-6 flex items-center justify-center gap-3"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(value => value-1)}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">Page {page} of {pages}</span><Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage(value => value+1)}><ChevronRight className="h-4 w-4" /></Button></div>}
    </div>
  </div>;
}
