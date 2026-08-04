import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { User, Camera, Save } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function EnhancedProfilePage() {
  const { token, user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profilePicture, setProfilePicture] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      setProfilePicture(response.data.profile_picture || '');
      setBio(response.data.bio || '');
    } catch (error) {
      toast.error('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePicture = async () => {
    try {
      await axios.put(
        `${API_URL}/profile/picture`,
        null,
        {
          params: { profile_picture: profilePicture },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Profile picture updated!');
      fetchProfile();
    } catch (error) {
      toast.error('Failed to update picture');
    }
  };

  const handleUpdateBio = async () => {
    try {
      await axios.put(
        `${API_URL}/profile/bio`,
        null,
        {
          params: { bio },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Bio updated!');
      fetchProfile();
    } catch (error) {
      toast.error('Failed to update bio');
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">My Profile</h1>

        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16 text-gray-400" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label>Image URL</Label>
                <Input
                  value={profilePicture}
                  onChange={(e) => setProfilePicture(e.target.value)}
                  placeholder="https://your-image-url.com/photo.jpg"
                />
                <Button onClick={handleUpdatePicture} className="gap-2">
                  <Camera className="w-4 h-4" />
                  Update Picture
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input value={user?.name || ''} disabled />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={user?.phone || ''} disabled />
              </div>
              <div>
                <Label>Role</Label>
                <Input value={user?.role || ''} disabled className="capitalize" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About Me</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Tell us about yourself..."
            />
            <Button onClick={handleUpdateBio} className="gap-2">
              <Save className="w-4 h-4" />
              Update Bio
            </Button>
          </CardContent>
        </Card>

        {user && (
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">{user.orders_count || 0}</p>
                  <p className="text-sm text-gray-600">Orders</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">{user.reviews_count || 0}</p>
                  <p className="text-sm text-gray-600">Reviews</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-3xl font-bold text-purple-600">{user.addresses_count || 0}</p>
                  <p className="text-sm text-gray-600">Addresses</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
