import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function FooterManagement() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    about_text: '',
    facebook_url: '',
    instagram_url: '',
    twitter_url: '',
    youtube_url: '',
    contact_email: '',
    contact_phone: '',
    address: ''
  });

  useEffect(() => {
    fetchFooterContent();
  }, []);

  const fetchFooterContent = async () => {
    try {
      const response = await axios.get(`${API_URL}/footer-content`);
      setFormData(response.data);
    } catch (error) {
      toast.error('Failed to fetch footer content');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/admin/footer-content`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Footer content updated successfully!');
    } catch (error) {
      toast.error('Failed to update footer content');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Footer Management</h1>
        <p className="text-gray-500 mt-1">Edit footer content and social media links</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>About Section</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.about_text}
              onChange={(e) => setFormData({ ...formData, about_text: e.target.value })}
              rows={3}
              placeholder="About text"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Social Media Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Facebook URL</Label>
              <Input
                value={formData.facebook_url || ''}
                onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                placeholder="https://facebook.com/your-page"
              />
            </div>
            <div>
              <Label>Instagram URL</Label>
              <Input
                value={formData.instagram_url || ''}
                onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                placeholder="https://instagram.com/your-profile"
              />
            </div>
            <div>
              <Label>Twitter URL</Label>
              <Input
                value={formData.twitter_url || ''}
                onChange={(e) => setFormData({ ...formData, twitter_url: e.target.value })}
                placeholder="https://twitter.com/your-profile"
              />
            </div>
            <div>
              <Label>YouTube URL</Label>
              <Input
                value={formData.youtube_url || ''}
                onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                placeholder="https://youtube.com/your-channel"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="support@blackmoney.com"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="+91 1234567890"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                placeholder="Office address"
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full gap-2">
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </form>
    </div>
  );
}
