// The project of a media post and the words of a delete stopped by a read-only project
import { isReadonlyRefusal, mediaPostProjectGUID, projectNameOfReadonlyError, projectReadonlyDeleteMessage, readonlyDeleteMessageOf } from '../../kit8/ui/components/media/mediaPostProject';

const P = '11111111-2222-3333-4444-555555555555';
const T = '66666666-2222-3333-4444-555555555555';

it('an independent post has no project; project / task / stage / chat files and posts under a project do', () => {
  expect(mediaPostProjectGUID({ rowParentGUID: 'empty', rowJSON: {} })).toBe('');
  expect(mediaPostProjectGUID({ rowParentGUID: P, rowJSON: { fileSourceKind: 'project' } })).toBe(P);
  expect(mediaPostProjectGUID({ rowParentGUID: T, rowJSON: { fileSourceKind: 'task', fileSourceProjectGUID: P } })).toBe(P);
  expect(mediaPostProjectGUID({ rowParentGUID: 'theme', rowJSON: { fileSourceKind: 'chat', fileSourceProjectGUID: P } })).toBe(P);
  expect(mediaPostProjectGUID({ rowParentGUID: 'org', rowJSON: { fileSourceKind: 'organization' } })).toBe('');
  expect(mediaPostProjectGUID({ rowParentGUID: P, rowJSON: { mediaPostTitle: 'x' } })).toBe(P);
  expect(mediaPostProjectGUID(null)).toBe('');
});

it('the refusals of a read-only project are recognised (function reason and database text)', () => {
  expect(isReadonlyRefusal('No permission: files, delete (projectReadonly)')).toBe(true);
  expect(isReadonlyRefusal({ code: '42501', message: 'Read-only project "Railway #1": nothing can be changed (mediaPostTable).' })).toBe(true);
  expect(isReadonlyRefusal('You have no permission to change files here.')).toBe(false);
  expect(projectNameOfReadonlyError({ message: 'Read-only project "Railway #1": nothing can be changed' })).toBe('Railway #1');
});

it('the snack bar says the project name, the one the list knows first, else the one in the database text', () => {
  expect(projectReadonlyDeleteMessage('Railway #1')).toBe('Delete process stopped! This media post belongs to the Project Railway #1 and Project is readonly now ');
  expect(readonlyDeleteMessageOf('No permission: files, delete (projectReadonly)', 'Alpha')).toContain('the Project Alpha and Project is readonly now');
  expect(readonlyDeleteMessageOf({ message: 'Read-only project "Beta": nothing can be changed' })).toContain('the Project Beta and');
  expect(readonlyDeleteMessageOf('some other error', 'Alpha')).toBeNull();
});
