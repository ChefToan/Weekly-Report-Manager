import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/utils/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { id } = await params;

    // Delete interactions for this resident belonging to the current user
    const { error: interactionsError } = await supabase
      .from('interactions')
      .delete()
      .eq('resident_id', id)
      .eq('user_id', currentUser.id);

    if (interactionsError) {
      console.error('Error deleting interactions:', interactionsError);
    }

    // Delete the resident only if it belongs to the current user
    const { error } = await supabase
      .from('residents')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}