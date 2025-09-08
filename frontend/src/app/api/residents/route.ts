import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/utils/auth';
import { attachHeaders, cacheHeaders, makeETag, getCachedJSON, setCachedJSON, getVersion, bumpVersion } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const v = await getVersion('residents', currentUser.id);
    const etag = makeETag([currentUser.id, 'residents', v]);

    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch && ifNoneMatch === etag) {
      const notMod = new NextResponse(null, { status: 304 });
      return attachHeaders(notMod, { ...cacheHeaders('residents'), ETag: etag });
    }

    // Try Redis cache
    const cached = await getCachedJSON<any[]>('residents', [currentUser.id, v]);
    if (cached) {
      const res = NextResponse.json(cached);
      return attachHeaders(res, { ...cacheHeaders('residents'), ETag: etag });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: residents, error } = await supabase
      .from('residents')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await setCachedJSON('residents', [currentUser.id, v], residents);

    const res = NextResponse.json(residents);
    return attachHeaders(res, { ...cacheHeaders('residents'), ETag: etag });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body = await request.json();

    const payload = {
      user_id: currentUser.id,
      name: body.name,
      empl_id: body.empl_id,
      email: body.email ?? null,
      room: body.room ?? null,
    };

    const { data, error } = await supabase
      .from('residents')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Invalidate caches
    await bumpVersion('residents', currentUser.id);
    await bumpVersion('stats', currentUser.id);

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// OPTIMIZED: Batch delete endpoint to handle multiple residents at once
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty ids array' }, { status: 400 });
    }

    // Delete related interactions first (only current user's)
    const { error: interactionsError } = await supabase
      .from('interactions')
      .delete()
      .in('resident_id', ids)
      .eq('user_id', currentUser.id);

    if (interactionsError) {
      console.error('Error deleting interactions:', interactionsError);
      // Continue with residents deletion even if interactions fail
    }

    // Delete residents that belong to the current user
    const { data, error } = await supabase
      .from('residents')
      .delete()
      .in('id', ids)
      .eq('user_id', currentUser.id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Invalidate caches
    await bumpVersion('residents', currentUser.id);
    await bumpVersion('interactions', currentUser.id);
    await bumpVersion('stats', currentUser.id);
    await bumpVersion('reports-weekly', currentUser.id);

    return NextResponse.json({
      message: `Successfully deleted ${data?.length || 0} residents`,
      deletedIds: (data || []).map(r => r.id)
    });
  } catch (error) {
    console.error('Batch delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}