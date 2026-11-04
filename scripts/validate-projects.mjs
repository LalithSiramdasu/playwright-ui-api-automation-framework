import { loadProjectRegistry } from '../src/core/project-registry.mjs';

try {
  const projects = loadProjectRegistry();
  console.log(`Validated ${projects.length} project profile(s):`);
  for (const project of projects) {
    const status = project.enabled ? 'configured' : 'template disabled';
    console.log(`- ${project.id} | ${project.type} | ${status} | ${Object.keys(project.environments).join(', ')}`);
  }
  console.log('Profiles validated. Module 2 executes enabled local targets via npm run project:run.');
} catch (error) {
  console.error(`Project profile validation failed: ${error.message}`);
  process.exitCode = 1;
}
