import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, DollarSign, CheckCircle, Clock, RefreshCw, Calendar, Wallet, Building, CreditCard, AlertCircle, Download, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function SellerPayouts() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState([]);
  const [sellerRevenue, setSellerRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [paymentRef, setPaymentRef] = useState('');
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('payouts');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [payoutsRes, revenueRes] = await Promise.all([
        axios.get(`${API_URL}/admin/seller-payouts`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/analytics/admin/seller-revenue`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setPayouts(payoutsRes.data);
      setSellerRevenue(revenueRes.data);
    } catch (error) {
      toast.error('Failed to fetch payout data');
    } finally {
      setLoading(false);
    }
  };

  const generatePayouts = async () => {
    setGenerating(true);
    try {
      const response = await axios.post(
        `${API_URL}/admin/generate-payouts`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message || 'Payouts generated successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate payouts');
    } finally {
      setGenerating(false);
    }
  };

  const processPayout = async () => {
    if (!paymentRef.trim()) {
      toast.error('Payment reference is required');
      return;
    }
    try {
      await axios.put(
        `${API_URL}/admin/seller-payouts/${selectedPayout.id}/process`,
        null,
        {
          params: { payment_reference: paymentRef },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Payout processed successfully!');
      fetchData();
      setShowProcessDialog(false);
      setSelectedPayout(null);
      setPaymentRef('');
    } catch (error) {
      toast.error('Failed to process payout');
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
      pending: { bg: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock className="w-3 h-3" /> },
      processed: { bg: 'bg-blue-100 text-blue-700 border-blue-200', icon: <RefreshCw className="w-3 h-3" /> },
      paid: { bg: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle className="w-3 h-3" /> }
    };
    const style = styles[status] || styles.pending;
    return (
      <Badge variant="outline" className={`${style.bg} flex items-center gap-1`}>
        {style.icon} {status?.toUpperCase()}
      </Badge>
    );
  };

  const filteredPayouts = filterStatus === 'all' 
    ? payouts 
    : payouts.filter(p => p.status === filterStatus);

  // Calculate summary stats
  const totalPending = payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.net_payout, 0);
  const totalPaid = payouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.net_payout, 0);
  const totalProcessed = payouts.filter(p => p.status === 'processed').reduce((sum, p) => sum + p.net_payout, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
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

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Seller Payouts</h1>
            <p className="text-gray-500 mt-1">Manage weekly seller payments and track payout history</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            <Button onClick={generatePayouts} disabled={generating} className="gap-2" data-testid="generate-payouts-btn">
              <DollarSign className="w-4 h-4" />
              {generating ? 'Generating...' : 'Generate Weekly Payouts'}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-yellow-700 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-800">{formatCurrency(totalPending)}</p>
              <p className="text-xs text-yellow-600">{payouts.filter(p => p.status === 'pending').length} payouts</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-blue-700 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-800">{formatCurrency(totalProcessed)}</p>
              <p className="text-xs text-blue-600">{payouts.filter(p => p.status === 'processed').length} payouts</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-green-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-800">{formatCurrency(totalPaid)}</p>
              <p className="text-xs text-green-600">{payouts.filter(p => p.status === 'paid').length} payouts</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-purple-700 flex items-center gap-2">
                <Wallet className="w-4 h-4" /> Total Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-800">{formatCurrency(sellerRevenue?.summary?.total_pending || 0)}</p>
              <p className="text-xs text-purple-600">Across all sellers</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="payouts">Payout Records</TabsTrigger>
            <TabsTrigger value="sellers">Seller Summary</TabsTrigger>
          </TabsList>

          {/* Payouts Tab */}
          <TabsContent value="payouts" className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-lg border">
              <Filter className="w-4 h-4 text-gray-500" />
              <Label className="text-sm">Filter by Status:</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payouts</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payouts Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Platform Fee</TableHead>
                      <TableHead className="text-right">Net Payout</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium">
                                {format(new Date(payout.period_start), 'MMM dd')} - {format(new Date(payout.period_end), 'MMM dd, yyyy')}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{payout.seller_id?.substring(0, 8)}...</p>
                        </TableCell>
                        <TableCell className="text-right">{payout.total_orders}</TableCell>
                        <TableCell className="text-right">{formatCurrency(payout.gross_amount)}</TableCell>
                        <TableCell className="text-right text-red-600">-{formatCurrency(payout.platform_fee + payout.promotion_fee)}</TableCell>
                        <TableCell className="text-right font-bold text-green-600">{formatCurrency(payout.net_payout)}</TableCell>
                        <TableCell>{getStatusBadge(payout.status)}</TableCell>
                        <TableCell>
                          {payout.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedPayout(payout);
                                setShowProcessDialog(true);
                              }}
                              data-testid={`process-btn-${payout.id}`}
                            >
                              Process
                            </Button>
                          )}
                          {payout.status === 'paid' && payout.payment_reference && (
                            <span className="text-xs text-gray-500">Ref: {payout.payment_reference}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {filteredPayouts.length === 0 && (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-500 mb-4">No payouts found</p>
                    <Button onClick={generatePayouts} disabled={generating}>
                      {generating ? 'Generating...' : 'Generate Payouts'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Seller Summary Tab */}
          <TabsContent value="sellers">
            <Card>
              <CardHeader>
                <CardTitle>Seller Payout Summary</CardTitle>
                <CardDescription>Overview of pending and paid amounts per seller</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Seller</TableHead>
                      <TableHead>Business Name</TableHead>
                      <TableHead className="text-right">Total Orders</TableHead>
                      <TableHead className="text-right">Net Revenue</TableHead>
                      <TableHead className="text-right">Total Paid</TableHead>
                      <TableHead className="text-right">Pending Payout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellerRevenue?.sellers?.map((seller) => (
                      <TableRow key={seller.seller_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{seller.seller_name}</p>
                            <p className="text-xs text-gray-500">{seller.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{seller.business_name}</TableCell>
                        <TableCell className="text-right">{seller.total_orders}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(seller.net_revenue)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(seller.total_paid)}</TableCell>
                        <TableCell className="text-right">
                          {seller.pending_payout > 0 ? (
                            <span className="font-bold text-orange-600">{formatCurrency(seller.pending_payout)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {(!sellerRevenue?.sellers || sellerRevenue.sellers.length === 0) && (
                  <div className="text-center py-12 text-gray-500">
                    <Building className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                    <p>No seller data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Process Payout Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Process Payout
            </DialogTitle>
            <DialogDescription>
              Mark this payout as processed and enter the payment reference.
            </DialogDescription>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Payout Amount:</span>
                  <span className="font-bold text-lg text-green-600">{formatCurrency(selectedPayout.net_payout)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Period:</span>
                  <span>{format(new Date(selectedPayout.period_start), 'PP')} - {format(new Date(selectedPayout.period_end), 'PP')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Orders:</span>
                  <span>{selectedPayout.total_orders}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="payment-ref">Payment Reference / Transaction ID *</Label>
                <Input
                  id="payment-ref"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g., NEFT123456789"
                  className="mt-1"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  Make sure the payment has been transferred to the seller's bank account before marking as processed.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessDialog(false)}>Cancel</Button>
            <Button onClick={processPayout} className="gap-2">
              <CheckCircle className="w-4 h-4" /> Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
