import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function BankOffersManagement() {
  const { token } = useAuth();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    bank_name: '',
    offer_text: '',
    discount_percentage: '',
    max_discount: '',
    min_order_amount: 0,
    card_type: 'all',
    valid_until: ''
  });

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      const response = await axios.get(`${API_URL}/bank-offers`);
      setOffers(response.data);
    } catch (error) {
      toast.error('Failed to fetch bank offers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        discount_percentage: formData.discount_percentage ? parseFloat(formData.discount_percentage) : null,
        max_discount: formData.max_discount ? parseFloat(formData.max_discount) : null,
        min_order_amount: parseFloat(formData.min_order_amount),
        valid_until: new Date(formData.valid_until).toISOString()
      };
      await axios.post(`${API_URL}/admin/bank-offers`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Bank offer created!');
      fetchOffers();
      setShowDialog(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to create bank offer');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bank offer?')) return;
    try {
      await axios.delete(`${API_URL}/admin/bank-offers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Bank offer deleted');
      fetchOffers();
    } catch (error) {
      toast.error('Failed to delete bank offer');
    }
  };

  const resetForm = () => {
    setFormData({
      bank_name: '',
      offer_text: '',
      discount_percentage: '',
      max_discount: '',
      min_order_amount: 0,
      card_type: 'all',
      valid_until: ''
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bank Offers Management</h1>
          <p className="text-gray-500 mt-1">Manage bank discount offers</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Bank Offer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Bank Offer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Bank Name *</Label>
                <Input
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="HDFC, ICICI, SBI..."
                  required
                />
              </div>
              <div>
                <Label>Offer Text *</Label>
                <Input
                  value={formData.offer_text}
                  onChange={(e) => setFormData({ ...formData, offer_text: e.target.value })}
                  placeholder="10% off up to ₹200"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Max Discount (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.max_discount}
                    onChange={(e) => setFormData({ ...formData, max_discount: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Min Order Amount (₹)</Label>
                <Input
                  type="number"
                  value={formData.min_order_amount}
                  onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                />
              </div>
              <div>
                <Label>Card Type</Label>
                <Select value={formData.card_type} onValueChange={(value) => setFormData({ ...formData, card_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cards</SelectItem>
                    <SelectItem value="credit">Credit Card Only</SelectItem>
                    <SelectItem value="debit">Debit Card Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valid Until *</Label>
                <Input
                  type="datetime-local"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" className="w-full">Create Offer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {offers.map((offer) => (
          <Card key={offer.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-500" />
                  <CardTitle className="text-lg">{offer.bank_name}</CardTitle>
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
            <CardContent className="space-y-2">
              <p className="font-semibold text-green-600">{offer.offer_text}</p>
              <div className="text-sm text-gray-600 space-y-1">
                {offer.discount_percentage && <p>Discount: {offer.discount_percentage}%</p>}
                {offer.max_discount && <p>Max: ₹{offer.max_discount}</p>}
                <p>Min Order: ₹{offer.min_order_amount}</p>
                <p>Card Type: {offer.card_type}</p>
                <p className="text-xs">Valid until: {format(new Date(offer.valid_until), 'PPP')}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {offers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No bank offers created yet</p>
            <Button onClick={() => setShowDialog(true)}>Create First Bank Offer</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
