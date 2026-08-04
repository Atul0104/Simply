import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Edit, Trash2, Image as ImageIcon, Video, X, Info } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function ProductsManagement() {
  const [products, setProducts] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [platformSettings, setPlatformSettings] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    mrp: '',
    sku: '',
    images: [],
    videos: [],
    specifications: {}
  });
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchPlatformSettings();
  }, []);

  const fetchProducts = async () => {
    try {
      const seller = await axios.get(`${API_URL}/sellers/me`);
      const response = await axios.get(`${API_URL}/products`, {
        params: { seller_id: seller.data.id }
      });
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/categories/list`);
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchPlatformSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/platform-settings`);
      setPlatformSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const calculateFees = (price) => {
    if (!platformSettings || !price) return null;
    const platformFee = (price * platformSettings.platform_fee_percentage) / 100;
    const promotionFee = (price * platformSettings.promotion_fee_percentage) / 100;
    const yourEarnings = price - platformFee - promotionFee;
    return { platformFee, promotionFee, yourEarnings };
  };

  const handleAddImage = () => {
    if (imageUrl.trim()) {
      setFormData({
        ...formData,
        images: [...formData.images, imageUrl]
      });
      setImageUrl('');
    }
  };

  const handleRemoveImage = (index) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData({ ...formData, images: newImages });
  };

  const handleAddVideo = () => {
    if (videoUrl.trim()) {
      setFormData({
        ...formData,
        videos: [...formData.videos, videoUrl]
      });
      setVideoUrl('');
    }
  };

  const handleRemoveVideo = (index) => {
    const newVideos = formData.videos.filter((_, i) => i !== index);
    setFormData({ ...formData, videos: newVideos });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        mrp: parseFloat(formData.mrp)
      };

      if (editingProduct) {
        await axios.put(`${API_URL}/products/${editingProduct.id}`, productData);
        toast.success('Product updated successfully!');
      } else {
        await axios.post(`${API_URL}/products`, productData);
        toast.success('Product created successfully!');
      }
      
      fetchProducts();
      resetForm();
      setShowDialog(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save product');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price.toString(),
      mrp: product.mrp.toString(),
      sku: product.sku,
      images: product.images || [],
      videos: product.videos || [],
      specifications: product.specifications || {}
    });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    
    try {
      await axios.delete(`${API_URL}/products/${id}`);
      toast.success('Product deleted successfully!');
      fetchProducts();
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      price: '',
      mrp: '',
      sku: '',
      images: [],
      videos: [],
      specifications: {}
    });
    setEditingProduct(null);
    setImageUrl('');
    setVideoUrl('');
  };

  const fees = calculateFees(parseFloat(formData.price));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Button variant="ghost" onClick={() => navigate('/seller')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Products Management</h1>
          <p className="text-gray-500">Add and manage your products</p>
        </div>
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Product Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Cotton T-Shirt"
                    required
                  />
                </div>
                <div>
                  <Label>Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Price (₹) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>MRP (₹) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>SKU *</Label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="PROD-001"
                    required
                  />
                </div>
              </div>

              {/* Fee Calculation Display */}
              {fees && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Fee Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Product Price:</span>
                      <span className="font-semibold">₹{formData.price}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Platform Fee ({platformSettings.platform_fee_percentage}%):</span>
                      <span>-₹{fees.platformFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Promotion Fee ({platformSettings.promotion_fee_percentage}%):</span>
                      <span>-₹{fees.promotionFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 font-bold text-base pt-2 border-t">
                      <span>Your Earnings:</span>
                      <span>₹{fees.yourEarnings.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Images Section */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <ImageIcon className="w-4 h-4" />
                  Product Images
                </Label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                    />
                    <Button type="button" onClick={handleAddImage} variant="outline">
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  {formData.images.length > 0 && (
                    <div className="grid grid-cols-4 gap-3">
                      {formData.images.map((img, index) => (
                        <div key={index} className="relative group">
                          <img 
                            src={img} 
                            alt={`Product ${index + 1}`} 
                            className="w-full h-24 object-cover rounded-lg border"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Videos Section */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Video className="w-4 h-4" />
                  Product Videos
                </Label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="Enter video URL (YouTube, Vimeo, etc.)"
                    />
                    <Button type="button" onClick={handleAddVideo} variant="outline">
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  {formData.videos.length > 0 && (
                    <div className="space-y-2">
                      {formData.videos.map((video, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 flex-1 overflow-hidden">
                            <Video className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <span className="text-sm truncate">{video}</span>
                          </div>
                          <Button
                            type="button"
                            onClick={() => handleRemoveVideo(index)}
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingProduct ? 'Update Product' : 'Create Product'}
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

      {/* Products Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id}>
            <CardContent className="p-4">
              {product.images?.[0] && (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-48 object-cover rounded-lg mb-3"
                />
              )}
              <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg font-bold">₹{product.price}</span>
                <span className="text-sm text-gray-500 line-through">₹{product.mrp}</span>
              </div>
              <div className="flex gap-2 text-xs text-gray-500 mb-3">
                <span className="px-2 py-1 bg-gray-100 rounded">{product.category}</span>
                {product.images && <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded">{product.images.length} images</span>}
                {product.videos?.length > 0 && <span className="px-2 py-1 bg-purple-100 text-purple-600 rounded">{product.videos.length} videos</span>}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(product)}
                  className="flex-1 gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(product.id)}
                  className="gap-2 text-red-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {products.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Plus className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No products added yet</p>
            <Button onClick={() => setShowDialog(true)}>Add Your First Product</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
