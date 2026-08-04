import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, DollarSign, Clock, CheckCircle, TrendingUp, Wallet, Calendar, CreditCard, AlertCircle, RefreshCw, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function PayoutHistory() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState([]);
  const [platformFees, setPlatformFees] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [payoutsRes, feesRes, earningsRes] = await Promise.all([
        axios.get(`${API_URL}/seller/payouts`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/seller/platform-fees`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/seller/earnings-summary`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setPayouts(payoutsRes.data);
      setPlatformFees(feesRes.data.fees || []);
      setEarnings(earningsRes.data);
    } catch (error) {
      console.error('Error fetching payout data:', error);
      toast.error('Failed to fetch payout data');
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

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-3 h-3" /> },
      processed: { bg: 'bg-blue-100 text-blue-700', icon: <RefreshCw className="w-3 h-3" /> },
      paid: { bg: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> }
    };
    const style = styles[status] || styles.pending;
    return (
      <Badge variant="outline" className={`${style.bg} flex items-center gap-1`}>
        {style.icon} {status?.toUpperCase()}
      </Badge>
    );
  };

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

        <div className="mb-6">
          <h1 className="text-3xl font-bold">Payout History</h1>
          <p className="text-gray-500 mt-1">Track your earnings and weekly payouts</p>
        </div>

        {/* Earnings Summary */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-purple-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Total Earnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatCurrency(earnings?.total_earnings || 0)}</p>
              <p className="text-xs text-purple-200 mt-1">Lifetime earnings</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-green-100 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Amount Received
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatCurrency(earnings?.total_paid || 0)}</p>
              <p className="text-xs text-green-200 mt-1">Successfully paid</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-orange-100 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Pending Payout
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatCurrency(earnings?.pending_payout || 0)}</p>
              <p className="text-xs text-orange-200 mt-1">Processing soon</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-600 to-gray-700 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-100 flex items-center gap-2">
                <IndianRupee className="w-4 h-4" /> Platform Fee Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatCurrency(earnings?.total_platform_fee || 0)}</p>
              <p className="text-xs text-gray-200 mt-1">2% of sales</p>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800">Weekly Payout Schedule</p>
                <p className="text-sm text-blue-600">
                  Payouts are processed every Monday for the previous week's orders. 
                  A 2% platform fee is deducted from your earnings. Payments are transferred to your registered bank account.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="payouts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="payouts">Weekly Payouts</TabsTrigger>
            <TabsTrigger value="orders">Order-wise Earnings</TabsTrigger>
          </TabsList>

          {/* Payouts Tab */}
          <TabsContent value="payouts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" /> Payout History
                </CardTitle>
                <CardDescription>Your weekly payout records</CardDescription>
              </CardHeader>
              <CardContent>
                {payouts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Gross Amount</TableHead>
                        <TableHead className="text-right">Platform Fee</TableHead>
                        <TableHead className="text-right">Net Payout</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts.map((payout) => (
                        <TableRow key={payout.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-sm">
                                {format(new Date(payout.period_start), 'MMM dd')} - {format(new Date(payout.period_end), 'MMM dd, yyyy')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{payout.total_orders}</TableCell>
                          <TableCell className="text-right">{formatCurrency(payout.gross_amount)}</TableCell>
                          <TableCell className="text-right text-red-600">-{formatCurrency(payout.platform_fee + payout.promotion_fee)}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">{formatCurrency(payout.net_payout)}</TableCell>
                          <TableCell>{getStatusBadge(payout.status)}</TableCell>
                          <TableCell>
                            {payout.payment_reference ? (
                              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{payout.payment_reference}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-500 mb-2">No payouts yet</p>
                    <p className="text-sm text-gray-400">Payouts will appear here once orders are delivered</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Order-wise Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" /> Order-wise Earnings
                </CardTitle>
                <CardDescription>Earnings breakdown by order</CardDescription>
              </CardHeader>
              <CardContent>
                {platformFees.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead className="text-right">Order Amount</TableHead>
                        <TableHead className="text-right">Platform Fee (2%)</TableHead>
                        <TableHead className="text-right">Your Earning</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {platformFees.map((fee) => (
                        <TableRow key={fee.id}>
                          <TableCell className="font-mono text-sm">{fee.order_id?.substring(0, 8)}...</TableCell>
                          <TableCell className="text-right">{formatCurrency(fee.order_amount)}</TableCell>
                          <TableCell className="text-right text-red-600">-{formatCurrency(fee.fee_amount)}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">{formatCurrency(fee.seller_payout)}</TableCell>
                          <TableCell>{getStatusBadge(fee.status)}</TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {fee.created_at ? format(new Date(fee.created_at), 'PP') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <CreditCard className="w-16 h-16 mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-500 mb-2">No order earnings yet</p>
                    <p className="text-sm text-gray-400">Complete orders to see your earnings</p>
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
