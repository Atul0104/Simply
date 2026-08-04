import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send, Users, Store, Truck, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function BroadcastNotifications() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'admin_broadcast',
    link_url: ''
  });
  
  // Recipient selection
  const [recipientType, setRecipientType] = useState('all'); // all, roles, specific
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    if (recipientType === 'specific') {
      fetchUsers();
    }
  }, [recipientType]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleRoleToggle = (role) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleUserToggle = (userId) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.message) {
      toast.error('Please fill in title and message');
      return;
    }
    
    if (recipientType === 'roles' && selectedRoles.length === 0) {
      toast.error('Please select at least one role');
      return;
    }
    
    if (recipientType === 'specific' && selectedUserIds.length === 0) {
      toast.error('Please select at least one user');
      return;
    }
    
    setLoading(true);

    try {
      const payload = {
        ...formData,
        target_roles: recipientType === 'roles' ? selectedRoles : null,
        user_ids: recipientType === 'specific' ? selectedUserIds : null
      };
      
      const response = await axios.post(`${API_URL}/admin/notifications/broadcast`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(response.data.message || 'Notifications sent successfully!');
      setFormData({ title: '', message: '', type: 'admin_broadcast', link_url: '' });
      setSelectedRoles([]);
      setSelectedUserIds([]);
    } catch (error) {
      toast.error('Failed to send notifications');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roleOptions = [
    { value: 'customer', label: 'Customers', icon: Users, color: 'text-blue-500' },
    { value: 'seller', label: 'Sellers', icon: Store, color: 'text-purple-500' },
    { value: 'delivery_partner', label: 'Delivery Partners', icon: Truck, color: 'text-green-500' },
    { value: 'admin', label: 'Admins', icon: UserCheck, color: 'text-red-500' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        
        <h1 className="text-3xl font-bold mb-6">Send Notifications</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Recipient Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Recipients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    value="all"
                    checked={recipientType === 'all'}
                    onChange={() => setRecipientType('all')}
                    className="w-4 h-4"
                  />
                  <span>All Users</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    value="roles"
                    checked={recipientType === 'roles'}
                    onChange={() => setRecipientType('roles')}
                    className="w-4 h-4"
                  />
                  <span>By Role</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    value="specific"
                    checked={recipientType === 'specific'}
                    onChange={() => setRecipientType('specific')}
                    className="w-4 h-4"
                  />
                  <span>Specific Users</span>
                </label>
              </div>
              
              {/* Role Selection */}
              {recipientType === 'roles' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                  {roleOptions.map(({ value, label, icon: Icon, color }) => (
                    <div
                      key={value}
                      onClick={() => handleRoleToggle(value)}
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedRoles.includes(value)
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                        selectedRoles.includes(value) 
                          ? 'bg-blue-500 border-blue-500' 
                          : 'border-gray-300'
                      }`}>
                        {selectedRoles.includes(value) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <Icon className={`w-5 h-5 ${color}`} />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Specific Users Selection */}
              {recipientType === 'specific' && (
                <div className="pt-4 space-y-4">
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  
                  {loadingUsers ? (
                    <div className="text-center py-4">Loading users...</div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border rounded-lg">
                      {filteredUsers.map(user => (
                        <div
                          key={user.id}
                          onClick={() => handleUserToggle(user.id)}
                          className={`flex items-center gap-3 p-3 border-b cursor-pointer ${
                            selectedUserIds.includes(user.id)
                              ? 'bg-blue-50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0 ${
                            selectedUserIds.includes(user.id) 
                              ? 'bg-blue-500 border-blue-500' 
                              : 'border-gray-300'
                          }`}>
                            {selectedUserIds.includes(user.id) && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded capitalize">
                            {user.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {selectedUserIds.length > 0 && (
                    <p className="text-sm text-blue-600">
                      {selectedUserIds.length} user(s) selected
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Notification Content */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="Enter notification title"
                  data-testid="notification-title"
                />
              </div>

              <div>
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  placeholder="Enter notification message"
                  rows={5}
                  data-testid="notification-message"
                />
              </div>
              
              <div>
                <Label htmlFor="link_url">Link URL (Optional)</Label>
                <Input
                  id="link_url"
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  placeholder="e.g., /customer/orders or /seller/products"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Users will be redirected to this URL when clicking the notification
                </p>
              </div>
              
              <div>
                <Label htmlFor="type">Notification Type</Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full border rounded-lg p-2"
                >
                  <option value="admin_broadcast">Admin Broadcast</option>
                  <option value="marketing">Marketing / Promotional</option>
                  <option value="order_update">Order Update</option>
                  <option value="seller_approval">Seller Approval</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Summary:</strong> {' '}
              {recipientType === 'all' && 'Notification will be sent to all users on the platform.'}
              {recipientType === 'roles' && selectedRoles.length > 0 && 
                `Notification will be sent to: ${selectedRoles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}`}
              {recipientType === 'roles' && selectedRoles.length === 0 && 'Please select at least one role.'}
              {recipientType === 'specific' && `Notification will be sent to ${selectedUserIds.length} selected user(s).`}
            </p>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading} data-testid="send-notification-btn">
            <Send className="w-4 h-4" />
            {loading ? 'Sending...' : 'Send Notification'}
          </Button>
        </form>
      </div>
    </div>
  );
}
