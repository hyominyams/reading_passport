import { createServiceClient, parseArgs, printUsage } from './_repair-utils.mjs';

const DEMO_ACCOUNTS = [
  {
    role: 'admin',
    email: 'admin@worlddocent.com',
    password: 'admin1234',
    match: { field: 'email', value: 'admin@worlddocent.com' },
  },
  {
    role: 'teacher',
    email: 'teacher@worlddocent.com',
    password: 'teacher1234',
    match: { field: 'email', value: 'teacher@worlddocent.com' },
  },
  {
    role: 'student',
    email: 'student1@worlddocent.com',
    password: 'student1234',
    match: { field: 'student_code', value: '123456' },
  },
];

async function getProfile(supabase, account) {
  const { field, value } = account.match;
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role, student_code, nickname')
    .eq(field, value)
    .eq('role', account.role)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function ensureAuthUser(supabase, profile, account, apply) {
  const { data: authResult, error: authLookupError } = await supabase.auth.admin.getUserById(profile.id);

  if (authLookupError) {
    throw authLookupError;
  }

  if (!authResult?.user) {
    console.log(`[auth:create] ${account.role} ${account.email}`);
    if (!apply) {
      return;
    }

    const { error: createError } = await supabase.auth.admin.createUser({
      id: profile.id,
      email: account.email,
      password: account.password,
      email_confirm: true,
      app_metadata: {
        role: account.role,
      },
      user_metadata: {
        nickname: profile.nickname,
        student_code: profile.student_code,
      },
    });

    if (createError) {
      throw createError;
    }

    return;
  }

  console.log(`[auth:update] ${account.role} ${account.email}`);
  if (!apply) {
    return;
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(profile.id, {
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: {
      ...(authResult.user.user_metadata ?? {}),
      nickname: profile.nickname,
      student_code: profile.student_code,
    },
  });

  if (updateError) {
    throw updateError;
  }
}

async function ensureProfileEmail(supabase, profile, account, apply) {
  if (profile.email === account.email) {
    return;
  }

  console.log(`[profile:update] ${account.role} ${profile.email ?? '-'} -> ${account.email}`);
  if (!apply) {
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ email: account.email })
    .eq('id', profile.id);

  if (error) {
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printUsage([
      'Usage: node scripts/repair-demo-auth.mjs [--apply]',
      '',
      'Ensures seeded demo auth accounts exist with the expected emails/passwords:',
      '- admin@worlddocent.com / admin1234',
      '- teacher@worlddocent.com / teacher1234',
      '- student1@worlddocent.com / student1234',
      '',
      'Default mode is dry-run. Pass --apply to write changes.',
    ]);
    return;
  }

  const supabase = createServiceClient();

  for (const account of DEMO_ACCOUNTS) {
    const profile = await getProfile(supabase, account);

    if (!profile) {
      console.log(`[skip] Missing ${account.role} profile for ${account.match.field}=${account.match.value}`);
      continue;
    }

    await ensureProfileEmail(supabase, profile, account, args.apply);
    await ensureAuthUser(supabase, profile, account, args.apply);
  }

  console.log(args.apply ? 'Demo auth repair complete.' : 'Dry run complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
