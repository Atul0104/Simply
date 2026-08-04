import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, SlidersHorizontal, Package, Heart, Star } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const sortOptions = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price_low_high', label: 'Price: Low to High' },
  { value: 'price_high_low', label: 'Price: High to Low' },
  { value: 'discount', label: 'Highest Discount' },
  { value: 'rating', label: 'Customer Rating' },
  { value: 'newest', label: 'Newest First' }
];

const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const colors = [
  { name: 'Black', value: 'black', hex: '#000000' },
  { name: 'White', value: 'white', hex: '#FFFFFF' },
  { name: 'Red', value: 'red', hex: '#EF4444' },
  { name: 'Blue', value: 'blue', hex: '#3B82F6' },
  { name: 'Green', value: 'green', hex: '#10B981' },
  { name: 'Yellow', value: 'yellow', hex: '#F59E0B' },
  { name: 'Pink', value: 'pink', hex: '#EC4899' },
  { name: 'Purple', value: 'purple', hex: '#A855F7' },
];

function ProductCard({ product, onClick }) {
  const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);
  
  return (
    <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 group" onClick={onClick}>
      <CardContent className="p-0">
        <div className="aspect-square bg-gray-100 relative overflow-hidden">
          {product.images && product.images[0] ? (
            <img 
              src={product.images[0]} 
              alt={product.name} 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
          )}
          {discount > 0 && (
            <Badge className="absolute top-2 right-2 bg-red-500 animate-pulse">
              {discount}% OFF
            </Badge>
          )}
          <button 
            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-2 shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              // Add to wishlist logic
            }}
          >
            <Heart className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3">
          <h3 className="font-semibold truncate">{product.name}</h3>
          <p className="text-sm text-gray-500 truncate">{product.category}</p>
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs text-gray-600">4.2</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-bold text-lg">₹{product.price}</span>
            {product.mrp > product.price && (
              <>
                <span className="text-sm text-gray-400 line-through">₹{product.mrp}</span>
                <span className="text-xs text-green-600 font-semibold">{discount}% off</span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CategoryPage() {
  const { category } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Filters state
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'recommended');
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [minRating, setMinRating] = useState(0);

  useEffect(() => {
    fetchProducts();
  }, [category]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [products, sortBy, selectedSizes, selectedColors, priceRange, minRating]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/products`, {
        params: { category: category }
      });
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...products];

    // Apply filters
    if (selectedSizes.length > 0) {
      // Filter by size (assuming size is in specifications)
      filtered = filtered.filter(p => 
        selectedSizes.some(size => 
          p.specifications?.size?.includes(size) || 
          p.specifications?.Size?.includes(size)
        )
      );
    }

    if (selectedColors.length > 0) {
      // Filter by color
      filtered = filtered.filter(p =>
        selectedColors.some(color =>
          p.name.toLowerCase().includes(color) ||
          p.description.toLowerCase().includes(color) ||
          p.specifications?.color?.toLowerCase().includes(color) ||
          p.specifications?.Color?.toLowerCase().includes(color)
        )
      );
    }

    // Filter by price range
    filtered = filtered.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);

    // Filter by rating (mock for now)
    if (minRating > 0) {
      // In real app, this would filter based on actual ratings
      filtered = filtered.filter(() => Math.random() > 0.3); // Mock filter
    }

    // Apply sorting
    switch (sortBy) {
      case 'price_low_high':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price_high_low':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'discount':
        filtered.sort((a, b) => {
          const discountA = ((a.mrp - a.price) / a.mrp) * 100;
          const discountB = ((b.mrp - b.price) / b.mrp) * 100;
          return discountB - discountA;
        });
        break;
      case 'rating':
        // Mock sorting by rating
        filtered.sort(() => Math.random() - 0.5);
        break;
      case 'newest':
        filtered.reverse();
        break;
      default: // recommended
        // Keep original order
        break;
    }

    setFilteredProducts(filtered);
  };

  const toggleSize = (size) => {
    setSelectedSizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const toggleColor = (color) => {
    setSelectedColors(prev =>
      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
    );
  };

  const clearFilters = () => {
    setSelectedSizes([]);
    setSelectedColors([]);
    setPriceRange([0, 10000]);
    setMinRating(0);
    setSortBy('recommended');
  };

  const activeFiltersCount = selectedSizes.length + selectedColors.length + (minRating > 0 ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                data-testid="back-btn"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{category}</h1>
                <p className="text-sm text-gray-500">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]" data-testid="sort-select">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="relative" data-testid="filters-btn">
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Filters
                    {activeFiltersCount > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>

                  <div className="mt-6 space-y-6">
                    {/* Price Range */}
                    <div>
                      <h3 className="font-semibold mb-3">Price Range</h3>
                      <div className="space-y-4">
                        <Slider
                          min={0}
                          max={10000}
                          step={100}
                          value={priceRange}
                          onValueChange={setPriceRange}
                          className="w-full"
                        />
                        <div className="flex justify-between text-sm">
                          <span>₹{priceRange[0]}</span>
                          <span>₹{priceRange[1]}</span>
                        </div>
                      </div>
                    </div>

                    {/* Size */}
                    <div>
                      <h3 className="font-semibold mb-3">Size</h3>
                      <div className="flex flex-wrap gap-2">
                        {sizes.map(size => (
                          <Button
                            key={size}
                            variant={selectedSizes.includes(size) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleSize(size)}
                            data-testid={`size-${size}`}
                          >
                            {size}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Color */}
                    <div>
                      <h3 className="font-semibold mb-3">Color</h3>
                      <div className="grid grid-cols-4 gap-3">
                        {colors.map(color => (
                          <button
                            key={color.value}
                            onClick={() => toggleColor(color.value)}
                            className={`relative w-12 h-12 rounded-full border-2 transition-all ${
                              selectedColors.includes(color.value)
                                ? 'border-blue-500 ring-2 ring-blue-200'
                                : 'border-gray-300'
                            }`}
                            style={{ backgroundColor: color.hex }}
                            title={color.name}
                            data-testid={`color-${color.value}`}
                          >
                            {color.value === 'white' && (
                              <div className="absolute inset-0 border rounded-full border-gray-300"></div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Customer Rating */}
                    <div>
                      <h3 className="font-semibold mb-3">Customer Rating</h3>
                      <div className="space-y-2">
                        {[4, 3, 2, 1].map(rating => (
                          <Button
                            key={rating}
                            variant={minRating === rating ? 'default' : 'outline'}
                            className="w-full justify-start"
                            onClick={() => setMinRating(minRating === rating ? 0 : rating)}
                            data-testid={`rating-${rating}`}
                          >
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                            {rating}+ Stars
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={clearFilters}
                        data-testid="clear-filters-btn"
                      >
                        Clear All
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => setFiltersOpen(false)}
                        data-testid="apply-filters-btn"
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No items found</h3>
            <p className="text-gray-500 mb-4">
              No products match your current filters
            </p>
            <Button onClick={clearFilters} variant="outline">
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            {/* Active Filters Display */}
            {activeFiltersCount > 0 && (
              <div className="mb-4 flex flex-wrap gap-2 items-center">
                <span className="text-sm text-gray-600">Active filters:</span>
                {selectedSizes.map(size => (
                  <Badge key={size} variant="secondary" className="cursor-pointer" onClick={() => toggleSize(size)}>
                    Size: {size} ×
                  </Badge>
                ))}
                {selectedColors.map(color => (
                  <Badge key={color} variant="secondary" className="cursor-pointer" onClick={() => toggleColor(color)}>
                    {color} ×
                  </Badge>
                ))}
                {minRating > 0 && (
                  <Badge variant="secondary" className="cursor-pointer" onClick={() => setMinRating(0)}>
                    {minRating}+ Stars ×
                  </Badge>
                )}
                <Button variant="link" size="sm" onClick={clearFilters} className="text-xs">
                  Clear all
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => navigate(`/customer/product/${product.id}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
