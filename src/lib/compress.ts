/* global Image, FileReader */

const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 0.82;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;

export async function compressImage(base64: string): Promise<string> {
  const dataUri = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;

  if (typeof g.Image === 'undefined' || typeof g.document === 'undefined') {
    return dataUri;
  }

  return new Promise<string>((resolve, reject) => {
    const img = new g.Image() as {
      onload: (() => void) | null;
      onerror: (() => void) | null;
      src: string;
      width: number;
      height: number;
    };

    img.onload = () => {
      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      type FakeCanvas = {
        width: number;
        height: number;
        getContext: (ctx: string) => {
          drawImage: (img: unknown, x: number, y: number, w: number, h: number) => void;
        } | null;
        toBlob: (cb: (blob: Blob | null) => void, type: string, quality: number) => void;
      };
      const canvas = g.document.createElement('canvas') as FakeCanvas;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx == null) {
        resolve(dataUri);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob: Blob | null) => {
          if (blob == null) {
            resolve(dataUri);
            return;
          }
          const reader = new g.FileReader() as {
            onloadend: (() => void) | null;
            onerror: (() => void) | null;
            result: string;
            readAsDataURL: (blob: Blob) => void;
          };
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(dataUri);
          reader.readAsDataURL(blob);
        },
        'image/webp',
        WEBP_QUALITY
      );
    };

    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = dataUri;
  });
}
