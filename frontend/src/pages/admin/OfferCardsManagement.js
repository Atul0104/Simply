import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function OfferCardsManagement() {
  const { token } = useAuth();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    link_url: '',
    display_order: 0
  });

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      const response = await axios.get(`${API_URL}/offer-cards`);
      setOffers(response.data);
    } catch (error) {
      toast.error('Failed to fetch offers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/admin/offer-cards`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Offer card created!');
      fetchOffers();
      setShowDialog(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to create offer card');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this offer card?')) return;
    try {
      await axios.delete(`${API_URL}/admin/offer-cards/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Offer card deleted');
      fetchOffers();
    } catch (error) {
      toast.error('Failed to delete offer card');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      link_url: '',
      display_order: 0
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Offer Cards Management</h1>
          <p className="text-gray-500 mt-1">Manage homepage promotional banners</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Offer Card
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Offer Card</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Image URL</Label>
                <Input
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>Link URL</Label>
                <Input
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  placeholder="/category/..."
                />
              </div>
              <div>
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                />
              </div>
              <Button type="submit" className="w-full">Create Offer Card</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {offers.map((offer) => (
          <Card key={offer.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-blue-500" />
                  <CardTitle className="text-lg">{offer.title}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(offer.id)}
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {offer.image_url && (
                <img src={offer.image_url} alt={offer.title} className="w-full h-32 object-cover rounded-lg" />
              )}
              <p className="text-sm text-gray-600">{offer.description}</p>
              {offer.link_url && (
                <p className="text-xs text-gray-500">Link: {offer.link_url}</p>
              )}
              <p className="text-xs text-gray-400">Order: {offer.display_order}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {offers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No offer cards created yet</p>
            <Button onClick={() => setShowDialog(true)}>Create First Offer Card</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
