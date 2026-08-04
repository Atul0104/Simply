import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, User, Package, MapPin, Heart, Star, Edit, Plus, Trash2, Home, Briefcase, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  
  // Get token from localStorage
  const token = localStorage.getItem('token');
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressForm, setAddressForm] = useState({
    name: '',
    phone: '',
    pincode: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    landmark: '',
    address_type: 'home',
    is_default: false
  });
  const [pincodeLoading, setPincodeLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchProfile();
    fetchAddresses();
  }, [user, navigate]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
      setProfileForm({ name: response.data.name, phone: response.data.phone || '' });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
    setLoading(false);
  };

  const fetchAddresses = async () => {
    try {
      const response = await axios.get(`${API_URL}/addresses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAddresses(response.data);
    } catch (error) {
      console.error('Error fetching addresses:', error);
    }
  };

  const handleProfileUpdate = async () => {
    try {
      await axios.put(`${API_URL}/profile`, profileForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Profile updated successfully');
      setEditingProfile(false);
      fetchProfile();
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handlePincodeChange = async (pincode) => {
    setAddressForm({ ...addressForm, pincode });
    if (pincode.length === 6) {
      setPincodeLoading(true);
      try {
        const response = await axios.get(`${API_URL}/pincode/${pincode}`);
        setAddressForm(prev => ({
          ...prev,
          city: response.data.city,
          state: response.data.state
        }));
        toast.success('Address details fetched!');
      } catch (error) {
        toast.error('Could not fetch address details');
      }
      setPincodeLoading(false);
    }
  };

  const handleAddressSubmit = async () => {
    if (!addressForm.name || !addressForm.phone || !addressForm.pincode || !addressForm.address_line1 || !addressForm.city || !addressForm.state) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      if (editingAddress) {
        await axios.put(`${API_URL}/addresses/${editingAddress.id}`, addressForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Address updated successfully');
      } else {
        await axios.post(`${API_URL}/addresses`, addressForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Address added successfully');
      }
      setAddressDialogOpen(false);
      setEditingAddress(null);
      resetAddressForm();
      fetchAddresses();
    } catch (error) {
      console.error('Address submit error:', error);
      toast.error(error.response?.data?.detail || 'Failed to save address');
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return;
    
    try {
      await axios.delete(`${API_URL}/addresses/${addressId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Address deleted');
      fetchAddresses();
    } catch (error) {
      toast.error('Failed to delete address');
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      await axios.put(`${API_URL}/addresses/${addressId}/default`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Default address updated');
      fetchAddresses();
    } catch (error) {
      toast.error('Failed to update default address');
    }
  };

  const openEditAddress = (address) => {
    setEditingAddress(address);
    setAddressForm({
      name: address.name,
      phone: address.phone,
      pincode: address.pincode,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || '',
      city: address.city,
      state: address.state,
      landmark: address.landmark || '',
      address_type: address.address_type,
      is_default: address.is_default
    });
    setAddressDialogOpen(true);
  };

  const resetAddressForm = () => {
    setAddressForm({
      name: '',
      phone: '',
      pincode: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      landmark: '',
      address_type: 'home',
      is_default: false
    });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft />
            </Button>
            <h1 className="text-xl font-bold">My Profile</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile Info</TabsTrigger>
            <TabsTrigger value="addresses">My Addresses</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Profile Card */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Personal Information</CardTitle>
                      <CardDescription>Manage your personal details</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditingProfile(!editingProfile)}>
                      <Edit className="w-4 h-4 mr-2" />
                      {editingProfile ? 'Cancel' : 'Edit'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingProfile ? (
                    <div className="space-y-4">
                      <div>
                        <Label>Full Name</Label>
                        <Input
                          value={profileForm.name}
                          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Phone Number</Label>
                        <Input
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        />
                      </div>
                      <Button onClick={handleProfileUpdate}>Save Changes</Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                          {profile?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{profile?.name}</h2>
                          <p className="text-gray-500">{profile?.email}</p>
                          {profile?.phone && <p className="text-gray-500">{profile?.phone}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/customer/orders')}>
                  <CardContent className="p-4 text-center">
                    <Package className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <p className="text-2xl font-bold">{profile?.stats?.orders_count || 0}</p>
                    <p className="text-sm text-gray-500">Orders</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/customer/wishlist')}>
                  <CardContent className="p-4 text-center">
                    <Heart className="w-8 h-8 mx-auto mb-2 text-red-500" />
                    <p className="text-2xl font-bold">{JSON.parse(localStorage.getItem('wishlist') || '[]').length}</p>
                    <p className="text-sm text-gray-500">Wishlist</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Star className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                    <p className="text-2xl font-bold">{profile?.stats?.reviews_count || 0}</p>
                    <p className="text-sm text-gray-500">Reviews</p>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Saved Addresses</h2>
                <Dialog open={addressDialogOpen} onOpenChange={(open) => {
                  setAddressDialogOpen(open);
                  if (!open) {
                    setEditingAddress(null);
                    resetAddressForm();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" /> Add Address
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Full Name *</Label>
                          <Input
                            value={addressForm.name}
                            onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                            placeholder="Enter name"
                          />
                        </div>
                        <div>
                          <Label>Phone Number *</Label>
                          <div className="flex gap-2">
                            <span className="flex items-center px-3 bg-gray-100 border rounded-l-md text-gray-600 text-sm">+91</span>
                            <Input
                              value={addressForm.phone}
                              onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                              placeholder="10-digit number"
                              maxLength={10}
                              className="rounded-l-none"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Pincode *</Label>
                          <Input
                            value={addressForm.pincode}
                            onChange={(e) => handlePincodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="6-digit pincode"
                            maxLength={6}
                          />
                          {pincodeLoading && <p className="text-xs text-blue-500 mt-1">Fetching location...</p>}
                        </div>
                        <div>
                          <Label>Address Type</Label>
                          <Select value={addressForm.address_type} onValueChange={(v) => setAddressForm({ ...addressForm, address_type: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="home"><Home className="w-4 h-4 inline mr-2" />Home</SelectItem>
                              <SelectItem value="work"><Briefcase className="w-4 h-4 inline mr-2" />Work</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>Address Line 1 *</Label>
                        <Input
                          value={addressForm.address_line1}
                          onChange={(e) => setAddressForm({ ...addressForm, address_line1: e.target.value })}
                          placeholder="House No., Building, Street"
                        />
                      </div>
                      <div>
                        <Label>Address Line 2</Label>
                        <Input
                          value={addressForm.address_line2}
                          onChange={(e) => setAddressForm({ ...addressForm, address_line2: e.target.value })}
                          placeholder="Area, Colony"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>City *</Label>
                          <Input
                            value={addressForm.city}
                            onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                            placeholder="City"
                          />
                        </div>
                        <div>
                          <Label>State *</Label>
                          <Input
                            value={addressForm.state}
                            onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                            placeholder="State"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Landmark (Optional)</Label>
                        <Input
                          value={addressForm.landmark}
                          onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                          placeholder="Nearby landmark"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_default"
                          checked={addressForm.is_default}
                          onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                          className="rounded"
                        />
                        <Label htmlFor="is_default">Set as default address</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddressDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddressSubmit}>
                        {editingAddress ? 'Update' : 'Add'} Address
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {addresses.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No saved addresses</p>
                    <p className="text-sm text-gray-400">Add an address for faster checkout</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <Card key={address.id} className={address.is_default ? 'border-blue-500 border-2' : ''}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {address.address_type === 'home' ? (
                                <Home className="w-4 h-4 text-blue-500" />
                              ) : address.address_type === 'work' ? (
                                <Briefcase className="w-4 h-4 text-purple-500" />
                              ) : (
                                <MapPin className="w-4 h-4 text-gray-500" />
                              )}
                              <span className="font-semibold capitalize">{address.address_type}</span>
                              {address.is_default && (
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">Default</span>
                              )}
                            </div>
                            <p className="font-medium">{address.name}</p>
                            <p className="text-gray-600 text-sm">
                              {address.address_line1}
                              {address.address_line2 && `, ${address.address_line2}`}
                            </p>
                            <p className="text-gray-600 text-sm">
                              {address.city}, {address.state} - {address.pincode}
                            </p>
                            {address.landmark && (
                              <p className="text-gray-500 text-sm">Landmark: {address.landmark}</p>
                            )}
                            <p className="text-gray-600 text-sm mt-1">Phone: {address.phone}</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditAddress(address)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteAddress(address.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            {!address.is_default && (
                              <Button variant="ghost" size="sm" className="text-blue-500" onClick={() => handleSetDefault(address.id)}>
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
