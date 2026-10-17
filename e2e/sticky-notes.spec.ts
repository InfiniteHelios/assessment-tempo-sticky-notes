import { expect, type Locator, type Page, test } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Element has no bounding box.');
  }
  return box;
}

async function resetBoard(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function createNote(
  page: Page,
  values: { x?: string; y?: string; width?: string; height?: string } = {},
) {
  await page.getByLabel('X').fill(values.x ?? '48');
  await page.getByLabel('Y').fill(values.y ?? '48');
  await page.getByLabel('Width').fill(values.width ?? '220');
  await page.getByLabel('Height').fill(values.height ?? '160');
  await page.getByRole('button', { name: 'Create note' }).click();
}

function note(page: Page) {
  return page.locator('article');
}

async function dragHandleBy(page: Page, dx: number, dy: number) {
  const handle = page.getByRole('button', { name: /^Drag note/ });
  const box = await boxOf(handle);
  const startX = box.x + 24;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 8 });
  await page.mouse.up();
}

async function dragPointerTo(page: Page, target: { x: number; y: number }, release: boolean) {
  const handle = page.getByRole('button', { name: /^Drag note/ });
  const handleBox = await boxOf(handle);
  const grab = { x: handleBox.x + 24, y: handleBox.y + handleBox.height / 2 };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  if (release) await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

test('creates a note at the requested board position and size', async ({ page }) => {
  await createNote(page, { x: '120', y: '90', width: '200', height: '140' });
  await expect(note(page)).toHaveAttribute('data-x', '120');
  await expect(note(page)).toHaveAttribute('data-y', '90');
  await expect(note(page)).toHaveAttribute('data-width', '200');
  await expect(note(page)).toHaveAttribute('data-height', '140');
});

test('rejects a note that does not fit and leaves the board empty', async ({ page }) => {
  await createNote(page, { width: '10' });
  await expect(page.getByRole('alert')).toContainText(/at least 120/i);
  await expect(note(page)).toHaveCount(0);
});

test('drags a note by its header without resizing it', async ({ page }) => {
  await createNote(page);
  await dragHandleBy(page, 80, 40);
  await expect(note(page)).toHaveAttribute('data-x', '128');
  await expect(note(page)).toHaveAttribute('data-y', '88');
  await expect(note(page)).toHaveAttribute('data-width', '220');
  await expect(note(page)).toHaveAttribute('data-height', '160');
});

test('resizes from the corner handle and keeps the note origin', async ({ page }) => {
  await createNote(page);
  const handle = page.getByRole('button', { name: 'Resize note' });
  const box = await boxOf(handle);
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 40, startY + 30, { steps: 8 });
  await page.mouse.up();
  await expect(note(page)).toHaveAttribute('data-x', '48');
  await expect(note(page)).toHaveAttribute('data-y', '48');
  await expect(note(page)).toHaveAttribute('data-width', '260');
  await expect(note(page)).toHaveAttribute('data-height', '190');
});

test('deletes a note only when the pointer is released over the trash', async ({ page }) => {
  await createNote(page);
  const trash = page.getByRole('region', { name: /Trash zone/ });
  const trashBox = await boxOf(trash);
  const outside = { x: trashBox.x - 40, y: trashBox.y - 40 };
  await dragPointerTo(page, outside, true);
  await expect(note(page)).toHaveCount(1);
  await expect(trash).toHaveAttribute('data-armed', 'false');

  const nextTrash = await boxOf(trash);
  await dragPointerTo(page, { x: nextTrash.x + 2, y: nextTrash.y + nextTrash.height - 2 }, false);
  await expect(trash).toHaveAttribute('data-armed', 'true');
  await page.mouse.up();
  await expect(note(page)).toHaveCount(0);
  await expect(page.getByText(/No notes yet/)).toBeVisible();
});

test('cancels a drag with Escape and keeps the committed position', async ({ page }) => {
  await createNote(page);
  const handle = page.getByRole('button', { name: /^Drag note/ });
  const box = await boxOf(handle);
  const startX = box.x + 24;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 70, startY + 30, { steps: 6 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(note(page)).toHaveAttribute('data-x', '48');
  await expect(note(page)).toHaveAttribute('data-y', '48');
});

test('edits text without starting a drag and restores the note after reload', async ({ page }) => {
  await createNote(page, { x: '80', y: '64' });
  const text = page.getByRole('textbox', { name: 'Note text' });
  await text.fill('Remember the demo');
  const textBox = await boxOf(text);
  await page.mouse.move(textBox.x + 12, textBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(textBox.x + 80, textBox.y + 40, { steps: 6 });
  await page.mouse.up();
  await expect(note(page)).toHaveAttribute('data-x', '80');
  await expect(note(page)).toHaveAttribute('data-y', '64');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('tempo-sticky-notes')))
    .toContain('Remember the demo');

  await page.reload();
  await expect(note(page)).toHaveAttribute('data-x', '80');
  await expect(note(page)).toHaveAttribute('data-y', '64');
  await expect(page.getByRole('textbox', { name: 'Note text' })).toHaveValue('Remember the demo');
});
