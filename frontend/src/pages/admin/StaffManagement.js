import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldCheck, UserPlus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
const EMPTY_FORM = { name: '', email: '', password: '', admin_role: 'order_manager' };
const ROLES = [
  ['admin', 'Operations admin'], ['product_manager', 'Product manager'],
  ['inventory_manager', 'Inventory manager'], ['order_manager', 'Order manager'],
  ['customer_support', 'Customer support'], ['marketing_manager', 'Marketing manager'],
  ['content_manager', 'Content manager'], ['finance_manager', 'Finance manager'],
  ['read_only_analyst', 'Read-only analyst'],
];

const roleLabel = (role) => ROLES.find(([value]) => value === role)?.[1] || role?.replaceAll('_', ' ') || 'Administrator';

export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showAdminStaff, setShowAdminStaff] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/admin/staff`);
      setStaff(response.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to load administrative staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  async function createStaff(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await axios.post(`${API_URL}/admin/staff`, form);
      toast.success('Administrator account created');
      setForm(EMPTY_FORM);
      setDialogOpen(false);
      fetchStaff();
    } catch (requestError) {
      toast.error(requestError.response?.data?.detail || 'Administrator could not be created');
    } finally {
      setSaving(false);
    }
  }

  async function updateStaff(member, changes) {
    try {
      await axios.put(`${API_URL}/admin/staff/${member.id}`, changes);
      toast.success('Access updated');
      fetchStaff();
    } catch (requestError) {
      toast.error(requestError.response?.data?.detail || 'Access could not be updated');
    }
  }

  async function removeStaff(member) {
    if (!window.confirm(`Remove ${member.name}'s Admin access? Their active sessions will be revoked.`)) return;
    try { await axios.delete(`${API_URL}/admin/staff/${member.id}`); toast.success('Administrator removed'); fetchStaff(); }
    catch (requestError) { toast.error(requestError.response?.data?.detail || 'Administrator could not be removed'); }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#7d4956]">Security &amp; governance</p>
            <h1 className="display-serif mt-1 text-3xl font-semibold">Admin departments</h1>
            <p className="mt-1 text-sm text-stone-500">Every operator keeps the Admin profile; departments control only the business tools they can access.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchStaff}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
            <Button onClick={() => setDialogOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Add staff</Button>
          </div>
        </div>
        <Card className="mb-5"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{showAdminStaff ? 'Admin staff' : 'Super Admin owners'}</p><p className="text-xs text-stone-500">Toggle on to manage operational Admin accounts. It does not reduce Super Admin authority.</p></div><div className="flex items-center gap-3"><Label htmlFor="staff-view-mode">Show Admin staff</Label><Switch id="staff-view-mode" checked={showAdminStaff} onCheckedChange={setShowAdminStaff} /></div></CardContent></Card>

        {error ? (
          <Card><CardContent className="p-10 text-center"><p className="text-red-700" role="alert">{error}</p><Button className="mt-4" variant="outline" onClick={fetchStaff}>Try again</Button></CardContent></Card>
        ) : loading ? (
          <div className="grid gap-3 md:grid-cols-2">{[1, 2, 3, 4].map(item => <div key={item} className="h-44 animate-pulse rounded-xl bg-stone-200" />)}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {staff.filter(member => showAdminStaff ? member.admin_role !== 'super_admin' : member.admin_role === 'super_admin').map(member => {
              const protectedAccount = member.admin_role === 'super_admin';
              return (
                <Card key={member.id} className="overflow-hidden">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate font-semibold">{member.name}</h2>
                          <Badge variant={member.is_active ? 'default' : 'secondary'}>{member.is_active ? 'Active' : 'Disabled'}</Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-stone-500">{member.email}</p>
                      </div>
                      <ShieldCheck className="h-6 w-6 shrink-0 text-[#7d4956]" />
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div>
                        <Label>Department access</Label>
                        {protectedAccount ? (
                          <p className="mt-2 text-sm font-medium">Super administrator</p>
                        ) : (
                          <Select value={member.admin_role || 'admin'} onValueChange={admin_role => updateStaff(member, { admin_role })}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>{ROLES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:pb-2">
                        <Label htmlFor={`active-${member.id}`}>Account active</Label>
                        <Switch id={`active-${member.id}`} checked={member.is_active} disabled={protectedAccount} onCheckedChange={is_active => updateStaff(member, { is_active })} />
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-stone-500">{protectedAccount ? 'Protected owner account' : `${member.permissions?.length || 0} permissions · ${roleLabel(member.admin_role)}`}</p>
                    {!protectedAccount && <Button variant="outline" className="mt-4 w-full text-red-700 hover:bg-red-50" onClick={() => removeStaff(member)}><Trash2 className="mr-2 h-4 w-4" />Remove administrator</Button>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Add delegated administrator</DialogTitle></DialogHeader>
          <form onSubmit={createStaff} className="space-y-4">
            <div><Label htmlFor="staff-name">Full name</Label><Input id="staff-name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} minLength={2} maxLength={100} required /></div>
            <div><Label htmlFor="staff-email">Work email</Label><Input id="staff-email" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required /></div>
            <div><Label htmlFor="staff-password">Temporary password</Label><Input id="staff-password" type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} minLength={10} autoComplete="new-password" required /><p className="mt-1 text-xs text-stone-500">At least 10 characters with uppercase, lowercase, number and symbol.</p></div>
            <div><Label>Department access</Label><Select value={form.admin_role} onValueChange={admin_role => setForm({ ...form, admin_role })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{ROLES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create account'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
