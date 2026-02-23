import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'papaparse';
import { getCurrentUser } from '../../../../utils/auth';

interface ResidentCSVRow {
  'first name'?: string;
  'last name'?: string;
  'id'?: string;
  name?: string;
  'empl id'?: string;
  'asu id'?: string;
  'student id'?: string;
  email?: string;
  'email address'?: string;
  room?: string;
  'room number'?: string;
  roomspace?: string;
  roomspacedescription?: string;
  [key: string]: string | undefined;
}

interface SkippedRow {
  row: number;
  reason: string;
  data: Record<string, string>;
}

interface ColumnMapping {
  detected: string | null;
  expectedOptions: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Resolve the current authenticated app user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role key for server-side operations to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    
    // Parse without header transformation first to preserve original case
    const { data: csvData, errors, meta } = parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      // Don't transform headers - keep original case
    });

    if (errors.length > 0) {
      return NextResponse.json({
        error: 'CSV parsing error',
        details: errors
      }, { status: 400 });
    }

    // Get all columns from CSV
    const csvColumns = meta.fields || [];

    // Define expected column options for each field
    const firstNameColumns = ['First Name', 'first name', 'firstname', 'first_name', 'FirstName'];
    const lastNameColumns = ['Last Name', 'last name', 'lastname', 'last_name', 'LastName'];
    const fullNameColumns = ['name', 'Name', 'Full Name', 'full name', 'full_name', 'FullName'];
    const nameColumns = [...firstNameColumns, ...lastNameColumns, ...fullNameColumns];
    const idColumns = ['ID', 'id', 'Empl ID', 'empl id', 'emplid', 'EmplId', 'empl_id', 'ASU ID', 'asu id', 'asu_id', 'Student ID', 'student id', 'student_id', 'Employee ID', 'employee id', 'employee_id'];
    const emailColumns = ['Email', 'email', 'Email Address', 'email address', 'email_address', 'E-mail', 'e-mail'];
    const roomColumns = ['RoomSpaceDescription', 'roomspacedescription', 'Room Space Description', 'room space description', 'RoomSpace', 'roomspace', 'Room Space', 'room space', 'Room Number', 'room number', 'room_number', 'Room', 'room'];

    // Helper to find which column was matched
    const findMatchedColumn = (keys: string[]): string | null => {
      for (const key of keys) {
        const foundKey = csvColumns.find(k => k.toLowerCase() === key.toLowerCase());
        if (foundKey) return foundKey;
      }
      return null;
    };

    // Build column mapping report
    const columnMapping: Record<string, ColumnMapping> = {
      name: { detected: findMatchedColumn(nameColumns), expectedOptions: nameColumns.slice(0, 4) },
      id: { detected: findMatchedColumn(idColumns), expectedOptions: idColumns.slice(0, 4) },
      email: { detected: findMatchedColumn(emailColumns), expectedOptions: emailColumns.slice(0, 3) },
      room: { detected: findMatchedColumn(roomColumns), expectedOptions: roomColumns.slice(0, 4) },
    };

    // Track skipped rows
    const skippedRows: SkippedRow[] = [];
    const validResidents: { user_id: string; name: string | null; empl_id: string | null; email: string | null; room: string | null; }[] = [];

    csvData.forEach((row, index) => {
      // Helper function to get value from row with case-insensitive key matching
      const getValue = (keys: string[]) => {
        for (const key of keys) {
          if (row[key]?.trim()) {
            return row[key].trim();
          }
          const foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
          if (foundKey && row[foundKey]?.trim()) {
            return row[foundKey].trim();
          }
        }
        return null;
      };

      // Handle different CSV formats for names
      const firstName = getValue(firstNameColumns);
      const lastName = getValue(lastNameColumns);
      const fullName = firstName && lastName ? `${firstName} ${lastName}` : getValue(fullNameColumns);

      // Handle different CSV formats for ID
      const id = getValue(idColumns);

      // Handle different CSV formats for email
      const email = getValue(emailColumns);

      // Handle room with all possible column name variations
      let roomValue = getValue(roomColumns);

      // If still no room found, try dynamic search for any column with room-like data
      if (!roomValue) {
        const roomKeys = Object.keys(row).filter(key => {
          const lowerKey = key.toLowerCase();
          return lowerKey.includes('room') ||
                 lowerKey.includes('space') ||
                 lowerKey.includes('residence') ||
                 lowerKey.includes('dorm');
        });

        for (const key of roomKeys) {
          if (row[key]?.trim()) {
            roomValue = row[key].trim();
            break;
          }
        }
      }

      const room = roomValue ? roomValue.toUpperCase() : null;

      // Validate required fields and track why rows are skipped
      const missingFields: string[] = [];
      if (!fullName) missingFields.push('name');
      if (!id) missingFields.push('ID');

      if (missingFields.length > 0) {
        skippedRows.push({
          row: index + 2, // +2 because index is 0-based and row 1 is header
          reason: `Missing required field(s): ${missingFields.join(', ')}`,
          data: row
        });
        return;
      }

      validResidents.push({
        user_id: user.id,
        name: fullName,
        empl_id: id,
        email: email,
        room: room || null,
      });
    });

    // Build detailed feedback
    const feedback = {
      totalRows: csvData.length,
      validRows: validResidents.length,
      skippedRows: skippedRows.length,
      detectedColumns: csvColumns,
      columnMapping,
      skippedDetails: skippedRows.slice(0, 10), // Limit to first 10 for readability
    };

    if (validResidents.length === 0) {
      return NextResponse.json({
        error: 'No valid residents found in CSV',
        feedback,
        suggestion: `Your CSV has columns: [${csvColumns.join(', ')}]. Required: a name column (${nameColumns.slice(0, 3).join(' or ')}) and an ID column (${idColumns.slice(0, 3).join(' or ')}).`
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('residents')
      .upsert(validResidents, {
        onConflict: 'user_id,empl_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message, feedback }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imported: data?.length || 0,
      residents: data,
      feedback,
      warnings: skippedRows.length > 0 ? `${skippedRows.length} row(s) were skipped due to missing required fields.` : null
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}