/** @jest-environment jsdom */
// The web file picker keeps its <input type=file> IN the document until it answers (Firefox loses a detached one: "Add file" did nothing).
import { Platform } from 'react-native';
import { pickFiles } from '../../kit8/files/pickFiles';

describe('pickFiles (web)', () => {
  beforeAll(() => { (Platform as any).OS = 'web'; });
  it('puts the input into the document, clicks it, resolves with the chosen files and removes the input', async () => {
    const clicked = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      expect(document.body.contains(this)).toBe(true);
    });
    const p = pickFiles();
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(clicked).toHaveBeenCalledTimes(1);
    const file = new File(['abc'], 'a.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    const r = await p;
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: 'a.txt', mime: 'text/plain', size: 3 });
    expect(document.querySelector('input[type=file]')).toBeNull();
    clicked.mockRestore();
  });
  it('a cancel gives an empty list', async () => {
    const clicked = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    const p = pickFiles();
    (document.querySelector('input[type=file]') as HTMLInputElement).dispatchEvent(new Event('cancel'));
    expect(await p).toEqual([]);
    clicked.mockRestore();
  });
});
