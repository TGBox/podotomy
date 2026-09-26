import { test, expect } from '@playwright/test';

test.describe('Dual View (Knochen & Haut) E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            const sampleMarkers = [
                {
                    id: 'marker-calcaneus-bone',
                    number: 1,
                    title: 'Calcaneus (Fersenbein)',
                    description: 'Rückfußskelett',
                    position: { x: 0, y: -10, z: -35 },
                    normal: { x: 0, y: 0.4, z: -0.9 },
                    createdAt: new Date().toISOString(),
                    view: 'bone'
                },
                {
                    id: 'marker-talus-bone',
                    number: 2,
                    title: 'Talus (Sprungbein)',
                    description: 'Sprunggelenk',
                    position: { x: 0, y: 20, z: -10 },
                    normal: { x: 0, y: 0.9, z: 0.3 },
                    createdAt: new Date().toISOString(),
                    view: 'bone'
                }
            ];
            window.localStorage.setItem('podotomy_foot_annotations_v2', JSON.stringify(sampleMarkers));
        });

        await page.goto('/');
        await page.waitForSelector('#loading-overlay.fade-out', { timeout: 45000 });
    });

    test('displays the segmented view toggle switch with bone and skin options', async ({ page }) => {
        const boneBtn = page.locator('#view-bone-btn');
        const skinBtn = page.locator('#view-skin-btn');

        await expect(boneBtn).toBeVisible();
        await expect(skinBtn).toBeVisible();

        // Knochen is active by default
        await expect(boneBtn).toHaveClass(/active/);
        await expect(boneBtn).toHaveAttribute('aria-checked', 'true');
        await expect(skinBtn).not.toHaveClass(/active/);
        await expect(skinBtn).toHaveAttribute('aria-checked', 'false');

        // Sidebar shows the 2 bone markers
        const cards = page.locator('#markers-list .marker-card');
        await expect(cards).toHaveCount(2);
        await expect(page.locator('#marker-count-badge')).toHaveText('2');
    });

    test('switches to skin view and filters sidebar to show only skin markers', async ({ page }) => {
        const boneBtn = page.locator('#view-bone-btn');
        const skinBtn = page.locator('#view-skin-btn');

        // Switch to skin view
        await skinBtn.click();

        await expect(skinBtn).toHaveClass(/active/);
        await expect(skinBtn).toHaveAttribute('aria-checked', 'true');
        await expect(boneBtn).not.toHaveClass(/active/);
        await expect(boneBtn).toHaveAttribute('aria-checked', 'false');

        // Sidebar should now be empty for skin view
        const cards = page.locator('#markers-list .marker-card');
        await expect(cards).toHaveCount(0);
        await expect(page.locator('#marker-count-badge')).toHaveText('0');
        await expect(page.locator('.empty-state')).toContainText('Hautansicht');

        // Switch back to bone view
        await boneBtn.click();
        await expect(boneBtn).toHaveClass(/active/);
        await expect(cards).toHaveCount(2);
        await expect(page.locator('#marker-count-badge')).toHaveText('2');
    });

    test('places a new skin marker with amber badge and separate numbering', async ({ page }) => {
        const skinBtn = page.locator('#view-skin-btn');
        await skinBtn.click();

        // Switch to add mode
        const addBtn = page.locator('#mode-add-btn');
        await addBtn.click();

        // Click canvas near center to place marker on the 3D model surface
        const canvas = page.locator('#canvas-container canvas');
        await canvas.click({ position: { x: 700, y: 360 } });

        // Add modal opens
        const modal = page.locator('#modal-add');
        await expect(modal).toBeVisible();

        await page.locator('#input-title').fill('Fersenpolster Plantar');
        await page.locator('#input-desc').fill('Subkutanes Fettgewebe der Ferse');
        await modal.locator('button.btn-save').click();

        // Check sidebar shows the newly added skin marker
        const cards = page.locator('#markers-list .marker-card');
        await expect(cards).toHaveCount(1);
        await expect(cards.first()).toHaveClass(/skin-marker/);
        await expect(cards.first().locator('.marker-badge-icon')).toHaveText('1');
        await expect(cards.first().locator('.marker-card-title')).toHaveText('Fersenpolster Plantar');

        // Switch back to bone view: bone markers shown (2 items), skin marker hidden from sidebar
        const boneBtn = page.locator('#view-bone-btn');
        await boneBtn.click();
        await expect(page.locator('#markers-list .marker-card')).toHaveCount(2);

        // Switch back to skin view: skin marker shown (1 item)
        await skinBtn.click();
        await expect(page.locator('#markers-list .marker-card')).toHaveCount(1);
        await expect(page.locator('#markers-list .marker-card').first().locator('.marker-card-title')).toHaveText('Fersenpolster Plantar');
    });

    test('renders skin foot model with lit PBR material and vertex normals', async ({ page }) => {
        const skinBtn = page.locator('#view-skin-btn');
        await skinBtn.click();
        await page.waitForTimeout(600);

        const skinInfo = await page.evaluate(() => {
            const state = (window as any).AppState;
            if (!state || !state.skinModel) return null;
            let meshCount = 0;
            let hasNormals = false;
            let materialType = '';
            state.skinModel.traverse((child: any) => {
                if (child.isMesh && child.geometry) {
                    meshCount++;
                    hasNormals = !!child.geometry.attributes.normal && child.geometry.attributes.normal.count > 0;
                    materialType = child.material?.type || '';
                }
            });
            return {
                visible: state.skinModel.visible,
                meshCount,
                hasNormals,
                materialType
            };
        });

        // Skin model is visible, has computed vertex normals for lighting, and MeshStandardMaterial
        expect(skinInfo).not.toBeNull();
        if (skinInfo) {
            expect(skinInfo.visible).toBe(true);
            expect(skinInfo.meshCount).toBeGreaterThan(0);
            expect(skinInfo.hasNormals).toBe(true);
            expect(skinInfo.materialType).toBe('MeshStandardMaterial');
        }

        // Full canvas screenshot confirms rendered content
        const screenshot = await page.screenshot();
        expect(screenshot.length).toBeGreaterThan(50000);
    });
});
