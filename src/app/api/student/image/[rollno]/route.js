import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAuthUser, apiError } from '@/lib/api-utils';

export async function GET(req, context) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return apiError('Unauthorized', 401);
    }
    
    const params = await context.params;
    const { rollno } = params;

    if (!rollno) {
      return new NextResponse('Roll number required', { status: 400 });
    }

    const rows = await query(
      `SELECT si.pfp 
       FROM student_images si 
       JOIN students s ON si.student_id = s.id 
       WHERE s.roll_no = ?`,
      [rollno]
    );

    if (rows.length === 0 || !rows[0].pfp) {
      // Return 404 or a default placeholder redirection
      return new NextResponse('Image not found', { status: 404 });
    }

    const imageBufferOrUrl = rows[0].pfp;

    // If it's a Cloudinary URL (string), redirect to it
    if (typeof imageBufferOrUrl === 'string' && imageBufferOrUrl.startsWith('http')) {
      return NextResponse.redirect(imageBufferOrUrl);
    }

    // Otherwise, treat as Buffer (old BLOB data)
    return new NextResponse(imageBufferOrUrl, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, must-revalidate', 
      },
    });

  } catch (error) {
    console.error('Error serving student image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
