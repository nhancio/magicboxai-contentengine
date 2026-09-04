import { PromptEnhanceEngine } from '../src/engine.js';
import { UserEnhanceRequest } from '../src/types.js';

async function runDemo() {
  console.log('===============================================================');
  console.log('🚀 PROMPT ENHANCE ENGINE - AI VIDEO DIRECTING DEMO');
  console.log('===============================================================\n');

  const engine = new PromptEnhanceEngine();

  // Test case matching user's exact query: "make a video on my brand for diwali"
  const userRequest: UserEnhanceRequest = {
    rawPrompt: 'make a video on my brand for diwali',
    brandName: 'Aura Luxe Jewels',
    brandCategory: 'Fine Festive Jewelry & Heritage Craft',
    targetAudience: 'Festive luxury shoppers, couples, and families celebrating Diwali',
    platform: 'instagram_reels',
    aspectRatio: '9:16',
    durationSeconds: 15,
    targetEngine: 'runway_gen3',
  };

  console.log('📥 USER INPUT PROMPT:');
  console.log(`"${userRequest.rawPrompt}"\n`);
  console.log('⚙️ CONTEXT INJECTED:');
  console.log(`- Brand: ${userRequest.brandName} (${userRequest.brandCategory})`);
  console.log(`- Aspect Ratio: ${userRequest.aspectRatio} | Duration: ${userRequest.durationSeconds}s`);
  console.log(`- Target Video Engine: ${userRequest.targetEngine}\n`);

  console.log('⏳ Enhancing prompt with AI Video Cinematography Engine...');
  const blueprint = await engine.enhance(userRequest, { forceFallback: true });

  console.log('\n===============================================================');
  console.log('✨ ENHANCED MULTI-SCENE PRODUCTION BLUEPRINT');
  console.log('===============================================================');
  console.log(`Title: ${blueprint.title}`);
  console.log(`Logline: ${blueprint.logline}`);
  console.log(`\n🎨 VISUAL STYLE GUIDE:`);
  console.log(`- Art Direction: ${blueprint.visualStyleGuide.artDirection}`);
  console.log(`- Color Palette: ${blueprint.visualStyleGuide.colorPalette.join(', ')}`);
  console.log(`- Lighting: ${blueprint.visualStyleGuide.lightingMood}`);
  console.log(`- Lens & Optics: ${blueprint.visualStyleGuide.lensAndOptics}`);

  console.log(`\n🎵 AUDIO BLUEPRINT:`);
  console.log(`- Music: ${blueprint.audioBlueprint.musicDescription}`);
  console.log(`- Pacing: ${blueprint.audioBlueprint.bpmAndPacing}`);

  console.log(`\n🎬 SHOT-BY-SHOT BREAKDOWN (${blueprint.scenes.length} SCENES):`);
  blueprint.scenes.forEach((scene) => {
    console.log(`\n---------------------------------------------------------------`);
    console.log(`[SCENE ${scene.sceneNumber}] (${scene.timestampRange}) - ${scene.sceneObjective.toUpperCase()}`);
    console.log(`Shot Type: ${scene.shotType} | Camera Move: ${scene.cameraMovement}`);
    console.log(`Visual Subject: ${scene.subjectDescription}`);
    console.log(`Lighting: ${scene.lightingAndAtmosphere}`);
    console.log(`Motion/Physics: ${scene.motionAndPhysics}`);
    if (scene.voiceoverLine) console.log(`Voiceover: "${scene.voiceoverLine}"`);
    if (scene.onScreenText) console.log(`On-Screen Text: [${scene.onScreenText}]`);
    console.log(`\n🎯 TARGET VIDEO PROMPT (Runway Gen-3 / Veo format):`);
    console.log(`"${scene.targetEnginePrompt}"`);
  });

  console.log('\n===============================================================');
  console.log('📦 READY-TO-SEND VIDEO GENERATOR API PAYLOADS:');
  console.log('===============================================================');
  console.log('\n--- Runway Gen-3 Alpha Prompt (Scene 1) ---');
  console.log(JSON.stringify(blueprint.modelPayloads.runwayGen3?.[0], null, 2));

  console.log('\n--- Google Veo 2 / 3.1 Prompt (Scene 1) ---');
  console.log(JSON.stringify(blueprint.modelPayloads.googleVeo?.[0], null, 2));

  console.log('\n--- Kling 1.5 / 2.0 Prompt (Scene 1) ---');
  console.log(JSON.stringify(blueprint.modelPayloads.kling?.[0], null, 2));

  console.log('\n✅ Prompt Enhancement Engine Demo Completed Successfully!\n');
}

runDemo().catch(console.error);
