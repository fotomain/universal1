type AnyObject = { [key: string]: any };

type Result =
    | { type: "not_found"; value: null }
    | { type: "multiple"; value: any[] }
    | { type: "single"; value: any; updatedObject: AnyObject };

function updateNestedJSONField(
    obj: AnyObject,
    targetKey: string,
    newValue: any
): Result {
    let count = 0;
    const values: any[] = [];

    function scan(current: any) {
        if (Array.isArray(current)) {
            current.forEach(scan);
            return;
        }

        if (current && typeof current === "object") {
            for (const key in current) {
                if (key === targetKey) {
                    count++;
                    values.push(current[key]);
                }
                scan(current[key]);
            }
        }
    }

    scan(obj);

    // ❌ Not found
    if (count === 0) {
        return { type: "not_found", value: null };
    }

    // ⚠️ Multiple found → return all
    if (count > 1) {
        return { type: "multiple", value: values };
    }

    // ✅ Exactly one → update + return value
    function update(current: any): any {
        if (Array.isArray(current)) {
            return current.map(update);
        }

        if (current && typeof current === "object") {
            const result: AnyObject = {};

            for (const key in current) {
                if (key === targetKey) {
                    result[key] = newValue;
                } else {
                    result[key] = update(current[key]);
                }
            }

            return result;
        }

        return current;
    }

    return {
        type: "single",
        value: values[0], // 👈 this is your "year"
        updatedObject: update(obj),
    };
}

export {updateNestedJSONField}