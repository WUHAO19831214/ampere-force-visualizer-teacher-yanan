import type { Rect } from '../types/physics';

export type ScreenViewMode = 'contain' | 'cover' | 'manual-crop';

export interface Size {
  width: number;
  height: number;
}

export interface VideoLayoutInfo {
  videoSize: Size;
  containerSize: Size;
  renderedVideoRect: Rect;
  viewMode: ScreenViewMode;
}

function safeSize(size: Size): Size {
  return {
    width: Math.max(1, size.width),
    height: Math.max(1, size.height),
  };
}

export function getRenderedVideoRect(videoSize: Size, containerSize: Size, viewMode: ScreenViewMode): Rect {
  const video = safeSize(videoSize);
  const container = safeSize(containerSize);
  const containScale = Math.min(container.width / video.width, container.height / video.height);
  const coverScale = Math.max(container.width / video.width, container.height / video.height);
  const scale = viewMode === 'cover' ? coverScale : containScale;
  const width = video.width * scale;
  const height = video.height * scale;

  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
  };
}

export function normalizedRectToDisplayRect(normalizedRect: Rect, layout: VideoLayoutInfo): Rect {
  const rendered = layout.renderedVideoRect;
  return {
    x: rendered.x + normalizedRect.x * rendered.width,
    y: rendered.y + normalizedRect.y * rendered.height,
    width: normalizedRect.width * rendered.width,
    height: normalizedRect.height * rendered.height,
  };
}

export function displayRectToNormalizedRect(displayRect: Rect, layout: VideoLayoutInfo): Rect {
  const rendered = layout.renderedVideoRect;
  return {
    x: (displayRect.x - rendered.x) / rendered.width,
    y: (displayRect.y - rendered.y) / rendered.height,
    width: displayRect.width / rendered.width,
    height: displayRect.height / rendered.height,
  };
}

export function normalizedRectToVideoPixelRect(normalizedRect: Rect, videoSize: Size): Rect {
  return {
    x: normalizedRect.x * videoSize.width,
    y: normalizedRect.y * videoSize.height,
    width: normalizedRect.width * videoSize.width,
    height: normalizedRect.height * videoSize.height,
  };
}
