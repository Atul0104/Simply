import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Store, Save, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function StoreManagement() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    store_name: '',
    store_description: '',
    store_images: [],
    store_address: '',
    store_city: '',
    store_state: '',
    store_pincode: '',
    store_phone: '',
    store_email: '',
    working_hours: '10 AM - 8 PM'
  });
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    fetchStore();
  }, []);

  const fetchStore = async () => {
    try {
      const response = await axios.get(`${API_URL}/stores/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setFormData(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch store');
    } finally {
      setLoading(false);
    }
  };

  const handleAddImage = () => {
    if (imageUrl.trim()) {
      setFormData({
        ...formData,
        store_images: [...(formData.store_images || []), imageUrl]
      });
      setImageUrl('');
    }
  };

  const handleRemoveImage = (index) => {
    const newImages = formData.store_images.filter((_, i) => i !== index);
    setFormData({ ...formData, store_images: newImages });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/stores/my`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Store updated successfully!');
    } catch (error) {
      toast.error('Failed to update store');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Store Management</h1>
        <p className="text-gray-500 mt-1">Manage your store information and photos</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Store Name *</Label>
              <Input
                value={formData.store_name}
                onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.store_description || ''}
                onChange={(e) => setFormData({ ...formData, store_description: e.target.value })}
                rows={3}
                placeholder="Tell customers about your store..."
              />
            </div>
            <div>
              <Label>Working Hours</Label>
              <Input
                value={formData.working_hours}
                onChange={(e) => setFormData({ ...formData, working_hours: e.target.value })}
                placeholder="10 AM - 8 PM"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Store Images</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL"
              />
              <Button type="button" onClick={handleAddImage}>
                Add
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {formData.store_images?.map((img, index) => (
                <div key={index} className="relative group">
                  <img src={img} alt="Store" className="w-full h-32 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact & Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.store_phone || ''}
                  onChange={(e) => setFormData({ ...formData, store_phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.store_email || ''}
                  onChange={(e) => setFormData({ ...formData, store_email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={formData.store_address || ''}
                onChange={(e) => setFormData({ ...formData, store_address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>City</Label>
                <Input
                  value={formData.store_city || ''}
                  onChange={(e) => setFormData({ ...formData, store_city: e.target.value })}
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={formData.store_state || ''}
                  onChange={(e) => setFormData({ ...formData, store_state: e.target.value })}
                />
              </div>
              <div>
                <Label>Pincode</Label>
                <Input
                  value={formData.store_pincode || ''}
                  onChange={(e) => setFormData({ ...formData, store_pincode: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full gap-2">
          <Save className="w-4 h-4" />
          Save Store Details
        </Button>
      </form>
    </div>
  );
}
