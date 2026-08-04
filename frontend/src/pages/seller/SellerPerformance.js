import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Package, CheckCircle, XCircle, Star, Clock, Award } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function SellerPerformance() {
  const { token } = useAuth();
  const [performance, setPerformance] = useState(null);
  const [platformFees, setPlatformFees] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformance();
    fetchPlatformFees();
  }, []);

  const fetchPerformance = async () => {
    try {
      const response = await axios.get(`${API_URL}/seller-performance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPerformance(response.data);
    } catch (error) {
      toast.error('Failed to fetch performance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlatformFees = async () => {
    try {
      const response = await axios.get(`${API_URL}/platform-fees/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlatformFees(response.data);
    } catch (error) {
      console.error('Failed to fetch platform fees');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Seller Performance</h1>
        <p className="text-gray-500 mt-1">Track your performance metrics and ratings</p>
      </div>

      {/* Overall Performance Card */}
      <Card className="border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-6 h-6 text-blue-500" />
            Overall Performance Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600">
                {performance?.fulfillment_rate || 0}%
              </div>
              <p className="text-sm text-gray-600 mt-1">Fulfillment Rate</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-yellow-600 flex items-center justify-center gap-2">
                <Star className="w-8 h-8 fill-yellow-400" />
                {performance?.rating?.toFixed(1) || 0}
              </div>
              <p className="text-sm text-gray-600 mt-1">Average Rating</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600">
                {performance?.on_time_delivery_rate || 0}%
              </div>
              <p className="text-sm text-gray-600 mt-1">On-Time Delivery</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{performance?.total_orders || 0}</div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Completed Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-green-600">{performance?.completed_orders || 0}</div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Cancelled Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-red-600">{performance?.cancelled_orders || 0}</div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Customer Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Reviews</p>
              <p className="text-2xl font-bold">{performance?.total_reviews || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Average Rating</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= (performance?.rating || 0)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xl font-bold">{performance?.rating?.toFixed(1) || 0}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Fees Summary */}
      {platformFees && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Earnings & Platform Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Payout</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{platformFees.summary?.total_seller_payout?.toFixed(2) || 0}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Platform Fees (2%)</p>
                <p className="text-2xl font-bold text-red-600">
                  ₹{platformFees.summary?.total_fee_amount?.toFixed(2) || 0}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Orders with Fees</p>
                <p className="text-2xl font-bold text-blue-600">
                  {platformFees.summary?.total_orders || 0}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Platform fee of 2% is deducted from each order to maintain and improve the marketplace.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Tips */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle className="text-purple-900">Tips to Improve Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <span>Ship orders within 24 hours to improve fulfillment rate</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <span>Provide accurate product descriptions to reduce returns</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <span>Respond to customer queries promptly</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <span>Maintain adequate inventory to avoid cancellations</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <span>Use quality packaging to ensure products reach safely</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
