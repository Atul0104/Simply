import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { ShoppingCart, User, Search, Menu, Star, Heart, Package, Bell, LogOut, Home, Shirt, Baby, Gem, Snowflake, Percent, Footprints, Sparkles, HelpCircle, ChevronLeft, ChevronRight, Settings, Eye, TrendingUp, X, Phone, Mail, Facebook, Instagram, Twitter, Youtube, ChevronDown } from 'lucide-react';
import ProductDetails from './customer/ProductDetails';
import CartPage from './customer/CartPage';
import CheckoutPage from './customer/CheckoutPage';
import MyOrders from './customer/MyOrders';
import SupportCenter from './customer/SupportCenter';
import CategoryPage from './customer/CategoryPage';
import WishlistPage from './customer/WishlistPage';
import ProfilePage from './customer/ProfilePage';
import SettingsPage from './customer/SettingsPage';
import OrderTracking from './customer/OrderTracking';
import ReturnRequest from './customer/ReturnRequest';
import EnhancedProfilePage from './customer/EnhancedProfilePage';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import BrandMark from '@/components/BrandMark';
import BottleLoader from '@/components/BottleLoader';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const categories = [
  { 
    label: 'For Him',
    icon: Shirt, 
    color: 'text-blue-600',
    subcategories: ['Woody', 'Fresh', 'Aquatic', 'Spicy', 'Leather']
  },
  { 
    label: 'For Her',
    icon: Gem, 
    color: 'text-pink-500',
    subcategories: ['Floral', 'Fruity', 'Amber', 'Gourmand', 'Musk']
  },
  { 
    label: 'Unisex',
    icon: Baby, 
    color: 'text-amber-500',
    subcategories: ['Clean', 'Citrus', 'Green', 'Aromatic', 'Niche']
  },
  { 
    label: 'Home Scents',
    icon: Star, 
    color: 'text-purple-600',
    subcategories: ['Candles', 'Diffusers', 'Room Sprays', 'Incense']
  },
  { 
    label: 'New Arrivals', 
    icon: Sparkles, 
    color: 'text-rose-500',
    subcategories: []
  },
  { 
    label: 'Sale', 
    icon: Percent, 
    color: 'text-red-600',
    subcategories: ['Clearance', 'Flash Sales', 'Bundle Deals']
  },
  { 
    label: 'Discovery Sets',
    icon: Snowflake, 
    color: 'text-sky-600',
    subcategories: ['For Him', 'For Her', 'Unisex', 'Build Your Own']
  },
  { 
    label: 'Gifting',
    icon: Footprints, 
    color: 'text-green-600',
    subcategories: ['Gift Sets', 'Miniatures', 'Under ₹2,000', 'Luxury Gifts']
  },
];

