export function GET(request:Request) {
  return Response.redirect(new URL('/share/home/image.png',request.url),308);
}
