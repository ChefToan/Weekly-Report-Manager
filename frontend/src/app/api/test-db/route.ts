import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // Try direct HTTP request to Supabase REST API
    const restUrl = `${supabaseUrl}/rest/v1/users?select=username,name,is_active&limit=3`;
    
    console.log('Making direct HTTP request to:', restUrl);
    
    const response = await fetch(restUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    });
    
    console.log('HTTP Response status:', response.status);
    console.log('HTTP Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('HTTP Response body:', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = responseText;
    }
    
    // Also try the Supabase client for comparison
    const supabase = createClient(supabaseUrl, serviceKey);
    const clientTest = await supabase.from('users').select('username,name,is_active').limit(3);
    
    return NextResponse.json({
      directHTTP: {
        status: response.status,
        statusText: response.statusText,
        data: data
      },
      supabaseClient: {
        error: clientTest.error?.message,
        data: clientTest.data
      },
      env: {
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceKey,
        keyPrefix: serviceKey.substring(0, 30),
        restUrl: restUrl
      }
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}