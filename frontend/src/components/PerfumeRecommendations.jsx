import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Star } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function PerfumeRecommendations({ title = 'Trending fragrances for you' }) {
  const [products, setProducts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API_URL}/products/trending`, { params: { limit: 8 } })
      .then(response => setProducts(Array.isArray(response.data) ? response.data : []))
      .catch(() => axios.get(`${API_URL}/products`).then(response => setProducts((response.data || []).slice(0, 8))).catch(() => {}));
  }, []);

  if (!products.length) return null;
  return (
    <section className="mt-8" aria-labelledby="empty-state-recommendations">
      <div className="mb-4 flex items-center gap-2">
        <Star className="h-5 w-5 fill-[#7d4956] text-[#7d4956]" />
        <h2 id="empty-state-recommendations" className="display-serif text-2xl font-semibold">{title}</h2>
      </div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 no-scrollbar sm:grid sm:grid-cols-3 lg:grid-cols-4" tabIndex={0} aria-label="Recommended perfumes">
        {products.slice(0, 8).map(product => (
          <button key={product.id} type="button" onClick={() => navigate(`/customer/product/${product.slug || product.id}`)} className="min-w-[155px] snap-start overflow-hidden rounded-xl border border-stone-200 bg-white text-left transition-shadow hover:shadow-md sm:min-w-0">
            <div className="h-36 bg-[#f2eee8] p-3"><img src={product.images?.[0]} alt={product.name} className="h-full w-full object-contain mix-blend-multiply" /></div>
            <div className="p-3">
              <p className="line-clamp-2 min-h-10 text-sm font-semibold">{product.name}</p>
              <p className="mt-1 font-bold text-[#6f3b49]">₹{Number(product.price).toLocaleString('en-IN')}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
