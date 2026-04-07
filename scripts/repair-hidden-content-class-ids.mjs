import {
  createServiceClient,
  parseArgs,
  printUsage,
} from './_repair-utils.mjs';

const args = parseArgs(process.argv);

function generateClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function findOrCreateClassRecord(supabase, teacherId, className, school, grade) {
  const { data: existing, error: lookupError } = await supabase
    .from('classes')
    .select('id, teacher_id, class_name, school, grade')
    .eq('teacher_id', teacherId)
    .eq('class_name', className)
    .limit(1);

  if (lookupError) {
    throw lookupError;
  }

  if (existing?.[0]) {
    return existing[0];
  }

  const { data, error } = await supabase
    .from('classes')
    .insert({
      teacher_id: teacherId,
      class_code: generateClassCode(),
      school,
      grade,
      class_name: className,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function main() {
  if (args.help) {
    printUsage([
      'Usage: npm run repair:hidden-content -- [--apply] [--limit N]',
      '',
      'Backfills class-scoped hidden content rows so `class_id` points to a',
      'real classes row for the content creator teacher/class combination.',
      '',
      'Default mode is dry-run. Pass --apply to write changes.',
    ]);
    return;
  }

  const supabase = createServiceClient();

  const { data: rows, error } = await supabase
    .from('hidden_content')
    .select('id, title, created_by, scope, class_id, approved')
    .eq('scope', 'class')
    .limit(args.limit ?? 100000);

  if (error) {
    throw error;
  }

  const items = rows ?? [];
  let repaired = 0;

  for (const item of items) {
    let classNeedsRepair = !item.class_id;

    if (!classNeedsRepair) {
      const { data: classRow } = await supabase
        .from('classes')
        .select('id')
        .eq('id', item.class_id)
        .maybeSingle();

      classNeedsRepair = !classRow;
    }

    const approvalNeedsRepair = !item.approved;
    if (!classNeedsRepair && !approvalNeedsRepair) {
      continue;
    }

    const { data: creator, error: creatorError } = await supabase
      .from('users')
      .select('id, role, teacher_id, class, school, grade')
      .eq('id', item.created_by)
      .single();

    if (creatorError || !creator) {
      console.log(`[skip] ${item.title} -> creator not found`);
      continue;
    }

    const teacherId =
      creator.role === 'teacher' || creator.role === 'admin'
        ? creator.id
        : creator.teacher_id;

    if (!teacherId) {
      console.log(`[skip] ${item.title} -> missing teacher mapping`);
      continue;
    }

    const className = creator.class?.trim() || '기본반';
    const school = creator.school?.trim() || '미정';
    const grade = creator.grade && creator.grade > 0 ? creator.grade : 1;
    const classRecord = await findOrCreateClassRecord(
      supabase,
      teacherId,
      className,
      school,
      grade
    );

    console.log(
      `[repair] ${item.title} class_id=${item.class_id ?? '-'} -> ${classRecord.id}`
    );

    if (!args.dryRun) {
      const patch = {
        class_id: classRecord.id,
        approved: true,
      };

      const { error: updateError } = await supabase
        .from('hidden_content')
        .update(patch)
        .eq('id', item.id);

      if (updateError) {
        console.error(`  failed: ${updateError.message}`);
        continue;
      }
    }

    repaired += 1;
  }

  console.log(
    dryRun
      ? `Dry run complete. Would repair ${repaired} hidden content rows.`
      : `Repair complete. Repaired ${repaired} hidden content rows.`
  );
}

const dryRun = args.dryRun;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
