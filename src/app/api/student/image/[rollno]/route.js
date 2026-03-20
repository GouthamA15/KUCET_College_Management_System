import logger from '@/lib/logger';
import { db } from '@/db';
import { studentImages, students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthUser, apiError } from '@/lib/api-utils';

export async function GET(req, context) {
  try {
    const user = await getAuthUser();
    if (!user) return apiError('Unauthorized', 401);
    
    const params = await context.params;
    const { rollno } = params;
    if (!rollno) return new NextResponse('Roll number required', { status: 400 });

    const rows = await db.select({ pfp: studentImages.pfp })
      .from(studentImages)
      .innerJoin(students, eq(studentImages.student_id, students.id))
      .where(eq(students.roll_no, rollno))
      .limit(1);

    if (rows.length === 0 || !rows[0].pfp) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const imageBufferOrUrl = rows[0].pfp;

    if (typeof imageBufferOrUrl === 'string' && imageBufferOrUrl.startsWith('http')) {
      const imageRes = await fetch(imageBufferOrUrl);
      if (!imageRes.ok) throw new Error('Cloudinary fetch failed');
      
      const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
      const buffer = await imageRes.arrayBuffer();

      return new NextResponse(Buffer.from(buffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, must-revalidate',
        },
      });
    }

    // Treat as Buffer (old BLOB data)
    return new NextResponse(imageBufferOrUrl, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, must-revalidate', 
      },
    });

  } catch (error) {
    logger.error('Error serving student image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
