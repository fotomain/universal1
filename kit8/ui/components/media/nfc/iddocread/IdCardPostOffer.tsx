// "Create media post" after an ID card / passport was read: the post carries the NAME of the owner (title), the DOCUMENT NUMBER (sub title), ALL the data of
// the document (description + `idCardFields`) and the owner PHOTO (a JPEG is drawn by the list; any format also goes to the file storage).
// Nothing is saved unless the user presses the button.
import React, { useState } from 'react';
import IdCardPostCreated from './IdCardPostCreated';
import ResultPostOffer from '../../common/ResultPostOffer';
import { useWriteMediaPost } from '../../common/useWriteMediaPost';
import { buildIdCardPost, idDocumentFolder } from '../../common/notePost';
import { identificationPath, uploadIdentificationPhoto } from '../../../../../files/common/identificationPhoto';
import { bytesToBase64 } from './crypto/bytes';
import { idCardFields } from './idCardFields';
import { jp2ToJpegDataUri } from './jp2ToJpeg';
import { countryName } from './countries';
import { fullDate } from './mrz';
import type { IdDocument } from './emrtd';

/** 'GIVEN NAMES SURNAME' of the zone, '' when there is no zone */
export function ownerNameOf(doc: IdDocument): string {
  const m = doc.mrz;
  return m ? [m.givenNames, m.surname].map((x) => (x ?? '').trim()).filter(Boolean).join(' ') : '';
}

export default function IdCardPostOffer({ doc, upload = uploadIdentificationPhoto }: { doc: IdDocument; /** replaceable for tests */ upload?: typeof uploadIdentificationPhoto }) {
  const write = useWriteMediaPost();
  const [note, setNote] = useState('');
  const m = doc.mrz;
  if (!m) return null;
  const folder = idDocumentFolder(m.documentCode);
  return (
    <ResultPostOffer
      testID="id-post"
      savedNote={note}
      renderSavedScreen={({ close, openPosts }) => (
        <IdCardPostCreated photo={doc.photo} ownerName={ownerNameOf(doc)} givenNames={m.givenNames} surname={m.surname} documentNumber={m.documentNumber.value.replace(/</g, '')} note={note} onOpenPosts={openPosts} onClose={close} />
      )}
      onCreate={async () => {
        // the picture of the post: a JPEG as it is; a JPEG 2000 (Latvian passports) is converted to a JPEG, Android cannot draw it. The ORIGINAL goes to the storage below.
        const pic = doc.photo ? (doc.photo.mime === 'image/jpeg' ? `data:image/jpeg;base64,${bytesToBase64(doc.photo.bytes)}` : jp2ToJpegDataUri(doc.photo.bytes, bytesToBase64)) : null;
        const fields = [...idCardFields(doc), ...(doc.photo && !pic ? [{ label: 'Photo', value: 'in the file storage (JPEG 2000: this phone cannot draw it)' }] : [])];
        const post = await write(
          (c) => buildIdCardPost({ ...c, fields, photoDataUri: pic ?? undefined, ownerName: ownerNameOf(doc), documentNumber: m.documentNumber.value.replace(/</g, ''), documentCode: m.documentCode, nationality: countryName(m.nationality), expiryDate: fullDate(m.expiryDate.value, 'expiry').split('-').reverse().join('.') }),
          'ID card result',
        );
        // the owner photo of the chip goes to the file storage of the organization: identification/<idcard | passport>/<post guid>.<ext>. The post stays when the photo cannot be saved.
        if (!doc.photo) {
          setNote('The document has no photo to save.');
        } else {
          const r = await upload(post.rowGUID as string, { mime: doc.photo.mime, bytes: doc.photo.bytes }, bytesToBase64);
          setNote(r.ok ? `Owner photo saved to the file storage: ${identificationPath(folder)}/${post.rowGUID}` : `The owner photo was NOT saved: ${r.error}`);
        }
        return post;
      }}
    />
  );
}
