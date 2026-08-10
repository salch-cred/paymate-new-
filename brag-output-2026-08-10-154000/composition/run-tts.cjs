const { spawnSync } = require('child_process');

const scenes = [
  { file: 'voice_s2.wav', text: 'Describe the work in plain language. PayMate structures it into a client-ready payment request — instantly.' },
  { file: 'voice_s3.wav', text: 'Your client gets a secure payment link. One click. USDC settles directly to your wallet on the GOAT Network.' },
  { file: 'voice_s4.wav', text: 'Every verified settlement builds your ERC-8004 reputation. Portable proof of your work — on-chain, forever.' },
  { file: 'voice_s5.wav', text: 'PayMate. Work, Settled.' }
];

for (const scene of scenes) {
  console.log(`Generating ${scene.file}...`);
  spawnSync('npx.cmd', ['hyperframes', 'tts', '--voice', 'af_heart', '--output', `assets/${scene.file}`], {
    input: scene.text,
    stdio: ['pipe', 'inherit', 'inherit']
  });
}
console.log('Done!');
