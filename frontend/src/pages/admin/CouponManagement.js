import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Percent, Plus, Trash2, Edit, Calendar, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function CouponManagement() {
  const { token } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    min_order_amount: '',
    max_discount: '',
    valid_from: new Date().toISOString().slice(0, 16),
    valid_until: '',
    usage_limit: ''
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const response = await axios.get(`${API_URL}/coupons/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCoupons(response.data);
    } catch (error) {
      toast.error('Failed to fetch coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        code: formData.code.toUpperCase(),
        discount_value: parseFloat(formData.discount_value),
        min_order_amount: parseFloat(formData.min_order_amount) || 0,
        max_discount: formData.max_discount ? parseFloat(formData.max_discount) : null,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        valid_from: new Date(formData.valid_from).toISOString(),
        valid_until: new Date(formData.valid_until).toISOString()
      };

      await axios.post(`${API_URL}/admin/coupons`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Coupon created successfully!');
      fetchCoupons();
      resetForm();
      setShowDialog(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create coupon');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      discount_type: 'percentage',
      discount_value: '',
      min_order_amount: '',
      max_discount: '',
      valid_from: new Date().toISOString().slice(0, 16),
      valid_until: '',
      usage_limit: ''
    });
  };

  const isActive = (coupon) => {
    const now = new Date();
    const validFrom = new Date(coupon.valid_from);
    const validUntil = new Date(coupon.valid_until);
    return coupon.is_active && now >= validFrom && now <= validUntil;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Coupon Management</h1>
          <p className="text-gray-500 mt-1">Create and manage discount coupons</p>
        </div>
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Coupon</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="code">Coupon Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., SAVE20"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Will be auto-converted to uppercase</p>
                </div>

                <div>
                  <Label htmlFor="discount_type">Discount Type *</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(value) => setFormData({ ...formData, discount_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="discount_value">Discount Value *</Label>
                  <Input
                    id="discount_value"
                    type="number"
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    placeholder={formData.discount_type === 'percentage' ? '10' : '100'}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="min_order_amount">Min Order Amount (₹)</Label>
                  <Input
                    id="min_order_amount"
                    type="number"
                    step="0.01"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                    placeholder="0"
                  />
                </div>

                {formData.discount_type === 'percentage' && (
                  <div>
                    <Label htmlFor="max_discount">Max Discount (₹)</Label>
                    <Input
                      id="max_discount"
                      type="number"
                      step="0.01"
                      value={formData.max_discount}
                      onChange={(e) => setFormData({ ...formData, max_discount: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="valid_from">Valid From *</Label>
                  <Input
                    id="valid_from"
                    type="datetime-local"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="valid_until">Valid Until *</Label>
                  <Input
                    id="valid_until"
                    type="datetime-local"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="usage_limit">Usage Limit (Optional)</Label>
                  <Input
                    id="usage_limit"
                    type="number"
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  Create Coupon
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {coupons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Percent className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No coupons created yet</p>
            <Button onClick={() => setShowDialog(true)}>Create Your First Coupon</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => (
            <Card key={coupon.id} className={isActive(coupon) ? 'border-green-500 border-2' : 'border-gray-200'}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-blue-500" />
                    <CardTitle className="text-lg font-mono">{coupon.code}</CardTitle>
                  </div>
                  {isActive(coupon) ? (
                    <Badge className="bg-green-500">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500">Inactive</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-center">
                    {coupon.discount_type === 'percentage'
                      ? `${coupon.discount_value}% OFF`
                      : `₹${coupon.discount_value} OFF`}
                  </p>
                  {coupon.discount_type === 'percentage' && coupon.max_discount && (
                    <p className="text-xs text-center text-gray-600 mt-1">
                      Max discount: ₹{coupon.max_discount}
                    </p>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Min Order:</span>
                    <span className="font-semibold">₹{coupon.min_order_amount}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Usage:</span>
                    <span className="font-semibold">
                      {coupon.used_count} / {coupon.usage_limit || '∞'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t">
                    <Calendar className="w-3 h-3" />
                    <span>Valid: {format(new Date(coupon.valid_from), 'PP')} - {format(new Date(coupon.valid_until), 'PP')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
