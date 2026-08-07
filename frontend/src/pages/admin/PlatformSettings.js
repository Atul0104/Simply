import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, Settings as SettingsIcon, Percent, CreditCard, Calendar, IndianRupee, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function PlatformSettings() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    platform_fee_percentage: 2.0,
    promotion_fee_percentage: 1.0,
    gst_percentage: 18.0,
    payment_cycle_days: 7,
    gift_wrap_enabled: true,
    gift_wrap_price: 49,
    sticker_enabled: true,
    sticker_price: 19
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/platform-settings`);
      setSettings(response.data);
    } catch (error) {
      toast.error('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        `${API_URL}/admin/platform-settings`,
        settings,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Platform settings updated successfully!');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Platform Settings</h1>
        <p className="text-gray-500 mt-1">Configure platform fees and payment cycles</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Fee Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Platform Fee (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={settings.platform_fee_percentage}
                onChange={(e) => setSettings({ ...settings, platform_fee_percentage: parseFloat(e.target.value) })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Commission charged from sellers per order</p>
            </div>

            <div>
              <Label>Promotion Fee (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={settings.promotion_fee_percentage}
                onChange={(e) => setSettings({ ...settings, promotion_fee_percentage: parseFloat(e.target.value) })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Additional fee for promotional services</p>
            </div>

            <div>
              <Label>GST (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={settings.gst_percentage}
                onChange={(e) => setSettings({ ...settings, gst_percentage: parseFloat(e.target.value) })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">GST charged from customers</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Cycle</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label>Payment Cycle (Days)</Label>
              <Input
                type="number"
                value={settings.payment_cycle_days}
                onChange={(e) => setSettings({ ...settings, payment_cycle_days: parseInt(e.target.value) })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Number of days between seller payouts (e.g., 7 for weekly)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Checkout Add-ons</CardTitle><CardDescription>Control which gift options customers can select and their server-authoritative prices.</CardDescription></CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-4"><div><Label htmlFor="gift-wrap-enabled">Premium gift wrap</Label><p className="text-xs text-gray-500">Show gift wrap during checkout</p></div><Switch id="gift-wrap-enabled" checked={Boolean(settings.gift_wrap_enabled)} onCheckedChange={gift_wrap_enabled => setSettings({ ...settings, gift_wrap_enabled })}/></div>
              <div><Label htmlFor="gift-wrap-price">Gift wrap price (₹)</Label><Input id="gift-wrap-price" type="number" min="0" max="10000" step="0.01" disabled={!settings.gift_wrap_enabled} value={settings.gift_wrap_price ?? 0} onChange={e => setSettings({ ...settings, gift_wrap_price: Number(e.target.value) })}/></div>
            </div>
            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-4"><div><Label htmlFor="sticker-enabled">Gift sticker</Label><p className="text-xs text-gray-500">Show the RAW sticker option</p></div><Switch id="sticker-enabled" checked={Boolean(settings.sticker_enabled)} onCheckedChange={sticker_enabled => setSettings({ ...settings, sticker_enabled })}/></div>
              <div><Label htmlFor="sticker-price">Sticker price (₹)</Label><Input id="sticker-price" type="number" min="0" max="10000" step="0.01" disabled={!settings.sticker_enabled} value={settings.sticker_price ?? 0} onChange={e => setSettings({ ...settings, sticker_price: Number(e.target.value) })}/></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-sm space-y-2">
              <p className="font-semibold">Fee Calculation Example:</p>
              <p>Order Amount: ₹1,000</p>
              <p>Platform Fee ({settings.platform_fee_percentage}%): ₹{((1000 * settings.platform_fee_percentage) / 100).toFixed(2)}</p>
              <p>Promotion Fee ({settings.promotion_fee_percentage}%): ₹{((1000 * settings.promotion_fee_percentage) / 100).toFixed(2)}</p>
              <p className="font-bold text-green-600">Seller Payout: ₹{(1000 - ((1000 * settings.platform_fee_percentage) / 100) - ((1000 * settings.promotion_fee_percentage) / 100)).toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full gap-2">
          <Save className="w-4 h-4" />
          Save Settings
        </Button>
      </form>
    </div>
  );
}
