import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Package, RefreshCw, Search, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
const FLAGS = [
  ['is_active', 'Storefront active'], ['is_featured', 'Featured'], ['is_bestseller', 'Bestseller'],
  ['is_new_arrival', 'New arrival'], ['is_limited_edition', 'Limited edition'], ['is_coming_soon', 'Coming soon'],
];
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function ProductMerchandising() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await axios.get(`${API_URL}/admin/products`, { params: {
        q: query || undefined, active: visibility === 'all' ? undefined : visibility === 'active',
        page, page_size: 24,
      } });
      setProducts(response.data.items || []); setTotal(response.data.total || 0); setPages(response.data.pages || 1);
    } catch (requestError) { setError(requestError.response?.data?.detail || 'Unable to load platform catalogue'); }
    finally { setLoading(false); }
  }, [page, query, visibility]);

  useEffect(() => { const timer = setTimeout(fetchProducts, 250); return () => clearTimeout(timer); }, [fetchProducts]);

  async function setFlag(product, key, value) {
    const operation = `${product.id}-${key}`; setUpdating(operation);
    setProducts(current => current.map(item => item.id === product.id ? { ...item, [key]: value } : item));
    try {
      await axios.patch(`${API_URL}/admin/products/${product.id}/merchandising`, { [key]: value });
      toast.success('Merchandising status updated');
    } catch (requestError) {
      setProducts(current => current.map(item => item.id === product.id ? { ...item, [key]: !value } : item));
      toast.error(requestError.response?.data?.detail || 'Status could not be updated');
    } finally { setUpdating(''); }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-[#7d4956]">Storefront curation</p><h1 className="display-serif mt-1 text-3xl font-semibold">Product catalogue</h1><p className="mt-1 text-sm text-stone-500">{total} products across all approved sellers</p></div><Button variant="outline" onClick={fetchProducts}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
        <Card className="mb-5"><CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:p-4"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><Input className="pl-9" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search product, brand or SKU" /></div><Select value={visibility} onValueChange={value => { setVisibility(value); setPage(1); }}><SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All products</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></CardContent></Card>
        {error ? <Card><CardContent className="p-10 text-center"><p className="text-red-700" role="alert">{error}</p><Button className="mt-4" variant="outline" onClick={fetchProducts}>Try again</Button></CardContent></Card> : loading ? <div className="grid gap-4 md:grid-cols-2">{[1,2,3,4].map(item => <div key={item} className="h-72 animate-pulse rounded-xl bg-stone-200" />)}</div> : products.length === 0 ? <Card><CardContent className="p-14 text-center"><Package className="mx-auto mb-3 h-12 w-12 text-stone-400" /><p>No matching products</p></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2">{products.map(product => <Card key={product.id} className="overflow-hidden"><CardContent className="p-4 sm:p-5"><div className="flex gap-4"><div className="h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100"><img src={product.images?.[0]} alt="" className="h-full w-full object-contain p-2" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><Badge variant={product.is_active ? 'default' : 'secondary'}>{product.is_active ? 'Active' : 'Inactive'}</Badge>{product.is_featured && <Badge variant="outline"><Sparkles className="mr-1 h-3 w-3" />Featured</Badge>}</div><h2 className="mt-2 truncate font-semibold">{product.name}</h2><p className="truncate text-sm text-stone-500">{product.brand} · {product.sku}</p><p className="mt-1 text-sm font-medium">{money(product.price)}</p></div></div><div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2">{FLAGS.map(([key, label]) => <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2"><Label htmlFor={`${product.id}-${key}`} className="text-sm">{label}</Label><Switch id={`${product.id}-${key}`} checked={Boolean(product[key])} disabled={updating === `${product.id}-${key}`} onCheckedChange={value => setFlag(product, key, value)} /></div>)}</div></CardContent></Card>)}</div>}
        {pages > 1 && <div className="mt-6 flex items-center justify-center gap-3"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(value => value - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">Page {page} of {pages}</span><Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage(value => value + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button></div>}
      </div>
    </main>
  );
}
