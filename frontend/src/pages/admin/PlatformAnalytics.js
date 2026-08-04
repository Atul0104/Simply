import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Users, ShoppingBag, TrendingUp, Package, DollarSign, Store, ArrowUpRight, ArrowDownRight, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#6366F1', '#14B8A6'];

export default function PlatformAnalytics() {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [sellerRevenue, setSellerRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();

  useEffect(() => {
    fetchAnalytics();
    fetchSellerRevenue();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API_URL}/analytics/admin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchSellerRevenue = async () => {
    try {
      const response = await axios.get(`${API_URL}/analytics/admin/seller-revenue`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSellerRevenue(response.data);
    } catch (error) {
      console.error('Error fetching seller revenue:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const styles = {
      approved: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      rejected: 'bg-red-100 text-red-700',
      suspended: 'bg-gray-100 text-gray-700'
    };
    return <Badge className={styles[status] || styles.pending}>{status?.toUpperCase()}</Badge>;
  };

  // Prepare chart data
  const sellerChartData = sellerRevenue?.sellers?.slice(0, 8).map((seller, index) => ({
    name: seller.business_name?.substring(0, 15) || 'Unknown',
    revenue: seller.gross_revenue,
    payout: seller.net_revenue,
    fee: seller.platform_fee
  })) || [];

  const pieData = sellerRevenue?.sellers?.slice(0, 6).map((seller, index) => ({
    name: seller.business_name?.substring(0, 12) || 'Unknown',
    value: seller.gross_revenue
  })) || [];

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
        <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Platform Analytics</h1>
            <p className="text-gray-500">Complete revenue and seller performance overview</p>
          </div>
          <Button onClick={() => navigate('/admin/payouts')} className="gap-2">
            <DollarSign className="w-4 h-4" /> Manage Payouts
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card data-testid="analytics-users" className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-100">Total Users</CardTitle>
              <Users className="w-5 h-5 text-purple-200" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics?.total_users || 0}</div>
              <p className="text-xs text-purple-200 mt-1">Registered users</p>
            </CardContent>
          </Card>

          <Card data-testid="analytics-sellers" className="bg-gradient-to-br from-pink-500 to-pink-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-pink-100">Active Sellers</CardTitle>
              <Store className="w-5 h-5 text-pink-200" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics?.total_sellers || 0}</div>
              <p className="text-xs text-pink-200 mt-1">{analytics?.pending_sellers || 0} pending approval</p>
            </CardContent>
          </Card>

          <Card data-testid="analytics-orders" className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-emerald-100">Total Orders</CardTitle>
              <ShoppingBag className="w-5 h-5 text-emerald-200" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics?.total_orders || 0}</div>
              <p className="text-xs text-emerald-200 mt-1">{analytics?.total_products || 0} products listed</p>
            </CardContent>
          </Card>

          <Card data-testid="analytics-revenue" className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-amber-100">Total Revenue</CardTitle>
              <TrendingUp className="w-5 h-5 text-amber-200" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(analytics?.total_revenue || 0)}</div>
              <p className="text-xs text-amber-200 mt-1">Platform fee: {formatCurrency(analytics?.total_platform_fee || 0)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full md:w-auto grid-cols-2 md:grid-cols-3">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="sellers" data-testid="tab-sellers">Seller Revenue</TabsTrigger>
            <TabsTrigger value="charts" data-testid="tab-charts">Charts</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {sellerRevenue && (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Gross Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(sellerRevenue.summary?.total_gross_revenue || 0)}
                    </p>
                    <div className="flex items-center gap-1 text-green-600 text-sm mt-1">
                      <ArrowUpRight className="w-4 h-4" />
                      <span>From all sellers</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Platform Fee Collected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatCurrency(sellerRevenue.summary?.total_platform_fee || 0)}
                    </p>
                    <div className="flex items-center gap-1 text-purple-600 text-sm mt-1">
                      <DollarSign className="w-4 h-4" />
                      <span>2% commission</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Seller Payouts Done</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(sellerRevenue.summary?.total_seller_payouts || 0)}
                    </p>
                    <div className="flex items-center gap-1 text-green-600 text-sm mt-1">
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Paid to sellers</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Pending Payouts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(sellerRevenue.summary?.total_pending || 0)}
                    </p>
                    <div className="flex items-center gap-1 text-orange-600 text-sm mt-1">
                      <ArrowDownRight className="w-4 h-4" />
                      <span>Yet to be paid</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Top Sellers Quick View */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" /> Top Performing Sellers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sellerRevenue?.sellers?.slice(0, 5).map((seller, index) => (
                    <div key={seller.seller_id} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{seller.business_name || seller.seller_name}</p>
                        <p className="text-sm text-gray-500">{seller.total_orders} orders</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(seller.gross_revenue)}</p>
                        <p className="text-xs text-gray-500">Net: {formatCurrency(seller.net_revenue)}</p>
                      </div>
                      <Progress value={(seller.gross_revenue / (sellerRevenue?.summary?.total_gross_revenue || 1)) * 100} className="w-24" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Seller Revenue Tab */}
          <TabsContent value="sellers">
            <Card>
              <CardHeader>
                <CardTitle>Seller-wise Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Seller</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Gross Revenue</TableHead>
                        <TableHead className="text-right">Platform Fee (2%)</TableHead>
                        <TableHead className="text-right">Net Revenue</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sellerRevenue?.sellers?.map((seller) => (
                        <TableRow key={seller.seller_id} data-testid={`seller-row-${seller.seller_id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{seller.business_name || seller.seller_name}</p>
                              <p className="text-xs text-gray-500">{seller.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(seller.status)}</TableCell>
                          <TableCell className="text-right font-medium">{seller.total_orders}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(seller.gross_revenue)}</TableCell>
                          <TableCell className="text-right text-red-600">-{formatCurrency(seller.platform_fee)}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">{formatCurrency(seller.net_revenue)}</TableCell>
                          <TableCell className="text-right text-blue-600">{formatCurrency(seller.total_paid)}</TableCell>
                          <TableCell className="text-right">
                            {seller.pending_payout > 0 ? (
                              <span className="text-orange-600 font-medium">{formatCurrency(seller.pending_payout)}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {(!sellerRevenue?.sellers || sellerRevenue.sellers.length === 0) && (
                  <div className="text-center py-12 text-gray-500">
                    <Store className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No seller revenue data available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Charts Tab */}
          <TabsContent value="charts" className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Seller (Top 8)</CardTitle>
                </CardHeader>
                <CardContent>
                  {sellerChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={sellerChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={12} angle={-45} textAnchor="end" height={80} />
                        <YAxis fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="revenue" name="Gross Revenue" fill="#8B5CF6" />
                        <Bar dataKey="payout" name="Net Payout" fill="#10B981" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-400">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-400">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Platform Fee vs Payout Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Platform Fee vs Seller Payout</CardTitle>
              </CardHeader>
              <CardContent>
                {sellerChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={sellerChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="fee" name="Platform Fee" fill="#EF4444" stackId="a" />
                      <Bar dataKey="payout" name="Seller Payout" fill="#10B981" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-gray-400">
                    No data available
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
