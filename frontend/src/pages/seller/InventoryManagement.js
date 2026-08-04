import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function InventoryManagement() {
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState({});
  const [editDialog, setEditDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [threshold, setThreshold] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await axios.get(`${API_URL}/inventory/my`);
      setInventory(response.data);
      
      // Fetch product details
      const productIds = [...new Set(response.data.map(i => i.product_id))];
      const productPromises = productIds.map(id => axios.get(`${API_URL}/products/${id}`));
      const productResponses = await Promise.all(productPromises);
      
      const productsMap = {};
      productResponses.forEach(res => {
        productsMap[res.data.id] = res.data;
      });
      setProducts(productsMap);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    try {
      await axios.put(`${API_URL}/inventory/${editingItem.product_id}`, {
        quantity: parseInt(quantity),
        low_stock_threshold: threshold ? parseInt(threshold) : null
      });
      toast.success('Inventory updated!');
      setEditDialog(false);
      setEditingItem(null);
      fetchInventory();
    } catch (error) {
      toast.error('Failed to update inventory');
    }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setQuantity(item.quantity.toString());
    setThreshold(item.low_stock_threshold.toString());
    setEditDialog(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate('/seller')} className="mb-4" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        
        <h1 className="text-3xl font-bold mb-6">Inventory Management</h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {inventory.map((item) => {
            const product = products[item.product_id];
            const isLowStock = item.quantity <= item.low_stock_threshold;
            
            return (
              <Card key={item.id} data-testid={`inventory-${item.product_id}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{product?.name || 'Loading...'}</h3>
                    {isLowStock && <Badge className="bg-red-500"><AlertTriangle className="w-3 h-3" /></Badge>}
                  </div>
                  <div className="space-y-2 text-sm mb-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current Stock:</span>
                      <span className="font-semibold">{item.quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Low Stock Alert:</span>
                      <span>{item.low_stock_threshold}</span>
                    </div>
                    {item.last_restocked && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Restocked:</span>
                        <span>{new Date(item.last_restocked).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => openEdit(item)}
                    data-testid={`update-inventory-${item.product_id}`}
                  >
                    Update Stock
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {inventory.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No inventory items yet. Add products first!</p>
            </CardContent>
          </Card>
        )}

        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Inventory</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  data-testid="quantity-input"
                />
              </div>
              <div>
                <Label htmlFor="threshold">Low Stock Threshold *</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  required
                  data-testid="threshold-input"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="submit-inventory-btn">
                Update
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
