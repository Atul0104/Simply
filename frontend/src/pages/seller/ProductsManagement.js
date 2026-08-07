import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ChevronLeft, ChevronRight, Edit, Image as ImageIcon, Package, Play, Plus, Search, Trash2, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
const FALLBACK_CATEGORIES = ['For Him', 'For Her', 'Unisex', 'Home Scents', 'Discovery Sets', 'Gifting'];
const FAMILIES = ['Floral', 'Woody', 'Fresh', 'Citrus', 'Oriental', 'Gourmand', 'Aquatic', 'Aromatic', 'Fruity', 'Leather'];
const CONCENTRATIONS = ['Parfum', 'EDP', 'EDT', 'EDC', 'Body Mist', 'Home Fragrance'];
const LONGEVITY = ['Light (2–4 hours)', 'Moderate (4–6 hours)', 'Long-lasting (6–8 hours)', 'Very long-lasting (8+ hours)'];
const SILLAGE = ['Intimate', 'Moderate', 'Strong', 'Room-filling'];

const emptyForm = () => ({
  name: '', brand: 'RAW', slug: '', short_description: '', description: '', category: '',
  target_category: 'Unisex', fragrance_family: '', concentration: '', price: '', mrp: '', cost_price: '', sku: '',
  top_notes: '', middle_notes: '', base_notes: '', longevity: '', sillage: '', seasons: '', occasions: '',
  ingredients: '', usage_instructions: '', safety_information: '', country_of_origin: '', manufacturer_details: '',
  shelf_life_months: '', gst_category: '', seo_title: '', seo_description: '', seo_keywords: '', canonical_url: '',
  images: [], videos: [], variants: [], sizes: [], specifications: {}, filters: {}, colors: [], color_images: {}, is_coming_soon: false,
  is_featured: false, is_bestseller: false, is_new_arrival: false, is_limited_edition: false,
});

const listText = value => Array.isArray(value) ? value.join(', ') : '';
const parseList = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));

function toForm(product) {
  const form = emptyForm();
  Object.keys(form).forEach(key => { if (product[key] !== undefined && product[key] !== null) form[key] = product[key]; });
  ['top_notes', 'middle_notes', 'base_notes', 'seasons', 'occasions', 'seo_keywords'].forEach(key => { form[key] = listText(product[key]); });
  form.cost_price = product.cost_price ?? '';
  form.shelf_life_months = product.shelf_life_months ?? '';
  return form;
}

function payloadFrom(form) {
  const payload = { ...form };
  ['top_notes', 'middle_notes', 'base_notes', 'seasons', 'occasions', 'seo_keywords'].forEach(key => { payload[key] = parseList(form[key]); });
  ['price', 'mrp'].forEach(key => { payload[key] = Number(form[key]); });
  payload.cost_price = form.cost_price === '' ? null : Number(form.cost_price);
  payload.shelf_life_months = form.shelf_life_months === '' ? null : Number(form.shelf_life_months);
  payload.slug = form.slug || null;
  payload.sizes = form.variants.map(variant => variant.label || (variant.size_ml ? `${variant.size_ml} ml` : '')).filter(Boolean);
  payload.variants = form.variants.map(variant => ({
    ...variant, size_ml: variant.size_ml === '' ? null : Number(variant.size_ml),
    price: Number(variant.price), mrp: Number(variant.mrp),
    cost_price: variant.cost_price === '' || variant.cost_price == null ? null : Number(variant.cost_price),
    stock_quantity: Number(variant.stock_quantity || 0), low_stock_limit: Number(variant.low_stock_limit ?? 5),
  }));
  return payload;
}

