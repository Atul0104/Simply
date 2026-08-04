import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function ReturnRequest() {
  const { orderId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [requestType, setRequestType] = useState('return');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        `${API_URL}/return-requests`,
        {
          order_id: orderId,
          reason,
          request_type: requestType,
          images: []
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`${requestType.charAt(0).toUpperCase() + requestType.slice(1)} request submitted!`);
      navigate('/customer/orders');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/customer/orders')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Submit Return/Cancel Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="requestType">Request Type</Label>
                <Select value={requestType} onValueChange={setRequestType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="return">Return</SelectItem>
                    <SelectItem value="replacement">Replacement</SelectItem>
                    <SelectItem value="cancel">Cancel Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="reason">Reason *</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please explain why you want to return/cancel this order"
                  rows={4}
                  required
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Note:</strong> Your request will be reviewed by the seller within 24-48 hours.
                  You'll receive a notification once the request is processed.
                </p>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Submitting...' : 'Submit Request'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
