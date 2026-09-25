import { test, expect } from '@playwright/test';

test.describe('Podotomy 3D E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Pre-seed known test markers into localStorage
        await page.addInitScript(() => {
            const sampleMarkers = [
                {
                    id: 'marker-calcaneus-1',
                    number: 1,
                    title: 'Calcaneus (Fersenbein)',
                    description: 'Größter Tarsalknochen, bildet den hinteren Hebelarm des Fußes.',
                    position: { x: 0, y: -10, z: -35 },
                    normal: { x: 0, y: 0.4, z: -0.9 },
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'marker-talus-2',
                    number: 2,
                    title: 'Talus (Sprungbein)',
                    description: 'Gelenkiger Übergang zwischen Unterschenkel und Fuß.',
                    position: { x: 0, y: 20, z: -10 },
                    normal: { x: 0, y: 0.9, z: 0.3 },
                    createdAt: new Date().toISOString()
                }
            ];
            window.localStorage.setItem('podotomy_foot_annotations_v2', JSON.stringify(sampleMarkers));
        });

        await page.goto('/');
        // Wait for page to initialize and loading overlay to finish (Full_Foot.glb 38.7 MB)
        await page.waitForSelector('#loading-overlay.fade-out', { timeout: 45000 });
    });

    test('loads the application, title, and 3D canvas', async ({ page }) => {
        await expect(page).toHaveTitle(/Podotomy 3D/i);
        const header = page.locator('.brand-info h1');
        await expect(header).toHaveText('Podotomy 3D');

        const canvas = page.locator('#canvas-container canvas');
        await expect(canvas).toBeVisible();

        // Check sidebar is present
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).toBeVisible();
    });

    test('renders seeded anatomical markers in the sidebar', async ({ page }) => {
        const markerCards = page.locator('#markers-list .marker-card');
        await expect(markerCards).toHaveCount(2);

        // First marker should have badge "1" and title "Calcaneus (Fersenbein)"
        const firstBadge = markerCards.first().locator('.marker-badge-icon');
        await expect(firstBadge).toHaveText('1');

        const firstTitle = markerCards.first().locator('.marker-card-title');
        await expect(firstTitle).toHaveText('Calcaneus (Fersenbein)');
    });

    test('clicking a sidebar marker card opens floating 3D tooltip', async ({ page }) => {
        const firstCard = page.locator('#markers-list .marker-card').first();
        await firstCard.click();

        // Floating tooltip should be displayed with matching title
        const tooltip = page.locator('#floating-tooltip');
        await expect(tooltip).toHaveClass(/visible/);

        const tooltipTitle = page.locator('#tooltip-title');
        await expect(tooltipTitle).toHaveText('Calcaneus (Fersenbein)');

        // Close tooltip via close button
        const closeBtn = page.locator('#tooltip-close');
        await closeBtn.click();
        await expect(tooltip).not.toHaveClass(/visible/);
    });

    test('editing a marker via tooltip opens edit modal and saves changes', async ({ page }) => {
        const firstCard = page.locator('#markers-list .marker-card').first();
        await firstCard.click();

        // Click Edit in floating tooltip
        await page.locator('#tooltip-edit-btn').click();

        // Edit modal should be open
        const editModal = page.locator('#modal-edit');
        await expect(editModal).toBeVisible();

        const titleInput = page.locator('#edit-title');
        await titleInput.fill('Geänderter Knochenpunkt');

        // Submit form
        await page.locator('#modal-edit .btn-save').click();

        // Verify updated in sidebar
        const updatedTitle = page.locator('#markers-list .marker-card').first().locator('.marker-card-title');
        await expect(updatedTitle).toHaveText('Geänderter Knochenpunkt');
    });

    test('toggles interaction mode between Navigate and Add Marker', async ({ page }) => {
        const navBtn = page.locator('#mode-nav-btn');
        const addBtn = page.locator('#mode-add-btn');
        const modeBanner = page.locator('#mode-banner');

        await expect(navBtn).toHaveClass(/active/);
        await expect(modeBanner).toHaveClass(/hidden/);

        // Click Add Marker button
        await addBtn.click();
        await expect(addBtn).toHaveClass(/active/);
        await expect(navBtn).not.toHaveClass(/active/);
        await expect(modeBanner).not.toHaveClass(/hidden/);

        // Switch back to Navigate
        await navBtn.click();
        await expect(navBtn).toHaveClass(/active/);
        await expect(addBtn).not.toHaveClass(/active/);
        await expect(modeBanner).toHaveClass(/hidden/);
    });

    test('search input filters marker cards in the sidebar', async ({ page }) => {
        const searchInput = page.locator('#search-input');
        await searchInput.fill('Calcaneus');

        const visibleCards = page.locator('#markers-list .marker-card:not([style*="display: none"])');
        await expect(visibleCards).toHaveCount(1);

        // Should hide non-matching items
        await searchInput.fill('XYZUnbekannterKnochen12345');
        const emptyVisibleCards = page.locator('#markers-list .marker-card:not([style*="display: none"])');
        await expect(emptyVisibleCards).toHaveCount(0);
    });

    test('toggles options drawer and sidebar collapse', async ({ page }) => {
        // Initially sidebar is expanded; click close button in sidebar header
        const sidebar = page.locator('#sidebar');
        const closeSidebarBtn = page.locator('#close-sidebar-btn');
        await expect(sidebar).not.toHaveClass(/collapsed/);
        await closeSidebarBtn.click();
        await expect(sidebar).toHaveClass(/collapsed/);

        // Now top-nav actions are unobscured
        const optionsBtn = page.locator('#toggle-options-btn');
        const optionsDrawer = page.locator('#options-drawer');

        await expect(optionsDrawer).toHaveClass(/hidden/);
        await optionsBtn.click();
        await expect(optionsDrawer).not.toHaveClass(/hidden/);

        // Close options drawer
        await page.locator('#close-options-btn').click();
        await expect(optionsDrawer).toHaveClass(/hidden/);

        // Re-open sidebar via top-nav toggle button
        const toggleSidebarBtn = page.locator('#toggle-sidebar-btn');
        await toggleSidebarBtn.click();
        await expect(sidebar).not.toHaveClass(/collapsed/);
    });
});