export default function ProductsManagement({ adminMode = false }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [specification, setSpecification] = useState({ key: '', value: '' });
  const [saving, setSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const endpoint = adminMode ? '/admin/catalogue/products' : '/seller/products';
      const response = await axios.get(`${API_URL}${endpoint}`, { params: { q: query || undefined, page, page_size: 24 } });
      setProducts(response.data.items || []); setTotal(response.data.total || 0); setPages(response.data.pages || 1);
    } catch (requestError) { setError(requestError.response?.data?.detail || 'Unable to load your catalogue'); }
    finally { setLoading(false); }
  }, [adminMode, page, query]);

  useEffect(() => { const timer = setTimeout(fetchProducts, 250); return () => clearTimeout(timer); }, [fetchProducts]);
  useEffect(() => { axios.get(`${API_URL}/categories/list`).then(response => { if (response.data?.length) setCategories(response.data); }).catch(() => {}); }, []);

  function resetForm() { setForm(emptyForm()); setEditingProduct(null); setImageUrl(''); setVideoUrl(''); setSpecification({ key: '', value: '' }); }
  function openEdit(product) { setEditingProduct(product); setForm(toForm(product)); setShowDialog(true); }
  function addVariant() {
    setForm(current => ({ ...current, variants: [...current.variants, {
      id: globalThis.crypto?.randomUUID?.(), sku: `${current.sku || 'SKU'}-${current.variants.length + 1}`,
      size_ml: '', label: '', price: current.price, mrp: current.mrp, cost_price: current.cost_price,
      stock_quantity: 0, low_stock_limit: 5, image: null, is_active: true,
    }] }));
  }
  function addStandardBottleRange() {
    const base = (form.sku || form.name || 'PFM').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'PFM';
    const basePrice = Number(form.price || 0);
    const baseMrp = Number(form.mrp || basePrice || 0);
    const sizes = [10, 30, 50, 100];
    setForm(current => ({ ...current, sku: current.sku || base, slug: current.slug || current.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), variants: sizes.map((size, index) => ({
      id: globalThis.crypto?.randomUUID?.(), sku: `${base}-${size}`, size_ml: size, label: `${size} ml`,
      price: basePrice ? Math.max(1, Math.round(basePrice * [0.28, 0.62, 1, 1.72][index])) : '',
      mrp: baseMrp ? Math.max(1, Math.round(baseMrp * [0.28, 0.62, 1, 1.72][index])) : '',
      cost_price: '', stock_quantity: 0, low_stock_limit: 5, image: null, is_active: true,
    })) }));
  }
  function updateVariant(index, changes) { setForm(current => ({ ...current, variants: current.variants.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item) })); }
  function removeVariant(index) { setForm(current => ({ ...current, variants: current.variants.filter((_, itemIndex) => itemIndex !== index) })); }

  async function submitProduct(event) {
    event.preventDefault();
    if (!form.images.length) { toast.error('Add at least one product image'); return; }
    if (!form.variants.length) { toast.error('Add at least one bottle size'); return; }
    if (form.variants.some(item => !item.sku || Number(item.price) <= 0 || Number(item.mrp) < Number(item.price))) { toast.error('Every bottle size needs a unique SKU and a valid price not above MRP'); return; }
    setSaving(true);
    try {
      const payload = payloadFrom(form);
      const base = adminMode ? `${API_URL}/admin/catalogue/products` : `${API_URL}/products`;
      if (editingProduct) await axios.put(`${base}/${editingProduct.id}`, payload);
      else await axios.post(base, payload);
      toast.success(editingProduct ? 'Fragrance updated' : 'Fragrance created');
      setShowDialog(false); resetForm(); fetchProducts();
    } catch (requestError) { toast.error(requestError.response?.data?.detail || 'Fragrance could not be saved'); }
    finally { setSaving(false); }
  }

  async function deleteProduct(id) {
    if (!window.confirm('Deactivate this fragrance? Existing order history will be preserved.')) return;
    try { await axios.delete(`${adminMode ? `${API_URL}/admin/catalogue/products` : `${API_URL}/products`}/${id}`); toast.success('Fragrance deactivated'); fetchProducts(); }
    catch (requestError) { toast.error(requestError.response?.data?.detail || 'Fragrance could not be deactivated'); }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Button variant="ghost" onClick={() => navigate(adminMode ? '/admin' : '/seller')} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Button>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs uppercase tracking-[0.2em] text-[#7d4956]">Catalogue studio</p><h1 className="display-serif mt-1 text-3xl font-semibold">Fragrances</h1><p className="mt-1 text-sm text-stone-500">{total} products · perfume taxonomy, bottle-size pricing and initial stock</p></div>
          <Dialog open={showDialog} onOpenChange={open => { setShowDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add fragrance</Button></DialogTrigger>
            <DialogContent className="max-h-[94vh] w-[96vw] max-w-5xl overflow-y-auto p-4 sm:p-6">
              <DialogHeader><DialogTitle>{editingProduct ? 'Edit fragrance' : 'Create fragrance'}</DialogTitle></DialogHeader>
              <form onSubmit={submitProduct}>
                <Tabs defaultValue="identity" className="mt-3">
                  <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-5"><TabsTrigger value="identity">Identity</TabsTrigger><TabsTrigger value="scent">Scent</TabsTrigger><TabsTrigger value="variants">Variants</TabsTrigger><TabsTrigger value="content">Content</TabsTrigger><TabsTrigger value="seo">SEO</TabsTrigger></TabsList>
                  <TabsContent value="identity" className="space-y-4 pt-4">
                    <div className="flex flex-col gap-3 rounded-xl border border-[#6f3b49]/15 bg-[#fffaf6] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-[#6f3b49]">Smart product setup</p><p className="text-xs text-stone-500">Generate slug, SKU and editable 10/30/50/100 ml variants from the base 50 ml price.</p></div><Button type="button" variant="outline" onClick={addStandardBottleRange}>Build standard sizes</Button></div>
                    <div className="grid gap-4 sm:grid-cols-2"><Field label="Product name" required value={form.name} onChange={name => setForm({ ...form, name })} placeholder="Nocturne Vetiver" /><Field label="Brand" required value={form.brand} onChange={brand => setForm({ ...form, brand })} /></div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SelectField label="Category" value={form.category} values={categories} onChange={category => setForm({ ...form, category })} /><SelectField label="Audience" value={form.target_category} values={['Men','Women','Unisex']} onChange={target_category => setForm({ ...form, target_category })} /><SelectField label="Family" value={form.fragrance_family} values={FAMILIES} onChange={fragrance_family => setForm({ ...form, fragrance_family })} /><SelectField label="Concentration" value={form.concentration} values={CONCENTRATIONS} onChange={concentration => setForm({ ...form, concentration })} /></div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><NumberField label="Selling price (₹)" required value={form.price} onChange={price => setForm({ ...form, price })} /><NumberField label="MRP (₹)" required value={form.mrp} onChange={mrp => setForm({ ...form, mrp })} /><NumberField label="Cost price (₹)" value={form.cost_price} onChange={cost_price => setForm({ ...form, cost_price })} /><Field label="Base SKU" required value={form.sku} onChange={sku => setForm({ ...form, sku })} /></div>
                    <Field label="Short description" value={form.short_description} onChange={short_description => setForm({ ...form, short_description })} maxLength={180} /><TextField label="Full description" required value={form.description} onChange={description => setForm({ ...form, description })} />
                    <div className="flex items-center justify-between rounded-xl border p-4"><div><Label htmlFor="coming-soon">Coming soon catalogue</Label><p className="text-xs text-stone-500">Show this product publicly with a Coming Soon badge but block checkout.</p></div><Switch id="coming-soon" checked={Boolean(form.is_coming_soon)} onCheckedChange={is_coming_soon => setForm({ ...form, is_coming_soon })} /></div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['is_featured','Featured'],['is_bestseller','Bestseller'],['is_new_arrival','New arrival'],['is_limited_edition','Limited edition']].map(([key,label]) => <div key={key} className="flex items-center justify-between rounded-xl border p-3"><Label htmlFor={key}>{label}</Label><Switch id={key} checked={Boolean(form[key])} onCheckedChange={value => setForm({...form,[key]:value})}/></div>)}</div>
                  </TabsContent>
                  <TabsContent value="scent" className="space-y-4 pt-4">
                    <p className="text-sm text-stone-500">Separate multiple values with commas.</p>
                    <div className="grid gap-4 sm:grid-cols-3"><Field label="Top notes" value={form.top_notes} onChange={top_notes => setForm({ ...form, top_notes })} placeholder="Bergamot, Pink pepper" /><Field label="Heart notes" value={form.middle_notes} onChange={middle_notes => setForm({ ...form, middle_notes })} placeholder="Iris, Rose" /><Field label="Base notes" value={form.base_notes} onChange={base_notes => setForm({ ...form, base_notes })} placeholder="Vetiver, Amber" /></div>
                    <div className="grid gap-4 sm:grid-cols-2"><SelectField label="Longevity" value={form.longevity} values={LONGEVITY} onChange={longevity => setForm({ ...form, longevity })} optional /><SelectField label="Sillage" value={form.sillage} values={SILLAGE} onChange={sillage => setForm({ ...form, sillage })} optional /><Field label="Seasons" value={form.seasons} onChange={seasons => setForm({ ...form, seasons })} placeholder="Autumn, Winter" /><Field label="Occasions" value={form.occasions} onChange={occasions => setForm({ ...form, occasions })} placeholder="Evening, Formal" /></div>
                  </TabsContent>
                  <TabsContent value="variants" className="space-y-4 pt-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">Bottle sizes</h3><p className="text-xs text-stone-500">Stock entered here applies only when adding a new size. Later adjustments belong in Inventory.</p></div><div className="flex gap-2"><Button type="button" variant="outline" onClick={addStandardBottleRange}>Standard 4 sizes</Button><Button type="button" variant="outline" onClick={addVariant}><Plus className="mr-2 h-4 w-4" />Add size</Button></div></div>
                    {form.variants.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-stone-500">Add at least one bottle size for variant-aware inventory.</div> : form.variants.map((variant, index) => <div key={variant.id || index} className="rounded-xl border bg-white p-3 sm:p-4"><div className="mb-3 flex items-center justify-between"><p className="font-medium">Size {index + 1}</p><Button type="button" size="icon" variant="ghost" onClick={() => removeVariant(index)} aria-label={`Remove size ${index + 1}`}><Trash2 className="h-4 w-4 text-red-600" /></Button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><NumberField label="Size (ml)" value={variant.size_ml} onChange={size_ml => updateVariant(index, { size_ml, label: size_ml ? `${size_ml} ml` : '' })} /><Field label="Label" value={variant.label || ''} onChange={label => updateVariant(index, { label })} /><Field label="Variant SKU" required value={variant.sku} onChange={sku => updateVariant(index, { sku })} /><NumberField label="Initial stock" value={variant.stock_quantity} onChange={stock_quantity => updateVariant(index, { stock_quantity })} disabled={Boolean(editingProduct && variant.id)} /><NumberField label="Price (₹)" required value={variant.price} onChange={price => updateVariant(index, { price })} /><NumberField label="MRP (₹)" required value={variant.mrp} onChange={mrp => updateVariant(index, { mrp })} /><NumberField label="Cost (₹)" value={variant.cost_price ?? ''} onChange={cost_price => updateVariant(index, { cost_price })} /><NumberField label="Low-stock alert" value={variant.low_stock_limit ?? 5} onChange={low_stock_limit => updateVariant(index, { low_stock_limit })} /></div></div>)}
                  </TabsContent>
                  <TabsContent value="content" className="space-y-4 pt-4">
                    <div><Label>Product images</Label><div className="mt-1 flex flex-col gap-2 sm:flex-row"><Input type="url" value={imageUrl} onChange={event => setImageUrl(event.target.value)} placeholder="https://…" /><Button type="button" variant="outline" onClick={() => { if (imageUrl.trim()) { setForm({ ...form, images: [...form.images, imageUrl.trim()] }); setImageUrl(''); } }}><ImageIcon className="mr-2 h-4 w-4" />Add URL</Button></div></div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{form.images.map((image, index) => <div key={`${image}-${index}`} className="group relative aspect-square overflow-hidden rounded-xl border bg-stone-100"><img src={image} alt={`Fragrance ${index + 1}`} className="h-full w-full object-contain p-2" /><Button type="button" size="icon" variant="destructive" className="absolute right-1 top-1 h-7 w-7" onClick={() => setForm({ ...form, images: form.images.filter((_, itemIndex) => itemIndex !== index) })}><X className="h-3 w-3" /></Button></div>)}</div>
                    <div className="rounded-xl border bg-stone-50 p-3 sm:p-4"><div className="flex items-center gap-2"><Video className="h-4 w-4 text-[#7d4956]"/><Label>Product videos</Label></div><p className="mt-1 text-xs text-stone-500">Optional hosted MP4/WebM clips for bottle details or spray demonstrations. Videos do not autoplay on the product page.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input type="url" value={videoUrl} onChange={event => setVideoUrl(event.target.value)} placeholder="https://example.com/product-film.mp4" /><Button type="button" variant="outline" onClick={() => { if (videoUrl.trim()) { setForm({ ...form, videos: [...form.videos, videoUrl.trim()] }); setVideoUrl(''); } }}><Play className="mr-2 h-4 w-4" />Add video</Button></div></div>
                    {form.videos.length > 0 && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{form.videos.map((video, index) => <div key={`${video}-${index}`} className="relative overflow-hidden rounded-xl border bg-stone-950"><video src={video} controls muted playsInline preload="metadata" className="aspect-video w-full object-contain" aria-label={`Product video ${index + 1}`} /><Button type="button" size="icon" variant="destructive" className="absolute right-2 top-2 h-8 w-8" onClick={() => setForm({ ...form, videos: form.videos.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Remove video ${index + 1}`}><X className="h-4 w-4" /></Button></div>)}</div>}
                    <div className="rounded-xl border p-4"><Label>Product specifications</Label><p className="mt-1 text-xs text-stone-500">Customer-visible facts such as volume, material, concentration or packaging.</p><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input value={specification.key} onChange={event => setSpecification({...specification,key:event.target.value})} placeholder="Specification name"/><Input value={specification.value} onChange={event => setSpecification({...specification,value:event.target.value})} placeholder="Value"/><Button type="button" variant="outline" onClick={() => { if(specification.key.trim()&&specification.value.trim()){setForm({...form,specifications:{...form.specifications,[specification.key.trim()]:specification.value.trim()}});setSpecification({key:'',value:''});}}}>Add</Button></div>{Object.entries(form.specifications || {}).length > 0 && <div className="mt-3 space-y-2">{Object.entries(form.specifications).map(([key,value]) => <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2 text-sm"><span><strong>{key}:</strong> {String(value)}</span><Button type="button" size="icon" variant="ghost" onClick={() => { const next={...form.specifications}; delete next[key]; setForm({...form,specifications:next}); }}><X className="h-4 w-4"/></Button></div>)}</div>}</div>
                    <div className="grid gap-4 sm:grid-cols-2"><TextField label="Ingredients" value={form.ingredients} onChange={ingredients => setForm({ ...form, ingredients })} /><TextField label="Usage instructions" value={form.usage_instructions} onChange={usage_instructions => setForm({ ...form, usage_instructions })} /><TextField label="Safety information" value={form.safety_information} onChange={safety_information => setForm({ ...form, safety_information })} /><TextField label="Manufacturer details" value={form.manufacturer_details} onChange={manufacturer_details => setForm({ ...form, manufacturer_details })} /></div>
                    <div className="grid gap-4 sm:grid-cols-3"><Field label="Country of origin" value={form.country_of_origin} onChange={country_of_origin => setForm({ ...form, country_of_origin })} /><NumberField label="Shelf life (months)" value={form.shelf_life_months} onChange={shelf_life_months => setForm({ ...form, shelf_life_months })} /><Field label="GST category / HSN" value={form.gst_category} onChange={gst_category => setForm({ ...form, gst_category })} /></div>
                  </TabsContent>
                  <TabsContent value="seo" className="space-y-4 pt-4"><Field label="URL slug" value={form.slug || ''} onChange={slug => setForm({ ...form, slug })} placeholder="Generated from product name when blank" /><Field label="SEO title" value={form.seo_title} onChange={seo_title => setForm({ ...form, seo_title })} maxLength={70} /><TextField label="SEO description" value={form.seo_description} onChange={seo_description => setForm({ ...form, seo_description })} /><Field label="SEO keywords" value={form.seo_keywords} onChange={seo_keywords => setForm({ ...form, seo_keywords })} placeholder="vetiver perfume, woody fragrance" /><Field label="Canonical URL" type="url" value={form.canonical_url} onChange={canonical_url => setForm({ ...form, canonical_url })} /></TabsContent>
                </Tabs>
                <DialogFooter className="mt-6"><Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingProduct ? 'Update fragrance' : 'Create fragrance'}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <Card className="mb-5"><CardContent className="p-3 sm:p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><Input className="pl-9" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, brand or SKU" /></div></CardContent></Card>
        {error ? <Card><CardContent className="p-10 text-center"><p className="text-red-700" role="alert">{error}</p><Button className="mt-4" variant="outline" onClick={fetchProducts}>Try again</Button></CardContent></Card> : loading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map(item => <div key={item} className="h-64 animate-pulse rounded-xl bg-stone-200" />)}</div> : products.length === 0 ? <Card><CardContent className="flex flex-col items-center py-14"><Package className="mb-3 h-12 w-12 text-stone-400" /><p>No matching fragrances</p><Button className="mt-4" onClick={() => setShowDialog(true)}>Add your first fragrance</Button></CardContent></Card> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{products.map(product => <Card key={product.id} className="overflow-hidden"><div className="aspect-[4/3] bg-stone-100"><img src={product.images?.[0] || '/placeholder-perfume.svg'} alt={product.name} className="h-full w-full object-contain p-5" /></div><CardContent className="p-4"><div className="flex flex-wrap gap-2"><Badge variant={product.is_active ? 'default' : 'secondary'}>{product.is_active ? 'Active' : 'Inactive'}</Badge>{product.is_featured && <Badge variant="outline">Featured</Badge>}</div><h2 className="mt-3 truncate text-lg font-semibold">{product.name}</h2><p className="text-sm text-stone-500">{product.brand} · {product.fragrance_family || product.category}</p><div className="mt-3 flex items-baseline gap-2"><span className="font-semibold">{money(product.price)}</span><span className="text-sm text-stone-400 line-through">{money(product.mrp)}</span></div><p className="mt-2 text-xs text-stone-500">{product.variants?.length || 0} sizes · SKU {product.sku}</p><div className="mt-4 flex gap-2"><Button variant="outline" className="flex-1" onClick={() => openEdit(product)}><Edit className="mr-2 h-4 w-4" />Edit</Button><Button variant="outline" size="icon" onClick={() => deleteProduct(product.id)} aria-label={`Deactivate ${product.name}`}><Trash2 className="h-4 w-4 text-red-600" /></Button></div></CardContent></Card>)}</div>}
        {pages > 1 && <div className="mt-6 flex items-center justify-center gap-3"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">Page {page} of {pages}</span><Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage(value => value + 1)}><ChevronRight className="h-4 w-4" /></Button></div>}
      </div>
    </main>
  );
}

function Field({ label, onChange, required, ...props }) { return <div><Label>{label}{required ? ' *' : ''}</Label><Input className="mt-1" required={required} onChange={event => onChange(event.target.value)} {...props} /></div>; }
function NumberField({ label, onChange, required, ...props }) { return <Field label={label} type="number" min="0" step="0.01" required={required} onChange={onChange} {...props} />; }
function TextField({ label, onChange, required, ...props }) { return <div><Label>{label}{required ? ' *' : ''}</Label><Textarea className="mt-1" rows={3} required={required} onChange={event => onChange(event.target.value)} {...props} /></div>; }
function SelectField({ label, value, values, onChange, optional }) { return <div><Label>{label}</Label><Select value={value || undefined} onValueChange={onChange}><SelectTrigger className="mt-1"><SelectValue placeholder={optional ? 'Not specified' : `Select ${label.toLowerCase()}`} /></SelectTrigger><SelectContent>{values.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>; }
