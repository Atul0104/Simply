import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useConsent } from '@/contexts/ConsentContext';

const categories = [
  ['necessary', 'Necessary', 'Authentication, security, checkout and your shopping cart.', true],
  ['functional', 'Functional', 'Remembers convenience choices such as dismissed offers and wishlists.'],
  ['analytics', 'Analytics', 'Measures anonymous campaign and storefront performance.'],
  ['marketing', 'Marketing', 'Enables campaign media and relevant offer measurement.'],
  ['personalization', 'Personalization', 'Uses browsing choices for tailored fragrance recommendations.'],
];

export default function CookieConsent() {
  const consent = useConsent();
  const [draft, setDraft] = useState({ necessary: true, functional: false, analytics: false, marketing: false, personalization: false });
  useEffect(() => { if (consent.preferences) setDraft(consent.preferences); }, [consent.preferences]);
  if (!consent.config) return null;
  return <>
    {!consent.preferences && <section role="region" aria-label="Cookie consent" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-5xl rounded-2xl border border-stone-200 bg-white p-4 shadow-2xl sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><h2 className="font-semibold text-stone-900">{consent.config.banner_title}</h2><p className="mt-1 text-sm leading-6 text-stone-600">{consent.config.banner_description} <Link className="underline" to="/cookie-policy">Cookie Policy</Link> · <Link className="underline" to="/privacy-policy">Privacy Policy</Link></p>{navigator.globalPrivacyControl === true && <p className="mt-1 text-xs font-medium text-emerald-700">Global Privacy Control detected. Tracking choices remain off.</p>}</div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><Button variant="outline" onClick={consent.rejectAll}>Reject optional</Button><Button variant="outline" onClick={consent.openPreferences}>Manage choices</Button><Button className="bg-[#6f3b49] hover:bg-[#5d2d3a]" onClick={consent.acceptAll}>Accept all</Button></div></div>
    </section>}
    <Dialog open={consent.preferencesOpen} onOpenChange={open => open ? consent.openPreferences() : consent.closePreferences()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Privacy preferences</DialogTitle><DialogDescription>Choose optional technologies. Necessary technology cannot be disabled. You can change these choices any time.</DialogDescription></DialogHeader><div className="space-y-3">{categories.map(([key, title, description, locked]) => <div key={key} className="flex items-start justify-between gap-5 rounded-xl border p-4"><div><Label htmlFor={`consent-${key}`}>{title}</Label><p className="mt-1 text-sm text-stone-500">{description}</p>{locked && <p className="mt-1 text-xs text-stone-500">Always active</p>}</div><Switch id={`consent-${key}`} checked={draft[key]} disabled={locked} onCheckedChange={value => setDraft(current => ({ ...current, [key]: value }))}/></div>)}</div><p className="text-xs text-stone-500">Preferences expire after {consent.config.consent_expiry_days} days or when the policy changes. Optional vendors are disabled until consent.</p><div className="grid gap-2 sm:grid-cols-3"><Button variant="outline" onClick={consent.rejectAll}>Reject optional</Button><Button variant="ghost" onClick={() => setDraft({ necessary: true, functional: false, analytics: false, marketing: false, personalization: false })}>Restore defaults</Button><Button onClick={() => consent.save(draft, 'preference_center')}>Save choices</Button></div></DialogContent></Dialog>
  </>;
}
