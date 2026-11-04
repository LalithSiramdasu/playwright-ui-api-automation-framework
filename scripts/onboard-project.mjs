#!/usr/bin/env node
/** Safe project onboarding: preview by default. --write creates disabled profiles only. */
import { planProjectOnboarding, writeProjectOnboarding } from '../src/core/project-onboarding.mjs';

function parse(argv) {
  const fields = { '--project': 'id', '--name': 'name', '--type': 'type', '--url': 'url' };
  const input = {};
  let write = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--write') { if (write) throw Error('--write supplied more than once'); write = true; continue; }
    if (!Object.hasOwn(fields, arg) || input[fields[arg]] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      throw Error(`Invalid argument '${arg}'. Use --project ID --name NAME --type web|api --url HTTPS_URL [--write]`);
    }
    input[fields[arg]] = argv[++i];
  }
  if (Object.keys(input).length !== 4) throw Error('Required: --project, --name, --type and --url');
  return { input, write };
}

try {
  const args = parse(process.argv.slice(2));
  const plan = planProjectOnboarding(args.input);
  const outcome = writeProjectOnboarding(plan, { write: args.write });
  console.log(`Project: ${plan.name} (${plan.id}) — ${plan.type}, approved-target candidate ${plan.host}`);
  console.log(`${args.write ? 'Created' : 'PREVIEW ONLY (no files written)'}: ${outcome.projectDir}`);
  for (const path of outcome.files) console.log(`  ${path}`);
  console.log(args.write
    ? 'New project is DISABLED and contains only TODO tests. Complete approval and real assertions before activation.'
    : 'Add --write only when ready to create these disabled, offline project files.');
} catch (error) {
  console.error(`Project onboarding rejected: ${error.message}`);
  process.exitCode = 1;
}
