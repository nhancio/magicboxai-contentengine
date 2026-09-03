import assert from 'node:assert';
import { PromptEnhanceEngine } from '../src/engine.js';
import { UserEnhanceRequest } from '../src/types.js';

async function testPromptEnhanceEngine() {
  const engine = new PromptEnhanceEngine();

  // Test 1: B2B Brand Launch (Domain2Deals) -> Must be Tech/Launch, ZERO Diwali/Diyas
  const reqTech: UserEnhanceRequest = {
    rawPrompt: 'make a video on my brand launch',
    brandName: 'Domain2Deals',
    brandCategory: 'B2B Sales & Marketing Tech',
    targetAudience: 'Businesses and sales teams seeking outreach solutions',
    targetEngine: 'google_veo',
    aspectRatio: '9:16',
    durationSeconds: 8,
  };

  const blueprintTech = await engine.enhance(reqTech, { forceFallback: true });
  assert.ok(blueprintTech, 'Tech blueprint should be generated');
  assert.strictEqual(blueprintTech.scenes.length, 1, 'Single-shot should generate exactly 1 scene');
  assert.strictEqual(blueprintTech.scenes[0].durationSec, 8);
  
  const techPromptLower = blueprintTech.scenes[0].targetEnginePrompt.toLowerCase();
  const techLoglineLower = blueprintTech.logline.toLowerCase();
  assert.ok(!techPromptLower.includes('diwali'), 'Tech prompt must NOT mention Diwali');
  assert.ok(!techPromptLower.includes('diya'), 'Tech prompt must NOT mention Diya');
  assert.ok(!techPromptLower.includes('marigold'), 'Tech prompt must NOT mention Marigold');
  assert.ok(!techLoglineLower.includes('diwali'), 'Tech logline must NOT mention Diwali');
  console.log('✅ Test 1 Passed: Tech/B2B Brand Launch prompt generates pure Tech commercial, zero Diwali!');

  // Test 2: Diwali Request -> Must have authentic Diwali cultural elements
  const reqDiwali: UserEnhanceRequest = {
    rawPrompt: 'make a video on my brand for diwali',
    brandName: 'Aura Luxe Jewels',
    brandCategory: 'Fine Heritage & Festive Jewelry',
    targetEngine: 'google_veo',
    aspectRatio: '9:16',
    durationSeconds: 8,
  };

  const blueprintDiwali = await engine.enhance(reqDiwali, { forceFallback: true });
  assert.ok(blueprintDiwali, 'Diwali blueprint should be generated');
  const diwaliPromptLower = blueprintDiwali.scenes[0].targetEnginePrompt.toLowerCase();
  assert.ok(diwaliPromptLower.includes('diya') || diwaliPromptLower.includes('rangoli') || diwaliPromptLower.includes('festive'), 'Diwali prompt must contain festive elements');
  console.log('✅ Test 2 Passed: Explicit Diwali prompt generates authentic festive campaign!');
}

testPromptEnhanceEngine().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
