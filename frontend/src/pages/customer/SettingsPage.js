import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, Bell, Mail, Smartphone, Moon, Sun, Globe, Shield, CreditCard, LogOut, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function SettingsPage() {
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
              
              <Button variant="outline" className="w-full">
                Change Password
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
              <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
              <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="w-4 h-4 mr-2" /> Delete Account
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
