import { createHmac } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const prompt = createInterface({ input: stdin, output: stdout });
const pepper = await prompt.question('SITE_CODE_PEPPER: ');
const siteCode = await prompt.question('Site Code: ');
prompt.close();

if (!pepper || !siteCode.trim()) {
  throw new Error('Both values are required.');
}

const accessCodeHash = createHmac('sha256', pepper)
  .update(siteCode.trim().toUpperCase())
  .digest('hex');

console.log(`accessCodeHash: ${accessCodeHash}`);
