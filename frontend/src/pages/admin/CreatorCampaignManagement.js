import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Image, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
const EMPTY = { title: '', creator_name: '', media_url: '', media_type: 'image', thumbnail_url: '', caption: '', destination_url: '', social_channel: 'instagram', campaign_code: '', display_order: 0 };

export default function CreatorCampaignManagement() {
  const [campaigns, setCampaigns] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try { const response = await axios.get(`${API_URL}/creator-campaigns`); setCampaigns(response.data || []); }
    catch { toast.error('Could not load creator campaigns'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async event => {
    event.preventDefault(); setSaving(true);
    try { await axios.post(`${API_URL}/admin/creator-campaigns`, { ...form, display_order: Number(form.display_order || 0), thumbnail_url: form.thumbnail_url || null, caption: form.caption || null, destination_url: form.destination_url || null, campaign_code: form.campaign_code || null }); setOpen(false); setForm(EMPTY); await load(); toast.success('Creator campaign published'); }
    catch (error) { toast.error(error.response?.data?.detail || 'Campaign could not be published'); }
    finally { setSaving(false); }
  };
  const archive = async id => { await axios.delete(`${API_URL}/admin/creator-campaigns/${id}`); await load(); toast.success('Campaign archived'); };

  return <main className="min-h-screen bg-stone-50 px-3 py-6 sm:px-6">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-[#7d4956]">Marketing CMS</p><h1 className="display-serif text-3xl font-semibold">Creator campaigns</h1><p className="text-sm text-stone-500">Publish influencer photos or hosted videos to the draggable storefront rail.</p></div><div className="flex gap-2"><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add campaign</Button></div></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{campaigns.map(campaign => <Card key={campaign.id} className="overflow-hidden"><div className="aspect-video bg-stone-200">{campaign.media_type === 'video' ? <video src={campaign.media_url} poster={campaign.thumbnail_url} className="h-full w-full object-cover" controls /> : <img src={campaign.media_url} alt="" className="h-full w-full object-cover" />}</div><CardContent className="p-4"><p className="text-xs uppercase text-stone-500">{campaign.social_channel} · {campaign.creator_name}</p><h2 className="mt-1 font-semibold">{campaign.title}</h2><div className="mt-4 flex items-center justify-between"><span className="text-sm text-stone-500">{campaign.likes || 0} likes</span><Button size="sm" variant="outline" onClick={() => archive(campaign.id)}><Trash2 className="mr-1 h-4 w-4" />Archive</Button></div></CardContent></Card>)}</div>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Publish creator campaign</DialogTitle></DialogHeader><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label>Campaign title</Label><Input value={form.title} onChange={e => setForm({...form,title:e.target.value})} required /></div>
      <div><Label>Creator name</Label><Input value={form.creator_name} onChange={e => setForm({...form,creator_name:e.target.value})} required /></div>
      <div><Label>Social channel</Label><Select value={form.social_channel} onValueChange={social_channel => setForm({...form,social_channel})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['instagram','youtube','facebook','other'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Media type</Label><Select value={form.media_type} onValueChange={media_type => setForm({...form,media_type})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">Photo</SelectItem><SelectItem value="video">Video</SelectItem></SelectContent></Select></div>
      <div><Label>Campaign code</Label><Input value={form.campaign_code} onChange={e => setForm({...form,campaign_code:e.target.value})} /></div>
      <div className="sm:col-span-2"><Label>Media URL</Label><Input type="url" value={form.media_url} onChange={e => setForm({...form,media_url:e.target.value})} required /><p className="mt-1 text-xs text-stone-500">Use a direct image or MP4/WebM URL from your media host.</p></div>
      {form.media_type === 'video' && <div className="sm:col-span-2"><Label>Video thumbnail URL</Label><Input type="url" value={form.thumbnail_url} onChange={e => setForm({...form,thumbnail_url:e.target.value})} /></div>}
      <div className="sm:col-span-2"><Label>Caption</Label><Textarea value={form.caption} onChange={e => setForm({...form,caption:e.target.value})} maxLength={500} /></div>
      <div className="sm:col-span-2"><Label>Destination URL</Label><Input value={form.destination_url} onChange={e => setForm({...form,destination_url:e.target.value})} placeholder="/customer/category/all or https://…" /></div>
      <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving}>{saving ? 'Publishing…' : 'Publish'}</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </main>;
}
