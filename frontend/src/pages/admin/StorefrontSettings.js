import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Eye, EyeOff, Save, Settings, Phone, Mail, Clock, MapPin, MessageCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function StorefrontSettings() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [visibility, setVisibility] = useState({
    show_hero_banner: true,
    show_ticker: true,
    show_categories: true,
    show_most_viewed: true,
    show_trending: true,
    show_bestsellers: true,
    show_new_arrivals: true,
    show_offer_cards: true,
    show_bank_offers: true,
    show_view_store: true,
    show_footer: true
  });
  
  const [supportSettings, setSupportSettings] = useState({
    support_email: '',
    support_phone: '',
    whatsapp_number: '',
    working_hours: '',
    support_address: '',
    faq_enabled: true,
    live_chat_enabled: false,
    ticket_system_enabled: true
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [visibilityRes, supportRes] = await Promise.all([
        axios.get(`${API_URL}/storefront-visibility`),
        axios.get(`${API_URL}/support-settings`)
      ]);
      setVisibility(visibilityRes.data);
      setSupportSettings(supportRes.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleVisibilityToggle = (key) => {
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const saveVisibility = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/admin/storefront-visibility`, visibility, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Visibility settings saved!');
    } catch (error) {
      toast.error('Failed to save visibility settings');
    } finally {
      setSaving(false);
    }
  };

  const saveSupportSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/admin/support-settings`, supportSettings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Support settings saved!');
    } catch (error) {
      toast.error('Failed to save support settings');
    } finally {
      setSaving(false);
    }
  };

  const visibilityOptions = [
    { key: 'show_hero_banner', label: 'Hero Banner', description: 'Main promotional banner at the top' },
    { key: 'show_ticker', label: 'Announcement Ticker', description: 'Scrolling announcement bar' },
    { key: 'show_categories', label: 'Category Navigation', description: 'Category tabs below header' },
    { key: 'show_most_viewed', label: 'Most Viewed Section', description: 'Products with most views' },
    { key: 'show_trending', label: 'Trending Now Section', description: 'Currently trending products' },
    { key: 'show_bestsellers', label: 'Bestsellers Section', description: 'Top selling products' },
    { key: 'show_new_arrivals', label: 'New Arrivals Section', description: 'Recently added products' },
    { key: 'show_offer_cards', label: 'Offer Cards', description: 'Promotional offer cards' },
    { key: 'show_bank_offers', label: 'Bank Offers', description: 'Bank discount offers' },
    { key: 'show_view_store', label: 'View Store Button', description: 'Button to view seller stores' },
    { key: 'show_footer', label: 'Footer', description: 'Website footer section' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">Storefront Settings</h1>
          <p className="text-gray-500">Control what customers see on your store</p>
        </div>

        <Tabs defaultValue="visibility" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="visibility" className="gap-2">
              <Eye className="w-4 h-4" /> Visibility Control
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2">
              <Phone className="w-4 h-4" /> Support Settings
            </TabsTrigger>
          </TabsList>

          {/* Visibility Tab */}
          <TabsContent value="visibility">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" /> Element Visibility
                </CardTitle>
                <CardDescription>
                  Toggle which sections are visible to customers on the homepage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {visibilityOptions.map((option) => (
                  <div key={option.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      {visibility[option.key] ? (
                        <Eye className="w-5 h-5 text-green-600" />
                      ) : (
                        <EyeOff className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <Label className="text-base font-medium cursor-pointer">{option.label}</Label>
                        <p className="text-sm text-gray-500">{option.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={visibility[option.key]}
                      onCheckedChange={() => handleVisibilityToggle(option.key)}
                      data-testid={`toggle-${option.key}`}
                    />
                  </div>
                ))}
                
                <Button onClick={saveVisibility} disabled={saving} className="w-full mt-4" data-testid="save-visibility-btn">
                  {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Visibility Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" /> Support Information
                </CardTitle>
                <CardDescription>
                  Configure customer support contact details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-2"><Mail className="w-4 h-4" /> Support Email</Label>
                    <Input
                      value={supportSettings.support_email}
                      onChange={(e) => setSupportSettings({ ...supportSettings, support_email: e.target.value })}
                      placeholder="support@example.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2"><Phone className="w-4 h-4" /> Support Phone</Label>
                    <Input
                      value={supportSettings.support_phone}
                      onChange={(e) => setSupportSettings({ ...supportSettings, support_phone: e.target.value })}
                      placeholder="+91 1234567890"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp Number</Label>
                    <Input
                      value={supportSettings.whatsapp_number || ''}
                      onChange={(e) => setSupportSettings({ ...supportSettings, whatsapp_number: e.target.value })}
                      placeholder="+91 9876543210"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2"><Clock className="w-4 h-4" /> Working Hours</Label>
                    <Input
                      value={supportSettings.working_hours}
                      onChange={(e) => setSupportSettings({ ...supportSettings, working_hours: e.target.value })}
                      placeholder="Mon-Sat: 10 AM - 6 PM"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Support Address</Label>
                  <Textarea
                    value={supportSettings.support_address || ''}
                    onChange={(e) => setSupportSettings({ ...supportSettings, support_address: e.target.value })}
                    placeholder="Enter full address..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h4 className="font-medium">Support Features</h4>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <Label>FAQ Section</Label>
                      <p className="text-sm text-gray-500">Show FAQ on support page</p>
                    </div>
                    <Switch
                      checked={supportSettings.faq_enabled}
                      onCheckedChange={(v) => setSupportSettings({ ...supportSettings, faq_enabled: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <Label>Ticket System</Label>
                      <p className="text-sm text-gray-500">Allow customers to raise tickets</p>
                    </div>
                    <Switch
                      checked={supportSettings.ticket_system_enabled}
                      onCheckedChange={(v) => setSupportSettings({ ...supportSettings, ticket_system_enabled: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <Label>Live Chat</Label>
                      <p className="text-sm text-gray-500">Enable live chat support</p>
                    </div>
                    <Switch
                      checked={supportSettings.live_chat_enabled}
                      onCheckedChange={(v) => setSupportSettings({ ...supportSettings, live_chat_enabled: v })}
                    />
                  </div>
                </div>
                
                <Button onClick={saveSupportSettings} disabled={saving} className="w-full" data-testid="save-support-btn">
                  {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Support Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
