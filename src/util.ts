// Convert a Date object to an ISO 8601 string in the local timezone
export function toISOString(date: Date) {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - tzOffset)).toISOString().slice(0, -1);
}

export function getTimestampedFilename(prefix: string, extension: string) {
    const dateStr = toISOString(new Date());
    const dateStrNums = dateStr.split(".")[0].replace(/[^0-9]/g, "");
    return `${prefix}-${dateStrNums}.${extension}`;
}

export function getStartDate() {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const date = new Date(Date.now() - tzOffset);
    const year = date.getFullYear();
    const month = date.getMonth() < 8 ? "01" : "09";
    return `${year}-${month}-01`;
}

export function getToday() {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const date = new Date(Date.now() - tzOffset);
    return date.toISOString().split("T")[0];
}