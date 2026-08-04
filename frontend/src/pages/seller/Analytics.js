import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, ShoppingBag, Package, DollarSign, IndianRupee, Calendar, Wallet, ArrowUpRight, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6'];

export default function Analytics() {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    try {
      const [analyticsRes, earningsRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/seller`, {
          params: { period },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/seller/earnings-summary`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setAnalytics(analyticsRes.data);
      setEarnings(earningsRes.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Prepare chart data from orders
  const orderChartData = analytics?.orders?.slice(0, 10).map(order => ({
    date: format(new Date(order.created_at), 'MMM dd'),
    amount: order.total_amount,
    items: order.items?.length || 0
  })).reverse() || [];

  // Order status distribution
  const statusCounts = analytics?.orders?.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {}) || {};

  const statusChartData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate('/seller')} className="mb-4" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-gray-500">Track your performance and revenue</p>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => navigate('/seller/payouts')} variant="outline" className="gap-2">
              <Wallet className="w-4 h-4" /> View Payouts
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white" data-testid="analytics-revenue">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-100">Total Revenue</CardTitle>
              <TrendingUp className="w-5 h-5 text-purple-200" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(analytics?.total_revenue || 0)}</div>
              <p className="text-xs text-purple-200 mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> {period} performance
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white" data-testid="analytics-earnings">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-100">Net Earnings</CardTitle>
              <IndianRupee className="w-5 h-5 text-green-200" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(earnings?.total_earnings || 0)}</div>
              <p className="text-xs text-green-200 mt-1">After 2% platform fee</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white" data-testid="analytics-orders">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Total Orders</CardTitle>
              <ShoppingBag className="w-5 h-5 text-blue-200" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics?.total_orders || 0}</div>
              <p className="text-xs text-blue-200 mt-1">Orders received</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white" data-testid="analytics-products">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-amber-100">Active Products</CardTitle>
              <Package className="w-5 h-5 text-amber-200" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics?.active_products || 0}</div>
              <p className="text-xs text-amber-200 mt-1">Listed products</p>
            </CardContent>
          </Card>
        </div>

        {/* Earnings Breakdown */}
        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Amount Received</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(earnings?.total_paid || 0)}</p>
              <p className="text-xs text-gray-500">Successfully paid out</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Pending Payout</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(earnings?.pending_payout || 0)}</p>
              <p className="text-xs text-gray-500">Processing next week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Platform Fee Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-600">{formatCurrency(earnings?.total_platform_fee || 0)}</p>
              <p className="text-xs text-gray-500">2% commission</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList>
            <TabsTrigger value="revenue">Revenue Trend</TabsTrigger>
            <TabsTrigger value="orders">Order Status</TabsTrigger>
            <TabsTrigger value="recent">Recent Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" /> Revenue Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orderChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={orderChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="amount" name="Order Value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    No order data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Order Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {statusChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    No order data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Your latest orders</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics?.orders && analytics.orders.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.orders.slice(0, 10).map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">{order.id?.substring(0, 8)}...</TableCell>
                          <TableCell>{order.items?.length || 0} items</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(order.total_amount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }>
                              {order.status?.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {order.created_at ? format(new Date(order.created_at), 'PP') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                    <p>No orders yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
