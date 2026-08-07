import { GET as assetProxyGET } from '@/app/api/assets/view/[...path]/route';

export async function GET(request, context) {
  return assetProxyGET(request, context);
}
