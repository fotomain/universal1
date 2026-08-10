import { useState, useEffect } from "react";

export function useMD3() {
    const [ready, setReady] = useState(true);
    return ready;
}
