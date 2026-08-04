import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Warehouse, MapPin, Phone, Clock, Edit, Trash2, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function WarehouseManagement() {
  const { token } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    contact_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    is_default: false,
    pickup_timings: '10:00 AM - 6:00 PM'
  });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const response = await axios.get(`${API_URL}/warehouses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarehouses(response.data);
    } catch (error) {
      toast.error('Failed to fetch warehouses');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingWarehouse) {
        await axios.put(
          `${API_URL}/warehouses/${editingWarehouse.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Warehouse updated successfully');
      } else {
        await axios.post(
          `${API_URL}/warehouses`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Warehouse added successfully');
      }
      fetchWarehouses();
      resetForm();
      setShowDialog(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save warehouse');
    }
  };

  const handleEdit = (warehouse) => {
    setEditingWarehouse(warehouse);
    setFormData(warehouse);
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this warehouse?')) return;
    
    try {
      await axios.delete(`${API_URL}/warehouses/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Warehouse deleted successfully');
      fetchWarehouses();
    } catch (error) {
      toast.error('Failed to delete warehouse');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact_person: '',
      contact_number: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      landmark: '',
      is_default: false,
      pickup_timings: '10:00 AM - 6:00 PM'
    });
    setEditingWarehouse(null);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Warehouse Management</h1>
          <p className="text-gray-500 mt-1">Manage pickup and return addresses</p>
        </div>
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Warehouse
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingWarehouse ? 'Edit Warehouse' : 'Add New Warehouse'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Warehouse Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Main Warehouse"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact_person">Contact Person *</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="contact_number">Contact Number *</Label>
                <Input
                  id="contact_number"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                  placeholder="10-digit mobile number"
                  required
                />
              </div>

              <div>
                <Label htmlFor="address_line1">Address Line 1 *</Label>
                <Input
                  id="address_line1"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  placeholder="Building, Street"
                  required
                />
              </div>

              <div>
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  placeholder="Area, Locality"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="6-digit pincode"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="landmark">Landmark</Label>
                  <Input
                    id="landmark"
                    value={formData.landmark}
                    onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="pickup_timings">Pickup Timings</Label>
                <Input
                  id="pickup_timings"
                  value={formData.pickup_timings}
                  onChange={(e) => setFormData({ ...formData, pickup_timings: e.target.value })}
                  placeholder="e.g., 10:00 AM - 6:00 PM"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_default" className="cursor-pointer">Set as default warehouse</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingWarehouse ? 'Update' : 'Add'} Warehouse
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {warehouses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Warehouse className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No warehouses added yet</p>
            <Button onClick={() => setShowDialog(true)}>Add Your First Warehouse</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {warehouses.map((warehouse) => (
            <Card key={warehouse.id} className={warehouse.is_default ? 'border-blue-500 border-2' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Warehouse className="w-5 h-5 text-blue-500" />
                    <CardTitle className="text-lg">{warehouse.name}</CardTitle>
                  </div>
                  {warehouse.is_default && (
                    <Badge className="bg-blue-500">
                      <Check className="w-3 h-3 mr-1" />
                      Default
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p>{warehouse.address_line1}</p>
                    {warehouse.address_line2 && <p>{warehouse.address_line2}</p>}
                    {warehouse.landmark && <p className="text-gray-500">Landmark: {warehouse.landmark}</p>}
                    <p>{warehouse.city}, {warehouse.state} - {warehouse.pincode}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="font-medium">{warehouse.contact_person}</p>
                    <p className="text-gray-500">{warehouse.contact_number}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-500">{warehouse.pickup_timings}</p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleEdit(warehouse)}
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(warehouse.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
