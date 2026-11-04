/** Module 9: audit approved sandbox configuration and acceptance mappings, without network traffic. */
import { auditPilotProjects } from '../src/core/pilot-audit.mjs';
try {
  const results = auditPilotProjects();
  for (const pilot of results) console.log(`${pilot.projectId}: ${pilot.cases} mapped safe tests, approved HTTPS host ${pilot.host}`);
  console.log('Pilot static audit passed; live remote Playwright tests are opt-in and were NOT executed.');
} catch (error) {
  console.error(`Pilot audit failed: ${error.message}`);
  process.exitCode = 1;
}
