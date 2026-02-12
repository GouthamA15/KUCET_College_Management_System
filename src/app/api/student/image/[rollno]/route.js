import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req, context) {
  try {
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

    const imageBuffer = rows[0].pfp;

    // Determine content type (simple check, or default to jpeg)
    // Most uploaded were forced to jpeg in frontend previously, but we removed compression.
    // It's safer to just serve as image/jpeg or detect magic numbers if needed. 
    // Browsers are good at sniffing images even with generic headers, but let's send image/jpeg.
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, must-revalidate', // Cache for 1 day
      },
    });

  } catch (error) {
    console.error('Error serving student image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
