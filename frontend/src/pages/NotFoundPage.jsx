import { useNavigate } from 'react-router-dom';
import { Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/Seo';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-[#faf8f4] grid place-items-center px-4 text-center">
      <Seo title="Page not found" description="The requested page could not be found." canonicalPath="/404" noindex />
      <div className="max-w-lg">
        <p className="text-xs uppercase tracking-[0.3em] text-[#7d4956]">Error 404</p>
        <h1 className="display-serif text-5xl sm:text-6xl mt-4">This trail has faded.</h1>
        <p className="text-stone-600 mt-5">The page may have moved, but your next signature scent is still waiting.</p>
        <div className="flex flex-col sm:flex-row justify-center gap-3 mt-7">
          <Button onClick={() => navigate('/')}><Home className="w-4 h-4 mr-2" /> Return home</Button>
          <Button variant="outline" onClick={() => navigate('/customer/category/all')}><Search className="w-4 h-4 mr-2" /> Browse fragrances</Button>
        </div>
      </div>
    </main>
  );
}
