import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Edit, Trash2, Image, Eye, EyeOff, GripVertical, Save } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function HeroBannerManagement() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    image_url: '',
    button_text: 'Shop Now',
    button_link: '',
    display_order: 0
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/hero-banners`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBanners(response.data);
    } catch (error) {
      toast.error('Failed to fetch banners');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.image_url) {
      toast.error('Title and image URL are required');
      return;
    }

    try {
      if (editingBanner) {
        await axios.put(`${API_URL}/admin/hero-banners/${editingBanner.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Banner updated!');
      } else {
        await axios.post(`${API_URL}/admin/hero-banners`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Banner created!');
      }
      fetchBanners();
      setShowDialog(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to save banner');
    }
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      image_url: banner.image_url,
      button_text: banner.button_text || 'Shop Now',
      button_link: banner.button_link || '',
      display_order: banner.display_order || 0
    });
    setShowDialog(true);
  };

  const handleDelete = async (bannerId) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return;
    
    try {
      await axios.delete(`${API_URL}/admin/hero-banners/${bannerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Banner deleted!');
      fetchBanners();
    } catch (error) {
      toast.error('Failed to delete banner');
    }
  };

  const toggleActive = async (banner) => {
    try {
      await axios.put(`${API_URL}/admin/hero-banners/${banner.id}`, 
        { is_active: !banner.is_active },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchBanners();
      toast.success(`Banner ${!banner.is_active ? 'activated' : 'deactivated'}`);
    } catch (error) {
      toast.error('Failed to update banner');
    }
  };

  const resetForm = () => {
    setEditingBanner(null);
    setFormData({
      title: '',
      subtitle: '',
      image_url: '',
      button_text: 'Shop Now',
      button_link: '',
      display_order: 0
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Hero Banner Management</h1>
            <p className="text-gray-500">Manage promotional banners on homepage</p>
          </div>
          <Button onClick={() => { resetForm(); setShowDialog(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Banner
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Button</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banners.map((banner, index) => (
                  <TableRow key={banner.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <img src={banner.image_url} alt={banner.title} className="w-32 h-16 object-cover rounded" />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{banner.title}</p>
                        {banner.subtitle && <p className="text-sm text-gray-500">{banner.subtitle}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm bg-gray-100 px-2 py-1 rounded">{banner.button_text}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {banner.is_active ? (
                          <Eye className="w-4 h-4 text-green-600" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        )}
                        <Switch
                          checked={banner.is_active}
                          onCheckedChange={() => toggleActive(banner)}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(banner)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(banner.id)} className="text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {banners.length === 0 && (
              <div className="text-center py-12">
                <Image className="w-16 h-16 mx-auto text-gray-200 mb-4" />
                <p className="text-gray-500 mb-4">No banners yet</p>
                <Button onClick={() => setShowDialog(true)}>Add First Banner</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBanner ? 'Edit Banner' : 'Add New Banner'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Flat 40% OFF on Winter Collection"
              />
            </div>
            <div>
              <Label>Subtitle</Label>
              <Input
                value={formData.subtitle}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                placeholder="Limited time offer"
              />
            </div>
            <div>
              <Label>Image URL *</Label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/banner.jpg"
              />
              {formData.image_url && (
                <img src={formData.image_url} alt="Preview" className="mt-2 w-full h-32 object-cover rounded" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Button Text</Label>
                <Input
                  value={formData.button_text}
                  onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                  placeholder="Shop Now"
                />
              </div>
              <div>
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label>Button Link (optional)</Label>
              <Input
                value={formData.button_link}
                onChange={(e) => setFormData({ ...formData, button_link: e.target.value })}
                placeholder="/category/winter-wear"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} className="gap-2">
              <Save className="w-4 h-4" /> {editingBanner ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
