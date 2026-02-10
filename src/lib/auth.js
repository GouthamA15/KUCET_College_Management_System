import { jwtVerify } from 'jose';

export async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error.name, error.message); // MODIFIED FOR MORE DETAIL
    return null;
  }
}
