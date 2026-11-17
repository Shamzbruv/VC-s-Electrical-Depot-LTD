export const mediaLimit=2*1024*1024;
export const mediaBucket='staff-media';
export const mediaPath='/api/media/';
export const mediaNamePattern=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}-[a-z0-9-]{1,70}\.webp$/;
export function managedImage(url:string) {
  return url.startsWith(mediaPath)&&mediaNamePattern.test(url.slice(mediaPath.length));
}

export type MediaItem={src:string;label:string;createdAt?:string};
export function mediaLabel(name:string) {
  return name.slice(37,-5).replaceAll('-',' ');
}
