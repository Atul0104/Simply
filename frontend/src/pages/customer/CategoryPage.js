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
import BottleLoader from '@/components/BottleLoader';
import Seo from '@/components/Seo';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const sortOptions = [
  { value: 'relevance', label: 'Recommended' },
  { value: 'popularity', label: 'Popularity' },
  { value: 'bestselling', label: 'Bestselling' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'discount', label: 'Highest Discount' },
  { value: 'rating', label: 'Customer Rating' },
  { value: 'newest', label: 'Newest First' },
  { value: 'name_asc', label: 'Name: A to Z' },
  { value: 'name_desc', label: 'Name: Z to A' }
];

const sizes = ['10 ml', '30 ml', '50 ml', '75 ml', '100 ml', '150 ml'];
const fragranceFamilies = ['Floral', 'Woody', 'Fresh', 'Citrus', 'Amber', 'Musk', 'Aquatic', 'Gourmand'];

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
              className="w-full h-full object-contain mix-blend-multiply p-3 sm:p-5 group-hover:scale-105 transition-transform duration-500"
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
          {product.is_coming_soon && <Badge className="absolute bottom-2 left-2 bg-violet-700">Coming Soon</Badge>}
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
            <span className="text-xs text-gray-600">{Number(product.average_rating || 0).toFixed(1)}</span>
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
  
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [fetchError, setFetchError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Filters state
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'relevance');
  const [selectedSizes, setSelectedSizes] = useState(searchParams.getAll('size'));
  const [selectedFamilies, setSelectedFamilies] = useState(searchParams.getAll('fragrance_family'));
  const [priceRange, setPriceRange] = useState([Number(searchParams.get('min_price') || 0), Number(searchParams.get('max_price') || 10000)]);
  const [minRating, setMinRating] = useState(Number(searchParams.get('min_rating') || 0));

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 250);
    return () => clearTimeout(timer);
  }, [category, sortBy, selectedSizes, selectedFamilies, priceRange, minRating]);

  const fetchProducts = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const params = new URLSearchParams();
      if (category?.toLowerCase() === 'coming soon') params.set('coming_soon', 'true');
      else if (category && category.toLowerCase() !== 'all') params.append('category', category);
      selectedSizes.forEach(value => params.append('size', value));
      selectedFamilies.forEach(value => params.append('fragrance_family', value));
      if (priceRange[0] > 0) params.set('min_price', priceRange[0]);
      if (priceRange[1] < 10000) params.set('max_price', priceRange[1]);
      if (minRating > 0) params.set('min_rating', minRating);
      params.set('sort', sortBy);
      params.set('page_size', '48');
      setSearchParams(params, { replace: true });
      const response = await axios.get(`${API_URL}/catalog/products`, {
        params,
      });
      setFilteredProducts(response.data.items || []);
      setTotalProducts(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching products:', error);
      setFetchError(error.response?.data?.detail || 'Unable to load this collection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSize = (size) => {
    setSelectedSizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const toggleFamily = (family) => {
    setSelectedFamilies(prev =>
      prev.includes(family) ? prev.filter(item => item !== family) : [...prev, family]
    );
  };

  const clearFilters = () => {
    setSelectedSizes([]);
    setSelectedFamilies([]);
    setPriceRange([0, 10000]);
    setMinRating(0);
    setSortBy('relevance');
  };

  const activeFiltersCount = selectedSizes.length + selectedFamilies.length + (minRating > 0 ? 1 : 0) + (priceRange[0] > 0 || priceRange[1] < 10000 ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Seo title={category === 'all' ? 'All fragrances' : category} description={`Shop ${category === 'all' ? 'perfume and fragrance' : category} at RAW.`} canonicalPath={`/customer/category/${encodeURIComponent(category)}`} />
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                data-testid="back-btn"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold truncate">{category}</h1>
                <p className="text-sm text-gray-500">
                  {totalProducts} {totalProducts === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[118px] sm:w-[180px]" data-testid="sort-select">
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

                    {/* Fragrance family */}
                    <div>
                      <h3 className="font-semibold mb-3">Fragrance family</h3>
                      <div className="flex flex-wrap gap-2">
                        {fragranceFamilies.map(family => (
                          <Button
                            key={family}
                            variant={selectedFamilies.includes(family) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleFamily(family)}
                            data-testid={`family-${family.toLowerCase()}`}
                          >
                            {family}
                          </Button>
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
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {loading ? (
          <BottleLoader compact label="Selecting fragrances" />
        ) : fetchError ? (
          <div className="text-center py-12" role="alert">
            <Package className="w-16 h-16 mx-auto text-[#8b5b66] mb-4" />
            <h3 className="text-xl font-semibold mb-2">We could not load this collection</h3>
            <p className="text-gray-500 mb-4">{typeof fetchError === 'string' ? fetchError : 'Please try again.'}</p>
            <Button onClick={fetchProducts} variant="outline">Try again</Button>
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
                {selectedFamilies.map(family => (
                  <Badge key={family} variant="secondary" className="cursor-pointer" onClick={() => toggleFamily(family)}>
                    {family} ×
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

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => navigate(`/customer/product/${product.slug || product.id}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
