const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test.describe('responsive storefront quality gate', () => {
  test('home has no runtime, overflow, or serious accessibility failures', async ({ page }, testInfo) => {
    const runtimeErrors = [];
    page.on('pageerror', error => runtimeErrors.push(error.message));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Most Viewed' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Four moods.*One commanding presence/i })).toBeVisible();
    await expect(page.getByText('The house signatures')).toBeVisible();
    await expect(page.getByRole('region', { name: 'House signature collection' }).getByRole('button', { name: /Velvet Oud Eau de Parfum/i })).toBeVisible();
    const dismissOffer = page.getByRole('button', { name: 'Maybe later' });
    if (await dismissOffer.isVisible({ timeout: 10_000 }).catch(() => false)) await dismissOffer.click();
    await expect(page.getByRole('heading', { name: 'Offers for every guest' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy offer code WELCOME10' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login to redeem' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Top reviews' })).toBeVisible();
    await expect(page.getByText('10 customer reviews')).toBeVisible();
    if (testInfo.project.name === 'mobile-chromium') {
      const carousel = page.getByRole('region', { name: 'Featured promotions' });
      const before = await carousel.locator('img').getAttribute('src');
      await carousel.getByRole('button', { name: 'Next promotion' }).click();
      await expect(carousel.locator('img')).not.toHaveAttribute('src', before);

      const rail = page.getByLabel('Product categories');
      const dimensions = await rail.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
      expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.width);
      await rail.dispatchEvent('pointerdown', { clientX: 300, pointerType: 'touch', buttons: 1 });
      await rail.dispatchEvent('pointermove', { clientX: 80, pointerType: 'touch', buttons: 1 });
      await page.getByTestId('category-for-him').dispatchEvent('click');
      await expect(page.getByRole('menuitem', { name: 'All For Him' })).toBeHidden();
    }
    await expect(page.locator('a.skip-link')).toHaveText('Skip to main content');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const accessibility = await new AxeBuilder({ page }).analyze();
    const serious = accessibility.violations.filter(item => ['serious', 'critical'].includes(item.impact));
    expect(serious, serious.map(item => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });

  test('authentication is keyboard reachable without horizontal overflow', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /welcome to perfurm/i })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip-link')).toBeFocused();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const accessibility = await new AxeBuilder({ page }).analyze();
    const serious = accessibility.violations.filter(item => ['serious', 'critical'].includes(item.impact));
    expect(serious, serious.map(item => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
  });
});

test('offer popup is usable, dismissible, and session-aware', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'A little luxury, on us.' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /copy/i }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Maybe later' }).click();
  await expect(page.getByRole('heading', { name: 'A little luxury, on us.' })).toBeHidden();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await expect(page.getByRole('heading', { name: 'A little luxury, on us.' })).toHaveCount(0);
});

test('admin can sign in and reach permission-aware operations', async ({ page }) => {
  await page.goto('/auth');
  await page.getByPlaceholder('Enter your email').fill('admin@perfurm.com');
  await page.getByPlaceholder('Enter your password').fill('admin123');
  await page.getByRole('button', { name: /^login$/i }).click();
  await expect(page).toHaveURL(/\/admin/);
  await page.getByTestId('menu-btn').click();
  await expect(page.getByRole('button', { name: /admin staff/i })).toBeVisible();
  const adminMode = page.getByRole('switch');
  if (!(await adminMode.isChecked())) await adminMode.click();
  await expect(page.getByRole('button', { name: /add & edit products/i })).toBeVisible();
  await page.getByRole('button', { name: /returns & cancellations/i }).click();
  await expect(page).toHaveURL(/\/admin\/returns/);
  await expect(page.getByRole('heading', { name: /returns and cancellations/i })).toBeVisible();
  await page.goto('/admin/privacy');
  await expect(page.getByRole('heading', { name: /account deletion/i })).toBeVisible();
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: /user management/i })).toBeVisible();
  await expect(page.getByPlaceholder('Min orders')).toBeVisible();
  await expect(page.getByRole('button', { name: /credit/i }).first()).toBeVisible();
  await page.goto('/admin/coupons');
  await expect(page.getByRole('heading', { name: /coupon management/i })).toBeVisible();
});

test('mobile empty cart and wishlist recommend perfumes without a size guide', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile empty-state regression');
  await page.goto('/customer/cart', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.removeItem('cart'); localStorage.removeItem('wishlist'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Your cart is empty')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trending perfumes to start your cart' })).toBeVisible();
  await page.goto('/customer/wishlist', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Your wishlist is empty')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Popular perfumes for your wishlist' })).toBeVisible();
  await page.getByLabel('Recommended perfumes').getByRole('button').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Size Guide' })).toHaveCount(0);
});

test('product media gallery and ordering choices remain responsive', async ({ page }) => {
  await page.route('**/api/products/velvet-oud-eau-de-parfum', async route => {
    const response = await route.fetch();
    const product = await response.json();
    product.videos = ['https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'];
    await route.fulfill({ response, json: product });
  });
  await page.goto('/customer/product/velvet-oud-eau-de-parfum', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Velvet Oud Eau de Parfum' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Show video/ })).toBeVisible();
  await page.getByRole('button', { name: /^Show video/ }).click();
  await expect(page.getByLabel('Velvet Oud Eau de Parfum product video')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous product media' })).toBeVisible();
  const prices = [];
  for (const size of ['10 ml', '50 ml', '100 ml']) {
    await page.getByRole('button', { name: new RegExp(`^${size}`) }).click();
    prices.push(await page.locator('[data-testid="product-price"]').textContent().catch(() => ''));
  }
  expect(new Set(prices).size).toBeGreaterThan(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
