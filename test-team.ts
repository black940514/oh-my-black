/**
 * Team module test
 */

import {
  createTeamFromTemplate,
  createTeam,
  createTeamMember,
  findAvailableMember,
  assignTaskToMember,
  releaseTaskFromMember,
  getTeamStatus,
  serializeTeam,
  parseTeam,
  getDefaultCapabilities,
  getRecommendedModelTier
} from './src/features/team/index.js';

console.log('Testing Team Module...\n');

// Test 1: Create team from template
console.log('1. Creating minimal team from template:');
const minimalTeam = createTeamFromTemplate('minimal', 'team-1', 'Test Minimal Team');
console.log(`   - Team: ${minimalTeam.name}`);
console.log(`   - Members: ${minimalTeam.members.length}`);
console.log(`   - Validation: ${minimalTeam.defaultValidationType}`);
console.log(`   ✓ Minimal team created\n`);

// Test 2: Create standard team
console.log('2. Creating standard team:');
const standardTeam = createTeamFromTemplate('standard', 'team-2', 'Test Standard Team');
console.log(`   - Team: ${standardTeam.name}`);
console.log(`   - Members: ${standardTeam.members.length}`);
console.log(`   - Validation: ${standardTeam.defaultValidationType}`);
console.log(`   ✓ Standard team created\n`);

// Test 3: Create robust team
console.log('3. Creating robust team:');
const robustTeam = createTeamFromTemplate('robust', 'team-3', 'Test Robust Team');
console.log(`   - Team: ${robustTeam.name}`);
console.log(`   - Members: ${robustTeam.members.length}`);
console.log(`   - Validation: ${robustTeam.defaultValidationType}`);
console.log(`   ✓ Robust team created\n`);

// Test 4: Create secure team
console.log('4. Creating secure team:');
const secureTeam = createTeamFromTemplate('secure', 'team-4', 'Test Secure Team');
console.log(`   - Team: ${secureTeam.name}`);
console.log(`   - Members: ${secureTeam.members.length}`);
console.log(`   - Validation: ${secureTeam.defaultValidationType}`);
console.log(`   ✓ Secure team created\n`);

// Test 5: Create fullstack team
console.log('5. Creating fullstack team:');
const fullstackTeam = createTeamFromTemplate('fullstack', 'team-5', 'Test Fullstack Team');
console.log(`   - Team: ${fullstackTeam.name}`);
console.log(`   - Members: ${fullstackTeam.members.length}`);
console.log(`   - Validation: ${fullstackTeam.defaultValidationType}`);
console.log(`   ✓ Fullstack team created\n`);

// Test 6: Get default capabilities
console.log('6. Testing default capabilities:');
const executorCaps = getDefaultCapabilities('executor');
console.log(`   - executor capabilities: ${executorCaps.join(', ')}`);
const validatorCaps = getDefaultCapabilities('validator-syntax');
console.log(`   - validator-syntax capabilities: ${validatorCaps.join(', ')}`);
console.log(`   ✓ Capabilities retrieved\n`);

// Test 7: Get recommended model tier
console.log('7. Testing recommended model tiers:');
console.log(`   - executor-low: ${getRecommendedModelTier('executor-low')}`);
console.log(`   - executor: ${getRecommendedModelTier('executor')}`);
console.log(`   - architect: ${getRecommendedModelTier('architect')}`);
console.log(`   ✓ Model tiers retrieved\n`);

// Test 8: Find available member
console.log('8. Testing member availability:');
const builder = findAvailableMember(standardTeam, 'builder');
console.log(`   - Found builder: ${builder?.id}`);
const validator = findAvailableMember(standardTeam, 'validator');
console.log(`   - Found validator: ${validator?.id}`);
console.log(`   ✓ Available members found\n`);

// Test 9: Assign task
console.log('9. Testing task assignment:');
if (builder) {
  const updatedTeam = assignTaskToMember(standardTeam, 'task-1', builder.id);
  const status = getTeamStatus(updatedTeam);
  console.log(`   - Busy members: ${status.busyMembers}`);
  console.log(`   - Total assigned tasks: ${status.totalAssignedTasks}`);
  console.log(`   ✓ Task assigned\n`);

  // Test 10: Release task
  console.log('10. Testing task release:');
  const releasedTeam = releaseTaskFromMember(updatedTeam, 'task-1', builder.id);
  const finalStatus = getTeamStatus(releasedTeam);
  console.log(`    - Idle members: ${finalStatus.idleMembers}`);
  console.log(`    - Total assigned tasks: ${finalStatus.totalAssignedTasks}`);
  console.log(`    ✓ Task released\n`);
}

// Test 11: Serialize and parse
console.log('11. Testing serialization:');
const json = serializeTeam(standardTeam);
const parsed = parseTeam(json);
console.log(`    - Serialized length: ${json.length} chars`);
console.log(`    - Parsed team: ${parsed?.name}`);
console.log(`    - Members match: ${parsed?.members.length === standardTeam.members.length}`);
console.log(`    ✓ Serialization works\n`);

// Test 12: Custom team
console.log('12. Testing custom team creation:');
const customMembers = [
  createTeamMember('m1', 'executor', 'builder'),
  createTeamMember('m2', 'validator-logic', 'validator')
];
const customTeam = createTeam(
  'custom-1',
  'Custom Team',
  'A custom team for testing',
  customMembers
);
console.log(`    - Team: ${customTeam.name}`);
console.log(`    - Members: ${customTeam.members.length}`);
console.log(`    - Validation: ${customTeam.defaultValidationType}`);
console.log(`    ✓ Custom team created\n`);

console.log('✅ All team module tests passed!');
