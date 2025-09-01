import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Use service role key for server-side operations to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: residents, error } = await supabase
      .from('residents')
      .select('*');
    
    // Import sorting utility (we'll sort on frontend for more control)
    // Keep basic order here but main sorting will be done in components

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(residents);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Use service role key for server-side operations to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body = await request.json();

    const { data, error } = await supabase
      .from('residents')
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// OPTIMIZED: Batch delete endpoint to handle multiple residents at once
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty ids array' }, { status: 400 });
    }

    // Delete related interactions first
    const { error: interactionsError } = await supabase
      .from('interactions')
      .delete()
      .in('resident_id', ids);
    
    if (interactionsError) {
      console.error('Error deleting interactions:', interactionsError);
      // Continue with residents deletion even if interactions fail
    }

    // Delete residents
    const { data, error } = await supabase
      .from('residents')
      .delete()
      .in('id', ids)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: `Successfully deleted ${data?.length || 0} residents`,
      deletedIds: ids 
    });
  } catch (error) {
    console.error('Batch delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}