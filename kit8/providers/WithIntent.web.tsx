// Web: a browser page cannot receive share intents, so the provider only passes its children on.
// (uxui.intentInfo and the "what to add?" window still work on web - e.g. for tests.)
import React from 'react';

const WithIntent = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export default WithIntent;
