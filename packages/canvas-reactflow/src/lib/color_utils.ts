export function stringToPastelColor(string: string): string {
  /*

  // Example usage:
  const pastelColor = stringToPastelColor("example_string");
  console.log(pastelColor); // Example output: #b3c8e2

*/

  // Generate a hash from the string
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = (hash << 5) - hash + string.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  // Convert the hash to a hue (0 to 360 degrees)
  const hue = Math.abs(hash) % 360;

  // Define the saturation and lightness for pastel colors
  const saturation = 0.3;  // Low saturation for pastel
  const lightness = 0.8;   // High lightness for pastel (lighter colors)

  // Convert HSL to RGB
  const rgb = hslToRgb(hue, saturation, lightness);

  // Convert RGB to Hex format
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

  return hex;
}

function hslToRgb(h: number, s: number, l: number): { r: number, g: number, b: number } {
  // Convert HSL to RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r: number, g: number, b: number;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  // Convert RGB to Hex format
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();
}

