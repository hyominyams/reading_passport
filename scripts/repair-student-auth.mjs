import {
  createServiceClient,
  parseArgs,
  printUsage,
  randomPassword,
  stableStudentEmail,
} from './_repair-utils.mjs';

const args = parseArgs(process.argv);

function generateStudentCode() {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function nextUniqueCode(existingCodes) {
  let code = generateStudentCode();
  while (existingCodes.has(code)) {
    code = generateStudentCode();
  }
  existingCodes.add(code);
  return code;
}

async function main() {
  if (args.help) {
    printUsage([
      'Usage: npm run repair:students -- [--apply] [--limit N]',
      '',
      'Scans student profiles and repairs missing auth users, internal emails,',
      'and duplicate/invalid 6-digit codes.',
      '',
      'Default mode is dry-run. Pass --apply to write changes.',
    ]);
    return;
  }

  const supabase = createServiceClient();

  const { data: studentsData, error } = await supabase
    .from('users')
    .select('id, email, student_code, teacher_id, nickname, class, school, grade')
    .eq('role', 'student')
    .limit(args.limit ?? 100000);

  if (error) {
    throw error;
  }

  const students = studentsData ?? [];
  const codeCounts = new Map();

  for (const student of students) {
    if (student.student_code) {
      codeCounts.set(student.student_code, (codeCounts.get(student.student_code) ?? 0) + 1);
    }
  }

  const assignedCodes = new Set();
  let repairedAuthUsers = 0;
  let repairedProfiles = 0;
  let repairedCodes = 0;

  for (const student of students) {
    const internalEmail = stableStudentEmail(student.id);
    const currentCode = student.student_code;
    const validUniqueCode =
      typeof currentCode === 'string' &&
      /^\d{6}$/.test(currentCode) &&
      (codeCounts.get(currentCode) ?? 0) === 1 &&
      !assignedCodes.has(currentCode);
    const desiredCode = validUniqueCode
      ? currentCode
      : nextUniqueCode(assignedCodes);

    if (validUniqueCode) {
      assignedCodes.add(currentCode);
    }

    const { data: authResult, error: authLookupError } = await supabase.auth.admin.getUserById(student.id);
    const authUser = authResult?.user ?? null;

    if (authLookupError) {
      console.log(`[auth:lookup-error] ${student.nickname ?? student.id} -> ${authLookupError.message}`);
    }

    if (!authUser) {
      console.log(`[auth:create] ${student.nickname ?? student.id} -> ${internalEmail}`);
      if (!args.dryRun) {
        const { error: createError } = await supabase.auth.admin.createUser({
          id: student.id,
          email: internalEmail,
          password: randomPassword(),
          email_confirm: true,
          user_metadata: {
            nickname: student.nickname,
            student_code: desiredCode,
            teacher_id: student.teacher_id,
          },
          app_metadata: {
            role: 'student',
          },
        });

        if (createError) {
          console.error(`  failed: ${createError.message}`);
          continue;
        }
      }
      repairedAuthUsers += 1;
    } else if (authUser.email !== internalEmail) {
      console.log(`[auth:update] ${student.nickname ?? student.id} ${authUser.email ?? '-'} -> ${internalEmail}`);
      if (!args.dryRun) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(student.id, {
          email: internalEmail,
          email_confirm: true,
          user_metadata: {
            ...(authUser.user_metadata ?? {}),
            nickname: student.nickname,
            student_code: desiredCode,
            teacher_id: student.teacher_id,
          },
        });

        if (updateError) {
          console.error(`  failed: ${updateError.message}`);
          continue;
        }
      }
      repairedAuthUsers += 1;
    }

    const profilePatch = {};

    if (student.email !== internalEmail) {
      profilePatch.email = internalEmail;
    }

    if (currentCode !== desiredCode) {
      profilePatch.student_code = desiredCode;
      repairedCodes += 1;
    }

    if (Object.keys(profilePatch).length > 0) {
      console.log(`[profile:update] ${student.nickname ?? student.id}`, profilePatch);
      if (!args.dryRun) {
        const { error: profileError } = await supabase
          .from('users')
          .update(profilePatch)
          .eq('id', student.id);

        if (profileError) {
          console.error(`  failed: ${profileError.message}`);
          continue;
        }
      }
      repairedProfiles += 1;
    }
  }

  console.log(
    dryRun
      ? `Dry run complete. Would repair auth=${repairedAuthUsers}, profiles=${repairedProfiles}, codes=${repairedCodes}.`
      : `Repair complete. Repaired auth=${repairedAuthUsers}, profiles=${repairedProfiles}, codes=${repairedCodes}.`
  );
}

const dryRun = args.dryRun;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
