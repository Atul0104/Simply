import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-gray-100 text-gray-800'
};

export default function SellerApprovals() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/sellers`);
      setSellers(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching sellers:', error);
      setLoading(false);
    }
  };

  const handleApprove = async (sellerId) => {
    try {
      await axios.put(`${API_URL}/admin/sellers/${sellerId}/approve`, null, {
        params: { approve: true }
      });
      toast.success('Seller approved!');
      fetchSellers();
    } catch (error) {
      toast.error('Failed to approve seller');
    }
  };

  const handleReject = async (sellerId) => {
    try {
      await axios.put(`${API_URL}/admin/sellers/${sellerId}/approve`, null, {
        params: { approve: false }
      });
      toast.success('Seller rejected');
      fetchSellers();
    } catch (error) {
      toast.error('Failed to reject seller');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        
        <h1 className="text-3xl font-bold mb-6">Seller Applications</h1>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : sellers.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No seller applications</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sellers.map((seller) => (
              <Card key={seller.id} data-testid={`seller-${seller.id}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{seller.business_name}</h3>
                      <p className="text-sm text-gray-500">
                        Applied: {format(new Date(seller.created_at), 'PPP')}
                      </p>
                    </div>
                    <Badge className={statusColors[seller.status] || 'bg-gray-100'}>
                      {seller.status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-gray-600">Business Email:</p>
                      <p className="font-medium">{seller.business_email}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Business Phone:</p>
                      <p className="font-medium">{seller.business_phone}</p>
                    </div>
                    {seller.gst_number && (
                      <div>
                        <p className="text-gray-600">GST Number:</p>
                        <p className="font-medium">{seller.gst_number}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-600">Address:</p>
                      <p className="font-medium">
                        {seller.address}, {seller.city}, {seller.state} - {seller.pincode}
                      </p>
                    </div>
                  </div>

                  {seller.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(seller.id)}
                        className="flex-1"
                        data-testid={`approve-${seller.id}`}
                      >
                        <Check className="w-4 h-4 mr-2" /> Approve
                      </Button>
                      <Button
                        onClick={() => handleReject(seller.id)}
                        variant="destructive"
                        className="flex-1"
                        data-testid={`reject-${seller.id}`}
                      >
                        <X className="w-4 h-4 mr-2" /> Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
