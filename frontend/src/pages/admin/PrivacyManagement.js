import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, Clock, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function PrivacyManagement() {
  const navigate = useNavigate(); const { user } = useAuth();
  const [status, setStatus] = useState('pending'); const [items, setItems] = useState([]);
  const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { const response = await axios.get(`${API_URL}/admin/privacy/deletion-requests`, { params: { status: status === 'all' ? undefined : status, page, page_size: 20 } }); setItems(response.data.items); setPages(response.data.pages); } catch (error) { toast.error(error.response?.data?.detail || 'Unable to load privacy requests'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [status, page]); // eslint-disable-line react-hooks/exhaustive-deps
  const decide = async (request, nextStatus) => { const notes = window.prompt(`${nextStatus === 'approved' ? 'Approval' : 'Rejection'} notes`); if (!notes || notes.trim().length < 3) return; try { await axios.patch(`${API_URL}/admin/privacy/deletion-requests/${request.id}`, { status: nextStatus, notes: notes.trim() }); toast.success(`Request ${nextStatus}`); load(); } catch (error) { toast.error(error.response?.data?.detail || 'Decision failed'); } };
  const fulfill = async request => { if (!window.confirm('Permanently anonymize eligible customer data? This cannot be undone.')) return; try { await axios.post(`${API_URL}/admin/privacy/deletion-requests/${request.id}/fulfill`); toast.success('Customer data anonymized'); load(); } catch (error) { toast.error(error.response?.data?.detail || 'Anonymization failed'); } };
  const isSuper = user?.admin_role === 'super_admin';
  return <div className="min-h-screen bg-stone-50 p-3 sm:p-6"><div className="mx-auto max-w-6xl">
    <Button variant="ghost" onClick={() => navigate('/admin')}><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Button>
    <div className="my-5"><p className="text-xs uppercase tracking-[.2em] text-[#7d4956]">Privacy operations</p><h1 className="display-serif text-3xl font-semibold">Account deletion</h1><p className="max-w-2xl text-sm text-stone-500">Review authenticated requests, observe legal retention dates and anonymize only after eligibility. Completion is restricted to Super Admin.</p></div>
    <Select value={status} onValueChange={value => { setStatus(value); setPage(1); }}><SelectTrigger className="mb-5 w-full sm:w-52"><SelectValue /></SelectTrigger><SelectContent>{['pending','approved','rejected','completed','all'].map(value => <SelectItem key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</SelectItem>)}</SelectContent></Select>
    {loading ? <div className="py-20 text-center">Loading privacy queue…</div> : items.length === 0 ? <Card><CardContent className="py-16 text-center text-stone-500">No requests in this queue.</CardContent></Card> : <div className="space-y-3">{items.map(request => { const eligible = request.eligible_at && new Date(request.eligible_at) <= new Date(); return <Card key={request.id}><CardContent className="p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><Badge>{request.status}</Badge>{request.eligible_at && <Badge variant="outline" className={eligible ? 'text-green-700' : 'text-amber-700'}><Clock className="mr-1 h-3 w-3" />{eligible ? 'Eligible' : `Retain until ${new Date(request.eligible_at).toLocaleDateString()}`}</Badge>}</div><p className="mt-3 break-all font-medium">{request.email || `Customer ${request.user_id}`}</p><p className="mt-1 text-sm text-stone-600">{request.reason || 'No reason provided'}</p><p className="mt-2 text-xs text-stone-400">Requested {new Date(request.requested_at).toLocaleString()}</p>{request.decision_notes && <p className="mt-2 rounded-lg bg-stone-100 p-2 text-sm">Decision: {request.decision_notes}</p>}</div><div className="flex flex-wrap gap-2 lg:w-80 lg:justify-end">{request.status === 'pending' && <><Button size="sm" onClick={() => decide(request,'approved')}><CheckCircle className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="destructive" onClick={() => decide(request,'rejected')}><XCircle className="mr-1 h-4 w-4" />Reject</Button></>}{request.status === 'approved' && isSuper && <Button size="sm" variant="destructive" disabled={!eligible} onClick={() => fulfill(request)}><Trash2 className="mr-1 h-4 w-4" />Anonymize</Button>}{request.status === 'completed' && <span className="flex items-center text-sm text-green-700"><ShieldCheck className="mr-1 h-4 w-4" />Completed</span>}</div></div></CardContent></Card>; })}</div>}
    {pages > 1 && <div className="mt-6 flex items-center justify-center gap-3"><Button size="icon" variant="outline" disabled={page <= 1} onClick={() => setPage(value => value-1)}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">Page {page} of {pages}</span><Button size="icon" variant="outline" disabled={page >= pages} onClick={() => setPage(value => value+1)}><ChevronRight className="h-4 w-4" /></Button></div>}
  </div></div>;
}
