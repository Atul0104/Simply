import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import { LocateFixed } from 'lucide-react';
import axios from 'axios';
import { useState } from 'react';
import { toast } from 'sonner';
import { validateAddressField } from '@/lib/addressValidation';

const FieldError = ({ id, message }) => message ? (
  <p id={id} role="alert" className="mt-1 flex items-start gap-1 text-xs font-medium text-red-600">
    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{message}
  </p>
) : null;

export default function AddressFormFields({ form, setForm, errors, setErrors, onPincodeChange, pincodeLoading = false }) {
  const [locating, setLocating] = useState(false);
  const [locationFetched, setLocationFetched] = useState(false);
  const useCurrentLocation = () => {
    if (!navigator.geolocation) return toast.error('Location is not supported on this device');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/location/reverse`, { params: { latitude: coords.latitude, longitude: coords.longitude }, headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        const found = response.data;
        setForm(current => ({ ...current, city: found.city || current.city, state: found.state || current.state, pincode: /^\d{6}$/.test(found.pincode || '') ? found.pincode : current.pincode, address_line2: found.address_line2 || current.address_line2 }));
        setErrors(current => ({ ...current, city: '', state: '', pincode: '' }));
        setLocationFetched(true); toast.success('Current location fetched. Please confirm the address details.');
      } catch (error) { toast.error(error.response?.data?.detail || 'Could not fetch your current address'); }
      finally { setLocating(false); }
    }, () => { setLocating(false); toast.error('Location permission was denied. Allow location access or enter the address manually.'); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  };
  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: validateAddressField(field, value) }));
  };
  const blur = (field) => setErrors((current) => ({ ...current, [field]: validateAddressField(field, form[field]) }));
  const inputProps = (field) => ({
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `${field}-error` : undefined,
    className: errors[field] ? 'border-red-500 focus-visible:ring-red-500' : undefined,
    onBlur: () => blur(field),
  });

  return <div className="space-y-4 py-4">
    <Button type="button" variant="outline" className="w-full border-[#7d4956]/30 text-[#7d4956]" onClick={useCurrentLocation} disabled={locating}><LocateFixed className="mr-2 h-4 w-4" />{locating ? 'Fetching current address…' : 'Use my current location'}</Button>
    {locationFetched && <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Location details were filled automatically. Please verify the pincode, city, state, and enter the exact house/building before saving.</p>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="address-name">Full Name *</Label>
        <Input id="address-name" value={form.name} onChange={(e) => update('name', e.target.value)} maxLength={100} autoComplete="name" placeholder="Enter full name" {...inputProps('name')} />
        <FieldError id="name-error" message={errors.name} />
      </div>
      <div>
        <Label htmlFor="address-phone">Phone Number *</Label>
        <div className="flex"><span className="flex items-center rounded-l-md border border-r-0 bg-gray-50 px-3 text-sm text-gray-600">+91</span>
          <Input id="address-phone" value={form.phone} onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" autoComplete="tel" maxLength={10} placeholder="10-digit mobile number" {...inputProps('phone')} className={`${errors.phone ? 'border-red-500 focus-visible:ring-red-500 ' : ''}rounded-l-none`} />
        </div>
        <FieldError id="phone-error" message={errors.phone} />
      </div>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="address-pincode">Pincode *</Label>
        <Input id="address-pincode" value={form.pincode} onChange={(e) => { const value=e.target.value.replace(/\D/g, '').slice(0, 6); update('pincode', value); onPincodeChange(value); }} inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="6-digit pincode" {...inputProps('pincode')} />
        {pincodeLoading && <p className="mt-1 text-xs text-blue-600" aria-live="polite">Checking delivery location…</p>}
        <FieldError id="pincode-error" message={errors.pincode} />
      </div>
      <div>
        <Label>Address Type *</Label>
        <Select value={form.address_type} onValueChange={(value) => update('address_type', value)}>
          <SelectTrigger aria-invalid={Boolean(errors.address_type)} className={errors.address_type ? 'border-red-500' : ''}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="home">Home</SelectItem><SelectItem value="work">Work</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
        </Select>
        <FieldError id="address_type-error" message={errors.address_type} />
      </div>
    </div>
    <div>
      <Label htmlFor="address-line-1">Address Line 1 *</Label>
      <Input id="address-line-1" value={form.address_line1} onChange={(e) => update('address_line1', e.target.value)} maxLength={250} autoComplete="address-line1" placeholder="House No., building, street" {...inputProps('address_line1')} />
      <FieldError id="address_line1-error" message={errors.address_line1} />
    </div>
    <div>
      <Label htmlFor="address-line-2">Address Line 2 (Optional)</Label>
      <Input id="address-line-2" value={form.address_line2} onChange={(e) => update('address_line2', e.target.value)} maxLength={250} autoComplete="address-line2" placeholder="Area, colony" {...inputProps('address_line2')} />
      <FieldError id="address_line2-error" message={errors.address_line2} />
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div><Label htmlFor="address-city">City *</Label><Input id="address-city" value={form.city} onChange={(e) => update('city', e.target.value)} maxLength={100} autoComplete="address-level2" placeholder="City" {...inputProps('city')} /><FieldError id="city-error" message={errors.city} /></div>
      <div><Label htmlFor="address-state">State *</Label><Input id="address-state" value={form.state} onChange={(e) => update('state', e.target.value)} maxLength={100} autoComplete="address-level1" placeholder="State" {...inputProps('state')} /><FieldError id="state-error" message={errors.state} /></div>
    </div>
    <div>
      <Label htmlFor="address-landmark">Landmark (Optional)</Label>
      <Input id="address-landmark" value={form.landmark} onChange={(e) => update('landmark', e.target.value)} maxLength={150} placeholder="Nearby landmark" {...inputProps('landmark')} />
      <FieldError id="landmark-error" message={errors.landmark} />
    </div>
    <div className="flex items-center gap-2"><input type="checkbox" id="address-default" checked={form.is_default} onChange={(e) => update('is_default', e.target.checked)} className="rounded" /><Label htmlFor="address-default">Set as default address</Label></div>
  </div>;
}