function ProductCard({ product, onClick }) {
  const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);
  
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="perfurm-product-card cursor-pointer transition-all duration-300 group overflow-hidden" onClick={onClick} data-testid={`product-card-${product.id}`}>
        <CardContent className="p-0">
          <div className="h-40 sm:h-44 lg:h-48 bg-[#f2eee8] relative overflow-hidden p-3 sm:p-4">
            {product.images && product.images[0] ? (
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-[1.03] transition-transform duration-500" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Package className="w-12 h-12 text-gray-400" /></div>
            )}
            {discount > 0 && (
              <Badge className="absolute top-2.5 right-2.5 bg-white/95 text-[#6f3b49] border border-[#6f3b49]/15 shadow-none text-[10px] tracking-wide">{discount}% OFF</Badge>
            )}
            <button className="absolute top-2.5 left-2.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 rounded-full p-2 border border-stone-200 hover:text-[#6f3b49]">
              <Heart className="w-4 h-4 hover:text-red-500" />
            </button>
          </div>
          <div className="p-3.5 sm:p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#8b6f68] mb-1.5 truncate">{product.category}</p>
            <h3 className="display-serif text-[15px] sm:text-base font-semibold leading-snug line-clamp-2 min-h-[40px]">{product.name}</h3>
            <div className="flex flex-wrap items-baseline gap-x-2 mt-2.5">
              <span className="font-bold text-lg">₹{product.price}</span>
              {product.mrp > product.price && (
                <span className="text-sm text-gray-400 line-through">₹{product.mrp}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SearchBar({ onClose }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState({ suggestions: [], products: [] });
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query.length >= 2) {
        fetchSuggestions();
      } else {
        setSuggestions({ suggestions: [], products: [] });
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const fetchSuggestions = async () => {
    try {
      const response = await axios.get(`${API_URL}/search/suggestions`, { params: { q: query } });
      setSuggestions(response.data);
      setShowResults(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/customer/search?q=${encodeURIComponent(query)}`);
      setShowResults(false);
      if (onClose) onClose();
    }
  };

  const handleProductClick = (productId) => {
    navigate(`/customer/product/${productId}`);
    setShowResults(false);
    if (onClose) onClose();
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          ref={inputRef}
          placeholder="Search fragrances, notes and houses..."
          className="pl-10 pr-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          data-testid="search-input"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setSuggestions({ suggestions: [], products: [] }); }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Search Results Dropdown */}
      <AnimatePresence>
        {showResults && (suggestions.suggestions.length > 0 || suggestions.products.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-y-auto"
          >
            {/* Category Suggestions */}
            {suggestions.suggestions.length > 0 && (
              <div className="p-2 border-b">
                <p className="text-xs text-gray-500 px-2 mb-1">Categories</p>
                {suggestions.suggestions.map((cat, idx) => (
                  <button
                    key={idx}
                    onClick={() => { navigate(`/customer/category/${cat}`); setShowResults(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center gap-2"
                  >
                    <Search className="w-4 h-4 text-gray-400" />
                    <span>{cat}</span>
                  </button>
                ))}
              </div>
            )}
            
            {/* Product Suggestions */}
            {suggestions.products.length > 0 && (
              <div className="p-2">
                <p className="text-xs text-gray-500 px-2 mb-1">Products</p>
                {suggestions.products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleProductClick(product.id)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center gap-3"
                  >
                    {product.images?.[0] && (
                      <img src={product.images[0]} alt="" className="w-10 h-10 rounded object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <p className="text-sm text-gray-500">₹{product.price}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

function HomePage() {
  const [products, setProducts] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [trending, setTrending] = useState([]);
  const [mostViewed, setMostViewed] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [offerIndex, setOfferIndex] = useState(0);
  const [tickerMessage, setTickerMessage] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [visibility, setVisibility] = useState({
    show_hero_banner: true,
    show_ticker: true,
    show_categories: true,
    show_most_viewed: true,
    show_trending: true,
    show_bestsellers: true,
    show_new_arrivals: true,
    show_offer_cards: true,
    show_bank_offers: true,
    show_view_store: true,
    show_footer: true
  });
  const [bestsellers, setBestsellers] = useState([]);
  const [heroBanners, setHeroBanners] = useState([]);
  const [offerCards, setOfferCards] = useState([]);
  const [bankOffers, setBankOffers] = useState([]);
  const [footerContent, setFooterContent] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const defaultOffers = [
    { title: 'Find the scent that stays', subtitle: 'An edited collection of modern, memorable fragrance', cta: 'Explore fragrances', image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=1400', link: '/customer/category/all' },
    { title: 'The art of the discovery set', subtitle: 'Try them slowly. Choose the one that feels like you.', cta: 'Discover sets', image: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=1400', link: '/customer/category/Discovery%20Sets' },
    { title: 'A beautiful way to be remembered', subtitle: 'Considered fragrance gifts for every occasion', cta: 'Shop gifting', image: 'https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=1400', link: '/customer/category/Gifting' },
  ];
  const offers = heroBanners.length > 0
    ? heroBanners.map((banner) => ({ title: banner.title, subtitle: banner.subtitle, cta: banner.button_text, image: banner.image_url, link: banner.button_link || '/customer/category/all' }))
    : defaultOffers;

  useEffect(() => {
    fetchProducts();
    fetchTrending();
    fetchMostViewed();
    fetchCategories();
    fetchTicker();
    fetchVisibility();
    fetchBestsellers();
    fetchHeroBanners();
    fetchPromotions();
    fetchFooterContent();
    loadCart();
    if (user) {
      fetchNotifications();
    }
  }, [selectedCategory, user]);

  useEffect(() => {
    const interval = setInterval(() => {
      setOfferIndex((prev) => (prev + 1) % offers.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [offers.length]);

  const loadCart = () => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  };

  const fetchProducts = async () => {
    try {
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      const response = await axios.get(`${API_URL}/products`, { params });
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchTrending = async () => {
    try {
      const response = await axios.get(`${API_URL}/products/trending`, { params: { limit: 8 } });
      setTrending(response.data);
    } catch (error) {
      console.error('Error fetching trending:', error);
    }
  };

  const fetchMostViewed = async () => {
    try {
      const response = await axios.get(`${API_URL}/products/most-viewed`, { params: { limit: 8 } });
      setMostViewed(response.data);
    } catch (error) {
      console.error('Error fetching most viewed:', error);
    }
  };

  const fetchVisibility = async () => {
    try {
      const response = await axios.get(`${API_URL}/storefront-visibility`);
      setVisibility(response.data);
    } catch (error) {
      console.error('Error fetching visibility:', error);
    }
  };

  const fetchBestsellers = async () => {
    try {
      const response = await axios.get(`${API_URL}/products/bestsellers`, { params: { limit: 8 } });
      setBestsellers(response.data);
    } catch (error) {
      console.error('Error fetching bestsellers:', error);
    }
  };

  const fetchHeroBanners = async () => {
    try {
      const response = await axios.get(`${API_URL}/hero-banners`);
      setHeroBanners(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching hero banners:', error);
    }
  };

  const fetchPromotions = async () => {
    try {
      const [offersResponse, banksResponse] = await Promise.all([
        axios.get(`${API_URL}/offer-cards`),
        axios.get(`${API_URL}/bank-offers`),
      ]);
      setOfferCards(Array.isArray(offersResponse.data) ? offersResponse.data : []);
      setBankOffers(Array.isArray(banksResponse.data) ? banksResponse.data : []);
    } catch (error) {
      console.error('Error fetching promotions:', error);
    }
  };

  const fetchFooterContent = async () => {
    try {
      const response = await axios.get(`${API_URL}/footer-content`);
      setFooterContent(response.data);
    } catch (error) {
      console.error('Error fetching footer content:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/categories`);
      setAllCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchTicker = async () => {
    try {
      const response = await axios.get(`${API_URL}/ticker/active`);
      setTickerMessage(response.data.message);
    } catch (error) {
      console.error('Error fetching ticker:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API_URL}/notifications/my`);
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      try {
        await axios.put(`${API_URL}/notifications/${notification.id}/read`);
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }
    
    // Navigate to link if provided
    if (notification.link_url) {
      setShowNotifications(false);
      navigate(notification.link_url);
    }
  };

  const goToCategory = (category, subcategory = null) => {
    const path = subcategory 
      ? `/customer/category/${category}?sub=${encodeURIComponent(subcategory)}`
      : `/customer/category/${category}`;
    navigate(path);
    setMenuOpen(false);
  };

  const unreadNotifications = notifications.filter(n => !n.is_read).length;

  if (initialLoading) {
    return <div className="min-h-screen perfurm-page"><BottleLoader label="Composing the Perfurm collection" /></div>;
  }

  return (
    <div className="min-h-screen perfurm-page">
      {/* Header */}
      <header className="bg-[#fffdf9]/95 backdrop-blur-md border-b border-stone-200/70 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-2.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="menu-btn">
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-1 pb-6">
                    {categories.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <div key={cat.label}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-3"
                            onClick={() => goToCategory(cat.label)}
                            data-testid={`menu-${cat.label.toLowerCase().replace(' ', '-')}`}
                          >
                            <Icon className={`w-5 h-5 ${cat.color}`} />
                            <span>{cat.label}</span>
                          </Button>
                          {cat.subcategories && cat.subcategories.length > 0 && (
                            <div className="ml-10 space-y-1">
                              {cat.subcategories.map((sub) => (
                                <Button
                                  key={sub}
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-gray-600 text-sm"
                                  onClick={() => goToCategory(cat.label, sub)}
                                >
                                  {sub}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </SheetContent>
              </Sheet>
              
              <motion.div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => { setSelectedCategory(null); navigate('/'); }}
                whileHover={{ scale: 1.02 }}
                data-testid="brand-logo"
              >
                <BrandMark />
              </motion.div>
            </div>
            
            <div className="hidden md:flex flex-1 max-w-xl">
              <SearchBar />
            </div>
            
            <div className="flex items-center gap-1">
              {/* Notifications */}
              {user && (
                <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative" data-testid="notifications-btn">
                      <Bell className="w-5 h-5" />
                      {unreadNotifications > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500">
                          {unreadNotifications}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel className="flex justify-between items-center">
                      <span>Notifications</span>
                      {unreadNotifications > 0 && (
                        <span className="text-xs text-blue-600">{unreadNotifications} new</span>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No notifications</div>
                    ) : (
                      notifications.slice(0, 5).map((notif) => (
                        <DropdownMenuItem 
                          key={notif.id} 
                          className={`flex flex-col items-start p-3 cursor-pointer ${!notif.is_read ? 'bg-blue-50' : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className="flex items-start gap-2 w-full">
                            {!notif.is_read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              <p className={`font-medium ${!notif.is_read ? 'text-blue-600' : ''}`}>{notif.title}</p>
                              <p className="text-sm text-gray-500 truncate w-full">{notif.message}</p>
                              {notif.link_url && (
                                <p className="text-xs text-blue-500 mt-1">Click to view →</p>
                              )}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))
                    )}
                    {notifications.length > 5 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-center text-blue-600 cursor-pointer"
                          onClick={() => {
                            setShowNotifications(false);
                            navigate('/customer/notifications');
                          }}
                        >
                          View all notifications
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button variant="ghost" size="icon" onClick={() => navigate('/customer/support')} data-testid="support-btn" title="Help & Support">
                <HelpCircle className="w-5 h-5" />
              </Button>
              
              <Button variant="ghost" size="icon" onClick={() => navigate('/customer/wishlist')} data-testid="wishlist-btn" title="Wishlist">
                <Heart className="w-5 h-5" />
              </Button>
              
              <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/customer/cart')} data-testid="cart-btn" title="Cart">
                <ShoppingCart className="w-5 h-5" />
                {cart.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {cart.length}
                  </Badge>
                )}
              </Button>
              
              {/* User Profile Dropdown */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid="user-menu-btn">
                      <User className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span>{user.name}</span>
                        <span className="text-xs font-normal text-gray-500">{user.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/customer/profile')}>
                      <User className="w-4 h-4 mr-2" /> My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/customer/orders')}>
                      <Package className="w-4 h-4 mr-2" /> My Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/customer/wishlist')}>
                      <Heart className="w-4 h-4 mr-2" /> Wishlist
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/customer/settings')}>
                      <Settings className="w-4 h-4 mr-2" /> Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/customer/support')}>
                      <HelpCircle className="w-4 h-4 mr-2" /> Help & Support
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-red-600">
                      <LogOut className="w-4 h-4 mr-2" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => navigate('/auth')} data-testid="login-btn" title="Login">
                  <User className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Mobile Search */}
          <div className="md:hidden mt-3">
            <SearchBar />
          </div>
        </div>
      </header>

      {/* Sub-Header with Categories */}
      {visibility.show_categories && <div className="bg-[#fffdf9] border-b border-stone-200/70">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-2.5">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="flex-shrink-0 rounded-full px-4 shadow-none"
              data-testid="category-all"
            >
              <Home className="w-4 h-4 mr-1" /> All
            </Button>
            {categories.map((cat) => {
              const Icon = cat.icon;
              if (cat.subcategories && cat.subcategories.length > 0) {
                return (
                  <DropdownMenu key={cat.label}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={selectedCategory === cat.label ? 'default' : 'outline'}
                        size="sm"
                        className="flex-shrink-0 rounded-full px-4 shadow-none border-stone-200"
                        data-testid={`category-${cat.label.toLowerCase().replace(' ', '-')}`}
                      >
                        <Icon className={`w-4 h-4 mr-1 ${cat.color}`} /> {cat.label}
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => goToCategory(cat.label)}>
                        All {cat.label}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {cat.subcategories.map((sub) => (
                        <DropdownMenuItem key={sub} onClick={() => goToCategory(cat.label, sub)}>
                          {sub}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }
              return (
                <Button
                  key={cat.label}
                  variant={selectedCategory === cat.label ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => goToCategory(cat.label)}
                  className="flex-shrink-0 rounded-full px-4 shadow-none border-stone-200"
                  data-testid={`category-${cat.label.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className={`w-4 h-4 mr-1 ${cat.color}`} /> {cat.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>}

      {/* Ticker */}
      {visibility.show_ticker && tickerMessage && (
        <div className="bg-[#6f3b49] text-white overflow-hidden">
          <motion.div
            className="py-2 text-sm font-medium whitespace-nowrap"
            animate={{ x: ['100%', '-100%'] }}
            transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
          >
            {tickerMessage}
          </motion.div>
        </div>
      )}

      {/* Offers Slider */}
      {visibility.show_hero_banner && <section className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 mt-5 sm:mt-7">
        <div className="relative rounded-md overflow-hidden shadow-[0_18px_50px_rgba(55,40,35,0.12)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={offerIndex}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="relative h-[220px] sm:h-[260px] lg:h-[285px]"
            >
              <img src={offers[offerIndex].image} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-stone-950/45 to-transparent flex items-center">
                <div className="px-7 sm:px-12 py-6 text-white max-w-xl">
                  <p className="text-xs uppercase tracking-[0.28em] mb-3 text-stone-200">Perfurm · Olfactory stories</p>
                  <h2 className="display-serif text-3xl sm:text-4xl lg:text-[44px] leading-[1.05] font-semibold mb-3">{offers[offerIndex].title}</h2>
                  <p className="mb-4 text-sm sm:text-base text-stone-200 max-w-md">{offers[offerIndex].subtitle}</p>
                  <Button size="sm" onClick={() => navigate(offers[offerIndex].link)} className="bg-[#fffdf9] text-stone-900 hover:bg-white rounded-full px-5">
                    {offers[offerIndex].cta}
                  </Button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          
          <button
            onClick={() => setOfferIndex((prev) => (prev - 1 + offers.length) % offers.length)}
            className="hidden sm:block absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => setOfferIndex((prev) => (prev + 1) % offers.length)}
            className="hidden sm:block absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 transition-all"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {offers.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setOfferIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === offerIndex ? 'bg-white w-8' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>
      </section>}

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-8 sm:py-12">
        {user && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl"
          >
            <p className="text-lg">Welcome back, <span className="font-semibold">{user.name}</span>! 👋</p>
          </motion.div>
        )}
        
        {/* Most Viewed Products */}
        {visibility.show_most_viewed && mostViewed.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }} className="mb-10 sm:mb-14">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Eye className="w-6 h-6 text-blue-600" />
                <h2 className="display-serif text-2xl sm:text-3xl font-semibold">Most Viewed</h2>
              </div>
              <Button variant="link" onClick={() => navigate('/customer/category/all')}>View All →</Button>
            </div>
            <div className="flex gap-3.5 sm:gap-5 overflow-x-auto no-scrollbar pb-4">
              {(Array.isArray(mostViewed) ? mostViewed : [])
                .slice(0, 6)
                .map((product) => (
                  <div key={product.id} className="min-w-[170px] sm:min-w-[205px] max-w-[220px] flex-shrink-0">
                  <ProductCard
                    product={product}
                    onClick={() => navigate(`/customer/product/${product.id}`)}
                  />
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Featured/Trending Products */}
        {visibility.show_trending && trending.length > 0 && (
          <section className="mb-10 sm:mb-14">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-orange-500" />
                <h2 className="display-serif text-2xl sm:text-3xl font-semibold">Trending Now</h2>
              </div>
              <Button variant="link" onClick={() => setSelectedCategory(null)}>View All →</Button>
            </div>
            <div className="flex gap-3.5 sm:gap-5 overflow-x-auto no-scrollbar pb-4">
              {(Array.isArray(trending) ? trending : []).slice(0, 6).map((product) => (
                <div key={product.id} className="min-w-[170px] sm:min-w-[205px] max-w-[220px] flex-shrink-0">
                  <ProductCard product={product} onClick={() => navigate(`/customer/product/${product.id}`)} />
                </div>
              ))}
            </div>
          </section>
        )}

        {visibility.show_bestsellers && bestsellers.length > 0 && (
          <section className="mb-10 sm:mb-14">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-[#6f3b49]" />
                <h2 className="display-serif text-2xl sm:text-3xl font-semibold">Bestsellers</h2>
              </div>
              <Button variant="link" onClick={() => navigate('/customer/category/all')}>View All →</Button>
            </div>
            <div className="flex gap-3.5 sm:gap-5 overflow-x-auto no-scrollbar pb-4">
              {bestsellers.slice(0, 6).map((product) => (
                <div key={product.id} className="min-w-[170px] sm:min-w-[205px] max-w-[220px] flex-shrink-0">
                  <ProductCard product={product} onClick={() => navigate(`/customer/product/${product.id}`)} />
                </div>
              ))}
            </div>
          </section>
        )}

        {visibility.show_offer_cards && offerCards.length > 0 && (
          <section className="mb-10 sm:mb-14">
            <h2 className="display-serif text-2xl sm:text-3xl font-semibold mb-4">Curated offers</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {offerCards.map((offer) => (
                <button key={offer.id} onClick={() => offer.link_url && navigate(offer.link_url)} className="relative min-h-36 overflow-hidden rounded-sm text-left bg-[#6f3b49] text-white p-6 group">
                  {offer.image_url && <img src={offer.image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35 group-hover:scale-105 transition-transform duration-500" />}
                  <span className="relative block display-serif text-xl font-semibold">{offer.title}</span>
                  <span className="relative block text-sm text-stone-200 mt-2">{offer.description}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {visibility.show_bank_offers && bankOffers.length > 0 && (
          <section className="mb-10 sm:mb-14 border-y border-stone-200 py-5">
            <div className="flex gap-4 overflow-x-auto no-scrollbar">
              {bankOffers.map((offer) => (
                <div key={offer.id} className="min-w-[260px] rounded-sm border border-stone-200 bg-[#fffdf9] px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#8b6f68]">{offer.bank_name}</p>
                  <p className="font-medium mt-1">{offer.offer_text}</p>
                  {offer.min_order_amount > 0 && <p className="text-xs text-stone-500 mt-2">Minimum order ₹{offer.min_order_amount}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
        
        {/* All Products */}
        {visibility.show_new_arrivals && <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="display-serif text-2xl sm:text-3xl font-semibold">
              {selectedCategory || 'All Products'}
            </h2>
            <Button variant="link" onClick={() => navigate('/customer/category/all')}>View All →</Button>
          </div>
          
          {products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6">
              {(Array.isArray(products) ? products : [] ).slice(0, 8).map((product) => (
                <div key={product.id}>
                <ProductCard
                  product={product}
                  onClick={() => navigate(`/customer/product/${product.id}`)}
                />
               </div>
              ))}
            </div>
          )}
        </section>}
      </div>

      {/* Footer */}
      {visibility.show_footer && <footer className="bg-[#211c1b] text-white mt-12">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BrandMark inverse />
              </div>
              <p className="text-gray-400 text-sm">
                {footerContent?.about_text || 'Fine fragrance, thoughtfully discovered. Find a scent that feels unmistakably yours.'}
              </p>
              {/* Social Media Icons */}
              <div className="flex gap-4 mt-4">
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-pink-400 transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-300 transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">
                  <Youtube className="w-5 h-5" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/customer/support" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link to="/customer/support" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
                <li><Link to="/customer/support" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link to="/customer/support" className="hover:text-white transition-colors">Return Policy</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact Us</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a href={`mailto:${footerContent?.contact_email || 'care@perfurm.com'}`} className="hover:text-white transition-colors flex items-center gap-2">
                    <Mail className="w-4 h-4" /> {footerContent?.contact_email || 'care@perfurm.com'}
                  </a>
                </li>
                <li>
                  <a href="tel:+919999999999" className="hover:text-white transition-colors flex items-center gap-2">
                    <Phone className="w-4 h-4" /> +91 99999 99999
                  </a>
                </li>
                <li className="text-gray-400">
                  123 Market St, City, India
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Download App</h4>
              <p className="text-sm text-gray-400 mb-4">Get the best shopping experience</p>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start border-gray-600 text-white hover:bg-gray-800">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="currentColor"><path d="M17.523 2H6.477C5.1 2 4 3.1 4 4.477v15.046C4 20.9 5.1 22 6.477 22h11.046C18.9 22 20 20.9 20 19.523V4.477C20 3.1 18.9 2 17.523 2zM12 20c-.827 0-1.5-.673-1.5-1.5S11.173 17 12 17s1.5.673 1.5 1.5S12.827 20 12 20zm5-4H7V5h10v11z"/></svg>
                  App Store
                </Button>
                <Button variant="outline" className="w-full justify-start border-gray-600 text-white hover:bg-gray-800">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="currentColor"><path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.6 3 21.09 3 20.5M16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12M20.16 10.81C20.5 11.08 20.75 11.5 20.75 12C20.75 12.5 20.53 12.9 20.18 13.18L17.89 14.5L15.39 12L17.89 9.5L20.16 10.81M6.05 2.66L16.81 8.88L14.54 11.15L6.05 2.66Z"/></svg>
                  Google Play
                </Button>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2026 Perfurm. All rights reserved.</p>
          </div>
        </div>
      </footer>}
    </div>
  );
}

function SearchResultsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const query = searchParams.get('q') || '';

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_URL}/search`, { params: { q: query } });
        setProducts(response.data);
      } catch (error) {
        console.error('Error searching:', error);
      }
      setLoading(false);
    };
    
    if (query) {
      fetchResults();
    }
  }, [query]);

  if (loading) {
    return <div className="min-h-screen perfurm-page"><BottleLoader label="Finding your next signature" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft />
            </Button>
            <div className="flex-1">
              <SearchBar />
            </div>
          </div>
        </div>
      </header>
      
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-6">
        <h1 className="text-2xl font-bold mb-4">
          Search results for "{query}" ({products.length} items)
        </h1>
        
        {products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No products found matching "{query}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => navigate(`/customer/product/${product.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerPortal() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchResultsPage />} />
      <Route path="/category/:category" element={<CategoryPage />} />
      <Route path="/product/:id" element={<ProductDetails />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/wishlist" element={<WishlistPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/orders" element={<MyOrders />} />
      <Route path="/orders/:orderId/track" element={<OrderTracking />} />
      <Route path="/orders/:orderId/return" element={<ReturnRequest />} />
      <Route path="/support" element={<SupportCenter />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/profile/enhanced" element={<EnhancedProfilePage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
