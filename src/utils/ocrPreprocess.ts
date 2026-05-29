import type { PreprocessMode } from '../types/physics';
import { preprocessForNumberRecognition } from './imagePreprocess';

export function preprocessForLangweiNumber(imageData: ImageData, mode: PreprocessMode): ImageData {
  if (mode === 'invert') {
    return preprocessForNumberRecognition(imageData, {
      scale: 4,
      threshold: 145,
      invert: true,
      removeNoise: true,
    });
  }

  if (mode === 'high-contrast') {
    return preprocessForNumberRecognition(sharpenImageData(imageData), {
      scale: 4,
      threshold: 135,
      removeNoise: true,
    });
  }

  if (mode === 'color-number') {
    return preprocessForNumberRecognition(extractColoredDigits(imageData), {
      scale: 4,
      threshold: 210,
      removeNoise: true,
    });
  }

  return preprocessForNumberRecognition(imageData, {
    scale: 4,
    threshold: mode === 'auto' ? 142 : 150,
    removeNoise: true,
  });
}

function sharpenImageData(imageData: ImageData): ImageData {
  const output = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  const source = imageData.data;
  const target = output.data;
  const { width, height } = imageData;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = source[index + channel] * 5;
        const left = source[index - 4 + channel];
        const right = source[index + 4 + channel];
        const top = source[index - width * 4 + channel];
        const bottom = source[index + width * 4 + channel];
        target[index + channel] = Math.max(0, Math.min(255, center - left - right - top - bottom));
      }
    }
  }
  return output;
}

function extractColoredDigits(imageData: ImageData): ImageData {
  const output = new ImageData(imageData.width, imageData.height);
  const source = imageData.data;
  const target = output.data;
  for (let index = 0; index < source.length; index += 4) {
    const red = source[index];
    const green = source[index + 1];
    const blue = source[index + 2];
    const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
    const blueDigit = blue > red * 1.1 && blue > green * 1.05 && saturation > 28;
    const magentaDigit = red > 120 && blue > 100 && green < 170 && saturation > 28;
    const darkBlueDigit = blue > 70 && red < 120 && green < 150 && saturation > 20;
    const value = blueDigit || magentaDigit || darkBlueDigit ? 0 : 255;
    target[index] = value;
    target[index + 1] = value;
    target[index + 2] = value;
    target[index + 3] = 255;
  }
  return output;
}
