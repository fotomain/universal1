// A look (photoFilters.ts) applied to a photo file - iOS and Android. expo-image-manipulator turns the EXIF orientation into real pixels (a
// camera file is a sideways picture with a note "turn it"), then Skia draws it through the colour matrix of the look into an off-screen
// surface and the result is kept as a JPEG in the cache. The web twin is applyPhotoFilter.web.ts.
import { File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { filterById, isIdentity } from './photoFilters';

export interface FilteredPhoto {
  uri: string;
  width: number;
  height: number;
}

/** the biggest side of a filtered photo (a 108 MP phone photo would not fit in an off-screen surface) */
export const MAX_FILTER_SIDE = 4096;

export async function applyPhotoFilter(uri: string, filterId: string, size?: { width: number; height: number }): Promise<FilteredPhoto> {
  const upright = await manipulateAsync(uri, [], { compress: 1, format: SaveFormat.JPEG });
  if (isIdentity(filterId)) return { uri: upright.uri, width: upright.width, height: upright.height };
  const filter = filterById(filterId);

  const data = await Skia.Data.fromURI(upright.uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('The photo could not be opened for the look.');
  const scale = Math.min(1, MAX_FILTER_SIDE / Math.max(image.width(), image.height()));
  const width = Math.max(1, Math.round(image.width() * scale));
  const height = Math.max(1, Math.round(image.height() * scale));
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) throw new Error('The photo is too big for this device.');
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(filter.matrix));
  canvas.drawImageRect(image, Skia.XYWHRect(0, 0, image.width(), image.height()), Skia.XYWHRect(0, 0, width, height), paint);
  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 92);

  const file = new File(Paths.cache, `kit8photo_${Date.now()}_${filter.id}.jpg`) as any;
  file.create({ overwrite: true });
  file.write(bytes);
  void size;
  return { uri: file.uri as string, width, height };
}
