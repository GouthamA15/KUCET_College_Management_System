import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing keys' }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Perform a minimal "ping" to Supabase Realtime/Rest
    // This counts as activity to prevent project pausing
    const { data, error } = await supabase.from('_dummy_ping').select('*').limit(1).maybeSingle();
    
    // Note: _dummy_ping doesn't need to exist. We just need to hit the API.
    
    return NextResponse.json({ 
      status: 'active', 
      timestamp: new Date().toISOString(),
      supabase: error?.code === 'PGRST116' || !error ? 'reachable' : 'error' 
    });
  } catch (err) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
