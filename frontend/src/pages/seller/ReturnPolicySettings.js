import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Save, Info } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function ReturnPolicySettings() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState({
    returns_enabled: true,
    return_window_days: 7,
    replacement_enabled: true,
    replacement_window_days: 7,
    conditions: ''
  });

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      const authToken = token || localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/return-policy/seller`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setPolicy(response.data);
    } catch (error) {
      console.error('Failed to fetch policy');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const authToken = token || localStorage.getItem('token');
      await axios.put(
        `${API_URL}/return-policy`,
        null,
        {
          params: policy,
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      toast.success('Return policy updated successfully!');
    } catch (error) {
      toast.error('Failed to update policy');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Return & Replacement Policy</h1>
        <p className="text-gray-500 mt-1">Configure your return and replacement policies</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Return Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                id="returns_enabled"
                checked={policy.returns_enabled}
                onChange={(e) => setPolicy({ ...policy, returns_enabled: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="returns_enabled">Enable Returns</Label>
            </div>

            {policy.returns_enabled && (
              <div>
                <Label>Return Window</Label>
                <Select
                  value={policy.return_window_days.toString()}
                  onValueChange={(value) => setPolicy({ ...policy, return_window_days: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="10">10 Days</SelectItem>
                    <SelectItem value="15">15 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Replacement Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                id="replacement_enabled"
                checked={policy.replacement_enabled}
                onChange={(e) => setPolicy({ ...policy, replacement_enabled: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="replacement_enabled">Enable Replacements</Label>
            </div>

            {policy.replacement_enabled && (
              <div>
                <Label>Replacement Window</Label>
                <Select
                  value={policy.replacement_window_days.toString()}
                  onValueChange={(value) => setPolicy({ ...policy, replacement_window_days: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="10">10 Days</SelectItem>
                    <SelectItem value="15">15 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Terms & Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={policy.conditions}
              onChange={(e) => setPolicy({ ...policy, conditions: e.target.value })}
              rows={4}
              placeholder="Product must be unused and in original packaging..."
            />
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700">
                <p className="font-semibold mb-2">Important Information:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>These policies apply to all your products</li>
                  <li>Customers can request returns within the specified window</li>
                  <li>You must approve/reject return requests</li>
                  <li>Clear conditions help reduce disputes</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full gap-2">
          <Save className="w-4 h-4" />
          Save Policy
        </Button>
      </form>
    </div>
  );
}
