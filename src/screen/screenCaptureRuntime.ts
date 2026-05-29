let screenCaptureVideoElement: HTMLVideoElement | null = null;

export function setScreenCaptureVideoElement(element: HTMLVideoElement | null) {
  screenCaptureVideoElement = element;
}

export function getScreenCaptureVideoElement() {
  return screenCaptureVideoElement;
}
