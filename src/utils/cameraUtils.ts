export async function listVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'videoinput');
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = canvas.toDataURL('image/png');
  anchor.download = filename;
  anchor.click();
}
