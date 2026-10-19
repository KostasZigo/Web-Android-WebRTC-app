import { expect, test, type Page } from 'playwright/test';

async function localPreviewEnabled(page: Page): Promise<boolean> {
  return page.locator('video').first().evaluate(video =>
    video instanceof HTMLVideoElement &&
    video.srcObject instanceof MediaStream &&
    video.srcObject.getVideoTracks().some(track => track.enabled)
  );
}

async function remoteVideoTrackCount(page: Page): Promise<number> {
  return page.locator('video').nth(1).evaluate(video =>
    video instanceof HTMLVideoElement && video.srcObject instanceof MediaStream
      ? video.srcObject.getVideoTracks().length : 0
  );
}

async function enterCall(page: Page) {
  let resolveMatch!: (offer: boolean) => void;
  const match = new Promise<boolean>(resolve => { resolveMatch = resolve; });
  page.on('websocket', socket => {
    if (!socket.url().startsWith('ws://127.0.0.1:8000/')) return;
    socket.on('framereceived', frame => {
      const message: unknown = JSON.parse(frame.payload.toString());
      if (typeof message === 'object' && message !== null &&
        'type' in message && message.type === 'matched' &&
        'offer' in message && typeof message.offer === 'boolean') {
        resolveMatch(message.offer);
      }
    });
  });
  await page.goto('/');
  return { match };
}

test('shows the call controls and pauses the local preview', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('mat-toolbar')).toContainText('Video Chat');
  await expect(page.getByRole('heading', { name: 'Make a connection' })).toBeVisible();
  await expect(page.locator('.video-description')).toHaveText(['Your camera', 'Other person']);
  await expect(page.locator('video')).toHaveCount(2);
  for (const label of ['Start', 'Stop', 'Call', 'Hangup']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.getByRole('button', { name: 'Start' }).click();
  const localVideo = page.locator('video').first();
  await expect.poll(() => localPreviewEnabled(page)).toBe(true);

  await page.getByRole('button', { name: 'Stop' }).click();
  await expect.poll(() => localVideo.evaluate(video =>
    video instanceof HTMLVideoElement && video.srcObject === null
  )).toBe(true);
  await page.getByRole('button', { name: 'Call' }).click();
  await expect(page.getByRole('alert')).toHaveText('Waiting for another caller.');
});

test('connects two browsers and releases media after Hangup', async ({ page, context }) => {
  const waiting = await enterCall(page);
  const offeringPage = await context.newPage();
  const offering = await enterCall(offeringPage);
  const [firstOffer, secondOffer] = await Promise.all([waiting.match, offering.match]);
  expect(firstOffer).toBe(false);
  expect(secondOffer).toBe(true);

  await page.getByRole('button', { name: 'Call' }).click();
  await expect(page.getByRole('alert')).toHaveText('Waiting for the other caller to start the call.');
  await offeringPage.getByRole('button', { name: 'Start' }).click();
  const localVideo = offeringPage.locator('video').first();
  await expect.poll(() => localPreviewEnabled(offeringPage)).toBe(true);
  const localTrack = await localVideo.evaluateHandle(video => {
    if (!(video instanceof HTMLVideoElement) || !(video.srcObject instanceof MediaStream)) {
      throw new Error('Local preview is unavailable');
    }
    const track = video.srcObject.getVideoTracks()[0];
    if (!track) throw new Error('Local video track is unavailable');
    return track;
  });
  await offeringPage.getByRole('button', { name: 'Call' }).click();
  await expect.poll(() => remoteVideoTrackCount(page)).toBeGreaterThan(0);
  await expect.poll(() => remoteVideoTrackCount(offeringPage)).toBeGreaterThan(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(offeringPage.getByRole('alert')).toHaveCount(0);

  await offeringPage.getByRole('button', { name: 'Hangup' }).click();
  await expect.poll(() => localTrack.evaluate(track => track.readyState)).toBe('ended');
  await expect.poll(() => page.locator('video').nth(1).evaluate(video =>
    video instanceof HTMLVideoElement && video.srcObject === null
  )).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
