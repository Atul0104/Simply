import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useConsent } from '@/contexts/ConsentContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, Bell, Mail, Smartphone, Moon, Sun, Globe, Shield, CreditCard, LogOut, Trash2, Download, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function SettingsPage() {
  const { openPreferences, preferences } = useConsent();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    theme: 'light',
    language: 'en',
    currency: 'INR',
    notifications_email: true,
    notifications_sms: true,
    notifications_push: true,
    marketing_emails: true,
    order_updates: true,
    offers_promotions: true,
    wishlist_alerts: true,
    restock_alerts: true,
    price_drop_alerts: true,
    personalized_recommendations: true,
    analytics_consent: true,
    two_factor_enabled: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchSettings();
  }, [user, navigate]);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings`);
      setSettings(prev => ({ ...prev, ...response.data }));
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
    setLoading(false);
  };

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    try {
      await axios.put(`${API_URL}/settings`, { [key]: value });
    } catch (error) {
      console.error('Error updating setting:', error);
      // Revert on error
      setSettings(settings);
      toast.error('Failed to update setting');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out successfully');
  };

  const changePassword = async () => {
    const currentPassword = window.prompt('Enter your current password');
    if (!currentPassword) return;
    const newPassword = window.prompt('Enter a new password (10+ characters with upper/lowercase, number and symbol)');
    if (!newPassword) return;
    setSaving(true);
    try {
      const response = await axios.post(`${API_URL}/profile/change-password`, { current_password: currentPassword, new_password: newPassword });
      toast.success(response.data.message);
      await logout(); navigate('/auth');
    } catch (error) { toast.error(error.response?.data?.detail || 'Password could not be changed'); }
    finally { setSaving(false); }
  };

  const exportData = async () => {
    setSaving(true);
    try {
      const response = await axios.get(`${API_URL}/profile/data-export`);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `perfurm-data-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
      URL.revokeObjectURL(url); toast.success('Your data export is ready');
    } catch (error) { toast.error(error.response?.data?.detail || 'Data export failed'); }
    finally { setSaving(false); }
  };

  const requestDeletion = async () => {
    if (!window.confirm('Request account deletion? Active orders must be completed first. Your records will follow the legal retention policy.')) return;
    const password = window.prompt('Confirm your password');
    if (!password) return;
    const reason = window.prompt('Reason (optional)') || null;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/profile/deletion-request`, { password, reason });
      toast.success('Deletion request submitted for review');
    } catch (error) { toast.error(error.response?.data?.detail || 'Deletion request failed'); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft />
            </Button>
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card><CardHeader><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-emerald-600"/><CardTitle>Privacy and cookies</CardTitle></div><CardDescription>Review or withdraw optional tracking and personalization consent at any time.</CardDescription></CardHeader><CardContent><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-gray-600">Optional categories enabled: {preferences ? Object.entries(preferences).filter(([key, value]) => key !== 'necessary' && value).length : 0}</p><Button variant="outline" onClick={openPreferences}>Manage cookie preferences</Button></div></CardContent></Card>
        {/* Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-500" />
                <CardTitle>Notifications</CardTitle>
              </div>
              <CardDescription>Manage how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-gray-500">Order updates, promotions via email</p>
                  </div>
                </div>
                <Switch
                  checked={settings.notifications_email}
                  onCheckedChange={(v) => updateSetting('notifications_email', v)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4 text-gray-500" />
                  <div>
                    <Label>SMS Notifications</Label>
                    <p className="text-sm text-gray-500">Order and delivery updates via SMS</p>
                  </div>
                </div>
                <Switch
                  checked={settings.notifications_sms}
                  onCheckedChange={(v) => updateSetting('notifications_sms', v)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-gray-500" />
                  <div>
                    <Label>Push Notifications</Label>
                    <p className="text-sm text-gray-500">Browser push notifications</p>
                  </div>
                </div>
                <Switch
                  checked={settings.notifications_push}
                  onCheckedChange={(v) => updateSetting('notifications_push', v)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <div>
                    <Label>Marketing Emails</Label>
                    <p className="text-sm text-gray-500">Deals, offers, and newsletters</p>
                  </div>
                </div>
                <Switch
                  checked={settings.marketing_emails}
                  onCheckedChange={(v) => updateSetting('marketing_emails', v)}
                />
              </div>
              {[
                ['order_updates', 'Order updates', 'Payment, packing and delivery status'],
                ['offers_promotions', 'Offers and promotions', 'Coupons, sale events and member rewards'],
                ['wishlist_alerts', 'Wishlist reminders', 'Updates about fragrances you saved'],
                ['restock_alerts', 'Back-in-stock alerts', 'Know when a sold-out bottle returns'],
                ['price_drop_alerts', 'Price-drop alerts', 'Get notified when a saved fragrance costs less'],
              ].map(([key, label, description]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3"><Bell className="h-4 w-4 text-gray-500" /><div><Label>{label}</Label><p className="text-sm text-gray-500">{description}</p></div></div>
                  <Switch checked={settings[key]} onCheckedChange={(value) => updateSetting(key, value)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-green-500" />
                <CardTitle>Preferences</CardTitle>
              </div>
              <CardDescription>Customize your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {settings.theme === 'dark' ? <Moon className="w-4 h-4 text-gray-500" /> : <Sun className="w-4 h-4 text-gray-500" />}
                  <div>
                    <Label>Theme</Label>
                    <p className="text-sm text-gray-500">Choose light or dark mode</p>
                  </div>
                </div>
                <Select value={settings.theme} onValueChange={(v) => updateSetting('theme', v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-gray-500" />
                  <div>
                    <Label>Language</Label>
                    <p className="text-sm text-gray-500">Select your preferred language</p>
                  </div>
                </div>
                <Select value={settings.language} onValueChange={(v) => updateSetting('language', v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                    <SelectItem value="ta">Tamil</SelectItem>
                    <SelectItem value="te">Telugu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-gray-500" />
                  <div>
                    <Label>Currency</Label>
                    <p className="text-sm text-gray-500">Display prices in your currency</p>
                  </div>
                </div>
                <Select value={settings.currency} onValueChange={(v) => updateSetting('currency', v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">₹ INR</SelectItem>
                    <SelectItem value="USD">$ USD</SelectItem>
                    <SelectItem value="EUR">€ EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Security */}
        <Card>
          <CardHeader><CardTitle>Privacy & personalization</CardTitle><CardDescription>Control how Perfurm tailors your storefront.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {[
              ['personalized_recommendations', 'Personalized recommendations', 'Use your browsing and purchase history to improve suggestions'],
              ['analytics_consent', 'Experience analytics', 'Share anonymous usage signals to improve the application'],
            ].map(([key, label, description]) => <div key={key} className="flex items-center justify-between gap-4"><div><Label>{label}</Label><p className="text-sm text-gray-500">{description}</p></div><Switch checked={settings[key]} onCheckedChange={(value) => updateSetting(key, value)} /></div>)}
          </CardContent>
        </Card>

        {/* Security */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-500" />
                <CardTitle>Security</CardTitle>
              </div>
              <CardDescription>Keep your account secure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <div>
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-gray-500">Add extra security to your account</p>
                  </div>
                </div>
                <Switch
                  checked={settings.two_factor_enabled}
                  onCheckedChange={(v) => updateSetting('two_factor_enabled', v)}
                />
              </div>
              
              <Button variant="outline" className="w-full" onClick={changePassword} disabled={saving}>
                <KeyRound className="mr-2 h-4 w-4" /> Change Password
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Account Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={exportData} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Export My Data
              </Button>
              <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
              <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={requestDeletion} disabled={saving}>
                <Trash2 className="w-4 h-4 mr-2" /> Request Account Deletion
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
