import { doRequestOp } from "./doRequestOp";
import { dedupeInFlight } from "./inFlight";

const URL_PATH = "/state/settings";
const SERVICE_NAME = "settings";

// Several startup components (home, UI preference banner, prefs sync) read settings at once.
export const fetchUserSettings = dedupeInFlight(async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/get",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
});

export const saveUserSettings = async (settings: any) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/save",
        data: { settings: settings },
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
}
