import fs from 'fs';
import path from 'path';

describe('posts route alias', () => {
  it('keeps the /posts route pointing to the media posts screen', () => {
    const filePath = path.join(__dirname, '..', 'app', 'posts', 'index.tsx');

    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('Redirect');
    expect(content).toContain('/posts/mediapostcrud');
  });
});
