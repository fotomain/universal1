// "Copy line GUID" of the Finances table: the GUID goes to the clipboard and a snackbar says so.
const mockSet = jest.fn(async (_t: string) => true);
jest.mock('expo-clipboard', () => ({ setStringAsync: (t: string) => mockSet(t) }));
import { copyLineGUID } from '../../../kit8/pm/view/task/finances/copyLineGuid';

afterEach(() => jest.clearAllMocks());

it('puts the GUID on the clipboard and shows a snackbar with it', async () => {
  const dispatch = jest.fn();
  await expect(copyLineGUID('1ea2b3c4-0000-4000-8000-000000000001', dispatch)).resolves.toBe(true);
  expect(mockSet).toHaveBeenCalledWith('1ea2b3c4-0000-4000-8000-000000000001');
  const action = dispatch.mock.calls[0][0];
  expect(JSON.stringify(action)).toContain('1ea2b3c4-0000-4000-8000-000000000001');
});

it('an empty GUID is not copied', async () => {
  const dispatch = jest.fn();
  await expect(copyLineGUID('', dispatch)).resolves.toBe(false);
  expect(mockSet).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
});

it('a clipboard that refuses is false, no snackbar', async () => {
  mockSet.mockRejectedValueOnce(new Error('denied'));
  const dispatch = jest.fn();
  await expect(copyLineGUID('g', dispatch)).resolves.toBe(false);
  expect(dispatch).not.toHaveBeenCalled();
});
