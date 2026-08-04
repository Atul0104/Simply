import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function SellerSetup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    business_email: '',
    business_phone: '',
    gst_number: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API_URL}/sellers/register`, formData);
      toast.success('Seller profile created! Waiting for admin approval.');
      navigate('/seller');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create seller profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle>Seller Registration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="business_name">Business Name *</Label>
                <Input
                  id="business_name"
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  required
                  data-testid="business-name"
                />
              </div>
              <div>
                <Label htmlFor="business_email">Business Email *</Label>
                <Input
                  id="business_email"
                  type="email"
                  value={formData.business_email}
                  onChange={(e) => setFormData({ ...formData, business_email: e.target.value })}
                  required
                  data-testid="business-email"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="business_phone">Business Phone *</Label>
                <Input
                  id="business_phone"
                  value={formData.business_phone}
                  onChange={(e) => setFormData({ ...formData, business_phone: e.target.value })}
                  required
                  data-testid="business-phone"
                />
              </div>
              <div>
                <Label htmlFor="gst_number">GST Number (Optional)</Label>
                <Input
                  id="gst_number"
                  value={formData.gst_number}
                  onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                  data-testid="gst-number"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
                data-testid="address"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                  data-testid="city"
                />
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  required
                  data-testid="state"
                />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  required
                  data-testid="pincode"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading} data-testid="submit-btn">
              {loading ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
