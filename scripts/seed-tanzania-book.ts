import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read .env.local manually
const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) env[key.trim()] = rest.join('=').trim();
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seed() {
  console.log('Seeding Tanzania book...');

  // 1. Find or create an admin user
  let adminId: string;

  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1);

  if (admins && admins.length > 0) {
    adminId = admins[0].id;
    console.log('Found existing admin:', adminId);
  } else {
    // Create an admin user via auth
    console.log('No admin found. Creating admin user...');
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@worlddocent.com',
      password: 'admin1234',
      email_confirm: true,
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      process.exit(1);
    }

    adminId = authUser.user.id;

    // Insert into users table
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: adminId,
        email: 'admin@worlddocent.com',
        role: 'admin',
      });

    if (profileError) {
      console.error('Error creating admin profile:', profileError);
      process.exit(1);
    }
    console.log('Admin user created:', adminId);
  }

  // 2. Check if book already exists
  const { data: existing } = await supabase
    .from('books')
    .select('id')
    .eq('country_id', 'tanzania')
    .eq('title', 'Who is the Real Hero?');

  if (existing && existing.length > 0) {
    console.log('Book already exists:', existing[0].id);
    return;
  }

  // 3. Insert the book
  const { data, error } = await supabase
    .from('books')
    .insert({
      country_id: 'tanzania',
      title: 'Who is the Real Hero?',
      cover_url: '/Story/tanzania-who-is-real-hero.pdf',
      pdf_url_ko: '/Story/tanzania-who-is-real-hero.pdf',
      pdf_url_en: '/Story/tanzania-who-is-real-hero.pdf',
      languages_available: ['ko', 'en'],
      character_analysis: {},
      created_by: adminId,
      scope: 'global',
      approved: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error inserting book:', error);
    process.exit(1);
  }

  console.log('Book created successfully! ID:', data.id);

  // 4. Also create a test teacher and student for testing
  const { data: teachers } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'teacher')
    .limit(1);

  if (!teachers || teachers.length === 0) {
    console.log('Creating test teacher...');
    const { data: teacherAuth, error: teacherAuthErr } = await supabase.auth.admin.createUser({
      email: 'teacher@worlddocent.com',
      password: 'teacher1234',
      email_confirm: true,
    });

    if (!teacherAuthErr && teacherAuth.user) {
      await supabase.from('users').insert({
        id: teacherAuth.user.id,
        email: 'teacher@worlddocent.com',
        role: 'teacher',
        school: 'World Docent School',
        grade: 5,
        class: '1',
      });
      console.log('Teacher created:', teacherAuth.user.id);

      // Create a test student
      console.log('Creating test student...');
      const { data: studentAuth, error: studentAuthErr } = await supabase.auth.admin.createUser({
        email: '123456@student.worlddocent.local',
        password: 'student1234',
        email_confirm: true,
      });

      if (!studentAuthErr && studentAuth.user) {
        await supabase.from('users').insert({
          id: studentAuth.user.id,
          email: '123456@student.worlddocent.local',
          role: 'student',
          student_code: '123456',
          teacher_id: teacherAuth.user.id,
          school: 'World Docent School',
          grade: 5,
          class: '1',
          nickname: '테스트학생',
        });
        console.log('Student created with code: 123456');
      }
    }
  }

  console.log('\n=== Seed Complete ===');
  console.log('Admin login: admin@worlddocent.com / admin1234');
  console.log('Teacher login: teacher@worlddocent.com / teacher1234');
  console.log('Student code: 123456');
}

seed().catch(console.error);
