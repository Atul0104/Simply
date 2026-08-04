import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function BusinessVerification() {
  const { token } = useAuth();
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    gst_number: '',
    pan_number: '',
    bank_account_number: '',
    bank_ifsc: '',
    aadhaar_number: '',
    trade_license: ''
  });

  useEffect(() => {
    fetchVerification();
  }, []);

  const fetchVerification = async () => {
    try {
      const authToken = token || localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/business-verification`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setVerification(response.data);
      setFormData({
        gst_number: response.data.gst_number || '',
        pan_number: response.data.pan_number || '',
        bank_account_number: response.data.bank_account_number || '',
        bank_ifsc: response.data.bank_ifsc || '',
        aadhaar_number: response.data.aadhaar_number || '',
        trade_license: response.data.trade_license || ''
      });
    } catch (error) {
      console.error('Failed to fetch verification details:', error);
      // Don't show error toast if just no data exists yet
      if (error.response?.status !== 404) {
        toast.error('Failed to fetch verification details');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const authToken = token || localStorage.getItem('token');
      await axios.put(
        `${API_URL}/business-verification`,
        formData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      toast.success('Verification details updated successfully');
      fetchVerification();
    } catch (error) {
      toast.error('Failed to update verification details');
    }
  };

  const getStatusBadge = (verified, status) => {
    if (verified) {
      return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
    }
    if (status === 'pending') {
      return <Badge variant="outline" className="text-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
    return <Badge variant="outline" className="text-gray-500"><XCircle className="w-3 h-3 mr-1" />Not Verified</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Business Verification</h1>
        <p className="text-gray-500 mt-1">Complete your business verification to start selling</p>
      </div>

      {/* Overall Status */}
      <Card className={verification?.verification_status === 'verified' ? 'border-green-500 border-2' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Verification Status</CardTitle>
              <CardDescription>Your business verification progress</CardDescription>
            </div>
            {verification && getStatusBadge(
              verification.verification_status === 'verified',
              verification.verification_status
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">GST Verification</span>
              {getStatusBadge(verification?.gst_verified, verification?.verification_status)}
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">PAN Verification</span>
              {getStatusBadge(verification?.pan_verified, verification?.verification_status)}
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Bank Verification</span>
              {getStatusBadge(verification?.bank_verified, verification?.verification_status)}
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Aadhaar Verification</span>
              {getStatusBadge(verification?.aadhaar_verified, verification?.verification_status)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* GST Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              GST Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="gst_number">GST Number</Label>
              <Input
                id="gst_number"
                value={formData.gst_number}
                onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
              <p className="text-xs text-gray-500 mt-1">15-digit GST identification number</p>
            </div>
          </CardContent>
        </Card>

        {/* PAN Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              PAN Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="pan_number">PAN Number *</Label>
              <Input
                id="pan_number"
                value={formData.pan_number}
                onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
                maxLength={10}
                required
              />
              <p className="text-xs text-gray-500 mt-1">10-character PAN number</p>
            </div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Bank Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="bank_account_number">Bank Account Number *</Label>
              <Input
                id="bank_account_number"
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                placeholder="Enter your bank account number"
                required
              />
            </div>
            <div>
              <Label htmlFor="bank_ifsc">IFSC Code *</Label>
              <Input
                id="bank_ifsc"
                value={formData.bank_ifsc}
                onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value.toUpperCase() })}
                placeholder="SBIN0001234"
                maxLength={11}
                required
              />
              <p className="text-xs text-gray-500 mt-1">11-character IFSC code</p>
            </div>
          </CardContent>
        </Card>

        {/* Aadhaar Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Aadhaar Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="aadhaar_number">Aadhaar Number</Label>
              <Input
                id="aadhaar_number"
                value={formData.aadhaar_number}
                onChange={(e) => setFormData({ ...formData, aadhaar_number: e.target.value })}
                placeholder="1234 5678 9012"
                maxLength={12}
              />
              <p className="text-xs text-gray-500 mt-1">12-digit Aadhaar number (optional)</p>
            </div>
          </CardContent>
        </Card>

        {/* Trade License */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Trade License (Optional)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="trade_license">Trade License Number</Label>
              <Input
                id="trade_license"
                value={formData.trade_license}
                onChange={(e) => setFormData({ ...formData, trade_license: e.target.value })}
                placeholder="Enter trade license number"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" className="flex-1">
            Save Verification Details
          </Button>
        </div>
      </form>

      {/* Information Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Important Information</h3>
          <ul className="text-sm space-y-1 text-gray-700">
            <li>• All verification details are reviewed by our admin team</li>
            <li>• GST and PAN are mandatory for tax compliance</li>
            <li>• Bank details are required for payout processing</li>
            <li>• Verification typically takes 24-48 hours</li>
            <li>• You'll receive notifications once verification is complete</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
